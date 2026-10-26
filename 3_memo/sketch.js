// =============================================
//  얼굴 화단 (핸드폰용) — p5.js (그리기) + matter.js (씨앗 낙하, 흙 부스러기)
//  시술 = 씨앗 → 새싹 → 꽃 → 시듦 (종류별로 같은 꽃 · 같은 효과)
//  토닝 = 화단을 문질러 물을 주면 얼굴이 연두색으로, 신경 쓰이는 곳 = 새
//  심은 꽃을 누르면 줌인 → 꽃마다 다른 터치 동작 / 바깥을 누르면 원래대로
// =============================================
const { Engine, Bodies, Composite, Body } = Matter;

const STORAGE_KEY = 'skin-flower-v1';
const BIRD_KEY = 'skin-flower-birds-v1';
const PIZZA_KEYS = { plants: 'skin-pizza-v1', birds: 'skin-pizza-olives-v1' };
const OLD_KEYS = { plants: 'skin-garden-v1', birds: 'skin-garden-birds-v1' };

// 화면 위·아래 여백 (style.css의 --top, --bar와 맞춰요)
const TOP_H = 84;
const BAR_H = 74;

// ---------- 색 ----------
const BG = '#f6f3ec';           // 배경 단색
const RIM = '#ece7dd';          // 돌 테두리 바탕
const STONE = '#ddd6cb';        // 돌
const FACE_L = '#6c8a67';       // 얼굴 왼쪽 면 (짙은 세이지 초록)
const FACE_R = '#89a47d';       // 얼굴 오른쪽 면 (조금 밝은 세이지)
const TONE_L = '#bfd6a0';       // 토닝 뒤 왼쪽 면 (연두)
const TONE_R = '#d6e6bc';       // 토닝 뒤 오른쪽 면 (밝은 연두)
const STEM = '#dfe8c8';         // 줄기 (짙은 초록 위에서 잘 보이게 밝게)
const STEM_DRY = '#c9b79a';     // 시든 줄기
const STEM_ON_TONE = '#6b8a57'; // 연두색 화단 위 줄기 (밝은 바탕에서 잘 보이게)
const EYE_WHITE = '#fffaf2';
const IRIS = '#39251c';
const PUPIL = '#141a12';
const INK = '#33402f';

const EYE_SHAPE = (() => {
  const pts = [];
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    pts.push({ x: Math.cos(t), y: Math.sin(t) });
  }
  return pts;
})();

let engine, ground, faceLayer, toneLayer, revealLayer, grainLayer;
let plants = [];
let birds = [];
let fallingSeeds = [];
let particles = [];
let popAnims = {};
let birdAnim = {};
const birdFx = {};
const fxState = {};
const spriteCache = {};

const layout = { u: 20, eyes: [] };
const PZ = { cx: 0, cy: 0, R: 0, inner: 0, earR: 0, earY: 0 };
const eyeState = [{ ox: 0, oy: 0 }, { ox: 0, oy: 0 }];
const blink = { next: 2500, start: -9999 };
const ptr = { x: 0, y: 0, type: 'touch' };          // 마지막 손가락 위치 (화단 좌표)
const cam = { s: 1, x: 0, y: 0, ts: 1, tx: 0, ty: 0 }; // 카메라 (줌인용)

let pending = null;     // 심을 씨앗 / 부를 새 / 물 주기
let water = null;       // 토닝 물 주기 진행 상태
let toneFadeT = -1e9;   // 토닝이 완성된 시각 (연두색이 부드럽게 퍼지도록)
let curTone = 0;        // 지금 연두색 정도 (줄기 색을 맞추는 데 써요)
let sweepT = -1e9;      // 토닝 갈퀴가 지나가기 시작한 시각
let formState = null;
let active = null;      // 줌인해서 보고 있는 꽃/새
let drag = null;        // 옮기기
let gesture = null;     // 줌인한 꽃에 하는 터치 동작
let dayOffset = 0;
let drawerKey = null;

let stageEl, cardEl, toastEl, holdEl, formLayerEl, seedFormEl, birdFormEl, drawerEl, drawerBody, toastTimer;

//////////////////// setup
function setup() {
  stageEl = document.getElementById('stage');
  cardEl = document.getElementById('infoSheet');
  toastEl = document.getElementById('toast');
  holdEl = document.getElementById('holdHint');
  formLayerEl = document.getElementById('formLayer');
  seedFormEl = document.getElementById('seedForm');
  birdFormEl = document.getElementById('birdForm');
  drawerEl = document.getElementById('drawer');
  drawerBody = document.getElementById('drawerBody');

  const c = createCanvas(stageEl.clientWidth, stageEl.clientHeight);
  c.parent('stage');
  pixelDensity(Math.min(2, displayDensity()));
  textFont('Noto Sans KR');
  setupPointer(c.elt);

  engine = Engine.create();
  engine.gravity.y = 0.5;
  makeGround();

  computeLayout();
  resetCam(true);
  ptr.x = PZ.cx; ptr.y = PZ.cy + PZ.R;
  loadData();
  buildUI();
}

/////////////////// draw
function draw() {
  Engine.update(engine, Math.min(deltaTime, 16.66));
  const now = getNow(), t = millis();

  // 카메라를 목표 쪽으로 부드럽게
  cam.s += (cam.ts - cam.s) * 0.12;
  cam.x += (cam.tx - cam.x) * 0.12;
  cam.y += (cam.ty - cam.y) * 0.12;

  background(BG);
  push();
  translate(width / 2, height / 2);
  scale(cam.s);
  translate(-cam.x, -cam.y);

  image(faceLayer, 0, 0, width, height);
  // 토닝(연두) 겹치기 — 핸드폰에서도 잘 되도록 tint 대신 투명도로 그려요
  const ctx = drawingContext;
  const tone = toneStrength(now, t);
  curTone = tone;
  if (tone > 0.001) {
    ctx.globalAlpha = tone;
    image(toneLayer, 0, 0, width, height);
    ctx.globalAlpha = 1;
  }
  if (revealLayer) {
    const k = water ? 1 : 1 - constrain((t - toneFadeT) / 700, 0, 1);
    if (k > 0) {
      ctx.globalAlpha = k;
      image(revealLayer, 0, 0, width, height);
      ctx.globalAlpha = 1;
    } else {
      revealLayer.remove();
      revealLayer = null;
    }
  }

  drawGrain(now, t);
  drawEyes();
  drawPlants(now, t);
  updateAndDrawBirds(t);
  updateFallingSeeds();
  drawFallingSeeds();
  updateParticles();
  drawDragHint();
  drawGhost();
  pop();
}

function windowResized() {
  resizeCanvas(stageEl.clientWidth, stageEl.clientHeight);
  computeLayout();
  if (active) zoomTo(activeItem()); else resetCam(true);
  Composite.remove(engine.world, ground);
  makeGround();
}

//////////////////// 카메라 (줌인)
function resetCam(instant) {
  cam.ts = 1; cam.tx = width / 2; cam.ty = height / 2;
  if (instant) { cam.s = 1; cam.x = cam.tx; cam.y = cam.ty; }
}

// 화면 좌표 → 화단 좌표
function toWorld(sx, sy) {
  return { x: (sx - width / 2) / cam.s + cam.x, y: (sy - height / 2) / cam.s + cam.y };
}

// 꽃(또는 새)을 화면 위쪽 1/3 지점에 오도록 크게
const ZOOM = 1.8;
function zoomTo(item) {
  if (!item) return;
  let px, py;
  if (active && active.kind === 'plant') {
    if (isWhole(item)) { resetCam(); return; }
    const g = plantGeom(item, getStatus(item, getNow()), millis(), fxOf(item.id));
    px = (g.x + g.hx) / 2;
    py = (g.y + g.hy) / 2;
  } else {
    const s = toScreen(item.nx, item.ny);
    px = s.x; py = s.y - layout.u;
  }
  cam.ts = ZOOM;
  cam.tx = px;
  cam.ty = py + (height * 0.5 - height * 0.3) / ZOOM;
}

//////////////////// 얼굴 + 화단
// 얼굴 크기와 배치 — 아래 값은 모두 '얼굴 상자'에 대한 비율이라, 눈과 얼굴이 화단에 붙어 함께 커지고 작아져요
const FACE_SCALE = 2.2;
const FACE_ASPECT = 1.6;
const FACE_ANCHOR = { x: 0.48, y: 0.58 };
const EYE_W = 0.15;        // 눈 가로 길이 (얼굴 상자 가로 기준)
const EYE_GAP = 0.35;      // 두 눈 중심 사이 거리
const EYE_Y = 0.35;        // 얼굴 상자 맨 위에서 눈 중심까지 (세로 기준)
const EYE_MID = 0.459;     // 두 눈 가운데의 가로 위치
const EAR_SIZE = 0.2;      // 귀 크기 (화단 반지름 기준)

const FB = { x: 0, y: 0, w: 0, h: 0 };
const fx = v => FB.x + v * FB.w;
const fy = v => FB.y + v * FB.h;

function computeLayout() {
  const availH = height - TOP_H - BAR_H;
  PZ.R = Math.min(width / 2.4, availH / 2.45);
  PZ.cx = width / 2;
  PZ.cy = TOP_H + availH / 2;   // 맨 위 글씨와 메뉴 바 사이 정가운데
  PZ.inner = PZ.R * 0.87;
  layout.u = PZ.R * 0.064;

  FB.w = PZ.inner * FACE_SCALE;
  FB.h = FB.w / FACE_ASPECT;
  FB.x = PZ.cx - FACE_ANCHOR.x * FB.w;
  FB.y = PZ.cy - FACE_ANCHOR.y * FB.h;

  PZ.earR = PZ.R * EAR_SIZE;
  PZ.earY = PZ.cy;

  const ew = EYE_W * FB.w, eh = ew / 1.86;
  layout.eyes = [
    { cx: fx(EYE_MID - EYE_GAP / 2), cy: fy(EYE_Y), w: ew, h: eh },
    { cx: fx(EYE_MID + EYE_GAP / 2), cy: fy(EYE_Y), w: ew, h: eh },
  ];
  for (const k in spriteCache) delete spriteCache[k];
  buildLayers();
}

function faceLines() {
  const X0 = fx(0.44), Yn = fy(0.57);
  const endDist = k => dist(X0 + 0.25 * FB.w * k, Yn + 0.43 * FB.h * k, PZ.cx, PZ.cy);
  let lo = 0.1, hi = 8;
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (endDist(m) < PZ.inner) lo = m; else hi = m;
  }
  const w = FB.w * lo, h = FB.h * lo;
  const x0 = X0 - 0.44 * w, y0 = Yn - 0.57 * h;
  return { x: v => x0 + v * w, y: v => y0 + v * h };
}

