import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { X402Gateway } from '../../src/v1/task/X402Gateway.mjs'


describe( 'V1 X402Gateway', () => {
    let mockReq
    let mockRes
    let mockNext
    let mockPaymentRequirements
    let mockServerExact


    beforeEach( () => {
        mockReq = {
            body: {
                method: 'tools/call',
                params: { name: 'get_weather' }
            },
            get: jest.fn()
        }

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            statusCode: 200,
            on: jest.fn()
        }

        mockNext = jest.fn().mockResolvedValue( undefined )

        const toolMap = new Map()
        toolMap.set( 'get_weather', {
            x402Version: 1,
            accepts: [ { scheme: 'exact', network: 'base-sepolia' } ]
        } )

        mockPaymentRequirements = new Map()
        mockPaymentRequirements.set( 'tools/call', toolMap )

        mockServerExact = {
            findMatchingPaymentRequirements: jest.fn(),
            validatePayment: jest.fn(),
            simulateTransaction: jest.fn(),
            settleTransaction: jest.fn()
        }
    } )


    describe( 'pass-through', () => {
        test( 'passes through when tool is not restricted', async () => {
            mockReq.body.params.name = 'unrestricted_tool'

            const middleware = X402Gateway.mcp( {
                paymentRequirements: mockPaymentRequirements,
                serverExact: mockServerExact
            } )

            await middleware( mockReq, mockRes, mockNext )

            expect( mockNext ).toHaveBeenCalled()
        } )


        test( 'passes through when method is not restricted', async () => {
            mockReq.body.method = 'resources/read'

            const middleware = X402Gateway.mcp( {
                paymentRequirements: mockPaymentRequirements,
                serverExact: mockServerExact
            } )

            await middleware( mockReq, mockRes, mockNext )

            expect( mockNext ).toHaveBeenCalled()
        } )
    } )


    describe( 'x-payment header checks', () => {
        test( 'returns 402 ERR_MISSING_XPAYMENT when header is missing', async () => {
            mockReq.get.mockReturnValue( undefined )

            const middleware = X402Gateway.mcp( {
                paymentRequirements: mockPaymentRequirements,
                serverExact: mockServerExact
            } )

            await middleware( mockReq, mockRes, mockNext )

            expect( mockRes.status ).toHaveBeenCalledWith( 402 )

            const response = mockRes.json.mock.calls[ 0 ][ 0 ]

            expect( response.errorCode ).toBe( 'ERR_MISSING_XPAYMENT' )
        } )


        test( 'returns 402 ERR_EMPTY_HEADER when header is empty', async () => {
            mockReq.get.mockReturnValue( '' )

            const middleware = X402Gateway.mcp( {
                paymentRequirements: mockPaymentRequirements,
                serverExact: mockServerExact
            } )

            await middleware( mockReq, mockRes, mockNext )

            expect( mockRes.status ).toHaveBeenCalledWith( 402 )

            const response = mockRes.json.mock.calls[ 0 ][ 0 ]

            expect( response.errorCode ).toBe( 'ERR_EMPTY_HEADER' )
        } )


        test( 'returns 402 ERR_INVALID_JSON when header is not valid JSON', async () => {
            mockReq.get.mockReturnValue( 'not-json{' )

            const middleware = X402Gateway.mcp( {
                paymentRequirements: mockPaymentRequirements,
                serverExact: mockServerExact
            } )

            await middleware( mockReq, mockRes, mockNext )

            expect( mockRes.status ).toHaveBeenCalledWith( 402 )

            const response = mockRes.json.mock.calls[ 0 ][ 0 ]

            expect( response.errorCode ).toBe( 'ERR_INVALID_JSON' )
        } )


        test( 'returns 402 ERR_INVALID_SCHEMA when schema is invalid', async () => {
            mockReq.get.mockReturnValue( JSON.stringify( { incomplete: true } ) )

            const middleware = X402Gateway.mcp( {
                paymentRequirements: mockPaymentRequirements,
                serverExact: mockServerExact
            } )

            await middleware( mockReq, mockRes, mockNext )

            expect( mockRes.status ).toHaveBeenCalledWith( 402 )

            const response = mockRes.json.mock.calls[ 0 ][ 0 ]

            expect( response.errorCode ).toBe( 'ERR_INVALID_SCHEMA' )
        } )


        test( 'returns 402 ERR_UNSUPPORTED_SCHEME for non-exact scheme', async () => {
            mockReq.get.mockReturnValue( JSON.stringify( {
                x402Version: 1,
                scheme: 'flexible',
                network: 'base-sepolia',
                payload: { auth: true }
            } ) )

            const middleware = X402Gateway.mcp( {
                paymentRequirements: mockPaymentRequirements,
                serverExact: mockServerExact
            } )

            await middleware( mockReq, mockRes, mockNext )

            expect( mockRes.status ).toHaveBeenCalledWith( 402 )

            const response = mockRes.json.mock.calls[ 0 ][ 0 ]

            expect( response.errorCode ).toBe( 'ERR_UNSUPPORTED_SCHEME' )
        } )
    } )


    describe( 'errors map', () => {
        test( 'has all expected error codes', () => {
            const expectedCodes = [
                'ERR_MISSING_XPAYMENT',
                'ERR_INVALID_HEADER_TYPE',
                'ERR_EMPTY_HEADER',
                'ERR_INVALID_JSON',
                'ERR_INVALID_SCHEMA',
                'ERR_UNSUPPORTED_SCHEME',
                'ERR_PAYLOAD_MISSING_FIELDS',
                'ERR_SIGNATURE_INVALID',
                'ERR_AUTHORIZATION_EXPIRED',
                'ERR_AUTHORIZATION_VALUE_INVALID',
                'ERR_AUTHORIZATION_TO_MISMATCH',
                'ERR_NONCE_ALREADY_USED',
                'ERR_ASSET_MISMATCH',
                'ERR_NETWORK_MISMATCH',
                'ERR_SIMULATION_FAILED',
                'ERR_INTERNAL_VALIDATION_ERROR'
            ]

            expectedCodes
                .forEach( ( code ) => {
                    expect( X402Gateway.errors ).toHaveProperty( code )
                } )
        } )
    } )


    describe( '#isValidX402Response (via gateway)', () => {
        test( 'rejects payment with valid schema but fails X402Validator', async () => {
            const validSchemaPayment = {
                x402Version: 1,
                scheme: 'exact',
                network: 'base-sepolia',
                payload: { authorization: {}, signature: '0x' }
            }

            mockReq.get.mockReturnValue( JSON.stringify( validSchemaPayment ) )

            mockServerExact.findMatchingPaymentRequirements
                .mockReturnValue( { selectedRequirement: null } )

            const middleware = X402Gateway.mcp( {
                paymentRequirements: mockPaymentRequirements,
                serverExact: mockServerExact
            } )

            await middleware( mockReq, mockRes, mockNext )

            expect( mockRes.status ).toHaveBeenCalledWith( 402 )

            const response = mockRes.json.mock.calls[ 0 ][ 0 ]

            expect( response.errorCode ).toBe( 'ERR_INVALID_SCHEMA' )
        } )
    } )
} )
