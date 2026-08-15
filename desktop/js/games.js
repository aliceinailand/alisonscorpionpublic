/**
 * ASX Desktop — first-party Games (lightweight, no engine vendor in repo).
 * Heavier titles (Pac-Man CDN, Doom/Freedoom WASM) stay research HOLD.
 *
 * Multi-AI Convergence: Alice (Matthew Gates), Grok, Claude, Gemini, ChatGPT, Copilot.
 */

import { escapeHtml } from "./sanitize.js?v=20260811t140000z";

function gameShell(title, hint) {
  const root = document.createElement("div");
  root.className = "asx-game";
  root.innerHTML = `
    <div class="asx-game-bar">
      <strong>${escapeHtml(title)}</strong>
      <span class="asx-game-hint">${escapeHtml(hint || "")}</span>
      <button type="button" class="asx-game-reset" title="Restart">↻</button>
    </div>
    <div class="asx-game-stage"></div>`;
  return root;
}

/** Tic Tac Toe — pure DOM. */
export function mountTicTacToe(stage, onStatus) {
  let board = Array(9).fill("");
  let turn = "X";
  let over = false;
  const wins = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  const grid = document.createElement("div");
  grid.className = "ttt-grid";
  stage.appendChild(grid);

  const status = (msg) => onStatus?.(msg);

  const winner = () => {
    for (const [a, b, c] of wins) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    if (board.every(Boolean)) return "draw";
    return null;
  };

  const paint = () => {
    grid.innerHTML = board
      .map(
        (c, i) =>
          `<button type="button" class="ttt-cell" data-i="${i}" ${
            c || over ? "disabled" : ""
          }>${escapeHtml(c || "")}</button>`
      )
      .join("");
    grid.querySelectorAll(".ttt-cell").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = +btn.dataset.i;
        if (over || board[i]) return;
        board[i] = turn;
        const w = winner();
        if (w === "draw") {
          over = true;
          status("Draw — restart?");
        } else if (w) {
          over = true;
          status(`${w} wins`);
        } else {
          turn = turn === "X" ? "O" : "X";
          status(`${turn}'s turn`);
        }
        paint();
      });
    });
  };

  const reset = () => {
    board = Array(9).fill("");
    turn = "X";
    over = false;
    status("X's turn");
    paint();
  };
  reset();
  return { reset };
}