// 얼굴 두 면 (+ 귓속) 그리기 — 기본(짙은 초록)과 토닝(연두) 두 장을 만들어요
function paintFace(g, colL, colR) {
  const ctx = g.drawingContext;
  for (const side of [-1, 1]) {
    g.fill(side < 0 ? colL : colR);
    g.circle(PZ.cx + side * PZ.R * 0.97, PZ.earY, PZ.earR * 1.24);
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(PZ.cx, PZ.cy, PZ.inner, 0, Math.PI * 2);
  ctx.clip();
  g.fill(colL);
  g.rect(0, 0, width, height);
  g.fill(colR);
  const F = faceLines();
  g.beginShape();
  g.vertex(F.x(0.44), F.y(-2));
  g.vertex(F.x(0.44), F.y(0.57));
  g.vertex(F.x(0.535), F.y(0.57));
  g.vertex(F.x(0.535), F.y(0.76));
  g.bezierVertex(F.x(0.535), F.y(0.87), F.x(0.6), F.y(0.96), F.x(0.69), F.y(1.0));
  g.vertex(F.x(0.82), F.y(1.5));
  g.vertex(F.x(3), F.y(3));
  g.vertex(F.x(3), F.y(-2));
  g.endShape(CLOSE);
  ctx.restore();
  g.fill(0);   // restore 뒤 p5 색 기억을 맞춰 둠
}

function buildLayers() {
  const dens = Math.min(2, displayDensity());
  const W = width, H = height;

  // 기본 화단
  const g = createGraphics(W, H);
  g.pixelDensity(dens);
  g.noStroke();
  g.clear();
  // 돌 테두리 (같은 크기의 동그란 돌을 고르게)
  g.fill(RIM);
  g.circle(PZ.cx, PZ.cy, PZ.R * 2);
  for (const side of [-1, 1]) g.circle(PZ.cx + side * PZ.R * 0.97, PZ.earY, PZ.earR * 2);
  g.fill(STONE);
  const ring = (cx, cy, r0, r1, a0, a1) => {
    const mid = (r0 + r1) / 2, d = (r1 - r0) * 0.72;
    const n = Math.max(5, Math.round(((a1 - a0) * mid) / (d * 1.45)));
    for (let i = 0; i < n; i++) {
      const a = a0 + ((i + 0.5) / n) * (a1 - a0);
      g.circle(cx + Math.cos(a) * mid, cy + Math.sin(a) * mid, d);
    }
  };
  for (const side of [-1, 1]) {
    const a0 = side > 0 ? -HALF_PI * 0.8 : HALF_PI * 1.2;
    ring(PZ.cx + side * PZ.R * 0.97, PZ.earY, PZ.earR * 0.62, PZ.earR, a0, a0 + PI * 0.8);
  }
  ring(PZ.cx, PZ.cy, PZ.inner, PZ.R, 0, TWO_PI);
  paintFace(g, FACE_L, FACE_R);
  if (faceLayer) faceLayer.remove();
  faceLayer = g;

  // 토닝 뒤 (연두) — 얼굴 면만
  const t = createGraphics(W, H);
  t.pixelDensity(dens);
  t.noStroke();
  t.clear();
  paintFace(t, TONE_L, TONE_R);
  if (toneLayer) toneLayer.remove();
  toneLayer = t;

  // 얼굴의 거친 결 (그레인) — 토닝을 하면 사라져요
  const gr = createGraphics(W, H);
  gr.pixelDensity(dens);
  gr.noStroke();
  gr.clear();
  const gctx = gr.drawingContext;
  gctx.save();
  gctx.beginPath();
  gctx.arc(PZ.cx, PZ.cy, PZ.inner, 0, Math.PI * 2);
  for (const side of [-1, 1]) {
    gctx.moveTo(PZ.cx + side * PZ.R * 0.97 + PZ.earR * 0.62, PZ.earY);
    gctx.arc(PZ.cx + side * PZ.R * 0.97, PZ.earY, PZ.earR * 0.62, 0, Math.PI * 2);
  }
  gctx.clip();
  randomSeed(17);
  const n = Math.round((PZ.R * PZ.R) * 0.3);
  for (let i = 0; i < n; i++) {
    const a = random(TWO_PI), r = PZ.R * Math.sqrt(random());
    const x = PZ.cx + Math.cos(a) * r, y = PZ.cy + Math.sin(a) * r;
    if (random() < 0.62) gr.fill(30, 45, 28, random(40, 95));
    else gr.fill(255, 252, 236, random(45, 100));
    gr.circle(x, y, random(0.7, 1.9));
  }
  for (let i = 0; i < n * 0.03; i++) {   // 조금 큰 모공 같은 점
    const a = random(TWO_PI), r = PZ.R * Math.sqrt(random());
    gr.fill(30, 45, 28, random(25, 55));
    gr.circle(PZ.cx + Math.cos(a) * r, PZ.cy + Math.sin(a) * r, random(2, 3.4));
  }
  randomSeed(Date.now() % 100000);
  gctx.restore();
  gr.fill(0);
  if (grainLayer) grainLayer.remove();
  grainLayer = gr;
}

function drawEyes() {
  const t = millis();
  if (t > blink.next) { blink.start = t; blink.next = t + random(2500, 6500); }
  const bt = (t - blink.start) / 400;
  const open = bt >= 0 && bt < 1 ? 1 - Math.sin(bt * Math.PI) * 0.92 : 1;
  const ctx = drawingContext;
  const midX = (layout.eyes[0].cx + layout.eyes[1].cx) / 2, midY = layout.eyes[0].cy;

  layout.eyes.forEach((e, i) => {
    const st = eyeState[i];
    const hw = e.w / 2, hh = (e.h / 2) * open;
    const irisR = e.h * 0.5;
    const dx = ptr.x - midX, dy = ptr.y - midY;
    const d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / (PZ.R * 1.2));
    const LOOK = 0.5;
    const maxX = (hw - irisR * 0.55) * LOOK, maxY = (e.h / 2 - irisR * 0.45) * LOOK;
    st.ox += ((dx / d) * k * maxX - st.ox) * 0.08;
    st.oy += ((dy / d) * k * maxY - st.oy) * 0.08;

    noStroke();
    fill(EYE_WHITE);
    beginShape();
    for (const p of EYE_SHAPE) vertex(e.cx + p.x * hw, e.cy + p.y * hh);
    endShape(CLOSE);

    ctx.save();
    ctx.beginPath();
    EYE_SHAPE.forEach((p, j) => {
      const x = e.cx + p.x * hw, y = e.cy + p.y * hh;
      j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.clip();
    fill(IRIS);
    circle(e.cx + st.ox, e.cy + st.oy, irisR * 2);
    fill(PUPIL);
    circle(e.cx + st.ox * 1.12, e.cy + st.oy * 1.12, irisR * 0.62);
    ctx.restore();
    fill(EYE_WHITE);
  });
}

function isOnEye(x, y) {
  const u = layout.u;
  return layout.eyes.some(e => {
    const dx = (x - e.cx) / (e.w / 2 + u * 0.8);
    const dy = (y - e.cy) / (e.h / 2 + u * 0.8);
    return dx * dx + dy * dy < 1;
  });
}

function isOnEar(x, y) {
  return [-1, 1].some(side => dist(x, y, PZ.cx + side * PZ.R * 0.97, PZ.earY) < PZ.earR * 0.85);
}

function isOnBed(x, y) {
  return dist(x, y, PZ.cx, PZ.cy) < PZ.inner || isOnEar(x, y);
}

function makeGround() {
  ground = Bodies.rectangle(width / 2, height + 25, width * 3, 50, { isStatic: true });
  Composite.add(engine.world, ground);
}

function toScreen(nx, ny) {
  return { x: PZ.cx + nx * PZ.R, y: PZ.cy + ny * PZ.R };
}

function toPizza(x, y) {
  return { nx: (x - PZ.cx) / PZ.R, ny: (y - PZ.cy) / PZ.R };
}

const catOf = p => SEEDS[p.type].cat;
const isWhole = p => CATS[catOf(p)].mode === 'whole';

//////////////////// 꽃 그림 (간단한 도형)
function getSprite(kind) {
  if (spriteCache[kind]) return spriteCache[kind];
  const D = layout.u * CATS[kind].size * 2;
  const S = Math.ceil(D * 1.25);
  const g = createGraphics(S, S);
  g.pixelDensity(Math.min(4, displayDensity() * ZOOM));   // 줌인해도 또렷하게
  const c = S / 2, k = S * 0.4;
  g.noStroke();

  if (kind === 'muscle') {
    // 큰 동그라미 + 작은 동그라미
    g.fill('#d9787f');
    g.circle(c, c - k * 0.2, k * 1.45);
    g.circle(c, c + k * 0.72, k * 0.5);
  } else if (kind === 'volume') {
    // 동그라미 세 개가 모인 구름 꽃
    g.stroke('#d6cce6');
    g.strokeWeight(Math.max(1, k * 0.05));
    g.fill('#faf4ea');
    g.circle(c - k * 0.4, c + k * 0.18, k * 1.0);
    g.circle(c + k * 0.4, c + k * 0.18, k * 1.0);
    g.circle(c, c - k * 0.34, k * 1.08);
    g.noStroke();
    g.fill('#c6b9de');
    g.circle(c, c + k * 0.02, k * 0.34);
  } else if (kind === 'lifting') {
    // 고리 + 작은 점
    g.fill('#a893c2');
    g.circle(c, c + k * 0.12, k * 1.6);
    g.erase();
    g.circle(c, c + k * 0.12, k * 0.84);
    g.noErase();
    g.fill('#d8cce6');
    g.circle(c, c - k * 0.9, k * 0.32);
  } else if (kind === 'booster') {
    // 반반 동그라미
    g.fill('#e48d80');
    g.arc(c, c, k * 1.7, k * 1.7, HALF_PI, PI * 1.5, PIE);
    g.fill('#f2c0b6');
    g.arc(c, c, k * 1.7, k * 1.7, -HALF_PI, HALF_PI, PIE);
  } else if (kind === 'resurf') {
    // 긴 알약 + 띠
    g.fill('#a8c9d6');
    g.rect(c - k * 0.3, c - k * 0.95, k * 0.6, k * 1.9, k * 0.3);
    g.fill('#dbe9ef');
    g.rect(c - k * 0.3, c - k * 0.1, k * 0.6, k * 0.22);
  } else if (kind === 'spot') {
    // 위가 뾰족한 물방울
    g.fill('#efd283');
    g.beginShape();
    g.vertex(c, c - k * 0.98);
    g.bezierVertex(c + k * 0.35, c - k * 0.45, c + k * 0.78, c - k * 0.05, c + k * 0.78, c + k * 0.3);
    g.bezierVertex(c + k * 0.78, c + k * 0.75, c + k * 0.42, c + k * 0.98, c, c + k * 0.98);
    g.bezierVertex(c - k * 0.42, c + k * 0.98, c - k * 0.78, c + k * 0.75, c - k * 0.78, c + k * 0.3);
    g.bezierVertex(c - k * 0.78, c - k * 0.05, c - k * 0.35, c - k * 0.45, c, c - k * 0.98);
    g.endShape(CLOSE);
  }
  spriteCache[kind] = { g, D, S };
  return spriteCache[kind];
}

//////////////////// 상태
const PLAY_MS = 5000;        // 심은 직후 인터랙션이 혼자 움직이는 시간
const WILT_SHOW_DAYS = 30;   // 꽃이 진 뒤 시든 모습이 남아 있는 날 수

function fxOf(id) {
  return fxState[id] || (fxState[id] = {
    h: 0, playT: -1e9,
    rings: [], lastRing: 0,
    holdT: 0, holding: false,      // 보톡스: 꾹 누르기
    pokeT: -1e9, pokeDir: 0,       // 필러: 톡 건드리기
    pull: 0, pullRel: -1e9, pullV: 0, // 리프팅: 끌어올리기
    drops: [], fill: 0,            // 부스터: 물방울
    holes: [],                     // 재생: 문지르기
    specks: null,                  // 잡티: 쓱 긋기
  });
}

function playEnv(playT, t) {
  const a = t - playT;
  if (a < 0 || a > PLAY_MS) return 0;
  return Math.min(1, a / 300, (PLAY_MS - a) / 900);
}

function effOf(st) {
  if (st.stage === 'growing') return constrain(st.growth, 0, 1);
  if (st.stage === 'bloom') return st.keep;
  return 0;
}

function alphaOf(st) {
  if (st.stage === 'waiting') return 0.25;
  if (st.stage === 'growing') return 0.45 + 0.55 * constrain(st.growth, 0, 1);
  if (st.stage === 'bloom') return st.keep < 0.25 ? map(st.keep, 0, 0.25, 0.35, 1) : 1;
  return 0;
}

function wiltFade(st) {
  return st.stage === 'wilted' ? 1 - constrain(st.daysSinceWilt / WILT_SHOW_DAYS, 0, 1) : 1;
}

function toppingSize(p) {
  return layout.u * CATS[catOf(p)].size * 2;
}

function easeOutQ(t) { return 1 - (1 - t) * (1 - t); }
function easeOutBack(t) {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function frac(v) { return v - Math.floor(v); }

function popScale(id) {
  const start = popAnims[id];
  if (start === undefined) return 1;
  const t = (millis() - start) / 600;
  if (t >= 1) { delete popAnims[id]; return 1; }
  return Math.max(0.05, easeOutBack(t));
}

//////////////////// 토닝: 얼굴이 연두색으로
// 진행 중인 토닝 중 가장 진한 값 (0~1) — 바로 나타나고, 유지 기간 끝 무렵 옅어져요
// 얼굴 전체 시술 중 가장 진한 값 (0~1) — 바로 나타나고, 유지 기간 끝 무렵 옅어져요
function wholeStrength(effect, now) {
  let s = 0;
  for (const p of plants) {
    if (!isWhole(p) || CATS[catOf(p)].effect !== effect) continue;
    const st = getStatus(p, now);
    let v = 0;
    if (st.stage === 'growing') v = 1;
    else if (st.stage === 'bloom') v = st.keep < 0.25 ? st.keep / 0.25 : 1;
    s = Math.max(s, v);
  }
  return s;
}

// 부스터: 연두색 정도
function toneStrength(now, t) {
  return wholeStrength('green', now) * constrain((t - toneFadeT) / 700, 0, 1);   // 물 주기를 마친 직후에는 부드럽게 퍼져요
}

// 토닝: 그레인을 그려요 (토닝 세기만큼 옅어지고, 갈퀴가 지나가는 동안은 지나간 위쪽부터 흙이 정리돼요)
const SWEEP_MS = 2000;
const GRAIN_ALPHA = 0.45;   // 그레인 진하기 (0~1, 작을수록 옅어요)
function drawGrain(now, t) {
  const smooth = wholeStrength('smooth', now);
  const ctx = drawingContext;
  const k = (t - sweepT) / SWEEP_MS;
  if (k >= 0 && k < 1) {
    const top = PZ.cy - PZ.R * 1.05, bottom = PZ.cy + PZ.R * 1.12;
    const ly = lerp(top, bottom, k);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, ly, width, height);
    ctx.clip();
    ctx.globalAlpha = GRAIN_ALPHA;
    image(grainLayer, 0, 0, width, height);
    ctx.globalAlpha = 1;
    ctx.restore();
    fill(0);
    drawRake(ly, k);
    return;
  }
  if (smooth >= 0.999) return;
  ctx.globalAlpha = (1 - smooth) * GRAIN_ALPHA;
  image(grainLayer, 0, 0, width, height);
  ctx.globalAlpha = 1;
}

// 갈퀴: 위에서 아래로 좌우로 살랑이며 흙을 고르고, 지나간 자리엔 옅은 결이 남아요
function drawRake(ly, k) {
  const u = layout.u;
  const fade = k < 0.85 ? 1 : (1 - k) / 0.15;
  // 고른 자국 — 얼굴 안쪽에만 가로 줄
  stroke(255, 250, 230, 45 * fade);
  strokeWeight(1);
  for (let y = PZ.cy - PZ.inner + u * 0.5; y < ly - u * 0.5; y += u * 0.55) {
    const dy = y - PZ.cy;
    if (Math.abs(dy) >= PZ.inner) continue;
    const hw = Math.sqrt(PZ.inner * PZ.inner - dy * dy) * 0.94;
    line(PZ.cx - hw, y, PZ.cx + hw, y);
  }
  // 갈퀴
  const rx = PZ.cx + Math.sin(k * PI * 5) * PZ.R * 0.22;
  const hw = PZ.R * 0.42;
  const wood = color(196, 160, 112, 255 * fade), head = color(132, 104, 76, 255 * fade);
  stroke(wood);
  strokeWeight(u * 0.26);
  line(rx, ly - u * 0.3, rx + PZ.R * 0.28, ly - PZ.R * 0.85);   // 자루
  stroke(head);
  strokeWeight(u * 0.12);
  for (let i = 0; i <= 8; i++) {                                 // 갈퀴 이
    const x = rx - hw + (i / 8) * hw * 2;
    line(x, ly - u * 0.3, x, ly + u * 0.45);
  }
  noStroke();
  fill(head);
  rect(rx - hw - u * 0.1, ly - u * 0.55, hw * 2 + u * 0.2, u * 0.36, u * 0.18);
  // 튀는 흙 부스러기
  fill(70, 88, 60, 200 * fade);
  for (let i = 0; i < 3; i++) {
    if (random() < 0.7) circle(rx + random(-hw, hw), ly + u * random(0.3, 0.8), u * random(0.08, 0.18));
  }
}

function startWatering(type, date, info, photos) {
  const cell = layout.u * 1.8;
  const cells = new Set();
  let total = 0;
  for (let x = PZ.cx - PZ.inner; x <= PZ.cx + PZ.inner; x += cell) {
    for (let y = PZ.cy - PZ.inner; y <= PZ.cy + PZ.inner; y += cell) {
      if (dist(x, y, PZ.cx, PZ.cy) < PZ.inner * 0.95) total++;
    }
  }
  water = { type, date, info, photos: photos || [], cell, cells, total, last: null };
  if (revealLayer) revealLayer.remove();
  revealLayer = createGraphics(width, height);
  revealLayer.pixelDensity(Math.min(2, displayDensity()));
  revealLayer.clear();
  pending = { kind: 'water', type };
  closeInfo();
  updateWaterHint();
  holdEl.classList.remove('hidden');
}

function updateWaterHint() {
  const pct = Math.min(100, Math.round((water.cells.size / (water.total * 0.55)) * 100));
  holdEl.innerHTML = `<span class="glyph">${CATS.booster.glyph}</span><span><b>${SEEDS[water.type].name}</b> · 화단을 문질러 물을 주세요 <span class="prog">${pct}%</span></span><button class="text-btn">취소</button>`;
  holdEl.querySelector('button').onclick = () => cancelWatering();
}

function waterAt(x, y) {
  if (!water || !isOnBed(x, y)) return;
  const r = layout.u * 2.2;
  const from = water.last || { x, y };
  const steps = Math.max(1, Math.ceil(dist(from.x, from.y, x, y) / (r * 0.4)));
  const ctx = revealLayer.drawingContext;
  for (let i = 1; i <= steps; i++) {
    const px = lerp(from.x, x, i / steps), py = lerp(from.y, y, i / steps);
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.clip();
    revealLayer.image(toneLayer, 0, 0, width, height);
    ctx.restore();
    // 덮인 칸 세기
    const c = water.cell;
    for (let gx = px - r; gx <= px + r; gx += c * 0.5) {
      for (let gy = py - r; gy <= py + r; gy += c * 0.5) {
        if (dist(gx, gy, px, py) > r || dist(gx, gy, PZ.cx, PZ.cy) > PZ.inner * 0.95) continue;
        water.cells.add(`${Math.round((gx - PZ.cx) / c)},${Math.round((gy - PZ.cy) / c)}`);
      }
    }
  }
  water.last = { x, y };
  if (random() < 0.5) spawnBit(x + random(-r, r) * 0.5, y - r * 0.3, random(['#a9d3e8', '#cfe8f3', TONE_R]), { x: random(-1.5, 1.5), y: random(-3, -1) }, 700);
  updateWaterHint();
  if (water.cells.size >= water.total * 0.55) finishWatering();
}

function finishWatering() {
  const w = water;
  water = null;
  pending = null;
  holdEl.classList.add('hidden');
  toneFadeT = millis();
  addPlant({ type: w.type, date: w.date, info: w.info, photos: w.photos });
  for (let i = 0; i < 18; i++) {
    const a = random(TWO_PI), r = random(PZ.inner * 0.8);
    spawnBit(PZ.cx + Math.cos(a) * r, PZ.cy + Math.sin(a) * r, random([TONE_L, TONE_R, '#ffffff']), { x: random(-2, 2), y: random(-4, -1.5) }, 1100);
  }
}

function cancelWatering() {
  if (water) deletePhotos(water.photos);
  water = null;
  pending = null;
  holdEl.classList.add('hidden');
  if (revealLayer) { revealLayer.remove(); revealLayer = null; }
}

//////////////////// 식물
const SWAY = 0.085;   // 바람에 흔들리는 정도 (키우면 더 많이 흔들려요)

function stemH(p) {
  return layout.u * CATS[catOf(p)].stem;
}

// 식물 모양 (곧은 줄기) — 그리기와 터치 판정에 같이 써요
function plantGeom(p, st, t, fx) {
  const { x, y } = toScreen(p.nx, p.ny);
  const u = layout.u, H = stemH(p), cat = catOf(p);
  const eff = effOf(st);
  let grow = 1, vivid = 1, wilt = false;
  if (st.stage === 'growing') grow = constrain(st.growth, 0, 1);
  if (st.stage === 'waiting') grow = 0;
  if (st.stage === 'bloom' && st.keep < 0.25) vivid = map(st.keep, 0, 0.25, 0.3, 1);
  if (st.stage === 'wilted') { wilt = true; vivid = 0; }

  // 리프팅: 심은 직후 + 손가락으로 끌어올린 만큼 줄기가 늘어나요
  let lift = 0;
  if (cat === 'lifting' && fx) {
    const auto = u * 1.0 * fx.h * (0.35 + 0.65 * eff);
    let pull = fx.pull;
    if (!gesture || gesture.id !== p.id) {
      const dt = (t - fx.pullRel) / 1000;
      pull = dt < 2 ? fx.pullV * Math.exp(-dt * 4) * Math.cos(dt * 13) : 0;   // 놓으면 통통 튀며 제자리로
    }
    lift = auto + u * 4 * pull * (0.4 + 0.6 * eff);
  }
  const len = wilt ? H * 0.6 : lerp(H * 0.18, H, easeOutQ(grow)) + lift;
  const lean = (frac(p.phase * 1.7) - 0.5) * 0.4;
  const sway = (Math.sin(t * 0.0016 + p.phase) * SWAY + (noise(p.phase, t * 0.0004) - 0.5) * SWAY * 1.1) * (wilt ? 0.1 : 1);
  const a = lean + sway;
  const dir = lean >= 0 ? 1 : -1;
  let hx, hy, mx, my;
  if (wilt) {
    // 시든 줄기: 중간에서 꺾여 고개를 숙임 (곧은 선 두 개)
    mx = x + Math.sin(a) * len * 0.6; my = y - Math.cos(a) * len * 0.6;
    const b = a + dir * 1.9;
    hx = mx + Math.sin(b) * len * 0.45; hy = my - Math.cos(b) * len * 0.45;
  } else {
    hx = x + Math.sin(a) * len; hy = y - Math.cos(a) * len;
    mx = hx; my = hy;
  }
  return { x, y, len, a, dir, hx, hy, mx, my, grow, vivid, wilt, eff };
}

function drawPlants(now, t) {
  const u = layout.u;
  const spots = plants.filter(p => !isWhole(p)).sort((a, b) => a.ny - b.ny);
  for (const p of spots) {
    const st = getStatus(p, now);
    const { x, y } = toScreen(p.nx, p.ny);
    drawDowntime(p, st, x, y);
  }
  for (const p of spots) {
    const st = getStatus(p, now);
    const fx = fxOf(p.id);
    fx.h = playEnv(fx.playT, t);
    drawPlant(p, st, u, fx, t);
    const al = alertOf(p, st);
    if (al) {
      const g = plantGeom(p, st, t, fx);
      const D = toppingSize(p);
      const hc = headCenter(g, D);
      drawAlert(hc.x + D * 0.55, hc.y - D * 0.5, u, al, t);
    }
  }
  if (frameCount % 30 === 0) { updateAlertDot(); updateFxBadges(); }
}

// 꽃 머리: 줄기 끝(x, y)에 붙여서
function drawHead(cat, x, y, size, rot, sx, sy, alpha, dry) {
  const spr = dry ? getDrySprite(cat) : getSprite(cat);
  const k = size / spr.D;
  push();
  translate(x, y);
  rotate(rot);
  translate(0, -size * 0.4);
  scale(sx * k, sy * k);
  drawingContext.globalAlpha = constrain(alpha, 0, 1);
  imageMode(CENTER);
  image(spr.g, 0, 0, spr.S, spr.S);
  drawingContext.globalAlpha = 1;
  pop();
}

// 시든 꽃 (갈색으로 칠한 그림을 한 번만 만들어 둬요)
function getDrySprite(kind) {
  const key = kind + '_dry';
  if (spriteCache[key]) return spriteCache[key];
  const src = getSprite(kind);
  const g = createGraphics(src.S, src.S);
  g.pixelDensity(src.g.pixelDensity());
  g.image(src.g, 0, 0, src.S, src.S);
  const ctx = g.drawingContext;
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(196, 172, 140, 0.88)';
  ctx.fillRect(0, 0, src.S, src.S);
  ctx.globalCompositeOperation = 'source-over';
  spriteCache[key] = { g, D: src.D, S: src.S };
  return spriteCache[key];
}

function headCenter(g, D) {
  return { x: g.hx + Math.sin(g.a) * D * 0.4, y: g.hy - Math.cos(g.a) * D * 0.4 };
}

function drawPlant(p, st, u, fx, t) {
  const cat = catOf(p);
  const c = CATS[cat];
  const D = toppingSize(p);
  const g = plantGeom(p, st, t, fx);
  const popS = popScale(p.id);
  const { x, y } = g;
  const fade = wiltFade(st);
  const focused = isActive('plant', p.id);
  const h = fx.h;

  // 씨앗 (시술일 전)
  if (st.stage === 'waiting') {
    noStroke();
    fill('#efe2c8');
    ellipse(x, y - u * 0.05, u * 0.42 * popS, u * 0.28 * popS);
    if (focused) focusRing(x, y, u);
    return;
  }
  if (fade <= 0) { if (focused) focusRing(x, y, u); return; }

  const hc = headCenter(g, D);

  // 꽃 아래 흙에서 일어나는 효과
  if (cat === 'resurf') drawHoles(p, fx, x, y, D, t);
  if (cat === 'booster') drawRipples(fx, x, y, D, t);
  if (cat === 'lifting') {
    const pulling = gesture && gesture.id === p.id;
    if ((h > 0.2 || pulling) && t - fx.lastRing > 380) {
      fx.rings.push({ t0: t, c: fx.rings.length % 2 ? '#e4ddee' : '#c3b5da' });
      fx.lastRing = t;
    }
    drawRings(fx, x, y, D, t);
  }
  if (cat === 'spot' && (st.stage === 'bloom' || st.stage === 'growing')) drawSpecks(p, fx, hc.x, hc.y, D, g.eff, t, focused);

  // 줄기 (곧은 선) + 곁가지 하나
  const stemCol = lerpColor(color(STEM_DRY), lerpColor(color(STEM), color(STEM_ON_TONE), curTone), g.vivid);
  stemCol.setAlpha(255 * fade);
  stroke(stemCol);
  strokeWeight(Math.max(1.4, u * 0.11));
  strokeCap(ROUND);
  line(x, y, g.mx, g.my);
  if (g.wilt) line(g.mx, g.my, g.hx, g.hy);
  if (g.grow > 0.3 && !g.wilt) {
    const k = 0.45;
    const bx = lerp(x, g.hx, k), by = lerp(y, g.hy, k);
    const side = frac(p.phase * 3.3) > 0.5 ? 1 : -1;
    const ba = g.a + side * 0.75;
    const bl = g.len * 0.28 * g.grow;
    const ex = bx + Math.sin(ba) * bl, ey = by - Math.cos(ba) * bl;
    line(bx, by, ex, ey);
    noStroke();
    const dc = lerpColor(color(STEM_DRY), color(c.accent), g.vivid);
    dc.setAlpha(200 * fade);
    fill(dc);
    circle(ex, ey, u * 0.32);
  }
  noStroke();
  fill(20, 40, 20, 50 * fade);
  ellipse(x, y + 1, u * 1.1, u * 0.3);

  // 꽃 머리
  if (st.stage === 'growing') {
    if (g.grow < 0.5) {
      fill(lerpColor(color(STEM), color(STEM_ON_TONE), curTone));
      circle(g.hx, g.hy, u * lerp(0.25, 0.45, g.grow * 2));   // 새싹 머리
    } else {
      const k = map(g.grow, 0.5, 1, 0, 1);
      drawHead(cat, g.hx, g.hy, D * lerp(0.3, 0.78, k) * popS, g.a, 1, 1, 0.55 + 0.4 * k, false);
    }
    if (focused) focusRing(x, y, u);
    return;
  }
  if (g.wilt) {
    drawHead(cat, g.hx, g.hy, D * 0.7, g.a + g.dir * 2.4, 1, 1, 0.9 * fade, true);
    if (focused) focusRing(x, y, u);
    return;
  }

  // 활짝 핀 꽃 + 종류별 효과 (심은 직후 5초 + 터치)
  let sx = 1, sy = 1, rot = g.a + (1 - g.vivid) * 0.9 * g.dir, size = D;
  if (cat === 'muscle') {
    // 꾹 누르면 찡그려요. 효과가 남아 있을수록 주름이 덜 생겨요.
    const auto = h * (0.5 + 0.5 * Math.sin((t - fx.playT) * 0.006 - HALF_PI));
    const hold = fx.holding ? Math.min(1, (t - fx.holdT) / 450) : 0;
    const A = Math.max(0.15, 1 - g.eff) * Math.max(auto, hold);
    const tryA = Math.max(auto, hold);
    sx = 1 + 0.06 * tryA + 0.06 * A;
    sy = 1 - 0.08 * tryA - 0.14 * A;
    rot += Math.sin(t * 0.05) * 0.03 * tryA;
    if (A > 0.01) drawWrinkles(hc.x, hc.y, D, A, t);
  } else if (cat === 'volume') {
    // 톡 건드리면 말랑하게 출렁여요. 시간이 지날수록 꽃송이가 작아져요.
    const tp = (t - fx.pokeT) / 1000;
    const poke = tp < 2.2 ? Math.exp(-tp * 3) * Math.sin(tp * 18) * 0.2 : 0;
    const ta = (t - fx.playT) / 1000;
    const auto = Math.sin(ta * 13) * 0.15 * h;
    const j = poke + auto;
    size = D * (0.7 + 0.3 * g.eff);
    sx = 1 + j;
    sy = 1 - j;
    rot += fx.pokeDir * poke * 0.6;
  } else if (cat === 'booster') {
    // 물방울을 넣을수록 몽글하게 차올라요
    fx.fill *= 0.995;
    const s2 = 1 + 0.06 * h * Math.sin((t - fx.playT) * 0.008) + 0.12 * fx.fill;
    sx = sy = s2;
  }
  drawHead(cat, g.hx, g.hy, size * popS, rot, sx, sy, alphaOf(st), false);

  if (cat === 'booster') drawDrops(p, fx, hc.x, hc.y, D, t);
  if (cat === 'spot') drawLaser(fx, hc.x, hc.y, D, t);
  if (focused) focusRing(x, y, u);
}

// 느낌표: 꽃이 다 피었거나 다 졌는데 아직 확인하지 않았을 때
function alertOf(p, st) {
  if (isWhole(p)) return null;
  const seen = p.seen || {};
  if (st.stage === 'bloom' && !seen.bloom) return 'bloom';
  if (st.stage === 'wilted' && wiltFade(st) > 0 && !seen.wilted) return 'wilted';
  return null;
}

// 꽃을 확인하면 느낌표가 사라져요 (시간 여행 중에는 기록하지 않아요)
function markSeen(p) {
  if (dayOffset) return;
  const a = alertOf(p, getStatus(p, getNow()));
  if (!a) return;
  p.seen = { ...(p.seen || {}), [a]: true };
  if (a === 'wilted') p.seen.bloom = true;
  savePlants();
  updateAlertDot();
}

function drawAlert(x, y, u, kind, t) {
  const bob = Math.sin(t * 0.006) * u * 0.12;
  const r = u * 0.62;
  noStroke();
  fill(0, 0, 0, 30);
  circle(x + 1, y + bob + 1.5, r * 2);
  fill(kind === 'bloom' ? '#e3897d' : '#b9a685');
  circle(x, y + bob, r * 2);
  fill(255);
  rect(x - r * 0.13, y + bob - r * 0.62, r * 0.26, r * 0.78, r * 0.13);
  circle(x, y + bob + r * 0.48, r * 0.28);
}

function updateAlertDot() {
  const n = plants.filter(p => alertOf(p, getStatus(p, getNow()))).length;
  const btn = document.querySelector('.bar-btn[data-key="status"]');
  if (btn) btn.classList.toggle('alert', n > 0);
}

// 부스터·토닝처럼 얼굴 전체에 하는 시술은 꽃이 없어서,
// 효과가 남아 있는 동안 얼굴 오른쪽 위(귀 위)에 그 모양을 띄워 둬요. 2개 이상이면 숫자가 붙어요.
let fxBadgeEl = null;
// 효과가 남아 있는 얼굴 전체 기록 (최근 것부터)
function activeWholeOf(key, now) {
  return plants
    .filter(p => catOf(p) === key && ['growing', 'bloom'].includes(getStatus(p, now).stage))
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
function updateFxBadges() {
  if (!fxBadgeEl) {
    fxBadgeEl = document.createElement('div');
    fxBadgeEl.id = 'fxBadges';
    document.body.appendChild(fxBadgeEl);
  }
  const now = getNow(), t = millis();
  const list = [];
  for (const key of Object.keys(CATS)) {
    if (CATS[key].mode !== 'whole') continue;
    if (key === 'toning' && t - sweepT < SWEEP_MS) continue;        // 갈퀴가 다 지나간 뒤에 떠요
    const n = activeWholeOf(key, now).length;
    if (n) list.push({ key, n });
  }
  const sig = list.map(b => b.key + b.n).join(',') + `|${Math.round(PZ.cx)},${Math.round(PZ.cy)},${Math.round(PZ.R)}`;
  if (fxBadgeEl.dataset.sig === sig) return;
  const old = new Set([...fxBadgeEl.children].map(el => el.dataset.key));
  fxBadgeEl.dataset.sig = sig;
  const size = Math.max(30, Math.min(40, PZ.R * 0.22));
  fxBadgeEl.innerHTML = list.map((b, i) => {
    const a = -0.66 - i * 0.36;                                      // 귀 위에서부터 테두리를 따라 위로
    const x = PZ.cx + Math.cos(a) * PZ.R * 1.13, y = PZ.cy + Math.sin(a) * PZ.R * 1.13;
    return `<button class="fx-badge${old.has(b.key) ? '' : ' pop'}" data-key="${b.key}" aria-label="${CATS[b.key].name} ${b.n}개"
      style="left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px">
      <span class="glyph">${CATS[b.key].glyph}</span>${b.n > 1 ? `<i>${b.n}</i>` : ''}</button>`;
  }).join('');
  fxBadgeEl.querySelectorAll('.fx-badge').forEach(el => {
    el.onclick = () => {                                              // 누르면 가장 최근 기록의 메모가 열려요
      const recs = activeWholeOf(el.dataset.key, getNow());
      if (recs.length) openInfo('plant', recs[0]);
    };
  });
}

function focusRing(x, y, u) {
  noFill();
  stroke(255, 255, 255, 170 + Math.sin(frameCount * 0.1) * 60);
  strokeWeight(1.2);
  drawingContext.setLineDash([3, 4]);
  ellipse(x, y + 1, u * 2.4, u * 0.8);
  drawingContext.setLineDash([]);
}

// 보톡스: 양옆 주름
function drawWrinkles(x, y, D, A, t) {
  noFill();
  stroke(255, 205, 210, 240 * Math.min(1, A));
  strokeWeight(1.5);
  for (const side of [0, PI]) {
    for (let k = 0; k < 3; k++) {
      beginShape();
      for (let th = -0.55; th <= 0.551; th += 0.05) {
        const rr = D * (0.62 + k * 0.13) + Math.sin(th * 14 + t * 0.01 + k) * A * D * 0.06;
        vertex(x + Math.cos(side + th) * rr, y + Math.sin(side + th) * rr * 0.9);
      }
      endShape();
    }
  }
}

// 리프팅: 바닥에서 퍼지는 점선 물결
function drawRings(fx, x, y, D, t) {
  noFill();
  strokeWeight(2);
  drawingContext.setLineDash([3, 6]);
  for (let i = fx.rings.length - 1; i >= 0; i--) {
    const r = fx.rings[i];
    const age = (t - r.t0) / 1300;
    if (age > 1) { fx.rings.splice(i, 1); continue; }
    const c = color(r.c);
    c.setAlpha(255 * Math.pow(1 - age, 0.7));
    stroke(c);
    ellipse(x, y, (D * 0.4 + age * D * 1.4) * 2, (D * 0.4 + age * D * 1.4) * 0.8);
  }
  drawingContext.setLineDash([]);
}

// 부스터: 바닥에 번지는 물기
function drawRipples(fx, x, y, D, t) {
  if (fx.h > 0.2 && t - fx.lastRing > 700) { fx.rings.push({ t0: t }); fx.lastRing = t; }
  noStroke();
  for (let i = fx.rings.length - 1; i >= 0; i--) {
    const age = (t - fx.rings[i].t0) / 1600;
    if (age > 1) { fx.rings.splice(i, 1); continue; }
    fill(190, 230, 240, 80 * (1 - age));
    ellipse(x, y, D * (0.8 + age * 1.6), D * (0.8 + age * 1.6) * 0.38);
  }
}

// 부스터: 꽃에 떨어져 스며드는 물방울 (심은 직후 + 톡톡 누를 때)
function drawDrops(p, fx, x, y, D, t) {
  if (fx.h > 0.2 && random() < 0.05) fx.drops.push({ dx: random(-0.4, 0.4) * D, t0: t });
  noStroke();
  for (let i = fx.drops.length - 1; i >= 0; i--) {
    const d = fx.drops[i];
    const age = (t - d.t0) / 900;
    if (age > 1) { fx.drops.splice(i, 1); continue; }
    const fall = Math.min(1, age * 1.6);
    const dx = x + d.dx, dy = y - D * 1.1 + fall * D * 1.0;
    const s = D * 0.11 * (1 - Math.max(0, age - 0.6) / 0.4);
    fill(225, 246, 252, 235);
    beginShape();
    vertex(dx, dy - s * 1.5);
    bezierVertex(dx + s, dy - s * 0.4, dx + s, dy + s, dx, dy + s);
    bezierVertex(dx - s, dy + s, dx - s, dy - s * 0.4, dx, dy - s * 1.5);
    endShape(CLOSE);
  }
}

// 재생: 흙에 생긴 작은 구멍이 메워져요 (심은 직후 + 문지른 자리)
function drawHoles(p, fx, x, y, D, t) {
  if (fx.h > 0.2 && random() < 0.35) {
    const a = random(TWO_PI), r = D * Math.sqrt(random()) * 0.9;
    fx.holes.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * 0.45, t0: t });
  }
  noStroke();
  for (let i = fx.holes.length - 1; i >= 0; i--) {
    const hle = fx.holes[i];
    const age = (t - hle.t0) / 2400;
    if (age > 1) { fx.holes.splice(i, 1); continue; }
    const s = layout.u * 0.2 * Math.min(1, age * 6) * (1 - Math.max(0, age - 0.4) / 0.6);
    fill(30, 50, 28, 200);
    circle(hle.x, hle.y, s * 2);
    fill(180, 220, 150, 140 * Math.max(0, age - 0.4));
    circle(hle.x, hle.y, s * 2.4);
  }
}

// 잡티: 꽃 주변의 점. 쓱 그으면 반짝이로 바뀌어요.
function drawSpecks(p, fx, x, y, D, eff, t, focused) {
  if (!fx.specks) {
    fx.specks = Array.from({ length: 12 }, (_, i) => {
      const ang = p.phase * 7 + i * 2.39;
      const rr = D * (0.65 + 0.45 * frac(i * 0.37 + p.phase));
      return { dx: Math.cos(ang) * rr, dy: Math.sin(ang) * rr, gone: 0, sz: 2 + frac(i * 0.71) * 2 };
    });
  }
  const show = Math.max(fx.h, focused ? 1 : 0);
  const vis = (0.35 + 0.65 * (1 - eff)) * show;
  noStroke();
  for (const s of fx.specks) {
    const sx = x + s.dx, sy = y + s.dy;
    if (s.gone && t - s.gone < 700) {
      const k = (t - s.gone) / 700;
      drawSparkle(sx, sy, D * 0.22 * Math.sin(k * PI), 1 - k);
    } else if (s.gone && t - s.gone > 4000) {
      s.gone = 0;   // 잠시 뒤 다시 생겨요
    } else if (!s.gone && vis > 0.01) {
      fill(196, 160, 118, 230 * vis);
      circle(sx, sy, s.sz * 1.7);
    }
  }
}

function drawLaser(fx, x, y, D, t) {
  if (fx.h > 0.05) {
    const bx = x - D * 1.1 + (((t - fx.playT) * 0.0006) % 1) * D * 2.2;
    zapLine(fx, x, y, bx, y - D * 1.2, bx, y + D * 1.2, fx.h, t);
  }
  if (fx.swipe && t - fx.swipe.t < 350) {
    const k = 1 - (t - fx.swipe.t) / 350;
    stroke(255, 250, 200, 230 * k);
    strokeWeight(layout.u * 0.25);
    line(fx.swipe.x0, fx.swipe.y0, fx.swipe.x1, fx.swipe.y1);
    stroke(255, 255, 255, 255 * k);
    strokeWeight(1.5);
    line(fx.swipe.x0, fx.swipe.y0, fx.swipe.x1, fx.swipe.y1);
    noStroke();
  }
}

// 선분이 지나간 자리의 잡티를 반짝이로
function zapLine(fx, x, y, x0, y0, x1, y1, a, t) {
  stroke(255, 248, 180, 150 * a);
  strokeWeight(layout.u * 0.25);
  line(x0, y0, x1, y1);
  noStroke();
  for (const s of fx.specks || []) {
    if (s.gone) continue;
    if (distToSeg(x + s.dx, y + s.dy, x0, y0, x1, y1) < layout.u * 0.6) s.gone = t;
  }
}

function distToSeg(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const l2 = dx * dx + dy * dy || 1;
  const k = constrain(((px - x0) * dx + (py - y0) * dy) / l2, 0, 1);
  return dist(px, py, x0 + k * dx, y0 + k * dy);
}

function drawSparkle(x, y, r, alpha) {
  if (r < 0.5) return;
  noStroke();
  fill(255, 246, 168, 255 * alpha);
  beginShape();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TWO_PI - HALF_PI;
    const rr = i % 2 ? r * 0.28 : r;
    vertex(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  endShape(CLOSE);
}

// 다운타임: 꽃 아래 흙이 붉어짐
function drawDowntime(p, st, x, y) {
  if (!st.downtime) return;
  const r = st.downtime.ratio;
  const k = 0.4 + 0.6 * r;
  const R = toppingSize(p) * (0.95 + 0.6 * r);
  const ctx = drawingContext;
  const g = ctx.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, `rgba(226, 120, 118, ${0.55 * k})`);
  g.addColorStop(0.55, `rgba(232, 146, 140, ${0.28 * k})`);
  g.addColorStop(1, 'rgba(250, 150, 150, 0)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(x, y, R, R * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  fill(0);
}

//////////////////// 새 (신경 쓰이는 곳) — 간단한 도형
// 발끝이 (x, y), 오른쪽을 바라보는 새
function drawBird(x, y, u, dir, flap, flying, alpha = 255) {
  const P = u * 0.9;
  const C = BIRD.colors;
  push();
  translate(x, y);
  scale(dir, 1);
  stroke(C.beak);
  strokeWeight(1.2);
  if (!flying) {
    line(-0.15 * P, 0, -0.1 * P, -0.5 * P);
    line(0.2 * P, 0, 0.12 * P, -0.5 * P);
  }
  noStroke();
  fill(C.wing);
  triangle(-0.55 * P, -1.05 * P, -1.3 * P, -1.5 * P, -1.18 * P, -0.7 * P);   // 꼬리
  fill(C.body);
  circle(0, -1.0 * P, 1.3 * P);       // 몸
  circle(0.6 * P, -1.68 * P, 0.8 * P); // 머리
  fill(C.beak);
  triangle(0.95 * P, -1.78 * P, 1.32 * P, -1.66 * P, 0.95 * P, -1.54 * P);   // 부리
  circle(0.7 * P, -1.76 * P, 0.14 * P);                                       // 눈
  push();
  translate(-0.05 * P, -1.0 * P);
  rotate(-flap);
  fill(C.wing);
  arc(0, 0, 0.9 * P, 0.9 * P, PI, TWO_PI, PIE);   // 날개 (반원)
  pop();
  pop();
}

function quadPt(a, b, c, t) {
  return (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
}

function updateAndDrawBirds(t) {
  const u = layout.u;
  for (const b of [...birds]) {
    const target = toScreen(b.nx, b.ny);
    const an = birdAnim[b.id];
    let x = target.x, y = target.y, flying = false, flap = 0, dir = b.dir || 1;

    if (an) {
      const k = (t - an.t0) / an.dur;
      if (k >= 1) {
        delete birdAnim[b.id];
        if (an.mode === 'leave') {
          birds = birds.filter(q => q.id !== b.id);
          saveBirds();
          refreshDrawer();
          continue;
        }
        birdFx[b.id] = t;
        for (let i = 0; i < 4; i++) spawnBit(x, y - u * 0.2, BIRD.colors.wing, { x: random(-2, 2), y: random(-3, -1) }, 900);
      } else {
        flying = true;
        const arrive = an.mode === 'arrive';
        const e = arrive ? 1 - Math.pow(1 - k, 3) : k * k * k;
        const P0 = arrive ? an.from : target, P2 = arrive ? target : an.from;
        const cx = (P0.x + P2.x) / 2, cy = Math.min(P0.y, P2.y) - height * 0.18;
        x = quadPt(P0.x, cx, P2.x, e);
        y = quadPt(P0.y, cy, P2.y, e);
        dir = P2.x >= P0.x ? 1 : -1;
        flap = Math.sin(t * 0.035) * 0.9 + 0.3;
      }
    }

    if (!flying) {
      // 앉은 뒤 · 톡 건드렸을 때: 제자리에서 날개만 짧게 푸드덕
      const t0 = birdFx[b.id] || -1e9;
      const a = t - t0;
      const env = a >= 0 && a < BIRD_FLAP_MS ? Math.min(1, a / 120, (BIRD_FLAP_MS - a) / 350) : 0;
      flap = Math.abs(Math.sin(a * 0.028)) * 0.75 * env;
      noStroke();
      fill(20, 40, 20, 50);
      ellipse(x, y + 1, u * 1.4, u * 0.3);
      if (isActive('bird', b.id) || (drag && drag.moved && drag.item === b)) focusRing(x, y, u);
    }
    drawBird(x, y, u, dir, flap, flying);
  }
}

const BIRD_FLAP_MS = 1400;   // 앉은 뒤 날개를 푸드덕하는 시간

function sendBirdIn(b) {
  const target = toScreen(b.nx, b.ny);
  const fromLeft = target.x > width / 2;
  const from = { x: fromLeft ? -60 : width + 60, y: random(-40, height * 0.2) };
  b.dir = target.x >= from.x ? 1 : -1;
  birdAnim[b.id] = { mode: 'arrive', t0: millis(), dur: 1600, from };
}

function sendBirdAway(b) {
  const from = { x: (b.dir || 1) > 0 ? width + 60 : -60, y: -60 };
  birdAnim[b.id] = { mode: 'leave', t0: millis(), dur: 1300, from };
}

//////////////////// matter.js: 떨어지는 씨앗 / 부스러기
function updateFallingSeeds() {
  for (let i = fallingSeeds.length - 1; i >= 0; i--) {
    const f = fallingSeeds[i];
    const target = toScreen(f.nx, f.ny);
    if (f.body.position.y >= target.y) {
      Composite.remove(engine.world, f.body);
      fallingSeeds.splice(i, 1);
      addPlant(f);
      landingBurst(target.x, target.y, f.type);
    }
  }
}

function drawFallingSeeds() {
  for (const f of fallingSeeds) {
    push();
    translate(f.body.position.x, f.body.position.y);
    rotate(f.body.angle);
    noStroke();
    fill('#efe2c8');
    ellipse(0, 0, 9, 6);
    pop();
  }
}

function landingBurst(x, y, type, n = 8) {
  const cols = ['#3f6339', '#86ad6f', SEEDS[type].accent];
  for (let k = 0; k < n; k++) spawnBit(x, y - 2, cols[k % cols.length], { x: random(-2.8, 2.8), y: random(-4.5, -1.5) }, 1000);
}

function spawnBit(x, y, col, vel, life) {
  if (particles.length > 160) return;
  const sz = random(3, 6);
  const body = Bodies.rectangle(x, y, sz, sz, {
    frictionAir: 0.05, restitution: 0.2, friction: 0.5,
    angle: random(TWO_PI),
    collisionFilter: { group: -1 },
  });
  if (vel) Body.setVelocity(body, vel);
  Body.setAngularVelocity(body, random(-0.12, 0.12));
  Composite.add(engine.world, body);
  particles.push({ body, col: color(col), born: millis(), life: life || random(4000, 7000), sz });
}

function updateParticles() {
  const now = millis();
  noStroke();
  for (let i = particles.length - 1; i >= 0; i--) {
    const pt = particles[i];
    const b = pt.body;
    const age = now - pt.born;
    if (age > pt.life || b.position.y > height + 60) {
      Composite.remove(engine.world, b);
      particles.splice(i, 1);
      continue;
    }
    const c = color(pt.col);
    c.setAlpha(map(age, pt.life - 600, pt.life, 255, 0, true));
    fill(c);
    circle(b.position.x, b.position.y, pt.sz * 0.85);
  }
}

//////////////////// 터치 / 마우스
function setupPointer(el) {
  el.style.touchAction = 'none';
  const pt = e => {
    const r = el.getBoundingClientRect();
    return toWorld(e.clientX - r.left, e.clientY - r.top);
  };
  el.addEventListener('pointerdown', e => {
    const p = pt(e);
    Object.assign(ptr, p, { type: e.pointerType });
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
    onDown(p.x, p.y);
  });
  el.addEventListener('pointermove', e => {
    const p = pt(e);
    Object.assign(ptr, p, { type: e.pointerType });
    onMove(p.x, p.y, e.buttons || e.pointerType !== 'mouse');
    if (e.pointerType === 'mouse') el.style.cursor = pending ? 'crosshair' : hitEntity(p.x, p.y) ? 'pointer' : 'default';
  });
  el.addEventListener('pointerup', () => onUp());
  el.addEventListener('pointercancel', () => onUp(true));
}

function canPlaceAt(x, y, self) {
  if (dist(x, y, PZ.cx, PZ.cy) > PZ.inner * 0.94 && !isOnEar(x, y)) return { ok: false, reason: '화단 안에 심어 주세요' };
  if (isOnEye(x, y)) return { ok: false, reason: '눈 위에는 심을 수 없어요' };
  const gap = layout.u * THEME.minGap;
  for (const o of [...plants.filter(q => !isWhole(q)), ...birds, ...fallingSeeds]) {
    if (o === self) continue;
    const s = toScreen(o.nx, o.ny);
    if (dist(x, y, s.x, s.y) < gap) return { ok: false, reason: '다른 꽃과 너무 가까워요' };
  }
  return { ok: true, ...toPizza(x, y) };
}

function hitEntity(mx, my) {
  const u = layout.u;
  const pad = (ptr.type === 'mouse' ? 0 : u * 0.4) / cam.s;
  for (const b of [...birds].reverse()) {
    if (birdAnim[b.id]) continue;
    const s = toScreen(b.nx, b.ny);
    if (Math.abs(mx - s.x) < u * 1.3 + pad && my < s.y + u * 0.4 + pad && my > s.y - u * 2.4 - pad) return { kind: 'bird', item: b };
  }
  const now = getNow(), t = millis();
  const spots = plants.filter(p => !isWhole(p)).sort((a, b) => b.ny - a.ny);
  for (const p of spots) {
    const st = getStatus(p, now);
    if (st.stage !== 'waiting' && wiltFade(st) <= 0) continue;
    const g = plantGeom(p, st, t, fxOf(p.id));
    const D = toppingSize(p);
    const hc = headCenter(g, D);
    if (st.stage === 'bloom' || (st.stage === 'growing' && g.grow >= 0.5) || g.wilt) {
      if (dist(mx, my, hc.x, hc.y) < D * 0.62 + pad) return { kind: 'plant', item: p };
    }
    if (distToSeg(mx, my, g.x, g.y, g.mx, g.my) < u * 0.8 + pad) return { kind: 'plant', item: p };
    if (dist(mx, my, g.x, g.y) < u * 0.9 + pad) return { kind: 'plant', item: p };
  }
  return null;
}

function onDown(x, y) {
  closeDrawer();

  // 토닝 물 주기
  if (pending && pending.kind === 'water') {
    water.last = null;
    waterAt(x, y);
    return;
  }
  // 씨앗 심기 / 새 부르기
  if (pending) {
    const r = canPlaceAt(x, y, null);
    if (!r.ok) { toast(r.reason); return; }
    placePending(r.nx, r.ny);
    return;
  }

  const hit = hitEntity(x, y);

  // 줌인 상태: 보고 있는 꽃에는 터치 동작, 다른 꽃은 그쪽으로 이동, 바깥은 원래대로
  if (active) {
    const it = activeItem();
    if (hit && hit.item === it) { startGesture(hit, x, y); return; }
    if (active.kind === 'plant' && it && !isWhole(it) && catOf(it) === 'resurf') {
      const g = toScreen(it.nx, it.ny);
      if (dist(x, y, g.x, g.y) < toppingSize(it) * 1.3) { startGesture({ kind: 'plant', item: it }, x, y); return; }
    }
    if (active.kind === 'plant' && it && !isWhole(it) && catOf(it) === 'spot') {
      const g = plantGeom(it, getStatus(it, getNow()), millis(), fxOf(it.id));
      const hc = headCenter(g, toppingSize(it));
      if (dist(x, y, hc.x, hc.y) < toppingSize(it) * 1.5) { startGesture({ kind: 'plant', item: it }, x, y); return; }
    }
    if (hit) { openInfo(hit.kind, hit.item); return; }
    closeInfo();
    return;
  }

  if (hit) {
    const s = toScreen(hit.item.nx, hit.item.ny);
    drag = { ...hit, startX: x, startY: y, offX: s.x - x, offY: s.y - y, origNx: hit.item.nx, origNy: hit.item.ny, moved: false };
  }
}

function onMove(x, y, down) {
  if (pending && pending.kind === 'water') {
    if (down) waterAt(x, y);
    return;
  }
  if (gesture) { moveGesture(x, y); return; }
  if (!drag) return;
  const th = ptr.type === 'mouse' ? 5 : 9;
  if (!drag.moved && dist(x, y, drag.startX, drag.startY) > th) drag.moved = true;
  if (drag.moved) {
    const q = toPizza(x + drag.offX, y + drag.offY);
    drag.item.nx = q.nx;
    drag.item.ny = q.ny;
  }
}

function onUp(cancel) {
  if (water) water.last = null;
  if (gesture) { endGesture(); return; }
  if (!drag) return;
  const d = drag;
  drag = null;
  if (!d.moved) {
    if (!cancel) openInfo(d.kind, d.item);   // 누르면 줌인
    return;
  }
  const s = toScreen(d.item.nx, d.item.ny);
  const r = canPlaceAt(s.x, s.y, d.item);
  if (cancel || !r.ok) {
    d.item.nx = d.origNx;
    d.item.ny = d.origNy;
    if (!cancel) toast(r.reason);
    return;
  }
  if (d.kind === 'plant') {
    landingBurst(s.x, s.y, d.item.type, 4);
    savePlants();
  } else {
    birdFx[d.item.id] = millis();
    saveBirds();
  }
}

//////////////////// 꽃마다 다른 터치 동작 (줌인했을 때)
function startGesture(hit, x, y) {
  const t = millis();
  if (hit.kind === 'bird') {
    birdFx[hit.item.id] = t;   // 톡: 날개 푸드덕
    return;
  }
  const p = hit.item;
  const st = getStatus(p, getNow());
  const fx = fxOf(p.id);
  gesture = { id: p.id, cat: catOf(p), x0: x, y0: y, lx: x, ly: y };
  if (st.stage !== 'bloom') {
    // 아직 꽃이 피지 않았거나 시든 꽃은 살짝 흔들리기만
    fx.pokeT = t; fx.pokeDir = x < toScreen(p.nx, p.ny).x ? 1 : -1;
    return;
  }
  switch (gesture.cat) {
    case 'muscle': fx.holding = true; fx.holdT = t; break;
    case 'volume': fx.pokeT = t; fx.pokeDir = x < toScreen(p.nx, p.ny).x ? 1 : -1; break;
    case 'lifting': fx.pull = 0; break;
    case 'booster':
      fx.drops.push({ dx: random(-0.3, 0.3) * toppingSize(p), t0: t });
      fx.rings.push({ t0: t });
      fx.fill = Math.min(1, fx.fill + 0.25);
      break;
    case 'resurf': fx.holes.push({ x, y, t0: t }); break;
    case 'spot': break;
  }
}

function moveGesture(x, y) {
  const p = plants.find(q => q.id === gesture.id);
  if (!p) { gesture = null; return; }
  const fx = fxOf(p.id);
  const t = millis();
  const u = layout.u;
  if (getStatus(p, getNow()).stage !== 'bloom') return;
  if (gesture.cat === 'lifting') {
    fx.pull = constrain((gesture.y0 - y) / (u * 6), 0, 1);   // 위로 끌어올린 만큼
  } else if (gesture.cat === 'resurf') {
    if (dist(x, y, gesture.lx, gesture.ly) > u * 0.35) {
      fx.holes.push({ x: x + random(-u, u) * 0.3, y: y + random(-u, u) * 0.3, t0: t });
      gesture.lx = x; gesture.ly = y;
    }
  } else if (gesture.cat === 'spot') {
    if (dist(x, y, gesture.lx, gesture.ly) > u * 0.2) {
      const g = plantGeom(p, getStatus(p, getNow()), t, fx);
      const hc = headCenter(g, toppingSize(p));
      fx.swipe = { x0: gesture.lx, y0: gesture.ly, x1: x, y1: y, t };
      for (const s of fx.specks || []) {
        if (!s.gone && distToSeg(hc.x + s.dx, hc.y + s.dy, gesture.lx, gesture.ly, x, y) < u * 0.8) s.gone = t;
      }
      gesture.lx = x; gesture.ly = y;
    }
  } else if (gesture.cat === 'muscle') {
    // 누른 채로 있기만 하면 돼요
  }
}

function endGesture() {
  const p = plants.find(q => q.id === gesture.id);
  if (p) {
    const fx = fxOf(p.id);
    if (gesture.cat === 'muscle') fx.holding = false;
    if (gesture.cat === 'lifting') { fx.pullV = fx.pull; fx.pullRel = millis(); fx.pull = 0; }
  }
  gesture = null;
}

function drawDragHint() {
  if (!drag || !drag.moved) return;
  const s = toScreen(drag.item.nx, drag.item.ny);
  if (canPlaceAt(s.x, s.y, drag.item).ok) return;
  stroke('#ff8a8a');
  strokeWeight(1.8);
  line(s.x - 6, s.y - 6, s.x + 6, s.y + 6);
  line(s.x + 6, s.y - 6, s.x - 6, s.y + 6);
}

function drawGhost() {
  if (!pending || ptr.type !== 'mouse' || pending.kind === 'water') return;
  const r = canPlaceAt(ptr.x, ptr.y, null);
  if (pending.kind === 'plant') {
    noStroke();
    fill(239, 226, 200, r.ok ? 240 : 90);
    ellipse(ptr.x, ptr.y, 10, 7);
  } else {
    drawingContext.globalAlpha = r.ok ? 0.85 : 0.35;
    drawBird(ptr.x, ptr.y, layout.u, 1, 0, false);
    drawingContext.globalAlpha = 1;
  }
}

function placePending(nx, ny) {
  const { x, y } = toScreen(nx, ny);
  if (pending.kind === 'plant') {
    const body = Bodies.circle(x, y - 160, 5, { isSensor: true, frictionAir: 0.01, collisionFilter: { mask: 0 } });
    Body.setAngularVelocity(body, random(-0.2, 0.2));
    Composite.add(engine.world, body);
    fallingSeeds.push({ body, type: pending.type, date: pending.date, info: pending.info, photos: pending.photos, nx, ny });
  } else {
    const b = { id: newId(), nx, ny, title: pending.title, memo: pending.memo, date: pending.date, photos: pending.photos || [], dir: 1, phase: Math.random() * TWO_PI };
    birds.push(b);
    sendBirdIn(b);
    saveBirds();
    refreshDrawer();
    toast('새가 날아오고 있어요');
  }
  pending.photos = null;   // 기록에 붙였으니 지우지 않아요
  stopHolding(true);
}

function addPlant(f) {
  const p = {
    id: newId(), type: f.type, date: f.date,
    nx: f.nx ?? 0, ny: f.ny ?? 0,
    phase: Math.random() * TWO_PI,
    info: f.info || {}, v: 3,
    photos: f.photos || [],
  };
  // 심는 순간 이미 피었거나 진 상태(지난 날짜 기록)는 느낌표 없이 시작해요
  const st0 = getStatus(p, parseDate(todayStr()));
  p.seen = { bloom: st0.stage === 'bloom' || st0.stage === 'wilted', wilted: st0.stage === 'wilted' };
  plants.push(p);
  if (!isWhole(p)) popAnims[p.id] = millis();
  fxOf(p.id).playT = millis();
  savePlants();
  refreshDrawer();
  const s = SEEDS[p.type];
  const st = getStatus(p, getNow());
  const green = CATS[s.cat].effect === 'green';
  let what = !isWhole(p) ? `${s.name} 씨앗을 심었어요` : green ? `${s.name} · 화단이 연두색으로 바뀌었어요` : `${s.name} · 화단 흙을 고르게 정리했어요`;
  if (isWhole(p) && st.stage === 'wilted') what = `${s.name} · 효과 기간이 이미 지난 날짜라 ${green ? '연두색으로 바뀌지' : '매끈해지지'} 않아요`;
  if (isWhole(p) && st.stage === 'waiting') what = `${s.name} · ${fmtDate(st.planted)}부터 ${green ? '연두색이 돼요' : '매끈해져요'}`;
  toast(st.downtime ? `${s.name} 다운타임 ${st.downtime.left}일 · ${s.downtime.note}` : what, st.downtime || isWhole(p) ? 3500 : 2200);
}

//////////////////// 입력 폼
const SEED_FIELDS = ['date', 'hospital', 'area', 'dose', 'cost', 'memo'];

function openSeedForm(mode, arg) {
  closeDrawer();
  const els = seedFormEl.elements;
  let type, values;
  if (mode === 'new') {
    type = arg;
    formState = { kind: 'plant', mode, type };
    values = { date: todayStr() };
  } else {
    type = arg.type;
    formState = { kind: 'plant', mode, type, id: arg.id };
    values = { date: arg.date, ...arg.info };
  }
  const s = SEEDS[type];
  const c = CATS[s.cat];
  document.getElementById('sfKicker').textContent = mode === 'new' ? `${c.full} · 새 씨앗` : '기록 수정';
  document.getElementById('sfSubmit').textContent = mode === 'new'
    ? (c.effect === 'green' ? '물 주러 가기' : c.effect === 'smooth' ? '기록하기' : '화단에 심으러 가기')
    : '저장';
  document.getElementById('sfGlyph').innerHTML = s.glyph;
  document.getElementById('sfTitle').textContent = s.name;
  document.getElementById('sfDesc').textContent = describeSeed(s) + (s.downtime ? ` · 다운타임 ${s.downtime.days}일` : '');
  for (const k of SEED_FIELDS) els[k].value = values[k] || '';
  // 처음엔 날짜와 사진만, 나머지는 '더 적기'를 누르면 펼쳐져요 (수정할 때 적어 둔 게 있으면 펼친 채로)
  const hasMore = mode !== 'new' && SEED_FIELDS.slice(1).some(k => values[k]);
  setMore(seedFormEl, hasMore);
  formPhotos = mode === 'new' ? [] : (arg.photos || []).map(ph => ({ ...ph, isNew: false }));
  removedPhotos = [];
  renderFormThumbs(seedFormEl);
  showForm(seedFormEl);
}

function openBirdForm(mode, arg) {
  closeDrawer();
  const els = birdFormEl.elements;
  if (mode === 'new') {
    formState = { kind: 'bird', mode };
    els.title.value = '';
    els.date.value = todayStr();
    els.memo.value = '';
    document.getElementById('bfKicker').textContent = '새 기록';
    document.getElementById('bfSubmit').textContent = '새 부르러 가기';
  } else {
    formState = { kind: 'bird', mode, id: arg.id };
    els.title.value = arg.title || '';
    els.date.value = arg.date || todayStr();
    els.memo.value = arg.memo || '';
    document.getElementById('bfKicker').textContent = '기록 수정';
    document.getElementById('bfSubmit').textContent = '저장';
  }
  document.getElementById('bfGlyph').innerHTML = BIRD.glyph;
  setMore(birdFormEl, mode !== 'new' && !!(arg && arg.memo));
  formPhotos = mode === 'new' ? [] : (arg.photos || []).map(ph => ({ ...ph, isNew: false }));
  removedPhotos = [];
  renderFormThumbs(birdFormEl);
  showForm(birdFormEl);
}

function showForm(formEl) {
  seedFormEl.classList.toggle('hidden', formEl !== seedFormEl);
  birdFormEl.classList.toggle('hidden', formEl !== birdFormEl);
  formLayerEl.classList.remove('hidden');
  formEl.scrollTop = 0;
}

function closeForm() {
  formState = null;
  formLayerEl.classList.add('hidden');
  // 저장하지 않고 닫으면 고른 사진은 버려요
  for (const ph of formPhotos) if (ph.isNew && ph.url) URL.revokeObjectURL(ph.url);
  formPhotos = [];
  removedPhotos = [];
}

function setMore(formEl, open) {
  formEl.querySelector('[data-more-box]').classList.toggle('hidden', !open);
  formEl.querySelector('[data-more]').classList.toggle('hidden', open);
}

async function onSeedSubmit(e) {
  e.preventDefault();
  if (!formState) return;
  const els = seedFormEl.elements;
  const date = els.date.value || todayStr();
  const info = {};
  for (const k of SEED_FIELDS.slice(1)) {
    const v = els[k].value.trim();
    if (v) info[k] = v;
  }

  if (formState.mode === 'new') {
    const type = formState.type;
    const photos = await commitFormPhotos(date);   // 처음 기록할 때 넣은 사진은 시술 날짜로
    closeForm();
    closeInfo();
    const eff = CATS[SEEDS[type].cat].effect;
    if (eff === 'green') {
      startWatering(type, date, info, photos);      // 부스터: 화단을 문질러 물 주기
    } else if (eff === 'smooth') {
      sweepT = millis();                            // 토닝: 갈퀴가 흙을 정리하며 그레인이 사라져요
      addPlant({ type, date, info, photos });
    } else {
      pending = { kind: 'plant', type, date, info, photos };
      startHolding();
    }
  } else {
    const p = plants.find(q => q.id === formState.id);
    const photos = await commitFormPhotos(todayStr());
    if (p) {
      p.date = date;
      p.info = info;
      p.photos = photos;
      savePlants();
      refreshDrawer();
      if (isActive('plant', p.id)) renderInfo();
      toast('기록을 고쳤어요');
    }
    closeForm();
  }
}

async function onBirdSubmit(e) {
  e.preventDefault();
  if (!formState) return;
  const els = birdFormEl.elements;
  const data = { title: els.title.value.trim(), date: els.date.value || todayStr(), memo: els.memo.value.trim() };
  if (!data.title) return;

  if (formState.mode === 'new') {
    const photos = await commitFormPhotos(data.date);
    closeForm();
    closeInfo();
    pending = { kind: 'bird', ...data, photos };
    startHolding();
  } else {
    const b = birds.find(q => q.id === formState.id);
    const photos = await commitFormPhotos(todayStr());
    if (b) {
      Object.assign(b, data, { photos });
      saveBirds();
      refreshDrawer();
      if (isActive('bird', b.id)) renderInfo();
      toast('기록을 고쳤어요');
    }
    closeForm();
  }
}

function startHolding() {
  const isPlant = pending.kind === 'plant';
  const glyph = isPlant ? SEEDS[pending.type].glyph : BIRD.glyph;
  const text = isPlant
    ? `<b>${SEEDS[pending.type].name}</b> · 화단에서 심을 곳을 눌러 주세요`
    : `<b>${escapeHtml(pending.title)}</b> · 신경 쓰이는 곳을 눌러 주세요`;
  holdEl.innerHTML = `<span class="glyph">${glyph}</span><span>${text}</span><button class="text-btn">취소</button>`;
  holdEl.querySelector('button').onclick = () => stopHolding(true);
  holdEl.classList.remove('hidden');
}

function stopHolding(clearPending) {
  if (clearPending && pending && pending.photos) deletePhotos(pending.photos);   // 심지 않고 취소하면 사진도 버려요
  if (clearPending) pending = null;
  holdEl.classList.add('hidden');
}

//////////////////// 사진 (처음 기록 + 경과 사진)
let formPhotos = [];      // 폼에서 고른 사진 [{ id, date, blob?, url?, isNew }]
let removedPhotos = [];   // 수정하면서 뺀 사진 (저장할 때 지워요)
let photoTarget = null;   // 고른 사진을 넣을 곳: { form } 또는 { kind, id }
let viewer = null;        // 크게 보는 중인 사진 { kind, id, i }

function findItem(kind, id) {
  return (kind === 'plant' ? plants : birds).find(q => q.id === id) || null;
}

function renderFormThumbs(formEl) {
  const box = formEl.querySelector('[data-thumbs]');
  box.innerHTML = formPhotos.map((ph, i) => `
    <div class="thumb"><img ${ph.url ? `src="${ph.url}"` : `data-pid="${ph.id}"`} alt=""><button type="button" class="t-x" data-i="${i}" aria-label="빼기">×</button></div>`).join('')
    + '<button type="button" class="thumb add" data-add>＋<small>사진</small></button>';
  fillPhotoImgs(box);
  box.querySelectorAll('.t-x').forEach(btn => {
    btn.onclick = () => {
      const ph = formPhotos.splice(Number(btn.dataset.i), 1)[0];
      if (ph.isNew) URL.revokeObjectURL(ph.url);
      else removedPhotos.push(ph);
      renderFormThumbs(formEl);
    };
  });
  box.querySelector('[data-add]').onclick = () => pickPhotos({ form: formEl });
}

function pickPhotos(target) {
  photoTarget = target;
  const input = document.getElementById('photoInput');
  input.value = '';
  input.click();
}

async function onPhotosPicked(files) {
  const target = photoTarget;
  photoTarget = null;
  if (!target || !files.length) return;
  let added = 0;
  for (const f of files) {
    let blob;
    try { blob = await compressImage(f); } catch (e) { toast(e.message); continue; }
    if (target.form) {
      formPhotos.push({ id: newId(), blob, url: URL.createObjectURL(blob), isNew: true });
      renderFormThumbs(target.form);
    } else {
      const item = findItem(target.kind, target.id);
      if (!item) continue;
      const id = newId();
      try { await PhotoDB.put(id, blob); } catch (e) { toast('사진을 저장하지 못했어요'); continue; }
      item.photos = [...(item.photos || []), { id, date: todayStr() }];
      added++;
    }
  }
  if (!target.form && added) {
    if (target.kind === 'plant') savePlants(); else saveBirds();
    if (isActive(target.kind, target.id)) renderInfo();
    toast(added > 1 ? `경과 사진 ${added}장을 추가했어요` : '경과 사진을 추가했어요');
  }
}

// 폼에서 고른 새 사진을 저장하고, 기록에 붙일 목록을 돌려줘요
async function commitFormPhotos(date) {
  const keep = formPhotos.filter(ph => !ph.isNew).map(ph => ({ id: ph.id, date: ph.date }));
  const added = [];
  for (const ph of formPhotos.filter(q => q.isNew)) {
    try {
      await PhotoDB.put(ph.id, ph.blob);
      photoURLCache[ph.id] = ph.url;   // 방금 만든 주소를 그대로 써요
      added.push({ id: ph.id, date });
    } catch (e) {
      toast('사진을 저장하지 못했어요');
    }
  }
  await deletePhotos(removedPhotos);
  formPhotos = [];
  removedPhotos = [];
  return [...keep, ...added];
}

// 정보 시트의 경과 사진 줄
function photoStrip(item, baseDate) {
  const list = item.photos || [];
  return `
    <p class="ph-label">경과 사진 ${list.length ? `<small>${list.length}장</small>` : ''}</p>
    <div class="thumbs strip">
      ${list.map((ph, i) => `<button class="thumb" data-view="${i}"><img data-pid="${ph.id}" alt=""><span>${dday(daysBetween(parseDate(baseDate), parseDate(ph.date)))}</span></button>`).join('')}
      <button class="thumb add" data-addphoto>＋<small>사진</small></button>
    </div>`;
}

function bindPhotoStrip(kind, item) {
  fillPhotoImgs(cardEl);
  cardEl.querySelectorAll('[data-view]').forEach(b => (b.onclick = () => openViewer(kind, item.id, Number(b.dataset.view))));
  cardEl.querySelector('[data-addphoto]').onclick = () => pickPhotos({ kind, id: item.id });
}

function openViewer(kind, id, i) {
  viewer = { kind, id, i };
  document.getElementById('viewer').classList.remove('hidden');
  showViewer();
}

function closeViewer() {
  viewer = null;
  document.getElementById('viewer').classList.add('hidden');
}

async function showViewer() {
  if (!viewer) return;
  const item = findItem(viewer.kind, viewer.id);
  const list = (item && item.photos) || [];
  if (!list.length) { closeViewer(); return; }
  viewer.i = (viewer.i + list.length) % list.length;
  const ph = list[viewer.i];
  const img = document.getElementById('viewerImg');
  img.src = (await photoURL(ph.id)) || '';
  document.getElementById('viewerCap').textContent =
    `${dday(daysBetween(parseDate(item.date), parseDate(ph.date)))} · ${fmtDate(parseDate(ph.date))} · ${viewer.i + 1}/${list.length}`;
}

function setupViewer() {
  const el = document.getElementById('viewer');
  el.querySelector('.v-close').onclick = closeViewer;
  el.querySelectorAll('.v-nav').forEach(b => (b.onclick = () => { viewer.i += Number(b.dataset.dir); showViewer(); }));
  el.querySelector('.v-del').onclick = async () => {
    const item = findItem(viewer.kind, viewer.id);
    if (!item || !confirm('이 사진을 지울까요?')) return;
    const ph = item.photos.splice(viewer.i, 1)[0];
    await deletePhotos([ph]);
    if (viewer.kind === 'plant') savePlants(); else saveBirds();
    if (isActive(viewer.kind, viewer.id)) renderInfo();
    showViewer();
  };
  // 옆으로 밀어서 넘기기
  let sx = null;
  const img = document.getElementById('viewerImg');
  img.addEventListener('pointerdown', e => { sx = e.clientX; });
  img.addEventListener('pointerup', e => {
    if (sx === null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 40) { viewer.i += dx < 0 ? 1 : -1; showViewer(); }
  });
  el.addEventListener('pointerdown', e => { if (e.target === el) closeViewer(); });
  document.getElementById('photoInput').addEventListener('change', e => onPhotosPicked([...e.target.files]));
}

//////////////////// 줌인 + 정보 시트
function isActive(kind, id) {
  return active && active.kind === kind && active.id === id;
}

function activeItem() {
  if (!active) return null;
  return (active.kind === 'plant' ? plants : birds).find(q => q.id === active.id) || null;
}

function openInfo(kind, item) {
  closeDrawer();
  if (kind === 'plant') markSeen(item);
  active = { kind, id: item.id };
  document.body.classList.add('zoomed');
  zoomTo(item);
  renderInfo();
  cardEl.classList.remove('hidden');
}

function closeInfo() {
  if (gesture) endGesture();
  active = null;
  cardEl.classList.add('hidden');
  document.body.classList.remove('zoomed');
  resetCam();
}

function renderInfo() {
  const item = activeItem();
  if (!item) { closeInfo(); return; }
  if (active.kind === 'plant') renderPlantInfo(item);
  else renderBirdInfo(item);
}

function renderPlantInfo(p) {
  const s = SEEDS[p.type];
  const c = CATS[s.cat];
  const st = getStatus(p, getNow());
  const info = p.info || {};
  const T = THEME.text;

  const doneNote = st.growDays === 0 ? T.grownInstant : T.grownAt(fmtDate(st.bloomAt));
  let growPct, growNote, keepPct, keepNote;
  if (st.stage === 'waiting') {
    growPct = 0; growNote = T.waitNote(fmtDate(st.planted));
    keepPct = 100; keepNote = T.keepPlan(st.keepDays, fmtDate(st.wiltAt));
  } else if (st.stage === 'growing') {
    growPct = Math.round(st.growth * 100); growNote = T.growTo(st.daysToBloom, fmtDate(st.bloomAt));
    keepPct = 100; keepNote = T.keepPlan(st.keepDays, fmtDate(st.wiltAt));
  } else if (st.stage === 'bloom') {
    growPct = 100; growNote = doneNote;
    keepPct = Math.round(st.keep * 100); keepNote = T.keepLeft(st.daysToWilt, fmtDate(st.wiltAt));
  } else {
    growPct = 100; growNote = doneNote;
    keepPct = 0; keepNote = T.keepDone(fmtDate(st.wiltAt));
  }

  const rows = [
    ['시술 날짜', `${fmtDate(st.planted)} · ${dday(st.elapsed)}`],
    ['병원', info.hospital], ['부위', info.area], ['용량 · 샷', info.dose], ['비용', info.cost],
  ].filter(r => r[1]);
  const dtHtml = st.downtime
    ? `<div class="downtime"><b>다운타임 ${st.downtime.left}일 남음</b><span>${s.downtime.note}</span></div>` : '';
  // 같은 시술을 여러 번 했으면 ‹ 1/2 › 로 넘겨 볼 수 있어요
  const sibs = c.mode === 'whole' ? activeWholeOf(s.cat, getNow()) : [];
  const si = sibs.findIndex(q => q.id === p.id);
  const navHtml = sibs.length > 1 && si >= 0
    ? `<div class="rec-nav"><button data-nav="-1" ${si === 0 ? 'disabled' : ''} aria-label="더 최근 기록">‹</button><span>${si + 1} / ${sibs.length}</span><button data-nav="1" ${si === sibs.length - 1 ? 'disabled' : ''} aria-label="이전 기록">›</button></div>` : '';
  const hint = c.mode === 'whole' ? '' : st.stage === 'bloom' ? c.touch : st.stage === 'wilted' ? '꽃이 졌어요 · 다시 심을 때예요' : '꽃이 피면 터치해서 놀아 볼 수 있어요';

  cardEl.innerHTML = `
    <div class="grab"></div>
    <button class="close" aria-label="닫기">×</button>
    <div class="ic-head">
      <span class="glyph">${s.glyph}</span>
      <div><span class="kicker">${c.full}</span><h3>${s.name}</h3><span class="state ${st.stage}">${THEME.stage[st.stage]}</span></div>
    </div>
    ${navHtml}
    ${hint ? `<p class="touch-hint">${hint}</p>` : ''}
    <dl class="ic-list">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${escapeHtml(v)}</dd></div>`).join('')}</dl>
    ${dtHtml}
    <div class="meter">
      <div class="meter-label"><span>${THEME.meter.grow}</span><span>${growPct}%</span></div>
      <div class="bar-line"><i style="width:${growPct}%"></i></div>
      <small>${growNote}</small>
    </div>
    <div class="meter keep" style="--c:${c.accent}">
      <div class="meter-label"><span>${THEME.meter.keep}</span><span>${keepPct}%</span></div>
      <div class="bar-line"><i style="width:${keepPct}%"></i></div>
      <small>${keepNote}</small>
    </div>
    ${info.memo ? `<p class="memo">${escapeHtml(info.memo)}</p>` : ''}
    ${photoStrip(p, p.date)}
    <div class="ic-actions">
      <button class="pill-btn" data-act="edit">수정</button>
      <button class="pill-btn danger" data-act="del">지우기</button>
    </div>`;
  bindPhotoStrip('plant', p);
  cardEl.querySelectorAll('[data-nav]').forEach(b => (b.onclick = () => {
    const q = sibs[si + Number(b.dataset.nav)];
    if (q) { active.id = q.id; markSeen(q); renderInfo(); }
  }));

  cardEl.querySelector('.close').onclick = closeInfo;
  cardEl.querySelector('[data-act="edit"]').onclick = () => openSeedForm('edit', p);
  cardEl.querySelector('[data-act="del"]').onclick = () => {
    if (!confirm(`${s.name} 기록을 지울까요? 삭제하면 되돌릴 수 없어요.`)) return;
    if (!isWhole(p)) {
      const { x, y } = toScreen(p.nx, p.ny);
      landingBurst(x, y, p.type, 12);
    }
    deletePhotos(p.photos);
    plants = plants.filter(q => q.id !== p.id);
    savePlants();
    closeInfo();
    refreshDrawer();
  };
}

function renderBirdInfo(b) {
  const elapsed = daysBetween(parseDate(b.date), getNow());
  cardEl.innerHTML = `
    <div class="grab"></div>
    <button class="close" aria-label="닫기">×</button>
    <div class="ic-head">
      <span class="glyph">${BIRD.glyph}</span>
      <div><span class="kicker">신경 쓰이는 곳</span><h3>${escapeHtml(b.title)}</h3></div>
    </div>
    <p class="touch-hint">새를 톡 건드리면 날개를 푸드덕해요</p>
    <dl class="ic-list"><div><dt>기록한 날</dt><dd>${fmtDate(parseDate(b.date))} · ${dday(elapsed)}</dd></div></dl>
    ${b.memo ? `<p class="memo">${escapeHtml(b.memo)}</p>` : ''}
    ${photoStrip(b, b.date)}
    <div class="ic-actions">
      <button class="pill-btn" data-act="edit">수정</button>
      <button class="pill-btn danger" data-act="del">날려 보내기</button>
    </div>`;
  bindPhotoStrip('bird', b);
  cardEl.querySelector('.close').onclick = closeInfo;
  cardEl.querySelector('[data-act="edit"]').onclick = () => openBirdForm('edit', b);
  cardEl.querySelector('[data-act="del"]').onclick = () => {
    if (!confirm(`'${b.title}' 기록을 지울까요? 새가 날아가요.`)) return;
    deletePhotos(b.photos);
    b.photos = [];
    closeInfo();
    sendBirdAway(b);
  };
}

function dday(n) {
  return n >= 0 ? `D+${n}` : `D${n}`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

//////////////////// 아래 메뉴 바 + 자세한 내용
const STATUS_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="#8b927f" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`;

function buildUI() {
  const bar = document.getElementById('bar');
  const btn = (key, glyph, label) => `<button class="bar-btn" data-key="${key}"><span class="glyph">${glyph}</span><b>${label}</b></button>`;
  bar.innerHTML =
    btn('bird', BIRD.glyph, '고민') +
    Object.entries(CATS).map(([k, c]) => btn(k, c.glyph, c.name)).join('') +
    btn('status', STATUS_ICON, '현황');

  bar.querySelectorAll('.bar-btn').forEach(b => {
    b.onclick = () => {
      const key = b.dataset.key;
      if (water) cancelWatering();
      if (pending) stopHolding(true);
      if (key === 'bird') { openBirdForm('new'); return; }
      if (drawerKey === key) closeDrawer();
      else openDrawer(key);
    };
  });

  seedFormEl.addEventListener('submit', onSeedSubmit);
  birdFormEl.addEventListener('submit', onBirdSubmit);
  for (const f of [seedFormEl, birdFormEl]) f.querySelector('[data-more]').onclick = () => setMore(f, true);
  setupViewer();
  document.querySelectorAll('[data-cancel]').forEach(b => (b.onclick = closeForm));
  formLayerEl.addEventListener('pointerdown', e => { if (e.target === formLayerEl) closeForm(); });
}

function openDrawer(key) {
  drawerKey = key;
  renderDrawer();
  drawerEl.classList.add('open');
  drawerEl.setAttribute('aria-hidden', 'false');
  document.querySelectorAll('.bar-btn').forEach(b => b.classList.toggle('on', b.dataset.key === key));
  drawerBody.scrollTop = 0;
}

function closeDrawer() {
  if (!drawerKey) return;
  drawerKey = null;
  drawerEl.classList.remove('open');
  drawerEl.setAttribute('aria-hidden', 'true');
  document.querySelectorAll('.bar-btn').forEach(b => b.classList.remove('on'));
}

function refreshDrawer() {
  if (drawerKey) renderDrawer();
}

function recItem(p, right) {
  const s = SEEDS[p.type];
  const where = p.info && p.info.area ? ` · ${escapeHtml(p.info.area)}` : '';
  return `<li data-kind="plant" data-id="${p.id}"><span class="glyph">${s.glyph}</span><span>${s.name}${where}</span><em>${right}</em></li>`;
}

function bindRecList() {
  drawerBody.querySelectorAll('li[data-id]').forEach(li => {
    li.onclick = () => {
      const kind = li.dataset.kind;
      const item = (kind === 'plant' ? plants : birds).find(q => q.id === li.dataset.id);
      if (item) openInfo(kind, item);
    };
  });
}

function renderDrawer() {
  const now = getNow();
  let html = '<button class="d-close" aria-label="닫기">×</button>';

  if (drawerKey === 'status') {
    const rows = plants.map(p => ({ p, st: getStatus(p, now) }));
    const count = k => rows.filter(r => r.st.stage === k).length;
    html += `
      <div class="d-head"><span class="glyph">${STATUS_ICON}</span><div><small>한눈에 보기</small><h2>화단 현황</h2></div></div>
      <p class="d-label">시간 여행</p>
      <input type="range" id="timeSlider" min="0" max="400" value="${dayOffset}">
      <div class="time-row"><span>${dayOffset ? `+${dayOffset}일 · ` : '오늘 · '}${fmtDate(now)}</span><button class="text-btn" id="timeReset">오늘로</button></div>
      <div class="stats">
        <div><b>${count('growing') + count('waiting')}</b><span>자라는 중</span></div>
        <div><b>${count('bloom')}</b><span>꽃 핌</span></div>
        <div><b>${count('wilted')}</b><span>시듦</span></div>
      </div>`;
    if (!plants.length && !birds.length) {
      html += '<p class="empty">아직 아무것도 없어요. 아래 메뉴에서 시술을 골라 보세요.</p>';
    } else {
      const alerts = rows.filter(r => alertOf(r.p, r.st));
      if (alerts.length) html += `<p class="d-label">확인할 꽃</p><ul class="rec-list">${alerts.map(r => recItem(r.p, alertOf(r.p, r.st) === 'bloom' ? '꽃이 피었어요 !' : '꽃이 졌어요 !')).join('')}</ul>`;
      const recovering = rows.filter(r => r.st.downtime);
      const blooming = rows.filter(r => r.st.stage === 'bloom').sort((a, b) => a.st.daysToWilt - b.st.daysToWilt);
      const growing = rows.filter(r => r.st.stage === 'growing').sort((a, b) => a.st.daysToBloom - b.st.daysToBloom);
      const wilted = rows.filter(r => r.st.stage === 'wilted');
      if (recovering.length) html += `<p class="d-label">다운타임 중</p><ul class="rec-list">${recovering.map(r => recItem(r.p, `${r.st.downtime.left}일 남음`)).join('')}</ul>`;
      if (blooming.length) html += `<p class="d-label">곧 질 꽃</p><ul class="rec-list">${blooming.map(r => recItem(r.p, `${r.st.daysToWilt}일 남음`)).join('')}</ul>`;
      if (growing.length) html += `<p class="d-label">곧 필 꽃</p><ul class="rec-list">${growing.map(r => recItem(r.p, `${r.st.daysToBloom}일 뒤`)).join('')}</ul>`;
      if (wilted.length) html += `<p class="d-label">다시 심을 때</p><ul class="rec-list">${wilted.map(r => recItem(r.p, fmtDate(r.st.wiltAt))).join('')}</ul>`;
      const perched = birds.filter(b => !birdAnim[b.id] || birdAnim[b.id].mode !== 'leave');
      if (perched.length) {
        html += `<p class="d-label">신경 쓰이는 곳</p><ul class="rec-list">${perched.map(b =>
          `<li data-kind="bird" data-id="${b.id}"><span class="glyph">${BIRD.glyph}</span><span>${escapeHtml(b.title)}</span><em>${fmtDate(parseDate(b.date))}</em></li>`).join('')}</ul>`;
      }
    }
    html += `<p class="d-label">정리</p><button class="pill-btn danger" id="resetBtn">화단 비우기</button>`;
    drawerBody.innerHTML = html;

    const slider = document.getElementById('timeSlider');
    slider.oninput = () => { dayOffset = Number(slider.value); onTimeChange(); };
    document.getElementById('timeReset').onclick = () => { dayOffset = 0; onTimeChange(); };
    document.getElementById('resetBtn').onclick = resetGarden;
  } else {
    const c = CATS[drawerKey];
    const list = Object.entries(SEEDS).filter(([, s]) => s.cat === drawerKey);
    html += `
      <div class="d-head"><span class="glyph">${c.glyph}</span><div><small>${c.name}</small><h2>${c.full}</h2></div></div>
      <p class="d-desc">${c.desc}</p>
      <p class="d-touch">${c.touch}</p>
      ${list.map(([id, s]) => `
        <button class="proc" data-type="${id}">
          <span class="glyph">${s.glyph}</span>
          <span><b>${s.name}</b><small>${describeSeed(s)}${s.downtime ? ` · <span class="dt">다운타임 ${s.downtime.days}일</span>` : ''}</small></span>
          <span class="plus">+</span>
        </button>`).join('')}`;
    const mine = plants.filter(p => SEEDS[p.type].cat === drawerKey)
      .map(p => ({ p, st: getStatus(p, now) }))
      .sort((a, b) => (a.p.date < b.p.date ? 1 : -1));
    html += `<p class="d-label">${c.effect === 'green' ? '물 준 기록' : c.mode === 'whole' ? '기록' : '심어 둔 기록'}</p>`;
    html += mine.length
      ? `<ul class="rec-list">${mine.map(r => recItem(r.p, `${fmtDate(r.st.planted)} · ${THEME.stage[r.st.stage]}`)).join('')}</ul>`
      : '<p class="empty">아직 기록이 없어요.</p>';
    drawerBody.innerHTML = html;
    drawerBody.querySelectorAll('.proc').forEach(b => (b.onclick = () => openSeedForm('new', b.dataset.type)));
  }

  drawerBody.querySelector('.d-close').onclick = closeDrawer;
  bindRecList();
}

function onTimeChange() {
  if (active) renderInfo();
  if (drawerKey === 'status') {
    const label = drawerBody.querySelector('.time-row span');
    const d = getNow();
    if (label) label.textContent = `${dayOffset ? `+${dayOffset}일 · ` : '오늘 · '}${fmtDate(d)}`;
    clearTimeout(onTimeChange.t);
    onTimeChange.t = setTimeout(() => {
      const keep = drawerBody.scrollTop;
      renderDrawer();
      drawerBody.scrollTop = keep;
    }, 250);
  }
}

function resetGarden() {
  if (!plants.length && !fallingSeeds.length) { toast('심어 둔 꽃이 없어요'); return; }
  if (!confirm(`시술 기록 ${plants.length}개를 모두 지울까요?\n삭제하면 되돌릴 수 없어요. (새는 그대로 남아요)`)) return;
  for (const p of plants) {
    if (isWhole(p)) continue;
    const { x, y } = toScreen(p.nx, p.ny);
    landingBurst(x, y, p.type, 8);
  }
  for (const f of fallingSeeds) Composite.remove(engine.world, f.body);
  for (const p of plants) deletePhotos(p.photos);
  fallingSeeds = [];
  plants = [];
  popAnims = {};
  if (active && active.kind === 'plant') closeInfo();
  savePlants();
  refreshDrawer();
  toast('화단을 비웠어요');
}

//////////////////// 공통
function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function getNow() {
  const d = parseDate(todayStr());
  d.setDate(d.getDate() + dayOffset);
  return d;
}

function toast(msg, ms = 1800) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

function savePlants() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(plants)); } catch (e) { /* 무시 */ }
}

