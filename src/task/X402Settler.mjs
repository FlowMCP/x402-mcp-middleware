class X402Settler {
    static async settlePayload( { parsedXPayment, selectedRequirement, serverExact } ) {
        // const { status, messages } = Validation.settlePayload( { parsedXPayment, selectedRequirement, serverExact } )
        // if( !status ) { Validation.error( { messages } ) }

        const { extra } = selectedRequirement
        const { domain } = extra
        const { verifyingContract } = domain

        const { ok } = await serverExact.settleTransaction( {
            decodedPayment: parsedXPayment,
            tokenAddress: verifyingContract
        } )


        if( !ok ) {
            console.error( 'Settlement failed' )
        }

        return { settlementStatus: ok }
    }
}


export { X402Settler }