/** Ping Pong — canvas 2P / vs simple AI. */
export function mountPong(stage, onStatus) {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 280;
  canvas.className = "asx-game-canvas";
  canvas.setAttribute("tabindex", "0");
  stage.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  let scoreL = 0;
  let scoreR = 0;
  let py = 110;
  let ay = 110;
  let bx = 240;
  let by = 140;
  let bvx = 3.2;
  let bvy = 2.1;
  let keys = {};
  let raf = 0;
  let live = true;

  const onKey = (e) => {
    keys[e.key] = e.type === "keydown";
    if (["ArrowUp", "ArrowDown", "w", "s", "W", "S"].includes(e.key)) e.preventDefault();
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);

  const resetBall = (dir) => {
    bx = 240;
    by = 140;
    bvx = 3.2 * dir;
    bvy = (Math.random() * 2 - 1) * 2.5;
  };

  const frame = () => {
    if (!live) return;
    if (keys.ArrowUp || keys.w || keys.W) py = Math.max(0, py - 5);
    if (keys.ArrowDown || keys.s || keys.S) py = Math.min(220, py + 5);
    // simple AI
    const target = by - 30;
    ay += Math.sign(target - ay) * Math.min(4, Math.abs(target - ay));
    ay = Math.max(0, Math.min(220, ay));

    bx += bvx;
    by += bvy;
    if (by < 4 || by > 276) bvy *= -1;
    if (bx < 18 && by > py && by < py + 60) {
      bvx = Math.abs(bvx) * 1.05;
      bvy += (by - (py + 30)) * 0.08;
    }
    if (bx > 462 && by > ay && by < ay + 60) {
      bvx = -Math.abs(bvx) * 1.05;
      bvy += (by - (ay + 30)) * 0.08;
    }
    if (bx < 0) {
      scoreR++;
      resetBall(1);
      onStatus?.(`You ${scoreL} — ASX ${scoreR}`);
    }
    if (bx > 480) {
      scoreL++;
      resetBall(-1);
      onStatus?.(`You ${scoreL} — ASX ${scoreR}`);
    }

    ctx.fillStyle = "#0a0618";
    ctx.fillRect(0, 0, 480, 280);
    ctx.strokeStyle = "rgba(180,140,255,0.35)";
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(240, 0);
    ctx.lineTo(240, 280);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#c4a1ff";
    ctx.fillRect(8, py, 8, 60);
    ctx.fillRect(464, ay, 8, 60);
    ctx.beginPath();
    ctx.arc(bx, by, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e8e0ff";
    ctx.font = "14px monospace";
    ctx.fillText(String(scoreL), 200, 24);
    ctx.fillText(String(scoreR), 268, 24);

    raf = requestAnimationFrame(frame);
  };
  frame();
  canvas.focus();

  return {
    reset: () => {
      scoreL = 0;
      scoreR = 0;
      py = 110;
      ay = 110;
      resetBall(1);
      onStatus?.("W/S or ↑/↓ — first to… forever");
    },
    destroy: () => {
      live = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    },
  };
}

/** Blocks — tetris-like (original label; not trademarked "Tetris"). */
export function mountBlocks(stage, onStatus) {
  const COLS = 10;
  const ROWS = 18;
  const SIZE = 16;
  const canvas = document.createElement("canvas");
  canvas.width = COLS * SIZE;
  canvas.height = ROWS * SIZE;
  canvas.className = "asx-game-canvas";
  canvas.setAttribute("tabindex", "0");
  stage.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  const SHAPES = {
    I: [[1, 1, 1, 1]],
    O: [
      [1, 1],
      [1, 1],
    ],
    T: [
      [0, 1, 0],
      [1, 1, 1],
    ],
    L: [
      [1, 0],
      [1, 0],
      [1, 1],
    ],
    J: [
      [0, 1],
      [0, 1],
      [1, 1],
    ],
    S: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    Z: [
      [1, 1, 0],
      [0, 1, 1],
    ],
  };
  const NAMES = Object.keys(SHAPES);
  let grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  let piece = null;
  let score = 0;
  let tick = 0;
  let raf = 0;
  let live = true;
  let dropMs = 500;
  let last = 0;

  const spawn = () => {
    const name = NAMES[Math.floor(Math.random() * NAMES.length)];
    const shape = SHAPES[name].map((r) => r.slice());
    piece = { shape, x: 3, y: 0, name };
    if (collides(piece)) {
      live = false;
      onStatus?.(`Game over — score ${score}`);
    }
  };

  const collides = (p) => {
    for (let y = 0; y < p.shape.length; y++) {
      for (let x = 0; x < p.shape[y].length; x++) {
        if (!p.shape[y][x]) continue;
        const gx = p.x + x;
        const gy = p.y + y;
        if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
        if (gy >= 0 && grid[gy][gx]) return true;
      }
    }
    return false;
  };

  const merge = () => {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (!piece.shape[y][x]) continue;
        const gy = piece.y + y;
        const gx = piece.x + x;
        if (gy >= 0) grid[gy][gx] = 1;
      }
    }
    let cleared = 0;
    grid = grid.filter((row) => {
      if (row.every(Boolean)) {
        cleared++;
        return false;
      }
      return true;
    });
    while (grid.length < ROWS) grid.unshift(Array(COLS).fill(0));
    if (cleared) {
      score += cleared * 100;
      onStatus?.(`Score ${score}`);
    }
    spawn();
  };

  const rotate = () => {
    const s = piece.shape;
    const next = s[0].map((_, i) => s.map((row) => row[i]).reverse());
    const trial = { ...piece, shape: next };
    if (!collides(trial)) piece = trial;
  };

  const onKey = (e) => {
    if (!live || !piece) return;
    if (e.key === "ArrowLeft") {
      piece.x--;
      if (collides(piece)) piece.x++;
    } else if (e.key === "ArrowRight") {
      piece.x++;
      if (collides(piece)) piece.x--;
    } else if (e.key === "ArrowDown") {
      piece.y++;
      if (collides(piece)) {
        piece.y--;
        merge();
      }
    } else if (e.key === "ArrowUp" || e.key === " ") {
      rotate();
      e.preventDefault();
    }
  };
  window.addEventListener("keydown", onKey);

  const draw = () => {
    ctx.fillStyle = "#0a0618";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const cell = (x, y, on) => {
      ctx.fillStyle = on ? "#9b6dff" : "rgba(255,255,255,0.04)";
      ctx.fillRect(x * SIZE + 1, y * SIZE + 1, SIZE - 2, SIZE - 2);
    };
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) cell(x, y, grid[y][x]);
    if (piece) {
      for (let y = 0; y < piece.shape.length; y++) {
        for (let x = 0; x < piece.shape[y].length; x++) {
          if (piece.shape[y][x]) cell(piece.x + x, piece.y + y, true);
        }
      }
    }
  };

  const loop = (t) => {
    if (!live) {
      draw();
      return;
    }
    if (!last) last = t;
    if (t - last > dropMs) {
      last = t;
      piece.y++;
      if (collides(piece)) {
        piece.y--;
        merge();
      }
    }
    draw();
    raf = requestAnimationFrame(loop);
  };

  spawn();
  onStatus?.("← → move · ↑/Space rotate · ↓ soft drop");
  raf = requestAnimationFrame(loop);
  canvas.focus();

  return {
    reset: () => {
      grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
      score = 0;
      live = true;
      last = 0;
      spawn();
      onStatus?.(`Score 0`);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    },
    destroy: () => {
      live = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    },
  };
}



