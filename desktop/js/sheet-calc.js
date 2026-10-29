/**
 * Local formula engine for the free desktop spreadsheet.
 * A cell that starts with "=" is a formula. Everything else is text.
 * No network and no login. This is not Excel.
 *
 * Functions: SUM AVERAGE MIN MAX COUNT COUNTA PRODUCT IF ROUND ABS CONCAT
 * Also: + - * / parentheses, unary minus, &, comparisons, A1 and $A$1, A1:B2.
 */

const FUNCS = new Set([
  "SUM",
  "AVERAGE",
  "MIN",
  "MAX",
  "COUNT",
  "COUNTA",
  "PRODUCT",
  "IF",
  "ROUND",
  "ABS",
  "CONCAT",
]);

export function colLetters(index) {
  let n = index;
  let s = "";
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function colIndex(letters) {
  const s = String(letters || "").toUpperCase();
  if (!/^[A-Z]{1,3}$/.test(s)) return -1;
  let n = 0;
  for (let i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
  return n - 1;
}

function fail(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return "#VALUE!";
  if (Object.is(n, -0) || n === 0) return "0";
  const rounded = Math.round(n * 1e10) / 1e10;
  let s = String(rounded);
  if (/e/i.test(s)) {
    s = rounded.toFixed(10).replace(/\.?0+$/, "");
  }
  return s;
}

function asNum(v) {
  if (!v) return { err: "#VALUE!" };
  if (v.err) return v;
  if (v.range) return { err: "#VALUE!" };
  if (v.num != null) return v;
  if (v.bool != null) return { num: v.bool ? 1 : 0 };
  if (v.blank) return { num: 0 };
  const raw = v.lit != null ? v.lit : v.str != null ? v.str : null;
  if (raw == null) return { err: "#VALUE!" };
  if (raw.trim() === "") return { num: 0 };
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw.trim())) return { num: Number(raw) };
  return { err: "#VALUE!" };
}

/** Number when the value is numeric or blank. Null when it is text. */
function asNumLoose(v) {
  if (!v || v.err || v.range) return null;
  if (v.num != null) return v.num;
  if (v.bool != null) return v.bool ? 1 : 0;
  if (v.blank) return 0;
  const raw = v.lit != null ? v.lit : v.str != null ? v.str : "";
  if (raw.trim() === "") return 0;
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(raw.trim())) return Number(raw);
  return null;
}

function asText(v) {
  if (!v || v.blank) return "";
  if (v.err) return v.err;
  if (v.str != null) return v.str;
  if (v.lit != null) return v.lit;
  if (v.num != null) return formatNumber(v.num);
  if (v.bool != null) return v.bool ? "TRUE" : "FALSE";
  return "";
}

function showValue(v) {
  if (!v || v.blank) return "";
  if (v.err) return v.err;
  if (v.lit != null) return v.lit;
  if (v.num != null) return formatNumber(v.num);
  if (v.bool != null) return v.bool ? "TRUE" : "FALSE";
  if (v.str != null) return v.str;
  return "";
}

function negate(v) {
  const n = asNum(v);
  if (n.err) return n;
  return { num: -n.num };
}

function arith(left, op, right) {
  const a = asNum(left);
  const b = asNum(right);
  if (a.err) return a;
  if (b.err) return b;
  if (op === "+") return { num: a.num + b.num };
  if (op === "-") return { num: a.num - b.num };
  if (op === "*") return { num: a.num * b.num };
  if (op === "/") {
    if (b.num === 0) return { err: "#DIV/0!" };
    return { num: a.num / b.num };
  }
  return { err: "#VALUE!" };
}

function concatValues(left, right) {
  if (left?.err) return left;
  if (right?.err) return right;
  if (left?.range || right?.range) return { err: "#VALUE!" };
  return { str: asText(left) + asText(right) };
}

