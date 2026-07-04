/* ============================================================
   白嶺のマタギ ─ script.js
   豪雪の山村を30日間ヒグマから守り抜くサバイバル防衛ゲーム
   ============================================================ */
"use strict";

/* ---------- 定数定義 ---------- */

const SAVE_KEY = "hakurei-matagi-save-v1";
const WIN_DAY = 30;
const POP_BASE = 8;

const WEATHERS = {
  clear:  { name: "晴雪", icon: "☀", yieldMul: 1.0, burn: 0, cls: "" },
  storm:  { name: "吹雪", icon: "🌨", yieldMul: 0.6, burn: 3, cls: "w-storm" },
  freeze: { name: "厳寒", icon: "❄", yieldMul: 0.8, burn: 5, cls: "w-freeze" },
};

const BUILD_DEFS = [
  {
    id: "hearth", name: "囲炉裏小屋", icon: "🔥", max: 5,
    desc: "村の中心。火を絶やさぬ限り、人は生きられる。",
    effect: lv => `耐寒 +${lv * 8}％ ／ 最大人口 ${POP_BASE + lv * 2}人`,
    cost: lv => ({ wood: 20 + lv * 14, iron: lv * 2 }),
  },
  {
    id: "woodshed", name: "薪小屋", icon: "🪵", max: 5,
    desc: "薪の蓄えを守る。雪に湿らせては一冬もたない。",
    effect: lv => `薪の保管上限 ${60 + lv * 40} ／ 採集効率 +${lv * 10}％`,
    cost: lv => ({ wood: 12 + lv * 10 }),
  },
  {
    id: "trapworks", name: "罠工房", icon: "🪤", max: 5,
    desc: "くくり罠を仕掛ける工房。獣の道を読む者の仕事場。",
    effect: lv => lv === 0 ? "罠が作れるようになる" : `罠成功率 +${lv * 8}％ ／ 罠の上限 ${2 + lv * 2}`,
    cost: lv => ({ wood: 10 + lv * 8, iron: 3 + lv * 2 }),
  },
  {
    id: "watchtower", name: "見張り台", icon: "🔭", max: 5,
    desc: "山の稜線を見渡す櫓。黒い影は早く見つけるに限る。",
    effect: lv => lv === 0 ? "ヒグマ接近度が数字で分かる" : `襲撃被害 -${lv * 8}％ ／ 見張り効率 +${lv * 15}％`,
    cost: lv => ({ wood: 16 + lv * 10, iron: 2 + lv }),
  },
  {
    id: "healer", name: "薬師小屋", icon: "🌿", max: 5,
    desc: "薬草を煎じ、傷と心を癒やす。冬の村の拠り所。",
    effect: lv => `負傷回復率 +${lv * 15}％ ／ 士気の落ち込みを軽減`,
    cost: lv => ({ wood: 12 + lv * 9, herb: 3 + lv * 2 }),
  },
  {
    id: "fence", name: "防柵", icon: "🛡", max: 5,
    desc: "雪囲いを兼ねた木の柵。爪と牙を、まず此処で受ける。",
    effect: lv => `防衛力 +${lv * 8} ／ 襲撃時の村被害を軽減`,
    cost: lv => ({ wood: 14 + lv * 12, iron: 1 + lv }),
  },
];

const JOB_DEFS = [
  { id: "wood",  name: "薪集め",   icon: "🪵", desc: "薪 約+3／人（天候の影響あり）" },
  { id: "food",  name: "食料集め", icon: "🍙", desc: "食料 約+3／人（狩り・氷下魚漁）" },
  { id: "herb",  name: "薬草採集", icon: "🌿", desc: "薬草 約+1／人" },
  { id: "trap",  name: "罠作り",   icon: "🪤", desc: "2人で罠1つ（薪2＋鉄1）※罠工房が必要" },
  { id: "watch", name: "見張り",   icon: "👁", desc: "防衛力+4／人。異変の察知も早くなる" },
  { id: "repair",name: "修理",     icon: "🔨", desc: "村の体力+2／人（薪1／人を消費）" },
];

const SKILL_DEFS = [
  { id: "tracking", name: "足跡読み", icon: "🐾", desc: "ヒグマ接近度の変化が読めるようになる" },
  { id: "trapper",  name: "罠師",     icon: "🪤", desc: "罠の成功率が大きく上がる（+15％）" },
  { id: "intuition",name: "山勘",     icon: "🌀", desc: "探索で悪い出来事を避けやすくなる" },
  { id: "firekeep", name: "火守り",   icon: "🔥", desc: "寒さによる被害が半分になる" },
  { id: "shooter",  name: "熊撃ち",   icon: "🎯", desc: "襲撃時の防衛力+12。撃退時に毛皮を得やすい" },
];

const LEVEL_EXP = [0, 10, 24, 42, 64, 90]; // 累計経験値でのレベル閾値（最大Lv6）

const THREAT_STAGES = [
  { min: 0,  label: "痕跡のみ",     icon: "🐾", cls: "" },
  { min: 20, label: "遠くで目撃",   icon: "🐾", cls: "" },
  { min: 40, label: "倉庫を狙っている", icon: "🐻", cls: "t-mid" },
  { min: 60, label: "防柵の外をうろつく", icon: "🐻", cls: "t-mid" },
  { min: 80, label: "村を狙っている",  icon: "🐻", cls: "t-high" },
];

const FLAVOR_DAY = [
  "囲炉裏の煙が、まっすぐ空へのぼっていく。",
  "軒先の氷柱が、朝日にきらめいている。",
  "子どもらが雪像の熊を作って遊んでいる。",
  "遠くの尾根に、風の巻き上げる雪煙が見える。",
  "誰かが古い山唄を口ずさんでいる。",
  "雪を踏む音だけが、村に響いている。",
];

const FLAVOR_TENSE = [
  "犬たちが、山の方を向いて唸っている。",
  "夕べ、倉の裏に大きな足跡があったという。",
  "風に混じって、獣の匂いがする気がする。",
  "年寄りが「今年の山は荒れとる」と呟いた。",
  "鳥が一斉に飛び立った。何かがいる。",
];

/* ============================================================
   サウンドエンジン ─ Web Audio APIによる完全自前生成のBGM/SFX
   外部音源ファイルを一切使わず、発振器とノイズだけで
   和風・雪山の雰囲気を鳴らす。
   ============================================================ */

const SOUND_KEY = "hakurei-matagi-sound-v1";

