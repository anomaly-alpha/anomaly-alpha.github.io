# Friend Tiers & AI Interaction Permissions — Spec v1

## [S0] Key Design Decisions (from elicitation, plus one flagged addition)

Locked in from discussion:
1. **Promotion is fully automatic** — a weighted mix of tenure (time since a
   user's first tracked interaction with Skarn in a guild) and Skarn-specific
   interaction volume. No admin can hand-promote someone's tier.
2. **Perks are a genuine mix**: relaxed rate limits, a warmer/more familiar
   tone from Skarn, and access to exclusive features/commands — all three,
   scaled by tier.
3. **5 tiers**, eggdrop-inspired granularity: `Stranger → Acquaintance →
   Regular → Trusted → Warband`.
4. **Anti-gaming is decay-only** — no admin demotion lever for the tier
   system itself. Inactivity pulls activity score back down over time;
   nothing else does.

**One thing worth flagging honestly about decision #4:** decay only
punishes *silence*, not misbehavior. A user who stays consistently active
while also being disruptive will still climb tiers on schedule — decay
never catches that, by design, since it only fires on inactivity. That's
fine, but it means tier progression and moderation are two genuinely
separate problems, and this spec keeps them separate rather than
compromising the auto-tier system to solve a problem it wasn't built for:

- **This is exactly what the "AI interaction permissions" half of your ask
  is for.** Rather than letting an admin override tier math (which you
  explicitly ruled out), admins get a **separate flag layer** ([S8]) that
  directly gates AI access — block or limit a specific user's ability to
  use AI features at all, independent of whatever tier they've earned. This
  is a cleaner separation of concerns than fighting the tier formula: tier
  answers "how established is this person," flags answer "should this
  person be interacting with AI features right now," and they don't need
  to agree.
- **One addition beyond what you asked for, clearly flagged as optional:**
  [S8c] proposes a `tier_boost` flag — an admin-grantable perk overlay that
  doesn't touch the underlying computed tier or score at all, just grants
  the *perks* of a specified tier on top of it. This exists for the "this
  is a real-life friend of the server owner, give them nice treatment
  immediately" case, without corrupting the auto-tier's integrity. This
  wasn't part of your original three answers — cut it from the build if you
  don't want an admin-facing lever anywhere near this system, no changes
  needed elsewhere in the spec if you do.

## [S1] Problem

Skarn currently treats every user identically once basic rate limits are
satisfied — a person who's talked to him daily for six months gets the
exact same tone, limits, and access as someone who joined an hour ago.
There's no sense of an established relationship translating into anything,
and no lightweight way for admins to restrict a specific problem user's AI
access without reaching for a heavier moderation tool outside the bot
entirely.

## [S2] Design Principles

- **Tiers are earned, not granted** — purely a function of time and
  engagement, computed the same way for everyone, no exceptions baked into
  the core system.
- **Perks accumulate gently, never dramatically** — this should feel like
  Skarn warming up to someone over time, not unlocking a tier list.
- **Flags are a separate, admin-controlled layer for access control**, not a
  tier-progression mechanism. They answer a different question than tiers
  do.
- **Anti-gaming is structural, not punitive** — a daily cap on countable
  interaction points prevents grinding-in-one-sitting without needing any
  human judgment call about what counts as "gaming."
- **Per-server, consistent with Realm and Derived Memory's existing
  scoping** — a user's standing in one server has no bearing on another.
- **Promotions are celebrated; demotions are quiet.** Losing a tier from
  inactivity is a private, undramatic fact, not a public callout.

## [S3] Architecture

```
skarn-bot/
├── features/friendTiers/
│   ├── friendTierCommand.js      ← /friend status, /friend leaderboard
│   ├── friendAdminCommand.js     ← /friendadmin flag, /friendadmin view
│   ├── friendTierStore.js        ← all SQLite operations for friend_tiers + friend_flags
│   ├── friendTierEngine.js       ← tier threshold logic, effective-tier resolution
│   ├── friendTierUpdate.js       ← daily job: decay, recompute, promotion announcements
│   ├── friendActivity.js         ← recordFriendActivity(), daily-cap enforcement
│   └── friendPermission.js       ← checkAiPermission() — the shared gate every AI handler calls
├── db/
│   └── skarn-schema.sql          ← APPEND friend_tiers, friend_flags
├── persona/
│   └── identity.js                ← buildSystemPrompt() gains a 4th param: familiarityLine
└── (touches every existing AI handler — see [S11], this is the real integration cost)
```

## [S4] Tier Definitions

| Tier | Index | Tenure gate | Activity gate |
|------|-------|-------------|----------------|
| Stranger | 0 | 0 days (default) | 0 points (default) |
| Acquaintance | 1 | ≥ 7 days | ≥ 10 points |
| Regular | 2 | ≥ 30 days | ≥ 40 points |
| Trusted | 3 | ≥ 90 days | ≥ 100 points |
| Warband | 4 | ≥ 180 days | ≥ 250 points |

**Both gates must be met** to hold a tier — this dual-gate design is what
makes decay meaningful (see [S6]): tenure never decreases once earned, but
activity points do, so a long-tenured-but-long-silent user can still drop
tiers even though their tenure alone would otherwise "lock in" status
forever.

These thresholds are starting points — tune after observing real usage,
same caveat as every other tunable numeric threshold elsewhere in this bot
(sentiment thresholds, rate limit windows, etc.).

## [S5] Activity Tracking

### [S5a] What counts as a qualifying interaction

Any of: a slash command used, a mention reply received, a `/consult` call,
a Realm action, a Confidant DM exchange — essentially any point where a
user meaningfully engaged with the bot, not just passive presence in a
channel (ordinary chat messages that don't involve the bot do NOT count —
this is about relationship with Skarn specifically, not general server
activity).

### [S5b] `recordFriendActivity(userId, guildId)`

Called once from within each of the touch points above, immediately after a
successful interaction (not on failures/errors). Behavior:
- If no `friend_tiers` row exists yet, create one with `first_seen_at = now`.
- Increment `activity_points` by 1, **but only if `activity_points_today <
  5` for the current UTC date** — once 5 countable points have accrued
  today, further interactions still work normally for the user, they simply
  stop adding to tier progress until the next day. This is the core
  anti-grind-in-one-sitting mechanism: spamming 50 commands in an hour
  counts exactly the same toward tier progress as 5 genuine interactions
  spread across the day.
- Update `last_interaction_at = now`.
- Reset `activity_points_today` to 0 whenever the stored
  `activity_points_today_date` no longer matches today's UTC date (checked
  lazily on each call, no separate reset job needed for this specific
  counter).

