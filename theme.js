/* ------------------------------------------------------------------
   theme.js - dark/light toggle.
   default follows the OS. once you click, your choice is remembered
   in localStorage and overrides the OS from then on.
   the no-flash setter lives inline in each page's <head>.
   ------------------------------------------------------------------ */

(function () {
  const root = document.documentElement;

  function systemDark() {
    return window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

  function effective() {
    const attr = root.getAttribute("data-theme");
    if (attr === "dark" || attr === "light") return attr;
    return systemDark() ? "dark" : "light";
  }

  function label(btn) {
    const now = effective();
    const next = now === "dark" ? "light" : "dark";
    btn.textContent = (next === "dark" ? "☾" : "☀") + " " + next;
    btn.setAttribute("aria-label", "switch to " + next + " mode");
    btn.setAttribute("title", "switch to " + next + " mode");
  }

  function mount() {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;
    label(btn);
    btn.addEventListener("click", function () {
      const next = effective() === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("theme", next); } catch (e) {}
      label(btn);
    });
    // if the user never chose, keep tracking the OS preference live
    if (window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const onChange = function () {
        if (!root.getAttribute("data-theme")) label(btn);
      };
      if (mq.addEventListener) mq.addEventListener("change", onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
