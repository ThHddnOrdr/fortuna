import {
    applyParamsToScript,
    Constr,
    Data,
    fromHex,
    fromText,
    generateSeedPhrase,
    Kupmios,
    Lucid,
    Network,
    Script,
    sha256,
    toHex,
} from "https://deno.land/x/lucid@0.10.1/mod.ts";

let datum = "";

self.onmessage = async (e) => {
    const updateDatum = (newDatum: string) => {
        datum = newDatum;
    }

    const mine = async (index: number, validatorHash, validatorAddress, kupoUrl: string, ogmiosUrl: string, network: Network) => {
        const log = (message: string) => console.log(`Worker ${index}: ${message}`)

        log(`Starting...`);
    
        const provider = new Kupmios(kupoUrl, ogmiosUrl);
        const lucid = await Lucid.new(provider, network);
        lucid.selectWalletFromSeed(Deno.readTextFileSync("seed.txt"));
    
        let validatorUTXOs = await lucid.utxosAt(validatorAddress);
    
        while (true) {
            log(`${datum}`);
    
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
    
    if (e.data.datum !== undefined) {
        updateDatum(e.data.datum)
    } else {
        const {index, validatorHash, validatorAddress, kupoUrl, ogmiosUrl, network} = e.data;

        await mine(index, validatorHash, validatorAddress, kupoUrl, ogmiosUrl, network)
    }    
};