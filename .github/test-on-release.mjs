import { RemoteServer } from 'mcpServers'
import { FlowMCP } from 'flowmcp'
import { ServerManager } from './../tests/helpers/ServerManager.mjs'

import { X402Middleware } from './../src/legacy/index.mjs'

import { schema as ping } from './../tests/schemas/v1.2.0/x402/ping.mjs'
import { schema as pinataRead } from './../tests/schemas/v1.2.0/pinata/read.mjs'


const env = {
    'envPath': './.github/.example.env',
    'schemaPath': './../../../tests/schemas/v1.2.0/',
    'envSelection': [
        [ 'facilitatorPrivateKey', 'ACCOUNT_DEVELOPMENT2_PRIVATE_KEY' ],
        [ 'payTo1',                'ACCOUNT_DEVELOPMENT2_PUBLIC_KEY'  ],
        [ 'serverProviderUrl',     'BASE_SEPOLIA_ALCHEMY_HTTP'        ]
    ]
}

const cfg = {
    'routePath': '/x402',
    'chainId': 84532,
    'chainName': 'base-sepolia',
    'restrictedCalls': [
        {
            'method': 'tools/call',
            'name': 'paid_ping_x402',  // 'get_protocols_defillama',
            'activePaymentOptions': [ 'usdc-sepolia' ],
        }
    ],
    'paymentOptions': {
        'usdc-sepolia': { 
            'contractId': 'usdc-sepolia',
            'maxAmountRequired': '0.01',
            'payTo': '{{payTo1}}',
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


const { envPath, envSelection, schemaPath } = env
const { routePath, chainId, chainName, restrictedCalls, paymentOptions, contracts } = cfg

const { managerVersion } = ServerManager
    .getPackageVersion()
const { envObject } = ServerManager
    .getEnvObject( { envPath } )
let { x402Credentials, privateKey: x402PrivateKey } = ServerManager
    .getX402Credentials( { envPath, envSelection } )
x402PrivateKey = process.env.ACCOUNT_DEVELOPMENT2_PRIVATE_KEY
/*
    const { arrayOfSchemas } = await ServerManager
        .getArrayOfSchemas( { schemaPath } )
*/

const { activationPayloads } = FlowMCP
    .prepareActivations( { arrayOfSchemas: [ ping, pinataRead ], envObject } )
const remoteServer = new RemoteServer( { 'silent': false } )
const app = remoteServer.getApp()
const middleware = await X402Middleware
    .create( { chainId, chainName, contracts, paymentOptions, restrictedCalls, x402Credentials, x402PrivateKey } )
app.use( ( await middleware ).mcp() )
app.get( routePath, ( _, res ) => res.send( `X402 Remote Server v${managerVersion} is running!` ) )

remoteServer.addActivationPayloads( { activationPayloads, routePath, transportProtocols: [ 'sse' ] } )
console.log( 'Success' )
process.exit( 0 )
