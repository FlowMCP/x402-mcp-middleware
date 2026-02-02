import { describe, test, expect } from '@jest/globals'
import { Meta } from '../../src/v2/mcp/meta.mjs'


describe( 'Meta', () => {
    describe( 'static constants', () => {
        test( 'exports default payment key', () => {
            expect( Meta.DEFAULT_PAYMENT_KEY ).toBe( 'x402/payment' )
        } )


        test( 'exports default payment response key', () => {
            expect( Meta.DEFAULT_PAYMENT_RESPONSE_KEY ).toBe( 'x402/payment-response' )
        } )
    } )


    describe( 'getPaymentFromMeta', () => {
        test( 'returns payment payload from params._meta', () => {
            const params = { _meta: { 'x402/payment': { scheme: 'exact' } } }
            const { paymentPayload, paymentFound } = Meta
                .getPaymentFromMeta( { params } )

            expect( paymentFound ).toBe( true )
            expect( paymentPayload ).toEqual( { scheme: 'exact' } )
        } )


        test( 'returns not found for null params', () => {
            const { paymentPayload, paymentFound } = Meta
                .getPaymentFromMeta( { params: null } )

            expect( paymentFound ).toBe( false )
            expect( paymentPayload ).toBeNull()
        } )


        test( 'returns not found for params without _meta', () => {
            const { paymentPayload, paymentFound } = Meta
                .getPaymentFromMeta( { params: { name: 'test' } } )

            expect( paymentFound ).toBe( false )
        } )


        test( 'returns not found when payment key missing', () => {
            const params = { _meta: { other: 'data' } }
            const { paymentPayload, paymentFound } = Meta
                .getPaymentFromMeta( { params } )

            expect( paymentFound ).toBe( false )
        } )


        test( 'supports custom payment meta key', () => {
            const params = { _meta: { 'custom/pay': { amount: '100' } } }
            const { paymentPayload, paymentFound } = Meta
                .getPaymentFromMeta( { params, paymentMetaKey: 'custom/pay' } )

            expect( paymentFound ).toBe( true )
            expect( paymentPayload ).toEqual( { amount: '100' } )
        } )
    } )


    describe( 'mergePaymentResponseIntoResult', () => {
        test( 'merges payment response into object result', () => {
            const result = { data: 'weather' }
            const paymentResponse = { success: true, txHash: '0xabc' }

            const { mergedResult } = Meta
                .mergePaymentResponseIntoResult( { result, paymentResponse } )

            expect( mergedResult.data ).toBe( 'weather' )
            expect( mergedResult._meta[ 'x402/payment-response' ] ).toEqual( paymentResponse )
        } )


        test( 'wraps primitive result in object', () => {
            const { mergedResult } = Meta
                .mergePaymentResponseIntoResult( { result: 'plain string', paymentResponse: { ok: true } } )

            expect( mergedResult.value ).toBe( 'plain string' )
            expect( mergedResult._meta[ 'x402/payment-response' ] ).toEqual( { ok: true } )
        } )


        test( 'preserves existing _meta keys', () => {
            const result = { data: 'test', _meta: { existing: 'value' } }
            const { mergedResult } = Meta
                .mergePaymentResponseIntoResult( { result, paymentResponse: { done: true } } )

            expect( mergedResult._meta.existing ).toBe( 'value' )
            expect( mergedResult._meta[ 'x402/payment-response' ] ).toEqual( { done: true } )
        } )
    } )


    describe( 'mergePaymentResponseIntoError', () => {
        test( 'merges payment response into error data object', () => {
            const errorData = { errorCode: 'TIMEOUT' }
            const paymentResponse = { settled: false }

            const { mergedErrorData } = Meta
                .mergePaymentResponseIntoError( { errorData, paymentResponse } )

            expect( mergedErrorData.errorCode ).toBe( 'TIMEOUT' )
            expect( mergedErrorData[ 'x402/payment-response' ] ).toEqual( { settled: false } )
        } )


        test( 'wraps non-object error data', () => {
            const { mergedErrorData } = Meta
                .mergePaymentResponseIntoError( { errorData: 'some error', paymentResponse: { ok: false } } )

            expect( mergedErrorData.originalError ).toBe( 'some error' )
            expect( mergedErrorData[ 'x402/payment-response' ] ).toEqual( { ok: false } )
        } )
    } )


    describe( 'createPaymentRequiredErrorData', () => {
        test( 'creates error data from payment required payload', () => {
            const payload = { x402Version: 2, accepts: [ { scheme: 'exact' } ] }
            const { errorData } = Meta
                .createPaymentRequiredErrorData( { paymentRequiredPayload: payload } )

            expect( errorData.x402Version ).toBe( 2 )
            expect( errorData.accepts ).toEqual( [ { scheme: 'exact' } ] )
        } )
    } )
} )
