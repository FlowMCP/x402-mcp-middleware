// X402 MCP Middleware v2 - Full E2E Test with Real Credentials
// Tests complete MCP flow: 402 → Payment → Settlement → Response

import { X402Middleware, JsonRpc, Meta } from '../../src/v2/index.mjs'
import { ClientExact } from 'x402-core/v2/exact/evm'
import { readFileSync } from 'fs'
import { resolve } from 'path'


// Load .env from parent directories
function loadEnv( envPath ) {
    const content = readFileSync( resolve( process.cwd(), envPath ), 'utf-8' )
    const env = {}

    content
        .split( '\n' )
        .filter( ( line ) => line && !line.startsWith( '#' ) )
        .forEach( ( line ) => {
            const [ key, ...valueParts ] = line.split( '=' )
            if( key ) {
                env[ key.trim() ] = valueParts.join( '=' ).trim()
            }
        } )

    return env
}

const env = loadEnv( './../../../../../.env' )


// Configuration
const config = {
    x402V2ExactEvmConfiguration: {
        contractCatalog: {
            'usdc-base-sepolia': {
                paymentNetworkId: 'eip155:84532',
                address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
                decimals: 6,
                domainName: 'USDC',
                domainVersion: '2'
            }
        },
        paymentOptionCatalog: {
            'usdc-10k': {
                contractId: 'usdc-base-sepolia',
                amount: '10000',
                payTo: '{{facilitator}}',
                maxTimeoutSeconds: 300
            }
        },
        restrictedCalls: [
            {
                method: 'tools/call',
                name: 'premium_tool',
                acceptedPaymentOptionIdList: [ 'usdc-10k' ]
            }
        ]
    },
    server: {
        payToAddressMap: {
            facilitator: env.ACCOUNT_DEVELOPMENT2_PUBLIC_KEY
        },
        providerUrlByPaymentNetworkId: {
            'eip155:84532': env.BASE_SEPOLIA_ALCHEMY_HTTP
        },
        facilitatorPrivateKeyByPaymentNetworkId: {
            'eip155:84532': env.ACCOUNT_DEVELOPMENT2_PRIVATE_KEY
        },
        silent: false
    }
}


// Mock Express req/res
function createMockReq( body, headers = {} ) {
    return {
        body,
        get: ( name ) => headers[ name.toLowerCase() ]
    }
}

function createMockRes() {
    return {
        statusCode: 200,
        locals: {},
        _json: null,
        _jsonCalled: false,
        status( code ) {
            this.statusCode = code
            return this
        },
        json( data ) {
            this._json = data
            this._jsonCalled = true
            return this
        }
    }
}


console.log( '═══════════════════════════════════════════════════════════════════' )
console.log( '  X402 MCP Middleware v2 - Full E2E Test' )
console.log( '═══════════════════════════════════════════════════════════════════' )
console.log( '' )


// 1️⃣ Initialize Middleware
console.log( '1️⃣  Initializing X402Middleware v2...' )
console.log( '' )

const middleware = await X402Middleware.create( config )
const mcpMiddleware = middleware.mcp()

console.log( '' )


// 2️⃣ Test: Non-restricted tool passes through
console.log( '─────────────────────────────────────────────────────────────────────' )
console.log( '2️⃣  Non-restricted tool → Pass through' )
console.log( '' )

const freeReq = createMockReq( {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'free_tool', arguments: {} }
} )
const freeRes = createMockRes()
let freeNextCalled = false

await mcpMiddleware( freeReq, freeRes, () => { freeNextCalled = true } )

console.log( `   next() called: ${freeNextCalled ? '✅' : '❌'}` )
console.log( `   No 402 response: ${!freeRes._jsonCalled ? '✅' : '❌'}` )
console.log( '' )


// 3️⃣ Test: Restricted tool without payment → 402
console.log( '─────────────────────────────────────────────────────────────────────' )
console.log( '3️⃣  Restricted tool WITHOUT payment → 402 PaymentRequired' )
console.log( '' )

const noPayReq = createMockReq( {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'premium_tool', arguments: {} }
} )
const noPayRes = createMockRes()
let noPayNextCalled = false

await mcpMiddleware( noPayReq, noPayRes, () => { noPayNextCalled = true } )