const Sound = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let windSource = null, windGain = null;
  let enabled = true;
  try { const v = localStorage.getItem(SOUND_KEY); if (v !== null) enabled = v === "1"; } catch (e) { /* 保存不可環境は既定でON */ }

  let schedulerId = null;
  let nextNoteTime = 0;
  let noteIndex = 0;
  let currentPattern = null;
  let currentTheme = null;
  let stepSec = 0.85;
  const LOOKAHEAD = 0.12;
  const TICK_MS = 90;

  // 陰旋法寄りの五音音階。昼は明るめ、夜は暗め、山の主は最も低く重い。
  const SCALE = {
    calm:  [261.63, 293.66, 311.13, 392.00, 440.00],
    tense: [220.00, 233.08, 261.63, 293.66, 349.23],
    boss:  [174.61, 196.00, 207.65, 246.94, 277.18],
  };

  function note(freq, t, dur, type, gain, dest) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest || musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noiseBurst(t, dur, gain, dest) {
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filt).connect(g).connect(dest || sfxGain);
    src.start(t);
  }

  function setupWind() {
    const dur = 3;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    windSource = ctx.createBufferSource();
    windSource.buffer = buf;
    windSource.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 500;
    filt.Q.value = 0.5;
    windGain = ctx.createGain();
    windGain.gain.value = 0.012;
    windSource.connect(filt).connect(windGain).connect(musicGain);
    windSource.start();
  }

  function rampWind(v) {
    if (!windGain) return;
    const t = ctx.currentTime;
    windGain.gain.cancelScheduledValues(t);
    windGain.gain.setValueAtTime(windGain.gain.value, t);
    windGain.gain.linearRampToValueAtTime(v, t + 1.2);
  }

  /* ---- 曲パターン：各テーマは (時刻, ステップ番号) を受けて音を置く ---- */

  function dayPattern(t, idx) {
    const sc = SCALE.calm;
    const steps = [0, -1, 2, -1, 1, 3, -1, 4, 2, -1, 0, -1];
    const s = steps[idx % steps.length];
    if (s >= 0) note(sc[s], t, stepSec * 1.6, "triangle", 0.05);
    if (idx % 6 === 0) note(sc[0] / 2, t, stepSec * 6, "sine", 0.03);
  }

  function eveningPattern(t, idx) {
    const sc = SCALE.calm;
    const steps = [-1, 1, -1, 3, -1, 2, 0, -1];
    const s = steps[idx % steps.length];
    if (s >= 0) note(sc[s], t, stepSec * 1.4, "triangle", 0.045);
    if (idx % 4 === 0) note(sc[1] / 2, t, stepSec * 4, "sine", 0.032);
  }

  function nightCalmPattern(t, idx) {
    const sc = SCALE.tense;
    const steps = [-1, -1, 0, -1, -1, 2, -1, -1, -1, 1, -1, -1];
    const s = steps[idx % steps.length];
    if (s >= 0) note(sc[s], t, stepSec * 1.3, "sine", 0.038);
    if (idx % 8 === 0) note(sc[0] / 2, t, stepSec * 8, "sine", 0.04);
  }

  function nightTensePattern(t, idx) {
    const sc = SCALE.tense;
    const steps = [0, 1, 0, 2, 0, 1, 3, 2];
    note(sc[steps[idx % steps.length]], t, stepSec * 0.8, "sawtooth", 0.04);
    if (idx % 2 === 0) note(sc[0] / 2, t, stepSec * 1.6, "sine", 0.045);
  }

  function bossPattern(t, idx) {
    const sc = SCALE.boss;
    note(sc[0] / 2, t, 0.3, "sine", 0.08);
    noiseBurst(t, 0.18, 0.05);
    const stab = [0, 2, 3, 2][idx % 4];
    note(sc[stab], t + stepSec * 0.5, stepSec * 0.5, "sawtooth", 0.055);
  }

  function setTheme(name) {
    if (!ctx || currentTheme === name) return;
    currentTheme = name;
    noteIndex = 0;
    nextNoteTime = ctx.currentTime + 0.05;
    const table = {
      day:         { pattern: dayPattern,        tempo: 0.9,  wind: 0.01 },
      evening:     { pattern: eveningPattern,     tempo: 0.95, wind: 0.02 },
      "night-calm":{ pattern: nightCalmPattern,   tempo: 1.05, wind: 0.03 },
      "night-tense":{ pattern: nightTensePattern, tempo: 0.55, wind: 0.055 },
      boss:        { pattern: bossPattern,        tempo: 0.42, wind: 0.09 },
    };
    const cfg = table[name];
    if (!cfg) return;
    currentPattern = cfg.pattern;
    stepSec = cfg.tempo;
    rampWind(cfg.wind);
  }

  function tick() {
    if (!ctx || !currentPattern) return;
    while (nextNoteTime < ctx.currentTime + LOOKAHEAD) {
      currentPattern(nextNoteTime, noteIndex);
      noteIndex++;
      nextNoteTime += stepSec;
    }
  }

  function init() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = enabled ? 0.55 : 0;
      master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = 1; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 1; sfxGain.connect(master);
      setupWind();
      nextNoteTime = ctx.currentTime + 0.1;
      schedulerId = setInterval(tick, TICK_MS);
    } catch (e) { ctx = null; /* Web Audio非対応環境では静かに諦める */ }
  }

  function toggle() {
    enabled = !enabled;
    try { localStorage.setItem(SOUND_KEY, enabled ? "1" : "0"); } catch (e) { /* 無視 */ }
    if (ctx && master) {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(enabled ? 0.55 : 0, t + 0.15);
    }
    return enabled;
  }

  const SFX = {
    build(t) { [523.25, 659.25, 783.99].forEach((f, i) => note(f, t + i * 0.06, 0.35, "triangle", 0.09, sfxGain)); },
    trapcatch(t) { note(1046.5, t, 0.15, "sine", 0.08, sfxGain); note(1318.5, t + 0.09, 0.22, "sine", 0.08, sfxGain); },
    repel(t) { [392.0, 523.25, 659.25, 783.99].forEach((f, i) => note(f, t + i * 0.08, 0.32, "triangle", 0.09, sfxGain)); },
    hit(t) { note(80, t, 0.4, "sine", 0.15, sfxGain); noiseBurst(t, 0.25, 0.12, sfxGain); },
    victory(t) { [392.0, 493.88, 587.33, 783.99].forEach((f, i) => note(f, t + i * 0.14, 0.7, "triangle", 0.08, sfxGain)); },
    defeat(t) { [392.0, 349.23, 293.66, 220.0].forEach((f, i) => note(f, t + i * 0.24, 0.55, "sine", 0.07, sfxGain)); },
    bell(t) { note(880, t, 0.5, "sine", 0.045, sfxGain); },
  };

  function sfx(name) {
    if (!ctx || !SFX[name]) return;
    SFX[name](ctx.currentTime);
  }

  return { init, toggle, setTheme, sfx, isEnabled: () => enabled };
})();

/* ---------- 状態 ---------- */

let S = null;          // ゲーム状態
let busy = false;      // オーバーレイ表示中の操作ロック

function defaultState() {
  return {
    v: 1,
    day: 1,
    time: "day",              // day | evening | night
    weather: "clear",
    hp: 100,                  // 村の体力
    villagers: 8,
    injured: 0,
    morale: 70,
    cold: 20,
    threat: 5,                // ヒグマ接近度 0-100
    traps: 1,
    resources: { wood: 40, food: 30, herb: 5, fur: 2, iron: 8 },
    buildings: { hearth: 1, woodshed: 0, trapworks: 0, watchtower: 0, healer: 0, fence: 0 },
    jobs: { wood: 0, food: 0, herb: 0, trap: 0, watch: 0, repair: 0 },
    skills: [],
    exp: 0,
    level: 1,
    pendingSkill: false,
    eveningDone: false,       // 今日の夕方行動を終えたか
    prepped: false,           // 今夜の防衛準備ボーナス
    knownAttack: null,        // 足跡発見で判明した情報（文字列）
    attackHappened: false,    // 一度でも襲撃が起きたか（序盤の保証用）
    stats: { repelled: 0, furGained: 0, trapKills: 0, explored: 0, lost: 0 },
    log: [],
    over: false,              // 勝敗決定済み
    tutorial: 0,              // チュートリアル進行段階
    seenIntro: false,
  };
}

/* ---------- ユーティリティ ---------- */

const $ = sel => document.querySelector(sel);

/** クラスを一度外して強制リフローしてから付け直す。同じクラス名でもアニメーションを再生させる。 */
function bumpEl(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const chance = p => Math.random() < p;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function weighted(items) {
  // items: [{w: weight, ...}]
  const total = items.reduce((s, it) => s + it.w, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it.w;
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

function hasSkill(id) { return S.skills.includes(id); }
function maxPop() { return POP_BASE + S.buildings.hearth * 2; }
function woodCap() { return 60 + S.buildings.woodshed * 40; }
function trapCap() { return 2 + S.buildings.trapworks * 2; }
function healthy() { return Math.max(0, S.villagers - S.injured); }
function assigned() { return Object.values(S.jobs).reduce((a, b) => a + b, 0); }
function idle() { return healthy() - assigned(); }

function trapRate() {
  let r = 0.4 + S.buildings.trapworks * 0.08;
  if (hasSkill("trapper")) r += 0.15;
  return clamp(r, 0, 0.92);
}

function defensePower(prepBonus) {
  let d = Math.min(S.villagers, 6); // 村人総出の松明と鳴子
  d += S.buildings.fence * 8;
  d += S.jobs.watch * 4 * (1 + S.buildings.watchtower * 0.15);
  d += Math.floor(S.morale / 12);
  if (hasSkill("shooter")) d += 12;
  if (prepBonus && S.prepped) d += 10;
  return Math.round(d);
}

function addLog(text, cls) {
  S.log.unshift({ d: S.day, t: text, c: cls || "" });
  if (S.log.length > 80) S.log.length = 80;
}

function gainRes(key, amount) {
  const r = S.resources;
  r[key] = Math.max(0, r[key] + amount);
  if (key === "wood") r.wood = Math.min(r.wood, woodCap());
}

function gainExp(n, report) {
  S.exp += n;
  const next = LEVEL_EXP[S.level]; // 次レベルの閾値（Lv6が上限）
  if (S.level < 6 && next !== undefined && S.exp >= next) {
    S.level++;
    S.pendingSkill = S.skills.length < SKILL_DEFS.length;
    if (report) report.push({ t: `マタギの技が冴えてきた（Lv${S.level}）`, c: "good" });
    addLog(`マタギ技能がLv${S.level}に上がった。`, "good");
  }
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* 保存不可環境では無視 */ }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1 || typeof data.day !== "number") return null;
    // 欠損キーはデフォルトで補完
    const base = defaultState();
    for (const k of Object.keys(base)) if (data[k] === undefined) data[k] = base[k];
    return data;
  } catch (e) { return null; }
}

/* ---------- 描画 ---------- */

function threatStage(v) {
  let st = THREAT_STAGES[0];
  for (const s of THREAT_STAGES) if (v >= s.min) st = s;
  return st;
}

let prevDay = null;

function renderTop() {
  $("#dayInfo").textContent = `第${S.day}日`;
  if (prevDay !== null && prevDay !== S.day) { bumpEl($("#dayInfo"), "day-bump"); Sound.sfx("bell"); }
  prevDay = S.day;
  updateMusicState();

  const timeMap = { day: "☀ 昼", evening: "🌆 夕方", night: "🌙 夜" };
  $("#timeInfo").textContent = timeMap[S.time] || "☀ 昼";
  const w = WEATHERS[S.weather];
  const wEl = $("#weatherInfo");
  wEl.textContent = `${w.icon} ${w.name}`;
  wEl.className = `weather-info ${w.cls}`;
  document.body.dataset.time = S.time;
  document.body.dataset.weather = S.weather;

  const st = threatStage(S.threat);
  const banner = $("#threatBanner");
  banner.className = `threat-banner ${st.cls}`;
  $("#threatIcon").textContent = st.icon;
  let txt = `ヒグマの気配：${st.label}`;
  if (S.buildings.watchtower >= 1) txt += `（接近度 ${Math.round(S.threat)}）`;
  if (S.day === WIN_DAY) txt = "⚠ 今夜、山の主が来る";
  $("#threatText").textContent = txt;
}

