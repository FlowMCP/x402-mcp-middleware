# X402 MCP Middleware v2

MCP-spec-compliant payment middleware with multi-network support.

## Installation

```javascript
import { X402Middleware } from 'x402-mcp-middleware/v2'
```

## Quick Start

```javascript
const middleware = await X402Middleware.create({
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
                payTo: '{{facilitator}}'
            },
            'avax-usdc-10k': {
                contractId: 'usdc-avalanche-fuji',
                amount: '10000',
                payTo: '{{facilitator}}'
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
        }
    }
})

app.use(middleware.mcp())
```

## MCP Protocol

### Payment Required (Server → Client)

When a restricted tool is called without payment:

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
                    "payTo": "0x..."
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
                    "authorization": { /* EIP-3009 authorization */ },
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
        "content": [ /* tool result */ ],
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

## Configuration Options

### `x402V2ExactEvmConfiguration`

| Key | Type | Description |
|-----|------|-------------|
| `contractCatalog` | object | Token contract definitions by ID |
| `paymentOptionCatalog` | object | Payment options by ID |
| `restrictedCalls` | array | Tools requiring payment |

### `server`

| Key | Type | Description |
|-----|------|-------------|
| `payToAddressMap` | object | Address aliases (e.g., `{{facilitator}}`) |
| `providerUrlByPaymentNetworkId` | object | RPC URLs per network |
| `facilitatorPrivateKeyByPaymentNetworkId` | object | Facilitator keys per network |
| `defaultMaxTimeoutSeconds` | number | Default timeout (300) |
| `simulateBeforeSettle` | boolean | Simulate before settlement (true) |
| `silent` | boolean | Suppress logs (false) |

### `mcp` (optional)

| Key | Type | Description |
|-----|------|-------------|
| `paymentMetaKey` | string | Meta key for payment (`x402/payment`) |
| `paymentResponseMetaKey` | string | Meta key for response (`x402/payment-response`) |
| `resourcePrefix` | string | Resource URL prefix (`mcp://tool/`) |

## Multi-Network Support

v2 supports multiple blockchains simultaneously. Configure providers and keys for each network:

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
