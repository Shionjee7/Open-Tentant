/**
 * Asking, inside the app.
 *
 * The browser's own confirm() box is a dead end. It cannot say "this house
 * still has a lease on it — here, go and look at it"; it can only say yes or
 * no, in the operating system's typeface, over a page you can no longer touch.
 *
 * These ask the same questions in the app's own voice, and can carry a list of
 * what is in the way with a link to each — so "you can't yet" becomes "here is
 * where to fix it".
 */

import { esc } from "./lib.js";

/**
 * A question with a way out of it.
 *
 * Resolves to { ok } when a button is pressed, or { ok: false, go } when the
 * reader follows one of the links instead — the caller navigates, so the
 * dialog never has to know about routing.
 */
export function ask({
  title,
  message = "",
  points = [],
  confirmLabel = "Yes",
  cancelLabel = "Cancel",
  danger = false,
  note = "",
}) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "ask";
    dialog.setAttribute("aria-labelledby", "ask-title");
    dialog.innerHTML = `
      <form method="dialog" class="ask-body">
        <h2 id="ask-title">${esc(title)}</h2>
        ${message ? `<p class="ask-msg">${message}</p>` : ""}
        ${points.length
          ? `<ul class="ask-points">${points
              .map(
                (point) => `
              <li>
                <span class="ask-point-t">${esc(point.label)}</span>
                ${point.href
                  ? `<a class="ask-go" href="${esc(point.href)}" data-go="${esc(point.href)}">${esc(point.action || "Take me there")} →</a>`
                  : ""}
              </li>`
              )
              .join("")}</ul>`
          : ""}
        ${note ? `<p class="note warn ask-note">${esc(note)}</p>` : ""}
        <div class="ask-acts">
          <button type="button" class="btn-secondary" data-ask="cancel">${esc(cancelLabel)}</button>
          <button type="button" class="btn${danger ? " danger" : ""}" data-ask="ok">${esc(confirmLabel)}</button>
        </div>
      </form>`;

    document.body.appendChild(dialog);

    const finish = (result) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };

    dialog.addEventListener("click", (event) => {
      const go = event.target.closest("[data-go]");
      if (go) {
        event.preventDefault();
        finish({ ok: false, go: go.dataset.go });
        return;
      }
      const button = event.target.closest("[data-ask]");
      if (button) {
        finish({ ok: button.dataset.ask === "ok" });
        return;
      }
      // Clicking the backdrop is a way out, like pressing Escape.
      if (event.target === dialog) finish({ ok: false });
    });

    // Escape, and the close that comes with it.
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish({ ok: false });
    });

    dialog.showModal();
    // The safe button takes focus, so Enter never destroys anything by reflex.
    dialog.querySelector('[data-ask="cancel"]')?.focus();
  });
}

/** A statement rather than a question: one button, nothing to decide. */
export function tell({ title, message = "", points = [], closeLabel = "Got it" }) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "ask";
    dialog.setAttribute("aria-labelledby", "ask-title");
    dialog.innerHTML = `
      <div class="ask-body">
        <h2 id="ask-title">${esc(title)}</h2>
        ${message ? `<p class="ask-msg">${message}</p>` : ""}
        ${points.length
          ? `<ul class="ask-points">${points
              .map(
                (point) => `
              <li>
                <span class="ask-point-t">${esc(point.label)}</span>
                ${point.href
                  ? `<a class="ask-go" href="${esc(point.href)}" data-go="${esc(point.href)}">${esc(point.action || "Take me there")} →</a>`
                  : ""}
              </li>`
              )
              .join("")}</ul>`
          : ""}
        <div class="ask-acts">
          <button type="button" class="btn" data-ask="ok">${esc(closeLabel)}</button>
        </div>
      </div>`;

    document.body.appendChild(dialog);

    const finish = (result) => {
      dialog.close();
      dialog.remove();
      resolve(result);
    };

    dialog.addEventListener("click", (event) => {
      const go = event.target.closest("[data-go]");
      if (go) {
        event.preventDefault();
        finish({ go: go.dataset.go });
        return;
      }
      if (event.target.closest("[data-ask]") || event.target === dialog) finish({});
    });
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      finish({});
    });

    dialog.showModal();
    dialog.querySelector('[data-ask="ok"]')?.focus();
  });
}
