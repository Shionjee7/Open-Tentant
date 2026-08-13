"use client";

export default function PrintButton() {
  return (
    <button type="button" className="btn no-print" onClick={() => window.print()}>
      Print or save PDF
    </button>
  );
}