/** 時間帯・接近度に応じてBGMのテーマを切り替える（山の主戦は別途明示的に切り替える）。 */
function updateMusicState() {
  if (S.over) return;
  if (S.time === "night") Sound.setTheme(S.threat >= 45 ? "night-tense" : "night-calm");
  else if (S.time === "evening") Sound.setTheme("evening");
  else Sound.setTheme("day");
}

let prevResources = null;

function renderResources() {
  const r = S.resources;
  const map = { wood: r.wood, food: r.food, herb: r.herb, fur: r.fur, iron: r.iron };
  for (const [k, v] of Object.entries(map)) {
    const el = $(`#res-${k}`);
    if (!el) continue;
    el.textContent = Math.floor(v);
    const parent = el.closest(".res");
    parent.classList.toggle("res-low", (k === "food" && v < S.villagers) || (k === "wood" && v < 6));
    if (prevResources) {
      const diff = Math.floor(v) - Math.floor(prevResources[k]);
      if (diff > 0) bumpEl(parent, "res-bump");
      else if (diff < 0) bumpEl(parent, "res-drop");
    }
  }
  prevResources = { ...map };
}

function bar(value, max, cls) {
  const pct = clamp(Math.round(value / max * 100), 0, 100);
  return `<div class="bar ${cls || ""}"><i style="width:${pct}%"></i></div>`;
}

function hpBarCls() { return S.hp <= 30 ? "b-danger" : S.hp <= 60 ? "b-warn" : ""; }
function moraleBarCls() { return S.morale <= 25 ? "b-danger" : S.morale <= 50 ? "b-warn" : ""; }

function renderVillage() {
  const el = $("#screen-village");
  const flavor = S.threat >= 55 ? pick(FLAVOR_TENSE) : pick(FLAVOR_DAY);
  const def = defensePower(true);
  const foodNeed = S.villagers;
  const w = WEATHERS[S.weather];
  const burnEst = Math.max(2, Math.round(3 + w.burn - S.buildings.hearth * 0.4));

  const todos = [
    { label: "村人を仕事に配置する", done: assigned() > 0 },
    { label: "夕方の行動を選ぶ（探索など）", done: S.eveningDone },
    { label: "「夜を迎える」で一日を終える", done: false },
  ];

  el.innerHTML = `
    <div class="village-flavor">${esc(flavor)}</div>
    <div class="panel">
      <h3>🏔 村の様子</h3>
      <div class="stat-grid">
        <div class="stat">村の体力 <b>${Math.round(S.hp)} / 100</b>${bar(S.hp, 100, hpBarCls())}</div>
        <div class="stat">士気 <b>${Math.round(S.morale)} / 100</b>${bar(S.morale, 100, moraleBarCls())}</div>
        <div class="stat">村人 <b>${S.villagers}人${S.injured > 0 ? `（負傷${S.injured}）` : ""}</b>
          <span style="font-size:11px;color:var(--ink-faint)">最大 ${maxPop()}人</span></div>
        <div class="stat">寒さ <b>${Math.round(S.cold)}</b>${bar(S.cold, 100, "b-cold")}</div>
        <div class="stat">今夜の防衛力 <b>${def}</b><span style="font-size:11px;color:var(--ink-faint)">柵・見張り・罠${S.traps}</span></div>
        <div class="stat">ヒグマ接近度 <b>${S.buildings.watchtower >= 1 || hasSkill("tracking") ? Math.round(S.threat) : threatStage(S.threat).label}</b>${S.buildings.watchtower >= 1 ? bar(S.threat, 100, "b-threat") : ""}</div>
      </div>
    </div>
    <div class="panel">
      <h3>📋 今日の目安</h3>
      <div class="todo-list">
        ${todos.map(t => `<div class="todo ${t.done ? "done" : ""}"><span class="todo-mark">${t.done ? "✔" : "▸"}</span>${t.label}</div>`).join("")}
      </div>
      <div style="font-size:11.5px;color:var(--ink-faint);margin-top:8px">
        今夜の消費見込み：食料 ${foodNeed} ／ 薪 約${burnEst}${S.knownAttack ? `<br>🐾 ${esc(S.knownAttack)}` : ""}
      </div>
    </div>
    <div class="panel">
      <h3>🏚 建設済みの施設</h3>
      <div style="font-size:12.5px;color:var(--ink-dim);line-height:2">
        ${BUILD_DEFS.filter(b => S.buildings[b.id] > 0).map(b => `${b.icon} ${b.name} Lv${S.buildings[b.id]}`).join("　") || "囲炉裏小屋だけの小さな村だ。"}
      </div>
    </div>`;
}

function costText(cost) {
  const icons = { wood: "🪵", food: "🍙", herb: "🌿", fur: "🟤", iron: "⚙️" };
  return Object.entries(cost).filter(([, v]) => v > 0)
    .map(([k, v]) => `<span class="${S.resources[k] < v ? "lack" : ""}">${icons[k]}${v}</span>`)
    .join(" ");
}

function canPay(cost) {
  return Object.entries(cost).every(([k, v]) => S.resources[k] >= v);
}

function payCost(cost) {
  for (const [k, v] of Object.entries(cost)) S.resources[k] -= v;
}

let justBuiltId = null;

function renderBuild() {
  const el = $("#screen-build");
  el.innerHTML = BUILD_DEFS.map(b => {
    const lv = S.buildings[b.id];
    const maxed = lv >= b.max;
    const cost = maxed ? null : b.cost(lv);
    const affordable = cost && canPay(cost);
    return `
      <div class="bcard ${b.id === justBuiltId ? "just-built" : ""}">
        <div class="b-icon">${b.icon}</div>
        <div class="b-main">
          <div><span class="b-name">${b.name}</span><span class="b-lv">${lv > 0 ? `Lv${lv}` : "未建設"}</span></div>
          <div class="b-desc">${b.desc}</div>
          <div class="b-effect">${lv > 0 ? "現在：" + b.effect(lv) : "効果：" + b.effect(1)}</div>
          ${maxed ? "" : `<div class="b-cost">費用 ${costText(cost)}</div>`}
        </div>
        <button class="btn ${affordable ? "btn-ember" : ""}" data-build="${b.id}" ${maxed || !affordable ? "disabled" : ""}>
          ${maxed ? "最大" : lv === 0 ? "建設" : "強化"}
        </button>
      </div>`;
  }).join("");
  justBuiltId = null;
}

let prevJobs = null;

function renderJobs() {
  const el = $("#screen-jobs");
  const free = idle();
  el.innerHTML = `
    <div class="panel" style="margin-bottom:10px">
      <div class="jobs-head">
        <span>働ける村人 <b>${healthy()}人</b>${S.injured > 0 ? `（負傷で${S.injured}人休み）` : ""}</span>
        <span>未配置 <b style="color:${free > 0 ? "var(--ember)" : "var(--ink)"}">${free}人</b></span>
      </div>
      <div style="font-size:11.5px;color:var(--ink-faint)">配置は毎晩の成果に反映される。翌日も引き継がれる。</div>
    </div>
    ${JOB_DEFS.map(j => {
      const n = S.jobs[j.id];
      const locked = j.id === "trap" && S.buildings.trapworks === 0;
      return `
      <div class="jrow" style="${locked ? "opacity:.55" : ""}">
        <div class="j-icon">${j.icon}</div>
        <div class="j-main">
          <div class="j-name">${j.name}</div>
          <div class="j-desc">${locked ? "🔒 罠工房を建てると解放" : j.desc}</div>
        </div>
        <div class="j-ctrl">
          <button class="jbtn" data-job="${j.id}" data-d="-1" ${n === 0 ? "disabled" : ""}>−</button>
          <span class="j-count" data-jc="${j.id}">${n}</span>
          <button class="jbtn" data-job="${j.id}" data-d="1" ${free === 0 || locked ? "disabled" : ""}>＋</button>
        </div>
      </div>`;
    }).join("")}`;
  if (prevJobs) {
    for (const j of JOB_DEFS) {
      if (S.jobs[j.id] !== prevJobs[j.id]) {
        bumpEl(el.querySelector(`.j-count[data-jc="${j.id}"]`), "bump");
      }
    }
  }
  prevJobs = { ...S.jobs };
}

