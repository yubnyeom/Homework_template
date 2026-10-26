// =============================================
//  얼굴 화단 — 시술 설정
//  시술은 종류(CATS)별로 묶여 있고, 같은 종류는 같은 꽃과 같은 효과를 써요.
//  시술일 = 씨앗을 심는 날
//  bloom: 시술일부터 효과가 다 나타나기까지(꽃이 피기까지)
//  wilt : 시술일부터 효과가 끝나기까지(꽃이 지기까지)
//  downtime: 다운타임 기간과 안내 문구 (없으면 생략)
//  ※ 기간은 일반적인 참고값이에요. 병원 안내에 맞춰 자유롭게 고쳐 주세요.
// =============================================

// ---------- 시술 종류 = 꽃 ----------
// size: 꽃 크기, stem: 줄기 길이, touch: 꽃을 눌러 줌인했을 때 해 볼 수 있는 터치 동작 안내
const CATS = {
  muscle: {
    name: '보톡스', full: '근육 이완', topping: '', size: 1.25, stem: 2.4, stemColor: '#6c9a3f', touch: '꽃을 꾹 누르고 있으면 찡그려 봐요', mode: 'spot',
    desc: '근육을 풀어 주름을 펴요. 효과가 남아 있을수록 찡그려도 주름이 덜 생겨요.',
    accent: '#d9787f', crumbs: ['#d9787f', '#c06672', '#f2cdd0'],
    glyph: `<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="7" fill="#d9787f"/><circle cx="12" cy="19.5" r="2.8" fill="#d9787f"/></svg>`,
  },
  volume: {
    name: '필러', full: '볼륨 채우기', topping: '', size: 1.2, stem: 1.95, stemColor: '#5f9a4a', touch: '꽃을 톡 건드리면 말랑하게 출렁여요', mode: 'spot',
    desc: '꺼진 곳을 채워요. 시간이 지날수록 꽃송이가 조금씩 작아져요.',
    accent: '#c6b9de', crumbs: ['#fffaf0', '#e3d6f4', '#ffffff'],
    glyph: `<svg viewBox="0 0 24 24"><circle cx="7.6" cy="14" r="5.2" fill="#faf4ea" stroke="#d6cce6" stroke-width="1"/><circle cx="16.4" cy="14" r="5.2" fill="#faf4ea" stroke="#d6cce6" stroke-width="1"/><circle cx="12" cy="8.6" r="5.6" fill="#faf4ea" stroke="#d6cce6" stroke-width="1"/><circle cx="12" cy="12" r="1.8" fill="#c6b9de"/></svg>`,
  },
  lifting: {
    name: '리프팅', full: '리프팅', topping: '', size: 1.25, stem: 2.9, stemColor: '#7c8f3a', touch: '꽃을 위로 끌어올려 보세요', mode: 'spot',
    desc: '처진 곳을 끌어올려요. 효과가 남아 있을수록 더 높이 당겨 올라가요.',
    accent: '#a893c2', crumbs: ['#a893c2', '#d8cce6', '#8f78ab'],
    glyph: `<svg viewBox="0 0 24 24"><path fill="#a893c2" fill-rule="evenodd" d="M12 5a8 8 0 1 1 0 16 8 8 0 0 1 0-16Zm0 3.8a4.2 4.2 0 1 0 0 8.4 4.2 4.2 0 0 0 0-8.4Z"/><circle cx="12" cy="2.4" r="1.6" fill="#d8cce6"/></svg>`,
  },
  booster: {
    name: '부스터', full: '스킨부스터 (얼굴 전체)', topping: '', size: 1.15, stem: 2.1, stemColor: '#5f9a4a', touch: '화단을 손가락으로 문질러 물을 줘요', mode: 'whole', effect: 'green',
    desc: '피부 속을 촉촉하게 채워요. 얼굴을 문질러 물을 주면 화단이 바로 연두색으로 바뀌어요.',
    accent: '#e48d80', crumbs: ['#e48d80', '#f2c0b6', '#bfe8f0'],
    glyph: `<svg viewBox="0 0 24 24"><path d="M12 3.5a8.5 8.5 0 0 0 0 17Z" fill="#e48d80"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="#f2c0b6"/></svg>`,
  },
  resurf: {
    name: '재생', full: '재생 레이저', topping: '', size: 1.25, stem: 1.7, stemColor: '#4f9a55', touch: '꽃 주변 흙을 문질러 보세요', mode: 'spot',
    desc: '미세한 구멍을 내어 새 피부가 차오르게 해요. 흙에 생긴 작은 구멍이 금방 메워져요.',
    accent: '#6fbf73', crumbs: ['#6fbf73', '#a9dfa9', '#4e9f55'],
    glyph: `<svg viewBox="0 0 24 24"><rect x="8.6" y="2" width="6.8" height="20" rx="3.4" fill="#a8c9d6"/><rect x="8.6" y="10" width="6.8" height="2.4" fill="#dbe9ef"/></svg>`,
  },
  spot: {
    name: '잡티', full: '점 · 잡티 제거', topping: '', size: 1.1, stem: 1.85, stemColor: '#4f8a3a', touch: '꽃 주변을 쓱 그어 잡티를 지워 보세요', mode: 'spot',
    desc: '점과 잡티를 없애요. 효과가 줄수록 주변 잡티가 다시 진해져요.',
    accent: '#f6c445', crumbs: ['#efd283', '#fff3b8', '#f2b33d'],
    glyph: `<svg viewBox="0 0 24 24"><path d="M12 2c3 5 6.5 8.6 6.5 12.5a6.5 6.5 0 0 1-13 0C5.5 10.6 9 7 12 2Z" fill="#efd283"/></svg>`,
  },
  toning: {
    name: '토닝', full: '토닝 (얼굴 전체)', topping: '', size: 1, stem: 0, stemColor: '#6c9a3f', touch: '기록하면 갈퀴가 지나가며 화단 흙을 고르게 정리해요', mode: 'whole', effect: 'smooth',
    desc: '얼굴 전체의 톤을 맑게 해요. 기록하면 갈퀴로 흙을 골라 얼굴의 거친 결(그레인)이 사라져요.',
    accent: '#d9c98f', crumbs: ['#fff8dc', '#efe3b4', '#ffffff'],
    glyph: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#e9e1c8"/><path d="M3 12a9 9 0 0 0 18 0Z" fill="#f7f2e2"/><g fill="#b8ab86"><circle cx="8" cy="8" r=".9"/><circle cx="12" cy="6.5" r=".8"/><circle cx="15.5" cy="8.6" r=".9"/><circle cx="10" cy="10.2" r=".7"/></g><path d="M3 12h18" stroke="#efd283" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  },
};

// ---------- 시술 ----------
// 키(botox, filler, ulthera, toning)는 이전 기록과 이어지도록 그대로 두었어요
// 토닝은 모두 바로 나타나요(bloom 0)
const SEEDS = {
  // 근육 이완
  botox:     { cat: 'muscle', name: '주름 보톡스', bloom: { days: 14 }, wilt: { months: 4 } },
  jawbotox:  { cat: 'muscle', name: '사각턱 보톡스', bloom: { days: 28 }, wilt: { months: 6 } },
  skinbotox: { cat: 'muscle', name: '스킨 보톡스', bloom: { days: 7 }, wilt: { months: 3 } },
  // 볼륨
  filler:    { cat: 'volume', name: '필러', bloom: { days: 0 }, wilt: { months: 6 }, downtime: { days: 7, note: '멍이나 붓기가 있을 수 있어요' } },
  lipfiller: { cat: 'volume', name: '입술 필러', bloom: { days: 0 }, wilt: { months: 6 }, downtime: { days: 5, note: '입술이 붓거나 멍이 들 수 있어요' } },
  sculptra:  { cat: 'volume', name: '스컬트라', bloom: { months: 2 }, wilt: { months: 24 }, downtime: { days: 3, note: '붓기가 있을 수 있어요, 마사지를 해 주세요' } },
  // 리프팅
  ulthera:   { cat: 'lifting', name: '울쎄라', bloom: { months: 2 }, wilt: { months: 12 } },
  shrink:    { cat: 'lifting', name: '슈링크', bloom: { months: 1 }, wilt: { months: 4 } },
  thermage:  { cat: 'lifting', name: '써마지', bloom: { months: 2 }, wilt: { months: 12 } },
  inmode:    { cat: 'lifting', name: '인모드', bloom: { days: 14 }, wilt: { months: 3 } },
  thread:    { cat: 'lifting', name: '실리프팅', bloom: { days: 0 }, wilt: { months: 12 }, downtime: { days: 7, note: '당기는 느낌과 붓기가 있을 수 있어요' } },
  // 스킨부스터
  rejuran:   { cat: 'booster', name: '리쥬란', bloom: { months: 1 }, wilt: { months: 6 }, downtime: { days: 3, note: '주사 자국이 오돌토돌할 수 있어요' } },
  juvelook:  { cat: 'booster', name: '쥬베룩', bloom: { months: 2 }, wilt: { months: 12 }, downtime: { days: 3, note: '주사 자국이 남을 수 있어요' } },
  hydra:     { cat: 'booster', name: '물광 주사', bloom: { days: 7 }, wilt: { months: 2 }, downtime: { days: 2, note: '작은 멍이 들 수 있어요' } },
  exosome:   { cat: 'booster', name: '엑소좀', bloom: { days: 14 }, wilt: { months: 3 } },
  // 재생 레이저
  fraxel:    { cat: 'resurf', name: '프락셀', bloom: { months: 1 }, wilt: { months: 6 }, downtime: { days: 5, note: '붉고 각질이 일어날 수 있어요' } },
  co2:       { cat: 'resurf', name: 'CO2 레이저', bloom: { months: 1 }, wilt: { months: 6 }, downtime: { days: 7, note: '딱지가 생기니 떼지 마세요' } },
  picofrax:  { cat: 'resurf', name: '피코 프락셀', bloom: { days: 21 }, wilt: { months: 4 }, downtime: { days: 3, note: '살짝 붉을 수 있어요' } },
  // 점 · 잡티
  mole:      { cat: 'spot', name: '점 빼기', bloom: { days: 7 }, wilt: { months: 12 }, downtime: { days: 7, note: '딱지가 떨어질 때까지 습윤 밴드를 붙여 주세요' } },
  pigment:   { cat: 'spot', name: '잡티 레이저', bloom: { days: 14 }, wilt: { months: 6 }, downtime: { days: 5, note: '잡티가 진해졌다가 떨어져요' } },
  // 토닝 (얼굴 전체)
  toning:    { cat: 'toning', name: '레이저 토닝', bloom: { days: 0 }, wilt: { months: 1 } },
  picotone:  { cat: 'toning', name: '피코 토닝', bloom: { days: 0 }, wilt: { months: 1 } },
  ipl:       { cat: 'toning', name: 'IPL', bloom: { days: 0 }, wilt: { months: 2 } },
  genesis:   { cat: 'toning', name: '레이저 제네시스', bloom: { days: 0 }, wilt: { months: 1 } },
};
// 종류의 정보(토핑 크기, 색, 아이콘)를 각 시술에 이어 붙여요
for (const s of Object.values(SEEDS)) {
  const c = CATS[s.cat];
  s.size = c.size; s.stem = c.stem; s.accent = c.accent; s.crumbs = c.crumbs; s.glyph = c.glyph; s.sub = c.topping;
}

const THEME = {
  minGap: 1.3,
  stage: { waiting: '심기 전', growing: '자라는 중', bloom: '꽃 핌', wilted: '시듦' },
  meter: { grow: '성장', keep: '남은 유지' },
  text: {
    descInstant: '바로 피고',
    descAfter: d => `${d} 뒤 피고`,
    descEnd: d => `${d} 뒤 져요`,
    waitNote: d => `${d}에 심을 예정이에요`,
    growTo: (n, d) => `꽃이 피기까지 ${n}일 · ${d}`,
    grownAt: d => `${d}에 꽃이 피었어요`,
    grownInstant: '심자마자 꽃이 피었어요',
    keepPlan: (n, d) => `핀 뒤 ${n}일 동안 유지 · ${d}까지`,
    keepLeft: (n, d) => `${n}일 남음 · ${d}에 져요`,
    keepDone: d => `${d}에 졌어요 · 다시 심을 때예요`,
  },
};

// ---------- 신경 쓰이는 곳 (새) ----------
const BIRD = {
  colors: { body: '#efd283', wing: '#e69a7c', beak: '#3a2e34' },
  glyph: `<svg viewBox="0 0 32 32"><path d="M13 30l1-6M18 30l-.6-6" stroke="#3a2e34" stroke-width="1.2"/><path d="M9 17L2 13l1.4 9Z" fill="#e69a7c"/><circle cx="14" cy="18" r="7.5" fill="#efd283"/><circle cx="21" cy="9.5" r="4.6" fill="#efd283"/><path d="M25 9l4.5 1.3L25 11.6Z" fill="#3a2e34"/><path d="M8.5 18a5.5 5.5 0 0 1 11 0Z" fill="#e69a7c"/><circle cx="22.4" cy="8.6" r=".9" fill="#3a2e34"/></svg>`,
};

// ---------- 날짜 도우미 ----------
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function todayStr() {
  return toDateStr(new Date());
}

function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDuration(date, dur) {
  const d = new Date(date);
  if (dur.months) {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + dur.months);
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, lastDay));
  }
  if (dur.days) d.setDate(d.getDate() + dur.days);
  return d;
}

