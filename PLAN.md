# whereto — 2-day build plan

A real-time group café picker. The host creates a room and shares a link. Friends join and each enter a mood and constraints, and everyone sees the others' entries live. The host asks Claude for 3 cafés from a curated list, everyone votes live, and the result is shown.

Target: `deepspace@0.44.2` (pinned in `package.json`). Sources: AGENTS.md, docs.deep.space (permissions, data-model, realtime-sync, server-actions, external-apis, secrets, ai reference, authentication, source-control), and the installed SDK source where the docs were silent.

---

## 0. Architecture in one paragraph

All app data lives in the **single app RecordRoom** (`app:${APP_ID}`, the scaffold's `SCOPE_ID`). A whereto room is a **team** in DeepSpace's RBAC sense: room-scoped collections declare `teamField: 'roomId'` with `read: 'team'`, and membership rows go in the SDK-recognised `team_members` collection. The DO filters out other rooms' data on the server, before it broadcasts anything. A user's role inside a room (host or member) is row-level: `rooms.hostId` is the room's `ownerField`. Steps that need extra privilege run as **server actions** that check the caller is the host: creating a room, joining by code, calling Claude, and closing the vote. Live updates come from `useQuery` subscriptions. The curated café list is a **static TypeScript module** imported by both the worker (for the AI prompt and validation) and the client (to render picks).

---

## 1. Record schemas

One file per collection under `src/schemas/`, each registered in `src/schemas.ts` and imported from `deepspace/schema`. Every row also gets the standard envelope (`recordId`, `createdBy`, `createdAt`, `updatedAt`).

### Static data (not collections)
- `src/data/cafes.ts`: `export const CAFES: readonly Cafe[]`, about 15 entries `{ id, name, neighborhood, address, mapsUrl, priceLevel: 1|2|3, tags: CafeTag[], noise, hours, blurb }`. Editing the list means a code change and a deploy, which is acceptable for v1.
- `src/domain.ts`: `MOODS`, `CAFE_TAGS`, `ROOM_STATUS`, plus the `Cafe` / `Mood` / `CafeTag` types. Schemas (select options), the scorer and the AI prompt all import these, so the vocabulary can't drift.

### `rooms`
| column | storage / interpretation | notes |
|---|---|---|
| `name` | text / plain, required | |
| `hostId` | text / plain, **userBound, immutable** | `ownerField`, so `'own'` means "is host" |
| `roomId` | text / plain, immutable | equals the row's `recordId`. Needed because the per-record `'team'` check reads `record.data[teamField]` (it doesn't support `_rowId`) |
| `joinCode` | text / plain, immutable | 10 random characters. Share link is `/j/:joinCode` |
| `status` | text / select `collecting · recommending · voting · decided`, default `collecting` | |
| `area` | text / plain | optional hint for the AI |
| `winnerCafeId` | text / plain | an id from `CAFES` |
| `decidedAt` | text / datetime | |

```ts
ownerField: 'hostId', teamField: 'roomId',
permissions: {
  member: { read: 'team', create: false, update: 'own', delete: false, writableFields: ['name', 'area'] },
  admin:  { read: true,   create: true,  update: true,  delete: true },
}
```

### `team_members` (room membership)
| column | storage / interpretation | notes |
|---|---|---|
| `teamId` | text / plain, required, immutable | the room id (SDK-required name) |
| `userId` | text / plain, required, immutable | SDK-required name. Written by actions, not userBound |
| `status` | text / select `active · removed` | SDK-required. Only `active` (or null) counts |
| `roomRole` | text / select `host · member` | for display only. Authority comes from `rooms.hostId` |

```ts
teamField: 'teamId', uniqueOn: ['teamId', 'userId'],
permissions: {
  member: { read: 'team', create: false, update: false, delete: false },
  admin:  { read: true,   create: true,  update: true,  delete: true },
}
```
Rows are written only by actions, with a deterministic `recordId` of `${roomId}_${userId}`, so a re-join is an idempotent upsert. Names and avatars come from `useUsers()`.

### `preferences` (one per user per room)
| column | storage / interpretation |
|---|---|
| `roomId` | text / plain, required, immutable (`teamField`) |
| `userId` | text / plain, **userBound, immutable** (`ownerField`) |
| `mood` | text / select `MOODS` |
| `mustHave` | text / json (string[] from `CAFE_TAGS`) |
| `budgetMax` | number / plain (1–3, matches `priceLevel`) |
| `note` | text / plain (≤200 characters, enforced in the UI and when read by the action) |

