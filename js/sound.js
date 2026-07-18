/* yashb.me · synthesized sound kit. Zero audio files, default off.
   Every voice is an oscillator built at call time; the whole kit costs
   nothing until someone turns it on, and nothing is ever downloaded. */

window.SOUND = (function () {
  "use strict";

  var ctx = null;
  var master = null;
  var enabled = false;
  var lastAt = {};

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
      /* a hidden tab goes silent instead of chirping in the background */
      document.addEventListener("visibilitychange", function () {
        if (master) master.gain.value = document.hidden ? 0 : 1;
      });
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /* per-voice rate limit so scroll-driven callers can stay naive */
  function gate(name, ms) {
    var now = (window.performance || Date).now();
    if (lastAt[name] && now - lastAt[name] < ms) return false;
    lastAt[name] = now;
    return true;
  }

  function blip(freq, dur, type, vol, delay) {
    if (!enabled) return;
    try {
      var c = ac();
      var t = c.currentTime + (delay || 0);
      var o = c.createOscillator();
      var g = c.createGain();
      o.type = type || "sine";
      o.frequency.setValueAtTime(freq, t);
      o.connect(g);
      g.connect(master);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol || 0.05, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (e) {}
  }

  /* the learning scale: loss maps onto two pentatonic-ish octaves, so a
     falling curve literally resolves upward into tune. chaos is the low
     root; a trained model rings near the top. */
  var DEGREES = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  function lossFreq(loss) {
    var prog = 1 - Math.min(1, Math.max(0, (loss - 1.4) / (4.4 - 1.4)));
    var idx = Math.round(prog * (DEGREES.length - 1));
    return 220 * Math.pow(2, DEGREES[idx] / 12);
  }

  return {
    setEnabled: function (v) {
      enabled = !!v;
      if (enabled) ac();
      try { localStorage.setItem("sound", enabled ? "on" : "off"); } catch (e) {}
      return enabled;
    },
    isEnabled: function () { return enabled; },
    saved: function () {
      try { return localStorage.getItem("sound") === "on"; } catch (e) { return false; }
    },
    tick: function () { if (gate("tick", 70)) blip(2300, 0.035, "square", 0.012); },
    hover: function () { if (gate("hover", 90)) blip(540, 0.05, "sine", 0.014); },
    open: function () {
      if (!gate("open", 150)) return;
      blip(340, 0.09, "sine", 0.035);
      blip(510, 0.09, "sine", 0.03, 0.06);
    },
    deny: function () {
      if (!gate("deny", 150)) return;
      blip(196, 0.11, "square", 0.018);
      blip(147, 0.13, "square", 0.016, 0.07);
    },
    /* one short note per training moment, pitched by the loss */
    train: function (loss) {
      if (!gate("train", 85)) return;
      blip(lossFreq(loss === null || loss === undefined ? 4.2 : loss), 0.07, "triangle", 0.02);
    },
    /* a layer seating into the assembly: deep sheets thock low, the top
       sheet lands highest, so a full assembly plays a rising chord */
    seat: function (i, n) {
      if (!gate("seat" + i, 120)) return;
      var f = 130 * Math.pow(2, ((n - 1 - i) / Math.max(1, n)) * 1.35);
      blip(f, 0.09, "triangle", 0.045);
      blip(f / 2, 0.12, "sine", 0.03);
    },
    slide: function () {
      if (!gate("slide", 200)) return;
      blip(300, 0.05, "sine", 0.02);
      blip(430, 0.07, "sine", 0.022, 0.05);
    },
    /* the click grammar's confirmation thock */
    press: function () {
      if (!gate("press", 110)) return;
      blip(190, 0.1, "triangle", 0.045);
      blip(95, 0.13, "sine", 0.03);
    },
    chime: function () {
      if (!gate("chime", 600)) return;
      blip(659, 0.22, "sine", 0.05);
      blip(988, 0.34, "sine", 0.04, 0.1);
      blip(1319, 0.42, "sine", 0.028, 0.2);
    }
  };
})();
