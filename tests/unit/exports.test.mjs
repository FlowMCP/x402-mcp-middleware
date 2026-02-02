import { describe, test, expect } from '@jest/globals'
import { v1, v2, legacy } from '../../src/index.mjs'
import { X402Middleware, JsonRpc, Meta, PaymentRequiredCache, ServerExactPool } from '../../src/v2/index.mjs'


describe( 'x402-mcp-middleware exports', () => {
    test( 'root index exports v1, v2, legacy namespaces', () => {
        expect( v1 ).toBeDefined()
        expect( v2 ).toBeDefined()
        expect( legacy ).toBeDefined()
    } )


    test( 'v2 exports X402Middleware class', () => {
        expect( X402Middleware ).toBeDefined()
        expect( typeof X402Middleware ).toBe( 'function' )
        expect( typeof X402Middleware.create ).toBe( 'function' )
    } )


    test( 'v2 exports JsonRpc module', () => {
        expect( JsonRpc ).toBeDefined()
    } )


    test( 'v2 exports Meta module', () => {
        expect( Meta ).toBeDefined()
    } )


    test( 'v2 exports PaymentRequiredCache class', () => {
        expect( PaymentRequiredCache ).toBeDefined()
        expect( typeof PaymentRequiredCache ).toBe( 'function' )
    } )


    test( 'v2 exports ServerExactPool class', () => {
        expect( ServerExactPool ).toBeDefined()
        expect( typeof ServerExactPool ).toBe( 'function' )
    } )
} )
