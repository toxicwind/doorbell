# Failover

| Artifact | Role |
|----------|------|
| `*.orig` | Immutable pre-mod backup (never overwrite) |
| `*.pre-mod` | Live file moved aside at cutover |
| `RESTORE.sh` | Restore + restart |

Restore immediately if restart or curl prove fails:

```bash
/home/toxic/estate/ranch/doorbell/RESTORE.sh
```
