/**
 * Shared theme toggle and lightweight HTML escaping helpers for Infinity DSA.
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
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
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

  window.InfinityDSA = {
    escapeHtml: escapeHtml,
    initTheme: initTheme,
    applyTheme: applyTheme,
  };

  // Apply theme immediately to reduce flash before DOMContentLoaded.
  document.documentElement.setAttribute("data-theme", getPreferredTheme());
  document.addEventListener("DOMContentLoaded", initTheme);
})();
