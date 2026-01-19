// GitHub CI Test - Middleware Initialization Tests (No Blockchain Transactions)
// Tests v1 (legacy) and v2 middleware initialization

import { RemoteServer } from 'mcpServers'
import { FlowMCP } from 'flowmcp'
import { ServerManager } from './../tests/helpers/ServerManager.mjs'

import { schema as ping } from './../tests/schemas/v1.2.0/x402/ping.mjs'
import { schema as pinataRead } from './../tests/schemas/v1.2.0/pinata/read.mjs'

console.log( '═══════════════════════════════════════════════════════════════════' )
console.log( '  x402-mcp-middleware GitHub CI Tests' )
console.log( '═══════════════════════════════════════════════════════════════════' )
console.log( '' )


// ═══════════════════════════════════════════════════════════════════════════════
// v1 LEGACY TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { X402Middleware as X402MiddlewareV1 } from './../src/legacy/index.mjs'

console.log( '1️⃣  v1 (Legacy) Middleware Tests' )
console.log( '' )

const v1Env = {
    'envPath': './.github/.example.env',
    'envSelection': [
        [ 'facilitatorPrivateKey', 'ACCOUNT_DEVELOPMENT2_PRIVATE_KEY' ],
        [ 'payTo1',                'ACCOUNT_DEVELOPMENT2_PUBLIC_KEY'  ],
        [ 'serverProviderUrl',     'BASE_SEPOLIA_ALCHEMY_HTTP'        ]
    ]
}

const v1Config = {
    'routePath': '/x402',
    'chainId': 84532,
    'chainName': 'base-sepolia',
    'restrictedCalls': [
        {
            'method': 'tools/call',
            'name': 'paid_ping_x402',
            'activePaymentOptions': [ 'usdc-sepolia' ]
        }
    ],
    'paymentOptions': {
        'usdc-sepolia': {
            'contractId': 'usdc-sepolia',
            'maxAmountRequired': '0.01',
            'payTo': '{{payTo1}}'
        }
    },
    'contracts': {
        'usdc-sepolia': {
            'domainName': 'USDC',
            'address': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            'assetType': 'erc20',
            'decimals': 6
        }
    }
}

// Test v1 X402Middleware.create validation (should fail with missing params)
try {
    await X402MiddlewareV1.create( {} )
    console.log( '   ❌ v1 X402Middleware.create() should throw on missing params' )
    process.exit( 1 )
} catch( e ) {
    if( e.message.includes( 'chainId: Is required' ) ) {
        console.log( '   ✅ v1 X402Middleware.create() validation (missing params)' )
    } else {
        console.log( '   ❌ v1 X402Middleware.create() unexpected error:', e.message )
        process.exit( 1 )
    }
}

// Test v1 X402Middleware.create with valid params
try {
    const { envPath, envSelection } = v1Env
    const { chainId, chainName, restrictedCalls, paymentOptions, contracts } = v1Config

    const { envObject } = ServerManager
        .getEnvObject( { envPath } )
    let { x402Credentials, privateKey: x402PrivateKey } = ServerManager
        .getX402Credentials( { envPath, envSelection } )

    // Use env variable if available (for GitHub CI)
    x402PrivateKey = process.env.ACCOUNT_DEVELOPMENT2_PRIVATE_KEY || x402PrivateKey

    const middleware = await X402MiddlewareV1
        .create( { chainId, chainName, contracts, paymentOptions, restrictedCalls, x402Credentials, x402PrivateKey } )

    if( !middleware ) {
        throw new Error( 'middleware is null' )
    }

    if( typeof middleware.mcp !== 'function' ) {
        throw new Error( 'middleware.mcp is not a function' )
    }

    const mcpMiddleware = middleware.mcp()

    if( typeof mcpMiddleware !== 'function' ) {
        throw new Error( 'mcp() did not return a function' )
    }

    console.log( '   ✅ v1 X402Middleware.create() with valid params' )
    console.log( '   ✅ v1 middleware.mcp() returns middleware function' )
} catch( e ) {
    console.log( '   ❌ v1 X402Middleware.create():', e.message )
    process.exit( 1 )
}

