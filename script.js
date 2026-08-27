// ---------- Data ----------
const NON_CONNECTORS = new Set(["ا", "د", "ذ", "ر", "ز", "و"]);

const RAW_LETTERS = [
  { ar: "ا", name: "Alif", translit: "ā" },
  { ar: "ب", name: "Ba", translit: "b" },
  { ar: "ت", name: "Ta", translit: "t" },
  { ar: "ث", name: "Tha", translit: "th" },
  { ar: "ج", name: "Jim", translit: "j" },
  { ar: "ح", name: "Ha", translit: "ḥ" },
  { ar: "خ", name: "Kha", translit: "kh" },
  { ar: "د", name: "Dal", translit: "d" },
  { ar: "ذ", name: "Dhal", translit: "dh" },
  { ar: "ر", name: "Ra", translit: "r" },
  { ar: "ز", name: "Zay", translit: "z" },
  { ar: "س", name: "Sin", translit: "s" },
  { ar: "ش", name: "Shin", translit: "sh" },
  { ar: "ص", name: "Sad", translit: "ṣ" },
  { ar: "ض", name: "Dad", translit: "ḍ" },
  { ar: "ط", name: "Ta (emphatic)", translit: "ṭ" },
  { ar: "ظ", name: "Za", translit: "ẓ" },
  { ar: "ع", name: "Ain", translit: "ʿ" },
  { ar: "غ", name: "Ghain", translit: "gh" },
  { ar: "ف", name: "Fa", translit: "f" },
  { ar: "ق", name: "Qaf", translit: "q" },
  { ar: "ك", name: "Kaf", translit: "k" },
  { ar: "ل", name: "Lam", translit: "l" },
  { ar: "م", name: "Mim", translit: "m" },
  { ar: "ن", name: "Nun", translit: "n" },
  { ar: "ه", name: "Ha (soft)", translit: "h" },
  { ar: "و", name: "Waw", translit: "w" },
  { ar: "ي", name: "Ya", translit: "y" },
];

const TATWEEL = "\u0640";

const LETTERS = RAW_LETTERS.map((l) => {
  const connects = !NON_CONNECTORS.has(l.ar);
  return {
    ...l,
    isolated: l.ar,
    initial: connects ? l.ar + TATWEEL : l.ar,
    medial: connects ? TATWEEL + l.ar + TATWEEL : TATWEEL + l.ar,
    final: TATWEEL + l.ar,
    connects,
  };
});

// ---------- State ----------
let selected = 0;
let currentScreen = "home"; // 'home' | 'reference' | 'trace'

// ---------- Progress (persisted locally on this device) ----------
const PROGRESS_KEY = "qalam-progress-v1";
const LAST_KEY = "qalam-last-letter-v1";

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (e) {
    return new Set();
  }
}

function saveProgress() {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify([...practiced]));
  } catch (e) {
    /* ignore (e.g. private browsing) */
  }
}

function loadLastLetter() {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw !== null ? parseInt(raw, 10) : null;
  } catch (e) {
    return null;
  }
}

function saveLastLetter(index) {
  try {
    localStorage.setItem(LAST_KEY, String(index));
  } catch (e) {
    /* ignore */
  }
}

let practiced = loadProgress();
let lastLetter = loadLastLetter();

function markPracticed(index) {
  lastLetter = index;
  saveLastLetter(index);
  if (!practiced.has(index)) {
    practiced.add(index);
    saveProgress();
    renderGrid();
  }
  renderHome();
}

const RING_CIRCUMFERENCE = 263.9; // 2 * PI * r(42)

function renderHome() {
  const total = LETTERS.length;
  const done = practiced.size;
  const pct = done / total;

  const countEl = document.getElementById("progressCount");
  const ringFill = document.getElementById("ringFill");
  if (countEl) countEl.textContent = `${done} / ${total}`;
  if (ringFill) ringFill.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - pct));

  const continueCard = document.getElementById("continueCard");
  const continueName = document.getElementById("continueName");
  const continueGlyph = document.getElementById("continueGlyph");
  if (continueCard) {
    if (lastLetter !== null && LETTERS[lastLetter]) {
      continueCard.classList.remove("hidden");
      continueName.textContent = LETTERS[lastLetter].name;
      continueGlyph.textContent = LETTERS[lastLetter].isolated;
    } else {
      continueCard.classList.add("hidden");
    }
  }
}

// ---------- Elements ----------
const detailLetter = document.getElementById("detailLetter");
const detailName = document.getElementById("detailName");
const detailMeta = document.getElementById("detailMeta");
const formsRow = document.getElementById("formsRow");
const btnTraceThis = document.getElementById("btnTraceThis");
const letterGrid = document.getElementById("letterGrid");

const practiceName = document.getElementById("practiceName");
const practiceTranslit = document.getElementById("practiceTranslit");
const canvas = document.getElementById("traceCanvas");
const strokeStatus = document.getElementById("strokeStatus");
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const btnClear = document.getElementById("btnClear");

