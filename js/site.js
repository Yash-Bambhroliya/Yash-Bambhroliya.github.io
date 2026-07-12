/* yashb.me v3 "Training Run" · GSAP + Lenis orchestration. */

(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.add("js");

  var saved = null, savedTemp = null;
  try {
    saved = localStorage.getItem("theme");
    savedTemp = localStorage.getItem("temp");
  } catch (e) {}
  if (saved === "dark" || saved === "light") root.setAttribute("data-theme", saved);

  function currentTheme() {
    return root.getAttribute("data-theme") || "dark";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var body = document.body;
    var hasGsap = typeof gsap !== "undefined";
    if (hasGsap) {
      gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);
      if (typeof Flip !== "undefined") gsap.registerPlugin(Flip);
    }

    if (savedTemp === "0.0" || savedTemp === "0.7" || savedTemp === "1.0") {
      body.setAttribute("data-temp", savedTemp);
    }

    var prefersReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var temp = body.getAttribute("data-temp") || "0.7";
    var reduced = prefersReduce || temp === "0.0" || !hasGsap;
    var fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    var isHome = body.getAttribute("data-page") === "home";
    var lenis = null;

    /* ---------- helpers ---------- */

    function revealAll() {
      document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
    }

    function esc(s) {
      return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    /* ---------- theme toggle ---------- */

    var toggle = document.querySelector(".theme-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var next = currentTheme() === "dark" ? "light" : "dark";
        root.setAttribute("data-theme", next);
        try { localStorage.setItem("theme", next); } catch (e) {}
      });
    }

    /* ---------- temperature control ---------- */

    var TEMPS = ["0.0", "0.7", "1.0"];
    var tempCtl = document.querySelector("[data-temp-ctl]");
    var tempVal = document.querySelector("[data-temp-val]");

    function setTemp(v, announce) {
      body.setAttribute("data-temp", v);
      try { localStorage.setItem("temp", v); } catch (e) {}
      if (tempVal) tempVal.textContent = v;
      if (hasGsap) gsap.globalTimeline.timeScale(v === "1.0" ? 1.2 : 1);
      if (v === "0.0") revealAll();
      /* the slider is real: it sets the sampling temperature of the model
         training in this tab */
      if (window.TRAINER && TRAINER.ready()) {
        TRAINER.setTemp(parseFloat(v));
        if (v === "0.0") TRAINER.stop();
      }
      if (announce && termPrint) {
        termPrint("temperature set to " + v + (v === "0.0" ? " (calm: motion off, training stopped)" : v === "1.0" ? " (spicy)" : " (default)"), "t-good");
      }
    }
    if (tempVal) tempVal.textContent = body.getAttribute("data-temp") || "0.7";
    if (hasGsap && body.getAttribute("data-temp") === "1.0") gsap.globalTimeline.timeScale(1.2);

    if (tempCtl) {
      tempCtl.addEventListener("click", function () {
        var cur = body.getAttribute("data-temp") || "0.7";
        var next = TEMPS[(TEMPS.indexOf(cur) + 1) % TEMPS.length];
        setTemp(next, false);
      });
    }

    /* ---------- clock ---------- */

    var clocks = document.querySelectorAll("[data-clock]");
    if (clocks.length) {
      var fmt = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
        hour12: false, timeZone: "Asia/Kolkata"
      });
      var tickClock = function () {
        var t = "IST " + fmt.format(new Date());
        clocks.forEach(function (c) { c.textContent = t; });
      };
      tickClock();
      setInterval(tickClock, 1000);
    }

    /* ---------- smooth scroll ---------- */

    if (!reduced && typeof Lenis !== "undefined") {
      lenis = new Lenis({ autoRaf: false, lerp: 0.12 });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
      document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener("click", function (e) {
          var target = document.querySelector(a.getAttribute("href"));
          if (target) { e.preventDefault(); lenis.scrollTo(target, { offset: -56 }); }
        });
      });
    }

    /* ---------- altitude: the world warms as you descend ----------
       The journey value drives color temperature through dusk: cold blue at
       the rim, violet and rose on the slope, amber at the basin. Applied to
       the accent family only, in oklch, per theme, with a scroll throttle. */

    var ALT = (function () {
      var last = -1;
      var shownJ = 0;
      var okl = typeof CSS !== "undefined" && CSS.supports && CSS.supports("color", "oklch(0.7 0.1 200)");
      var bezelAlt = document.querySelector("[data-bezel-alt]");
      var heroAlt = document.querySelector("[data-hm-alt]");

      /* dusk path: hue climbs through magenta so blue arrives at amber */
      var ENDS = {
        dark: { cold: [0.72, 0.13, 250], warm: [0.79, 0.12, 425] },
        light: { cold: [0.52, 0.14, 255], warm: [0.57, 0.12, 420] }
      };

      function stageWord(j) {
        if (j < 0.04) return "the rim";
        if (j > 0.96) return "the minimum";
        return "descending";
      }

      function apply(j) {
        var w = j * j * (3 - 2 * j);
        if (okl) {
          var m = (root.getAttribute("data-theme") || "dark") === "light" ? ENDS.light : ENDS.dark;
          var L = m.cold[0] + (m.warm[0] - m.cold[0]) * w;
          var C = m.cold[1] + (m.warm[1] - m.cold[1]) * w;
          var H = m.cold[2] + (m.warm[2] - m.cold[2]) * w;
          var st = root.style;
          st.setProperty("--accent", "oklch(" + L.toFixed(3) + " " + C.toFixed(3) + " " + H.toFixed(1) + ")");
          st.setProperty("--accent-deep", "oklch(" + Math.min(0.92, L + 0.08).toFixed(3) + " " + Math.max(0.05, C - 0.02).toFixed(3) + " " + H.toFixed(1) + ")");
          st.setProperty("--glow", "oklch(" + L.toFixed(3) + " " + C.toFixed(3) + " " + H.toFixed(1) + " / 0.35)");
          st.setProperty("--accent-wash", "oklch(" + L.toFixed(3) + " " + C.toFixed(3) + " " + H.toFixed(1) + " / 0.1)");
          if (window.SCENE && window.SCENE.supported) window.SCENE.refreshColors();
        }
        var altTxt = (1 - j).toFixed(2);
        if (bezelAlt) { bezelAlt.hidden = false; bezelAlt.textContent = "alt " + altTxt + " · " + stageWord(j); }
        if (heroAlt) heroAlt.textContent = "alt " + altTxt;
      }

      return {
        set: function (j) {
          shownJ = j;
          if (Math.abs(j - last) < 0.012 && j !== 0 && j !== 1) return;
          last = j;
          apply(j);
        },
        refresh: function () { last = -1; this.set(shownJ); }
      };
    })();

    /* theme flips re-derive the altitude colors for the new palette */
    new MutationObserver(function () { ALT.refresh(); })
      .observe(root, { attributes: true, attributeFilter: ["data-theme"] });

    /* ---------- v4: the 3D layer (loss-landscape terrain + net fly-through) ---------- */

    var sceneCanvas = document.querySelector("[data-scene]");
    var scenePromise = (function () {
      if (!isHome || reduced || !sceneCanvas || !window.SCENE || !window.SCENE.supported) {
        return Promise.resolve(false);
      }
      return window.SCENE.init({ canvas: sceneCanvas, dims: { hidden: 128, vocab: 79 } }).then(function (ok) {
        if (!ok) return false;
        body.classList.add("scene-on");
        sceneCanvas.classList.add("live");
        if (fine) {
          window.addEventListener("pointermove", function (e) {
            window.SCENE.setPointer(e.clientX, e.clientY, true);
          });
          document.documentElement.addEventListener("pointerleave", function () {
            window.SCENE.setPointer(0, 0, false);
          });
        }
        /* the continuous descent: the whole page is one walk down the valley.
           Sections are stations at elevations; the camera rests while you
           read and travels between sections. The ball is the model on the
           same path, so you can look up and see how far it has learned. */
        if (typeof ScrollTrigger !== "undefined") {
          var STATIONS = [
            { sel: ".hero", t: 0 },
            { sel: "[data-learn]", t: 0.16, spacer: true },
            { sel: "#work", t: 0.42 },
            { sel: "#experience", t: 0.62, lookBack: true },
            { sel: ".skills", t: 0.8 },
            { sel: "#contact", t: 1 }
          ];
          var anchors = [];
          var measureStations = function () {
            anchors = [];
            var vh = window.innerHeight;
            STATIONS.forEach(function (st) {
              var el = document.querySelector(st.sel);
              if (!el) return;
              var target = st.spacer ? (el.closest(".pin-spacer") || el) : el;
              var r = target.getBoundingClientRect();
              if (!r.height) return; /* hidden sections join once they exist */
              var top = r.top + window.scrollY, bottom = r.bottom + window.scrollY;
              var a = top - vh * 0.7;
              var b = Math.max(a + 1, bottom - vh * 0.85);
              anchors.push({ a: a, b: b, t: st.t, lookBack: !!st.lookBack });
            });
            anchors.sort(function (x, y) { return x.a - y.a; });
          };
          var ssm = function (v) { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };
          var journeyAt = function (y) {
            if (!anchors.length) return { j: 0, lb: 0 };
            if (y <= anchors[0].b) {
              var lb0 = anchors[0].lookBack ? Math.sin(Math.PI * ssm((y - anchors[0].a) / (anchors[0].b - anchors[0].a))) : 0;
              return { j: anchors[0].t, lb: lb0 };
            }
            for (var i = 0; i < anchors.length - 1; i++) {
              var cur = anchors[i], nxt = anchors[i + 1];
              if (y <= nxt.a) {
                /* traveling between stations */
                var p = ssm((y - cur.b) / Math.max(1, nxt.a - cur.b));
                return { j: cur.t + (nxt.t - cur.t) * p, lb: 0 };
              }
              if (y <= nxt.b) {
                /* resting at a station */
                var local = ssm((y - nxt.a) / Math.max(1, nxt.b - nxt.a));
                return { j: nxt.t, lb: nxt.lookBack ? Math.sin(Math.PI * local) * 0.85 : 0 };
              }
            }
            return { j: anchors[anchors.length - 1].t, lb: 0 };
          };
          ScrollTrigger.addEventListener("refresh", measureStations);
          measureStations();
          ScrollTrigger.create({
            start: 0, end: "max",
            onUpdate: function () {
              var r = journeyAt(window.scrollY);
              window.SCENE.setJourney(r.j, r.lb);
              ALT.set(r.j);
            }
          });
          var r0 = journeyAt(window.scrollY);
          window.SCENE.setJourney(r0.j, r0.lb);
          ALT.set(r0.j);
        }
        /* the network scene is opt-in now (terminal: model), never a wall
           between a recruiter and the work */
        if (window.TRAINER) {
          var applyDims = function () {
            var st = TRAINER.state();
            var hidden = st.tier === "A" ? 128 : st.tier === "B" ? 96 : 64;
            window.SCENE.setDims({ hidden: hidden, vocab: st.vocab });
          };
          TRAINER.ready() ? applyDims() : TRAINER.on("ready", applyDims);
        }
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
          setTimeout(function () { window.SCENE.refreshColors(); }, 50);
        });
        var pEl = document.querySelector("[data-ev-particles]");
        if (pEl) {
          setInterval(function () {
            var st = window.SCENE.stats();
            pEl.textContent = st.verts.toLocaleString("en-US") + " vertices · " + st.mode;
          }, 1500);
        }
        return true;
      });
    })();

    /* ---------- boot the in-tab trainer (decides its own eligibility) ---------- */

    if (isHome && window.TRAINER) TRAINER.boot();

    /* ---------- preloader: training run ---------- */

    var pre = document.querySelector(".preloader");
    var seen = false;
    try { seen = sessionStorage.getItem("run") === "done"; } catch (e) {}

    /* one decision per page load: this session's telemetry is either fully
       real (worker training) or fully the v3 canned sequence. Never mixed. */
    var realPath = false;
    var convMax = 0;

    function driveConverge(value, ms) {
      /* hysteresis: the assembled name never disassembles */
      if (value <= convMax) return;
      convMax = value;
      if (window.SCENE) window.SCENE.setTraining(value);
    }

    /* the ball is the model walking the same valley as the reader: warmup
       covers the upper slope, corpus learning the rest, done is the basin */
    if (isHome && window.TRAINER) {
      TRAINER.on("step", function (d) {
        if (!realPath) return;
        if (d.phase === "warmup") {
          if (d.headlineAcc !== undefined) driveConverge(0.12 + 0.38 * d.headlineAcc);
        } else if (d.corpusLoss) {
          var lp = Math.max(0, Math.min(1, (4.45 - d.corpusLoss) / 2.45));
          driveConverge(0.5 + 0.5 * lp);
        }
      });
      TRAINER.on("done", function () { if (realPath) driveConverge(1); });
    }

    function endPreloader(instant) {
      if (!pre || pre.classList.contains("done")) return;
      try { sessionStorage.setItem("run", "done"); } catch (e) {}
      if (!realPath) {
        scenePromise.then(function (ok) {
          if (ok) driveConverge(1);
        });
      }
      if (instant || reduced) {
        pre.classList.add("done");
        heroIntro();
        return;
      }
      gsap.to(pre, {
        yPercent: -100, duration: 0.55, ease: "power4.inOut",
        onComplete: function () { pre.classList.add("done"); }
      });
      heroIntro();
    }

    function runPreloader() {
      if (!pre) return heroIntro();
      var rows = pre.querySelectorAll(".row");
      setTimeout(function () { endPreloader(true); }, 12000);
      if (reduced || seen) {
        rows.forEach(function (r) { if (!r.hasAttribute("data-sample-row")) r.classList.add("on"); });
        setTimeout(function () { endPreloader(reduced); }, reduced ? 0 : 300);
        /* repeat view this session: no training theater, but a fresh model
           still trains quietly so the instruments stay real */
        if (!reduced && isHome && window.TRAINER) {
          var seenStart = function () {
            if (!TRAINER.restored()) {
              /* fresh model in the background: the ball travels honestly */
              realPath = true;
              TRAINER.start("background");
            } else {
              /* a finished checkpoint has already reached the basin */
              driveConverge(1);
            }
          };
          TRAINER.ready() ? seenStart() : TRAINER.on("ready", seenStart);
        }
        return;
      }
      if (rows.length < 4) {
        rows[0].classList.add("on");
        setTimeout(function () { if (rows[1]) rows[1].classList.add("on"); }, 280);
        setTimeout(function () { endPreloader(false); }, 800);
        return;
      }

      var barEl = pre.querySelector("[data-bar]");
      var lossEl = pre.querySelector("[data-loss]");
      var epochEl = pre.querySelector("[data-epoch]");
      var sampleRow = pre.querySelector("[data-sample-row]");
      var sampleEl = pre.querySelector("[data-sample]");
      var convergedLabel = pre.querySelector("[data-converged-label]");
      var CELLS = 24;
      var chosen = false;
      var tl = null;

      rows[0].classList.add("on");

      function goFake() {
        if (chosen) return;
        chosen = true;
        var state = { p: 0 };
        tl = gsap.timeline();
        tl.call(function () { rows[1].classList.add("on"); rows[2].classList.add("on"); }, null, 0.1)
          .to(state, {
            p: 1, duration: 1.25, ease: "power2.inOut",
            onUpdate: function () {
              var filled = Math.round(state.p * CELLS);
              if (barEl) barEl.textContent = "█".repeat(filled) + "░".repeat(CELLS - filled);
              if (lossEl) lossEl.textContent = (2.31 * Math.pow(0.012 / 2.31, state.p)).toFixed(3);
              if (epochEl) epochEl.textContent = String(Math.min(3, 1 + Math.floor(state.p * 3)));
              if (window.SCENE && state.p * 0.55 > convMax) { convMax = state.p * 0.55; window.SCENE.setTraining(convMax); }
            }
          }, 0.15)
          .call(function () { rows[rows.length - 1].classList.add("on"); }, null, 1.55)
          .call(function () { endPreloader(false); }, null, 1.95);
      }

      function startWhenReady(mode) {
        if (TRAINER.ready()) { TRAINER.start(mode); return; }
        var off = TRAINER.on("ready", function () { off(); TRAINER.start(mode); });
      }

      function goReal() {
        if (chosen) return;
        chosen = true;
        realPath = true;
        var capMs = 9000;
        rows[1].firstChild.nodeValue = "training gru ";
        rows[1].classList.add("on");
        rows[2].classList.add("on");
        var preNote = pre.querySelector("[data-pre-note]");
        if (preNote) preNote.hidden = false;
        if (sampleRow) { sampleRow.hidden = false; sampleRow.classList.add("on"); }
        if (convergedLabel) convergedLabel.textContent = "name learned · rendering site";
        var t0 = performance.now();
        var exited = false;
        var lockedAt = 0;
        var labeled = false;

        function maybeExit(acc) {
          if (exited) return;
          var elapsed = performance.now() - t0;
          if (acc >= 0.85 && !lockedAt) lockedAt = elapsed;
          if ((lockedAt && elapsed - lockedAt > 500) || elapsed > capMs) {
            exited = true;
            rows[rows.length - 1].classList.add("on");
            /* fresh models keep learning in the background; a restored
               checkpoint has done its time (resume with: train more) */
            TRAINER.restored() ? TRAINER.stop() : TRAINER.setMode("background");
            setTimeout(function () { endPreloader(false); }, 350);
          }
        }

        TRAINER.on("step", function (d) {
          if (!labeled) {
            labeled = true;
            capMs = TRAINER.state().tier === "C" ? 7000 : 9000;
            rows[1].firstChild.nodeValue = (TRAINER.restored() ? "resuming checkpoint gru-" : "training gru-") + Math.round(TRAINER.state().params / 1000) + "k ";
          }
          /* preloader telemetry (keeps running post-reveal for widget/footer) */
          if (!exited) {
            var p = d.phase === "warmup" ? Math.min(1, (d.headlineAcc || 0) / 0.92) : 1;
            var filled = Math.round(p * CELLS);
            if (barEl) barEl.textContent = "█".repeat(filled) + "░".repeat(CELLS - filled);
            if (lossEl) lossEl.textContent = d.emaLoss === null ? "measuring" : d.emaLoss.toFixed(3);
            if (epochEl) epochEl.textContent = String(d.epoch);
            if (sampleEl && d.headlineSample) renderMorphInto(sampleEl, d.headlineSample);
          }
          if (d.headlineAcc !== undefined) maybeExit(d.headlineAcc);
        });
        startWhenReady("preloader");
        setTimeout(function () { maybeExit(0); }, capMs + 3500);
      }

      var deciding = isHome && window.TRAINER && !reduced;
      if (deciding) {
        var deadline = setTimeout(goFake, 2800);
        TRAINER.on("ready", function () {
          clearTimeout(deadline);
          if (chosen && !realPath) {
            /* the canned preloader won the race; train quietly anyway so the
               loss widget, footer, and terminal still carry real telemetry */
            TRAINER.start("background");
            return;
          }
          goReal();
        });
        TRAINER.on("decided", function (s) {
          /* also fires if the worker dies after a hopeful start */
          if (!s.eligible) { clearTimeout(deadline); realPath ? endPreloader(false) : goFake(); }
        });
        if (TRAINER.decided()) {
          clearTimeout(deadline);
          TRAINER.eligible() ? (TRAINER.restored() ? goRestored() : goReal()) : goFake();
        }
      } else {
        goFake();
      }

      var skip = pre.querySelector("[data-skip]");
      if (skip) skip.addEventListener("click", function () { if (tl) tl.kill(); realPath && TRAINER.setMode("background"); endPreloader(false); });
      document.addEventListener("keydown", function onEsc(e) {
        if (e.key === "Escape" && !pre.classList.contains("done")) { if (tl) tl.kill(); realPath && TRAINER.setMode("background"); endPreloader(false); }
        else if (pre.classList.contains("done")) document.removeEventListener("keydown", onEsc);
      });
    }

    /* per-character morph: sampled chars render dim until they match the
       target, matched chars lock at full ink */
    var HERO_TARGET = "Yash Bambhroliya";
    function renderMorphInto(el, sampled) {
      var html = "";
      for (var i = 0; i < HERO_TARGET.length; i++) {
        var t = HERO_TARGET[i], s = sampled[i] || " ";
        if (s === t) {
          html += '<span class="tok-lock">' + (t === " " ? "&nbsp;" : esc(t)) + "</span>";
        } else {
          html += '<span class="tok-miss">' + (s === " " || s === "\n" ? "&nbsp;" : esc(s)) + "</span>";
        }
      }
      el.innerHTML = html;
    }

    /* ---------- hero intro: token sampling ---------- */

    var heroDone = false;
    function heroIntro() {
      if (heroDone) return;
      heroDone = true;
      var typeEls = document.querySelectorAll("[data-type]");
      var stream = document.querySelector("[data-stream]");
      var role = document.querySelector(".hero .role");
      var links = document.querySelector(".hero-links");
      if (reduced || !typeEls.length) return;
      document.fonts.ready.then(function () { runHeroIntro(typeEls, stream, role, links); });
    }

    function runHeroIntro(typeEls, stream, role, links) {
      try {
        var tl = gsap.timeline();
        gsap.set([role, links], { opacity: 0 });
        var at = 0;
        /* when the particle field renders the name, the DOM h1 stays hidden */
        if (true) { /* the h1 is always crisp DOM type now */
          if (realPath && window.TRAINER && TRAINER.ready()) {
            /* model-driven morph: h1 chars show live samples until they lock */
            bindHeroMorph(typeEls);
            at = 0.9;
          } else {
            typeEls.forEach(function (el) {
              var split = new SplitText(el, { type: "chars" });
              gsap.set(split.chars, { visibility: "hidden" });
              split.chars.forEach(function (c) {
                tl.set(c, { visibility: "visible" }, at);
                at += 0.028 + Math.random() * 0.03;
              });
              at += 0.12;
            });
          }
        } else {
          at = 0.9;
        }
        tl.to(role, { opacity: 1, duration: 0.4 }, at * 0.35);
        if (stream) {
          var words = new SplitText(stream, { type: "words" });
          gsap.set(words.words, { visibility: "hidden" });
          var wAt = at + 0.1;
          words.words.forEach(function (w) {
            tl.set(w, { visibility: "visible" }, wAt);
            wAt += 0.022;
          });
          tl.to(links, { opacity: 1, duration: 0.5 }, wAt);
        } else {
          tl.to(links, { opacity: 1, duration: 0.5 }, at + 0.2);
        }
      } catch (e) {
        gsap.set([role, links], { opacity: 1 });
      }
    }

    /* h1 as a live sampling surface: each char span shows the model's sampled
       char (dim) until it matches the target, then locks. Two lines map onto
       "Yash" (0-3) and "Bambhroliya" (5-15) of the headline string. */
    function bindHeroMorph(typeEls) {
      var spans = [];
      var offsets = [0, 5];
      typeEls.forEach(function (el, li) {
        var text = el.textContent;
        var html = "";
        for (var i = 0; i < text.length; i++) html += '<span class="tok-miss">' + esc(text[i]) + "</span>";
        el.innerHTML = html;
        Array.prototype.forEach.call(el.children, function (span, ci) {
          spans.push({ span: span, target: text[ci], pos: offsets[li] + ci, locked: false });
        });
      });
      var allLocked = false;
      var off = TRAINER.on("step", function (d) {
        if (allLocked || !d.headlineSample) return;
        var remaining = 0;
        spans.forEach(function (s) {
          if (s.locked) return;
          var sampled = d.headlineSample[s.pos] || " ";
          if (sampled === s.target) {
            s.locked = true;
            s.span.className = "tok-lock";
            s.span.textContent = s.target;
          } else {
            s.span.textContent = sampled === " " || sampled === "\n" ? " " : sampled;
            remaining++;
          }
        });
        if (remaining === 0) { allLocked = true; off(); }
      });
      /* whatever is not locked in 20s locks anyway; the page is not a hostage */
      setTimeout(function () {
        if (allLocked) return;
        allLocked = true;
        off();
        spans.forEach(function (s) { s.span.className = "tok-lock"; s.span.textContent = s.target; });
      }, 20000);
    }

    runPreloader();

    /* the hero spec plate: real model identity once the trainer reports in */
    (function () {
      var hm = document.querySelector("[data-hm-model]");
      if (!hm || !window.TRAINER) return;
      var fill = function () {
        if (!TRAINER.eligible()) { hm.textContent = "model off this visit"; return; }
        var st = TRAINER.state();
        hm.textContent = "tier " + st.tier + " · gru-" + Math.round(st.params / 1000) + "k · " + st.vocab + " chars";
      };
      TRAINER.ready() ? fill() : TRAINER.on("decided", fill);
    })();

    /* the plain-words line under the hero: only when something real runs */
    (function () {
      var note = document.querySelector("[data-live-note]");
      if (!note || !window.TRAINER) return;
      var showNote = function () {
        if (!TRAINER.eligible()) return;
        setTimeout(function () { note.hidden = false; }, 2500);
      };
      TRAINER.ready() ? showNote() : TRAINER.on("ready", showNote);
    })();

    /* ---------- watch it learn: the training run, replayed by scroll ----------
       The section owns its final layout from first paint (placeholders, then
       data), because inserting 2300px of pin space after load shifts the page
       under the reader and breaks hash landings. Three honest sources, never
       blended and always labeled: live, your earlier run, or a recording. */

    (function () {
      var section = document.querySelector("[data-learn]");
      if (!section) return;
      if (!isHome) return;
      var el = {
        sub: section.querySelector("[data-learn-sub]"),
        badge: section.querySelector("[data-learn-badge]"),
        step: section.querySelector("[data-learn-step]"),
        clock: section.querySelector("[data-learn-clock]"),
        loss: section.querySelector("[data-learn-loss]"),
        sample: section.querySelector("[data-learn-sample]"),
        stage: section.querySelector("[data-learn-stagelabel]"),
        name: section.querySelector("[data-learn-name]"),
        endnote: section.querySelector("[data-learn-endnote]"),
        dot: section.querySelector("[data-learn-dot]")
      };

      function stageLabel(s) {
        if (s.phase === "warmup") {
          if ((s.acc || 0) < 0.2) return "pure noise";
          if ((s.acc || 0) < 0.75) return "letters are forming";
          return "it can spell my name";
        }
        if (s.loss === null || s.loss > 3.1) return "now reading everything I wrote";
        if (s.loss > 2.65) return "real words are appearing";
        return "writing in my voice";
      }

      var nameSpans = [];
      (function buildName() {
        var html = "";
        for (var i = 0; i < HERO_TARGET.length; i++) {
          html += "<span>" + (HERO_TARGET[i] === " " ? "&nbsp;" : esc(HERO_TARGET[i])) + "</span>";
        }
        el.name.innerHTML = html;
        nameSpans = Array.prototype.slice.call(el.name.children);
      })();

      function renderSnap(s) {
        el.step.textContent = "step " + s.step.toLocaleString("en-US");
        el.clock.textContent = (s.ms / 1000).toFixed(1) + "s of cpu";
        el.loss.textContent = s.loss === null ? "measuring loss" : (s.phase === "warmup" ? "name loss " : "loss ") + s.loss.toFixed(3);
        var txt = (s.sample || "").replace(/\s+/g, " ");
        /* the seed is a fixed prompt, shown dim; everything after it is output */
        el.sample.innerHTML = (s.seed ? '<span class="learn-seed">' + esc(s.seed) + "</span>" : "") + esc(s.seed ? txt.replace(/^\s+/, "") : txt.trim());
        el.stage.textContent = stageLabel(s);
        var nm = s.name || "";
        for (var i = 0; i < nameSpans.length; i++) {
          var t = HERO_TARGET[i], g = nm[i] || " ";
          if (g === t) {
            nameSpans[i].className = "on";
            nameSpans[i].innerHTML = t === " " ? "&nbsp;" : esc(t);
          } else {
            nameSpans[i].className = "";
            nameSpans[i].innerHTML = g === " " || g === "\n" ? "&nbsp;" : esc(g);
          }
        }
      }

      var getSnaps = function () { return []; };
      var kind = null;
      var doneMs = 0;
      var lastP = 0;
      var pinned = false;

      function setBadge() {
        if (kind === null) { el.badge.textContent = "waking"; return; }
        if (kind === "recorded") { el.badge.textContent = "recorded run"; return; }
        if (kind === "restored") { el.badge.textContent = "your earlier run"; return; }
        if (doneMs) { el.badge.textContent = "trained in " + Math.round(doneMs / 1000) + "s"; el.badge.classList.remove("pulse"); }
        else { el.badge.textContent = "live now"; el.badge.classList.add("pulse"); }
      }

      function endnote(last) {
        var secs = Math.max(1, Math.round(last.ms / 1000));
        return kind === "recorded"
          ? "from random noise to my name in " + secs + "s of cpu. recorded from a real run of this exact network."
          : "from random noise to my name in " + secs + "s of cpu, right here in your browser. nothing prerendered, nothing sent anywhere.";
      }

      function renderAtP(p) {
        lastP = p;
        var snaps = getSnaps();
        var n = snaps.length;
        if (el.dot) el.dot.style.left = (p * 100).toFixed(2) + "%";
        if (!n) return;
        var t = Math.min(1, p / 0.9);
        renderSnap(snaps[Math.min(n - 1, Math.round(t * (n - 1)))]);
        var done = p > 0.93;
        section.classList.toggle("learn-done", done);
        if (done) el.endnote.textContent = endnote(snaps[n - 1]);
      }

      /* the pin exists from first paint so the page never shifts later */
      if (!reduced && hasGsap && typeof ScrollTrigger !== "undefined") {
        pinned = true;
        ScrollTrigger.create({
          trigger: section, start: "top top", end: "+=240%",
          pin: true, scrub: 0.35,
          onUpdate: function (self) { renderAtP(self.progress); }
        });
        ScrollTrigger.refresh();
        /* a hash landing must anchor against the final layout, pin included */
        if (location.hash && location.hash.length > 1) {
          var tgt = null;
          try { tgt = document.querySelector(location.hash); } catch (e) {}
          if (tgt) {
            var y = tgt.getBoundingClientRect().top + window.scrollY - 56;
            if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
            else window.scrollTo(0, y);
            ScrollTrigger.update();
          }
        }
      }

      function bindSource(getter, k) {
        getSnaps = getter;
        kind = k;
        if (k === "restored" && el.sub) {
          el.sub.textContent = "A network trained on your device during an earlier visit and saved in your browser. This is its training run, replayed.";
        } else if (k === "recorded" && el.sub) {
          el.sub.textContent = "Your browser skipped live training this visit, so this is a recording of the same network learning from scratch, step by step.";
        }
        if (k === "live" && window.TRAINER) {
          var st = TRAINER.state();
          doneMs = st.doneInfo ? (st.doneInfo.trainedMs || 1) : 0;
          TRAINER.on("done", function (d) { doneMs = d.trainedMs || 1; setBadge(); });
          /* while the model is still training, fresh moments join the replay */
          TRAINER.on("snap", function () { renderAtP(lastP); });
        }
        setBadge();
        if (!pinned) { renderAtP(1); return; }
        renderAtP(lastP);
        ScrollTrigger.refresh();
      }

      function fail() {
        /* no data will ever arrive: fold the section away cleanly */
        if (typeof ScrollTrigger !== "undefined") {
          ScrollTrigger.getAll().forEach(function (t) { if (t.trigger === section) t.kill(true); });
        }
        var spacer = section.closest(".pin-spacer");
        (spacer || section).remove();
        if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
      }

      function useRecording() {
        fetch("/data/replay.json").then(function (r) {
          if (!r.ok) throw new Error("replay " + r.status);
          return r.json();
        }).then(function (j) {
          if (!j || !j.snaps || j.snaps.length < 6) { fail(); return; }
          bindSource(function () { return j.snaps; }, "recorded");
        }).catch(fail);
      }

      var settled = false;
      function decide() {
        if (settled) return;
        settled = true;
        if (TRAINER.eligible() && TRAINER.ready()) {
          if (TRAINER.restored() && TRAINER.history().length < 6) { useRecording(); return; }
          bindSource(function () { return TRAINER.history(); }, TRAINER.restored() ? "restored" : "live");
        } else {
          useRecording();
        }
      }

      if (window.TRAINER) {
        /* decided() flips before the worker boots; only ready() or a firm
           ineligible verdict settles which source this page gets */
        if (TRAINER.ready() || (TRAINER.decided() && !TRAINER.eligible())) {
          decide();
        } else {
          TRAINER.on("ready", decide);
          TRAINER.on("decided", function (s) { if (!s.eligible) decide(); });
        }
      } else {
        useRecording();
      }
    })();

    /* ---------- logprob tooltips ---------- */

    var lps = document.querySelectorAll(".lp");
    if (lps.length && fine) {
      var lpTip = document.createElement("div");
      lpTip.className = "lp-tip";
      document.body.appendChild(lpTip);
      lps.forEach(function (el) {
        el.addEventListener("mouseenter", function () {
          var alts;
          try { alts = JSON.parse(el.getAttribute("data-alts")); } catch (e) { return; }
          lpTip.innerHTML = "top-k for this token\n" + alts.map(function (a) {
            var bar = "█".repeat(Math.max(1, Math.round(a[1] * 12)));
            return esc(String(a[0]).padEnd(14).slice(0, 14)) + ' <span class="p-bar">' + bar + "</span> " + a[1].toFixed(2);
          }).join("\n");
          lpTip.classList.add("show");
        });
        el.addEventListener("mousemove", function (e) {
          var w = lpTip.offsetWidth, h = lpTip.offsetHeight;
          lpTip.style.left = Math.min(e.clientX + 14, window.innerWidth - w - 8) + "px";
          lpTip.style.top = (e.clientY - h - 14 < 8 ? e.clientY + 16 : e.clientY - h - 14) + "px";
        });
        el.addEventListener("mouseleave", function () { lpTip.classList.remove("show"); });
      });
    }

    /* ---------- scroll reveals ---------- */

    var items = document.querySelectorAll(".reveal");
    if (reduced || !("IntersectionObserver" in window)) {
      revealAll();
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { entry.target.classList.add("in"); io.unobserve(entry.target); }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -5% 0px" });
      items.forEach(function (el) { io.observe(el); });
    }

    /* masked line rise on section headings: flat, type never bends */
    if (!reduced) {
      document.fonts.ready.then(function () {
        document.querySelectorAll("[data-h2]").forEach(function (h) {
          try {
            var sp = new SplitText(h, { type: "lines", mask: "lines" });
            gsap.from(sp.lines, {
              yPercent: 110,
              duration: 0.9, ease: "power4.out", stagger: 0.08,
              scrollTrigger: { trigger: h, start: "top 88%", once: true }
            });
          } catch (e) {}
        });
        if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
      });
    }

    /* ---------- depth kit: flat entrances; 3D is reserved for things that
       respond to the pointer, never for scripted text ---------- */

    if (!reduced && hasGsap) {
      gsap.utils.toArray(".work-row, .card, .xp-row, .stat").forEach(function (el) {
        gsap.from(el, {
          y: 26,
          duration: 0.85, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 90%", once: true }
        });
      });

      if (fine) {
        document.querySelectorAll(".card").forEach(function (el) {
          var rx = gsap.quickTo(el, "rotationX", { duration: 0.5, ease: "power3" });
          var ry = gsap.quickTo(el, "rotationY", { duration: 0.5, ease: "power3" });
          var lift = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" });
          el.addEventListener("pointermove", function (e) {
            var r = el.getBoundingClientRect();
            var nx = (e.clientX - r.left) / r.width;
            var ny = (e.clientY - r.top) / r.height;
            rx((0.5 - ny) * 8);
            ry((nx - 0.5) * 8);
            lift(-4);
          });
          el.addEventListener("pointerleave", function () { rx(0); ry(0); lift(0); });
        });
      }
    }

    /* ---------- velocity marquee ---------- */

    var track = document.querySelector("[data-marquee]");
    if (track && !reduced) {
      track.style.animation = "none";
      var loop = gsap.to(track, { xPercent: -50, duration: 30, ease: "none", repeat: -1 });
      var skewTarget = 0;
      if (lenis) {
        lenis.on("scroll", function (e) {
          var v = Math.abs(e.velocity || 0);
          loop.timeScale(1 + Math.min(v / 30, 3.5));
          skewTarget = Math.max(-6, Math.min(6, (e.velocity || 0) / 12));
        });
      }
      var skewNow = 0;
      gsap.ticker.add(function () {
        skewNow += (skewTarget - skewNow) * 0.12;
        skewTarget *= 0.92;
        gsap.set(track, { skewX: skewNow });
      });
    }

    /* ---------- loss-curve scroll progress ---------- */

    var lossWidget = document.querySelector(".loss-widget");
    if (lossWidget) {
      var curve = lossWidget.querySelector("[data-loss-curve]");
      var liveLoss = lossWidget.querySelector("[data-loss-live]");
      var liveEpoch = lossWidget.querySelector("[data-loss-epoch]");
      var lossLabel = lossWidget.querySelector("[data-loss-label]");
      var widgetReal = false;
      var scrollDriver = null;
      if (reduced || !hasGsap) {
        if (liveLoss) liveLoss.textContent = isHome ? "0.012" : "0%";
        if (liveEpoch) liveEpoch.textContent = "3";
      } else {
        var L = curve.getTotalLength();
        curve.style.strokeDasharray = L;
        curve.style.strokeDashoffset = L;
        scrollDriver = ScrollTrigger.create({
          start: 0,
          end: "max",
          onUpdate: function (self) {
            if (widgetReal) return;
            var p = self.progress;
            curve.style.strokeDashoffset = String(L * (1 - p));
            if (!isHome) {
              /* case pages carry no model, so the instrument tells the
                 truth it can: how far through the page you are */
              if (liveLoss) liveLoss.textContent = Math.round(p * 100) + "%";
              return;
            }
            if (liveLoss) liveLoss.textContent = (2.31 * Math.pow(0.012 / 2.31, p)).toFixed(3);
            if (liveEpoch) liveEpoch.textContent = String(Math.min(3, 1 + Math.floor(p * 3)));
          }
        });
      }

      /* a restored checkpoint that is not retraining still gets a real
         instrument: its recorded history, never the scroll toy */
      if (window.TRAINER && lossLabel && curve) {
        var restoredWidget = function () {
          if (widgetReal || !TRAINER.restored()) return;
          var h = TRAINER.history();
          if (!h.length) return;
          widgetReal = true;
          if (scrollDriver) scrollDriver.kill();
          curve.style.strokeDasharray = "none";
          curve.style.strokeDashoffset = "0";
          var last = h[h.length - 1];
          lossLabel.innerHTML = "trained on your device · step " + last.step +
            ' · loss <span class="loss-val">' + (last.loss === null ? "measuring" : last.loss.toFixed(3)) + "</span>";
          var pts = h.filter(function (s) { return s.loss !== null; });
          if (pts.length > 1) {
            var mx = 0.001;
            pts.forEach(function (s) { if (s.loss > mx) mx = s.loss; });
            var pth = "";
            for (var i = 0; i < pts.length; i++) {
              var x = 2 + (92 * i / (pts.length - 1));
              var y = 3 + 23 * (1 - pts[i].loss / mx);
              pth += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1) + " ";
            }
            curve.setAttribute("d", pth.trim());
          }
        };
        TRAINER.ready() ? restoredWidget() : TRAINER.on("ready", restoredWidget);
      }

      /* when the tab is really training, the widget becomes an instrument:
         the curve is the recorded loss history, not a scroll toy */
      if (window.TRAINER && lossLabel) {
        TRAINER.on("step", function (d) {
          if (!widgetReal) {
            widgetReal = true;
            if (scrollDriver) scrollDriver.kill();
            curve.style.strokeDasharray = "none";
            curve.style.strokeDashoffset = "0";
          }
          var lossTxt = d.emaLoss === null ? "measuring" : d.emaLoss.toFixed(3);
          lossLabel.innerHTML = (d.phase === "warmup" ? "learning my name" : "learning on your device") +
            ' · step ' + d.step + ' · loss <span class="loss-val">' + lossTxt + "</span>";
          if (d.lossHistory && d.lossHistory.length > 1) {
            var hist = d.lossHistory;
            var mx = 0;
            for (var i = 0; i < hist.length; i++) if (hist[i] > mx) mx = hist[i];
            mx = Math.max(mx, 0.001);
            /* high loss plots near the top, so the curve descends as it learns */
            var pth = "";
            for (i = 0; i < hist.length; i++) {
              var x = 2 + (92 * i / (hist.length - 1));
              var y = 3 + 23 * (1 - hist[i] / mx);
              pth += (i === 0 ? "M" : "L") + x.toFixed(1) + " " + y.toFixed(1) + " ";
            }
            curve.setAttribute("d", pth.trim());
          }
        });
      }
    }

    /* ---------- crosshair ---------- */

    var hero = document.querySelector(".hero");
    var xhair = document.querySelector(".xhair");
    if (hero && xhair && fine && !reduced) {
      var hLine = xhair.querySelector(".h");
      var vLine = xhair.querySelector(".v");
      var coords = xhair.querySelector(".coords");
      hero.addEventListener("pointermove", function (e) {
        var r = hero.getBoundingClientRect();
        var x = e.clientX - r.left, y = e.clientY - r.top;
        hLine.style.top = y + "px";
        vLine.style.left = x + "px";
        coords.style.left = x + "px";
        coords.style.top = y + "px";
        coords.textContent = "x " + (x / r.width).toFixed(2) + " · y " + (y / r.height).toFixed(2);
      });
    }

    /* ---------- cursor halo: a trailing ring, native cursor untouched ---------- */

    if (fine && !reduced && hasGsap) {
      var halo = document.createElement("div");
      halo.className = "halo";
      halo.setAttribute("aria-hidden", "true");
      document.body.appendChild(halo);
      var haloX = gsap.quickTo(halo, "x", { duration: 0.42, ease: "power3" });
      var haloY = gsap.quickTo(halo, "y", { duration: 0.42, ease: "power3" });
      var HOT = "a, button, input, textarea, select, [role=button], .lp";
      window.addEventListener("pointermove", function (e) {
        body.classList.add("halo-on");
        haloX(e.clientX);
        haloY(e.clientY);
        halo.classList.toggle("hot", !!(e.target.closest && e.target.closest(HOT)));
      }, { passive: true });
      document.documentElement.addEventListener("pointerleave", function () {
        body.classList.remove("halo-on");
      });
    }

    /* ---------- the house signature: text resolves out of noise ---------- */

    if (!reduced && hasGsap && fine) {
      document.querySelectorAll(".nav-links a, .brand").forEach(function (el) {
        var original = el.textContent;
        el.addEventListener("mouseenter", function () {
          gsap.to(el, {
            duration: 0.5,
            overwrite: "auto",
            scrambleText: { text: original, chars: "reluant", speed: 1.4 }
          });
        });
      });
    }

    /* ---------- magnetic ---------- */

    if (fine && !reduced && hasGsap) {
      document.querySelectorAll(".contact .email, .theme-toggle, .temp-ctl").forEach(function (el) {
        var xTo = gsap.quickTo(el, "x", { duration: 0.35, ease: "power3" });
        var yTo = gsap.quickTo(el, "y", { duration: 0.35, ease: "power3" });
        el.addEventListener("pointermove", function (e) {
          var r = el.getBoundingClientRect();
          xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
          yTo((e.clientY - (r.top + r.height / 2)) * 0.3);
        });
        el.addEventListener("pointerleave", function () { xTo(0); yTo(0); });
      });
    }

    /* ---------- case charts draw themselves as you arrive ---------- */

    if (body.getAttribute("data-page") === "case" && !reduced && hasGsap) {
      document.querySelectorAll(".viz svg, .diagram svg").forEach(function (svg) {
        var trig = { trigger: svg, start: "top 82%", once: true };

        var bars = svg.querySelectorAll(".series-base, .series-ft");
        if (bars.length) {
          gsap.from(bars, {
            scaleY: 0, transformOrigin: "50% 100%",
            duration: 0.9, ease: "power3.out", stagger: 0.07,
            scrollTrigger: trig
          });
        }

        svg.querySelectorAll(".line-path, .flow").forEach(function (p, i) {
          if (!p.getTotalLength) return;
          var len = p.getTotalLength();
          p.style.strokeDasharray = len;
          p.style.strokeDashoffset = len;
          gsap.to(p, {
            strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut", delay: 0.15 + i * 0.12,
            scrollTrigger: trig
          });
        });

        var dots = svg.querySelectorAll(".dot");
        if (dots.length) {
          gsap.from(dots, {
            scale: 0, transformOrigin: "50% 50%",
            duration: 0.5, ease: "back.out(2.2)", stagger: 0.12, delay: 0.25,
            scrollTrigger: trig
          });
        }

        var boxes = svg.querySelectorAll(".box");
        if (boxes.length) {
          gsap.from(boxes, {
            opacity: 0, y: 10, duration: 0.6, ease: "power3.out", stagger: 0.1,
            scrollTrigger: trig
          });
        }

        var labels = svg.querySelectorAll(".direct-label");
        if (labels.length) {
          gsap.from(labels, {
            opacity: 0, y: 6, duration: 0.5, ease: "power3.out", stagger: 0.1, delay: 0.6,
            scrollTrigger: trig
          });
        }
      });
    }

    /* ---------- chart tooltips (case pages) ---------- */

    var tipTargets = document.querySelectorAll("[data-tip]");
    if (tipTargets.length) {
      var tip = document.createElement("div");
      tip.className = "viz-tip";
      tip.setAttribute("role", "status");
      document.body.appendChild(tip);
      var showTip = function (el, x, y) {
        tip.innerHTML = el.getAttribute("data-tip");
        tip.classList.add("show");
        moveTip(x, y);
      };
      var moveTip = function (x, y) {
        var w = tip.offsetWidth, h = tip.offsetHeight;
        tip.style.left = Math.min(x + 14, window.innerWidth - w - 8) + "px";
        tip.style.top = (y - h - 14 < 8 ? y + 14 : y - h - 14) + "px";
      };
      tipTargets.forEach(function (el) {
        el.setAttribute("tabindex", "0");
        el.addEventListener("mouseenter", function (e) { showTip(el, e.clientX, e.clientY); });
        el.addEventListener("mousemove", function (e) { moveTip(e.clientX, e.clientY); });
        el.addEventListener("mouseleave", function () { tip.classList.remove("show"); });
        el.addEventListener("focus", function () {
          var r = el.getBoundingClientRect();
          showTip(el, r.left + r.width / 2, r.top);
        });
        el.addEventListener("blur", function () { tip.classList.remove("show"); });
      });
    }

    /* ---------- terminal ---------- */

    var term = document.querySelector("[data-term]");
    var termOut = document.querySelector("[data-term-out]");
    var termIn = document.querySelector("[data-term-in]");
    var termPrint = null;

    if (term && termOut && termIn) {
      var termOpen = false;
      var greeted = false;

      termPrint = function (text, cls) {
        var div = document.createElement("div");
        if (cls) div.className = cls;
        div.innerHTML = text;
        termOut.appendChild(div);
        termOut.scrollTop = termOut.scrollHeight;
      };

      var openTerm = function () {
        termOpen = true;
        term.classList.add("open");
        if (!greeted) {
          greeted = true;
          termPrint('<span class="t-accent">yash-shell</span> · type <span class="t-good">help</span> to see commands');
        }
        setTimeout(function () { termIn.focus(); }, 320);
      };
      var closeTerm = function () {
        termOpen = false;
        term.classList.remove("open");
        termIn.blur();
      };

      document.addEventListener("keydown", function (e) {
        if ((e.key === "`" || e.key === "~") && document.activeElement !== termIn) {
          e.preventDefault();
          termOpen ? closeTerm() : openTerm();
        } else if (e.key === "Escape" && termOpen) {
          closeTerm();
        }
      });

      var CMDS = {
        help: function () {
          termPrint("commands: <span class='t-good'>about</span> · <span class='t-good'>work</span> · <span class='t-good'>evals</span> · <span class='t-good'>sample</span> · <span class='t-good'>model</span> · <span class='t-good'>train stats|stop|more</span> · <span class='t-good'>fit &lt;paste a job description&gt;</span> · <span class='t-good'>contact</span> · <span class='t-good'>temp 0|0.7|1.0</span> · <span class='t-good'>theme</span> · <span class='t-good'>whoami</span> · <span class='t-good'>sudo hire</span> · <span class='t-good'>clear</span> · <span class='t-good'>exit</span>");
        },
        model: function () {
          if (!window.SCENE || !document.body.classList.contains("scene-on")) {
            termPrint("the 3D layer is off on this visit, nothing to fly through");
            return;
          }
          var st = window.TRAINER && TRAINER.ready() ? TRAINER.state() : null;
          var hidden = st ? (st.tier === "A" ? 128 : st.tier === "B" ? 96 : 64) : 128;
          termPrint("flying through the network on this page: characters in, " + hidden + " recurrent units, " + (st ? st.vocab : 79) + " characters out", "t-accent");
          closeTerm();
          var flight = { p: 0 };
          gsap.to(flight, {
            p: 1, duration: 9, ease: "power1.inOut",
            onUpdate: function () {
              var v = flight.p < 0.85 ? flight.p / 0.85 : 1 - (flight.p - 0.85) / 0.15;
              window.SCENE.setInterlude(Math.max(0, Math.min(1, v)) * 0.999);
            },
            onComplete: function () { window.SCENE.setInterlude(0); }
          });
        },
        fit: function (rest) {
          var panel = document.querySelector("[data-jd-panel]");
          if (!panel) { termPrint("the fit panel lives on the home page"); return; }
          if (rest && rest.length >= 100 && window.runFit) {
            closeTerm();
            panel.classList.add("open");
            panel.scrollIntoView({ behavior: "smooth", block: "center" });
            window.runFit(rest);
            return;
          }
          closeTerm();
          panel.classList.add("open");
          var jdToggle = panel.querySelector("[data-jd-toggle]");
          if (jdToggle) jdToggle.setAttribute("aria-expanded", "true");
          panel.scrollIntoView({ behavior: "smooth", block: "center" });
          var jdInput = panel.querySelector("[data-jd-input]");
          if (jdInput) setTimeout(function () { jdInput.focus(); }, 400);
        },
        sample: function () {
          if (!window.TRAINER || !TRAINER.ready()) {
            termPrint("no model this visit: training was skipped (reduced motion, low memory, or save-data). reload without those and one will train.");
            return;
          }
          var st = TRAINER.stats();
          termPrint('<span class="t-dim">sampling gru-' + Math.round(st.params / 1000) + "k at temp " + (body.getAttribute("data-temp") || "0.7") + " · trained " + Math.round(st.trainedMs / 1000) + "s in your tab</span>");
          TRAINER.sample(200).then(function (text) {
            if (text === null) { termPrint("sampler timed out, try again"); return; }
            termPrint(esc(text).replace(/\n/g, "<br>"), "t-accent");
          });
        },
        train: function (rest) {
          if (!window.TRAINER || !TRAINER.ready()) { termPrint("no trainer this visit"); return; }
          var sub = (rest || "stats").trim();
          if (sub === "stop") { TRAINER.stop(); termPrint("training stopped, weights saved", "t-good"); }
          else if (sub === "more") { TRAINER.resume(); TRAINER.setMode("background"); termPrint("training resumed", "t-good"); }
          else {
            var st = TRAINER.stats();
            termPrint("tier " + st.tier + " · " + st.params.toLocaleString("en-US") + " params · step " + st.step + " · " + st.tokensSeen.toLocaleString("en-US") + " tokens · " + (st.loss ? "corpus loss " + st.loss.toFixed(3) : "measuring loss") + " · " + Math.round(st.trainedMs / 1000) + "s on your CPU" + (st.restored ? " (restored from a previous visit)" : ""));
          }
        },
        about: function () {
          termPrint("AI engineer in Gujarat, India. I fine-tune, quantize, serve, and evaluate LLMs in production. Currently at Nextbase Solutions.");
        },
        work: function () {
          termPrint('01 MathTutor-Qwen3-8B <span class="t-dim">fine-tune + LLM-as-judge eval</span> <a href="/work/mathtutor.html">/work/mathtutor</a>');
          termPrint('02 HGD Memory Engine <span class="t-dim">retrieval benchmark, 40% to 85%</span> <a href="/work/hgd-eval.html">/work/hgd-eval</a>');
          termPrint('03 Rhizome Logic <span class="t-dim">competitive-intelligence agent</span> <a href="/work/rhizome.html">/work/rhizome</a>');
        },
        evals: function () {
          termPrint("<span class='t-dim'>MathTutor FT-2 vs base Qwen3-8B (judge: Claude Sonnet 4, corrected)</span>");
          termPrint("correctness   4.79 &gt; 4.88  <span class='t-good'>+0.09</span>");
          termPrint("pedagogy      4.52 &gt; 4.56  <span class='t-good'>+0.04</span>");
          termPrint("structure     4.80 &gt; 4.86  <span class='t-good'>+0.06</span>");
          termPrint("faithfulness  4.62 &gt; 4.80  <span class='t-good'>+0.18</span>");
          termPrint("refusal (OOD) 3.14 &gt; 4.12  <span class='t-good'>+0.98</span>");
        },
        contact: function () {
          termPrint('email: <a href="mailto:yashbambhroliya1@gmail.com">yashbambhroliya1@gmail.com</a> · github: <a href="https://github.com/Yash-Bambhroliya">Yash-Bambhroliya</a> · hf: <a href="https://huggingface.co/Yash0707">Yash0707</a>');
        },
        whoami: function () { termPrint("recruiter, probably. good instincts."); },
        theme: function () {
          var next = currentTheme() === "dark" ? "light" : "dark";
          root.setAttribute("data-theme", next);
          try { localStorage.setItem("theme", next); } catch (e) {}
          termPrint("theme: " + next, "t-good");
        },
        clear: function () { termOut.innerHTML = ""; },
        exit: function () { closeTerm(); }
      };

      termIn.addEventListener("keydown", function (e) {
        if (e.key !== "Enter") return;
        var raw = termIn.value.trim();
        termIn.value = "";
        if (!raw) return;
        termPrint('<span class="t-dim">$ ' + esc(raw) + "</span>");
        /* only the command word is case-folded; arguments keep their case */
        var firstSpace = raw.search(/\s/);
        var cmd = (firstSpace === -1 ? raw : raw.slice(0, firstSpace)).toLowerCase();
        var rest = firstSpace === -1 ? "" : raw.slice(firstSpace + 1).trim();
        var parts = raw.toLowerCase().split(/\s+/);
        if (cmd === "temp" && parts[1]) {
          var v = parts[1] === "1" ? "1.0" : parts[1] === "0" ? "0.0" : parts[1];
          if (TEMPS.indexOf(v) > -1) { setTemp(v, true); } else { termPrint("usage: temp 0 | 0.7 | 1.0"); }
        } else if (cmd === "sudo" && parts[1] === "hire") {
          termPrint("access granted.", "t-good");
          termPrint("drafting email to yashbambhroliya1@gmail.com ...");
          setTimeout(function () { window.location.href = "mailto:yashbambhroliya1@gmail.com?subject=Let's talk"; }, 700);
        } else if (CMDS[cmd]) {
          CMDS[cmd](rest);
        } else {
          termPrint("command not found: " + esc(cmd) + " · try <span class='t-good'>help</span>");
        }
      });
    }

    /* ---------- footer: the model trained in this tab ---------- */

    var evModel = document.querySelector("[data-ev-model]");
    if (evModel && window.TRAINER) {
      setInterval(function () {
        if (!TRAINER.ready()) return;
        var st = TRAINER.stats();
        if (!st.step && !st.restored) return;
        evModel.textContent = st.params.toLocaleString("en-US") + " params · " +
          (st.loss ? "loss " + st.loss.toFixed(2) + " · " : "") +
          Math.round(st.trainedMs / 1000) + "s of your CPU";
      }, 2000);
    }

    /* ---------- site evals footer ---------- */

    var evWeight = document.querySelector("[data-ev-weight]");
    var evLcp = document.querySelector("[data-ev-lcp]");
    var evReq = document.querySelector("[data-ev-req]");
    if (evWeight && "performance" in window) {
      if ("PerformanceObserver" in window && evLcp) {
        try {
          new PerformanceObserver(function (list) {
            var entries = list.getEntries();
            var last = entries[entries.length - 1];
            if (last) evLcp.textContent = (last.startTime / 1000).toFixed(2) + "s";
          }).observe({ type: "largest-contentful-paint", buffered: true });
        } catch (e) { evLcp.textContent = "n/a"; }
      }
      window.addEventListener("load", function () {
        setTimeout(function () {
          var res = performance.getEntriesByType("resource");
          var nav = performance.getEntriesByType("navigation")[0];
          var size = function (r) { return r.transferSize || r.decodedBodySize || 0; };
          var bytes = (nav ? size(nav) : 0) + res.reduce(function (s, r) { return s + size(r); }, 0);
          evWeight.textContent = (bytes / 1024).toFixed(0) + " KB";
          if (evReq) evReq.textContent = String(res.length + 1);
        }, 500);
      });
    }

    /* ---------- console banner + blur title ---------- */

    try {
      console.log(
        "%cyashb.me%c\n\ntraining complete. loss: 0.012\npress ` on the page for a terminal.\nhiring? yashbambhroliya1@gmail.com",
        "font-size: 24px; font-weight: bold; color: #2a78d6;",
        "font-size: 12px; color: #888;"
      );
    } catch (e) {}

    var origTitle = document.title;
    window.addEventListener("blur", function () { document.title = "paused · yashb.me"; });
    window.addEventListener("focus", function () { document.title = origTitle; });

    /* ---------- #debug instrument panel ---------- */

    if (location.hash === "#debug" && hasGsap) {
      var dbg = document.createElement("div");
      dbg.className = "dbg";
      dbg.innerHTML =
        '<div style="font-weight:600">instrument panel</div>' +
        '<label>fps <span data-fps>60</span></label>' +
        '<label>timeScale <input type="range" min="0.1" max="2" step="0.1" value="1" data-ts></label>' +
        '<label>temp <span data-dbg-temp>' + (body.getAttribute("data-temp")) + "</span></label>" +
        '<label>scrollTriggers <span>' + (typeof ScrollTrigger !== "undefined" ? ScrollTrigger.getAll().length : 0) + "</span></label>";
      document.body.appendChild(dbg);
      var fpsEl = dbg.querySelector("[data-fps]");
      var frames = 0, lastT = performance.now();
      gsap.ticker.add(function () {
        frames++;
        var now = performance.now();
        if (now - lastT >= 1000) {
          fpsEl.textContent = String(frames);
          frames = 0;
          lastT = now;
        }
      });
      dbg.querySelector("[data-ts]").addEventListener("input", function (e) {
        gsap.globalTimeline.timeScale(parseFloat(e.target.value));
      });
      scenePromise.then(function (ok) {
        if (!ok) return;
        var row = document.createElement("label");
        row.innerHTML = 'descent <input type="range" min="0" max="1" step="0.01" value="0" data-cv>';
        dbg.appendChild(row);
        row.querySelector("[data-cv]").addEventListener("input", function (e) {
          window.SCENE.setTraining(parseFloat(e.target.value));
        });
        var irow = document.createElement("label");
        irow.innerHTML = 'interlude <input type="range" min="0" max="1" step="0.01" value="0" data-iv>';
        dbg.appendChild(irow);
        irow.querySelector("[data-iv]").addEventListener("input", function (e) {
          window.SCENE.setInterlude(parseFloat(e.target.value));
        });
      });
      if (window.TRAINER) {
        var trow = document.createElement("label");
        trow.innerHTML = 'trainer <span data-dbg-train>booting</span>';
        dbg.appendChild(trow);
        var tEl = trow.querySelector("[data-dbg-train]");
        var lastStepAt = 0, lastStepNo = 0, stepsPerSec = 0;
        TRAINER.on("decided", function (s) { if (!s.eligible) tEl.textContent = "ineligible"; });
        TRAINER.on("step", function (d) {
          var now = performance.now();
          if (lastStepAt) stepsPerSec = 0.9 * stepsPerSec + 0.1 * (1000 * (d.step - lastStepNo) / (now - lastStepAt));
          lastStepAt = now; lastStepNo = d.step;
          tEl.textContent = d.phase + " s" + d.step + " " + stepsPerSec.toFixed(1) + "/s" +
            (d.headlineAcc !== undefined ? " acc " + Math.round(d.headlineAcc * 100) + "%" : "") +
            (d.emaLoss !== null ? " loss " + d.emaLoss.toFixed(2) : "");
        });
        TRAINER.gradcheck();
        TRAINER.on("gradcheck", function (g) {
          console.log("[debug] gradcheck fails:", g.fails, "of", g.checked, "worst rel:", g.worst);
        });
      }
    }
  });
})();
