/* yashb.me v4 "Convergence" · GPU particle field.
   Noise becomes structure: particles converge from chaos into targets
   (name, loss curve, constellation, checkmark) as you move through the page.
   Exposes window.FIELD; site.js decides when to init and drives the uniforms. */

import * as THREE from "../vendor/three.module.min.js";

(function () {
  "use strict";

  var SIMPLEX = [
    "vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}",
    "vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}",
    "vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}",
    "vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}",
    "float snoise(vec3 v){",
    "  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);",
    "  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);",
    "  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);",
    "  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;",
    "  i=mod289(i);",
    "  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));",
    "  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;",
    "  vec4 j=p-49.0*floor(p*ns.z*ns.z);",
    "  vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);",
    "  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);",
    "  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);",
    "  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));",
    "  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;",
    "  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);",
    "  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));",
    "  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;",
    "  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;",
    "  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));",
    "}"
  ].join("\n");

  var VERT = [
    "attribute vec3 aSeed;",
    "attribute vec3 aTargetA;",
    "attribute vec3 aTargetB;",
    "attribute float aTint;",
    "uniform float uTime;",
    "uniform float uConverge;",
    "uniform float uMorph;",
    "uniform vec2 uMouse;",
    "uniform float uMouseOn;",
    "uniform float uTurb;",
    "uniform float uSize;",
    "uniform vec2 uBounds;",
    "varying float vTint;",
    "varying float vFade;",
    SIMPLEX,
    "void main(){",
    "  vTint=aTint;",
    "  float t=uTime*0.08;",
    "  vec3 s=aSeed*7.3;",
    "  vec3 drift=vec3(snoise(s+vec3(t,0.0,0.0)),snoise(s+vec3(0.0,t,13.7)),snoise(s+vec3(9.2,0.0,t))*0.4);",
    "  vec3 chaos=vec3((aSeed.x*2.0-1.0)*uBounds.x*0.55,(aSeed.y*2.0-1.0)*uBounds.y*0.55,(aSeed.z*2.0-1.0)*120.0)+drift*90.0;",
    "  vec3 target=mix(aTargetA,aTargetB,uMorph);",
    "  target+=drift*(3.0+uTurb*55.0);",
    "  vec3 pos=mix(chaos,target,uConverge);",
    "  vec2 dm=pos.xy-uMouse;",
    "  float md=length(dm);",
    "  float force=exp(-md*0.011)*60.0*uMouseOn;",
    "  pos.xy+=(md>0.001?normalize(dm):vec2(0.0))*force;",
    "  vFade=0.55+0.45*snoise(s+vec3(t*2.0,4.2,8.4));",
    "  vec4 mv=modelViewMatrix*vec4(pos,1.0);",
    "  gl_Position=projectionMatrix*mv;",
    "  gl_PointSize=uSize*(0.6+0.8*aSeed.x);",
    "}"
  ].join("\n");

  var FRAG = [
    "uniform vec3 uColInk;",
    "uniform vec3 uColAccent;",
    "uniform float uAlpha;",
    "varying float vTint;",
    "varying float vFade;",
    "void main(){",
    "  vec2 c=gl_PointCoord-0.5;",
    "  float d=length(c);",
    "  float a=smoothstep(0.5,0.32,d)*uAlpha*vFade;",
    "  if(a<0.01) discard;",
    "  vec3 col=mix(uColInk,uColAccent,step(0.88,vTint));",
    "  gl_FragColor=vec4(col,a);",
    "}"
  ].join("\n");

  function cssColor(name) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return new THREE.Color(v || "#898781");
  }

  function makeState() {
    return {
      supported: (function () {
        try {
          var c = document.createElement("canvas");
          return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
        } catch (e) { return false; }
      })(),
      ready: false,
      renderer: null,
      scene: null,
      camera: null,
      points: null,
      uniforms: null,
      count: 0,
      targets: {},
      current: "name",
      raf: null,
      tweens: []
    };
  }

  var S = makeState();

  /* --- target generation: rasterize shapes, sample filled pixels --- */

  function samplePixels(draw, w, h, step) {
    var cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    var ctx = cv.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, w, h);
    draw(ctx, w, h);
    var data = ctx.getImageData(0, 0, w, h).data;
    var pts = [];
    for (var y = 0; y < h; y += step) {
      for (var x = 0; x < w; x += step) {
        if (data[(y * w + x) * 4 + 3] > 120) pts.push([x - w / 2, h / 2 - y]);
      }
    }
    return pts;
  }

  function normalize(pts) {
    var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    pts.forEach(function (p) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    });
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    return {
      pts: pts.map(function (p) { return [p[0] - cx, p[1] - cy]; }),
      w: Math.max(1, maxX - minX),
      h: Math.max(1, maxY - minY)
    };
  }

  function placed(pts, maxW, maxH, offX, offY, count, zSpread, jitter) {
    var n = normalize(pts);
    var s = Math.min(maxW / n.w, maxH / n.h);
    var arr = new Float32Array(count * 3);
    var j = jitter || 2.6;
    for (var i = 0; i < count; i++) {
      var p = n.pts[(Math.random() * n.pts.length) | 0] || [0, 0];
      arr[i * 3] = p[0] * s + (offX || 0) + (Math.random() - 0.5) * j;
      arr[i * 3 + 1] = p[1] * s + (offY || 0) + (Math.random() - 0.5) * j;
      arr[i * 3 + 2] = (Math.random() - 0.5) * (zSpread || 24);
    }
    return arr;
  }

  function buildTargets(vw, vh, count) {
    var t = {};

    /* name: two lines, bbox-normalized then fitted to the hero area */
    var namePts = samplePixels(function (ctx, w, h) {
      ctx.fillStyle = "#000";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = 'bold 200px "Space Grotesk", system-ui, sans-serif';
      var m = ctx.measureText("BAMBHROLIYA");
      var size = Math.floor(200 * (w * 0.94) / m.width);
      ctx.font = "bold " + size + 'px "Space Grotesk", system-ui, sans-serif';
      ctx.fillText("YASH", w / 2, h * 0.27);
      ctx.fillText("BAMBHROLIYA", w / 2, h * 0.73);
    }, 1600, 560, 3);
    t.name = placed(namePts, vw * 0.88, vh * 0.44, 0, vh * 0.03, count, 26, 3.2);

    /* loss curve: descending exponential band */
    var curvePts = [];
    var cw = vw * 0.72, ch = vh * 0.5;
    for (var i = 0; i < 3200; i++) {
      var x = i / 3200;
      var y = Math.exp(-3.1 * x);
      var jitterY = (Math.random() - 0.5) * 0.055;
      curvePts.push([(x - 0.5) * cw, (y - 0.42 + jitterY) * ch]);
    }
    var curveArr = new Float32Array(count * 3);
    for (var j = 0; j < count; j++) {
      var p = curvePts[(Math.random() * curvePts.length) | 0];
      curveArr[j * 3] = p[0] + (Math.random() - 0.5) * 4;
      curveArr[j * 3 + 1] = p[1] + (Math.random() - 0.5) * 4;
      curveArr[j * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    t.curve = curveArr;

    /* constellation: seeded nodes, edges to two nearest */
    var rng = (function (seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; })(42);
    var nodes = [];
    for (var n = 0; n < 22; n++) {
      nodes.push([(rng() - 0.5) * vw * 0.7, (rng() - 0.5) * vh * 0.55]);
    }
    var graphPts = [];
    nodes.forEach(function (a, ai) {
      for (var k = 0; k < 60; k++) {
        var ang = rng() * 6.283, r = rng() * 9;
        graphPts.push([a[0] + Math.cos(ang) * r, a[1] + Math.sin(ang) * r]);
      }
      var dists = nodes.map(function (b, bi) {
        return [bi, ai === bi ? 1e9 : Math.hypot(a[0] - b[0], a[1] - b[1])];
      }).sort(function (p, q) { return p[1] - q[1]; });
      for (var e = 0; e < 2; e++) {
        var b = nodes[dists[e][0]];
        for (var s = 0; s < 34; s++) {
          var f = s / 34;
          graphPts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
        }
      }
    });
    t.graph = fillTargetsFromRaw(graphPts, count, 40);

    /* checkmark */
    var checkPts = samplePixels(function (ctx, w, h) {
      ctx.fillStyle = "#000";
      ctx.font = 'bold 360px "Space Grotesk", system-ui, sans-serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("✓", w / 2, h / 2);
    }, 520, 520, 3);
    t.check = placed(checkPts, Math.min(vw, vh) * 0.5, Math.min(vw, vh) * 0.5, 0, 0, count, 24, 3);

    return t;
  }

  function fillTargetsFromRaw(pts, count, zSpread) {
    var arr = new Float32Array(count * 3);
    for (var i = 0; i < count; i++) {
      var p = pts[(Math.random() * pts.length) | 0] || [0, 0];
      arr[i * 3] = p[0] + (Math.random() - 0.5) * 2;
      arr[i * 3 + 1] = p[1] + (Math.random() - 0.5) * 2;
      arr[i * 3 + 2] = (Math.random() - 0.5) * zSpread;
    }
    return arr;
  }

  /* --- tiny tween (no gsap dependency inside the module) --- */

  function tween(obj, key, to, ms, ease) {
    S.tweens = S.tweens.filter(function (t) { return !(t.obj === obj && t.key === key); });
    S.tweens.push({ obj: obj, key: key, from: obj[key], to: to, t0: performance.now(), ms: ms, ease: ease || function (x) { return 1 - Math.pow(1 - x, 3); } });
  }

  function runTweens(now) {
    S.tweens = S.tweens.filter(function (t) {
      var x = Math.min(1, (now - t.t0) / t.ms);
      t.obj[t.key] = t.from + (t.to - t.from) * t.ease(x);
      return x < 1;
    });
  }

  /* --- public API --- */

  window.FIELD = {
    supported: S.supported,

    init: function (opts) {
      if (!S.supported || S.ready) return Promise.resolve(false);
      var canvas = opts.canvas;
      var vw = window.innerWidth, vh = window.innerHeight;
      var coarse = vw < 768 || (navigator.deviceMemory && navigator.deviceMemory <= 4);
      S.count = coarse ? 18000 : 60000;

      S.renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false, powerPreference: "high-performance" });
      S.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      S.renderer.setSize(vw, vh, false);

      S.scene = new THREE.Scene();
      S.camera = new THREE.OrthographicCamera(-vw / 2, vw / 2, vh / 2, -vh / 2, -1000, 1000);

      var geo = new THREE.BufferGeometry();
      var seeds = new Float32Array(S.count * 3);
      var tints = new Float32Array(S.count);
      var pos = new Float32Array(S.count * 3);
      for (var i = 0; i < S.count; i++) {
        seeds[i * 3] = Math.random();
        seeds[i * 3 + 1] = Math.random();
        seeds[i * 3 + 2] = Math.random();
        tints[i] = Math.random();
      }
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 3));
      geo.setAttribute("aTint", new THREE.BufferAttribute(tints, 1));
      geo.setAttribute("aTargetA", new THREE.BufferAttribute(new Float32Array(S.count * 3), 3));
      geo.setAttribute("aTargetB", new THREE.BufferAttribute(new Float32Array(S.count * 3), 3));

      S.uniforms = {
        uTime: { value: 0 },
        uConverge: { value: 0 },
        uMorph: { value: 0 },
        uMouse: { value: new THREE.Vector2(9999, 9999) },
        uMouseOn: { value: 0 },
        uTurb: { value: 0 },
        uSize: { value: (coarse ? 1.7 : 2.0) * Math.min(window.devicePixelRatio || 1, 2) },
        uBounds: { value: new THREE.Vector2(vw, vh) },
        uColInk: { value: cssColor("--ink-3") },
        uColAccent: { value: cssColor("--accent") },
        uAlpha: { value: 0.72 }
      };

      var mat = new THREE.ShaderMaterial({
        uniforms: S.uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false
      });

      S.points = new THREE.Points(geo, mat);
      S.scene.add(S.points);

      var self = this;
      return document.fonts.ready.then(function () {
        S.targets = buildTargets(vw, vh, S.count);
        geo.getAttribute("aTargetA").array.set(S.targets.name);
        geo.getAttribute("aTargetA").needsUpdate = true;
        S.current = "name";
        S.ready = true;
        if (S.pending) { self.setConverge(S.pending[0], S.pending[1]); S.pending = null; }

        var themeWatch = new MutationObserver(function () { self.refreshColors(); });
        themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

        var resizeT = null;
        window.addEventListener("resize", function () {
          clearTimeout(resizeT);
          resizeT = setTimeout(function () { self._resize(); }, 250);
        });

        document.addEventListener("visibilitychange", function () {
          if (document.hidden) { cancelAnimationFrame(S.raf); S.raf = null; }
          else if (!S.raf) self._loop();
        });

        self._fps = { frames: 0, last: performance.now(), lowStreak: 0 };
        self._loop();
        return true;
      });
    },

    _loop: function () {
      var self = this;
      var start = null;
      function frame(now) {
        S.raf = requestAnimationFrame(frame);
        if (start === null) start = now;
        S.uniforms.uTime.value = (now - start) / 1000;
        runTweens(now);
        S.renderer.render(S.scene, S.camera);
        /* adaptive: halve draw range on sustained low fps */
        var f = self._fps;
        f.frames++;
        if (now - f.last >= 1000) {
          if (f.frames < 38) { f.lowStreak++; } else { f.lowStreak = 0; }
          if (f.lowStreak >= 3 && S.points.geometry.drawRange.count === Infinity) {
            S.points.geometry.setDrawRange(0, Math.floor(S.count / 2));
          }
          self.fps = f.frames;
          f.frames = 0;
          f.last = now;
        }
      }
      S.raf = requestAnimationFrame(frame);
    },

    _resize: function () {
      if (!S.ready) return;
      var vw = window.innerWidth, vh = window.innerHeight;
      S.renderer.setSize(vw, vh, false);
      S.camera.left = -vw / 2; S.camera.right = vw / 2;
      S.camera.top = vh / 2; S.camera.bottom = -vh / 2;
      S.camera.updateProjectionMatrix();
      S.uniforms.uBounds.value.set(vw, vh);
      S.targets = buildTargets(vw, vh, S.count);
      var a = S.points.geometry.getAttribute("aTargetA");
      a.array.set(S.targets[S.current]);
      a.needsUpdate = true;
      S.uniforms.uMorph.value = 0;
    },

    setConverge: function (v, ms) {
      if (!S.uniforms) return;
      if (!S.ready) { S.pending = [v, ms]; return; }
      if (ms) tween(S.uniforms.uConverge, "value", v, ms);
      else S.uniforms.uConverge.value = v;
    },

    morphTo: function (name, ms) {
      if (!S.ready || S.current === name || !S.targets[name]) return;
      var geo = S.points.geometry;
      /* bake current interpolated state into A, put new target into B */
      var a = geo.getAttribute("aTargetA");
      var b = geo.getAttribute("aTargetB");
      var m = S.uniforms.uMorph.value;
      if (m > 0) {
        var cur = S.targets[S.current];
        for (var i = 0; i < a.array.length; i++) {
          a.array[i] = a.array[i] + (b.array[i] - a.array[i]) * m;
        }
      }
      b.array.set(S.targets[name]);
      a.needsUpdate = true;
      b.needsUpdate = true;
      S.uniforms.uMorph.value = 0;
      tween(S.uniforms.uMorph, "value", 1, ms || 1400, function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; });
      S.current = name;
    },

    setPointer: function (clientX, clientY, active) {
      if (!S.uniforms) return;
      S.uniforms.uMouse.value.set(clientX - window.innerWidth / 2, window.innerHeight / 2 - clientY);
      tween(S.uniforms.uMouseOn, "value", active ? 1 : 0, 300);
    },

    setTurbulence: function (v) {
      if (S.uniforms) S.uniforms.uTurb.value = Math.min(Math.abs(v) / 60, 1);
    },

    refreshColors: function () {
      if (!S.uniforms) return;
      S.uniforms.uColInk.value = cssColor("--ink-3");
      S.uniforms.uColAccent.value = cssColor("--accent");
    },

    stats: function () {
      return { particles: S.points ? (S.points.geometry.drawRange.count === Infinity ? S.count : S.points.geometry.drawRange.count) : 0, fps: this.fps || 0, current: S.current };
    }
  };

  document.dispatchEvent(new CustomEvent("field:module-ready"));
})();
