"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveState = "idle" | "pending" | "saving" | "saved" | "error";

type SaveResult = { id: string; savedAt: string };

/**
 * Background form saving with a short debounce and a four-second maximum wait.
 * Saves are serialized so an older request can never overwrite newer typing.
 */
export function useAutosaveForm({
  action,
  initialId = "",
  onCreated,
}: {
  action: (form: FormData) => Promise<SaveResult>;
  initialId?: string;
  onCreated?: (id: string) => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const idRef = useRef(initialId);
  const onCreatedRef = useRef(onCreated);
  onCreatedRef.current = onCreated;
  const dirtyRef = useRef(false);
  const forceRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxWaitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drainRef = useRef<Promise<string | null> | null>(null);
  const [id, setId] = useState(initialId);
  const [state, setState] = useState<AutosaveState>(initialId ? "saved" : "idle");

  const clearTimers = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (maxWaitRef.current) clearTimeout(maxWaitRef.current);
    debounceRef.current = null;
    maxWaitRef.current = null;
  }, []);

  const saveNow = useCallback(
    (force = false): Promise<string | null> => {
      clearTimers();
      if (force) forceRef.current = true;
      if (drainRef.current) return drainRef.current;

      const run = (async () => {
        while (dirtyRef.current || (forceRef.current && !idRef.current)) {
          const form = formRef.current;
          if (!form) return null;

          forceRef.current = false;
          dirtyRef.current = false;
          setState("saving");

          const data = new FormData(form);
          if (idRef.current) data.set("id", idRef.current);

          try {
            const result = await action(data);
            if (!idRef.current) {
              idRef.current = result.id;
              setId(result.id);
              onCreatedRef.current?.(result.id);
            }
          } catch (error) {
            console.error("Autosave failed", error);
            dirtyRef.current = true;
            setState("error");
            return null;
          }
        }

        setState("saved");
        return idRef.current || null;
      })();

      drainRef.current = run;
      void run.finally(() => {
        if (drainRef.current === run) drainRef.current = null;
      });
      return run;
    },
    [action, clearTimers]
  );

  const queueSave = useCallback(() => {
    dirtyRef.current = true;
    setState("pending");

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void saveNow(), 700);
    if (!maxWaitRef.current) {
      maxWaitRef.current = setTimeout(() => void saveNow(), 4000);
    }
  }, [saveNow]);

  const onBlurCapture = useCallback(
    (event: React.FocusEvent<HTMLFormElement>) => {
      // Moving between fields is not a reason to interrupt typing. Leaving the
      // form is: start the request before a sidebar or Done navigation occurs.
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        void saveNow();
      }
    },
    [saveNow]
  );

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden" && dirtyRef.current) void saveNow();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      clearTimers();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [clearTimers, saveNow]);

  return {
    formRef,
    id,
    state,
    saveNow,
    queueSave,
    formEvents: {
      onInputCapture: queueSave,
      onChangeCapture: queueSave,
      onBlurCapture,
    },
  };
}
