"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Sign with a finger, a mouse, or by typing.
 *
 * Typing a name is a valid signature under ESIGN, and on a phone it's the
 * faster path — so the typed field is always the one that counts, and the
 * drawing is an optional extra that gets stored alongside it. The canvas is
 * exported at a fixed small size so a drawn signature stays a few kilobytes.
 */
export default function SignaturePad({ defaultName }: { defaultName: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenRef = useRef<HTMLInputElement | null>(null);
  const drawing = useRef(false);
  const [drawn, setDrawn] = useState(false);
  const [mode, setMode] = useState<"type" | "draw">("type");
  const [typed, setTyped] = useState(defaultName);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== "draw") return;

    // Match the backing store to the CSS size so strokes aren't blurry.
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, [mode]);

  function pointOf(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointOf(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    // Stops the page scrolling under a finger mid-stroke.
    event.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointOf(event);
    ctx.lineTo(x, y);
    ctx.stroke();
    setDrawn(true);
  }

  function end() {
    drawing.current = false;
    save();
  }

  function save() {
    const canvas = canvasRef.current;
    const hidden = hiddenRef.current;
    if (!canvas || !hidden) return;
    hidden.value = drawn ? canvas.toDataURL("image/png") : "";
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setDrawn(false);
    if (hiddenRef.current) hiddenRef.current.value = "";
  }

  return (
    <div>
      <label className="label">Your full legal name</label>
      <input
        name="typed_name"
        required
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        className="input"
        autoComplete="name"
        placeholder="Type your name exactly as it should appear"
      />
      <p className="mt-1 text-xs text-ink-500">
        Typing your name here is your signature. Drawing one is optional.
      </p>

      {typed.trim() && mode === "type" && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-ink-500">Preview</div>
          <div
            className="mt-1 text-3xl leading-tight text-ink-900"
            style={{ fontFamily: '"Segoe Script", "Brush Script MT", "Snell Roundhand", cursive' }}
          >
            {typed}
          </div>
        </div>
      )}

      <input ref={hiddenRef} type="hidden" name="drawn_signature" defaultValue="" />

      <div className="mt-3">
        {mode === "type" ? (
          <button type="button" onClick={() => setMode("draw")} className="btn-secondary btn-sm">
            Draw it instead
          </button>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <label className="label mb-0">Draw your signature</label>
              <div className="flex gap-2">
                <button type="button" onClick={clear} className="btn-secondary btn-sm">
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clear();
                    setMode("type");
                  }}
                  className="btn-secondary btn-sm"
                >
                  Type instead
                </button>
              </div>
            </div>
            <canvas
              ref={canvasRef}
              onPointerDown={start}
              onPointerMove={move}
              onPointerUp={end}
              onPointerLeave={end}
              className="mt-1.5 h-36 w-full touch-none rounded-lg border-2 border-dashed border-slate-300 bg-white"
            />
            <p className="mt-1 text-xs text-ink-500">
              {drawn ? "Looks good — your drawing will appear on the lease." : "Sign with your finger or mouse."}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
