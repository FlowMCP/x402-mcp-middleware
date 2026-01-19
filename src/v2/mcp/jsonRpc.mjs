// JSON-RPC Response Builder for MCP
// Implements MCP spec: id mirroring, result XOR error, no response for notifications

class JsonRpc {
    // Standard JSON-RPC error codes
    static ErrorCodes = {
        PARSE_ERROR: -32700,
        INVALID_REQUEST: -32600,
        METHOD_NOT_FOUND: -32601,
        INVALID_PARAMS: -32602,
        INTERNAL_ERROR: -32603,
        PAYMENT_REQUIRED: 402
    }


    static isNotification( { request } ) {
        // Notifications have no 'id' field
        // Also treat missing/invalid request as notification (pass through)
        const isNotification = !request || request.id === undefined

        return { isNotification }
    }


    static createSuccessResponse( { id, result } ) {
        const response = {
            jsonrpc: '2.0',
            id,
            result
        }

        return { response }
    }


    static createErrorResponse( { id, code, message, data = null } ) {
        const error = { code, message }

        if( data !== null ) {
            error.data = data
        }

        const response = {
            jsonrpc: '2.0',
            id,
            error
        }

        return { response }
    }


    static createPaymentRequiredResponse( { id, paymentRequiredPayload } ) {
        const { response } = JsonRpc
            .createErrorResponse( {
                id,
                code: JsonRpc.ErrorCodes.PAYMENT_REQUIRED,
                message: 'Payment Required',
                data: paymentRequiredPayload
            } )

        return { response }
    }


    static createInvalidParamsResponse( { id, message = 'Invalid params' } ) {
        const { response } = JsonRpc
            .createErrorResponse( {
                id,
                code: JsonRpc.ErrorCodes.INVALID_PARAMS,
                message
            } )

        return { response }
    }


    static createInternalErrorResponse( { id, message = 'Internal error', data = null } ) {
        const { response } = JsonRpc
            .createErrorResponse( {
                id,
                code: JsonRpc.ErrorCodes.INTERNAL_ERROR,
                message,
                data
            } )

        return { response }
    }
}


export { JsonRpc }
