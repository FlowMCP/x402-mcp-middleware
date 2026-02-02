import { describe, test, expect, jest, beforeEach } from '@jest/globals'


const mockGetPreparedPaymentOptionCatalog = jest.fn()
const mockGetPaymentRequiredResponsePayload = jest.fn()
const mockValidateX402V2ExactEvmConfiguration = jest.fn()
const mockValidatePaymentRequiredResponsePayload = jest.fn()
const mockServerExactInit = jest.fn()
const mockServerExactSetWallet = jest.fn()

const MockServerExact = jest.fn().mockImplementation( () => {
    const instance = {
        init: mockServerExactInit,
        setWallet: mockServerExactSetWallet
    }

    mockServerExactInit.mockReturnValue( instance )
    mockServerExactSetWallet.mockResolvedValue( instance )

    return instance
} )

MockServerExact.getPreparedPaymentOptionCatalog = mockGetPreparedPaymentOptionCatalog
MockServerExact.getPaymentRequiredResponsePayload = mockGetPaymentRequiredResponsePayload

jest.unstable_mockModule( 'x402-core/v2/exact/evm', () => ( {
    ServerExact: MockServerExact,
    NonceStore: jest.fn().mockImplementation( () => ( {} ) ),
    ClientExact: {
        validatePaymentRequiredResponsePayload: mockValidatePaymentRequiredResponsePayload
    }
} ) )

jest.unstable_mockModule( 'x402-core/v2/config', () => ( {
    ConfigValidator: {
        validateX402V2ExactEvmConfiguration: mockValidateX402V2ExactEvmConfiguration
    }
} ) )

const { X402Middleware } = await import( '../../src/v2/X402Middleware.mjs' )


