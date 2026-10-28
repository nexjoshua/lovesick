/* ==========================================================================
   LOVESICK WEDDINGS — main.js (v2)
   Vanilla JS. Three.js (r128, loaded from cdnjs on the home page only)
   powers the hero camera.
   Modules: Loader · Header · Hero 3D camera · Cover-flow · Floating gallery ·
            Tilt cards · Lightbox · Portfolio filters · Cursor label · Forms
   No scroll-triggered animations (per client brief).
   ========================================================================== */

/* ---------- CONFIG ------------------------------------------------------- */
const CONFIG = {
  /* GHL Inbound Webhooks, one per form.
     Each key must match the form's data-ghl attribute exactly (note the en dash "–"). */
  ghlWebhooks: {
    "Home – Check your date": "https://services.leadconnectorhq.com/hooks/t9buh8VifOKEOEwnYhQF/webhook-trigger/f16954e5-d2c2-4a06-9e33-26c8b5c71d3b",
    "Contact – Book now":     "https://services.leadconnectorhq.com/hooks/t9buh8VifOKEOEwnYhQF/webhook-trigger/b09dc17f-ccbd-49d0-8547-d26439e3fc66"
  },
  ghlWebhookUrl: "", // fallback for any future form not listed above
  thankYouRedirect: "", // optional, e.g. "thank-you.html"

  heroFrames: {
    count: 0,
    path: "assets/frames/camera_",
    pad: 3,
    ext: ".webp",
    fps: 30,
    loopFrom: 0
  }
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/* ---------- LOADER ------------------------------------------------------- */
/* A CSS 3D camera assembles (lens rings appear, wireframe fills to solid)
   while the page loads, then the screen closes like an iris.
   First visit per session gets the full show; later pages get a quick one. */
const Loader = {
  done: false,
  init() {
    const el = $(".loader");
    if (!el) return this.finish();
    const cam = $(".lcam", el);
    const discs = $$(".lcam__lens i", el);
    const bar = $(".loader__bar", el);
    const pctEl = $("[data-loader-pct]", el);
    let seen = false;
    try { seen = sessionStorage.getItem("ls-intro") === "1"; } catch (e) {}
    const minTime = reduceMotion ? 300 : seen ? 700 : 2600;
    if (seen) el.classList.add("is-quick");

    const start = performance.now();
    let loaded = document.readyState === "complete";
    window.addEventListener("load", () => (loaded = true));
    let shown = 0;

    const tick = (now) => {
      const elapsed = now - start;
      const timeP = clamp(elapsed / minTime);
      const target = loaded ? timeP : Math.min(timeP, 0.88);
      shown += (target - shown) * 0.12;
      if (target >= 1 && shown > 0.995) shown = 1;
      const p = shown;
      bar?.style.setProperty("--p", p.toFixed(3));
      if (pctEl) pctEl.textContent = `${Math.round(p * 100)}%`;
      const on = Math.round(p * 1.35 * discs.length);
      discs.forEach((d, i) => d.classList.toggle("is-on", i < on));
      cam?.classList.toggle("is-solid", p > 0.72);
      if (p >= 1) return this.close(el);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    setTimeout(() => this.close(el), 8000); // safety net
  },
  close(el) {
    if (this.done) return;
    try { sessionStorage.setItem("ls-intro", "1"); } catch (e) {}
    setTimeout(() => {
      el.classList.add("is-done");
      document.body.classList.remove("is-loading");
      this.finish();
      setTimeout(() => el.remove(), 1200);
    }, 260);
  },
  finish() {
    if (this.done) return;
    this.done = true;
    document.body.classList.remove("is-loading");
    document.dispatchEvent(new CustomEvent("lovesick:ready"));
  }
};
const onReady = (fn) => (Loader.done ? fn() : document.addEventListener("lovesick:ready", fn, { once: true }));

/* ---------- HEADER ------------------------------------------------------- */
function initHeader() {
  const header = $(".site-header");
  const toggle = $(".nav__toggle");
  if (!header) return;

  if (header.classList.contains("site-header--over-hero")) {
    const update = () => header.classList.toggle("is-solid", window.scrollY > 40);
    update();
    window.addEventListener("scroll", update, { passive: true });
  }

  if (toggle) {
    const menu = $(".mobile-menu");
    const setMenu = (open) => {
      document.body.classList.toggle("nav-open", open);
      document.body.classList.toggle("no-scroll", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menu?.setAttribute("aria-hidden", String(!open));
    };
    toggle.addEventListener("click", () => setMenu(!document.body.classList.contains("nav-open")));
    $$(".mobile-menu a").forEach(a => a.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
    window.addEventListener("resize", () => { if (window.innerWidth >= 1000) setMenu(false); });
  }

  $$("[data-year]").forEach(el => (el.textContent = new Date().getFullYear()));
}

/* ---------- HERO: shared HUD helpers ------------------------------------ */
function heroHud() {
  const hero = $(".hero");
  const status = $("[data-cam-status]");
  const tc = $("[data-timecode]");
  let tcStart = 0, tcRaf;
  const pad = n => String(n).padStart(2, "0");
  return {
    hero,
    status(text) { if (status) status.textContent = text; },
    rec() {
      if (!hero || hero.classList.contains("is-rec")) return;
      hero.classList.add("is-rec", "is-flash");
      this.status("Recording · your story");
      if (!tc || reduceMotion) return;
      tcStart = performance.now();
      const tick = () => {
        const t = (performance.now() - tcStart) / 1000;
        tc.textContent = `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t / 60) % 60)}:${pad(Math.floor(t % 60))}:${pad(Math.floor((t % 1) * 25))}`;
        tcRaf = requestAnimationFrame(tick);
      };
      tick();
    }
  };
}

/* ---------- HERO: 3D CAMERA (Three.js) ---------------------------------- */
/* Sequence: exploded wireframe skeleton assembles → a scan line fills the
   body with real materials → lens powers on → "REC" + viewfinder HUD.
   Then it idles with a handheld sway and follows the pointer. */
function initHeroCamera() {
  const mount = $("[data-camera3d]");
  if (!mount) return;
  const hud = heroHud();
  onReady(() => hud.hero?.classList.add("is-in"));

  if (CONFIG.heroFrames.count > 0) return initHeroFrames(mount, hud);

  const webgl = (() => {
    try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"))); }
    catch (e) { return false; }
  })();
  if (!window.THREE || !webgl) {
    mount.classList.add("is-fallback");
    onReady(() => hud.rec());
    return;
  }

  const T = window.THREE;
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.localClippingEnabled = true;
  renderer.setClearColor(0x000000, 0);
  mount.prepend(renderer.domElement);

  const scene = new T.Scene();
  const view = new T.PerspectiveCamera(28, 1, 0.1, 100);

  /* Studio reflections — a tiny soft-box scene baked into an env map */
  const pmrem = new T.PMREMGenerator(renderer);
  const envScene = new T.Scene();
  envScene.add(new T.Mesh(new T.BoxGeometry(40, 40, 40), new T.MeshBasicMaterial({ color: 0x1a0a0e, side: T.BackSide })));
  const softbox = (w, h, color, x, y, z) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color, side: T.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); envScene.add(m);
  };
  softbox(14, 8, 0xfff3ea, -8, 9, 8);   // key
  softbox(4, 18, 0xe59aa6, 12, 0, 3);   // rose rim
  softbox(16, 3, 0xffffff, 0, -3, -12); // back strip
  softbox(6, 6, 0x5e2131, 0, -12, 6);  // wine floor bounce
  softbox(3, 3, 0xffd9c8, 6, 6, 12);    // catchlight
  scene.environment = pmrem.fromScene(envScene, 0.035).texture;

  scene.add(new T.HemisphereLight(0xffeee6, 0x1a0a0e, 0.22));
  const key = new T.DirectionalLight(0xfff1e8, 1.6); key.position.set(-5, 7, 8); scene.add(key);
  const rim = new T.PointLight(0xff7f92, 1.4, 40); rim.position.set(7, 2, -5); scene.add(rim);

  /* Procedural textures */
  const canvasTex = (w, h, draw, repeat = [1, 1]) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]);
    return t;
  };
  const leather = canvasTex(256, 256, (g, w, h) => {
    const d = g.createImageData(w, h);
    for (let i = 0; i < d.data.length; i += 4) { const v = 110 + Math.random() * 90; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0);
  }, [4, 4]);
  const ribs = (n) => canvasTex(512, 4, (g, w) => {
    for (let x = 0; x < w; x++) { const v = 128 + Math.sin((x / w) * Math.PI * 2 * 16) * 127; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, 0, 1, 4); }
  }, [n / 16, 1]);
  const zoomRibs = ribs(96), focusRibs = ribs(180), dialRibs = ribs(48);
  const glow = canvasTex(256, 256, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, "rgba(255,226,214,1)"); r.addColorStop(.25, "rgba(232,140,156,.85)");
    r.addColorStop(.6, "rgba(127,50,66,.35)"); r.addColorStop(1, "rgba(127,50,66,0)");
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  glow.wrapS = glow.wrapT = T.ClampToEdgeWrapping;

  /* Clipping planes drive the "skeleton → solid" reveal */
  const clipSolid = new T.Plane(new T.Vector3(0, -1, 0), -10); // shows y <= constant
  const clipWire = new T.Plane(new T.Vector3(0, 1, 0), 10);    // shows y >= -constant
  const setScan = (y) => { clipSolid.constant = y; clipWire.constant = -y; };

  const solid = (opts) => new T.MeshStandardMaterial(Object.assign({ clippingPlanes: [clipSolid], envMapIntensity: 1.1 }, opts));
  const M = {
    leather: solid({ color: 0x0b0909, roughness: .86, metalness: .05, bumpMap: leather, bumpScale: .02, envMapIntensity: .45 }),
    satin: solid({ color: 0x121012, roughness: .3, metalness: .7, envMapIntensity: .85 }),
    rubber: solid({ color: 0x0a0909, roughness: .6, metalness: .1, bumpMap: zoomRibs, bumpScale: .035, envMapIntensity: .6 }),
    rubberFine: solid({ color: 0x0d0b0c, roughness: .5, metalness: .15, bumpMap: focusRibs, bumpScale: .03, envMapIntensity: .7 }),
    dial: solid({ color: 0x141113, roughness: .28, metalness: .8, bumpMap: dialRibs, bumpScale: .035 }),
    metal: solid({ color: 0xb7aaa6, roughness: .22, metalness: 1 }),
    red: solid({ color: 0xc8323c, roughness: .32, metalness: .2, emissive: 0x000000 }),
    glass: new T.MeshPhysicalMaterial({ color: 0x0b0810, roughness: .03, metalness: .2, clearcoat: 1, clearcoatRoughness: .02, envMapIntensity: 2.4, transparent: true, opacity: .86, depthWrite: false, clippingPlanes: [clipSolid] }),
    iris: new T.MeshBasicMaterial({ map: glow, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false })
  };
  const lineMat = new T.LineBasicMaterial({ color: 0xf6dcd2, transparent: true, opacity: .9, clippingPlanes: [clipWire] });
  const wireMat = new T.MeshBasicMaterial({ color: 0xe8b7b6, wireframe: true, transparent: true, opacity: .07, clippingPlanes: [clipWire], depthWrite: false });

  /* Geometry helpers */
  const roundRect = (w, h, r) => {
    const s = new T.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  };
  const extrude = (shape, depth, bevel = .08) => {
    const g = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 16 });
    g.center(); return g;
  };
  const cyl = (rTop, rBot, h, seg = 96) => new T.CylinderGeometry(rTop, rBot, h, seg, 1);
  const LENS = [Math.PI / 2, 0, 0]; // cylinder axis → camera's optical (z) axis

  const rig = new T.Group();      // rotates
  const assembly = new T.Group(); // offset so the rig pivots around the middle
  assembly.position.set(0, -0.25, -1.15);
  rig.add(assembly); scene.add(rig);

  const parts = [];
  const part = (geo, mat, { pos = [0, 0, 0], rot = [0, 0, 0], from = [0, 0, 0], delay = 0, edges = 28, wire = true } = {}) => {
    const g = new T.Group();
    const mesh = new T.Mesh(geo, mat); mesh.rotation.set(rot[0], rot[1], rot[2]); g.add(mesh);
    if (edges) { const l = new T.LineSegments(new T.EdgesGeometry(geo, edges), lineMat); l.rotation.copy(mesh.rotation); g.add(l); }
    if (wire) { const w = new T.Mesh(geo, wireMat); w.rotation.copy(mesh.rotation); g.add(w); }
    g.position.set(pos[0], pos[1], pos[2]); g.visible = false;
    assembly.add(g);
    parts.push({ g, home: new T.Vector3(...pos), off: new T.Vector3(...from), delay });
    return mesh;
  };

  /* ---- Body ---- */
  part(extrude(roundRect(4.3, 2.3, .3), 1.25), M.leather, { pos: [0, -.12, 0], delay: 0 });
  part(extrude(roundRect(4.22, .52, .18), 1.3, .06), M.satin, { pos: [0, 1.06, 0], from: [0, 1.4, 0], delay: .15 });
  part(extrude(roundRect(1.12, 2.5, .5), .74, .14), M.leather, { pos: [-1.6, -.12, 1.0], from: [-2.6, 0, 1.4], delay: .3 });
  const hump = new T.Shape(); hump.moveTo(-.86, 0); hump.lineTo(.86, 0); hump.lineTo(.56, .74); hump.lineTo(-.56, .74); hump.closePath();
  part(extrude(hump, 1.12, .06), M.satin, { pos: [.25, 1.62, -.02], from: [0, 2.4, 0], delay: .45 });
  part(new T.BoxGeometry(.72, .06, .56), M.metal, { pos: [.25, 2.07, -.02], from: [0, 2.8, 0], delay: .6 });

  /* Engraved wordmark on the viewfinder hump */
  const word = canvasTex(512, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = "#e8dcd3";
    g.font = "500 54px Jost, Arial, sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
    if ("letterSpacing" in g) g.letterSpacing = "14px";
    g.fillText("LOVESICK", w / 2, h / 2 + 2);
  });
  word.wrapS = word.wrapT = T.ClampToEdgeWrapping;
  part(new T.PlaneGeometry(1.0, .19), new T.MeshBasicMaterial({ map: word, transparent: true, clippingPlanes: [clipSolid], depthWrite: false }), { pos: [.25, 1.6, .63], from: [0, 2.4, 0], delay: .45, edges: false, wire: false });

  /* ---- Dials & buttons ---- */
  part(cyl(.36, .36, .3, 72), M.dial, { pos: [-1.05, 1.47, -.15], from: [0, 2.2, 0], delay: .7 });
  part(cyl(.2, .2, .06, 48), M.metal, { pos: [-1.05, 1.65, -.15], from: [0, 2.6, 0], delay: .78 });
  part(cyl(.42, .42, .3, 72), M.dial, { pos: [1.48, 1.47, -.05], from: [0, 2.2, 0], delay: .82 });
  part(cyl(.435, .435, .07, 72), M.red, { pos: [1.48, 1.33, -.05], from: [0, 2.0, 0], delay: .9 });
  part(cyl(.17, .19, .12, 48), M.metal, { pos: [-1.62, 1.22, 1.08], from: [0, 2.2, .4], delay: .95 });
  part(new T.TorusGeometry(.24, .035, 12, 48), M.satin, { pos: [-1.62, 1.18, 1.08], rot: [Math.PI / 2, 0, 0], from: [0, 2.0, .4], delay: .95, wire: false });
  const recBtn = part(cyl(.15, .15, .1, 48), M.red, { pos: [1.72, -.86, .7], rot: LENS, from: [1.2, 0, 1.2], delay: 1.0 });
  part(cyl(.08, .08, .06, 32), M.satin, { pos: [1.35, .35, .7], rot: LENS, from: [1, 0, 1], delay: 1.05, wire: false });
  part(cyl(.08, .08, .06, 32), M.satin, { pos: [1.35, .05, .7], rot: LENS, from: [1, 0, 1], delay: 1.08, wire: false });
  [-2.26, 2.26].forEach((x, i) => part(new T.TorusGeometry(.12, .035, 10, 24), M.metal, { pos: [x, .85, .05], rot: [0, Math.PI / 2, 0], from: [x * .6, 0, 0], delay: 1.1 + i * .04, wire: false }));

  /* ---- Lens (front to back explode along z) ---- */
  part(cyl(1.13, 1.13, .1), M.metal,   { pos: [0, -.1, .77], rot: LENS, from: [0, 0, 1.2], delay: 1.0 });
  part(cyl(1.06, 1.06, .32), M.satin,  { pos: [0, -.1, .98], rot: LENS, from: [0, 0, 1.9], delay: 1.1 });
  part(cyl(1.11, 1.11, .68), M.rubber, { pos: [0, -.1, 1.47], rot: LENS, from: [0, 0, 2.6], delay: 1.2 });
  part(cyl(1.05, 1.05, .26), M.satin,  { pos: [0, -.1, 1.94], rot: LENS, from: [0, 0, 3.2], delay: 1.3 });
  part(cyl(1.12, 1.12, .48), M.rubberFine, { pos: [0, -.1, 2.31], rot: LENS, from: [0, 0, 3.8], delay: 1.4 });
  part(cyl(1.22, 1.12, .36), M.satin,  { pos: [0, -.1, 2.73], rot: LENS, from: [0, 0, 4.4], delay: 1.5 });
  part(new T.RingGeometry(.86, 1.22, 96), M.satin, { pos: [0, -.1, 2.912], from: [0, 0, 4.6], delay: 1.55, wire: false });
  part(new T.RingGeometry(1.15, 1.2, 96), M.metal, { pos: [0, -.1, 2.918], from: [0, 0, 4.7], delay: 1.58, wire: false, edges: false });
  part(new T.RingGeometry(.28, .78, 64), solid({ color: 0x0a0809, roughness: .4, metalness: .5, side: T.DoubleSide }), { pos: [0, -.1, 2.55], from: [0, 0, 4.9], delay: 1.62, wire: false });
  const iris = part(new T.PlaneGeometry(1.7, 1.7), M.iris, { pos: [0, -.1, 2.5], from: [0, 0, 5], delay: 1.62, edges: false, wire: false });
  iris.renderOrder = 1;
  const capTheta = Math.asin(.88 / 1.6);
  const glass = part(new T.SphereGeometry(1.6, 96, 24, 0, Math.PI * 2, 0, capTheta), M.glass, { pos: [0, -.1, 2.86 - 1.6 * Math.cos(capTheta)], rot: LENS, from: [0, 0, 5.6], delay: 1.7, edges: 40 });
  glass.renderOrder = 2;

  /* Scan beam — a soft horizontal sheet of light that sweeps up the body */
  const beam = new T.Mesh(new T.PlaneGeometry(9, 9), new T.MeshBasicMaterial({ map: glow, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide }));
  beam.rotation.x = -Math.PI / 2; scene.add(beam);

  /* Soft contact shadow */
  const shadowTex = canvasTex(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    r.addColorStop(0, "rgba(20,5,10,.55)"); r.addColorStop(1, "rgba(20,5,10,0)");
    g.fillStyle = r; g.fillRect(0, 0, w, h);
  });
  const shadow = new T.Mesh(new T.PlaneGeometry(8, 4), new T.MeshBasicMaterial({ map: shadowTex, transparent: true, opacity: 0, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -2.35; scene.add(shadow);

  /* Layout */
  const resize = () => {
    const w = mount.clientWidth || 1, h = mount.clientHeight || 1;
    renderer.setSize(w, h, false);
    view.aspect = w / h;
    const halfW = 3.9, halfH = 2.9;
    const tanV = Math.tan(T.MathUtils.degToRad(view.fov / 2));
    const dist = Math.max(halfH / tanV, halfW / (tanV * view.aspect));
    view.position.set(0, .35, dist + 2);
    view.lookAt(0, -.05, 0);
    view.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  /* Pointer steering */
  let px = 0, py = 0, tx = 0, ty = 0;
  if (canHover && !reduceMotion) {
    (hud.hero || mount).addEventListener("pointermove", (e) => {
      const r = mount.getBoundingClientRect();
      tx = clamp((e.clientX - r.left) / r.width - .5, -.6, .6);
      ty = clamp((e.clientY - r.top) / r.height - .5, -.6, .6);
    });
    (hud.hero || mount).addEventListener("pointerleave", () => { tx = 0; ty = 0; });
  }

  /* Timeline (seconds) */
  const TL = { build: [0, 2.9], scan: [2.9, 4.7], power: [4.7, 5.6] };
  const status = ["Assembling · body + optics", "Calibrating · light + colour", "Power on"];
  let started = false, t0 = 0, recFired = false, lastStatus = -1, visible = true, raf;
  const SKIP = reduceMotion ? 99 : 0;

  const render = (now) => {
    raf = requestAnimationFrame(render);
    if (!visible) return;
    const t = started ? (now - t0) / 1000 + SKIP : 0;

    // 1 — skeleton assembles
    parts.forEach(p => {
      const k = clamp((t - p.delay) / 1.15);
      p.g.visible = started && t >= p.delay;
      p.g.position.copy(p.home).addScaledVector(p.off, 1 - easeOut(k));
    });
    // 2 — scan fills the skeleton with materials (bottom → top)
    const s = clamp((t - TL.scan[0]) / (TL.scan[1] - TL.scan[0]));
    const scanY = -2.6 + easeInOut(s) * 5.6;
    setScan(scanY);
    beam.position.y = scanY;
    beam.material.opacity = s > 0 && s < 1 ? Math.sin(s * Math.PI) * .7 : 0;
    lineMat.opacity = .9 * (1 - clamp((t - TL.scan[1]) / .6));
    wireMat.opacity = .07 * (1 - clamp((t - TL.scan[1]) / .6));
    shadow.material.opacity = .9 * easeOut(clamp((t - 1) / 3));
    // 3 — power on: iris glows, focus ring turns, REC lights
    const pw = clamp((t - TL.power[0]) / (TL.power[1] - TL.power[0]));
    M.iris.opacity = easeOut(pw) * (.78 + Math.sin(t * 2.2) * .06);
    focusRibs.offset.x = easeInOut(pw) * .9;
    M.red.emissive.setRGB(.5 * pw * (Math.sin(t * 5) > 0 ? 1 : .35), 0, .02 * pw);
    if (pw > .35 && !recFired) { recFired = true; hud.rec(); hud.hero?.classList.add("is-live"); }

    const st = t < TL.scan[0] ? 0 : t < TL.power[0] ? 1 : 2;
    if (started && st !== lastStatus && !recFired) { lastStatus = st; hud.status(status[st]); }

    // Rig motion: wide side angle during build → hero ¾ angle → idle sway
    px += (tx - px) * .05; py += (ty - py) * .05;
    const intro = easeInOut(clamp(t / TL.power[1]));
    const idle = clamp((t - TL.power[1]) / 1.5);
    rig.rotation.y = -1.05 + intro * 1.45 + idle * (Math.sin(t * .45) * .12 + px * .55);
    rig.rotation.x = .2 - intro * .1 + idle * (Math.cos(t * .33) * .035 + py * .22);
    rig.position.y = idle * Math.sin(t * .9) * .06;
    renderer.render(scene, view);
  };
  setScan(-2.6);
  raf = requestAnimationFrame(render);
  hud.status("Standby");

  onReady(() => { started = true; t0 = performance.now(); });

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(mount);
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelAnimationFrame(raf);
    else raf = requestAnimationFrame(render);
  });
}

/* ---------- HERO: optional Gemini image-sequence player ----------------- */
function initHeroFrames(mount, hud) {
  const cfg = CONFIG.heroFrames;
  const canvas = document.createElement("canvas");
  mount.prepend(canvas);
  const ctx = canvas.getContext("2d");
  const frames = [];
  let loadedCount = 0;
  for (let i = 1; i <= cfg.count; i++) {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => loadedCount++;
    img.src = `${cfg.path}${String(i).padStart(cfg.pad, "0")}${cfg.ext}`;
    frames.push(img);
  }
  const fit = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = mount.clientWidth * dpr; canvas.height = mount.clientHeight * dpr;
  };
  fit(); window.addEventListener("resize", fit);
  const draw = (img) => {
    if (!img || !img.complete || !img.naturalWidth) return;
    const s = Math.min(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  };
  onReady(() => {
    const t0 = performance.now();
    const last = cfg.count - 1;
    hud.status("Assembling");
    const loop = (now) => {
      let f = Math.floor(((now - t0) / 1000) * cfg.fps);
      if (reduceMotion) f = last;
      if (f > last) {
        hud.rec();
        if (cfg.loopFrom > 0) f = cfg.loopFrom - 1 + ((f - last) % (cfg.count - cfg.loopFrom + 1));
        else f = last;
      }
      draw(frames[f]);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

/* ---------- COVER-FLOW --------------------------------------------------- */
class CoverFlow {
  constructor(root) {
    this.root = root;
    this.stage = $(".coverflow__stage", root);
    this.items = $$(".coverflow__item", root);
    this.count = $(".coverflow__count", root);
    this.dotsWrap = $(".coverflow__dots", root);
    this.index = Math.min(Number(root.dataset.start || 0), this.items.length - 1);
    this.autoplay = root.dataset.autoplay !== "false" && !reduceMotion;
    this.timer = null;
    if (!this.items.length) return;
    this.buildDots();
    this.bind();
    this.render();
    this.play();
  }
  buildDots() {
    if (!this.dotsWrap) return;
    this.dots = this.items.map((_, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.setAttribute("aria-label", `Show photo ${i + 1}`);
      b.addEventListener("click", () => this.go(i));
      this.dotsWrap.appendChild(b);
      return b;
    });
  }
  bind() {
    $(".coverflow__prev", this.root)?.addEventListener("click", () => this.go(this.index - 1));
    $(".coverflow__next", this.root)?.addEventListener("click", () => this.go(this.index + 1));
    this.items.forEach((item, i) => {
      item.addEventListener("click", () => {
        if (this.dragMoved) return;
        if (i === this.index) Lightbox.openFrom(item);
        else this.go(i);
      });
    });
    this.root.setAttribute("tabindex", "0");
    this.root.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft") { e.preventDefault(); this.go(this.index - 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); this.go(this.index + 1); }
      if (e.key === "Enter") Lightbox.openFrom(this.items[this.index]);
    });
    let startX = 0, dx = 0, dragging = false;
    this.stage.addEventListener("pointerdown", (e) => {
      dragging = true; this.dragMoved = false; startX = e.clientX; dx = 0;
      this.stage.classList.add("is-dragging");
      this.stop();
    });
    window.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      dx = e.clientX - startX;
      if (Math.abs(dx) > 6) this.dragMoved = true;
      this.render(dx / 220);
    });
    window.addEventListener("pointerup", () => {
      if (!dragging) return;
      dragging = false;
      this.stage.classList.remove("is-dragging");
      const steps = Math.round(-dx / 160);
      steps ? this.go(this.index + steps) : this.render();
      setTimeout(() => (this.dragMoved = false), 50);
      this.play();
    });
    this.root.addEventListener("mouseenter", () => this.stop());
    this.root.addEventListener("mouseleave", () => this.play());
    this.root.addEventListener("focusin", () => this.stop());
  }
  go(i) {
    const n = this.items.length;
    this.index = (i + n) % n;
    this.render();
  }
  render(drag = 0) {
    const wide = window.innerWidth > 760;
    const spacing = wide ? 0.62 : 0.5;
    this.items.forEach((item, i) => {
      let o = i - this.index;
      const n = this.items.length;
      if (o > n / 2) o -= n;
      if (o < -n / 2) o += n;
      o += drag;
      const abs = Math.abs(o);
      const w = item.offsetWidth;
      const x = o * w * spacing + Math.sign(o) * Math.min(abs, 1) * w * 0.18;
      const z = -abs * 160;
      const ry = Math.max(-1, Math.min(1, o)) * -48;
      const scale = abs < 0.5 ? 1 : 0.92;
      item.style.transform = `translate(-50%, -50%) translateX(${x}px) translateZ(${z}px) rotateY(${ry}deg) scale(${scale})`;
      item.style.zIndex = String(100 - Math.round(abs * 10));
      item.style.opacity = abs > 3.2 ? "0" : String(1 - abs * 0.12);
      item.style.filter = abs < 0.5 ? "none" : `brightness(${1 - Math.min(abs, 3) * 0.12})`;
      item.classList.toggle("is-active", Math.round(o) === 0);
      item.setAttribute("aria-hidden", Math.round(o) === 0 ? "false" : "true");
    });
    if (this.count) this.count.textContent = `${String(this.index + 1).padStart(2, "0")} / ${String(this.items.length).padStart(2, "0")}`;
    this.dots?.forEach((d, i) => d.classList.toggle("is-active", i === this.index));
  }
  play() {
    if (!this.autoplay) return;
    this.stop();
    this.timer = setInterval(() => this.go(this.index + 1), 4200);
  }
  stop() { clearInterval(this.timer); }
}
function initCoverflows() {
  const flows = $$("[data-coverflow]").map(el => new CoverFlow(el));
  let t;
  window.addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => flows.forEach(f => f.render()), 120); });
}

