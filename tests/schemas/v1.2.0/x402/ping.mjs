const schema = {
    namespace: "x402",
    name: "x402 Experimental MCP Interface",
    description: "A test schema for verifying free and paid route behavior under FlowMCP v1.2.0",
    docs: ["https://example.com/x402/docs"],
    tags: [],
    flowMCP: "1.2.0",
    root: "https://api.x402.test/v1",
    requiredServerParams: [],
    headers: {},
    routes: {
        free_ping: {
            requestMethod: "GET",
            description: "Simple free route to verify server responsiveness",
            route: "/ping",
            parameters: [],
            tests: [ { _description: "Basic ping test" } ],
            modifiers: [ { phase: "execute", handlerName: "free_ping" } ]
        },
        paid_ping: {
            requestMethod: "GET",
            description: "Simulated paid route to test vault access",
            route: "/vault/item",
            parameters: [],
            tests: [ { _description: "Basic paid ping test" } ],
            modifiers: [ { phase: "execute", handlerName: "paid_ping" } ]
        }
    },
    handlers: {
        free_ping: async ({ struct, payload }) => {
            struct.data = {
                method: "free_ping",
                status: "alive",
                version: "x402-experiment",
                time: new Date().toISOString()
            };
            struct.status = true;
            return { struct, payload };
        },
        paid_ping: async ({ struct, payload }) => {
            struct.data = {
                method: "paid_ping",
                itemId: "XYZ00001",
                content: "Encrypted payload or structured data here",
                access_level: "licensed",
                metadata: {
                    retrieved_at: new Date().toISOString(),
                    source: "x402-vault-test"
                }
            };
            struct.status = true;
            return { struct, payload };
        }
    }
};


export { schema }