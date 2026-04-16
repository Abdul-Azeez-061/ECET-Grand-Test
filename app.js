// ============================================================
//  APP.JS — Core Application Logic
// ============================================================

"use strict";

// ── Configuration ────────────────────────────────────────────
const CONFIG = {
  math:    { count: 50,  label: "Mathematics", color: "blue"   },
  physics: { count: 25,  label: "Physics",     color: "purple" },
  chem:    { count: 25,  label: "Chemistry",   color: "green"  },
  core:    { count: 100, label: "Core",        color: "orange" },
};

const CORE_SUBJECTS = [
  { key: "digitalElectronics",      arr: () => digitalElectronicsQuestions,      n: 6  },
  { key: "softwareEngineering",     arr: () => softwareEngineeringQuestions,      n: 6  },
  { key: "comsOrgMicroprocessors",  arr: () => comsOrgMicroprocessorsQuestions,   n: 8  },
  { key: "dataStructures",          arr: () => dataStructuresQuestions,           n: 10 },
  { key: "computerNetworks",        arr: () => computerNetworksQuestions,         n: 6  },
  { key: "operatingSystems",        arr: () => operatingSystemsQuestions,         n: 10 },
  { key: "dbms",                    arr: () => dbmsQuestions,                     n: 8  },
  { key: "javaProgramming",         arr: () => javaProgrammingQuestions,          n: 10 },
  { key: "webTechnologies",         arr: () => webTechnologiesQuestions,          n: 8  },
  { key: "bigDataCloud",            arr: () => bigDataCloudQuestions,             n: 6  },
  { key: "androidProgramming",      arr: () => androidProgrammingQuestions,       n: 6  },
  { key: "iot",                     arr: () => iotQuestions,                      n: 8  },
  { key: "pythonProgramming",       arr: () => pythonProgrammingQuestions,        n: 8  },
];

// ── State ────────────────────────────────────────────────────
let testQuestions = [];   // final 200-question array
let answers       = [];   // user answers (null = unanswered)
let submitted     = false;
let timerInterval = null;
let secondsLeft   = 3 * 60 * 60; // 3 hours

const BLOCKS = [
  { key: "math",    label: "Mathematics", color: "blue",   count: CONFIG.math.count },
  { key: "physics", label: "Physics",     color: "purple", count: CONFIG.physics.count },
  { key: "chem",    label: "Chemistry",   color: "green",  count: CONFIG.chem.count },
  { key: "core",    label: "Core",        color: "orange", count: CONFIG.core.count },
];

let blockPositions = {};
let currentBlock   = BLOCKS[0].key;
let currentQuestionIndex = 0;
let visited       = [];
let markedReview  = [];
let violationCount = 0;

(function setBlockRanges() {
  let cursor = 0;
  BLOCKS.forEach(block => {
    block.start = cursor;
    block.end   = cursor + block.count - 1;
    cursor += block.count;
  });
})();

