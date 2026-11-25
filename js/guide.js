/**
 * Interactive Problem Guide renderer for Infinity DSA (by InfinityDevLog).
 */
(function () {
  const esc = window.InfinityDSA.escapeHtml;

  const state = {
    catalog: null,
    problem: null,
    guide: null,
    dryStep: 0,
    selectedApproachIdx: 0,
    selectedLanguage: null,
  };

  function difficultyBadgeClass(diff) {
    if (diff === "Easy") return "badge-easy";
    if (diff === "Medium") return "badge-medium";
    if (diff === "Hard") return "badge-hard";
    return "badge-unknown";
  }

  function accessBadgeClass(access) {
    if (access === "Free") return "badge-free";
    if (access === "Premium") return "badge-premium";
    return "badge-unknown";
  }

  function problemHref(problem) {
    if (problem.slug && problem.slug !== "unknown") {
      return `problem.html?slug=${encodeURIComponent(problem.slug)}`;
    }
    return `problem.html?id=${encodeURIComponent(problem.number)}`;
  }

  function renderAuxPanel(aux) {
    if (!aux || !Array.isArray(aux.entries) || aux.entries.length === 0) {
      return "";
    }
    const chips = aux.entries
      .map((entry) => {
        const cls = entry.highlight ? "aux-chip highlight" : "aux-chip";
        const label =
          entry.key !== undefined && entry.key !== null && entry.key !== ""
            ? `${esc(entry.key)}: ${esc(entry.value)}`
            : `${esc(entry.value)}`;
        return `<span class="${cls}">${label}</span>`;
      })
      .join("");
    return `
      <div class="aux-panel">
        <div class="aux-title">${esc(aux.title || "State")}</div>
        <div class="aux-entries">${chips}</div>
      </div>`;
  }

  function renderDiagram(diagram) {
    if (!diagram) {
      return `<p class="muted">No diagram data provided.</p>`;
    }

    const type = diagram.type || "array";
    let bodyHtml = "";

    if (type === "array" || type === "two-pointers" || type === "hash" || type === "stack") {
      const pointersByIndex = new Map();
      (diagram.pointers || []).forEach((ptr) => {
        const idx = ptr.index;
        if (!pointersByIndex.has(idx)) pointersByIndex.set(idx, []);
        pointersByIndex.get(idx).push(ptr.name);
      });

      const cells = (diagram.items || [])
        .map((item) => {
          const ptrs = (pointersByIndex.get(item.index) || [])
            .map((name) => `<span class="pointer-tag">${esc(name)}</span>`)
            .join("");
          const stateCls = item.state ? `state-${esc(item.state)}` : "";
          const labelHtml = item.label
            ? `<span class="cell-label">${esc(item.label)}</span>`
            : "";
          return `
            <div class="cell-wrap">
              <div class="cell-pointers">${ptrs}</div>
              <div class="cell-box ${stateCls}">${esc(item.value)}</div>
              <span class="cell-index">idx ${esc(item.index)}</span>
              ${labelHtml}
            </div>`;
        })
        .join("");

      bodyHtml = `<div class="diagram-array-row">${cells}</div>`;
    } else if (type === "linked-list") {
      const ptrsByNode = new Map();
      (diagram.pointers || []).forEach((ptr) => {
        if (!ptrsByNode.has(ptr.nodeId)) ptrsByNode.set(ptr.nodeId, []);
        ptrsByNode.get(ptr.nodeId).push(ptr.name);
      });

      const nodes = (diagram.nodes || [])
        .map((node, idx, arr) => {
          const ptrs = (ptrsByNode.get(node.id) || [])
            .map((name) => `<span class="pointer-tag">${esc(name)}</span>`)
            .join("");
          const stateCls = node.state ? `state-${esc(node.state)}` : "";
          const arrow = idx < arr.length - 1 ? `<span class="ll-arrow">→</span>` : `<span class="ll-arrow">→ null</span>`;
          return `
            <div class="cell-wrap">
              <div class="cell-pointers">${ptrs}</div>
              <div class="cell-box ${stateCls}">${esc(node.value)}</div>
              ${node.label ? `<span class="cell-label">${esc(node.label)}</span>` : ""}
            </div>
            ${arrow}`;
        })
        .join("");

      bodyHtml = `<div class="ll-row">${nodes}</div>`;
    } else if (type === "grid") {
      const ptrMap = new Map();
      (diagram.pointers || []).forEach((p) => {
        ptrMap.set(`${p.r},${p.c}`, p.name);
      });

      const rowsHtml = (diagram.rows || [])
        .map((row, rIdx) => {
          const tds = row
            .map((cell, cIdx) => {
              const obj = typeof cell === "object" && cell !== null ? cell : { value: cell };
              const stateCls = obj.state ? `state-${esc(obj.state)}` : "";
              const ptr = ptrMap.get(`${rIdx},${cIdx}`);
              return `<td class="${stateCls}" title="(${rIdx}, ${cIdx})">${esc(obj.value)}${
                ptr ? `<div class="pointer-tag">${esc(ptr)}</div>` : ""
              }</td>`;
            })
            .join("");
          return `<tr>${tds}</tr>`;
        })
        .join("");
      bodyHtml = `<table class="grid-table">${rowsHtml}</table>`;
    } else if (type === "tree" || type === "graph") {
      const nodes = diagram.nodes || [];
      const edges = diagram.edges || [];
      const nodeById = new Map(nodes.map((n) => [n.id, n]));
      const width = diagram.width || 560;
      const height = diagram.height || 230;

      const edgeSvgs = edges
        .map((edge) => {
          const from = nodeById.get(edge.from);
          const to = nodeById.get(edge.to);
          if (!from || !to) return "";
          const stroke = edge.state === "match" ? "var(--easy)" : "var(--border-strong)";
          return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${stroke}" stroke-width="2.5" />`;
        })
        .join("");

      const nodeSvgs = nodes
        .map((n) => {
          let fill = "var(--surface)";
          let stroke = "var(--border-strong)";
          if (n.state === "active") {
            fill = "var(--accent-soft)";
            stroke = "var(--accent)";
          } else if (n.state === "match") {
            fill = "var(--easy-bg)";
            stroke = "var(--easy)";
          }
          return `
            <g>
              <circle cx="${n.x}" cy="${n.y}" r="22" fill="${fill}" stroke="${stroke}" stroke-width="2.5"></circle>
              <text x="${n.x}" y="${n.y + 5}" text-anchor="middle" fill="var(--text)" font-size="13" font-weight="700" font-family="var(--font-mono)">${esc(n.label)}</text>
            </g>`;
        })
        .join("");

      bodyHtml = `<svg class="svg-diagram" viewBox="0 0 ${width} ${height}" role="img" aria-label="Problem structure diagram">${edgeSvgs}${nodeSvgs}</svg>`;
    }

    const auxHtml = renderAuxPanel(diagram.aux);
    const captionHtml = diagram.caption
      ? `<p class="diagram-caption">${esc(diagram.caption)}</p>`
      : "";

    return `<div class="diagram-stage">${bodyHtml}${auxHtml}${captionHtml}</div>`;
  }

  function renderPendingView(problem, neighbors) {
    const isPremium = problem.access === "Premium";
    const topicsHtml = (problem.topics || ["unknown"])
      .map((t) => `<a class="topic-chip" href="index.html?topic=${encodeURIComponent(t)}">${esc(t)}</a>`)
      .join("");

    return `
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="index.html">Infinity DSA</a>
        <span aria-hidden="true">/</span>
        <span>#${esc(problem.number)} ${esc(problem.title)}</span>
      </nav>

      <section class="guide-hero">
        <div class="guide-hero-top">
          <div>
            <div class="badge-row">
              <span class="problem-num">#${esc(problem.number)}</span>
              <span class="badge ${difficultyBadgeClass(problem.difficulty)}">${esc(problem.difficulty)}</span>
              <span class="badge ${accessBadgeClass(problem.access)}">${esc(problem.access)}</span>
              <span class="badge badge-pending">Guide pending</span>
            </div>
            <h1>${esc(problem.title)}</h1>
            <div class="topic-list">${topicsHtml}</div>
          </div>
          <div class="guide-hero-actions">
            <button type="button" class="btn btn-secondary" id="copyShareBtn">Share link</button>
            ${
              problem.url && problem.url !== "unknown"
                ? `<a class="btn btn-primary" href="${esc(problem.url)}" target="_blank" rel="noopener noreferrer">Open Official Problem ↗</a>`
                : ""
            }
          </div>
        </div>
      </section>

      <section class="guide-card pending-card">
        <h2>Guide pending</h2>
        <p>
          We have indexed problem <strong>#${esc(problem.number)} (${esc(problem.title)})</strong> in the Infinity DSA catalog (slug: <code>${esc(problem.slug)}</code>, category: <code>${esc(problem.category || "unknown")}</code>), and its full step-by-step guide is not yet written.
        </p>
        ${
          isPremium
            ? `<p><strong>Access note:</strong> This entry is marked as <strong>Premium</strong> on LeetCode. Infinity DSA respects access restrictions and only indexes public catalog metadata alongside the official link.</p>`
            : `<p>Use the official link above to read the canonical problem statement on LeetCode while our plain-language explanation, diagram, dry run, and multi-language implementations are added in an upcoming batch.</p>`
        }
        <div class="guide-hero-actions" style="margin-top: 16px;">
          ${
            problem.url && problem.url !== "unknown"
              ? `<a class="btn btn-primary" href="${esc(problem.url)}" target="_blank" rel="noopener noreferrer">View on LeetCode ↗</a>`
              : ""
          }
          <a class="btn btn-secondary" href="index.html">Back to Catalog</a>
          ${neighbors.prev ? `<a class="btn btn-secondary" href="${problemHref(neighbors.prev)}">← #${esc(neighbors.prev.number)}</a>` : ""}
          ${neighbors.next ? `<a class="btn btn-secondary" href="${problemHref(neighbors.next)}">#${esc(neighbors.next.number)} →</a>` : ""}
        </div>
      </section>`;
  }

  function renderFullGuide(problem, guide, neighbors) {
    const u = guide.understand;
    const approaches = guide.approaches || [];
    const allLanguages = (state.catalog.meta && state.catalog.meta.allLanguages) || [];
    const activeApproach = approaches[state.selectedApproachIdx] || approaches[0];
    const currentStep = guide.dryRun.steps[state.dryStep] || guide.dryRun.steps[0];

    const topicsHtml = (problem.topics || ["unknown"])
      .map((t) => `<a class="topic-chip" href="index.html?topic=${encodeURIComponent(t)}">${esc(t)}</a>`)
      .join("");

    const termsHtml = (u.terms || [])
      .map(
        (term) => `
        <div class="glossary-item">
          <strong>${esc(term.term)}</strong>
          <span>${esc(term.definition)}</span>
        </div>`
      )
      .join("");

    const rulesHtml = (u.rules || []).map((r) => `<li>${esc(r)}</li>`).join("");

    const comparisonRows = approaches
      .map(
        (ap, idx) => `
        <tr>
          <td>
            <strong>${esc(ap.name)}</strong>
            ${ap.recommended ? `<div><span class="badge badge-available">Recommended</span></div>` : ""}
          </td>
          <td>${esc(ap.coreIdeaSummary || ap.coreIdea)}</td>
          <td><code>${esc(ap.complexity.time)}</code></td>
          <td><code>${esc(ap.complexity.space)}</code></td>
          <td>${esc(ap.complexity.boundType || "Worst-case")}</td>
          <td><button type="button" class="btn btn-secondary btn-sm" data-pick-approach="${idx}">Inspect</button></td>
        </tr>`
      )
      .join("");

    const approachTabs = approaches
      .map(
        (ap, idx) => `
        <button type="button" class="approach-tab ${idx === state.selectedApproachIdx ? "active" : ""}" data-approach-tab="${idx}">
          ${esc(ap.name)}${ap.recommended ? " ★" : ""}
        </button>`
      )
      .join("");

    const availableCodeMap = activeApproach.code || {};
    const availableLangsForApproach = allLanguages.filter(
      (lang) => typeof availableCodeMap[lang] === "string" && availableCodeMap[lang].trim() !== ""
    );

    if (!state.selectedLanguage || !availableCodeMap[state.selectedLanguage]) {
      state.selectedLanguage = availableLangsForApproach[0] || null;
    }

    const langButtons = allLanguages
      .map((lang) => {
        const exists = typeof availableCodeMap[lang] === "string" && availableCodeMap[lang].trim() !== "";
        const active = lang === state.selectedLanguage;
        return `<button type="button" class="lang-pill ${active ? "active" : ""}" data-lang="${esc(lang)}" ${
          exists ? "" : 'disabled title="Not yet implemented for this approach"'
        }>${esc(lang)}</button>`;
      })
      .join("");

    const selectedCode = state.selectedLanguage ? availableCodeMap[state.selectedLanguage] : "// No code available";
    const verifiedSet = new Set((guide.verification && guide.verification.verifiedLanguages) || []);
    const isVerifiedLang = state.selectedLanguage && verifiedSet.has(state.selectedLanguage);
    const verifyLabel = state.selectedLanguage
      ? isVerifiedLang
        ? "Verified locally against test suite"
        : "Not locally tested (runtime unavailable)"
      : "No language selected";

    const canRunInBrowser = state.selectedLanguage === "JavaScript" && Array.isArray(guide.tests) && guide.tests.length > 0 && guide.jsFunctionName;

    return `
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="index.html">Infinity DSA</a>
        <span aria-hidden="true">/</span>
        <span>#${esc(problem.number)} ${esc(problem.title)}</span>
      </nav>

      <section class="guide-hero">
        <div class="guide-hero-top">
          <div>
            <div class="badge-row">
              <span class="problem-num">#${esc(problem.number)}</span>
              <span class="badge ${difficultyBadgeClass(problem.difficulty)}">${esc(problem.difficulty)}</span>
              <span class="badge ${accessBadgeClass(problem.access)}">${esc(problem.access)}</span>
              <span class="badge badge-available">Complete Guide</span>
            </div>
            <h1>${esc(problem.title)}</h1>
            <div class="topic-list">${topicsHtml}</div>
          </div>
          <div class="guide-hero-actions">
            <button type="button" class="btn btn-secondary" id="copyShareBtn">Share link</button>
            ${
              problem.url && problem.url !== "unknown"
                ? `<a class="btn btn-primary" href="${esc(problem.url)}" target="_blank" rel="noopener noreferrer">Official Problem ↗</a>`
                : ""
            }
          </div>
        </div>

        <nav class="guide-toc" aria-label="Guide sections">
          <a class="toc-pill" href="#understand">1. What are we trying to find?</a>
          <a class="toc-pill" href="#dry-run">2. Interactive Dry Run</a>
          <a class="toc-pill" href="#approaches">3. Approaches &amp; Complexity</a>
          <a class="toc-pill" href="#code">4. Code (${esc(availableLangsForApproach.length)}/${esc(allLanguages.length)} languages)</a>
        </nav>
      </section>

      <section class="guide-card" id="understand">
        <h2>1. What are we trying to find?</h2>
        <p><strong>${esc(u.question)}</strong></p>
        <p>${esc(u.plainExplanation)}</p>

        <div class="two-col">
          <div class="info-box">
            <h4>What the input means</h4>
            <p style="margin:0">${esc(u.inputMeaning)}</p>
          </div>
          <div class="info-box">
            <h4>What the output represents</h4>
            <p style="margin:0">${esc(u.outputMeaning)}</p>
          </div>
        </div>

        <h3>Rules that affect the answer</h3>
        <ul>${rulesHtml}</ul>

        ${
          termsHtml
            ? `<h3>Key terms</h3><div class="glossary-grid">${termsHtml}</div>`
            : ""
        }

        <div class="example-box">
          <h3 style="margin-top:0">Example 1 — Core walkthrough</h3>
          <div class="mono-io"><strong>Input:</strong> ${esc(u.example1.input)}\n<strong>Output:</strong> ${esc(u.example1.output)}</div>
          <p style="margin-bottom:0">${esc(u.example1.whyValid)}</p>
          ${renderDiagram(u.example1.diagram)}
        </div>

        <div class="example-box edge">
          <h3 style="margin-top:0">Example 2 — Edge case</h3>
          <div class="mono-io"><strong>Input:</strong> ${esc(u.example2.input)}\n<strong>Output:</strong> ${esc(u.example2.output)}</div>
          <p style="margin-bottom:0">${esc(u.example2.whyEdgeCase)}</p>
        </div>
      </section>

      <section class="guide-card" id="dry-run">
        <h2>2. Interactive Dry Run: ${esc(guide.dryRun.algorithmName)}</h2>
        <p class="muted" style="margin-top:0">Step through how the recommended algorithm solves Example 1 from start to finish.</p>

        <div class="dryrun-controls">
          <div class="dryrun-buttons">
            <button type="button" class="btn btn-secondary" id="prevStepBtn" ${state.dryStep <= 0 ? "disabled" : ""}>← Previous</button>
            <button type="button" class="btn btn-primary" id="nextStepBtn" ${state.dryStep >= guide.dryRun.steps.length - 1 ? "disabled" : ""}>Next →</button>
            <button type="button" class="btn btn-secondary" id="resetStepBtn">Reset</button>
          </div>
          <span class="step-indicator">Step ${state.dryStep + 1} of ${guide.dryRun.steps.length}</span>
        </div>

        <div id="dryRunDiagram">${renderDiagram(currentStep.state)}</div>
        <div class="step-description" id="dryRunText">
          <strong>${esc(currentStep.title)}</strong>
          <span>${esc(currentStep.description)}</span>
        </div>
      </section>

      <section class="guide-card" id="approaches">
        <h2>3. Compare Approaches &amp; Trade-offs</h2>
        <div class="table-scroll">
          <table class="compare-table">
            <thead>
              <tr>
                <th>Approach</th>
                <th>Core Idea</th>
                <th>Time</th>
                <th>Auxiliary Space</th>
                <th>Bound Type</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${comparisonRows}</tbody>
          </table>
        </div>

        <div class="approach-tabs" role="tablist" aria-label="Solution approaches">${approachTabs}</div>

        <div class="approach-panel" id="approachDetail">
          <div class="badge-row" style="margin-bottom:8px;">
            <h3 style="margin:0">${esc(activeApproach.name)}</h3>
            ${activeApproach.recommended ? `<span class="badge badge-available">Recommended Default</span>` : ""}
          </div>
          ${
            activeApproach.recommended && activeApproach.recommendedTradeOff
              ? `<p><strong>Why this is the recommended default:</strong> ${esc(activeApproach.recommendedTradeOff)}</p>`
              : ""
          }
          <p><strong>Core idea:</strong> ${esc(activeApproach.coreIdea)}</p>
          <p><strong>Algorithm steps:</strong></p>
          <ol>${(activeApproach.steps || []).map((s) => `<li>${esc(s)}</li>`).join("")}</ol>
          <p><strong>Why it works:</strong> ${esc(activeApproach.whyItWorks)}</p>
          <p><strong>When to use it:</strong> ${esc(activeApproach.whenToUse)}</p>

          <div class="complexity-strip">
            <div class="complexity-box">
              <small>Time Complexity (${esc(activeApproach.complexity.boundType || "Worst-case")})</small>
              <strong>${esc(activeApproach.complexity.time)}</strong>
            </div>
            <div class="complexity-box">
              <small>Auxiliary Space Complexity</small>
              <strong>${esc(activeApproach.complexity.space)}</strong>
            </div>
            <div class="complexity-box">
              <small>Variables</small>
              <span style="font-size:0.86rem">${esc(activeApproach.complexity.variables)}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="guide-card" id="code">
        <h2>4. Implementation &amp; Language Selector</h2>
        <p class="muted" style="margin-top:0">
          Showing code for <strong>${esc(activeApproach.name)}</strong>. Available in <strong>${esc(availableLangsForApproach.length)}</strong> of ${esc(allLanguages.length)} tracked languages; disabled pills do not yet have an implementation for this approach.
        </p>

        <div class="lang-grid" role="group" aria-label="Select programming language">${langButtons}</div>

        <div class="code-toolbar">
          <span><strong>${esc(state.selectedLanguage || "None")}</strong> · ${esc(verifyLabel)}</span>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${canRunInBrowser ? `<button type="button" class="btn btn-primary btn-sm" id="runJsBtn">Run JS Tests</button>` : ""}
            <button type="button" class="btn btn-secondary btn-sm" id="copyCodeBtn">Copy code</button>
          </div>
        </div>
        <pre class="code-block"><code>${esc(selectedCode)}</code></pre>
        <div id="runnerOutput" class="runner-output" hidden></div>
      </section>

      <div class="guide-hero-actions" style="justify-content: space-between;">
        <div>
          ${neighbors.prev ? `<a class="btn btn-secondary" href="${problemHref(neighbors.prev)}">← #${esc(neighbors.prev.number)} ${esc(neighbors.prev.title)}</a>` : ""}
        </div>
        <div>
          ${neighbors.next ? `<a class="btn btn-secondary" href="${problemHref(neighbors.next)}">#${esc(neighbors.next.number)} ${esc(neighbors.next.title)} →</a>` : ""}
        </div>
      </div>`;
  }

  function runBrowserJsTests() {
    const outEl = document.getElementById("runnerOutput");
    if (!outEl || !state.guide) return;
    const ap = state.guide.approaches[state.selectedApproachIdx];
    const code = ap && ap.code && ap.code.JavaScript;
    const fnName = state.guide.jsFunctionName;
    if (!code || !fnName) return;

    try {
      let preamble = "";
      let invokeExpr = `fn.apply(null, clonedArgs)`;
      if (state.guide.runtimeHelpers === "linked_list") {
        preamble = `
          class ListNode { constructor(val = 0, next = null) { this.val = val; this.next = next; } }
          const __toList = (arr) => { const d = new ListNode(0); let c = d; for (const x of arr) { c.next = new ListNode(x); c = c.next; } return d.next; };
          const __fromList = (n) => { const o = []; while (n) { o.push(n.val); n = n.next; } return o; };
        `;
        invokeExpr = `__fromList(fn.apply(null, clonedArgs.map(__toList)))`;
      }
      const factory = new Function(`${preamble}\n${code}\nreturn ${fnName};`);
      const fn = factory();
      const lines = [];
      let passed = 0;

      state.guide.tests.forEach((t, idx) => {
        const clonedArgs = JSON.parse(JSON.stringify(t.args));
        const actual = state.guide.runtimeHelpers === "linked_list"
          ? new Function("fn", "clonedArgs", `${preamble} return ${invokeExpr};`)(fn, clonedArgs)
          : fn.apply(null, clonedArgs);
        let ok = false;
        if (t.unorderedArray) {
          const a = Array.isArray(actual) ? [...actual].sort((x, y) => x - y) : actual;
          const e = Array.isArray(t.expected) ? [...t.expected].sort((x, y) => x - y) : t.expected;
          ok = JSON.stringify(a) === JSON.stringify(e);
        } else {
          ok = JSON.stringify(actual) === JSON.stringify(t.expected);
        }
        if (ok) passed++;
        lines.push(
          `${ok ? "PASS" : "FAIL"} Test ${idx + 1} (${t.name}): got ${JSON.stringify(actual)}, expected ${JSON.stringify(t.expected)}`
        );
      });

      outEl.hidden = false;
      outEl.textContent = `JavaScript (${ap.name}): ${passed}/${state.guide.tests.length} passed\n` + lines.join("\n");
    } catch (err) {
      outEl.hidden = false;
      outEl.textContent = `Runtime error: ${err.message}`;
    }
  }

  function wirePageEvents(neighbors) {
    const root = document.getElementById("guideRoot");

    const copyShareBtn = document.getElementById("copyShareBtn");
    if (copyShareBtn) {
      copyShareBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          copyShareBtn.textContent = "Link copied!";
          window.setTimeout(() => {
            copyShareBtn.textContent = "Share link";
          }, 1500);
        } catch (_) {
          copyShareBtn.textContent = window.location.href;
        }
      });
    }

    if (!state.guide) return;

    const prevBtn = document.getElementById("prevStepBtn");
    const nextBtn = document.getElementById("nextStepBtn");
    const resetBtn = document.getElementById("resetStepBtn");
    const totalSteps = state.guide.dryRun.steps.length;

    const updateDryRunOnly = () => {
      const step = state.guide.dryRun.steps[state.dryStep];
      document.getElementById("dryRunDiagram").innerHTML = renderDiagram(step.state);
      document.getElementById("dryRunText").innerHTML = `<strong>${esc(step.title)}</strong><span>${esc(step.description)}</span>`;
      document.querySelector(".step-indicator").textContent = `Step ${state.dryStep + 1} of ${totalSteps}`;
      prevBtn.disabled = state.dryStep <= 0;
      nextBtn.disabled = state.dryStep >= totalSteps - 1;
    };

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (state.dryStep > 0) {
          state.dryStep--;
          updateDryRunOnly();
        }
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (state.dryStep < totalSteps - 1) {
          state.dryStep++;
          updateDryRunOnly();
        }
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        state.dryStep = 0;
        updateDryRunOnly();
      });
    }

    root.querySelectorAll("[data-approach-tab], [data-pick-approach]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const attr = btn.hasAttribute("data-approach-tab") ? "data-approach-tab" : "data-pick-approach";
        state.selectedApproachIdx = parseInt(btn.getAttribute(attr), 10) || 0;
        renderPage(neighbors);
        if (attr === "data-pick-approach") {
          document.getElementById("approachDetail").scrollIntoView({ behavior: "smooth" });
        }
      });
    });

    root.querySelectorAll("[data-lang]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        state.selectedLanguage = btn.getAttribute("data-lang");
        renderPage(neighbors);
      });
    });

    const copyCodeBtn = document.getElementById("copyCodeBtn");
    if (copyCodeBtn) {
      copyCodeBtn.addEventListener("click", async () => {
        const ap = state.guide.approaches[state.selectedApproachIdx];
        const code = (ap && ap.code && ap.code[state.selectedLanguage]) || "";
        try {
          await navigator.clipboard.writeText(code);
          copyCodeBtn.textContent = "Copied!";
          window.setTimeout(() => {
            copyCodeBtn.textContent = "Copy code";
          }, 1500);
        } catch (_) {
          copyCodeBtn.textContent = "Copy failed";
        }
      });
    }

    const runJsBtn = document.getElementById("runJsBtn");
    if (runJsBtn) {
      runJsBtn.addEventListener("click", runBrowserJsTests);
    }
  }

  function renderPage(neighbors) {
    const root = document.getElementById("guideRoot");
    if (state.guide) {
      root.innerHTML = renderFullGuide(state.problem, state.guide, neighbors);
    } else {
      root.innerHTML = renderPendingView(state.problem, neighbors);
    }
    wirePageEvents(neighbors);
  }

  function updateDocumentMeta(problem) {
    document.title = `#${problem.number} ${problem.title} — Infinity DSA | LeetCode Solutions`;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute(
        "content",
        `Infinity DSA by InfinityDevLog — LeetCode #${problem.number} ${problem.title} (${problem.difficulty}) interactive guide, dry run, and solutions.`
      );
    }
  }

  async function init() {
    const root = document.getElementById("guideRoot");
    const params = new URLSearchParams(window.location.search);
    const slugParam = params.get("slug");
    const idParam = params.get("id");

    try {
      const catResp = await fetch("data/catalog.json");
      if (!catResp.ok) throw new Error(`HTTP ${catResp.status}`);
      state.catalog = await catResp.json();
      const problems = state.catalog.problems || [];

      let idx = -1;
      if (slugParam) {
        idx = problems.findIndex((p) => p.slug === slugParam);
      } else if (idParam) {
        const num = parseInt(idParam, 10);
        idx = problems.findIndex((p) => p.number === num);
      } else {
        idx = 0;
      }

      if (idx === -1) {
        root.innerHTML = `
          <div class="empty-state">
            <h2>Problem not found</h2>
            <p>No catalog entry matched that problem number or slug.</p>
            <a class="btn btn-primary" href="index.html">Return to catalog</a>
          </div>`;
        return;
      }

      state.problem = problems[idx];
      updateDocumentMeta(state.problem);

      const neighbors = {
        prev: idx > 0 ? problems[idx - 1] : null,
        next: idx < problems.length - 1 ? problems[idx + 1] : null,
      };

      if (state.problem.guideStatus === "available" && state.problem.guideFile) {
        const gResp = await fetch(state.problem.guideFile);
        if (!gResp.ok) throw new Error(`Guide HTTP ${gResp.status}`);
        state.guide = await gResp.json();
        const recIdx = (state.guide.approaches || []).findIndex((a) => a.recommended);
        state.selectedApproachIdx = recIdx >= 0 ? recIdx : 0;
      }

      renderPage(neighbors);
    } catch (err) {
      root.innerHTML = `
        <div class="empty-state">
          <h2>Could not load guide</h2>
          <p>${esc(err.message)}</p>
          <a class="btn btn-secondary" href="index.html">Back to catalog</a>
        </div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
