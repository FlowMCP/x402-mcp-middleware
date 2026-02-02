import { describe, test, expect, jest } from '@jest/globals'


jest.unstable_mockModule( 'x402-core/legacy', () => ( {
    ServerExact: class MockServerExact {
        constructor() {}
        init() { return this }
        async setWallet() {}
        static getPreparedPaymentOptions() { return { preparedPaymentOptions: [] } }
        static getPaymentRequirementsPayload() { return { paymentRequirementsPayload: {} } }
    },
    NonceStore: class MockNonceStore {}
} ) )

const { X402Middleware } = await import( '../../src/v1/index.mjs' )


describe( 'V1 X402Middleware validation', () => {
    test( 'rejects missing chainId', async () => {
        await expect( X402Middleware.create( {
            chainName: 'base-sepolia',
            contracts: {},
            paymentOptions: {},
            restrictedCalls: [],
            x402Credentials: {},
            x402PrivateKey: '0xabc'
        } ) ).rejects.toThrow( 'chainId: Is required' )
    } )


    test( 'rejects non-number chainId', async () => {
        await expect( X402Middleware.create( {
            chainId: 'not-a-number',
            chainName: 'base-sepolia',
            contracts: {},
            paymentOptions: {},
            restrictedCalls: [],
            x402Credentials: {},
            x402PrivateKey: '0xabc'
        } ) ).rejects.toThrow( 'chainId: Must be a number' )
    } )


    test( 'rejects missing chainName', async () => {
        await expect( X402Middleware.create( {
            chainId: 84532,
            contracts: {},
            paymentOptions: {},
            restrictedCalls: [],
            x402Credentials: {},
            x402PrivateKey: '0xabc'
        } ) ).rejects.toThrow( 'chainName: Is required' )
    } )


    test( 'rejects missing contracts', async () => {
        await expect( X402Middleware.create( {
            chainId: 84532,
            chainName: 'base-sepolia',
            paymentOptions: {},
            restrictedCalls: [],
            x402Credentials: {},
            x402PrivateKey: '0xabc'
        } ) ).rejects.toThrow( 'contracts: Is required' )
    } )


    test( 'rejects non-object paymentOptions', async () => {
        await expect( X402Middleware.create( {
            chainId: 84532,
            chainName: 'base-sepolia',
            contracts: {},
            paymentOptions: 'bad',
            restrictedCalls: [],
            x402Credentials: {},
            x402PrivateKey: '0xabc'
        } ) ).rejects.toThrow( 'paymentOptions: Must be an object' )
    } )


    test( 'rejects non-array restrictedCalls', async () => {
        await expect( X402Middleware.create( {
            chainId: 84532,
            chainName: 'base-sepolia',
            contracts: {},
            paymentOptions: {},
            restrictedCalls: 'not-array',
            x402Credentials: {},
            x402PrivateKey: '0xabc'
        } ) ).rejects.toThrow( 'restrictedCalls: Must be an array' )
    } )


    test( 'rejects missing x402Credentials', async () => {
        await expect( X402Middleware.create( {
            chainId: 84532,
            chainName: 'base-sepolia',
            contracts: {},
            paymentOptions: {},
            restrictedCalls: [],
            x402PrivateKey: '0xabc'
        } ) ).rejects.toThrow( 'x402Credentials: Is required' )
    } )


    test( 'rejects missing x402PrivateKey', async () => {
        await expect( X402Middleware.create( {
            chainId: 84532,
            chainName: 'base-sepolia',
            contracts: {},
            paymentOptions: {},
            restrictedCalls: [],
            x402Credentials: {}
        } ) ).rejects.toThrow( 'x402PrivateKey: Is required' )
    } )
} )
