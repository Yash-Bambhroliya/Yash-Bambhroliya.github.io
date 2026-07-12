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
    var set = root.getAttribute("data-theme");
    if (set) return set;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var body = document.body;
    var hasGsap = typeof gsap !== "undefined";
    if (hasGsap) gsap.registerPlugin(ScrollTrigger, SplitText, ScrambleTextPlugin);

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
      if (announce && termPrint) {
        termPrint("temperature set to " + v + (v === "0.0" ? " (calm: motion off on next load)" : v === "1.0" ? " (spicy)" : " (default)"), "t-good");
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

    /* ---------- v4: convergence particle field ---------- */

    var fieldCanvas = document.querySelector("[data-field]");
    var fieldPromise = (function () {
      if (!isHome || reduced || !fieldCanvas || !window.FIELD || !window.FIELD.supported) {
        return Promise.resolve(false);
      }
      return window.FIELD.init({ canvas: fieldCanvas }).then(function (ok) {
        if (!ok) return false;
        body.classList.add("field-on");
        fieldCanvas.classList.add("live");
        if (fine) {
          window.addEventListener("pointermove", function (e) {
            window.FIELD.setPointer(e.clientX, e.clientY, true);
          });
          document.documentElement.addEventListener("pointerleave", function () {
            window.FIELD.setPointer(0, 0, false);
          });
        }
        if (lenis) {
          lenis.on("scroll", function (e) { window.FIELD.setTurbulence(e.velocity || 0); });
        }
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
          setTimeout(function () { window.FIELD.refreshColors(); }, 50);
        });
        /* scroll choreography: resolve the field target from scroll position.
           Deterministic (no edge events), morphTo is a no-op when unchanged. */
        var SHAPE_SECTIONS = [
          [document.querySelector("#work"), "curve"],
          [document.querySelector(".skills"), "graph"],
          [document.querySelector("#contact"), "check"]
        ].filter(function (p) { return p[0]; });
        var shapeQueued = false;
        function resolveShape() {
          shapeQueued = false;
          var line = window.innerHeight * 0.55;
          var target = "name";
          SHAPE_SECTIONS.forEach(function (p) {
            if (p[0].getBoundingClientRect().top < line) target = p[1];
          });
          window.FIELD.morphTo(target);
        }
        function queueShape() {
          if (shapeQueued) return;
          shapeQueued = true;
          requestAnimationFrame(resolveShape);
        }
        if (lenis) lenis.on("scroll", queueShape);
        window.addEventListener("scroll", queueShape, { passive: true });
        resolveShape();
        var pEl = document.querySelector("[data-ev-particles]");
        if (pEl) {
          setInterval(function () {
            var st = window.FIELD.stats();
            pEl.textContent = st.particles.toLocaleString("en-US") + " at " + st.fps + " fps";
          }, 1500);
        }
        return true;
      });
    })();

    /* ---------- preloader: training run ---------- */

    var pre = document.querySelector(".preloader");
    var seen = false;
    try { seen = sessionStorage.getItem("run") === "done"; } catch (e) {}

    function endPreloader(instant) {
      if (!pre || pre.classList.contains("done")) return;
      try { sessionStorage.setItem("run", "done"); } catch (e) {}
      fieldPromise.then(function (ok) {
        if (ok) window.FIELD.setConverge(1, 1600);
      });
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
      setTimeout(function () { endPreloader(true); }, 5000);
      if (reduced || seen) {
        rows.forEach(function (r) { r.classList.add("on"); });
        setTimeout(function () { endPreloader(reduced); }, reduced ? 0 : 300);
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
      var CELLS = 24;
      var state = { p: 0 };
      var tl = gsap.timeline();
      tl.call(function () { rows[0].classList.add("on"); })
        .call(function () { rows[1].classList.add("on"); rows[2].classList.add("on"); }, null, 0.3)
        .to(state, {
          p: 1, duration: 1.25, ease: "power2.inOut",
          onUpdate: function () {
            var filled = Math.round(state.p * CELLS);
            if (barEl) barEl.textContent = "█".repeat(filled) + "░".repeat(CELLS - filled);
            if (lossEl) lossEl.textContent = (2.31 * Math.pow(0.012 / 2.31, state.p)).toFixed(3);
            if (epochEl) epochEl.textContent = String(Math.min(3, 1 + Math.floor(state.p * 3)));
            if (window.FIELD) window.FIELD.setConverge(state.p * 0.55);
          }
        }, 0.35)
        .call(function () { rows[3].classList.add("on"); }, null, 1.75)
        .call(function () { endPreloader(false); }, null, 2.15);

      var skip = pre.querySelector("[data-skip]");
      if (skip) skip.addEventListener("click", function () { tl.kill(); endPreloader(false); });
      document.addEventListener("keydown", function onEsc(e) {
        if (e.key === "Escape" && !pre.classList.contains("done")) { tl.kill(); endPreloader(false); }
        else if (pre.classList.contains("done")) document.removeEventListener("keydown", onEsc);
      });
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
        if (!body.classList.contains("field-on")) {
          typeEls.forEach(function (el) {
            var split = new SplitText(el, { type: "chars" });
            gsap.set(split.chars, { visibility: "hidden" });
            split.chars.forEach(function (c) {
              tl.set(c, { visibility: "visible" }, at);
              at += 0.028 + Math.random() * 0.03;
            });
            at += 0.12;
          });
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

    runPreloader();

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

    /* masked line rise on section headings */
    if (!reduced) {
      document.fonts.ready.then(function () {
        document.querySelectorAll("[data-h2]").forEach(function (h) {
          try {
            var sp = new SplitText(h, { type: "lines", mask: "lines" });
            gsap.from(sp.lines, {
              yPercent: 110, duration: 0.8, ease: "power4.out", stagger: 0.08,
              scrollTrigger: { trigger: h, start: "top 88%", once: true }
            });
          } catch (e) {}
        });
        if (typeof ScrollTrigger !== "undefined") ScrollTrigger.refresh();
      });
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
      if (reduced || !hasGsap) {
        if (liveLoss) liveLoss.textContent = "0.012";
        if (liveEpoch) liveEpoch.textContent = "3";
      } else {
        var L = curve.getTotalLength();
        curve.style.strokeDasharray = L;
        curve.style.strokeDashoffset = L;
        ScrollTrigger.create({
          start: 0,
          end: "max",
          onUpdate: function (self) {
            var p = self.progress;
            curve.style.strokeDashoffset = String(L * (1 - p));
            if (liveLoss) liveLoss.textContent = (2.31 * Math.pow(0.012 / 2.31, p)).toFixed(3);
            if (liveEpoch) liveEpoch.textContent = String(Math.min(3, 1 + Math.floor(p * 3)));
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
          termPrint("commands: <span class='t-good'>about</span> · <span class='t-good'>work</span> · <span class='t-good'>evals</span> · <span class='t-good'>contact</span> · <span class='t-good'>temp 0|0.7|1.0</span> · <span class='t-good'>theme</span> · <span class='t-good'>whoami</span> · <span class='t-good'>sudo hire</span> · <span class='t-good'>clear</span> · <span class='t-good'>exit</span>");
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
        var parts = raw.toLowerCase().split(/\s+/);
        var cmd = parts[0];
        if (cmd === "temp" && parts[1]) {
          var v = parts[1] === "1" ? "1.0" : parts[1] === "0" ? "0.0" : parts[1];
          if (TEMPS.indexOf(v) > -1) { setTemp(v, true); } else { termPrint("usage: temp 0 | 0.7 | 1.0"); }
        } else if (cmd === "sudo" && parts[1] === "hire") {
          termPrint("access granted.", "t-good");
          termPrint("drafting email to yashbambhroliya1@gmail.com ...");
          setTimeout(function () { window.location.href = "mailto:yashbambhroliya1@gmail.com?subject=Let's talk"; }, 700);
        } else if (CMDS[cmd]) {
          CMDS[cmd]();
        } else {
          termPrint("command not found: " + esc(cmd) + " · try <span class='t-good'>help</span>");
        }
      });
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
      fieldPromise.then(function (ok) {
        if (!ok) return;
        var row = document.createElement("label");
        row.innerHTML = 'converge <input type="range" min="0" max="1" step="0.01" value="1" data-cv>';
        dbg.appendChild(row);
        row.querySelector("[data-cv]").addEventListener("input", function (e) {
          window.FIELD.setConverge(parseFloat(e.target.value));
        });
        var morphs = document.createElement("label");
        morphs.innerHTML = '<button data-m="name">name</button> <button data-m="curve">curve</button> <button data-m="graph">graph</button> <button data-m="check">check</button>';
        dbg.appendChild(morphs);
        morphs.querySelectorAll("[data-m]").forEach(function (b) {
          b.addEventListener("click", function () { window.FIELD.morphTo(b.getAttribute("data-m")); });
        });
      });
    }
  });
})();
