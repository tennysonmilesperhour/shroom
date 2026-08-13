"use client";

import { useEffect, useMemo, useState } from "react";
import type { Option } from "@/lib/entities";

export function ChoiceField({
  name,
  options,
  defaultValue,
  required,
  allowEmpty = false,
  ariaLabel,
}: {
  name: string;
  options: Option[];
  defaultValue?: string;
  required?: boolean;
  allowEmpty?: boolean;
  ariaLabel: string;
}) {
  const values = allowEmpty ? [{ value: "", label: "None" }, ...options] : options;
  return (
    <div className="choice-chips" role="radiogroup" aria-label={ariaLabel}>
      {values.map((option) => (
        <label className="choice-chip" key={`${name}-${option.value || "empty"}`}>
          <input
            type="radio"
            name={name}
            value={option.value}
            defaultChecked={(defaultValue ?? "") === option.value}
            required={required}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

export function ToggleField({
  id,
  name,
  label,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="tap-toggle" htmlFor={id}>
      <input id={id} type="checkbox" name={name} defaultChecked={defaultChecked} />
      <span className="tap-toggle-track" aria-hidden="true"><span /></span>
      <span>{label}</span>
    </label>
  );
}

export function StepperField({
  id,
  name,
  defaultValue,
  min = 0,
  max,
  step = 1,
  required,
}: {
  id: string;
  name: string;
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
}) {
  const [value, setValue] = useState(Number.isFinite(defaultValue) ? defaultValue : min);
  const adjust = (delta: number) => {
    setValue((current) => {
      const next = Math.round((current + delta) * 1000) / 1000;
      return Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min, next));
    });
  };
  return (
    <div className="stepper-field">
      <button type="button" aria-label={`Decrease ${name}`} onClick={() => adjust(-step)}>−</button>
      <input
        id={id}
        name={name}
        type="number"
        value={value}
        onChange={(event) => setValue(Number(event.target.value))}
        min={min}
        max={max}
        step={step}
        required={required}
      />
      <button type="button" aria-label={`Increase ${name}`} onClick={() => adjust(step)}>+</button>
    </div>
  );
}

function readList(key: string): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function SmartTextField({
  id,
  name,
  storageKey,
  defaultValue = "",
  placeholder,
  suggestions,
}: {
  id: string;
  name: string;
  storageKey: string;
  defaultValue?: string;
  placeholder?: string;
  suggestions: string[];
}) {
  const recentKey = `shroom-recent-${storageKey}:v1`;
  const favoriteKey = `shroom-favorite-${storageKey}:v1`;
  const [value, setValue] = useState(defaultValue);
  const [recent, setRecent] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  useEffect(() => {
    setRecent(readList(recentKey));
    setFavorites(readList(favoriteKey));
  }, [recentKey, favoriteKey]);
  const choices = useMemo(
    () => [...new Set([...favorites, ...recent, ...suggestions])].filter(Boolean).slice(0, 8),
    [favorites, recent, suggestions],
  );

  function choose(choice: string) {
    setValue(choice);
    const next = [choice, ...recent.filter((item) => item !== choice)].slice(0, 5);
    setRecent(next);
    try { localStorage.setItem(recentKey, JSON.stringify(next)); } catch { /* private mode */ }
  }

  function toggleFavorite(choice: string) {
    const next = favorites.includes(choice)
      ? favorites.filter((item) => item !== choice)
      : [choice, ...favorites].slice(0, 8);
    setFavorites(next);
    try { localStorage.setItem(favoriteKey, JSON.stringify(next)); } catch { /* private mode */ }
  }

  return (
    <div className="smart-field">
      <input
        id={id}
        name={name}
        value={value}
        placeholder={placeholder}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => value.trim() && choose(value.trim())}
      />
      {choices.length > 0 && (
        <div className="smart-choices" aria-label={`Recent and favorite ${name} choices`}>
          {choices.map((choice) => (
            <span className="smart-choice" key={choice}>
              <button type="button" onClick={() => choose(choice)}>{choice}</button>
              <button
                type="button"
                className={favorites.includes(choice) ? "favorite" : ""}
                aria-label={`${favorites.includes(choice) ? "Unfavorite" : "Favorite"} ${choice}`}
                onClick={() => toggleFavorite(choice)}
              >
                {favorites.includes(choice) ? "★" : "☆"}
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function RecentSelect({
  id,
  name,
  storageKey,
  options,
  defaultValue = "",
  required,
  emptyLabel,
}: {
  id: string;
  name: string;
  storageKey: string;
  options: Option[];
  defaultValue?: string;
  required?: boolean;
  emptyLabel?: string;
}) {
  const key = `shroom-recent-${storageKey}:v1`;
  const [value, setValue] = useState(defaultValue);
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(readList(key)), [key]);
  function choose(nextValue: string) {
    setValue(nextValue);
    if (!nextValue) return;
    const next = [nextValue, ...recent.filter((item) => item !== nextValue)].slice(0, 4);
    setRecent(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* private mode */ }
  }
  const recentOptions = recent.map((item) => options.find((option) => option.value === item)).filter(Boolean) as Option[];
  return (
    <div className="smart-field">
      <select id={id} name={name} value={value} required={required} onChange={(event) => choose(event.target.value)}>
        {emptyLabel && <option value="">{emptyLabel}</option>}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      {recentOptions.length > 0 && (
        <div className="smart-choices compact">
          {recentOptions.map((option) => (
            <button type="button" key={option.value} onClick={() => choose(option.value)}>{option.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}
