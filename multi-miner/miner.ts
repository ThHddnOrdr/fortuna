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
    const {index, validatorHash, validatorAddress, kupoUrl, ogmiosUrl, network} = e;

    console.log(`Worker ${index}: Starting...`);
    self.log("test");
    
    const provider = new Kupmios(kupoUrl, ogmiosUrl);
    const lucid = await Lucid.new(provider, network);
    lucid.selectWalletFromSeed(Deno.readTextFileSync("seed.txt"));

    let validatorUTXOs = await lucid.utxosAt(validatorAddress);

    console.log(`Worker ${index}: ${validatorUTXOs}`)
};