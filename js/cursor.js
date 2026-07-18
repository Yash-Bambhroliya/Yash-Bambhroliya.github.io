/* yashb.me · the click grammar. One language for everything clickable:
   the cursor locks a reticle around the target, a small verb names the
   action, the element leans toward the pointer, the press compresses,
   and the click pings a sonar ring from the exact point. The native
   cursor is untouched. Desktop gets the full stack; touch keeps press
   and ping. Sound rides the existing kit and stays silent unless the
   visitor turned sound on. Reduced motion opts out of all of it. */

(function () {
  "use strict";

  if (!window.matchMedia) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var fine = matchMedia("(pointer: fine)").matches;
  var body = document.body;

  var HOT = "a, button, [role=button], .lp, .an-row, summary";
  var PLAIN = "input, textarea, select";
  var PAD = 7, BK = 10;

  function snd(name) {
    var S = window.SOUND;
    if (S && S[name]) { try { S[name](); } catch (e) {} }
  }

  /* ---------- verb: what a click will do ---------- */
  function verbFor(el) {
    var v = el.getAttribute("data-cursor");
    if (v !== null) return v === "none" ? "" : v;
    if (el.tagName === "A") {
      var href = el.getAttribute("href") || "";
      if (href.indexOf("mailto:") === 0) return "mail";
      if (href.charAt(0) === "#") return "go";
      if (el.host && el.host !== location.host) return "visit";
      return "open";
    }
    if (el.classList.contains("an-row")) return "pull";
    return "press";
  }

  /* ---------- sonar ping (all pointer types, also keyboard clicks) ---------- */
  function ping(x, y) {
    var p = document.createElement("div");
    p.className = "c-ping";
    p.style.left = x + "px";
    p.style.top = y + "px";
    body.appendChild(p);
    setTimeout(function () { if (p.parentNode) p.parentNode.removeChild(p); }, 560);
  }

  /* ---------- element physics: magnet lean + press compress ----------
     Inline transforms are only applied to elements whose computed
     transform is none at first touch, so nothing that already moves in
     CSS (hover slides, entrance animations) gets clobbered. */
  var LIVE = new Map();

  function stateOf(el) {
    var st = LIVE.get(el);
    if (!st) {
      var cs = getComputedStyle(el);
      var r = el.getBoundingClientRect();
      st = {
        ok: cs.transform === "none" && !el.closest(".preloader"),
        mag: cs.transform === "none" && r.width < 420 && r.height < 220,
        tx: 0, ty: 0, s: 1, ttx: 0, tty: 0, ts: 1
      };
      LIVE.set(el, st);
    }
    return st;
  }

  var hotEl = null, magEl = null, pressEl = null;
  var mx = innerWidth / 2, my = innerHeight / 2;

  document.addEventListener("pointerover", function (e) {
    var t = e.target.closest ? e.target.closest(HOT) : null;
    if (t && (t.matches(PLAIN) || t.getAttribute("data-cursor") === "none")) t = null;
    if (t === hotEl) return;
    hotEl = t;
    magEl = null;
    if (t) {
      snd("hover");
      var st = stateOf(t);
      if (fine && st.mag) magEl = t;
    }
  });
  document.addEventListener("pointerout", function (e) {
    if (hotEl && !(e.relatedTarget && hotEl.contains(e.relatedTarget))) {
      var st = LIVE.get(hotEl);
      if (st) { st.ttx = 0; st.tty = 0; }
      hotEl = null;
      magEl = null;
    }
  });
  document.addEventListener("pointermove", function (e) {
    mx = e.clientX; my = e.clientY;
    if (fine) body.classList.add("cur-on");
    if (magEl) {
      var st = stateOf(magEl);
      var r = magEl.getBoundingClientRect();
      var dx = (mx - (r.left + r.width / 2)) / (r.width / 2);
      var dy = (my - (r.top + r.height / 2)) / (r.height / 2);
      st.ttx = Math.max(-1, Math.min(1, dx)) * 4;
      st.tty = Math.max(-1, Math.min(1, dy)) * 3;
    }
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", function () {
    body.classList.remove("cur-on");
    hotEl = null; magEl = null;
  });

  document.addEventListener("pointerdown", function (e) {
    var t = e.target.closest ? e.target.closest(HOT) : null;
    if (!t || t.matches(PLAIN)) return;
    var st = stateOf(t);
    if (st.ok) {
      pressEl = t;
      /* compress by at most ~2px per edge: a wide display link shrinking
         under the pointer would otherwise slip out from under the click */
      var r = t.getBoundingClientRect();
      st.ts = 1 - Math.min(0.038, 5 / Math.max(r.width, r.height, 1));
      /* and the pressed element keeps the pointer no matter how it moves,
         so the release click always lands on the thing that was pressed */
      if (t.setPointerCapture && e.pointerId !== undefined) {
        try { t.setPointerCapture(e.pointerId); } catch (err) {}
      }
    }
  });
  function release() {
    if (pressEl) {
      var st = LIVE.get(pressEl);
      if (st) st.ts = 1;
      pressEl = null;
    }
  }
  document.addEventListener("pointerup", release);
  document.addEventListener("pointercancel", release);

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest(HOT) : null;
    if (!t || t.matches(PLAIN) || t.getAttribute("data-cursor") === "none") return;
    var x = e.clientX, y = e.clientY;
    if (e.detail === 0 || (x === 0 && y === 0)) {
      var r = t.getBoundingClientRect();
      x = r.left + r.width / 2; y = r.top + r.height / 2;
    }
    ping(x, y);
    snd("press");
  });

  /* ---------- cursor chrome: ring, reticle brackets, verb ---------- */
  var ring = null, verb = null, bks = [], fbks = [];
  function bracket(cls) {
    var b = document.createElement("div");
    b.className = "c-bk " + cls;
    b.style.opacity = "0";
    b.setAttribute("aria-hidden", "true");
    body.appendChild(b);
    return { el: b, x: mx, y: my, o: 0, cls: cls };
  }
  var CORNERS = ["b-tl", "b-tr", "b-bl", "b-br"];
  if (fine) {
    ring = document.createElement("div");
    ring.className = "c-ring";
    ring.setAttribute("aria-hidden", "true");
    body.appendChild(ring);
    verb = document.createElement("div");
    verb.className = "c-verb";
    verb.setAttribute("aria-hidden", "true");
    body.appendChild(verb);
    CORNERS.forEach(function (c) { bks.push(bracket(c)); });
  }
  CORNERS.forEach(function (c) { fbks.push(bracket(c + " fb")); });

  /* keyboard focus gets the same reticle, snapped, no mouse required */
  var focusEl = null;
  document.addEventListener("focusin", function (e) {
    var t = e.target.closest ? e.target.closest(HOT) : null;
    focusEl = t && t.matches(":focus-visible") && !t.matches(PLAIN) ? t : null;
  });
  document.addEventListener("focusout", function () { focusEl = null; });

  function cornerXY(cls, r) {
    return [
      cls.indexOf("l") === 3 ? r.left - PAD : r.right + PAD - BK,
      cls.indexOf("t") === 2 ? r.top - PAD : r.bottom + PAD - BK
    ];
  }

  var rx = mx, ry = my, last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;

    /* cursor-side chrome */
    if (fine && ring) {
      var k = 1 - Math.exp(-dt * 18);
      rx += (mx - rx) * k;
      ry += (my - ry) * k;

      var rect = null, vword = "";
      if (hotEl) {
        var hr = hotEl.getBoundingClientRect();
        if (hr.width <= 720 && hr.height <= 400) rect = hr;
        vword = verbFor(hotEl);
      }

      var size = hotEl && !rect ? 34 : rect ? 14 : 20;
      ring.style.width = size + "px";
      ring.style.height = size + "px";
      ring.style.left = rx + "px";
      ring.style.top = ry + "px";
      ring.style.opacity = rect ? "0.25" : "";

      var kb = 1 - Math.exp(-dt * 16);
      bks.forEach(function (b) {
        var tx, ty, to;
        if (rect) {
          var c = cornerXY(b.cls, rect);
          tx = c[0]; ty = c[1]; to = 1;
        } else {
          tx = rx - BK / 2; ty = ry - BK / 2; to = 0;
        }
        b.x += (tx - b.x) * kb;
        b.y += (ty - b.y) * kb;
        b.o += (to - b.o) * kb;
        b.el.style.left = b.x + "px";
        b.el.style.top = b.y + "px";
        b.el.style.opacity = b.o.toFixed(2);
      });

      if (vword) {
        verb.textContent = vword;
        verb.classList.add("on");
        verb.style.left = rx + 16 + "px";
        verb.style.top = ry + 20 + "px";
      } else {
        verb.classList.remove("on");
      }
    }

    /* focus reticle, snapped each frame so it survives scrolling */
    var fr = focusEl ? focusEl.getBoundingClientRect() : null;
    fbks.forEach(function (b) {
      if (fr) {
        var c = cornerXY(b.cls, fr);
        b.el.style.left = c[0] + "px";
        b.el.style.top = c[1] + "px";
        b.el.style.opacity = "1";
      } else {
        b.el.style.opacity = "0";
      }
    });

    /* element physics */
    LIVE.forEach(function (st, el) {
      var ke = 1 - Math.exp(-dt * 14);
      st.tx += (st.ttx - st.tx) * ke;
      st.ty += (st.tty - st.ty) * ke;
      st.s += (st.ts - st.s) * ke;
      var resting = Math.abs(st.tx) < 0.05 && Math.abs(st.ty) < 0.05 && Math.abs(st.s - 1) < 0.002;
      if (resting && st.ttx === 0 && st.tty === 0 && st.ts === 1) {
        if (el.style.transform) el.style.transform = "";
        if (el !== hotEl && el !== pressEl) LIVE.delete(el);
      } else if (st.ok) {
        el.style.transform = "translate3d(" + st.tx.toFixed(2) + "px," + st.ty.toFixed(2) + "px,0) scale(" + st.s.toFixed(3) + ")";
      }
    });
  }
  requestAnimationFrame(frame);
})();
