/**
 * seedFandomCandidates.ts - Fandom candidate backfill (research round 2).
 *
 * Seeds official candidates for the 9 ready Fandom rankings. Idempotent:
 * existing nominees (matched by ranking + name) keep their data; only an
 * empty photo_url is backfilled. New profiles are created by the system user
 * (team@rephear.com / RepHear Team) and audited with NOMINEE_CREATED.
 *
 * Photo sources were verified during research; URLs below are descriptive only
 * at seed-authoring time; photo_url points at the local copy so no
 * hot-linking happens at runtime.
 */

import { findNomineeByRankingAndName, createProfile, setNomineePhotoIfEmpty } from "./profiles";
import { findRankingBySlug } from "./rankings";
import { findUserByEmail } from "./users";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog";

type CandidateSeed = { name: string; bio: string; photoUrl: string; source: string };

const CANDIDATE_SEEDS: Record<string, CandidateSeed[]> = {
  "most-overrated-anime-right-now": [
    {
      name: "Frieren: Beyond Journey's End",
      bio: "MAL's highest-rated anime of all time (9.25+); Season 2 aired winter 2026 — and CBR named it 'the most overrated anime of all time' in January 2026.",
      photoUrl: "/images/nominees/most-overrated-anime-right-now-1.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/6/60/Frieren_Beyond_Journey%27s_End.jpg",
    },
    {
      name: "Demon Slayer: Kimetsu no Yaiba",
      bio: "Infinity Castle's first chapter became the highest-grossing anime film in history ($793M+); critics say ufotable's animation carries a mid story.",
      photoUrl: "/images/nominees/most-overrated-anime-right-now-2.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/a/ae/Kimetsu_No_Yaiba_Mugen_Jyo-hen_theatrical_poster.jpg",
    },
    {
      name: "Solo Leveling",
      bio: "Crunchyroll's #1 most popular anime through 2024–2025 until Gachiakuta dethroned it in August 2025; 'all aura, no substance' is the standard criticism.",
      photoUrl: "/images/nominees/most-overrated-anime-right-now-3.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/6/6c/Solo_Leveling_Volume_1_Cover.jpg",
    },
    {
      name: "Takopi's Original Sin",
      bio: "2025's breakout hit with every episode at IMDb 9+ — until the ending split the fandom; ComicBook named it 2025's most overrated anime.",
      photoUrl: "/images/nominees/most-overrated-anime-right-now-4.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/4/48/Takopi%27s_Original_Sin_1.png",
    },
    {
      name: "Gachiakuta",
      bio: "Won Best New Anime at the 2026 Crunchyroll Anime Awards while critics argued Takopi deserved it more; Bones' adaptation edits spark weekly wars.",
      photoUrl: "/images/nominees/most-overrated-anime-right-now-5.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/8/80/Gachiakuta_vol_1.png",
    },
    {
      name: "Jujutsu Kaisen",
      bio: "Global shonen flagship; the perennial Reddit accusation: 'fight scenes carry zero storytelling.'",
      photoUrl: "/images/nominees/most-overrated-anime-right-now-6.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/4/46/Jujutsu_kaisen.jpg",
    },
    {
      name: "The Apothecary Diaries",
      bio: "Fall 2026's most anticipated anime (AnimeCorner #1–2); Season 3 premieres October 2 — 'slow pacing' critics are already circling.",
      photoUrl: "/images/nominees/most-overrated-anime-right-now-7.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/3/33/Kusuriyaaaa.jpg",
    },
    {
      name: "Spy x Family",
      bio: "The wholesome mainstream hit everyone loves — but does 'everyone loves it' equal all-time-great status?",
      photoUrl: "/images/nominees/most-overrated-anime-right-now-8.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/5/51/Spy_Family_vol_1.jpg",
    },
    {
      name: "Mushoku Tensei: Jobless Reincarnation",
      bio: "'The ceiling of isekai' to some, 'unwatchable protagonist' to others — the most values-divided fandom on this list.",
      photoUrl: "/images/nominees/most-overrated-anime-right-now-9.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/f/f6/Mushoku_Tensei_1.png",
    },
    {
      name: "Cyberpunk: Edgerunners 2",
      bio: "Fall 2026's #1 most anticipated anime (AnimeCorner poll) before a single episode airs October 20 on Netflix — is the hype itself overrated?",
      photoUrl: "/images/nominees/most-overrated-anime-right-now-10.jpg",
      source: "https://static.wikia.nocookie.net/cyberpunk/images/f/f9/Cyberpunk_Edgerunners_2_Cover_01_CPEDGEII.jpg/revision/latest",
    },
  ],
  "most-overrated-game-of-the-decade": [
    {
      name: "The Legend of Zelda: Breath of the Wild",
      bio: "Metacritic 97; the decade's benchmark — and WhatCulture's pick for the most overrated game of the past decade ('empty world, breakable weapons').",
      photoUrl: "/images/nominees/most-overrated-game-of-the-decade-1.jpg",
      source: "https://cdn.wikimg.net/en/zeldawiki/images/c/c7/BotW_NA_Switch_Box_Art.png",
    },
    {
      name: "Red Dead Redemption 2",
      bio: "Metacritic 97; 'cinematic masterpiece' to fans, 'boring horse-riding simulator' to detractors.",
      photoUrl: "/images/nominees/most-overrated-game-of-the-decade-2.jpg",
      source: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/header.jpg?t=1720558643",
    },
    {
      name: "The Last of Us Part II",
      bio: "93+ on Metacritic and 2020's Game of the Year — met with one of gaming's most infamous review-bombing campaigns.",
      photoUrl: "/images/nominees/most-overrated-game-of-the-decade-3.jpg",
      source: "https://store.playstation.com/store/api/chihiro/00_09_000/container/NL/nl/99/EP9000-PPSA15508_00-THELASTOFUSPART2/0/image?_version=00_09_000&platform=chihiro&bg_color=000000&opacity=100&w=720&h=720",
    },
    {
      name: "Elden Ring",
      bio: "Metacritic 96, 2022 Game of the Year; Steam hosts a thread literally titled 'Most overrated game of the decade!'",
      photoUrl: "/images/nominees/most-overrated-game-of-the-decade-4.jpg",
      source: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1245620/f0b19c231f86fa0e633ff88a1a63459443017728/header_alt_assets_3.jpg?t=1790290043",
    },
    {
      name: "Baldur's Gate 3",
      bio: "Metacritic 96, 2023 Game of the Year; even a Polygon critic called its celebrated writing overrated.",
      photoUrl: "/images/nominees/most-overrated-game-of-the-decade-5.jpg",
      source: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1086940/header.jpg?t=1725555775",
    },
    {
      name: "The Legend of Zelda: Tears of the Kingdom",
      bio: "Metacritic 96; 'just Breath of the Wild again with building' — the Zelda civil war starts here.",
      photoUrl: "/images/nominees/most-overrated-game-of-the-decade-6.jpg",
      source: "https://assets-prd.ignimgs.com/2024/09/26/the-legend-of-zelda-tears-of-the-kingdom-1727356636410.jpg",
    },
    {
      name: "God of War Ragnarök",
      bio: "Metacritic 94; 'bloated puzzles and a finale that wasn't epic enough' — the safe-but-real Sony debate.",
      photoUrl: "/images/nominees/most-overrated-game-of-the-decade-7.jpg",
      source: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/2322010/header.jpg?t=1728067832",
    },
    {
      name: "Death Stranding",
      bio: "Hideo Kojima's divisive delivery epic (Metacritic 82); the 'walking simulator' debate drew a public response from Kojima himself.",
      photoUrl: "/images/nominees/most-overrated-game-of-the-decade-8.jpg",
      source: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1850570/header_2x.jpg?t=1773400635",
    },
    {
      name: "Super Mario Odyssey",
      bio: "Metacritic 97; the happiest game ever made — and NeoGAF's 'most overrated generation' threads name it alongside BOTW and RDR2.",
      photoUrl: "/images/nominees/most-overrated-game-of-the-decade-9.jpg",
      source: "https://mario.wiki.gallery/images/8/8b/SMO_AU_Box.png",
    },
  ],
  "board-games-that-end-friendships": [
    {
      name: "Diplomacy",
      bio: "No dice, no luck — pure negotiation and backstabbing since 1959; the gold standard of friendship-ending board games.",
      photoUrl: "/images/nominees/board-games-that-end-friendships-1.jpg",
      source: "https://i2.wp.com/media.gamestop.com/i/gamestop/11156080/Diplomacy-Board-Game",
    },
    {
      name: "Monopoly",
      bio: "Jail, rent, bankruptcy: the zero-sum shame cycle that has ended more family game nights than any other box on this list.",
      photoUrl: "/images/nominees/board-games-that-end-friendships-2.jpg",
      source: "https://m.media-amazon.com/images/I/91IpVhd5gfL._AC_SX679_.jpg",
    },
    {
      name: "Catan",
      bio: "144,000+ BGG ratings of 'trade me your wool or the robber stays' — polite cooperation on the surface, cold calculation underneath.",
      photoUrl: "/images/nominees/board-games-that-end-friendships-3.jpg",
      source: "https://shop.thirdeyecomics.com/cdn/shop/files/catan-studios-board-games-6th-catan-the-game-029877030811-cn3081-1150562507_1024x.jpg?v=1742605634",
    },
    {
      name: "Risk",
      bio: "Four-hour global conquest sessions where Australia-turtling friendships go to die.",
      photoUrl: "/images/nominees/board-games-that-end-friendships-4.jpg",
      source: "https://www.easons.com/images/m/5e0ffbe3dc5c6c92/original/0931560_5638272048.png",
    },
    {
      name: "Munchkin",
      bio: "Steve Jackson's take-that classic: curse your friends right before they win, steal their loot, repeat for 20+ years.",
      photoUrl: "/images/nominees/board-games-that-end-friendships-5.jpg",
      source: "https://cdn11.bigcommerce.com/s-285hkc2e8r/images/stencil/1280w/products/31397/264129/SJG4001_web_Box_3D_L__27885__87172.1781101208.jpg?c=2",
    },
    {
      name: "Secret Hitler",
      bio: "Hidden-role fascist party game where accusing the wrong friend leaves a real crack in the friendship.",
      photoUrl: "/images/nominees/board-games-that-end-friendships-6.jpg",
      source: "https://images.cdon.com/images/f_auto/t_600x600/cdon-prod/1600718fbe744399/ecefa848eb71/secret-hitler-bradspel-strategispel-pusselspel-for-2-8-personer",
    },
    {
      name: "Uno",
      bio: "The +4 stacking wars are a global meme; the official 'can you stack +4?' rules dispute has ended friendships on its own.",
      photoUrl: "/images/nominees/board-games-that-end-friendships-7.jpg",
      source: "https://shop.mattel.com/cdn/shop/files/r4iltbe8ewykaxuase7z.png?v=1750368329",
    },
    {
      name: "Cosmic Encounter",
      bio: "Since 1977: verbal deals with zero binding power — breaking them isn't just allowed, it's the game.",
      photoUrl: "/images/nominees/board-games-that-end-friendships-8.jpg",
      source: "https://cdn.shopify.com/s/files/1/0491/7225/0789/products/ce01.png",
    },
    {
      name: "Sheriff of Nottingham",
      bio: "Bluff, bribe, and lie to the Sheriff; 2015 Origins Board Game of the Year.",
      photoUrl: "/images/nominees/board-games-that-end-friendships-9.jpg",
      source: "https://cdn.shopify.com/s/files/1/1633/7907/products/sheriff_of_nottingham_pre.png?v=1571446594",
    },
    {
      name: "Exploding Kittens",
      bio: "BGG's own description says it: a game about 'betraying friends' — Kickstarter's biggest tabletop campaign ever.",
      photoUrl: "/images/nominees/board-games-that-end-friendships-10.jpg",
      source: "https://cdn.shopify.com/s/files/1/0532/1696/8883/products/8fe28e73-e35b-43f1-8285-0c984a7ed4b9.580223e55894ecf3d0badcdd440f940a_1024x1024.jpg?v=1622801711",
    },
  ],
  "your-forever-anime": [
    {
      name: "Fullmetal Alchemist: Brotherhood",
      bio: "MAL's eternal #2 (9.09) — the yardstick every other anime gets measured against.",
      photoUrl: "/images/nominees/your-forever-anime-1.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/9/9d/Fullmetal123.jpg",
    },
    {
      name: "Spirited Away",
      bio: "Oscar winner and Golden Bear; the childhood film non-anime fans will still vote for.",
      photoUrl: "/images/nominees/your-forever-anime-2.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/d/db/Spirited_Away_Japanese_poster.png",
    },
    {
      name: "One Piece",
      bio: "On air since 1999; its forever argument isn't perfection, it's presence — it grew up with a generation.",
      photoUrl: "/images/nominees/your-forever-anime-3.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/9/90/One_Piece%2C_Volume_61_Cover_%28Japanese%29.jpg",
    },
    {
      name: "Cowboy Bebop",
      bio: "1998's 26-episode space-western; the Western gateway anime — 'does the 90s filter overrate it?'",
      photoUrl: "/images/nominees/your-forever-anime-4.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/a/a9/Cowboy_Bebop_key_visual.jpg",
    },
    {
      name: "Neon Genesis Evangelion",
      bio: "1995's genre-redefining landmark; 'pretentious' vs 'revolutionary' since day one.",
      photoUrl: "/images/nominees/your-forever-anime-5.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/9/9e/Eoeposter.JPG",
    },
    {
      name: "Steins;Gate",
      bio: "MAL's eternal #3; 'survive the first 11 episodes and it becomes perfect' — El Psy Kongroo.",
      photoUrl: "/images/nominees/your-forever-anime-6.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/e/e4/Steins%3BGate_cover_art.jpg",
    },
    {
      name: "Hunter × Hunter (2011)",
      bio: "The ceiling of shonen storytelling — forever unfinished, forever debated (Chimera Ant: masterpiece or bloat?).",
      photoUrl: "/images/nominees/your-forever-anime-7.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/e/e8/Hunter_%C3%97_Hunter_vol._1.png",
    },
    {
      name: "Clannad: After Story",
      bio: "Key's tearjerker peak (2008–09); no fights, no worldbuilding — just the family storyline that changed everyone who watched it.",
      photoUrl: "/images/nominees/your-forever-anime-8.jpg",
      source: "https://cdn.anisearch.es/images/anime/cover/4/4832_600.webp",
    },
    {
      name: "Gintama",
      bio: "2006–2018; the only comedy on this list — 367 episodes of 'weekly joy' as a forever argument.",
      photoUrl: "/images/nominees/your-forever-anime-9.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/a/a9/Gintama_vol._01.png",
    },
    {
      name: "A Silent Voice",
      bio: "Kyoto Animation's 2016 film on bullying and redemption; 'the half hour of silence after watching' is the standard review.",
      photoUrl: "/images/nominees/your-forever-anime-10.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/3/32/A_Silent_Voice_Film_Poster.jpg",
    },
  ],
  "your-forever-game": [
    {
      name: "Tetris",
      bio: "1984; Guinness record for most ported game ever; the first video game played in space.",
      photoUrl: "/images/nominees/your-forever-game-1.jpg",
      source: "https://cdn.prod.website-files.com/657a0449c9d50d05253287d0/6725064e211acc444d53a2fe_tetris.png",
    },
    {
      name: "Minecraft",
      bio: "The first single game to sell 300 million copies; the 'creator' identity, boxed.",
      photoUrl: "/images/nominees/your-forever-game-2.jpg",
      source: "https://static0.gamerantimages.com/wordpress/wp-content/uploads/2026/08/minecraft-modern-key-art-1.jpg",
    },
    {
      name: "The Elder Scrolls V: Skyrim",
      bio: "60M+ copies across three console generations; the mod community made it literally unfinishable.",
      photoUrl: "/images/nominees/your-forever-game-3.jpg",
      source: "http://cdn.akamai.steamstatic.com/steam/apps/72850/header.jpg?t=1734119874",
    },
    {
      name: "The Legend of Zelda: Ocarina of Time",
      bio: "Won Game Informer's 2024 readers' poll for greatest game of all time, beating Half-Life 2 in the final.",
      photoUrl: "/images/nominees/your-forever-game-4.jpg",
      source: "https://jogorama.com.br/arquivos/capas/1431.jpg",
    },
    {
      name: "Half-Life 2",
      bio: "The 2024 greatest-game runner-up; the FPS storytelling revolution and Valve's identity totem.",
      photoUrl: "/images/nominees/your-forever-game-5.jpg",
      source: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/220/b91f57c06260776c04648d061aba6e8de494ef59/library_header.jpg",
    },
    {
      name: "Final Fantasy VII",
      bio: "The JRPG that broke the genre worldwide in 1997; the remake trilogy keeps it a live debate in 2026.",
      photoUrl: "/images/nominees/your-forever-game-6.jpg",
      source: "https://djf7qc4xvps5h.cloudfront.net/game_d/steam/39140/header.jpg?t=1771952602",
    },
    {
      name: "World of Warcraft",
      bio: "Defined the 'second life' MMO; 20th anniversary in 2024 and still running.",
      photoUrl: "/images/nominees/your-forever-game-7.jpg",
      source: "https://wow.zamimg.com/uploads/blog/images/44026-new-world-of-warcraft-20th-anniversary-key-art.jpg",
    },
    {
      name: "Dark Souls",
      bio: "Invented 'suffering as aesthetic' and the soulslike genre; 'Praise the Sun' outgrew the game.",
      photoUrl: "/images/nominees/your-forever-game-8.jpg",
      source: "https://cdn.thegamesdb.net/images/thumb/boxart/front/55654-1.jpg",
    },
    {
      name: "Disco Elysium",
      bio: "2019's Game Awards winner for narrative, RPG and indie; games can be literature.",
      photoUrl: "/images/nominees/your-forever-game-9.jpg",
      source: "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/632470/extras/a66a0ea3cf03137c506e6ecc9b59ca02.webp?t=1780913406",
    },
    {
      name: "Stardew Valley",
      bio: "41M+ copies from a solo developer with 8+ years of free updates; the comfort-game haven.",
      photoUrl: "/images/nominees/your-forever-game-10.jpg",
      source: "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/413150/header.jpg?t=1711128146",
    },
  ],
  "london-university-anime-societies": [
    {
      name: "UCL Anime Society",
      bio: "One of London's largest anime societies — mascot Remi, the Anime Band, karaoke, quiz nights and intercollegiate events (Students' Union UCL).",
      photoUrl: "/images/nominees/london-university-anime-societies-1.jpg",
      source: "https://studentsunionucl.org/sites/default/files/2026-09/Remi%20Portico.jpg",
    },
    {
      name: "KCL Anime & Manga Society",
      bio: "King's flagship anime society — 2026/27 programme includes movie nights, karaoke, arts & crafts and a maid café (KCLSU).",
      photoUrl: "/images/nominees/london-university-anime-societies-2.jpg",
      source: "https://www.kclsu.org/asset/Organisation/8806/Background%20(7).png",
    },
    {
      name: "Imperial College AnimeSoc (ICAS)",
      bio: "Founded 2001, London's oldest anime society — 500+ item lending library, weekly sessions, and the Melon Band (Imperial College Union).",
      photoUrl: "/images/nominees/london-university-anime-societies-3.jpg",
      source: "https://sums-data-public.sums.digital/IM/group-thumbnails/67/jLZVKqe0ukhw.png",
    },
    {
      name: "LSE Anime and Manga Society",
      bio: "LSE's anime society and London Anime Union member — weekly screenings plus Comic Con and Hyper Japan trips (LSESU).",
      photoUrl: "/images/nominees/london-university-anime-societies-4.jpg",
      source: "https://www.lsesu.com/asset/Organisation/6122/Screenshot%202024-09-20%20at%2005.02.07.png",
    },
    {
      name: "Queen Mary Anime Society",
      bio: "East London's anime society at Mile End — confirmed active for 2026/27 with a Spring Fest social & games night (QMSU).",
      photoUrl: "/images/nominees/london-university-anime-societies-5.jpg",
      source: "https://www.qmsu.org/asset/Organisation/6317/14423585_1289736907703606_1473197991_o.jpg?thumbnail_width=360&thumbnail_height=260&resize_type=CropToFit",
    },
    {
      name: "University of Westminster Anime Society",
      bio: "Central London's anime, manga and Japanese culture society — screenings, karaoke, quizzes and debates (UWSU).",
      photoUrl: "/images/nominees/london-university-anime-societies-6.jpg",
      source: "https://sums-data-public.sums.digital/WM/group-thumbnails/113/OfFAJkwVXWZr.png",
    },
    {
      name: "Goldsmiths Anime & Games Society",
      bio: "New Cross's creative-university society — anime-and-games hybrid with SU-award-recognised activity in 2026 (Goldsmiths SU).",
      photoUrl: "/images/nominees/london-university-anime-societies-7.jpg",
      source: "https://api.huzzle.app/rails/active_storage/blobs/redirect/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaHBBdUVUIiwiZXhwIjpudWxsLCJwdXIiOiJibG9iX2lkIn19--d57699601b521041c472504011056fbbc2ae2ad2/Anime__Gaming_Society.png",
    },
    {
      name: "Greenwich Anime & Games Society",
      bio: "Confirmed running 2026/27 — weekly Thursday sessions in the Dreadnought, plus D&D tables and the Greenwich Royals esports teams (Greenwich SU).",
      photoUrl: "/images/nominees/london-university-anime-societies-8.jpg",
      source: "https://api.huzzle.app/rails/active_storage/blobs/redirect/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaHBBaThKIiwiZXhwIjpudWxsLCJwdXIiOiJibG9iX2lkIn19--d3ed2da10533ba23ba8c3e481b54744c25efc80a/41944110_1837668879648483_5462788901150130176_n.png",
    },
  ],
  "london-dnd-tabletop-rpg-tables": [
    {
      name: "The London Dungeons & Dragons Meetup",
      bio: "London's flagship D&D meetup since 2006 — 14,000+ members, 15–23 games every Sunday at The Britannia, Monument; 20th anniversary March 2026.",
      photoUrl: "/images/nominees/london-dnd-tabletop-rpg-tables-1.jpg",
      source: "https://secure.meetupstatic.com/photos/event/8/c/0/7/600_467495847.jpeg",
    },
    {
      name: "Wyrd West London Dungeons & Dragons",
      bio: "Free weekly Tuesday D&D at The George IV, Chiswick — one-shots, mini-campaigns and long campaigns with beginner-friendly tables.",
      photoUrl: "/images/nominees/london-dnd-tabletop-rpg-tables-2.jpg",
      source: "https://secure.meetupstatic.com/photos/event/b/6/8/b/600_520786731.jpeg",
    },
    {
      name: "Darksphere — D&D Adventurer's Guild",
      bio: "Shepherd's Bush gaming store's Wednesday D&D night (Adventurer's Guild format, 18:30–22:30) — TCG/RPG crossover territory.",
      photoUrl: "/images/nominees/london-dnd-tabletop-rpg-tables-3.jpg",
      source: "https://www.darksphere.co.uk/logoblu.jpg",
    },
    {
      name: "RPG Taverns",
      bio: "'You roll dice, we do the rest' — ticketed D&D with provided GMs, dice and story at COLAB Tavern, Elephant & Castle; new-player tickets available.",
      photoUrl: "/images/nominees/london-dnd-tabletop-rpg-tables-4.jpg",
      source: "https://static.wixstatic.com/media/95f61f_88b0cdb0867546c8bd05655ca8531db5~mv2.jpg/v1/crop/x_156,y_0,w_498,h_497/fill/w_121,h_121,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/95f61f_362ec84b5f774d548ad9fe03a38f94ba~mv2.jpg",
    },
    {
      name: "The Role Play Haven",
      bio: "Volunteer-run RPG club with London branches (Archway, Hammersmith, Lewisham, Stratford) — fixed 6- and 12-week D&D and indie-RPG campaigns.",
      photoUrl: "/images/nominees/london-dnd-tabletop-rpg-tables-5.jpg",
      source: "https://www.rphaven.co.uk/api/media/file/featured_rph_goblin.png",
    },
    {
      name: "London Indie RPG Meetup (Indiemeet)",
      bio: "Monthly indie-TTRPG tables (not D&D 5e) every 3rd Sunday at The Arcanist's Tavern, Hackney Road.",
      photoUrl: "/images/nominees/london-dnd-tabletop-rpg-tables-6.jpg",
      source: "https://secure.meetupstatic.com/photos/event/c/7/2/4/600_476390980.jpeg",
    },
    {
      name: "Dragons Keep Role Play Games",
      bio: "Weekly Friday RPG tables at Cold Harbour Community Hall, Chislehurst — system-agnostic grassroots club for South-East London.",
      photoUrl: "/images/nominees/london-dnd-tabletop-rpg-tables-7.jpg",
      source: "https://secure.meetupstatic.com/photos/event/b/b/2/e/600_503027918.jpeg",
    },
    {
      name: "Bad Moon Cafe",
      bio: "London's most RPG-identified café (159A Great Dover Street) — custom terrain gaming tables and RPG event nights.",
      photoUrl: "/images/nominees/london-dnd-tabletop-rpg-tables-8.jpg",
      source: "https://www.badmooncafe.co.uk/wp-content/uploads/2025/05/DSCF0988-scaled.jpg",
    },
  ],
  "london-cosplayers-about-to-blow-up": [
    {
      name: "Meebee Cosplays",
      bio: "Cosplayer featured by Food And Cosplay (Sept 2026) for her Mary Saotome (Kakegurui) at MegaConLive London 2026. Instagram: @meebee_cosplays.",
      photoUrl: "/images/nominees/london-cosplayers-about-to-blow-up-1.jpg",
      source: "https://foodandcosplay.org/wp-content/uploads/2026/09/FnC-MegaConLive-London-2026-071.jpg",
    },
    {
      name: "val.aura",
      bio: "Cosplayer featured by Food And Cosplay (Sept 2026) for Deidara (Naruto Shippuden) at MCM Comic Con London, May 2026. Instagram: @val.aura.",
      photoUrl: "/images/nominees/london-cosplayers-about-to-blow-up-2.jpg",
      source: "https://foodandcosplay.org/wp-content/uploads/2026/09/MCM-London-May-26-055.jpg",
    },
    {
      name: "Bathysphere Cosplay",
      bio: "Cosplayer featured by Food And Cosplay (Sept 2026) for Tsunade (Naruto Shippuden) at MCM Comic Con London, May 2026; also known for Madara and Khal Drogo cosplays. Instagram: @bathysphere_cosplay.",
      photoUrl: "/images/nominees/london-cosplayers-about-to-blow-up-3.jpg",
      source: "https://foodandcosplay.org/wp-content/uploads/2026/09/MCM-London-May-26-048.jpg",
    },
    {
      name: "TZ20cosplays",
      bio: "Cosplayer featured by Food And Cosplay (Sept 2026) for Elsa (Frozen) at MCM Comic Con London, May 2026. Instagram: @TZ20cosplays.",
      photoUrl: "/images/nominees/london-cosplayers-about-to-blow-up-4.jpg",
      source: "https://foodandcosplay.org/wp-content/uploads/2026/09/MCM-London-May-26-057.jpg",
    },
    {
      name: "breadednuggetss",
      bio: "Cosplayer featured by Food And Cosplay (Sept 2026) for Makima (Chainsaw Man) at MegaConLive London 2026. Instagram: @breadednuggetss.",
      photoUrl: "/images/nominees/london-cosplayers-about-to-blow-up-5.jpg",
      source: "https://foodandcosplay.org/wp-content/uploads/2026/09/FnC-MegaConLive-London-2026-030.jpg",
    },
    {
      name: "exhaustedpige0ncosplays",
      bio: "Cosplayer featured by Food And Cosplay (Sept 2026) for Squirrel Girl (Marvel) at MCM Comic Con London, May 2026; also cosplays Critical Role's Pike Trickfoot. Instagram: @exhaustedpige0ncosplays.",
      photoUrl: "/images/nominees/london-cosplayers-about-to-blow-up-6.jpg",
      source: "https://foodandcosplay.org/wp-content/uploads/2026/09/MCM-London-May-26-040.jpg",
    },
    {
      name: "Megusacos",
      bio: "Cosplayer featured by Food And Cosplay (Sept 2026) for a Fallout Vault Dweller at MegaConLive London 2026. Instagram: @Megusacos.",
      photoUrl: "/images/nominees/london-cosplayers-about-to-blow-up-7.jpg",
      source: "https://foodandcosplay.org/wp-content/uploads/2026/09/FnC-MegaConLive-London-2026-070.jpg",
    },
    {
      name: "Synthetic Spider",
      bio: "Cosplayer featured by Food And Cosplay (Sept 2026) for Spook (Mistborn) at MCM Comic Con London, May 2026; also known for Spider-Man and Caleb Widogast cosplays. Instagram: @synthetic_spider.",
      photoUrl: "/images/nominees/london-cosplayers-about-to-blow-up-8.jpg",
      source: "https://foodandcosplay.org/wp-content/uploads/2026/09/MCM-London-May-26-042.jpg",
    },
    {
      name: "CJ Diddums",
      bio: "Cosplayer featured by Food And Cosplay (Sept 2026) for Torrance Shipman (Bring It On) at MCM Comic Con London, May 2026; guest on the Cosplay Podcast. Instagram: @cjdiddums.",
      photoUrl: "/images/nominees/london-cosplayers-about-to-blow-up-9.jpg",
      source: "https://foodandcosplay.org/wp-content/uploads/2026/09/MCM-London-May-26-062.jpg",
    },
  ],
  "anime-characters-with-the-most-aura": [
    {
      name: "Satoru Gojo",
      bio: "The honoured one — 'Throughout Heaven and Earth, I alone am the honored one.' The character the phrase 'aura farming' was invented for.",
      photoUrl: "/images/nominees/anime-characters-with-the-most-aura-1.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/9/96/SatoruGojomanga.png",
    },
    {
      name: "Shanks",
      bio: "The Red-Haired Emperor: ended the Marineford War with a sentence. Aura by scarcity.",
      photoUrl: "/images/nominees/anime-characters-with-the-most-aura-2.jpg",
      source: "https://static.wikia.nocookie.net/onepiece/images/6/66/Shanks_Anime_Infobox.png/revision/latest",
    },
    {
      name: "Madara Uchiha",
      bio: "Soloed the Allied Shinobi Forces; the 'dance king' — villain aura's ceiling.",
      photoUrl: "/images/nominees/anime-characters-with-the-most-aura-3.jpg",
      source: "https://upload.wikimedia.org/wikipedia/en/e/eb/Madara_Uchiha.jpg",
    },
    {
      name: "Sōsuke Aizen",
      bio: "'Everything was within my calculations' — the mastermind aura, back in the spotlight with the Thousand-Year Blood War anime.",
      photoUrl: "/images/nominees/anime-characters-with-the-most-aura-4.jpg",
      source: "https://statico.soapcentral.com/editor/2025/04/28732-17445334367220.jpg",
    },
    {
      name: "Levi Ackerman",
      bio: "'Humanity's strongest soldier' — says nothing, kills everything. The ODM spin against the Beast Titan is a 2010s defining scene.",
      photoUrl: "/images/nominees/anime-characters-with-the-most-aura-5.jpg",
      source: "https://static.wikia.nocookie.net/shingekinokyojin/images/9/94/Levi_Ackerman_character_image.png/revision/latest",
    },
    {
      name: "Toji Fushiguro",
      bio: "The Sorcerer Killer — zero cursed energy, pure physique; bodied a young Gojo. The mortal ceiling.",
      photoUrl: "/images/nominees/anime-characters-with-the-most-aura-6.jpg",
      source: "https://static.wikia.nocookie.net/jujutsu-kaisen/images/d/db/Toji_Fushiguro_%28Anime%29.png/revision/latest",
    },
    {
      name: "Sung Jinwoo",
      bio: "'ARISE' — the English internet's #1 aura-farming meme; every entrance comes with a monarch's pressure.",
      photoUrl: "/images/nominees/anime-characters-with-the-most-aura-7.jpg",
      source: "https://static.wikia.nocookie.net/solo-leveling/images/8/8b/Jinwoo4.jpg/revision/latest",
    },
    {
      name: "Cid Kagenou",
      bio: "'I AM ATOMIC' — the chuunibyo god of The Eminence in Shadow; aura through delusion, perfected.",
      photoUrl: "/images/nominees/anime-characters-with-the-most-aura-8.jpg",
      source: "https://static.wikia.nocookie.net/to-be-a-power-in-the-shadows/images/5/58/Cid-Kagenou-Profile.jpg/revision/latest",
    },
    {
      name: "Chihiro Rokuhira",
      bio: "Kagurabachi's cold-faced revenge lead with the cursed blade — manga-first aura; the anime lands April 2027.",
      photoUrl: "/images/nominees/anime-characters-with-the-most-aura-9.jpg",
      source: "https://static.wikia.nocookie.net/kagurabachi/images/3/39/Chihiro_Rokuhira_%28Anime%29.png/revision/latest",
    },
    {
      name: "Grimmjow Jaegerjaquez",
      bio: "The 6th Espada's 'Pantera' release — feral-king aura and Ichigo's eternal rival.",
      photoUrl: "/images/nominees/anime-characters-with-the-most-aura-10.jpg",
      source: "https://static.wikia.nocookie.net/bleach/images/4/4c/Ep398GrimmjowProfile.png/revision/latest",
    },
  ],
};

