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
const STRONG_DESC = ["description", "name", "memo", "payee", "note", "notes", "narrative", "to/from", "counterparty", "sender"];
const WEAK_DESC = ["details", "transaction"];

function describeIndices(headers: string[], dateIndex: number, amountIndex: number): number[] {
  // Skip columns that are clearly identifiers or bookkeeping noise.
  const isNoise = (header: string) => /id$|^id|balance|currency|status|type|fee|tax|account/.test(header);
  const pick = (keys: string[]) => {
    const indices: number[] = [];
    headers.forEach((header, index) => {
      if (index === dateIndex || index === amountIndex || isNoise(header)) return;
      if (keys.some((key) => header.includes(key))) indices.push(index);
    });
    return indices;
  };

  // "Details" and "Transaction" are a fallback. Chase has a Details column next
  // to its Description column and it holds DEBIT or CREDIT, so reading both
  // gives "DEBIT — DUKE ENERGY" — which matches nothing and reads like nonsense
  // in the books. A column is only worth joining on when nothing better exists.
  const strong = pick(STRONG_DESC);
  return strong.length > 0 ? strong : pick(WEAK_DESC);
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
    //
    // The integer part is `\d[\d,]*` rather than `\d{1,3}(,\d{3})*` on purpose:
    // plenty of exports print 1234.00 with no thousands separator, and a
    // three-digit cap silently turned that into 234.00 — a wrong number that
    // looks perfectly plausible in the books.
    const amounts = [...trimmed.matchAll(/\(?-?\$?\s?\d[\d,]*\.\d{2}\)?/g)];
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

  // Real exports rarely start with the header row — the bank's name, the
  // account number, and the statement period usually come first. So look for
  // the header rather than assuming line one, and take the first position that
  // yields actual rows.
  const searchDepth = Math.min(lines.length, 15);
  for (let start = 0; start < searchDepth; start++) {
    if (!/[,\t]/.test(lines[start])) continue;
    const parsed = parseDelimited(lines.slice(start));
    if (parsed && parsed.length > 0) return parsed;
  }
  return parseFreeText(lines);
}

/** Stable id for a row so importing the same statement twice doesn't duplicate. */
export function fingerprint(accountId: string, row: ParsedRow): string {
  const normalized = row.description.toLowerCase().replace(/\s+/g, " ").trim();
  return `${accountId}|${row.posted_date}|${row.amount.toFixed(2)}|${normalized}`;
}

/**
 * Which account did this statement come from?
 *
 * A landlord with one bank per house shouldn't have to remember which is
 * which. Statements name themselves: the last four digits appear next to the
 * account number, and the bank's own name is usually in the header. We read
 * both and say what we concluded, so a wrong guess is visible rather than
 * silent.
 */
export type AccountHint = {
  id: string;
  name: string;
  institution: string;
  last4: string;
};

export type AccountGuess = {
  id: string;
  /** Plain English, shown to the landlord: "matched ····4821 in the statement". */
  reason: string;
  score: number;
};

export function detectAccount(text: string, accounts: AccountHint[]): AccountGuess | null {
  const haystack = text.toLowerCase().slice(0, 20000);
  // Digit runs that a statement would print for an account number: masked
  // (****4821, xxxx4821, ···4821) or the tail of a longer number.
  const masked = [...haystack.matchAll(/[*x·•#-]{2,}\s?(\d{4})\b/g)].map((m) => m[1]);
  const afterLabel = [...haystack.matchAll(/account[^0-9]{0,20}(\d{4})\b/g)].map((m) => m[1]);
  const digits = new Set([...masked, ...afterLabel]);

  const guesses = accounts
    .map((account) => {
      let score = 0;
      const reasons: string[] = [];

      if (account.last4 && digits.has(account.last4)) {
        score += 60;
        reasons.push(`the statement shows ····${account.last4}`);
      }
      if (account.institution && account.institution.trim().length > 2) {
        const bank = account.institution.toLowerCase().trim();
        if (haystack.includes(bank)) {
          score += 30;
          reasons.push(`it names ${account.institution}`);
        }
      }
      if (account.name && account.name.trim().length > 3 && haystack.includes(account.name.toLowerCase())) {
        score += 15;
        reasons.push(`it names "${account.name}"`);
      }

      return { id: account.id, score, reason: reasons.join(" and ") };
    })
    .filter((g) => g.score >= 30)
    .sort((a, b) => b.score - a.score);

  if (guesses.length === 0) return null;
  // Two accounts fitting equally well is not a guess worth making.
  if (guesses.length > 1 && guesses[0].score === guesses[1].score) return null;
  return guesses[0];
}

/**
 * What kind of expense does this withdrawal look like?
 *
 * Bank descriptions are terse but consistent — "DUKE ENERGY", "HOME DEPOT",
 * "STATE FARM". Matching them to a category turns a statement into bookkeeping
 * instead of a list of mystery debits. It's a suggestion: the category sits in
 * a dropdown the landlord can change before booking it.
 */
const CATEGORY_HINTS: [string, RegExp][] = [
  ["utilities", /\b(electric|energy|power|duke|aep|con\s?ed|pg&?e|gas co|natural gas|water|sewer|utility|utilities|waste|trash|refuse|internet|comcast|xfinity|spectrum|at&?t|verizon)\b/],
  ["mortgage", /\b(mortgage|loan pmt|loan payment|escrow|rocket mortgage|freedom mtg|mr cooper|wells fargo home)\b/],
  ["insurance", /\b(insurance|insur|state farm|allstate|geico|progressive|liberty mutual|nationwide)\b/],
  ["taxes", /\b(tax|treasurer|county of|irs|dept of revenue)\b/],
  // Stems carry a \w* because a trailing \b will not let one through: "plumb"
  // does not match "PLUMBING".
  ["repairs", /\b(home depot|lowe'?s|menards|ace hardware|plumb\w*|hvac|roof\w*|electric(ian)?|handyman|repair\w*|contractor\w*|sherwin|grainger)\b/],
  ["turnover", /\b(clean\w*|carpet|paint\w*|junk removal|dumpster|locksmith|turnover)\b/],
  ["software", /\b(software|subscription|saas|google|microsoft|adobe|zoom|godaddy|namecheap)\b/],
];

export function suggestCategory(description: string): string {
  const text = description.toLowerCase();
  for (const [category, pattern] of CATEGORY_HINTS) {
    if (pattern.test(text)) return category;
  }
  return "other";
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
