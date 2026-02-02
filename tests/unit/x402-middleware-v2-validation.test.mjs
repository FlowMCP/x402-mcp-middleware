import { describe, test, expect } from '@jest/globals'
import { X402Middleware } from '../../src/v2/X402Middleware.mjs'


describe( 'V2 X402Middleware validation', () => {
    test( 'rejects missing x402V2ExactEvmConfiguration', async () => {
        await expect( X402Middleware.create( {
            x402V2ExactEvmConfiguration: undefined,
            server: { payToAddressMap: {}, providerUrlByPaymentNetworkId: {}, facilitatorPrivateKeyByPaymentNetworkId: {} }
        } ) ).rejects.toThrow( 'x402V2ExactEvmConfiguration: Is required' )
    } )


    test( 'rejects non-object x402V2ExactEvmConfiguration', async () => {
        await expect( X402Middleware.create( {
            x402V2ExactEvmConfiguration: 'not-an-object',
            server: { payToAddressMap: {}, providerUrlByPaymentNetworkId: {}, facilitatorPrivateKeyByPaymentNetworkId: {} }
        } ) ).rejects.toThrow( 'Must be an object' )
    } )


    test( 'rejects missing contractCatalog in configuration', async () => {
        await expect( X402Middleware.create( {
            x402V2ExactEvmConfiguration: { paymentOptionCatalog: {}, restrictedCalls: [] },
            server: { payToAddressMap: {}, providerUrlByPaymentNetworkId: {}, facilitatorPrivateKeyByPaymentNetworkId: {} }
        } ) ).rejects.toThrow( 'contractCatalog: Is required' )
    } )


    test( 'rejects missing server', async () => {
        await expect( X402Middleware.create( {
            x402V2ExactEvmConfiguration: { contractCatalog: {}, paymentOptionCatalog: {}, restrictedCalls: [] },
            server: undefined
        } ) ).rejects.toThrow( 'server: Is required' )
    } )


    test( 'rejects non-object server', async () => {
        await expect( X402Middleware.create( {
            x402V2ExactEvmConfiguration: { contractCatalog: {}, paymentOptionCatalog: {}, restrictedCalls: [] },
            server: 'bad'
        } ) ).rejects.toThrow( 'server: Must be an object' )
    } )


    test( 'rejects missing providerUrlByPaymentNetworkId in server', async () => {
        await expect( X402Middleware.create( {
            x402V2ExactEvmConfiguration: { contractCatalog: {}, paymentOptionCatalog: {}, restrictedCalls: [] },
            server: { payToAddressMap: {}, facilitatorPrivateKeyByPaymentNetworkId: {} }
        } ) ).rejects.toThrow( 'providerUrlByPaymentNetworkId: Is required' )
    } )


    test( 'rejects non-object mcp', async () => {
        await expect( X402Middleware.create( {
            x402V2ExactEvmConfiguration: { contractCatalog: {}, paymentOptionCatalog: {}, restrictedCalls: [] },
            server: { payToAddressMap: {}, providerUrlByPaymentNetworkId: {}, facilitatorPrivateKeyByPaymentNetworkId: {} },
            mcp: 'bad'
        } ) ).rejects.toThrow( 'mcp: Must be an object' )
    } )


    test( 'rejects non-array restrictedCalls', async () => {
        await expect( X402Middleware.create( {
            x402V2ExactEvmConfiguration: { contractCatalog: {}, paymentOptionCatalog: {}, restrictedCalls: 'not-array' },
            server: { payToAddressMap: {}, providerUrlByPaymentNetworkId: {}, facilitatorPrivateKeyByPaymentNetworkId: {} }
        } ) ).rejects.toThrow( 'restrictedCalls: Must be an array' )
    } )
} )
