# BankBuddy hosted workspace

Private Sites-hosted reconciliation workspace, adapted from the BankingBuddy handoff.

## Architecture

Vinext / React frontend with Cloudflare Worker API routes. Sites D1 stores review decisions and keyboard settings. R2 stores original source files and a read-only reconciliation report; no financial inputs or report data are committed or included in deployment assets.

All routes are protected by the owner-private Sites access policy. Keep this deployment owner-private: the workspace is a single-owner application, not a multi-user financial service. Service imports use the platform's Sites service credential.

## Import

Run `python backend/scripts/import-statements.py <input-directory> <private-report-path>` with downloaded Revolut/Nordea CSVs and a Money Manager `.mmbak` backup. Inputs are read-only and the backup SHA-256 is checked after import. Import original bytes to `/api/import?key=sources/<sha256>` and the report to `/api/import?key=reconciliation.json` using the owner's platform service access. Imports are immutable and reject replacement. The handoff ZIP is stored separately as `handoff.zip`.

The parser handles separate currency/account sections, decimal commas, and stable file-hash/row transaction identifiers. All dated bank transactions are retained, including transfers and income. Suggestions use same-currency amounts within seven days and rank institution/date/description evidence. Revolut NOK expenses also consider round-ups. No historical currency conversion or automatic account pairing is claimed. Scores are ranks, not probabilities; every match needs explicit review. Money Manager date/time conversion preserves the handoff's UTC convention.

## Review

Review one transaction card at a time, scoped to a selected month (default: the previous completed month in Europe/Oslo). New entries are green; existing-entry edits are orange. Title, date and time remain visible, with unavailable times explicitly labelled. Swipe left/right to browse; pull or click a field for ranked options. The green check confirms the draft; Hold, Delete and Revert are available on each card. Bottom navigation and the menu provide the queue, progress by month/account, and settings.

Confirmed and held draft edits, deletions, notes and keyboard settings persist in D1. Unconfirmed field changes are only kept in memory while browsing and are lost on reload. Confirmed target IDs are unique, enforced in D1, preventing two bank transactions from claiming the same Money Manager entry. Export draft decisions as JSON. Source files can be downloaded byte-for-byte.

No endpoint writes to the original Money Manager backup. Proposed new entries and field edits are stored as review decisions. Confirmed decisions can now be exported to a new Money Manager backup. Automatic round-up splitting and month-end balancing remain future work. Existing legacy decisions are retained inside the original handoff archive; they are not silently remapped onto new transaction IDs.

## Source checkpoints

Source is versioned in the private Sites Git repository when published. Local edits are not a remote backup until pushed. The GitHub source is `Zvone7/tardis`, under `projects/bankbuddy`, on `feature/bankbuddy`. Publishing to Sites remains a separate operation. Financial inputs and runtime decisions belong in private storage, not source control.

## Development

Install with the Sites dependency helper, run `npm run db:generate` for schema changes and the Sites build helper for Worker output. Apply generated migrations to local D1 before starting managed preview. Deployment migrations are handled by Sites. Do not commit personal financial datasets, credentials or local database state.

The browser WebMCP filter tool changes visible filters only; it never confirms transactions.

## Synthetic fixtures and verification

Only generated demo records are included. No actual statements, Money Manager backups, reconciliation reports, account identifiers or runtime decisions belong in this repository.

```bash
cd projects/bankbuddy
python3 backend/scripts/generate-dummy-fixtures.py
python3 -m unittest discover -s backend/tests -p 'test_*.py'
python3 backend/scripts/import-statements.py backend/tests/fixtures/dummy /tmp/bankbuddy-demo-report.json
cd frontend
npm run install:ci
npx tsc --noEmit
npm run build
```

`backend/tests/fixtures/dummy/money-manager-dummy.mmbak` is a freshly generated SQLite database with the minimal schema consumed by the importer. It is not a full Realbyte application backup and must not be restored into the real app. The generator creates it from SQL and never reads personal files. The CSVs deliberately cover decimal commas, income, expenses, a possible round-up, and a missing match.

For hosting, from `frontend/`, copy `.openai/hosting.example.json` to `.openai/hosting.json` and fill in your registered Site project ID. The real manifest is ignored. Bindings require private D1/R2 storage and owner-only access. This repository does not publish automatically on push. The hosted single-owner application relies on Sites authentication; do not deploy its financial endpoints publicly without equivalent access protection.

Last checkpoint: single-card review, month selection, field pickers, draft edit/create/delete/revert, progress, bottom navigation and persisted keyboard settings. TypeScript and production build passed; isolated decision-handler checks passed. Browser gesture QA remains unverified. Backup export is implemented; restoration in the Money Manager app remains unverified.

## Tardis layout and remaining work

The project follows the sibling apps' `projects/<name>/frontend` and `backend` layout. `frontend/` contains the hosted React application, Worker API routes and their D1 migrations. `backend/` contains the offline Python import tools and synthetic fixture tests. This is folder alignment, not a port to the siblings' ASP.NET Core architecture; the HTTP backend remains hosted with the frontend. Run all npm/Sites commands from `frontend/`.

Verified in source: one review card, previous completed month selection, title/date/time fields, green create and orange edit cards, confirm/delete/revert, swipe navigation, ranked option sheets, progress views and bottom navigation.

Implemented: continuous hold-and-drag option scrolling, separate transfer account fields, and export of confirmed changes to a new backup. Automatic round-up splitting and month-end balancing remain future work. Browser gesture QA remains unverified.

## Review and export update

Hold a field for 300 ms, then drag vertically to scroll its ranked choices without lifting; tapping also opens the list. Choose Expense, Income or Transfer. Transfers expose separate source and target accounts and require matching currencies.

Settings → Download reviewed backup applies all confirmed changes across all months to an in-memory copy of the original and downloads a new `.mmbak`. Held/unconfirmed changes are excluded. Checks include the original SHA-256, atomic rollback, duplicate linked-entry protection and SQLite integrity. Transfers use paired type 4/type 3 records with a shared transaction link. Unsupported linked fees, incomplete transfers and ambiguous categories block the entire export. Existing entries preserve their base-currency ratio; new entries use the backup's stored exchange rates. No original file is modified.

Synthetic checks: `node scripts/test-backup-export.mjs` and `node scripts/test-decision-transfers.mjs`. Browser gesture QA is unavailable in this environment; restoring an export in the Money Manager mobile app has not been verified.
