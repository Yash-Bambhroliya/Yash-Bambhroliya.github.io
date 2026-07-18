/* yashb.me · the exploded view. The page can be torn into its true strata:
   instruments, type, controls, linework, color, the live scene, the grid,
   and, at the very bottom, the data everything else is built on. Sheets are
   sprung, not tweened; the assembly is the arrival; the BOM tells the truth. */

window.ANATOMY = (function () {
  "use strict";

  var root = document.documentElement;
  var isHome = null;
  var reduced = false;
  var coarse = false;

  var built = false, active = false, arriving = false, inspecting = -1;
  var stage, stack, sheets = [], chips = [], bomRows = [];
  var canvasHome = null, canvasMark = null, movedCanvas = null;
  var state = { t: 0 };
  var insp = 0;                       /* eased 0..1 while a sheet is held */
  var Z = [], V = [], seated = [];
  var raf = null, lastNow = 0, idleTimer = null;
  var N = 8;
  var claimsInfo = null;

  var LAYERS = [
    { name: "instruments", note: "registration · bezel · nav" },
    { name: "type", note: "Space Grotesk 300-700 · Instrument Serif" },
    { name: "controls", note: "magnetic · sounded · honest" },
    { name: "linework", note: "1px hairlines, drawn not drawn on" },
    { name: "color", note: "oklch altitude drift" },
    { name: "scene", note: "three.js terrain · live, not a picture" },
    { name: "grid", note: "48px construction lattice" },
    { name: "data", note: "claims.json · the truth layer" }
  ];

  function supported() {
    if (isHome === null) {
      isHome = document.body.getAttribute("data-page") === "home";
      reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        document.body.getAttribute("data-temp") === "0.0";
      coarse = !window.matchMedia("(hover: hover) and (pointer: fine)").matches || window.innerWidth < 720;
    }
    return isHome && typeof gsap !== "undefined";
  }

  function attitude() {
    return coarse ? { rx: 42, rz: -22, gap: 60, out: 0.3 } : { rx: 54, rz: -34, gap: 90, out: 0.24 };
  }

  /* ---------- resource truth for the BOM ---------- */

  function kb(rx) {
    try {
      var sum = 0;
      performance.getEntriesByType("resource").forEach(function (r) {
        if (rx.test(r.name)) sum += r.transferSize || r.decodedBodySize || 0;
      });
      return sum ? (sum / 1024).toFixed(1) + " KB" : "cached";
    } catch (e) { return "—".replace("—", "n/a"); }
  }

  function bomData() {
    var verts = "";
    try { verts = window.SCENE && SCENE.supported ? SCENE.stats().verts.toLocaleString("en-US") + " vertices" : "off this visit"; } catch (e) {}
    return [
      ["1", "instruments", "site.js", kb(/js\/site\.js/)],
      ["2", "type", "two variable fonts", kb(/fonts\//)],
      ["3", "controls", "sound.js, oscillators only", kb(/js\/sound\.js/)],
      ["4", "linework", "site.css", kb(/css\/site\.css/)],
      ["5", "color", "oklch, computed live", "0 KB extra"],
      ["6", "scene", "three.js", (kb(/vendor\/three/) + " · " + verts)],
      ["7", "grid", "two css gradients", "~0.2 KB"],
      ["8", "data", "claims.json", (claimsInfo ? claimsInfo.kb + " · " + claimsInfo.count + " claims" : kb(/claims\.json/))],
      ["9", "the reader", "you", "completes the assembly"]
    ];
  }

  /* ---------- stage construction ---------- */

  /* clones leave their ancestors behind, so scoped CSS stops matching;
     every computed text and box style is inlined to keep the copy exact */
  var COPY = ["font-family", "font-size", "font-weight", "font-style", "line-height",
    "letter-spacing", "text-transform", "color", "text-align", "white-space",
    "text-decoration", "font-variant-numeric", "display", "align-items",
    "justify-content", "flex-direction", "flex-wrap", "gap", "padding", "border",
    "border-radius", "background-color", "opacity", "overflow", "fill", "stroke"];

  function styleClone(src) {
    var c = src.cloneNode(true);
    var a = [src], b = [c], i = 0;
    while (i < a.length) {
      var s = a[i], d = b[i]; i++;
      if (s.nodeType !== 1 || !d) continue;
      var cs = getComputedStyle(s);
      var css = "";
      for (var j = 0; j < COPY.length; j++) css += COPY[j] + ":" + cs.getPropertyValue(COPY[j]) + ";";
      d.style.cssText = css + d.style.cssText;
      d.removeAttribute("id");
      for (var k = 0; k < s.children.length; k++) { a.push(s.children[k]); b.push(d.children[k]); }
    }
    return c;
  }

  function snapInto(sheet, selectors) {
    selectors.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height || r.bottom < -40 || r.top > window.innerHeight + 40) return;
        var c = styleClone(el);
        c.style.cssText += ";position:absolute;margin:0;left:" + r.left + "px;top:" + r.top +
          "px;width:" + r.width + "px;height:" + r.height + "px;pointer-events:none;";
        sheet.appendChild(c);
      });
    });
  }

  function build() {
    if (built) return;
    var acc = getComputedStyle(root).getPropertyValue("--accent").trim() || "#3ea6ff";

    stage = document.createElement("div");
    stage.className = "anatomy";
    stage.innerHTML = '<div class="an-stack"></div>' +
      '<div class="an-title mono">fig. 00 · viewport assembly · 8 parts + 1 · scale 1:1 · rev 07</div>' +
      '<div class="an-bom mono" aria-label="Parts list"><div class="an-bom-h">parts list</div></div>' +
      '<div class="an-hint mono">scroll to tear · click a sheet to hold it · esc reassembles</div>';
    stack = stage.querySelector(".an-stack");

    for (var i = 0; i < N; i++) {
      var sh = document.createElement("div");
      sh.className = "an-sheet an-l" + (i + 1);
      sh.setAttribute("data-i", i);
      /* flat paint order must match the strata: deep sheets first in the
         DOM, instruments last, so at rest nothing hides behind the scene */
      sh.style.zIndex = String(N - i);
      var chip = document.createElement("div");
      chip.className = "an-chip mono";
      chip.textContent = i + 1;
      sh.appendChild(chip);
      chips.push(chip);
      if (stack.firstChild) stack.insertBefore(sh, stack.firstChild);
      else stack.appendChild(sh);
      sheets.push(sh);
      Z.push(0); V.push(0); seated.push(true);
    }

    /* 1 · instruments */
    snapInto(sheets[0], [".nav", ".bezel"]);
    /* 2 · type */
    snapInto(sheets[1], [".hero .hero-meta", ".hero .role", ".hero h1", ".hero .lead", ".hero .greet", ".hero .live-note"]);
    /* 3 · controls */
    snapInto(sheets[2], [".hero .hero-links", ".loss-widget", ".an-pill"]);
    /* 4 · linework: drawn fresh, matching the house geometry */
    sheets[3].innerHTML += '<div class="an-frame"></div>' +
      '<i class="an-tick" style="top:38px;left:38px"></i><i class="an-tick" style="top:38px;right:38px"></i>' +
      '<i class="an-tick" style="bottom:38px;left:38px"></i><i class="an-tick" style="bottom:38px;right:38px"></i>';
    /* 5 · color wash */
    sheets[4].innerHTML += '<div class="an-wash" style="background:' +
      "radial-gradient(60% 55% at 72% 68%, color-mix(in srgb, " + acc + " 18%, transparent), transparent 70%)," +
      "radial-gradient(38% 40% at 18% 22%, color-mix(in srgb, " + acc + " 7%, transparent), transparent 70%)" + '"></div>';
    /* 6 · scene: the real canvas moves in; it stays alive */
    var canvas = document.querySelector("canvas.field");
    if (canvas) {
      canvasHome = canvas.parentNode;
      canvasMark = document.createComment("field-home");
      canvasHome.insertBefore(canvasMark, canvas);
      movedCanvas = canvas;
    } else {
      sheets[5].innerHTML += '<div class="an-noscene mono">scene off this visit</div>';
    }
    /* 7 · grid */
    sheets[6].innerHTML += '<div class="an-grid"></div>';
    /* 8 · data */
    var dataEl = document.createElement("div");
    dataEl.className = "an-data mono";
    dataEl.textContent = "reading claims.json ...";
    sheets[7].appendChild(dataEl);
    fetch("/data/claims.json").then(function (r) { return r.json(); }).then(function (j) {
      var rows = (j.claims || []).slice(0, 10).map(function (c) {
        return '<div><span class="an-cid">' + c.id + "</span> " + (c.text || "").slice(0, 92) + "…</div>";
      }).join("");
      claimsInfo = { count: (j.claims || []).length, kb: kb(/claims\.json/) };
      dataEl.innerHTML = rows || "claims.json";
      fillBom();
    }).catch(function () { dataEl.textContent = "claims.json"; });

    /* BOM */
    fillBom();

    /* input (the keydown listener lives at module init, not here) */
    stage.addEventListener("wheel", onWheel, { passive: false });
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("click", onClick);

    document.body.appendChild(stage);
    built = true;
  }

  function fillBom() {
    if (!stage) return;
    var bom = stage.querySelector(".an-bom");
    bom.querySelectorAll(".an-row").forEach(function (r) { r.remove(); });
    bomRows = [];
    bomData().forEach(function (row, i) {
      var el = document.createElement("div");
      el.className = "an-row" + (i === N ? " an-reader" : "");
      el.innerHTML = '<span class="an-n">' + row[0] + '</span><span class="an-name">' + row[1] +
        '</span><span class="an-mat">' + row[2] + '</span><span class="an-kb">' + row[3] + "</span>";
      if (i < N) {
        el.addEventListener("mouseenter", function () { hot(i, true); });
        el.addEventListener("mouseleave", function () { hot(i, false); });
        el.addEventListener("click", function () { withdraw(i); });
      }
      stage.querySelector(".an-bom").appendChild(el);
      bomRows.push(el);
    });
  }

  function hot(i, on) {
    if (!active || arriving) return;
    sheets[i].classList.toggle("hot", on);
  }

  /* ---------- the springs ---------- */

  function targets() {
    var a = attitude();
    var t = state.t;
    var out = [];
    for (var i = 0; i < N; i++) {
      var lag = i * 0.045;
      var tl = Math.max(0, Math.min(1, (t - lag) / (1 - lag)));
      /* the resting ladder: 0.6px per stratum is invisible at this
         perspective but keeps depth sorting honest while springs settle,
         so the terrain's occluder can never paint over the type */
      var z = ((N - 1) / 2 - i) * a.gap * tl + (N - 1 - i) * 0.6;
      /* holding a sheet: it comes to one fixed reading depth no matter
         which stratum it lives in; the rest compress into the background */
      if (inspecting >= 0) {
        z = i === inspecting ? 250 : z * 0.3 - 70;
      }
      out.push(z);
    }
    return out;
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    var dt = Math.min(0.033, (now - lastNow) / 1000 || 0.016);
    lastNow = now;
    var tg = targets();
    var a = attitude();
    var e = state.t * state.t * (3 - 2 * state.t);
    /* while a sheet is held, the whole stack eases toward frontal so the
       held sheet reads flat, wherever it came from in the stack */
    insp += ((inspecting >= 0 ? 1 : 0) - insp) * Math.min(1, dt * 7);
    var rx = a.rx * e * (1 - 0.72 * insp);
    var rz = a.rz * e * (1 - 0.72 * insp);
    stack.style.transform = "scale(" + (1 - a.out * e + 0.06 * insp) + ") rotateX(" + rx + "deg) rotateZ(" + rz + "deg)";
    var allSeated = true;
    for (var i = 0; i < N; i++) {
      var k = 130 - i * 9;                       /* deep sheets are heavier */
      V[i] += (tg[i] - Z[i]) * k * dt - V[i] * 11 * dt;
      Z[i] += V[i] * dt;
      var off = Math.abs(tg[i] - Z[i]) + Math.abs(V[i]) * 0.01;
      if (off > 2.5) allSeated = false;
      /* the thock: a sheet coming home at speed */
      if (!seated[i] && Math.abs(Z[i] - tg[i]) < 2 && Math.abs(V[i]) < 40 && state.t < 0.12 && inspecting < 0) {
        seated[i] = true;
        if (window.SOUND) SOUND.seat(i, N);
      }
      if (Math.abs(Z[i] - tg[i]) > 12) seated[i] = false;
      sheets[i].style.transform = "translateZ(" + Z[i].toFixed(2) + "px)";
      sheets[i].style.setProperty("--sheet", (0.62 * e).toFixed(3));
      sheets[i].style.setProperty("--xray", e.toFixed(3));
      sheets[i].style.setProperty("--chipop", Math.max(0, (state.t - 0.5) / 0.5).toFixed(3));
      chips[i].style.transform = "rotateZ(" + (-rz) + "deg) rotateX(" + (-rx) + "deg) scale(" + (1 + 0.5 * e) + ")";
      sheets[i].classList.toggle("dim", inspecting >= 0 && inspecting !== i);
    }
    stage.classList.toggle("apart", state.t > 0.35);
    /* at rest the stack leaves 3D: composited layers (the live canvas)
       cannot out-sort the type when paint order is plain z-index */
    stage.classList.toggle("flat", state.t < 0.035 && inspecting < 0);
    if (arriving && allSeated && state.t < 0.01) finishArrival();
  }

  function startLoop() {
    if (raf === null) { lastNow = 0; raf = requestAnimationFrame(tick); }
  }
  function stopLoop() {
    if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
  }

  /* ---------- input ---------- */

  function onWheel(e) {
    if (arriving) { e.preventDefault(); hurry(); return; }
    if (!active) return;
    e.preventDefault();
    if (inspecting >= 0) return;      /* a held sheet ignores the scrub */
    gsap.killTweensOf(state);
    state.t = Math.max(0, Math.min(1, state.t + e.deltaY * 0.0009));
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      if (inspecting >= 0) return;
      if (state.t < 0.06) { close(); return; }
      gsap.to(state, { t: state.t > 0.5 ? 1 : 0, duration: 0.6, ease: "power3.out", onComplete: function () { if (state.t < 0.01) close(); } });
    }, 460);
  }

  var dragY = null, dragT = 0;
  function onDown(e) {
    if (arriving) { hurry(); return; }
    if (e.target.closest(".an-bom")) return;
    dragY = e.clientY; dragT = state.t;
    gsap.killTweensOf(state);
    var move = function (ev) {
      state.t = Math.max(0, Math.min(1, dragT + (dragY - ev.clientY) / 380));
    };
    var up = function () {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (inspecting >= 0) return;
      gsap.to(state, { t: state.t > 0.5 ? 1 : 0, duration: 0.6, ease: "power3.out", onComplete: function () { if (state.t < 0.01) close(); } });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function onClick(e) {
    if (arriving || !active) return;
    if (e.target.closest(".an-bom") || e.target.closest(".an-hint")) return;
    if (state.t < 0.6) return;
    var sh = e.target.closest(".an-sheet");
    /* pick the sheet nearest the eye under the pointer: DOM hit works because
       later siblings render nearer; climb from the hit target */
    var i = sh ? parseInt(sh.getAttribute("data-i"), 10) : -1;
    if (inspecting >= 0) { withdraw(-1); return; }
    if (i >= 0) withdraw(i);
  }

  function onKey(e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if ((e.key === "x" || e.key === "X") && supported() && !document.body.classList.contains("demo-on")) {
      e.preventDefault();
      toggle();
    } else if (e.key === "Escape" && active && !arriving) {
      if (inspecting >= 0) withdraw(-1);
      else close();
    }
  }

  function withdraw(i) {
    if (i === inspecting) i = -1;
    inspecting = i;
    if (window.SOUND) SOUND.slide();
    bomRows.forEach(function (r, j) { r.classList.toggle("on", j === i); });
    seated.forEach(function (_, j) { seated[j] = true; });
  }

  /* ---------- lifecycle ---------- */

  function mountCanvas() {
    if (movedCanvas) {
      sheets[5].insertBefore(movedCanvas, sheets[5].firstChild);
      movedCanvas.style.position = "absolute";
      movedCanvas.style.inset = "0";
    }
  }
  function restoreCanvas() {
    if (movedCanvas && canvasMark && canvasHome) {
      canvasHome.insertBefore(movedCanvas, canvasMark);
      movedCanvas.style.position = "";
      movedCanvas.style.inset = "";
    }
  }

  function open() {
    if (active || !supported() || document.body.classList.contains("demo-on")) return;
    if (window.__lenis) window.__lenis.stop();
    window.scrollTo(0, 0);
    build();
    fillBom();
    mountCanvas();
    stage.classList.add("on");
    active = true;
    inspecting = -1;
    document.body.classList.add("anatomy-on");
    if (window.SOUND) SOUND.open();
    if (reduced) {
      state.t = 1;
      var tg = targets();
      for (var i = 0; i < N; i++) { Z[i] = tg[i]; V[i] = 0; }
    } else {
      gsap.to(state, { t: 1, duration: 0.9, ease: "power3.out" });
    }
    startLoop();
  }

  function close() {
    if (!active) return;
    inspecting = -1;
    bomRows.forEach(function (r) { r.classList.remove("on"); });
    var done = function () {
      active = false;
      stopLoop();
      stage.classList.remove("on");
      restoreCanvas();
      document.body.classList.remove("anatomy-on");
      if (window.__lenis) window.__lenis.start();
    };
    if (reduced) { state.t = 0; done(); return; }
    gsap.to(state, {
      t: 0, duration: 0.7, ease: "power3.inOut",
      onComplete: function () { setTimeout(done, 240); }
    });
  }

  function toggle() { active ? close() : open(); }

  /* the arrival: the page assembles out of its own diagram, once, at load */
  var arrivalDone = false, hurried = false;
  function hurry() {
    if (!arriving || hurried) return;
    hurried = true;
    gsap.killTweensOf(state);
    gsap.to(state, { t: 0, duration: 0.35, ease: "power2.out" });
  }
  function finishArrival() {
    if (!arriving) return;
    arriving = false;
    if (stage) stage.classList.remove("arriving");
    gsap.fromTo(stack, { x: 0 }, { x: 2, duration: 0.05, repeat: 3, yoyo: true, clearProps: "x" });
    setTimeout(function () {
      active = true;   /* let close() run its teardown */
      close();
    }, 260);
  }

  function arriveEligible() {
    return supported() && !reduced && !location.hash && window.scrollY < 40 && !arrivalDone;
  }

  function arrive() {
    if (!arriveEligible()) return false;
    arrivalDone = true;
    build();
    mountCanvas();
    stage.classList.add("on");
    stage.classList.add("arriving");
    arriving = true;
    document.body.classList.add("anatomy-on");
    state.t = 1;
    var tg = targets();
    for (var i = 0; i < N; i++) { Z[i] = tg[i]; V[i] = 0; seated[i] = false; }
    startLoop();
    gsap.to(state, {
      t: 0, duration: 1.9, delay: 0.35, ease: "power3.inOut",
      onComplete: function () { gsap.delayedCall(0.4, finishArrival); }
    });
    return true;
  }

  window.addEventListener("resize", function () { if (active && !arriving) close(); });

  /* the door: a quiet pill above the colophon corner */
  document.addEventListener("DOMContentLoaded", function () {
    if (!supported()) return;
    document.addEventListener("keydown", onKey);
    var pill = document.createElement("button");
    pill.type = "button";
    pill.className = "an-pill mono";
    pill.textContent = "⟂ anatomy";
    pill.setAttribute("aria-label", "Tear the page into its layers");
    pill.addEventListener("click", function () { toggle(); });
    document.body.appendChild(pill);
  });

  return {
    get supported() { return supported(); },
    get active() { return active; },
    arrive: arrive,
    arriveEligible: arriveEligible,
    open: open,
    close: close,
    toggle: toggle
  };
})();
