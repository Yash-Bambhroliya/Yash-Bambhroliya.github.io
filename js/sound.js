/* yashb.me · synthesized sound kit. Zero audio files, default off. */

window.SOUND = (function () {
  "use strict";

  var ctx = null;
  var enabled = false;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
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
      g.connect(c.destination);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol || 0.05, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t);
      o.stop(t + dur + 0.05);
    } catch (e) {}
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
    tick: function () { blip(2300, 0.035, "square", 0.012); },
    hover: function () { blip(540, 0.06, "sine", 0.025); },
    open: function () { blip(340, 0.09, "sine", 0.035); blip(510, 0.09, "sine", 0.03, 0.06); },
    chime: function () {
      blip(659, 0.22, "sine", 0.05);
      blip(988, 0.34, "sine", 0.04, 0.1);
      blip(1319, 0.42, "sine", 0.028, 0.2);
    }
  };
})();