function renderExplore() {
  const el = $("#screen-explore");
  const done = S.eveningDone;
  el.innerHTML = `
    <div class="panel">
      <h3>🌲 夕方の行動</h3>
      <div style="font-size:12.5px;color:var(--ink-dim)">
        日暮れまでに、ひとつだけ選べる。山は恵みも危険も抱えている。
      </div>
    </div>
    <button class="ecard" data-explore="mountain" ${done ? "disabled" : ""}>
      <div class="e-icon">🏔</div>
      <div>
        <div class="e-name">山へ入る</div>
        <div class="e-desc">痕跡や資源を探す。恵みは大きいが、危険もある。</div>
      </div>
    </button>
    <button class="ecard" data-explore="prep" ${done ? "disabled" : ""}>
      <div class="e-icon">🛡</div>
      <div>
        <div class="e-name">防衛準備</div>
        <div class="e-desc">柵を点検し、罠を確かめる。今夜の防衛力+10。</div>
      </div>
    </button>
    <button class="ecard" data-explore="rest" ${done ? "disabled" : ""}>
      <div class="e-icon">🍵</div>
      <div>
        <div class="e-name">囲炉裏で休む</div>
        <div class="e-desc">村人と語らう。士気+6、寒さも和らぐ。</div>
      </div>
    </button>
    <div class="explore-note">${done ? "今日はもう日が暮れかけている。「夜を迎える」で一日を終えよう。" : "選ぶと夕方になる。"}</div>`;
}

function renderLog() {
  const el = $("#screen-log");
  const expNext = S.level < 6 ? `${S.exp} / ${LEVEL_EXP[S.level]}` : "最大";
  el.innerHTML = `
    <div class="panel">
      <h3>🎯 マタギ ${esc(playerTitle())}（Lv${S.level}）</h3>
      <div style="font-size:12.5px;color:var(--ink-dim);margin-bottom:8px">経験 ${expNext}</div>
      <div class="skill-list">
        ${S.skills.length === 0 ? `<div style="font-size:12px;color:var(--ink-faint)">技能はまだない。経験を積み、レベルが上がると覚えられる。</div>` :
          S.skills.map(id => {
            const sk = SKILL_DEFS.find(s => s.id === id);
            return `<div class="skill-owned"><span>${sk.icon}</span><div><b style="font-size:13px">${sk.name}</b><div class="sk-desc">${sk.desc}</div></div></div>`;
          }).join("")}
      </div>
    </div>
    <div class="panel">
      <h3>📜 村の記録</h3>
      <div class="loglist">
        ${S.log.length === 0 ? `<div class="logline">まだ記録はない。</div>` :
          S.log.map(l => `<div class="logline log-${l.c || "plain"}"><span class="log-day">${l.d}日</span>${esc(l.t)}</div>`).join("")}
      </div>
    </div>
    <div class="panel">
      <h3>⚙️ その他</h3>
      <div style="display:flex;flex-direction:column;gap:8px">
        <button class="btn btn-wide" id="helpBtn">遊び方を見る</button>
        <button class="btn btn-wide" id="resetBtn" style="border-color:#7a3535;color:#eda0a0">はじめからやり直す</button>
      </div>
      <div style="font-size:11px;color:var(--ink-faint);margin-top:8px">進行は自動でこの端末に保存される。</div>
    </div>`;
  $("#helpBtn").addEventListener("click", showHelp);
  $("#resetBtn").addEventListener("click", confirmReset);
}

function playerTitle() {
  if (S.level >= 6) return "白嶺の主";
  if (S.level >= 5) return "熊撃ちの名手";
  if (S.level >= 4) return "山を知る者";
  if (S.level >= 3) return "一人前";
  if (S.level >= 2) return "若衆";
  return "見習い";
}

const RENDERERS = {
  village: renderVillage,
  build: renderBuild,
  jobs: renderJobs,
  explore: renderExplore,
  log: renderLog,
};

let currentTab = "village";

function renderAll() {
  renderTop();
  renderResources();
  RENDERERS[currentTab]();
  $("#endDayBtn").disabled = S.over || busy;
  renderHint();
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  document.querySelectorAll(".screen").forEach(s => s.classList.toggle("active", s.id === `screen-${tab}`));
  RENDERERS[tab]();
  renderHint();
}

/* ---------- チュートリアル ---------- */

const TUT_STEPS = [
  { text: "まずは下の「配置」タブを開き、村人を薪集めと食料集めに割り振ろう。", check: () => S.jobs.wood > 0 && S.jobs.food > 0 },
  { text: "いいぞ。「探索」タブで夕方の行動を選ぼう。最初は山へ入って様子を見るのがいい。", check: () => S.eveningDone },
  { text: "日が暮れる。「夜を迎える」を押して、一日を終えよう。", check: () => S.day >= 2 },
  { text: "朝になったら村の状態を確かめる。薪と食料を切らさず、「施設」タブで防柵や罠工房も整えていこう。", check: () => S.day >= 3 || S.buildings.fence > 0 || S.buildings.trapworks > 0 },
];

function renderHint() {
  const bar_ = $("#hintBar");
  if (S.over || S.tutorial >= TUT_STEPS.length) { bar_.classList.add("hidden"); return; }
  const step = TUT_STEPS[S.tutorial];
  if (step.check()) {
    S.tutorial++;
    save();
    renderHint();
    return;
  }
  $("#hintText").textContent = step.text;
  bar_.classList.remove("hidden");
}

/* ---------- モーダル / オーバーレイ ---------- */

function showOverlay(html, cls) {
  busy = true;
  const ov = $("#overlay");
  const card = $("#overlayCard");
  card.className = "";
  void card.offsetWidth; // 強制リフローで、連続ページでも入場アニメーションを毎回再生させる
  card.className = `overlay-card ${cls || ""}`;
  card.innerHTML = html;
  ov.classList.remove("hidden");
  card.scrollTop = 0;
  $("#endDayBtn").disabled = true;
}

function hideOverlay() {
  busy = false;
  $("#overlay").classList.add("hidden");
  $("#overlayCard").innerHTML = "";
  renderAll();
}

/** ページ列を順番に表示する。各ページ: {kicker,title,emoji,html,cls,btn} */
/** 獣が画面奥から迫り出す3D演出。爪痕が交差する一瞬の間合いを表現する。 */
function beastHtml(emoji) {
  const claws = [
    { r: -16, d: .48 },
    { r: 8, d: .56 },
    { r: -6, d: .64 },
  ].map(c => `<div class="claw" style="rotate:${c.r}deg;animation-delay:${c.d}s"></div>`).join("");
  return `<div class="ov-beast"><span class="beast-emoji">${emoji}</span>${claws}</div>`;
}

function playPages(pages, onDone) {
  let i = 0;
  const show = () => {
    const p = pages[i];
    const isLast = i === pages.length - 1;
    const btnLabel = p.btn || (isLast ? "閉じる" : "▼ 続ける");
    showOverlay(`
      ${p.kicker ? `<div class="ov-kicker">${esc(p.kicker)}</div>` : ""}
      ${p.title ? `<div class="ov-title">${esc(p.title)}</div>` : ""}
      ${p.emoji ? (p.beast ? beastHtml(p.emoji) : `<div class="ov-emoji">${p.emoji}</div>`) : ""}
      <div class="ov-body">${p.html || ""}</div>
      <div class="ov-actions"><button class="btn btn-ember btn-wide" id="ovNext">${esc(btnLabel)}</button></div>
    `, p.cls);
    $("#ovNext").addEventListener("click", () => {
      i++;
      if (i < pages.length) show();
      else { hideOverlay(); if (onDone) onDone(); }
    });
  };
  show();
}

function linesHtml(lines) {
  return `<div class="ov-lines">${lines.map(l =>
    `<div class="ov-line ${l.c ? "l-" + l.c : ""}">${esc(l.t)}</div>`).join("")}</div>`;
}

/* ---------- 行動 ---------- */

function doBuild(id) {
  if (busy || S.over) return;
  const def = BUILD_DEFS.find(b => b.id === id);
  const lv = S.buildings[id];
  if (lv >= def.max) return;
  const cost = def.cost(lv);
  if (!canPay(cost)) return;
  payCost(cost);
  S.buildings[id] = lv + 1;
  addLog(`${def.name}を${lv === 0 ? "建てた" : `Lv${lv + 1}に強化した`}。`, "good");
  justBuiltId = id;
  Sound.sfx("build");
  save();
  renderAll();
}

function doJob(id, delta) {
  if (busy || S.over) return;
  if (delta > 0) {
    if (idle() <= 0) return;
    if (id === "trap" && S.buildings.trapworks === 0) return;
    S.jobs[id]++;
  } else {
    if (S.jobs[id] <= 0) return;
    S.jobs[id]--;
  }
  save();
  renderAll();
}

function doEvening(kind) {
  if (busy || S.over || S.eveningDone) return;
  S.eveningDone = true;
  S.time = "evening";

  if (kind === "prep") {
    S.prepped = true;
    addLog("柵を点検し、罠を確かめた。今夜は備えがある。");
    save();
    playPages([{
      kicker: "夕方", title: "防衛準備", emoji: "🛡",
      html: `<p class="fl">縄を張り直し、杭を打ち直す。できることは全部やった。</p>
             ${linesHtml([{ t: "今夜の防衛力 +10", c: "good" }])}`,
    }]);
    return;
  }

  if (kind === "rest") {
    S.morale = clamp(S.morale + 6, 0, 100);
    S.cold = clamp(S.cold - 8, 0, 100);
    addLog("囲炉裏を囲んで休んだ。皆の顔が少し和らいだ。");
    save();
    playPages([{
      kicker: "夕方", title: "囲炉裏のひととき", emoji: "🍵",
      html: `<p class="fl">囲炉裏の火が、今夜だけは頼もしく見える。</p>
             ${linesHtml([{ t: "士気 +6", c: "good" }, { t: "寒さ -8", c: "good" }])}`,
    }]);
    return;
  }

  // 山探索
  S.stats.explored++;
  const result = rollExplore();
  gainExp(2);
  save();
  playPages(result.pages);
}

