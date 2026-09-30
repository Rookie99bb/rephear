# Cold-start ranking strategy — brief for the marketing agent

**Owner:** marketing agent (daily ops). **Engineering input:** Phase 4 shipped the *capability* (milestone share cards + claimed-owner milestone pings). This brief is the *ops playbook* — no code.

## 1. Objective

Turn each cold-start ranking's nominees into a self-running growth loop:

**claim → milestone → card → share → `/s/` attribution → new users → more milestones**

Engineering built the loop mechanics. Marketing's job is to prime it: get nominees claimed, make the first milestones visible, and put cards in front of audiences that convert.

## 2. What engineering now provides (Phase 4, live after deploy)

- **Milestone share cards** — server-rendered 1080×1080 PNG (IG-native 1:1), 4 types:
  - `I'm #N in {ranking}` (live rank, frozen at generation, labeled "as of {date}")
  - `Top 10 🎉` (from the real `entered_top_10` milestone event)
  - `{N} backers ❤️` (real backer count, gated on the 50-backer milestone)
  - `Rising ↗` (real snapshot movement: up 2+ spots or new entry — no data, no card)
- **Claimed-gating, server-side.** Only the verified claiming owner can generate their card. Unclaimed nominees get nothing — this is anti-impersonation, not a bug.
- **Claimed-owner milestone pings** (in-app notification center): "You entered the Top 10 🎉", "You're 8 credits from the Top 10", etc. The owner learns a milestone fired and is pointed at their share page to grab the card.
- Every card carries a deep link (`/s/` short link preferred, `/n/TOKEN` fallback) + CTA "Support {Name} on RepHear". `/s/` visits are attribution-tracked (campaign_links stats).

## 3. The playbook

### 3.1 Get nominees claimed (highest leverage, do first)
An unclaimed nominee is a dead loop — no cards, no pings. Prioritize:
1. Rankings where nominees have real audiences (DJ lineup, K-pop dance, uni societies, cosplay — the 89 cold-start set, DJ campaign first since it's already warm).
2. Outreach order: DM the nominee → "your RepHear page is live, claim it to unlock milestone cards + your share kit" → they claim → loop starts.
3. Track claim rate per ranking. A ranking with 0 claimed nominees gets outreach before it gets poster budget.

### 3.2 Make the first milestones visible
Milestones need real board activity. Seed the flywheel honestly:
- The `likeAction` vote-to-enter giveaway hook is the legal lever (likes only — **never** paid-action raffle entries; Gambling Act risk, non-negotiable).
- Coordinate poster waves (existing pipeline, 1080×1080) with rankings that are *close* to a threshold — "3 backers from 50" is a better wave target than a dead board. Engineering's milestone cron detects crossings daily.
- Do NOT manufacture milestones: no fake supports, no inflated counts. One fabricated milestone destroys nominee trust permanently.

### 3.3 Distribute cards where they convert
- **Nominee's own channels first** (their IG/TikTok/X) — a card shared by the nominee outperforms anything posted by @hirephear. The card says "I'm #7", not "RepHear says".
- **Official accounts second**: repost claimed nominees' cards (with credit), especially Top-10 and #1 moments.
- **Timing**: within 24h of the milestone. The card is labeled "as of {date}" — stale cards look stale.
- Always keep the deep link intact. If a platform strips links (IG captions), put the `/s/` link in bio/comments per the existing playbook.

### 3.4 Feed the loop back
- Watch `/s/` attribution per nominee (campaign link stats). Tell active nominees their numbers — "your card brought 40 visits" is the retention hook that keeps them sharing the *next* milestone.
- When a nominee's card drives a spike, prioritize their ranking for the next poster wave.

## 4. Copy rules (non-negotiable)

- **Credits only, never fiat.** "2,860 Support Credits", never "£286". No £/$/€ anywhere except the actual Stripe checkout page.
- **Real data only.** Every number on a card traces to a milestone event or a live board read at generation time. Never round up, never project ("almost Top 10" is fine as *your* caption; the card itself states facts).
- **No fee/revenue talk.** Never publish or imply the platform/nominee revenue split. Never claim nominees receive cash.
- **No wealth hierarchy.** No "top spender", no spend-tier badges, no "X spent the most". Identity = who + when + what happened, never how much.
- **No pressure copy.** "Share your milestone" is fine. "Support again", "don't fall behind", countdown-pressure — banned.
- **No fabricated movement.** If a card says "Rising", the snapshots prove it. (Engineering enforces this; don't work around it with captions that imply otherwise.)

## 5. Metrics to watch (weekly)

- Claim rate: % of nominees claimed per priority ranking (target: 30%+ on warm rankings first)
- Cards generated per claimed nominee (are owners actually grabbing them?)
- `/s/` visits per card share (attribution — which nominees/channels convert)
- New users attributed to `/s/` per week (the loop's output metric)
- Milestone velocity: thresholds crossed per week across cold-start rankings

## 6. Open decisions (for 欢)

1. **Outreach incentive**: do we offer claimed nominees anything beyond cards (e.g. featured placement) for sharing? Recommendation: no paid incentives — keep it organic; decide if a ranking stalls.
2. **Wave priority**: DJ campaign is warmest — confirm it stays wave 0 while the loop proves out, before spreading poster budget to the 89.
3. **Near-miss cadence**: claimed owners get one "X credits from Top 10" nudge ever per ranking (engineering-guarded). If we want repeated near-miss nudges, that's a product call — currently deliberately once-ever.
