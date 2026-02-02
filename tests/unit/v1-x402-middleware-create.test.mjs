import { describe, test, expect, jest } from '@jest/globals'


const mockServerExactInit = jest.fn()
const mockServerExactSetWallet = jest.fn()
const mockGetPreparedPaymentOptions = jest.fn()
const mockGetPaymentRequirementsPayload = jest.fn()

const MockServerExact = jest.fn().mockImplementation( () => {
    const instance = {
        init: mockServerExactInit,
        setWallet: mockServerExactSetWallet
    }

    mockServerExactInit.mockReturnValue( instance )
    mockServerExactSetWallet.mockResolvedValue( instance )

    return instance
} )

MockServerExact.getPreparedPaymentOptions = mockGetPreparedPaymentOptions
MockServerExact.getPaymentRequirementsPayload = mockGetPaymentRequirementsPayload

jest.unstable_mockModule( 'x402-core/legacy', () => ( {
    ServerExact: MockServerExact,
    NonceStore: jest.fn().mockImplementation( () => ( {} ) )
} ) )

const { X402Middleware } = await import( '../../src/v1/index.mjs' )


describe( 'V1 X402Middleware create flow', () => {
    beforeEach( () => {
        jest.clearAllMocks()

        mockServerExactInit.mockImplementation( function() { return this } )
        mockServerExactSetWallet.mockImplementation( async function() { return this } )

        mockGetPreparedPaymentOptions.mockReturnValue( {
            preparedPaymentOptions: { 'usdc': { payTo: '0xServer' } }
        } )

        mockGetPaymentRequirementsPayload.mockReturnValue( {
            paymentRequirementsPayload: {
                x402Version: 1,
                accepts: [ { scheme: 'exact', network: 'base-sepolia' } ]
            }
        } )
    } )


    test( 'creates middleware with valid configuration', async () => {
        const mw = await X402Middleware.create( {
            chainId: 84532,
            chainName: 'base-sepolia',
            contracts: { 'usdc': { address: '0xToken' } },
            paymentOptions: { 'usdc': { payTo: '{{serverAddress}}' } },
            restrictedCalls: [
                { method: 'tools/call', name: 'get_weather', activePaymentOptions: [ 'usdc' ] }
            ],
            x402Credentials: { serverAddress: '0xServer', serverProviderUrl: 'http://localhost:8545' },
            x402PrivateKey: '0xabc'
        } )

        expect( mw ).toBeDefined()
        expect( MockServerExact ).toHaveBeenCalled()
        expect( mockServerExactInit ).toHaveBeenCalledWith( { providerUrl: 'http://localhost:8545' } )
        expect( mockServerExactSetWallet ).toHaveBeenCalledWith( { privateKey: '0xabc' } )
        expect( mockGetPreparedPaymentOptions ).toHaveBeenCalled()
        expect( mockGetPaymentRequirementsPayload ).toHaveBeenCalled()
    } )


    test( 'returns middleware with mcp() method', async () => {
        const mw = await X402Middleware.create( {
            chainId: 84532,
            chainName: 'base-sepolia',
            contracts: {},
            paymentOptions: {},
            restrictedCalls: [],
            x402Credentials: { serverProviderUrl: 'http://localhost:8545' },
            x402PrivateKey: '0xkey'
        } )

        expect( typeof mw.mcp ).toBe( 'function' )

        const middlewareFn = mw.mcp()

        expect( typeof middlewareFn ).toBe( 'function' )
    } )


    test( 'maps multiple restricted calls', async () => {
        await X402Middleware.create( {
            chainId: 84532,
            chainName: 'base-sepolia',
            contracts: {},
            paymentOptions: {},
            restrictedCalls: [
                { method: 'tools/call', name: 'tool_a', activePaymentOptions: [ 'usdc' ] },
                { method: 'tools/call', name: 'tool_b', activePaymentOptions: [ 'usdc' ] }
            ],
            x402Credentials: { serverProviderUrl: 'http://localhost:8545' },
            x402PrivateKey: '0xkey'
        } )

        expect( mockGetPreparedPaymentOptions ).toHaveBeenCalledTimes( 2 )
        expect( mockGetPaymentRequirementsPayload ).toHaveBeenCalledTimes( 2 )
    } )


    test( 'rejects non-string chainName type', async () => {
        await expect( X402Middleware.create( {
            chainId: 84532,
            chainName: 123,
            contracts: {},
            paymentOptions: {},
            restrictedCalls: [],
            x402Credentials: {},
            x402PrivateKey: '0xkey'
        } ) ).rejects.toThrow( 'chainName: Must be a string' )
    } )


    test( 'rejects non-object contracts', async () => {
        await expect( X402Middleware.create( {
            chainId: 84532,
            chainName: 'base-sepolia',
            contracts: [],
            paymentOptions: {},
            restrictedCalls: [],
            x402Credentials: {},
            x402PrivateKey: '0xkey'
        } ) ).rejects.toThrow( 'contracts: Must be an object' )
    } )


    test( 'rejects non-object x402Credentials', async () => {
        await expect( X402Middleware.create( {
            chainId: 84532,
            chainName: 'base-sepolia',
            contracts: {},
            paymentOptions: {},
            restrictedCalls: [],
            x402Credentials: 'bad',
            x402PrivateKey: '0xkey'
        } ) ).rejects.toThrow( 'x402Credentials: Must be an object' )
    } )


    test( 'rejects non-string x402PrivateKey', async () => {
        await expect( X402Middleware.create( {
            chainId: 84532,
            chainName: 'base-sepolia',
            contracts: {},
            paymentOptions: {},
            restrictedCalls: [],
            x402Credentials: {},
            x402PrivateKey: 123
        } ) ).rejects.toThrow( 'x402PrivateKey: Must be a string' )
    } )
} )
