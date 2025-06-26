const schema = {
    namespace: "defillama",
    name: "DeFi Llama MCP",
    description: "Provides access to DeFi protocol and liquidity data from DeFi Llama",
    docs: ["https://docs.llama.fi"],
    tags: [],
    flowMCP: "1.2.0",
    root: "https://api.llama.fi",
    requiredServerParams: [],
    headers: {},
    routes: {
        getProtocols: {
            requestMethod: "GET",
            description: "Retrieve a list of all DeFi protocols from DeFi Llama (first 20)",
            route: "/protocols",
            parameters: [],
            tests: [
                { _description: "Test fetching protocols" }
            ],
            modifiers: [
                { phase: "post", handlerName: "modifyResult" }
            ]
        },
        getProtocolTvl: {
            requestMethod: "GET",
            description: "Get TVL data for a specific DeFi protocol",
            route: "/protocol/:protocol",
            parameters: [
                { position: { key: "protocol", value: "{{USER_PARAM}}", location: "insert" }, z: { primitive: "string()", options: [] } }
            ],
            tests: [
                { _description: "Test Aave protocol TVL", protocol: "aave" }
            ],
            modifiers: [
                { phase: "post", handlerName: "modifyResult" }
            ]
        },
        getChainTvl: {
            requestMethod: "GET",
            description: "Retrieve historical TVL data for a specific blockchain",
            route: "/v2/historicalChainTvl/:chain",
            parameters: [
                { position: { key: "chain", value: "{{USER_PARAM}}", location: "insert" }, z: { primitive: "string()", options: [] } }
            ],
            tests: [
                { _description: "Ethereum chain TVL", chain: "ethereum" }
            ],
            modifiers: [
                { phase: "post", handlerName: "modifyResult" }
            ]
        }
    },
    handlers: {
        modifyResult: ( { struct, payload } ) => {
            return { struct, payload }
        }
    }
}


export { schema }