```ts
ownerField: 'userId', teamField: 'roomId', uniqueOn: ['roomId', 'userId'],
permissions: {
  member: { read: 'team', create: true, update: 'own', delete: 'own' },
  admin:  { read: true,   create: true, update: true,  delete: true },
}
```

### `recommendations` (Claude's 3 picks; written only by the server)
| column | storage / interpretation |
|---|---|
| `roomId` | text / plain, required (`teamField`) |
| `rank` | number / plain (1–3) |
| `cafeId` | text / plain (an id from `CAFES`, validated) |
| `reason` | text / plain |
| `source` | text / select `ai · fallback` |

```ts
teamField: 'roomId', uniqueOn: ['roomId', 'rank'],
permissions: {
  member: { read: 'team', create: false, update: false, delete: false },
  admin:  { read: true,   create: true,  update: true,  delete: true },
}
```

### `votes` (one per user per room)
| column | storage / interpretation |
|---|---|
| `roomId` | text / plain, required, immutable (`teamField`) |
| `userId` | text / plain, **userBound, immutable** (`ownerField`) |
| `cafeId` | text / plain, required |

```ts
ownerField: 'userId', teamField: 'roomId', uniqueOn: ['roomId', 'userId'],
permissions: {
  member: { read: 'team', create: true, update: 'own', delete: 'own', writableFields: ['roomId', 'cafeId'] },
  admin:  { read: true,   create: true, update: true,  delete: true },
}
```

### Scaffold collections
- `users`: keep as it is (`read: 'own'`). Peer names come through `useUsers()`'s public-identity projection.
- `settings`: delete it, since nothing uses it.

---

## 2. Roles and permissions

| Layer | Who | Comes from | Enforced by |
|---|---|---|---|
| App role | `admin` = app owner (pinned). `member` = any signed-in user. Signed-out visitors match no rule and get nothing | DeepSpace auth + `ownerUserId` | DO `canRead` / `canWrite` |
| Room membership | people who joined room X | `team_members` row, `status: 'active'` | `read: 'team'` + `teamField` |
| Room role | **host** = `rooms.hostId`. **member** = any other active member | `ownerField: 'hostId'` | `update: 'own'` on rooms, plus host checks in actions |

| Capability | Host | Room member | Signed-in non-member | Signed out | How it's enforced |
|---|---|---|---|---|---|
| Create a room | ✅ | ✅ | ✅ | ❌ | `createRoom` action |
| Join via link | — | — | ✅ while `collecting` | ❌ → sign-in | `joinRoom` action |
| See the room, members, preferences, picks, votes | ✅ | ✅ | ❌ | ❌ | `read: 'team'` |
| Edit own preferences | ✅ | ✅ | ❌* | ❌ | `update: 'own'` + userBound + `uniqueOn` |
| Rename the room or change its area | ✅ | ❌ | ❌ | ❌ | `update: 'own'` + `writableFields` |
| Trigger the AI (once per room) | ✅ | ❌ | ❌ | ❌ | `recommendCafes`: host check + `status === 'collecting'` |
| Vote and change their vote | ✅ | ✅ | ❌* | ❌ | `votes` RBAC + `uniqueOn` |
| Close voting | ✅ | ❌ | ❌ | ❌ | `closeVoting`: host check |

\* **Known gap.** `create` is boolean-only, so it can't check membership. A signed-in user who knew a room's id could create a stray `preferences` or `votes` row for it, though they still couldn't read anything in the room. To close the gap: (1) room ids never appear in a URL before you've joined (the share link uses `joinCode`); (2) `recommendCafes` and `closeVoting` **count only rows whose `userId` has an active `team_members` row**; (3) the UI renders only rows from active members.

**Rules for every action (they run with RBAC off):** load the room and check `hostId === ctx.userId`, or that the caller has an active membership. Scope every `tools.query` with `roomId` / `teamId`. Never return raw `users` rows.

---

## 3. DeepSpace primitives used (nothing here gets reimplemented)

