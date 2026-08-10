/**
 * ASX Desktop — Three.js satellite view of Earth
 *
 * ASX as protector-of-Earth viewpoint: natural textured Earth (no lattice lines).
 * Distant sun sized by *angular diameter* (not linear AU) so it still reads as a
 * ball of fire — real sky θ≈0.53°; ASX art ~2° disc + bloom. Moon orbit good.
 * Translucent drifting clouds (NASA + climate priors) — continents stay readable;
 * weather scrolls and fades so cover never freezes into an ice sheet.
 * Drag empty desktop to look; release → auto orbit.
 * Double-click Earth → Google-Earth-like zoom toward that point; wheel zoom;
 * double-click empty space → zoom back out.
 *
 * Research (audit-log / public transparency):
 * - agents/research/threejs/google_earth_threejs_matchup_20260810.md
 * - agents/research/threejs/cloud_cover_simulation_20260810.md
 * - agents/research/threejs/sun_angular_scale_architecture_20260810.md
 * - website/desktop-os/docs/RESOURCE_CDN_POLICY.md (CDN-first delivery)
 */

/**
 * Free public CDNs first (jsDelivr / threejs.org); our /assets/cdn/* is fallback only.
 * (We cannot Cache-Rule jsdelivr.com — not our zone — but they already long-cache.)
 */