describe( 'V2 X402Middleware create flow', () => {
    beforeEach( () => {
        jest.clearAllMocks()

        mockServerExactInit.mockImplementation( function() { return this } )
        mockServerExactSetWallet.mockImplementation( async function() { return this } )

        mockValidateX402V2ExactEvmConfiguration.mockReturnValue( {
            configurationValidationOk: true,
            configurationValidationIssueList: []
        } )

        mockGetPreparedPaymentOptionCatalog.mockReturnValue( {
            preparedPaymentOptionCatalog: {
                'option-usdc': { contractId: 'usdc-base', amount: '100', payTo: '0xServer' }
            }
        } )

        mockGetPaymentRequiredResponsePayload.mockReturnValue( {
            paymentRequiredResponsePayload: {
                x402Version: 2,
                accepts: [ { scheme: 'exact', network: 'eip155:84532' } ]
            }
        } )
    } )


    test( 'creates middleware with valid configuration', async () => {
        const mw = await X402Middleware.create( {
            x402V2ExactEvmConfiguration: {
                contractCatalog: { 'usdc-base': { paymentNetworkId: 'eip155:84532' } },
                paymentOptionCatalog: { 'option-usdc': { contractId: 'usdc-base' } },
                restrictedCalls: [
                    { method: 'tools/call', name: 'get_weather', acceptedPaymentOptionIdList: [ 'option-usdc' ] }
                ]
            },
            server: {
                payToAddressMap: { serverAddress: '0xServer' },
                providerUrlByPaymentNetworkId: { 'eip155:84532': 'http://base:8545' },
                facilitatorPrivateKeyByPaymentNetworkId: { 'eip155:84532': '0xkey1' },
                silent: true
            }
        } )

        expect( mw ).toBeDefined()
        expect( typeof mw.mcp ).toBe( 'function' )
        expect( mockValidateX402V2ExactEvmConfiguration ).toHaveBeenCalled()
        expect( mockGetPreparedPaymentOptionCatalog ).toHaveBeenCalled()
    } )


    test( 'throws when configuration validation fails', async () => {
        mockValidateX402V2ExactEvmConfiguration.mockReturnValue( {
            configurationValidationOk: false,
            configurationValidationIssueList: [ { issueMessage: 'bad config' } ]
        } )

        await expect( X402Middleware.create( {
            x402V2ExactEvmConfiguration: {
                contractCatalog: {},
                paymentOptionCatalog: {},
                restrictedCalls: []
            },
            server: {
                payToAddressMap: {},
                providerUrlByPaymentNetworkId: { 'eip155:84532': 'http://base:8545' },
                facilitatorPrivateKeyByPaymentNetworkId: { 'eip155:84532': '0xkey1' },
                silent: true
            }
        } ) ).rejects.toThrow( 'Configuration validation failed' )
    } )


    test( 'mcp() returns an Express middleware function', async () => {
        const mw = await X402Middleware.create( {
            x402V2ExactEvmConfiguration: {
                contractCatalog: {},
                paymentOptionCatalog: {},
                restrictedCalls: []
            },
            server: {
                payToAddressMap: {},
                providerUrlByPaymentNetworkId: { 'eip155:84532': 'http://base:8545' },
                facilitatorPrivateKeyByPaymentNetworkId: { 'eip155:84532': '0xkey1' },
                silent: true
            }
        } )

        const middlewareFn = mw.mcp()

        expect( typeof middlewareFn ).toBe( 'function' )
        expect( middlewareFn.length ).toBe( 3 )
    } )


    test( 'passes mcp options to gateway config', async () => {
        const mw = await X402Middleware.create( {
            x402V2ExactEvmConfiguration: {
                contractCatalog: {},
                paymentOptionCatalog: {},
                restrictedCalls: []
            },
            server: {
                payToAddressMap: {},
                providerUrlByPaymentNetworkId: { 'eip155:84532': 'http://base:8545' },
                facilitatorPrivateKeyByPaymentNetworkId: { 'eip155:84532': '0xkey1' },
                simulateBeforeSettle: false,
                silent: true
            },
            mcp: {
                paymentMetaKey: 'custom/payment',
                paymentResponseMetaKey: 'custom/response',
                resourcePrefix: 'mcp://custom/'
            }
        } )

        expect( mw ).toBeDefined()
    } )


    test( 'rejects array x402V2ExactEvmConfiguration', async () => {
        await expect( X402Middleware.create( {
            x402V2ExactEvmConfiguration: [],
            server: { payToAddressMap: {}, providerUrlByPaymentNetworkId: {}, facilitatorPrivateKeyByPaymentNetworkId: {} }
        } ) ).rejects.toThrow( 'Must be an object' )
    } )


    test( 'rejects missing paymentOptionCatalog', async () => {
        await expect( X402Middleware.create( {
            x402V2ExactEvmConfiguration: { contractCatalog: {}, restrictedCalls: [] },
            server: { payToAddressMap: {}, providerUrlByPaymentNetworkId: {}, facilitatorPrivateKeyByPaymentNetworkId: {} }
        } ) ).rejects.toThrow( 'paymentOptionCatalog: Is required' )
    } )


    test( 'rejects missing facilitatorPrivateKeyByPaymentNetworkId', async () => {
        await expect( X402Middleware.create( {
            x402V2ExactEvmConfiguration: { contractCatalog: {}, paymentOptionCatalog: {}, restrictedCalls: [] },
            server: { payToAddressMap: {}, providerUrlByPaymentNetworkId: {} }
        } ) ).rejects.toThrow( 'facilitatorPrivateKeyByPaymentNetworkId: Is required' )
    } )


    test( 'rejects array server', async () => {
        await expect( X402Middleware.create( {
            x402V2ExactEvmConfiguration: { contractCatalog: {}, paymentOptionCatalog: {}, restrictedCalls: [] },
            server: []
        } ) ).rejects.toThrow( 'server: Must be an object' )
    } )


    test( 'rejects missing payToAddressMap', async () => {
        await expect( X402Middleware.create( {
            x402V2ExactEvmConfiguration: { contractCatalog: {}, paymentOptionCatalog: {}, restrictedCalls: [] },
            server: { providerUrlByPaymentNetworkId: {}, facilitatorPrivateKeyByPaymentNetworkId: {} }
        } ) ).rejects.toThrow( 'payToAddressMap: Is required' )
    } )
} )
