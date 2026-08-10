/**
 * ASX Desktop — Three.js universe purple background
 * CDN: three.js r128 (cdnjs). Patterns from Claude extract_00 / extract_03 gates.
 * SEO/perf: pause when tab hidden; static frame if prefers-reduced-motion.
 * Mobile: DPR cap, visualViewport resize, lighter scene (research 2026-08-10).
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

function viewSize() {
  const vv = window.visualViewport;
  if (vv && vv.width > 0 && vv.height > 0) {
    return {
      w: Math.max(1, Math.floor(vv.width)),
      h: Math.max(1, Math.floor(vv.height)),
    };
  }
  return {
    w: Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1),
    h: Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1),
  };
}

export function initThreeBg(canvasId = "three-bg") {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof THREE === "undefined") return null;

  const reduceMotion =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mobile = isMobileClient();

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0809, mobile ? 0.016 : 0.012);

  const { w: iw, h: ih } = viewSize();
  const camera = new THREE.PerspectiveCamera(60, iw / ih, 0.1, 1000);
  camera.position.z = mobile ? 48 : 42;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !mobile,
    alpha: true,
    powerPreference: mobile ? "low-power" : "default",
  });

  // Mobile DPR often 2–3; uncapped fill-rate kills FPS (discourse / common practice).
  const dprCap = mobile ? 1.25 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.setSize(iw, ih, false);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  renderer.setClearColor(0x0a0809, 1);

  scene.add(new THREE.AmbientLight(0xffffff, 0.15));

  const purple = new THREE.PointLight(0x8b5cf6, mobile ? 1.8 : 2.2, 220);
  purple.position.set(12, 8, 20);
  scene.add(purple);

  const gold = new THREE.PointLight(0xc8a35a, 0.9, 180);
  gold.position.set(-18, -6, 14);
  scene.add(gold);

  const coreDetail = mobile ? 1 : 2;
  const core = new THREE.Mesh(
    new THREE.IcosahedronGeometry(5.5, coreDetail),
    new THREE.MeshStandardMaterial({
      color: 0x7c3aed,
      emissive: 0x4c1d95,
      metalness: 0.55,
      roughness: 0.35,
      wireframe: false,
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
  const ringCount = mobile ? 2 : 3;
  const ringSeg = mobile ? 48 : 100;
  for (let i = 0; i < ringCount; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(11 + i * 4.2, 0.08, 8, ringSeg),
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
  const n = reduceMotion ? 280 : mobile ? 500 : 1400;
  const positions = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 220;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: 0xf5edd8,
      size: mobile ? 0.22 : 0.18,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
    })
  );
  scene.add(stars);

  let raf = 0;
  let running = true;
  let resizeTimer = 0;

  function frame(tMs) {
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
    renderer.render(scene, camera);
  }

  function animate() {
    if (!running) return;
    raf = requestAnimationFrame(animate);
    frame(performance.now());
  }

  if (reduceMotion) {
    frame(0);
  } else {
    animate();
  }

  function onVisibility() {
    if (reduceMotion) return;
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
    const { w, h } = viewSize();
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // Keep CSS 100%; buffer size in CSS pixels * pixelRatio (setSize false)
    renderer.setSize(w, h, false);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    if (reduceMotion || document.hidden) {
      frame(performance.now());
    }
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applySize, mobile ? 80 : 32);
  }

  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onResize);
    window.visualViewport.addEventListener("scroll", onResize);
  }

  // Re-check DPR if user docks/undocks or moves window across displays
  if (typeof matchMedia === "function") {
    try {
      matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener?.(
        "change",
        () => {
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
          applySize();
        }
      );
    } catch {
      /* ignore */
    }
  }

  return {
    dispose() {
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
      renderer.dispose();
      core.geometry.dispose();
      wire.geometry.dispose();
      starGeo.dispose();
      rings.forEach((r) => r.geometry.dispose());
    },
  };
}
