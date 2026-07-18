/* trainer.js · main-thread bridge to the GRU training worker.
   Decides eligibility once, feeds the corpus, relays telemetry,
   and persists weights to IndexedDB so repeat visits sample instantly. */

(function () {
  "use strict";

  var listeners = {};
  var worker = null;
  var state = {
    decided: false, eligible: false, ready: false, restored: false,
    tier: null, params: 0, vocab: 0,
    lastStep: null, doneInfo: null, temp: 0.7,
    corpusHash: null, startedAt: 0, snaps: [],
    running: false, lastStepAt: 0
  };
  var pendingSamples = {};
  var reqId = 0;

  function emit(name, data) {
    (listeners[name] || []).forEach(function (fn) {
      try { fn(data); } catch (e) {}
    });
  }

  /* ---------- eligibility: decided once, before any telemetry paints ---------- */

  function computeEligible() {
    if (typeof Worker === "undefined") return false;
    if (!("indexedDB" in window)) return false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    if (document.body.getAttribute("data-temp") === "0.0") return false;
    if (navigator.connection && navigator.connection.saveData) return false;
    if (navigator.deviceMemory !== undefined && navigator.deviceMemory <= 2) return false;
    return true;
  }

  /* ---------- IndexedDB ---------- */

  function idbOpen() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open("yashb-lm", 1);
      req.onupgradeneeded = function () { req.result.createObjectStore("models"); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function idbGet(key) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction("models", "readonly");
        var rq = tx.objectStore("models").get(key);
        rq.onsuccess = function () { resolve(rq.result || null); };
        rq.onerror = function () { resolve(null); };
      });
    }).catch(function () { return null; });
  }

  function idbPut(key, value) {
    return idbOpen().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction("models", "readwrite");
        tx.objectStore("models").put(value, key);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      });
    }).catch(function () { return false; });
  }

  function hashString(s) {
    /* FNV-1a, enough to invalidate on corpus edits */
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    return h.toString(16);
  }

  function persist() {
    if (!worker || !state.ready) return;
    worker.postMessage({ type: "getWeights" });
  }

  /* ---------- worker lifecycle ---------- */

  function boot() {
    state.decided = true;
    state.eligible = computeEligible();
    if (!state.eligible) { emit("decided", state); return; }

    fetch("/data/corpus.txt").then(function (r) {
      if (!r.ok) throw new Error("corpus " + r.status);
      return r.text();
    }).then(function (corpus) {
      state.corpusHash = hashString(corpus);
      var key = "gru-v1:" + state.corpusHash;
      return idbGet(key).then(function (saved) {
        worker = new Worker("/js/train-worker.js?v=9");
        worker.onerror = function (e) {
          try { console.error("[trainer] worker error:", e && e.message, e && e.filename, e && e.lineno); } catch (e2) {}
          state.eligible = false;
          state.running = false;
          emit("decided", state);
          try { worker.terminate(); } catch (e3) {}
          worker = null;
        };
        worker.onmessage = onWorkerMessage;
        var init = { type: "init", corpus: corpus };
        if (saved && saved.weights) {
          init.weights = saved.weights;
          init.meta = saved.meta;
        }
        worker.postMessage(init);
      });
    }).catch(function () {
      state.eligible = false;
      emit("decided", state);
    });
  }

  function onWorkerMessage(e) {
    var d = e.data;
    if (d.type === "ready") {
      if (d.tier === "D") {
        state.eligible = false;
        emit("decided", state);
        worker.terminate(); worker = null;
        return;
      }
      state.ready = true;
      state.tier = d.tier;
      state.params = d.params;
      state.vocab = d.vocab;
      state.restored = !!d.restored;
      if (d.snaps) state.snaps = d.snaps;
      emit("decided", state);
      emit("ready", state);
    } else if (d.type === "step") {
      state.lastStep = d;
      state.lastStepAt = performance.now();
      if (d.snap) state.snaps.push(d.snap);
      emit("step", d);
      if (d.snap) emit("snap", d.snap);
    } else if (d.type === "trainerror") {
      try { console.error("[trainer] recovered from a bad step:", d.message, "at step", d.step); } catch (e2) {}
      emit("trainerror", d);
    } else if (d.type === "done") {
      state.doneInfo = d;
      state.running = false;
      if (d.snap) state.snaps.push(d.snap);
      emit("done", d);
      if (d.snap) emit("snap", d.snap);
      persist();
    } else if (d.type === "sampled") {
      var cb = pendingSamples[d.reqId];
      if (cb) { delete pendingSamples[d.reqId]; cb(d.text); }
    } else if (d.type === "probe") {
      var pcb = pendingSamples[d.reqId];
      if (pcb) { delete pendingSamples[d.reqId]; pcb(d); }
    } else if (d.type === "weights") {
      idbPut("gru-v1:" + state.corpusHash, { weights: d.buffer, meta: d.meta, savedAt: Date.now() });
    } else if (d.type === "gradcheck") {
      emit("gradcheck", d);
    } else if (d.type === "stats") {
      emit("stats", d);
    }
  }

  document.addEventListener("visibilitychange", function () {
    if (!worker || !state.ready) return;
    worker.postMessage({ type: document.hidden ? "pause" : "resume" });
  });

  /* watchdog: a run that claims to be alive but has gone silent gets kicked.
     Covers lost resume races and any stall the worker cannot see itself. */
  setInterval(function () {
    if (!worker || !state.ready || !state.running || document.hidden) return;
    if (performance.now() - state.lastStepAt > 6000) {
      worker.postMessage({ type: "resume" });
    }
  }, 4000);

  window.addEventListener("pagehide", function () { persist(); });

  /* ---------- public API ---------- */

  window.TRAINER = {
    boot: boot,
    decided: function () { return state.decided; },
    eligible: function () { return state.decided && state.eligible; },
    ready: function () { return state.ready; },
    restored: function () { return state.restored; },
    history: function () { return state.snaps; },
    state: function () { return state; },
    start: function (mode) { if (worker && state.ready) { state.startedAt = performance.now(); state.running = true; state.lastStepAt = performance.now(); worker.postMessage({ type: "start", mode: mode || "background" }); } },
    setMode: function (mode) { if (worker) worker.postMessage({ type: "mode", mode: mode }); },
    stop: function () { state.running = false; if (worker) worker.postMessage({ type: "stop" }); },
    resume: function () { if (worker) { state.running = true; state.lastStepAt = performance.now(); worker.postMessage({ type: "resume" }); } },
    setTemp: function (v) { state.temp = v; if (worker) worker.postMessage({ type: "temp", value: v }); },
    sample: function (n, seed) {
      return new Promise(function (resolve) {
        if (!worker || !state.ready) { resolve(null); return; }
        var id = ++reqId;
        pendingSamples[id] = resolve;
        worker.postMessage({ type: "sample", n: n || 160, seed: seed, reqId: id });
        setTimeout(function () {
          if (pendingSamples[id]) { delete pendingSamples[id]; resolve(null); }
        }, 4000);
      });
    },
    probe: function (seed) {
      return new Promise(function (resolve) {
        if (!worker || !state.ready) { resolve(null); return; }
        var id = ++reqId;
        pendingSamples[id] = resolve;
        worker.postMessage({ type: "probe", seed: seed, reqId: id });
        setTimeout(function () {
          if (pendingSamples[id]) { delete pendingSamples[id]; resolve(null); }
        }, 4000);
      });
    },
    gradcheck: function () { if (worker) worker.postMessage({ type: "gradcheck" }); },
    stats: function () {
      var s = state.lastStep || {};
      var lastSnap = state.snaps.length ? state.snaps[state.snaps.length - 1] : null;
      return {
        tier: state.tier, params: state.params, vocab: state.vocab,
        step: s.step || (lastSnap && lastSnap.step) || 0, tokensSeen: s.tokensSeen || 0,
        trainedMs: s.trainedMs || (state.doneInfo && state.doneInfo.trainedMs) || (lastSnap && lastSnap.ms) || 0,
        /* display-gated: the raw corpus ema spikes at the phase switch and
           instruments must never show that number */
        loss: s.emaLoss !== undefined && s.emaLoss !== null ? s.emaLoss : (lastSnap && lastSnap.loss !== null ? lastSnap.loss : undefined),
        phase: s.phase, restored: state.restored
      };
    },
    on: function (name, fn) {
      (listeners[name] = listeners[name] || []).push(fn);
      return function () { listeners[name] = listeners[name].filter(function (f) { return f !== fn; }); };
    }
  };
})();
