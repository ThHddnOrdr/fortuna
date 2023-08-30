import {
    Constr,
    Data,
    fromHex,
    fromText,
    Kupmios,
    Lucid,
    Network,
    sha256,
    toHex,
} from "https://deno.land/x/lucid@0.10.1/mod.ts";
import {
    calculateDifficultyNumber,
    calculateInterlink,
    getDifficulty,
    getDifficultyAdjustement,
    incrementU8Array,
} from "./utils.ts";

let validatorOutRef: any = undefined;
let readUtxo: any = undefined;
let state: any = undefined;
let nonce: Uint8Array = new Uint8Array(16);
let targetState: any = undefined;
let targetHash: Uint8Array;
let difficulty: {
    leadingZeros: bigint;
    difficulty_number: bigint;
};

self.onmessage = async (e) => {
    const updateDatum = (_validatorOutRef: any, _readUtxo: any) => {
        validatorOutRef = _validatorOutRef;
        readUtxo = _readUtxo;

        state = Data.from(validatorOutRef.datum) as Constr<
            string | bigint | string[]
        >;

        crypto.getRandomValues(nonce);

        targetState = new Constr(0, [
            // nonce: ByteArray
            toHex(nonce),
            // block_number: Int
            state.fields[0] as bigint,
            // current_hash: ByteArray
            state.fields[1] as bigint,
            // leading_zeros: Int
            state.fields[2] as bigint,
            // difficulty_number: Int
            state.fields[3] as bigint,
            //epoch_time: Int
            state.fields[4] as bigint,
        ]);
    }

    const mine = async (index: number, validatorHash, validatorAddress, kupoUrl: string, ogmiosUrl: string, network: Network) => {
        const log = (message: string) => console.log(`Worker ${index}: ${message}`);
        const postMineTx = async function (targetHash, difficulty, state, validatorHash, lucid, validatorOutRef, validatorAddress, readUtxo) {
            const realTimeNow = Number((Date.now() / 1000).toFixed(0)) * 1000 - 60000;

            const interlink = calculateInterlink(toHex(targetHash), difficulty, {
                leadingZeros: state.fields[2] as bigint,
                difficulty_number: state.fields[3] as bigint,
            }, state.fields[7] as string[]);

            let epoch_time = (state.fields[4] as bigint) + BigInt(90000 + realTimeNow) - (state.fields[5] as bigint);

            let difficulty_number = state.fields[3] as bigint;
            let leading_zeros = state.fields[2] as bigint;

            if (
                state.fields[0] as bigint % 2016n === 0n && state.fields[0] as bigint > 0
            ) {
                const adjustment = getDifficultyAdjustement(epoch_time, 1_209_600_000n);

                epoch_time = 0n;

                const new_difficulty = calculateDifficultyNumber(
                    {
                        leadingZeros: state.fields[2] as bigint,
                        difficulty_number: state.fields[3] as bigint,
                    },
                    adjustment.numerator,
                    adjustment.denominator,
                );

                difficulty_number = new_difficulty.difficulty_number;
                leading_zeros = new_difficulty.leadingZeros;
            }

            const postDatum = new Constr(0, [
                (state.fields[0] as bigint) + 1n,
                toHex(targetHash),
                leading_zeros,
                difficulty_number,
                epoch_time,
                BigInt(90000 + realTimeNow),
                0n,
                interlink,
            ]);

            const outDat = Data.to(postDatum);

            log(`Found next datum: ${outDat}`);

            const mintTokens = { [validatorHash + fromText("TUNA")]: 5000000000n };
            const masterToken = { [validatorHash + fromText("lord tuna")]: 1n };

            const txMine = await lucid
                .newTx()
                .collectFrom([validatorOutRef], Data.to(new Constr(1, [toHex(nonce)])))
                .payToAddressWithData(validatorAddress, { inline: outDat }, masterToken)
                .mintAssets(mintTokens, Data.to(new Constr(0, [])))
                .readFrom(readUtxo)
                .validTo(realTimeNow + 180000)
                .validFrom(realTimeNow)
                .complete();

            const signed = await txMine.sign().complete();

            log(`Submitting TX: ${signed.toHash()}...`);

            await signed.submit();
        }

        log(`Starting...`);

        const provider = new Kupmios(kupoUrl, ogmiosUrl);
        const lucid = await Lucid.new(provider, network);
        lucid.selectWalletFromSeed(Deno.readTextFileSync("seed.txt"));

        let hashingSample = {
            date: new Date(),
            count: 0
        }

        while (true) {
            if (targetState === undefined)
                continue;
            
            let hashingSampleElapsedTime = new Date().valueOf() - hashingSample.date.valueOf();
            if (hashingSampleElapsedTime > 60000) {
                log(`Datum/s: ${(hashingSample.count / (hashingSampleElapsedTime / 1000)).toFixed(0)}`);

                hashingSample = {
                    date: new Date(),
                    count: 0
                };
            }

            targetHash = sha256(sha256(fromHex(Data.to(targetState))));

            difficulty = getDifficulty(targetHash);

            const { leadingZeros, difficulty_number } = difficulty;

            if (
                leadingZeros > (state.fields[2] as bigint) ||
                (leadingZeros == (state.fields[2] as bigint) &&
                    difficulty_number < (state.fields[3] as bigint))
            ) {
                try {
                    await postMineTx(targetHash, difficulty, state, validatorHash, lucid, validatorOutRef, validatorAddress, readUtxo);

                    log("TX submitted successfully.")
                } catch (e) {
                    log("Exception while submitting TX (input probably already in mempool/on-chain).")
                }
            }

            incrementU8Array(nonce);

            targetState.fields[0] = toHex(nonce);

            hashingSample.count++;
        }
    }

    if (e.data.validatorOutRef !== undefined) {
        updateDatum(e.data.validatorOutRef, e.data.readUtxo);
    } else {
        const { index, validatorHash, validatorAddress, kupoUrl, ogmiosUrl, network } = e.data;

        await mine(index, validatorHash, validatorAddress, kupoUrl, ogmiosUrl, network);
    }
};