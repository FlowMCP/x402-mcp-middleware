# Migration Guide: v1 → v2

## Breaking Changes

### Import Paths

**v1 (Legacy):**
```javascript
// OLD - No longer works from root
import { X402Middleware } from 'x402-mcp-middleware'

// NEW - Use explicit version
import { X402Middleware } from 'x402-mcp-middleware/legacy'
```

**v2:**
```javascript
import { X402Middleware } from 'x402-mcp-middleware/v2'
```

### Configuration Structure

**v1:**
```javascript
X402Middleware.create({
    chainId: 84532,
    chainName: 'Base Sepolia',
    contracts: { ... },
    paymentOptions: { ... },
    restrictedCalls: [ ... ],
    x402Credentials: { serverProviderUrl: '...' },
    x402PrivateKey: '0x...'
})
```

**v2:**
```javascript
X402Middleware.create({
    x402V2ExactEvmConfiguration: {
        contractCatalog: { ... },
        paymentOptionCatalog: { ... },
        restrictedCalls: [ ... ]
    },
    server: {
        payToAddressMap: { ... },
        providerUrlByPaymentNetworkId: { ... },
        facilitatorPrivateKeyByPaymentNetworkId: { ... }
    }
})
```

### Payment Protocol

| Aspect | v1 | v2 |
|--------|----|----|
| Payment Required | HTTP 402 status | JSON-RPC `error.code: 402` |
| Payment Input | `X-PAYMENT` header | `params._meta["x402/payment"]` |
| Payment Response | `X-PAYMENT-RESPONSE` header | `result._meta["x402/payment-response"]` |
| Network Support | Single chain | Multi-chain |

## Migration Steps

### 1. Update Import

```diff
- import { X402Middleware } from 'x402-mcp-middleware'
+ import { X402Middleware } from 'x402-mcp-middleware/v2'
```

### 2. Update Configuration

```diff
- const middleware = await X402Middleware.create({
-     chainId: 84532,
-     chainName: 'Base Sepolia',
-     contracts: {
-         'usdc': { address: '0x...', decimals: 6 }
-     },
-     paymentOptions: {
-         'usdc-10k': { contractId: 'usdc', amount: '10000', payTo: '{{payTo1}}' }
-     },
-     restrictedCalls: [
-         { method: 'tools/call', name: 'premium', activePaymentOptions: ['usdc-10k'] }
-     ],
-     x402Credentials: { serverProviderUrl: '...', payTo1: '0x...' },
-     x402PrivateKey: '0x...'
- })

+ const middleware = await X402Middleware.create({
+     x402V2ExactEvmConfiguration: {
+         contractCatalog: {
+             'usdc-base-sepolia': {
+                 paymentNetworkId: 'eip155:84532',
+                 address: '0x...',
+                 decimals: 6,
+                 domainName: 'USDC',
+                 domainVersion: '2'
+             }
+         },
+         paymentOptionCatalog: {
+             'usdc-10k': {
+                 contractId: 'usdc-base-sepolia',
+                 amount: '10000',
+                 payTo: '{{facilitator}}'
+             }
+         },
+         restrictedCalls: [
+             { method: 'tools/call', name: 'premium', acceptedPaymentOptionIdList: ['usdc-10k'] }
+         ]
+     },
+     server: {
+         payToAddressMap: { facilitator: '0x...' },
+         providerUrlByPaymentNetworkId: { 'eip155:84532': '...' },
+         facilitatorPrivateKeyByPaymentNetworkId: { 'eip155:84532': '0x...' }
+     }
+ })
```

### 3. Update Client Integration

Clients must now send payment via `_meta`:

```diff
- // v1: X-PAYMENT header
- headers: { 'X-PAYMENT': JSON.stringify(paymentPayload) }

+ // v2: _meta in params
+ params: {
+     name: 'premium',
+     arguments: { ... },
+     _meta: {
+         'x402/payment': paymentPayload
+     }
+ }
```

### 4. Update Response Handling

```diff
- // v1: X-PAYMENT-RESPONSE header
- const paymentResponse = JSON.parse(res.headers['x-payment-response'])

+ // v2: _meta in result
+ const paymentResponse = result._meta['x402/payment-response']
```

## Staying on v1

If you cannot migrate immediately, continue using v1 via the legacy import:

```javascript
import { X402Middleware } from 'x402-mcp-middleware/legacy'
```

v1 is frozen but will continue to work. No security patches or features will be added.
