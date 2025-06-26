// ./src/proxy/MCPStdioSSEProxy.mjs

import readline from 'node:readline'
import process from 'node:process'
import z from 'zod'
import { createParser } from 'eventsource-parser'

const JSONRPCMessageSchema = z.object({
    jsonrpc: z.literal('2.0'),
    id: z.union([z.string(), z.number()]).optional(),
    method: z.string().optional(),
    params: z.any().optional(),
    result: z.any().optional(),
    error: z.object({
        code: z.number(),
        message: z.string(),
        data: z.any().optional()
    }).optional()
})

class SSEClientTransport {
    #serverUrl
    #postUrl = null
    #bearerToken
    #controller = new AbortController()
    #onmessage = null
    #onerror = null
    #silent

    constructor({ serverUrl, bearerToken = null, silent = false }) {
        this.#serverUrl = serverUrl
        this.#bearerToken = bearerToken
        this.#silent = silent
    }

    setHandlers({ onmessage, onerror }) {
        this.#onmessage = onmessage
        this.#onerror = onerror
    }

    async start() {
        const headers = { 'Accept': 'text/event-stream' }

        if (this.#bearerToken) {
            headers['Authorization'] = `Bearer ${this.#bearerToken}`
        }

        const response = await fetch(this.#serverUrl, {
            method: 'GET',
            headers,
            signal: this.#controller.signal
        })

        if (!response.ok || !response.body) {
            throw new Error(`Failed to connect SSE: HTTP ${response.status}`)
        }

        const parser = createParser({
            onEvent: (event) => {
                if (event.event === 'endpoint') {
                    try {
                        this.#postUrl = new URL(event.data, this.#serverUrl).toString()
                        console.warn('[DEBUG] Set postUrl to:', this.#postUrl)
                    } catch (err) {
                        console.warn('[DEBUG] Failed to parse endpoint event data:', event.data)
                        if (this.#onerror) this.#onerror(err)
                    }
                    return
                }

                if (event.event === 'message') {
                    try {
                        const parsed = JSON.parse(event.data)
                        console.warn('[DEBUG] Received SSE message:', parsed)
                        const message = JSONRPCMessageSchema.parse(parsed)
                        if (this.#onmessage) this.#onmessage(message)
                    } catch (err) {
                        console.warn('[DEBUG] Failed to parse SSE message:', event.data)
                        if (this.#onerror) this.#onerror(err)
                    }
                }
            }
        })

        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        const readLoop = async () => {
            try {
                while (true) {
                    const { value, done } = await reader.read()
                    if (done) break
                    const chunk = decoder.decode(value, { stream: true })
                    console.warn('[DEBUG] SSE chunk:', chunk)
                    parser.feed(chunk)
                }
            } catch (err) {
                console.warn('[DEBUG] SSE readLoop error:', err)
                if (this.#onerror) this.#onerror(err)
            }
        }

        readLoop()
    }

    async sendRequest({ message, getPaymentHeader }) {
        if (!this.#postUrl) {
            throw new Error('Cannot send before receiving endpoint URL')
        }

        const headers = { 'Content-Type': 'application/json' }

        if (this.#bearerToken) {
            headers['Authorization'] = `Bearer ${this.#bearerToken}`
        }

        console.warn('[DEBUG] Sending initial request:', message)

        const response = await fetch(this.#postUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(message)
        })

        if (response.status === 402 && getPaymentHeader) {
            const errorPayload = await response.json()

            console.warn('[x402] 402 Payment Required - payload:', errorPayload)

            const accepts = errorPayload?.accepts
            console.warn('[x402] Raw accepts field:', accepts)
            console.warn('[x402] Full response:', JSON.stringify(errorPayload, null, 2))

            if (!Array.isArray(accepts)) {
                console.warn('[x402] Missing or malformed "accepts" field in response, skipping payment header generation')
                throw new Error('[x402] Payment header generation failed, cannot retry')
            }

            const header = await getPaymentHeader(message, errorPayload)
            if (!header) {
                throw new Error('[x402] Payment header generation failed, cannot retry')
            }

            console.warn('[x402] Retrying with X-PAYMENT header:', header)

            const retryResponse = await fetch(this.#postUrl, {
                method: 'POST',
                headers: {
                    ...headers,
                    'X-PAYMENT': header
                },
                body: JSON.stringify(message)
            })

            if (!retryResponse.ok) {
                throw new Error(`Retry failed: HTTP ${retryResponse.status}`)
            }

            return
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} on POST`)
        }
    }

    async close() {
        this.#controller.abort()
    }
}

class MCPStdioSSEProxy {
    #sseTransport
    #getPaymentHeader

    constructor({ serverUrl, bearerToken, getPaymentHeader, silent = false }) {
        this.#sseTransport = new SSEClientTransport({ serverUrl, bearerToken, silent })
        this.#getPaymentHeader = getPaymentHeader
    }

    async start() {
        await this.#sseTransport.start()

        this.#sseTransport.setHandlers({
            onmessage: (msg) => {
                console.warn('[DEBUG] Received message from server:', msg)
                process.stdout.write(JSON.stringify(msg) + '\n')
            },
            onerror: (err) => {
                console.warn('[DEBUG] SSE error encountered:', err)
                console.error('SSE error:', err)
            }
        })

        const rl = readline.createInterface({ input: process.stdin })

        rl.on('line', async (line) => {
            try {
                console.warn('[DEBUG] Received input line:', line)
                const message = JSON.parse(line)
                await this.#sseTransport.sendRequest({
                    message,
                    getPaymentHeader: this.#getPaymentHeader
                })
            } catch (err) {
                console.warn('[DEBUG] Error handling input line:', err)
                console.error('Error parsing or sending message:', err)
            }
        })

        rl.on('close', async () => {
            console.warn('[DEBUG] Input stream closed, shutting down SSE transport.')
            await this.#sseTransport.close()
        })
    }
}

export { SSEClientTransport, MCPStdioSSEProxy }
