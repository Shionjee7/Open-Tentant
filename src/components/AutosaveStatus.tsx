"use client";

import type { AutosaveState } from "@/lib/useAutosaveForm";

export default function AutosaveStatus({
  state,
  retry,
}: {
  state: AutosaveState;
  retry: () => void;
}) {
  const labels: Record<Exclude<AutosaveState, "error">, string> = {
    idle: "Not saved yet",
    pending: "Unsaved changes",
    saving: "Saving...",
    saved: "All changes saved",
  };

  if (state === "error") {
    return (
      <span className="flex items-center gap-2 text-sm font-medium text-rose-700" role="alert">
        Couldn&apos;t save
        <button type="button" onClick={retry} className="underline underline-offset-2">
          Retry
        </button>
      </span>
    );
  }

  return (
    <span
      className={`text-sm ${state === "saved" ? "text-emerald-700" : "text-ink-500"}`}
      role="status"
      aria-live="polite"
    >
      {state === "saved" && <span aria-hidden="true">✓ </span>}
      {labels[state]}
    </span>
  );
}