function rollExplore() {
  const intuition = hasSkill("intuition");
  const stormy = S.weather !== "clear";
  const events = [
    { id: "tracks", w: 16 },
    { id: "bearshelf", w: 10 },
    { id: "wood", w: 18 },
    { id: "herb", w: 14 },
    { id: "iron", w: 14 },
    { id: "blizzard", w: (stormy ? 16 : 8) * (intuition ? 0.4 : 1) },
    { id: "cub", w: (S.day >= 6 ? 8 : 3) * (intuition ? 0.5 : 1) },
    { id: "quiet", w: 10 },
  ];
  const ev = weighted(events);
  const L = [];
  let title = "", emoji = "", flavor = "", cls = "";

  switch (ev.id) {
    case "tracks": {
      title = "足跡を発見"; emoji = "🐾";
      flavor = "新しい足跡だ。雪の沈み方で、大きさも向かう先も分かる。";
      const soon = S.threat >= 55 || S.day >= WIN_DAY - 1;
      S.knownAttack = soon ? "足跡は村へ向かっていた。今夜あたり、来る。" : "足跡は山の奥へ。今夜はまだ余裕がありそうだ。";
      L.push({ t: "ヒグマの動きが読めた", c: "good" });
      L.push({ t: soon ? "今夜の襲撃に警戒せよ" : "しばらくは大きな動きはなさそうだ", c: soon ? "warn" : "good" });
      gainExp(2);
      break;
    }
    case "bearshelf": {
      title = "熊棚を発見"; emoji = "🌰";
      flavor = "楢の木に、枝を折り重ねた熊棚。ここは奴の縄張りだ。";
      const fur = rnd(1, 2), food = rnd(3, 6);
      gainRes("fur", fur); gainRes("food", food);
      S.threat = clamp(S.threat + 10, 0, 100);
      L.push({ t: `毛皮 +${fur}、食料 +${food}`, c: "good" });
      L.push({ t: "ヒグマ接近度 +10", c: "bad" });
      break;
    }
    case "wood": {
      title = "倒木を発見"; emoji = "🪵";
      flavor = "雪の重みで倒れた枯木。良い薪になる。";
      const n = rnd(6, 10);
      gainRes("wood", n);
      L.push({ t: `薪 +${n}`, c: "good" });
      break;
    }
    case "herb": {
      title = "薬草の群生"; emoji = "🌿";
      flavor = "岩陰の雪を払うと、青々とした葉が覗いた。";
      const n = rnd(3, 5);
      gainRes("herb", n);
      L.push({ t: `薬草 +${n}`, c: "good" });
      break;
    }
    case "iron": {
      title = "古い猟具を発見"; emoji = "⚙️";
      flavor = "昔の猟師が残した錆びた罠。鉄はまだ使える。";
      const n = rnd(3, 5);
      gainRes("iron", n);
      L.push({ t: `鉄くず +${n}`, c: "good" });
      break;
    }
    case "blizzard": {
      title = "吹雪に遭遇"; emoji = "🌨"; cls = "oc-attack";
      flavor = "視界が白く塗り潰される。木の幹にしがみつき、やり過ごした。";
      S.morale = clamp(S.morale - 8, 0, 100);
      S.cold = clamp(S.cold + 10, 0, 100);
      L.push({ t: "士気 -8", c: "bad" });
      L.push({ t: "寒さ +10", c: "bad" });
      if (!intuition && chance(0.35) && healthy() > 1) {
        S.injured++;
        L.push({ t: "同行の村人が凍傷を負った（負傷+1）", c: "bad" });
      }
      break;
    }
    case "cub": {
      title = "小熊の痕跡"; emoji = "🐻";
      flavor = "小さな足跡の脇に、大きな足跡が寄り添っている。母熊だ。急いで山を下りた。";
      S.threat = clamp(S.threat + 15, 0, 100);
      L.push({ t: "ヒグマ接近度 +15", c: "bad" });
      L.push({ t: "母熊は気が立っている", c: "warn" });
      gainExp(2);
      break;
    }
    default: {
      title = "静かな山"; emoji = "🌲";
      flavor = "雪を踏む自分の足音だけが響く。山は静かだった。";
      L.push({ t: "特に何も見つからなかった" });
      const n = rnd(1, 3);
      gainRes("wood", n);
      L.push({ t: `帰り道に枯枝を拾った（薪 +${n}）`, c: "good" });
    }
  }

  addLog(`山へ入った：${title}。`);
  return {
    pages: [{
      kicker: "夕方 ─ 山にて", title, emoji, cls,
      html: `<p class="fl">${esc(flavor)}</p>${linesHtml(L)}`,
    }],
  };
}

/* ---------- 一日の終わり ---------- */

function endDay() {
  if (busy || S.over) return;
  S.time = "night";
  renderTop();

  const R = [];           // 朝の報告行
  const w = WEATHERS[S.weather];

  /* --- 1. 仕事の成果 --- */
  const mul = w.yieldMul;
  const woodGain = Math.round(S.jobs.wood * 3 * mul * (1 + S.buildings.woodshed * 0.1));
  const foodGain = Math.round(S.jobs.food * 3 * mul);
  const herbGain = Math.round(S.jobs.herb * 1 * mul);
  if (woodGain) { gainRes("wood", woodGain); R.push({ t: `薪 +${woodGain}（薪集め）`, c: "good" }); }
  if (foodGain) { gainRes("food", foodGain); R.push({ t: `食料 +${foodGain}（食料集め）`, c: "good" }); }
  if (herbGain) { gainRes("herb", herbGain); R.push({ t: `薬草 +${herbGain}（薬草採集）`, c: "good" }); }

  // 罠作り：2人で1つ、薪2＋鉄1
  if (S.jobs.trap > 0 && S.buildings.trapworks > 0) {
    const makable = Math.floor(S.jobs.trap * (1 + S.buildings.trapworks * 0.1) / 2);
    let made = 0;
    while (made < makable && S.traps + made < trapCap() && S.resources.wood >= 2 && S.resources.iron >= 1) {
      S.resources.wood -= 2; S.resources.iron -= 1; made++;
    }
    if (made > 0) { S.traps += made; R.push({ t: `罠 +${made}（薪${made * 2}・鉄${made}を消費）`, c: "good" }); }
    else if (S.traps >= trapCap()) R.push({ t: "罠は上限まで仕掛けてある", c: "warn" });
    else R.push({ t: "罠の材料が足りない（薪2＋鉄1／個）", c: "warn" });
  }

  // 修理
  if (S.jobs.repair > 0) {
    const usable = Math.min(S.jobs.repair, Math.floor(S.resources.wood));
    if (usable > 0 && S.hp < 100) {
      S.resources.wood -= usable;
      const heal = usable * 2;
      S.hp = clamp(S.hp + heal, 0, 100);
      R.push({ t: `村の体力 +${heal}（修理・薪${usable}消費）`, c: "good" });
    }
  }

  /* --- 2. 消費 --- */
  const foodNeed = S.villagers;
  let starving = false;
  if (S.resources.food >= foodNeed) {
    S.resources.food -= foodNeed;
    S.morale = clamp(S.morale + 2, 0, 100);
  } else {
    starving = true;
    S.resources.food = 0;
    S.morale = clamp(S.morale - 12, 0, 100);
    S.hp = clamp(S.hp - 4, 0, 100);
    R.push({ t: "食料が足りない！ 士気 -12、村の体力 -4", c: "bad" });
  }

  const burn = Math.max(2, Math.round(3 + w.burn - S.buildings.hearth * 0.4));
  const coldGuard = hasSkill("firekeep") ? 0.5 : 1;
  if (S.resources.wood >= burn) {
    S.resources.wood -= burn;
    S.cold = clamp(S.cold - 6 + w.burn, 5, 100);
  } else {
    const shortage = burn - Math.floor(S.resources.wood);
    S.resources.wood = 0;
    S.cold = clamp(S.cold + 14 * coldGuard, 0, 100);
    S.morale = clamp(S.morale - 6 * coldGuard, 0, 100);
    S.hp = clamp(S.hp - shortage * 1.5 * coldGuard, 0, 100);
    R.push({ t: `薪が尽きた！ 寒さが増し、村が凍える（体力 -${Math.round(shortage * 1.5 * coldGuard)}）`, c: "bad" });
  }

  // 寒さのペナルティ
  if (S.cold >= 60) {
    const dmg = Math.round((S.cold - 50) / 10 * 2 * coldGuard);
    S.hp = clamp(S.hp - dmg, 0, 100);
    S.morale = clamp(S.morale - 2 * coldGuard, 0, 100);
    R.push({ t: `厳しい寒さが村を蝕む（体力 -${dmg}）`, c: "bad" });
    if (S.cold >= 80 && chance(0.3 * coldGuard) && healthy() > 0) {
      S.injured++;
      R.push({ t: "村人が凍傷で倒れた（負傷 +1）", c: "bad" });
    }
  }

  /* --- 3. 回復 --- */
  if (S.injured > 0) {
    const healer = S.buildings.healer;
    let healed = 0;
    for (let i = 0; i < S.injured; i++) {
      if (S.resources.herb >= 1 && chance(0.35 + healer * 0.15)) {
        S.resources.herb -= 1; healed++;
      }
    }
    if (healed > 0) {
      S.injured -= healed;
      R.push({ t: `負傷者${healed}人が回復した（薬草${healed}消費）`, c: "good" });
    }
    const moralePenalty = Math.max(0, S.injured - healer);
    if (moralePenalty > 0) S.morale = clamp(S.morale - moralePenalty, 0, 100);
  }

  /* --- 4. 接近度の自然増加 --- */
  const growth = 3 + Math.floor(S.day / 7) + (starving ? 2 : 0);
  S.threat = clamp(S.threat + growth, 0, 100);

  /* --- 5. 夜イベント --- */
  const night = resolveNight(R);

  /* --- 6. 日送り --- */
  const endedDay = S.day;
  const isFinal = endedDay >= WIN_DAY;
  if (!isFinal) {
    S.day++;
    S.weather = rollWeather(S.day);
    S.eveningDone = false;
    S.prepped = false;
    S.knownAttack = null;
    S.time = "day";
    // 仕事人数が働ける人数を超えていたら削る
    let over = assigned() - healthy();
    for (const j of JOB_DEFS.map(x => x.id)) {
      while (over > 0 && S.jobs[j] > 0) { S.jobs[j]--; over--; }
    }
    // 新しい村人（士気が高く空きがあれば時々）
    if (S.morale >= 60 && S.villagers < maxPop() && chance(0.18)) {
      S.villagers++;
      R.push({ t: "雪山で遭難していた旅人が村に加わった（村人 +1）", c: "good" });
      addLog("行き倒れの旅人を助けた。新しい仲間だ。", "good");
    }
  }

  /* --- 7. 勝敗判定 --- */
  let ending = null;
  if (S.hp <= 0) ending = "hp";
  else if (S.villagers <= 0) ending = "pop";
  else if (S.morale <= 0) ending = "morale";
  else if (isFinal) ending = "win";

  if (ending) S.over = true;
  save();

  /* --- 8. 演出ページを組み立て --- */
  const pages = [...night.pages];
  if (ending === "win") pages.push(...victoryPages());
  else if (ending) pages.push(...defeatPages(ending));
  else pages.push(morningPage(R, endedDay));

  playPages(pages, () => {
    if (S.over) { newGame(); return; }
    if (S.pendingSkill) showSkillChoice();
    else renderAll();
  });
}

