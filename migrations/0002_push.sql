CREATE TABLE push_subscriptions (user TEXT NOT NULL, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL,
  auth TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (user, endpoint));
CREATE TABLE reminder_log (user TEXT NOT NULL, day TEXT NOT NULL, PRIMARY KEY (user, day));
