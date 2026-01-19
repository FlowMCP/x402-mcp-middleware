// X402Middleware v2
// MCP-spec-compliant payment middleware with multi-network support
//
// Usage:
//   import { X402Middleware } from 'x402-mcp-middleware/v2'
//   const middleware = await X402Middleware.create({ ... })
//   app.use(middleware.mcp())

import { ServerExact } from 'x402-core/v2/exact/evm'
import { ConfigValidator } from 'x402-core/v2/config'
import { PaymentRequiredCache } from './exact/evm/paymentRequiredCache.mjs'
import { ServerExactPool } from './exact/evm/serverExactPool.mjs'
import { X402Gateway } from './task/X402Gateway.mjs'


class X402Middleware {
    #paymentRequiredCache
    #serverExactPool
    #config


    constructor( { paymentRequiredCache, serverExactPool, config } ) {
        this.#paymentRequiredCache = paymentRequiredCache
        this.#serverExactPool = serverExactPool
        this.#config = config
    }


    static async create( { x402V2ExactEvmConfiguration, server, mcp = {} } ) {
        // Validate inputs
        const { status, messages } = X402Middleware
            .#validationCreate( { x402V2ExactEvmConfiguration, server, mcp } )

        if( !status ) {
            throw new Error( `X402Middleware.create: ${messages.join( ', ' )}` )
        }

        const {
            contractCatalog,
            paymentOptionCatalog,
            restrictedCalls
        } = x402V2ExactEvmConfiguration

        const {
            payToAddressMap,
            defaultMaxTimeoutSeconds = 300,
            providerUrlByPaymentNetworkId,
            facilitatorPrivateKeyByPaymentNetworkId,
            simulateBeforeSettle = true,
            silent = false
        } = server

        const {
            paymentMetaKey = 'x402/payment',
            paymentResponseMetaKey = 'x402/payment-response',
            resourcePrefix = 'mcp://tool/'
        } = mcp

        // Validate configuration using core v2
        const { configurationValidationOk, configurationValidationIssueList } = ConfigValidator
            .validateX402V2ExactEvmConfiguration( {
                contractCatalog,
                paymentOptionCatalog,
                serverPayToAddressMap: payToAddressMap
            } )

        if( !configurationValidationOk ) {
            throw new Error( `Configuration validation failed: ${JSON.stringify( configurationValidationIssueList )}` )
        }

        // Prepare payment option catalog
        const { preparedPaymentOptionCatalog } = ServerExact
            .getPreparedPaymentOptionCatalog( {
                paymentOptionCatalog,
                serverPayToAddressMap: payToAddressMap,
                serverDefaultMaxTimeoutSeconds: defaultMaxTimeoutSeconds,
                contractCatalog
            } )

        // Build payment required cache
        const paymentRequiredCache = new PaymentRequiredCache()
        const { cacheSize } = paymentRequiredCache
            .build( {
                restrictedCalls,
                preparedPaymentOptionCatalog,
                contractCatalog,
                resourcePrefix
            } )

        if( !silent ) {
            console.log( `✅ PaymentRequired cache built for ${cacheSize} restricted tool(s)` )
        }

        // Initialize server exact pool for multi-network
        const serverExactPool = new ServerExactPool( { silent } )
        const { poolSize } = await serverExactPool
            .init( {
                providerUrlByPaymentNetworkId,
                facilitatorPrivateKeyByPaymentNetworkId
            } )

        if( !silent ) {
            console.log( `✅ ServerExact pool initialized for ${poolSize} network(s)` )
        }

        const config = {
            paymentMetaKey,
            paymentResponseMetaKey,
            simulateBeforeSettle
        }

        const x402Middleware = new X402Middleware( {
            paymentRequiredCache,
            serverExactPool,
            config
        } )

        return x402Middleware
    }


    mcp() {
        const middleware = X402Gateway
            .mcp( {
                paymentRequiredCache: this.#paymentRequiredCache,
                serverExactPool: this.#serverExactPool,
                config: this.#config
            } )

        return middleware
    }


    static #validationCreate( { x402V2ExactEvmConfiguration, server, mcp } ) {
        const struct = { status: false, messages: [] }

        // Validate x402V2ExactEvmConfiguration
        if( x402V2ExactEvmConfiguration === undefined ) {
            struct[ 'messages' ].push( 'x402V2ExactEvmConfiguration: Is required' )
        } else if( typeof x402V2ExactEvmConfiguration !== 'object' || Array.isArray( x402V2ExactEvmConfiguration ) ) {
            struct[ 'messages' ].push( 'x402V2ExactEvmConfiguration: Must be an object' )
        } else {
            if( !x402V2ExactEvmConfiguration.contractCatalog ) {
                struct[ 'messages' ].push( 'x402V2ExactEvmConfiguration.contractCatalog: Is required' )
            }
            if( !x402V2ExactEvmConfiguration.paymentOptionCatalog ) {
                struct[ 'messages' ].push( 'x402V2ExactEvmConfiguration.paymentOptionCatalog: Is required' )
            }
            if( !x402V2ExactEvmConfiguration.restrictedCalls ) {
                struct[ 'messages' ].push( 'x402V2ExactEvmConfiguration.restrictedCalls: Is required' )
            } else if( !Array.isArray( x402V2ExactEvmConfiguration.restrictedCalls ) ) {
                struct[ 'messages' ].push( 'x402V2ExactEvmConfiguration.restrictedCalls: Must be an array' )
            }
        }

        // Validate server
        if( server === undefined ) {
            struct[ 'messages' ].push( 'server: Is required' )
        } else if( typeof server !== 'object' || Array.isArray( server ) ) {
            struct[ 'messages' ].push( 'server: Must be an object' )
        } else {
            if( !server.payToAddressMap ) {
                struct[ 'messages' ].push( 'server.payToAddressMap: Is required' )
            }
            if( !server.providerUrlByPaymentNetworkId ) {
                struct[ 'messages' ].push( 'server.providerUrlByPaymentNetworkId: Is required' )
            }
            if( !server.facilitatorPrivateKeyByPaymentNetworkId ) {
                struct[ 'messages' ].push( 'server.facilitatorPrivateKeyByPaymentNetworkId: Is required' )
            }
        }

        // Validate mcp (optional)
        if( mcp !== undefined && ( typeof mcp !== 'object' || Array.isArray( mcp ) ) ) {
            struct[ 'messages' ].push( 'mcp: Must be an object' )
        }

        if( struct[ 'messages' ].length > 0 ) {
            return struct
        }

        struct[ 'status' ] = true

        return struct
    }
}


export { X402Middleware }
