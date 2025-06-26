const schema = {
    namespace: "pinata",
    name: "Pinata IPFS Read MCP Interface",
    description: "A FlowMCP interface for reading content from the Pinata IPFS gateway",
    docs: ["https://gateway.pinata.cloud/"],
    tags: [],
    flowMCP: "1.2.0",
    root: "https://gateway.pinata.cloud/ipfs",
    requiredServerParams: [], //[ 'PINATA_GATEWAY' ],
    headers: {},
    routes: {
        free_read_example: {
            requestMethod: "GET",
            description: "Returns a static IPFS-hosted example image",
            route: "/{{cid}}",
            parameters: [
                { position: { key: "cid", value: 'QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/1', location: "insert" } }
            ],
            tests: [ { _description: "Load sample image from IPFS" } ],
            modifiers: [ { phase: "post", handlerName: "free_read_example" } ]
        },
        free_read_cid: {
            requestMethod: "GET",
            description: "Reads content from any IPFS CID",
            route: "/{{cid}}",
            parameters: [
                { position: { key: "cid", value: "{{USER_PARAM}}", location: "insert" }, z: { primitive: "string()", options: [] } }
            ],
            tests: [ { _description: "Read arbitrary CID", cid: "QmYwAPJzv5CZsnAzt8auV2Annh6wKghpMdJtKhHgGMRFjx" } ],
            modifiers: [ { phase: "post", handlerName: "free_read_cid" } ]
        }
    },
    handlers: {
        free_read_example: async ( a ) => {
            const { struct } = a
            return { struct }
        },
        free_read_cid: async ( a ) => {
            const { struct } = a
            return { struct }
        }
    }
};

export { schema }