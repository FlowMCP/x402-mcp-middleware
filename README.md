[![Test](https://img.shields.io/github/actions/workflow/status/FlowMCP/x402-mcp-middleware/test-on-release.yml)](https://github.com/FlowMCP/x402-mcp-middleware/actions) ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

# X402 Middleware
An Express-compatible payment gateway middleware for X402-protected MCP endpoints.

This module provides a middleware component for building secure, payment-enabled server endpoints using the X402 micropayment protocol. It supports dynamic payment requirement injection, verification logic via `x402-core`, and seamless integration with `flowmcp`-based client tooling. The middleware handles the complete payment flow: serving `X-PAYMENT` requirements on protected calls, validating payment headers, and settling transactions.

## Quickstart

To get started quickly, clone the repository and install dependencies:

```bash
git clone https://github.com/FlowMCP/x402-mcp-middleware
cd x402-mcp-middleware
npm i
````

You can now run a payment-enabled server and client with the examples below.

### Server

> Use:
>
> * `cfg` -> configuration with chainId, contracts, paymentOptions, and restrictedCalls
> * `x402Credentials` -> resolved from .env using `ServerManager`
> * `x402PrivateKey` -> facilitator wallet private key

```javascript
import { RemoteServer } from 'mcpServers'
import { FlowMCP } from 'flowmcp'
import { ServerManager } from './helpers/ServerManager.mjs'
import { X402Middleware } from '../src/index.mjs'
import { schema as ping } from './schemas/v1.2.0/x402/ping.mjs'

const envPath = './.env'

const { x402Credentials, privateKey: x402PrivateKey } = ServerManager
    .getX402Credentials( {
        envPath,
        envSelection: [
            [ 'facilitatorPrivateKey', 'ACCOUNT_DEV_PRIVATE_KEY' ],
            [ 'payTo1', 'ACCOUNT_DEV_PUBLIC_KEY' ],
            [ 'serverProviderUrl', 'BASE_SEPOLIA_ALCHEMY_HTTP' ]
        ]
    } )

const cfg = {
    chainId: 84532,
    chainName: 'base-sepolia',
    restrictedCalls: [
        {
            method: 'tools/call',
            name: 'paid_ping_x402',
            activePaymentOptions: [ 'usdc-sepolia' ]
        }
    ],
    paymentOptions: {
        'usdc-sepolia': {
            contractId: 'usdc-sepolia',
            maxAmountRequired: '0.01',
            payTo: '{{payTo1}}'
        }
    },
    contracts: {
        'usdc-sepolia': {
            domainName: 'USDC',
            address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            assetType: 'erc20',
            decimals: 6
        }
    }
}

const { activationPayloads } = FlowMCP
    .prepareActivations( { arrayOfSchemas: [ ping ], envObject: {} } )

const middleware = await X402Middleware
    .create( { ...cfg, x402Credentials, x402PrivateKey } )

const remoteServer = new RemoteServer( { silent: false } )
const app = remoteServer.getApp()

app.use( middleware.mcp() )
app.get( '/x402', ( _, res ) => res.send( 'X402 Server is running!' ) )

remoteServer.addActivationPayloads( {
    activationPayloads,
    routePath: '/x402',
    transportProtocols: [ 'sse' ]
} )

remoteServer.start()
```

### Client

> Use:
>
> * `clientCredentials` -> resolved from .env using `ServerManager`
> * `allowedPaymentOptions` -> tokens and max amounts the client allows
> * `MCPClientSSE` -> SSE client for MCP communication

```javascript
import { MCPClientSSE } from './client/MCPClientSSE.mjs'
import { ClientExact } from 'x402-core'
import { ServerManager } from './helpers/ServerManager.mjs'

const { x402Credentials: clientCredentials, privateKey: clientPrivateKey } = ServerManager
    .getX402Credentials( {
        envPath: './.env',
        envSelection: [
            [ 'clientPrivateKey', 'ACCOUNT_DEV_PRIVATE_KEY' ],
            [ 'clientProviderUrl', 'BASE_SEPOLIA_ALCHEMY_HTTP' ]
        ]
    } )

const allowedPaymentOptions = [
    {
        name: 'USDC',
        tokenAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        decimals: 6,
        maxAmountRequired: '0.01'
    }
]

const clientExact = new ClientExact( { silent: false } )
    .init( { providerUrl: clientCredentials.clientProviderUrl } )
await clientExact
    .setWallet( { privateKey: clientPrivateKey, allowedPaymentOptions } )

const client = new MCPClientSSE( {
    serverUrl: 'http://localhost:8080/x402/sse',
    silent: false
} )

await client.start()

client.usePaymentHandler( async ( { originalRequest, response } ) => {
    const paymentRequirementsPayload = response.data

    const { paymentOption } = ClientExact
        .selectMatchingPaymentOption( {
            paymentRequirementsPayload,
            allowedPaymentOptions,
            chainId: 84532
        } )

    const { scheme, network } = paymentOption

    const { authorization, signature } = await clientExact
        .createAuthorization( {
            paymentOption,
            allowedPaymentOptions,
            chainId: 84532
        } )

    const { headerString } = clientExact
        .createXPaymentHeader( {
            scheme,
            network,
            authorization,
            signature
        } )

    const { retryResponse } = await client
        .retryRequest( {
            request: originalRequest,
            headers: {
                'X-PAYMENT': headerString
            }
        } )

    return retryResponse
} )

const { status, data } = await client
    .callTool( { toolName: 'paid_ping_x402', args: {} } )

console.log( 'Status:', status, 'Data:', data.result.content )

await client.close()
```

## Features

* **Drop-in Express Middleware**
  Integrates seamlessly with Express-based servers using standard `app.use()` pattern.

* **Dynamic Payment Requirements**
  Enforces schema-based payment requirements per endpoint with configurable `restrictedCalls`.

* **Automatic Payment Verification**
  Validates `X-PAYMENT` headers including signature, time window, chain, and nonce checks.

* **Chain-Agnostic Configuration**
  Supports multiple chains and tokens via `chainId`, `contracts`, and `paymentOptions` config.

* **FlowMCP Integration**
  Works seamlessly with `flowmcp` activation payloads and schemas for MCP server patterns.

* **Retry Logic Support**
  Client-side payment handler supports automatic retry with payment header injection.

* **Meta-Transaction Settlement**
  Server executes authorized transfers - no user gas fees, full control over execution.

## Table of Contents

- [X402 Middleware](#x402-middleware)
  - [Quickstart](#quickstart)
    - [Server](#server)
    - [Client](#client)
  - [Features](#features)
  - [Table of Contents](#table-of-contents)
  - [METHODS - X402Middleware](#methods---x402middleware)
    - [.create()](#create)
    - [.mcp()](#mcp)
  - [Configuration](#configuration)
    - [restrictedCalls](#restrictedcalls)
    - [paymentOptions](#paymentoptions)
    - [contracts](#contracts)
  - [Contribution](#contribution)
  - [License](#license)





## METHODS - X402Middleware
This class provides middleware functionality for X402-secured endpoints, including dynamic payment requirement handling and server initialization. The available methods support middleware creation and Express integration. See also [.create()](#create) and [.mcp()](#mcp).

### .create()
Creates an instance of `X402Middleware`. This method validates the input, prepares the payment requirements, initializes the `ServerExact` instance, and sets the wallet using the private key.

**Method**
```
static async .create( { chainId, chainName, contracts, paymentOptions, restrictedCalls, x402Credentials, x402PrivateKey } )
```

| Key               | Type   | Description                                                                | Required |
|-------------------|--------|----------------------------------------------------------------------------|----------|
| chainId           | number | Chain ID for the blockchain network (e.g., `84532` for Base Sepolia).      | Yes      |
| chainName         | string | Name of the blockchain network (e.g., `'base-sepolia'`).                   | Yes      |
| contracts         | object | Object mapping contract IDs to contract metadata (address, decimals, etc). | Yes      |
| paymentOptions    | object | Available payment options keyed by option ID.                              | Yes      |
| restrictedCalls   | array  | Calls requiring payment with `method`, `name`, and `activePaymentOptions`. | Yes      |
| x402Credentials   | object | X402 credentials including `serverProviderUrl`.                            | Yes      |
| x402PrivateKey    | string | Wallet private key used for transaction signing.                           | Yes      |

**Example**
```js
const middleware = await X402Middleware
    .create( {
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
            { method: 'tools/call', name: 'paid_ping_x402', activePaymentOptions: [ 'usdc-sepolia' ] }
        ],
        x402Credentials: { serverProviderUrl: 'https://...', payTo1: '0x...' },
        x402PrivateKey: '0x...'
    } )
```

**Returns**
```js
returns X402Middleware
```

| Key        | Type           | Description                                  |
|------------|----------------|----------------------------------------------|
| (instance) | X402Middleware | The initialized middleware instance.         |

---

### .mcp()
Returns the middleware handler function for Express-like servers. This function intercepts requests, checks if the call requires payment, serves payment requirements or validates payment headers accordingly.

**Method**
```
.mcp()
```

**Example**
```js
const app = express()
app.use( middleware.mcp() )
```

**Returns**
```js
returns function
```

| Key        | Type     | Description                                           |
|------------|----------|-------------------------------------------------------|
| (function) | function | Express-compatible middleware function `(req, res, next)`. |

---

## Configuration

### restrictedCalls
Array of call definitions that require payment. Each entry specifies which method and name combination triggers payment requirements.

```js
restrictedCalls: [
    {
        method: 'tools/call',              // MCP method type
        name: 'paid_ping_x402',            // Tool/resource name
        activePaymentOptions: [ 'usdc-sepolia' ]  // Which payment options to accept
    }
]
```

| Key                   | Type             | Description                                      |
|-----------------------|------------------|--------------------------------------------------|
| method                | string           | The MCP method type (e.g., `'tools/call'`).      |
| name                  | string           | The specific tool or resource name.              |
| activePaymentOptions  | array of strings | Payment option IDs from `paymentOptions` to use. |

---

### paymentOptions
Object mapping option IDs to payment configuration. Each option references a contract and defines amount and recipient.

```js
paymentOptions: {
    'usdc-sepolia': {
        contractId: 'usdc-sepolia',        // References contracts[contractId]
        maxAmountRequired: '0.01',          // Amount in token units (human-readable)
        payTo: '{{payTo1}}'                 // Alias resolved from x402Credentials
    }
}
```

| Key               | Type   | Description                                              |
|-------------------|--------|----------------------------------------------------------|
| contractId        | string | Reference to an entry in `contracts`.                    |
| maxAmountRequired | string | Payment amount in human-readable units (e.g., `'0.01'`). |
| payTo             | string | Recipient address or `{{alias}}` placeholder.            |

---

### contracts
Object mapping contract IDs to token contract metadata used for EIP-712 domain construction and token operations.

```js
contracts: {
    'usdc-sepolia': {
        domainName: 'USDC',                                    // EIP-712 domain name
        address: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Token contract address
        assetType: 'erc20',                                    // Asset type
        decimals: 6                                            // Token decimals
    }
}
```

| Key        | Type   | Description                                    |
|------------|--------|------------------------------------------------|
| domainName | string | EIP-712 domain name for signature verification. |
| address    | string | Token contract address on the chain.           |
| assetType  | string | Asset type (currently `'erc20'`).              |
| decimals   | number | Token decimals for amount conversion.          |

---

## Contribution

Contributions, improvements, and feedback are highly welcome!
Feel free to fork the repository, open issues, or submit pull requests.

To contribute:

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Commit your changes: `git commit -m 'Add my feature'`
3. Push to the branch: `git push origin feature/my-feature`
4. Open a pull request


## License

This project is licensed under the MIT License.
See the [LICENSE](./LICENSE) file for details.