console.log( `   next() NOT called: ${!noPayNextCalled ? '✅' : '❌'}` )
console.log( `   Response sent: ${noPayRes._jsonCalled ? '✅' : '❌'}` )
console.log( `   error.code = 402: ${noPayRes._json?.error?.code === 402 ? '✅' : '❌'}` )
console.log( `   error.data has resource: ${noPayRes._json?.error?.data?.resource ? '✅' : '❌'}` )
console.log( `   error.data has accepts: ${Array.isArray( noPayRes._json?.error?.data?.accepts ) ? '✅' : '❌'}` )

if( noPayRes._json?.error?.data?.accepts?.[ 0 ] ) {
    const accept = noPayRes._json.error.data.accepts[ 0 ]
    console.log( `   accepts[0].network: ${accept.network}` )
    console.log( `   accepts[0].amount: ${accept.amount}` )
}

console.log( '' )


// 4️⃣ Test: Restricted tool WITH valid payment → Settlement
console.log( '─────────────────────────────────────────────────────────────────────' )
console.log( '4️⃣  Restricted tool WITH payment → Validate + Settle' )
console.log( '' )

// Create client and payment
const client = new ClientExact( { silent: true } )
    .init( { providerUrl: env.BASE_SEPOLIA_ALCHEMY_HTTP } )
await client.setWallet( { privateKey: env.ACCOUNT_DEVELOPMENT_PRIVATE_KEY } )

// Get payment requirements from 402 response
const paymentRequired = noPayRes._json.error.data

// Select payment option
const { selectedPaymentRequirements } = ClientExact
    .selectMatchingPaymentOption( {
        paymentRequiredResponsePayload: paymentRequired,
        clientSupportedPaymentNetworkIdList: [ 'eip155:84532' ],
        clientAllowedAssetConstraintList: [
            { asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', maxAmount: '1000000' }
        ]
    } )

console.log( `   Selected: ${selectedPaymentRequirements.network} - ${selectedPaymentRequirements.amount} units` )

// Create authorization
const { exactEvmAuthorizationPayload, exactEvmAuthorizationSignature } = await client
    .createAuthorization( {
        selectedPaymentRequirements,
        exactEvmAuthorizationTimeWindowDefinition: { validAfterOffsetSeconds: -30 }
    } )

// Build payment payload
const { paymentPayload } = ClientExact
    .createPaymentPayloadObject( {
        resource: paymentRequired.resource,
        selectedPaymentRequirements,
        exactEvmAuthorizationPayload,
        exactEvmAuthorizationSignature
    } )

console.log( `   Authorization nonce: ${exactEvmAuthorizationPayload.nonce.slice( 0, 20 )}...` )

// Send request with payment in _meta
const payReq = createMockReq( {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/call',
    params: {
        name: 'premium_tool',
        arguments: { query: 'test' },
        _meta: {
            'x402/payment': paymentPayload
        }
    }
} )
const payRes = createMockRes()
let payNextCalled = false

await mcpMiddleware( payReq, payRes, async () => {
    payNextCalled = true
    // Simulate tool execution and response
    payRes.json( {
        jsonrpc: '2.0',
        id: 3,
        result: {
            content: [ { type: 'text', text: 'Premium content!' } ]
        }
    } )
} )

console.log( '' )
console.log( `   next() called (tool executed): ${payNextCalled ? '✅' : '❌'}` )
console.log( `   Response sent: ${payRes._jsonCalled ? '✅' : '❌'}` )

if( payRes._json?.result ) {
    console.log( `   Has result (not error): ✅` )
    console.log( `   Has _meta: ${payRes._json.result._meta ? '✅' : '❌'}` )

    const paymentResponse = payRes._json.result._meta?.[ 'x402/payment-response' ]
    if( paymentResponse ) {
        console.log( `   Has x402/payment-response: ✅` )
        console.log( '' )
        console.log( `   Settlement Result:` )
        console.log( `     success: ${paymentResponse.success}` )
        console.log( `     transaction: ${paymentResponse.transaction}` )
        console.log( `     network: ${paymentResponse.network}` )
        console.log( `     payer: ${paymentResponse.payer}` )
    } else {
        console.log( `   Has x402/payment-response: ❌` )
    }
} else if( payRes._json?.error ) {
    console.log( `   ERROR: ${payRes._json.error.message}` )
    console.log( `   Data: ${JSON.stringify( payRes._json.error.data, null, 2 )}` )
}

console.log( '' )
console.log( '═══════════════════════════════════════════════════════════════════' )
console.log( '  E2E Test Complete' )
console.log( '═══════════════════════════════════════════════════════════════════' )
