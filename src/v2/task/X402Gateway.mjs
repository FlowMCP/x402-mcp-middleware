// X402 Gateway v2 for MCP
// Implements X402 v2 MCP Transport:
// - PaymentRequired: JSON-RPC error 402 with error.data
// - Payment: params._meta["x402/payment"]
// - Response: result._meta["x402/payment-response"]

import { JsonRpc, Meta } from '../mcp/index.mjs'
import { ClientExact, ServerExact } from 'x402-core/v2/exact/evm'


class X402Gateway {
    static mcp( { paymentRequiredCache, serverExactPool, config } ) {
        const {
            paymentMetaKey = Meta.DEFAULT_PAYMENT_KEY,
            paymentResponseMetaKey = Meta.DEFAULT_PAYMENT_RESPONSE_KEY,
            simulateBeforeSettle = true
        } = config

        return async function x402Middleware( req, res, next ) {
            const body = req.body

            // Check if notification (no id) - pass through without response
            const { isNotification } = JsonRpc.isNotification( { request: body } )
            if( isNotification ) {
                return next()
            }

            const { id, method, params } = body

            // Only intercept tools/call
            if( method !== 'tools/call' ) {
                return next()
            }

            const toolName = params?.name
            if( !toolName ) {
                return next()
            }

            // Check if this tool is restricted
            const { paymentRequiredPayload, isRestricted } = paymentRequiredCache
                .get( { method: 'tools/call', name: toolName } )

            if( !isRestricted ) {
                return next()
            }

            // Tool is restricted - check for payment
            const { paymentPayload, paymentFound } = Meta
                .getPaymentFromMeta( { params, paymentMetaKey } )

            if( !paymentFound ) {
                // No payment provided - return 402
                const { errorData } = Meta
                    .createPaymentRequiredErrorData( { paymentRequiredPayload } )
                const { response } = JsonRpc
                    .createPaymentRequiredResponse( { id, paymentRequiredPayload: errorData } )

                return res.status( 200 ).json( response )
            }

            // Validate payment payload
            const validationResult = await X402Gateway
                .#validatePayment( { paymentPayload, paymentRequiredPayload, serverExactPool, simulateBeforeSettle } )

            if( !validationResult.valid ) {
                const { response } = JsonRpc
                    .createErrorResponse( {
                        id,
                        code: validationResult.errorCode,
                        message: validationResult.errorMessage,
                        data: validationResult.errorData
                    } )

                return res.status( 200 ).json( response )
            }

            // Store settlement context for response interceptor
            res.locals.x402 = {
                paymentPayload,
                paymentRequiredPayload,
                matchedRequirement: validationResult.matchedRequirement,
                serverExact: validationResult.serverExact
            }

            // Wrap res.json to intercept response
            const originalJson = res.json.bind( res )
            res.json = async function( responseBody ) {
                const x402Context = res.locals.x402

                if( !x402Context ) {
                    return originalJson( responseBody )
                }

                // Check if response is an error
                if( responseBody.error ) {
                    return originalJson( responseBody )
                }

                // Attempt settlement
                const settlementResult = await X402Gateway
                    .#settlePayment( {
                        paymentPayload: x402Context.paymentPayload,
                        matchedRequirement: x402Context.matchedRequirement,
                        serverExact: x402Context.serverExact
                    } )

                if( !settlementResult.ok ) {
                    // Settlement failed - return 402 with failure details
                    const { mergedErrorData } = Meta
                        .mergePaymentResponseIntoError( {
                            errorData: x402Context.paymentRequiredPayload,
                            paymentResponse: settlementResult.settlementResponse,
                            paymentResponseMetaKey
                        } )

                    const { response } = JsonRpc
                        .createPaymentRequiredResponse( { id: responseBody.id, paymentRequiredPayload: mergedErrorData } )

                    return originalJson( response )
                }

                // Settlement successful - merge payment response into result
                const { mergedResult } = Meta
                    .mergePaymentResponseIntoResult( {
                        result: responseBody.result,
                        paymentResponse: settlementResult.settlementResponse,
                        paymentResponseMetaKey
                    } )

                responseBody.result = mergedResult

                return originalJson( responseBody )
            }

