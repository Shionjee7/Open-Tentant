"use client";

import { useEffect, useId, useRef, useState } from "react";

type Suggestion = {
  label: string;
  address: string;
  city: string;
  state: string;
  zip: string;
};

/**
 * Street address field with autocomplete. Picking a suggestion fills in the
 * city, state, and ZIP fields beside it, so adding a property is one line of
 * typing instead of four.
 *
 * If the lookup is unavailable (offline, or the geocoder is down) this behaves
 * exactly like a plain text input.
 */
export default function AddressAutocomplete({
  defaultValue = "",
  defaultCity = "",
  defaultState = "",
  defaultZip = "",
}: {
  defaultValue?: string;
  defaultCity?: string;
  defaultState?: string;
  defaultZip?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState(defaultValue);
  const [city, setCity] = useState(defaultCity);
  const [state, setState] = useState(defaultState);
  const [zip, setZip] = useState(defaultZip);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  // Set when the user picks a suggestion, so we don't immediately re-search it.
  const justPicked = useRef(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    if (query.trim().length < 4) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    // Debounce: Nominatim's usage policy asks for at most one request a second.
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = (await response.json()) as { results: Suggestion[] };
        setSuggestions(data.results ?? []);
        setOpen(true);
        setHighlight(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 700);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function choose(s: Suggestion) {
    justPicked.current = true;
    setQuery(s.address);
    setCity(s.city);
    setState(s.state);
    setZip(s.zip);
    setOpen(false);
    setSuggestions([]);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" && highlight >= 0) {
      event.preventDefault();
      choose(suggestions[highlight]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <>
      <div className="relative sm:col-span-2" ref={boxRef}>
        <label className="label" htmlFor={listId}>
          Street address
          <span className="ml-2 font-normal normal-case tracking-normal text-ink-500">
            start typing — we&apos;ll fill in the rest
          </span>
        </label>
        <input
          id={listId}
          name="address"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          className="input"
          placeholder="412 Maple St"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={`${listId}-list`}
        />
        {loading && (
          <span className="absolute right-3 top-9 text-xs text-ink-500">searching…</span>
        )}
        {open && suggestions.length > 0 && (
          <ul
            id={`${listId}-list`}
            role="listbox"
            className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {suggestions.map((s, i) => (
              <li key={`${s.label}-${i}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === highlight}
                  onClick={() => choose(s)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    i === highlight ? "bg-brand-50 text-brand-700" : "hover:bg-slate-50"
                  }`}
                >
                  <span className="font-medium">{s.address}</span>
                  <span className="block text-xs text-ink-500">
                    {[s.city, s.state, s.zip].filter(Boolean).join(", ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className="label">City</label>
        <input name="city" value={city} onChange={(e) => setCity(e.target.value)} className="input" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">State</label>
          <input name="state" value={state} onChange={(e) => setState(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">ZIP</label>
          <input name="zip" value={zip} onChange={(e) => setZip(e.target.value)} className="input" />
        </div>
      </div>
    </>
  );
}
