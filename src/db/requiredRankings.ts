// -----------------------------------------------------------------------
// REQUIRED FANDOM DATASET (2026-09-30) — the execution specification's
// mandatory rankings. This file is the SINGLE SOURCE OF TRUTH for the
// 134 required rankings:
//
//   Anime x30 + Manga x30 + Gaming x30 + Cosplay x30 + Creator Bridge x14
//
// Every title below is EXACT per the spec (Phases 2-6). Do not rename,
// substitute, or "improve" them. Existing production rankings whose
// title matches one of these EXACTLY are REUSED (their taxonomy is
// canonicalized to the values here; user-created titles/descriptions
// are never overwritten) — see canonicalizeRequiredRankings() in
// seedTaxonomyRankings.ts.
//
// Each entry: exact title, canonical category slug, canonical
// subcategory slug, canonical scope, tags, and a concise 1-2 sentence
// description explaining what users are recognising/voting on.
// -----------------------------------------------------------------------

export interface RequiredRankingSeed {
  title: string;
  slug: string;
  categorySlug: string;
  subcategorySlug: string;
  scope: "global" | "country" | "city";
  /** Only for scope "city". */
  city?: string;
  /** Only for scope "city". */
  country?: string;
  description: string;
  tags: string[];
}

const G = "global" as const;

