/* train-worker.js · a character-level GRU language model, written by hand.
   No frameworks. Typed arrays and patience. View source is the documentation.

   Model: char embedding (D) -> GRU (H) -> linear head (V).
   h_t = z ⊙ h_prev + (1 - z) ⊙ c   (update-gate bias +1 so early state carries)
   Trained with Adam on truncated BPTT over B parallel corpus streams. */

"use strict";

var M = null; /* model state */

/* ---------- small linear algebra, row-major ---------- */

/* out[b,n] = sum_k inp[b,k] * W[n,k]  (x · W^T), W stored N x K */
function matmul(out, inp, W, B, K, N) {
  for (var b = 0; b < B; b++) {
    var ib = b * K, ob = b * N;
    for (var n = 0; n < N; n++) {
      var wn = n * K, s = 0;
      for (var k = 0; k < K; k++) s += inp[ib + k] * W[wn + k];
      out[ob + n] = s;
    }
  }
}

/* dW[n,k] += sum_b dOut[b,n] * inp[b,k] */
function accGradW(dW, dOut, inp, B, K, N) {
  for (var b = 0; b < B; b++) {
    var ib = b * K, ob = b * N;
    for (var n = 0; n < N; n++) {
      var g = dOut[ob + n];
      if (g === 0) continue;
      var wn = n * K;
      for (var k = 0; k < K; k++) dW[wn + k] += g * inp[ib + k];
    }
  }
}

/* dInp[b,k] += sum_n dOut[b,n] * W[n,k] */
function backInp(dInp, dOut, W, B, K, N) {
  for (var b = 0; b < B; b++) {
    var ib = b * K, ob = b * N;
    for (var n = 0; n < N; n++) {
      var g = dOut[ob + n];
      if (g === 0) continue;
      var wn = n * K;
      for (var k = 0; k < K; k++) dInp[ib + k] += g * W[wn + k];
    }
  }
}

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }

/* ---------- parameter registry ---------- */

function makeParams(V, D, H) {
  var defs = [
    ["Wemb", V * D], ["Wz", H * D], ["Uz", H * H], ["bz", H],
    ["Wr", H * D], ["Ur", H * H], ["br", H],
    ["Wc", H * D], ["Uc", H * H], ["bc", H],
    ["Why", V * H], ["by", V]
  ];
  var total = 0;
  defs.forEach(function (d) { total += d[1]; });
  var flat = new Float32Array(total);
  var grads = new Float32Array(total);
  var m = new Float32Array(total);
  var v = new Float32Array(total);
  var P = {}, G = {}, off = 0;
  defs.forEach(function (d) {
    P[d[0]] = flat.subarray(off, off + d[1]);
    G[d[0]] = grads.subarray(off, off + d[1]);
    off += d[1];
  });
  var scale = 0.08;
  for (var i = 0; i < total; i++) flat[i] = (Math.random() * 2 - 1) * scale;
  P.bz.fill(0); P.br.fill(0); P.bc.fill(0); P.by.fill(0);
  return { flat: flat, grads: grads, m: m, v: v, P: P, G: G, total: total, V: V, D: D, H: H };
}

/* ---------- forward/backward over one (B,T) window ---------- */

