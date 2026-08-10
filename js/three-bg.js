/**
 * ASX Desktop — Three.js satellite view of Earth
 *
 * ASX as protector-of-Earth viewpoint: textured Earth + lattice grid (no outer rings).
 * Distant sun (glare-first, not a nearby ball). Moon orbit.
 * Drag empty desktop to look; release → auto orbit.
 * Double-click Earth → Google-Earth-like zoom toward that point; wheel zoom;
 * double-click empty space → zoom back out.
 *
 * Research (2026-08-10): true Google Earth = map tiles / Cesium / geo-three / Maps API.
 * Matching ASX guest desktop = raycast + camera dolly (patlov/earthThreeJS, discourse,
 * three-globe patterns) — not Google's proprietary globe product.
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

const EARTH_R = 8;
const RADIUS_FAR = 36;
const RADIUS_NEAR = EARTH_R * 1.28; // surface approach (not through crust)
const RADIUS_MID = EARTH_R * 2.1;

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

function latLngFromPoint(p, radius) {
  const r = radius || p.length();
  const lat = 90 - (Math.acos(Math.min(1, Math.max(-1, p.y / r))) * 180) / Math.PI;
  const lng = ((270 + (Math.atan2(p.x, p.z) * 180) / Math.PI) % 360) - 180;
  return { lat, lng };
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
  scene.background = new THREE.Color(0x010208);
  scene.fog = new THREE.FogExp2(0x010208, tiny ? 0.008 : 0.0035);

  const { w: iw, h: ih } = viewSize(canvas);
  const camera = new THREE.PerspectiveCamera(tiny ? 55 : 48, iw / ih, 0.1, 8000);

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
  renderer.setClearColor(0x010208, 1);
  if (renderer.outputEncoding !== undefined) {
    renderer.outputEncoding = THREE.sRGBEncoding;
  }

  // --- Lights: distant sun (real-sun feel: tiny disc, strong parallel light) ---
  scene.add(new THREE.AmbientLight(0x0a1528, 0.28));
  // Sun direction unit (from far away)
  const sunDir = new THREE.Vector3(0.65, 0.22, -0.73).normalize();
  const SUN_DIST = 2800; // way beyond Earth scale
  const sunWorld = sunDir.clone().multiplyScalar(SUN_DIST);

  const sunLight = new THREE.DirectionalLight(0xfff2dd, 1.55);
  sunLight.position.copy(sunWorld);
  scene.add(sunLight);
  // Tiny fill only on lit side
  const sunFill = new THREE.AmbientLight(0x1a2030, 0.08);
  scene.add(sunFill);

  // Distant sun: almost point-like (angular size tiny like real sun ~0.5°)
  const sunGroup = new THREE.Group();
  sunGroup.position.copy(sunWorld);
  const sunCore = new THREE.Mesh(
    new THREE.SphereGeometry(4.2, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff8e7 })
  );
  // Soft corona only — no large nearby ball
  const sunCorona = new THREE.Mesh(
    new THREE.SphereGeometry(14, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0xffcc88,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    })
  );
  sunGroup.add(sunCore);
  sunGroup.add(sunCorona);
  scene.add(sunGroup);

  // --- Stars ---
  const starGeo = new THREE.BufferGeometry();
  const nStars = reduceMotion ? 220 : tiny ? 400 : mobile ? 800 : 1800;
  const starPos = new Float32Array(nStars * 3);
  for (let i = 0; i < nStars * 3; i++) {
    starPos[i] = (Math.random() - 0.5) * 1200;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      color: 0xdce6ff,
      size: tiny ? 0.4 : 0.28,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: true,
      depthWrite: false,
    })
  );
  scene.add(stars);

  // --- Earth + grid (no outer torus rings) ---
  const earthGroup = new THREE.Group();
  scene.add(earthGroup);

  const earthMat = new THREE.MeshPhongMaterial({
    color: 0x2266aa,
    emissive: 0x020810,
    specular: 0x334455,
    shininess: 16,
  });
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(
      EARTH_R,
      tiny ? 32 : mobile ? 48 : 64,
      tiny ? 24 : mobile ? 36 : 48
    ),
    earthMat
  );
  earthGroup.add(earth);

  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R * 1.04, 32, 24),
    new THREE.MeshBasicMaterial({
      color: 0x4da3ff,
      transparent: true,
      opacity: 0.11,
      side: THREE.BackSide,
      depthWrite: false,
    })
  );
  earthGroup.add(atmo);

  // ASX protector lattice / graphical grid
  const grid = new THREE.Mesh(
    new THREE.IcosahedronGeometry(EARTH_R * 1.1, 1),
    new THREE.MeshBasicMaterial({
      color: 0xa78bfa,
      wireframe: true,
      transparent: true,
      opacity: 0.32,
    })
  );
  earthGroup.add(grid);

  // Moon
  const moonMat = new THREE.MeshPhongMaterial({
    color: 0xbbb8b0,
    emissive: 0x0a0a0a,
    shininess: 4,
  });
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_R * 0.27, tiny ? 16 : 32, tiny ? 12 : 24),
    moonMat
  );
  const moonOrbit = new THREE.Group();
  moon.position.set(EARTH_R * 2.85, EARTH_R * 0.15, 0);
  moonOrbit.add(moon);
  earthGroup.add(moonOrbit);

  // Textures
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
    if (spec) earthMat.specularMap = spec;
    earthMat.needsUpdate = true;
    if (moonTex) {
      if (moonTex.encoding !== undefined) moonTex.encoding = THREE.sRGBEncoding;
      moonMat.map = moonTex;
      moonMat.color.set(0xffffff);
      moonMat.needsUpdate = true;
    }
  });

  // --- Satellite camera ---
  let theta = 0.55;
  let phi = 1.12;
  let radius = tiny ? RADIUS_FAR * 1.05 : RADIUS_FAR;
  let targetRadius = radius;
  let lookTarget = new THREE.Vector3(0, 0, 0);
  let lookGoal = new THREE.Vector3(0, 0, 0);
  let autoSpin = !reduceMotion;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let resumeTimer = 0;
  let glareHold = 0;
  let zoomLabel = null;

  const glareEl = ensureGlareEl();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const _vSun = new THREE.Vector3();
  const _vLook = new THREE.Vector3();
  const _vNdc = new THREE.Vector3();
  const _tmp = new THREE.Vector3();

  function ensureZoomHint() {
    if (zoomLabel) return zoomLabel;
    zoomLabel = document.createElement("div");
    zoomLabel.id = "earth-zoom-hint";
    zoomLabel.setAttribute("aria-live", "polite");
    document.body.appendChild(zoomLabel);
    return zoomLabel;
  }

  function showZoomHint(text) {
    const el = ensureZoomHint();
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(showZoomHint._t);
    showZoomHint._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function placeCamera() {
    const sp = Math.sin(phi);
    camera.position.set(
      radius * sp * Math.sin(theta),
      radius * Math.cos(phi),
      radius * sp * Math.cos(theta)
    );
    camera.lookAt(lookTarget);
  }
  placeCamera();

  let raf = 0;
  let running = true;
  let resizeTimer = 0;
  let disposed = false;
  let t0 = performance.now();

  function updateGlare() {
    if (!glareEl) return;
    _vSun.copy(sunGroup.position).sub(camera.position).normalize();
    camera.getWorldDirection(_vLook);
    const align = _vSun.dot(_vLook);
    _vNdc.copy(sunGroup.position).project(camera);
    const onScreen =
      _vNdc.z < 1 &&
      Math.abs(_vNdc.x) < 1.15 &&
      Math.abs(_vNdc.y) < 1.15;
    glareEl.style.setProperty("--gx", 50 + _vNdc.x * 50 + "%");
    glareEl.style.setProperty("--gy", 50 - _vNdc.y * 50 + "%");

    // Real-sun style: only a tight glare bloom when nearly looking at the sun
    if (onScreen && align > 0.965) {
      glareHold = Math.max(glareHold, 3.2);
    }
    if (glareHold > 0) {
      const peak = onScreen ? Math.max(0, (align - 0.94) / 0.06) : 0;
      const hold = Math.min(1, glareHold / 3.2);
      const op = Math.min(0.72, (peak * 0.85 + hold * 0.25) * hold);
      glareEl.style.opacity = String(op);
    } else {
      glareEl.style.opacity = "0";
    }
  }

  function frame(now) {
    if (disposed) return;
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;

    earth.rotation.y += dt * 0.06;
    grid.rotation.y -= dt * 0.025;
    grid.rotation.x += dt * 0.008;
    moonOrbit.rotation.y += dt * 0.18;
    moon.rotation.y += dt * 0.04;
    stars.rotation.y += dt * 0.002;

    // Smooth zoom / look
    radius += (targetRadius - radius) * Math.min(1, dt * 3.2);
    lookTarget.lerp(lookGoal, Math.min(1, dt * 3.5));

    if (autoSpin && !dragging && !reduceMotion && targetRadius > RADIUS_MID) {
      theta += dt * 0.1;
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

  if (reduceMotion) frame(performance.now());
  else animate(performance.now());

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

  function setPointerFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;
  }

  function zoomTowardEarthHit(e) {
    setPointerFromEvent(e);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(earth, false);
    if (!hits.length) return false;
    const hit = hits[0].point.clone();
    // Aim slightly above surface along normal
    const normal = hit.clone().normalize();
    lookGoal.copy(normal.multiplyScalar(EARTH_R * 0.92));
    // Orbit angles from hit direction
    const dir = hit.clone().normalize();
    phi = Math.acos(Math.min(1, Math.max(-1, dir.y)));
    theta = Math.atan2(dir.x, dir.z);
    targetRadius = RADIUS_NEAR;
    autoSpin = false;
    clearTimeout(resumeTimer);
    const { lat, lng } = latLngFromPoint(hit, EARTH_R);
    showZoomHint(
      `ASX approach · ${lat.toFixed(1)}° lat, ${lng.toFixed(1)}° lng · scroll to zoom · double-click empty to pull out`
    );
    return true;
  }

  function zoomOutHome() {
    lookGoal.set(0, 0, 0);
    targetRadius = RADIUS_FAR;
    showZoomHint("ASX satellite view restored");
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      if (!disposed && !reduceMotion) autoSpin = true;
    }, 600);
  }

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
      // Sensitivity scales with zoom (tighter near surface)
      const sens = 0.004 * (radius / RADIUS_FAR);
      theta -= dx * sens * 1.2;
      phi -= dy * sens;
      phi = Math.max(0.2, Math.min(Math.PI - 0.2, phi));
    },
    onUp() {
      if (!dragging) return;
      dragging = false;
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        // Only auto-spin when zoomed out
        if (!disposed && !reduceMotion && targetRadius > RADIUS_MID) {
          autoSpin = true;
        }
      }, 450);
    },
  };

  function onWheel(e) {
    if (disposed) return;
    // Only when over empty desktop or while zoomed (layer target)
    e.preventDefault();
    const delta = Math.sign(e.deltaY);
    const factor = 1 + delta * 0.08;
    targetRadius = Math.min(
      RADIUS_FAR * 1.35,
      Math.max(RADIUS_NEAR, targetRadius * factor)
    );
    autoSpin = false;
    clearTimeout(resumeTimer);
    if (targetRadius > RADIUS_MID) {
      lookGoal.set(0, 0, 0);
      resumeTimer = setTimeout(() => {
        if (!disposed && !reduceMotion) autoSpin = true;
      }, 800);
    }
  }

  function bindOrbitTarget(el) {
    if (!el || disposed) return () => {};
    const down = (e) => {
      if (e.target !== el) return;
      if (e.button != null && e.button !== 0) return;
      orbit.onDown(e);
    };
    const move = (e) => orbit.onMove(e);
    const up = () => orbit.onUp();
    const dbl = (e) => {
      if (e.target !== el) return;
      // Double-click Earth → zoom in; double-click empty space → zoom out
      if (!zoomTowardEarthHit(e)) {
        zoomOutHome();
      }
    };
    const wheel = (e) => {
      if (e.target !== el && !el.contains(e.target)) return;
      // Only wheel on empty desktop surface
      if (e.target !== el) return;
      onWheel(e);
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    el.addEventListener("dblclick", dbl);
    el.addEventListener("wheel", wheel, { passive: false });
    showZoomHint("Drag empty desktop to look · double-click Earth to approach · scroll to zoom");
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      el.removeEventListener("dblclick", dbl);
      el.removeEventListener("wheel", wheel);
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
    if (zoomLabel) zoomLabel.remove();
    try {
      renderer.dispose();
      earth.geometry.dispose();
      grid.geometry.dispose();
      moon.geometry.dispose();
      starGeo.dispose();
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

export function shouldUseAmbientBg() {
  if (typeof window === "undefined") return true;
  const w =
    window.visualViewport?.width ||
    window.innerWidth ||
    document.documentElement.clientWidth ||
    0;
  if (w > 0 && w <= 420) return true;
  try {
    const bg = new URLSearchParams(location.search).get("bg");
    if (bg === "ambient") return true;
    if (bg === "three" || bg === "earth") return false;
  } catch {
    /* ignore */
  }
  if (navigator.connection?.saveData) return true;
  return false;
}
