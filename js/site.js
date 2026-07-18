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
        if (window.SOUND) SOUND.tick();
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
        if (window.SOUND) SOUND.tick();
      });
    }

    /* ---------- sound: a synthesized kit, strictly opt-in ----------
       The pill lives in the nav on wide screens; the terminal owns it
       everywhere. A saved "on" cannot start audio by itself (autoplay
       policy), so it waits for the first real gesture and wakes silently. */

    var SND = window.SOUND || null;
    var soundCtl = null;

    function soundLabel() {
      if (soundCtl) soundCtl.querySelector(".t-val").textContent = SND && SND.isEnabled() ? "on" : "off";
    }

    function setSound(v) {
      if (!SND) return false;
      SND.setEnabled(v);
      soundLabel();
      if (v) SND.open();
      return SND.isEnabled();
    }

    if (SND) {
      var navLinks = document.querySelector(".nav-links");
      if (navLinks && toggle) {
        soundCtl = document.createElement("button");
        soundCtl.type = "button";
        soundCtl.className = "temp-ctl sound-ctl";
        soundCtl.setAttribute("aria-label", "Toggle interface sound");
        soundCtl.innerHTML = 'sound <span class="t-val">off</span>';
        navLinks.insertBefore(soundCtl, toggle);
        soundCtl.addEventListener("click", function () { setSound(!SND.isEnabled()); });
        soundLabel();
      }
      if (SND.saved()) {
        /* pointerup, not pointerdown: Chrome grants the audio gesture on the
           tail of a tap, so waking on the press start warns and stays mute */
        var wake = function () {
          document.removeEventListener("pointerup", wake);
          document.removeEventListener("keydown", wake);
          if (SND && !SND.isEnabled()) { SND.setEnabled(true); soundLabel(); }
        };
        document.addEventListener("pointerup", wake, { once: true });
        document.addEventListener("keydown", wake, { once: true });
      }
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
      window.__lenis = lenis;
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
        light: { cold: [0.5, 0.16, 30], warm: [0.55, 0.13, 60] }
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
            /* every leg of travel earns a minimum scroll runway, borrowed
               from the reading holds, so adjacent sections never force a
               fifth of the valley into a few hundred pixels of scroll */
            var minTravel = vh * 0.9;
            for (var ai = 0; ai < anchors.length - 1; ai++) {
              var gap = anchors[ai + 1].a - anchors[ai].b;
              var need = minTravel - gap;
              if (need > 0) {
                anchors[ai].b = Math.max(anchors[ai].a + 1, anchors[ai].b - need / 2);
                anchors[ai + 1].a = Math.min(anchors[ai + 1].b - 1, anchors[ai + 1].a + need / 2);
              }
            }
          };
          var ssm = function (v) { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };
          var journeyAt = function (y) {
            if (!anchors.length) return { j: 0, lb: 0 };
            if (y <= anchors[0].b) {
              var lb0 = anchors[0].lookBack ? Math.sin(Math.PI * ssm((y - anchors[0].a) / (anchors[0].b - anchors[0].a))) * 0.35 : 0;
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
                return { j: nxt.t, lb: nxt.lookBack ? Math.sin(Math.PI * local) * 0.35 : 0 };
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
      /* the page assembles out of its own exploded diagram; the assembly IS
         the intro, so the typed hero reveal stands down when it plays */
      if (window.ANATOMY && ANATOMY.arriveEligible && ANATOMY.arriveEligible()) {
        setTimeout(function () { if (!ANATOMY.arrive()) heroIntro(); }, 60);
      } else {
        heroIntro();
      }
    }

    function runPreloader() {
      if (!pre) return heroIntro();
      var rows = pre.querySelectorAll(".row");
      /* last resort only: graceful (false), so even a wedged run slides out
         and still gets the anatomy arrival; goReal's own stall exits win first */
      setTimeout(function () { endPreloader(false); }, 15000);
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
        var gotStep = false;

        function maybeExit(acc, force) {
          if (exited) return;
          var elapsed = performance.now() - t0;
          if (acc >= 0.85 && !lockedAt) lockedAt = elapsed;
          if (force || (lockedAt && elapsed - lockedAt > 500) || elapsed > capMs) {
            exited = true;
            /* the checkmark only claims what actually happened */
            if (convergedLabel && !lockedAt) {
              convergedLabel.textContent = TRAINER.restored()
                ? "checkpoint restored · rendering site"
                : "still learning · rendering site";
            }
            rows[rows.length - 1].classList.add("on");
            /* fresh models keep learning in the background; a restored
               checkpoint has done its time (resume with: train more) */
            TRAINER.restored() ? TRAINER.stop() : TRAINER.setMode("background");
            setTimeout(function () { endPreloader(false); }, 350);
          }
        }

        TRAINER.on("step", function (d) {
          gotStep = true;
          if (!labeled) {
            labeled = true;
            capMs = TRAINER.state().tier === "C" ? 7000 : 9000;
            rows[1].firstChild.nodeValue = (TRAINER.restored() ? "resuming checkpoint gru-" : "training gru-") + Math.round(TRAINER.state().params / 1000) + "k ";
            /* a resumed checkpoint is past its epochs; count steps instead */
            if (TRAINER.restored() && rows[2]) {
              rows[2].childNodes[0].nodeValue = "step ";
              if (rows[2].childNodes[2]) rows[2].childNodes[2].nodeValue = " · loss ";
            }
          }
          /* preloader telemetry (keeps running post-reveal for widget/footer) */
          if (!exited) {
            var p = d.phase === "warmup" ? Math.min(1, (d.headlineAcc || 0) / 0.92) : 1;
            var filled = Math.round(p * CELLS);
            if (barEl) barEl.textContent = "█".repeat(filled) + "░".repeat(CELLS - filled);
            if (lossEl) lossEl.textContent = d.emaLoss === null ? "measuring" : d.emaLoss.toFixed(3);
            if (epochEl) epochEl.textContent = TRAINER.restored() ? (d.step || 0).toLocaleString("en-US") : String(d.epoch);
            if (sampleEl && d.headlineSample) renderMorphInto(sampleEl, d.headlineSample);
          }
          if (d.headlineAcc !== undefined) maybeExit(d.headlineAcc);
        });
        startWhenReady("preloader");
        /* a worker that reported ready but never steps is wedged; nobody
           should watch a frozen bar for it (training keeps trying behind) */
        setTimeout(function () { if (!gotStep) maybeExit(0, true); }, 6000);
        setTimeout(function () { maybeExit(0); }, capMs + 2000);
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
          TRAINER.eligible() ? goReal() : goFake();
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

    /* ---------- meet the model: one set of demos, three doors ----------
       The terminal, the loss-widget dock, and the replay finale all fire
       the same guided runners. say() is an optional line sink so results
       can land in whichever surface launched them. */

    var DEMOS = (function () {
      var capEl = null;
      function capOn(text) {
        if (!capEl) {
          capEl = document.createElement("div");
          capEl.className = "model-cap";
          capEl.setAttribute("aria-hidden", "true");
          document.body.appendChild(capEl);
        }
        if (text === null) { capEl.classList.remove("on"); return; }
        capEl.textContent = text;
        capEl.classList.add("on");
      }

      var busy = false;
      var exitBtn = null;
      function ensureExit() {
        if (exitBtn) return;
        exitBtn = document.createElement("button");
        exitBtn.type = "button";
        exitBtn.className = "demo-exit";
        exitBtn.textContent = "return";
        document.body.appendChild(exitBtn);
      }

      function runDemo(mode, secs, aux, caps, onDone) {
        if (busy || !hasGsap) return;
        busy = true;
        if (window.SOUND) SOUND.open();
        var st = { t: 0 };
        var lastCap = -1;
        var inspecting = false;
        var dragging = false, lastX = 0, lastY = 0;

        /* the curtain: the page steps aside so the stage owns the screen */
        body.classList.add("demo-on");
        ensureExit();
        if (lenis) lenis.stop();

        var tween = null;

        function onWheel(e) {
          e.preventDefault();
          if (inspecting) window.SCENE.inspectZoom(e.deltaY);
        }
        function onDown(e) {
          if (!inspecting) return;
          if (exitBtn && exitBtn.contains(e.target)) return;
          dragging = true;
          lastX = e.clientX; lastY = e.clientY;
        }
        function onMove(e) {
          if (!dragging) return;
          window.SCENE.inspectMove(e.clientX - lastX, e.clientY - lastY);
          lastX = e.clientX; lastY = e.clientY;
        }
        function onUp() { dragging = false; }
        function onKey(e) { if (e.key === "Escape") exit(); }
        function onExitClick() { exit(); }

        window.addEventListener("wheel", onWheel, { passive: false });
        window.addEventListener("pointerdown", onDown);
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        document.addEventListener("keydown", onKey);
        exitBtn.addEventListener("click", onExitClick);

        function exit() {
          if (!busy) return;
          if (tween) tween.kill();
          if (inspecting) window.SCENE.inspectEnd();
          else window.SCENE.demo(null, 1);
          window.removeEventListener("wheel", onWheel);
          window.removeEventListener("pointerdown", onDown);
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          document.removeEventListener("keydown", onKey);
          exitBtn.removeEventListener("click", onExitClick);
          capOn(null);
          body.classList.remove("demo-on");
          if (lenis) lenis.start();
          busy = false;
        }

        function enterInspect() {
          inspecting = true;
          if (window.SOUND) SOUND.tick();
          window.SCENE.inspectStart(mode === "orbitBall" ? "ball" : "net");
          capOn("yours now: drag to look around · scroll to zoom · return or esc to leave");
          if (onDone) onDone();
        }

        tween = gsap.to(st, {
          t: 1, duration: secs, ease: "power1.inOut",
          onUpdate: function () {
            window.SCENE.demo(mode, Math.min(st.t, 0.999), aux);
            for (var i = caps.length - 1; i >= 0; i--) {
              if (st.t >= caps[i][0]) {
                if (lastCap !== i) { lastCap = i; capOn(caps[i][1]); }
                break;
              }
            }
          },
          onComplete: enterInspect
        });
      }

      function sceneOn() { return !!(window.SCENE && document.body.classList.contains("scene-on")); }
      function live() { return !!(window.TRAINER && TRAINER.ready()); }
      function glyph(ch) { return ch === " " ? "space" : ch === "\n" ? "newline" : ch; }

      return {
        sceneOn: sceneOn,
        live: live,
        busy: function () { return busy; },
        a: function (say) {
          if (!sceneOn() || !live()) { if (say) say("the live model or the 3D layer is off this visit"); return; }
          TRAINER.probe("Yas").then(function (d) {
            if (!d) { if (say) say("the model did not answer, try again"); return; }
            runDemo("pass", 11, { inIdx: d.seedIdx || 0, probs: d.probs }, [
              [0.02, "this is the network in your tab"],
              [0.1, "one letter goes in: " + d.seed.slice(-1)],
              [0.3, d.hidden + " units update their memory"],
              [0.56, d.vocab + " scores come out, one per symbol"],
              [0.78, "its guess for the next letter: " + glyph(d.next)]
            ], function () {
              if (say) say('after "' + esc(d.seed) + '" it expects "' + esc(glyph(d.next)) + '" (p=' + d.top[0][1].toFixed(2) + ")", "t-accent");
            });
          });
        },
        b: function (say) {
          if (!sceneOn()) { if (say) say("the 3D layer is off on this visit"); return; }
          var stb = live() ? TRAINER.state() : null;
          var hid = stb ? (stb.tier === "A" ? 128 : stb.tier === "B" ? 96 : 64) : 128;
          runDemo("shot", 9, null, [
            [0.04, "characters in: one cell per symbol it can read"],
            [0.36, "a recurrent block: " + hid + " units of memory"],
            [0.66, "characters out: " + (stb ? stb.vocab : 79) + " scores, one per symbol"]
          ], null);
        },
        c: function (say) {
          if (!sceneOn()) { if (say) say("the 3D layer is off on this visit"); return; }
          var stc = live() ? TRAINER.stats() : null;
          runDemo("orbitBall", 9, null, stc && stc.step ? [
            [0.04, "this is the model, walking the loss downhill"],
            [0.35, "step " + stc.step.toLocaleString("en-US") + (stc.loss ? " · loss " + stc.loss.toFixed(3) : "")],
            [0.68, Math.round(stc.trainedMs / 1000) + "s of your cpu so far"]
          ] : [
            [0.04, "this is the model's marker on the terrain"],
            [0.4, "the lower it sits, the more it has learned"],
            [0.72, "it rests at the bottom when training ends"]
          ], null);
        },
        d: function (say) {
          var std = live() ? TRAINER.stats() : null;
          say("<span class='t-dim'>architecture</span>");
          say("chars in [" + (std ? std.vocab : 79) + "] -> embed [32] -> gru [" + (std ? (std.tier === "A" ? 128 : std.tier === "B" ? 96 : 64) : 128) + "] -> chars out [" + (std ? std.vocab : 79) + "]");
          if (!std) {
            say("no live model this visit; those are the standard dimensions");
            return;
          }
          say(std.params.toLocaleString("en-US") + " params · tier " + std.tier + " · step " + std.step.toLocaleString("en-US") + (std.loss ? " · loss " + std.loss.toFixed(3) : "") + " · " + Math.round(std.trainedMs / 1000) + "s of your cpu");
          TRAINER.probe("Yas").then(function (d) {
            if (!d) return;
            say("<span class='t-dim'>next-char probe after \"Yas\"</span>");
            d.top.forEach(function (t) {
              var bar = "█".repeat(Math.max(1, Math.round(t[1] * 16)));
              say(esc(glyph(t[0])) + "  <span class='p-bar'>" + bar + "</span> " + t[1].toFixed(2));
            });
          });
        }
      };
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

      var lastSnapIdx = -1;
      var wasDone = false;
      function renderAtP(p) {
        lastP = p;
        var snaps = getSnaps();
        var n = snaps.length;
        if (el.dot) el.dot.style.left = (p * 100).toFixed(2) + "%";
        if (!n) return;
        var t = Math.min(1, p / 0.9);
        var idx = Math.min(n - 1, Math.round(t * (n - 1)));
        renderSnap(snaps[idx]);
        /* each training moment is one note, pitched by its loss: scrubbing
           the run downhill plays the model coming into tune */
        if (idx !== lastSnapIdx) {
          if (lastSnapIdx !== -1 && window.SOUND) SOUND.train(snaps[idx].loss);
          lastSnapIdx = idx;
        }
        var done = p > 0.93;
        section.classList.toggle("learn-done", done);
        if (done) el.endnote.textContent = endnote(snaps[n - 1]);
        if (done && !wasDone && window.SOUND) SOUND.chime();
        wasDone = done;
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

    /* ---------- the unbroken thread ----------
       One line runs the whole page: born at the hero caret, down the margin
       lane, underlining each section heading as it passes, alongside the
       replay and the work, ending under the email address in the basin. Its
       tip tracks your reading position; its stroke carries the dusk gradient
       from cold at the rim to amber at the bottom. Desktop fine-pointer only. */

    (function () {
      if (!isHome || reduced || !hasGsap || typeof ScrollTrigger === "undefined") return;
      if (!window.matchMedia("(min-width: 900px) and (pointer: fine)").matches) return;
      var main = document.querySelector("main");
      var caret = document.querySelector(".hero .caret");
      if (!main || !caret) return;

      var NS = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "thread");
      svg.setAttribute("aria-hidden", "true");
      var defs = document.createElementNS(NS, "defs");
      var grad = document.createElementNS(NS, "linearGradient");
      grad.setAttribute("id", "threadGrad");
      grad.setAttribute("gradientUnits", "userSpaceOnUse");
      grad.setAttribute("x1", "0"); grad.setAttribute("y1", "0");
      grad.setAttribute("x2", "0");
      defs.appendChild(grad);
      svg.appendChild(defs);
      var path = document.createElementNS(NS, "path");
      path.setAttribute("class", "thread-path");
      svg.appendChild(path);
      var tip = document.createElementNS(NS, "circle");
      tip.setAttribute("class", "thread-tip");
      tip.setAttribute("r", "3");
      svg.appendChild(tip);
      main.insertBefore(svg, main.firstChild);

      /* dusk endpoints per theme, matching the altitude system */
      function paintGradient(docH) {
        grad.setAttribute("y2", String(docH));
        var light = (root.getAttribute("data-theme") || "dark") === "light";
        var stops = light
          ? ["oklch(0.5 0.16 30)", "oklch(0.52 0.15 42)", "oklch(0.55 0.13 60)"]
          : ["oklch(0.72 0.13 250)", "oklch(0.755 0.125 340)", "oklch(0.79 0.12 65)"];
        grad.innerHTML = "";
        stops.forEach(function (c, i) {
          var s = document.createElementNS(NS, "stop");
          s.setAttribute("offset", String(i * 50) + "%");
          s.setAttribute("stop-color", c);
          grad.appendChild(s);
        });
      }

      function docPoint(el, dx, dy, edge) {
        var r = el.getBoundingClientRect();
        var x = edge === "right" ? r.right : r.left;
        return { x: x + (dx || 0), y: r.top + window.scrollY + (dy || 0) + (edge === "bottom" || edge === "right" ? r.height : 0) };
      }

      var totalLen = 0, lenTable = [];

      function build() {
        var wrapR = document.querySelector(".hero.wrap").getBoundingClientRect();
        var laneX = Math.max(22, wrapR.left * 0.55);
        var sy = window.scrollY;
        var pts = [];

        /* born at the caret */
        var cr = caret.getBoundingClientRect();
        pts.push({ x: cr.left + cr.width / 2, y: cr.bottom + sy + 6 });

        /* sweep left into the margin lane */
        var lead = document.querySelector(".hero .lead");
        if (lead) {
          var lr = lead.getBoundingClientRect();
          pts.push({ x: lr.left - 34, y: lr.top + sy + lr.height * 0.4 });
        }
        pts.push({ x: laneX, y: pts[pts.length - 1].y + 260 });

        /* straight past the pinned replay */
        var spacer = document.querySelector(".pin-spacer");
        var learnEl = document.querySelector("[data-learn]");
        var beside = spacer || learnEl;
        if (beside) {
          var br = beside.getBoundingClientRect();
          pts.push({ x: laneX, y: br.top + sy + 60 });
          pts.push({ x: laneX, y: br.bottom + sy - 60 });
        }

        /* underline each section heading on the way down */
        ["#work", "#experience", ".skills", "#contact"].forEach(function (sel) {
          var h = document.querySelector(sel + " h2, " + sel + " [data-h2]");
          if (!h) return;
          var hr = h.getBoundingClientRect();
          var y = hr.bottom + sy + 12;
          var runEnd = hr.left + Math.min(hr.width, 320);
          pts.push({ x: laneX, y: y - 130 });
          pts.push({ x: hr.left - 4, y: y });
          pts.push({ x: runEnd, y: y });
          pts.push({ x: hr.left - 4, y: y + 8 });
          pts.push({ x: laneX, y: y + 150 });
        });

        /* terminate under the email address */
        var email = document.querySelector(".contact .email");
        if (email) {
          var er = email.getBoundingClientRect();
          var ey = er.bottom + sy + 8;
          pts.push({ x: laneX, y: ey - 90 });
          pts.push({ x: er.left, y: ey });
          pts.push({ x: er.left + er.width, y: ey });
        }

        /* smooth polyline: quadratic through midpoints */
        var d = "M" + pts[0].x.toFixed(1) + " " + pts[0].y.toFixed(1);
        for (var i = 1; i < pts.length - 1; i++) {
          var mx = (pts[i].x + pts[i + 1].x) / 2;
          var my = (pts[i].y + pts[i + 1].y) / 2;
          d += " Q" + pts[i].x.toFixed(1) + " " + pts[i].y.toFixed(1) + " " + mx.toFixed(1) + " " + my.toFixed(1);
        }
        var last = pts[pts.length - 1];
        d += " L" + last.x.toFixed(1) + " " + last.y.toFixed(1);
        path.setAttribute("d", d);

        var docH = document.documentElement.scrollHeight;
        svg.setAttribute("width", String(document.documentElement.clientWidth));
        svg.setAttribute("height", String(docH));
        svg.setAttribute("viewBox", "0 0 " + document.documentElement.clientWidth + " " + docH);
        paintGradient(docH);

        totalLen = path.getTotalLength();
        path.style.strokeDasharray = String(totalLen);
        /* length lookup: document y to distance along the path */
        lenTable = [];
        var SAMPLES = 260;
        for (i = 0; i <= SAMPLES; i++) {
          var l = (i / SAMPLES) * totalLen;
          lenTable.push({ l: l, y: path.getPointAtLength(l).y });
        }
      }

      function lenAtY(y) {
        var best = 0;
        for (var i = 0; i < lenTable.length; i++) {
          if (lenTable[i].y <= y) best = Math.max(best, lenTable[i].l);
        }
        return best;
      }

      var shown = 0;
      function update() {
        if (!totalLen) return;
        var target = lenAtY(window.scrollY + window.innerHeight * 0.62);
        shown += (target - shown) * 0.14;
        if (Math.abs(target - shown) < 0.5) shown = target;
        path.style.strokeDashoffset = String(Math.max(0, totalLen - shown));
        var p = path.getPointAtLength(Math.min(totalLen, Math.max(0.1, shown)));
        tip.setAttribute("cx", p.x.toFixed(1));
        tip.setAttribute("cy", p.y.toFixed(1));
      }

      build();
      update();
      ScrollTrigger.addEventListener("refresh", function () { build(); update(); });
      new MutationObserver(function () { paintGradient(document.documentElement.scrollHeight); })
        .observe(root, { attributes: true, attributeFilter: ["data-theme"] });
      gsap.ticker.add(update);
    })();

    /* ---------- the construction toggle: press g ----------
       The site exposes its own drawing: baseline grid, column guides,
       and the real spacing between sections written into the gaps. */

    (function () {
      var on = false, layer = null;

      function build() {
        layer = document.createElement("div");
        layer.className = "drawing";
        layer.setAttribute("aria-hidden", "true");
        var docH = document.documentElement.scrollHeight;
        layer.style.height = docH + "px";

        var wrap = document.querySelector("main .wrap") || document.querySelector(".wrap");
        if (wrap) {
          var r = wrap.getBoundingClientRect();
          var cs = getComputedStyle(wrap);
          var left = r.left + parseFloat(cs.paddingLeft);
          var right = r.right - parseFloat(cs.paddingRight);
          var guides = [r.left, left, (left + right) / 2, right, r.right];
          var measure = left + 42 * 16;
          if (measure < right - 40) guides.push(measure);
          guides.forEach(function (x) {
            var v = document.createElement("i");
            v.className = "dg-v";
            v.style.left = x.toFixed(1) + "px";
            layer.appendChild(v);
          });

          /* the real vertical rhythm, written into the gaps it measures */
          var blocks = document.querySelectorAll("main > section, main > div.ticker");
          var prev = null;
          blocks.forEach(function (el) {
            var b = el.getBoundingClientRect();
            var top = b.top + window.scrollY, bottom = b.bottom + window.scrollY;
            if (prev !== null) {
              var gap = Math.round(top - prev);
              if (gap > 12) {
                var lab = document.createElement("span");
                lab.className = "dg-label";
                lab.textContent = "Δ " + gap + "px";
                lab.style.left = (left - 34).toFixed(1) + "px";
                lab.style.top = ((prev + top) / 2).toFixed(1) + "px";
                layer.appendChild(lab);
              }
            }
            prev = bottom;
          });
        }
        document.body.appendChild(layer);
      }

      function setGrid(next) {
        on = next === undefined ? !on : !!next;
        body.classList.toggle("blueprint", on);
        if (layer) { layer.remove(); layer = null; }
        if (on) build();
      }
      window.__grid = setGrid;

      document.addEventListener("keydown", function (e) {
        if (e.key !== "g" && e.key !== "G") return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        var t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        setGrid();
      });

      window.addEventListener("resize", function () { if (on) setGrid(true); });
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

    /* masked line rise on section headings: flat, type never bends.
       Space Grotesk is a variable font, so the same trigger also settles
       the weight from hairline to full: the ink arrives with the line. */
    if (!reduced) {
      document.fonts.ready.then(function () {
        document.querySelectorAll("[data-h2]").forEach(function (h) {
          try {
            var sp = new SplitText(h, { type: "lines", mask: "lines" });
            var trig = { trigger: h, start: "top 88%", once: true };
            gsap.from(sp.lines, {
              yPercent: 110,
              duration: 0.9, ease: "power4.out", stagger: 0.08,
              scrollTrigger: trig
            });
            var ink = { w: 340 };
            gsap.to(ink, {
              w: 700, duration: 1.15, ease: "power2.out",
              scrollTrigger: trig,
              onStart: function () { h.style.fontVariationSettings = '"wght" 340'; },
              onUpdate: function () { h.style.fontVariationSettings = '"wght" ' + ink.w.toFixed(0); },
              onComplete: function () { h.style.fontVariationSettings = ""; }
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
          delay: el.classList.contains("work-row") ? 0.18 : 0,
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

    /* ---------- the experience axis grows with the reader ---------- */

    (function () {
      var xpEl = document.querySelector(".xp");
      if (!xpEl) return;
      if (reduced || !hasGsap || typeof ScrollTrigger === "undefined") {
        xpEl.style.setProperty("--axis", "1");
        return;
      }
      xpEl.style.setProperty("--axis", "0");
      /* the tip tracks one viewport line; higher on screen means the line
         arrives later and follows the eye instead of leading it */
      ScrollTrigger.create({
        trigger: xpEl, start: "top 67%", end: "bottom 67%", scrub: 0.4,
        onUpdate: function (self) {
          xpEl.style.setProperty("--axis", self.progress.toFixed(4));
        }
      });
    })();

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

    /* ---------- the model dock: the loss widget opens the demos ---------- */

    (function () {
      var widget = document.querySelector(".loss-widget");
      if (!widget || !isHome) return;
      widget.removeAttribute("aria-hidden");
      widget.setAttribute("role", "button");
      widget.setAttribute("tabindex", "0");
      widget.setAttribute("aria-label", "Meet the model");

      var dock = document.createElement("div");
      dock.className = "model-dock";
      dock.innerHTML =
        '<p class="dock-title">meet the model</p>' +
        '<button type="button" data-demo="a">watch a letter travel through it</button>' +
        '<button type="button" data-demo="b">see its architecture</button>' +
        '<button type="button" data-demo="c">visit it on the terrain</button>' +
        '<button type="button" data-demo="d">read its spec sheet</button>' +
        '<div class="dock-spec" data-dock-spec hidden></div>';
      document.body.appendChild(dock);
      var spec = dock.querySelector("[data-dock-spec]");
      var open = false;

      function setOpen(v) {
        if (v && !open && window.SOUND) SOUND.open();
        open = v;
        dock.classList.toggle("open", v);
        if (!v) { spec.hidden = true; spec.innerHTML = ""; }
      }

      function specSay(html, cls) {
        spec.hidden = false;
        var div = document.createElement("div");
        if (cls) div.className = cls;
        div.innerHTML = html;
        spec.appendChild(div);
      }

      function fire(which) {
        if (DEMOS.busy()) { setOpen(true); spec.innerHTML = ""; specSay("one moment, a demo is already playing"); return; }
        if (which === "d") { setOpen(true); spec.innerHTML = ""; DEMOS.d(specSay); return; }
        if (!DEMOS.sceneOn() || (which === "a" && !DEMOS.live())) {
          setOpen(true); spec.innerHTML = "";
          specSay(!DEMOS.sceneOn() ? "the 3D layer is off on this visit; the spec sheet still works" : "no live model this visit; try the architecture instead");
          return;
        }
        setOpen(false);
        DEMOS[which]();
      }

      dock.addEventListener("click", function (e) {
        var b = e.target.closest("button[data-demo]");
        if (b) fire(b.getAttribute("data-demo"));
      });
      var toggleDock = function () { setOpen(!open); };
      widget.addEventListener("click", toggleDock);
      widget.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleDock(); }
      });
      document.addEventListener("click", function (e) {
        if (!open) return;
        /* the click that just opened the dock from an invitation chip must
           not also close it on the way up */
        if (dock.contains(e.target) || widget.contains(e.target)) return;
        if (e.target.closest && e.target.closest("[data-learn-meet]")) return;
        setOpen(false);
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && open) setOpen(false);
      });

      /* the replay finale invitation fires the same doors */
      document.querySelectorAll("[data-learn-meet] button").forEach(function (b) {
        b.addEventListener("click", function () { fire(b.getAttribute("data-demo")); });
      });
    })();

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
        if (window.SOUND) SOUND.open();
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
          termPrint("commands: <span class='t-good'>about</span> · <span class='t-good'>work</span> · <span class='t-good'>evals</span> · <span class='t-good'>sample</span> · <span class='t-good'>model</span> · <span class='t-good'>train stats|stop|more</span> · <span class='t-good'>fit &lt;paste a job description&gt;</span> · <span class='t-good'>contact</span> · <span class='t-good'>temp 0|0.7|1.0</span> · <span class='t-good'>theme</span> · <span class='t-good'>sound on|off</span> · <span class='t-good'>anatomy</span> · <span class='t-good'>grid</span> · <span class='t-good'>whoami</span> · <span class='t-good'>sudo hire</span> · <span class='t-good'>clear</span> · <span class='t-good'>exit</span>");
        },
        model: function (rest) {
          var v = (rest || "").trim().toLowerCase();
          if (!v) {
            termPrint("four ways to meet the model. pick one:", "t-accent");
            termPrint("<span class='t-good'>model a</span> <span class='t-dim'>watch one letter travel the network, a live forward pass</span>");
            termPrint("<span class='t-good'>model b</span> <span class='t-dim'>the architecture, orbited and captioned</span>");
            termPrint("<span class='t-good'>model c</span> <span class='t-dim'>visit the walker on the terrain, live stats</span>");
            termPrint("<span class='t-good'>model d</span> <span class='t-dim'>the spec sheet, right here in the terminal</span>");
            return;
          }
          if (v === "a" || v === "b" || v === "c") {
            if (!DEMOS.sceneOn()) { termPrint("the 3D layer is off on this visit; try <span class='t-good'>model d</span>"); return; }
            if (v === "a" && !DEMOS.live()) { termPrint("no live model this visit, so no forward pass; try <span class='t-good'>model b</span>"); return; }
            if (DEMOS.busy()) { termPrint("a demo is already playing"); return; }
            closeTerm();
            DEMOS[v](termPrint);
            return;
          }
          if (v === "d") { DEMOS.d(termPrint); return; }
          termPrint("usage: model a | b | c | d");
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
            termPrint("tier " + st.tier + " · " + st.params.toLocaleString("en-US") + " params · step " + st.step + " · " + st.tokensSeen.toLocaleString("en-US") + " tokens · " + (st.loss ? "loss " + st.loss.toFixed(3) : "measuring loss") + " · " + Math.round(st.trainedMs / 1000) + "s on your CPU" + (st.restored ? " (restored from a previous visit)" : ""));
          }
        },
        about: function () {
          termPrint("AI engineer in Gujarat, India. I fine-tune, quantize, serve, and evaluate LLMs in production. Currently at Nextbase Solutions.");
        },
        work: function () {
          termPrint('01 innerlens <span class="t-dim">hallucination signal from model internals, AUROC 0.80</span> <a href="/work/innerlens.html">/work/innerlens</a>');
          termPrint('02 MathTutor-Qwen3-8B <span class="t-dim">fine-tune + LLM-as-judge eval</span> <a href="/work/mathtutor.html">/work/mathtutor</a>');
          termPrint('03 HGD Memory Engine <span class="t-dim">retrieval benchmark, 40% to 85%</span> <a href="/work/hgd-eval.html">/work/hgd-eval</a>');
          termPrint('04 Rhizome Logic <span class="t-dim">competitive-intelligence agent</span> <a href="/work/rhizome.html">/work/rhizome</a>');
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
        grid: function () {
          if (window.__grid) { closeTerm(); window.__grid(); termPrint("construction layer toggled", "t-good"); }
        },
        theme: function () {
          var next = currentTheme() === "dark" ? "light" : "dark";
          root.setAttribute("data-theme", next);
          try { localStorage.setItem("theme", next); } catch (e) {}
          termPrint("theme: " + next, "t-good");
        },
        sound: function (rest) {
          if (!SND) { termPrint("no audio engine in this browser"); return; }
          var v = (rest || "").trim().toLowerCase();
          var next = v === "on" ? true : v === "off" ? false : !SND.isEnabled();
          setSound(next);
          termPrint("sound: " + (next ? "on · synthesized live, nothing downloaded" : "off"), "t-good");
        },
        anatomy: function () {
          if (window.ANATOMY && ANATOMY.supported) {
            closeTerm();
            ANATOMY.toggle();
            termPrint("tearing the page into its eight layers · esc reassembles", "t-good");
          } else {
            termPrint("anatomy lives on the home page");
          }
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
          if (window.SOUND) SOUND.chime();
          setTimeout(function () { window.location.href = "mailto:yashbambhroliya1@gmail.com?subject=Let's talk"; }, 700);
        } else if (CMDS[cmd]) {
          if (window.SOUND) SOUND.tick();
          CMDS[cmd](rest);
        } else {
          if (window.SOUND) SOUND.deny();
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