function step(model, batchIds, targets, B, T, cache) {
  var P = model.P, G = model.G, V = model.V, D = model.D, H = model.H;
  var c = cache;
  var loss = 0;

  /* forward */
  for (var t = 0; t < T; t++) {
    var x = c.x[t], hPrev = t === 0 ? c.h0 : c.h[t - 1];
    for (var b = 0; b < B; b++) {
      var id = batchIds[t * B + b], xe = b * D, we = id * D;
      for (var d = 0; d < D; d++) x[xe + d] = P.Wemb[we + d];
    }
    matmul(c.zpre[t], x, P.Wz, B, D, H);
    matmul(c.tmpH, hPrev, P.Uz, B, H, H);
    for (var i = 0; i < B * H; i++) c.zpre[t][i] = sigmoid(c.zpre[t][i] + c.tmpH[i] + P.bz[i % H]);
    matmul(c.rpre[t], x, P.Wr, B, D, H);
    matmul(c.tmpH, hPrev, P.Ur, B, H, H);
    for (i = 0; i < B * H; i++) c.rpre[t][i] = sigmoid(c.rpre[t][i] + c.tmpH[i] + P.br[i % H]);
    var rh = c.rh[t];
    for (i = 0; i < B * H; i++) rh[i] = c.rpre[t][i] * hPrev[i];
    matmul(c.cpre[t], x, P.Wc, B, D, H);
    matmul(c.tmpH, rh, P.Uc, B, H, H);
    for (i = 0; i < B * H; i++) c.cpre[t][i] = Math.tanh(c.cpre[t][i] + c.tmpH[i] + P.bc[i % H]);
    var h = c.h[t];
    for (i = 0; i < B * H; i++) {
      var z = c.zpre[t][i];
      h[i] = z * hPrev[i] + (1 - z) * c.cpre[t][i];
    }
    /* head + softmax CE */
    matmul(c.logits, h, P.Why, B, H, V);
    var probs = c.probs[t];
    for (b = 0; b < B; b++) {
      var lb = b * V, mx = -1e30;
      for (var q = 0; q < V; q++) { var lv = c.logits[lb + q] + P.by[q]; c.logits[lb + q] = lv; if (lv > mx) mx = lv; }
      var sum = 0;
      for (q = 0; q < V; q++) { var e = Math.exp(c.logits[lb + q] - mx); probs[lb + q] = e; sum += e; }
      var inv = 1 / sum;
      for (q = 0; q < V; q++) probs[lb + q] *= inv;
      loss += -Math.log(Math.max(probs[lb + targets[t * B + b]], 1e-12));
    }
  }
  loss /= B * T;

  /* backward */
  model.grads.fill(0);
  c.dh.fill(0);
  for (t = T - 1; t >= 0; t--) {
    var probsT = c.probs[t], hT = c.h[t];
    hPrev = t === 0 ? c.h0 : c.h[t - 1];
    x = c.x[t];
    /* dLogits = probs - onehot, scaled */
    var dLog = c.dLog, sc = 1 / (B * T);
    for (b = 0; b < B; b++) {
      lb = b * V;
      for (q = 0; q < V; q++) dLog[lb + q] = probsT[lb + q] * sc;
      dLog[lb + targets[t * B + b]] -= sc;
    }
    accGradW(G.Why, dLog, hT, B, H, V);
    for (b = 0; b < B; b++) { lb = b * V; for (q = 0; q < V; q++) G.by[q] += dLog[lb + q]; }
    /* dh = dLog·Why + carried */
    backInp(c.dh, dLog, P.Why, B, H, V);

    var dhNext = c.dhNext; dhNext.fill(0);
    var dzpre = c.dzpre, drpre = c.drpre, dcpre = c.dcpre, drh = c.drh;
    for (i = 0; i < B * H; i++) {
      z = c.zpre[t][i];
      var cc = c.cpre[t][i], dh = c.dh[i];
      var dz = dh * (hPrev[i] - cc);
      var dc = dh * (1 - z);
      dhNext[i] += dh * z;
      dcpre[i] = dc * (1 - cc * cc);
      dzpre[i] = dz * z * (1 - z);
    }
    accGradW(G.Wc, dcpre, x, B, D, H);
    accGradW(G.Uc, dcpre, c.rh[t], B, H, H);
    for (b = 0; b < B; b++) { var hb = b * H; for (i = 0; i < H; i++) G.bc[i] += dcpre[hb + i]; }
    drh.fill(0);
    backInp(drh, dcpre, P.Uc, B, H, H);
    for (i = 0; i < B * H; i++) {
      var r = c.rpre[t][i];
      var dr = drh[i] * hPrev[i];
      dhNext[i] += drh[i] * r;
      drpre[i] = dr * r * (1 - r);
    }
    accGradW(G.Wr, drpre, x, B, D, H);
    accGradW(G.Ur, drpre, hPrev, B, H, H);
    accGradW(G.Wz, dzpre, x, B, D, H);
    accGradW(G.Uz, dzpre, hPrev, B, H, H);
    for (b = 0; b < B; b++) {
      hb = b * H;
      for (i = 0; i < H; i++) { G.br[i] += drpre[hb + i]; G.bz[i] += dzpre[hb + i]; }
    }
    backInp(dhNext, drpre, P.Ur, B, H, H);
    backInp(dhNext, dzpre, P.Uz, B, H, H);
    /* dx -> embedding rows */
    var dx = c.dx; dx.fill(0);
    backInp(dx, dzpre, P.Wz, B, D, H);
    backInp(dx, drpre, P.Wr, B, D, H);
    backInp(dx, dcpre, P.Wc, B, D, H);
    for (b = 0; b < B; b++) {
      id = batchIds[t * B + b]; we = id * D; xe = b * D;
      for (d = 0; d < D; d++) G.Wemb[we + d] += dx[xe + d];
    }
    c.dh.set(dhNext);
  }
  return loss;
}