function compareValues(left, op, right) {
  if (left?.err) return left;
  if (right?.err) return right;
  if (left?.range || right?.range) return { err: "#VALUE!" };
  const ln = asNumLoose(left);
  const rn = asNumLoose(right);
  let ord;
  if (ln != null && rn != null) {
    ord = ln < rn ? -1 : ln > rn ? 1 : 0;
  } else {
    const ls = asText(left).toLowerCase();
    const rs = asText(right).toLowerCase();
    ord = ls < rs ? -1 : ls > rs ? 1 : 0;
  }
  const ok =
    op === "="
      ? ord === 0
      : op === "<>"
        ? ord !== 0
        : op === "<"
          ? ord < 0
          : op === ">"
            ? ord > 0
            : op === "<="
              ? ord <= 0
              : op === ">="
                ? ord >= 0
                : null;
  if (ok == null) return { err: "#VALUE!" };
  return { bool: ok };
}

function roundAway(n, digits) {
  const f = 10 ** digits;
  const x = n * f;
  const sign = x < 0 ? -1 : 1;
  return (sign * Math.round(Math.abs(x))) / f;
}

/**
 * @param {string[][]} raw
 * @returns {string[][]}
 */
export function evaluateGrid(raw) {
  const rows = Array.isArray(raw)
    ? raw.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : []))
    : [];
  const nR = rows.length;
  const nC = nR ? rows.reduce((m, row) => Math.max(m, row.length), 0) : 0;
  const memo = new Map();

  function evalCell(r, c) {
    if (r < 0 || c < 0 || r >= nR || c >= nC) return { err: "#REF!" };
    const key = r + "," + c;
    const hit = memo.get(key);
    if (hit === "visiting") return { err: "#CYCLE!" };
    if (hit && typeof hit === "object") return hit;
    memo.set(key, "visiting");
    const text = rows[r][c] ?? "";
    let value;
    if (text.startsWith("=")) {
      try {
        const parser = createParser(text.slice(1), evalCell);
        value = parser.parseCompare();
        parser.skip();
        if (!parser.eof() || value?.range) value = { err: "#VALUE!" };
      } catch (e) {
        value = { err: e && e.code ? e.code : "#VALUE!" };
      }
    } else if (text === "") {
      value = { blank: true };
    } else {
      value = { lit: text };
    }
    memo.set(key, value);
    return value;
  }

  const display = [];
  for (let r = 0; r < nR; r++) {
    const line = [];
    for (let c = 0; c < nC; c++) {
      if (c >= (rows[r]?.length ?? 0)) {
        line.push("");
        continue;
      }
      const value = evalCell(r, c);
      line.push(showValue(value));
    }
    display.push(line);
  }
  return display;
}