/* ---------- FLOATING 3D GALLERY ----------------------------------------- */
function initFloatGallery() {
  $$(".float-gallery").forEach(g => {
    const scene = $(".float-gallery__scene", g);
    if (!scene || reduceMotion || !canHover) return;
    g.addEventListener("pointermove", (e) => {
      const r = g.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      scene.style.setProperty("--fy", `${px * 14}deg`);
      scene.style.setProperty("--fx", `${-py * 10}deg`);
    });
    g.addEventListener("pointerleave", () => {
      scene.style.setProperty("--fy", "0deg");
      scene.style.setProperty("--fx", "0deg");
    });
  });
}

/* ---------- TILT CARDS -------------------------------------------------- */
function initTilt() {
  if (reduceMotion || !canHover) return;
  $$("[data-tilt]").forEach(card => {
    const max = Number(card.dataset.tilt || 6);
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `perspective(900px) rotateY(${px * max}deg) rotateX(${-py * max}deg) translateY(-6px)`;
    });
    card.addEventListener("pointerleave", () => (card.style.transform = ""));
  });
}

/* ---------- LIGHTBOX ---------------------------------------------------- */
const Lightbox = {
  el: null, img: null, cap: null, list: [], i: 0, lastFocus: null,
  init() {
    this.el = $(".lightbox");
    if (!this.el) return;
    this.img = $(".lightbox__img", this.el);
    this.cap = $(".lightbox__cap", this.el);
    $(".lightbox__close", this.el).addEventListener("click", () => this.close());
    $(".lightbox__prev", this.el).addEventListener("click", () => this.step(-1));
    $(".lightbox__next", this.el).addEventListener("click", () => this.step(1));
    this.el.addEventListener("click", (e) => { if (e.target === this.el) this.close(); });
    document.addEventListener("keydown", (e) => {
      if (!this.el.classList.contains("is-open")) return;
      if (e.key === "Escape") this.close();
      if (e.key === "ArrowLeft") this.step(-1);
      if (e.key === "ArrowRight") this.step(1);
    });
    $$("[data-lightbox]").forEach(t => {
      if (t.closest("[data-coverflow]")) return;
      t.addEventListener("click", (e) => { e.preventDefault(); this.openFrom(t); });
      if (t.tagName !== "A" && t.tagName !== "BUTTON") {
        t.setAttribute("tabindex", "0");
        t.setAttribute("role", "button");
        t.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.openFrom(t); } });
      }
    });
  },
  openFrom(trigger) {
    if (!this.el || !trigger) return;
    const group = trigger.dataset.lightbox || "default";
    this.list = $$(`[data-lightbox="${group}"]`).filter(n => !n.classList.contains("is-hidden"));
    this.i = Math.max(0, this.list.indexOf(trigger));
    this.lastFocus = document.activeElement;
    this.show();
    this.el.classList.add("is-open");
    this.el.setAttribute("aria-hidden", "false");
    document.body.classList.add("no-scroll");
    $(".lightbox__close", this.el).focus();
  },
  show() {
    const t = this.list[this.i];
    const src = t.dataset.src || t.getAttribute("href") || $("img", t)?.src;
    const alt = $("img", t)?.alt || "";
    this.img.style.opacity = "0";
    this.img.onload = () => (this.img.style.opacity = "1");
    this.img.src = src;
    this.img.alt = alt;
    this.cap.textContent = t.dataset.caption || "";
  },
  step(d) {
    if (!this.list.length) return;
    this.i = (this.i + d + this.list.length) % this.list.length;
    this.show();
  },
  close() {
    this.el.classList.remove("is-open");
    this.el.setAttribute("aria-hidden", "true");
    document.body.classList.remove("no-scroll");
    this.lastFocus?.focus?.();
  }
};