function clipAndAdam(model, lr, step) {
  var g = model.grads, n = model.total;
  var norm = 0;
  for (var i = 0; i < n; i++) norm += g[i] * g[i];
  norm = Math.sqrt(norm);
  var scale = norm > 5 ? 5 / norm : 1;
  var b1 = 0.9, b2 = 0.999, eps = 1e-8;
  var c1 = 1 - Math.pow(b1, step), c2 = 1 - Math.pow(b2, step);
  var flat = model.flat, m = model.m, v = model.v;
  for (i = 0; i < n; i++) {
    var gi = g[i] * scale;
    m[i] = b1 * m[i] + (1 - b1) * gi;
    v[i] = b2 * v[i] + (1 - b2) * gi * gi;
    flat[i] -= lr * (m[i] / c1) / (Math.sqrt(v[i] / c2) + eps);
  }
}

/* ---------- inference ---------- */

function forwardChar(model, id, h, logits) {
  var P = model.P, D = model.D, H = model.H, V = model.V;
  var x = M.infX, we = id * D;
  for (var d = 0; d < D; d++) x[d] = P.Wemb[we + d];
  var zv = M.infZ, rv = M.infR, cv = M.infC;
  var i, k, row;
  for (i = 0; i < H; i++) {
    row = i * D;
    var uz = i * H, sZ = P.bz[i], sR = P.br[i];
    for (d = 0; d < D; d++) { sZ += x[d] * P.Wz[row + d]; sR += x[d] * P.Wr[row + d]; }
    for (k = 0; k < H; k++) { sZ += h[k] * P.Uz[uz + k]; sR += h[k] * P.Ur[uz + k]; }
    zv[i] = sigmoid(sZ);
    rv[i] = sigmoid(sR);
  }
  for (i = 0; i < H; i++) {
    row = i * D;
    var uc = i * H, sC = P.bc[i];
    for (d = 0; d < D; d++) sC += x[d] * P.Wc[row + d];
    for (k = 0; k < H; k++) sC += (rv[k] * h[k]) * P.Uc[uc + k];
    cv[i] = Math.tanh(sC);
  }
  for (i = 0; i < H; i++) h[i] = zv[i] * h[i] + (1 - zv[i]) * cv[i];
  if (logits) {
    for (var q = 0; q < V; q++) {
      var wy = q * H, sl = P.by[q];
      for (k = 0; k < H; k++) sl += h[k] * P.Why[wy + k];
      logits[q] = sl;
    }
  }
}

function sampleFromLogits(logits, V, temp) {
  if (temp <= 0.01) {
    var best = 0;
    for (var q = 1; q < V; q++) if (logits[q] > logits[best]) best = q;
    return best;
  }
  var mx = -1e30;
  for (q = 0; q < V; q++) if (logits[q] > mx) mx = logits[q];
  var sum = 0, p = M.infP;
  for (q = 0; q < V; q++) { p[q] = Math.exp((logits[q] - mx) / temp); sum += p[q]; }
  var rnd = Math.random() * sum, acc = 0;
  for (q = 0; q < V; q++) { acc += p[q]; if (rnd <= acc) return q; }
  return V - 1;
}

function sampleText(model, n, temp, seed) {
  var h = new Float32Array(model.H);
  var logits = M.infLogits;
  var out = "";
  var start = seed || "\n";
  var id;
  for (var s = 0; s < start.length; s++) {
    forwardChar(model, M.stoi[start[s]] !== undefined ? M.stoi[start[s]] : 0, h, s === start.length - 1 ? logits : null);
  }
  for (var i = 0; i < n; i++) {
    id = sampleFromLogits(logits, model.V, temp);
    out += M.itos[id];
    forwardChar(model, id, h, logits);
  }
  return out;
}

/* teacher-forced sample of the headline: at each position, sample from
   p(char | TRUE prefix). Matches lock in as the model learns to spell. */
