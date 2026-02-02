import { describe, test, expect } from '@jest/globals'
import { JsonRpc } from '../../src/v2/mcp/jsonRpc.mjs'


describe( 'JsonRpc', () => {
    describe( 'ErrorCodes', () => {
        test( 'exports standard JSON-RPC error codes', () => {
            expect( JsonRpc.ErrorCodes.PARSE_ERROR ).toBe( -32700 )
            expect( JsonRpc.ErrorCodes.INVALID_REQUEST ).toBe( -32600 )
            expect( JsonRpc.ErrorCodes.METHOD_NOT_FOUND ).toBe( -32601 )
            expect( JsonRpc.ErrorCodes.INVALID_PARAMS ).toBe( -32602 )
            expect( JsonRpc.ErrorCodes.INTERNAL_ERROR ).toBe( -32603 )
            expect( JsonRpc.ErrorCodes.PAYMENT_REQUIRED ).toBe( 402 )
        } )
    } )


    describe( 'isNotification', () => {
        test( 'returns true for request without id', () => {
            const { isNotification } = JsonRpc
                .isNotification( { request: { method: 'notifications/initialized' } } )

            expect( isNotification ).toBe( true )
        } )


        test( 'returns false for request with id', () => {
            const { isNotification } = JsonRpc
                .isNotification( { request: { id: 1, method: 'tools/call' } } )

            expect( isNotification ).toBe( false )
        } )


        test( 'returns true for null request', () => {
            const { isNotification } = JsonRpc
                .isNotification( { request: null } )

            expect( isNotification ).toBe( true )
        } )


        test( 'returns true for undefined request', () => {
            const { isNotification } = JsonRpc
                .isNotification( { request: undefined } )

            expect( isNotification ).toBe( true )
        } )
    } )


    describe( 'createSuccessResponse', () => {
        test( 'creates valid success response', () => {
            const { response } = JsonRpc
                .createSuccessResponse( { id: 1, result: { data: 'test' } } )

            expect( response.jsonrpc ).toBe( '2.0' )
            expect( response.id ).toBe( 1 )
            expect( response.result ).toEqual( { data: 'test' } )
            expect( response.error ).toBeUndefined()
        } )
    } )


    describe( 'createErrorResponse', () => {
        test( 'creates error response without data', () => {
            const { response } = JsonRpc
                .createErrorResponse( { id: 1, code: -32600, message: 'Invalid Request' } )

            expect( response.jsonrpc ).toBe( '2.0' )
            expect( response.id ).toBe( 1 )
            expect( response.error.code ).toBe( -32600 )
            expect( response.error.message ).toBe( 'Invalid Request' )
            expect( response.error.data ).toBeUndefined()
        } )


        test( 'creates error response with data', () => {
            const { response } = JsonRpc
                .createErrorResponse( { id: 2, code: -32603, message: 'Internal', data: { detail: 'oops' } } )

            expect( response.error.data ).toEqual( { detail: 'oops' } )
        } )
    } )


    describe( 'createPaymentRequiredResponse', () => {
        test( 'creates 402 error response with payment payload', () => {
            const payload = { x402Version: 2, accepts: [] }
            const { response } = JsonRpc
                .createPaymentRequiredResponse( { id: 5, paymentRequiredPayload: payload } )

            expect( response.error.code ).toBe( 402 )
            expect( response.error.message ).toBe( 'Payment Required' )
            expect( response.error.data ).toEqual( payload )
        } )
    } )


    describe( 'createInvalidParamsResponse', () => {
        test( 'creates invalid params response with default message', () => {
            const { response } = JsonRpc
                .createInvalidParamsResponse( { id: 3 } )

            expect( response.error.code ).toBe( -32602 )
            expect( response.error.message ).toBe( 'Invalid params' )
        } )


        test( 'creates invalid params response with custom message', () => {
            const { response } = JsonRpc
                .createInvalidParamsResponse( { id: 3, message: 'Missing field' } )

            expect( response.error.message ).toBe( 'Missing field' )
        } )
    } )


    describe( 'createInternalErrorResponse', () => {
        test( 'creates internal error response with default message', () => {
            const { response } = JsonRpc
                .createInternalErrorResponse( { id: 4 } )

            expect( response.error.code ).toBe( -32603 )
            expect( response.error.message ).toBe( 'Internal error' )
        } )


        test( 'creates internal error response with custom message and data', () => {
            const { response } = JsonRpc
                .createInternalErrorResponse( { id: 4, message: 'DB down', data: { retryAfter: 30 } } )

            expect( response.error.message ).toBe( 'DB down' )
            expect( response.error.data ).toEqual( { retryAfter: 30 } )
        } )
    } )
} )