const TEX = {
  earth:
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_atmos_2048.jpg",
  earthNormal:
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_normal_2048.jpg",
  earthSpec:
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_specular_2048.jpg",
  earthClouds:
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_clouds_1024.png",
  earthCloudsFallbacks: [
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_clouds_1024.png",
    "https://threejs.org/examples/textures/planets/earth_clouds_1024.png",
    "/assets/cdn/three-r128/planets/earth_clouds_1024.png",
    "https://raw.githubusercontent.com/mrdoob/three.js/r128/examples/textures/planets/earth_clouds_1024.png",
  ],
  moon:
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/moon_1024.jpg",
  // Same-origin mirror if free CDN fails
  local: {
    earth: "/assets/cdn/three-r128/planets/earth_atmos_2048.jpg",
    earthNormal: "/assets/cdn/three-r128/planets/earth_normal_2048.jpg",
    earthSpec: "/assets/cdn/three-r128/planets/earth_specular_2048.jpg",
    moon: "/assets/cdn/three-r128/planets/moon_1024.jpg",
  },
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

function loadTexture(loader, url, fallbackUrl) {
  return new Promise((resolve) => {
    const tryUrl = (u, next) => {
      if (!u) {
        resolve(null);
        return;
      }
      loader.load(
        u,
        (tex) => {
          tex.anisotropy = 4;
          resolve(tex);
        },
        undefined,
        () => {
          if (next) tryUrl(next, null);
          else resolve(null);
        }
      );
    };
    tryUrl(url, fallbackUrl || null);
  });
}

function latLngFromPoint(p, radius) {
  const r = radius || p.length();
  const lat = 90 - (Math.acos(Math.min(1, Math.max(-1, p.y / r))) * 180) / Math.PI;
  const lng = ((270 + (Math.atan2(p.x, p.z) * 180) / Math.PI) % 360) - 180;
  return { lat, lng };
}

/**
 * Annual-mean-ish cloud fraction priors by region (ISCCP / Wikipedia / climate atlas synthesis).
 * Global ~0.67; oceans ~0.72; land ~0.55. Sahara / Mideast / Australia drier;
 * ITCZ, storm tracks, Amazon, monsoon belts wetter. Never used alone — mixed with
 * seeded noise so each page load is a different weather day.
 *
 * Sources logged in cloud_cover_simulation_20260810.md (public research folder).
 */
const CLOUD_REGIONS = [
  // name, latMin, latMax, lngMin, lngMax, prior
  ["sahara", 12, 32, -18, 38, 0.18],
  ["middle_east", 12, 36, 35, 62, 0.22],
  ["australia_interior", -35, -14, 115, 150, 0.3],
  ["sw_us_desert", 22, 38, -120, -100, 0.28],
  ["southern_africa_dry", -32, -16, 12, 30, 0.34],
  ["gobi_central_asia", 35, 50, 70, 110, 0.36],
  ["amazon", -12, 8, -78, -48, 0.78],
  ["congo", -6, 6, 10, 32, 0.74],
  ["se_asia_monsoon", 0, 28, 70, 140, 0.73],
  ["europe", 36, 72, -15, 42, 0.68],
  ["east_n_america", 30, 55, -95, -55, 0.66],
  ["west_n_america_coast", 35, 60, -130, -115, 0.7],
  ["southern_ocean", -65, -42, -180, 180, 0.82],
  ["itcz", -10, 10, -180, 180, 0.76],
  ["antarctica", -90, -70, -180, 180, 0.5],
  ["arctic", 70, 90, -180, 180, 0.58],
];

/** Rough land boxes when no named arid/wet region matches (prior ≈ land mean ~0.55). */
const LAND_BOXES = [
  [15, 72, -170, -50], // N America
  [-56, 14, -82, -34], // S America
  [35, 72, -12, 40], // Europe
  [-35, 38, -18, 52], // Africa
  [5, 75, 40, 180], // Asia
  [-45, -10, 110, 155], // Australia
];

function inBox(lat, lng, latMin, latMax, lngMin, lngMax) {
  if (lat < latMin || lat > latMax) return false;
  if (lngMin <= lngMax) return lng >= lngMin && lng <= lngMax;
  // wrap (unused for current boxes)
  return lng >= lngMin || lng <= lngMax;
}

/**
 * Climate prior for one equirectangular sample.
 * @returns {number} cloud fraction prior 0..1
 */
function cloudPrior(lat, lng) {
  // Named regions: first match wins (order = specificity)
  for (let i = 0; i < CLOUD_REGIONS.length; i++) {
    const r = CLOUD_REGIONS[i];
    if (inBox(lat, lng, r[1], r[2], r[3], r[4])) return r[5];
  }
  for (let i = 0; i < LAND_BOXES.length; i++) {
    const b = LAND_BOXES[i];
    if (inBox(lat, lng, b[0], b[1], b[2], b[3])) return 0.54;
  }
  // Open ocean default (higher than land)
  return 0.71;
}

function hash2(ix, iy, seed) {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function smoothNoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = hash2(x0, y0, seed);
  const n10 = hash2(x0 + 1, y0, seed);
  const n01 = hash2(x0, y0 + 1, seed);
  const n11 = hash2(x0 + 1, y0 + 1, seed);
  const a = n00 + (n10 - n00) * sx;
  const b = n01 + (n11 - n01) * sx;
  return a + (b - a) * sy;
}

function fbm(x, y, seed, octaves) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * smoothNoise(x * freq, y * freq, seed + o * 1013);
    norm += amp;
    amp *= 0.5;
    freq *= 2.05;
  }
  return sum / (norm || 1);
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Build a randomized but climate-weighted cloud alpha map for one page load.
 * When earth_clouds_1024.png loads, its structure is the primary shape prior
 * (seeded UV phase so each visit is a different "weather day"); FBM + continent
 * priors still modulate coverage. Global mean forced to ~58–74%.
 *
 * @param {{ seed: number, width: number, height: number, targetMean?: number, baseImage?: HTMLImageElement|HTMLCanvasElement|null, nasaWeight?: number, phaseX?: number }} opts
 * @returns {{ canvas: HTMLCanvasElement, mean: number, seed: number, targetMean: number, usedNasa: boolean }}
 */
