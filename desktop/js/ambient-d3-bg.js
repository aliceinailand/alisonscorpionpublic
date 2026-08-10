/**
 * ASX Desktop — ambient universe background (small-screen / WebGL fallback)
 *
 * Path B: CSS + SVG (+ optional D3.js). No WebGL.
 * Scales via viewBox — works at ~320px CSS width where Three.js often fails.
 * D3 enhances motion when loaded; vanilla SVG works without it.
 *
 * Research: d3js.org; combine with Three only as dual-path (not both heavy GPUs).
 */

function viewBoxSize() {
  const w = Math.max(
    320,
    window.visualViewport?.width ||
      window.innerWidth ||
      document.documentElement.clientWidth ||
      360
  );
  const h = Math.max(
    480,
    window.visualViewport?.height ||
      window.innerHeight ||
      document.documentElement.clientHeight ||
      640
  );
  return { w: Math.floor(w), h: Math.floor(h) };
}

function ensureSvgHost(canvasId) {
  let host = document.getElementById("ambient-bg");
  if (host) return host;

  const canvas = document.getElementById(canvasId);
  host = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  host.id = "ambient-bg";
  host.setAttribute("aria-hidden", "true");
  host.classList.add("ambient-bg");

  if (canvas && canvas.parentNode) {
    canvas.style.display = "none";
    canvas.parentNode.insertBefore(host, canvas);
  } else {
    document.body.prepend(host);
  }
  return host;
}

function loadD3() {
  if (typeof window.d3 !== "undefined") return Promise.resolve(window.d3);
  const trySrc = (src) =>
    new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.crossOrigin = "anonymous";
      s.onload = () => resolve(window.d3 || null);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  // Public CDNs only — never load D3 from our origin
  return trySrc("https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js").then(
    (d3) => {
      if (d3) return d3;
      return trySrc(
        "https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"
      ).then((d3b) => {
        if (d3b) return d3b;
        return trySrc("https://unpkg.com/d3@7.9.0/dist/d3.min.js");
      });
    }
  );
}

/**
 * @param {string} [canvasId]
 * @returns {Promise<{ dispose: Function, mode: string }|null>}
 */
export async function initAmbientD3Bg(canvasId = "three-bg") {
  const svg = ensureSvgHost(canvasId);
  document.body.classList.add("asx-bg-ambient");
  document.body.classList.remove("asx-bg-three");

  const reduceMotion =
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  const { w, h } = viewBoxSize();
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.innerHTML = "";

  // Gradient void
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <radialGradient id="asx-void" cx="50%" cy="42%" r="65%">
      <stop offset="0%" stop-color="#2e1065"/>
      <stop offset="45%" stop-color="#1a1030"/>
      <stop offset="100%" stop-color="#0a0809"/>
    </radialGradient>
    <radialGradient id="asx-core-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#c4b5fd" stop-opacity="0.95"/>
      <stop offset="40%" stop-color="#7c3aed" stop-opacity="0.75"/>
      <stop offset="100%" stop-color="#4c1d95" stop-opacity="0"/>
    </radialGradient>
  `;
  svg.appendChild(defs);

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", "url(#asx-void)");
  svg.appendChild(bg);

  const gStars = document.createElementNS("http://www.w3.org/2000/svg", "g");
  gStars.setAttribute("class", "ambient-stars");
  svg.appendChild(gStars);

  const gOrbits = document.createElementNS("http://www.w3.org/2000/svg", "g");
  gOrbits.setAttribute("class", "ambient-orbits");
  gOrbits.setAttribute(
    "transform",
    `translate(${w / 2}, ${h * 0.42})`
  );
  svg.appendChild(gOrbits);

  const starCount = Math.min(120, Math.max(40, Math.floor((w * h) / 4000)));
  const stars = [];
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.4 + Math.random() * 1.4,
      o: 0.25 + Math.random() * 0.55,
    });
  }

  const d3 = await loadD3();
  let timer = null;
  let ro = null;

  if (d3) {
    d3.select(gStars)
      .selectAll("circle")
      .data(stars)
      .join("circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", (d) => d.r)
      .attr("fill", "#f5edd8")
      .attr("opacity", (d) => d.o);

    const rings = [Math.min(w, h) * 0.12, Math.min(w, h) * 0.2, Math.min(w, h) * 0.3];
    d3.select(gOrbits)
      .selectAll("ellipse.orbit")
      .data(rings)
      .join("ellipse")
      .attr("class", "orbit")
      .attr("cx", 0)
      .attr("cy", 0)
      .attr("rx", (d) => d)
      .attr("ry", (d) => d * 0.55)
      .attr("fill", "none")
      .attr("stroke", "#a78bfa")
      .attr("stroke-opacity", (d, i) => 0.35 - i * 0.08)
      .attr("stroke-width", 1.2);

    d3.select(gOrbits)
      .append("circle")
      .attr("class", "core")
      .attr("r", Math.min(w, h) * 0.06)
      .attr("fill", "url(#asx-core-glow)");

    if (!reduceMotion) {
      let t0 = performance.now();
      const tick = (now) => {
        const t = (now - t0) * 0.00025;
        d3.select(gOrbits).attr(
          "transform",
          `translate(${w / 2}, ${h * 0.42}) rotate(${t * 12})`
        );
        d3.select(gStars)
          .selectAll("circle")
          .attr("opacity", (d, i) => {
            const pulse = 0.5 + 0.5 * Math.sin(t * 3 + i);
            return d.o * (0.55 + 0.45 * pulse);
          });
        timer = requestAnimationFrame(tick);
      };
      timer = requestAnimationFrame(tick);
    }
  } else {
    // Vanilla SVG (no D3)
    stars.forEach((d) => {
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("cx", String(d.x));
      c.setAttribute("cy", String(d.y));
      c.setAttribute("r", String(d.r));
      c.setAttribute("fill", "#f5edd8");
      c.setAttribute("opacity", String(d.o));
      gStars.appendChild(c);
    });
    [0.12, 0.2, 0.3].forEach((f, i) => {
      const e = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      const R = Math.min(w, h) * f;
      e.setAttribute("cx", "0");
      e.setAttribute("cy", "0");
      e.setAttribute("rx", String(R));
      e.setAttribute("ry", String(R * 0.55));
      e.setAttribute("fill", "none");
      e.setAttribute("stroke", "#a78bfa");
      e.setAttribute("stroke-opacity", String(0.35 - i * 0.08));
      e.setAttribute("stroke-width", "1.2");
      gOrbits.appendChild(e);
    });
    const core = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    core.setAttribute("r", String(Math.min(w, h) * 0.06));
    core.setAttribute("fill", "url(#asx-core-glow)");
    gOrbits.appendChild(core);

    if (!reduceMotion) {
      gOrbits.style.transformOrigin = "0 0";
      gOrbits.style.animation = "asx-orbit-spin 48s linear infinite";
    }
  }

  function onResize() {
    const s = viewBoxSize();
    svg.setAttribute("viewBox", `0 0 ${s.w} ${s.h}`);
    gOrbits.setAttribute("transform", `translate(${s.w / 2}, ${s.h * 0.42})`);
  }
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onResize);
  }

  return {
    mode: d3 ? "ambient-d3" : "ambient-svg",
    dispose() {
      if (timer) cancelAnimationFrame(timer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", onResize);
      }
      if (ro) ro.disconnect();
      svg.remove();
      document.body.classList.remove("asx-bg-ambient");
      const canvas = document.getElementById(canvasId);
      if (canvas) canvas.style.display = "";
    },
  };
}
