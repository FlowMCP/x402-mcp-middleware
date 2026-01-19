// v2 Test - Uses v2 API
import { RemoteServer } from 'mcpServers'
import { FlowMCP } from 'flowmcp'
import { ServerManager } from '../helpers/ServerManager.mjs'

import { X402Middleware } from '../../src/v2/index.mjs'

import { schema as ping } from '../schemas/v1.2.0/x402/ping.mjs'
import { schema as pinataRead } from '../schemas/v1.2.0/pinata/read.mjs'


const env = {
    'envPath': './../../../.env',
    'schemaPath': './../../../../tests/schemas/v1.2.0/',
    'envSelection': [
        [ 'facilitatorPrivateKey', 'ACCOUNT_DEVELOPMENT2_PRIVATE_KEY' ],
        [ 'payTo1',                'ACCOUNT_DEVELOPMENT2_PUBLIC_KEY'  ],
        [ 'serverProviderUrl',     'BASE_SEPOLIA_ALCHEMY_HTTP'        ]
    ]
}

const cfg = {
    'routePath': '/x402',
    'x402V2ExactEvmConfiguration': {
        'contractCatalog': {
            'usdc-base-sepolia': {
                'paymentNetworkId': 'eip155:84532',
                'address': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
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
            }
        },
        'restrictedCalls': [
            {
                'method': 'tools/call',
                'name': 'paid_ping_x402',
                'acceptedPaymentOptionIdList': [ 'usdc-10k' ]
            }
        ]
    }
}


const { envPath, envSelection, schemaPath } = env
const { routePath, x402V2ExactEvmConfiguration } = cfg

const { envObject } = ServerManager
    .getEnvObject( { envPath } )
const { x402Credentials, privateKey: facilitatorPrivateKey } = ServerManager
    .getX402Credentials( { envPath, envSelection } )

const { activationPayloads } = FlowMCP
    .prepareActivations( { arrayOfSchemas: [ ping, pinataRead ], envObject } )

const remoteServer = new RemoteServer( { 'silent': false } )
const app = remoteServer.getApp()

const middleware = await X402Middleware
    .create( {
        x402V2ExactEvmConfiguration,
        server: {
            payToAddressMap: {
                facilitator: x402Credentials.payTo1
            },
            providerUrlByPaymentNetworkId: {
                'eip155:84532': x402Credentials.serverProviderUrl
            },
            facilitatorPrivateKeyByPaymentNetworkId: {
                'eip155:84532': facilitatorPrivateKey
            },
            silent: false
        }
    } )

app.use( middleware.mcp() )
app.get( routePath, ( _, res ) => res.send( `X402 Remote Server v2 is running!` ) )

remoteServer.addActivationPayloads( { activationPayloads, routePath, transportProtocols: [ 'sse' ] } )
remoteServer.start()
