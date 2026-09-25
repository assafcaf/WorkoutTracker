# Cloud sync checks: [O16] (E7-T8)

Serial resources `cloudflare` and `iphone`. Run once, at the merge commit, after `E7-T8`'s
tests are green. The orchestrator does part A; the operator does parts B-E and pastes the
result block into the run log.

## A. Deploy and check the Worker (orchestrator)

1. `npx wrangler deploy` from the merge commit. Note the deployed URL (`<URL>` below).
2. Without an Access session: `curl -s -o /dev/null -w '%{http_code}\n' <URL>/api/me` against
   the Worker's own hostname, bypassing Access. Expected: `401`.
3. Through the Access-protected hostname with no cookie, `/api/me` must not answer `200` with an
   email (Access redirects to its login page instead).

## B. Sign in on the iPhone with an emailed code (operator)

1. In Safari, open `<URL>`. Expected: Cloudflare Access's login page, asking for an email.
2. Enter an email on the Access policy; enter the code emailed to it. Expected: the app loads.
3. Settings -> Account shows that email and a sync time, not "Never synced".

## C. The installed app opens offline (operator)

1. Add to Home Screen; open it from the icon once online; close it.
2. Airplane mode on; open it from the icon. Expected: the app loads, not an error page.
3. Airplane mode off.

## D. A session logged on the phone appears on a second device (operator)

1. On the phone: start Workout A, log one set of back squat, finish the workout.
2. On a second device (a laptop browser): open `<URL>`, sign in with the same email.
3. Open History. Expected: the phone's session, with the same date, workout and set count.
   If not there yet, press Settings -> Sync now once and look again.

## E. An email not on the policy is refused (operator)

1. In a private window, open `<URL>`; enter an email that is not on the Access policy.
2. Expected: Access refuses it (no code is sent, or the code is rejected); the app never loads.

## Result block

```
[O16] (E7-T8) at <merge sha>: PASS / FAIL
  A. /api/me without Access:        (status code)
  B. signed in with emailed code:    Y / N   account shown:
  C. installed app opened offline:   Y / N
  D. phone session on second device: Y / N   needed Sync now: Y / N
  E. off-policy email refused:       Y / N
  What actually happened:
```
