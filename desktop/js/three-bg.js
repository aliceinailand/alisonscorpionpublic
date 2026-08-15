/**
 * ASX Desktop — Three.js satellite view of Earth
 *
 * ASX as protector-of-Earth viewpoint: natural textured Earth (no lattice lines).
 * Distant sun sized by *angular diameter* (not linear AU) so it still reads as a
 * ball of fire — real sky θ≈0.53°; ASX art ~2° disc + bloom. Moon orbit good.
 * Translucent drifting clouds (NASA + climate priors) — continents stay readable;
 * weather scrolls and fades so cover never freezes into an ice sheet.
 * Celestial sphere: dense far stars + real RA/Dec catalog brights (no stick
 * figure lines) on a universe-purple void — background only; Earth/Moon focus.
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
 * Textures: public CDNs only — never our origin (rank #4 is shell-only).
 * Prefer jsDelivr (often Cloudflare-fronted) → threejs.org → raw.githubusercontent.
 * See docs/RESOURCE_CDN_POLICY.md (#1 Cloudflare ecosystem, then other CDNs).
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
    "https://raw.githubusercontent.com/mrdoob/three.js/r128/examples/textures/planets/earth_clouds_1024.png",
  ],
  moon:
    "https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/moon_1024.jpg",
  // Secondary public CDN hop (not our origin)
  alt: {
    earth:
      "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
    earthNormal:
      "https://threejs.org/examples/textures/planets/earth_normal_2048.jpg",
    earthSpec:
      "https://threejs.org/examples/textures/planets/earth_specular_2048.jpg",
    moon: "https://threejs.org/examples/textures/planets/moon_1024.jpg",
  },
};

const EARTH_R = 8;
const RADIUS_FAR = 36;
const RADIUS_NEAR = EARTH_R * 1.28; // surface approach (not through crust)
const RADIUS_MID = EARTH_R * 2.1;

/** Universe-purple void — brand night sky (not pure black). */
const VOID_PURPLE = 0x0a0618;
const VOID_FOG = 0x12081f;
const VOID_AMBIENT = 0x1a0f2e;

/**
 * Celestial sphere helpers — same sky from Earth surface and LEO
 * (stellar parallax ≪ 1″ for catalog stars; altitude ≪ AU).
 * RA hours (J2000-ish) + Dec degrees → Three.js Y-up cartesian.
 * Research: agents/research/threejs/earth_view_stars_constellations_20260810.md
 */
