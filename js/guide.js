/**
 * Interactive 3-column Problem Guide renderer for Infinity DSA (by InfinityDevLog).
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
    activeRailStep: 1,
    activeSubtab: "intuition",
    compareOpen: false,
    visitedSteps: new Set([1]),
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
    if (!aux || !Array.isArray(aux.entries) || aux.entries.length === 0) return "";
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
    return `<div class="aux-panel"><div class="aux-title">${esc(aux.title || "State")}</div><div class="aux-entries">${chips}</div></div>`;
  }

  function renderDiagram(diagram) {
    if (!diagram) return `<p class="muted">No diagram data provided.</p>`;
    const type = diagram.type || "array";
    let bodyHtml = "";

    if (type === "array" || type === "two-pointers" || type === "hash" || type === "stack") {
      const ptrMap = new Map();
      (diagram.pointers || []).forEach((ptr) => {
        if (!ptrMap.has(ptr.index)) ptrMap.set(ptr.index, []);
        ptrMap.get(ptr.index).push(ptr.name);
      });

      const cells = (diagram.items || [])
        .map((item) => {
          const ptrs = (ptrMap.get(item.index) || []).map((n) => `<span class="pointer-tag">${esc(n)}</span>`).join("");
          const stateCls = item.state ? `state-${esc(item.state)}` : "";
          const labelHtml = item.label ? `<span class="cell-label">${esc(item.label)}</span>` : "";
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
      const ptrMap = new Map();
      (diagram.pointers || []).forEach((ptr) => {
        if (!ptrMap.has(ptr.nodeId)) ptrMap.set(ptr.nodeId, []);
        ptrMap.get(ptr.nodeId).push(ptr.name);
      });
      const nodes = (diagram.nodes || [])
        .map((node, idx, arr) => {
          const ptrs = (ptrMap.get(node.id) || []).map((n) => `<span class="pointer-tag">${esc(n)}</span>`).join("");
          const stateCls = node.state ? `state-${esc(node.state)}` : "";
          const arrow = idx < arr.length - 1 ? `<span class="ll-arrow">→</span>` : `<span class="ll-arrow">→ null</span>`;
          return `
            <div class="cell-wrap">
              <div class="cell-pointers">${ptrs}</div>
              <div class="cell-box ${stateCls}">${esc(node.value)}</div>
              ${node.label ? `<span class="cell-label">${esc(node.label)}</span>` : ""}
            </div>${arrow}`;
        })
        .join("");
      bodyHtml = `<div class="ll-row">${nodes}</div>`;
    } else if (type === "grid") {
      const ptrMap = new Map();
      (diagram.pointers || []).forEach((p) => ptrMap.set(`${p.r},${p.c}`, p.name));
      const rowsHtml = (diagram.rows || [])
        .map((row, rIdx) => {
          const tds = row
            .map((cell, cIdx) => {
              const obj = typeof cell === "object" && cell !== null ? cell : { value: cell };
              const stateCls = obj.state ? `state-${esc(obj.state)}` : "";
              const ptr = ptrMap.get(`${rIdx},${cIdx}`);
              return `<td class="${stateCls}">${esc(obj.value)}${ptr ? `<div class="pointer-tag">${esc(ptr)}</div>` : ""}</td>`;
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
        .map((e) => {
          const f = nodeById.get(e.from);
          const t = nodeById.get(e.to);
          if (!f || !t) return "";
          return `<line x1="${f.x}" y1="${f.y}" x2="${t.x}" y2="${t.y}" stroke="var(--border-strong)" stroke-width="2.5"/>`;
        })
        .join("");
      const nodeSvgs = nodes
        .map((n) => `<circle cx="${n.x}" cy="${n.y}" r="22" fill="var(--surface)" stroke="var(--accent)" stroke-width="2.5"/><text x="${n.x}" y="${n.y + 5}" text-anchor="middle" fill="var(--text)" font-size="13" font-weight="700" font-family="var(--font-mono)">${esc(n.label)}</text>`)
        .join("");
      bodyHtml = `<svg class="svg-diagram" viewBox="0 0 ${width} ${height}">${edgeSvgs}${nodeSvgs}</svg>`;
    }

    return `<div class="diagram-stage">${bodyHtml}${renderAuxPanel(diagram.aux)}${
      diagram.caption ? `<p class="diagram-caption">${esc(diagram.caption)}</p>` : ""
    }</div>`;
  }

  function findRelatedProblems(problem) {
    const all = (state.catalog && state.catalog.problems) || [];
    const primaryTopic = (problem.topics || [])[0];
    const sameTopic = all.filter(
      (p) => p.number !== problem.number && primaryTopic && (p.topics || []).includes(primaryTopic)
    );
    const availableFirst = sameTopic.sort((a, b) => {
      if (a.guideStatus !== b.guideStatus) return a.guideStatus === "available" ? -1 : 1;
      return a.number - b.number;
    });
    return availableFirst.slice(0, 4);
  }

  function renderPendingView(problem, neighbors) {
    const isPremium = problem.access === "Premium";
    const topicsHtml = (problem.topics || ["unknown"])
      .map((t) => `<a class="topic-chip" href="index.html?topic=${encodeURIComponent(t)}">${esc(t)}</a>`)
      .join("");
    const primaryTopic = (problem.topics && problem.topics[0]) || "Algorithms";

    return `
      <div class="guide-topbar">
        <nav class="breadcrumbs" aria-label="Breadcrumb">
          <a href="index.html">Problems</a>
          <span aria-hidden="true">›</span>
          <a href="index.html?topic=${encodeURIComponent(primaryTopic)}">${esc(primaryTopic)}</a>
          <span aria-hidden="true">›</span>
          <span>#${esc(problem.number)}. ${esc(problem.title)}</span>
        </nav>
      </div>

      <div class="guide-title-row">
        <div class="guide-title-left">
          <h1>${esc(problem.number)}. ${esc(problem.title)}</h1>
          <span class="badge ${difficultyBadgeClass(problem.difficulty)}">${esc(problem.difficulty)}</span>
          <span class="badge ${accessBadgeClass(problem.access)}">${esc(problem.access)}</span>
          <span class="badge badge-pending">Guide pending</span>
          ${topicsHtml}
        </div>
        <div class="guide-nav-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="copyShareBtn">Share link</button>
          ${neighbors.prev ? `<a class="btn btn-secondary btn-sm" href="${problemHref(neighbors.prev)}">← Prev</a>` : ""}
          ${neighbors.next ? `<a class="btn btn-primary btn-sm" href="${problemHref(neighbors.next)}">Next →</a>` : ""}
        </div>
      </div>

      <section class="stage-card">
        <div class="stage-card-header">
          <h2>Guide pending</h2>
          ${
            problem.url && problem.url !== "unknown"
              ? `<a class="btn btn-outline-green btn-sm" href="${esc(problem.url)}" target="_blank" rel="noopener noreferrer">View on LeetCode ↗</a>`
              : ""
          }
        </div>
        <p>
          Problem <strong>#${esc(problem.number)} (${esc(problem.title)})</strong> is indexed in Infinity DSA (slug: <code>${esc(problem.slug)}</code>, category: <code>${esc(problem.category || "unknown")}</code>), and its full visual guide is queued for an upcoming batch.
        </p>
        ${
          isPremium
            ? `<p><strong>Access notice:</strong> This problem is marked <strong>Premium</strong> on LeetCode. Infinity DSA respects access restrictions and only indexes public catalog metadata with an official link.</p>`
            : `<p>Use the official link to view the canonical statement on LeetCode, or browse completed guides in the catalog.</p>`
        }
        <div class="guide-nav-actions" style="margin-top:12px;">
          <a class="btn btn-primary btn-sm" href="index.html">Browse Catalog</a>
          <a class="btn btn-outline-green btn-sm" href="index.html?status=available">View Completed Guides</a>
        </div>
      </section>`;
  }

  function renderSubtabContent(guide, activeApproach, allLanguages) {
    const currentStep = guide.dryRun.steps[state.dryStep] || guide.dryRun.steps[0];
    const availableCodeMap = activeApproach.code || {};
    const availableLangs = allLanguages.filter(
      (lang) => typeof availableCodeMap[lang] === "string" && availableCodeMap[lang].trim() !== ""
    );

    if (!state.selectedLanguage || !availableCodeMap[state.selectedLanguage]) {
      state.selectedLanguage = availableLangs[0] || null;
    }

    if (state.activeSubtab === "intuition") {
      return `
        <div class="subpanel-grid">
          <div class="inner-box">
            <h3>Intuition &amp; Invariant</h3>
            <p>${esc(activeApproach.coreIdea)}</p>
            <p><strong>Why it works:</strong> ${esc(activeApproach.whyItWorks)}</p>
            ${
              activeApproach.recommended && activeApproach.recommendedTradeOff
                ? `<div class="mini-example-card primary-ex" style="margin-top:10px;"><h4>Recommended Trade-off</h4><p style="margin:0;font-size:0.84rem;">${esc(activeApproach.recommendedTradeOff)}</p></div>`
                : ""
            }
          </div>
          <div class="inner-box">
            <h3>Visual Overview (Example 1)</h3>
            ${renderDiagram(guide.understand.example1.diagram)}
            <p style="margin:10px 0 0;font-size:0.86rem;color:var(--text-secondary);">${esc(guide.understand.example1.whyValid)}</p>
          </div>
        </div>`;
    }

    if (state.activeSubtab === "algorithm") {
      return `
        <div class="inner-box">
          <h3>Algorithm Steps — ${esc(activeApproach.name)}</h3>
          <ol style="margin:8px 0 0;padding-left:20px;">
            ${(activeApproach.steps || []).map((s) => `<li style="margin-bottom:6px;">${esc(s)}</li>`).join("")}
          </ol>
        </div>`;
    }

    if (state.activeSubtab === "dryrun") {
      return `
        <div class="inner-box">
          <div class="dryrun-controls">
            <div>
              <strong>Interactive Dry Run: ${esc(guide.dryRun.algorithmName)}</strong>
              <div style="font-size:0.82rem;color:var(--muted);">Step through how the recommended algorithm solves Example 1.</div>
            </div>
            <div class="dryrun-buttons">
              <button type="button" class="btn btn-secondary btn-sm" id="prevStepBtn" ${state.dryStep <= 0 ? "disabled" : ""}>← Previous</button>
              <button type="button" class="btn btn-primary btn-sm" id="nextStepBtn" ${state.dryStep >= guide.dryRun.steps.length - 1 ? "disabled" : ""}>Next →</button>
              <button type="button" class="btn btn-secondary btn-sm" id="resetStepBtn">Reset</button>
            </div>
          </div>
          <span class="step-indicator">Step ${state.dryStep + 1} of ${guide.dryRun.steps.length}</span>
          <div id="dryRunDiagram">${renderDiagram(currentStep.state)}</div>
          <div class="step-description" id="dryRunText">
            <strong>${esc(currentStep.title)}</strong>
            <span>${esc(currentStep.description)}</span>
          </div>
        </div>`;
    }

    if (state.activeSubtab === "code") {
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
      const canRunInBrowser =
        state.selectedLanguage === "JavaScript" && Array.isArray(guide.tests) && guide.tests.length > 0 && guide.jsFunctionName;

      return `
        <div class="inner-box">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
            <strong>Language Selector (${esc(availableLangs.length)} of ${esc(allLanguages.length)} available)</strong>
            <span style="font-size:0.78rem;color:var(--muted);">Disabled pills do not yet have an implementation for this approach.</span>
          </div>
          <div class="lang-grid">${langButtons}</div>
          <div class="code-toolbar">
            <span><strong>${esc(state.selectedLanguage || "None")}</strong> · ${esc(verifyLabel)}</span>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${canRunInBrowser ? `<button type="button" class="btn btn-primary btn-sm" id="runJsBtn">Run JS Tests</button>` : ""}
              <button type="button" class="btn btn-secondary btn-sm" id="copyCodeBtn">Copy code</button>
            </div>
          </div>
          <pre class="code-block"><code>${esc(selectedCode)}</code></pre>
          <div id="runnerOutput" class="runner-output" hidden></div>
        </div>`;
    }

    return `
      <div class="subpanel-grid">
        <div class="inner-box">
          <h3>Time &amp; Auxiliary Space Complexity</h3>
          <p><strong>Time (${esc(activeApproach.complexity.boundType || "Worst-case")}):</strong> <code>${esc(activeApproach.complexity.time)}</code></p>
          <p><strong>Auxiliary Space:</strong> <code>${esc(activeApproach.complexity.space)}</code></p>
          <p><strong>Variables:</strong> ${esc(activeApproach.complexity.variables)}</p>
        </div>
        <div class="inner-box">
          <h3>When to Use &amp; Trade-offs</h3>
          <p>${esc(activeApproach.whenToUse)}</p>
          ${
            activeApproach.recommended && activeApproach.recommendedTradeOff
              ? `<p><strong>Recommended trade-off:</strong> ${esc(activeApproach.recommendedTradeOff)}</p>`
              : ""
          }
        </div>
      </div>`;
  }

  function renderFullGuide(problem, guide, neighbors) {
    const u = guide.understand;
    const approaches = guide.approaches || [];
    const allLanguages = (state.catalog.meta && state.catalog.meta.allLanguages) || [];
    const activeApproach = approaches[state.selectedApproachIdx] || approaches[0];
    const primaryTopic = (problem.topics && problem.topics[0]) || "Algorithms";
    const topicsHtml = (problem.topics || ["unknown"])
      .map((t) => `<a class="topic-chip" href="index.html?topic=${encodeURIComponent(t)}">${esc(t)}</a>`)
      .join("");
    const related = findRelatedProblems(problem);
    const pct = Math.round((state.visitedSteps.size / 7) * 100);

    const railItems = [
      [1, "Problem", "What are we finding?"],
      [2, "Approaches", `${approaches.length} distinct methods`],
      [3, "Intuition", "Core idea & why it works"],
      [4, "Algorithm", "Step-by-step logic"],
      [5, "Dry Run", "Interactive walkthrough"],
      [6, "Code", "Multi-language solutions"],
      [7, "Analysis", "Complexity & trade-offs"],
    ];

    const approachButtons = approaches
      .map(
        (ap, idx) => `
        <button type="button" class="approach-card-btn ${idx === state.selectedApproachIdx ? "active" : ""}" data-approach-tab="${idx}">
          ${ap.recommended ? `<span class="rec-crown">★ Recommended</span>` : ""}
          <span class="ap-num">Approach ${idx + 1}</span>
          <span class="ap-name">${esc(ap.name)}</span>
          <span class="ap-time">${esc(ap.complexity.time)}</span>
        </button>`
      )
      .join("");

    const compareTableHtml = state.compareOpen
      ? `
      <div class="table-scroll">
        <table class="compare-table">
          <thead>
            <tr>
              <th>Approach</th>
              <th>Core Idea</th>
              <th>Time</th>
              <th>Auxiliary Space</th>
              <th>Bound</th>
            </tr>
          </thead>
          <tbody>
            ${approaches
              .map(
                (ap) => `
              <tr>
                <td><strong>${esc(ap.name)}</strong>${ap.recommended ? ' <span class="badge badge-available">Recommended</span>' : ""}</td>
                <td>${esc(ap.coreIdeaSummary || ap.coreIdea)}</td>
                <td><code>${esc(ap.complexity.time)}</code></td>
                <td><code>${esc(ap.complexity.space)}</code></td>
                <td>${esc(ap.complexity.boundType || "Worst-case")}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`
      : "";

    return `
      <div class="guide-topbar">
        <nav class="breadcrumbs" aria-label="Breadcrumb">
          <a href="index.html">Problems</a>
          <span aria-hidden="true">›</span>
          <a href="index.html?topic=${encodeURIComponent(primaryTopic)}">${esc(primaryTopic)}</a>
          <span aria-hidden="true">›</span>
          <span>${esc(problem.number)}. ${esc(problem.title)}</span>
        </nav>
      </div>

      <div class="guide-title-row">
        <div class="guide-title-left">
          <h1>${esc(problem.number)}. ${esc(problem.title)}</h1>
          <span class="badge ${difficultyBadgeClass(problem.difficulty)}">${esc(problem.difficulty)}</span>
          <span class="badge ${accessBadgeClass(problem.access)}">${esc(problem.access)}</span>
          ${topicsHtml}
        </div>
        <div class="guide-nav-actions">
          <button type="button" class="btn btn-secondary btn-sm" id="copyShareBtn">Share link</button>
          ${
            problem.url && problem.url !== "unknown"
              ? `<a class="btn btn-outline-green btn-sm" href="${esc(problem.url)}" target="_blank" rel="noopener noreferrer">Official ↗</a>`
              : ""
          }
          ${neighbors.prev ? `<a class="btn btn-secondary btn-sm" href="${problemHref(neighbors.prev)}">← Prev</a>` : ""}
          ${neighbors.next ? `<a class="btn btn-primary btn-sm" href="${problemHref(neighbors.next)}">Next →</a>` : ""}
        </div>
      </div>

      <div class="workspace-grid">
        <aside class="left-rail" aria-label="Learning steps">
          <div class="sidebar-card">
            <h3>Learn This Problem</h3>
            <div class="step-rail">
              ${railItems
                .map(
                  ([num, label, sub]) => `
                <button type="button" class="rail-btn ${state.activeRailStep === num ? "active" : ""}" data-rail-step="${num}">
                  <span class="rail-num">${num}</span>
                  <span class="rail-text"><strong>${esc(label)}</strong><small>${esc(sub)}</small></span>
                </button>`
                )
                .join("")}
            </div>
          </div>
          <div class="sidebar-card">
            <h3>Learn in Order</h3>
            <p style="margin:0;font-size:0.8rem;color:var(--muted);">Follow steps 1 to 7 for the clearest learning flow.</p>
            <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
            <div style="text-align:right;font-size:0.76rem;font-weight:700;margin-top:5px;">${pct}%</div>
          </div>
        </aside>

        <section class="center-stage">
          <article class="stage-card" id="understandSection">
            <div class="stage-card-header">
              <h2>1. What are we trying to find?</h2>
              <span class="badge badge-available">Understand before coding</span>
            </div>
            <p style="margin:0 0 8px;"><strong>${esc(u.question)}</strong></p>
            <p style="margin:0 0 10px;color:var(--text-secondary);">${esc(u.plainExplanation)}</p>
            <div class="subpanel-grid" style="margin-bottom:10px;">
              <div class="mini-example-card"><h4>Input Meaning</h4><p style="margin:0;font-size:0.83rem;">${esc(u.inputMeaning)}</p></div>
              <div class="mini-example-card"><h4>Output Meaning</h4><p style="margin:0;font-size:0.83rem;">${esc(u.outputMeaning)}</p></div>
            </div>

            <div class="examples-3col">
              <div class="mini-example-card primary-ex">
                <h4>Example 1</h4>
                <pre>Input: ${esc(u.example1.input)}
Output: ${esc(u.example1.output)}</pre>
              </div>
              <div class="mini-example-card">
                <h4>Example 2 (Edge Case)</h4>
                <pre>Input: ${esc(u.example2.input)}
Output: ${esc(u.example2.output)}</pre>
                <p style="margin:6px 0 0;font-size:0.78rem;color:var(--text-secondary);">${esc(u.example2.whyEdgeCase)}</p>
              </div>
              <div class="mini-example-card">
                <h4>Rules &amp; Constraints</h4>
                <ul>${(u.rules || []).map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
              </div>
            </div>

            ${
              (u.terms || []).length > 0
                ? `<div class="glossary-grid">${u.terms
                    .map((t) => `<div class="glossary-item"><strong>${esc(t.term)}</strong><span>${esc(t.definition)}</span></div>`)
                    .join("")}</div>`
                : ""
            }
          </article>

          <article class="stage-card" id="approachesSection">
            <div class="stage-card-header">
              <h2>Choose an Approach (${approaches.length})</h2>
              <button type="button" class="btn btn-secondary btn-sm" id="toggleCompareBtn">
                ${state.compareOpen ? "Hide Comparison Table" : "Compare Approaches"}
              </button>
            </div>
            <div class="approach-cards-grid">${approachButtons}</div>
            ${compareTableHtml}
          </article>

          <article class="approach-detail-card" id="detailSection">
            <div class="approach-header">
              <div>
                <h2>Approach ${state.selectedApproachIdx + 1}: ${esc(activeApproach.name)}${activeApproach.recommended ? " (Recommended)" : ""}</h2>
                <p style="margin:0;font-size:0.88rem;color:var(--text-secondary);">${esc(activeApproach.coreIdeaSummary || activeApproach.coreIdea)}</p>
              </div>
              <div class="complexity-pills">
                <span class="cx-pill">Time: ${esc(activeApproach.complexity.time)}</span>
                <span class="cx-pill">Space: ${esc(activeApproach.complexity.space)}</span>
              </div>
            </div>

            <div class="subtabs" role="tablist">
              <button type="button" class="subtab-btn ${state.activeSubtab === "intuition" ? "active" : ""}" data-subtab="intuition">Intuition</button>
              <button type="button" class="subtab-btn ${state.activeSubtab === "algorithm" ? "active" : ""}" data-subtab="algorithm">Algorithm</button>
              <button type="button" class="subtab-btn ${state.activeSubtab === "dryrun" ? "active" : ""}" data-subtab="dryrun">Dry Run</button>
              <button type="button" class="subtab-btn ${state.activeSubtab === "code" ? "active" : ""}" data-subtab="code">Code</button>
              <button type="button" class="subtab-btn ${state.activeSubtab === "analysis" ? "active" : ""}" data-subtab="analysis">Complexity &amp; When to Use</button>
            </div>

            <div id="subtabBody">${renderSubtabContent(guide, activeApproach, allLanguages)}</div>
          </article>

          <article class="stage-card" id="dryRunAlwaysSection" style="margin-top:16px;">
            <div class="stage-card-header">
              <h2>Interactive Dry Run: ${esc(guide.dryRun.algorithmName)}</h2>
              <span class="step-indicator">Step ${state.dryStep + 1} of ${guide.dryRun.steps.length}</span>
            </div>
            <div class="dryrun-controls">
              <span style="font-size:0.85rem;color:var(--muted);">Walk through Example 1 step by step with the recommended algorithm.</span>
              <div class="dryrun-buttons">
                <button type="button" class="btn btn-secondary btn-sm" id="prevStepMainBtn" ${state.dryStep <= 0 ? "disabled" : ""}>← Previous</button>
                <button type="button" class="btn btn-primary btn-sm" id="nextStepMainBtn" ${state.dryStep >= guide.dryRun.steps.length - 1 ? "disabled" : ""}>Next →</button>
                <button type="button" class="btn btn-secondary btn-sm" id="resetStepMainBtn">Reset</button>
              </div>
            </div>
            <div id="dryRunMainDiagram">${renderDiagram((guide.dryRun.steps[state.dryStep] || guide.dryRun.steps[0]).state)}</div>
            <div class="step-description" id="dryRunMainText">
              <strong>${esc((guide.dryRun.steps[state.dryStep] || guide.dryRun.steps[0]).title)}</strong>
              <span>${esc((guide.dryRun.steps[state.dryStep] || guide.dryRun.steps[0]).description)}</span>
            </div>
          </article>
        </section>

        <aside class="right-rail" aria-label="Problem summary and related guides">
          <div class="sidebar-card">
            <h3>What You'll Learn</h3>
            <ul class="check-list">
              <li>${approaches.length} distinct ways to solve ${esc(problem.title)}</li>
              <li>Plain-language intuition &amp; edge-case traps</li>
              <li>Step-by-step interactive dry run</li>
              <li>Clean, multi-language implementations</li>
              <li>Time &amp; auxiliary space complexity</li>
            </ul>
          </div>

          <div class="sidebar-card">
            <h3>Problem Info</h3>
            <div class="info-kv">
              <div class="info-kv-row"><span class="muted">Difficulty</span><span class="badge ${difficultyBadgeClass(problem.difficulty)}">${esc(problem.difficulty)}</span></div>
              <div class="info-kv-row"><span class="muted">Access</span><span class="badge ${accessBadgeClass(problem.access)}">${esc(problem.access)}</span></div>
              <div class="info-kv-row"><span class="muted">Languages</span><strong>${esc((problem.languages || []).length)} / ${esc(allLanguages.length)}</strong></div>
              <div>
                <div class="muted" style="margin-bottom:4px;">Topics</div>
                <div class="topic-list">${topicsHtml}</div>
              </div>
            </div>
          </div>

          <div class="sidebar-card">
            <h3>Key Takeaways</h3>
            <ul class="check-list">
              <li>${esc(activeApproach.coreIdeaSummary || activeApproach.coreIdea)}</li>
              <li>${esc(activeApproach.complexity.time)} time (${esc(activeApproach.complexity.boundType || "Worst-case")})</li>
              <li>${esc(activeApproach.complexity.space)} auxiliary space</li>
            </ul>
          </div>

          <div class="sidebar-card">
            <h3>Related Problems</h3>
            <div class="related-list">
              ${related
                .map(
                  (r) => `
                <a class="related-item" href="${problemHref(r)}">
                  <span>${esc(r.number)}. ${esc(r.title)}</span>
                  <span class="badge ${difficultyBadgeClass(r.difficulty)}">${esc(r.difficulty)}</span>
                </a>`
                )
                .join("")}
            </div>
            <div style="margin-top:10px;">
              <a class="btn btn-outline-green btn-sm" style="width:100%;" href="index.html?topic=${encodeURIComponent(primaryTopic)}">Show More ${esc(primaryTopic)} →</a>
            </div>
          </div>
        </aside>
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
        const actual =
          state.guide.runtimeHelpers === "linked_list"
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
        lines.push(`${ok ? "PASS" : "FAIL"} Test ${idx + 1} (${t.name}): got ${JSON.stringify(actual)}, expected ${JSON.stringify(t.expected)}`);
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
          copyShareBtn.textContent = "Copied!";
          window.setTimeout(() => { copyShareBtn.textContent = "Share link"; }, 1400);
        } catch (_) {
          copyShareBtn.textContent = window.location.href;
        }
      });
    }

    if (!state.guide) return;

    root.querySelectorAll("[data-rail-step]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const stepNum = parseInt(btn.getAttribute("data-rail-step"), 10) || 1;
        state.activeRailStep = stepNum;
        state.visitedSteps.add(stepNum);
        const tabMap = { 3: "intuition", 4: "algorithm", 5: "dryrun", 6: "code", 7: "analysis" };
        if (tabMap[stepNum]) state.activeSubtab = tabMap[stepNum];
        renderPage(neighbors);
        const targetId = stepNum === 1 ? "understandSection" : stepNum === 2 ? "approachesSection" : "detailSection";
        document.getElementById(targetId).scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    const toggleCompareBtn = document.getElementById("toggleCompareBtn");
    if (toggleCompareBtn) {
      toggleCompareBtn.addEventListener("click", () => {
        state.compareOpen = !state.compareOpen;
        renderPage(neighbors);
      });
    }

    root.querySelectorAll("[data-approach-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.selectedApproachIdx = parseInt(btn.getAttribute("data-approach-tab"), 10) || 0;
        state.visitedSteps.add(2);
        renderPage(neighbors);
      });
    });

    root.querySelectorAll("[data-subtab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.activeSubtab = btn.getAttribute("data-subtab");
        const stepMap = { intuition: 3, algorithm: 4, dryrun: 5, code: 6, analysis: 7 };
        if (stepMap[state.activeSubtab]) {
          state.activeRailStep = stepMap[state.activeSubtab];
          state.visitedSteps.add(stepMap[state.activeSubtab]);
        }
        renderPage(neighbors);
      });
    });

    const totalSteps = state.guide.dryRun.steps.length;
    const stepChange = (nextIdx) => {
      state.dryStep = Math.max(0, Math.min(totalSteps - 1, nextIdx));
      state.visitedSteps.add(5);
      renderPage(neighbors);
    };

    ["prevStepBtn", "prevStepMainBtn"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", () => stepChange(state.dryStep - 1));
    });
    ["nextStepBtn", "nextStepMainBtn"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", () => stepChange(state.dryStep + 1));
    });
    ["resetStepBtn", "resetStepMainBtn"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("click", () => stepChange(0));
    });

    root.querySelectorAll("[data-lang]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        state.selectedLanguage = btn.getAttribute("data-lang");
        state.visitedSteps.add(6);
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
          window.setTimeout(() => { copyCodeBtn.textContent = "Copy code"; }, 1400);
        } catch (_) {
          copyCodeBtn.textContent = "Copy failed";
        }
      });
    }

    const runJsBtn = document.getElementById("runJsBtn");
    if (runJsBtn) runJsBtn.addEventListener("click", runBrowserJsTests);
  }

  function renderPage(neighbors) {
    const root = document.getElementById("guideRoot");
    root.innerHTML = state.guide ? renderFullGuide(state.problem, state.guide, neighbors) : renderPendingView(state.problem, neighbors);
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

  function isValidCatalog(data) {
    return Boolean(data) && typeof data === "object" && Array.isArray(data.problems) && data.problems.length > 0;
  }

  function isValidGuide(data) {
    return (
      Boolean(data) &&
      typeof data === "object" &&
      data.understand &&
      data.dryRun &&
      Array.isArray(data.approaches) &&
      data.approaches.length > 0
    );
  }

  async function init() {
    const root = document.getElementById("guideRoot");
    const params = new URLSearchParams(window.location.search);
    const slugParam = params.get("slug");
    const idParam = params.get("id");

    try {
      state.catalog = await window.InfinityDSA.fetchSiteJson(
        "data/catalog.json",
        isValidCatalog,
        "data/offline-catalog.js",
        () => window.__INFINITY_DSA_CATALOG__
      );
      const problems = state.catalog.problems || [];

      let idx = -1;
      if (slugParam) idx = problems.findIndex((p) => p.slug === slugParam);
      else if (idParam) idx = problems.findIndex((p) => p.number === parseInt(idParam, 10));
      else idx = 0;

      if (idx === -1) {
        root.innerHTML = `<div class="empty-state"><h2>Problem not found</h2><a class="btn btn-primary" href="index.html">Return to catalog</a></div>`;
        return;
      }

      state.problem = problems[idx];
      updateDocumentMeta(state.problem);
      const neighbors = { prev: idx > 0 ? problems[idx - 1] : null, next: idx < problems.length - 1 ? problems[idx + 1] : null };

      if (state.problem.guideStatus === "available" && state.problem.guideFile) {
        const guidePath = state.problem.guideFile;
        state.guide = await window.InfinityDSA.fetchSiteJson(
          guidePath,
          isValidGuide,
          "data/offline-guides.js",
          () => (window.__INFINITY_DSA_GUIDES__ ? window.__INFINITY_DSA_GUIDES__[guidePath] : null)
        );
        const recIdx = (state.guide.approaches || []).findIndex((a) => a.recommended);
        state.selectedApproachIdx = recIdx >= 0 ? recIdx : 0;
      }

      renderPage(neighbors);
    } catch (err) {
      root.innerHTML = `<div class="empty-state"><h2>Could not load guide</h2><p>${esc(err.message)}</p><a class="btn btn-secondary" href="index.html">Back to catalog</a></div>`;
    }
  }

  document.addEventListener("keydown", (ev) => {
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k") {
      const searchEl = document.querySelector(".header-search input");
      if (searchEl) {
        ev.preventDefault();
        searchEl.focus();
      }
    }
  });

  document.addEventListener("DOMContentLoaded", init);
})();
