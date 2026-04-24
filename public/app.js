const API_BASE_URL = "https://hardik-agrawal-submission.onrender.com/";

const sampleEdges = [
  "A->B", "A->C", "B->D", "C->E", "E->F",
  "X->Y", "Y->X",
  "B->D",
  "hello", "1->2", "A->",
  "G->H", "G->H", "G->I",
  "P->Q", "Q->R"
];

const inputBox = document.getElementById("data-input");
const submitBtn = document.getElementById("btn-submit");
const clearBtn = document.getElementById("btn-clear");
const exampleBtn = document.getElementById("btn-load-example");
const errBanner = document.getElementById("error-banner");
const errMsg = document.getElementById("error-message");
const errCloseBtn = document.getElementById("error-close");
const resultsPanel = document.getElementById("results-section");
const idRow = document.getElementById("identity-row");
const summaryRow = document.getElementById("summary-row");
const treesGrid = document.getElementById("hierarchies-grid");
const issuesRow = document.getElementById("issues-row");
const rawBtn = document.getElementById("btn-toggle-raw");
const rawOverlay = document.getElementById("raw-json-overlay");
const rawBox = document.getElementById("raw-json-content");
const rawCloseBtn = document.getElementById("raw-json-close");

let cachedResponse = null;

submitBtn.addEventListener("click", handleSubmit);
clearBtn.addEventListener("click", handleClear);
exampleBtn.addEventListener("click", loadSampleData);
errCloseBtn.addEventListener("click", () => dismissError());
rawBtn.addEventListener("click", () => openRawView());
rawCloseBtn.addEventListener("click", () => closeRawView());
rawOverlay.addEventListener("click", e => { if (e.target === rawOverlay) closeRawView(); });

inputBox.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    handleSubmit();
  }
});

function loadSampleData() {
  inputBox.value = JSON.stringify({ data: sampleEdges }, null, 2);
  inputBox.focus();
  inputBox.style.transition = "background 0.3s";
  inputBox.style.background = "rgba(99, 102, 241, 0.05)";
  setTimeout(() => { inputBox.style.background = ""; }, 400);
}

function handleClear() {
  inputBox.value = "";
  dismissError();
  resultsPanel.style.display = "none";
  cachedResponse = null;
  inputBox.focus();
}

async function handleSubmit() {
  dismissError();
  const raw = inputBox.value.trim();

  if (!raw) {
    showError("Please enter some data before submitting.");
    return;
  }

  let entries;
  try {
    const parsed = JSON.parse(raw);
    if (parsed.data && Array.isArray(parsed.data)) {
      entries = parsed.data;
    } else if (Array.isArray(parsed)) {
      entries = parsed;
    } else {
      throw new Error("bad format");
    }
  } catch {
    entries = raw.split("\n").map(l => l.trim()).filter(l => l.length > 0);
  }

  if (entries.length === 0) {
    showError("No entries found. Please check your input.");
    return;
  }

  submitBtn.classList.add("loading");
  submitBtn.disabled = true;

  try {
    const base = API_BASE_URL || window.location.origin;
    const resp = await fetch(`${base}/bfhl`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: entries })
    });

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      throw new Error(body.error || `Status ${resp.status}`);
    }

    const json = await resp.json();
    cachedResponse = json;
    showResults(json);
  } catch (err) {
    showError(`Error: ${err.message}`);
  } finally {
    submitBtn.classList.remove("loading");
    submitBtn.disabled = false;
  }
}