/** Snake — first-party canvas. */
export function mountSnake(stage, onStatus) {
  const SIZE = 16;
  const COLS = 24;
  const ROWS = 18;
  const canvas = document.createElement("canvas");
  canvas.width = COLS * SIZE;
  canvas.height = ROWS * SIZE;
  canvas.className = "asx-game-canvas";
  canvas.setAttribute("tabindex", "0");
  stage.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  let snake, dir, nextDir, food, score, live, raf, last;
  const reset = () => {
    snake = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }];
    dir = { x: 1, y: 0 };
    nextDir = { ...dir };
    food = { x: 16, y: 9 };
    score = 0;
    live = true;
    last = 0;
    onStatus?.("Arrows · score 0");
  };
  const placeFood = () => {
    for (let i = 0; i < 200; i++) {
      const f = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
      if (!snake.some((s) => s.x === f.x && s.y === f.y)) {
        food = f;
        return;
      }
    }
  };
  const onKey = (e) => {
    const k = e.key;
    if (k === "ArrowUp" && dir.y !== 1) nextDir = { x: 0, y: -1 };
    else if (k === "ArrowDown" && dir.y !== -1) nextDir = { x: 0, y: 1 };
    else if (k === "ArrowLeft" && dir.x !== 1) nextDir = { x: -1, y: 0 };
    else if (k === "ArrowRight" && dir.x !== -1) nextDir = { x: 1, y: 0 };
    if (k.startsWith("Arrow")) e.preventDefault();
  };
  window.addEventListener("keydown", onKey);
  const tick = (t) => {
    if (!live) return;
    if (!last) last = t;
    if (t - last > 110) {
      last = t;
      dir = nextDir;
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS || snake.some((s) => s.x === head.x && s.y === head.y)) {
        live = false;
        onStatus?.(`Game over · ${score}`);
      } else {
        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) {
          score += 10;
          onStatus?.(`Score ${score}`);
          placeFood();
        } else snake.pop();
      }
    }
    ctx.fillStyle = "#0a0618";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f0a0ff";
    ctx.fillRect(food.x * SIZE + 1, food.y * SIZE + 1, SIZE - 2, SIZE - 2);
    ctx.fillStyle = "#9b6dff";
    snake.forEach((s, i) => {
      ctx.globalAlpha = i === 0 ? 1 : 0.85;
      ctx.fillRect(s.x * SIZE + 1, s.y * SIZE + 1, SIZE - 2, SIZE - 2);
    });
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  };
  reset();
  placeFood();
  raf = requestAnimationFrame(tick);
  canvas.focus();
  return {
    reset: () => {
      cancelAnimationFrame(raf);
      reset();
      placeFood();
      live = true;
      raf = requestAnimationFrame(tick);
    },
    destroy: () => {
      live = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
    },
  };
}

