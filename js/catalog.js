/**
 * Homepage catalog loader, search, multi-facet filtering, sorting, and pagination.
 */
(function () {
  const PAGE_SIZE = 48;
  const esc = window.InfinityDSA.escapeHtml;

  const state = {
    catalog: null,
    filtered: [],
    q: "",
    difficulty: "all",
    topic: "all",
    language: "all",
    status: "all",
    access: "all",
    sort: "number-asc",
    page: 1,
  };

  const els = {};

  function cacheElements() {
    els.statTotal = document.getElementById("statTotal");
    els.statCompleted = document.getElementById("statCompleted");
    els.statPending = document.getElementById("statPending");
    els.statLanguages = document.getElementById("statLanguages");
    els.heroProvenanceTag = document.getElementById("heroProvenanceTag");
    els.featuredGrid = document.getElementById("featuredGrid");
    els.filterAvailableBtn = document.getElementById("filterAvailableBtn");
    els.headerSearchInput = document.getElementById("headerSearchInput");
    els.searchInput = document.getElementById("searchInput");
    els.topicFilter = document.getElementById("topicFilter");
    els.languageFilter = document.getElementById("languageFilter");
    els.statusFilter = document.getElementById("statusFilter");
    els.accessFilter = document.getElementById("accessFilter");
    els.sortSelect = document.getElementById("sortSelect");
    els.resetFiltersBtn = document.getElementById("resetFiltersBtn");
    els.resultsCount = document.getElementById("resultsCount");
    els.catalogProvenance = document.getElementById("catalogProvenance");
    els.catalogBody = document.getElementById("catalogBody");
    els.pagination = document.getElementById("pagination");
    els.diffButtons = Array.from(document.querySelectorAll("[data-diff]"));
  }

  function readQueryParams() {
    const params = new URLSearchParams(window.location.search);
    state.q = params.get("q") || "";
    state.difficulty = params.get("diff") || "all";
    state.topic = params.get("topic") || "all";
    state.language = params.get("lang") || "all";
    state.status = params.get("status") || "all";
    state.access = params.get("access") || "all";
    state.sort = params.get("sort") || "number-asc";
    const parsedPage = parseInt(params.get("page") || "1", 10);
    state.page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  }

  function syncControlsFromState() {
    els.searchInput.value = state.q;
    if (els.headerSearchInput) els.headerSearchInput.value = state.q;
    els.topicFilter.value = state.topic;
    els.languageFilter.value = state.language;
    els.statusFilter.value = state.status;
    els.accessFilter.value = state.access;
    els.sortSelect.value = state.sort;
    els.diffButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-diff") === state.difficulty);
    });
  }

  function writeQueryParams() {
    const params = new URLSearchParams();
    if (state.q.trim()) params.set("q", state.q.trim());
    if (state.difficulty !== "all") params.set("diff", state.difficulty);
    if (state.topic !== "all") params.set("topic", state.topic);
    if (state.language !== "all") params.set("lang", state.language);
    if (state.status !== "all") params.set("status", state.status);
    if (state.access !== "all") params.set("access", state.access);
    if (state.sort !== "number-asc") params.set("sort", state.sort);
    if (state.page > 1) params.set("page", String(state.page));
    const qs = params.toString();
    const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", nextUrl);
  }

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

  function guideHref(problem) {
    if (problem.slug && problem.slug !== "unknown") {
      return `problem.html?slug=${encodeURIComponent(problem.slug)}`;
    }
    return `problem.html?id=${encodeURIComponent(problem.number)}`;
  }

  function populateFacets(meta) {
    const topicFrag = document.createDocumentFragment();
    (meta.allTopics || []).forEach((topic) => {
      const opt = document.createElement("option");
      opt.value = topic;
      opt.textContent = topic === "unknown" ? "Unknown / Unlisted" : topic;
      topicFrag.appendChild(opt);
    });
    els.topicFilter.appendChild(topicFrag);

    const langFrag = document.createDocumentFragment();
    const coveredLangs = meta.availableLanguages || [];
    coveredLangs.forEach((lang) => {
      const opt = document.createElement("option");
      opt.value = lang;
      opt.textContent = lang;
      langFrag.appendChild(opt);
    });
    els.languageFilter.appendChild(langFrag);
  }

  function renderStatsAndFeatured(data) {
    const meta = data.meta || {};
    els.statTotal.textContent = (meta.totalProblems || 0).toLocaleString();
    els.statCompleted.textContent = (meta.completedGuides || 0).toLocaleString();
    els.statPending.textContent = (meta.pendingGuides || 0).toLocaleString();
    const covCount = (meta.availableLanguages || []).length;
    const totalLangs = (meta.allLanguages || []).length || 19;
    els.statLanguages.textContent = `${covCount} / ${totalLangs}`;

    if (meta.source) {
      if (els.heroProvenanceTag) {
        els.heroProvenanceTag.textContent = `Snapshot ${meta.source.checkedDate} · ${meta.source.license}`;
      }
      els.catalogProvenance.textContent = `Source: ${meta.source.name} (${meta.source.license}, checked ${meta.source.checkedDate})`;
    }

    const completed = (data.problems || []).filter((p) => p.guideStatus === "available");
    if (els.featuredGrid) {
      els.featuredGrid.innerHTML = completed
        .slice(0, 12)
        .map(
          (p) => `
          <a class="completed-mini" href="${guideHref(p)}">
            <div class="sub-meta" style="justify-content:space-between;">
              <span class="problem-num">#${esc(p.number)}</span>
              <span class="badge ${difficultyBadgeClass(p.difficulty)}">${esc(p.difficulty)}</span>
            </div>
            <strong style="font-size:0.9rem;">${esc(p.title)}</strong>
            <div class="sub-meta">
              <span class="badge badge-available">Guide available</span>
              <span class="badge badge-unknown">${esc(p.languages.length)} langs</span>
            </div>
          </a>`
        )
        .join("");
    }
  }

  function applyFilters(resetPage) {
    if (resetPage) state.page = 1;
    const query = state.q.trim().toLowerCase();
    const numericQuery = query.replace(/^#/, "");

    const filtered = (state.catalog.problems || []).filter((p) => {
      if (state.difficulty !== "all" && p.difficulty !== state.difficulty) return false;
      if (state.status !== "all" && p.guideStatus !== state.status) return false;
      if (state.access !== "all" && p.access !== state.access) return false;
      if (state.topic !== "all" && !(p.topics || []).includes(state.topic)) return false;
      if (state.language !== "all" && !(p.languages || []).includes(state.language)) return false;

      if (query) {
        const numMatch = String(p.number) === numericQuery || String(p.number).includes(numericQuery);
        const titleMatch = (p.title || "").toLowerCase().includes(query);
        const slugMatch = (p.slug || "").toLowerCase().includes(query);
        const topicMatch = (p.topics || []).some((t) => t.toLowerCase().includes(query));
        if (!numMatch && !titleMatch && !slugMatch && !topicMatch) return false;
      }
      return true;
    });

    if (state.sort === "number-desc") {
      filtered.sort((a, b) => b.number - a.number);
    } else if (state.sort === "guides-first") {
      filtered.sort((a, b) => {
        if (a.guideStatus !== b.guideStatus) return a.guideStatus === "available" ? -1 : 1;
        return a.number - b.number;
      });
    } else {
      filtered.sort((a, b) => a.number - b.number);
    }

    state.filtered = filtered;
    const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;

    writeQueryParams();
    renderResults();
  }

  function renderResults() {
    const total = state.filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const startIdx = (state.page - 1) * PAGE_SIZE;
    const slice = state.filtered.slice(startIdx, startIdx + PAGE_SIZE);

    els.resultsCount.textContent =
      total === 0
        ? "0 matching problems"
        : `Showing ${startIdx + 1}–${Math.min(startIdx + slice.length, total)} of ${total.toLocaleString()} problems`;

    if (slice.length === 0) {
      els.catalogBody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">
              <h3>No problems match these filters</h3>
              <p>Try clearing your search or switching back to all difficulties, topics, and languages.</p>
            </div>
          </td>
        </tr>`;
      els.pagination.innerHTML = "";
      return;
    }

    els.catalogBody.innerHTML = slice
      .map((p) => {
        const isAvailable = p.guideStatus === "available";
        const guideBadge = isAvailable
          ? `<span class="badge badge-available">Guide available</span>`
          : `<span class="badge badge-pending">Guide pending</span>`;

        const topicButtons = (p.topics || ["unknown"])
          .map(
            (topic) =>
              `<button type="button" class="topic-chip" data-topic-pick="${esc(topic)}">${esc(topic)}</button>`
          )
          .join("");

        const viewBtn = isAvailable
          ? `<a class="btn btn-outline-green btn-sm" href="${guideHref(p)}">View Solution →</a>`
          : `<a class="btn btn-secondary btn-sm" href="${guideHref(p)}">Pending Info →</a>`;

        const officialBtn =
          p.url && p.url !== "unknown"
            ? `<a class="btn btn-secondary btn-sm" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" title="Official LeetCode statement">Official ↗</a>`
            : "";

        return `
        <tr>
          <td><span class="problem-num">${esc(p.number)}</span></td>
          <td>
            <div class="problem-title-cell">
              <a class="problem-title-link" href="${guideHref(p)}">${esc(p.title)}</a>
              <div class="sub-meta">
                <span class="badge ${accessBadgeClass(p.access)}">${esc(p.access)}</span>
                ${
                  p.languages && p.languages.length > 0
                    ? `<span class="badge badge-unknown">${esc(p.languages.length)} langs</span>`
                    : ""
                }
              </div>
            </div>
          </td>
          <td><div class="topic-list">${topicButtons}</div></td>
          <td><span class="badge ${difficultyBadgeClass(p.difficulty)}">${esc(p.difficulty)}</span></td>
          <td>${guideBadge}</td>
          <td><div class="sub-meta">${viewBtn}${officialBtn}</div></td>
        </tr>`;
      })
      .join("");

    renderPagination(totalPages);
  }

  function renderPagination(totalPages) {
    if (totalPages <= 1) {
      els.pagination.innerHTML = "";
      return;
    }
    const pages = new Set([1, totalPages, state.page - 1, state.page, state.page + 1]);
    const sorted = Array.from(pages)
      .filter((n) => n >= 1 && n <= totalPages)
      .sort((a, b) => a - b);

    let buttonsHtml = `<button type="button" class="page-btn" data-page="${state.page - 1}" ${
      state.page <= 1 ? "disabled" : ""
    }>Prev</button>`;

    let prev = 0;
    sorted.forEach((n) => {
      if (prev && n - prev > 1) {
        buttonsHtml += `<span class="problem-num" aria-hidden="true">…</span>`;
      }
      buttonsHtml += `<button type="button" class="page-btn ${n === state.page ? "active" : ""}" data-page="${n}">${n}</button>`;
      prev = n;
    });

    buttonsHtml += `<button type="button" class="page-btn" data-page="${state.page + 1}" ${
      state.page >= totalPages ? "disabled" : ""
    }>Next</button>`;

    els.pagination.innerHTML = `
      <span class="step-indicator">Page ${state.page} of ${totalPages}</span>
      <div class="page-buttons">${buttonsHtml}</div>
    `;
  }

  function bindEvents() {
    let searchTimer = null;
    const onSearchInput = (val) => {
      state.q = val;
      if (els.searchInput.value !== val) els.searchInput.value = val;
      if (els.headerSearchInput && els.headerSearchInput.value !== val) els.headerSearchInput.value = val;
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => applyFilters(true), 120);
    };

    els.searchInput.addEventListener("input", () => onSearchInput(els.searchInput.value));
    if (els.headerSearchInput) {
      els.headerSearchInput.addEventListener("input", () => onSearchInput(els.headerSearchInput.value));
    }

    document.addEventListener("keydown", (ev) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k") {
        ev.preventDefault();
        (els.headerSearchInput || els.searchInput).focus();
      }
    });

    els.diffButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        state.difficulty = btn.getAttribute("data-diff") || "all";
        syncControlsFromState();
        applyFilters(true);
      });
    });

    [
      [els.topicFilter, "topic"],
      [els.languageFilter, "language"],
      [els.statusFilter, "status"],
      [els.accessFilter, "access"],
      [els.sortSelect, "sort"],
    ].forEach(([el, key]) => {
      el.addEventListener("change", () => {
        state[key] = el.value;
        applyFilters(true);
      });
    });

    els.resetFiltersBtn.addEventListener("click", () => {
      state.q = "";
      state.difficulty = "all";
      state.topic = "all";
      state.language = "all";
      state.status = "all";
      state.access = "all";
      state.sort = "number-asc";
      state.page = 1;
      syncControlsFromState();
      applyFilters(true);
    });

    if (els.filterAvailableBtn) {
      els.filterAvailableBtn.addEventListener("click", () => {
        state.status = "available";
        syncControlsFromState();
        applyFilters(true);
        document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
      });
    }

    els.catalogBody.addEventListener("click", (ev) => {
      const chip = ev.target.closest("[data-topic-pick]");
      if (!chip) return;
      state.topic = chip.getAttribute("data-topic-pick") || "all";
      syncControlsFromState();
      applyFilters(true);
    });

    els.pagination.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-page]");
      if (!btn || btn.disabled) return;
      const nextPage = parseInt(btn.getAttribute("data-page"), 10);
      if (!Number.isFinite(nextPage)) return;
      state.page = nextPage;
      writeQueryParams();
      renderResults();
      document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
    });
  }

  async function init() {
    cacheElements();
    readQueryParams();

    try {
      const resp = await fetch("data/catalog.json");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      state.catalog = await resp.json();
      populateFacets(state.catalog.meta || {});
      syncControlsFromState();
      renderStatsAndFeatured(state.catalog);
      bindEvents();
      applyFilters(false);
    } catch (err) {
      els.resultsCount.textContent = "Failed to load catalog.";
      els.catalogBody.innerHTML = `
        <tr><td colspan="6">
          <div class="empty-state">
            <h3>Could not load data/catalog.json</h3>
            <p>Serve this directory over any static HTTP server (for example <code>npx serve .</code> or GitHub Pages).</p>
            <p>${esc(err.message)}</p>
          </div>
        </td></tr>`;
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