function createParser(src, evalCell) {
  let i = 0;
  const s = String(src || "");

  function peek() {
    return s[i];
  }
  function eof() {
    return i >= s.length;
  }
  function skip() {
    while (s[i] === " " || s[i] === "\t" || s[i] === "\n" || s[i] === "\r") i++;
  }
  function isAlpha(ch) {
    return (ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z");
  }
  function isDigit(ch) {
    return ch >= "0" && ch <= "9";
  }

  function parseCompare() {
    let left = parseConcat();
    skip();
    const two = s.slice(i, i + 2);
    let op = "";
    if (two === "<=" || two === ">=" || two === "<>") op = two;
    else if (peek() === "<" || peek() === ">" || peek() === "=") op = peek();
    if (!op) return left;
    i += op.length;
    const right = parseConcat();
    return compareValues(left, op, right);
  }

  function parseConcat() {
    let left = parseAdd();
    for (;;) {
      skip();
      if (peek() !== "&") break;
      i++;
      left = concatValues(left, parseAdd());
    }
    return left;
  }

  function parseAdd() {
    let left = parseMul();
    for (;;) {
      skip();
      if (peek() !== "+" && peek() !== "-") break;
      const op = peek();
      i++;
      left = arith(left, op, parseMul());
    }
    return left;
  }

  function parseMul() {
    let left = parseUnary();
    for (;;) {
      skip();
      if (peek() !== "*" && peek() !== "/") break;
      const op = peek();
      i++;
      left = arith(left, op, parseUnary());
    }
    return left;
  }

  function parseUnary() {
    skip();
    if (peek() === "+") {
      i++;
      return parseUnary();
    }
    if (peek() === "-") {
      i++;
      return negate(parseUnary());
    }
    return parseAtom();
  }

  function parseAtom() {
    skip();
    if (s.startsWith("#REF!", i)) {
      i += 5;
      return { err: "#REF!" };
    }
    const ch = peek();
    if (!ch) throw fail("#VALUE!");
    if (ch === "(") {
      i++;
      const inner = parseCompare();
      skip();
      if (peek() !== ")") throw fail("#VALUE!");
      i++;
      return inner;
    }
    if (ch === '"') return parseString();
    if (ch === "." || isDigit(ch)) return parseNumber();
    if (ch === "$" || isAlpha(ch)) return parseNameOrRef();
    throw fail("#VALUE!");
  }

  function parseString() {
    i++;
    let out = "";
    while (i < s.length) {
      if (s[i] === '"') {
        if (s[i + 1] === '"') {
          out += '"';
          i += 2;
          continue;
        }
        i++;
        return { str: out };
      }
      out += s[i];
      i++;
    }
    throw fail("#VALUE!");
  }

  function parseNumber() {
    const start = i;
    while (isDigit(peek())) i++;
    if (peek() === ".") {
      i++;
      while (isDigit(peek())) i++;
    }
    const token = s.slice(start, i);
    if (token === "." || token === "") throw fail("#VALUE!");
    return { num: Number(token) };
  }

  function parseNameOrRef() {
    skip();
    if (isAlpha(peek())) {
      const mark = i;
      let name = "";
      while (isAlpha(peek())) {
        name += s[i];
        i++;
      }
      const after = i;
      skip();
      if (peek() === "(") return parseCall(name.toUpperCase());
      const upper = name.toUpperCase();
      if (upper === "TRUE") return { bool: true };
      if (upper === "FALSE") return { bool: false };
      i = mark;
      void after;
    }
    return parseRef();
  }

  function readRef() {
    skip();
    let absCol = false;
    let absRow = false;
    if (peek() === "$") {
      absCol = true;
      i++;
    }
    let col = "";
    while (isAlpha(peek())) {
      col += s[i].toUpperCase();
      i++;
    }
    if (!col) throw fail("#NAME?");
    if (peek() === "$") {
      absRow = true;
      i++;
    }
    let row = "";
    while (isDigit(peek())) {
      row += s[i];
      i++;
    }
    if (!row) throw fail("#NAME?");
    const c = colIndex(col);
    const r = Number(row) - 1;
    if (c < 0 || r < 0) return { err: "#REF!", absCol, absRow };
    return { r, c, absCol, absRow };
  }

  function parseRef() {
    const start = readRef();
    if (start.err) return start;
    skip();
    if (peek() !== ":") return evalCell(start.r, start.c);
    i++;
    const end = readRef();
    if (end.err) return end;
    return { range: { r1: start.r, c1: start.c, r2: end.r, c2: end.c } };
  }

  function parseCall(name) {
    if (!FUNCS.has(name)) throw fail("#NAME?");
    if (peek() !== "(") throw fail("#VALUE!");
    i++;
    const args = [];
    skip();
    if (peek() !== ")") {
      for (;;) {
        args.push(parseCompare());
        skip();
        if (peek() === ",") {
          i++;
          continue;
        }
        break;
      }
    }
    skip();
    if (peek() !== ")") throw fail("#VALUE!");
    i++;
    return applyFunc(name, args, evalCell);
  }

  return { parseCompare, skip, eof };
}

function flattenArg(arg, evalCell, into) {
  if (arg?.err) {
    into.push(arg);
    return;
  }
  if (!arg?.range) {
    into.push(arg);
    return;
  }
  const r1 = Math.min(arg.range.r1, arg.range.r2);
  const r2 = Math.max(arg.range.r1, arg.range.r2);
  const c1 = Math.min(arg.range.c1, arg.range.c2);
  const c2 = Math.max(arg.range.c1, arg.range.c2);
  const count = (r2 - r1 + 1) * (c2 - c1 + 1);
  if (count > 10000) {
    into.push({ err: "#VALUE!" });
    return;
  }
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) into.push(evalCell(r, c));
  }
}