## [S6] Decay

Run as part of the same daily job that recomputes tiers ([S7]):
- If `now - last_interaction_at > 14 days` (grace period — short absences
  don't cost anything), reduce `activity_points` by **5 per day** of
  continued inactivity beyond that grace period, floored at 0.
- At this rate, someone who reaches Warband (250 points) and then goes
  fully silent takes roughly a year of continuous inactivity to decay all
  the way back to Stranger — deliberately slow, since a long relationship
  shouldn't evaporate over a two-week vacation, but genuinely reversible
  over sustained absence.
- Decay only ever affects `activity_points`, never `first_seen_at`/tenure —
  tenure is a historical fact, not a moving target.

## [S7] Daily Update Job — `friendTierUpdate.js`

Runs once daily via `setInterval`, same pattern as `stateDecay.js`'s and
Confidant's proactive job:
1. For every `friend_tiers` row: recompute `tenure_days` from `first_seen_at`.
2. Apply decay per [S6] if applicable.
3. Recompute the tier from the dual-gate thresholds in [S4].
4. If the tier **increased**, trigger a promotion announcement (see [S7a]).
   If it **decreased**, update silently — no announcement, no public or
   private message. The user can always check `/friend status` themselves
   if curious.

### [S7a] Promotion announcements

Posted to a designated channel (configurable, same pattern as Realm's major
events). For most tier-ups, a short static-with-variation line is enough:
`"{user} has become an Acquaintance."` styled in Skarn's voice.

**For a promotion specifically into Warband** (the top tier, and
comparatively rare), this is worth a genuine payoff: generate a short,
personalized AI congratulation drawing on that user's `/etch` facts and
top Derived Memory entries, if either system is deployed and has data for
them (graceful no-op if neither exists — this is an enhancement, not a
dependency). This is the one place this spec deliberately reaches across
into two other already-built systems, because the result is worth it: a
promotion message that references something genuinely remembered about the
person, not just a templated congratulations. Uses a dedicated
`roles.friend_promotion` role line, small token budget (~200), and is
subject to the same "no gushing" understated-voice constraint as everything
else Skarn says.

## [S8] Permission Flags — the "AI interaction permissions" layer

Distinct from tiers. Admin-controlled (`ManageGuild` permission required),
directly gates access rather than reflecting earned status.

### [S8a] `friend_flags` fields

- `ai_blocked` (boolean) — total lockout from every AI-powered feature in
  this guild. Reserved for actual abuse cases.
- `ai_limited` (boolean) — restricts to a defined safe subset: basic
  `/consult` only, no Realm, no Confidant, no migrated creative/game
  commands. A lighter tool than a full block for borderline cases.
- `tier_boost` (nullable integer, 0-4) — **[optional addition, see [S0]]**
  when set, this tier's *perks* apply regardless of the user's actual
  computed tier/score. Does not modify `friend_tiers` at all — purely a
  perk overlay resolved at the point perks are calculated (see [S9]).

### [S8b] Setting flags — `/friendadmin flag <user> <flag> <value>`

Admin-only. Writes to `friend_flags`, records `set_by` (the admin's user ID)
and `updated_at` for audit purposes. No confirmation step needed (unlike
Confidant/Realm's destructive-action confirmations) — this is a reversible
administrative setting, not data deletion.

### [S8c] Effective tier resolution

```js
function getEffectiveTier(friendTierRow, friendFlagsRow) {
  if (friendFlagsRow?.tier_boost != null) return friendFlagsRow.tier_boost;
  return friendTierRow?.current_tier ?? 0; // default Stranger
}
```
`ai_blocked`/`ai_limited` are checked separately, before perk resolution
even happens — see [S11].

## [S9] Perks by Effective Tier

### [S9a] Rate limit multipliers

Applied to the existing per-user call ceilings in `lib/rateLimit.js`,
`realmRateLimit.js`, and `confidantRateLimit.js` — each of those needs a
small modification to accept a multiplier rather than a hardcoded constant
(see [S11] for the integration cost this implies across already-shipped
code):

| Tier | Multiplier |
|------|-----------|
| Stranger | 1.0x |
| Acquaintance | 1.0x |
| Regular | 1.25x |
| Trusted | 1.5x |
| Warband | 2.0x |

Acquaintance deliberately gets no rate-limit bump — the first tier is about
Skarn recognizing someone, not a perks unlock yet.

### [S9b] Familiarity line — `buildSystemPrompt`'s 4th parameter

`persona/identity.js`'s `buildSystemPrompt` gains an optional 4th field:

```js
function buildSystemPrompt({ roleLine = '', stateLine = '', memoryLine = '', familiarityLine = '' } = {}) {
  const parts = [SKARN_CORE_IDENTITY];
  if (roleLine) parts.push(roleLine);
  if (stateLine) parts.push(stateLine);
  if (memoryLine) parts.push(memoryLine);
  if (familiarityLine) parts.push(familiarityLine);
  return parts.join('\n\n');
}
```

Familiarity lines per effective tier, kept in Skarn's understated register
— warmth is expressed as *trust*, never as enthusiasm:

```
Stranger: "" (no line — default baseline voice, nothing added)
Acquaintance: "You've spoken with this person a handful of times. Nothing familiar yet, but you recognize them."
Regular: "This person is a regular presence. You're a little more at ease with them than with a stranger."
Trusted: "You trust this person. Let a touch more warmth through — still understated, never effusive."
Warband: "This person has earned real standing with you over time. Treat them with the quiet respect that implies — you don't perform affection, you simply extend more trust."
```

Only `/consult`, mention replies, and Confidant Mode use `familiarityLine`
in v1 — migrated one-shot commands (`/joke`, `/roast`, etc.) skip it, same
reasoning as Derived Memory's scoping decision: a one-shot novelty command
isn't where relationship-depth voice shading adds value.

### [S9c] Exclusive features by tier

- **Regular:** an automatically-granted cosmetic Discord role (if the bot
  has `ManageRoles` permission) — e.g. "Acquaintance of Skarn"-style flair,
  purely cosmetic, no functional effect.
- **Trusted:** unlocks one exclusive interaction — proposed as a
  `/consult` variant with a slightly larger token budget for longer,
  more developed replies (a tangible, low-risk "you get more out of this"
  perk that doesn't require new content design).
- **Warband:** the personalized promotion callback in [S7a], plus standing
  eligibility for the `/friend leaderboard` top listing (all tiers appear
  on the leaderboard, but Warband members are visually distinguished there).

## [S10] Commands

| Command | Purpose | Permission |
|---------|---------|-----------|
| `/friend status` | Own tier, score breakdown (tenure/activity), progress to next tier | Everyone |
| `/friend leaderboard` | Top users by tier/score in this guild | Everyone |
| `/friendadmin flag <user> <flag> <value>` | Set/clear `ai_blocked`, `ai_limited`, or `tier_boost` | `ManageGuild` |
| `/friendadmin view <user>` | Full tier + flag state for a user, audit trail | `ManageGuild` |

### [S10a] `/friend status` detail

Ephemeral. Shows: current tier name, tenure days, activity points (current
/ needed for next tier), and — if a `tier_boost` flag is active — a note
that perks are currently elevated by admin grant, distinct from their
naturally computed tier, so nobody's confused about which is "real."

## [S11] Integration Touch Points — the real cost of this spec

This is the section worth budgeting time for. Unlike Derived Memory or
Confidant, which were mostly new, self-contained code, this system's value
only exists insofar as it's actually wired into everything that already
exists:

- **Every AI-powered handler** (`consult.handler.js`, `vein.handler.js`,
  `mentionRouter.js`, all 18 migrated commands, Realm's action handlers,
  Confidant's conversation handler, Derived Memory's extraction trigger)
  needs a `checkAiPermission(userId, guildId)` call added at the top,
  before any AI call — this returns `{ allowed: boolean, reason: 'blocked' | 'limited' | null }`
  and handlers branch accordingly. This is the same shape of change as
  adding rate-limit checks to each handler was in the original persona
  migration plan — same integration points, so it's additive to code that
  already has a rate-limit check sitting right next to where this one goes.
- **`recordFriendActivity()`** needs a call added at the same touch points,
  on success.
- **The three existing rate limiters** (`lib/rateLimit.js`,
  `realmRateLimit.js`, `confidantRateLimit.js`) each need their hardcoded
  `MAX_CALLS`-equivalent constant replaced with `baseLimit * tierMultiplier`,
  computed via `getEffectiveTier()` + the table in [S9a].
- **`buildSystemPrompt` callers** in `consult.handler.js`, `mentionRouter.js`,
  and Confidant's conversation handler need the new `familiarityLine`
  parameter populated.

None of this is architecturally hard — it's the same pattern repeated
across ~25 existing call sites — but it's real, and should be scoped as its
own migration pass, not treated as incidental to standing up the new
tables and commands.

## [S12] Persistence

```sql
CREATE TABLE IF NOT EXISTS friend_tiers (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  first_seen_at INTEGER NOT NULL,
  last_interaction_at INTEGER NOT NULL,
  activity_points INTEGER NOT NULL DEFAULT 0,
  activity_points_today INTEGER NOT NULL DEFAULT 0,
  activity_points_today_date TEXT NOT NULL,
  current_tier INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, guild_id)
);
CREATE INDEX IF NOT EXISTS idx_friend_tiers_guild ON friend_tiers(guild_id);

CREATE TABLE IF NOT EXISTS friend_flags (
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  ai_blocked INTEGER NOT NULL DEFAULT 0,
  ai_limited INTEGER NOT NULL DEFAULT 0,
  tier_boost INTEGER,
  set_by TEXT,
  updated_at INTEGER,
  PRIMARY KEY (user_id, guild_id)
);
```

Guild-scoped throughout via `(user_id, guild_id)`, consistent with Realm
and Derived Memory's existing scoping decisions.

## [S13] Error Handling

| Case | Behavior |
|------|----------|
| `ai_blocked` user attempts any AI command | Neutral, non-shaming static reply: `"I'm not able to respond to you here."` — no elaboration, no AI call |
| `ai_limited` user attempts a restricted surface (Realm, Confidant, etc.) | `"That's not available to you right now."` — basic `/consult` still works |
| `/friendadmin flag` with an invalid flag name or value | `"That's not a flag I recognize."` — no partial writes |
| `/friend status` for a brand-new user with no `friend_tiers` row yet | Treated as Stranger, tenure 0, activity 0 — no error, this is just the default state |
| Daily update job fails partway through | Logged; per-user updates are independent, so one failure doesn't block others in the same batch (same pattern as Confidant's proactive job) |
| Promotion announcement channel not configured or inaccessible | Log it, skip the announcement — tier state itself still updates correctly |

## [S14] Files

### [S14a] New Files

| File | Purpose | Est. Lines |
|------|---------|-----------|
| `features/friendTiers/friendTierCommand.js` | `/friend status`, `/friend leaderboard` | ~100 |
| `features/friendTiers/friendAdminCommand.js` | `/friendadmin flag`, `/friendadmin view` | ~90 |
| `features/friendTiers/friendTierStore.js` | SQLite operations | ~110 |
| `features/friendTiers/friendTierEngine.js` | Threshold logic, effective-tier resolution | ~70 |
| `features/friendTiers/friendTierUpdate.js` | Daily decay/recompute/announcement job | ~100 |
| `features/friendTiers/friendActivity.js` | `recordFriendActivity()`, daily cap | ~60 |
| `features/friendTiers/friendPermission.js` | `checkAiPermission()` shared gate | ~50 |

Total: ~7 new files, ~580 lines — plus the integration pass across ~25
existing call sites per [S11], which is the larger real effort here.

### [S14b] Modified Files

| File | Change |
|------|--------|
| `db/skarn-schema.sql` | Append `friend_tiers`, `friend_flags` |
| `persona/identity.js` | Add `familiarityLine` param to `buildSystemPrompt` |
| `persona/roles.js` | Add `friend_promotion` role + token budget |
| `lib/rateLimit.js`, `realmRateLimit.js`, `confidantRateLimit.js` | Accept a tier multiplier on the base call ceiling |
| All AI-powered handlers (~25 call sites) | Add `checkAiPermission()` + `recordFriendActivity()` calls — see [S11] |
| `bot.js` | Wire up the daily `friendTierUpdate` job interval |

## [S15] Out of Scope (v1)

- Cross-server/account-wide tiers (per-server only, per [S0])
- Admin manual tier promotion or demotion (decay-only, per [S0] — flags
  handle access control instead, not tier progression)
- Any tier effect on Realm-specific mechanics (NPC pricing, encounter
  difficulty, etc.) — tiers stay a persona-layer concept in v1; a future
  revision could pipe `familiarityLine` into Realm NPC dialogue if desired,
  but that's an explicit non-goal here
- Leaderboard cross-referencing with Derived Memory or Confidant data
  beyond the one-time Warband promotion callback in [S7a]
- Any user-facing way to see *why* a demotion happened beyond checking
  `/friend status` themselves (no proactive "you've been demoted" message,
  per the "demotions are quiet" principle in [S2])

## [S16] Verification

1. New user's first qualifying interaction — verify a `friend_tiers` row is
   created with `first_seen_at = now`, tier `Stranger`
2. Spam 20+ qualifying interactions in one sitting — verify `activity_points`
   only increases by 5 for that day, not 20+ (anti-grind cap)
3. Manually backdate `first_seen_at` and `activity_points` past the
   Acquaintance thresholds, run the daily job — verify tier updates to
   `Acquaintance` and a promotion announcement posts
4. Backdate a user past Warband thresholds with existing `/etch`/derived
   memory data present — verify the promotion announcement includes a
   personalized AI-generated line referencing that data, not just a
   template
5. Backdate `last_interaction_at` 20+ days in the past with nonzero
   `activity_points`, run the daily job — verify `activity_points` decays
   by 5, and that `current_tier` drops if it now falls below its gate
   — verify no public announcement was posted for the demotion
6. `/friendadmin flag @user ai_blocked true` — verify that user's next AI
   command attempt gets the neutral blocked message, with no AI call made
7. `/friendadmin flag @user ai_limited true` — verify `/consult` still
   works but Realm/Confidant do not
8. `/friendadmin flag @user tier_boost 4` on a Stranger-tier user — verify
   they receive Warband-level rate limits and familiarity tone, while
   `/friend status` still shows their real computed tier as Stranger with a
   note that perks are currently boosted
9. Verify rate limiter multipliers apply correctly at each tier by checking
   the effective max-calls value used at Regular (1.25x), Trusted (1.5x),
   and Warband (2.0x) against the base limiter's default
10. Verify `familiarityLine` is empty/absent at Stranger tier and
    progressively present at higher tiers, and that it is NOT injected into
    one-shot commands like `/joke` or `/roast`
11. `/friend leaderboard` — verify Warband members are visually
    distinguished from other tiers in the listing