/* ---------- PORTFOLIO FILTERS ------------------------------------------ */
function initFilters() {
  const btns = $$(".filter-btn");
  const tiles = $$(".tile[data-cat]");
  if (!btns.length) return;
  btns.forEach(btn => btn.addEventListener("click", () => {
    const cat = btn.dataset.filter;
    btns.forEach(b => { b.classList.toggle("is-active", b === btn); b.setAttribute("aria-pressed", String(b === btn)); });
    tiles.forEach(t => {
      const show = cat === "all" || t.dataset.cat === cat;
      if (show) {
        t.classList.remove("is-hidden");
        t.animate?.([{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }], { duration: reduceMotion ? 0 : 500, easing: "cubic-bezier(.22,1,.36,1)" });
      } else {
        t.classList.add("is-hidden");
      }
    });
  }));
}

/* ---------- CURSOR LABEL ("View") -------------------------------------- */
function initCursorLabel() {
  if (!canHover || reduceMotion) return;
  const label = document.createElement("div");
  label.className = "cursor-label";
  label.setAttribute("aria-hidden", "true");
  document.body.appendChild(label);
  let x = 0, y = 0, cx = 0, cy = 0;
  const loop = () => {
    cx += (x - cx) * 0.2; cy += (y - cy) * 0.2;
    label.style.left = cx + "px"; label.style.top = cy + "px";
    requestAnimationFrame(loop);
  };
  loop();
  window.addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; }, { passive: true });
  $$("[data-cursor]").forEach(el => {
    el.addEventListener("mouseenter", () => { label.textContent = el.dataset.cursor; label.classList.add("is-on"); });
    el.addEventListener("mouseleave", () => label.classList.remove("is-on"));
  });
}

