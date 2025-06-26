import { X402Validator } from './X402Validator.mjs'
import { X402Settler } from './X402Settler.mjs'


class X402Gateway {
    static mcp( { paymentRequirements, serverExact } ) {
        return async function cryptoMiddleware( req, res, next ) {
            const method = req.body?.method
            const name = req.body?.params?.name

            const paymentRequirement = paymentRequirements.get( method )?.get( name )
            if( !paymentRequirement ) { return next() }

            const body = X402Gateway.#getResponseBody( { method, name, paymentRequirements } )

            const xPayment = req.get('x-payment')
            if( xPayment === undefined ) { 
                return X402Gateway.#res( { body, res, code: 'ERR_MISSING_XPAYMENT' } ) 
            }
            else if( typeof xPayment !== 'string' ) { return X402Gateway.#res( { body, res, code: 'ERR_INVALID_HEADER_TYPE' } ) }
            else if( xPayment === '' ) { return X402Gateway.#res( { body, res, code: 'ERR_EMPTY_HEADER' } ) }

            const isValid = (() => { try { JSON.parse( xPayment ); return true } catch { return false } })()
            if( !isValid ) { return X402Gateway.#res( { body, res, code: 'ERR_INVALID_JSON' } ) }

            const parsedXPayment = JSON.parse( xPayment )
            const { isValidX402Response } = X402Gateway.#isValidX402Response( { parsedXPayment } )
            if( !isValidX402Response ) { return X402Gateway.#res( { body, res, code: 'ERR_INVALID_SCHEMA' } ) }

            const { scheme } = parsedXPayment
            const isValidScheme = [ 'exact' ].includes( scheme )
            if( !isValidScheme ) { return X402Gateway.#res( { body, res, code: 'ERR_UNSUPPORTED_SCHEME' } ) }

            const { valid, errorCode, selectedRequirement } = await X402Validator
                .verifyPayload( { parsedXPayment, paymentRequirement, serverExact } )
            if( !valid ) { return X402Gateway.#res( { body, res, code: errorCode } ) }

            res.on( 'finish', async () => {
                if( res.statusCode >= 200 && res.statusCode < 300 ) {
                    try {
                        const timeoutPromise = new Promise( ( _, reject ) => setTimeout( () => reject( new Error( 'Settlement timeout' ) ), 5000 ) )
                        await Promise.race([
                            X402Settler.settlePayload( { parsedXPayment, selectedRequirement, serverExact } ),
                            timeoutPromise
                        ] )
                        console.log( 'Settlement completed successfully.' )
                    } catch( err ) {
                        console.error( 'Settlement failed:', err )
                    }
                }
            } )

            await next()
        }
    }


    static #isValidX402Response( { parsedXPayment } ) {
        if (!parsedXPayment || typeof parsedXPayment !== 'object') {
            return { isValidX402Response: false }
        }

        const { x402Version, scheme, network, payload } = parsedXPayment
        const isValidX402Response = [
            [ 'x402Version', x402Version, 'number', null ],
            [ 'scheme',      scheme,      'string', null ],
            [ 'network',     network,     'string', null ],
            [ 'payload',     payload,     'object', null ]
        ]
            .map( ( [ key, value, type ] ) => {
                if( value === undefined || value === null ) { return false } 
                else if( typeof value !== type || ( type === 'object' && Array.isArray( value ) ) ) { return false }
                return true
            } )
            .every( ( a ) => a === true )

        return { isValidX402Response }
    }


    static #getResponseBody( { method, name, paymentRequirements } ) {
        let status = true
        const body = paymentRequirements.get( method )?.get( name )
        if( !body ) { status = false }

        return { status, body }
    }


    static #res({ body, res, code }) {
        const response = {
            ...body.body,
            x402Version: body.body.x402Version,
            errorCode: code,
            error: X402Gateway.errors[ code ] ?? 'Unknown Error'
        }
        res.status( 402 ).json( response )
    }

    static errors = {
        'ERR_MISSING_XPAYMENT': 'X-PAYMENT header is missing',
        'ERR_INVALID_HEADER_TYPE': 'X-PAYMENT header must be a string',
        'ERR_EMPTY_HEADER': 'X-PAYMENT header is empty',
        'ERR_INVALID_JSON': 'X-PAYMENT header contains invalid JSON',
        'ERR_INVALID_SCHEMA': 'X-PAYMENT header schema invalid',
        'ERR_UNSUPPORTED_SCHEME': 'Unsupported payment scheme',
        'ERR_PAYLOAD_MISSING_FIELDS': 'Payload or authorization fields missing',
        'ERR_SIGNATURE_INVALID': 'Signature verification failed',
        'ERR_AUTHORIZATION_EXPIRED': 'Authorization time window invalid',
        'ERR_AUTHORIZATION_VALUE_INVALID': 'Authorization value too low',
        'ERR_AUTHORIZATION_TO_MISMATCH': 'Authorization recipient does not match',
        'ERR_NONCE_ALREADY_USED': 'Nonce already used',
        'ERR_ASSET_MISMATCH': 'Asset address mismatch',
        'ERR_NETWORK_MISMATCH': 'Network mismatch',
        'ERR_SIMULATION_FAILED': 'Transaction simulation failed',
        'ERR_INTERNAL_VALIDATION_ERROR': 'Internal validation error'
    }
}


export { X402Gateway }
