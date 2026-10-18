# 0022. Imports append, and the sets leave as a CSV

Date: 2026-10-18 · Status: accepted · Tracker: E23

## Context
The JSON backup restores this app and nothing else. The trainee could not open the log in a
spreadsheet or bring in history kept in Strong or Hevy.

## Decision
- **Import appends.** A Strong or Hevy export becomes finished Sessions (`programId` `Strong` or
  `Hevy`, `workoutId` the source workout name) added next to the stored ones; nothing is replaced
  or merged into a stored Session. A Session whose start falls in the same minute as a live stored
  one, with the same set of Exercise ids, is skipped and counted, so the same file twice adds 0.
- **Nothing is written before Import.** `TransferService.readImport` parses and proposes a name
  mapping; only `confirmImport` writes, in one `putSessions` bulk write stamped `updatedAt` (so it
  syncs and backs up) and one `sessions` announcement. A Custom Exercise made in the review is
  authored data and stays even if the import is cancelled.
- **Units and effort.** Parsers read columns by name; lbs become kg (x 0.45359237, 0.1 kg); a
  Strong file stating no unit asks the trainee (kg default); RPE becomes RIR,
  `min(3, max(0, ceil(10 - RPE)))`.
- **Mapped ids** prefer the catalog id over the library id, so imported history joins the
  trainee's own.
- **CSV export.** `workout-sets-<date>.csv`, UTF-8 with a BOM, one row per Set (warm-ups as
  `warmup` with a blank e1RM), shared through Web Share with files, else downloaded. It does not
  stamp `lastExportedAt`: that badge is about the restorable JSON backup.
- **No new setting, `Session` field or schema change.** Parsing, mapping, building and the sets
  CSV are pure and live in `src/domain/`; the service in `src/services/transfer.ts` does the I/O.

## Consequences
The Excel history is not imported (no sample file; moved to roadmap R10). Strong and Hevy headers
come from published knowledge, so a changed export is refused naming its missing column rather
than read wrongly. Local times carry no zone, so an export made elsewhere shifts by the offset.

## Outcome
Built as E23.