function headline(model, target, temp) {
  var h = new Float32Array(model.H);
  var logits = M.infLogits;
  var out = "", correct = 0;
  forwardChar(model, M.stoi["\n"] !== undefined ? M.stoi["\n"] : 0, h, logits);
  for (var i = 0; i < target.length; i++) {
    var sampled = sampleFromLogits(logits, model.V, temp);
    var arg = sampleFromLogits(logits, model.V, 0);
    out += M.itos[sampled];
    if (M.itos[arg] === target[i]) correct++;
    var trueId = M.stoi[target[i]] !== undefined ? M.stoi[target[i]] : 0;
    forwardChar(model, trueId, h, logits);
  }
  return { text: out, acc: correct / target.length };
}

/* ---------- gradient check (finite differences, toy config) ---------- */

function gradCheck() {
  var V = 8, D = 4, H = 6, B = 2, T = 3;
  var model = makeParams(V, D, H);
  /* unsaturated config so every path carries measurable gradient */
  model.P.bz.fill(0);
  for (var j = 0; j < model.total; j++) model.flat[j] = Math.sin(j * 1.7) * 0.3;
  var cache = makeCache(B, T, V, D, H);
  var ids = new Int32Array(B * T), tg = new Int32Array(B * T);
  for (var i = 0; i < B * T; i++) { ids[i] = (i * 3) % V; tg[i] = (i * 5 + 1) % V; }
  var seedH0 = function () { for (var s = 0; s < cache.h0.length; s++) cache.h0[s] = Math.sin(s * 0.9) * 0.4; };
  seedH0();
  step(model, ids, tg, B, T, cache);
  var analytic = new Float32Array(model.grads);
  var eps = 1e-3, worst = 0, checked = 0, fails = 0;
  for (var p = 0; p < model.total; p += 7) {
    var orig = model.flat[p];
    model.flat[p] = orig + eps;
    seedH0();
    var lp = step(model, ids, tg, B, T, cache);
    model.flat[p] = orig - eps;
    seedH0();
    var lm = step(model, ids, tg, B, T, cache);
    model.flat[p] = orig;
    var numeric = (lp - lm) / (2 * eps);
    var a = analytic[p];
    var abs = Math.abs(a - numeric);
    var rel = abs / Math.max(1e-6, Math.abs(a) + Math.abs(numeric));
    /* float32 activations limit numeric resolution: require BOTH errors large to fail */
    if (abs > 1e-4 && rel > 1e-2) fails++;
    if (rel > worst && abs > 1e-4) worst = rel;
    checked++;
  }
  return { worst: worst, checked: checked, fails: fails };
}

/* ---------- cache ---------- */

function makeCache(B, T, V, D, H) {
  var c = {
    h0: new Float32Array(B * H), tmpH: new Float32Array(B * H),
    logits: new Float32Array(B * V), dLog: new Float32Array(B * V),
    dh: new Float32Array(B * H), dhNext: new Float32Array(B * H),
    dzpre: new Float32Array(B * H), drpre: new Float32Array(B * H),
    dcpre: new Float32Array(B * H), drh: new Float32Array(B * H),
    dx: new Float32Array(B * D),
    x: [], zpre: [], rpre: [], cpre: [], rh: [], h: [], probs: []
  };
  for (var t = 0; t < T; t++) {
    c.x.push(new Float32Array(B * D));
    c.zpre.push(new Float32Array(B * H));
    c.rpre.push(new Float32Array(B * H));
    c.cpre.push(new Float32Array(B * H));
    c.rh.push(new Float32Array(B * H));
    c.h.push(new Float32Array(B * H));
    c.probs.push(new Float32Array(B * V));
  }
  return c;
}

/* ---------- training driver ---------- */

var RUN = { active: false, mode: null, phase: "warmup", step: 0, tokens: 0, epoch: 1, ema: null, emaName: null, temp: 0.7, startAt: 0, trainedMs: 0, lossHistory: [], lastAcc: 0, snaps: [], nextSnapAt: 1, finishTarget: 0, doneReason: null };
var HEADLINE = "Yash Bambhroliya";

/* a snapshot is what the model wrote at one moment of its life: a free-run
   sample, its greedy attempt at the name, and the loss. The recorded set
   replays the whole learning arc, noise to prose, on scroll.
   The sample is seeded with a short prose prefix (shown dimmed on the page,
   never claimed as output); a newline seed collapses into name loops because
   the corpus oversamples the name after line breaks. */
