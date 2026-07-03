# Secrets-in-git-history: rotation + purge runbook

**Status: PENDING — neither step has been executed yet.**

## What happened

`.env` was tracked in git until commit `c6e7806` ("Remove .env from git tracking").
Untracking does not remove history: `git show c6e7806^:.env` still yields the file,
including a real `DATABASE_URL` and `SESSION_SECRET` (the 2026-07 audit found
`OPENAI_API_KEY`/`SENDGRID_API_KEY` values empty at that commit — verify before
assuming). The repo pushes to GitHub (`Echoh2o/Hydrogen-Studies`), so the exposed
history exists remotely, in any fork/clone, and potentially in GitHub's cached views.

Treat both credentials as compromised regardless of whether the repo is private.

## Step 1 — Rotate credentials (do FIRST; purging without rotating fixes nothing)

### DATABASE_URL (Railway Postgres)
1. Railway dashboard → the Postgres service → Settings/Credentials → reset the
   password (or create a new DB user and drop the old one if reset isn't offered).
2. Update the `DATABASE_URL` variable on the app service (Railway → app service →
   Variables). If the app uses Railway's reference variable to the DB service, the
   reset propagates automatically — verify rather than assume.
3. Redeploy and check `/healthz` (DB probe) goes green.
4. Update your local `.env`.

### SESSION_SECRET
1. Generate: `openssl rand -hex 32`
2. Replace `SESSION_SECRET` on the Railway app service and in local `.env`.
3. Side effect: every existing login session becomes invalid (cookies were signed
   with the old secret). Users and admins must log in again. Do it at a quiet hour.

### While you're in there
- `ALLOWED_ORIGINS`, `ADMIN_USER_IDS`, `VITE_GA_MEASUREMENT_ID` were also in the
  exposed file — not secrets, no rotation needed.
- If any real OpenAI/SendGrid key was EVER committed (check older commits:
  `git log --all --oneline -- .env` then `git show <sha>:.env`), rotate those too.

## Step 2 — Purge history (also removes ~1.3GB of dead blobs)

The purge doubles as repo slimming: history holds ~1,059 old `uploads/study-images/*.png`
(~2MB each) plus a 7.6MB WordPress export XML — that's most of the 1.4GB `.git`.

**DESTRUCTIVE: rewrites all history and requires a force-push. Coordinate anyone
with a clone; open PRs will need rebasing. Do this only after Step 1.**

```bash
# 0. Prereq
brew install git-filter-repo

# 1. Work on a fresh mirror clone — never filter your working repo
cd ~/tmp
git clone --mirror https://github.com/Echoh2o/Hydrogen-Studies.git hs-purge.git
cd hs-purge.git

# 2. Remove the secret file and the heavyweight paths from ALL history
git filter-repo \
  --invert-paths \
  --path .env \
  --path uploads \
  --path hydrogenstudies.WordPress.2026-02-20.xml

# 3. Verify: both must return nothing
git log --all --oneline -- .env
git rev-list --objects --all | grep -c "uploads/" || true

# 4. Force-push rewritten history (filter-repo removes 'origin'; re-add it)
git remote add origin https://github.com/Echoh2o/Hydrogen-Studies.git
git push origin --force --all
git push origin --force --tags

# 5. Every collaborator re-clones (do NOT pull into an old clone)

# 6. GitHub-side residue: old commits can remain reachable by SHA in caches,
#    forks, and PR refs. For a private repo with no forks this is low-risk once
#    rotated; to be thorough, contact GitHub Support to run gc / invalidate
#    cached views, and delete any forks.
```

After the purge, local repos shrink from ~1.4GB of git history to tens of MB.

## Order of operations

1. Rotate DATABASE_URL → verify deploy healthy
2. Rotate SESSION_SECRET → verify login works
3. Purge history → force-push → team re-clones
4. Delete this runbook's "PENDING" status line and record the completion date
