#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const database = process.argv[2] || path.join(project, "data", "bankingbuddy.sqlite");
mkdirSync(path.dirname(database), { recursive: true });
const schema = "PRAGMA journal_mode=WAL;\n"
  + "CREATE TABLE IF NOT EXISTS decisions (candidate_id TEXT PRIMARY KEY, source_transaction_id TEXT NOT NULL, money_manager_transaction_id TEXT, decision TEXT NOT NULL CHECK(decision IN ('confirmed', 'rejected', 'edited')), certainty REAL NOT NULL CHECK(certainty >= 0 AND certainty <= 1), proposed_edit TEXT, user_note TEXT, decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);\n"
  + "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);\n"
  + "CREATE TABLE IF NOT EXISTS monthly_rebalances (id INTEGER PRIMARY KEY, account_key TEXT NOT NULL, month TEXT NOT NULL, statement_opening_balance REAL, statement_closing_balance REAL, money_manager_net_change REAL NOT NULL, required_adjustment REAL NOT NULL, status TEXT NOT NULL DEFAULT 'provisional' CHECK(status IN ('provisional', 'accepted', 'replaced')), money_manager_transaction_id TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(account_key, month));\n"
  + "INSERT OR IGNORE INTO settings(key, value) VALUES ('round_up_destination_name', 'Demo savings');";
execFileSync("sqlite3", [database, schema], { stdio: "inherit" });
console.log("Initialized " + database);
