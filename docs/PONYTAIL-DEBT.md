# Ponytail Debt Ledger

> Auto-harvested per `ponytail:` markers. Every deliberate shortcut has a named ceiling and upgrade trigger; rows without a trigger get `no-trigger` and rot first.

| File:Line | Shortcut | Ceiling | Upgrade trigger |
|---|---|---|---|
| ntp/ntp.js:997 | `MAX_CONNECTIONS = 5000` bounded cap | 5k connections | pagination past 5k |
| ntp/ntp.js:1030 | O(n) prune on save (not hot path) | save-time only | if prune cost > 2ms at >5k conns |
| ntp/ntp.js:1040 | fallback linear scan before connIdx built | first render only | build connIdx before any prune |
| ntp/ntp.js:1754 | O(m*n) elastic group pass per group | per group move | swap in rbush R-tree at >100 boxes per group |

4 markers, 0 with no-trigger.
