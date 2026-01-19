# X402 MCP Middleware v2

> **Current Version** - MCP-spec-compliant payment middleware with multi-network support.

[![Test](https://img.shields.io/github/actions/workflow/status/flowmcp/x402-mcp-middleware/test-on-release.yml)]() ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

Express middleware for integrating x402 micropayments into MCP (Model Context Protocol) servers. Version 2 features multi-network support and full MCP specification compliance.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
  - [Server Setup](#server-setup)
  - [Client Integration](#client-integration)
- [Features](#features)
- [Key Changes from v1](#key-changes-from-v1)
- [Methods](#methods)
  - [X402Middleware.create()](#x402middlewarecreate)
  - [middleware.mcp()](#middlewaremcp)
- [Configuration](#configuration)
  - [x402V2ExactEvmConfiguration](#x402v2exactevmconfiguration)
  - [server](#server)
  - [mcp](#mcp)
- [MCP Protocol](#mcp-protocol)
  - [Payment Required](#payment-required-server--client)
  - [Payment Submission](#payment-submission-client--server)
  - [Payment Response](#payment-response-server--client)
- [Multi-Network Support](#multi-network-support)
- [Payment Flow](#payment-flow)
- [Contribution](#contribution)
- [License](#license)

## Installation

```bash
npm install x402-mcp-middleware
```

```javascript
import { X402Middleware } from 'x402-mcp-middleware/v2'
```

## Quick Start

### Server Setup

```javascript
import express from 'express'
import { X402Middleware } from 'x402-mcp-middleware/v2'

const app = express()
app.use( express.json() )

const middleware = await X402Middleware.create( {
    x402V2ExactEvmConfiguration: {
        contractCatalog: {
            'usdc-base-sepolia': {
                paymentNetworkId: 'eip155:84532',
                address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
                decimals: 6,
                domainName: 'USDC',
                domainVersion: '2'
            },
            'usdc-avalanche-fuji': {
                paymentNetworkId: 'eip155:43113',
                address: '0x5425890298aed601595a70AB815c96711a31Bc65',
                decimals: 6,
                domainName: 'USDC',
                domainVersion: '2'
            }
        },
        paymentOptionCatalog: {
            'base-usdc-10k': {
                contractId: 'usdc-base-sepolia',
                amount: '10000',
                payTo: '{{facilitator}}',
                maxTimeoutSeconds: 300
            },
            'avax-usdc-10k': {
                contractId: 'usdc-avalanche-fuji',
                amount: '10000',
                payTo: '{{facilitator}}',
                maxTimeoutSeconds: 300
            }
        },
        restrictedCalls: [
            {
                method: 'tools/call',
                name: 'premium_tool',
                acceptedPaymentOptionIdList: [ 'base-usdc-10k', 'avax-usdc-10k' ]
            }
        ]
    },
    server: {
        payToAddressMap: {
            facilitator: process.env.FACILITATOR_ADDRESS
        },
        providerUrlByPaymentNetworkId: {
            'eip155:84532': process.env.BASE_SEPOLIA_RPC,
            'eip155:43113': process.env.AVALANCHE_FUJI_RPC
        },
        facilitatorPrivateKeyByPaymentNetworkId: {
            'eip155:84532': process.env.FACILITATOR_KEY_BASE,
            'eip155:43113': process.env.FACILITATOR_KEY_AVAX
        },
        defaultMaxTimeoutSeconds: 300,
        simulateBeforeSettle: true,
        silent: false
    },
    mcp: {
        paymentMetaKey: 'x402/payment',
        paymentResponseMetaKey: 'x402/payment-response',
        resourcePrefix: 'mcp://tool/'
    }
} )

// Apply middleware to Express app
app.use( middleware.mcp() )

app.listen( 8080, () => {
    console.log( 'X402 MCP Server v2 running on port 8080' )
} )
```

### Client Integration

```javascript
import { ClientExact } from 'x402-core/v2/exact/evm'

// Initialize client for Base Sepolia
const client = new ClientExact( { silent: false } )
    .init( { providerUrl: process.env.BASE_SEPOLIA_RPC } )

await client.setWallet( { privateKey: process.env.CLIENT_PRIVATE_KEY } )

// Handle 402 Payment Required response
async function handlePaymentRequired( paymentRequiredResponsePayload ) {
    // Select matching payment option based on client constraints
    const { selectedPaymentRequirements } = ClientExact
        .selectMatchingPaymentOption( {
            paymentRequiredResponsePayload,
            clientSupportedPaymentNetworkIdList: [ 'eip155:84532', 'eip155:43113' ],
            clientAllowedAssetConstraintList: [
                { asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', maxAmount: '1000000' },
                { asset: '0x5425890298aed601595a70AB815c96711a31Bc65', maxAmount: '1000000' }
            ],
            paymentOptionSelectionPolicy: null
        } )

    // Create EIP-3009 authorization
    const { exactEvmAuthorizationPayload, exactEvmAuthorizationSignature } = await client
        .createAuthorization( {
            selectedPaymentRequirements,
            exactEvmAuthorizationTimeWindowDefinition: { validAfterOffsetSeconds: -30 }
        } )

    // Build payment payload
    const { paymentPayload } = ClientExact
        .createPaymentPayloadObject( {
            resource: paymentRequiredResponsePayload.resource,
            selectedPaymentRequirements,
            exactEvmAuthorizationPayload,
            exactEvmAuthorizationSignature
        } )

    return paymentPayload
}

// MCP Client request with payment in _meta
const mcpRequest = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
        name: 'premium_tool',
        arguments: { query: 'test' },
        _meta: {
            'x402/payment': paymentPayload
        }
    }
}
```

## Features

- **Multi-Network Support**: Accept payments from multiple blockchains simultaneously
- **MCP-Spec Compliant**: Uses JSON-RPC error codes and `_meta` for payment transmission
- **Automatic Network Routing**: Routes payments to correct network based on payload
- **EIP-3009 Authorization**: Gasless transfers using `transferWithAuthorization`
- **Payment Validation**: Server-side validation of signatures and amounts
- **Simulation Before Settlement**: Optional transaction simulation before on-chain settlement
- **Configurable Meta Keys**: Customize payment and response meta keys

## Key Changes from v1

| Feature | v1 (Legacy) | v2 |
|---------|-------------|-----|
| Multi-chain | No | Yes |
| Payment transmission | `X-PAYMENT` header | `_meta["x402/payment"]` |
| Payment required | HTTP 402 status | JSON-RPC error code 402 |
| MCP spec compliant | No | Yes |
| Network routing | Single network | Automatic by payload |
| Configuration | Flat structure | Nested catalogs |
| Amount format | Human-readable (`'0.01'`) | Raw units (`'10000'`) |

## Methods

### X402Middleware.create()

Creates and initializes a new X402Middleware instance with multi-network support.

**Signature:**
```javascript
static async .create( { x402V2ExactEvmConfiguration, server, mcp } )
```

**Parameters:**

| Key | Type | Description | Required |
|-----|------|-------------|----------|
| x402V2ExactEvmConfiguration | object | Contract, payment option, and restricted call definitions | Yes |
| server | object | Server configuration (providers, keys, settings) | Yes |
| mcp | object | MCP-specific settings (meta keys, resource prefix) | No |

**Returns:**
```javascript
returns X402Middleware
```

The method returns a configured X402Middleware instance ready to be used as Express middleware.

**Example:**
```javascript
const middleware = await X402Middleware.create( {
    x402V2ExactEvmConfiguration: {
        contractCatalog: { /* ... */ },
        paymentOptionCatalog: { /* ... */ },
        restrictedCalls: [ /* ... */ ]
    },
    server: {
        payToAddressMap: { /* ... */ },
        providerUrlByPaymentNetworkId: { /* ... */ },
        facilitatorPrivateKeyByPaymentNetworkId: { /* ... */ }
    }
} )
```

---

### middleware.mcp()

Returns an Express middleware function that intercepts MCP requests and handles payment validation/settlement using the MCP protocol.

**Signature:**
```javascript
.mcp()
```

**Parameters:**

None.

**Returns:**
```javascript
returns function( req, res, next )
```

An Express middleware function.

**Example:**
```javascript
const middleware = await X402Middleware.create( { /* ... */ } )

// Apply to Express app
app.use( middleware.mcp() )

// Or apply to specific route
app.use( '/mcp', middleware.mcp() )
```

## Configuration

### x402V2ExactEvmConfiguration

The main configuration object containing contract, payment option, and access control definitions.

#### contractCatalog

Object defining token contracts by ID.

```javascript
contractCatalog: {
    'usdc-base-sepolia': {
        paymentNetworkId: 'eip155:84532',      // CAIP-2 network identifier
        address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        decimals: 6,
        domainName: 'USDC',                     // EIP-712 domain name
        domainVersion: '2'                      // EIP-712 domain version
    }
}
```

| Key | Type | Description |
|-----|------|-------------|
| paymentNetworkId | string | CAIP-2 network identifier (e.g., `'eip155:84532'`) |
| address | string | Token contract address |
| decimals | number | Token decimals |
| domainName | string | EIP-712 domain name for signature |
| domainVersion | string | EIP-712 domain version |

#### paymentOptionCatalog

Object defining payment options by ID.

```javascript
paymentOptionCatalog: {
    'base-usdc-10k': {
        contractId: 'usdc-base-sepolia',        // Reference to contractCatalog
        amount: '10000',                         // Amount in raw units (not human-readable)
        payTo: '{{facilitator}}',                // Address alias from payToAddressMap
        maxTimeoutSeconds: 300                   // Authorization validity window
    }
}
```

| Key | Type | Description |
|-----|------|-------------|
| contractId | string | ID referencing an entry in `contractCatalog` |
| amount | string | Payment amount in raw token units |
| payTo | string | Recipient address or alias (e.g., `'{{facilitator}}'`) |
| maxTimeoutSeconds | number | Max validity window for authorization (default: 300) |

#### restrictedCalls

Array defining which MCP methods/tools require payment.

```javascript
restrictedCalls: [
    {
        method: 'tools/call',
        name: 'premium_tool',
        acceptedPaymentOptionIdList: [ 'base-usdc-10k', 'avax-usdc-10k' ]
    }
]
```

| Key | Type | Description |
|-----|------|-------------|
| method | string | MCP method (typically `'tools/call'`) |
| name | string | Name of the tool requiring payment |
| acceptedPaymentOptionIdList | array | Array of payment option IDs accepted for this tool |

### server

Server-side configuration for blockchain connections and facilitator wallets.

```javascript
server: {
    payToAddressMap: {
        facilitator: '0x...'                     // Resolve '{{facilitator}}' aliases
    },
    providerUrlByPaymentNetworkId: {
        'eip155:84532': 'https://base-sepolia.rpc...',
        'eip155:43113': 'https://avalanche-fuji.rpc...'
    },
    facilitatorPrivateKeyByPaymentNetworkId: {
        'eip155:84532': '0x...',
        'eip155:43113': '0x...'
    },
    defaultMaxTimeoutSeconds: 300,
    simulateBeforeSettle: true,
    silent: false
}
```

| Key | Type | Description | Required |
|-----|------|-------------|----------|
| payToAddressMap | object | Address aliases used in paymentOptionCatalog | Yes |
| providerUrlByPaymentNetworkId | object | RPC URLs keyed by CAIP-2 network ID | Yes |
| facilitatorPrivateKeyByPaymentNetworkId | object | Facilitator private keys keyed by network ID | Yes |
| defaultMaxTimeoutSeconds | number | Default authorization validity (default: 300) | No |
| simulateBeforeSettle | boolean | Simulate transaction before settlement (default: true) | No |
| silent | boolean | Suppress console logs (default: false) | No |

### mcp

MCP-specific configuration (optional).

```javascript
mcp: {
    paymentMetaKey: 'x402/payment',
    paymentResponseMetaKey: 'x402/payment-response',
    resourcePrefix: 'mcp://tool/'
}
```

| Key | Type | Description | Default |
|-----|------|-------------|---------|
| paymentMetaKey | string | Meta key for payment in request | `'x402/payment'` |
| paymentResponseMetaKey | string | Meta key for response | `'x402/payment-response'` |
| resourcePrefix | string | Prefix for resource URIs | `'mcp://tool/'` |

## MCP Protocol

### Payment Required (Server → Client)

When a restricted tool is called without payment, the server responds with a JSON-RPC error:

```json
{
    "jsonrpc": "2.0",
    "id": 1,
    "error": {
        "code": 402,
        "message": "Payment Required",
        "data": {
            "x402Version": 2,
            "resource": "mcp://tool/premium_tool",
            "accepts": [
                {
                    "scheme": "exact",
                    "network": "eip155:84532",
                    "amount": "10000",
                    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                    "payTo": "0x...",
                    "maxTimeoutSeconds": 300,
                    "extra": {
                        "name": "USDC",
                        "version": "2"
                    }
                },
                {
                    "scheme": "exact",
                    "network": "eip155:43113",
                    "amount": "10000",
                    "asset": "0x5425890298aed601595a70AB815c96711a31Bc65",
                    "payTo": "0x...",
                    "maxTimeoutSeconds": 300,
                    "extra": {
                        "name": "USDC",
                        "version": "2"
                    }
                }
            ]
        }
    }
}
```

### Payment Submission (Client → Server)

Client includes payment in `params._meta["x402/payment"]`:

```json
{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
        "name": "premium_tool",
        "arguments": { "query": "test" },
        "_meta": {
            "x402/payment": {
                "x402Version": 2,
                "resource": "mcp://tool/premium_tool",
                "accepted": {
                    "scheme": "exact",
                    "network": "eip155:84532",
                    "amount": "10000",
                    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
                    "payTo": "0x..."
                },
                "payload": {
                    "authorization": {
                        "from": "0x...",
                        "to": "0x...",
                        "value": "10000",
                        "validAfter": "1700000000",
                        "validBefore": "1700000300",
                        "nonce": "0x..."
                    },
                    "signature": "0x..."
                }
            }
        }
    }
}
```

### Payment Response (Server → Client)

On successful payment, response includes `result._meta["x402/payment-response"]`:

```json
{
    "jsonrpc": "2.0",
    "id": 2,
    "result": {
        "content": [
            {
                "type": "text",
                "text": "Premium tool result..."
            }
        ],
        "_meta": {
            "x402/payment-response": {
                "success": true,
                "transaction": "0x...",
                "network": "eip155:84532",
                "payer": "0x..."
            }
        }
    }
}
```

## Multi-Network Support

v2 supports multiple blockchains simultaneously. Configure providers and facilitator keys for each network:

```javascript
providerUrlByPaymentNetworkId: {
    'eip155:84532':    'https://base-sepolia.rpc...',
    'eip155:43113':    'https://avalanche-fuji.rpc...',
    'eip155:11155111': 'https://ethereum-sepolia.rpc...'
},
facilitatorPrivateKeyByPaymentNetworkId: {
    'eip155:84532':    process.env.KEY_BASE,
    'eip155:43113':    process.env.KEY_AVAX,
    'eip155:11155111': process.env.KEY_ETH
}
```

The middleware automatically routes payments to the correct network based on the `accepted.network` in the payment payload.

### Network Identifier Format

Network identifiers follow the CAIP-2 specification:
- `eip155:84532` - Base Sepolia
- `eip155:43113` - Avalanche Fuji
- `eip155:11155111` - Ethereum Sepolia

## Payment Flow

```
┌────────────────┐                    ┌────────────────┐
│     Client     │                    │     Server     │
└───────┬────────┘                    └───────┬────────┘
        │                                     │
        │  1. tools/call (no payment)         │
        │ ──────────────────────────────────> │
        │                                     │
        │  2. JSON-RPC error 402 + accepts    │
        │ <────────────────────────────────── │
        │                                     │
        │  3. tools/call + _meta["x402/..."]  │
        │ ──────────────────────────────────> │
        │                                     │
        │     4. Validate → Simulate → Settle │
        │                                     │
        │  5. result + _meta["x402/..."]      │
        │ <────────────────────────────────── │
        │                                     │
```

1. Client calls a premium tool without payment
2. Server responds with JSON-RPC error 402 and payment options
3. Client selects option, creates authorization, sends with `_meta`
4. Server validates signature, simulates (optional), and settles on-chain
5. Server executes tool and returns result with settlement receipt in `_meta`

## Contribution

Contributions are welcome. Please follow the existing code style and include tests for new features.

## License

MIT
