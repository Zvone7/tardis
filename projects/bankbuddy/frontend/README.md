# BankBuddy hosted workspace

Private Sites-hosted reconciliation workspace, adapted from the BankingBuddy handoff.

## Architecture

Vinext / React frontend with Cloudflare Worker API routes. Sites D1 stores review decisions and keyboard settings. R2 stores original source files and a read-only reconciliation report; no financial inputs or report data are committed or included in deployment assets.

All routes are protected by the owner-private Sites access policy. Keep this deployment owner-private: the workspace is a single-owner application, not a multi-user financial service. Service imports use the platform's Sites service credential.

## Import

Run `python scripts/import-statements.py <input-directory> <private-report-path>` with downloaded Revolut/Nordea CSVs and a Money Manager `.mmbak` backup. Inputs are read-only and the backup SHA-256 is checked after import. Import original bytes to `/api/import?key=sources/<sha256>` and the report to `/api/import?key=reconciliation.json` using the owner's platform service access. Imports are immutable and reject replacement. The handoff ZIP is stored separately as `handoff.zip`.

The parser handles separate currency/account sections, decimal commas, and stable file-hash/row transaction identifiers. All dated bank transactions are retained, including transfers and income. Suggestions use same-currency amounts within seven days and rank institution/date/description evidence. Revolut NOK expenses also consider round-ups. No historical currency conversion or automatic account pairing is claimed. Scores are ranks, not probabilities; every match needs explicit review. Money Manager date/time conversion preserves the handoff's UTC convention.

## Review

Review one transaction card at a time, scoped to a selected month (default: the previous completed month in Europe/Oslo). New entries are green; existing-entry edits are orange. Title, date and time remain visible, with unavailable times explicitly labelled. Use the top Previous/Next controls to browse and tap fields for ranked options. Save queues the proposal locally; Delete dismisses it without deleting an original Money Manager entry. Bottom navigation and the menu provide the queue, progress by month/account, and settings.

Confirmed and held draft edits, dismissals, notes and keyboard settings persist in D1. Unconfirmed field changes are only kept in memory while browsing and are lost on reload. Confirmed target IDs are unique, enforced in D1, preventing two bank transactions from claiming the same Money Manager entry. Export draft decisions as JSON. Source files can be downloaded byte-for-byte.

No endpoint writes to the original Money Manager backup. Proposed new entries and field edits are stored as review decisions. Applying these decisions to a downloadable Money Manager backup, round-up transfers and month-end balancing remain future work. Existing legacy decisions are retained inside the original handoff archive; they are not silently remapped onto new transaction IDs.

## Source checkpoints

Source is versioned in the private Sites Git repository when published. Local edits are not a remote backup until pushed. The GitHub plugin has been offered for a separate private code repository, but that connection and repository are not yet configured. Financial inputs and runtime decisions belong in private storage, not source control.

## Development

Install with the Sites dependency helper, run `npm run db:generate` for schema changes and the Sites build helper for Worker output. Apply generated migrations to local D1 before starting managed preview. Deployment migrations are handled by Sites. Do not commit personal financial datasets, credentials or local database state.

The browser WebMCP filter tool changes visible filters only; it never confirms transactions.

## Review and export update

Tap a field to open its ranked choices. Choose Expense, Income or Transfer. Transfers expose separate source and target accounts and require matching currencies.

Settings → Download reviewed backup applies all confirmed changes across all months to an in-memory copy of the original and downloads a new `.mmbak`. Held/unconfirmed changes are excluded. Checks include the original SHA-256, atomic rollback, duplicate linked-entry protection and SQLite integrity. Transfers use paired type 4/type 3 records with a shared transaction link. Unsupported linked fees, incomplete transfers and ambiguous categories block the entire export. Existing entries preserve their base-currency ratio; new entries use the backup's stored exchange rates. No original file is modified.

Synthetic checks: `node scripts/test-backup-export.mjs` and `node scripts/test-decision-transfers.mjs`. Browser gesture QA is unavailable in this environment; restoring an export in the Money Manager mobile app has not been verified.

## Simplified form and round-up matching

The review form follows Money Manager's row layout: Income/Expense/Transfer, Date/Time, Account, Category (or To account), Amount, Note (merchant), and Description. Account and category requirements are shown inline. Missing times default to 23:59. New expenses receive a `Newly created expense (BankBuddy)` description. Description exports into `ZMEMO`; the merchant note exports into `ZCONTENT`.

Revolut outgoing Lommepenger pocket amounts up to 10 NOK are compared with nearby purchases in the same account, statement and currency. Suggestions require an exact next-10 rounding amount and a date gap of at most one day. Statement-row proximity ranks competing matches. Matching incoming pocket credits are linked by occurrence order only when debit/credit counts agree; otherwise they remain for separate review.

A user-selected pair becomes one proposed expense for the combined debit total. The selected Money Manager expense may be on a different account or have a different amount; merchant/date evidence supports suggestions. The user can correct the account, update an existing expense, or create a new combined expense. Confirmation claims all paired bank rows atomically so none can be added twice; revert releases them. Combining savings with an expense is an explicit review choice, never automatic.

The private `matching-catalogue-v2.json` can be generated using `scripts/build-matching-catalogue.py ORIGINAL_BACKUP PRIVATE_OUTPUT` and imported via the authenticated immutable import endpoint. Never commit that output. It allows suggestions from all active Money Manager accounts. Browser gesture/layout QA remains unverified in this environment.
# Publication version

Run `node scripts/stamp-version.mjs` immediately before the publication build. It writes the Oslo-time version (`v0.YYYYMMDD_HHmm`) shown during loading and in the header. Commit and deploy the stamped source with its matching build.