var SNAP_SEED = "I ";
function snapshot() {
  var hl = headline(M.model, HEADLINE, 0);
  /* same display gate as the loss widget: corpus loss right after the phase
     switch is a spike from name memorization, shown as warming until real */
  var burned = RUN.phase !== "main" || (RUN.ema !== null && RUN.ema < Math.log(M.V) + 0.15);
  var displayLoss = RUN.phase === "warmup" ? RUN.emaName : (burned ? RUN.ema : null);
  return {
    step: RUN.step,
    ms: Math.round(RUN.trainedMs),
    phase: RUN.phase,
    loss: displayLoss === null ? null : Math.round(displayLoss * 1000) / 1000,
    acc: Math.round(hl.acc * 100) / 100,
    name: hl.text,
    seed: SNAP_SEED,
    sample: sampleText(M.model, 140, 0.8, SNAP_SEED)
  };
}

function scheduleNextSnap() {
  RUN.nextSnapAt = RUN.step < 20 ? RUN.step + 2 : Math.max(RUN.step + 3, Math.round(RUN.step * 1.22));
}

function trainLoop() {
  if (!RUN.active || !M) return;
  var t0 = performance.now();
  var B = M.B, T = M.T;

  /* two-phase curriculum. Phase "warmup": pure headline batches, the model
     learns to spell the name (its loss is reported, labeled as headline loss).
     Phase "main": corpus batches with 10% headline maintenance; corpus loss
     is reported. Never blended, so every number on screen is a real loss. */
  if (RUN.phase === "warmup" && (RUN.lastAcc >= 0.92 || RUN.step >= 90)) {
    RUN.phase = "main";
    RUN.mainStart = RUN.step;
    RUN.lossHistory = [];
  }
  /* heavy headline maintenance right after the switch prevents forgetting,
     then decays: over-rehearsing the name turns free samples into name loops.
     A slipped probe raises the rate back up until the name re-locks. */
  var msMain = RUN.phase === "main" ? RUN.step - RUN.mainStart : 0;
  var maint = msMain < 150 ? 0.3 : msMain < 400 ? 0.1 : 0.05;
  if (RUN.phase === "main" && RUN.lastAcc < 0.9) maint = 0.3;
  var nameBatch = RUN.phase === "warmup" || RUN.finishTarget ? true : Math.random() < maint;
  var T_use = RUN.phase === "warmup" ? Math.min(16, T) : T;

  var ids, ptrs, starts, N, h0;
  if (nameBatch && (RUN.phase === "warmup" || RUN.lastAcc < 0.9 || RUN.finishTarget)) {
    /* the name slipped below the probe threshold: repair with pure batches */
    ids = M.nameIds; ptrs = M.namePtrs; starts = M.nameStarts; N = M.nameIds.length; h0 = M.nameH0;
  } else if (nameBatch) {
    ids = M.mixIds; ptrs = M.mixPtrs; starts = M.mixStarts; N = M.mixIds.length; h0 = M.mixH0;
  } else {
    ids = M.ids; ptrs = M.ptrs; starts = M.starts; N = M.ids.length; h0 = M.corpusH0;
  }
  M.cache.h0.set(h0);
  for (var b = 0; b < B; b++) {
    var ptr = ptrs[b];
    if (ptr + T_use + 1 >= N) { ptr = ptrs[b] = starts[b]; M.cache.h0.fill(0, b * M.H, (b + 1) * M.H); if (b === 0 && !nameBatch) RUN.epoch++; }
    for (var t = 0; t < T_use; t++) {
      M.batchIds[t * B + b] = ids[ptr + t];
      M.targets[t * B + b] = ids[ptr + t + 1];
    }
    ptrs[b] = ptr + T_use;
  }
  var loss = step(M.model, M.batchIds, M.targets, B, T_use, M.cache);
  h0.set(M.cache.h[T_use - 1]); /* carry hidden state per source */
  RUN.step++;
  RUN.tokens += B * T_use;
  clipAndAdam(M.model, RUN.phase === "warmup" ? 2e-2 : 3e-3, RUN.step);
  if (nameBatch) {
    RUN.emaName = RUN.emaName === null ? loss : 0.7 * RUN.emaName + 0.3 * loss;
  } else {
    RUN.ema = RUN.ema === null ? loss : 0.9 * RUN.ema + 0.1 * loss;
  }
  RUN.trainedMs += performance.now() - t0;

  var snap = null;
  if (RUN.step >= RUN.nextSnapAt && RUN.snaps.length < 64) {
    snap = snapshot();
    RUN.snaps.push(snap);
    scheduleNextSnap();
  }

  /* corpus loss right after the phase switch is a spike (the net just
     memorized 19 chars); burn in 10 steps before showing it */
  var mainBurnedIn = RUN.phase === "main" && RUN.ema !== null && RUN.ema < Math.log(M.V) + 0.15;
  var displayLoss = RUN.phase === "warmup"
    ? (RUN.emaName === null ? Math.log(M.V) : RUN.emaName)
    : (mainBurnedIn ? RUN.ema : null);
  if (RUN.step % 2 === 0 && displayLoss !== null) RUN.lossHistory.push(displayLoss);
  if (RUN.lossHistory.length > 220) RUN.lossHistory.splice(0, RUN.lossHistory.length - 200);

  var msg = { type: "step", step: RUN.step, phase: RUN.phase, emaLoss: displayLoss, corpusLoss: RUN.ema, tokensSeen: RUN.tokens, epoch: RUN.epoch, trainedMs: RUN.trainedMs };
  if (RUN.mainStart !== undefined) msg.mainStep = RUN.step - RUN.mainStart;
  if (RUN.mode === "preloader" || RUN.step % 3 === 0 || RUN.finishTarget) {
    var hl = headline(M.model, HEADLINE, RUN.temp);
    msg.headlineSample = hl.text;
    msg.headlineAcc = hl.acc;
    RUN.lastAcc = hl.acc;
  }
  if (RUN.step % 5 === 0) msg.sample = sampleText(M.model, 90, RUN.temp);
  if (RUN.step % 10 === 0 && RUN.lossHistory.length > 1) msg.lossHistory = RUN.lossHistory.slice(-120);
  if (snap) msg.snap = snap;
  postMessage(msg);

  /* the preloader UI exits on its own clock; the worker only stops itself
     on corpus convergence or the background training cap */
  var capMs = M.trainCapMs;
  var converged = RUN.ema !== null && RUN.ema < 1.35;
  if (!RUN.finishTarget && (converged || RUN.trainedMs > capMs)) {
    RUN.doneReason = converged ? "converged" : "cap";
    /* finishing pass: if the name slipped, spend the last few dozen steps
       on pure name batches so the run ends where it began, locked */
    RUN.finishTarget = RUN.lastAcc < 0.95 ? RUN.step + 40 : RUN.step;
  }
  if (RUN.finishTarget && (RUN.lastAcc >= 0.95 || RUN.step >= RUN.finishTarget)) {
    RUN.active = false;
    /* the replay's last frame is the model's actual final state */
    var finalSnap = null;
    if (RUN.snaps.length < 64 && (!RUN.snaps.length || RUN.snaps[RUN.snaps.length - 1].step < RUN.step)) {
      finalSnap = snapshot();
      RUN.snaps.push(finalSnap);
      scheduleNextSnap();
    }
    postMessage({ type: "done", reason: RUN.doneReason, emaLoss: RUN.ema, step: RUN.step, trainedMs: RUN.trainedMs, snap: finalSnap });
    return;
  }
  setTimeout(trainLoop, 0);
}

