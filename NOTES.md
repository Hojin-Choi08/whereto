Live URL: https://whereto.app.space
Repository: https://github.com/hojin-choi08/whereto

What I built
whereto is a real-time group café picker. A host creates a room and shares an invite link. Friends join, and everyone adds their mood and must-haves while seeing each other's cards update live. The host asks Claude for three cafés from a curated list of 28 real Kirkland and Bellevue cafés, everyone votes live, and the host closes voting to show the winner with a Maps link.

DeepSpace features and integrations used

Auth and RBAC: Each room is a DeepSpace team. Room data uses read: 'team', so the server only sends a room's data to its members.
Records and useQuery: These power the live preference cards, vote counts, and room status. I didn't write any custom WebSocket or polling code.
Server actions: Creating rooms, joining, AI recommendations, and closing votes run as server actions with host and member checks.
Anthropic integration: Claude is called through createDeepSpaceAI, billed to the app owner, so there's no API key anywhere in the code.
Presence: usePresenceRoom shows who's in the room right now and who's editing their card. The worker only admits a room's active members to its presence channel.

I left out payments, email, and maps or places APIs because they wouldn't improve the core flow.

Main tradeoff
I used a small, hand-verified café list instead of a live places API. Each café comes from guide pages that I checked myself. That keeps results reliable and lets the server confirm that Claude only picks real cafés from the list. The cost is limited coverage. The sources had no prices or hours, so I didn't invent them. Instead I removed the budget filter and hid hours. A deterministic scorer shortlists cafés and also serves as the fallback if the AI call fails, so a room never gets stuck.

What the agent did
I used Claude Code, then, Codex to draft the plan, schemas, actions, UI, and tests (73 passing). I kept PLAN.md in the repo so context carried over between agents.

What I verified or changed myself

I cut the agent's 4-day plan down to 2 days and chose what to cut.
I tested room isolation and live sync with two accounts before building further.
I found that invite links lost the room after sign-in. The agent's first fix (sessionStorage) passed in a normal window, but I retested in incognito and it failed. I traced the cause to the OAuth hop and had it moved to a server-side HttpOnly cookie.
I confirmed the real AI path on production through the logs (ai ok=true, about 4 seconds, no fallback).
I supplied the verified café data and decided not to invent missing prices or hours.

Unfinished / next steps
Re-running recommendations, removing members, verified price data, a multi-user Playwright test, and moving preference writes behind an action. Vote writes have since moved behind `castVote`, which checks membership, room status, and pick validity server-side.
