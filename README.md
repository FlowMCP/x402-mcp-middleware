[![Test](https://img.shields.io/github/actions/workflow/status/flowmcp/flowmcp/test-on-release.yml)]() ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

# X402 Middleware
An Express-compatible payment gateway middleware for X402-protected MCP endpoints.

This module provides a middleware component for building secure, payment-enabled server endpoints using the X402 micropayment protocol. It supports dynamic payment requirement injection, verification logic via `x402-core`, and seamless integration with `flowmcp`-based client tooling.

---

## Quickstart

To get started quickly, clone the repository and install dependencies:

```bash
git clone https://github.com/YOUR_ORG_OR_NAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
npm i
````

You can now run a payment-enabled server and client with the examples below.

---

### Server

The following example sets up a remote server using `X402Middleware`:

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

---

### Client

The following example demonstrates how a client can consume the secured endpoint using `MCPClientSSE`:

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

---

## Features

* Drop-in Express-compatible middleware for X402 micropayment protection
* Enforces dynamic, schema-based payment requirements per endpoint
* Automatic payment header verification and retry logic
* Integrates seamlessly with `flowmcp` activation payloads and schemas
* Chain-agnostic configuration using `chainId`, `contracts`, and `paymentOptions`
* Validates input parameters and environment structure at runtime
* Supports multiple payment options per endpoint with fallback logic
* Designed for modular integration with `RemoteServer` and `ClientExact`

---

## Table of Contents

- [X402 Middleware](#x402-middleware)
  - [Quickstart](#quickstart)
    - [Server](#server)
    - [Client](#client)
  - [Features](#features)
  - [Table of Contents](#table-of-contents)
  - [Methods](#methods)
    - [create](#create)
    - [mcp](#mcp)
  - [Contribution](#contribution)
  - [License](#license)

---

## Methods

The `X402Middleware` class provides middleware functionality for X402-secured endpoints, including dynamic payment requirement handling and server initialization. The following methods are available:

* `.create()` – initializes the middleware instance asynchronously.
* `.mcp()` – returns the middleware handler function.

### create

Creates an instance of `X402Middleware`. This method validates the input, prepares the payment requirements, initializes the `ServerExact` instance, and sets the wallet using the private key.

```javascript
static .create( {
    chainId,
    chainName,
    contracts,
    paymentOptions,
    restrictedCalls,
    x402Credentials,
    x402PrivateKey
} )
```

| Key               | Type   | Description                                                                | Required |
| ----------------- | ------ | -------------------------------------------------------------------------- | -------- |
| `chainId`         | number | Chain ID for the blockchain network.                                       | Yes      |
| `chainName`       | string | Name of the blockchain network.                                            | Yes      |
| `contracts`       | object | Object mapping contract IDs to contract metadata.                          | Yes      |
| `paymentOptions`  | object | Available payment options.                                                 | Yes      |
| `restrictedCalls` | array  | Calls requiring payment with `method`, `name`, and `activePaymentOptions`. | Yes      |
| `x402Credentials` | object | X402 credentials including `serverProviderUrl`.                            | Yes      |
| `x402PrivateKey`  | string | Wallet private key used for authorization.                                 | Yes      |

**Returns:** an instance of `X402Middleware`

---

### mcp

Returns the middleware handler function for Express-like servers.

```javascript
.mcp()
```

**Returns:** an Express-compatible middleware function

---

## Contribution

Contributions, improvements, and feedback are highly welcome!
Feel free to fork the repository, open issues, or submit pull requests.

To contribute:

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Commit your changes: `git commit -m 'Add my feature'`
3. Push to the branch: `git push origin feature/my-feature`
4. Open a pull request

---

## License

This project is licensed under the MIT License.
See the [LICENSE](./LICENSE) file for details.

```