function rollWeather(day) {
  let pClear = 0.62, pStorm = 0.23;
  if (day >= 10) { pClear = 0.48; pStorm = 0.32; }
  if (day >= 20) { pClear = 0.38; pStorm = 0.38; }
  const r = Math.random();
  if (r < pClear) return "clear";
  if (r < pClear + pStorm) return "storm";
  return "freeze";
}

function morningPage(R, endedDay) {
  const w = WEATHERS[S.weather];
  const flavorPool = S.threat >= 55 ? FLAVOR_TENSE : FLAVOR_DAY;
  return {
    kicker: `第${endedDay}日の夜が明けた`,
    title: `第${S.day}日の朝`,
    emoji: w.icon,
    html: `
      <p class="fl">${esc(pick(flavorPool))}</p>
      <p style="text-align:center;font-size:12.5px">今日の天候：<b>${w.icon} ${w.name}</b>${w.yieldMul < 1 ? `（採集効率 ${Math.round(w.yieldMul * 100)}％）` : ""}</p>
      ${R.length ? linesHtml(R) : ""}
      <p style="text-align:center;color:var(--ink-faint);font-size:12px;margin-top:8px">残り ${WIN_DAY - S.day + 1}日 ─ 春はまだ遠い</p>`,
    btn: "村へ戻る",
  };
}

/* ---------- 夜イベント ---------- */

function resolveNight(R) {
  const isFinal = S.day >= WIN_DAY;
  if (isFinal) return bossNight(R);

  // 襲撃確率：接近度と日数で決まる。序盤（4日目以降）に一度は軽い襲撃を保証。
  let atkChance = S.threat < 15 ? 0.02 : clamp((S.threat - 15) / 100 * 0.9, 0, 0.75);
  if (S.day <= 3) atkChance = 0;
  const forceFirst = !S.attackHappened && S.day >= 5 && (S.day >= 7 || chance(0.45));

  if (forceFirst || chance(atkChance)) return bearAttack(R, false);

  // 襲撃以外の夜イベント
  const ev = weighted([
    { id: "quiet", w: 30 },
    { id: "storm", w: S.weather === "storm" ? 22 : 10 },
    { id: "noise", w: S.threat >= 35 ? 16 : 6 },
    { id: "trapcatch", w: S.traps > 0 ? 10 : 0 },
    { id: "raid", w: S.threat >= 40 ? 12 : 0 },
    { id: "injury", w: 6 },
  ]);

  const L = [];
  let page;

  switch (ev.id) {
    case "storm": {
      const guard = hasSkill("firekeep") ? 0.5 : 1;
      const dmg = Math.round(rnd(3, 6) * guard * (1 - S.buildings.hearth * 0.08));
      S.hp = clamp(S.hp - dmg, 0, 100);
      S.morale = clamp(S.morale - 3, 0, 100);
      S.cold = clamp(S.cold + 8, 0, 100);
      L.push({ t: `村の体力 -${dmg}`, c: "bad" });
      L.push({ t: "士気 -3 ／ 寒さ +8", c: "bad" });
      addLog("夜通し吹雪が屋根を叩いた。", "danger");
      page = {
        kicker: "夜", title: "吹雪の夜", emoji: "🌨", cls: "oc-attack",
        html: `<p class="fl">風が戸板を軋ませる。誰も眠れぬまま、朝を待った。</p>${linesHtml(L)}`,
      };
      break;
    }
    case "noise": {
      const watchers = S.jobs.watch;
      if (watchers > 0 || S.buildings.watchtower > 0) {
        S.threat = clamp(S.threat - 5, 0, 100);
        gainExp(1);
        L.push({ t: "見張りが松明を掲げ、影は山へ退いた", c: "good" });
        L.push({ t: "ヒグマ接近度 -5", c: "good" });
        addLog("見張りが黒い影を追い払った。", "good");
      } else {
        S.threat = clamp(S.threat + 8, 0, 100);
        S.morale = clamp(S.morale - 3, 0, 100);
        L.push({ t: "誰も気づかなかった。倉の周りに足跡が残っていた", c: "bad" });
        L.push({ t: "ヒグマ接近度 +8 ／ 士気 -3", c: "bad" });
        addLog("夜のうちに、何かが村の際まで来ていた。", "danger");
      }
      page = {
        kicker: "夜", title: "闇の中の気配", emoji: "👁",
        html: `<p class="fl">雪の向こうで、枝の折れる音がした。</p>${linesHtml(L)}`,
      };
      break;
    }
    case "trapcatch": {
      S.traps--;
      const fur = rnd(1, 2), food = rnd(2, 5);
      gainRes("fur", fur); gainRes("food", food);
      S.stats.trapKills++;
      gainExp(2, R);
      L.push({ t: `毛皮 +${fur} ／ 食料 +${food}`, c: "good" });
      L.push({ t: "罠を1つ消費した", c: "warn" });
      addLog("罠に獲物がかかっていた。", "good");
      Sound.sfx("trapcatch");
      page = {
        kicker: "夜明け前", title: "罠が仕事をした", emoji: "🪤", cls: "oc-good",
        html: `<p class="fl">罠に荒い毛が絡んでいた。獣は雪の上に伸びている。</p>${linesHtml(L)}`,
      };
      break;
    }
    case "raid": {
      // 倉庫荒らし：軽い被害
      const foodLoss = Math.min(Math.floor(S.resources.food), rnd(4, 8));
      S.resources.food -= foodLoss;
      S.threat = clamp(S.threat - 10, 0, 100);
      S.morale = clamp(S.morale - 4, 0, 100);
      L.push({ t: `食料 -${foodLoss}`, c: "bad" });
      L.push({ t: "士気 -4 ／ 満足したのか、接近度 -10", c: "warn" });
      addLog("夜のうちに倉が荒らされた。", "danger");
      Sound.setTheme("night-tense");
      Sound.sfx("hit");
      page = {
        kicker: "夜", title: "倉庫荒らし", emoji: "🐻", cls: "oc-attack", beast: true,
        html: `<p class="fl">朝、倉の戸が裂かれていた。太い爪の痕が三本、深く。</p>${linesHtml(L)}`,
      };
      break;
    }
    case "injury": {
      if (healthy() > 1) {
        S.injured++;
        L.push({ t: "負傷 +1（薬草があれば朝に回復判定）", c: "bad" });
        addLog("村人が屋根の雪下ろしで足を痛めた。", "danger");
      } else {
        L.push({ t: "大事には至らなかった", c: "good" });
      }
      page = {
        kicker: "夜", title: "小さな事故", emoji: "🤕",
        html: `<p class="fl">屋根の雪が、鈍い音を立てて落ちた。下に人がいた。</p>${linesHtml(L)}`,
      };
      break;
    }
    default: {
      S.morale = clamp(S.morale + 2, 0, 100);
      L.push({ t: "士気 +2", c: "good" });
      addLog("静かな夜だった。");
      page = {
        kicker: "夜", title: "静かな夜", emoji: "🌙",
        html: `<p class="fl">雪あかりが青く、村を包んでいる。何事もない夜だった。</p>${linesHtml(L)}`,
      };
    }
  }

  return { pages: [page] };
}

