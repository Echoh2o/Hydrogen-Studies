# Database Backup Strategy

**Last updated:** March 14, 2026

## Railway PostgreSQL Backups

Railway provides automated backups for PostgreSQL databases on paid plans:

- **Point-in-time recovery (PITR):** Available on Pro plan, continuous WAL archiving
- **Automated snapshots:** Daily snapshots retained for 7 days
- **Manual snapshots:** Create on-demand via the Railway dashboard

### Verify Your Backup Settings

1. Go to Railway dashboard → your project → PostgreSQL service
2. Click **Settings** → **Backups**
3. Confirm:
   - Automated backups: **Enabled**
   - Retention period: **7 days** (minimum recommended)
   - PITR: **Enabled** (Pro plan)

## Secondary Backup (Recommended)

For additional protection, set up a daily `pg_dump` to cloud storage.

### Option A: Railway Cron Job

Add to `server/services/job-scheduler.ts`:

```typescript
// Daily database backup at 3 AM UTC
scheduler.addJob({
  name: 'database-backup',
  schedule: '0 3 * * *',
  handler: async () => {
    // pg_dump to S3/R2/GCS
  }
});
```

### Option B: GitHub Actions Cron

Create `.github/workflows/db-backup.yml`:

```yaml
name: Database Backup
on:
  schedule:
    - cron: '0 3 * * *'  # Daily at 3 AM UTC
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Install pg_dump
        run: sudo apt-get install -y postgresql-client
      - name: Dump database
        run: |
          pg_dump $DATABASE_URL --format=custom --no-owner \
            > backup-$(date +%Y%m%d).dump
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
      - name: Upload to S3
        uses: jakejarvis/s3-sync-action@v0.5.1
        with:
          args: --include "backup-*.dump"
        env:
          AWS_S3_BUCKET: ${{ secrets.BACKUP_BUCKET }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## Restore Procedure

### From Railway Dashboard
1. Go to Railway → PostgreSQL service → **Backups**
2. Select the backup point → **Restore**
3. Confirm — this replaces the current database

### From pg_dump File
```bash
# Restore from custom-format dump
pg_restore --clean --no-owner -d $DATABASE_URL backup-20260314.dump

# Or from SQL dump
psql $DATABASE_URL < backup-20260314.sql
```

### Post-Restore Checklist
- [ ] Verify row counts in critical tables: `studies`, `users`, `blog_articles`
- [ ] Test login with a known account
- [ ] Verify study search returns results
- [ ] Check blog listing loads
- [ ] Verify session table was recreated (auto-created on app start)

## Retention Policy

| Backup Type | Retention | Location |
|------------|-----------|----------|
| Railway automated | 7 days | Railway infrastructure |
| Railway PITR | Continuous (Pro plan) | Railway infrastructure |
| Secondary pg_dump | 30 days | S3/R2/GCS |
| Pre-migration manual | Keep until migration verified | S3/R2/GCS |

## Emergency Contacts

- Railway support: https://railway.app/support
- Railway status: https://status.railway.app
- Database connection string: `DATABASE_URL` env var in Railway dashboard
