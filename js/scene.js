/* yashb.me v4 "Descent" · the 3D layer.
   A loss-landscape terrain behind the hero: a glowing marker descends the
   valley as the model training in this tab actually improves. Scrolling into
   the interlude flies the camera through the network architecture itself.
   Exposes window.SCENE; site.js decides when to init and drives the state. */

import * as THREE from "../vendor/three.module.min.js";

(function () {
  "use strict";

  var S = {
    ready: false, canvas: null, renderer: null, scene: null, camera: null,
    raf: null, t0: 0,
    training: 0, trainingShown: 0,
    interlude: 0, recede: 0,
    journey: 0, journeyShown: 0, lookBack: 0, lookShown: 0,
    demo: { mode: null, t: 0, aux: null },
    inspect: { on: false, blend: 0, kind: null, target: null, radius: 40, theta: 0, phi: 1.1, tTheta: 0, tPhi: 1.1, tRadius: 40 },
    netMats: [],
    netPts: {},
    mouse: { x: 0, y: 0, on: false, sx: 0, sy: 0 },
    ball: null, ballGlow: null, trail: null, trailPts: [],
    terrain: null, terrainWire: null, net: null, pulseMats: [],
    path: null, camCurve: null, coarse: false, verts: 0
  };

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function smoothstep(v) { v = clamp01(v); return v * v * (3 - 2 * v); }

  /* THREE.Color cannot parse oklch(), which is how the altitude drift writes
     the accent family; convert to hex here so the 3D layer keeps the dusk. */
  function oklchToHex(L, C, H) {
    var h = (H * Math.PI) / 180, a = C * Math.cos(h), b = C * Math.sin(h);
    var l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    var m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    var s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    var l = l_ * l_ * l_, m = m_ * m_ * m_, s = s_ * s_ * s_;
    var out = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    ].map(function (c) {
      c = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055;
      c = Math.max(0, Math.min(1, c));
      return ("0" + Math.round(c * 255).toString(16)).slice(-2);
    });
    return "#" + out.join("");
  }

  function cssColor(name) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888888";
    var m = v.match(/^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i);
    if (m) v = oklchToHex(parseFloat(m[1]) * (m[2] ? 0.01 : 1), parseFloat(m[3]), parseFloat(m[4]));
    return new THREE.Color(v);
  }

  function mode() {
    return getComputedStyle(document.documentElement).getPropertyValue("--mode").trim() || "dark";
  }

  /* deterministic value noise for the terrain heights */
  function hashNoise(x, y) {
    var s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function smoothNoise(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var a = hashNoise(xi, yi), b = hashNoise(xi + 1, yi);
    var c = hashNoise(xi, yi + 1), d = hashNoise(xi + 1, yi + 1);
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y) {
    return smoothNoise(x, y) * 0.55 + smoothNoise(x * 2.1, y * 2.1) * 0.28 + smoothNoise(x * 4.3, y * 4.3) * 0.17;
  }

  /* the descent path: high ridge to the basin. The ball (the model) and the
     camera (the reader) both travel it; the whole page is this one walk. */
  function pathPoint(t) {
    var x = -70 + t * 130;
    var z = -16 + Math.sin(t * Math.PI * 1.8) * 24 - t * 10;
    return new THREE.Vector2(x, z);
  }

  function terrainHeight(x, z) {
    var h = fbm(x * 0.035 + 7.3, z * 0.035 + 2.9) * 26 - 6;
    /* carve the valley along the descent path so the walk reads naturally */
    var best = 1e9;
    for (var i = 0; i <= 30; i++) {
      var p = pathPoint(i / 30);
      var dx = x - p.x, dz = z - p.y;
      var d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    var carve = Math.exp(-best / 260);
    h = h * (1 - carve * 0.72);
    /* overall slope: the far left is high ground, the basin sits right */
    h += (1 - (x + 95) / 190) * 16;
    return h;
  }

  function buildTerrain() {
    var segX = S.coarse ? 110 : 190, segZ = S.coarse ? 66 : 116;
    var geo = new THREE.PlaneGeometry(270, 165, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    var pos = geo.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, terrainHeight(x, z));
    }
    geo.computeVertexNormals();
    S.verts = pos.count;

    var group = new THREE.Group();
    /* solid dark fill occludes back-facing lines: the classic crisp wireframe */
    var fill = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: cssColor("--paper"), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
    }));
    var wire = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: cssColor("--ink-3"), wireframe: true, transparent: true, opacity: 0.32
    }));
    group.add(fill);
    group.add(wire);
    S.terrain = group;
    S.terrainWire = wire;
    group.position.set(0, -14, -30);
    return group;
  }

  function glowTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var ctx = c.getContext("2d");
    var g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  function buildBall() {
    var ball = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 20, 20),
      new THREE.MeshBasicMaterial({ color: cssColor("--accent") })
    );
    var glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: cssColor("--accent"),
      transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false
    }));
    glow.scale.set(13, 13, 1);
    ball.add(glow);
    S.ball = ball;
    S.ballGlow = glow;

    var trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(64 * 3), 3));
    S.trail = new THREE.Line(trailGeo, new THREE.LineBasicMaterial({
      color: cssColor("--accent"), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending
    }));
    S.trail.frustumCulled = false;
    return ball;
  }

  /* world-space position on the descent path */
  function pathPos3(t, lift) {
    var p = pathPoint(t);
    var v = new THREE.Vector3(p.x, 0, p.y);
    v.y = terrainHeight(p.x, p.y) + (lift || 0);
    v.add(S.terrain.position);
    return v;
  }

  function ballPos(t) {
    return pathPos3(t, 1.6);
  }

  /* ---------- the network (interlude scene) ---------- */

  var NET_SCALE = 0.55;

  function buildNet(dims) {
    var group = new THREE.Group();
    S.netPts = {};
    S.netMats = [];
    var accent = cssColor("--accent"), ink = cssColor("--ink-2");
    var mats = [];

    function pointsLayer(positions, size, color, key) {
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      var n = positions.length / 3;
      var cols = new Float32Array(n * 3);
      for (var ci = 0; ci < n * 3; ci++) cols[ci] = 0.62;
      geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
      var m = new THREE.PointsMaterial({
        color: color, size: size, map: glowTexture(), vertexColors: true,
        transparent: true, opacity: 1, blending: THREE.AdditiveBlending,
        depthWrite: false, sizeAttenuation: true
      });
      mats.push(m);
      S.netMats.push(m);
      if (key) S.netPts[key] = { geo: geo, n: n };
      return new THREE.Points(geo, m);
    }

    /* input: character grid */
    var inN = 80, inPos = new Float32Array(inN * 3), inPts = [];
    for (var i = 0; i < inN; i++) {
      var gx = (i % 10) - 4.5, gy = Math.floor(i / 10) - 3.5;
      inPos[i * 3] = gx * 3.2; inPos[i * 3 + 1] = gy * 3.2; inPos[i * 3 + 2] = 0;
      inPts.push(new THREE.Vector3(gx * 3.2, gy * 3.2, 0));
    }
    group.add(pointsLayer(inPos, 2.2, ink, "in"));

    /* hidden: a double ring, the recurrent block */
    var hidN = dims && dims.hidden || 128;
    var hidPos = new Float32Array(hidN * 3), hidPts = [];
    for (i = 0; i < hidN; i++) {
      var a = (i / hidN) * Math.PI * 2;
      var r = 13 + (i % 2) * 3.5;
      var v = new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 40 + (i % 4) * 1.2);
      hidPos[i * 3] = v.x; hidPos[i * 3 + 1] = v.y; hidPos[i * 3 + 2] = v.z;
      hidPts.push(v);
    }
    group.add(pointsLayer(hidPos, 2.8, accent, "hid"));

    /* output: vocab column */
    var outN = dims && dims.vocab || 79;
    var outPos = new Float32Array(outN * 3), outPts = [];
    for (i = 0; i < outN; i++) {
      var oy = (i - outN / 2) * 0.75;
      var ov = new THREE.Vector3((i % 3 - 1) * 2.2, oy, 84);
      outPos[i * 3] = ov.x; outPos[i * 3 + 1] = ov.y; outPos[i * 3 + 2] = ov.z;
      outPts.push(ov);
    }
    group.add(pointsLayer(outPos, 2.2, ink, "out"));

    /* connections: sampled, additive, pulsing */
    function wires(fromPts, toPts, count, opacity) {
      var arr = new Float32Array(count * 6);
      for (var w = 0; w < count; w++) {
        var f = fromPts[(Math.random() * fromPts.length) | 0];
        var t = toPts[(Math.random() * toPts.length) | 0];
        arr[w * 6] = f.x; arr[w * 6 + 1] = f.y; arr[w * 6 + 2] = f.z;
        arr[w * 6 + 3] = t.x; arr[w * 6 + 4] = t.y; arr[w * 6 + 5] = t.z;
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      var m = new THREE.LineBasicMaterial({
        color: accent, transparent: true, opacity: opacity, blending: THREE.AdditiveBlending, depthWrite: false
      });
      m.userData = { base: opacity };
      S.pulseMats.push(m);
      return new THREE.LineSegments(geo, m);
    }
    var wireCount = S.coarse ? 0.5 : 1;
    group.add(wires(inPts, hidPts, Math.round(420 * wireCount), 0.10));
    group.add(wires(hidPts, hidPts, Math.round(240 * wireCount), 0.14));
    group.add(wires(hidPts, outPts, Math.round(420 * wireCount), 0.10));

    /* the mind lives in the world now: hovering above the basin the
       descent walks toward, visible from the whole journey */
    group.position.set(58, 16, -72);
    group.scale.setScalar(NET_SCALE);
    S.net = group;
    return group;
  }

  /* camera rig */
  var HERO_POS = new THREE.Vector3(0, 16, 62);
  var HERO_LOOK = new THREE.Vector3(6, -4, -40);

  function buildCamPath() {
    var n = S.net.position;
    S.camCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 14, -60),
      new THREE.Vector3(n.x + 4, n.y + 4, n.z - 18),
      new THREE.Vector3(n.x, n.y, n.z + 40),
      new THREE.Vector3(n.x - 2, n.y + 2, n.z + 84 + 26)
    ]);
  }

  function netCenter() {
    var n = S.net.position;
    return new THREE.Vector3(n.x, n.y, n.z + 42 * NET_SCALE);
  }

  /* ---------- guided demos: light the layers, stage the camera ---------- */

  function setLayer(key, fn) {
    var L = S.netPts[key];
    if (!L) return;
    var att = L.geo.attributes.color;
    for (var i = 0; i < L.n; i++) {
      var v = Math.max(0.06, Math.min(1, fn(i)));
      att.setXYZ(i, v, v, v);
    }
    att.needsUpdate = true;
  }

  function resetLayers() {
    ["in", "hid", "out"].forEach(function (k) {
      setLayer(k, function () { return 0.62; });
    });
  }

  /* a soft window: 1 inside [a,b], eased at both edges */
  function win(t, a, b, e) {
    e = e || 0.06;
    return clamp01((t - a) / e) * clamp01((b - t) / e);
  }

  function applyPass(t, aux) {
    var inLit = win(t, 0.1, 0.52);
    setLayer("in", function (i) {
      return 0.28 + (aux && i === aux.inIdx ? inLit * 0.72 : 0);
    });
    var flare = win(t, 0.3, 0.62);
    setLayer("hid", function (i) {
      var ripple = Math.sin(i * 0.7 + t * 40) * 0.12;
      return 0.3 + flare * (0.55 + ripple);
    });
    var outLit = win(t, 0.58, 0.97);
    var probs = aux && aux.probs;
    var mx = aux && aux.maxProb || 1;
    setLayer("out", function (i) {
      var p = probs ? probs[i] / mx : 0;
      return 0.24 + outLit * p * 0.76;
    });
    /* wires hand the pulse forward */
    if (S.pulseMats.length >= 3) {
      S.pulseMats[0].opacity = 0.08 + win(t, 0.18, 0.4) * 0.4;
      S.pulseMats[1].opacity = 0.1 + win(t, 0.3, 0.58) * 0.45;
      S.pulseMats[2].opacity = 0.08 + win(t, 0.5, 0.75) * 0.4;
    }
  }

  function applyShot(t) {
    var third = function (i) { return win(t, 0.08 + i * 0.28, 0.34 + i * 0.28); };
    setLayer("in", function () { return 0.4 + third(0) * 0.6; });
    setLayer("hid", function () { return 0.4 + third(1) * 0.6; });
    setLayer("out", function () { return 0.4 + third(2) * 0.6; });
    if (S.pulseMats.length >= 3) {
      S.pulseMats[0].opacity = 0.08 + third(0) * 0.3;
      S.pulseMats[1].opacity = 0.1 + third(1) * 0.35;
      S.pulseMats[2].opacity = 0.08 + third(2) * 0.3;
    }
  }

  function loop(now) {
    S.raf = requestAnimationFrame(loop);
    var t = (now - S.t0) / 1000;

    /* smooth the driven values */
    S.trainingShown += (S.training - S.trainingShown) * 0.04;
    S.journeyShown += (S.journey - S.journeyShown) * 0.04;
    S.lookShown += (S.lookBack - S.lookShown) * 0.045;
    S.mouse.sx += (S.mouse.x - S.mouse.sx) * 0.06;
    S.mouse.sy += (S.mouse.y - S.mouse.sy) * 0.06;

    /* ball descends the carved valley as the real loss falls */
    if (S.ball) {
      var bp = ballPos(Math.min(0.999, S.trainingShown));
      bp.y += Math.sin(t * 2.4) * 0.35 + 0.2;
      S.ball.position.copy(bp);
      var pulse = 0.8 + Math.sin(t * 3.1) * 0.15;
      S.ballGlow.material.opacity = (0.55 + pulse * 0.3) * (S.glowDim || 1);

      S.trailPts.push(bp.clone());
      if (S.trailPts.length > 64) S.trailPts.shift();
      var tp = S.trail.geometry.attributes.position;
      for (var i = 0; i < 64; i++) {
        var p = S.trailPts[Math.min(i, S.trailPts.length - 1)] || bp;
        tp.setXYZ(i, p.x, p.y + 0.3, p.z);
      }
      tp.needsUpdate = true;
      S.trail.geometry.setDrawRange(0, S.trailPts.length);
    }

    /* the network is a citizen of the landscape: always there, pulsing
       above the basin. Its wobble pauses while it is being staged. */
    var demoNet = S.demo.mode === "pass" || S.demo.mode === "shot";
    var inspectNet = S.inspect.kind === "net" && (S.inspect.on || S.inspect.blend > 0.01);
    var flightOn = S.interlude > 0.001;
    if (S.net) {
      S.net.visible = true;
      for (i = 0; i < S.pulseMats.length; i++) {
        var m = S.pulseMats[i];
        m.opacity = m.userData.base * (0.7 + 0.5 * Math.sin(t * 2 + i * 1.7));
      }
      S.net.rotation.z = (demoNet || inspectNet) ? 0 : Math.sin(t * 0.12) * 0.05;
    }

    /* camera: the reader walks the same valley the model descends.
       interlude fly-through > journey path rig > hero vista, blended. */
    var cam = S.camera;
    if (flightOn) {
      var p = Math.min(1, S.interlude);
      cam.position.copy(S.camCurve.getPointAt(p));
      var look = new THREE.Vector3().copy(S.net.position);
      look.z += 40 + p * 70;
      cam.lookAt(look);
    } else {
      var rx = S.mouse.on ? S.mouse.sx : 0;
      var ry = S.mouse.on ? S.mouse.sy : 0;
      var j = clamp01(S.journeyShown);

      /* path rig: third person, above and behind the walk position.
         Short tangent and look-ahead windows keep meanders from whipping
         the view; the smoothing above does the rest. */
      var cur = pathPos3(j, 0);
      var ahead = pathPos3(Math.min(1, j + 0.035), 0);
      var behind = pathPos3(Math.max(0, j - 0.035), 0);
      var dir = new THREE.Vector3().subVectors(ahead, behind);
      if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
      dir.normalize();
      var pathPos = cur.clone().addScaledVector(dir, -14);
      pathPos.y = Math.max(pathPos.y + 10, cur.y + 7.5);
      var lookAhead = pathPos3(Math.min(1, j + 0.07), 2);
      var lookBehind = pathPos3(Math.max(0, j - 0.1), 4);
      var pathLook = lookAhead.lerp(lookBehind, clamp01(S.lookShown));

      /* hero vista holds the top of the page, then hands over to the walk
         across the whole approach to the replay, never in one scroll tick */
      var w = smoothstep(j / 0.16);
      var pos = new THREE.Vector3(HERO_POS.x, HERO_POS.y, HERO_POS.z).lerp(pathPos, w);
      var lk = HERO_LOOK.clone().lerp(pathLook, w);
      pos.x += rx * (7 - 4.5 * w);
      pos.y -= ry * (4 - 2.5 * w);

      /* guided demos borrow the camera and hand it back */
      if (S.demo.mode) {
        var dt = S.demo.t;
        /* ramp in and hold: the stage is handed to the visitor at the end,
           so the camera never retreats on its own */
        var dw = smoothstep(Math.min(dt / 0.12, 1));
        var dPos = null, dLook = null;
        var nc = netCenter();
        if (S.demo.mode === "pass") {
          dPos = new THREE.Vector3(nc.x - 88, nc.y + 7, nc.z);
          dLook = nc.clone();
          applyPass(dt, S.demo.aux);
        } else if (S.demo.mode === "shot") {
          var sa = -0.4 + dt * 0.55;
          dPos = new THREE.Vector3(nc.x + Math.sin(sa) * 95, nc.y + 12 + dt * 6, nc.z + Math.cos(sa) * 95);
          dLook = nc.clone();
          applyShot(dt);
        } else if (S.demo.mode === "orbitBall") {
          var bp2 = ballPos(Math.min(0.999, S.trainingShown));
          var oa = dt * Math.PI * 2;
          dPos = new THREE.Vector3(bp2.x + Math.sin(oa) * 20, bp2.y + 9, bp2.z + Math.cos(oa) * 20);
          dLook = bp2;
        }
        if (dPos) {
          pos.lerp(dPos, dw);
          lk.lerp(dLook, dw);
        }
      }

      /* free inspection: a damped orbit the visitor drives */
      var I = S.inspect;
      if (I.on || I.blend > 0.001) {
        I.blend += ((I.on ? 1 : 0) - I.blend) * 0.09;
        I.theta += (I.tTheta - I.theta) * 0.12;
        I.phi += (I.tPhi - I.phi) * 0.12;
        I.radius += (I.tRadius - I.radius) * 0.12;
        if (I.kind === "ball") I.target = ballPos(Math.min(0.999, S.trainingShown));
        if (I.target) {
          var iPos = new THREE.Vector3().setFromSphericalCoords(I.radius, I.phi, I.theta).add(I.target);
          pos.lerp(iPos, I.blend);
          lk.lerp(I.target, I.blend);
        }
        if (!I.on && I.blend < 0.01) { I.blend = 0; I.kind = null; }
      }

      cam.position.copy(pos);
      cam.lookAt(lk);
    }

    S.renderer.render(S.scene, S.camera);
  }

  window.SCENE = {
    supported: (function () {
      try {
        var c = document.createElement("canvas");
        return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
      } catch (e) { return false; }
    })(),

    init: function (opts) {
      if (S.ready) return Promise.resolve(true);
      try {
        S.canvas = opts.canvas;
        S.coarse = (navigator.deviceMemory !== undefined && navigator.deviceMemory <= 4) ||
                   window.matchMedia("(pointer: coarse)").matches;
        S.renderer = new THREE.WebGLRenderer({ canvas: S.canvas, alpha: true, antialias: !S.coarse, powerPreference: "high-performance" });
        S.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        S.renderer.setSize(window.innerWidth, window.innerHeight, false);
        S.scene = new THREE.Scene();
        S.scene.fog = new THREE.FogExp2(cssColor("--paper"), 0.0075);
        S.camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 600);
        S.camera.position.copy(HERO_POS);
        S.camera.lookAt(HERO_LOOK);

        S.scene.add(buildTerrain());
        S.scene.add(buildBall());
        S.scene.add(S.trail);
        S.scene.add(buildNet(opts.dims));
        buildCamPath();

        var self = this;
        window.addEventListener("resize", function () {
          S.renderer.setSize(window.innerWidth, window.innerHeight, false);
          S.camera.aspect = window.innerWidth / window.innerHeight;
          S.camera.updateProjectionMatrix();
        });
        document.addEventListener("visibilitychange", function () {
          if (document.hidden) { cancelAnimationFrame(S.raf); S.raf = null; }
          else if (!S.raf) { S.t0 = performance.now() - 1; S.raf = requestAnimationFrame(loop); }
        });
        var themeWatch = new MutationObserver(function () { self.refreshColors(); });
        themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

        S.ready = true;
        S.t0 = performance.now();
        S.raf = requestAnimationFrame(loop);
        return Promise.resolve(true);
      } catch (e) {
        return Promise.resolve(false);
      }
    },

    setTraining: function (v) { S.training = Math.max(S.training, Math.min(1, v)); },
    setInterlude: function (p) { S.interlude = p; },
    /* reader position along the descent, 0 hero to 1 contact; lookBack turns
       the camera up the valley for the how-far-we-came beat */
    setJourney: function (j, lookBack) {
      S.journey = Math.max(0, Math.min(1, j));
      S.lookBack = Math.max(0, Math.min(1, lookBack || 0));
    },
    setRecede: function (r) { S.recede = Math.max(0, Math.min(1, r)); },
    /* free inspection: enter from a demo's final frame, orbit, zoom, leave */
    inspectStart: function (kind) {
      if (!S.ready) return;
      var I = S.inspect;
      I.kind = kind;
      I.target = kind === "ball" ? ballPos(Math.min(0.999, S.trainingShown)) : netCenter();
      var sph = new THREE.Spherical().setFromVector3(S.camera.position.clone().sub(I.target));
      I.radius = I.tRadius = Math.max(6, sph.radius);
      I.theta = I.tTheta = sph.theta;
      I.phi = I.tPhi = Math.min(1.45, Math.max(0.3, sph.phi));
      I.on = true;
      I.blend = 1;
      /* the choreography is over; keep its lighting, drop its camera */
      S.demo.mode = null;
      S.demo.aux = null;
    },
    inspectMove: function (dx, dy) {
      var I = S.inspect;
      if (!I.on) return;
      I.tTheta -= dx * 0.005;
      I.tPhi = Math.min(1.45, Math.max(0.3, I.tPhi - dy * 0.004));
    },
    inspectZoom: function (dz) {
      var I = S.inspect;
      if (!I.on) return;
      var lim = I.kind === "ball" ? [7, 48] : [16, 110];
      I.tRadius = Math.min(lim[1], Math.max(lim[0], I.tRadius * (dz > 0 ? 1.09 : 0.92)));
    },
    inspectEnd: function () {
      S.inspect.on = false;
      resetLayers();
    },

    /* guided demos for the terminal: mode pass | shot | orbitBall, t 0..1 */
    demo: function (mode, t, aux) {
      if (!S.ready) return;
      if (!mode || t >= 1) {
        S.demo.mode = null;
        S.demo.aux = null;
        resetLayers();
        return;
      }
      if (aux && aux.probs && !aux.maxProb) {
        var mp = 0;
        for (var i = 0; i < aux.probs.length; i++) if (aux.probs[i] > mp) mp = aux.probs[i];
        aux.maxProb = mp || 1;
      }
      S.demo.mode = mode;
      S.demo.t = t;
      if (aux) S.demo.aux = aux;
    },
    setPointer: function (x, y, on) {
      S.mouse.on = on;
      S.mouse.x = (x / window.innerWidth - 0.5) * 2;
      S.mouse.y = (y / window.innerHeight - 0.5) * 2;
    },

    setDims: function (dims) {
      if (!S.ready || !dims) return;
      /* rebuild the net with the real trained dimensions */
      S.scene.remove(S.net);
      S.pulseMats = [];
      S.scene.add(buildNet(dims));
      buildCamPath();
    },

    refreshColors: function () {
      if (!S.ready) return;
      var paper = cssColor("--paper"), accent = cssColor("--accent"), ink3 = cssColor("--ink-3");
      S.scene.fog.color = paper;
      S.terrain.children[0].material.color = paper;
      S.terrain.children[1].material.color = ink3;
      S.ball.material.color = accent;
      S.ballGlow.material.color = accent;
      S.trail.material.color = accent;
      /* additive glow can only brighten: on the light theme it reads as a
         washed white blob, so the glow becomes a tinted normal-blend halo */
      var light = mode() === "light";
      var blend = light ? THREE.NormalBlending : THREE.AdditiveBlending;
      S.ballGlow.material.blending = blend;
      S.trail.material.blending = blend;
      S.ballGlow.material.needsUpdate = true;
      S.trail.material.needsUpdate = true;
      S.glowDim = light ? 0.35 : 1;
      S.ballGlow.scale.set(light ? 9 : 13, light ? 9 : 13, 1);
      S.trail.material.opacity = light ? 0.3 : 0.5;
      /* the always-visible net follows the same rule: additive bloom on
         dark, tinted normal blending on paper, and it drinks the accent */
      var ink2 = cssColor("--ink-2");
      (S.netMats || []).forEach(function (nm, i) {
        nm.blending = blend;
        nm.color = i === 1 ? accent : ink2;
        nm.opacity = light ? 0.75 : 1;
        nm.needsUpdate = true;
      });
      S.pulseMats.forEach(function (pm) {
        pm.blending = blend;
        pm.color = accent;
        pm.needsUpdate = true;
      });
    },

    stats: function () {
      return { verts: S.verts, fps: 0, mode: S.interlude > 0.01 ? "net" : "terrain" };
    }
  };

  document.dispatchEvent(new CustomEvent("scene:module-ready"));
})();