function generateCloudCoverMap(opts) {
  const seed = (opts.seed >>> 0) || 1;
  const width = opts.width || 512;
  const height = opts.height || 256;
  const targetMean = Math.min(
    0.74,
    Math.max(0.58, opts.targetMean != null ? opts.targetMean : 0.66)
  );
  // When NASA map is present, default strong structure blend (user-requested)
  const nasaWeight =
    opts.nasaWeight != null
      ? Math.min(1, Math.max(0, opts.nasaWeight))
      : 0.72;

  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return { canvas: c, mean: 0, seed, targetMean, usedNasa: false };
  }

  // Optional NASA earth_clouds_1024 structure (drawn full-frame, then sampled with phase)
  let baseData = null;
  let usedNasa = false;
  if (opts.baseImage && opts.baseImage.width) {
    try {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(opts.baseImage, 0, 0, width, height);
      baseData = ctx.getImageData(0, 0, width, height).data;
      usedNasa = true;
    } catch (e) {
      console.warn("[ASX] earth_clouds blend: canvas tainted or draw failed", e);
      baseData = null;
      usedNasa = false;
    }
  }

  const img = ctx.createImageData(width, height);
  const data = img.data;
  // Weather-day offsets so pattern is not locked to the static NASA map
  const dayU = ((seed % 997) / 997) * 8;
  const dayV = (((seed >>> 10) % 991) / 991) * 6;
  const scale = 4.2 + ((seed % 50) / 50) * 1.6;
  // Longitude phase shift of NASA map (different face each load)
  const phaseX =
    opts.phaseX != null
      ? ((opts.phaseX % 1) + 1) % 1
      : (seed % 1000) / 1000;
  const phasePx = Math.floor(phaseX * width);

  let sum = 0;
  const alphas = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    const v = y / (height - 1);
    const lat = 90 - v * 180;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const lng = u * 360 - 180;
      const prior = cloudPrior(lat, lng);

      // Multi-scale weather noise (each seed = different synoptic day)
      const n1 = fbm(u * scale + dayU, v * scale * 0.85 + dayV, seed, 5);
      const n2 = fbm(u * scale * 2.3 - dayV, v * scale * 2.1 + dayU, seed ^ 0x9e3779b9, 3);
      let d = n1 * 0.62 + n2 * 0.38;

      // Blend NASA earth_clouds_1024.png structure (primary when available)
      if (baseData) {
        const sx = (x + phasePx) % width;
        const bi = (y * width + sx) * 4;
        const lum =
          (baseData[bi] * 0.299 + baseData[bi + 1] * 0.587 + baseData[bi + 2] * 0.114) /
          255;
        const ba = baseData[bi + 3] / 255;
        // PNG may be white-on-black or alpha; take either channel as cloud amount
        const baseCloud = Math.max(lum, ba);
        d = baseCloud * nasaWeight + d * (1 - nasaWeight);
      }

      // Region prior: arid zones clear more often; ocean/ITCZ rarely clear
      const thresh = usedNasa
        ? 0.28 - prior * 0.14 // preserve NASA filaments more
        : 0.42 - prior * 0.22;
      let a = smoothstep(thresh, thresh + 0.38 + prior * 0.12, d);
      a *= 0.4 + prior * 0.75;
      if (Math.abs(lat) > 78) a *= 0.55 + (90 - Math.abs(lat)) / 30;

      alphas[y * width + x] = a;
      sum += a;
    }
  }

  let mean = sum / (width * height);
  // Force global coverage into realistic band — real Earth is almost never clear
  const scaleMean = mean > 1e-6 ? targetMean / mean : 1;
  // Soft max alpha: veil, not ice sheet — landmasses (and Pacific) stay legible
  const softCap = 0.62;
  sum = 0;
  for (let i = 0; i < alphas.length; i++) {
    let a = Math.min(1, alphas[i] * scaleMean);
    a = Math.pow(a, 1.12) * softCap;
    if (a > 0.015 && a < 0.04) a = 0.04;
    alphas[i] = a;
    sum += a;
    const pi = i * 4;
    // Warm-grey mist (not pure white polar ice)
    data[pi] = 232;
    data[pi + 1] = 236;
    data[pi + 2] = 242;
    data[pi + 3] = Math.round(a * 255);
  }
  mean = sum / alphas.length;
  ctx.putImageData(img, 0, 0);
  return { canvas: c, mean, seed, targetMean, usedNasa };
}

