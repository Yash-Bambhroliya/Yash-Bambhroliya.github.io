/* record-replay.mjs · runs the real train-worker in Node against the real
   corpus and captures its snapshot history to data/replay.json. That file
   is the honest fallback for browsers that skip live training: a recording
   of this exact network learning, never a fabrication.

   usage: node scripts/record-replay.mjs */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "js", "train-worker.js"), "utf8").replace('"use strict";', "");

const snaps = [];
let meta = {};

globalThis.onmessage = null;
globalThis.postMessage = function (m) {
  if (m.type === "ready") {
    meta = { tier: m.tier, params: m.params, vocab: m.vocab };
    if (m.snaps) snaps.push(...m.snaps);
    console.log("ready:", JSON.stringify(meta));
  } else if (m.type === "step") {
    if (m.snap) console.log("snap step", m.snap.step, "acc", m.snap.acc, "loss", m.snap.loss), snaps.push(m.snap);
  } else if (m.type === "done") {
    /* seed comparison on the final model, to sanity-check the snapshot seed */
    for (const seed of ["\n", "I ", "The ", "and "]) {
      console.log("seed", JSON.stringify(seed), ":", JSON.stringify(globalThis.sampleText(globalThis.M.model, 110, 0.8, seed)));
    }
    const out = {
      meta: {
        ...meta,
        note: "recorded from a real training run of this exact network",
        steps: m.step,
        trainedMs: Math.round(m.trainedMs)
      },
      snaps
    };
    writeFileSync(join(root, "data", "replay.json"), JSON.stringify(out));
    console.log("done:", m.reason, "· steps", m.step, "·", Math.round(m.trainedMs), "ms trained");
    console.log("wrote data/replay.json with", snaps.length, "snapshots");
    process.exit(0);
  }
};

(0, eval)(src);

const corpus = readFileSync(join(root, "data", "corpus.txt"), "utf8");
onmessage({ data: { type: "init", corpus, tier: "B" } });
/* Node runs the loop slower than a browser JIT does; give the recording
   enough compute budget to reach the full arc. M is a global var in the
   eval'd sloppy-mode source, so the cap is reachable here. */
globalThis.M.trainCapMs = 180000;
onmessage({ data: { type: "start", mode: "background" } });