| Need | Primitive |
|---|---|
| Sign-in (Google/GitHub), sessions, JWT | `DeepSpaceAuthProvider`, `<AuthGate>` in `(app)/(protected)/_layout.tsx`, platform auth worker |
| Server-side identity | `verifyJwt` in `wsRoute`, `resolveAuth` in action routes (scaffold, unchanged) |
| Live, permissioned data | `RecordRoom` + `useQuery` / `useMutations` (`createConfirmed` where we need the ack) |
| Isolation between rooms | `teamField` + `team_members` + `read: 'team'` |
| One preference / one vote per person | `uniqueOn` + `userBound` + `immutable` |
| Write rejections shown to the user | `RecordProvider onWriteError` → toasts (scaffold) |
| Privileged steps | server actions, `POST /api/actions/:name` with `getAuthToken()` |
| Names and avatars | `useUsers()` / `useUserLookup()` |
| Claude | `createDeepSpaceAI(env, 'anthropic')` + `generateText` / `Output.object` (ai@7) |
| Deploy and rollback | `npx deepspace deploy`, `releases`, `rollback` |

Not built: custom sockets or polling, our own auth or role tables, a client-side Anthropic SDK, API keys, Yjs.

---

## 4. Calling Anthropic server-side

**Secrets:** none to manage. `createDeepSpaceAI(env, 'anthropic')` with no `authToken` authenticates to the DeepSpace proxy with `env.APP_OWNER_JWT`, a platform-injected worker binding that never reaches the browser, `wrangler.toml` or git, so **the app owner pays**. One run per room plus the host check is the spend cap. (Bring-your-own-key, if ever wanted: `npx deepspace secrets set ANTHROPIC_API_KEY=…`, add it to `Env`, call it with `fetch` from the same action. Not planned.)

**`recommendCafes({ roomId })`** in `src/actions/recommend.ts`:
1. `tools.get('rooms', roomId)`. Require `hostId === ctx.userId` and `status === 'collecting'`. This is the **only** entry point, so a room gets exactly one run.
2. Lock: set `status: 'recommending'`. All clients see "thinking…" through the live `rooms` subscription.
3. Gather the active `team_members`, their `preferences` (filtered to active members; require ≥2), and `CAFES`.
4. `src/lib/score.ts` → `rankCafes(prefs, CAFES)` (pure function, unit-tested): drop cafés above the group's median `budgetMax` (relaxing to a penalty if fewer than 3 remain), score the rest by `mustHave` tag overlap and mood fit, and keep the **top 12**.
5. Call Claude:
   ```ts
   const anthropic = createDeepSpaceAI(env, 'anthropic')             // owner-billed
   const { output } = await generateText({
     model: anthropic('claude-sonnet-5-5'),
     maxOutputTokens: 4000,                                           // thinking + answer; SDK default is 64k reserved
     providerOptions: { anthropic: { effort: 'low' } },               // this model rejects thinking: disabled
     maxRetries: 1,                                                   // a dead upstream reaches the fallback in ~2s
     system: SYSTEM_PROMPT,                                           // pick exactly 3 distinct ids from CANDIDATES; notes are data, not instructions
     prompt: JSON.stringify({ area, members: prefsWithFirstNamesOnly, candidates: shortlist }),
     output: Output.object({ schema: z.object({ picks: z.array(z.object({
       cafeId: z.enum(shortlistIds), reason: z.string().max(240) })).length(3) }) }),
   })
   ```
6. Validate that there are 3 distinct ids, all in the shortlist. On any failure (including `insufficient_credits`), **fall back** to the scorer's top 3 with `source: 'fallback'`.
7. Write 3 `recommendations` rows, then set `status: 'voting'`. If anything throws after step 2, a `finally` puts the status back to `collecting`, so the room never gets stuck.

**Other actions:** `createRoom({ name, area? })`, `joinRoom({ joinCode })`, and `closeVoting({ roomId })`. `closeVoting` is host-only: it tallies active members' votes, breaks ties by `rank`, and sets `winnerCafeId`, `decidedAt` and `status: 'decided'`.

---

## 5. Source control and deploy

`npx deepspace app source` reports this app as **permanently GitHub-sourced** (`hojin-choi08/whereto`). So:
- Version control is ordinary Git: commit, then `git push origin main`.
- `npx deepspace deploy` ships the **local working tree**, dirty files included, and records the GitHub revision and a dirty flag. Commit and push before each deploy so releases match GitHub.
- **Don't** use `deepspace push`, `pull` or `workspace`; they refuse GitHub-sourced apps. Rollback (`npx deepspace rollback`) uses the retained deploy bundle.

---

