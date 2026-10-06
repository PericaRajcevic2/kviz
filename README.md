# Balkan na sluh

A mobile-friendly Balkan music guessing game built with Next.js 15 and React. No account or Spotify integration is required.

## Development

Use Node.js 22 or newer and npm (the project has one lockfile).

```sh
npm ci
npm run dev
```

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Deploy the branch with the existing Vercel project. No new environment variables, database or paid services are required for this version.

## Game rules

- Daily challenge: five deterministic songs, using the Europe/Sarajevo calendar date, including DST. A new challenge starts at local midnight. Mixes prefer distinct artists and cover all four genres.
- Practice: unlimited five-song sets, with mix, pop, rock, folk and modern/trap packs.
- Six snippet lengths: 1, 3, 5, 10, 15 and 30 seconds. Scores: 100, 80, 60, 40, 20 and 10. Replaying the current snippet is free.
- Title or an approved alias solves a song. Artist alone is a hint and uses an attempt, not a correct answer. Empty input does nothing.
- A result is revealed for every round, including the fifth one, before the final summary.
- An unavailable excerpt can be retried or replaced without penalty. Replacement sets are explicitly identified in shared results and may differ between players.
- Sessions, attempts, answers and statistics are saved in versioned browser storage. Invalid storage is discarded. Older prototype keys are intentionally not migrated because they do not contain sufficient result data.
- Statistics are personal to the browser. There is no online leaderboard or claim of tamper-resistant scoring.

## Catalog and audio

`src/data/songs.json` retains 153 entries. The test pool contains 142 songs pinned to specific Deezer recording IDs. Eleven entries without a matching original preview are marked `audioUnavailable` and excluded from selection and autocomplete. They have not been replaced with covers or live versions. Six reviewed title/artist aliases fix provider spelling differences. Availability remains provider- and region-dependent; this is not a licensing claim.

`src/app/api/audio/[id]/route.ts` resolves only active catalog IDs. Pinned IDs bypass title search; unpinned future entries have a bounded strict-match search fallback. Signed preview URLs are fetched fresh with `no-store`, including retries. API errors returned inside HTTP 200 are treated as provider failures rather than missing songs. The player refreshes an expired/unavailable URL once automatically without taking a guess or points.

Run `node --import tsx scripts/audit-audio.ts` to check the active pool, or append `--all` to also inspect excluded candidates. The script verifies metadata matching and an audio response, prints a per-song report, writes `audio-audit.json`, and exits unsuccessfully if any checked song fails. It does not save recordings. The **Audit current audio catalog** GitHub Actions workflow runs this check when the audit script changes. A successful check establishes availability at that time, not permanent availability in every region.

The existing Deezer preview source is retained as a replaceable adapter. Continued availability and permission to use this source for a public game must be confirmed by the project owner. Preview availability does not itself establish permission. The optional `audioUrl` field supports approved, HTTPS-hosted excerpts; `deezerId` supports a verified exact recording. Neither downloading nor rehosting provider recordings is implemented.

Catalog edits must preserve stable IDs. Bump `CATALOG_VERSION` in `src/lib/game.ts` when changing the daily selection pool to avoid mixing different challenges under the same identifier.

For a competitive leaderboard, introduce server-authoritative sessions, answer checking and scoring first. The current casual game deliberately keeps the catalog and answers on the client.

## Security and deployment checklist

- **Revoke/rotate the Spotify client secret exposed in the previous public revision.** Removing the Spotify routes does not revoke that credential or remove it from Git history. Rotate it in the Spotify developer dashboard, and remove obsolete Spotify variables from the deployment. Never put secrets in `NEXT_PUBLIC_*` variables.
- Next.js is pinned to 15.5.27; React and the lockfile are updated. Keep dependencies maintained and run `npm audit` as part of maintenance.
- Merge the reviewed branch to `main` to update the existing production Vercel site. A branch/PR preview is preferred for acceptance testing first.
- Before public launch, verify regional audio availability and music-source permissions. Try a complete daily game and each practice pack on desktop, Android and iOS.

## Structure

- `src/lib/game.ts`: deterministic selection, date boundary, scoring, state transitions and storage validation.
- `src/lib/audio.ts`: provider matching and URL validation.
- `src/components/use-audio.ts`: audio lifecycle, replay, timer and cleanup.
- `src/components/music-quiz.tsx`: home, game, results, local search and accessible dialogs.
- `src/app/globals.css`: responsive visual system and reduced-motion support.
- `tests/game.test.ts`: gameplay, persistence, date and provider-matching regressions.

No keys are required for the current adapter. Old Spotify auth/search code and unused Netlify/Tailwind dependencies have been removed.
