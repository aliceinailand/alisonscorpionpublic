/**
 * Alison glass gate — Zero-inspired “draw a circle” captcha.
 * Purple universe glass · female left hand tracks pointer · fog clears on click ·
 * complete circle → shatter → desktop boot.
 *
 * Inspired by https://why.zero.university/ (draw-a-zero interaction), ASX themed.
 * Not a copy of their 3D stack — DOM/SVG for weight + reliability.
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
        <p class="gg-sub">Alison is on the other side of the glass · move the hand · hold and draw</p>
      </div>
      <div class="gg-hand" aria-hidden="true">
        ${femaleLeftHandSvg()}
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
      // Left hand: fingertip near cursor; hand sits bottom-left of tip
      const hx = clientX - 28;
      const hy = clientY + 8;
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

/** Stylized realistic female left hand (palm toward viewer-ish, index extended). */
function femaleLeftHandSvg() {
  return `
<svg class="gg-hand-svg" viewBox="0 0 200 280" width="200" height="280" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="ggSkin" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f3d4b8"/>
      <stop offset="45%" stop-color="#e8b896"/>
      <stop offset="100%" stop-color="#c98b6a"/>
    </linearGradient>
    <linearGradient id="ggSkinSh" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f7e0c8" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#a86b4a" stop-opacity="0.35"/>
    </linearGradient>
    <linearGradient id="ggNail" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#f5d0d8"/>
      <stop offset="100%" stop-color="#d4a0a8"/>
    </linearGradient>
    <filter id="ggSoft" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="b"/>
      <feOffset dy="2" dx="1"/>
      <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g filter="url(#ggSoft)" transform="rotate(-8 100 140)">
    <!-- wrist / palm (left hand, fingers up toward cursor) -->
    <ellipse cx="108" cy="210" rx="38" ry="48" fill="url(#ggSkin)"/>
    <path fill="url(#ggSkin)" d="M72 175 C58 140 62 95 78 70 C88 52 102 48 112 58 C118 48 132 46 142 58 C152 48 168 52 172 72 C178 100 168 145 158 175 Z"/>
    <!-- pinky -->
    <path fill="url(#ggSkin)" d="M78 95 C72 70 74 48 82 36 C88 28 96 30 98 40 C100 58 96 82 92 100 Z"/>
    <!-- ring -->
    <path fill="url(#ggSkin)" d="M96 78 C92 48 96 22 106 12 C114 4 122 10 122 22 C122 48 114 78 110 98 Z"/>
    <!-- middle -->
    <path fill="url(#ggSkin)" d="M116 72 C114 40 118 10 128 2 C136 -4 144 4 144 18 C144 48 134 78 128 100 Z"/>
    <!-- index (pointing — longer nail) -->
    <path fill="url(#ggSkin)" d="M138 80 C142 42 148 8 152 -6 C156 -16 166 -14 168 -2 C172 24 164 70 158 102 Z"/>
    <ellipse cx="162" cy="-4" rx="7.5" ry="11" fill="url(#ggNail)" transform="rotate(8 162 -4)"/>
    <!-- thumb (left side of left hand from viewer when pointing up) -->
    <path fill="url(#ggSkin)" d="M70 150 C48 138 38 118 48 102 C56 90 72 92 80 108 C88 124 86 148 82 165 Z"/>
    <!-- soft shade -->
    <path fill="url(#ggSkinSh)" opacity="0.45" d="M95 180 C100 140 120 120 145 130 C150 160 140 200 120 220 C100 230 90 210 95 180 Z"/>
    <!-- knuckle hints -->
    <circle cx="92" cy="108" r="3" fill="#c98b6a" opacity="0.35"/>
    <circle cx="110" cy="100" r="3.2" fill="#c98b6a" opacity="0.35"/>
    <circle cx="128" cy="96" r="3.2" fill="#c98b6a" opacity="0.35"/>
    <circle cx="148" cy="102" r="3" fill="#c98b6a" opacity="0.3"/>
  </g>
</svg>`;
}