export async function seedFandomCandidates(): Promise<void> {
  const systemUser = await findUserByEmail("team@rephear.com");
  if (!systemUser) {
    console.warn("[seedFandomCandidates] system user team@rephear.com not found; skipping");
    return;
  }

  let created = 0;
  let photoBackfilled = 0;
  for (const [rankingSlug, seeds] of Object.entries(CANDIDATE_SEEDS)) {
    try {
      const ranking = await findRankingBySlug(rankingSlug);
      if (!ranking) {
        console.warn(`[seedFandomCandidates] ranking not found: ${rankingSlug}; skipping`);
        continue;
      }
      for (const seed of seeds) {
        try {
          const existing = await findNomineeByRankingAndName(ranking.id, seed.name);
          if (existing) {
            await setNomineePhotoIfEmpty(existing.id, seed.photoUrl);
            photoBackfilled++;
            continue;
          }
          const profile = await createProfile({
            rankingId: ranking.id,
            name: seed.name,
            bio: seed.bio,
            photoUrl: seed.photoUrl,
            addedBy: systemUser.id,
          });
          created++;
          await recordAuditLog({
            actorUserId: systemUser.id,
            action: AUDIT_ACTIONS.NOMINEE_CREATED,
            targetType: "profile",
            targetId: profile.id,
            details: {
              source: "fandom_candidate_backfill",
              rankingSlug,
              nomineeName: seed.name,
              sourceUrl: seed.source,
            },
          });
        } catch (err) {
          console.error(`[seedFandomCandidates] nominee failed: ${rankingSlug} / ${seed.name}`, err);
        }
      }
    } catch (err) {
      console.error(`[seedFandomCandidates] ranking failed: ${rankingSlug}`, err);
    }
  }
  console.log(`[seedFandomCandidates] done: ${created} created, ${photoBackfilled} existing checked`);
}
