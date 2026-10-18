# Send a Workout to Apple Health

The summary of a finished Session has a **Send to Apple Health** button. It opens the Shortcuts
app and runs a Shortcut named exactly **Workout Tracker to Health**, passing the Workout as text.
Apple Health cannot be written from a web app, so you build this Shortcut once on your iPhone.

## What the Shortcut receives

Its input is text (**Shortcut Input**): JSON with four keys.

```json
{ "workout": "Workout A", "start": "2026-10-12T07:00:00.000Z", "end": "2026-10-12T07:53:00.000Z", "minutes": 53 }
```

`start` and `end` are ISO 8601; `minutes` is the duration, rounded.

## Build it

1. Open **Shortcuts**, tap **+**, and name the Shortcut `Workout Tracker to Health`
   (the name must match, including the capitals).
2. In the Shortcut's settings, set it to accept **Text** as its input.
3. Add **Get Dictionary from Input** (input: **Shortcut Input**).
4. Add **Get Dictionary Value** for `workout`, then again for `start`, `end` and `minutes`.
5. Add **Get Dates from Input** on `start` and again on `end`, to turn the text into dates.
6. Add **Log Workout**: type **Traditional Strength Training**, **Duration** the `minutes` value
   in minutes, **Start Date** the start date, **End Date** the end date.
7. Done. Run it once from the Shortcuts app to allow it to write to Health.

## Use it

Finish a Session and tap **Send to Apple Health** on its summary. Shortcuts opens, logs the
workout in Health and returns you to the app.
