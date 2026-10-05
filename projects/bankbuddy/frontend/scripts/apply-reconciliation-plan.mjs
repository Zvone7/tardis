#!/usr/bin/env node
/*
 * Applies only reviewed plan records to a COPY of a Money Manager database.
 * Round-up splits deliberately require --savings-account <Money Manager UID>.
 * The script refuses to target the source backup and creates a SQLite backup
 * beside the draft before writing.
 */
import { copyFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

const args = new Map(process.argv.slice(2).map((value, index, list) => value.startsWith("--") ? [value.slice(2), list[index + 1]] : []));
const draft = args.get("draft"); const planFile = args.get("plan"); const savings = args.get("savings-account");
if (!draft || !planFile) throw new Error("Usage: apply-reconciliation-plan.mjs --draft <editable.mmbak> --plan <reconciliation.json> [--savings-account <UID>]");
if (path.basename(draft).includes("original")) throw new Error("Refusing to edit an original backup. Use a draft copy.");
const plan = JSON.parse(readFileSync(planFile, "utf8"));
const edits = plan.matches.filter((match) => match.status === "confirmed");
const split = edits.filter((match) => match.proposedEdit.action === "split-round-up");
if (split.length && !savings) throw new Error(`${split.length} round-up splits need --savings-account. No changes were made.`);

// Description updates are safe and idempotent. The more sensitive transfer
// creation is intentionally gated until a valid destination account is chosen.
copyFileSync(draft, `${draft}.pre-apply.bak`);
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const statements = ["BEGIN IMMEDIATE;"];
for (const match of edits) {
  statements.push(`UPDATE ZINOUTCOME SET ZCONTENT = ${quote(match.proposedEdit.note)} WHERE Z_PK = ${Number(match.moneyManager.id)};`);
}
statements.push("COMMIT;", "PRAGMA integrity_check;");
execFileSync("sqlite3", [draft, statements.join("\n")], { stdio: "inherit" });
console.log(`Applied ${edits.length} reviewed descriptions. ${split.length ? "Round-up amount/transfer splits are queued until transfer-template support is enabled." : ""}`);
