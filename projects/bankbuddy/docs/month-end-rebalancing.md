# Month-end rebalancing

For every configured real-account to Money Manager-account pair, BankingBuddy calculates the statement closing balance minus the statement opening balance minus the Money Manager net change.

The result is the required balancing adjustment. A positive result becomes an income; a negative result becomes an expense. It is timestamped at 23:59 on the final day of the month and titled BankingBuddy adjustment — YYYY-MM.

In Money Manager it will use a dedicated BankingBuddy / Rebalance category and subcategory. The adjustment is provisional until review resolves it by adding a real missing expense or income, or correcting/removing a Money Manager-only transaction. Replaced adjustments stay in BankingBuddy's local database as audit history; the original backup is never edited.

Only accounts whose exports provide both a dated opening and closing balance can be automatically rebalanced. Other accounts remain in review until an account balance is supplied.
