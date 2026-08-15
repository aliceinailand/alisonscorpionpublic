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
 * Space Invaders — first-party canvas (no Taito assets).
 * ← → move · Space / click / tap-center fire.
 */
export function mountInvaders(stage, onStatus) {
  const W = 480;
  const H = 340;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  canvas.className = "asx-game-canvas";
  canvas.setAttribute("tabindex", "0");
  stage.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  let keys = {};
  let live = true;
  let raf = 0;
  let px = 220;
  let cool = 0;
  let bullets = [];
  let bombs = [];
  let score = 0;
  let wave = 1;
  let dir = 1;
  let stepY = 0;
  let aliens = [];
  let bunkers = [];
  let over = false;
  let tick = 0;

  const COLS = 9;
  const ROWS = 4;

  const spawnWave = () => {
    aliens = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        aliens.push({
          x: 36 + c * 44,
          y: 28 + r * 28,
          t: r,
          alive: true,
        });
      }
    }
    dir = 1;
  };

  const resetBunkers = () => {
    bunkers = [];
    for (let i = 0; i < 4; i++) {
      const bx = 50 + i * 110;
      for (let y = 0; y < 3; y++) {
        for (let x = 0; x < 5; x++) {
          if (y === 2 && x > 0 && x < 4) continue;
          bunkers.push({ x: bx + x * 8, y: 250 + y * 8, hp: 3 });
        }
      }
    }
  };

  const reset = () => {
    px = 220;
    cool = 0;
    bullets = [];
    bombs = [];
    score = 0;
    wave = 1;
    over = false;
    tick = 0;
    spawnWave();
    resetBunkers();
    onStatus?.("← →  Space to fire");
  };

  const fire = () => {
    if (over || cool > 0) return;
    bullets.push({ x: px + 12, y: H - 36 });
    cool = 16;
  };

  const onKey = (e) => {
    keys[e.key] = e.type === "keydown";
    if (["ArrowLeft", "ArrowRight", " ", "a", "d", "A", "D"].includes(e.key)) {
      e.preventDefault();
    }
    if (e.type === "keydown" && (e.key === " " || e.key === "ArrowUp")) fire();
  };
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKey);
  canvas.addEventListener("pointerdown", (e) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    if (x < W * 0.33) keys.ArrowLeft = true;
    else if (x > W * 0.67) keys.ArrowRight = true;
    else fire();
  });
  canvas.addEventListener("pointerup", () => {
    keys.ArrowLeft = keys.ArrowRight = false;
  });

  const hitBox = (ax, ay, aw, ah, bx, by, bw, bh) =>
    ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

  const frame = () => {
    if (!live) return;
    tick++;
    if (!over) {
      if (keys.ArrowLeft || keys.a || keys.A) px = Math.max(8, px - 4);
      if (keys.ArrowRight || keys.d || keys.D) px = Math.min(W - 32, px + 4);
      if (cool) cool--;

      bullets = bullets.filter((b) => {
        b.y -= 7;
        return b.y > 8;
      });
      bombs = bombs.filter((b) => {
        b.y += 3 + wave * 0.3;
        return b.y < H;
      });

      const living = aliens.filter((a) => a.alive);
      const cadence = Math.max(8, 28 - wave * 2 - Math.floor((COLS * ROWS - living.length) / 3));
      if (tick % cadence === 0 && living.length) {
        let edge = false;
        for (const a of living) {
          a.x += dir * 8;
          if (a.x < 10 || a.x > W - 28) edge = true;
        }
        if (edge) {
          dir *= -1;
          stepY++;
          for (const a of living) a.y += 12;
        }
      }
      if (living.length && Math.random() < 0.02 + wave * 0.004) {
        const shooter = living[(Math.random() * living.length) | 0];
        bombs.push({ x: shooter.x + 8, y: shooter.y + 14 });
      }

      for (const b of bullets) {
        for (const a of aliens) {
          if (!a.alive) continue;
          if (hitBox(b.x - 1, b.y - 4, 3, 8, a.x, a.y, 20, 14)) {
            a.alive = false;
            b.y = -99;
            score += (4 - a.t) * 10;
            onStatus?.(`Score ${score}  ·  wave ${wave}`);
          }
        }
      }
      for (const shot of [...bullets, ...bombs]) {
        for (const k of bunkers) {
          if (k.hp <= 0) continue;
          if (hitBox(shot.x - 1, shot.y - 2, 3, 6, k.x, k.y, 8, 8)) {
            k.hp--;
            shot.y = shot === bombs[bombs.indexOf(shot)] ? H + 9 : -99;
          }
        }
      }
      for (const b of bombs) {
        if (hitBox(b.x - 2, b.y, 4, 6, px, H - 28, 24, 12)) {
          over = true;
          onStatus?.(`Hit — score ${score}. Restart ↻`);
        }
      }
      if (living.some((a) => a.y > H - 48)) {
        over = true;
        onStatus?.(`Landed — score ${score}. Restart ↻`);
      }
      if (!living.length) {
        wave++;
        spawnWave();
        onStatus?.(`Wave ${wave}  ·  score ${score}`);
      }
    }

    ctx.fillStyle = "#070412";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1a1030";
    ctx.fillRect(0, H - 10, W, 10);

    for (const a of aliens) {
      if (!a.alive) continue;
      ctx.fillStyle = a.t === 0 ? "#f0abfc" : a.t === 1 ? "#c4b5fd" : a.t === 2 ? "#67e8f9" : "#86efac";
      ctx.fillRect(a.x, a.y + 4, 20, 8);
      ctx.fillRect(a.x + 3, a.y, 5, 4);
      ctx.fillRect(a.x + 12, a.y, 5, 4);
      ctx.fillRect(a.x + 2, a.y + 12, 4, 4);
      ctx.fillRect(a.x + 14, a.y + 12, 4, 4);
    }
    for (const k of bunkers) {
      if (k.hp <= 0) continue;
      ctx.fillStyle = `rgba(52, 211, 153, ${0.25 + k.hp * 0.22})`;
      ctx.fillRect(k.x, k.y, 7, 7);
    }
    ctx.fillStyle = "#e8e0ff";
    for (const b of bullets) ctx.fillRect(b.x, b.y, 2, 8);
    ctx.fillStyle = "#f87171";
    for (const b of bombs) ctx.fillRect(b.x, b.y, 2, 6);
    ctx.fillStyle = "#a78bfa";
    ctx.fillRect(px, H - 24, 24, 8);
    ctx.fillRect(px + 9, H - 30, 6, 8);
    ctx.fillStyle = "#e8e0ff";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(String(score), 10, 16);
    if (over) {
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(0, 120, W, 60);
      ctx.fillStyle = "#fff";
      ctx.fillText("GAME OVER", 190, 154);
    }

    raf = requestAnimationFrame(frame);
  };
  reset();
  frame();
  canvas.focus();
  return {
    reset,
    destroy: () => {
      live = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    },
  };
}