console.log( '' )


// ═══════════════════════════════════════════════════════════════════════════════
// v2 TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { X402Middleware as X402MiddlewareV2 } from './../src/v2/index.mjs'

console.log( '2️⃣  v2 Middleware Tests' )
console.log( '' )

const v2Env = {
    'envPath': './.github/.example.env',
    'envSelection': [
        [ 'facilitatorPrivateKey', 'ACCOUNT_DEVELOPMENT2_PRIVATE_KEY' ],
        [ 'payTo1',                'ACCOUNT_DEVELOPMENT2_PUBLIC_KEY'  ],
        [ 'serverProviderUrl',     'BASE_SEPOLIA_ALCHEMY_HTTP'        ]
    ]
}

const v2Config = {
    'x402V2ExactEvmConfiguration': {
        'contractCatalog': {
            'usdc-base-sepolia': {
                'paymentNetworkId': 'eip155:84532',
                'address': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
                'decimals': 6,
                'domainName': 'USDC',
                'domainVersion': '2'
            },
            'usdc-avalanche-fuji': {
                'paymentNetworkId': 'eip155:43113',
                'address': '0x5425890298aed601595a70AB815c96711a31Bc65',
                'decimals': 6,
                'domainName': 'USDC',
                'domainVersion': '2'
            }
        },
        'paymentOptionCatalog': {
            'usdc-10k': {
                'contractId': 'usdc-base-sepolia',
                'amount': '10000',
                'payTo': '{{facilitator}}',
                'maxTimeoutSeconds': 300
            },
            'usdc-avax-10k': {
                'contractId': 'usdc-avalanche-fuji',
                'amount': '10000',
                'payTo': '{{facilitator}}',
                'maxTimeoutSeconds': 300
            }
        },
        'restrictedCalls': [
            {
                'method': 'tools/call',
                'name': 'paid_ping_x402',
                'acceptedPaymentOptionIdList': [ 'usdc-10k', 'usdc-avax-10k' ]
            }
        ]
    }
}

// Test v2 X402Middleware.create validation (should fail with missing params)
try {
    await X402MiddlewareV2.create( {} )
    console.log( '   ❌ v2 X402Middleware.create() should throw on missing params' )
    process.exit( 1 )
} catch( e ) {
    if( e.message.includes( 'x402V2ExactEvmConfiguration: Is required' ) ) {
        console.log( '   ✅ v2 X402Middleware.create() validation (missing params)' )
    } else {
        console.log( '   ❌ v2 X402Middleware.create() unexpected error:', e.message )
        process.exit( 1 )
    }
}

// Test v2 X402Middleware.create validation (should fail with missing server params)
try {
    await X402MiddlewareV2.create( {
        x402V2ExactEvmConfiguration: v2Config.x402V2ExactEvmConfiguration
    } )
    console.log( '   ❌ v2 X402Middleware.create() should throw on missing server' )
    process.exit( 1 )
} catch( e ) {
    if( e.message.includes( 'server: Is required' ) ) {
        console.log( '   ✅ v2 X402Middleware.create() validation (missing server)' )
    } else {
        console.log( '   ❌ v2 X402Middleware.create() unexpected error:', e.message )
        process.exit( 1 )
    }
}

