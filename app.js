let QUESTIONS = [];
let current = 0;
const revealedSolutions = new Set();
function freshState() {
  return { subparts: {}, mcq: {}, yesno: {}, proofs: {} };
}
function normalizeState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid attempt");
  const normalized = freshState();
  for (const key of Object.keys(normalized)) {
    if (
      value[key] &&
      typeof value[key] === "object" &&
      !Array.isArray(value[key])
    )
      normalized[key] = value[key];
  }
  return normalized;
}
function loadState() {
  try {
    return normalizeState(
      JSON.parse(localStorage.getItem("cs4261_studio_state_v3") || "{}"),
    );
  } catch {
    return freshState();
  }
}
const STORAGE_KEY = "cs4261_studio_state_v3";
let state = loadState();
// schema of state:
// {
//   subparts: { subpart_id: { input: "...", isCorrect: true/false, checked: true } },
//   mcq: { subpart_id: { choice: 0..3, isCorrect: true/false, score: number } },
//   yesno: { subpart_id: { choice: "Yes"|"No"|"Don't know", score: 0|1|2 } },
//   proofs: { question_id: { text: "...", wordCount: 120, selfScore: 0..8, isDk: false } }
// }
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateStats();
}

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2200);
}

function toggleTheme() {
  document.body.classList.toggle("dark");
  localStorage.setItem(
    "cs4261_theme",
    document.body.classList.contains("dark") ? "dark" : "light",
  );
  document
    .getElementById("themeToggle")
    .setAttribute("aria-pressed", document.body.classList.contains("dark"));
}
if (localStorage.getItem("cs4261_theme") === "dark")
  document.body.classList.add("dark");
document
  .getElementById("themeToggle")
  .setAttribute("aria-pressed", document.body.classList.contains("dark"));

// String normalization
function cleanString(str) {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[;]/g, ",");
}

function parseNumber(val) {
  const clean = cleanString(val);
  if (/^[-+]?\d*\.?\d+$/.test(clean)) return parseFloat(clean);
  if (/^[-+]?\d+\s*\/\s*\d+$/.test(clean)) {
    const parts = clean.split("/");
    return parseFloat(parts[0]) / parseFloat(parts[1]);
  }
  return null;
}

function checkMathMatch(userAns, acceptedList) {
  const cleanUser = cleanString(userAns);
  if (!cleanUser) return false;

  const userNum = parseNumber(cleanUser);

  for (const acc of acceptedList) {
    const cleanAcc = cleanString(acc);
    if (cleanUser === cleanAcc) return true;

    const accNum = parseNumber(cleanAcc);
    if (userNum !== null && accNum !== null) {
      if (Math.abs(userNum - accNum) < 0.015) return true;
    }

    if (cleanUser.includes(cleanAcc) || cleanAcc.includes(cleanUser)) {
      if (cleanUser.length > 3 && cleanAcc.length > 3) return true;
    }
  }
  return false;
}

// Filtering
const practiceSetSelect = document.getElementById("practiceSet");
const weekFilter = document.getElementById("weekFilter");
const typeFilter = document.getElementById("typeFilter");
const topicFilter = document.getElementById("topicFilter");
const diffFilter = document.getElementById("diffFilter");
const questionContainer = document.getElementById("questionList");
const emptyNotice = document.getElementById("empty");

function getFilteredQuestions() {
  const s = practiceSetSelect.value;
  const w = weekFilter.value;
  const t = typeFilter.value;
  const d = diffFilter.value;

  return QUESTIONS.filter((q) => {
    if (s !== "all" && String(q.set) !== s) return false;
    if (w !== "all" && String(q.week) !== w) return false;
    if (t !== "all" && q.type !== t) return false;
    if (d !== "all" && q.difficulty !== d) return false;
    if (topicFilter.value !== "all" && q.topic !== topicFilter.value)
      return false;
    return true;
  });
}

