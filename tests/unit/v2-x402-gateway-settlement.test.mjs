import { describe, test, expect, jest, beforeEach } from '@jest/globals'


const mockValidatePaymentRequiredResponsePayload = jest.fn()

jest.unstable_mockModule( 'x402-core/v2/exact/evm', () => ( {
    ClientExact: {
        validatePaymentRequiredResponsePayload: mockValidatePaymentRequiredResponsePayload
    },
    ServerExact: {}
} ) )

const { X402Gateway } = await import( '../../src/v2/task/X402Gateway.mjs' )


describe( 'V2 X402Gateway settlement flow', () => {
    const MOCK_PAYMENT_REQUIRED = {
        x402Version: 2,
        accepts: [ { scheme: 'exact', network: 'eip155:84532' } ]
    }

    const MOCK_PAYMENT_PAYLOAD = {
        x402Version: 2,
        accepted: {
            scheme: 'exact',
            network: 'eip155:84532',
            amount: '100000'
        },
        payload: {
            authorization: { from: '0xSender', to: '0xPayTo' },
            signature: '0xSig'
        }
    }

    let mockCache
    let mockPool
    let mockServerExact
    let mockReq
    let mockRes
    let mockNext
    let middleware
    let originalJson


    beforeEach( () => {
        jest.clearAllMocks()

        mockServerExact = {
            validatePaymentSignatureRequestPayload: jest.fn().mockResolvedValue( {
                paymentSignatureRequestPayloadValidationOutcome: {
                    validationOk: true,
                    matchedPaymentRequirementsFromClientPayload: { matched: true }
                }
            } ),
            simulateTransaction: jest.fn().mockResolvedValue( {
                paymentSimulationOutcome: { simulationOk: true }
            } ),
            settleTransaction: jest.fn().mockResolvedValue( {
                paymentSettlementOutcome: {
                    settlementOk: true,
                    settlementResponse: { success: true, transactionHash: '0xTxHash' }
                }
            } )
        }

        mockCache = {
            get: jest.fn().mockReturnValue( {
                paymentRequiredPayload: MOCK_PAYMENT_REQUIRED,
                isRestricted: true
            } )
        }

        mockPool = {
            get: jest.fn().mockReturnValue( {
                serverExact: mockServerExact,
                found: true
            } )
        }

        mockReq = {
            body: {
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/call',
                params: {
                    name: 'get_weather',
                    arguments: { location: 'Berlin' },
                    _meta: {
                        'x402/payment': MOCK_PAYMENT_PAYLOAD
                    }
                }
            }
        }

        originalJson = jest.fn()

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: originalJson,
            locals: {}
        }

        mockNext = jest.fn()

        mockValidatePaymentRequiredResponsePayload.mockReturnValue( {
            validationOk: true,
            validationIssueList: []
        } )

        middleware = X402Gateway.mcp( {
            paymentRequiredCache: mockCache,
            serverExactPool: mockPool,
            config: { simulateBeforeSettle: true }
        } )
    } )


    test( 'successful settlement merges payment response into result', async () => {
        await middleware( mockReq, mockRes, mockNext )

        expect( mockNext ).toHaveBeenCalled()
        expect( mockRes.locals.x402 ).toBeDefined()

        const wrappedJson = mockRes.json
        const successResponse = {
            jsonrpc: '2.0',
            id: 1,
            result: {
                content: [ { type: 'text', text: 'Weather in Berlin: Sunny' } ]
            }
        }

        await wrappedJson( successResponse )

        expect( mockServerExact.settleTransaction ).toHaveBeenCalled()
        expect( originalJson ).toHaveBeenCalled()

        const finalResponse = originalJson.mock.calls[ 0 ][ 0 ]

        expect( finalResponse.result._meta ).toBeDefined()
        expect( finalResponse.result._meta[ 'x402/payment-response' ] ).toBeDefined()
        expect( finalResponse.result._meta[ 'x402/payment-response' ].success ).toBe( true )
    } )


    test( 'failed settlement returns 402 with settlement details', async () => {
        mockServerExact.settleTransaction.mockResolvedValue( {
            paymentSettlementOutcome: {
                settlementOk: false,
                settlementResponse: { success: false, errorReason: 'gas too low' }
            }
        } )

        await middleware( mockReq, mockRes, mockNext )

        expect( mockNext ).toHaveBeenCalled()

        const wrappedJson = mockRes.json
        const successResponse = {
            jsonrpc: '2.0',
            id: 1,
            result: {
                content: [ { type: 'text', text: 'some result' } ]
            }
        }

        await wrappedJson( successResponse )

        expect( originalJson ).toHaveBeenCalled()

        const finalResponse = originalJson.mock.calls[ 0 ][ 0 ]

        expect( finalResponse.error ).toBeDefined()
        expect( finalResponse.error.code ).toBe( 402 )
    } )


    test( 'settlement exception returns 402 with error reason', async () => {
        mockServerExact.settleTransaction.mockRejectedValue( new Error( 'network timeout' ) )

        await middleware( mockReq, mockRes, mockNext )

        const wrappedJson = mockRes.json
        const successResponse = {
            jsonrpc: '2.0',
            id: 1,
            result: { content: [] }
        }

        await wrappedJson( successResponse )

        expect( originalJson ).toHaveBeenCalled()

        const finalResponse = originalJson.mock.calls[ 0 ][ 0 ]

        expect( finalResponse.error ).toBeDefined()
        expect( finalResponse.error.code ).toBe( 402 )
    } )


    test( 'passes through error responses without settlement', async () => {
        await middleware( mockReq, mockRes, mockNext )

        const wrappedJson = mockRes.json
        const errorResponse = {
            jsonrpc: '2.0',
            id: 1,
            error: {
                code: -32603,
                message: 'Internal error'
            }
        }

        await wrappedJson( errorResponse )

        expect( mockServerExact.settleTransaction ).not.toHaveBeenCalled()
        expect( originalJson ).toHaveBeenCalled()

        const finalResponse = originalJson.mock.calls[ 0 ][ 0 ]

        expect( finalResponse.error.code ).toBe( -32603 )
    } )


    test( 'passes through when no x402 context (safety check)', async () => {
        await middleware( mockReq, mockRes, mockNext )

        const wrappedJson = mockRes.json
        mockRes.locals.x402 = undefined

        const response = { jsonrpc: '2.0', id: 1, result: {} }

        await wrappedJson( response )

        expect( mockServerExact.settleTransaction ).not.toHaveBeenCalled()
        expect( originalJson ).toHaveBeenCalled()
    } )


    test( 'validation exception returns internal error', async () => {
        mockServerExact.validatePaymentSignatureRequestPayload.mockRejectedValue(
            new Error( 'unexpected failure' )
        )

        await middleware( mockReq, mockRes, mockNext )

        const response = mockRes.json.mock.calls[ 0 ][ 0 ]

        expect( response.error ).toBeDefined()
        expect( response.error.message ).toContain( 'Validation error' )
        expect( response.error.message ).toContain( 'unexpected failure' )
    } )
} )