function numsFrom(values, { skipText }) {
  const nums = [];
  for (const v of values) {
    if (v?.err) {
      if (skipText) continue;
      return v;
    }
    if (v?.blank) continue;
    if (v?.range) return { err: "#VALUE!" };
    if (skipText && v?.lit != null && asNumLoose(v) == null && String(v.lit).trim() !== "") continue;
    if (skipText && v?.str != null && asNumLoose(v) == null) continue;
    const n = asNum(v);
    if (n.err) {
      if (skipText) continue;
      return n;
    }
    if (v?.blank) continue;
    if ((v?.lit != null || v?.str != null) && String(v.lit ?? v.str).trim() === "") continue;
    nums.push(n.num);
  }
  return nums;
}

function applyFunc(name, args, evalCell) {
  if (name === "IF") {
    if (args.length < 2 || args.length > 3) return { err: "#VALUE!" };
    const cond = asBool(args[0]);
    if (cond.err) return cond;
    const picked = cond.bool ? args[1] : args.length > 2 ? args[2] : { bool: false };
    if (picked?.range) return { err: "#VALUE!" };
    return picked;
  }
  if (name === "ROUND") {
    if (args.length < 1 || args.length > 2) return { err: "#VALUE!" };
    const n = asNum(args[0]);
    if (n.err) return n;
    let digits = 0;
    if (args.length === 2) {
      const d = asNum(args[1]);
      if (d.err) return d;
      digits = Math.trunc(d.num);
    }
    if (digits < -10 || digits > 10) return { err: "#VALUE!" };
    return { num: roundAway(n.num, digits) };
  }
  if (name === "ABS") {
    if (args.length !== 1) return { err: "#VALUE!" };
    const n = asNum(args[0]);
    if (n.err) return n;
    return { num: Math.abs(n.num) };
  }

  const flat = [];
  for (const arg of args) flattenArg(arg, evalCell, flat);
  for (const v of flat) {
    if (v?.err && name !== "COUNT" && name !== "COUNTA") return v;
  }

  if (name === "CONCAT") {
    let out = "";
    for (const v of flat) {
      if (v?.err) return v;
      out += asText(v);
    }
    return { str: out };
  }
  if (name === "COUNTA") {
    let n = 0;
    for (const v of flat) {
      if (v?.blank) continue;
      if (v?.lit === "") continue;
      if (v?.str === "" && v?.num == null && v?.bool == null && !v?.err) continue;
      n++;
    }
    return { num: n };
  }
  if (name === "COUNT") {
    const nums = numsFrom(flat, { skipText: true });
    if (nums.err) return nums;
    return { num: nums.length };
  }

  const nums = numsFrom(flat, { skipText: true });
  if (nums.err) return nums;
  if (name === "SUM") {
    return { num: nums.reduce((a, b) => a + b, 0) };
  }
  if (name === "PRODUCT") {
    if (!nums.length) return { num: 0 };
    return { num: nums.reduce((a, b) => a * b, 1) };
  }
  if (name === "AVERAGE") {
    if (!nums.length) return { err: "#DIV/0!" };
    return { num: nums.reduce((a, b) => a + b, 0) / nums.length };
  }
  if (name === "MIN") {
    if (!nums.length) return { num: 0 };
    return { num: Math.min(...nums) };
  }
  if (name === "MAX") {
    if (!nums.length) return { num: 0 };
    return { num: Math.max(...nums) };
  }
  return { err: "#NAME?" };
}

function asBool(v) {
  if (!v) return { bool: false };
  if (v.err) return v;
  if (v.range) return { err: "#VALUE!" };
  if (v.bool != null) return { bool: v.bool };
  if (v.num != null) return { bool: v.num !== 0 };
  if (v.blank) return { bool: false };
  const loose = asNumLoose(v);
  if (loose != null && (v.lit != null || v.str != null)) {
    if (String(v.lit ?? v.str).trim() === "") return { bool: false };
    return { bool: loose !== 0 };
  }
  if ((v.lit != null && v.lit !== "") || (v.str != null && v.str !== "")) return { err: "#VALUE!" };
  return { bool: false };
}

