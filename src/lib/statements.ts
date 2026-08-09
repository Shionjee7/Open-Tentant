/**
 * Turns a pasted or uploaded bank statement into rows we can match to tenants.
 *
 * Every bank exports slightly different CSV headers, so instead of demanding
 * one format we look for whichever columns look like a date, a description,
 * and an amount. Plain text pasted from a PDF statement also works.
 */

export type ParsedRow = {
  posted_date: string;
  description: string;
  amount: number;
};

const DATE_KEYS = ["date", "posted date", "posting date", "transaction date", "post date", "settled", "created"];
const DESC_KEYS = ["description", "name", "memo", "details", "payee", "note", "notes", "narrative", "transaction", "to/from", "counterparty"];
const AMOUNT_KEYS = ["amount", "credit", "deposit", "amount (usd)", "net amount", "amount in"];

/** Splits a CSV line, honoring quoted fields containing commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === "," || char === "\t") && !inQuotes) {
      out.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current.trim());
  return out;
}

function parseAmount(raw: string): number | null {
  if (!raw) return null;
  let text = raw.replace(/[$\s,]/g, "").replace(/[""]/g, "");
  if (!text) return null;
  // Accounting style: (12.34) means negative.
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  }
  if (text.startsWith("+")) text = text.slice(1);
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return negative ? -value : value;
}

/** Normalizes the many date shapes banks emit into YYYY-MM-DD. */
export function parseDate(raw: string): string | null {
  if (!raw) return null;
  const text = raw.trim().replace(/^["']|["']$/g, "");

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (slash) {
    const month = slash[1].padStart(2, "0");
    const day = slash[2].padStart(2, "0");
    let year = slash[3];
    if (year.length === 2) year = Number(year) > 70 ? `19${year}` : `20${year}`;
    return `${year}-${month}-${day}`;
  }

  // "Mar 3, 2026" / "3 Mar 2026"
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function findIndex(headers: string[], candidates: string[]): number {
  for (const candidate of candidates) {
    const index = headers.findIndex((h) => h === candidate);
    if (index !== -1) return index;
  }
  for (const candidate of candidates) {
    const index = headers.findIndex((h) => h.includes(candidate));
    if (index !== -1) return index;
  }
  return -1;
}

/**
 * All columns that carry human-readable context, in order. Exports often split
 * the payer's name and the memo across separate columns (Cash App does), and
 * the name is the strongest matching signal — so we keep every one of them.
 */
function describeIndices(headers: string[], dateIndex: number, amountIndex: number): number[] {
  const indices: number[] = [];
  headers.forEach((header, index) => {
    if (index === dateIndex || index === amountIndex) return;
    const isDescriptive = DESC_KEYS.some((key) => header.includes(key)) || header.includes("sender");
    // Skip columns that are clearly identifiers or bookkeeping noise.
    const isNoise = /id$|^id|balance|currency|status|type|fee|tax|account/.test(header);
    if (isDescriptive && !isNoise) indices.push(index);
  });
  return indices;
}

/** Parses CSV/TSV text that has a header row. */
function parseDelimited(lines: string[]): ParsedRow[] | null {
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/^["']|["']$/g, ""));
  const dateIndex = findIndex(headers, DATE_KEYS);
  let amountIndex = findIndex(headers, AMOUNT_KEYS);

  // Some exports split money into separate debit and credit columns.
  const creditIndex = headers.findIndex((h) => h.includes("credit") || h.includes("deposit"));
  if (amountIndex === -1 && creditIndex !== -1) amountIndex = creditIndex;
  if (dateIndex === -1 || amountIndex === -1) return null;

  const descIndices = describeIndices(headers, dateIndex, amountIndex);

  const rows: ParsedRow[] = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    const cells = splitCsvLine(line);
    const date = parseDate(cells[dateIndex] ?? "");
    const amount = parseAmount(cells[amountIndex] ?? "");
    if (!date || amount === null) continue;

    const pieces =
      descIndices.length > 0
        ? descIndices.map((i) => cells[i] ?? "")
        : cells.filter((_, i) => i !== dateIndex && i !== amountIndex);
    const description = pieces
      .map((p) => p.trim())
      .filter(Boolean)
      .join(" — ");

    rows.push({ posted_date: date, description, amount });
  }
  return rows;
}

/**
 * Fallback for text copied out of a PDF statement, where each line looks
 * roughly like: 03/04/2026  ZELLE FROM DANA LIU  1,250.00
 */
function parseFreeText(lines: string[]): ParsedRow[] {
  const rows: ParsedRow[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const dateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)/);
    if (!dateMatch) continue;
    const date = parseDate(dateMatch[1]);
    if (!date) continue;

    // The last money-looking token on the line is the amount.
    const amounts = [...trimmed.matchAll(/\(?-?\$?\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})\)?/g)];
    if (amounts.length === 0) continue;
    const last = amounts[amounts.length - 1];
    const amount = parseAmount(last[0]);
    if (amount === null) continue;

    const description = trimmed
      .slice(dateMatch[0].length, last.index)
      .replace(/\s+/g, " ")
      .trim();
    rows.push({ posted_date: date, description, amount });
  }
  return rows;
}

export function parseStatement(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const looksDelimited = /[,\t]/.test(lines[0]);
  if (looksDelimited) {
    const parsed = parseDelimited(lines);
    if (parsed && parsed.length > 0) return parsed;
  }
  return parseFreeText(lines);
}

/** Stable id for a row so importing the same statement twice doesn't duplicate. */
export function fingerprint(accountId: number, row: ParsedRow): string {
  const normalized = row.description.toLowerCase().replace(/\s+/g, " ").trim();
  return `${accountId}|${row.posted_date}|${row.amount.toFixed(2)}|${normalized}`;
}

/**
 * Scores how likely a deposit belongs to a given tenant/payment.
 * Name in the description is the strongest signal; an exact amount match and
 * a nearby date add confidence.
 */
export function matchScore(
  description: string,
  amount: number,
  candidate: { tenantName: string; amount: number; dueDate: string; postedDate: string }
): number {
  let score = 0;
  const haystack = description.toLowerCase();
  const parts = candidate.tenantName.toLowerCase().split(/\s+/).filter((p) => p.length > 2);

  for (const part of parts) {
    if (haystack.includes(part)) score += 40;
  }
  if (Math.abs(amount - candidate.amount) < 0.01) score += 35;
  else if (Math.abs(amount - candidate.amount) <= candidate.amount * 0.05) score += 15;

  const due = new Date(candidate.dueDate + "T00:00:00").getTime();
  const posted = new Date(candidate.postedDate + "T00:00:00").getTime();
  if (Number.isFinite(due) && Number.isFinite(posted)) {
    const days = Math.abs(posted - due) / 86400000;
    if (days <= 5) score += 20;
    else if (days <= 15) score += 10;
    else if (days > 60) score -= 10;
  }
  return score;
}
