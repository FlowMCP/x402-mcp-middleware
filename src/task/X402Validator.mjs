class X402Validator {
    static async verifyPayload( { parsedXPayment, paymentRequirement, serverExact } ) {
        try {
            const { selectedRequirement } = serverExact
                .findMatchingPaymentRequirements({
                    paymentRequirementsPayload: paymentRequirement,
                    decodedPayment: parsedXPayment
                })
            if( !selectedRequirement ) {
                return { valid: false, errorCode: 'ERR_INVALID_SCHEMA' }
            }

            const validationResult = await serverExact.validatePayment({
                decodedPayment: parsedXPayment,
                paymentRequirement: selectedRequirement
            })
            if( !validationResult.ok ) {
                return { valid: false, errorCode: 'ERR_SIGNATURE_INVALID' }
            }

            const verifyingContract = selectedRequirement.extra.domain.verifyingContract
            const simulationResult = await serverExact.simulateTransaction({
                decodedPayment: parsedXPayment,
                tokenAddress: verifyingContract
            })
            if( !simulationResult.ok ) {
                return { valid: false, errorCode: 'ERR_SIMULATION_FAILED' }
            }

            return { valid: true, selectedRequirement }
        } catch( error ) {
            console.error( error )
            return { valid: false, errorCode: 'ERR_INTERNAL_VALIDATION_ERROR', 'selectedRequirement': null }
        }
    }
}

export { X402Validator }