function renderQuestions() {
  const list = getFilteredQuestions();
  questionContainer.innerHTML = "";
  emptyNotice.classList.toggle("hidden", list.length > 0);
  document.getElementById("loading-state").classList.add("hidden");
  current = Math.max(0, Math.min(current, list.length - 1));

  list.slice(current, current + 1).forEach((q) => {
    const idx = current;
    const card = document.createElement("article");
    card.className = `question-card ${q.type}`;
    card.id = `card-${q.id}`;

    let setBadgeLabel = q.set <= 5 ? `Paper ${q.set}` : `Set 6: Capstone`;

    let subpartsHtml = "";

    // Check if question has MCQ subparts with 4 options (A, B, C, D)
    const isStandardMcqSubparts =
      q.subparts &&
      q.subparts.length > 0 &&
      q.subparts[0].options &&
      typeof q.subparts[0].answer === "number";
    const isYesNoSubparts =
      q.subparts &&
      q.subparts.length > 0 &&
      q.subparts[0].options &&
      typeof q.subparts[0].answer === "string";

    if (isStandardMcqSubparts) {
      subpartsHtml =
        `<div class="subpart-list">` +
        q.subparts
          .map((sp) => {
            const saved = state.mcq[sp.id] || {
              choice: null,
              isCorrect: null,
              score: 0,
            };
            const letters = ["A", "B", "C", "D"];

            let optionsListHtml =
              `<div class="mcq-options-grid">` +
              sp.options
                .map((opt, optIdx) => {
                  let cardClass = "mcq-option-card";
                  if (saved.choice !== null) {
                    if (saved.choice === optIdx) {
                      cardClass +=
                        optIdx === sp.answer
                          ? " selected-correct"
                          : " selected-incorrect";
                    } else if (optIdx === sp.answer) {
                      cardClass += " highlight-correct";
                    }
                  }
                  return `
            <button class="${cardClass}" type="button" aria-pressed="${saved.choice === optIdx}" onclick="selectMcqOption('${sp.id}', ${optIdx}, ${sp.answer}, ${sp.marks})">
              <span class="opt-letter">${letters[optIdx]}.</span>
              <span>${opt}</span>
            </button>
          `;
                })
                .join("") +
              `</div>`;

            let feedbackHtml = "";
            if (saved.choice !== null) {
              const isCorrect = saved.choice === sp.answer;
              feedbackHtml = `
            <div class="mcq-feedback-box ${isCorrect ? "correct" : "incorrect"}">
              <div><strong>${isCorrect ? "✓ Correct (+" + sp.marks + " Marks)" : "✗ Incorrect (0/" + sp.marks + " Marks)"}:</strong> ${sp.explanation}</div>
              ${sp.misconception ? `<div class="mcq-misconception"><strong>💡 Common Exam Trap / Misconception:</strong> ${sp.misconception}</div>` : ""}
            </div>
          `;
            }

            return `
          <div class="subpart-item" id="subpart-${sp.id}">
            <div class="subpart-header">
              <span class="subpart-label">${sp.label}</span>
              <span class="subpart-marks">${sp.marks} Marks</span>
            </div>
            <div class="subpart-prompt">${sp.prompt}</div>
            ${optionsListHtml}
            <div id="mcq-feedback-${sp.id}">${feedbackHtml}</div>
          </div>
        `;
          })
          .join("") +
        `</div>`;
    } else if (isYesNoSubparts) {
      // Yes/No conceptual questions with penalty scoring
      subpartsHtml =
        `<div class="subpart-list">` +
        q.subparts
          .map((sp) => {
            const saved = state.yesno[sp.id] || { choice: null, score: 0 };
            let feedbackHtml = "";
            if (saved.choice) {
              if (saved.choice === sp.answer) {
                feedbackHtml = `<div class="yn-feedback correct">✓ Correct (+2 Marks): ${sp.explanation}</div>`;
              } else if (saved.choice === "Don't know") {
                feedbackHtml = `<div class="yn-feedback dk">ℹ Don't Know (+1 Mark Guaranteed): ${sp.explanation}</div>`;
              } else {
                feedbackHtml = `<div class="yn-feedback incorrect">✗ Incorrect (0 Marks): ${sp.explanation}</div>`;
              }
            }
            return `
          <div class="subpart-item" id="subpart-${sp.id}">
            <div class="subpart-header">
              <span class="subpart-label">${sp.label}</span>
              <span class="subpart-marks">${sp.marks} Marks</span>
            </div>
            <div class="subpart-prompt">${sp.prompt}</div>
            <div class="yn-group">
              <button class="yn-btn ${saved.choice === "Yes" ? "selected-yes" : ""}" onclick="selectYesNo('${sp.id}', 'Yes', '${sp.answer}')">Yes</button>
              <button class="yn-btn ${saved.choice === "No" ? "selected-no" : ""}" onclick="selectYesNo('${sp.id}', 'No', '${sp.answer}')">No</button>
              <button class="yn-btn ${saved.choice === "Don't know" ? "selected-dk" : ""}" onclick="selectYesNo('${sp.id}', 'Don\\'t know', '${sp.answer}')">Don't know (+1 pt)</button>
            </div>
            <div id="yn-feedback-${sp.id}">${feedbackHtml}</div>
          </div>
        `;
          })
          .join("") +
        `</div>`;
    } else if (q.type === "short" && q.subparts) {
      subpartsHtml =
        `<div class="subpart-list">` +
        q.subparts
          .map((sp) => {
            const saved = state.subparts[sp.id] || {
              input: "",
              isCorrect: null,
              checked: false,
            };
            let statusBadge = "";
            if (saved.checked) {
              if (saved.isCorrect) {
                statusBadge = `<div class="check-status status-correct">✓ Correct (+${sp.marks} Marks)</div>`;
              } else {
                statusBadge = `<div class="check-status status-incorrect">✗ Incorrect (0/${sp.marks} Marks)</div>`;
              }
            }
            return `
          <div class="subpart-item" id="subpart-${sp.id}">
            <div class="subpart-header">
              <span class="subpart-label">${sp.label}</span>
              <span class="subpart-marks">${sp.marks} Marks</span>
            </div>
            <div class="subpart-prompt">${sp.prompt}</div>
            <div class="input-validation-row">
              <input type="text" class="text-input" id="input-${sp.id}"
                aria-label="Answer for ${sp.id}" placeholder="${sp.placeholder || "Your calculated answer..."}"
                value="${escapeHtml(saved.input)}"
                oninput="onSubpartInput('${sp.id}', this.value)"
                onkeydown="if(event.key==='Enter') verifySubpart('${q.id}', '${sp.id}')">
              <button class="btn-check" onclick="verifySubpart('${q.id}', '${sp.id}')">Check Answer</button>
            </div>
            <div id="status-${sp.id}">${statusBadge}</div>
          </div>
        `;
          })
          .join("") +
        `</div>`;
    } else if (q.type === "proof") {
      const saved = state.proofs[q.id] || {
        text: "",
        wordCount: 0,
        selfScore: null,
        isDk: false,
      };
      subpartsHtml = `
        <div class="proof-area">
          <label class="draft-label" for="textarea-${q.id}">Your proof</label>
          <textarea class="proof-textarea" id="textarea-${q.id}"
            placeholder="Draft your full mathematical proof here. State assumptions, formalize definitions, derive each step logically, and conclude clearly..."
            oninput="onProofInput('${q.id}', this.value)">${escapeHtml(saved.text)}</textarea>
          <div class="proof-meta-bar">
            <span id="wordcount-${q.id}">${saved.wordCount} words</span>
            <button class="btn-dk-proof" onclick="selectProofDontKnow('${q.id}')">I Don't Know (Take Guaranteed 1 Mark)</button>
          </div>
        </div>
      `;
    }

    // Solution Drawer
    let solutionDrawer = "";
    if (q.type === "proof") {
      const saved = state.proofs[q.id] || { selfScore: null };
      const scoreBtns = [0, 1, 2, 3, 4, 5, 6, 7, 8]
        .map(
          (score) => `
        <button class="score-btn ${saved.selfScore === score ? "active" : ""}"
          onclick="setProofScore('${q.id}', ${score})">${score}</button>
      `,
        )
        .join("");

      solutionDrawer = `
        <div class="solution-drawer">
          <button aria-expanded="${revealedSolutions.has(q.id)}" class="btn-toggle-sol" onclick="toggleSolution('${q.id}')">
            <span id="sol-btn-label-${q.id}">${revealedSolutions.has(q.id) ? "Hide Proof Blueprint & Rubric" : "Reveal Proof Blueprint & Rubric"}</span>
          </button>
          <div class="sol-content ${revealedSolutions.has(q.id) ? "is-open" : ""}" id="sol-content-${q.id}">
            ${q.blueprint || ""}
            <div style="margin: 16px 0;">
              <h4 style="color: var(--gold); margin-bottom: 8px;">8-Mark Grading Rubric:</h4>
              <ul style="padding-left: 20px; color: var(--text);">
                ${(q.rubric || []).map((r) => `<li style="margin-bottom: 4px;">${r}</li>`).join("")}
              </ul>
            </div>
            <div class="self-score-box">
              <span class="self-score-label">Self-Awarded Score (0 to 8 Marks):</span>
              <div class="score-btn-group">${scoreBtns}</div>
            </div>
          </div>
        </div>
      `;
    } else {
      solutionDrawer = `
        <div class="solution-drawer">
          <button aria-expanded="${revealedSolutions.has(q.id)}" class="btn-toggle-sol" onclick="toggleSolution('${q.id}')">
            <span id="sol-btn-label-${q.id}">${revealedSolutions.has(q.id) ? "Hide Worked Solution" : "Show Worked Solution & Strategy"}</span>
          </button>
          <div class="sol-content ${revealedSolutions.has(q.id) ? "is-open" : ""}" id="sol-content-${q.id}">
            ${q.solution || ""}
          </div>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="question-topline"><span class="mono">QUESTION ${String(idx + 1).padStart(2, "0")} / ${String(list.length).padStart(2, "0")}</span><span class="badge ${q.difficulty === "Challenging" ? "hard" : ""}">${q.difficulty.toUpperCase()}</span></div>
      <div class="question-topic">${escapeHtml(q.topic)}</div>
      <div class="question-kind">${q.id} · ${setBadgeLabel} · WEEK ${q.week} · ${q.marks} MARKS · ${q.type === "short" ? "CALCULATION" : q.type === "mcq" ? "MULTIPLE CHOICE / YES–NO" : "WRITTEN PROOF"}</div>
      <div class="question-prompt">${q.prompt}</div>
      ${subpartsHtml}
      ${solutionDrawer}
      <div class="question-actions"><button class="secondary-button" type="button" onclick="go(-1)" ${current === 0 ? "disabled" : ""}>← Previous</button><button class="primary-button" type="button" onclick="go(1)">${current === list.length - 1 ? "Back to first question ↺" : "Next question →"}</button></div>
    `;

    questionContainer.appendChild(card);
  });

  // Render KaTeX
  if (window.renderMathInElement) {
    renderMathInElement(questionContainer, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
    });
  }

  updateStats();
}

