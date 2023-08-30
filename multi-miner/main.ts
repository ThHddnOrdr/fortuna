import { loadSync } from "https://deno.land/std@0.199.0/dotenv/mod.ts";
import { Command } from "https://deno.land/x/cliffy@v1.0.0-rc.3/command/mod.ts";
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

loadSync({ export: true, allowEmptyValues: true });

type Genesis = {
  validator: string;
  validatorHash: string;
  validatorAddress: string;
  boostrapHash: string;
  outRef: { txHash: string; index: number };
};

declare var latestDatum: string;

const mine = new Command()
  .description("Start the multi-core miner")
  .env("KUPO_URL=<value:string>", "Kupo URL", { required: true })
  .env("OGMIOS_URL=<value:string>", "Ogmios URL", { required: true })
  .option("-p, --preview", "Use testnet")
  .action(async ({ preview, ogmiosUrl, kupoUrl }) => {
    const genesisFile = Deno.readTextFileSync(`genesis/${preview ? "preview" : "mainnet"}.json`);
    const { validatorHash, validatorAddress }: Genesis = JSON.parse(
      genesisFile,
    );
    const provider = new Kupmios(kupoUrl, ogmiosUrl);
    const lucid = await Lucid.new(provider, preview ? "Preview" : "Mainnet");
    lucid.selectWalletFromSeed(Deno.readTextFileSync("seed.txt"));

    const readUtxo = await lucid.utxosByOutRef([{
      txHash: "01751095ea408a3ebe6083b4de4de8a24b635085183ab8a2ac76273ef8fff5dd",
      outputIndex: 0,
    }]);

    latestDatum = ""
    
    const workers = [];

    for (let i = 0; i < 12; i++) {
        workers.push(new Worker(new URL("./miner.ts", import.meta.url).href, { type: "module" }));
    }

    workers.forEach((worker, index) => {
      worker.postMessage({
        index: index,
        validatorHash: validatorHash,
        validatorAddress: validatorAddress,
        kupoUrl: kupoUrl, 
        ogmiosUrl: ogmiosUrl,
        network: preview ? "Preview" : "Mainnet"
      });
    });

    while (true) {
      latestDatum = `${Math.random()}`;

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

await new Command()
  .name("fortuna")
  .description("Fortuna multi-core miner")
  .version("0.0.1")
  .command("mine", mine)
  .parse(Deno.args);