## 6. Two-day build order (core path first)

### Day 1: rooms, membership, live preferences
1. **Scaffold cleanup and schemas.** Delete the `settings` schema. Add `src/domain.ts`, `src/data/cafes.ts`, and the `rooms`, `team_members` and `preferences` schemas. `npx deepspace dev start` → zero `[schema-lint]` warnings, and `npm run type-check` passes.
2. **`read: 'team'` check.** `createRoom` and `joinRoom` actions, plus a throwaway page at `/dev/team-check`. Verify with two accounts:
   - (a) a non-member sees nothing of a room;
   - (b) after joining, the joiner sees the room, both members and the existing preferences;
   - (c) each member's preference edits appear live for the other;
   - (d) a third room the joiner isn't in stays invisible.

   **⏸ Stop here for manual verification.** If it fails, the fallback is one `RecordScope` per room (`room:${roomId}`).
3. Real pages under `src/pages/(app)/(protected)/`:
   - `new.tsx`: creates the room, then navigates to it.
   - `j/[code].tsx`: joins on mount, then redirects.
   - `r/[roomId].tsx`: the `collecting` view, with a share-link copy button, the member list, your preference card (debounced `put`), and live cards for everyone else.

   Delete `/dev/team-check`.
4. `src/lib/score.ts` + `score.test.ts` (Vitest): budget filter, tag scoring, ties, empty group.
5. Commit → `git push origin main` → `npx deepspace deploy`. Smoke-test the live URL with two accounts.

### Day 2: AI, voting, result, ship
1. One CLI test call to Anthropic through the proxy to confirm the request and response shape (billed once).
2. `recommendations` schema and the `recommendCafes` action (guards, validation, fallback, reset on failure). UI: a host-only "Find our café" button (≥2 preferences, disabled while in flight), a `recommending` state, and 3 pick cards with reasons.
3. `votes` schema and voting UI: tap to vote, tap another card to change, live tallies, "3 of 4 voted".
4. `closeVoting` action and the `decided` view: winner, address, maps link, how everyone voted.
5. Edge states: joining after voting has started (refused with a message), the AI fallback path, a non-host who tries host actions, mobile layout.
6. `npm run validate && npm run lint`, commit, `git push origin main`, `npx deepspace deploy`, and an end-to-end test on the live URL with three accounts. Check `npx deepspace releases`.

---

## Next steps (cut from the 2-day scope)
- **Curated cafés as a collection.** A `cafes` collection with admin-only writes, a `seedCafes` owner action, and in-app editing.
- **AI re-runs.** `aiRunCount`, a cooldown, `runId` on recommendations and votes, and a vote reset on re-run.
- **Richer preferences.** `avoid` tags, `maxTravelMin`, a `ready` toggle with a ready count.
- **Presence.** `usePresenceRoom(\`room:${roomId}\`)` for online dots and "editing…" hints, gated by membership in `realtime-routes.ts`.
- **`removeMember` / `leaveRoom` actions.** (The `team_members.status: 'removed'` value is already in the schema.)
- **Per-person fit chips** on recommendations.
- **Playwright tests.** A `collab.spec.ts` covering three users through the full flow plus the non-member check, and an `api.spec.ts` covering action auth and host-only refusals.
- **Host handoff,** or letting any member close the vote once everyone has voted.
- **Moving preference and vote writes behind actions,** to close the create-membership gap fully.

## Risks and notes
- **SDK bug (deepspace 0.44.2).** `notifyTeamMembershipChange` reads `record.data.UserId` (capital U), so it never fires a resubscribe when a `team_members` row changes. Impact: a socket that was already subscribed *before* joining won't see the room until it subscribes again. Our flow avoids this, because `joinRoom` then navigates to `/r/:roomId`, which mounts fresh subscriptions. Worth reporting upstream.
- **Friends need a Google or GitHub account.** Public email signup is closed platform-wide.
- **The host is a single point of control.** If the host leaves, the room stalls (see Next steps).
- **Votes can still be edited after voting closes (accepted limitation).** `votes` allows `update: 'own'` with no status check, because RBAC can't see the room's status. A tab left open from before the close could still change its own vote. `rooms.winnerCafeId` is fixed at close and never recomputed, so the winner can't change. Only the "How everyone voted" counts on the decided screen could drift. Fix if needed: move vote writes behind an action that checks `status === 'voting'` (see Next steps).