/**
 * Pac-Man style maze — first-party (original layout, no Namco assets).
 * Arrows / WASD. Eat dots, avoid ghosts; power pellets flip the hunt.
 */
export function mountPacman(stage, onStatus) {
  // 19×17 unique ASX maze — # wall  . pellet  o power  - gate  P start  G ghost
  const RAW = [
    "###################",
    "#........#........#",
    "#o##.###.#.###.##o#",
    "#.................#",
    "#.##.#.#####.#.##.#",
    "#....#...#...#....#",
    "####.###.#.###.####",
    "   #.#.......#.#   ",
    "####.#.##-##.#.####",
    "#.....# G G #.....#",
    "####.#.#####.#.####",
    "   #.#.......#.#   ",
    "####.#.#####.#.####",
    "#........#........#",
    "#.##.###.#.###.##.#",
    "#o..#....P....#..o#",
    "###################",
  ];
  const ROWS = RAW.length;
  const COLS = RAW[0].length;
  const S = 18;
  const canvas = document.createElement("canvas");
  canvas.width = COLS * S;
  canvas.height = ROWS * S;
  canvas.className = "asx-game-canvas";
  canvas.setAttribute("tabindex", "0");
  stage.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  let wall = [];
  let pellets = new Set();
  let power = new Set();
  let start = { x: 9, y: 15 };
  let dens = [];
  let px, py, pdx, pdy, ndx, ndy;
  let ghosts = [];
  let mouth = 0;
  let score = 0;
  let frightened = 0;
  let live = true;
  let over = false;
  let won = false;
  let raf = 0;
  let acc = 0;
  let last = 0;
  const key = (x, y) => x + "," + y;

  const rebuild = () => {
    wall = RAW.map((r) => r.split(""));
    pellets = new Set();
    power = new Set();
    dens = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = wall[y][x];
        if (c === ".") pellets.add(key(x, y));
        if (c === "o") power.add(key(x, y));
        if (c === "P") start = { x, y };
        if (c === "G") dens.push({ x, y });
      }
    }
  };

  const blocked = (x, y, ghost) => {
    if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return true;
    const c = wall[y][x];
    if (c === "#") return true;
    if (c === "-" && !ghost) return true;
    return false;
  };

  const resetActors = () => {
    px = start.x;
    py = start.y;
    pdx = 0;
    pdy = 0;
    ndx = 0;
    ndy = 0;
    const colors = ["#f87171", "#fb923c", "#67e8f9", "#f0abfc"];
    ghosts = dens.map((d, i) => ({
      x: d.x,
      y: d.y,
      dx: i % 2 ? 1 : -1,
      dy: 0,
      color: colors[i % colors.length],
      home: { ...d },
    }));
    frightened = 0;
  };

  const reset = () => {
    rebuild();
    resetActors();
    score = 0;
    over = false;
    won = false;
    acc = 0;
    onStatus?.("Arrows / WASD · eat the dots");
  };

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  const onKey = (e) => {
    const map = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      a: [-1, 0],
      d: [1, 0],
      w: [0, -1],
      s: [0, 1],
      A: [-1, 0],
      D: [1, 0],
      W: [0, -1],
      S: [0, 1],
    };
    if (map[e.key]) {
      e.preventDefault();
      ndx = map[e.key][0];
      ndy = map[e.key][1];
    }
  };
  window.addEventListener("keydown", onKey);

  const stepPlayer = () => {
    if (!blocked(px + ndx, py + ndy, false) && (ndx || ndy)) {
      pdx = ndx;
      pdy = ndy;
    }
    if (!blocked(px + pdx, py + pdy, false)) {
      px += pdx;
      py += pdy;
      if (px < 0) px = COLS - 1;
      if (px >= COLS) px = 0;
    }
    const k = key(px, py);
    if (pellets.delete(k)) {
      score += 10;
      onStatus?.(`Score ${score}`);
    }
    if (power.delete(k)) {
      score += 50;
      frightened = 40;
      onStatus?.(`Score ${score} · power`);
    }
    if (!pellets.size && !power.size) {
      won = true;
      onStatus?.(`Clear — ${score}. Restart ↻`);
    }
  };

  const stepGhosts = () => {
    for (const g of ghosts) {
      const options = dirs.filter(([dx, dy]) => {
        if (dx === -g.dx && dy === -g.dy && optionsWait(g)) return false;
        return !blocked(g.x + dx, g.y + dy, true);
      });
      const pick = () => {
        if (!options.length) return [ -g.dx, -g.dy ];
        if (frightened > 0) return options[(Math.random() * options.length) | 0];
        let best = options[0];
        let bestD = Infinity;
        for (const d of options) {
          const nx = g.x + d[0] - px;
          const ny = g.y + d[1] - py;
          const dist = nx * nx + ny * ny;
          if (dist < bestD) {
            bestD = dist;
            best = d;
          }
        }
        return best;
      };
      const [dx, dy] = pick();
      g.dx = dx;
      g.dy = dy;
      g.x += dx;
      g.y += dy;
      if (g.x < 0) g.x = COLS - 1;
      if (g.x >= COLS) g.x = 0;
      if (g.x === px && g.y === py) {
        if (frightened > 0) {
          score += 200;
          g.x = g.home.x;
          g.y = g.home.y;
          onStatus?.(`Score ${score}`);
        } else {
          over = true;
          onStatus?.(`Caught — ${score}. Restart ↻`);
        }
      }
    }
  };

  function optionsWait() {
    return true;
  }

  const draw = () => {
    ctx.fillStyle = "#050210";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = wall[y][x];
        if (c === "#") {
          ctx.fillStyle = "#312e81";
          ctx.fillRect(x * S + 1, y * S + 1, S - 2, S - 2);
        } else if (c === "-") {
          ctx.fillStyle = "#a78bfa";
          ctx.fillRect(x * S + 2, y * S + S / 2 - 1, S - 4, 2);
        }
        if (pellets.has(key(x, y))) {
          ctx.fillStyle = "#fde68a";
          ctx.beginPath();
          ctx.arc(x * S + S / 2, y * S + S / 2, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        if (power.has(key(x, y))) {
          ctx.fillStyle = "#fbbf24";
          ctx.beginPath();
          ctx.arc(x * S + S / 2, y * S + S / 2, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    mouth = (mouth + 0.18) % (Math.PI / 2);
    const ang = Math.atan2(pdy, pdx) || 0;
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.moveTo(px * S + S / 2, py * S + S / 2);
    ctx.arc(
      px * S + S / 2,
      py * S + S / 2,
      S / 2 - 2,
      ang + mouth,
      ang + Math.PI * 2 - mouth
    );
    ctx.closePath();
    ctx.fill();
    for (const g of ghosts) {
      ctx.fillStyle = frightened > 0 ? "#818cf8" : g.color;
      ctx.beginPath();
      ctx.arc(g.x * S + S / 2, g.y * S + S / 2 - 1, S / 2 - 2, Math.PI, 0);
      ctx.lineTo(g.x * S + S - 3, g.y * S + S - 3);
      ctx.lineTo(g.x * S + 3, g.y * S + S - 3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.fillRect(g.x * S + 5, g.y * S + 6, 3, 3);
      ctx.fillRect(g.x * S + 10, g.y * S + 6, 3, 3);
    }
    if (over || won) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(0, canvas.height / 2 - 18, canvas.width, 36);
      ctx.fillStyle = "#fff";
      ctx.font = "14px ui-monospace, monospace";
      ctx.fillText(won ? "CLEAR" : "CAUGHT", canvas.width / 2 - 28, canvas.height / 2 + 5);
    }
  };

  const loop = (t) => {
    if (!live) return;
    if (!last) last = t;
    acc += t - last;
    last = t;
    const stepMs = 130;
    while (acc > stepMs) {
      acc -= stepMs;
      if (!over && !won) {
        stepPlayer();
        if (tickGhost(acc)) stepGhosts();
        if (frightened > 0) frightened--;
      }
    }
    draw();
    raf = requestAnimationFrame(loop);
  };

  let gPhase = 0;
  function tickGhost() {
    gPhase++;
    return gPhase % 1 === 0;
  }

  reset();
  raf = requestAnimationFrame(loop);
  canvas.focus();
  return {
    reset,
    destroy: () => {
      live = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
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
