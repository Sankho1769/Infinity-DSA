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
    els.navProblems = document.getElementById("navProblems");
    els.navTopics = document.getElementById("navTopics");
    els.navRoadmap = document.getElementById("navRoadmap");
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
    els.footerStats = document.getElementById("footerStats");
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
    els.topicFilter.value = state.topic;
    els.languageFilter.value = state.language;
    els.statusFilter.value = state.status;
    els.accessFilter.value = state.access;
    els.sortSelect.value = state.sort;
    els.diffButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-diff") === state.difficulty);
    });
    if (els.navProblems && els.navRoadmap && els.navTopics) {
      els.navProblems.classList.toggle("active", state.status !== "available");
      els.navRoadmap.classList.toggle("active", state.status === "available");
      els.navTopics.classList.toggle("active", state.topic !== "all" && state.status !== "available");
    }
    if (els.resetFiltersBtn) {
      const hasActive =
        state.q.trim() !== "" ||
        state.difficulty !== "all" ||
        state.topic !== "all" ||
        state.language !== "all" ||
        state.status !== "all" ||
        state.access !== "all" ||
        state.sort !== "number-asc";
      els.resetFiltersBtn.hidden = !hasActive;
    }
  }

  function writeQueryParams(pushHistory) {
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
    if (nextUrl === `${window.location.pathname}${window.location.search}`) return;
    if (pushHistory) {
      window.history.pushState(null, "", nextUrl);
    } else {
      window.history.replaceState(null, "", nextUrl);
    }
  }

  function difficultyBadgeClass(diff) {
    if (diff === "Easy") return "badge-easy";
    if (diff === "Medium") return "badge-medium";
    if (diff === "Hard") return "badge-hard";
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
    (meta.availableLanguages || []).forEach((lang) => {
      const opt = document.createElement("option");
      opt.value = lang;
      opt.textContent = lang;
      langFrag.appendChild(opt);
    });
    els.languageFilter.appendChild(langFrag);

    if (meta.source) {
      els.catalogProvenance.textContent = `Source: ${meta.source.name} (${meta.source.license}, checked ${meta.source.checkedDate})`;
    }
    if (els.footerStats) {
      els.footerStats.textContent = `${(meta.totalProblems || 0).toLocaleString()} indexed · ${(meta.completedGuides || 0).toLocaleString()} completed guides · ${(meta.availableLanguages || []).length}/${(meta.allLanguages || []).length} languages covered`;
    }
  }

  function applyFilters(resetPage, pushHistory = false, syncUrl = true) {
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

    syncControlsFromState();
    if (syncUrl) writeQueryParams(pushHistory);
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
          <td colspan="5">
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
        const premiumTag = p.access === "Premium" ? `<span class="badge badge-premium">Premium</span>` : "";

        const topicButtons = (p.topics || ["unknown"])
          .map((topic) => `<button type="button" class="topic-chip" data-topic-pick="${esc(topic)}">${esc(topic)}</button>`)
          .join("");

        const actionHtml = isAvailable
          ? `<a class="btn btn-outline-green btn-sm" href="${guideHref(p)}">View Solution →</a>`
          : `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
               <a class="btn btn-secondary btn-sm" href="${guideHref(p)}">Guide pending</a>
               ${p.url && p.url !== "unknown" ? `<a class="topic-chip" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" title="Official LeetCode problem">↗</a>` : ""}
             </div>`;

        const href = guideHref(p);
        return `
        <tr class="problem-row-link" data-href="${esc(href)}" tabindex="0" role="link" aria-label="Open #${esc(p.number)} ${esc(p.title)}">
          <td><span class="problem-num">${esc(p.number)}</span></td>
          <td>
            <div class="title-wrap">
              <a class="problem-title-link" href="${esc(href)}">${esc(p.title)}</a>
              ${premiumTag}
            </div>
          </td>
          <td><div class="topic-list">${topicButtons}</div></td>
          <td><span class="badge ${difficultyBadgeClass(p.difficulty)}">${esc(p.difficulty)}</span></td>
          <td>${actionHtml}</td>
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
      if (prev && n - prev > 1) buttonsHtml += `<span class="problem-num" aria-hidden="true">…</span>`;
      buttonsHtml += `<button type="button" class="page-btn ${n === state.page ? "active" : ""}" data-page="${n}">${n}</button>`;
      prev = n;
    });

    buttonsHtml += `<button type="button" class="page-btn" data-page="${state.page + 1}" ${
      state.page >= totalPages ? "disabled" : ""
    }>Next</button>`;

    els.pagination.innerHTML = buttonsHtml;
  }

  function bindEvents() {
    let searchTimer = null;
    els.searchInput.addEventListener("input", () => {
      state.q = els.searchInput.value;
      window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(() => applyFilters(true), 120);
    });

    document.addEventListener("keydown", (ev) => {
      if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === "k") {
        ev.preventDefault();
        els.searchInput.focus();
      }
    });

    if (els.navProblems) {
      els.navProblems.addEventListener("click", (ev) => {
        ev.preventDefault();
        state.status = "all";
        applyFilters(true, true);
        document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
      });
    }
    if (els.navTopics) {
      els.navTopics.addEventListener("click", (ev) => {
        ev.preventDefault();
        state.status = "all";
        applyFilters(false, true);
        els.topicFilter.focus();
        document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
      });
    }
    if (els.navRoadmap) {
      els.navRoadmap.addEventListener("click", (ev) => {
        ev.preventDefault();
        state.status = state.status === "available" ? "all" : "available";
        applyFilters(true, true);
        document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
      });
    }

    els.diffButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        state.difficulty = btn.getAttribute("data-diff") || "all";
        applyFilters(true, true);
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
        applyFilters(true, true);
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
      applyFilters(true, true);
    });

    els.catalogBody.addEventListener("click", (ev) => {
      const chip = ev.target.closest("[data-topic-pick]");
      if (chip) {
        ev.stopPropagation();
        state.topic = chip.getAttribute("data-topic-pick") || "all";
        applyFilters(true, true);
        return;
      }
      if (ev.target.closest("a, button")) {
        return;
      }
      const row = ev.target.closest("tr[data-href]");
      if (!row) return;
      const href = row.getAttribute("data-href");
      if (!href) return;
      if (ev.ctrlKey || ev.metaKey) {
        window.open(href, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = href;
      }
    });

    els.catalogBody.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" && ev.key !== " ") return;
      if (ev.target.closest("a, button")) return;
      const row = ev.target.closest("tr[data-href]");
      if (!row) return;
      ev.preventDefault();
      window.location.href = row.getAttribute("data-href");
    });

    els.pagination.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-page]");
      if (!btn || btn.disabled) return;
      const nextPage = parseInt(btn.getAttribute("data-page"), 10);
      if (!Number.isFinite(nextPage)) return;
      state.page = nextPage;
      writeQueryParams(true);
      renderResults();
      document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
    });

    window.addEventListener("popstate", () => {
      readQueryParams();
      applyFilters(false, false, false);
    });
  }

  function isValidCatalog(data) {
    return (
      Boolean(data) &&
      typeof data === "object" &&
      data.meta &&
      Array.isArray(data.problems) &&
      data.problems.length > 0 &&
      typeof data.problems[0].number === "number" &&
      typeof data.problems[0].title === "string"
    );
  }

  async function init() {
    cacheElements();
    readQueryParams();

    try {
      state.catalog = await window.InfinityDSA.fetchSiteJson(
        "data/catalog.json",
        isValidCatalog,
        "data/offline-catalog.js",
        () => window.__INFINITY_DSA_CATALOG__
      );
      populateFacets(state.catalog.meta || {});
      syncControlsFromState();
      bindEvents();
      applyFilters(false, false, false);
      if (new URLSearchParams(window.location.search).get("focus") === "topics") {
        els.topicFilter.focus();
      }
    } catch (err) {
      els.resultsCount.textContent = "Failed to load catalog.";
      els.catalogBody.innerHTML = `
        <tr><td colspan="5">
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
