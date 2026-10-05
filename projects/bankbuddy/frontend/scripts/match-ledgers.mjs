#!/usr/bin/env node
/*
 * Read-only matcher for Money Manager SQLite and the two bank CSV exports.
 * It writes a review queue under data/analysis/ (which is Git-ignored) and
 * never changes either database.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = path.join(project, "data");
const args = new Map(process.argv.slice(2).map((value, index, list) => value.startsWith("--") ? [value.slice(2), list[index + 1]] : []));
const mmFile = args.get("money-manager") || path.join(data, "source", "moneymanager-original-backup.mmbak");
const revolutFile = args.get("revolut") || path.join(data, "source", "revolut-september-2026.csv");
const nordeaFile = args.get("nordea") || path.join(data, "source", "nordea-october-2026.csv");
const outFile = args.get("out") || path.join(data, "analysis", "reconciliation.json");

function csv(text, delimiter) {
  const rows = []; let row = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]; const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell); if (row.some(Boolean)) rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  row.push(cell); if (row.some(Boolean)) rows.push(row);
  return rows;
}

function amount(value) { return Number(String(value).replace(/[^0-9,.-]/g, "").replace(/,/g, "")); }
function isoDate(value) {
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(value)) return value.replaceAll("/", "-");
  const parsed = new Date(`${value} UTC`);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString().slice(0, 10);
}

function readRevolut() {
  const rows = csv(readFileSync(revolutFile, "utf8").replace(/^\uFEFF/, ""), ",");
  const header = rows.findIndex((row) => row[0] === "Date" && row[1] === "Description" && row[2] === "Category");
  if (header < 0) throw new Error("Revolut transaction header not found");
  return rows.slice(header + 1).flatMap((row, index) => {
    const date = isoDate(row[0] || ""); const value = amount(row[3]);
    if (!date || !/NOK/.test(row[3] || "") || !(value < 0) || row[2] === "Others") return [];
    return [{ id: `revolut-${index}`, source: "revolut", date, description: row[1], amount: Math.abs(value), state: "booked" }];
  });
}

function readNordea() {
  const rows = csv(readFileSync(nordeaFile, "utf8").replace(/^\uFEFF/, ""), ";");
  return rows.slice(1).flatMap((row, index) => {
    const date = isoDate(row[0] || ""); const value = amount(row[1]);
    if (!date || !(value < 0)) return [];
    return [{ id: `nordea-${index}`, source: "nordea", date, description: row[5] || row[4] || "Unlabelled", amount: Math.abs(value), state: "booked" }];
  });
}

function sqlite(query) {
  return JSON.parse(execFileSync("sqlite3", ["-readonly", "-json", mmFile, query], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }) || "[]");
}

function readMoneyManager() {
  const query = `SELECT t.Z_PK AS id, date(t.ZDATE + 978307200, 'unixepoch') AS date,
    time(t.ZDATE + 978307200, 'unixepoch') AS time,
    t.ZAMOUNTACCOUNT AS amount, t.ZASSETUID AS accountUid, coalesce(t.ZCONTENT, '') AS description,
    a.ZNICNAME AS accountName, t.ZDO_TYPE AS type, t.ZCURRENCYUID AS currencyUid
    FROM ZINOUTCOME t JOIN ZASSET a ON a.ZUID = t.ZASSETUID
    WHERE t.ZISDEL = 0 AND t.ZDO_TYPE = 1 AND a.ZISDEL IN (0, 3)`;
  return sqlite(query).map((row) => ({
    ...row,
    source: row.accountName.toLowerCase().includes("evolut") ? "revolut-mm" : "nordea-mm",
    amount: Number(row.amount),
  }));
}

function daysBetween(left, right) { return Math.abs((Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / 86400000); }
function normalize(value) { return value.toLowerCase().replace(/[^a-z0-9æøå]/g, " ").split(/\s+/).filter((word) => word.length > 2); }
function sharedWords(left, right) { const words = new Set(normalize(left)); return normalize(right).filter((word) => words.has(word)).length; }

function edge(source, mm) {
  const distance = daysBetween(source.date, mm.date); if (distance > 7) return null;
  const roundUp = source.source === "revolut" ? Math.ceil(source.amount / 10) * 10 - source.amount : 0;
  const difference = Math.abs(mm.amount - source.amount);
  const amountKind = difference < 0.01 ? "exact" : Math.abs(mm.amount - source.amount - roundUp) < 0.01 ? "round-up" : null;
  if (!amountKind && difference > 10) return null;
  const words = sharedWords(source.description, mm.description);
  const sameInstitution = (source.source === "revolut" && mm.source === "revolut-mm") || (source.source === "nordea" && mm.source === "nordea-mm");
  const nokAccount = mm.currencyUid === "EUR_NOK";
  const score = (sameInstitution ? 24 : 3) + (nokAccount ? 12 : 0) + (amountKind ? 40 : Math.max(0, 18 - difference * 2)) + (distance <= 1 ? 15 : distance <= 3 ? 8 : 2) + Math.min(15, words * 7);
  return { source, mm, score, distance, roundUp, amountKind, words, accountMatch: sameInstitution && nokAccount ? "expected" : sameInstitution ? "currency-review" : "account-review" };
}

const sources = [...readRevolut(), ...readNordea()];
const firstSourceDate = sources.map((item) => item.date).sort()[0];
const lastSourceDate = sources.map((item) => item.date).sort().at(-1);
const inStatementWindow = (date) => date >= new Date(Date.parse(`${firstSourceDate}T00:00:00Z`) - 7 * 86400000).toISOString().slice(0, 10)
  && date <= new Date(Date.parse(`${lastSourceDate}T00:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
const moneyManager = readMoneyManager().filter((item) => inStatementWindow(item.date));
const edges = sources.flatMap((source) => moneyManager.map((mm) => edge(source, mm)).filter(Boolean)).sort((a, b) => b.score - a.score);
const claimedSource = new Set(); const claimedMm = new Set(); const matches = [];
for (const candidate of edges) {
  if (claimedSource.has(candidate.source.id) || claimedMm.has(candidate.mm.id)) continue;
  if (candidate.score < 70) continue;
  claimedSource.add(candidate.source.id); claimedMm.add(candidate.mm.id);
  matches.push({ ...candidate, status: candidate.score >= 85 && candidate.accountMatch === "expected" ? "confirmed" : "review" });
}

function suggestionsForSource(transaction) {
  return edges.filter((item) => item.source.id === transaction.id).slice(0, 3).map((item) => ({ moneyManagerId: item.mm.id, accountName: item.mm.accountName, currencyUid: item.mm.currencyUid, score: item.score, distance: item.distance, amountKind: item.amountKind, accountMatch: item.accountMatch }));
}
function suggestionsForMoneyManager(transaction) {
  return edges.filter((item) => item.mm.id === transaction.id).slice(0, 3).map((item) => ({ sourceId: item.source.id, score: item.score, distance: item.distance, amountKind: item.amountKind }));
}

const result = {
  generatedAt: new Date().toISOString(),
  sourceFiles: { moneyManager: path.basename(mmFile), revolut: path.basename(revolutFile), nordea: path.basename(nordeaFile) },
  matches: matches.map(({ source, mm, score, distance, roundUp, amountKind, status }) => ({
    id: `${source.id}:${mm.id}`, source, moneyManager: mm, score, distance, roundUp, amountKind, status,
    proposedEdit: amountKind === "round-up"
      ? { action: "split-round-up", merchantAmount: source.amount, roundUp, note: source.description, requiresSavingsDestination: true }
      : { action: "rename", note: source.description },
  })),
  unmatched: {
    revolut: sources.filter((item) => item.source === "revolut" && !claimedSource.has(item.id)).map((transaction) => ({ transaction, suggestions: suggestionsForSource(transaction) })),
    nordea: sources.filter((item) => item.source === "nordea" && !claimedSource.has(item.id)).map((transaction) => ({ transaction, suggestions: suggestionsForSource(transaction) })),
    revolutMoneyManager: moneyManager.filter((item) => item.source === "revolut-mm" && !claimedMm.has(item.id)).map((transaction) => ({ transaction, suggestions: suggestionsForMoneyManager(transaction) })),
    nordeaMoneyManager: moneyManager.filter((item) => item.source === "nordea-mm" && !claimedMm.has(item.id)).map((transaction) => ({ transaction, suggestions: suggestionsForMoneyManager(transaction) })),
  },
};
mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`);
console.log(`Wrote ${result.matches.length} proposed matches to ${outFile}`);