function showResults(data) {
  resultsPanel.style.display = "block";
  setTimeout(() => resultsPanel.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  buildIdentityCards(data);
  buildSummaryCards(data.summary);
  buildTreeCards(data.hierarchies);
  buildIssueCards(data.invalid_entries, data.duplicate_edges);
}

function buildIdentityCards(data) {
  idRow.innerHTML = `
    <div class="identity-card">
      <span class="identity-label">User ID</span>
      <span class="identity-value">${safeText(data.user_id)}</span>
    </div>
    <div class="identity-card">
      <span class="identity-label">Email</span>
      <span class="identity-value">${safeText(data.email_id)}</span>
    </div>
    <div class="identity-card">
      <span class="identity-label">Roll Number</span>
      <span class="identity-value">${safeText(data.college_roll_number)}</span>
    </div>
  `;
}

function buildSummaryCards(summary) {
  summaryRow.innerHTML = `
    <div class="summary-card trees">
      <div class="summary-number">${summary.total_trees}</div>
      <div class="summary-label">Valid Trees</div>
    </div>
    <div class="summary-card cycles">
      <div class="summary-number">${summary.total_cycles}</div>
      <div class="summary-label">Cycles Detected</div>
    </div>
    <div class="summary-card largest">
      <div class="summary-number">${safeText(summary.largest_tree_root) || "—"}</div>
      <div class="summary-label">Largest Tree Root</div>
    </div>
  `;
}

function buildTreeCards(hierarchies) {
  if (!hierarchies || hierarchies.length === 0) {
    treesGrid.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted); font-size:0.9rem;">No hierarchies to display.</div>`;
    return;
  }

  treesGrid.innerHTML = hierarchies.map((h, i) => {
    const isCycle = h.has_cycle === true;
    return `
      <div class="hierarchy-card ${isCycle ? "cyclic" : ""}" style="animation-delay: ${i * 80}ms">
        <div class="hierarchy-header">
          <div class="hierarchy-root">
            <div class="root-node">${safeText(h.root)}</div>
            <span class="root-label">Root Node</span>
          </div>
          <div class="hierarchy-badges">
            ${isCycle
        ? `<span class="cycle-badge">
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                   CYCLE
                 </span>`
        : `<span class="depth-badge">Depth: ${h.depth}</span>`
      }
          </div>
        </div>
        <div class="hierarchy-body">
          ${isCycle ? cycleMsg() : drawTree(h.tree)}
        </div>
      </div>
    `;
  }).join("");
}

function cycleMsg() {
  return `
    <div class="cycle-message">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
      </svg>
      Cycle detected — tree structure cannot be displayed.
    </div>
  `;
}

function drawTree(treeObj) {
  if (!treeObj || Object.keys(treeObj).length === 0) {
    return '<div class="issue-empty">Empty tree</div>';
  }
  const lines = [];
  walkTree(treeObj, "", lines);
  return `<div class="tree-container">${lines.join("")}</div>`;
}

function walkTree(obj, prefix, lines) {
  const keys = Object.keys(obj).sort();
  keys.forEach((key, idx) => {
    const last = idx === keys.length - 1;
    const connector = prefix === "" ? "" : last ? "└─ " : "├─ ";
    const nextPrefix = prefix === "" ? "" : prefix + (last ? "   " : "│  ");

    lines.push(`
      <div class="tree-node">
        <span class="tree-branch">${safeText(prefix + connector)}</span>
        <span class="node-name">${safeText(key)}</span>
      </div>
    `);

    const sub = obj[key];
    if (sub && typeof sub === "object" && Object.keys(sub).length > 0) {
      walkTree(sub, nextPrefix, lines);
    }
  });
}

function buildIssueCards(badList, dupList) {
  const hasBad = badList && badList.length > 0;
  const hasDup = dupList && dupList.length > 0;

  issuesRow.innerHTML = `
    <div class="issue-card invalid">
      <div class="issue-header">
        <div class="issue-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          Invalid Entries
        </div>
        <span class="issue-count">${badList ? badList.length : 0}</span>
      </div>
      <div class="issue-body">
        ${hasBad
      ? `<ul class="issue-list">${badList.map(e => `<li class="issue-chip">${safeText(e || '""')}</li>`).join("")}</ul>`
      : `<span class="issue-empty">No invalid entries found</span>`
    }
      </div>
    </div>
    <div class="issue-card duplicate">
      <div class="issue-header">
        <div class="issue-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2"><rect x="8" y="2" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Duplicate Edges
        </div>
        <span class="issue-count">${dupList ? dupList.length : 0}</span>
      </div>
      <div class="issue-body">
        ${hasDup
      ? `<ul class="issue-list">${dupList.map(e => `<li class="issue-chip">${safeText(e)}</li>`).join("")}</ul>`
      : `<span class="issue-empty">No duplicate edges found</span>`
    }
      </div>
    </div>
  `;
}

function openRawView() {
  if (!cachedResponse) return;
  rawBox.textContent = JSON.stringify(cachedResponse, null, 2);
  rawOverlay.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function closeRawView() {
  rawOverlay.style.display = "none";
  document.body.style.overflow = "";
}

function showError(msg) {
  errMsg.textContent = msg;
  errBanner.style.display = "flex";
}

function dismissError() {
  errBanner.style.display = "none";
}

function safeText(str) {
  if (str === null || str === undefined) return "";
  const el = document.createElement("div");
  el.textContent = String(str);
  return el.innerHTML;
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeRawView();
});
