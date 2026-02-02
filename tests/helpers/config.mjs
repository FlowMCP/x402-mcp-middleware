// --- Mock Restricted Calls ---

const MOCK_RESTRICTED_CALLS = [
    {
        method: 'tools/call',
        name: 'get_weather',
        acceptedPaymentOptionIdList: [ 'option-base-usdc' ]
    }
]


// --- Mock Payment Required Payload ---

const MOCK_PAYMENT_REQUIRED_PAYLOAD = {
    x402Version: 2,
    resource: {
        url: 'mcp://mcp.example.com/tool/get_weather'
    },
    accepts: [
        {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1000000',
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            payTo: '0x1234567890abcdef1234567890abcdef12345678',
            maxTimeoutSeconds: 300,
            extra: {
                name: 'USDC',
                version: '2'
            }
        }
    ]
}


// --- Mock Contract Catalog ---

const MOCK_CONTRACT_CATALOG = {
    'usdc-base': {
        paymentNetworkId: 'eip155:8453',
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        decimals: 6,
        domainName: 'USD Coin',
        domainVersion: '2'
    }
}


// --- Mock JSON-RPC Request ---

const MOCK_JSON_RPC_REQUEST = {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
        name: 'get_weather',
        arguments: { location: 'Berlin' }
    }
}


// --- Mock JSON-RPC Notification ---

const MOCK_JSON_RPC_NOTIFICATION = {
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {}
}


export {
    MOCK_RESTRICTED_CALLS,
    MOCK_PAYMENT_REQUIRED_PAYLOAD,
    MOCK_CONTRACT_CATALOG,
    MOCK_JSON_RPC_REQUEST,
    MOCK_JSON_RPC_NOTIFICATION
}