function escapeHtml(str) {
  return String(str || "").replace(
    /[&<>"']/g,
    (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[m],
  );
}

// User interactions
function selectMcqOption(spId, choiceIdx, correctIdx, marks) {
  const isCorrect = choiceIdx === correctIdx;
  const score = isCorrect ? marks : 0;
  state.mcq[spId] = {
    choice: choiceIdx,
    isCorrect,
    score,
  };
  saveState();
  renderQuestions();
  toast(
    isCorrect
      ? `Correct! +${marks} Marks`
      : `Incorrect (0/${marks} Marks). Check rationale below.`,
  );
}

function onSubpartInput(spId, val) {
  if (!state.subparts[spId]) state.subparts[spId] = {};
  state.subparts[spId].input = val;
  state.subparts[spId].checked = false;
  state.subparts[spId].isCorrect = null;
  const status = document.getElementById(`status-${spId}`);
  if (status) status.textContent = "";
  saveState();
}

function verifySubpart(qId, spId) {
  const q = QUESTIONS.find((item) => item.id === qId);
  if (!q) return;
  const sp = q.subparts.find((item) => item.id === spId);
  if (!sp) return;

  const inputEl = document.getElementById(`input-${spId}`);
  const userAns = inputEl ? inputEl.value : "";
  const isMatch = checkMathMatch(userAns, sp.accepted || []);

  state.subparts[spId] = {
    input: userAns,
    isCorrect: isMatch,
    checked: true,
  };
  saveState();

  const statusContainer = document.getElementById(`status-${spId}`);
  if (statusContainer) {
    if (isMatch) {
      statusContainer.innerHTML = `<div class="check-status status-correct">✓ Correct (+${sp.marks} Marks)</div>`;
      toast(`Correct! +${sp.marks} marks awarded.`);
    } else {
      statusContainer.innerHTML = `<div class="check-status status-incorrect">✗ Incorrect (0/${sp.marks} Marks)</div>`;
      toast(`Not quite. Try again or check the worked solution.`);
    }
  }
}

function selectYesNo(spId, choice, correctAns) {
  let score = 0;
  if (choice === correctAns) score = 2;
  else if (choice === "Don't know") score = 1;
  else score = 0;

  state.yesno[spId] = { choice, score };
  saveState();
  renderQuestions();
  toast(
    choice === correctAns
      ? "Correct! +2 Marks"
      : choice === "Don't know"
        ? "Don't know recorded: +1 Mark"
        : "Incorrect: 0 Marks",
  );
}

function onProofInput(qId, text) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  if (!state.proofs[qId]) state.proofs[qId] = { selfScore: null };
  state.proofs[qId].text = text;
  state.proofs[qId].wordCount = words;
  state.proofs[qId].isDk = false;

  const countEl = document.getElementById(`wordcount-${qId}`);
  if (countEl) countEl.textContent = `${words} words`;
  saveState();
}

function selectProofDontKnow(qId) {
  if (!state.proofs[qId]) state.proofs[qId] = {};
  state.proofs[qId].text = "Don't know";
  state.proofs[qId].wordCount = 2;
  state.proofs[qId].selfScore = 1;
  state.proofs[qId].isDk = true;
  saveState();
  renderQuestions();
  toast("Recorded 'Don't know' for proof: +1 Mark guaranteed");
}

function setProofScore(qId, score) {
  if (!state.proofs[qId]) state.proofs[qId] = { text: "", wordCount: 0 };
  state.proofs[qId].selfScore = score;
  saveState();
  renderQuestions();
  toast(`Self-awarded score for ${qId}: ${score}/8 Marks`);
}

function toggleSolution(qId) {
  if (revealedSolutions.has(qId)) revealedSolutions.delete(qId);
  else revealedSolutions.add(qId);
  renderQuestions();
}

function updateStats() {
  const shown = getFilteredQuestions();
  document.getElementById("statShown").textContent = shown.length;

  let answeredCount = 0;
  let totalAvailableMarks = 0;
  let totalScore = 0;

  shown.forEach((q) => {
    totalAvailableMarks += q.marks;

    let questionAnyAnswered = false;

    if (q.subparts) {
      q.subparts.forEach((sp) => {
        // Check MCQ
        const mcqItem = state.mcq[sp.id];
        if (mcqItem && mcqItem.choice !== null) {
          questionAnyAnswered = true;
          totalScore += mcqItem.score;
        }

        // Check Yes/No
        const ynItem = state.yesno[sp.id];
        if (ynItem && ynItem.choice) {
          questionAnyAnswered = true;
          totalScore += ynItem.score;
        }

        // Check calculation subpart
        const calcItem = state.subparts[sp.id];
        if (calcItem && calcItem.input && calcItem.input.trim()) {
          questionAnyAnswered = true;
        }
        if (calcItem && calcItem.isCorrect) {
          totalScore += sp.marks;
        }
      });
    }

    if (q.type === "proof") {
      const proofItem = state.proofs[q.id];
      if (
        proofItem &&
        ((proofItem.text || "").trim() || proofItem.selfScore != null)
      ) {
        questionAnyAnswered = true;
        if (proofItem.selfScore != null) totalScore += proofItem.selfScore;
      }
    }

    if (questionAnyAnswered) answeredCount++;
  });

  document.getElementById("statAnswered").textContent = answeredCount;
  document.getElementById("statMarks").textContent = totalAvailableMarks;
  document.getElementById("statScore").textContent = totalScore;
  document.getElementById("progress-bar").style.width = shown.length
    ? (answeredCount / shown.length) * 100 + "%"
    : "0%";
  const mcqs = shown
    .flatMap((q) => q.subparts || [])
    .filter((sp) => sp.options && state.mcq[sp.id]?.choice != null);
  const correct = mcqs.filter(
    (sp) => state.mcq[sp.id].choice === sp.answer,
  ).length;
  document.getElementById("accuracyStat").textContent = mcqs.length
    ? Math.round((correct / mcqs.length) * 100) + "%"
    : "—";
}

function clearFilters() {
  [practiceSetSelect, weekFilter, typeFilter, diffFilter, topicFilter].forEach(
    (el) => {
      el.value = "all";
    },
  );
  current = 0;
  renderQuestions();
}
[practiceSetSelect, weekFilter, typeFilter, diffFilter, topicFilter].forEach(
  (el) =>
    el.addEventListener("change", () => {
      current = 0;
      renderQuestions();
    }),
);
document
  .getElementById("clearFiltersBtn")
  .addEventListener("click", clearFilters);
function go(delta) {
  const list = getFilteredQuestions();
  if (!list.length) return;
  current = (current + delta + list.length) % list.length;
  renderQuestions();
  questionContainer.scrollIntoView({ behavior: "smooth", block: "start" });
}
document.addEventListener("keydown", (event) => {
  if (
    event.target.matches("textarea, input, select, [contenteditable]") ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  )
    return;
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    event.preventDefault();
    go(event.key === "ArrowRight" ? 1 : -1);
  }
});

