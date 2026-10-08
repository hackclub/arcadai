/* ArcadAI · script.js
   Plain JavaScript, no libraries. Three parts:
     1. the mobile menu
     2. the "copy prompt" button
     3. Orpheus Run, the tiny game in the hero cabinet
   Read it, steal from it. The game is the kind of thing step 1 of ArcadAI produces. */

(function () {
  'use strict';

  /* ------------------------------------------------------------------
     1. Mobile menu
     ------------------------------------------------------------------ */
  const toggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  if (toggle && navLinks) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      navLinks.classList.toggle('is-open', !open);
    });
    // Close the menu after picking a link
    navLinks.addEventListener('click', (event) => {
      if (event.target.closest('a')) {
        toggle.setAttribute('aria-expanded', 'false');
        navLinks.classList.remove('is-open');
      }
    });
  }

  /* ------------------------------------------------------------------
     2. Copy buttons  (<button data-copy="id-of-the-text">)
     ------------------------------------------------------------------ */
  document.querySelectorAll('[data-copy]').forEach((button) => {
    const source = document.getElementById(button.getAttribute('data-copy'));
    if (!source) return;
    const label = button.textContent;
    let timer = null;

    const finish = (copied) => {
      if (!copied) {
        // Clipboard blocked? Select the text so it can be copied by hand.
        const range = document.createRange();
        range.selectNodeContents(source);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
      }
      button.textContent = copied ? 'Copied!' : 'Selected. Press Ctrl+C';
      button.classList.toggle('is-done', copied);
      clearTimeout(timer);
      timer = setTimeout(() => {
        button.textContent = label;
        button.classList.remove('is-done');
      }, 2000);
    };

    button.addEventListener('click', () => {
      const text = source.textContent;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => finish(true), () => finish(false));
      } else {
        finish(false);
      }
    });
  });

  /* ------------------------------------------------------------------
     3. Orpheus Run
        One button: jump. Jump over the bugs. Score goes up the longer you last.
     ------------------------------------------------------------------ */
  const canvas = document.getElementById('game');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const readout = document.getElementById('game-readout');
  const playButton = document.getElementById('game-start');

  const W = canvas.width;    // 480 game pixels wide
  const H = canvas.height;   // 270 game pixels tall
  const GROUND = 232;        // y position of the ground line
  const GRAVITY = 1500;      // pixels per second, per second
  const JUMP_SPEED = -540;   // negative is up
  const PX = 3;              // one sprite "pixel" is 3 game pixels

  const COLOR = {
    sky: '#0a0812',
    ground: '#3d3360',
    star: '#f4f1fb',
    dino: '#5bc0de',
    bug: '#ec3750',
    text: '#f4f1fb',
    muted: '#857f9c',
    accent: '#f1c40f',
  };

  // Sprites are drawn from text. '#' = body, 'o' = eye, '.' = nothing.
  const DINO_BODY = [
    '......#######',
    '......##o####',
    '......#######',
    '......####...',
    '......######.',
    '#....######..',
    '##..#######..',
    '.#########...',
    '..########...',
    '...######....',
  ];
  const DINO_FRAMES = [
    DINO_BODY.concat(['....##.##....', '....#...#....']),  // legs apart
    DINO_BODY.concat(['....##.##....', '.....#.#.....']),  // legs together
  ];
  const BUG = [
    '#.....#',
    '.#...#.',
    '.#####.',
    '##o#o##',
    '#######',
    '.#.#.#.',
  ];
  const DINO_W = 13 * PX;
  const DINO_H = 12 * PX;
  const BUG_W = 7 * PX;
  const BUG_H = 6 * PX;

  function drawSprite(rows, x, y, color) {
    const left = Math.round(x);
    const top = Math.round(y);
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const cell = rows[r][c];
        if (cell === '.') continue;
        ctx.fillStyle = cell === 'o' ? COLOR.sky : color;
        ctx.fillRect(left + c * PX, top + r * PX, PX, PX);
      }
    }
  }

  // ----- Game state -----
  let state = 'idle';        // 'idle' | 'playing' | 'over'
  let player, obstacles, speed, distance, score, nextGap, runTime;
  let best = loadBest();
  let lastFrame = 0;
  let frameId = 0;
  let paused = false;
  let overSince = 0;

  const stars = [];
  for (let i = 0; i < 40; i++) {
    stars.push({ x: Math.random() * W, y: Math.random() * (GROUND - 50), size: Math.random() < 0.3 ? 2 : 1, alpha: 0.3 + Math.random() * 0.7 });
  }

  function loadBest() {
    try { return Number(localStorage.getItem('arcadai-best')) || 0; } catch (err) { return 0; }
  }
  function saveBest(value) {
    try { localStorage.setItem('arcadai-best', String(value)); } catch (err) { /* storage blocked, no big deal */ }
  }

  function reset() {
    player = { x: 56, y: GROUND - DINO_H, vy: 0, onGround: true };
    obstacles = [];
    speed = 170;
    distance = 0;
    score = 0;
    nextGap = 380;
    runTime = 0;
  }

  function spawnObstacle() {
    const roll = Math.random();
    let kind = 'bug', w = BUG_W, h = BUG_H;
    if (roll < 0.25) { kind = 'tall'; h = BUG_H * 2; }          // two bugs stacked
    else if (roll < 0.45) { kind = 'wide'; w = BUG_W * 2 + PX; } // two bugs side by side
    obstacles.push({ x: W + 10, y: GROUND - h, w, h, kind });
  }

  function jump() {
    if (player.onGround) {
      player.vy = JUMP_SPEED;
      player.onGround = false;
    }
  }

  // Boxes overlap? With a little forgiveness so near misses feel fair.
  function hits(p, o) {
    return p.x + 7 < o.x + o.w - 2 &&
           p.x + DINO_W - 7 > o.x + 2 &&
           p.y + 4 < o.y + o.h &&
           p.y + DINO_H - 2 > o.y;
  }

  function update(dt) {
    speed = Math.min(440, speed + 7 * dt);   // gets faster the longer you last
    distance += speed * dt;
    score = Math.floor(distance / 12);
    runTime += dt;

    // Player physics
    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y >= GROUND - DINO_H) {
      player.y = GROUND - DINO_H;
      player.vy = 0;
      player.onGround = true;
    }

    // Move the bugs, drop the ones that left the screen, spawn the next one
    for (const o of obstacles) o.x -= speed * dt;
    obstacles = obstacles.filter((o) => o.x + o.w > -20);
    const last = obstacles[obstacles.length - 1];
    if (!last || last.x < W - nextGap) {
      spawnObstacle();
      nextGap = 230 + Math.random() * 220 + speed * 0.35;
    }

    // Stars drift slowly for a bit of depth
    for (const s of stars) {
      s.x -= speed * 0.08 * s.size * dt;
      if (s.x < 0) s.x += W;
    }

    for (const o of obstacles) {
      if (hits(player, o)) { gameOver(); return; }
    }
  }

  function text(str, x, y, color, size, align) {
    ctx.fillStyle = color;
    ctx.font = (size || 10) + 'px Silkscreen, "Courier New", monospace';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(str, x, y);
  }

  function pad(n) { return String(n).padStart(4, '0'); }

  function draw() {
    ctx.fillStyle = COLOR.sky;
    ctx.fillRect(0, 0, W, H);

    for (const s of stars) {
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = COLOR.star;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.size, s.size);
    }
    ctx.globalAlpha = 1;

    // Ground line plus dashes that scroll with the distance
    ctx.fillStyle = COLOR.ground;
    ctx.fillRect(0, GROUND, W, 2);
    const offset = Math.floor(distance % 40);
    for (let x = -offset; x < W; x += 40) ctx.fillRect(x, GROUND + 8, 16, 2);

    for (const o of obstacles) {
      drawSprite(BUG, o.x, o.y, COLOR.bug);
      if (o.kind === 'tall') drawSprite(BUG, o.x, o.y + BUG_H, COLOR.bug);
      if (o.kind === 'wide') drawSprite(BUG, o.x + BUG_W + PX, o.y, COLOR.bug);
    }

    const running = state === 'playing' && player.onGround;
    const frame = running ? Math.floor(runTime * 8) % 2 : 0;
    drawSprite(DINO_FRAMES[frame], player.x, player.y, COLOR.dino);

    text('SCORE ' + pad(score), 12, 10, COLOR.text, 11);
    text('BEST ' + pad(best), W - 12, 10, COLOR.text, 11, 'right');

    // The canvas is 480px wide but shows at ~320px on a phone, so the text is a bit big on purpose
    if (state === 'idle') {
      text('ORPHEUS RUN', W / 2, 68, COLOR.accent, 22, 'center');
      text('PRESS SPACE OR TAP TO PLAY', W / 2, 108, COLOR.text, 13, 'center');
      text('JUMP OVER THE BUGS', W / 2, 132, COLOR.muted, 12, 'center');
    } else if (state === 'over') {
      text('GAME OVER', W / 2, 68, COLOR.bug, 22, 'center');
      text('SCORE ' + score + '   BEST ' + best, W / 2, 108, COLOR.text, 13, 'center');
      text('PRESS SPACE OR TAP TO RETRY', W / 2, 132, COLOR.accent, 12, 'center');
    }
  }

  function loop(now) {
    if (state !== 'playing' || paused) return;
    const dt = Math.min((now - lastFrame) / 1000, 0.05);   // cap so a hiccup can't teleport the bugs
    lastFrame = now;
    update(dt);
    draw();
    if (state === 'playing') frameId = requestAnimationFrame(loop);
  }

  function setReadout(message) {
    if (readout) readout.textContent = message;
  }

  function start() {
    reset();
    state = 'playing';
    paused = false;
    setReadout('Run!');
    if (playButton) playButton.textContent = 'Restart';
    lastFrame = performance.now();
    cancelAnimationFrame(frameId);
    frameId = requestAnimationFrame(loop);
  }

  function gameOver() {
    state = 'over';
    overSince = performance.now();
    if (score > best) {
      best = score;
      saveBest(best);
    }
    draw();
    setReadout('Game over · score ' + score + ' · best ' + best);
    if (playButton) playButton.textContent = 'Play again';
  }

  // One input does everything: start the game, jump, or retry.
  function action() {
    if (state === 'playing') {
      jump();
    } else if (state === 'over' && performance.now() - overSince < 400) {
      // Ignore the tap that caused the crash
    } else {
      start();
    }
  }

  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    canvas.focus({ preventScroll: true });
    action();
  });

  canvas.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW' || event.code === 'Enter') {
      event.preventDefault();          // keep the page from scrolling
      if (!event.repeat) action();
    }
  });

  if (playButton) {
    playButton.addEventListener('click', () => {
      start();
      canvas.focus({ preventScroll: true });
    });
  }

  // Pause when the tab is hidden, pick up where we left off when it's back
  document.addEventListener('visibilitychange', () => {
    if (state !== 'playing') return;
    if (document.hidden) {
      paused = true;
      cancelAnimationFrame(frameId);
    } else if (paused) {
      paused = false;
      lastFrame = performance.now();
      frameId = requestAnimationFrame(loop);
    }
  });

  // First frame, then redraw once the pixel font has loaded
  reset();
  draw();
  if (document.fonts && document.fonts.load) {
    document.fonts.load('10px Silkscreen').then(() => { if (state !== 'playing') draw(); }).catch(() => {});
  }
})();
