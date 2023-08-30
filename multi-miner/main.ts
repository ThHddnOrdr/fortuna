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

const mine = new Command()
  .description("Start the multi-core miner")
  .env("KUPO_URL=<value:string>", "Kupo URL", { required: true })
  .env("OGMIOS_URL=<value:string>", "Ogmios URL", { required: true })
  .env("WORKERS_COUNT=<value:number>", "Workers Count", { required: true })
  .option("-p, --preview", "Use testnet")
  .action(async ({ preview, workersCount, ogmiosUrl, kupoUrl }) => {
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

    const workers: Worker[] = [];

    let validatorUTXOs = await lucid.utxosAt(validatorAddress);
    let validatorOutRef = validatorUTXOs.find(
      (u) => u.assets[validatorHash + fromText("lord tuna")],
    )!;
    let datum: string = validatorOutRef.datum!;

    for (let i = 0; i < workersCount; i++) {
      let worker: Worker = new Worker(new URL("./miner.ts", import.meta.url).href, { type: "module" });

      worker.postMessage({
        validatorOutRef: validatorOutRef,
        readUtxo: readUtxo
      });

      await new Promise(resolve => setTimeout(resolve, 1000));

      worker.postMessage({
        index: i,
        validatorHash: validatorHash,
        validatorAddress: validatorAddress,
        kupoUrl: kupoUrl,
        ogmiosUrl: ogmiosUrl,
        network: preview ? "Preview" : "Mainnet"
      });

      workers.push(worker);
    }

    while (true) {
      validatorUTXOs = await lucid.utxosAt(validatorAddress);
      validatorOutRef = validatorUTXOs.find(
        (u) => u.assets[validatorHash + fromText("lord tuna")],
      )!;

      if (datum !== validatorOutRef.datum!) {
        console.log(`New datum: ${validatorOutRef.datum!}.`);

        workers.forEach((worker) => {
          worker.postMessage({
            validatorOutRef: validatorOutRef
          });
        });

        datum = validatorOutRef.datum!;
      }

      await new Promise(resolve => setTimeout(resolve, 250));
    }
  });

await new Command()
  .name("fortuna")
  .description("Fortuna multi-core miner")
  .version("0.0.1")
  .command("mine", mine)
  .parse(Deno.args);