// JSON Export & Import
document.getElementById("exportJsonBtn").addEventListener("click", () => {
  const data = JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      state,
    },
    null,
    2,
  );
  downloadFile(
    `cs4261-practice-backup-${new Date().toISOString().slice(0, 10)}.json`,
    data,
    "application/json",
  );
  toast("Attempt saved as JSON backup");
});

document.getElementById("importJsonBtn").addEventListener("click", () => {
  document.getElementById("importFileInput").click();
});

document
  .getElementById("importFileInput")
  .addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.state) {
        state = normalizeState(parsed.state);
        saveState();
        renderQuestions();
        toast("Backup attempt restored successfully!");
      } else {
        alert("Invalid backup file format.");
      }
    } catch (err) {
      alert("Failed to parse JSON file.");
    }
    e.target.value = "";
  });

// Reset
document.getElementById("resetBtn").addEventListener("click", () => {
  if (
    confirm(
      "Are you sure you want to reset all responses in this browser? This cannot be undone.",
    )
  ) {
    state = freshState();
    revealedSolutions.clear();
    saveState();
    renderQuestions();
    toast("All responses reset.");
  }
});

// Markdown Export for LLM Grader
document.getElementById("exportMdBtn").addEventListener("click", () => {
  const shown = getFilteredQuestions();
  let md = `# CS4261 Midterm Practice Submission & Grader Evaluation Package\n\n`;
  md += `## Metadata\n`;
  md += `- Date: ${new Date().toISOString()}\n`;
  md += `- Total Questions Included: ${shown.length}\n`;
  md += `- Total Available Marks: ${shown.reduce((acc, q) => acc + q.marks, 0)}\n\n`;

  md += `## Instructions to LLM Grader\n`;
  md += `You are an expert examiner for NUS CS4261 (Algorithmic Mechanism Design). Grade the student's submission question by question according to the official reference answer, step-by-step logic, and itemized grading rubric provided.\n`;
  md += `Provide detailed feedback for partial credit, highlight any misconceptions, and return an itemized score table.\n\n`;

  shown.forEach((q, i) => {
    md += `---\n\n### Question ${i + 1}: ${q.id} — ${q.topic} (${q.marks} Marks)\n\n`;
    md += `**Setting & Prompt:**\n${q.prompt}\n\n`;

    if (q.subparts) {
      q.subparts.forEach((sp) => {
        if (sp.options && typeof sp.answer === "number") {
          const m = state.mcq[sp.id];
          const choiceLetter =
            m && m.choice !== null
              ? ["A", "B", "C", "D"][m.choice]
              : "[No response]";
          const choiceText =
            m && m.choice !== null ? sp.options[m.choice] : "[No response]";
          md += `**${sp.label} [${sp.marks} Marks]:** ${sp.prompt}\n`;
          md += `- **Student Selected:** Option ${choiceLetter}: ${choiceText} (${m && m.isCorrect ? "Correct" : "Incorrect"})\n`;
          md += `- **Correct Answer:** Option ${["A", "B", "C", "D"][sp.answer]}: ${sp.options[sp.answer]}\n\n`;
        } else if (sp.options && typeof sp.answer === "string") {
          const userChoice =
            state.yesno[sp.id]?.choice || "[No response provided]";
          md += `**${sp.label} [${sp.marks} Marks]:** ${sp.prompt}\n`;
          md += `- **Student Selected:** ${userChoice} (Correct Answer: ${sp.answer})\n\n`;
        } else {
          const userVal = (
            state.subparts[sp.id]?.input || "[No response provided]"
          ).trim();
          md += `**${sp.label} [${sp.marks} Marks]:** ${sp.prompt}\n`;
          md += `- **Student Response:** ${userVal}\n\n`;
        }
      });
    } else if (q.type === "proof") {
      const p = state.proofs[q.id] || {};
      const userProof = (p.text || "[No response provided]").trim();
      md += `**Student Written Proof:**\n\n${userProof}\n\n`;
      if (p.selfScore != null) {
        md += `*Student Self-Assessed Score:* ${p.selfScore} / 8 Marks\n\n`;
      }
    }

    md += `**Official Reference Solution / Blueprint:**\n`;
    md += `${q.reference || q.solution || q.blueprint || "No reference answer provided."}\n\n`;

    if (q.rubric) {
      md += `**Grading Rubric Criteria:**\n`;
      q.rubric.forEach((r) => (md += `- ${r}\n`));
      md += `\n`;
    }
  });

  downloadFile(
    `cs4261-submission-${new Date().toISOString().slice(0, 10)}.md`,
    md,
    "text/markdown",
  );
  toast("Exported Markdown submission for LLM grading!");
});

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

async function init() {
  try {
    const response = await fetch("./questions.json");
    if (!response.ok)
      throw new Error(`Question bank request failed (${response.status})`);
    const data = await response.json();
    QUESTIONS = shuffled(data.questions);
    [...new Set(QUESTIONS.map((q) => q.topic))].sort().forEach((topic) => {
      const option = document.createElement("option");
      option.value = topic;
      option.textContent = topic;
      topicFilter.appendChild(option);
    });
    document.getElementById("load-status").textContent =
      `${QUESTIONS.length} questions ready · randomized`;
    document.getElementById("load-status").classList.add("ready");
    renderQuestions();
  } catch (error) {
    document.getElementById("loading-state").innerHTML =
      "<h2>Could not load the question bank</h2><p>Open this site through GitHub Pages or a local web server so the question data can be fetched.</p>";
    document.getElementById("load-status").textContent =
      "Question bank unavailable";
    console.error(error);
  }
}
init();
