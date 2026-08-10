/**
 * Alison glass gate — only the “draw a circle on glass” beat (Zero-inspired).
 * NOT their full WebGL product — no Zero assets, no second experience after this.
 *
 * Photoreal finger-on-glass PNG follows pointer (last try vs scary cartoon glove).
 * Fog clears on press · complete circle → shatter → ASX boot only.
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
        <p class="gg-sub">Finger on the glass · follow the tip · hold and draw a circle</p>
      </div>
      <div class="gg-hand" aria-hidden="true">
        <img
          class="gg-hand-img"
          src="${glassFingerSrc()}"
          alt=""
          width="220"
          height="253"
          draggable="false"
          decoding="async"
        />
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
      // Fingertip is near top-center of glass-finger.png (~48.5% x, ~1.7% y)
      hand.style.transform = `translate3d(${clientX}px, ${clientY}px, 0)`;
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
 * Photoreal finger-on-glass asset (session last-try; not Zero’s mesh).
 * Resolves relative to desktop shell paths (apex `/` and `/desktop/`).
 */
function glassFingerSrc() {
  try {
    const base = new URL(".", import.meta.url);
    // js/ → sibling assets/
    return new URL("../assets/glass-finger.png", base).href;
  } catch {
    return "assets/glass-finger.png";
  }
}
