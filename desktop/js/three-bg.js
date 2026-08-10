/**
 * ASX Desktop — Three.js universe purple background
 * CDN: three.js r128 (cdnjs). Patterns from Claude extract_00 / extract_03 gates.
 *
 * Small-screen fixes (2026-08-10):
 * - Size from canvas client rect + visualViewport (avoid 0×0 / wrong aspect)
 * - Guard aspect; min buffer 1×1
 * - Ultra-light scene when width ≤ 480
 * - webglcontextlost → dispose + callback for ambient fallback
 * - Prefer fail open to ambient path rather than broken canvas
 */

function isMobileClient() {
  if (typeof window === "undefined") return false;
  const coarse =
    typeof matchMedia === "function" &&
    matchMedia("(pointer: coarse)").matches;
  const narrow = window.innerWidth <= 768;
  const ua = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  return coarse || narrow || ua;
}

/** Prefer canvas layout box; fall back to visualViewport / window */
function viewSize(canvas) {
  let w = 0;
  let h = 0;
  if (canvas) {
    const r = canvas.getBoundingClientRect();
    w = Math.floor(r.width);
    h = Math.floor(r.height);
  }
  if (w < 2 || h < 2) {
    const vv = window.visualViewport;
    if (vv && vv.width > 1 && vv.height > 1) {
      w = Math.floor(vv.width);
      h = Math.floor(vv.height);
    } else {
      w = Math.floor(
        window.innerWidth || document.documentElement.clientWidth || 360
      );
      h = Math.floor(
        window.innerHeight || document.documentElement.clientHeight || 640
      );
    }
  }
  // Never pass 0 into setSize / aspect (smallest-width crash class)
  return {
    w: Math.max(2, w),
    h: Math.max(2, h),
  };
}

/**
 * @param {string} [canvasId]
 * @param {{ onContextLost?: Function }} [opts]
 */