/** Breakout — first-party. */
export function mountBreakout(stage, onStatus) {
  const W = 420;
  const H = 300;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  canvas.className = "asx-game-canvas";
  canvas.setAttribute("tabindex", "0");
  stage.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  let px, ball, bricks, live, score, keys, raf;
  const reset = () => {
    px = 180;
    ball = { x: 210, y: 200, vx: 2.6, vy: -2.8 };
    bricks = [];
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 8; c++)
        bricks.push({ x: 20 + c * 48, y: 30 + r * 18, w: 44, h: 14, alive: true });
    live = true;
    score = 0;
    keys = {};
    onStatus?.("← → · clear the bricks");
  };
  const onKey = (e) => {
    keys[e.key] = e.type === "keydown";
    if (e.key.startsWith("Arrow")) e.preventDefault();
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  const frame = () => {
    if (!live) return;
    if (keys.ArrowLeft) px = Math.max(0, px - 6);
    if (keys.ArrowRight) px = Math.min(W - 70, px + 6);
    ball.x += ball.vx;
    ball.y += ball.vy;
    if (ball.x < 6 || ball.x > W - 6) ball.vx *= -1;
    if (ball.y < 6) ball.vy *= -1;
    if (ball.y > H) {
      live = false;
      onStatus?.(`Miss · score ${score}`);
    }
    if (ball.y > H - 28 && ball.x > px && ball.x < px + 70) {
      ball.vy = -Math.abs(ball.vy);
      ball.vx += (ball.x - (px + 35)) * 0.08;
    }
    bricks.forEach((b) => {
      if (!b.alive) return;
      if (ball.x > b.x && ball.x < b.x + b.w && ball.y > b.y && ball.y < b.y + b.h) {
        b.alive = false;
        ball.vy *= -1;
        score += 5;
        onStatus?.(`Score ${score}`);
      }
    });
    if (bricks.every((b) => !b.alive)) {
      live = false;
      onStatus?.(`Clear! ${score}`);
    }
    ctx.fillStyle = "#0a0618";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#c4a1ff";
    ctx.fillRect(px, H - 16, 70, 10);
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 6, 0, Math.PI * 2);
    ctx.fill();
    bricks.forEach((b) => {
      if (!b.alive) return;
      ctx.fillStyle = "#7c5cff";
      ctx.fillRect(b.x, b.y, b.w, b.h);
    });
    raf = requestAnimationFrame(frame);
  };
  reset();
  raf = requestAnimationFrame(frame);
  canvas.focus();
  return {
    reset: () => {
      cancelAnimationFrame(raf);
      reset();
      live = true;
      raf = requestAnimationFrame(frame);
    },
    destroy: () => {
      live = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    },
  };
}

/** Memory match — DOM. */
export function mountMemory(stage, onStatus) {
  const glyphs = ["🦂", "🐝", "🌍", "⭐", "◆", "☾", "⚡", "◆"];
  // unique 6 pairs
  const pool = ["🦂", "🐝", "🌍", "⭐", "☾", "⚡"];
  let cards = [];
  let flip = [];
  let lock = false;
  let matched = 0;
  const grid = document.createElement("div");
  grid.className = "mem-grid";
  stage.appendChild(grid);
  const reset = () => {
    cards = [...pool, ...pool].sort(() => Math.random() - 0.5).map((g, i) => ({ g, i, open: false, done: false }));
    flip = [];
    lock = false;
    matched = 0;
    onStatus?.("Find pairs");
    paint();
  };
  const paint = () => {
    grid.innerHTML = cards
      .map(
        (c, i) =>
          `<button type="button" class="mem-card ${c.open || c.done ? "open" : ""}" data-i="${i}">${
            c.open || c.done ? c.g : "?"
          }</button>`
      )
      .join("");
    grid.querySelectorAll(".mem-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (lock) return;
        const i = +btn.dataset.i;
        const c = cards[i];
        if (c.done || c.open) return;
        c.open = true;
        flip.push(i);
        paint();
        if (flip.length === 2) {
          lock = true;
          const [a, b] = flip;
          if (cards[a].g === cards[b].g) {
            cards[a].done = cards[b].done = true;
            matched++;
            flip = [];
            lock = false;
            onStatus?.(matched >= pool.length ? "All matched!" : `Pairs ${matched}/${pool.length}`);
            paint();
          } else {
            setTimeout(() => {
              cards[a].open = cards[b].open = false;
              flip = [];
              lock = false;
              paint();
            }, 550);
          }
        }
      });
    });
  };
  reset();
  return { reset };
}

/** Minesweeper-lite. */
export function mountMines(stage, onStatus) {
  const W = 9;
  const H = 9;
  const MINES = 10;
  const grid = document.createElement("div");
  grid.className = "mine-grid";
  stage.appendChild(grid);
  let cells, open, flag, dead, won;
  const idx = (x, y) => y * W + x;
  const neigh = (x, y) => {
    const o = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) o.push(idx(nx, ny));
      }
    return o;
  };
  const reset = () => {
    cells = Array(W * H).fill(0);
    open = Array(W * H).fill(false);
    flag = Array(W * H).fill(false);
    dead = false;
    won = false;
    const spots = [...Array(W * H).keys()].sort(() => Math.random() - 0.5).slice(0, MINES);
    spots.forEach((i) => {
      cells[i] = -1;
    });
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = idx(x, y);
        if (cells[i] === -1) continue;
        cells[i] = neigh(x, y).filter((j) => cells[j] === -1).length;
      }
    onStatus?.("L-click open · R-click flag");
    paint();
  };
  const flood = (i) => {
    if (open[i] || flag[i] || cells[i] === -1) return;
    open[i] = true;
    if (cells[i] === 0) {
      const x = i % W;
      const y = (i / W) | 0;
      neigh(x, y).forEach(flood);
    }
  };
  const paint = () => {
    grid.innerHTML = "";
    for (let i = 0; i < W * H; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "mine-cell" + (open[i] ? " open" : "") + (flag[i] ? " flag" : "");
      if (open[i]) {
        if (cells[i] === -1) b.textContent = "✸";
        else if (cells[i] > 0) b.textContent = String(cells[i]);
      } else if (flag[i]) b.textContent = "⚑";
      b.addEventListener("click", () => {
        if (dead || won || flag[i]) return;
        if (cells[i] === -1) {
          open[i] = true;
          dead = true;
          onStatus?.("Boom");
          paint();
          return;
        }
        flood(i);
        if (open.filter(Boolean).length === W * H - MINES) {
          won = true;
          onStatus?.("Clear!");
        }
        paint();
      });
      b.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (dead || won || open[i]) return;
        flag[i] = !flag[i];
        paint();
      });
      grid.appendChild(b);
    }
  };
  reset();
  return { reset };
}

