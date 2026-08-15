/**
 * Turns a bank statement into rows the app can book.
 *
 * Every bank exports slightly different CSV headers, so instead of demanding
 * one format we look for whichever columns look like a date, a description and
 * an amount. Plain text pasted out of a PDF statement also works.
 *
 * This is the same logic the server used to run, moved into the browser now
 * that the browser talks to the database directly. Nothing about a statement
 * leaves this machine.
 */

const DATE_KEYS = ["date", "posted date", "posting date", "transaction date", "post date", "settled", "created"];
const DESC_KEYS = ["description", "name", "memo", "details", "payee", "note", "notes", "narrative", "transaction", "to/from", "counterparty"];
const AMOUNT_KEYS = ["amount", "credit", "deposit", "amount (usd)", "net amount", "amount in"];

/** Splits a CSV line, honouring quoted fields containing commas. */
function splitCsvLine(line) {
  const out = [];
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

function parseAmount(raw) {
  if (!raw) return null;
  let text = String(raw).replace(/[$\s,]/g, "").replace(/[“”"]/g, "");
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

/** Normalises the many date shapes banks emit into YYYY-MM-DD. */
export function parseDate(raw) {
  if (!raw) return null;
  const text = String(raw).trim().replace(/^["']|["']$/g, "");

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
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

function findIndex(headers, candidates) {
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
 *
 * "Details" and "Transaction" are held back as a fallback. Chase has a Details
 * column next to its Description column, and it holds DEBIT or CREDIT — reading
 * both gives "DEBIT — DUKE ENERGY", which then fails to match anything and
 * reads like nonsense in the books. A column is only worth joining on when
 * nothing better is present.
 */
const STRONG_DESC = ["description", "name", "memo", "payee", "note", "notes", "narrative", "to/from", "counterparty", "sender"];
const WEAK_DESC = ["details", "transaction"];

function describeIndices(headers, dateIndex, amountIndex) {
  // Skip columns that are clearly identifiers or bookkeeping noise.
  const isNoise = (header) => /id$|^id|balance|currency|status|type|fee|tax|account/.test(header);
  const pick = (keys) => {
    const indices = [];
    headers.forEach((header, index) => {
      if (index === dateIndex || index === amountIndex || isNoise(header)) return;
      if (keys.some((key) => header.includes(key))) indices.push(index);
    });
    return indices;
  };

  const strong = pick(STRONG_DESC);
  return strong.length > 0 ? strong : pick(WEAK_DESC);
}

/** Parses CSV/TSV text that has a header row. */
function parseDelimited(lines) {
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/^["']|["']$/g, ""));
  const dateIndex = findIndex(headers, DATE_KEYS);
  let amountIndex = findIndex(headers, AMOUNT_KEYS);

  // Some exports split money into separate debit and credit columns.
  const creditIndex = headers.findIndex((h) => h.includes("credit") || h.includes("deposit"));
  if (amountIndex === -1 && creditIndex !== -1) amountIndex = creditIndex;
  if (dateIndex === -1 || amountIndex === -1) return null;

  const descIndices = describeIndices(headers, dateIndex, amountIndex);

  const rows = [];
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
    const description = pieces.map((p) => p.trim()).filter(Boolean).join(" — ");

    rows.push({ posted_date: date, description, amount });
  }
  return rows;
}

/**
 * Fallback for text copied out of a PDF statement, where each line looks
 * roughly like: 03/04/2026  ZELLE FROM DANA LIU  1,250.00
 */
function parseFreeText(lines) {
  const rows = [];
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

    const description = trimmed.slice(dateMatch[0].length, last.index).replace(/\s+/g, " ").trim();
    rows.push({ posted_date: date, description, amount });
  }
  return rows;
}

export function parseStatement(text) {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  // Real exports rarely start with the header row — the bank's name, the
  // account number and the statement period usually come first. So look for the
  // header rather than assuming line one, and take the first position that
  // yields actual rows.
  const searchDepth = Math.min(lines.length, 15);
  for (let start = 0; start < searchDepth; start++) {
    if (!/[,\t]/.test(lines[start])) continue;
    const parsed = parseDelimited(lines.slice(start));
    if (parsed && parsed.length > 0) return parsed;
  }
  return parseFreeText(lines);
}

/** Stable id for a row, so importing the same statement twice doesn't duplicate. */
export function fingerprint(accountId, row) {
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
export function detectAccount(text, accounts) {
  const haystack = String(text).toLowerCase().slice(0, 20000);
  // Digit runs a statement would print for an account number: masked
  // (****4821, xxxx4821, ···4821) or the tail of a longer number.
  const masked = [...haystack.matchAll(/[*x·•#-]{2,}\s?(\d{4})\b/g)].map((m) => m[1]);
  const afterLabel = [...haystack.matchAll(/account[^0-9]{0,20}(\d{4})\b/g)].map((m) => m[1]);
  const digits = new Set([...masked, ...afterLabel]);

  const guesses = accounts
    .map((account) => {
      let score = 0;
      const reasons = [];

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
 * The bills a landlord actually pays, kept separate rather than lumped into one
 * "utilities" bucket. At tax time the difference between the water bill and the
 * mortgage matters, and a category you have to split apart later is a category
 * that was never worth recording.
 */
export const CATEGORIES = [
  ["mortgage", "Mortgage"],
  ["electric", "Electric"],
  ["water", "Water & sewer"],
  ["gas", "Gas & heating"],
  ["internet", "Internet & phone"],
  ["insurance", "Insurance"],
  ["taxes", "Property taxes"],
  ["repairs", "Repairs"],
  ["turnover", "Turnover & cleaning"],
  ["hoa", "HOA & fees"],
  ["utilities", "Other utilities"],
  ["other", "Something else"],
];

export function categoryLabel(value) {
  return CATEGORIES.find(([key]) => key === value)?.[1] ?? "Something else";
}

/**
 * What kind of bill does this withdrawal look like?
 *
 * Bank descriptions are terse but consistent — "DUKE ENERGY", "CITY OF COLUMBUS
 * WATER", "HOME DEPOT". Matching them turns a statement into bookkeeping
 * instead of a list of mystery debits. It is only a suggestion: every row shows
 * the category in a dropdown you can change before anything is booked.
 */
const CATEGORY_HINTS = [
  ["mortgage", /\b(mortgage|mtg|loan pmt|loan payment|escrow|rocket mortgage|freedom mtg|mr cooper|wells fargo home|chase home|penny ?mac|lakeview|selene)\b/],
  ["electric", /\b(electric|energy|power|duke|aep|con\s?ed|pg&?e|dominion|entergy|xcel|georgia power|fpl|reliant)\b/],
  ["water", /\b(water|sewer|sewage|aqua|utilit(y|ies) (dept|department)|city of [a-z ]*water|waste ?water|trash|refuse|garbage|waste management|rumpke|republic services)\b/],
  ["gas", /\b(natural gas|gas co|gas company|columbia gas|nicor|spire|national grid|heating oil|propane)\b/],
  ["internet", /\b(internet|wi-?fi|comcast|xfinity|spectrum|at&?t|verizon|t-?mobile|cox comm|frontier|centurylink|google fiber|starlink|phone)\b/],
  ["insurance", /\b(insurance|insur|state farm|allstate|geico|progressive|liberty mutual|nationwide|travelers|erie ins)\b/],
  ["taxes", /\b(tax|treasurer|county of|irs|dept of revenue|auditor)\b/],
  // Stems carry a \w* because a trailing \b will not let one through: "plumb"
  // does not match "PLUMBING", so a plumber's invoice was landing in "Something
  // else" every month.
  ["repairs", /\b(home depot|lowe'?s|menards|ace hardware|plumb\w*|hvac|roof\w*|electrician|handyman|repair\w*|contractor\w*|sherwin|grainger|appliance\w*|heating|cooling)\b/],
  ["turnover", /\b(clean\w*|carpet|paint\w*|junk removal|dumpster|locksmith|turnover|landscap\w*|lawn|mow\w*|snow)\b/],
  ["hoa", /\b(hoa|homeowners assoc|condo assoc|association dues|management fee)\b/],
];

export function suggestCategory(description) {
  const text = String(description).toLowerCase();
  for (const [category, pattern] of CATEGORY_HINTS) {
    if (pattern.test(text)) return category;
  }
  return "other";
}

/**
 * The vendor's name, pulled out of a statement line.
 *
 * Statements bolt a reference onto the end — "DUKE ENERGY OH PAYMENT 8829119",
 * "ROCKET MORTGAGE PMT 03/04" — and the reference changes every month while the
 * name never does. So a remembered rule is built from the words at the front,
 * with the digits and the bank's own boilerplate stripped off. Get it wrong and
 * you can edit the rule; the point is that the suggestion is usually right.
 */
const BOILERPLATE = /\b(payment|pmt|ach|debit|credit|purchase|pos|recurring|autopay|auto pay|online|web|bill ?pay|withdrawal|deposit|transfer|xfer|des|id|indn|ppd|ccd|co|ref)\b/g;

export function vendorKey(description) {
  const cleaned = String(description)
    .toLowerCase()
    .split(/ — /)[0]
    .replace(/[#*]/g, " ")
    .replace(/\b[\d/.-]{2,}\b/g, " ")
    .replace(BOILERPLATE, " ")
    .replace(/[^a-z& ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = cleaned.split(" ").filter((w) => w.length > 1);
  // Two words name a vendor without pinning it to one month's reference:
  // "duke energy", "rocket mortgage", "city columbus".
  return words.slice(0, 2).join(" ");
}

/**
 * Applies the landlord's own rules first.
 *
 * A rule the landlord wrote beats a pattern we shipped, always. They know their
 * plumber's trading name and we do not.
 */
export function applyRules(description, rules) {
  const text = String(description).toLowerCase();
  const hits = rules
    .filter((rule) => rule.match && text.includes(String(rule.match).toLowerCase()))
    // The most specific rule wins, so "duke energy solar" beats "duke".
    .sort((a, b) => String(b.match).length - String(a.match).length);
  return hits[0] ?? null;
}

/**
 * How the money arrived.
 *
 * A landlord chasing a missing payment asks "did they Zelle it?", so the way it
 * came in is worth keeping. Statements say so plainly enough to read.
 */
export const METHODS = [
  ["zelle", "Zelle"],
  ["cashapp", "Cash App"],
  ["venmo", "Venmo"],
  ["bank", "Bank transfer"],
  ["cash", "Cash"],
  ["check", "Check"],
  ["card", "Card"],
  ["money_order", "Money order"],
  ["other", "Other"],
];

export function methodLabel(value) {
  return METHODS.find(([key]) => key === value)?.[1] ?? "Other";
}

const METHOD_HINTS = [
  ["zelle", /\bzelle\b/],
  ["cashapp", /\bcash ?app\b|\bsquare cash\b|\bcash out\b/],
  ["venmo", /\bvenmo\b/],
  ["check", /\bche(ck|que)\b|\bck#?\d/],
  ["cash", /\bcash (deposit|dep)\b|\bteller (cash )?dep/],
  ["card", /\bdebit\b|\bcredit card\b|\bvisa\b|\bmastercard\b/],
  ["money_order", /\bmoney order\b|\bmo #/],
  ["bank", /\bach\b|\btransfer\b|\bdirect dep|\bdeposit\b|\bwire\b/],
];

export function suggestMethod(description) {
  const text = String(description).toLowerCase();
  for (const [method, pattern] of METHOD_HINTS) {
    if (pattern.test(text)) return method;
  }
  return "bank";
}

/**
 * Scores how likely a deposit belongs to a given charge.
 *
 * The tenant's name in the description is the strongest signal; an exact amount
 * and a nearby due date add confidence.
 */
export function matchScore(description, amount, candidate) {
  let score = 0;
  const haystack = String(description).toLowerCase();
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

/**
 * Pairs each deposit with the charge it most likely settles.
 *
 * Only confident pairings are offered, and each charge can only be claimed
 * once — two rent payments of the same amount in one month must not both be
 * matched to January's charge, leaving February looking unpaid.
 */
export function matchDeposits(rows, charges, people) {
  const nameOf = new Map(
    people.map((p) => [p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()])
  );
  const taken = new Set();

  return rows.map((row) => {
    if (row.amount <= 0) return { row, charge: null, score: 0 };

    let best = null;
    for (const charge of charges) {
      if (taken.has(charge.id) || charge.status === "paid") continue;
      const score = matchScore(row.description, row.amount, {
        tenantName: nameOf.get(charge.person) || "",
        amount: Number(charge.amount) || 0,
        dueDate: String(charge.due_date ?? ""),
        postedDate: row.posted_date,
      });
      if (!best || score > best.score) best = { charge, score };
    }

    // 55 is "the amount matches and it arrived on time", or "the name matches
    // and the amount is close". Below that we would be guessing at the
    // landlord's books, so the row waits to be assigned by hand.
    if (best && best.score >= 55) {
      taken.add(best.charge.id);
      return { row, charge: best.charge, score: best.score };
    }
    return { row, charge: null, score: best?.score ?? 0 };
  });
}
