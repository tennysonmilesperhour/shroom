"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export type MushroomMode = "magic" | "functional";

export default function MushroomModeToggle() {
  const router = useRouter();
  const [mode, setMode] = useState<MushroomMode>("magic");

  useEffect(() => {
    const current = document.documentElement.dataset.mushroomMode;
    setMode(current === "functional" ? "functional" : "magic");
  }, []);

  function choose(next: MushroomMode) {
    if (next === mode) return;
    setMode(next);
    document.documentElement.dataset.mushroomMode = next;
    localStorage.setItem("shroom-mushroom-mode", next);
    document.cookie = `shroom-mushroom-mode=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="mushroom-mode" role="group" aria-label="Mushroom dashboard">
      <span className="mode-caption">Collection</span>
      <div className="mode-segmented">
        <button
          type="button"
          className={mode === "magic" ? "active" : ""}
          aria-pressed={mode === "magic"}
          onClick={() => choose("magic")}
        >
          <span aria-hidden="true">✦</span> Magic
        </button>
        <button
          type="button"
          className={mode === "functional" ? "active" : ""}
          aria-pressed={mode === "functional"}
          onClick={() => choose("functional")}
        >
          <span aria-hidden="true">◒</span> Functional
        </button>
      </div>
      <span className="mode-context" aria-live="polite">
        {mode === "magic" ? "Psychedelic cultivation" : "Functional + culinary"}
      </span>
    </div>
  );
}