function raDecToXYZ(raHours, decDeg, radius) {
  const ra = (raHours / 24) * Math.PI * 2;
  const dec = (decDeg * Math.PI) / 180;
  const c = Math.cos(dec);
  return [
    radius * c * Math.cos(ra),
    radius * Math.sin(dec),
    radius * c * Math.sin(ra),
  ];
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomOnSphere(radius, rng) {
  // Uniform on sphere (not cube fill — avoids dense cube corners)
  const u = rng() * 2 - 1;
  const phi = rng() * Math.PI * 2;
  const s = Math.sqrt(Math.max(0, 1 - u * u));
  return [radius * s * Math.cos(phi), radius * u, radius * s * Math.sin(phi)];
}

/**
 * Bright catalog stars (approx J2000 RA/Dec, Vmag) — naked-eye anchors
 * visible from Earth. Colors lean spectral type (O/B blue-white … M orange-red).
 * Scorpius (Antares, Shaula, …) kept for ASX brand resonance.
 */
const BRIGHT_STARS = [
  // name, raH, decDeg, mag, rgb
  ["Sirius", 6.7525, -16.7161, -1.46, [0.72, 0.82, 1.0]],
  ["Canopus", 6.3992, -52.6957, -0.74, [1.0, 0.95, 0.88]],
  ["Rigil Kentaurus", 14.6601, -60.8339, -0.27, [1.0, 0.94, 0.82]],
  ["Arcturus", 14.261, 19.1824, -0.05, [1.0, 0.72, 0.42]],
  ["Vega", 18.6156, 38.7837, 0.03, [0.78, 0.88, 1.0]],
  ["Capella", 5.2782, 45.998, 0.08, [1.0, 0.9, 0.7]],
  ["Rigel", 5.2423, -8.2016, 0.13, [0.68, 0.78, 1.0]],
  ["Procyon", 7.655, 5.225, 0.34, [1.0, 0.94, 0.82]],
  ["Achernar", 1.6286, -57.2368, 0.46, [0.7, 0.8, 1.0]],
  ["Betelgeuse", 5.9195, 7.4071, 0.5, [1.0, 0.48, 0.28]],
  ["Hadar", 14.0637, -60.373, 0.61, [0.68, 0.78, 1.0]],
  ["Altair", 19.8464, 8.8683, 0.76, [1.0, 0.94, 0.88]],
  ["Acrux", 12.4433, -63.0991, 0.76, [0.7, 0.8, 1.0]],
  ["Aldebaran", 4.5987, 16.5093, 0.85, [1.0, 0.55, 0.28]],
  ["Antares", 16.4901, -26.4319, 0.96, [1.0, 0.38, 0.22]],
  ["Spica", 13.4199, -11.1613, 0.97, [0.72, 0.8, 1.0]],
  ["Pollux", 7.7553, 28.0262, 1.14, [1.0, 0.72, 0.45]],
  ["Fomalhaut", 22.9608, -29.6222, 1.16, [1.0, 0.96, 0.9]],
  ["Deneb", 20.6905, 45.2803, 1.25, [0.82, 0.9, 1.0]],
  ["Mimosa", 12.7954, -59.6888, 1.25, [0.68, 0.78, 1.0]],
  ["Regulus", 10.1395, 11.9672, 1.35, [0.72, 0.82, 1.0]],
  ["Adhara", 6.9771, -28.9721, 1.5, [0.65, 0.75, 1.0]],
  ["Shaula", 17.5601, -37.1038, 1.62, [0.7, 0.8, 1.0]],
  ["Castor", 7.5766, 31.8883, 1.58, [0.78, 0.88, 1.0]],
  ["Gacrux", 12.5194, -57.1132, 1.63, [1.0, 0.55, 0.4]],
  ["Bellatrix", 5.4189, 6.3497, 1.64, [0.7, 0.8, 1.0]],
  ["Elnath", 5.4382, 28.6075, 1.65, [0.75, 0.85, 1.0]],
  ["Alnilam", 5.6036, -1.2019, 1.69, [0.68, 0.78, 1.0]],
  ["Alnitak", 5.6793, -1.9426, 1.74, [0.65, 0.75, 1.0]],
  ["Alioth", 12.9004, 55.9598, 1.76, [0.78, 0.86, 1.0]],
  ["Dubhe", 11.0621, 61.751, 1.79, [1.0, 0.82, 0.55]],
  ["Mirfak", 3.4054, 49.8612, 1.79, [1.0, 0.9, 0.72]],
  ["Alkaid", 13.7923, 49.3133, 1.85, [0.7, 0.8, 1.0]],
  ["Sargas", 17.6219, -42.9978, 1.86, [1.0, 0.82, 0.55]],
  ["Polaris", 2.5303, 89.2641, 1.98, [1.0, 0.94, 0.82]],
  ["Mintaka", 5.5334, -0.2991, 2.23, [0.68, 0.78, 1.0]],
  ["Saiph", 5.7959, -9.6696, 2.09, [0.7, 0.8, 1.0]],
  ["Dschubba", 16.0056, -22.6217, 2.29, [0.7, 0.8, 1.0]],
  ["Larawag", 17.7081, -39.0299, 2.29, [1.0, 0.82, 0.55]],
  ["Merak", 11.0307, 56.3824, 2.37, [0.78, 0.86, 1.0]],
  ["Phecda", 11.8972, 53.6948, 2.44, [0.78, 0.86, 1.0]],
  ["Mizar", 13.3987, 54.9254, 2.27, [0.78, 0.86, 1.0]],
  ["Megrez", 12.2571, 57.0326, 3.31, [0.78, 0.86, 1.0]],
  ["Schedar", 0.6751, 56.5373, 2.24, [1.0, 0.7, 0.48]],
  ["Caph", 0.1529, 59.1498, 2.28, [1.0, 0.94, 0.85]],
  ["Gamma Cas", 0.9451, 60.7167, 2.47, [0.7, 0.8, 1.0]],
  ["Ruchbah", 1.4302, 60.2353, 2.68, [0.78, 0.86, 1.0]],
  ["Segin", 1.9066, 63.67, 3.35, [0.7, 0.8, 1.0]],
  ["Nunki", 18.9211, -26.2967, 2.05, [0.72, 0.82, 1.0]],
  ["Kaus Australis", 18.4029, -34.3846, 1.85, [1.0, 0.82, 0.55]],
];

/**
 * Build distant starfield: dense dim background + catalog brights.
 * Stars sit on a large sphere so they feel infinitely far (no cube-clump).
 * Constellation stick-figure lines intentionally omitted (stars only).
 */
function buildCelestialStarfield(THREE, { reduceMotion, tiny, mobile }) {
  const group = new THREE.Group();
  group.name = "celestial-sphere";
  const disposables = [];

  // Shell radius: outside Moon (~23) and Earth, inside camera far plane.
  // sizeAttenuation:false → size is *pixels* (old 0.3 world-units at r=920 = invisible).
  // fog:false → Exp2 fog was eating the far shell.
  const STAR_R = 280;
  const rng = mulberry32(0xa5c_2026); // stable field (not re-random each boot)

  const starMat = (sizePx, opacity) =>
    new THREE.PointsMaterial({
      size: sizePx,
      vertexColors: true,
      transparent: true,
      opacity,
      sizeAttenuation: false, // pixel stars — readable at any camera distance
      depthWrite: false,
      fog: false, // don't let void fog erase the sky
      blending: THREE.AdditiveBlending,
    });

  // --- Layer A: dense far dust (background only — never compete with Earth) ---
  const nFar = reduceMotion ? 1200 : tiny ? 2800 : mobile ? 5500 : 11000;
  const farPos = new Float32Array(nFar * 3);
  const farCol = new Float32Array(nFar * 3);
  for (let i = 0; i < nFar; i++) {
    const r = STAR_R * (0.94 + rng() * 0.12);
    const p = randomOnSphere(r, rng);
    farPos[i * 3] = p[0];
    farPos[i * 3 + 1] = p[1];
    farPos[i * 3 + 2] = p[2];
    // Universe-purple white (cool violet, not pure white)
    const cool = rng() < 0.6;
    farCol[i * 3] = cool ? 0.65 + rng() * 0.3 : 0.85 + rng() * 0.15;
    farCol[i * 3 + 1] = cool ? 0.55 + rng() * 0.3 : 0.78 + rng() * 0.15;
    farCol[i * 3 + 2] = cool ? 0.95 + rng() * 0.05 : 0.98;
  }
  const farGeo = new THREE.BufferGeometry();
  farGeo.setAttribute("position", new THREE.BufferAttribute(farPos, 3));
  farGeo.setAttribute("color", new THREE.BufferAttribute(farCol, 3));
  disposables.push(farGeo);
  const farStars = new THREE.Points(
    farGeo,
    starMat(tiny ? 1.35 : mobile ? 1.15 : 1.05, 0.72)
  );
  farStars.name = "stars-far";
  group.add(farStars);

  // --- Layer B: mid field (still background; a bit brighter) ---
  const nMid = reduceMotion ? 280 : tiny ? 600 : mobile ? 1200 : 2400;
  const midPos = new Float32Array(nMid * 3);
  const midCol = new Float32Array(nMid * 3);
  for (let i = 0; i < nMid; i++) {
    const r = STAR_R * (0.9 + rng() * 0.1);
    const p = randomOnSphere(r, rng);
    midPos[i * 3] = p[0];
    midPos[i * 3 + 1] = p[1];
    midPos[i * 3 + 2] = p[2];
    const warm = rng() > 0.72;
    midCol[i * 3] = warm ? 1.0 : 0.78 + rng() * 0.2;
    midCol[i * 3 + 1] = warm ? 0.88 : 0.62 + rng() * 0.25;
    midCol[i * 3 + 2] = warm ? 0.95 : 1.0;
  }
  const midGeo = new THREE.BufferGeometry();
  midGeo.setAttribute("position", new THREE.BufferAttribute(midPos, 3));
  midGeo.setAttribute("color", new THREE.BufferAttribute(midCol, 3));
  disposables.push(midGeo);
  const midStars = new THREE.Points(
    midGeo,
    starMat(tiny ? 1.9 : mobile ? 1.55 : 1.45, 0.85)
  );
  midStars.name = "stars-mid";
  group.add(midStars);

  // --- Layer C: Milky Way band (galactic-plane-ish density, purple glow) ---
  if (!reduceMotion) {
    const nBand = tiny ? 1600 : mobile ? 3200 : 5200;
    const bandPos = new Float32Array(nBand * 3);
    const bandCol = new Float32Array(nBand * 3);
    const tilt = (60 * Math.PI) / 180;
    for (let i = 0; i < nBand; i++) {
      const lon = rng() * Math.PI * 2;
      const lat = (rng() + rng() + rng() - 1.5) * 0.22;
      const cl = Math.cos(lat);
      const x = STAR_R * 0.97 * cl * Math.cos(lon);
      const y = STAR_R * 0.97 * Math.sin(lat);
      const z = STAR_R * 0.97 * cl * Math.sin(lon);
      const y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
      const z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
      bandPos[i * 3] = x;
      bandPos[i * 3 + 1] = y2;
      bandPos[i * 3 + 2] = z2;
      const glow = 0.45 + rng() * 0.55;
      bandCol[i * 3] = 0.55 + glow * 0.4;
      bandCol[i * 3 + 1] = 0.35 + glow * 0.3;
      bandCol[i * 3 + 2] = 0.85 + glow * 0.15;
    }
    const bandGeo = new THREE.BufferGeometry();
    bandGeo.setAttribute("position", new THREE.BufferAttribute(bandPos, 3));
    bandGeo.setAttribute("color", new THREE.BufferAttribute(bandCol, 3));
    disposables.push(bandGeo);
    const band = new THREE.Points(bandGeo, starMat(tiny ? 1.5 : 1.25, 0.48));
    band.name = "milky-way-band";
    group.add(band);
  }

  // --- Layer D: real bright stars (Earth-view catalog; no stick-figure lines) ---
  const nCat = BRIGHT_STARS.length;
  const catPos = new Float32Array(nCat * 3);
  const catCol = new Float32Array(nCat * 3);
  for (let i = 0; i < nCat; i++) {
    const [, ra, dec, mag, rgb] = BRIGHT_STARS[i];
    const p = raDecToXYZ(ra, dec, STAR_R * 0.99);
    catPos[i * 3] = p[0];
    catPos[i * 3 + 1] = p[1];
    catPos[i * 3 + 2] = p[2];
    const bright = Math.max(0.45, Math.min(1.35, 1.25 - mag * 0.18));
    catCol[i * 3] = Math.min(1, rgb[0] * bright);
    catCol[i * 3 + 1] = Math.min(1, rgb[1] * bright);
    catCol[i * 3 + 2] = Math.min(1, rgb[2] * bright);
  }
  const catGeo = new THREE.BufferGeometry();
  catGeo.setAttribute("position", new THREE.BufferAttribute(catPos, 3));
  catGeo.setAttribute("color", new THREE.BufferAttribute(catCol, 3));
  disposables.push(catGeo);
  const catStars = new THREE.Points(
    catGeo,
    starMat(tiny ? 2.8 : mobile ? 2.4 : 2.2, 0.95)
  );
  catStars.name = "stars-catalog";
  group.add(catStars);

  // Soft halo for the very brightest (first ~18 by catalog order / mag)
  const nHalo = Math.min(18, nCat);
  const haloPos = new Float32Array(nHalo * 3);
  const haloCol = new Float32Array(nHalo * 3);
  for (let i = 0; i < nHalo; i++) {
    haloPos[i * 3] = catPos[i * 3];
    haloPos[i * 3 + 1] = catPos[i * 3 + 1];
    haloPos[i * 3 + 2] = catPos[i * 3 + 2];
    haloCol[i * 3] = catCol[i * 3];
    haloCol[i * 3 + 1] = catCol[i * 3 + 1];
    haloCol[i * 3 + 2] = catCol[i * 3 + 2];
  }
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute("position", new THREE.BufferAttribute(haloPos, 3));
  haloGeo.setAttribute("color", new THREE.BufferAttribute(haloCol, 3));
  disposables.push(haloGeo);
  const haloStars = new THREE.Points(haloGeo, starMat(tiny ? 5.5 : 4.5, 0.28));
  haloStars.name = "stars-halo";
  group.add(haloStars);

  return { group, disposables, farStars, midStars, catStars };
}

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
  // Universe purple void (not pure black) — brand night sky
  scene.background = new THREE.Color(VOID_PURPLE);
  // Light fog only near camera — stars use fog:false so sky stays readable
  scene.fog = new THREE.FogExp2(VOID_FOG, tiny ? 0.004 : 0.0012);

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
  renderer.setClearColor(VOID_PURPLE, 1);
  if (renderer.outputEncoding !== undefined) {
    renderer.outputEncoding = THREE.sRGBEncoding;
  }

  // --- Sun: architecture scale (angular size first, not 1 AU linear) ---
  // Real physics: 1 AU ≈ 8.3 light-minutes, θ_sun ≈ 0.53° from Earth *and* from
  // LEO (altitude << AU). Moon θ similar. Linear 1:1 AU makes a useless speck on
  // a website; we keep the sun *optically* far (low parallax past the Moon) but
  // size the photosphere for a readable fireball disc + bloom.
  // Research: sun_angular_scale_architecture_20260810.md
  scene.add(new THREE.AmbientLight(VOID_AMBIENT, 0.38));
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
  // Soft purple fill so night side + starfield read as universe purple
  scene.add(new THREE.AmbientLight(0x2a1848, 0.14));
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

  // --- Celestial sphere: Earth-view stars + purple dust (no constellation lines) ---
  // Dense background field stays subordinate to Earth/Moon focus.
  const {
    group: stars,
    disposables: starDisposables,
  } = buildCelestialStarfield(THREE, { reduceMotion, tiny, mobile });
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
    loadTexture(loader, TEX.earth, TEX.alt.earth),
    loadTexture(loader, TEX.earthNormal, TEX.alt.earthNormal),
    loadTexture(loader, TEX.earthSpec, TEX.alt.earthSpec),
    loadTexture(loader, TEX.moon, TEX.alt.moon),
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
    // Sidereal drift — very slow so sky feels infinite, not a busy prop
    stars.rotation.y += dt * 0.0012;
    stars.rotation.x += dt * 0.00015;

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
      for (const d of starDisposables) {
        try {
          d.dispose();
        } catch {
          /* ignore */
        }
      }
      stars.traverse((obj) => {
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
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
  // Shared lite / phone / no-WebGL / save-data probe (browser-capability.js).
  // Dynamic import avoided here to keep sync API; inline mirror of shouldUseLiteMode.
  try {
    const bg = new URLSearchParams(location.search).get("bg");
    if (bg === "three" || bg === "earth") return false;
    if (bg === "ambient" || bg === "lite") return true;
    if (
      new URLSearchParams(location.search).get("lite") === "1" ||
      new URLSearchParams(location.search).get("lite") === "true"
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }
  const w =
    window.visualViewport?.width ||
    window.innerWidth ||
    document.documentElement.clientWidth ||
    0;
  if (w > 0 && w <= 420) return true;
  try {
    if (navigator.connection?.saveData) return true;
    const et = navigator.connection?.effectiveType;
    if (et === "slow-2g" || et === "2g") return true;
  } catch {
    /* ignore */
  }
  try {
    if (
      matchMedia("(pointer: coarse)").matches &&
      w > 0 &&
      w <= 768
    ) {
      return true;
    }
  } catch {
    /* ignore */
  }
  try {
    const c = document.createElement("canvas");
    const gl =
      c.getContext("webgl") ||
      c.getContext("experimental-webgl") ||
      c.getContext("webgl2");
    if (!gl) return true;
  } catch {
    return true;
  }
  // body class set by browser-capability (resize / boot)
  if (document.body?.classList?.contains("asx-lite")) return true;
  return false;
}
