# whereto

A real-time group café picker. The host creates a room and shares a link. Friends join and each add a mood, must-haves and a note, and everyone sees the others' cards update live. The host asks Claude for three cafés from a curated list of 28 Kirkland and Bellevue cafés, everyone votes live, and the winner is shown with a map link.

**Live:** https://whereto.app.space (sign in with Google or GitHub)

Built on [DeepSpace](https://docs.deep.space) (Cloudflare Workers + Durable Objects) with React 19, Vite and Tailwind.

## How a room works

1. **Create:** `/new`. The host names the room and gets an invite link `/j/<code>`.
2. **Join:** a friend opens the link and signs in, and is dropped straight into the room, even through a Google or GitHub sign-in round trip.
3. **Collect:** everyone fills in a card (mood, must-have tags, a note). Cards update live for all members.
4. **Recommend:** once at least 2 people have filled in a card, the host clicks **Find our café**. Everyone sees a "thinking" state, then three ranked picks with reasons. This happens **once per room**.
5. **Vote:** tap a card to vote, tap another to change. Live counts, voter names and "X of Y voted".
6. **Decide:** the host closes voting. Most votes wins, and a tie goes to the higher-ranked pick. Everyone sees the winner, its address and an **Open in Maps** link.

## Architecture

### Data and isolation: rooms are teams
All data lives in the app's single DeepSpace `RecordRoom`. Each whereto room is a **team** in DeepSpace's RBAC model:

- Room-scoped collections (`rooms`, `preferences`, `recommendations`, `votes`) declare `teamField: 'roomId'` and `read: 'team'`.
- Membership rows live in the SDK-recognised `team_members` collection.

So the Durable Object filters out other rooms' data on the server, before broadcasting. Non-members receive nothing, and client-side filtering is never relied on for privacy.

| Layer | Who | Enforced by |
|---|---|---|
| App role | any signed-in user = `member`; app owner = `admin`; signed-out = nothing | DeepSpace auth + collection permissions |
| Room membership | people who joined room X | `read: 'team'` + `team_members` (`status: 'active'`) |
| Room role | **host** = `rooms.hostId` (the `ownerField`); everyone else is a member | `update: 'own'` on `rooms`, plus host checks in server actions |

One preference and one vote per person are enforced with `uniqueOn` + `userBound` (the server stamps the user id, so a client can't write as someone else).

Schemas: [`src/schemas/`](src/schemas/). Shared vocabulary and types: [`src/domain.ts`](src/domain.ts).

### Server actions: the privileged steps
Anything the browser shouldn't be trusted with runs as a DeepSpace server action at `POST /api/actions/<name>`, authenticated with the caller's JWT. Actions run with RBAC off, so **each one does its own checks**: it loads the room, checks the caller is the host or an active member, and scopes every query to that room.

| Action | Who | Does |
|---|---|---|
| `createRoom` | any signed-in user | creates the room and the host's membership together |
| `joinRoom` | any signed-in user | joins by invite code while the room is still collecting |
| `recommendCafes` | host only | the single AI run (below) |
| `closeVoting` | host only | tallies votes and records the winner |

Code: [`src/actions/`](src/actions/).

### AI with a fallback that never leaves a room stuck
`recommendCafes` ([`src/actions/recommend.ts`](src/actions/recommend.ts)):

1. **Gates:** host only, room still `collecting` (so only one run per room), at least 2 active members with a filled-in card.
2. **Shortlist:** a deterministic scorer ([`src/lib/score.ts`](src/lib/score.ts)) ranks the curated cafés by must-have tags and mood and keeps the top 12.
3. **Claude:** `createDeepSpaceAI(env, 'anthropic')` + `generateText` (AI SDK 7), model `claude-sonnet-5-5`, `effort: 'low'`, with a token cap and structured output that **only allows ids from the shortlist**. Only first names and preferences are sent, and member notes are treated as data, not instructions.
4. **Validation:** the server re-checks for exactly 3 distinct shortlisted picks, each with a reason.
5. **Fallback:** any AI problem (error, timeout, out of credits, invalid output) gives the scorer's top 3, with reasons built only from what actually matched.
6. **Never sticks:** if a write fails, `finally` deletes partial picks and puts the room back to `collecting`.

**Secrets:** none to manage. With no `authToken`, `createDeepSpaceAI` authenticates to the DeepSpace AI proxy with `APP_OWNER_JWT`, a worker binding the platform injects, so the app owner pays. No Anthropic key exists in the code, the config or git.

The live tallies and `closeVoting` share one counting rule ([`src/lib/tally.ts`](src/lib/tally.ts)): only active members' votes, only for the room's picks, and ties go to the higher rank. So what people watch and what the server declares can't disagree.

### Realtime and auth: DeepSpace primitives, nothing custom
- **Live data:** `useQuery` / `useMutations` subscriptions over the RecordRoom WebSocket.
- **Sign-in and gated pages:** `DeepSpaceAuthProvider` + `<AuthGate>` for Google/GitHub sign-in and the protected pages.
- **Presence:** `usePresenceRoom('room:<id>')` (in memory, nothing persisted) shows who's in the room now (dots on member cards) and who's editing their card. The worker only lets active room members open a room's presence socket: it verifies the JWT, then looks up that user's `team_members` row (`src/server/room-presence.ts`). Non-members get 403.
- **Returning to the room after OAuth:** a short-lived (10 min), HttpOnly, SameSite=Lax cookie set in `/api/auth/social-redirect` and consumed in `/api/auth/oauth-complete`. Only `/j/<code>` and `/r/<id>` paths are accepted. Code: [`src/server/return-to-cookie.ts`](src/server/return-to-cookie.ts).

### Café data
[`src/data/cafes.ts`](src/data/cafes.ts) holds **28 verified cafés** from a hand-curated corpus. Its header lists the six source guides and the mapping rules:
- Facts are copied or paraphrased only from those sources.
- Tags are applied only where the source clearly says it.
- One café with a disputed address was excluded.
- The source has **no prices, hours or map links**, so those fields stay empty rather than invented. The UI hides them when missing.

## Run locally

Requirements: Node 22.15+ (or 24 / 26), npm 11.6+, and a DeepSpace account.

```sh
npm install
npx deepspace auth login     # once
npx deepspace dev start      # Vite + local Workers runtime → http://localhost:5173
```

`deepspace dev` writes the local credentials to `.dev.vars` (gitignored, regenerated on every run). Never edit or commit it.

### Tests

```sh
npm run test:unit            # Vitest: scorer, tally, café data guards, action handlers, auth return cookie
npm run validate             # type-check + unit tests
npm run lint
```

The action handler tests run against an in-memory fake of DeepSpace's server-action `tools` API, with the AI pointed at a dead port, so they exercise the fallback path at no cost. One opt-in test makes a real, owner-billed call (about 1¢) through the DeepSpace proxy:

```sh
LIVE_AI=1 npx vitest run src/actions/recommend.live.test.ts
```

### Deploy

The app's source is GitHub (claimed permanently on the first deploy), so version control is plain Git:

```sh
git push origin main
npx deepspace deploy         # ships the local working tree; commit + push first
npx deepspace releases       # history; `npx deepspace rollback` to revert
```

`deepspace push`, `pull` and `workspace` don't apply to GitHub-sourced apps.

## Known limitations
- **Votes can be edited after voting closes.** `votes` allows `update: 'own'`, and RBAC can't see the room's status. The winner is fixed at close and never recomputed, so only the "How everyone voted" counts could drift. (Accepted; fix by moving vote writes behind an action.)
- **Room membership isn't checked when someone writes a preference or vote.** DeepSpace's `create` permission is on or off only. A signed-in non-member who learned a room's internal id could write a stray row they still can't read. Room ids never appear in links before joining, and both actions count only active members' rows, so stray rows can't affect results.
- **One AI run per room.** No re-runs.
- **No prices or hours** in the café data, so the budget picker is hidden and the scorer ignores budget.
- **The host is a single point of control.** If the host leaves, the room stalls.
- **Sign-in needs Google or GitHub.** DeepSpace has public email signup closed.
- **SDK bug (deepspace 0.44.2).** Its membership-change hook reads `record.data.UserId` (capital U), so it never fires. The app avoids the impact by navigating to the room after joining, which opens fresh subscriptions.

## Next steps
Full list with implementation notes: [PLAN.md → Next steps](PLAN.md#next-steps-cut-from-the-2-day-scope). Highlights:
- Add prices, hours and map links from a verified source, then bring back the budget picker and switch on the scorer's budget rule (already built and tested behind `considerBudget`).
- Host handoff, or letting any member close a vote once everyone has voted.
- Move preference and vote writes behind actions, which closes both of the first two limitations above.
- Playwright end-to-end tests for the three-user flow and host-only refusals.
- AI re-runs, leave and remove-member actions, and curated cafés as an editable collection.

## Repo map

```
worker.ts                  Worker entry: routes + Durable Object classes
src/actions/               Server actions (rooms, recommend, voting) + handler tests
src/schemas/               Collection schemas and RBAC
src/data/cafes.ts          Curated café corpus (sources in header)
src/lib/                   Scorer, tally, fallback reasons, return-to, room hook
src/components/room/       Preference, pick, voting and winner UI
src/pages/(app)/           Routes; (protected)/ requires sign-in
src/server/                HTTP, auth, realtime and action routing
PLAN.md                    Design plan, decisions, risks, next steps
```
