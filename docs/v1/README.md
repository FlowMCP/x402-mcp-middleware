# X402 MCP Middleware v1 (Legacy)

> **This version is frozen.** No new features will be added.
> For new projects, use [v2](../v2/README.md).

[![Test](https://img.shields.io/github/actions/workflow/status/flowmcp/x402-mcp-middleware/test-on-release.yml)]() ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

Express middleware for integrating x402 micropayments into MCP (Model Context Protocol) servers. This version supports single-chain payment processing with HTTP 402 status codes.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
  - [Server Setup](#server-setup)
  - [Client Integration](#client-integration)
- [Features](#features)
- [Methods](#methods)
  - [X402Middleware.create()](#x402middlewarecreate)
  - [middleware.mcp()](#middlewaremcp)
- [Configuration](#configuration)
  - [restrictedCalls](#restrictedcalls)
  - [paymentOptions](#paymentoptions)
  - [contracts](#contracts)
  - [x402Credentials](#x402credentials)
- [Payment Flow](#payment-flow)
- [Differences from v2](#differences-from-v2)
- [Contribution](#contribution)
- [License](#license)

## Installation

```bash
npm install x402-mcp-middleware
```

```javascript
import { X402Middleware } from 'x402-mcp-middleware/legacy'
```

## Quick Start

### Server Setup

```javascript
import express from 'express'
import { X402Middleware } from 'x402-mcp-middleware/legacy'

const app = express()
app.use( express.json() )

const middleware = await X402Middleware.create( {
    chainId: 84532,
    chainName: 'base-sepolia',
    contracts: {
        'usdc-sepolia': {
            domainName: 'USDC',
            address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            assetType: 'erc20',
            decimals: 6
        }
    },
    paymentOptions: {
        'usdc-sepolia': {
            contractId: 'usdc-sepolia',
            maxAmountRequired: '0.01',
            payTo: '{{payTo1}}'
        }
    },
    restrictedCalls: [
        {
            method: 'tools/call',
            name: 'premium_tool',
            activePaymentOptions: [ 'usdc-sepolia' ]
        }
    ],
    x402Credentials: {
        serverProviderUrl: process.env.BASE_SEPOLIA_RPC,
        payTo1: process.env.FACILITATOR_ADDRESS
    },
    x402PrivateKey: process.env.FACILITATOR_PRIVATE_KEY
} )

// Apply middleware to Express app
app.use( middleware.mcp() )

app.listen( 8080, () => {
    console.log( 'X402 MCP Server running on port 8080' )
} )
```

### Client Integration

```javascript
import { ClientExact } from 'x402-core/legacy'

// Initialize client
const client = new ClientExact( { silent: false } )
    .init( { providerUrl: process.env.BASE_SEPOLIA_RPC } )

await client.setWallet( { privateKey: process.env.CLIENT_PRIVATE_KEY } )

// Handle 402 Payment Required response
async function handlePaymentRequired( paymentRequirementsPayload ) {
    const { chainId } = paymentRequirementsPayload

    // Select matching payment option
    const { paymentOption } = ClientExact
        .selectMatchingPaymentOption( {
            paymentRequirementsPayload,
            allowedPaymentOptions: [
                {
                    name: 'USDC',
                    tokenAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
                    decimals: 6,
                    maxAmountRequired: '0.01'
                }
            ],
            chainId
        } )

    // Create authorization
    const { authorization, signature } = await client
        .createAuthorization( { paymentOption } )

    // Build payment header
    const { xPaymentHeader } = client
        .buildXPaymentHeader( { paymentOption, authorization, signature } )

    return xPaymentHeader
}

// Make request with payment
const response = await fetch( 'http://localhost:8080/mcp', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT': xPaymentHeader
    },
    body: JSON.stringify( {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'premium_tool', arguments: {} }
    } )
} )
```

## Features

- **Single-Chain Support**: Optimized for single blockchain deployment
- **HTTP 402 Status**: Standard HTTP status code for payment required
- **X-PAYMENT Header**: JSON-based payment transmission via HTTP headers
- **EIP-3009 Authorization**: Gasless transfers using `transferWithAuthorization`
- **Payment Validation**: Server-side validation of payment signatures
- **Settlement**: Automatic on-chain settlement via facilitator wallet

## Methods

### X402Middleware.create()

Creates and initializes a new X402Middleware instance.

**Signature:**
```javascript
static async .create( { chainId, chainName, contracts, paymentOptions, restrictedCalls, x402Credentials, x402PrivateKey } )
```

**Parameters:**

| Key | Type | Description | Required |
|-----|------|-------------|----------|
| chainId | number | Blockchain chain ID (e.g., `84532` for Base Sepolia) | Yes |
| chainName | string | Human-readable chain name (e.g., `'base-sepolia'`) | Yes |
| contracts | object | Contract definitions keyed by contract ID | Yes |
| paymentOptions | object | Payment options keyed by option ID | Yes |
| restrictedCalls | array | Array of restricted MCP calls requiring payment | Yes |
| x402Credentials | object | Server credentials including RPC URL and payTo addresses | Yes |
| x402PrivateKey | string | Private key for facilitator wallet | Yes |

**Returns:**
```javascript
returns X402Middleware
```

The method returns a configured X402Middleware instance ready to be used as Express middleware.

**Example:**
```javascript
const middleware = await X402Middleware.create( {
    chainId: 84532,
    chainName: 'base-sepolia',
    contracts: { /* ... */ },
    paymentOptions: { /* ... */ },
    restrictedCalls: [ /* ... */ ],
    x402Credentials: { serverProviderUrl: '...', payTo1: '0x...' },
    x402PrivateKey: '0x...'
} )
```

---

### middleware.mcp()

Returns an Express middleware function that intercepts MCP requests and handles payment validation/settlement.

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

### restrictedCalls

Array defining which MCP methods/tools require payment.

```javascript
restrictedCalls: [
    {
        method: 'tools/call',           // MCP method to intercept
        name: 'premium_tool',           // Tool name requiring payment
        activePaymentOptions: [         // Payment options accepted for this tool
            'usdc-sepolia'
        ]
    },
    {
        method: 'tools/call',
        name: 'another_premium_tool',
        activePaymentOptions: [ 'usdc-sepolia' ]
    }
]
```

| Key | Type | Description |
|-----|------|-------------|
| method | string | MCP method (typically `'tools/call'`) |
| name | string | Name of the tool requiring payment |
| activePaymentOptions | array | Array of payment option IDs accepted |

### paymentOptions

Object defining available payment configurations.

```javascript
paymentOptions: {
    'usdc-sepolia': {
        contractId: 'usdc-sepolia',     // Reference to contracts entry
        maxAmountRequired: '0.01',       // Amount in human-readable format
        payTo: '{{payTo1}}'              // Address alias from x402Credentials
    }
}
```

| Key | Type | Description |
|-----|------|-------------|
| contractId | string | ID referencing an entry in `contracts` |
| maxAmountRequired | string | Payment amount in human-readable format (e.g., `'0.01'` for 0.01 USDC) |
| payTo | string | Recipient address or alias (e.g., `'{{payTo1}}'`) |

### contracts

Object defining token contracts.

```javascript
contracts: {
    'usdc-sepolia': {
        domainName: 'USDC',
        address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        assetType: 'erc20',
        decimals: 6
    }
}
```

| Key | Type | Description |
|-----|------|-------------|
| domainName | string | EIP-712 domain name for signature |
| address | string | Contract address |
| assetType | string | Asset type (`'erc20'`) |
| decimals | number | Token decimals |

### x402Credentials

Object containing server-side credentials and aliases.

```javascript
x402Credentials: {
    serverProviderUrl: 'https://base-sepolia.rpc...',
    payTo1: '0x...'
}
```

| Key | Type | Description |
|-----|------|-------------|
| serverProviderUrl | string | RPC URL for blockchain connection |
| payTo1, payTo2, ... | string | Address aliases used in paymentOptions |

## Payment Flow

```
┌────────────────┐                    ┌────────────────┐
│     Client     │                    │     Server     │
└───────┬────────┘                    └───────┬────────┘
        │                                     │
        │  1. Request premium tool            │
        │ ──────────────────────────────────> │
        │                                     │
        │  2. HTTP 402 + PaymentRequired      │
        │ <────────────────────────────────── │
        │                                     │
        │  3. Request + X-PAYMENT header      │
        │ ──────────────────────────────────> │
        │                                     │
        │         4. Validate & Settle        │
        │                                     │
        │  5. Response + X-PAYMENT-RESPONSE   │
        │ <────────────────────────────────── │
        │                                     │
```

1. Client requests a premium tool without payment
2. Server responds with HTTP 402 and payment requirements
3. Client creates EIP-3009 authorization and sends with X-PAYMENT header
4. Server validates signature and settles on-chain
5. Server executes tool and returns result with settlement receipt

## Differences from v2

| Feature | v1 (Legacy) | v2 |
|---------|-------------|-----|
| Multi-chain | No | Yes |
| Payment transmission | `X-PAYMENT` header | `_meta["x402/payment"]` |
| Payment required | HTTP 402 status | JSON-RPC error 402 |
| MCP spec compliant | No | Yes |
| Network routing | Single network | Automatic by payload |

## Contribution

Contributions are welcome. Please follow the existing code style and include tests for new features.

## License

MIT
