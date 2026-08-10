/**
 * Alison glass gate — only the “draw a circle on glass” beat (Zero-inspired).
 * NOT their full WebGL product — no Zero assets, no second experience after this.
 *
 * Universe-purple glass · purple satin glove (female left, long nails) follows
 * pointer · fog clears on click · complete circle → shatter → ASX boot only.
 */

const GATE_SESSION = "asx-glass-gate-ok";

export function glassGatePassed() {
  try {
    return sessionStorage.getItem(GATE_SESSION) === "1";
  } catch {
    return false;
  }
}

function markPassed() {
  try {
    sessionStorage.setItem(GATE_SESSION, "1");
  } catch {
    /* ignore */
  }
}

/**
 * @returns {Promise<void>}
 */
export function runGlassGate() {
  if (glassGatePassed()) return Promise.resolve();

  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.id = "asx-glass-gate";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-label", "Draw a circle to enter Alison Scorpion Desktop");
    root.innerHTML = `
      <div class="gg-bg" aria-hidden="true"></div>
      <div class="gg-fog" aria-hidden="true"></div>
      <canvas class="gg-draw" aria-hidden="true"></canvas>
      <div class="gg-hint">
        <p class="gg-title">DRAW A CIRCLE</p>
        <p class="gg-sub">Alison’s glove on the glass · follow the finger · hold and draw a circle</p>
      </div>
      <div class="gg-hand" aria-hidden="true">
        ${alisonPurpleGloveSvg()}
      </div>
      <div class="gg-shatter" aria-hidden="true"></div>
      <button type="button" class="gg-skip">Skip (accessibility)</button>
    `;
    document.body.appendChild(root);
    document.body.classList.add("asx-gate-active");

    const fog = root.querySelector(".gg-fog");
    const hand = root.querySelector(".gg-hand");
    const canvas = root.querySelector(".gg-draw");
    const ctx = canvas.getContext("2d");
    const hint = root.querySelector(".gg-hint");
    const shatter = root.querySelector(".gg-shatter");

    let w = 0;
    let h = 0;
    let drawing = false;
    let points = [];
    let fogLevel = 0.72; // 0 clear … 1 dense
    let finished = false;

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      redraw();
    };

    const setFog = (v) => {
      fogLevel = Math.max(0.12, Math.min(0.85, v));
      fog.style.opacity = String(fogLevel);
    };
    setFog(fogLevel);

    const moveHand = (clientX, clientY) => {
      // Index fingertip is at top-center of the SVG viewBox — pin tip to cursor
      const hx = clientX;
      const hy = clientY;
      hand.style.transform = `translate3d(${hx}px, ${hy}px, 0)`;
    };

    const redraw = () => {
      ctx.clearRect(0, 0, w, h);
      if (points.length < 2) return;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(245, 237, 216, 0.92)";
      ctx.shadowColor = "rgba(167, 139, 250, 0.85)";
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
      // soft trail
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(196, 181, 253, 0.35)";
      ctx.lineWidth = 8;
      ctx.stroke();
    };

    /**
     * Circle completeness: angular coverage of stroke relative to path centroid,
     * plus closure (end near start) and enough path length.
     */
    const circleScore = () => {
      if (points.length < 24) return 0;
      let cx = 0;
      let cy = 0;
      for (const p of points) {
        cx += p.x;
        cy += p.y;
      }
      cx /= points.length;
      cy /= points.length;

      let pathLen = 0;
      for (let i = 1; i < points.length; i++) {
        pathLen += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
      }
      const rAvg =
        points.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / points.length;
      if (rAvg < 28 || pathLen < rAvg * 3.5) return 0;

      const bins = new Array(16).fill(0);
      for (const p of points) {
        let a = Math.atan2(p.y - cy, p.x - cx);
        if (a < 0) a += Math.PI * 2;
        const b = Math.min(15, Math.floor((a / (Math.PI * 2)) * 16));
        bins[b] = 1;
      }
      const coverage = bins.reduce((s, v) => s + v, 0) / 16;
      const first = points[0];
      const last = points[points.length - 1];
      const close = Math.hypot(last.x - first.x, last.y - first.y);
      const closed = close < Math.max(36, rAvg * 0.55) ? 1 : close < rAvg ? 0.55 : 0.15;
      return coverage * 0.72 + closed * 0.28;
    };

    const complete = () => {
      if (finished) return;
      finished = true;
      markPassed();
      hint.classList.add("gg-done");
      hint.querySelector(".gg-title").textContent = "WELCOME";
      hint.querySelector(".gg-sub").textContent = "Glass opens · entering Alison's desktop…";
      hand.classList.add("gg-hand-out");
      // Shatter / explosion
      shatter.innerHTML = "";
      for (let i = 0; i < 28; i++) {
        const shard = document.createElement("div");
        shard.className = "gg-shard";
        const ang = (i / 28) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 40 + Math.random() * 70;
        shard.style.setProperty("--dx", Math.cos(ang) * dist + "vw");
        shard.style.setProperty("--dy", Math.sin(ang) * dist + "vh");
        shard.style.setProperty("--rot", (Math.random() * 720 - 360) + "deg");
        shard.style.left = 40 + Math.random() * 20 + "%";
        shard.style.top = 35 + Math.random() * 25 + "%";
        shatter.appendChild(shard);
      }
      root.classList.add("gg-explode");
      setTimeout(() => {
        root.remove();
        document.body.classList.remove("asx-gate-active");
        resolve();
      }, 1100);
    };

    const onDown = (e) => {
      if (finished) return;
      drawing = true;
      points = [{ x: e.clientX, y: e.clientY }];
      // Click wipes fog (Zero-like)
      setFog(fogLevel - 0.14);
      moveHand(e.clientX, e.clientY);
      redraw();
    };
    const onMove = (e) => {
      if (finished) return;
      moveHand(e.clientX, e.clientY);
      if (!drawing) return;
      const last = points[points.length - 1];
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      if (dx * dx + dy * dy < 9) return;
      points.push({ x: e.clientX, y: e.clientY });
      // gentle fog clear while drawing
      if (points.length % 8 === 0) setFog(fogLevel - 0.02);
      redraw();
      if (circleScore() >= 0.82) {
        drawing = false;
        complete();
      }
    };
    const onUp = () => {
      if (finished) return;
      drawing = false;
      if (circleScore() >= 0.78) complete();
      else if (points.length > 10 && circleScore() < 0.5) {
        // soft reset trail if failed ring
        points = [];
        redraw();
      }
    };

    root.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("resize", resize);
    root.querySelector(".gg-skip")?.addEventListener("click", () => {
      if (finished) return;
      finished = true;
      markPassed();
      root.remove();
      document.body.classList.remove("asx-gate-active");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", resize);
      resolve();
    });

    resize();
    // start hand near center
    moveHand(w * 0.5, h * 0.55);
  });
}