function saveBirds() {
  try { localStorage.setItem(BIRD_KEY, JSON.stringify(birds)); } catch (e) { /* 무시 */ }
}

function loadData() {
  // 처음 열 때: 피자 버전 기록은 그대로, 예전 버전(화면 비율 좌표)은 화단 기준으로 옮겨 와요
  const fromScreen = o => {
    let nx = o.nx, ny = o.ny;
    if (o.v !== 2 && o.v !== 3 && o.type) { nx = 0.5 + nx * 0.32; ny = 0.5 + ny * 0.38; }
    const q = toPizza(nx * width, ny * height);
    const d = Math.hypot(q.nx, q.ny), lim = 0.72;
    if (d > lim) { q.nx *= lim / d; q.ny *= lim / d; }
    return { ...o, ...q, v: 3 };
  };
  const read = key => {
    try {
      const raw = localStorage.getItem(key);
      const arr = raw ? JSON.parse(raw) : null;
      return Array.isArray(arr) ? arr : null;
    } catch (e) {
      return null;
    }
  };

  let arr = read(STORAGE_KEY) || read(PIZZA_KEYS.plants);
  if (!arr) arr = (read(OLD_KEYS.plants) || []).map(fromScreen);
  plants = arr.filter(p => SEEDS[p.type] && p.date).map(p => ({ ...p, info: p.info || (p.note ? { memo: p.note } : {}) }));

  let barr = read(BIRD_KEY) || read(PIZZA_KEYS.birds);
  if (!barr) barr = (read(OLD_KEYS.birds) || []).map(fromScreen);
  birds = barr.filter(b => b.title && b.date);

  savePlants();
  saveBirds();
}
