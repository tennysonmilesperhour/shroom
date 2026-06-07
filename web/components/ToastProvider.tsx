"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastTone = "lumen" | "moss" | "ember" | "spore";

export interface ToastInput {
  title: string;
  body?: string;
  tone?: ToastTone;
  /** ms before auto-dismiss. Default 3800. */
  duration?: number;
}

interface ToastItem extends Required<Omit<ToastInput, "body">> {
  id: number;
  body?: string;
}

interface ToastContextValue {
  push: (t: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// useToast() — call push({ title, body?, tone? }) from any client component to
// raise a transient, non-blocking notification. Stacks bottom-right, aria-live
// polite. Reuses the visual language of the existing .toast styles.
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    ({ title, body, tone = "lumen", duration = 3800 }: ToastInput) => {
      const id = nextId.current++;
      setItems((list) => [...list, { id, title, body, tone, duration }]);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="qtoast-stack" role="region" aria-live="polite" aria-label="Notifications">
        {items.map((t) => (
          <div key={t.id} className={`qtoast ${t.tone}`} role="status">
            <span className="qtoast-mark" aria-hidden="true" />
            <div className="qtoast-text">
              <div className="qtoast-title">{t.title}</div>
              {t.body && <div className="qtoast-body">{t.body}</div>}
            </div>
            <button
              type="button"
              className="qtoast-x"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