/* ---------- ヒグマ襲撃 ---------- */

function bearAttack(R, isBoss) {
  S.attackHappened = true;
  const pages = [];
  const L = [];

  // 襲撃力
  let power = isBoss
    ? 88 + Math.round(S.threat * 0.25)
    : 14 + Math.round(S.day * 1.6) + Math.round(S.threat * 0.3);

  const approach = isBoss
    ? "地響きのような唸り。松明の火が、一斉に揺れた。"
    : pick([
      "犬が狂ったように吠えている。柵の外に、大きな影。",
      "見張りが叫んだ。「来たぞ！」",
      "雪を蹴散らす音が、まっすぐ村へ向かってくる。",
    ]);

  Sound.setTheme(isBoss ? "boss" : "night-tense");
  pages.push({
    kicker: isBoss ? "最後の夜" : "夜", title: isBoss ? "山の主" : "ヒグマ襲撃",
    emoji: isBoss ? "🐻‍❄️" : "🐻", cls: isBoss ? "oc-boss" : "oc-attack", beast: true,
    html: `<p class="fl">${esc(approach)}</p><p style="text-align:center;color:var(--ink-faint);font-size:12px">襲撃の勢い：${power}</p>`,
    btn: "迎え撃つ",
  });

  // --- 罠の判定 ---
  const rate = trapRate();
  let trapHits = 0;
  const trapsUsed = Math.min(S.traps, isBoss ? 4 : 3);
  for (let i = 0; i < trapsUsed; i++) {
    if (chance(rate)) trapHits++;
  }
  S.traps -= trapsUsed;
  let fled = false;
  if (trapHits > 0) {
    power -= trapHits * 12;
    S.stats.trapKills += trapHits;
    if (!isBoss && chance(0.25 * trapHits)) fled = true;
  }
  if (trapsUsed > 0) {
    const TL = [];
    if (trapHits > 0) {
      TL.push({ t: `罠が${trapHits}つ食い込んだ！ 勢い -${trapHits * 12}`, c: "good" });
      if (fled) TL.push({ t: "獣は悲鳴を上げ、山へ逃げ帰った！", c: "good" });
    } else {
      TL.push({ t: "罠はすべて跳ね飛ばされた…", c: "bad" });
    }
    TL.push({ t: `罠を${trapsUsed}つ消費した`, c: "warn" });
    Sound.sfx(trapHits > 0 ? "trapcatch" : "hit");
    pages.push({
      kicker: "防衛", title: "罠の間合い", emoji: "🪤",
      cls: trapHits > 0 ? "oc-good flash-good" : "oc-attack",
      html: `<p class="fl">${trapHits > 0 ? "硬い音と、獣の咆哮。罠が仕事をした。" : "雪を払う音。罠は空を噛んだ。"}</p>${linesHtml(TL)}`,
      btn: fled ? "見届ける" : "続ける",
    });
  }

  if (fled) {
    S.threat = clamp(S.threat - 30, 0, 100);
    const fur = rnd(1, 2);
    gainRes("fur", fur);
    S.stats.repelled++;
    S.morale = clamp(S.morale + 8, 0, 100);
    gainExp(6, R);
    addLog("罠がヒグマを撃退した。", "good");
    Sound.sfx("repel");
    pages.push({
      kicker: "夜明け", title: "撃退", emoji: "🏔", cls: "oc-good",
      html: `<p class="fl">血の点々が山へ続いている。今夜は、村の勝ちだ。</p>
        ${linesHtml([
          { t: `毛皮 +${fur}（罠に残っていた）`, c: "good" },
          { t: "士気 +8 ／ ヒグマ接近度 -30", c: "good" },
        ])}`,
      btn: "朝を迎える",
    });
    return { pages };
  }

  // --- 防衛判定 ---
  const def = defensePower(true);
  const dmgReduce = 1 - Math.min(0.4, S.buildings.watchtower * 0.08);
  const diff = power - def;

  if (diff <= 0) {
    // 撃退
    S.threat = clamp(S.threat - 30, 0, 100);
    S.stats.repelled++;
    S.morale = clamp(S.morale + 10, 0, 100);
    let fur = 0;
    if (hasSkill("shooter") || chance(0.4)) {
      fur = rnd(1, 3);
      gainRes("fur", fur);
      S.stats.furGained += fur;
    }
    gainExp(6, R);
    addLog("ヒグマの襲撃を撃退した！", "good");
    Sound.sfx("repel");
    L.push({ t: `防衛力 ${def} が勢い ${power} を上回った`, c: "good" });
    L.push({ t: "士気 +10 ／ ヒグマ接近度 -30", c: "good" });
    if (fur > 0) L.push({ t: `毛皮 +${fur}`, c: "good" });
    pages.push({
      kicker: "夜明け", title: "撃退", emoji: "🎯", cls: "oc-good",
      html: `<p class="fl">${hasSkill("shooter") ? "一発。それで十分だった。" : "皆で松明と鳴子を打ち鳴らし、朝までしのぎ切った。"}</p>${linesHtml(L)}`,
      btn: "朝を迎える",
    });
  } else {
    // 突破される
    const dmg = Math.round(clamp(diff * 0.7, 4, 38) * dmgReduce);
    S.hp = clamp(S.hp - dmg, 0, 100);
    S.morale = clamp(S.morale - 8, 0, 100);
    S.threat = clamp(S.threat - 15, 0, 100);
    const foodLoss = Math.min(Math.floor(S.resources.food), rnd(3, 8));
    S.resources.food -= foodLoss;
    L.push({ t: `村の体力 -${dmg}`, c: "bad" });
    L.push({ t: `食料 -${foodLoss} ／ 士気 -8`, c: "bad" });
    let deaths = 0;
    if (diff >= 12 && healthy() > 0 && chance(0.5)) {
      S.injured++;
      L.push({ t: "村人が負傷した（負傷 +1）", c: "bad" });
    }
    if (diff >= 32 && S.villagers > 1 && chance(0.4)) {
      deaths = 1;
      S.villagers--;
      S.injured = Math.min(S.injured, Math.max(0, S.villagers - 1));
      S.stats.lost++;
      S.morale = clamp(S.morale - 10, 0, 100);
      L.push({ t: "村人が一人、還らなかった…（村人 -1／士気 -10）", c: "bad" });
    }
    gainExp(3, R);
    addLog(`ヒグマに柵を破られた。被害 ${dmg}。`, "danger");
    Sound.sfx("hit");
    pages.push({
      kicker: "夜", title: "柵が破られた", emoji: "💥", cls: "oc-attack",
      html: `<p class="fl">${deaths > 0 ? "雪が、赤い。誰も声を出せなかった。" : "牙と爪の嵐。夜明けと共に、獣はようやく山へ消えた。"}</p>${linesHtml(L)}`,
      btn: "朝を迎える",
    });
  }
  return { pages };
}

/* ---------- 最終夜：山の主 ---------- */

function bossNight(R) {
  const pages = [];
  pages.push({
    kicker: "第三十日 ─ 最後の夜", title: "山の主", emoji: "🌑", cls: "oc-boss",
    html: `<p class="fl">山の主が、村の匂いを覚えた。</p>
           <p class="fl">谷を渡る風が止み、犬たちが一斉に黙り込む。来る。</p>`,
    btn: "全員、持ち場へ",
  });
  const battle = bearAttack(R, true);
  // bearAttackの導入ページと重複しないよう、導入はそのまま使う
  pages.push(...battle.pages);
  return { pages };
}

/* ---------- 勝敗 ---------- */

function endingStatsHtml() {
  return `<div class="ending-stats">
    <span>生き延びた日数 <b>${Math.min(S.day, WIN_DAY)}日</b></span>
    <span>村人 <b>${S.villagers}人</b></span>
    <span>撃退したヒグマ <b>${S.stats.repelled}</b></span>
    <span>罠にかけた獲物 <b>${S.stats.trapKills}</b></span>
    <span>得た毛皮 <b>${Math.floor(S.resources.fur)}</b></span>
    <span>マタギ技能 <b>Lv${S.level}</b></span>
  </div>`;
}

