import { describe, test, expect, jest, beforeEach } from '@jest/globals'


const mockValidatePaymentRequiredResponsePayload = jest.fn()
const mockValidatePaymentSignatureRequestPayload = jest.fn()
const mockSimulateTransaction = jest.fn()
const mockSettleTransaction = jest.fn()

jest.unstable_mockModule( 'x402-core/v2/exact/evm', () => ( {
    ClientExact: {
        validatePaymentRequiredResponsePayload: mockValidatePaymentRequiredResponsePayload
    },
    ServerExact: {}
} ) )

const { X402Gateway } = await import( '../../src/v2/task/X402Gateway.mjs' )
const { JsonRpc } = await import( '../../src/v2/mcp/jsonRpc.mjs' )
const { Meta } = await import( '../../src/v2/mcp/meta.mjs' )


describe( 'V2 X402Gateway', () => {
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
    let mockReq
    let mockRes
    let mockNext
    let middleware


    beforeEach( () => {
        mockCache = {
            get: jest.fn()
        }

        mockPool = {
            get: jest.fn()
        }

        mockReq = {
            body: {
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/call',
                params: {
                    name: 'get_weather',
                    arguments: { location: 'Berlin' }
                }
            }
        }

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn(),
            locals: {},
            on: jest.fn()
        }

        mockNext = jest.fn()

        middleware = X402Gateway.mcp( {
            paymentRequiredCache: mockCache,
            serverExactPool: mockPool,
            config: {}
        } )

        mockValidatePaymentRequiredResponsePayload.mockReset()
        mockValidatePaymentRequiredResponsePayload.mockReturnValue( { validationOk: true, validationIssueList: [] } )
        mockValidatePaymentSignatureRequestPayload.mockReset()
        mockSimulateTransaction.mockReset()
        mockSettleTransaction.mockReset()
    } )


    describe( 'pass-through scenarios', () => {
        test( 'passes through when no body', async () => {
            mockReq.body = undefined

            await middleware( mockReq, mockRes, mockNext )

            expect( mockNext ).toHaveBeenCalled()
        } )


        test( 'passes through notifications (no id)', async () => {
            mockReq.body = {
                jsonrpc: '2.0',
                method: 'notifications/initialized',
                params: {}
            }

            await middleware( mockReq, mockRes, mockNext )

            expect( mockNext ).toHaveBeenCalled()
        } )


        test( 'passes through non-tools/call methods', async () => {
            mockReq.body = {
                jsonrpc: '2.0',
                id: 1,
                method: 'resources/read',
                params: { name: 'doc' }
            }

            await middleware( mockReq, mockRes, mockNext )

            expect( mockNext ).toHaveBeenCalled()
        } )


        test( 'passes through when no tool name in params', async () => {
            mockReq.body = {
                jsonrpc: '2.0',
                id: 1,
                method: 'tools/call',
                params: {}
            }

            await middleware( mockReq, mockRes, mockNext )

            expect( mockNext ).toHaveBeenCalled()
        } )


        test( 'passes through unrestricted tools', async () => {
            mockCache.get.mockReturnValue( { paymentRequiredPayload: null, isRestricted: false } )

            await middleware( mockReq, mockRes, mockNext )

            expect( mockNext ).toHaveBeenCalled()
        } )
    } )


    describe( 'payment required (no payment)', () => {
        test( 'returns 402 when tool is restricted and no payment provided', async () => {
            mockCache.get.mockReturnValue( { paymentRequiredPayload: MOCK_PAYMENT_REQUIRED, isRestricted: true } )

            await middleware( mockReq, mockRes, mockNext )

            expect( mockRes.status ).toHaveBeenCalledWith( 200 )
            expect( mockRes.json ).toHaveBeenCalled()

            const response = mockRes.json.mock.calls[ 0 ][ 0 ]

            expect( response.error ).toBeDefined()
            expect( response.error.code ).toBe( 402 )
        } )
    } )


    describe( 'payment validation', () => {
        test( 'returns error when payment network is not in pool', async () => {
            mockCache.get.mockReturnValue( { paymentRequiredPayload: MOCK_PAYMENT_REQUIRED, isRestricted: true } )

            mockReq.body.params._meta = {
                'x402/payment': MOCK_PAYMENT_PAYLOAD
            }

            mockPool.get.mockReturnValue( { serverExact: null, found: false } )

            await middleware( mockReq, mockRes, mockNext )

            expect( mockRes.status ).toHaveBeenCalledWith( 200 )

            const response = mockRes.json.mock.calls[ 0 ][ 0 ]

            expect( response.error ).toBeDefined()
            expect( response.error.message ).toContain( 'Unsupported payment network' )
        } )


        test( 'returns error when payment validation fails', async () => {
            mockCache.get.mockReturnValue( { paymentRequiredPayload: MOCK_PAYMENT_REQUIRED, isRestricted: true } )

            mockReq.body.params._meta = {
                'x402/payment': MOCK_PAYMENT_PAYLOAD
            }

            const mockServerExact = {
                validatePaymentSignatureRequestPayload: jest.fn().mockResolvedValue( {
                    paymentSignatureRequestPayloadValidationOutcome: {
                        validationOk: false,
                        validationIssueList: [ 'invalid signature' ]
                    }
                } ),
                simulateTransaction: mockSimulateTransaction,
                settleTransaction: mockSettleTransaction
            }

            mockPool.get.mockReturnValue( { serverExact: mockServerExact, found: true } )

            await middleware( mockReq, mockRes, mockNext )

            expect( mockRes.status ).toHaveBeenCalledWith( 200 )

            const response = mockRes.json.mock.calls[ 0 ][ 0 ]

            expect( response.error ).toBeDefined()
            expect( response.error.message ).toBe( 'Payment validation failed' )
        } )


        test( 'returns error when simulation fails', async () => {
            mockCache.get.mockReturnValue( { paymentRequiredPayload: MOCK_PAYMENT_REQUIRED, isRestricted: true } )

            mockReq.body.params._meta = {
                'x402/payment': MOCK_PAYMENT_PAYLOAD
            }

            const mockServerExact = {
                validatePaymentSignatureRequestPayload: jest.fn().mockResolvedValue( {
                    paymentSignatureRequestPayloadValidationOutcome: {
                        validationOk: true,
                        matchedPaymentRequirementsFromClientPayload: { matched: true }
                    }
                } ),
                simulateTransaction: jest.fn().mockResolvedValue( {
                    paymentSimulationOutcome: {
                        simulationOk: false,
                        simulationError: 'insufficient funds'
                    }
                } ),
                settleTransaction: mockSettleTransaction
            }

            mockPool.get.mockReturnValue( { serverExact: mockServerExact, found: true } )

            await middleware( mockReq, mockRes, mockNext )

            expect( mockRes.status ).toHaveBeenCalledWith( 200 )

            const response = mockRes.json.mock.calls[ 0 ][ 0 ]

            expect( response.error ).toBeDefined()
            expect( response.error.message ).toBe( 'Payment simulation failed' )
        } )


        test( 'calls next() on successful validation and sets res.locals.x402', async () => {
            mockCache.get.mockReturnValue( { paymentRequiredPayload: MOCK_PAYMENT_REQUIRED, isRestricted: true } )

            mockReq.body.params._meta = {
                'x402/payment': MOCK_PAYMENT_PAYLOAD
            }

            const mockServerExact = {
                validatePaymentSignatureRequestPayload: jest.fn().mockResolvedValue( {
                    paymentSignatureRequestPayloadValidationOutcome: {
                        validationOk: true,
                        matchedPaymentRequirementsFromClientPayload: { matched: true }
                    }
                } ),
                simulateTransaction: jest.fn().mockResolvedValue( {
                    paymentSimulationOutcome: { simulationOk: true }
                } ),
                settleTransaction: mockSettleTransaction
            }

            mockPool.get.mockReturnValue( { serverExact: mockServerExact, found: true } )

            await middleware( mockReq, mockRes, mockNext )

            expect( mockNext ).toHaveBeenCalled()
            expect( mockRes.locals.x402 ).toBeDefined()
            expect( mockRes.locals.x402.paymentPayload ).toEqual( MOCK_PAYMENT_PAYLOAD )
        } )


        test( 'handles missing accepted field in payment', async () => {
            mockCache.get.mockReturnValue( { paymentRequiredPayload: MOCK_PAYMENT_REQUIRED, isRestricted: true } )

            mockReq.body.params._meta = {
                'x402/payment': { x402Version: 2 }
            }

            await middleware( mockReq, mockRes, mockNext )

            expect( mockRes.status ).toHaveBeenCalledWith( 200 )

            const response = mockRes.json.mock.calls[ 0 ][ 0 ]

            expect( response.error ).toBeDefined()
            expect( response.error.message ).toContain( 'Missing network' )
        } )


        test( 'skips simulation when simulateBeforeSettle is false', async () => {
            const noSimMiddleware = X402Gateway.mcp( {
                paymentRequiredCache: mockCache,
                serverExactPool: mockPool,
                config: { simulateBeforeSettle: false }
            } )

            mockCache.get.mockReturnValue( { paymentRequiredPayload: MOCK_PAYMENT_REQUIRED, isRestricted: true } )

            mockReq.body.params._meta = {
                'x402/payment': MOCK_PAYMENT_PAYLOAD
            }

            const mockServerExact = {
                validatePaymentSignatureRequestPayload: jest.fn().mockResolvedValue( {
                    paymentSignatureRequestPayloadValidationOutcome: {
                        validationOk: true,
                        matchedPaymentRequirementsFromClientPayload: { matched: true }
                    }
                } ),
                simulateTransaction: jest.fn(),
                settleTransaction: mockSettleTransaction
            }

            mockPool.get.mockReturnValue( { serverExact: mockServerExact, found: true } )

            await noSimMiddleware( mockReq, mockRes, mockNext )

            expect( mockNext ).toHaveBeenCalled()
            expect( mockServerExact.simulateTransaction ).not.toHaveBeenCalled()
        } )
    } )
} )
