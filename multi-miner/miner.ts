self.onmessage = async (e) => {
    const {index, validatorHash, validatorAddress, lucid} = e;

    console.log(`Worker ${index}: Starting...`)

    let validatorUTXOs = await lucid.utxosAt(validatorAddress);

    console.log(`Worker ${index}: ${validatorUTXOs}`)
});