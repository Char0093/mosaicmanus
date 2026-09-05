# Mosaic Classroom upgrade validation

The project now has a Drizzle-backed classroom, learner, and answer model, with a generated migration applied successfully to the project database. Demo data is seeded lazily on first access, so the dashboard and kiosk use persisted rows when the database is available and retain a deterministic fallback when it is not.

Server-side adaptive feedback calls the live `gpt-5-mini` model through the managed LLM helper, with a structured JSON response and deterministic fallback. The prompt explicitly avoids learner PII and requires JSON-only output.

Dexie now queues quiz answers in IndexedDB when the kiosk is offline. A public `syncOffline` procedure replays queued answers through the same persistence path when the browser comes back online, and the UI shows Online/Offline plus queued-count status.

Validation so far: `pnpm check`, `pnpm build`, and `pnpm test` all pass; Vitest reports 3 tests passed across 2 files. The updated dashboard loads and the kiosk code returns the 20-person roster from the persistent path.

The live preview reopened the kiosk from the database-backed classroom path, returned all 20 roster members, and showed Hana’s student quiz with the online indicator. The incorrect option was selected successfully; the final submit step is the remaining interactive check.

The AI-backed answer submission reached the server and the UI entered “Checking your thinking…”. A follow-up browser view showed it still pending after the initial response window, so the next step is to inspect the server log/runtime path rather than duplicate the request.

After the timeout guard and server restart, the kiosk entry still returned the full database-backed roster. The browser snapshot became stale during the transition, so the next interaction will use a fresh DOM snapshot before selecting Hana.

With the timeout guard active, the quiz submission reached the server and entered “Checking your thinking…” again. The next view will confirm whether it returns the structured AI response or the 7-second deterministic fallback.

The final feedback card rendered successfully with the bounded server path. Returning through the roster and teacher view triggered a fresh database-backed dashboard load, which is the persistence verification step.