/**
 * Universe-purple satin glove — female left hand, index pointing.
 * Fingertip of index is at (100, 8) in viewBox so CSS can pin tip to cursor.
 * Intentional ASX brand piece (not Zero’s hand mesh).
 */
function alisonPurpleGloveSvg() {
  return `
<svg class="gg-hand-svg" viewBox="0 0 200 320" width="200" height="320" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="ggGlove" x1="12%" y1="0%" x2="88%" y2="100%">
      <stop offset="0%" stop-color="#ddd6fe"/>
      <stop offset="28%" stop-color="#a78bfa"/>
      <stop offset="62%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#4c1d95"/>
    </linearGradient>
    <linearGradient id="ggGloveHi" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0"/>
      <stop offset="40%" stop-color="#f5f3ff" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="ggGloveSh" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#2e1065" stop-opacity="0"/>
      <stop offset="100%" stop-color="#1e1b4b" stop-opacity="0.55"/>
    </linearGradient>
    <linearGradient id="ggNailLong" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fce7f3"/>
      <stop offset="55%" stop-color="#f9a8d4"/>
      <stop offset="100%" stop-color="#db2777"/>
    </linearGradient>
    <linearGradient id="ggNailSoft" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fdf2f8"/>
      <stop offset="100%" stop-color="#f0abfc"/>
    </linearGradient>
    <filter id="ggDrop" x="-25%" y="-15%" width="150%" height="140%">
      <feDropShadow dx="2" dy="6" stdDeviation="4.5" flood-color="#0a0612" flood-opacity="0.55"/>
    </filter>
    <filter id="ggSatin">
      <feGaussianBlur in="SourceAlpha" stdDeviation="0.6" result="b"/>
      <feSpecularLighting in="b" surfaceScale="2" specularConstant="0.9" specularExponent="28" lighting-color="#ede9fe" result="spec">
        <fePointLight x="-40" y="-80" z="90"/>
      </feSpecularLighting>
      <feComposite in="spec" in2="SourceAlpha" operator="in" result="spec2"/>
      <feComposite in="SourceGraphic" in2="spec2" operator="arithmetic" k1="0" k2="1" k3="0.55" k4="0"/>
    </filter>
  </defs>
  <!-- transform: tip of index at ~(100,8); hand hangs below cursor -->
  <g filter="url(#ggDrop)" transform="translate(0,0)">
    <g filter="url(#ggSatin)" transform="rotate(-6 100 160)">
      <!-- forearm cuff -->
      <path fill="url(#ggGlove)" d="
        M78 300
        C70 278 68 250 74 228
        L126 228
        C132 250 130 278 122 300
        Z"/>
      <path fill="url(#ggGloveSh)" d="M78 300 C74 275 76 248 80 232 L120 232 C122 255 120 280 118 300 Z" opacity="0.5"/>
      <!-- palm (back of left glove) -->
      <path fill="url(#ggGlove)" d="
        M70 220
        C58 200 54 170 60 140
        C64 118 72 102 86 92
        L118 88
        C132 90 148 100 156 122
        C164 148 160 180 152 208
        C146 224 130 232 112 234
        C94 236 78 230 70 220
        Z"/>
      <!-- satin highlight on palm -->
      <path fill="url(#ggGloveHi)" opacity="0.55" d="
        M88 210 C82 180 86 140 96 115
        C108 120 120 140 124 175
        C120 200 108 218 96 220 Z"/>
      <!-- thumb (left side of left hand when pointing up) -->
      <path fill="url(#ggGlove)" d="
        M62 155
        C42 148 28 128 34 108
        C40 90 58 88 70 100
        C82 114 84 138 80 158
        C76 168 68 162 62 155
        Z"/>
      <ellipse cx="48" cy="102" rx="6" ry="8.5" fill="url(#ggNailSoft)" transform="rotate(-25 48 102)"/>
      <!-- pinky -->
      <path fill="url(#ggGlove)" d="
        M78 100
        C70 78 68 52 74 36
        C78 26 88 24 92 34
        C96 50 94 78 92 102
        Z"/>
      <ellipse cx="82" cy="30" rx="5" ry="7.5" fill="url(#ggNailSoft)" transform="rotate(-8 82 30)"/>
      <!-- ring -->
      <path fill="url(#ggGlove)" d="
        M96 92
        C90 62 92 32 100 16
        C106 6 116 8 118 20
        C120 44 114 74 112 100
        Z"/>
      <ellipse cx="108" cy="12" rx="5.5" ry="8.5" fill="url(#ggNailSoft)"/>
      <!-- middle -->
      <path fill="url(#ggGlove)" d="
        M114 90
        C110 55 112 22 120 6
        C126 -4 138 -2 140 12
        C142 40 132 72 128 100
        Z"/>
      <ellipse cx="128" cy="2" rx="5.5" ry="9" fill="url(#ggNailSoft)"/>
      <!-- index (pointing — longer nail, tip = cursor) -->
      <path fill="url(#ggGlove)" d="
        M134 98
        C138 58 142 24 148 8
        C152 -4 162 -8 168 2
        C174 18 170 55 164 100
        C160 112 140 112 134 98
        Z"/>
      <!-- longer glam nail on index -->
      <path fill="url(#ggNailLong)" d="
        M152 10
        C154 -2 160 -12 166 -14
        C172 -12 176 -2 174 10
        C172 18 168 22 160 20
        C154 18 152 14 152 10
        Z"/>
      <path fill="#fff" opacity="0.35" d="M158 -6 C160 -10 164 -10 166 -6 C164 -4 160 -4 158 -6 Z"/>
      <!-- seam lines (glove) -->
      <path stroke="#5b21b6" stroke-width="1.1" stroke-opacity="0.45" fill="none"
        d="M88 210 C92 175 98 140 104 118"/>
      <path stroke="#5b21b6" stroke-width="1" stroke-opacity="0.35" fill="none"
        d="M108 212 C112 175 116 140 120 112"/>
      <path stroke="#5b21b6" stroke-width="1" stroke-opacity="0.35" fill="none"
        d="M126 210 C130 172 136 140 142 112"/>
      <!-- cuff rim -->
      <ellipse cx="100" cy="228" rx="32" ry="7" fill="none" stroke="#c4b5fd" stroke-width="2.2" opacity="0.75"/>
      <ellipse cx="100" cy="228" rx="28" ry="5" fill="#2e1065" opacity="0.35"/>
    </g>
  </g>
</svg>`;
}