// ── Utilities ─────────────────────────────────────────────────
function fisherYates(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickN(arr, n, label) {
  if (arr.length < n) {
    console.warn(`[${label}] Dataset has ${arr.length} questions but ${n} required. Duplicating to fill.`);
    const filled = [];
    while (filled.length < n) filled.push(...arr);
    return fisherYates(filled).slice(0, n);
  }
  return fisherYates(arr).slice(0, n);
}

function formatTime(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

function categoryOf(index) {
  if (index < 50)  return "math";
  if (index < 75)  return "physics";
  if (index < 100) return "chem";
  return "core";
}

// ── Build Test ────────────────────────────────────────────────
function buildTest() {
  const math    = pickN(mathQuestions,    CONFIG.math.count,    "Mathematics");
  const physics = pickN(physicsQuestions, CONFIG.physics.count, "Physics");
  const chem    = pickN(chemistryQuestions, CONFIG.chem.count,  "Chemistry");

  const coreChunks = CORE_SUBJECTS.map(subj =>
    pickN(subj.arr(), subj.n, subj.key)
  );
  const core = [].concat(...coreChunks);

  testQuestions = [...math, ...physics, ...chem, ...core];
  answers       = new Array(testQuestions.length).fill(null);
  visited       = new Array(testQuestions.length).fill(false);
  markedReview  = new Array(testQuestions.length).fill(false);
  blockPositions = BLOCKS.reduce((acc, block) => {
    acc[block.key] = 0;
    return acc;
  }, {});
  currentBlock = BLOCKS[0].key;
  currentQuestionIndex = 0;
}

// ── Render Test ───────────────────────────────────────────────
function renderTest() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="test-shell">
      <div class="test-main">
        <div class="block-tabs" id="block-tabs"></div>
        <div class="question-frame">
          <div id="question-card-container"></div>
          <div class="question-actions">
            <button class="btn-nav" id="prev-question-btn">Previous</button>
            <button class="btn-nav" id="next-question-btn">Next</button>
          </div>
        </div>
      </div>

      <aside class="sidebar">
        <div class="sidebar-head">
          <div>
            <div class="sidebar-title">Question Map</div>
            <div class="sidebar-sub" id="sidebar-block-label"></div>
          </div>
          <div class="sidebar-status"><span id="sidebar-answered-count">0</span> / <span id="sidebar-total-count">0</span></div>
        </div>
        <div class="sidebar-legend" id="sidebar-legend"></div>
        <div class="question-grid" id="question-grid"></div>
      </aside>
    </div>
  `;

  renderBlockTabs();
  renderCurrentQuestion();
  renderQuestionGrid();
  renderSidebarLegend();

  document.getElementById("prev-question-btn").addEventListener("click", previousQuestion);
  document.getElementById("next-question-btn").addEventListener("click", nextQuestion);
}

function getBlockMeta(key) {
  return BLOCKS.find(block => block.key === key);
}

function getGlobalIndex(blockKey, localIndex) {
  const block = getBlockMeta(blockKey);
  return block ? block.start + localIndex : 0;
}

function renderBlockTabs() {
  const tabs = BLOCKS.map(block => `
    <button class="block-tab${block.key === currentBlock ? ' active' : ''}" data-block="${block.key}">
      ${block.label}
    </button>
  `).join("");

  document.getElementById("block-tabs").innerHTML = tabs;
  document.querySelectorAll(".block-tab").forEach(btn => {
    btn.addEventListener("click", () => switchBlock(btn.dataset.block));
  });
}

function renderCurrentQuestion() {
  const block = getBlockMeta(currentBlock);
  const globalIndex = getGlobalIndex(currentBlock, currentQuestionIndex);
  const q = testQuestions[globalIndex];

  if (!q) {
    document.getElementById("question-card-container").innerHTML = `<div class="question-card">Question not available.</div>`;
    return;
  }

  const optionsHTML = q.options.map((opt, oi) => {
    const letter = ["A","B","C","D"][oi];
    const checked = answers[globalIndex] === opt ? "checked" : "";
    return `
      <label class="option-label" id="opt-${globalIndex}-${oi}">
        <input type="radio" name="q${globalIndex}" value="${escapeHTML(opt)}" data-index="${globalIndex}" ${checked}>
        <span class="option-letter">${letter}</span>
        <span class="option-text">${escapeHTML(opt)}</span>
      </label>`;
  }).join("");

  visited[globalIndex] = true;

  const reviewState = markedReview[globalIndex] ? 'marked' : 'unmarked';
  const reviewButtonLabel = markedReview[globalIndex] ? 'Remove Review' : 'Mark for Review';

  document.getElementById("question-card-container").innerHTML = `
    <div class="question-card current-question-card ${reviewState}" id="qcard-${globalIndex}">
      <div class="question-header">
        <span class="q-number">Q${globalIndex + 1}</span>
        <span class="q-text">${escapeHTML(q.question)}</span>
      </div>
      <div class="question-meta">
        <button class="btn-review" id="review-toggle-btn">${reviewButtonLabel}</button>
      </div>
      <div class="options-grid">${optionsHTML}</div>
    </div>
  `;

  document.querySelectorAll("#question-card-container input[type=radio]").forEach(radio => {
    radio.addEventListener("change", handleAnswer);
  });

  document.getElementById("review-toggle-btn").addEventListener("click", () => toggleReview(globalIndex));

  checkSubmitEnabled();

  document.getElementById("sidebar-block-label").textContent = block.label;
  updateNavButtons();
  updateSidebarStatus();
}

function renderQuestionGrid() {
  const block = getBlockMeta(currentBlock);
  const answeredCount = answers.filter((_, index) => index >= block.start && index <= block.end && answers[index] !== null).length;

  document.getElementById("sidebar-answered-count").textContent = answeredCount;
  document.getElementById("sidebar-total-count").textContent = block.count;

  const gridHTML = Array.from({ length: block.count }, (_, localIndex) => {
    const globalIndex = getGlobalIndex(currentBlock, localIndex);
    const isAnswered = answers[globalIndex] !== null;
    const isMarked   = markedReview[globalIndex];
    const isVisited  = visited[globalIndex];
    const isActive   = localIndex === currentQuestionIndex;
    const stateClass = isAnswered && isMarked ? ' answered-marked'
      : isMarked ? ' marked'
      : isAnswered ? ' answered'
      : !isVisited ? ' not-visited'
      : ' not-answered';

    return `
      <button class="question-number${isActive ? ' active' : ''}${stateClass}" data-index="${localIndex}">
        ${localIndex + 1}
      </button>`;
  }).join("");

  const grid = document.getElementById("question-grid");
  grid.innerHTML = gridHTML;
  grid.querySelectorAll(".question-number").forEach(btn => {
    btn.addEventListener("click", () => setCurrentQuestion(parseInt(btn.dataset.index, 10)));
  });
}

function switchBlock(blockKey) {
  if (blockKey === currentBlock) return;
  currentBlock = blockKey;
  currentQuestionIndex = blockPositions[blockKey] || 0;
  renderBlockTabs();
  renderCurrentQuestion();
  renderQuestionGrid();
}

function setCurrentQuestion(localIndex) {
  const block = getBlockMeta(currentBlock);
  currentQuestionIndex = Math.max(0, Math.min(localIndex, block.count - 1));
  blockPositions[currentBlock] = currentQuestionIndex;
  renderCurrentQuestion();
  renderQuestionGrid();
  // Close sidebar on mobile after selecting question
  if (window.innerWidth <= 1040) {
    document.querySelector(".sidebar").classList.remove("sidebar-open");
  }
}

function previousQuestion() {
  if (currentQuestionIndex === 0) return;
  setCurrentQuestion(currentQuestionIndex - 1);
}

function nextQuestion() {
  const block = getBlockMeta(currentBlock);
  if (currentQuestionIndex >= block.count - 1) return;
  setCurrentQuestion(currentQuestionIndex + 1);
}

function updateNavButtons() {
  const block = getBlockMeta(currentBlock);
  document.getElementById("prev-question-btn").disabled = currentQuestionIndex === 0;
  document.getElementById("next-question-btn").disabled = currentQuestionIndex >= block.count - 1;
}

function updateSidebarStatus() {
  const block = getBlockMeta(currentBlock);
  const total = block.count;
  const blockRange = (index) => index >= block.start && index <= block.end;

  const answered = answers.filter((_, index) => blockRange(index) && answers[index] !== null).length;
  const markedNotAnswered = markedReview.filter((marked, index) => blockRange(index) && marked && answers[index] === null).length;
  const answeredMarked = answers.filter((answer, index) => blockRange(index) && answer !== null && markedReview[index]).length;
  const notVisited = visited.filter((visited, index) => blockRange(index) && !visited).length;
  const notAnswered = visited.filter((v, index) => blockRange(index) && v && answers[index] === null).length;

  document.getElementById("sidebar-answered-count").textContent = answered;
  document.getElementById("sidebar-total-count").textContent = total;
  document.getElementById("sidebar-legend").innerHTML = renderSidebarLegend({ answered, notAnswered, notVisited, markedNotAnswered, answeredMarked });
}

function toggleSidebar() {
  const sidebar = document.querySelector(".sidebar");
  sidebar.classList.toggle("sidebar-open");
}

function renderSidebarLegend(stats = {}) {
  const {
    answered = 0,
    notAnswered = 0,
    notVisited = 0,
    markedNotAnswered = 0,
    answeredMarked = 0,
  } = stats;

  return `
    <div class="legend-row">
      <span class="legend-dot status-answered"></span>
      <span>Answered</span>
      <span class="legend-count">${answered}</span>
    </div>
    <div class="legend-row">
      <span class="legend-dot status-not-answered"></span>
      <span>Not Answered</span>
      <span class="legend-count">${notAnswered}</span>
    </div>
    <div class="legend-row">
      <span class="legend-dot status-not-visited"></span>
      <span>Not Visited</span>
      <span class="legend-count">${notVisited}</span>
    </div>
    <div class="legend-row">
      <span class="legend-dot status-marked"></span>
      <span>Marked for Review</span>
      <span class="legend-count">${markedNotAnswered}</span>
    </div>
    <div class="legend-row">
      <span class="legend-dot status-answered-marked"></span>
      <span>Answered & Reviewed</span>
      <span class="legend-count">${answeredMarked}</span>
    </div>
  `;
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Handle Answer ─────────────────────────────────────────────
function handleAnswer(e) {
  if (submitted) return;
  const index = parseInt(e.target.dataset.index, 10);
  answers[index] = e.target.value;

  checkSubmitEnabled();
  renderCurrentQuestion();
  renderQuestionGrid();
}

function toggleReview(globalIndex) {
  if (submitted) return;
  markedReview[globalIndex] = !markedReview[globalIndex];
  renderCurrentQuestion();
  renderQuestionGrid();
}

// ── Submit Logic ──────────────────────────────────────────────
function checkSubmitEnabled() {
  const btn     = document.getElementById("submit-btn");
  const allVisited = visited.every(v => v);
  btn.disabled  = !allVisited;
  btn.classList.toggle("btn-ready", allVisited);
  btn.classList.toggle("hidden", !allVisited);
}

function openConfirmModal() {
  const answered = answers.filter(a => a !== null).length;
  const skipped  = testQuestions.length - answered;

  document.getElementById("modal-answered").textContent = answered;
  document.getElementById("modal-skipped").textContent  = skipped;
  document.getElementById("confirm-modal").classList.add("active");
}

function closeConfirmModal() {
  document.getElementById("confirm-modal").classList.remove("active");
}

function submitTest() {
  closeConfirmModal();
  submitted = true;
  clearInterval(timerInterval);

  // Lock all radios
  document.querySelectorAll("input[type=radio]").forEach(r => r.disabled = true);

  // Reset violation count on successful submission
  localStorage.removeItem('violationCount');

  renderReport();
}

// ── Timer ─────────────────────────────────────────────────────
function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    secondsLeft--;
    if (secondsLeft <= 0) {
      secondsLeft = 0;
      clearInterval(timerInterval);
      openConfirmModal();
    }
    updateTimerDisplay();
    if (secondsLeft <= 300) {
      document.getElementById("timer-display").classList.add("timer-warning");
    }
  }, 1000);
}

function updateTimerDisplay() {
  document.getElementById("timer-display").textContent = formatTime(secondsLeft);
}

// ── Report ────────────────────────────────────────────────────
function renderReport() {
  // Calculate scores
  let mathScore=0, physicsScore=0, chemScore=0, coreScore=0;
  testQuestions.forEach((q, i) => {
    const correct = answers[i] === q.answer;
    if (i < 50)  mathScore    += correct ? 1 : 0;
    else if (i < 75)  physicsScore += correct ? 1 : 0;
    else if (i < 100) chemScore    += correct ? 1 : 0;
    else              coreScore    += correct ? 1 : 0;
  });

  const total    = mathScore + physicsScore + chemScore + coreScore;
  const maxTotal = testQuestions.length;
  const pct      = ((total / maxTotal) * 100).toFixed(1);
  const passed   = pct >= 40;

  const app = document.getElementById("app");
  app.innerHTML = `
    <div class="report-page">
      <div class="report-header">
        <div class="report-title-block">
          <span class="report-icon">📋</span>
          <div>
            <h1 class="report-title">Test Report</h1>
            <p class="report-sub">Detailed Performance Analysis</p>
          </div>
        </div>
        <button class="btn-print" onclick="window.print()">🖨 Print / Download</button>
      </div>

      <!-- Score Summary -->
      <div class="score-summary">
        <div class="score-main">
          <div class="score-circle ${passed ? 'pass' : 'fail'}">
            <span class="score-num">${total}</span>
            <span class="score-denom">/${maxTotal}</span>
          </div>
          <div class="score-meta">
            <div class="score-pct">${pct}%</div>
            <div class="score-verdict ${passed ? 'pass-label' : 'fail-label'}">${passed ? '✅ PASSED' : '❌ FAILED'}</div>
            <div class="pass-note">Pass mark: 40%</div>
          </div>
        </div>
        <div class="cat-scores">
          ${renderCatScore("Mathematics", mathScore,   50,  "blue")}
          ${renderCatScore("Physics",     physicsScore, 25, "purple")}
          ${renderCatScore("Chemistry",   chemScore,   25,  "green")}
          ${renderCatScore("Core",        coreScore,  100,  "orange")}
        </div>
      </div>

      <!-- Question Review -->
      <div class="review-section">
        <h2 class="review-heading">Full Question Review</h2>
        ${renderReviewCategories()}
      </div>
    </div>
  `;
}

function renderCatScore(label, score, max, color) {
  const pct = Math.round((score/max)*100);
  return `
    <div class="cat-score-card cat-${color}">
      <div class="cat-score-label">${label}</div>
      <div class="cat-score-val">${score} <span>/ ${max}</span></div>
      <div class="cat-score-bar"><div class="cat-score-fill" style="width:${pct}%"></div></div>
      <div class="cat-score-pct">${pct}%</div>
    </div>`;
}

function renderReviewCategories() {
  const cats = [
    { label: "Mathematics", start:   0, end:  49, color: "blue"   },
    { label: "Physics",     start:  50, end:  74, color: "purple" },
    { label: "Chemistry",   start:  75, end:  99, color: "green"  },
    { label: "Core",        start: 100, end: 199, color: "orange" },
  ];

  return cats.map(cat => {
    const qHTML = [];
    for (let i = cat.start; i <= cat.end; i++) {
      const q       = testQuestions[i];
      if (!q) continue;
      const userAns = answers[i];
      const correct = userAns === q.answer;

      const optsHTML = q.options.map((opt, oi) => {
        let cls = "review-opt";
        if (opt === q.answer)  cls += " correct-opt";
        if (opt === userAns && !correct) cls += " wrong-opt";
        const letter = ["A","B","C","D"][oi];
        return `<div class="${cls}"><span class="review-opt-letter">${letter}</span> ${escapeHTML(opt)}</div>`;
      }).join("");

      qHTML.push(`
        <div class="review-card ${correct ? 'review-correct' : 'review-wrong'}">
          <div class="review-q-header">
            <span class="review-q-num">Q${i+1}</span>
            <span class="review-verdict">${correct ? "✅ Correct" : "❌ Wrong"}</span>
          </div>
          <div class="review-q-text">${escapeHTML(q.question)}</div>
          <div class="review-opts">${optsHTML}</div>
          ${!userAns ? `<div class="review-skipped">⚠ Not answered</div>` : ""}
        </div>`);
    }

    return `
      <div class="review-cat-header cat-${cat.color}">
        <span>${getCatIcon(cat.color)}</span>
        <span>${cat.label}</span>
      </div>
      ${qHTML.join("")}`;
  }).join("");
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Load violation count
  violationCount = parseInt(localStorage.getItem('violationCount') || 0);

  // Check for excessive tab/minimize violations
  if (violationCount >= 3) {
    alert('Too many tab switch/minimize violations. Test will be reset.');
    localStorage.clear();
    window.location.href = 'index.html';
    return;
  }

  buildTest();
  renderTest();
  startTimer();
  checkSubmitEnabled();

  // Set user name from localStorage
  const userName = localStorage.getItem('userName');
  if (userName) {
    document.getElementById('user-name').textContent = userName;
  }

  // Strict tab switching and minimizing protection
  window.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      violationCount++;
      localStorage.setItem('violationCount', violationCount);
      if (violationCount >= 3) {
        alert('Too many violations (tab switching/minimizing). Test will be reset.');
        localStorage.clear();
        window.location.href = 'index.html';
      } else {
        alert(`Violation ${violationCount}/3: Tab switching or minimizing detected.`);
      }
    }
  });

  document.getElementById("submit-btn").addEventListener("click", () => {
    if (!document.getElementById("submit-btn").disabled) openConfirmModal();
  });

  document.getElementById("modal-confirm-btn").addEventListener("click", submitTest);
  document.getElementById("modal-cancel-btn").addEventListener("click", closeConfirmModal);
  document.getElementById("confirm-modal").addEventListener("click", e => {
    if (e.target === document.getElementById("confirm-modal")) closeConfirmModal();
  });

  document.getElementById("sidebar-toggle-btn").addEventListener("click", toggleSidebar);

  // Close sidebar when clicking outside on mobile
  document.addEventListener("click", (e) => {
    const sidebar = document.querySelector(".sidebar");
    const toggleBtn = document.getElementById("sidebar-toggle-btn");
    if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target) && window.innerWidth <= 1040) {
      sidebar.classList.remove("sidebar-open");
    }
  });
});
