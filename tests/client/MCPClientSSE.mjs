import readline from 'node:readline'
import { Readable } from 'node:stream'


class MCPClientSSE {
    #serverUrl
    #endpointUrl = null
    #abortController = new AbortController()
    #requestId = 1
    #pendingRequests = new Map()
    #responseInterceptors = []
    #paymentHandlers = []
    #silent
    #methodLocks = new Map()
    #methodLockDuration = 10_000


    constructor( { serverUrl, silent = false } ) {
        if( !serverUrl ) {
            throw new Error( 'MCPClientSSE: serverUrl is required.' )
        }

        this.#serverUrl = new URL( serverUrl )
        this.#silent = silent
    }


    useResponseInterceptor( interceptorFn ) {
        this.#responseInterceptors.push( interceptorFn )
    }


    usePaymentHandler( handlerFn ) {
        this.#paymentHandlers.push( handlerFn )
    }


    async start() {
        if( !this.#silent ) { console.log( '[MCPClientSSE] Starting connection and initialization' ) }

        await this.#connectAndStartListener()
        await this.#initialize()
        await this.#notifyInitialized()

        if( !this.#silent ) { console.log( '[MCPClientSSE] Initialization complete' ) }

        return { result: true }
    }


    async request( { method, params = {}, headers = {} } ) {
        const now = Date.now()
        const lastCall = this.#methodLocks.get( method ) || 0

        if( now - lastCall < this.#methodLockDuration ) {
            const message = `[MCPClientSSE] ERROR: Method '${method}' is locked (rate-limited). Wait before retrying.`
            console.error( message )

            return {
                status: 429,
                data: { error: 'Too many requests. Please wait before retrying.' }
            }
        }

        this.#methodLocks.set( method, now )

        if( !this.#silent ) { console.log( `[MCPClientSSE] Sending request: ${method}` ) }

        const request = {
            jsonrpc: '2.0',
            id: this.#nextRequestId(),
            method,
            params
        }

        const response = await this.#sendRequest( { request, headers } )

        return response
    }


    async callTool( { toolName, args = {}, headers = {} } ) {
        if( !this.#silent ) { console.log( `[MCPClientSSE] Calling tool: ${toolName}` ) }

        return await this.request( {
            method: 'tools/call',
            params: { name: toolName, arguments: args },
            headers
        } )
    }


    async close() {
        this.#abortController.abort()

        if( !this.#silent ) { console.log( '[MCPClientSSE] Connection closed' ) }

        return { result: true }
    }


    async #connectAndStartListener() {
        if( !this.#silent ) { console.log( '[MCPClientSSE] Connecting to SSE server' ) }

        const res = await fetch( this.#serverUrl.href, {
            headers: { 'Accept': 'text/event-stream' },
            signal: this.#abortController.signal
        } )

        if( !res.ok ) {
            throw new Error( `Failed to connect: ${res.status} ${res.statusText}` )
        }

        const nodeReadable = Readable.fromWeb( res.body )
        const rl = readline.createInterface( {
            input: nodeReadable,
            crlfDelay: Infinity
        } )

        this.#startListening( rl )

        while( !this.#endpointUrl ) {
            await new Promise( ( resolve ) => setTimeout( resolve, 10 ) )
        }

        return { result: true }
    }


    async #startListening( rl ) {
        try {
            for await ( const line of rl ) {
                if( !line.startsWith( 'data: ' ) ) continue

                const data = line.substring( 6 )

                if( !this.#endpointUrl ) {
                    this.#endpointUrl = new URL( data, this.#serverUrl.origin )

                    if( !this.#silent ) {
                        console.log( `[MCPClientSSE] Received endpoint URL: ${this.#endpointUrl.href}` )
                    }

                    continue
                }

                if( !data.trim().startsWith( '{' ) ) continue

                try {
                    const message = JSON.parse( data )

                    if( message.id && this.#pendingRequests.has( message.id ) ) {
                        const { resolve } = this.#pendingRequests.get( message.id )
                        this.#pendingRequests.delete( message.id )

                        resolve( { status: 200, data: message } )
                    }
                } catch( err ) {
                    if( !this.#silent ) {
                        console.log( '[MCPClientSSE] Failed to parse message:', err )
                    }
                }
            }
        } catch( err ) {
            if( err.name === 'AbortError' ) {
                if( !this.#silent ) {
                    console.log( '[MCPClientSSE] Listener aborted (normal shutdown)' )
                }
            } else {
                throw err
            }
        }
    }


    async #initialize() {
        if( !this.#silent ) { console.log( '[MCPClientSSE] Sending initialize request' ) }

        const request = {
            jsonrpc: '2.0',
            id: this.#nextRequestId(),
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: {
                    name: 'MCP-SSE-Client',
                    title: 'MCP SSE Client',
                    version: '1.0.0'
                }
            }
        }

        const response = await this.#sendRequest( { request } )

        return response
    }


    async #notifyInitialized() {
        if( !this.#silent ) { console.log( '[MCPClientSSE] Sending notifyInitialized' ) }

        const notification = {
            jsonrpc: '2.0',
            method: 'notifications/initialized'
        }

        await fetch( this.#endpointUrl.href, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'MCP-Protocol-Version': '2024-11-05'
            },
            body: JSON.stringify( notification )
        } )

        return { result: true }
    }


    async #sendRequest( { request, headers = {} } ) {
        return new Promise( async ( resolve, reject ) => {
            this.#pendingRequests.set( request.id, { resolve, reject } )

            const res = await fetch( this.#endpointUrl.href, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'MCP-Protocol-Version': '2024-11-05',
                    ...headers
                },
                body: JSON.stringify( request )
            } )

            if( res.status === 202 ) {
                // Response kommt asynchron über SSE
            } else if( res.status === 402 ) {
                let json = null
                try { json = await res.json() } catch {}

                this.#responseInterceptors
                    .forEach( ( interceptor ) => {
                        try { interceptor( { status: 402, data: json } ) } catch {}
                    } )

                for ( const handler of this.#paymentHandlers ) {
                    try {
                        const retryResult = await handler( {
                            originalRequest: request,
                            response: { status: 402, data: json }
                        } )

                        resolve( retryResult )
                        this.#pendingRequests.delete( request.id )

                        return
                    } catch ( err ) {
                        reject( err )
                        this.#pendingRequests.delete( request.id )

                        return
                    }
                }

                resolve( { status: 402, data: json } )
                this.#pendingRequests.delete( request.id )
            } else if( res.headers.get( 'content-type' )?.startsWith( 'application/json' ) ) {
                const json = await res.json()

                this.#responseInterceptors
                    .forEach( ( interceptor ) => {
                        try { interceptor( { status: res.status, data: json } ) } catch {}
                    } )

                resolve( { status: res.status, data: json } )
                this.#pendingRequests.delete( request.id )
            } else if( !res.ok ) {
                this.#pendingRequests.delete( request.id )
                reject( new Error( `HTTP error: ${res.status}` ) )
            }
        } )
    }


    async retryRequest( { request, headers = {} } ) {
        const retryResponse = await this.#sendRequest( { request, headers } )

        return { retryResponse }
    }


    #nextRequestId() {
        return this.#requestId++
    }
}


export { MCPClientSSE }
