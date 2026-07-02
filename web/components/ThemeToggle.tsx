"use client";

import { useEffect, useState } from "react";

// Light/dark toggle. The initial theme is set before paint by the inline script
// in app/layout.tsx (reads localStorage, falls back to the OS preference), so
// this component only mirrors and flips the <html data-theme> value. Persists to
// localStorage under the same key the boot script reads.
type Theme = "dark" | "light";
const STORAGE_KEY = "shroom-theme";

function currentTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTheme(currentTheme());
    setMounted(true);
    // Keep in sync if another tab flips the theme.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === "light" || e.newValue === "dark")) {
        document.documentElement.dataset.theme = e.newValue;
        setTheme(e.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* private mode / storage disabled — theme still applies for this session */
    }
    setTheme(next);
  }

  const isLight = theme === "light";
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      // Before mount the label could be wrong (SSR renders dark); suppress the
      // a11y name mismatch flash by only announcing once mounted.
      aria-label={mounted ? (isLight ? "Switch to dark theme" : "Switch to light theme") : "Toggle theme"}
      aria-pressed={mounted ? isLight : undefined}
      title={isLight ? "Dark mode" : "Light mode"}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb">
          {isLight ? (
            // Sun
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
            </svg>
          ) : (
            // Moon
            <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          )}
        </span>
      </span>
    </button>
  );
}
