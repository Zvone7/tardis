> Historical prototype documentation. See the project README for the current hosted implementation.

# BankingBuddy

BankingBuddy is a local-first reconciliation workspace for bringing Revolut and Nordea exports into agreement with a Realbyte Money Manager SQLite backup. It is designed to be safely handed to another coding agent: financial source files are deliberately separate from the app, and the original Money Manager backup is never edited.

## What it does today

- Reads Revolut and Nordea CSV exports plus a Money Manager `.mmbak` SQLite database.
- Matches transactions by account, currency, amount, merchant wording, posting-date distance, and Revolut round-ups.
- Produces a private reconciliation report with confirmed, review, and unmatched candidates.
- Keeps the original `.mmbak` untouched and works only against an editable draft copy.
- Stores confirmation decisions, account pairings, keyboard configuration, and future rebalance evidence in a local BankingBuddy SQLite database.
- Offers a dark, retro-game review UI with a central expense card, account/category/amount candidates, certainty-weighted nodes, match queue, per-month completeness bars, and context notes.
- Supports Norwegian Mac physical-key labels (`Å`, `^`, `Ø`, `Æ`) and configurable shortcuts. Keyboard bindings are stored locally and cannot collide.
- Shows Money Manager timestamps; when a bank export has no time, it can present the matched Money Manager time as an explicit suggestion.

## Important safety boundaries

`data/` is ignored by Git. It contains personal data and must not be committed or shared unless you explicitly choose to do so.

- `data/source/moneymanager-original-backup.mmbak` is the immutable source backup.
- `data/drafts/moneymanager-reconciled-draft.mmbak` is the only Money Manager file that may be modified.
- The current plan applier is intentionally description-only. It does **not** create round-up transfers, categories, transactions, or month-end adjustments yet.
- Any future mutation script must back up its target first and operate only on the draft.

## Repository layout

```text
bankingbuddy/
  frontend/                       Next.js + TypeScript review application
    app/components/ReconciliationWorkspace.tsx
                                   central review UI and keyboard interaction
    app/api/decisions/            private local decision persistence
    app/api/settings/             private settings / keyboard persistence
    app/api/reconciliation/       exposes generated local report to the UI
  scripts/
    match-ledgers.mjs             read-only export / Money Manager matcher
    init-local-db.mjs             creates BankingBuddy's private SQLite DB
    apply-reconciliation-plan.mjs safe, draft-only plan application scaffold
  docs/month-end-rebalancing.md   proposed rebalance behaviour and safeguards
  data/                           private inputs and generated state (ignored)
```

## Setup on another computer

Requirements: current Node.js (20+ recommended), `sqlite3` command-line tool, and npm.

```bash
cd bankingbuddy/frontend
npm install
cd ..
node scripts/init-local-db.mjs
node scripts/match-ledgers.mjs
cd frontend
npm run dev -- --port 3001
```

Open `http://localhost:3001`.

The project requires private source files before matching can run:

```text
data/source/moneymanager-original-backup.mmbak
data/source/revolut-september-2026.csv
data/source/nordea-october-2026.csv
```

These are intentionally excluded from the handoff ZIP. Copy them separately only through a channel appropriate for sensitive financial data, then rename or pass explicit paths to `match-ledgers.mjs`.

## Matching behaviour

`scripts/match-ledgers.mjs` reads only. It generates `data/analysis/reconciliation.json`, including Money Manager timestamps. Its current score combines:

- institution and likely Money Manager account/currency pairing;
- exact amount or the known Revolut "round up to next 10 NOK" amount;
- day distance, allowing a seven-day review window;
- merchant-name word overlap.

Every possible candidate has a score. A mismatch of Money Manager account or currency remains visible as a review signal instead of being silently corrected.

## UI interaction model

The app is a review surface, not an automatic editor. A central expense card compares a real statement transaction with an existing Money Manager entry or a potential new entry:

- Grey Money Manager border: an existing entry.
- Green Money Manager border: a new/phantom entry proposed for creation.
- Candidate node size is proportional to certainty: approximately 20% = one-sixteenth of the viewport width and 100% = one-quarter.
- Changing the account/category/amount focus sends temporary coloured signal lines to the active candidate nodes; they fade after three seconds.
- Unsettled candidates show a small certainty label. Confirmed (100%) or manually saved choices stay visually clean.
- Source and candidate notes include weekday/date/time. If the statement lacks time, the Money Manager time is marked as an auto-suggestion.

### Default shortcuts

All defaults can be changed in the keyboard overview and are persisted in the local BankingBuddy SQLite database.

| Action | Default physical label |
| --- | --- |
| Keyboard overview | `K` |
| Match queue | `M` |
| Previous / next expense | `Ø` / `Æ` |
| Skip / save | `Å` / `^` |
| Field up / left / down / right | `W` / `A` / `S` / `D` |

In the keyboard overview, arrow keys move the selected command; Enter starts capture; Enter confirms a captured key. Esc once resets the pending binding to that action's default, and Esc twice cancels capture. The keyboard diagram is a read-only physical reference.

## Current state and known next work

The UI currently uses a small representative transaction dataset in `frontend/app/data/reconciliation.ts` while the private matcher produces the complete report. A future agent should wire the UI directly to the full report before treating it as a complete production reconciliation tool.

Planned but not yet implemented:

- user-approved Money Manager transaction/category/account mutations;
- creating a `BankingBuddy / Rebalance` category and month-end balancing entries;
- transfer creation for Revolut round-ups into the selected `Demo savings` savings destination;
- robust account-pair configuration UI;
- foreign-currency historical conversion using verified date-specific rates;
- venue/location extraction and category-learning from confirmed decisions.

## Handoff notes for another GPT

Start by reading this README, then `scripts/match-ledgers.mjs`, `docs/month-end-rebalancing.md`, and `frontend/app/components/ReconciliationWorkspace.tsx`. Preserve the safety model: never mutate the source backup, never silently apply suggestions, and do not include `data/` in version control or public uploads.