/** Matter.js physics playground — CDN lazy. */
export async function mountPhysics(stage, onStatus, loadMatter) {
  const Matter = await loadMatter();
  if (!Matter) {
    stage.innerHTML = `<p style="color:var(--muted);padding:16px">Matter.js CDN unavailable.</p>`;
    onStatus?.("CDN fail");
    return { reset: () => {}, destroy: () => {} };
  }
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 320;
  canvas.className = "asx-game-canvas";
  stage.appendChild(canvas);
  const engine = Matter.Engine.create();
  const world = engine.world;
  const render = Matter.Render.create({
    canvas,
    engine,
    options: { width: 480, height: 320, wireframes: false, background: "#0a0618" },
  });
  const ground = Matter.Bodies.rectangle(240, 310, 460, 20, { isStatic: true, render: { fillStyle: "#4a3070" } });
  const wallL = Matter.Bodies.rectangle(10, 160, 20, 300, { isStatic: true, render: { fillStyle: "#4a3070" } });
  const wallR = Matter.Bodies.rectangle(470, 160, 20, 300, { isStatic: true, render: { fillStyle: "#4a3070" } });
  Matter.World.add(world, [ground, wallL, wallR]);
  const MAX_DYNAMIC = 64;
  const spawn = () => {
    const dynamics = world.bodies.filter((b) => !b.isStatic);
    if (dynamics.length >= MAX_DYNAMIC) {
      Matter.World.remove(world, dynamics[0]);
    }
    const b = Matter.Bodies.circle(80 + Math.random() * 320, 40, 12 + Math.random() * 14, {
      restitution: 0.6,
      render: { fillStyle: "#9b6dff" },
    });
    Matter.World.add(world, b);
  };
  for (let i = 0; i < 8; i++) spawn();
  Matter.Render.run(render);
  const runner = Matter.Runner.create();
  Matter.Runner.run(runner, engine);
  const onClick = () => spawn();
  canvas.addEventListener("click", onClick);
  onStatus?.("Click to drop · Matter.js physics");
  return {
    reset: () => {
      Matter.World.clear(world, false);
      Matter.World.add(world, [ground, wallL, wallR]);
      for (let i = 0; i < 8; i++) spawn();
    },
    destroy: () => {
      canvas.removeEventListener("click", onClick);
      Matter.Render.stop(render);
      Matter.Runner.stop(runner);
      Matter.World.clear(world, false);
      Matter.Engine.clear(engine);
    },
  };
}


/**
 * Open a game window via WindowManager.
 * @param {object} wm
 * @param {{ id: string, title: string, hint: string, mount: Function, w?: number, h?: number }} spec
 */
export function openGameWindow(wm, spec) {
  const root = gameShell(spec.title, spec.hint);
  const stage = root.querySelector(".asx-game-stage");
  const hintEl = root.querySelector(".asx-game-hint");
  let ctrl = null;
  const setHint = (m) => {
    if (hintEl) hintEl.textContent = m;
  };
  const boot = () => {
    try {
      ctrl?.destroy?.();
    } catch {
      /* ignore */
    }
    stage.innerHTML = "";
    ctrl = spec.mount(stage, setHint);
  };
  root.querySelector(".asx-game-reset")?.addEventListener("click", () => {
    if (ctrl?.reset) ctrl.reset();
    else boot();
  });
  wm.open({
    id: spec.id,
    title: spec.title,
    w: spec.w || 520,
    h: spec.h || 400,
    body: root,
    onMount: () => boot(),
    onClose: () => {
      try {
        ctrl?.destroy?.();
      } catch {
        /* ignore */
      }
    },
  });
}
