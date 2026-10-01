# Research Log — 42 empty rankings nominee research

**Date:** 2026-10-01
**Scope:** All 42 empty public rankings from `NOMINEE_REVIEW_QUEUE.md` (28 cosplay + 14 digital-creators).
**Result:** 239 verified nominee records across 42 rankings. 13 rankings at full 10/10; 29 with shortfalls; **1 ranking (Best Villain Cosplay) with zero verifiable nominees**.

## Hard rules enforced (no exceptions)
1. **NEVER invent people** — a wrong person is worse than an empty slot.
2. Every nominee: one public profile URL (Instagram/TikTok/YouTube/X/portfolio) actually opened via browser_open (name + theme confirmed on-page) + at least one corroborating public source (second platform / press / convention guest page). Single-source entries were dropped.
3. Bios: one factual English line; only stats actually seen on the profile — never invented.
4. No duplicate names within a ranking (case-insensitive).
5. Shortfalls reported honestly — never padded.
6. London/UK rankings ("London's Best Cosplayer 2026", "London Cosplay Creator of the Year 2026", "Best MCM London Cosplay") required London/UK evidence; `region` = "London, UK" only there, else "".
7. Family-friendly: adult/OnlyFans-adjacent candidates flagged or excluded.

## Coverage table

| # | Ranking | Cat | n/10 |
|---|---|---|---|
| 1 | London's Best Cosplayer 2026 | cosplay | 1 |
| 2 | Best Anime Cosplayer | cosplay | 10 |
| 3 | Best Gaming Cosplayer | cosplay | 10 |
| 4 | Best Manga Cosplay | cosplay | 10 |
| 5 | Best Male Cosplayer | cosplay | 4 |
| 6 | Best Female Cosplayer | cosplay | 10 |
| 7 | Best Duo Cosplay | cosplay | 5 |
| 8 | Best Group Cosplay | cosplay | 2 |
| 9 | Best Couple Cosplay | cosplay | 3 |
| 10 | Best Genderbend Cosplay | cosplay | 4 |
| 11 | **Best Villain Cosplay** | cosplay | **0 — zero verifiable** |
| 12 | Best Cosplay Transformation | cosplay | 1 |
| 13 | Best Makeup Transformation | cosplay | 4 |
| 14 | Best Wig Styling | cosplay | 4 |
| 15 | Best Handmade Costume | cosplay | 6 |
| 16 | Best Armour Build | cosplay | 3 |
| 17 | Best Prop Maker | cosplay | 6 |
| 18 | Best Cosplay Performance | cosplay | 1 |
| 19 | Best Convention Look | cosplay | 4 |
| 20 | Best MCM London Cosplay | cosplay | 1 |
| 21 | Most Creative Cosplay | cosplay | 3 |
| 22 | Most Accurate Cosplay | cosplay | 4 |
| 23 | Most Unexpected Cosplay | cosplay | 1 |
| 24 | Funniest Cosplay Creator | cosplay | 1 |
| 25 | Cosplayer With the Most Aura | cosplay | 3 |
| 26 | London Cosplay Creator of the Year 2026 | cosplay | 1 |
| 27 | Best Anime Content Creator | digital-creators | 10 |
| 28 | Anime TikTok Creator to Watch | digital-creators | 7 |
| 29 | Best Anime YouTuber | digital-creators | 10 |
| 30 | Best Anime Video Editor | digital-creators | 9 |
| 31 | Best Anime Fan Artist | digital-creators | 10 |
| 32 | Best Manga Reviewer | digital-creators | 9 |
| 33 | Manga Creator to Watch | digital-creators | 7 |
| 34 | Gaming Creator to Watch | digital-creators | 10 |
| 35 | Best Gaming Streamer | digital-creators | 10 |
| 36 | Best Gaming TikTok Creator | digital-creators | 10 |
| 37 | Rising VTuber | digital-creators | 10 |
| 38 | Best Cosplay Creator | digital-creators | 10 |
| 39 | Best Cosplay Photographer | cosplay | 5 |
| 40 | Best Cosplay Photographer | digital-creators | 10 |
| 41 | Best Cosplay Video Creator | cosplay | 5 |
| 42 | Best Cosplay Video Creator | digital-creators | 5 |

Duplicate titles "Best Cosplay Photographer" and "Best Cosplay Video Creator" exist once per category — distinguished in the JSON by the `category` field.

## Platform reality (observed 2026-10-01, consistent across 6 researchers)
- Instagram returns systematic **403** via browser_open — the single biggest verification blocker (most cosplayers/photographers are IG-first).
- X is blocked; TikTok native pages are mostly stubs (urlebird mirrors usable as tiktok-platform entries).
- YouTube channel pages, official/portfolio sites, DeviantArt, Behance, Ko-fi, Patreon, convention guest pages open reliably.
- Consequence: shortfalls concentrate in IG-native cosplay niches (villain, transformation, performance, MCM London, London rankings).

