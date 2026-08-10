/**
 * ASX Desktop — Three.js satellite view of Earth
 *
 * Keeps vortex rings + graphical grid around the planet (ASX "protector" frame).
 * Sphere = textured Earth; Moon orbits; Sun distant with glare when in view.
 * Camera acts as ASX satellite; drag empty desktop to look; release → auto orbit resumes.
 *
 * Textures: three.js r128 examples (jsDelivr). Fallback procedural if load fails.
 * Small-screen / WebGL fail → ambient path (main.js).
 */

const TEX = {
  earth:
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_atmos_2048.jpg",
  earthNormal:
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_normal_2048.jpg",
  earthSpec:
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_specular_2048.jpg",
  moon:
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/moon_1024.jpg",
};

function isMobileClient() {
  if (typeof window === "undefined") return false;
  const coarse =
    typeof matchMedia === "function" &&
    matchMedia("(pointer: coarse)").matches;
  const narrow = window.innerWidth <= 768;
  const ua = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  return coarse || narrow || ua;
}

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
  return { w: Math.max(2, w), h: Math.max(2, h) };
}

function ensureGlareEl() {
  let el = document.getElementById("sun-glare");
  if (el) return el;
  el = document.createElement("div");
  el.id = "sun-glare";
  el.setAttribute("aria-hidden", "true");
  const canvas = document.getElementById("three-bg");
  if (canvas && canvas.parentNode) {
    canvas.parentNode.insertBefore(el, canvas.nextSibling);
  } else {
    document.body.prepend(el);
  }
  return el;
}

function loadTexture(loader, url) {
  return new Promise((resolve) => {
    loader.load(
      url,
      (tex) => {
        tex.anisotropy = 4;
        resolve(tex);
      },
      undefined,
      () => resolve(null)
    );
  });
}

/**
 * @param {string} [canvasId]
 * @param {{ onContextLost?: Function }} [opts]
 */