export const REQUIRED_RANKINGS: RequiredRankingSeed[] = [
  // ============================ ANIME (30) ============================
  {
    title: "Best Anime Right Now",
    slug: "best-anime-right-now",
    categorySlug: "anime",
    subcategorySlug: "anime-trending",
    scope: G,
    description:
      "The anime airing this season that everyone is watching and talking about. Vote for what's actually worth your time right now.",
    tags: ["anime", "trending", "seasonal", "2026"],
  },
  {
    title: "Best Anime of 2026",
    slug: "best-anime-of-2026",
    categorySlug: "anime",
    subcategorySlug: "anime-trending",
    scope: G,
    description:
      "The single best anime released in 2026. The community vote for this year's standout series.",
    tags: ["anime", "2026", "best of year"],
  },
  {
    title: "Best Anime of All Time",
    slug: "best-anime-of-all-time",
    categorySlug: "anime",
    subcategorySlug: "anime-series",
    scope: G,
    description:
      "The greatest anime series ever made. The definitive community ranking, from classics to modern masterpieces.",
    tags: ["anime", "all time", "classics", "goat"],
  },
  {
    title: "Most Overrated Anime Right Now",
    slug: "most-overrated-anime-right-now",
    categorySlug: "anime",
    subcategorySlug: "anime-hot-takes",
    scope: G,
    description:
      "Everyone hypes it, but is it really that good? The hot-take ranking for anime that doesn't deserve the praise.",
    tags: ["anime", "hot takes", "overrated"],
  },
  {
    title: "Most Underrated Anime",
    slug: "most-underrated-anime",
    categorySlug: "anime",
    subcategorySlug: "anime-hot-takes",
    scope: G,
    description:
      "Hidden gems the algorithm never showed you. Vote for the anime that deserves ten times the audience it has.",
    tags: ["anime", "hot takes", "underrated", "hidden gems"],
  },
  {
    title: "Anime Everyone Should Watch Once",
    slug: "anime-everyone-should-watch-once",
    categorySlug: "anime",
    subcategorySlug: "anime-series",
    scope: G,
    description:
      "Essential viewing. The anime series every fan should experience at least once in their life.",
    tags: ["anime", "essentials", "recommendations"],
  },
  {
    title: "Best Anime for Beginners",
    slug: "best-anime-for-beginners",
    categorySlug: "anime",
    subcategorySlug: "anime-series",
    scope: G,
    description:
      "Never watched anime? Start here. The most welcoming gateway series for brand-new fans.",
    tags: ["anime", "beginners", "recommendations", "gateway"],
  },
  {
    title: "Anime You Wish You Could Watch Again for the First Time",
    slug: "anime-rewatch-first-time",
    categorySlug: "anime",
    subcategorySlug: "anime-series",
    scope: G,
    description:
      "That first-watch magic you can never get back. The anime whose reveals and endings hit hardest the first time.",
    tags: ["anime", "rewatch", "nostalgia"],
  },
  {
    title: "Best Anime Protagonist",
    slug: "best-anime-protagonist",
    categorySlug: "anime",
    subcategorySlug: "anime-characters",
    scope: G,
    description:
      "The heroes and main characters who carried their series. Vote for anime's greatest protagonists.",
    tags: ["anime", "characters", "protagonists", "heroes"],
  },
  {
    title: "Best Anime Villain",
    slug: "best-anime-villain",
    categorySlug: "anime",
    subcategorySlug: "anime-characters",
    scope: G,
    description:
      "The antagonists we love to hate. Ranking anime's most compelling, terrifying and iconic villains.",
    tags: ["anime", "characters", "villains", "antagonists"],
  },
  {
    title: "Anime Characters With the Most Aura",
    slug: "anime-characters-most-aura",
    categorySlug: "anime",
    subcategorySlug: "anime-characters",
    scope: G,
    description:
      "Pure presence. The characters whose entrances, stares and one-liners give you chills every time.",
    tags: ["anime", "characters", "aura"],
  },
  {
    title: "Most Iconic Anime Character of All Time",
    slug: "most-iconic-anime-character",
    categorySlug: "anime",
    subcategorySlug: "anime-characters",
    scope: G,
    description:
      "Recognisable anywhere on earth. The single most iconic character anime has ever produced.",
    tags: ["anime", "characters", "iconic", "all time"],
  },
  {
    title: "Best Female Anime Character",
    slug: "best-female-anime-character",
    categorySlug: "anime",
    subcategorySlug: "anime-characters",
    scope: G,
    description:
      "Anime's greatest heroines, rivals and legends. Celebrating the best-written female characters in the medium.",
    tags: ["anime", "characters", "heroines"],
  },
  {
    title: "Best Anime Duo",
    slug: "best-anime-duo",
    categorySlug: "anime",
    subcategorySlug: "anime-characters",
    scope: G,
    description:
      "Unstoppable pairs. The anime duos whose chemistry, teamwork and banter define their series.",
    tags: ["anime", "characters", "duos", "partnerships"],
  },
  {
    title: "Best Anime Rivalry",
    slug: "best-anime-rivalry",
    categorySlug: "anime",
    subcategorySlug: "anime-characters",
    scope: G,
    description:
      "They push each other to be better — or to destroy each other. Anime's greatest rivalries of all time.",
    tags: ["anime", "characters", "rivalries"],
  },
  {
    title: "Best Anime Couple",
    slug: "best-anime-couple",
    categorySlug: "anime",
    subcategorySlug: "anime-ships",
    scope: G,
    description:
      "Canon or not, these are the ships the fandom sails forever. Vote for anime's greatest couples.",
    tags: ["anime", "ships", "couples", "romance"],
  },
  {
    title: "Best Anime Friendship",
    slug: "best-anime-friendship",
    categorySlug: "anime",
    subcategorySlug: "anime-characters",
    scope: G,
    description:
      "Ride-or-die bonds. The friendships that made us laugh, cry and believe in nakama power.",
    tags: ["anime", "characters", "friendship"],
  },
  {
    title: "Best Anime Character Development",
    slug: "best-anime-character-development",
    categorySlug: "anime",
    subcategorySlug: "anime-characters",
    scope: G,
    description:
      "From zero to legend. The character arcs with the most satisfying growth across their series.",
    tags: ["anime", "characters", "development", "arcs"],
  },
  {
    title: "Best Anime Fight of All Time",
    slug: "best-anime-fight-of-all-time",
    categorySlug: "anime",
    subcategorySlug: "anime-battles",
    scope: G,
    description:
      "Sakuga, stakes and goosebumps. The single greatest anime fight ever animated.",
    tags: ["anime", "battles", "fights", "sakuga", "all time"],
  },
  {
    title: "Best Anime Power System",
    slug: "best-anime-power-system",
    categorySlug: "anime",
    subcategorySlug: "anime-battles",
    scope: G,
    description:
      "Nen, Stands, quirks, cursed energy — which anime built the most clever, consistent and fun power system?",
    tags: ["anime", "battles", "power system"],
  },
  {
    title: "Best Anime Worldbuilding",
    slug: "best-anime-worldbuilding",
    categorySlug: "anime",
    subcategorySlug: "anime-series",
    scope: G,
    description:
      "Worlds you could live in. The anime with the richest lore, history and lived-in universes.",
    tags: ["anime", "worldbuilding", "lore"],
  },
  {
    title: "Best Anime Plot Twist",
    slug: "best-anime-plot-twist",
    categorySlug: "anime",
    subcategorySlug: "anime-series",
    scope: G,
    description:
      "You did NOT see that coming. The anime plot twists that broke the internet and rewired the whole story.",
    tags: ["anime", "plot twist", "story"],
  },
  {
    title: "Best Anime Opening",
    slug: "best-anime-opening",
    categorySlug: "anime",
    subcategorySlug: "anime-music",
    scope: G,
    description:
      "You never skip it. Ranking the greatest anime opening themes and sequences ever made.",
    tags: ["anime", "music", "openings", "op"],
  },
  {
    title: "Best Anime Ending Song",
    slug: "best-anime-ending-song",
    categorySlug: "anime",
    subcategorySlug: "anime-music",
    scope: G,
    description:
      "The perfect cooldown after the episode. Anime's greatest ending songs of all time.",
    tags: ["anime", "music", "endings", "ed"],
  },
  {
    title: "Best Anime Soundtrack",
    slug: "best-anime-soundtrack",
    categorySlug: "anime",
    subcategorySlug: "anime-music",
    scope: G,
    description:
      "Scores that elevate every scene. The anime with the most unforgettable soundtracks.",
    tags: ["anime", "music", "soundtrack", "ost"],
  },
  {
    title: "Best Anime Animation",
    slug: "best-anime-animation",
    categorySlug: "anime",
    subcategorySlug: "anime-visuals",
    scope: G,
    description:
      "A feast for the eyes. The anime with the most stunning, fluid and ambitious animation.",
    tags: ["anime", "visuals", "animation", "sakuga"],
  },
  {
    title: "Most Beautiful Anime",
    slug: "most-beautiful-anime",
    categorySlug: "anime",
    subcategorySlug: "anime-visuals",
    scope: G,
    description:
      "Every frame a painting. The most visually breathtaking anime ever made.",
    tags: ["anime", "visuals", "beautiful", "art"],
  },
  {
    title: "Most Emotional Anime",
    slug: "most-emotional-anime",
    categorySlug: "anime",
    subcategorySlug: "anime-series",
    scope: G,
    description:
      "Keep tissues nearby. The anime that made the whole fandom cry the hardest.",
    tags: ["anime", "emotional", "drama"],
  },
  {
    title: "Funniest Anime",
    slug: "funniest-anime",
    categorySlug: "anime",
    subcategorySlug: "anime-series",
    scope: G,
    description:
      "Comedy gold. The anime that never fails to make you laugh out loud.",
    tags: ["anime", "comedy", "funny"],
  },
  {
    title: "Anime With the Strongest Fandom",
    slug: "anime-strongest-fandom",
    categorySlug: "anime",
    subcategorySlug: "anime-community",
    scope: G,
    description:
      "The most passionate, creative and unstoppable fanbases in anime. Which fandom runs the internet?",
    tags: ["anime", "community", "fandom"],
  },
  // ============================ MANGA (30) ============================
  {
    title: "Best Manga Right Now",
    slug: "best-manga-right-now",
    categorySlug: "manga",
    subcategorySlug: "manga-trending",
    scope: G,
    description:
      "The manga everyone is reading this month. Vote for the series dominating the conversation right now.",
    tags: ["manga", "trending", "2026"],
  },
  {
    title: "Best Manga of All Time",
    slug: "best-manga-of-all-time",
    categorySlug: "manga",
    subcategorySlug: "manga-series",
    scope: G,
    description:
      "The greatest manga ever drawn. The definitive community ranking of the medium's masterpieces.",
    tags: ["manga", "all time", "classics", "goat"],
  },
  {
    title: "Best Ongoing Manga 2026",
    slug: "best-ongoing-manga-2026",
    categorySlug: "manga",
    subcategorySlug: "manga-trending",
    scope: G,
    description:
      "Still serialising, still delivering. The best manga you can follow chapter by chapter in 2026.",
    tags: ["manga", "ongoing", "2026", "serialization"],
  },
  {
    title: "Most Addictive Manga",
    slug: "most-addictive-manga",
    categorySlug: "manga",
    subcategorySlug: "manga-series",
    scope: G,
    description:
      "Just one more chapter... The manga you physically could not put down until 4am.",
    tags: ["manga", "addictive", "binge"],
  },
  {
    title: "Most Overrated Manga Right Now",
    slug: "most-overrated-manga-right-now",
    categorySlug: "manga",
    subcategorySlug: "manga-hot-takes",
    scope: G,
    description:
      "Hyped beyond reason? The hot-take ranking for manga that doesn't live up to the buzz.",
    tags: ["manga", "hot takes", "overrated"],
  },
  {
    title: "Most Underrated Manga",
    slug: "most-underrated-manga",
    categorySlug: "manga",
    subcategorySlug: "manga-hot-takes",
    scope: G,
    description:
      "Buried masterpieces. The manga that deserves a fandom ten times its size.",
    tags: ["manga", "hot takes", "underrated", "hidden gems"],
  },
  {
    title: "Manga Everyone Should Read Once",
    slug: "manga-everyone-should-read-once",
    categorySlug: "manga",
    subcategorySlug: "manga-series",
    scope: G,
    description:
      "Essential reading. The manga every fan should experience at least once.",
    tags: ["manga", "essentials", "recommendations"],
  },
  {
    title: "Best Manga for Anime Fans",
    slug: "best-manga-for-anime-fans",
    categorySlug: "manga",
    subcategorySlug: "manga-series",
    scope: G,
    description:
      "Love the anime? Read further. The manga that anime-only fans absolutely need to pick up.",
    tags: ["manga", "anime fans", "recommendations"],
  },
  {
    title: "Best New-Gen Manga",
    slug: "best-new-gen-manga",
    categorySlug: "manga",
    subcategorySlug: "manga-trending",
    scope: G,
    description:
      "The new wave. Ranking the best manga from the current generation of creators.",
    tags: ["manga", "new gen", "trending"],
  },
  {
    title: "Manga Most Deserving of an Anime Adaptation",
    slug: "manga-deserving-anime-adaptation",
    categorySlug: "manga",
    subcategorySlug: "manga-adaptations",
    scope: G,
    description:
      "Studio, are you listening? The unadapted manga that would break the internet as anime.",
    tags: ["manga", "adaptations", "anime"],
  },
  {
    title: "Best Manga Art Style",
    slug: "best-manga-art-style",
    categorySlug: "manga",
    subcategorySlug: "manga-art",
    scope: G,
    description:
      "Linework that stops you mid-page. Celebrating the most distinctive and beautiful manga art styles.",
    tags: ["manga", "art", "art style"],
  },
  {
    title: "Best Manga Panels of All Time",
    slug: "best-manga-panels",
    categorySlug: "manga",
    subcategorySlug: "manga-art",
    scope: G,
    description:
      "Single panels burned into fandom memory. The most iconic manga panels ever drawn.",
    tags: ["manga", "art", "panels", "iconic"],
  },
  {
    title: "Best Manga Cover Art",
    slug: "best-manga-cover-art",
    categorySlug: "manga",
    subcategorySlug: "manga-art",
    scope: G,
    description:
      "Judged by the cover, proudly. The most striking manga volume covers of all time.",
    tags: ["manga", "art", "covers"],
  },
  {
    title: "Best Manga Character Design",
    slug: "best-manga-character-design",
    categorySlug: "manga",
    subcategorySlug: "manga-art",
    scope: G,
    description:
      "Silhouettes you recognise instantly. The manga with the most memorable character designs.",
    tags: ["manga", "art", "character design"],
  },
  {
    title: "Best Manga Protagonist",
    slug: "best-manga-protagonist",
    categorySlug: "manga",
    subcategorySlug: "manga-characters",
    scope: G,
    description:
      "The heroes of the page. Vote for manga's greatest protagonists.",
    tags: ["manga", "characters", "protagonists"],
  },
  {
    title: "Best Manga Villain",
    slug: "best-manga-villain",
    categorySlug: "manga",
    subcategorySlug: "manga-characters",
    scope: G,
    description:
      "Chilling in black and white. Manga's most compelling and terrifying villains.",
    tags: ["manga", "characters", "villains"],
  },
  {
    title: "Best Female Manga Character",
    slug: "best-female-manga-character",
    categorySlug: "manga",
    subcategorySlug: "manga-characters",
    scope: G,
    description:
      "Manga's greatest heroines and icons. Celebrating the best-written female characters on the page.",
    tags: ["manga", "characters", "heroines"],
  },
  {
    title: "Best Manga Couple",
    slug: "best-manga-couple",
    categorySlug: "manga",
    subcategorySlug: "manga-characters",
    scope: G,
    description:
      "The ships that sailed a thousand fanarts. Vote for manga's greatest couples.",
    tags: ["manga", "characters", "couples", "ships", "romance"],
  },
  {
    title: "Best Manga Rivalry",
    slug: "best-manga-rivalry",
    categorySlug: "manga",
    subcategorySlug: "manga-characters",
    scope: G,
    description:
      "Pushing each other beyond limits. The greatest rivalries ever drawn in manga.",
    tags: ["manga", "characters", "rivalries"],
  },
  {
    title: "Most Heartbreaking Manga",
    slug: "most-heartbreaking-manga",
    categorySlug: "manga",
    subcategorySlug: "manga-series",
    scope: G,
    description:
      "It hurts so good. The manga that broke readers' hearts and never put them back together.",
    tags: ["manga", "emotional", "drama", "heartbreaking"],
  },
  {
    title: "Funniest Manga",
    slug: "funniest-manga",
    categorySlug: "manga",
    subcategorySlug: "manga-series",
    scope: G,
    description:
      "Laughing on the train, no regrets. The funniest manga ever published.",
    tags: ["manga", "comedy", "funny"],
  },
  {
    title: "Darkest Manga Worth Reading",
    slug: "darkest-manga-worth-reading",
    categorySlug: "manga",
    subcategorySlug: "manga-genres",
    scope: G,
    description:
      "Not for the faint of heart — but worth it. The darkest manga that earns every shadow.",
    tags: ["manga", "genres", "dark", "seinen"],
  },
  {
    title: "Best Romance Manga",
    slug: "best-romance-manga",
    categorySlug: "manga",
    subcategorySlug: "manga-genres",
    scope: G,
    description:
      "Butterflies guaranteed. The greatest romance manga, from slow burns to whirlwinds.",
    tags: ["manga", "genres", "romance", "shojo"],
  },
  {
    title: "Best Horror Manga",
    slug: "best-horror-manga",
    categorySlug: "manga",
    subcategorySlug: "manga-genres",
    scope: G,
    description:
      "Don't read at 3am. The most terrifying manga ever put to paper.",
    tags: ["manga", "genres", "horror"],
  },
  {
    title: "Best Sports Manga",
    slug: "best-sports-manga",
    categorySlug: "manga",
    subcategorySlug: "manga-genres",
    scope: G,
    description:
      "You don't even need to like sports. The manga that made matches feel like wars.",
    tags: ["manga", "genres", "sports"],
  },
  {
    title: "Best Fantasy Manga",
    slug: "best-fantasy-manga",
    categorySlug: "manga",
    subcategorySlug: "manga-genres",
    scope: G,
    description:
      "Portals to other worlds. The greatest fantasy manga ever drawn.",
    tags: ["manga", "genres", "fantasy", "isekai"],
  },
  {
    title: "Best Psychological Manga",
    slug: "best-psychological-manga",
    categorySlug: "manga",
    subcategorySlug: "manga-genres",
    scope: G,
    description:
      "Mind games on paper. The manga that messes with your head in the best way.",
    tags: ["manga", "genres", "psychological", "thriller"],
  },
  {
    title: "Best Manga Plot Twist",
    slug: "best-manga-plot-twist",
    categorySlug: "manga",
    subcategorySlug: "manga-series",
    scope: G,
    description:
      "The page-turn that changed everything. Manga's most shocking plot twists.",
    tags: ["manga", "plot twist", "story"],
  },
  {
    title: "Manga With the Best Worldbuilding",
    slug: "manga-best-worldbuilding",
    categorySlug: "manga",
    subcategorySlug: "manga-series",
    scope: G,
    description:
      "Universes with their own rules, history and weight. The manga with the richest worldbuilding.",
    tags: ["manga", "worldbuilding", "lore"],
  },
  {
    title: "Manga You Wish You Could Read Again for the First Time",
    slug: "manga-read-first-time",
    categorySlug: "manga",
    subcategorySlug: "manga-series",
    scope: G,
    description:
      "That first-read shock, lost forever. The manga whose twists and endings hit hardest the first time.",
    tags: ["manga", "reread", "nostalgia"],
  },
  // ============================ GAMING (30) ============================
  {
    title: "Best Game Right Now",
    slug: "best-game-right-now",
    categorySlug: "gaming",
    subcategorySlug: "gaming-trending",
    scope: G,
    description:
      "What everyone's playing this month. Vote for the game dominating right now.",
    tags: ["gaming", "trending", "2026"],
  },
  {
    title: "Game of the Year 2026 — Community Vote",
    slug: "game-of-the-year-2026",
    categorySlug: "gaming",
    subcategorySlug: "gaming-trending",
    scope: G,
    description:
      "Forget the award shows — this is the players' pick. The community vote for 2026's Game of the Year.",
    tags: ["gaming", "goty", "2026", "community vote"],
  },
  {
    title: "Best Game of All Time",
    slug: "best-game-of-all-time",
    categorySlug: "gaming",
    subcategorySlug: "gaming-games",
    scope: G,
    description:
      "The greatest video game ever made. The definitive player-voted ranking across every era and platform.",
    tags: ["gaming", "all time", "goat", "classics"],
  },
  {
    title: "Most Overrated Game Right Now",
    slug: "most-overrated-game-right-now",
    categorySlug: "gaming",
    subcategorySlug: "gaming-hot-takes",
    scope: G,
    description:
      "10/10 from everyone but you? The hot-take ranking for games that don't deserve the hype.",
    tags: ["gaming", "hot takes", "overrated"],
  },
  {
    title: "Most Underrated Game",
    slug: "most-underrated-game",
    categorySlug: "gaming",
    subcategorySlug: "gaming-hot-takes",
    scope: G,
    description:
      "Slept-on masterpieces. The games that deserved way more players, sales and love.",
    tags: ["gaming", "hot takes", "underrated", "hidden gems"],
  },
  {
    title: "Your Forever Game",
    slug: "your-forever-game",
    categorySlug: "gaming",
    subcategorySlug: "gaming-games",
    scope: G,
    description:
      "The one you always come back to. Which game is your permanent install, your forever game?",
    tags: ["gaming", "forever game", "comfort"],
  },
  {
    title: "Game You Wish You Could Play Again for the First Time",
    slug: "game-play-first-time",
    categorySlug: "gaming",
    subcategorySlug: "gaming-games",
    scope: G,
    description:
      "That blind first playthrough, gone forever. The games whose discovery you'll never get back.",
    tags: ["gaming", "nostalgia", "first playthrough"],
  },
  {
    title: "Most Addictive Game",
    slug: "most-addictive-game",
    categorySlug: "gaming",
    subcategorySlug: "gaming-games",
    scope: G,
    description:
      "One more run. One more turn. The games that ate hundreds of your hours without apology.",
    tags: ["gaming", "addictive"],
  },
  {
    title: "Best Multiplayer Game",
    slug: "best-multiplayer-game",
    categorySlug: "gaming",
    subcategorySlug: "gaming-multiplayer",
    scope: G,
    description:
      "Better with others. The greatest multiplayer experiences ever made.",
    tags: ["gaming", "multiplayer"],
  },
  {
    title: "Best Co-op Game",
    slug: "best-co-op-game",
    categorySlug: "gaming",
    subcategorySlug: "gaming-multiplayer",
    scope: G,
    description:
      "Built for teamwork. The best games to play cooperatively with friends.",
    tags: ["gaming", "co-op", "multiplayer"],
  },
  {
    title: "Best Competitive Game",
    slug: "best-competitive-game",
    categorySlug: "gaming",
    subcategorySlug: "gaming-multiplayer",
    scope: G,
    description:
      "Where legends are made and friendships tested. The best competitive games ever.",
    tags: ["gaming", "competitive", "esports", "pvp"],
  },
  {
    title: "Best Open-World Game",
    slug: "best-open-world-game",
    categorySlug: "gaming",
    subcategorySlug: "gaming-games",
    scope: G,
    description:
      "Go anywhere, do anything. Ranking the greatest open worlds in gaming history.",
    tags: ["gaming", "open world"],
  },
  {
    title: "Best RPG",
    slug: "best-rpg",
    categorySlug: "gaming",
    subcategorySlug: "gaming-rpg",
    scope: G,
    description:
      "Hundred-hour epics and character builds. The greatest role-playing games of all time.",
    tags: ["gaming", "rpg", "jrpg"],
  },
  {
    title: "Best Horror Game",
    slug: "best-horror-game",
    categorySlug: "gaming",
    subcategorySlug: "gaming-games",
    scope: G,
    description:
      "Play with the lights on. The scariest, most atmospheric horror games ever made.",
    tags: ["gaming", "horror"],
  },
  {
    title: "Best Indie Game",
    slug: "best-indie-game",
    categorySlug: "gaming",
    subcategorySlug: "gaming-indie",
    scope: G,
    description:
      "Small teams, huge ideas. Celebrating the greatest independent games ever made.",
    tags: ["gaming", "indie"],
  },
  {
    title: "Best Cozy Game",
    slug: "best-cozy-game",
    categorySlug: "gaming",
    subcategorySlug: "gaming-indie",
    scope: G,
    description:
      "No stress, just vibes. The coziest games to unwind with.",
    tags: ["gaming", "cozy", "indie", "wholesome"],
  },
  {
    title: "Best Story in Gaming",
    slug: "best-story-in-gaming",
    categorySlug: "gaming",
    subcategorySlug: "gaming-games",
    scope: G,
    description:
      "Narratives that rival film and novels. The games with the greatest stories ever told.",
    tags: ["gaming", "story", "narrative"],
  },
  {
    title: "Best Game World",
    slug: "best-game-world",
    categorySlug: "gaming",
    subcategorySlug: "gaming-games",
    scope: G,
    description:
      "Places you never wanted to leave. The most immersive and memorable game worlds.",
    tags: ["gaming", "world", "lore", "immersion"],
  },
  {
    title: "Best Video Game Character",
    slug: "best-video-game-character",
    categorySlug: "gaming",
    subcategorySlug: "gaming-characters",
    scope: G,
    description:
      "Icons of the medium. Vote for the greatest video game character of all time.",
    tags: ["gaming", "characters"],
  },
  {
    title: "Best Gaming Villain",
    slug: "best-gaming-villain",
    categorySlug: "gaming",
    subcategorySlug: "gaming-characters",
    scope: G,
    description:
      "The final bosses of our nightmares. Gaming's most unforgettable villains.",
    tags: ["gaming", "characters", "villains"],
  },
  {
    title: "Best Video Game Duo",
    slug: "best-video-game-duo",
    categorySlug: "gaming",
    subcategorySlug: "gaming-characters",
    scope: G,
    description:
      "Partners in every sense. The greatest duos in video game history.",
    tags: ["gaming", "characters", "duos"],
  },
  {
    title: "Best Video Game Romance",
    slug: "best-video-game-romance",
    categorySlug: "gaming",
    subcategorySlug: "gaming-characters",
    scope: G,
    description:
      "Love stories told through play. The most moving romances in gaming.",
    tags: ["gaming", "characters", "romance"],
  },
  {
    title: "Best Game Soundtrack",
    slug: "best-game-soundtrack",
    categorySlug: "gaming",
    subcategorySlug: "gaming-games",
    scope: G,
    description:
      "Music that made the moment. The greatest video game soundtracks ever composed.",
    tags: ["gaming", "soundtrack", "music", "ost"],
  },
  {
    title: "Best Character Design in Gaming",
    slug: "best-character-design-gaming",
    categorySlug: "gaming",
    subcategorySlug: "gaming-characters",
    scope: G,
    description:
      "Instantly recognisable silhouettes. Celebrating the best character designs in gaming.",
    tags: ["gaming", "characters", "design", "art"],
  },
  {
    title: "Best Boss Fight of All Time",
    slug: "best-boss-fight-of-all-time",
    categorySlug: "gaming",
    subcategorySlug: "gaming-games",
    scope: G,
    description:
      "Heart pounding, hands shaking. The single greatest boss fight in gaming history.",
    tags: ["gaming", "boss fight", "all time"],
  },
  {
    title: "Hardest Game You Actually Love",
    slug: "hardest-game-you-love",
    categorySlug: "gaming",
    subcategorySlug: "gaming-hot-takes",
    scope: G,
    description:
      "Brutal — and you keep coming back. The hardest games that earned every death.",
    tags: ["gaming", "hard", "difficult", "soulslike"],
  },
  {
    title: "Best Game to Play With Friends",
    slug: "best-game-with-friends",
    categorySlug: "gaming",
    subcategorySlug: "gaming-multiplayer",
    scope: G,
    description:
      "Game night essentials. The best games to play together with your friends.",
    tags: ["gaming", "friends", "party", "multiplayer"],
  },
  {
    title: "Game With the Best Community",
    slug: "game-best-community",
    categorySlug: "gaming",
    subcategorySlug: "gaming-community",
    scope: G,
    description:
      "Wholesome lobbies only. The games with the kindest, most welcoming player communities.",
    tags: ["gaming", "community"],
  },
  {
    title: "Game With the Most Chaotic Community",
    slug: "game-most-chaotic-community",
    categorySlug: "gaming",
    subcategorySlug: "gaming-community",
    scope: G,
    description:
      "Beautiful chaos. The player communities that never, ever behave — and we love them for it.",
    tags: ["gaming", "community", "chaotic", "memes"],
  },
  {
    title: "Game That Defined Your Childhood",
    slug: "game-defined-childhood",
    categorySlug: "gaming",
    subcategorySlug: "gaming-games",
    scope: G,
    description:
      "After school, no saves, pure joy. The game that defined your childhood.",
    tags: ["gaming", "childhood", "nostalgia", "retro"],
  },
  // ============================ COSPLAY (30) ============================
  {
    title: "London's Best Cosplayer 2026",
    slug: "londons-best-cosplayer-2026",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-creators",
    scope: "city",
    city: "London",
    country: "United Kingdom",
    description:
      "The capital's finest. Vote for London's best cosplayer of 2026.",
    tags: ["cosplay", "london", "2026", "creators"],
  },
  {
    title: "London's Best Rookie Cosplayer 2026",
    slug: "londons-best-rookie-cosplayer-2026",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-rising",
    scope: "city",
    city: "London",
    country: "United Kingdom",
    description:
      "New to the scene, already turning heads. London's best rookie cosplayer of 2026.",
    tags: ["cosplay", "london", "rookie", "rising", "2026"],
  },
  {
    title: "London Cosplayers About to Blow Up",
    slug: "london-cosplayers-about-to-blow-up",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-rising",
    scope: "city",
    city: "London",
    country: "United Kingdom",
    description:
      "Before they were famous. The London cosplayers about to blow up — spot them first.",
    tags: ["cosplay", "london", "rising", "upcoming"],
  },
  {
    title: "Best Anime Cosplayer",
    slug: "best-anime-cosplayer",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-anime",
    scope: G,
    description:
      "Bringing 2D to life. The world's best cosplayers specialising in anime characters.",
    tags: ["cosplay", "anime"],
  },
  {
    title: "Best Gaming Cosplayer",
    slug: "best-gaming-cosplayer",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-gaming",
    scope: G,
    description:
      "From the screen to the convention floor. The world's best gaming cosplayers.",
    tags: ["cosplay", "gaming"],
  },
  {
    title: "Best Manga Cosplay",
    slug: "best-manga-cosplay",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-anime",
    scope: G,
    description:
      "Black-and-white panels, in full colour. The best cosplays inspired by manga.",
    tags: ["cosplay", "manga"],
  },
  {
    title: "Best Male Cosplayer",
    slug: "best-male-cosplayer",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-creators",
    scope: G,
    description:
      "The kings of the craft. Celebrating the world's best male cosplayers.",
    tags: ["cosplay", "creators"],
  },
  {
    title: "Best Female Cosplayer",
    slug: "best-female-cosplayer",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-creators",
    scope: G,
    description:
      "The queens of the convention. Celebrating the world's best female cosplayers.",
    tags: ["cosplay", "creators"],
  },
  {
    title: "Best Duo Cosplay",
    slug: "best-duo-cosplay",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-creators",
    scope: G,
    description:
      "Twice the talent. The best duo cosplays — perfectly matched pairs.",
    tags: ["cosplay", "duo"],
  },
  {
    title: "Best Group Cosplay",
    slug: "best-group-cosplay",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-creators",
    scope: G,
    description:
      "Squad goals, realised. The most impressive group cosplays ever assembled.",
    tags: ["cosplay", "group"],
  },
  {
    title: "Best Couple Cosplay",
    slug: "best-couple-cosplay",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-creators",
    scope: G,
    description:
      "Matching costumes, matching energy. The cutest and most creative couple cosplays.",
    tags: ["cosplay", "couple"],
  },
  {
    title: "Best Genderbend Cosplay",
    slug: "best-genderbend-cosplay",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-costume",
    scope: G,
    description:
      "Reimagined brilliantly. The best genderbend cosplays that transform the character.",
    tags: ["cosplay", "genderbend", "costume"],
  },
  {
    title: "Best Villain Cosplay",
    slug: "best-villain-cosplay",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-costume",
    scope: G,
    description:
      "Delightfully evil. The most striking villain cosplays ever worn.",
    tags: ["cosplay", "villains", "costume"],
  },
  {
    title: "Best Cosplay Transformation",
    slug: "best-cosplay-transformation",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-costume",
    scope: G,
    description:
      "Before and after, unbelievably. The most jaw-dropping cosplay transformations.",
    tags: ["cosplay", "transformation", "costume"],
  },
  {
    title: "Best Makeup Transformation",
    slug: "best-makeup-transformation",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-makeup",
    scope: G,
    description:
      "The brush is mightier. Celebrating the best makeup artistry in cosplay.",
    tags: ["cosplay", "makeup", "transformation"],
  },
  {
    title: "Best Wig Styling",
    slug: "best-wig-styling",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-costume",
    scope: G,
    description:
      "Gravity-defying spikes and silk-smooth gradients. The best wig styling in cosplay.",
    tags: ["cosplay", "wig", "styling", "costume"],
  },
  {
    title: "Best Handmade Costume",
    slug: "best-handmade-costume",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-costume",
    scope: G,
    description:
      "Sewn, glued and dreamed into existence. Honouring the best handmade cosplay costumes.",
    tags: ["cosplay", "handmade", "costume", "craft"],
  },
  {
    title: "Best Armour Build",
    slug: "best-armour-build",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-costume",
    scope: G,
    description:
      "Foam, Worbla and pure patience. The most impressive cosplay armour builds.",
    tags: ["cosplay", "armour", "build", "craft"],
  },
  {
    title: "Best Prop Maker",
    slug: "best-prop-maker",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-costume",
    scope: G,
    description:
      "Weapons, staffs and gadgets, built by hand. Celebrating cosplay's best prop makers.",
    tags: ["cosplay", "props", "craft"],
  },
  {
    title: "Best Cosplay Photographer",
    slug: "best-cosplay-photographer",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-photography",
    scope: G,
    description:
      "They make costumes legendary. The world's best cosplay photographers.",
    tags: ["cosplay", "photography"],
  },
  {
    title: "Best Cosplay Video Creator",
    slug: "best-cosplay-video-creator",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-creators",
    scope: G,
    description:
      "Transitions, skits and cinematics. The best cosplay video creators online.",
    tags: ["cosplay", "video", "tiktok", "creators"],
  },
  {
    title: "Best Cosplay Performance",
    slug: "best-cosplay-performance",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-performance",
    scope: G,
    description:
      "It's not just the costume — it's the act. The best cosplay stage performances.",
    tags: ["cosplay", "performance", "stage"],
  },
  {
    title: "Best Convention Look",
    slug: "best-convention-look",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-performance",
    scope: G,
    description:
      "Stealing the show on the con floor. The most unforgettable convention looks.",
    tags: ["cosplay", "convention", "look"],
  },
  {
    title: "Best MCM London Cosplay",
    slug: "best-mcm-london-cosplay",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-performance",
    scope: "city",
    city: "London",
    country: "United Kingdom",
    description:
      "The best of MCM London Comic Con. Vote for the standout cosplay from London's biggest pop culture weekend.",
    tags: ["cosplay", "mcm", "london", "convention"],
  },
  {
    title: "Most Creative Cosplay",
    slug: "most-creative-cosplay",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-costume",
    scope: G,
    description:
      "Nobody else would have thought of that. The most wildly creative cosplays ever made.",
    tags: ["cosplay", "creative", "costume"],
  },
  {
    title: "Most Accurate Cosplay",
    slug: "most-accurate-cosplay",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-costume",
    scope: G,
    description:
      "Pixel-perfect. The cosplays so accurate they look ripped from the source.",
    tags: ["cosplay", "accurate", "costume"],
  },
  {
    title: "Most Unexpected Cosplay",
    slug: "most-unexpected-cosplay",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-costume",
    scope: G,
    description:
      "Wait — that's a cosplay?! The most surprising and unexpected cosplay concepts.",
    tags: ["cosplay", "unexpected", "creative"],
  },
  {
    title: "Funniest Cosplay Creator",
    slug: "funniest-cosplay-creator",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-creators",
    scope: G,
    description:
      "Comedy in costume. The funniest cosplay creators on the internet.",
    tags: ["cosplay", "funny", "comedy", "creators"],
  },
  {
    title: "Cosplayer With the Most Aura",
    slug: "cosplayer-most-aura",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-creators",
    scope: G,
    description:
      "Commanding every room they enter. The cosplayer with the most undeniable aura.",
    tags: ["cosplay", "aura", "creators"],
  },
  {
    title: "London Cosplay Creator of the Year 2026",
    slug: "london-cosplay-creator-of-the-year-2026",
    categorySlug: "cosplay",
    subcategorySlug: "cosplay-creators",
    scope: "city",
    city: "London",
    country: "United Kingdom",
    description:
      "London's cosplay crown for 2026. Vote for the capital's creator of the year.",
    tags: ["cosplay", "london", "2026", "creators"],
  },

  // ====================== CREATOR BRIDGE (14) ======================
  {
    title: "Best Anime Content Creator",
    slug: "best-anime-content-creator",
    categorySlug: "digital-creators",
    subcategorySlug: "digital-creators-anime",
    scope: G,
    description:
      "The voices of anime fandom. Celebrating the best anime content creators across every platform.",
    tags: ["creators", "anime", "content"],
  },
  {
    title: "Anime TikTok Creator to Watch",
    slug: "anime-tiktok-creator-to-watch",
    categorySlug: "digital-creators",
    subcategorySlug: "digital-creators-tiktok",
    scope: G,
    description:
      "Your FYP's anime corner. The TikTok creators making the best anime content right now.",
    tags: ["creators", "anime", "tiktok"],
  },
  {
    title: "Best Anime YouTuber",
    slug: "best-anime-youtuber",
    categorySlug: "digital-creators",
    subcategorySlug: "digital-creators-youtube",
    scope: G,
    description:
      "Essays, reviews and deep dives. The best anime YouTubers on the platform.",
    tags: ["creators", "anime", "youtube"],
  },
  {
    title: "Best Anime Video Editor",
    slug: "best-anime-video-editor",
    categorySlug: "digital-creators",
    subcategorySlug: "digital-creators-video-editors",
    scope: G,
    description:
      "AMVs and edits that give you chills. The best anime video editors online.",
    tags: ["creators", "anime", "editing", "amv"],
  },
  {
    title: "Best Anime Fan Artist",
    slug: "best-anime-fan-artist",
    categorySlug: "digital-creators",
    subcategorySlug: "digital-creators-fan-artists",
    scope: G,
    description:
      "Fandom's illustrators. Celebrating the best anime fan artists and their work.",
    tags: ["creators", "anime", "fan art", "artists"],
  },
  {
    title: "Best Manga Reviewer",
    slug: "best-manga-reviewer",
    categorySlug: "digital-creators",
    subcategorySlug: "digital-creators-manga",
    scope: G,
    description:
      "They read so you know what to read. The most trusted manga reviewers online.",
    tags: ["creators", "manga", "reviews"],
  },
  {
    title: "Manga Creator to Watch",
    slug: "manga-creator-to-watch",
    categorySlug: "digital-creators",
    subcategorySlug: "digital-creators-manga",
    scope: G,
    description:
      "Rising voices in manga fandom. The manga creators you should be following.",
    tags: ["creators", "manga", "rising"],
  },
  {
    title: "Gaming Creator to Watch",
    slug: "gaming-creator-to-watch",
    categorySlug: "digital-creators",
    subcategorySlug: "digital-creators-gaming",
    scope: G,
    description:
      "Next up in gaming content. The gaming creators about to blow up.",
    tags: ["creators", "gaming", "rising"],
  },
  {
    title: "Best Gaming Streamer",
    slug: "best-gaming-streamer",
    categorySlug: "digital-creators",
    subcategorySlug: "digital-creators-streamers",
    scope: G,
    description:
      "Live and legendary. The best gaming streamers to watch right now.",
    tags: ["creators", "gaming", "streamers", "twitch"],
  },
  {
    title: "Best Gaming TikTok Creator",
    slug: "best-gaming-tiktok-creator",
    categorySlug: "digital-creators",
    subcategorySlug: "digital-creators-tiktok",
    scope: G,
    description:
      "Gaming's short-form stars. The best gaming creators on TikTok.",
    tags: ["creators", "gaming", "tiktok"],
  },
  {
    title: "Rising VTuber",
    slug: "rising-vtuber",
    categorySlug: "digital-creators",
    subcategorySlug: "digital-creators-vtubers",
    scope: G,
    description:
      "New models, new legends. The VTubers on the rise that you need to know.",
    tags: ["creators", "vtuber", "rising"],
  },
  {
    title: "Best Cosplay Creator",
    slug: "best-cosplay-creator",
    categorySlug: "digital-creators",
    subcategorySlug: "digital-creators-cosplay",
    scope: G,
    description:
      "Cosplay's content stars. The creators taking cosplay beyond the convention floor.",
    tags: ["creators", "cosplay"],
  },
  {
    title: "Best Cosplay Photographer",
    slug: "best-cosplay-photographer-creator",
    categorySlug: "digital-creators",
    subcategorySlug: "digital-creators-cosplay",
    scope: G,
    description:
      "The creators behind the lens. Celebrating cosplay photographers as digital creators.",
    tags: ["creators", "cosplay", "photography"],
  },
  {
    title: "Best Cosplay Video Creator",
    slug: "best-cosplay-video-creator-creator",
    categorySlug: "digital-creators",
    subcategorySlug: "digital-creators-cosplay",
    scope: G,
    description:
      "Cosplay in motion. The video creators redefining what cosplay content can be.",
    tags: ["creators", "cosplay", "video"],
  },
];

export const REQUIRED_RANKING_TITLES = new Set(
  REQUIRED_RANKINGS.map((r) => r.title)
);

export const REQUIRED_RANKING_SLUGS = REQUIRED_RANKINGS.map((r) => r.slug);