            return next()
        }
    }


    static async #validatePayment( { paymentPayload, paymentRequiredPayload, serverExactPool, simulateBeforeSettle } ) {
        try {
            // Validate payload structure
            const { validationOk: shapeOk, validationIssueList: shapeIssues } = ClientExact
                .validatePaymentRequiredResponsePayload( { paymentRequiredResponsePayloadToValidate: paymentPayload } )

            // Extract network from payment
            const { accepted } = paymentPayload
            if( !accepted || !accepted.network ) {
                return {
                    valid: false,
                    errorCode: JsonRpc.ErrorCodes.INVALID_PARAMS,
                    errorMessage: 'Missing network in payment payload',
                    errorData: null
                }
            }

            const paymentNetworkId = accepted.network

            // Get ServerExact for this network
            const { serverExact, found } = serverExactPool
                .get( { paymentNetworkId } )

            if( !found ) {
                return {
                    valid: false,
                    errorCode: JsonRpc.ErrorCodes.INVALID_PARAMS,
                    errorMessage: `Unsupported payment network: ${paymentNetworkId}`,
                    errorData: null
                }
            }

            // Validate payment against requirements
            const { paymentSignatureRequestPayloadValidationOutcome } = await serverExact
                .validatePaymentSignatureRequestPayload( {
                    decodedPaymentSignatureRequestPayloadToValidate: paymentPayload,
                    paymentRequiredResponsePayload: paymentRequiredPayload
                } )

            if( !paymentSignatureRequestPayloadValidationOutcome.validationOk ) {
                return {
                    valid: false,
                    errorCode: JsonRpc.ErrorCodes.INVALID_PARAMS,
                    errorMessage: 'Payment validation failed',
                    errorData: paymentSignatureRequestPayloadValidationOutcome.validationIssueList
                }
            }

            const { matchedPaymentRequirementsFromClientPayload } = paymentSignatureRequestPayloadValidationOutcome

            // Optional simulation
            if( simulateBeforeSettle ) {
                const { paymentSimulationOutcome } = await serverExact
                    .simulateTransaction( {
                        decodedPaymentSignatureRequestPayload: paymentPayload,
                        matchedPaymentRequirementsFromClientPayload
                    } )

                if( !paymentSimulationOutcome.simulationOk ) {
                    return {
                        valid: false,
                        errorCode: JsonRpc.ErrorCodes.INTERNAL_ERROR,
                        errorMessage: 'Payment simulation failed',
                        errorData: { simulationError: paymentSimulationOutcome.simulationError }
                    }
                }
            }

            return {
                valid: true,
                serverExact,
                matchedRequirement: matchedPaymentRequirementsFromClientPayload
            }
        } catch( e ) {
            return {
                valid: false,
                errorCode: JsonRpc.ErrorCodes.INTERNAL_ERROR,
                errorMessage: `Validation error: ${e.message}`,
                errorData: null
            }
        }
    }


    static async #settlePayment( { paymentPayload, matchedRequirement, serverExact } ) {
        try {
            const { paymentSettlementOutcome } = await serverExact
                .settleTransaction( {
                    decodedPaymentSignatureRequestPayload: paymentPayload,
                    matchedPaymentRequirementsFromClientPayload: matchedRequirement
                } )

            if( !paymentSettlementOutcome.settlementOk ) {
                return {
                    ok: false,
                    settlementResponse: paymentSettlementOutcome.settlementResponse
                }
            }

            return {
                ok: true,
                settlementResponse: paymentSettlementOutcome.settlementResponse
            }
        } catch( e ) {
            return {
                ok: false,
                settlementResponse: {
                    success: false,
                    errorReason: e.message
                }
            }
        }
    }
}


export { X402Gateway }