export function initThreeBg(canvasId = "three-bg", opts = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof THREE === "undefined") return null;

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
  scene.background = new THREE.Color(0x02040a);
  scene.fog = new THREE.FogExp2(0x02040a, tiny ? 0.012 : 0.006);

  const { w: iw, h: ih } = viewSize(canvas);
  const camera = new THREE.PerspectiveCamera(tiny ? 58 : 50, iw / ih, 0.1, 2000);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !mobile && !tiny,
      alpha: false,
      powerPreference: mobile || tiny ? "low-power" : "default",
      failIfMajorPerformanceCaveat: false,
    });
  } catch (e) {
    console.warn("ASX Three.js: WebGLRenderer failed", e);
    return null;
  }

  const dprCap = tiny ? 1 : mobile ? 1.25 : 2;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.setSize(iw, ih, false);
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  renderer.setClearColor(0x02040a, 1);
  if (renderer.outputEncoding !== undefined) {
    renderer.outputEncoding = THREE.sRGBEncoding;
  }

  // --- Lights ---
  scene.add(new THREE.AmbientLight(0x1a2744, 0.35));
  const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.35);
  sunLight.position.set(120, 40, -80);
  scene.add(sunLight);
  const sunFill = new THREE.PointLight(0xffe8c0, 1.8, 400);
  sunFill.position.copy(sunLight.position);
  scene.add(sunFill);

  // --- Stars ---
  const starGeo = new THREE.BufferGeometry();
  const nStars = reduceMotion ? 200 : tiny ? 350 : mobile ? 700 : 1600;
  const starPos = new Float32Array(nStars * 3);
  for (let i = 0; i < nStars * 3; i++) {
    starPos[i] = (Math.random() - 0.5) * 600;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: 0xdce6ff,
      size: tiny ? 0.35 : 0.22,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
      depthWrite: false,
    })
  );
  scene.add(stars);

  // --- Earth system at origin ---
  const earthGroup = new THREE.Group();
  scene.add(earthGroup);

  const earthR = 8;
  const earthMat = new THREE.MeshPhongMaterial({
    color: 0x2266aa,
    emissive: 0x031018,
    specular: 0x335566,
    shininess: 18,
  });
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(earthR, tiny ? 32 : mobile ? 48 : 64, tiny ? 24 : mobile ? 36 : 48),
    earthMat
  );
  earthGroup.add(earth);

  // Soft atmosphere
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(earthR * 1.045, 32, 24),
    new THREE.MeshBasicMaterial({
      color: 0x4da3ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  earthGroup.add(atmo);

  // Graphical grid layer (ASX protector lattice — kept from prior design)
  const grid = new THREE.Mesh(
    new THREE.IcosahedronGeometry(earthR * 1.12, 1),
    new THREE.MeshBasicMaterial({
      color: 0xa78bfa,
      wireframe: true,
      transparent: true,
      opacity: 0.28,
    })
  );
  earthGroup.add(grid);

  // Vortex rings (kept)
  const rings = [];
  const ringCount = tiny ? 2 : 3;
  const ringSeg = tiny ? 32 : mobile ? 48 : 96;
  for (let i = 0; i < ringCount; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(earthR * (1.55 + i * 0.45), 0.06, 6, ringSeg),
      new THREE.MeshStandardMaterial({
        color: 0xa78bfa,
        emissive: 0x4c1d95,
        metalness: 0.35,
        roughness: 0.45,
        transparent: true,
        opacity: 0.42 - i * 0.08,
      })
    );
    ring.rotation.x = Math.PI / 2.35 + i * 0.18;
    ring.rotation.y = i * 0.35;
    earthGroup.add(ring);
    rings.push(ring);
  }

  // Moon
  const moonMat = new THREE.MeshPhongMaterial({
    color: 0xbbb8b0,
    emissive: 0x111111,
    shininess: 4,
  });
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(earthR * 0.27, tiny ? 16 : 32, tiny ? 12 : 24),
    moonMat
  );
  const moonOrbit = new THREE.Group();
  moon.position.set(earthR * 2.8, 0, 0);
  moonOrbit.add(moon);
  earthGroup.add(moonOrbit);

  // Distant sun (mesh + corona)
  const sunGroup = new THREE.Group();
  sunGroup.position.set(140, 45, -110);
  const sunCore = new THREE.Mesh(
    new THREE.SphereGeometry(6, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff2c4 })
  );
  const sunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(9, 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0xffc266,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    })
  );
  sunGroup.add(sunCore);
  sunGroup.add(sunHalo);
  scene.add(sunGroup);
  sunLight.position.copy(sunGroup.position);
  sunFill.position.copy(sunGroup.position);

  // Async textures
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = "anonymous";
  Promise.all([
    loadTexture(loader, TEX.earth),
    loadTexture(loader, TEX.earthNormal),
    loadTexture(loader, TEX.earthSpec),
    loadTexture(loader, TEX.moon),
  ]).then(([day, normal, spec, moonTex]) => {
    if (disposed) return;
    if (day) {
      if (day.encoding !== undefined) day.encoding = THREE.sRGBEncoding;
      earthMat.map = day;
      earthMat.color.set(0xffffff);
    }
    if (normal) {
      earthMat.normalMap = normal;
      earthMat.normalScale = new THREE.Vector2(0.85, 0.85);
    }
    if (spec) {
      earthMat.specularMap = spec;
    }
    earthMat.needsUpdate = true;
    if (moonTex) {
      if (moonTex.encoding !== undefined) moonTex.encoding = THREE.sRGBEncoding;
      moonMat.map = moonTex;
      moonMat.color.set(0xffffff);
      moonMat.needsUpdate = true;
    }
  });

  // --- Satellite camera orbit (ASX viewpoint) ---
  let theta = 0.35; // azimuth
  let phi = 1.15; // polar (from Y)
  let radius = tiny ? 38 : mobile ? 36 : 34;
  let autoSpin = !reduceMotion;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let resumeTimer = 0;
  let glareHold = 0; // seconds of visible glare after peak
  const glareEl = ensureGlareEl();
  const _vSun = new THREE.Vector3();
  const _vLook = new THREE.Vector3();
  const _vNdc = new THREE.Vector3();

  function placeCamera() {
    const sp = Math.sin(phi);
    camera.position.set(
      radius * sp * Math.sin(theta),
      radius * Math.cos(phi),
      radius * sp * Math.cos(theta)
    );
    camera.lookAt(0, 0, 0);
  }
  placeCamera();

  let raf = 0;
  let running = true;
  let resizeTimer = 0;
  let disposed = false;
  let t0 = performance.now();

  function updateGlare() {
    if (!glareEl) return;
    // Direction from camera toward sun
    _vSun.copy(sunGroup.position).sub(camera.position).normalize();
    camera.getWorldDirection(_vLook);
    const align = _vSun.dot(_vLook); // 1 = sun dead center
    // Project sun to screen for gradient center
    _vNdc.copy(sunGroup.position).project(camera);
    const onScreen =
      _vNdc.z < 1 &&
      _vNdc.x > -1.2 &&
      _vNdc.x < 1.2 &&
      _vNdc.y > -1.2 &&
      _vNdc.y < 1.2;
    const gx = 50 + _vNdc.x * 50;
    const gy = 50 - _vNdc.y * 50;
    glareEl.style.setProperty("--gx", gx + "%");
    glareEl.style.setProperty("--gy", gy + "%");

    if (onScreen && align > 0.88) {
      glareHold = Math.max(glareHold, 2.8); // hold glare a few seconds
    }
    if (glareHold > 0) {
      const peak = onScreen ? Math.max(0, (align - 0.82) / 0.18) : 0;
      const holdFade = Math.min(1, glareHold / 2.8);
      const op = Math.min(0.85, Math.max(peak, holdFade * 0.45) * holdFade);
      glareEl.style.opacity = String(op);
    } else {
      glareEl.style.opacity = "0";
    }
  }

  function frame(now) {
    if (disposed) return;
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;

    // Earth spin & ASX grid / rings
    earth.rotation.y += dt * 0.08;
    grid.rotation.y -= dt * 0.03;
    grid.rotation.x += dt * 0.01;
    rings.forEach((r, i) => {
      r.rotation.z += dt * (0.12 + i * 0.04);
      r.rotation.y += dt * (0.05 + i * 0.02);
    });
    moonOrbit.rotation.y += dt * 0.22;
    moon.rotation.y += dt * 0.05;
    stars.rotation.y += dt * 0.003;

    if (autoSpin && !dragging && !reduceMotion) {
      theta += dt * 0.12; // satellite orbital drift
    }
    if (glareHold > 0) glareHold -= dt;

    placeCamera();
    updateGlare();

    try {
      renderer.render(scene, camera);
    } catch (e) {
      console.warn("ASX Three.js render failed", e);
    }
  }

  function animate(now) {
    if (!running || disposed) return;
    raf = requestAnimationFrame(animate);
    frame(now || performance.now());
  }

  if (reduceMotion) {
    frame(performance.now());
  } else {
    animate(performance.now());
  }

  function onVisibility() {
    if (reduceMotion || disposed) return;
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(raf);
    } else {
      running = true;
      t0 = performance.now();
      animate(t0);
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
    if (reduceMotion || document.hidden) frame(performance.now());
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
  requestAnimationFrame(() => requestAnimationFrame(applySize));

  // --- Drag orbit on empty desktop (not icons / windows) ---
  const orbit = {
    onDown(e) {
      if (disposed || reduceMotion) return;
      dragging = true;
      autoSpin = false;
      lastX = e.clientX;
      lastY = e.clientY;
      clearTimeout(resumeTimer);
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    onMove(e) {
      if (!dragging || disposed) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      theta -= dx * 0.005;
      phi -= dy * 0.004;
      phi = Math.max(0.25, Math.min(Math.PI - 0.25, phi));
    },
    onUp() {
      if (!dragging) return;
      dragging = false;
      // Resume normal satellite rotation after release
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        if (!disposed && !reduceMotion) autoSpin = true;
      }, 400);
    },
  };

  function bindOrbitTarget(el) {
    if (!el || disposed) return () => {};
    const down = (e) => {
      // Only empty desktop / ambient bg — not icons, windows, taskbar, menus
      if (e.target !== el) return;
      if (e.button != null && e.button !== 0) return;
      orbit.onDown(e);
    };
    const move = (e) => orbit.onMove(e);
    const up = () => orbit.onUp();
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }

  let unbindOrbit = null;

  function disposeAll() {
    if (disposed) return;
    disposed = true;
    running = false;
    cancelAnimationFrame(raf);
    clearTimeout(resizeTimer);
    clearTimeout(resumeTimer);
    if (typeof unbindOrbit === "function") unbindOrbit();
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", onResize);
      window.visualViewport.removeEventListener("scroll", onResize);
    }
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    if (glareEl) glareEl.style.opacity = "0";
    try {
      renderer.dispose();
      earth.geometry.dispose();
      grid.geometry.dispose();
      moon.geometry.dispose();
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
    if (typeof opts.onContextLost === "function") opts.onContextLost();
  }
  canvas.addEventListener("webglcontextlost", onContextLost, false);

  document.body.classList.add("asx-bg-three");
  document.body.classList.remove("asx-bg-ambient");

  return {
    mode: "three-earth",
    dispose: disposeAll,
    bindOrbitTarget(el) {
      if (typeof unbindOrbit === "function") unbindOrbit();
      unbindOrbit = bindOrbitTarget(el);
    },
  };
}

/** True when we should skip Three and use ambient SVG/D3 path */
export function shouldUseAmbientBg() {
  if (typeof window === "undefined") return true;
  const w =
    window.visualViewport?.width ||
    window.innerWidth ||
    document.documentElement.clientWidth ||
    0;
  if (w > 0 && w <= 420) return true;
  try {
    if (new URLSearchParams(location.search).get("bg") === "ambient") return true;
    if (new URLSearchParams(location.search).get("bg") === "three") return false;
    if (new URLSearchParams(location.search).get("bg") === "earth") return false;
  } catch {
    /* ignore */
  }
  if (navigator.connection?.saveData) return true;
  return false;
}