## Group method notes
- **Group A (cosplay individuals):** YouTube-first where possible; press/convention corroboration. Deliberately excluded Sneesnaw, Eva Violet, Jessica Nigri (adult/OnlyFans adjacency).
- **Group B (duo/group/couple/themed):** Nominee = the act itself ("A & B"). Worked to 5/ranking; shortfalls recomputed vs 10. "Joe Colton Cosplay" bio carries THEME FIT UNCERTAIN for genderbend. Dropped Narga & Aoki Lifestream (adult adjacency).
- **Group C (craft & making):** YouTube tutorials, maker sites, press features. Schema normalized by coordinator (corroborating_source_url → corroborating_url; platform inferred from URL; stats folded/dropped).
- **Group D (photo/video/performance):** Kotaku/EventHubs/convention press as corroboration. One entry (izziebellacosplay) removed for empty corroborating_url. TikTok tracking params stripped. Ejen Chuang corroboration is an Inven Global tag page (weak — flagged). Mineralblu profile_url is a paginated self-site page.
- **Group F (gaming/VTuber/digital cosplay):** A 2026-10-01 context compaction destroyed 29 verbatim URLs already verified that day; a dedicated re-attachment worker re-opened and name-confirmed all 29. Wikipedia 403'd for 2xRaKai/Auronplay/Rubius/JuanSGuarnizo → corroboration substituted with a second official YouTube channel (opened, name-confirmed; weaker independence — flagged). R3 corroboration is one shared Feedspot roundup URL for all 10 (per-nominee presence not individually re-confirmed — flagged).
- **Group E (anime/manga):** First dispatch errored (output overflow); second dispatch delivered 62. Platform mapped to enum: patreon→portfolio, etsy→portfolio, animemusicvideos.org→portfolio. Loish profile_url kept verbatim with Patreon query string (opened; do not prettify without re-verifying). TikTok URLs canonicalized (tracking stripped).

## Verification-strength flags (weaker than the two-strong-source ideal — review before use)
1. **Best Makeup Transformation:** Amazing JIRO, Sosenka, Unique Sora — primary URL is a press feature, not a personal profile. Dual-press verified; replace with personal profile URL if strict profile rule required.
2. **Best Prop Maker:** Volpin Props (Harrison Krix) — same press-primary situation, dual-press verified.
3. **Best Handmade Costume:** Narga (Natalia) solo verified via Kotaku, but Group B excluded the "Narga & Aoki Lifestream" couple entry for adult-content adjacency — editorial review recommended. Pinky Lu Xun corroboration is same-domain as profile (weak, needs independent second source).
4. **Best Armour Build:** Much Props (Thomas Hanna) — Patreon corroboration could not be re-opened (empty JS shell); read in an earlier session only. Treat as single-verified.
5. **Best Wig Styling:** "Epic Cosplay" is a brand/retailer, not an individual — brand nominee.
6. **Best Cosplay Creator (digital-creators):** Jessica Nigri — adult/OnlyFans-adjacent; other groups deliberately excluded her. Editorial review recommended.
7. **Best Cosplay Photographer (cosplay):** Ejen Chuang corroboration is an Inven Global tag page (weak).
8. **Best Gaming Streamer / Gaming Creator to Watch:** 2xRaKai, Auronplay, Rubius, JuanSGuarnizo corroboration via second YouTube channel (Wikipedia 403) — weaker independence.
9. **Best Gaming TikTok Creator:** all 10 share one Feedspot roundup URL as corroboration.
10. **Content advisories (from Wikipedia, for editorial awareness):** 2xRaKai (platform bans), TheBurntPeanut (controversies), Neuro-sama (January 2023 Twitch ban).

## Notable drops (per no-fabrication rule — identity or source failed)
- Best Villain Cosplay: Anthony Misiano, Joe Kerr Cosplay, @cosplayben, Reyla, namorcosplay, Ernie Cisneros, HydraEvil — all IG/TikTok-only, unverifiable.
- Couple: Narga & Aoki Lifestream (adult adjacency); Rinaca & Surine (Facebook-only).
- Aura: Jessica Nigri (no verbatim YouTube URL obtainable — different reason than suitability).
- Armour: Shawn Thorsson; Makeup: Jo Steel, Tia Lunaria (wrong theme); Creative: Alexander Kravets; Accurate: Maja Felicitas / CutiePieSensei.
- Video Creator: D-Piddy (name mismatch on opened channel), Team Ashen (merch store), Justin Pineda Media.
- TikTok: @the_otaku_sage (account gone), @md_lando (name mismatch — Billie Eilish fan account), @anteroarts (timeout).
- Manga: The Masked Man, Pause and Select, Manga Hoarder (no channel URL); AMV: Bry__ (no channel URL).

## Deliverable
- `data/empty-rankings-nominees.json` — `{"rankings": [{"title", "category", "nominees": [{name, bio, profile_url, platform, corroborating_url, region}], "shortfall", "shortfall_reason"}]}`, queue order. `category` distinguishes the two duplicate titles.
- No database writes were made. No photos were attached.