function rewriteOne(absCol, col, absRow, rowDigits, change) {
  let c = colIndex(col);
  let r = Number(rowDigits) - 1;
  if (c < 0 || r < 0) return "#REF!";
  if (change.kind === "insert-row") {
    if (r >= change.index) r += 1;
  } else if (change.kind === "delete-row") {
    if (r === change.index) return "#REF!";
    if (r > change.index) r -= 1;
  } else if (change.kind === "insert-col") {
    if (c >= change.index) c += 1;
  } else if (change.kind === "delete-col") {
    if (c === change.index) return "#REF!";
    if (c > change.index) c -= 1;
  }
  if (r < 0 || c < 0) return "#REF!";
  return `${absCol ? "$" : ""}${colLetters(c)}${absRow ? "$" : ""}${r + 1}`;
}

/** Shift A1-style references after a row or column is inserted or deleted. */
export function rewriteFormula(formula, change) {
  const src = String(formula ?? "");
  if (!src.startsWith("=") || !change) return src;
  const s = src.slice(1);
  let out = "=";
  let i = 0;
  while (i < s.length) {
    if (s[i] === '"') {
      let j = i + 1;
      while (j < s.length) {
        if (s[j] === '"') {
          if (s[j + 1] === '"') {
            j += 2;
            continue;
          }
          j++;
          break;
        }
        j++;
      }
      out += s.slice(i, j);
      i = j;
      continue;
    }
    const m = /^(\$?)([A-Za-z]{1,3})(\$?)(\d+)/.exec(s.slice(i));
    if (m) {
      const ref = rewriteOne(m[1], m[2], m[3], m[4], change);
      const next = i + m[0].length;
      const m2 = /^:(\$?)([A-Za-z]{1,3})(\$?)(\d+)/.exec(s.slice(next));
      if (m2) {
        const ref2 = rewriteOne(m2[1], m2[2], m2[3], m2[4], change);
        out += ref === "#REF!" || ref2 === "#REF!" ? "#REF!" : `${ref}:${ref2}`;
        i = next + m2[0].length;
      } else {
        out += ref;
        i = next;
      }
      continue;
    }
    out += s[i];
    i++;
  }
  return out;
}

function mapFormulas(data, change) {
  return data.map((row) => row.map((cell) => rewriteFormula(String(cell ?? ""), change)));
}

function rectangle(data) {
  const rows = data.map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? "")) : []));
  const cols = Math.max(1, ...rows.map((r) => r.length), 1);
  return rows.map((row) => {
    const next = row.slice(0, cols);
    while (next.length < cols) next.push("");
    return next;
  });
}

export function insertRow(data, index) {
  const rows = rectangle(Array.isArray(data) ? data : []);
  const at = Math.max(0, Math.min(index, rows.length));
  const next = mapFormulas(rows, { kind: "insert-row", index: at });
  const cols = next[0] ? next[0].length : 1;
  next.splice(at, 0, Array.from({ length: cols }, () => ""));
  return next;
}

export function deleteRow(data, index) {
  const rows = rectangle(Array.isArray(data) ? data : []);
  if (rows.length <= 1) return { data: rows, error: "Keep at least one row" };
  if (index < 0 || index >= rows.length) return { data: rows, error: "No such row" };
  const next = mapFormulas(rows, { kind: "delete-row", index });
  next.splice(index, 1);
  return { data: next, error: "" };
}

export function insertCol(data, index) {
  const rows = rectangle(Array.isArray(data) ? data : []);
  const cols = rows[0] ? rows[0].length : 1;
  const at = Math.max(0, Math.min(index, cols));
  const next = mapFormulas(rows, { kind: "insert-col", index: at });
  next.forEach((row) => row.splice(at, 0, ""));
  return next;
}

export function deleteCol(data, index) {
  const rows = rectangle(Array.isArray(data) ? data : []);
  const cols = rows[0] ? rows[0].length : 1;
  if (cols <= 1) return { data: rows, error: "Keep at least one column" };
  if (index < 0 || index >= cols) return { data: rows, error: "No such column" };
  const next = mapFormulas(rows, { kind: "delete-col", index });
  next.forEach((row) => row.splice(index, 1));
  return { data: next, error: "" };
}
