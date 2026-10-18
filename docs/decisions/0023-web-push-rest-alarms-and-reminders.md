# 0023. Web Push from the Worker: rest alarms and reminders

Date: 2026-10-18 · Status: accepted · Tracker: E24 · Extends: 0007, 0019

## Context
Roadmap R9: the app should reach the trainee outside the page, with a "Rest over" notification when
a rest ends and a "Time to train" reminder. The Worker is on the Cloudflare Workers Free plan
(0007), so every new piece of server state has to fit its limits. The scope was
`.work/specs/2026-10-18-reach-outside-the-app.md`; the operator waived `/spec` and `/tickets`.

## Decision
- **Subscriptions live in D1**, in `push_subscriptions` (`migrations/0002_push.sql`), one row per
  `(user, endpoint)`. Endpoints are allowlisted to the known push services, so the Worker never
  POSTs to an arbitrary URL a client sent. An endpoint answering `410` is deleted.
- **Push is native WebCrypto in the Worker**: RFC 8291 `aes128gcm` encryption and an RFC 8292
  VAPID ES256 token, signed with the `VAPID_PRIVATE_KEY` secret. Rotating that key invalidates
  every subscription.
- **The rest push is a Durable Object alarm, not a Queue with a delay.** One SQLite-backed
  `RestAlarm` per user holds the pending message; `setAlarm` replaces it and `deleteAlarm`
  cancels it, which is exactly "logging the next Set or leaving the Session cancels". A delayed
  queue message cannot be cancelled, so each would need a D1 lookup to see whether it is stale.
  Free-plan budget for Durable Objects: 100 000 requests, 13 000 GB-s and 100 000 rows written a
  day, 5 GB stored; at about 30 Sets a Session this uses a few dozen of each. Queues give 10 000
  operations a day and retain a message at most 24 h.
- **Reminders use a Cron Trigger every minute** (`[triggers] crons = ["* * * * *"]`), not the
  Durable Object. The free plan allows 5 cron triggers per account and this uses 1: 1440
  invocations a day out of 100 000, each a read of a handful of rows. The reminder is a synced
  setting (`workoutReminders`); the Worker reads its row in `settings` and adds only
  `reminder_log (user, day)`, claimed before sending, so a user gets at most one push per local
  day. A user with a Session started that local day (and not deleted) gets none. A reminder is
  due for 30 minutes from its time, so a missed minute does not lose it.
- **No contract version bump**: the routes are additive, `CONTRACT_VERSION` stays 2.

## Consequences
- CPU is the risk: the free plan gives 10 ms per invocation, and one push costs an ECDH, an HKDF,
  an AES-GCM and an ES256 signature. Fan-out is to the trainee's few devices; if it overruns, the
  fix is paid Workers.
- Reminders are at-most-once: the day is logged before the push, so a failed push is not retried.
  A reminder can fire on a day whose Session has not synced yet.
- Deploying needs the `VAPID_PRIVATE_KEY` secret, the Durable Object migration (`new_sqlite_classes`)
  and the cron to be accepted by wrangler 3.x; the first deploy checks all three (E24-T12).
