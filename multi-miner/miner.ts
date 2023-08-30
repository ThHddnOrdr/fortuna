import {
    applyParamsToScript,
    Constr,
    Data,
    fromHex,
    fromText,
    generateSeedPhrase,
    Kupmios,
    Lucid,
    Script,
    sha256,
    toHex,
  } from "https://deno.land/x/lucid@0.10.1/mod.ts";

self.onmessage = async (e) => {
    const {index, validatorHash, validatorAddress, kupoUrl, ogmiosUrl, network, globalWorkersState} = e.data;

    const log = (message: string) => console.log(`Worker ${index}: ${message}`)

    console.log(`Worker ${index}: Starting...`);

    const provider = new Kupmios(kupoUrl, ogmiosUrl);
    const lucid = await Lucid.new(provider, network);
    lucid.selectWalletFromSeed(Deno.readTextFileSync("seed.txt"));

    let validatorUTXOs = await lucid.utxosAt(validatorAddress);

    while (true) {
        log(`${self.getGlobalWorkersState().newestDatum}`);

        await new Promise(resolve => setTimeout(resolve, 5000));
    }
};