/* ---------- tier benchmark ---------- */

function benchmark() {
  var V = 79, D = 32, H = 128, B = 16, T = 8;
  var model = makeParams(V, D, H);
  var cache = makeCache(B, T, V, D, H);
  var ids = new Int32Array(B * T), tg = new Int32Array(B * T);
  for (var i = 0; i < B * T; i++) { ids[i] = i % V; tg[i] = (i + 1) % V; }
  step(model, ids, tg, B, T, cache); /* warmup */
  var t0 = performance.now(), reps = 3;
  for (var r = 0; r < reps; r++) { cache.h0.fill(0); step(model, ids, tg, B, T, cache); }
  /* per-token cost is roughly T-independent, so T=8 timing predicts T=32 */
  return (performance.now() - t0) / (reps * B * T);
}

/* ---------- message handling ---------- */

onmessage = function (e) {
  var d = e.data;
  if (d.type === "init") {
    var text = d.corpus;
    var chars = {};
    for (var i = 0; i < text.length; i++) chars[text[i]] = 1;
    var itos = Object.keys(chars).sort();
    var stoi = {};
    itos.forEach(function (ch, idx) { stoi[ch] = idx; });
    var V = itos.length;
    var benchMsTok = benchmark();
    /* tier pick: ms per token for tier-A shape; thresholds picked so
       tier A needs >= ~1.5k tok/s */
    var tier = d.tier || (benchMsTok < 0.7 ? "A" : benchMsTok < 1.4 ? "B" : benchMsTok < 3 ? "C" : "D");
    var cfg = { A: [128, 16, 32, 9000, 90000], B: [96, 8, 32, 9000, 60000], C: [64, 8, 24, 7000, 20000], D: null }[tier];
    if (!cfg) { postMessage({ type: "ready", tier: "D", benchMsTok: benchMsTok }); return; }
    var H = cfg[0], B = cfg[1], T = cfg[2];
    var D = 32;
    var model = makeParams(V, D, H);
    var ids = new Int32Array(text.length);
    for (i = 0; i < text.length; i++) ids[i] = stoi[text[i]];
    var starts = new Int32Array(B), ptrs = new Int32Array(B);
    var span = Math.floor(ids.length / B);
    for (var b = 0; b < B; b++) { starts[b] = b * span; ptrs[b] = b * span; }
    /* headline curriculum corpus: the name line repeated (warmup only) */
    var nameLine = "\n" + HEADLINE + ". ";
    var nameText = "";
    while (nameText.length < B * T * 4 + nameLine.length + 1) nameText += nameLine;
    var nameIds = new Int32Array(nameText.length);
    for (i = 0; i < nameText.length; i++) nameIds[i] = stoi[nameText[i]] !== undefined ? stoi[nameText[i]] : 0;
    var nameStarts = new Int32Array(B), namePtrs = new Int32Array(B);
    var nameSpan = Math.floor(nameIds.length / B);
    for (b = 0; b < B; b++) { nameStarts[b] = b * nameSpan; namePtrs[b] = b * nameSpan; }
    /* maintenance stream: the name spliced into varied corpus context.
       Rehearsing the pure loop teaches "name follows name" and free samples
       collapse into name spam; this keeps the spelling sharp instead */
    var mixText = "";
    while (mixText.length < B * T * 24) {
      var cut = Math.floor(Math.random() * Math.max(1, text.length - 400));
      mixText += nameLine + text.slice(cut, cut + 100 + Math.floor(Math.random() * 140));
    }
    var mixIds = new Int32Array(mixText.length);
    for (i = 0; i < mixText.length; i++) mixIds[i] = stoi[mixText[i]] !== undefined ? stoi[mixText[i]] : 0;
    var mixStarts = new Int32Array(B), mixPtrs = new Int32Array(B);
    var mixSpan = Math.floor(mixIds.length / B);
    for (b = 0; b < B; b++) { mixStarts[b] = b * mixSpan; mixPtrs[b] = b * mixSpan; }
    M = {
      model: model, cache: makeCache(B, T, V, D, H),
      ids: ids, starts: starts, ptrs: ptrs,
      nameIds: nameIds, nameStarts: nameStarts, namePtrs: namePtrs,
      mixIds: mixIds, mixStarts: mixStarts, mixPtrs: mixPtrs,
      nameH0: new Float32Array(B * H), corpusH0: new Float32Array(B * H),
      mixH0: new Float32Array(B * H),
      batchIds: new Int32Array(B * T), targets: new Int32Array(B * T),
      B: B, T: T, V: V, D: D, H: H,
      stoi: stoi, itos: itos,
      preloaderCapMs: cfg[3], trainCapMs: cfg[4],
      infX: new Float32Array(D), infH2: new Float32Array(H), infC: new Float32Array(H),
      infZ: new Float32Array(H), infR: new Float32Array(H),
      infLogits: new Float32Array(V), infP: new Float32Array(V)
    };
    if (d.weights) {
      var w = new Float32Array(d.weights);
      if (w.length === model.total) { model.flat.set(w); RUN.step = d.meta && d.meta.step || 0; RUN.tokens = d.meta && d.meta.tokensSeen || 0; RUN.trainedMs = d.meta && d.meta.trainedMs || 0; RUN.ema = d.meta && d.meta.emaLoss || null; if (d.meta && d.meta.lossHistory) RUN.lossHistory = Array.prototype.slice.call(d.meta.lossHistory); if (d.meta && d.meta.snaps) RUN.snaps = d.meta.snaps; }
      if (RUN.step > 0) scheduleNextSnap();
    } else {
      /* the birth frame: what an untrained net writes is the honest zero */
      RUN.snaps = [snapshot()];
      RUN.nextSnapAt = 1;
    }
    postMessage({ type: "ready", tier: tier, vocab: V, params: model.total, benchMsTok: benchMsTok, restored: !!d.weights, snaps: RUN.snaps });
  } else if (d.type === "start") {
    if (!M) return;
    RUN.mode = d.mode || "background";
    if (!RUN.active) { RUN.active = true; trainLoop(); }
  } else if (d.type === "mode") {
    RUN.mode = d.mode;
  } else if (d.type === "stop" || d.type === "pause") {
    RUN.active = false;
    if (d.type === "stop") postMessage({ type: "done", reason: "stopped", emaLoss: RUN.ema, step: RUN.step, trainedMs: RUN.trainedMs });
  } else if (d.type === "resume") {
    if (M && !RUN.active) {
      /* a resumed run earns a fresh budget past the cap it already hit */
      RUN.finishTarget = 0;
      if (RUN.trainedMs > M.trainCapMs - 5000) M.trainCapMs = RUN.trainedMs + 30000;
      RUN.active = true;
      trainLoop();
    }
  } else if (d.type === "temp") {
    RUN.temp = d.value;
  } else if (d.type === "sample") {
    if (!M) return;
    postMessage({ type: "sampled", text: sampleText(M.model, d.n || 160, RUN.temp, d.seed), reqId: d.reqId });
  } else if (d.type === "quiz") {
    /* one duel round: a real corpus snippet, the true next char, and the
       model's committed guess plus its top-5 distribution. Everything is
       decided here, before the player sees the choices. */
    if (!M) return;
    var CTX = 60;
    var off = CTX + 1 + Math.floor(Math.random() * (M.ids.length - CTX - 2));
    /* land on a guessable target: letters and common punctuation */
    var guard = 0;
    while (!/[a-z .,]/.test(M.itos[M.ids[off]]) && guard++ < 500) {
      off++;
      if (off >= M.ids.length - 1) off = CTX + 1;
    }
    var hq = new Float32Array(M.H);
    var lg = M.infLogits;
    var ctx = "";
    for (var qi = off - CTX; qi < off; qi++) {
      ctx += M.itos[M.ids[qi]];
      forwardChar(M.model, M.ids[qi], hq, qi === off - 1 ? lg : null);
    }
    var qmx = -1e30;
    for (var qq = 0; qq < M.V; qq++) if (lg[qq] > qmx) qmx = lg[qq];
    var qsum = 0, dist = [];
    for (qq = 0; qq < M.V; qq++) { var qe = Math.exp(lg[qq] - qmx); dist.push([M.itos[qq], qe]); qsum += qe; }
    for (qq = 0; qq < dist.length; qq++) dist[qq][1] /= qsum;
    dist.sort(function (a, b) { return b[1] - a[1]; });
    postMessage({
      type: "quiz", reqId: d.reqId,
      context: ctx,
      truth: M.itos[M.ids[off]],
      pick: dist[0][0],
      top: dist.slice(0, 5)
    });
  } else if (d.type === "headline") {
    if (!M) return;
    var hl = headline(M.model, HEADLINE, RUN.temp);
    postMessage({ type: "headline", text: hl.text, acc: hl.acc });
  } else if (d.type === "getWeights") {
    if (!M) return;
    var buf = M.model.flat.slice().buffer;
    postMessage({
      type: "weights", buffer: buf,
      meta: { step: RUN.step, tokensSeen: RUN.tokens, trainedMs: RUN.trainedMs, emaLoss: RUN.ema, lossHistory: new Float32Array(RUN.lossHistory), snaps: RUN.snaps }
    }, [buf]);
  } else if (d.type === "gradcheck") {
    var res = gradCheck();
    postMessage({ type: "gradcheck", worst: res.worst, checked: res.checked, fails: res.fails });
  } else if (d.type === "stats") {
    postMessage({ type: "stats", step: RUN.step, tokensSeen: RUN.tokens, trainedMs: RUN.trainedMs, emaLoss: RUN.ema, params: M ? M.model.total : 0, tier: M ? (M.H === 128 ? "A" : M.H === 96 ? "B" : "C") : "D" });
  }
};
