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
    mouse: { x: 0, y: 0, on: false, sx: 0, sy: 0 },
    ball: null, ballGlow: null, trail: null, trailPts: [],
    terrain: null, terrainWire: null, net: null, pulseMats: [],
    path: null, camCurve: null, coarse: false, verts: 0
  };

  function cssColor(name) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return new THREE.Color(v || "#888888");
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

  /* the descent path: high ridge to the basin, along which the ball rolls */
  function pathPoint(t) {
    var x = -55 + t * 95;
    var z = -20 + Math.sin(t * Math.PI * 1.35) * 22 - t * 6;
    return new THREE.Vector2(x, z);
  }

  function terrainHeight(x, z) {
    var h = fbm(x * 0.035 + 7.3, z * 0.035 + 2.9) * 26 - 6;
    /* carve the valley along the descent path so the ball reads naturally */
    var best = 1e9;
    for (var i = 0; i <= 20; i++) {
      var p = pathPoint(i / 20);
      var dx = x - p.x, dz = z - p.y;
      var d = dx * dx + dz * dz;
      if (d < best) best = d;
    }
    var carve = Math.exp(-best / 260);
    var descent = 18 - 0 * x;
    h = h * (1 - carve * 0.72);
    /* overall slope: the far left is high ground, the basin sits right */
    h += (1 - (x + 80) / 160) * 14;
    return h;
  }

  function buildTerrain() {
    var segX = S.coarse ? 90 : 150, segZ = S.coarse ? 54 : 90;
    var geo = new THREE.PlaneGeometry(190, 110, segX, segZ);
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
    glow.scale.set(10, 10, 1);
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

  function ballPos(t) {
    var p = pathPoint(t);
    var v = new THREE.Vector3(p.x, 0, p.y);
    v.y = terrainHeight(p.x, p.y) + 1.6;
    v.add(S.terrain.position);
    return v;
  }

  /* ---------- the network (interlude scene) ---------- */

  function buildNet(dims) {
    var group = new THREE.Group();
    var accent = cssColor("--accent"), ink = cssColor("--ink-2");
    var mats = [];

    function pointsLayer(positions, size, color) {
      var geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      var m = new THREE.PointsMaterial({
        color: color, size: size, map: glowTexture(),
        transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending,
        depthWrite: false, sizeAttenuation: true
      });
      mats.push(m);
      return new THREE.Points(geo, m);
    }

    /* input: character grid */
    var inN = 80, inPos = new Float32Array(inN * 3), inPts = [];
    for (var i = 0; i < inN; i++) {
      var gx = (i % 10) - 4.5, gy = Math.floor(i / 10) - 3.5;
      inPos[i * 3] = gx * 3.2; inPos[i * 3 + 1] = gy * 3.2; inPos[i * 3 + 2] = 0;
      inPts.push(new THREE.Vector3(gx * 3.2, gy * 3.2, 0));
    }
    group.add(pointsLayer(inPos, 2.2, ink));

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
    group.add(pointsLayer(hidPos, 2.8, accent));

    /* output: vocab column */
    var outN = dims && dims.vocab || 79;
    var outPos = new Float32Array(outN * 3), outPts = [];
    for (i = 0; i < outN; i++) {
      var oy = (i - outN / 2) * 0.75;
      var ov = new THREE.Vector3((i % 3 - 1) * 2.2, oy, 84);
      outPos[i * 3] = ov.x; outPos[i * 3 + 1] = ov.y; outPos[i * 3 + 2] = ov.z;
      outPts.push(ov);
    }
    group.add(pointsLayer(outPos, 2.2, ink));

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

    group.position.set(0, 6, -290);
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

  function loop(now) {
    S.raf = requestAnimationFrame(loop);
    var t = (now - S.t0) / 1000;

    /* smooth the driven values */
    S.trainingShown += (S.training - S.trainingShown) * 0.04;
    S.mouse.sx += (S.mouse.x - S.mouse.sx) * 0.06;
    S.mouse.sy += (S.mouse.y - S.mouse.sy) * 0.06;

    /* ball descends the carved valley as the real loss falls */
    if (S.ball) {
      var bp = ballPos(Math.min(0.999, S.trainingShown));
      bp.y += Math.sin(t * 2.4) * 0.35 + 0.2;
      S.ball.position.copy(bp);
      var pulse = 0.8 + Math.sin(t * 3.1) * 0.15;
      S.ballGlow.material.opacity = 0.55 + pulse * 0.3;

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

    /* net pulses while anything is alive */
    for (i = 0; i < S.pulseMats.length; i++) {
      var m = S.pulseMats[i];
      m.opacity = m.userData.base * (0.7 + 0.5 * Math.sin(t * 2 + i * 1.7));
    }
    if (S.net) S.net.rotation.z = Math.sin(t * 0.12) * 0.05;

    /* camera: hero rig blended into the interlude fly-through */
    var cam = S.camera;
    if (S.interlude > 0.001) {
      var p = Math.min(1, S.interlude);
      var eased = p;
      cam.position.copy(S.camCurve.getPointAt(eased));
      var look = new THREE.Vector3().copy(S.net.position);
      look.z += 40 + eased * 70;
      cam.lookAt(look);
    } else {
      var rx = S.mouse.on ? S.mouse.sx : 0;
      var ry = S.mouse.on ? S.mouse.sy : 0;
      cam.position.set(
        HERO_POS.x + rx * 7,
        HERO_POS.y + 10 * S.recede - ry * 4,
        HERO_POS.z + S.recede * 26
      );
      var lk = HERO_LOOK.clone();
      lk.y -= S.recede * 8;
      cam.lookAt(lk);
    }

    /* the terrain steps back and dims once you scroll past the hero */
    if (S.terrainWire) {
      S.terrainWire.material.opacity = 0.32 * (1 - S.recede * 0.75);
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
    setRecede: function (r) { S.recede = Math.max(0, Math.min(1, r)); },
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
    },

    stats: function () {
      return { verts: S.verts, fps: 0, mode: S.interlude > 0.01 ? "net" : "terrain" };
    }
  };

  document.dispatchEvent(new CustomEvent("scene:module-ready"));
})();