/* ---------- FORMS (GHL opt-in) ----------------------------------------- */
function initForms() {
  const utm = {};
  const params = new URLSearchParams(location.search);
  ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid"].forEach(k => {
    if (params.get(k)) utm[k] = params.get(k);
  });

  $$("form[data-ghl]").forEach(form => {
    $$('input[type="date"]', form).forEach(d => (d.min = new Date().toISOString().split("T")[0]));

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!validate(form)) return;
      if ($(".hp input", form)?.value) return; // honeypot = bot

      const btn = $('button[type="submit"]', form);
      const label = btn.innerHTML;
      btn.setAttribute("aria-busy", "true");
      btn.innerHTML = "Sending…";

      const data = Object.fromEntries(new FormData(form).entries());
      delete data.website;
      $$("[data-multi]", form).forEach(group => {
        data[group.dataset.multi] = $$("input:checked", group).map(i => i.value).join(", ");
      });
      const payload = {
        ...data,
        ...utm,
        form_name: form.dataset.ghl,
        sms_email_consent: !!$('input[name="consent"]', form)?.checked,
        marketing_opt_in: !!$('input[name="marketing_opt_in"]', form)?.checked,
        source_page: location.pathname,
        submitted_at: new Date().toISOString()
      };

      // Pick the webhook for this specific form (falls back to ghlWebhookUrl)
      const webhookUrl = (CONFIG.ghlWebhooks && CONFIG.ghlWebhooks[form.dataset.ghl]) || CONFIG.ghlWebhookUrl;

      try {
        if (webhookUrl) {
          const res = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error(`Webhook responded with ${res.status}`);
        } else {
          console.info(`[Lovesick] No webhook set for "${form.dataset.ghl}". Payload:`, payload);
          await new Promise(r => setTimeout(r, 700));
        }
        if (CONFIG.thankYouRedirect) { location.href = CONFIG.thankYouRedirect; return; }
        form.classList.add("is-sent");
        const success = form.nextElementSibling;
        if (success?.classList.contains("form-success")) {
          const nameSlot = $("[data-name]", success);
          if (nameSlot) nameSlot.textContent = (data.first_name || "").trim() || "lovebirds";
          success.setAttribute("tabindex", "-1");
          success.focus();
        }
      } catch (err) {
        console.error("[Lovesick] Form submit failed:", err);
        alert("Sorry — something went wrong sending your enquiry. Please try again or email macy@lovesickmedia.com.au.");
      } finally {
        btn.removeAttribute("aria-busy");
        if (!form.classList.contains("is-sent")) btn.innerHTML = label;
      }
    });

    form.addEventListener("input", (e) => {
      const wrap = e.target.closest(".field, .check");
      if (wrap?.classList.contains("has-error")) {
        wrap.classList.remove("has-error");
        const msg = $(".field__error", wrap); if (msg) msg.textContent = "";
      }
    });
  });

  function validate(form) {
    let ok = true, first = null;
    $$("[required]", form).forEach(input => {
      const wrap = input.closest(".field, .check");
      let msg = "";
      if (input.type === "checkbox" && !input.checked) msg = "Please tick to continue.";
      else if (!input.value.trim()) msg = "This field is required.";
      else if (input.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(input.value)) msg = "Please enter a valid email.";
      else if (input.type === "tel" && input.value.replace(/\D/g, "").length < 8) msg = "Please enter a valid phone number.";
      if (msg) {
        ok = false; first = first || input;
        wrap?.classList.add("has-error");
        const err = wrap && $(".field__error", wrap);
        if (err) err.textContent = msg;
      }
    });
    first?.focus();
    return ok;
  }
}

/* ---------- BOOT -------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  Loader.init();
  initHeader();
  initHeroCamera();
  Lightbox.init();
  initCoverflows();
  initFloatGallery();
  initTilt();
  initFilters();
  initCursorLabel();
  initForms();
});