export function initThreeBg(canvasId = "three-bg", opts = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof THREE === "undefined") return null;

  // WebGL availability — use throwaway canvas so we don't poison #three-bg
  try {
    const probe = document.createElement("canvas");
    const test =
      probe.getContext("webgl") || probe.getContext("experimental-webgl");
    if (!test) return null;
  } catch {
    return null;
  }

  const reduceMotion =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = isMobileClient();
  const tiny =
    (window.innerWidth || 0) <= 420 ||
    (window.visualViewport && window.visualViewport.width <= 420);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0809, tiny ? 0.02 : mobile ? 0.016 : 0.012);

  const { w: iw, h: ih } = viewSize(canvas);
  const camera = new THREE.PerspectiveCamera(tiny ? 68 : 60, iw / ih, 0.1, 1000);
  camera.position.z = tiny ? 54 : mobile ? 48 : 42;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !mobile && !tiny,
      alpha: true,
      powerPreference: mobile || tiny ? "low-power" : "default",
      failIfMajorPerformanceCaveat: false,
    });
  } catch (e) {
    console.warn("ASX Three.js: WebGLRenderer failed", e);
    return null;
  }

  // Tiny phones: DPR 1 — fill-rate dominates
  const dprCap = tiny ? 1 : mobile ? 1.25 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.setSize(iw, ih, false);
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  renderer.setClearColor(0x0a0809, 1);

  scene.add(new THREE.AmbientLight(0xffffff, 0.18));

  const purple = new THREE.PointLight(0x8b5cf6, tiny ? 1.4 : mobile ? 1.8 : 2.2, 220);
  purple.position.set(12, 8, 20);
  scene.add(purple);

  const gold = new THREE.PointLight(0xc8a35a, 0.85, 180);
  gold.position.set(-18, -6, 14);
  scene.add(gold);

  const coreDetail = tiny ? 0 : mobile ? 1 : 2;
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(5.5, coreDetail),
    new THREE.MeshStandardMaterial({
      color: 0x7c3aed,
      emissive: 0x4c1d95,
      metalness: 0.55,
      roughness: 0.35,
      transparent: true,
      opacity: 0.85,
    })
  );
  scene.add(core);

  const wire = new THREE.Mesh(
    new THREE.IcosahedronGeometry(5.8, 1),
    new THREE.MeshBasicMaterial({
      color: 0xa78bfa,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    })
  );
  scene.add(wire);

  const rings = [];
  const ringCount = tiny ? 1 : mobile ? 2 : 3;
  const ringSeg = tiny ? 24 : mobile ? 48 : 100;
  for (let i = 0; i < ringCount; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(11 + i * 4.2, 0.08, 6, ringSeg),
      new THREE.MeshStandardMaterial({
        color: 0xa78bfa,
        emissive: 0x5b21b6,
        metalness: 0.4,
        roughness: 0.5,
        transparent: true,
        opacity: 0.45 - i * 0.08,
      })
    );
    ring.rotation.x = Math.PI / 2.4 + i * 0.2;
    ring.rotation.y = i * 0.4;
    scene.add(ring);
    rings.push(ring);
  }

  const starGeo = new THREE.BufferGeometry();
  const n = reduceMotion ? 120 : tiny ? 180 : mobile ? 400 : 1400;
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 220;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: 0xf5edd8,
      size: tiny ? 0.28 : mobile ? 0.22 : 0.18,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    })
  );
  scene.add(stars);

  let raf = 0;
  let running = true;
  let resizeTimer = 0;
  let disposed = false;

  function frame(tMs) {
    if (disposed) return;
    const t = tMs * 0.00035;
    core.rotation.x = t * 0.6;
    core.rotation.y = t * 0.9;
    wire.rotation.x = -t * 0.4;
    wire.rotation.y = t * 0.5;
    rings.forEach((r, i) => {
      r.rotation.z = t * (0.3 + i * 0.12);
      r.rotation.y = t * (0.15 + i * 0.05);
    });
    stars.rotation.y = t * 0.08;
    purple.position.x = Math.sin(t) * 14;
    purple.position.y = Math.cos(t * 0.7) * 8;
    try {
      renderer.render(scene, camera);
    } catch (e) {
      console.warn("ASX Three.js render failed", e);
    }
  }

  function animate() {
    if (!running || disposed) return;
    raf = requestAnimationFrame(animate);
    frame(performance.now());
  }

  if (reduceMotion) {
    frame(0);
  } else {
    animate();
  }

  function onVisibility() {
    if (reduceMotion || disposed) return;
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else {
      running = true;
      animate();
    }
  }
  document.addEventListener("visibilitychange", onVisibility);

  function applySize() {
    if (disposed) return;
    const { w, h } = viewSize(canvas);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    if (reduceMotion || document.hidden) {
      frame(performance.now());
    }
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applySize, mobile || tiny ? 100 : 32);
  }

  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onResize);
    window.visualViewport.addEventListener("scroll", onResize);
  }

  // Layout may settle after first paint (mobile address bar / fonts)
  requestAnimationFrame(() => requestAnimationFrame(applySize));

  function disposeAll() {
    if (disposed) return;
    disposed = true;
    running = false;
    cancelAnimationFrame(raf);
    clearTimeout(resizeTimer);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", onResize);
      window.visualViewport.removeEventListener("scroll", onResize);
    }
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    try {
      renderer.dispose();
      core.geometry.dispose();
      wire.geometry.dispose();
      starGeo.dispose();
      rings.forEach((r) => r.geometry.dispose());
    } catch {
      /* ignore */
    }
  }

  function onContextLost(e) {
    e.preventDefault();
    console.warn("ASX Three.js: WebGL context lost — ambient fallback");
    disposeAll();
    if (typeof opts.onContextLost === "function") {
      opts.onContextLost();
    }
  }
  canvas.addEventListener("webglcontextlost", onContextLost, false);

  document.body.classList.add("asx-bg-three");
  document.body.classList.remove("asx-bg-ambient");

  return {
    mode: "three",
    dispose: disposeAll,
  };
}

/** True when we should skip Three and use ambient SVG/D3 path */
export function shouldUseAmbientBg() {
  if (typeof window === "undefined") return true;
  if (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    // still allow static three frame — ambient is fine too
  }
  const w =
    window.visualViewport?.width ||
    window.innerWidth ||
    document.documentElement.clientWidth ||
    0;
  // Smallest-width class: ambient is reliable
  if (w > 0 && w <= 420) return true;
  // Force via query ?bg=ambient
  try {
    if (new URLSearchParams(location.search).get("bg") === "ambient") return true;
    if (new URLSearchParams(location.search).get("bg") === "three") return false;
  } catch {
    /* ignore */
  }
  // Save-data / low end
  if (navigator.connection?.saveData) return true;
  return false;
}