function victoryPages() {
  addLog("三十日目の朝。村は、守り抜かれた。", "good");
  Sound.setTheme("day");
  Sound.sfx("victory");
  return [{
    kicker: "結末", title: "春を待つ村", emoji: "🌅", cls: "oc-boss",
    html: `
      <p class="fl">山の主は、深い雪の向こうへ消えた。もう戻っては来ないだろう。</p>
      <p class="fl">三十日。囲炉裏の火は、一度も絶えなかった。</p>
      <p class="fl">軒先の氷柱から、雫がひとつ落ちる。──春が、近い。</p>
      ${endingStatsHtml()}
      <p style="text-align:center;font-family:var(--serif);letter-spacing:.2em;color:var(--ember)">─ 完 ─</p>`,
    btn: "新しい冬をはじめる",
  }];
}

function defeatPages(reason) {
  const texts = {
    hp: { title: "村は雪に還った", fl: "壊れた柵、崩れた屋根。囲炉裏の火は、もう誰も守れない。" },
    pop: { title: "誰もいない村", fl: "雪だけが、静かに積もり続けている。" },
    morale: { title: "心が折れた冬", fl: "飢えと寒さに、人の心が先に尽きた。皆、山を下りていった。" },
  };
  const t = texts[reason] || texts.hp;
  addLog("村は冬を越せなかった。", "danger");
  Sound.sfx("defeat");
  return [{
    kicker: "結末", title: t.title, emoji: "🕯", cls: "oc-attack",
    html: `
      <p class="fl">${esc(t.fl)}</p>
      <p class="fl">${S.day}日目の冬だった。</p>
      ${endingStatsHtml()}`,
    btn: "もう一度、冬に挑む",
  }];
}

/* ---------- 技能選択 ---------- */

function showSkillChoice() {
  const candidates = SKILL_DEFS.filter(s => !hasSkill(s.id));
  if (candidates.length === 0) { S.pendingSkill = false; save(); renderAll(); return; }
  const pool = [...candidates];
  const shown = [];
  while (shown.length < 3 && pool.length) {
    const i = Math.floor(Math.random() * pool.length);
    shown.push(pool.splice(i, 1)[0]);
  }
  showOverlay(`
    <div class="ov-kicker">レベルアップ</div>
    <div class="ov-title">技が身についた</div>
    <div class="ov-emoji">✨</div>
    <div class="ov-body"><p class="fl">山で過ごした日々が、体に刻まれていく。ひとつ、選べ。</p></div>
    <div class="ov-actions">
      ${shown.map(s => `
        <button class="skill-choice" data-skill="${s.id}">
          <span class="sk-icon">${s.icon}</span>
          <span><span class="sk-name">${s.name}</span><div class="sk-desc">${s.desc}</div></span>
        </button>`).join("")}
    </div>`, "oc-good");
  document.querySelectorAll(".skill-choice").forEach(btn => {
    btn.addEventListener("click", () => {
      S.skills.push(btn.dataset.skill);
      S.pendingSkill = false;
      const sk = SKILL_DEFS.find(s => s.id === btn.dataset.skill);
      addLog(`技能「${sk.name}」を会得した。`, "good");
      save();
      hideOverlay();
    });
  });
}

/* ---------- ヘルプ・リセット ---------- */

function showHelp() {
  playPages([{
    kicker: "遊び方", title: "白嶺のマタギ", emoji: "🏔",
    html: `
      <p><b>目標：</b>30日間、村を守り抜く。</p>
      <p><b>一日の流れ：</b>①「配置」で村人に仕事を割り振る → ②「施設」を建てる・強化する → ③「探索」で夕方の行動を選ぶ → ④「夜を迎える」で一日を終える。</p>
      <p><b>資源：</b>🪵薪は暖と建設に、🍙食料は毎晩村人1人につき1消費。🌿薬草は負傷の治療、⚙️鉄は罠と柵に使う。</p>
      <p><b>ヒグマ：</b>接近度が高いほど夜の襲撃が起きやすい。防柵・罠・見張りで防衛力を上げよう。罠は使い切りだ。</p>
      <p><b>敗北：</b>村の体力0、村人0、または士気0で終わり。</p>`,
    btn: "閉じる",
  }]);
}

function confirmReset() {
  showOverlay(`
    <div class="ov-title">はじめからやり直す</div>
    <div class="ov-body"><p>いまの村の記録は消える。本当にやり直すか？</p></div>
    <div class="ov-actions">
      <button class="btn btn-wide" id="resetYes" style="border-color:#7a3535;color:#eda0a0">やり直す</button>
      <button class="btn btn-wide" id="resetNo">やめておく</button>
    </div>`);
  $("#resetYes").addEventListener("click", () => { newGame(); });
  $("#resetNo").addEventListener("click", hideOverlay);
}

/* ---------- ゲーム開始 ---------- */

function showIntro() {
  playPages([
    {
      kicker: "序", title: "白嶺のマタギ", emoji: "🏔",
      html: `
        <p class="fl">その冬、雪は一晩で軒まで届いた。</p>
        <p class="fl">峠は塞がり、白嶺（しらみね）の村は外界から切り離された。</p>
        <p class="fl">そして山には──腹を空かせた、大きな影がいる。</p>`,
      btn: "続ける",
    },
    {
      kicker: "序", title: "若きマタギへ", emoji: "🎯",
      html: `
        <p class="fl">「村を頼む」と、年寄りたちは言った。</p>
        <p>あなたは村でただ一人のマタギ。<b>30日間</b>、雪解けまで村を守り抜けば勝利だ。</p>
        ${linesHtml([
          { t: "昼：村人を仕事に配置し、施設を建てる" },
          { t: "夕方：山を探索するか、防衛を固める" },
          { t: "夜：ヒグマや吹雪が村を試す", c: "warn" },
        ])}`,
      btn: "冬をはじめる",
    },
  ], () => {
    S.seenIntro = true;
    save();
    renderAll();
  });
}

function newGame() {
  S = defaultState();
  save();
  hideOverlay();
  switchTab("village");
  renderAll();
  showIntro();
}

/* ---------- 降雪演出 ---------- */

function initSnow() {
  const wrap = $("#snow");
  const n = 36;
  let html = "";
  for (let i = 0; i < n; i++) {
    const size = (Math.random() * 8 + 4).toFixed(1);
    const left = (Math.random() * 100).toFixed(1);
    const dur = (Math.random() * 9 + 8).toFixed(1);
    const delay = (-Math.random() * 17).toFixed(1);
    const drift = (Math.random() * 60 - 30).toFixed(0);
    const op = (Math.random() * 0.5 + 0.25).toFixed(2);
    html += `<span class="flake" style="left:${left}%;font-size:${size}px;opacity:${op};--drift:${drift}px;animation-duration:${dur}s;animation-delay:${delay}s">❄</span>`;
  }
  wrap.innerHTML = html;
}

/* ---------- イベント登録・起動 ---------- */

function bindEvents() {
  document.querySelectorAll(".tab").forEach(t =>
    t.addEventListener("click", () => switchTab(t.dataset.tab)));

  $("#endDayBtn").addEventListener("click", endDay);

  $("#screen-build").addEventListener("click", e => {
    const btn = e.target.closest("[data-build]");
    if (btn) doBuild(btn.dataset.build);
  });

  $("#screen-jobs").addEventListener("click", e => {
    const btn = e.target.closest("[data-job]");
    if (btn) doJob(btn.dataset.job, Number(btn.dataset.d));
  });

  $("#screen-explore").addEventListener("click", e => {
    const btn = e.target.closest("[data-explore]");
    if (btn) doEvening(btn.dataset.explore);
  });

  $("#hintClose").addEventListener("click", () => {
    S.tutorial = TUT_STEPS.length;
    save();
    renderHint();
  });

  $("#soundToggle").addEventListener("click", () => {
    Sound.init();
    updateSoundIcon(Sound.toggle());
    updateMusicState();
  });
}

function updateSoundIcon(on) {
  const btn = $("#soundToggle");
  btn.textContent = on ? "🔊" : "🔇";
  btn.classList.toggle("on", on);
  btn.setAttribute("aria-label", on ? "音を消す" : "音を鳴らす");
}

function init() {
  initSnow();
  bindEvents();
  updateSoundIcon(Sound.isEnabled());
  const startAudioOnce = () => {
    Sound.init();
    updateMusicState();
    document.removeEventListener("pointerdown", startAudioOnce);
  };
  document.addEventListener("pointerdown", startAudioOnce, { once: true });

  const loaded = load();
  if (loaded) {
    S = loaded;
    S.time = S.time === "night" ? "day" : S.time; // 夜の途中保存からは朝扱いで復帰
    renderAll();
    if (!S.seenIntro) showIntro();
    else if (S.pendingSkill && !S.over) showSkillChoice();
    else if (S.over) {
      // 決着済みセーブ：結果を見せて再挑戦を促す
      const pages = S.day >= WIN_DAY && S.hp > 0 && S.villagers > 0 && S.morale > 0
        ? victoryPages()
        : defeatPages(S.hp <= 0 ? "hp" : S.villagers <= 0 ? "pop" : "morale");
      playPages(pages, newGame);
    }
  } else {
    S = defaultState();
    save();
    renderAll();
    showIntro();
  }
}

document.addEventListener("DOMContentLoaded", init);
