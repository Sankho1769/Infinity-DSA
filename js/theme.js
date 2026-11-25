/**
 * Shared theme toggle, HTML escaping, and subpath/offline JSON loader for Infinity DSA.
 */
(function () {
  const STORAGE_KEY = "infinity-dsa-theme";

  function getPreferredTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") {
        return saved;
      }
    } catch (_) {
      // Ignore storage failures in restricted contexts.
    }
    return "light";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    const btn = document.getElementById("themeToggle");
    if (btn) {
      const label = btn.querySelector("[data-theme-label]");
      const icon = btn.querySelector("[data-theme-icon]");
      if (label) {
        label.textContent = theme === "dark" ? "Light mode" : "Dark mode";
      }
      if (icon) {
        icon.textContent = theme === "dark" ? "☀" : "☾";
      }
      btn.setAttribute("aria-pressed", String(theme === "dark"));
    }
  }

  function initTheme() {
    const current = getPreferredTheme();
    applyTheme(current);
    const btn = document.getElementById("themeToggle");
    if (btn) {
      btn.addEventListener("click", function () {
        const next =
          document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
        try {
          localStorage.setItem(STORAGE_KEY, next);
        } catch (_) {
          // Ignore storage failures.
        }
        applyTheme(next);
      });
    }
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function buildCandidateUrls(relativePath) {
    const cleanRel = relativePath.replace(/^\.?\//, "");
    const urls = [];
    const seen = new Set();
    const add = (u) => {
      if (u && !seen.has(u)) {
        seen.add(u);
        urls.push(u);
      }
    };

    try {
      add(new URL(cleanRel, window.location.href).href);
    } catch (_) {
      add(cleanRel);
    }

    // Handle project subpaths served without a trailing slash (e.g. /Infinity-DSA)
    if (window.location.protocol !== "file:") {
      const pathName = window.location.pathname || "/";
      if (!pathName.endsWith("/") && !/\.[a-z0-9]+$/i.test(pathName)) {
        add(`${window.location.origin}${pathName}/${cleanRel}`);
      }
    }

    return urls;
  }

  function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[data-offline-src="${src}"]`);
      if (existing) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = src;
      script.setAttribute("data-offline-src", src);
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Could not load offline bundle ${src}`));
      document.head.appendChild(script);
    });
  }

  async function fetchSiteJson(relativePath, validator, offlineScript, offlineGetter) {
    // When opened directly over file://, browsers block fetch() via CORS; load generated JS mirror.
    if (window.location.protocol === "file:" && offlineScript && offlineGetter) {
      await loadScriptOnce(offlineScript);
      const localData = offlineGetter();
      if (localData && (!validator || validator(localData))) {
        return localData;
      }
    }

    const candidates = buildCandidateUrls(relativePath);
    let lastError = null;

    for (const url of candidates) {
      try {
        const resp = await fetch(url, { cache: "no-cache" });
        if (!resp.ok) {
          lastError = new Error(`HTTP ${resp.status} fetching ${url}`);
          continue;
        }
        const rawText = await resp.text();
        let data;
        try {
          data = JSON.parse(rawText);
        } catch (parseErr) {
          lastError = new Error(`Invalid JSON from ${url}: ${parseErr.message}`);
          continue;
        }
        if (validator && !validator(data)) {
          lastError = new Error(`Unexpected JSON structure from ${url}`);
          continue;
        }
        return data;
      } catch (err) {
        lastError = err;
      }
    }

    if (offlineScript && offlineGetter) {
      try {
        await loadScriptOnce(offlineScript);
        const fallbackData = offlineGetter();
        if (fallbackData && (!validator || validator(fallbackData))) {
          return fallbackData;
        }
      } catch (_) {
        // Keep original fetch error below.
      }
    }

    throw lastError || new Error(`Could not load ${relativePath}`);
  }

  window.InfinityDSA = {
    escapeHtml: escapeHtml,
    initTheme: initTheme,
    applyTheme: applyTheme,
    fetchSiteJson: fetchSiteJson,
  };

  document.documentElement.setAttribute("data-theme", getPreferredTheme());
  document.addEventListener("DOMContentLoaded", initTheme);
})();