// ---------- Screen navigation ----------
const screens = {
  home: document.getElementById("screenHome"),
  reference: document.getElementById("screenReference"),
  trace: document.getElementById("screenTrace"),
};
const tabs = document.querySelectorAll(".tab");

function showScreen(next) {
  currentScreen = next;
  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle("active", key === next);
  });
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === next));
  if (next === "trace") setupCanvas();
  if (next === "home") renderHome();
  window.scrollTo(0, 0);
}

tabs.forEach((t) => t.addEventListener("click", () => showScreen(t.dataset.tab)));

document.querySelectorAll("[data-back]").forEach((btn) => {
  btn.addEventListener("click", () => showScreen("home"));
});

document.getElementById("tileReference").addEventListener("click", () => showScreen("reference"));
document.getElementById("tileTrace").addEventListener("click", () => showScreen("trace"));

document.getElementById("continueCard").addEventListener("click", () => {
  if (lastLetter !== null) selected = lastLetter;
  showScreen("trace");
});

// ---------- Reference rendering ----------
function renderDetail() {
  const l = LETTERS[selected];

  // re-trigger ink reveal animation
  detailLetter.classList.remove("ink-reveal");
  void detailLetter.offsetWidth; // force reflow
  detailLetter.classList.add("ink-reveal");
  detailLetter.textContent = l.isolated;

  detailName.textContent = l.name;
  detailMeta.textContent = `transliteration: ${l.translit} · ${l.connects ? "connects both sides" : "connects from the right only"}`;

  const forms = [
    { label: "Isolated", val: l.isolated },
    { label: "Initial", val: l.initial },
    { label: "Medial", val: l.medial },
    { label: "Final", val: l.final },
  ];
  formsRow.innerHTML = "";
  forms.forEach((f) => {
    const item = document.createElement("div");
    item.className = "form-item";
    item.innerHTML = `
      <div class="form-glyph qalam-arabic">${f.val}</div>
      <div class="form-label qalam-mono">${f.label}</div>
    `;
    formsRow.appendChild(item);
  });
}

function renderGrid() {
  letterGrid.innerHTML = "";
  LETTERS.forEach((l, i) => {
    const card = document.createElement("button");
    card.className = "qalam-btn letter-card" + (i === selected ? " selected" : "");
    card.innerHTML = `
      ${practiced.has(i) ? '<span class="badge" title="Practiced"></span>' : ""}
      <span class="glyph qalam-arabic">${l.isolated}</span>
      <span class="translit qalam-mono">${l.translit}</span>
    `;
    card.addEventListener("click", () => {
      selected = i;
      renderDetail();
      renderGrid();
    });
    letterGrid.appendChild(card);
  });
}

btnTraceThis.addEventListener("click", () => showScreen("trace"));

// ---------- Practice / canvas ----------
let drawing = false;
let strokeCount = 0;
let ctx;

function drawGuide() {
  const size = canvas.clientWidth;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.fillStyle = "#211D18";
  ctx.globalAlpha = 0.13;
  ctx.font = "220px Amiri";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(LETTERS[selected].isolated, size / 2, size / 2 + 14);
  ctx.restore();
}

function setupCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const size = canvas.clientWidth;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  drawGuide();
  strokeCount = 0;
  updateStrokeStatus();
  updatePracticeHeader();
}

function updatePracticeHeader() {
  practiceName.textContent = LETTERS[selected].name;
  practiceTranslit.textContent = LETTERS[selected].translit;
}

function updateStrokeStatus() {
  strokeStatus.textContent =
    strokeCount === 0 ? "trace the faint letter" : `${strokeCount} stroke${strokeCount > 1 ? "s" : ""} drawn`;
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function start(e) {
  e.preventDefault();
  const { x, y } = getPos(e);
  drawing = true;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#AD7C2E";
}

function move(e) {
  if (!drawing) return;
  e.preventDefault();
  const { x, y } = getPos(e);
  ctx.lineTo(x, y);
  ctx.stroke();
}

function end() {
  if (drawing) {
    strokeCount++;
    updateStrokeStatus();
    markPracticed(selected);
  }
  drawing = false;
}

canvas.addEventListener("mousedown", start);
canvas.addEventListener("mousemove", move);
canvas.addEventListener("mouseup", end);
canvas.addEventListener("mouseleave", end);
canvas.addEventListener("touchstart", start, { passive: false });
canvas.addEventListener("touchmove", move, { passive: false });
canvas.addEventListener("touchend", end);

btnClear.addEventListener("click", () => {
  drawGuide();
  strokeCount = 0;
  updateStrokeStatus();
});

btnPrev.addEventListener("click", () => {
  selected = (selected - 1 + LETTERS.length) % LETTERS.length;
  setupCanvas();
});

btnNext.addEventListener("click", () => {
  selected = (selected + 1) % LETTERS.length;
  setupCanvas();
});

// ---------- Init ----------
renderDetail();
renderGrid();
renderHome();