function loadImage(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Try primary + fallback URLs until earth_clouds_1024.png loads (CORS-safe). */
async function loadEarthCloudsBase() {
  const urls = [TEX.earthClouds].concat(TEX.earthCloudsFallbacks || []);
  const seen = new Set();
  for (const url of urls) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const img = await loadImage(url);
    if (img) return { img, url };
  }
  return { img: null, url: null };
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

  // --- Sun: architecture scale (angular size first, not 1 AU linear) ---
  // Real physics: 1 AU ≈ 8.3 light-minutes, θ_sun ≈ 0.53° from Earth *and* from
  // LEO (altitude << AU). Moon θ similar. Linear 1:1 AU makes a useless speck on
  // a website; we keep the sun *optically* far (low parallax past the Moon) but
  // size the photosphere for a readable fireball disc + bloom.
  // Research: sun_angular_scale_architecture_20260810.md
  scene.add(new THREE.AmbientLight(0x0a1528, 0.32));
  const sunDir = new THREE.Vector3(0.65, 0.22, -0.73).normalize();
  // ~65 Earth radii out — far past Moon (~2.85 R), still inside far plane
  const SUN_DIST = 520;
  // Art-directed angular diameter (~real 0.53° is tiny on FOV 48°; ~2.3° + corona
  // still reads "distant ball of fire" without becoming a nearby lantern)
  const SUN_ANGULAR_DEG = tiny ? 2.8 : mobile ? 2.5 : 2.3;
  const SUN_R =
    SUN_DIST * Math.tan(((SUN_ANGULAR_DEG * Math.PI) / 180) / 2);
  const sunWorld = sunDir.clone().multiplyScalar(SUN_DIST);

  const sunLight = new THREE.DirectionalLight(0xfff4e0, 1.75);
  sunLight.position.copy(sunWorld);
  scene.add(sunLight);
  // Soft fill so night side isn't pure void
  scene.add(new THREE.AmbientLight(0x121a2c, 0.1));
  // Warm point at photosphere — local fireball presence without moving the sun closer
  const sunPoint = new THREE.PointLight(0xffddaa, 0.55, SUN_DIST * 1.8, 2);
  sunPoint.position.copy(sunWorld);
  scene.add(sunPoint);

  const sunGroup = new THREE.Group();
  sunGroup.position.copy(sunWorld);

  // Photosphere — hard disc you can resolve as a ball (not a 1-pixel star)
  const sunCore = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_R, tiny ? 20 : 32, tiny ? 16 : 24),
    new THREE.MeshBasicMaterial({ color: 0xfffaf0 })
  );
  // Chromosphere rim
  const sunChromo = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_R * 1.12, 24, 18),
    new THREE.MeshBasicMaterial({
      color: 0xffc266,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  // Inner corona
  const sunCorona = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_R * 2.1, 24, 18),
    new THREE.MeshBasicMaterial({
      color: 0xffb060,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  // Outer halo — why space photos still feel like a "ball of fire"
  const sunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_R * 4.2, 20, 16),
    new THREE.MeshBasicMaterial({
      color: 0xff9940,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  // Faint outer scatter
  const sunScatter = new THREE.Mesh(
    new THREE.SphereGeometry(SUN_R * 7.5, 16, 12),
    new THREE.MeshBasicMaterial({
      color: 0xff8822,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  sunGroup.add(sunCore);
  sunGroup.add(sunChromo);
  sunGroup.add(sunCorona);
  sunGroup.add(sunHalo);
  sunGroup.add(sunScatter);
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

  // --- Earth (natural — no lattice / orbit lines; satellites stay invisible) ---
  const earthGroup = new THREE.Group();
  scene.add(earthGroup);

  const earthMat = new THREE.MeshPhongMaterial({
    color: 0x2266aa,
    emissive: 0x020810,
    specular: 0x445566,
    shininess: 22,
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

  // Cloud shell — translucent veil so continents (and the vast Pacific) stay legible
  const cloudSeed =
    (Math.floor(Math.random() * 0xffffffff) ^
      (Date.now() & 0xffffffff) ^
      ((performance.now() * 1000) | 0)) >>>
    0;
  // Coverage still realistic; transparency is material + softCap, not zero clouds
  const cloudTargetMean = 0.55 + Math.random() * 0.14; // 55–69%
  const cloudMapW = tiny ? 256 : mobile ? 512 : 1024;
  const cloudMapH = Math.max(128, cloudMapW >> 1);
  let cloudCoverMeta = {
    seed: cloudSeed,
    targetMean: cloudTargetMean,
    mean: 0,
    mode: "pending",
  };

  const cloudMat = new THREE.MeshPhongMaterial({
    color: 0xe8ecf2,
    transparent: true,
    opacity: 0.52,
    depthWrite: false,
    side: THREE.FrontSide,
    specular: 0x222222,
    shininess: 4,
  });
  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(
      EARTH_R * 1.018,
      tiny ? 24 : mobile ? 40 : 56,
      tiny ? 16 : mobile ? 28 : 40
    ),
    cloudMat
  );
  clouds.renderOrder = 2;
  earthGroup.add(clouds);

  // Thin high-cirrus shell — faster opposite drift for living weather
  const cirrusMat = new THREE.MeshBasicMaterial({
    color: 0xdde6f0,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  const cirrus = new THREE.Mesh(
    new THREE.SphereGeometry(
      EARTH_R * 1.028,
      tiny ? 16 : 32,
      tiny ? 12 : 24
    ),
    cirrusMat
  );
  cirrus.renderOrder = 3;
  earthGroup.add(cirrus);

  // Weather motion state (texture scroll + opacity breath — clouds never frozen)
  let cloudTexScroll = 0;
  let cirrusTexScroll = 0;
  let weatherPhase = Math.random() * Math.PI * 2;

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

  // Textures + climate-weighted cloud map; NASA earth_clouds_1024.png blended when loadable
  const loader = new THREE.TextureLoader();
  loader.crossOrigin = "anonymous";
  Promise.all([
    loadTexture(loader, TEX.earth, TEX.local.earth),
    loadTexture(loader, TEX.earthNormal, TEX.local.earthNormal),
    loadTexture(loader, TEX.earthSpec, TEX.local.earthSpec),
    loadTexture(loader, TEX.moon, TEX.local.moon),
    loadEarthCloudsBase(),
  ]).then(([day, normal, spec, moonTex, cloudBase]) => {
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

    const cloudBaseImg = cloudBase && cloudBase.img ? cloudBase.img : null;
    const nasaPhase = (cloudSeed % 1000) / 1000;
    const cover = generateCloudCoverMap({
      seed: cloudSeed,
      width: cloudMapW,
      height: cloudMapH,
      targetMean: cloudTargetMean,
      baseImage: cloudBaseImg,
      nasaWeight: cloudBaseImg ? 0.72 : 0,
      phaseX: nasaPhase,
    });
    cloudCoverMeta = {
      seed: cover.seed,
      targetMean: cover.targetMean,
      mean: cover.mean,
      usedNasa: !!cover.usedNasa,
      nasaUrl: cloudBase && cloudBase.url ? cloudBase.url : null,
      nasaWeight: cover.usedNasa ? 0.72 : 0,
      mode: cover.usedNasa
        ? "earth_clouds_1024+climate-prior"
        : "procedural+climate-prior",
      mapPx: cloudMapW + "x" + cloudMapH,
    };

    const cloudTex = new THREE.CanvasTexture(cover.canvas);
    cloudTex.wrapS = THREE.RepeatWrapping;
    cloudTex.wrapT = THREE.ClampToEdgeWrapping;
    // Phase already baked into map sample; small extra offset for variety
    cloudTex.offset.x = 0;
    if (cloudTex.encoding !== undefined) cloudTex.encoding = THREE.sRGBEncoding;
    cloudTex.needsUpdate = true;
    cloudMat.map = cloudTex;
    cloudMat.alphaMap = cloudTex;
    cloudMat.transparent = true;
    cloudMat.opacity = 0.52;
    cloudMat.needsUpdate = true;

    // Cirrus: lighter NASA blend + different phase (high thin veil)
    const cirrusCover = generateCloudCoverMap({
      seed: (cloudSeed ^ 0xa5a5a5a5) >>> 0,
      width: Math.max(128, cloudMapW >> 1),
      height: Math.max(64, cloudMapH >> 1),
      targetMean: Math.min(0.5, cloudTargetMean * 0.5),
      baseImage: cloudBaseImg,
      nasaWeight: cloudBaseImg ? 0.45 : 0,
      phaseX: (nasaPhase + 0.37) % 1,
    });
    const cirrusTex = new THREE.CanvasTexture(cirrusCover.canvas);
    cirrusTex.wrapS = THREE.RepeatWrapping;
    cirrusTex.wrapT = THREE.ClampToEdgeWrapping;
    cirrusTex.offset.x = 0;
    cirrusTex.needsUpdate = true;
    cirrusMat.map = cirrusTex;
    cirrusMat.alphaMap = cirrusTex;
    cirrusMat.opacity = 0.22;
    cirrusMat.needsUpdate = true;

    // Public transparency: audit attributes + console (source is shared)
    try {
      canvas.dataset.asxCloudSeed = String(cloudCoverMeta.seed);
      canvas.dataset.asxCloudCover = cover.mean.toFixed(3);
      canvas.dataset.asxCloudTarget = cover.targetMean.toFixed(3);
      canvas.dataset.asxCloudMode = cloudCoverMeta.mode;
      canvas.dataset.asxCloudNasa = cover.usedNasa ? "1" : "0";
    } catch {
      /* ignore */
    }
    console.info(
      "[ASX] Earth cloud cover · mean≈" +
        (cover.mean * 100).toFixed(1) +
        "% · target " +
        (cover.targetMean * 100).toFixed(0) +
        "% · seed 0x" +
        cover.seed.toString(16) +
        " · " +
        cloudCoverMeta.mode +
        (cover.usedNasa ? " · nasaWeight=0.72" : " · NASA map unavailable, procedural only") +
        " (research: cloud_cover_simulation_20260810.md)"
    );
    showZoomHint(
      "Cloud cover · ~" +
        (cover.mean * 100).toFixed(0) +
        "% · " +
        (cover.usedNasa ? "NASA clouds + climate" : "climate procedural") +
        " · seed 0x" +
        cover.seed.toString(16)
    );
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
      Math.abs(_vNdc.x) < 1.35 &&
      Math.abs(_vNdc.y) < 1.35;
    glareEl.style.setProperty("--gx", 50 + _vNdc.x * 50 + "%");
    glareEl.style.setProperty("--gy", 50 - _vNdc.y * 50 + "%");

    // Bright disc + bloom when the sun is in view (space photos: always a fireball,
    // not a one-frame spark). Peak when looking near it; soft presence otherwise.
    if (onScreen && align > 0.82) {
      glareHold = Math.max(glareHold, 2.8);
    }
    if (onScreen) {
      const near = Math.max(0, (align - 0.72) / 0.28);
      const hold = Math.min(1, glareHold / 2.8);
      // Soft floor so a visible sun always contributes glare
      const op = Math.min(0.88, 0.12 + near * 0.62 + hold * 0.22 * near);
      glareEl.style.opacity = String(op);
      glareEl.classList.toggle("hot", near > 0.55);
    } else if (glareHold > 0) {
      const hold = Math.min(1, glareHold / 2.8);
      glareEl.style.opacity = String(0.08 * hold);
      glareEl.classList.remove("hot");
    } else {
      glareEl.style.opacity = "0";
      glareEl.classList.remove("hot");
    }
  }

  function frame(now) {
    if (disposed) return;
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;

    earth.rotation.y += dt * 0.06;

    // Living weather: differential rotation + UV scroll + opacity breath.
    // Real clouds never sit still relative to the ground; they advect and thin.
    if (!reduceMotion) {
      weatherPhase += dt * 0.35;
      // Shells drift relative to Earth (and each other)
      clouds.rotation.y += dt * 0.095;
      cirrus.rotation.y -= dt * 0.055;
      cirrus.rotation.x += dt * 0.012;
      // Texture scroll = weather systems moving / reforming
      cloudTexScroll = (cloudTexScroll + dt * 0.018) % 1;
      cirrusTexScroll = (cirrusTexScroll - dt * 0.027 + 1) % 1;
      if (cloudMat.map) {
        cloudMat.map.offset.x = cloudTexScroll;
        cloudMat.map.needsUpdate = true;
      }
      if (cirrusMat.map) {
        cirrusMat.map.offset.x = cirrusTexScroll;
        cirrusMat.map.offset.y = Math.sin(weatherPhase * 0.4) * 0.02;
        cirrusMat.map.needsUpdate = true;
      }
      // Soft pulse: patches thicken and thin (disappear / reappear feel)
      const breath = 0.5 + 0.5 * Math.sin(weatherPhase);
      const breath2 = 0.5 + 0.5 * Math.sin(weatherPhase * 1.37 + 1.1);
      cloudMat.opacity = 0.42 + breath * 0.16; // ~0.42–0.58
      cirrusMat.opacity = 0.14 + breath2 * 0.14; // ~0.14–0.28
    } else {
      clouds.rotation.y = earth.rotation.y * 1.05;
      cirrus.rotation.y = earth.rotation.y * 0.92;
    }

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
      clouds.geometry.dispose();
      cirrus.geometry.dispose();
      if (cloudMat.map) cloudMat.map.dispose();
      if (cirrusMat.map) cirrusMat.map.dispose();
      cloudMat.dispose();
      cirrusMat.dispose();
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
    /** Climate-weighted cloud cover meta for this page load (audit / transparency). */
    getCloudCover() {
      return { ...cloudCoverMeta };
    },
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