function daysBetween(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

function fmtDate(d) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDuration(dur) {
  if (dur.months) return dur.months % 12 === 0 ? `${dur.months / 12}년` : `${dur.months}개월`;
  if (!dur.days) return '바로';
  if (dur.days % 7 === 0) return `${dur.days / 7}주`;
  return `${dur.days}일`;
}

function describeSeed(seed) {
  if (CATS[seed.cat].effect === 'green') return `물 주면 바로 연두색이 되고 ${fmtDuration(seed.wilt)} 뒤 돌아와요`;
  if (CATS[seed.cat].effect === 'smooth') return `기록하면 바로 흙이 고르게 정리되고 ${fmtDuration(seed.wilt)} 뒤 결이 돌아와요`;
  const instant = !seed.bloom.days && !seed.bloom.months;
  const b = instant ? THEME.text.descInstant : THEME.text.descAfter(fmtDuration(seed.bloom));
  return `${b} ${THEME.text.descEnd(fmtDuration(seed.wilt))}`;
}

// ---------- 상태 계산 ----------
// stage: waiting(시술일 전) / growing(익는 중) / bloom(맛있음) / wilted(사라짐)
function getStatus(p, now) {
  const s = SEEDS[p.type];
  const planted = parseDate(p.date);
  const bloomAt = addDuration(planted, s.bloom);
  const wiltAt = addDuration(planted, s.wilt);
  const growDays = daysBetween(planted, bloomAt);
  const keepDays = daysBetween(bloomAt, wiltAt);
  const elapsed = daysBetween(planted, now);

  let stage;
  let growth = 1;
  let keep = 0;

  if (elapsed < 0) {
    stage = 'waiting'; growth = 0; keep = 1;
  } else if (now < bloomAt) {
    stage = 'growing'; growth = growDays > 0 ? elapsed / growDays : 1; keep = 1;
  } else if (now < wiltAt) {
    stage = 'bloom'; keep = keepDays > 0 ? daysBetween(now, wiltAt) / keepDays : 0;
  } else {
    stage = 'wilted'; keep = 0;
  }

  const dt = s.downtime;
  const downtime = dt && elapsed >= 0 && elapsed < dt.days
    ? { left: dt.days - elapsed, ratio: 1 - elapsed / dt.days }
    : null;

  return {
    planted, bloomAt, wiltAt, growDays, keepDays, elapsed, stage, growth, keep,
    daysToBloom: Math.max(0, daysBetween(now, bloomAt)),
    daysToWilt: Math.max(0, daysBetween(now, wiltAt)),
    daysSinceWilt: Math.max(0, daysBetween(wiltAt, now)),
    downtime,
  };
}
