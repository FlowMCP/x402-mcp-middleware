// MCP _meta Helper
// Merge-safe operations for _meta object (must not destroy existing _meta)

class Meta {
    static DEFAULT_PAYMENT_KEY = 'x402/payment'
    static DEFAULT_PAYMENT_RESPONSE_KEY = 'x402/payment-response'


    static getPaymentFromMeta( { params, paymentMetaKey = Meta.DEFAULT_PAYMENT_KEY } ) {
        if( !params || typeof params !== 'object' ) {
            return { paymentPayload: null, paymentFound: false }
        }

        const meta = params._meta
        if( !meta || typeof meta !== 'object' ) {
            return { paymentPayload: null, paymentFound: false }
        }

        const paymentPayload = meta[ paymentMetaKey ]
        if( paymentPayload === undefined ) {
            return { paymentPayload: null, paymentFound: false }
        }

        return { paymentPayload, paymentFound: true }
    }


    static mergePaymentResponseIntoResult( { result, paymentResponse, paymentResponseMetaKey = Meta.DEFAULT_PAYMENT_RESPONSE_KEY } ) {
        // Ensure result is an object
        const safeResult = result && typeof result === 'object' ? { ...result } : { value: result }

        // Preserve existing _meta
        const existingMeta = safeResult._meta && typeof safeResult._meta === 'object'
            ? { ...safeResult._meta }
            : {}

        // Merge payment response
        existingMeta[ paymentResponseMetaKey ] = paymentResponse

        safeResult._meta = existingMeta

        return { mergedResult: safeResult }
    }


    static mergePaymentResponseIntoError( { errorData, paymentResponse, paymentResponseMetaKey = Meta.DEFAULT_PAYMENT_RESPONSE_KEY } ) {
        // Ensure errorData is an object
        const safeErrorData = errorData && typeof errorData === 'object'
            ? { ...errorData }
            : { originalError: errorData }

        // Add payment response to error data
        safeErrorData[ paymentResponseMetaKey ] = paymentResponse

        return { mergedErrorData: safeErrorData }
    }


    static createPaymentRequiredErrorData( { paymentRequiredPayload, paymentResponseMetaKey = Meta.DEFAULT_PAYMENT_RESPONSE_KEY } ) {
        // PaymentRequired goes directly in error.data
        const errorData = { ...paymentRequiredPayload }

        return { errorData }
    }
}


export { Meta }