// Test v2 X402Middleware.create with valid params
try {
    const { envPath, envSelection } = v2Env
    const { x402V2ExactEvmConfiguration } = v2Config

    const { x402Credentials, privateKey: facilitatorPrivateKey } = ServerManager
        .getX402Credentials( { envPath, envSelection } )

    // Use env variable if available (for GitHub CI)
    const effectivePrivateKey = process.env.ACCOUNT_DEVELOPMENT2_PRIVATE_KEY || facilitatorPrivateKey

    const middleware = await X402MiddlewareV2
        .create( {
            x402V2ExactEvmConfiguration,
            server: {
                payToAddressMap: {
                    facilitator: x402Credentials.payTo1
                },
                providerUrlByPaymentNetworkId: {
                    'eip155:84532': x402Credentials.serverProviderUrl,
                    'eip155:43113': 'https://api.avax-test.network/ext/bc/C/rpc'
                },
                facilitatorPrivateKeyByPaymentNetworkId: {
                    'eip155:84532': effectivePrivateKey,
                    'eip155:43113': effectivePrivateKey
                },
                silent: true
            }
        } )

    if( !middleware ) {
        throw new Error( 'middleware is null' )
    }

    if( typeof middleware.mcp !== 'function' ) {
        throw new Error( 'middleware.mcp is not a function' )
    }

    const mcpMiddleware = middleware.mcp()

    if( typeof mcpMiddleware !== 'function' ) {
        throw new Error( 'mcp() did not return a function' )
    }

    console.log( '   ✅ v2 X402Middleware.create() with valid params' )
    console.log( '   ✅ v2 middleware.mcp() returns middleware function' )
} catch( e ) {
    console.log( '   ❌ v2 X402Middleware.create():', e.message )
    process.exit( 1 )
}

// Test v2 with multi-network configuration (2 chains - more reliable for CI)
try {
    const { envPath, envSelection } = v2Env
    const { x402Credentials, privateKey: facilitatorPrivateKey } = ServerManager
        .getX402Credentials( { envPath, envSelection } )

    const effectivePrivateKey = process.env.ACCOUNT_DEVELOPMENT2_PRIVATE_KEY || facilitatorPrivateKey

    const multiNetworkConfig = {
        'contractCatalog': {
            'usdc-base': {
                'paymentNetworkId': 'eip155:84532',
                'address': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
                'decimals': 6,
                'domainName': 'USDC',
                'domainVersion': '2'
            },
            'usdc-avax': {
                'paymentNetworkId': 'eip155:43113',
                'address': '0x5425890298aed601595a70AB815c96711a31Bc65',
                'decimals': 6,
                'domainName': 'USDC',
                'domainVersion': '2'
            }
        },
        'paymentOptionCatalog': {
            'base-10k': { 'contractId': 'usdc-base', 'amount': '10000', 'payTo': '{{fac}}' },
            'avax-10k': { 'contractId': 'usdc-avax', 'amount': '10000', 'payTo': '{{fac}}' }
        },
        'restrictedCalls': [
            {
                'method': 'tools/call',
                'name': 'multi_chain_tool',
                'acceptedPaymentOptionIdList': [ 'base-10k', 'avax-10k' ]
            }
        ]
    }

    const middleware = await X402MiddlewareV2
        .create( {
            x402V2ExactEvmConfiguration: multiNetworkConfig,
            server: {
                payToAddressMap: {
                    fac: x402Credentials.payTo1
                },
                providerUrlByPaymentNetworkId: {
                    'eip155:84532': x402Credentials.serverProviderUrl,
                    'eip155:43113': 'https://api.avax-test.network/ext/bc/C/rpc'
                },
                facilitatorPrivateKeyByPaymentNetworkId: {
                    'eip155:84532': effectivePrivateKey,
                    'eip155:43113': effectivePrivateKey
                },
                silent: true
            },
            mcp: {
                paymentMetaKey: 'x402/payment',
                paymentResponseMetaKey: 'x402/payment-response',
                resourcePrefix: 'mcp://tool/'
            }
        } )

    if( !middleware ) {
        throw new Error( 'middleware is null' )
    }

    console.log( '   ✅ v2 X402Middleware.create() with multi-network (2 chains)' )
} catch( e ) {
    console.log( '   ❌ v2 X402Middleware.create() multi-network:', e.message )
    process.exit( 1 )
}

console.log( '' )
console.log( '═══════════════════════════════════════════════════════════════════' )
console.log( '  All Tests Passed!' )
console.log( '═══════════════════════════════════════════════════════════════════' )

process.exit( 0 )
