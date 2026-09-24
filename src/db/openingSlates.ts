import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { findUserByEmail, createUser } from "./users";
import { findRankingBySlug } from "./rankings";
import { createProfile, findNomineeByRankingAndName, setNomineePhotoIfEmpty } from "./profiles";
import { recordAuditLog, AUDIT_ACTIONS } from "./auditLog";

// -----------------------------------------------------------------------
// Official opening slates: the first Nominees in the cold-start Rankings,
// placed by the RepHear Team before any real users arrive.
//
// WHY: an empty Ranking has no gunpowder. Every slate below is built as
// 3-4 natural rivals — same competition, same circuit, same claim to a
// crown — so rivalry exists from day one. Every name is real and was
// verified against public sources (social profiles, press, event
// results) before being listed here. No private beefs are claimed:
// where the competitive link is structural (shared competitions,
// awards circuits, public claim-wars, club tribalism) the bio says so.
//
// WHAT IT DOES NOT DO: no photos (portrait use waits for the claim
// flow, which is the consent gate), no Likes, no Support/credit
// records, no claims, no invitations. Bios cite only publicly
// documented facts — competition results, showcases, residencies,
// press coverage.
//
// IDEMPOTENCY: each Nominee is looked up by (ranking, name) before
// creation, so running seedOpeningSlates() any number of times —
// automatically on every app start via ensureMigrated(), same as every
// other seed step in schema.ts — creates each Nominee at most once.
// NOTE: because this runs on every start, deleting a preset Nominee
// via admin will resurrect it on the next start unless it is also
// removed from SLATES below.
//
// ATTRIBUTION: added_by references the "RepHear Team" service account
// (team@rephear.com), created on first run and reused afterwards.
// -----------------------------------------------------------------------
const SYSTEM_ACCOUNT_EMAIL = "team@rephear.com";
const SYSTEM_ACCOUNT_NAME = "RepHear Team";

interface NomineeSeed {
  name: string;
  bio: string;
  photoUrl?: string;
}

interface SlateSeed {
  rankingSlug: string;
  nominees: NomineeSeed[];
}

const SLATES: SlateSeed[] = [
  // ---------------------------------------------------------------
  // K-pop: uni-vs-uni and champion-vs-runner-up
  // ---------------------------------------------------------------
  {
    rankingSlug: "best-kpop-dance-crew-london-2026",
    nominees: [
      {
        name: "UCL K-Pop Society",
        bio: "University College London's K-pop dance society — girl-group, boy-group and wildcard teams competing against 15+ UK universities, with term showcases at the Bloomsbury Theatre.",
      },
      {
        name: "Imperial K Pop Society",
        bio: "Imperial College's K-pop dance team ICarus — 2nd place Girl Group at Steal The Stage 2025, competing on London's inter-uni K-pop circuit against UCL.",
      },
      {
        name: "Dal Segno",
        bio: "1st Place Group Dance at the New Malden K-POP Awards 2025.",
      },
      {
        name: "IVIX",
        bio: "K-pop dance crew — 3rd-place tie in Group Dance at the New Malden K-POP Awards 2025.",
      },
      {
        name: "NV",
        bio: "K-pop dance crew — 3rd-place tie in Group Dance at the New Malden K-POP Awards 2025; 1st Place (Dance) at the 2026 edition.",
      },      {
        name: "AZIZA Dance Crew",
        bio: "London K-pop cover dance crew; one of six dance teams at the 2022 K-Pop World Festival UK Round at Rich Mix, London, organised by the Korean Cultural Centre UK.",
      },
      {
        name: "COVE",
        bio: "London and Birmingham K-pop dance team founded in 2022, a troupe of 40+ dancers who travel across the country street dancing and entering competitions (Instagram @projectcove).",
      },
      {
        name: "BKT",
        bio: "London-based non-profit K-pop event organisers founded in 2021 by Katie and Bee; host 1-2 Random Play Dances in London per month and ran the RPD at MCM Comic Con London.",
      },
      {
        name: "LVL19",
        bio: "London K-pop cover crew; a dance team at the 2022 K-Pop World Festival UK Round at Rich Mix, London (KCCUK), still posting London one-take covers (Instagram @lvl19dance).",
      },
      {
        name: "44city",
        bio: "London K-pop dance cover group posting weekly one-take K-pop covers filmed in public across London (Instagram @_44city, TikTok @44c1ty).",
      },
      {
        name: "UJJN",
        bio: "Long-running London K-pop dance crew; performed at the KBS K-POP World Festival prelims at the 2017 London Korean Festival and again at the 2022 K-Pop World Festival UK Round at Rich Mix.",
      },
      {
        name: "CYPHX",
        bio: "London-based K-pop dance cover group filming K-pop in public covers around London (YouTube: \"We are CYPHX, a London based dance cover group\").",
      },
      {
        name: "KVLT Dance Crew",
        bio: "London K-pop cover crew posting K-pop in public dance covers filmed in London (Instagram @the__kvlt).",
      },
      {
        name: "KMDC",
        bio: "London K-pop dance classes and community running since 2018, with studios in Marylebone, Elephant & Castle and The Place; describe themselves as one of London's largest K-pop dance communities.",
      },
      {
        name: "YDA DANCE",
        bio: "Semi-finalist in the dance category at the 3rd New Malden K-POP Awards 2026 in London (28 August 2026).",
      },

    ],
  },
  // ---------------------------------------------------------------
  // Underground DJs: same new-wave circuit, old-vs-new school
  // ---------------------------------------------------------------
  {
    rankingSlug: "most-popular-uk-garage-dj-london-2026",
    nominees: [
      {
        name: "Higgo",
        bio: "London UK garage DJ/producer — 'Pretty Little Raver' (EA Sports FC 24), Radio 1 and Kiss FM airplay, Printworks and Ministry of Sound headline sets.",
      },
      {
        name: "Conducta",
        bio: "UK garage's pace-setter — producer of AJ Tracey's 'Ladbroke Grove', ran London's Kiwi Rekords 2019–2024. The benchmark the new wave is chasing.",
      },
      {
        name: "Riria",
        bio: "Tokyo-born, London-based — Rinse FM resident, viral Boiler Room set, Mixmag Top Breakthrough DJ 2025, bridging UK garage and amapiano.",
      },      {
        name: "DJ EZ",
        bio: "Tottenham-born UK garage DJ — long-running Kiss 100 show, mixed the 2m-copy-selling Pure Garage series and Fabriclive 71, Boiler Room sets watched by millions.",
      },
      {
        name: "Sammy Virji",
        bio: "London-born UK garage DJ/producer — 'If U Need It' (UK chart hit), DJ Mag Best Producer 2025, early releases on Conducta's Kiwi Rekords.",
      },
      {
        name: "MJ Cole",
        bio: "London producer/DJ — 'Sincere' single and Mercury Prize-nominated Sincere album (2000), MOBO Best Producer 2001, remixes for Mariah Carey and Amy Winehouse.",
      },
      {
        name: "Wookie",
        bio: "UK garage producer/DJ (Jason Chue) — 'Battle' (UK Top 10, 2000), remixes for Sia, Disclosure and Jessie J, cited as an influence by Disclosure and Conducta.",
      },
      {
        name: "El-B",
        bio: "South London producer/DJ (Lewis Beadle) — dark 2-step garage on his Ghost Recordings label, co-founder of Groove Chronicles, cited by Burial as a key influence and seen as a dubstep pioneer.",
      },
      {
        name: "Zed Bias",
        bio: "Producer/DJ (Dave Jones), Manchester-based — 'Neighbourhood' (UK #25, 2000), Maddslinky and Phuturistix aliases, MOBO Best Garage Act nominee 2001.",
      },
      {
        name: "Interplanetary Criminal",
        bio: "Manchester-based UK garage DJ/producer (Zach Bruce) — 'B.O.T.A. (Baddest of Them All)' with Eliza Rose (UK #1, 2022), co-founder of ATW Records, DJ Mag Best DJ 2025.",
      },
      {
        name: "Flava D",
        bio: "Bournemouth-born UK garage/bassline producer and DJ (Danielle Gooding) — 'Hold On', Fabriclive 88, six-month BBC Radio 1 residency and XOYO residency.",
      },
      {
        name: "MPH",
        bio: "Canterbury-born UK garage producer/DJ (Myles Fairbairn) — releases on Night Bass, support from Skream, Disclosure and Chris Lake, Calvin Harris remix.",
      },
      {
        name: "Oppidan",
        bio: "North London-born, Bristol-based UK garage DJ/producer (Isobel Fielding) — 'Armed & Dangerous' (ft. Cutty Ranks), Night Bass and UKF releases, DJ Mag Breakthrough Producer nominee 2023.",
      },
      {
        name: "Oneman",
        bio: "Streatham, London DJ (Steven Bishop) — Rinse FM regular since 2006, two Fabriclive mix albums, sets blending UK garage with grime, dubstep and UK funky.",
      },
      {
        name: "Preditah",
        bio: "Birmingham garage/grime producer and DJ (Nathan Gerald) — Fabriclive 92, Boiler Room sets, Radio 1 support for 'Selecta' (2015).",
      },

    ],
  },
  {
    rankingSlug: "most-popular-jungle-dj-london-2026",
    nominees: [
      {
        name: "Tim Reaper",
        bio: "London-born jungle producer/DJ — runs Future Retro London (DJ Mag Breakthrough Label 2021), NTS show, the new wave's vital talent.",
      },
      {
        name: "SHERELLE",
        bio: "Walthamstow-born 160bpm+ selector — viral Boiler Room, DJ Mag Best British DJ 2020, BBC 6 Music resident. Shared the HERE at Outernet 2025 bill with Tim Reaper.",
      },      {
        name: "Nia Archives",
        bio: "Yorkshire jungle DJ/producer — 'Silence Is Loud' debut album (2024), first jungle artist to earn three BRIT Award nominations.",
      },
      {
        name: "Sully",
        bio: "Norwich producer and DJ — intricate drum programming and murky soundscapes fusing jungle with UK garage and dubstep, releases on Keysound and Astrophonica.",
      },
      {
        name: "Double O",
        bio: "London-based jungle DJ/producer (David Henry) — co-founder of the Rupture night and label (since 2006), 25+ year selector, 2025 debut album Firm Meditation.",
      },
      {
        name: "4am Kru",
        bio: "London jungle collective — energetic rave-driven productions on influential underground labels, a busy post-lockdown touring schedule.",
      },
      {
        name: "Samurai Breaks",
        bio: "Leeds jungle/bass producer — releases on Hooversound and Rua Sound, dynamic live sets fusing jungle with footwork.",
      },
      {
        name: "Dillinja",
        bio: "Brixton jungle/drum & bass DJ/producer (Karl Francis) — Valve Recordings label and sound system with Lemon D, 'Twist Em Out' (UK #35, 2003).",
      },
      {
        name: "Goldie",
        bio: "West Midlands-born jungle pioneer (Clifford Price) — co-founded Metalheadz (1994), 'Timeless' album (UK #7, 1995), MBE 2016.",
      },
      {
        name: "DJ Hype",
        bio: "London jungle DJ/producer (Kevin Ford) — represented England at the 1989 DMCs, Kiss 100 and Fantasy FM shows, Ganja Records/True Playaz label boss.",
      },
      {
        name: "Fabio",
        bio: "Brixton DJ (Fitzroy Heslop) — Rage residency at Heaven with Grooverider, Kiss 100 and BBC Radio 1 shows, now Rinse FM residency.",
      },
      {
        name: "Grooverider",
        bio: "Jungle/drum & bass DJ/producer — Rage at Heaven with Fabio, BBC Radio 1 show, Prototype label, MOBO for 'Mysteries of Funk'.",
      },
      {
        name: "Dead Man's Chest",
        bio: "Bristol-based producer/DJ (Alex Eveson) — Western Lore label boss, 'Lore Sessions' residency on Kool FM/Rinse, named a leader of the 2010s jungle revival.",
      },
      {
        name: "Mantra",
        bio: "London jungle DJ/producer (Indi Khera) — co-founder of the Rupture night and label (since 2006), releases on Ilian Tape and Future Retro London.",
      },

    ],
  },
  // ---------------------------------------------------------------
  // Club nights & venues: genuine claim-wars and north/south flags
  // ---------------------------------------------------------------
  {
    rankingSlug: "best-underground-party-london-2026",
    nominees: [
      {
        name: "Jungle Cakes",
        bio: "Ed Solo & Deekline's flagship jungle night — XOYO 360° takeover, Brixton Jamm. One of London's two defining jungle parties.",
      },
      {
        name: "London Something",
        bio: "DJ Ron's jungle night at EartH Kitchen Hackney — booking the veteran guard: Aries, Breakage, Brockie.",
      },
      {
        name: "AMAPIANOLAND",
        bio: "Calls itself London's #1 Amapiano & Afrobeats party — sold-out OUTERNET, Studio 338 and Boxpark Croydon.",
      },
      {
        name: "Invasion Parties",
        bio: "Calls AFROLIFE London's biggest amapiano & afrohouse party (1000+ ravers) — Steel Yard, E1, Scala. The public claim-war with AMAPIANOLAND is real.",
      },      {
        name: "Rupture",
        bio: "Mantra & Double O's jungle and drum & bass night, running since 2006. Home of the Rupture label; a book celebrating its 20 years, We Are Rupture, arrives November 2026.",
      },
      {
        name: "Horse Meat Disco",
        bio: "Weekly Sunday queer disco party at The Eagle, Vauxhall, since New Year's Day 2004. Residents James Hillard, Jim Stanton, Severino and Luke Howard; a Glastonbury fixture with international residencies.",
      },
      {
        name: "The Doctor's Orders",
        bio: "Spin Doctor's hip-hop party running since 2005; the UK's longest-running hip-hop night. Celebrated its 20th birthday at Electric Brixton in June 2025 with 9th Wonder and The Beatnuts.",
      },
      {
        name: "Metalheadz",
        bio: "Goldie's drum & bass institution; the 90s Blue Note Sessions nights helped shape the genre. Marked 30 years of Platinum Breakz at Electric Brixton in April 2026.",
      },
      {
        name: "Garage Nation",
        bio: "UK garage institution from the late 90s, still running with residents DJ Luck & MC Neat. Plays a Halloween daytime session at Ministry of Sound in October 2026.",
      },
      {
        name: "Blackout Club",
        bio: "Weekly Friday indie/rock/alternative club night at The Underworld, Camden. Guest DJs plus drinks deals; still running every Friday in 2026.",
      },
      {
        name: "Clockwork Orange",
        bio: "90s house classics institution. Returns to Ministry of Sound in November 2026 with Fat Tony, Graeme Park, Alistair Whitehead and Grant Nelson.",
      },
      {
        name: "Louder",
        bio: "Ministry of Sound's drum & bass night; Andy C returned after 10 years at the club's 35th birthday in October 2026. Lilly Palmer plays in November 2026.",
      },
      {
        name: "Glitterbox",
        bio: "Defected's disco and house party with dancers, drags and live PA guests. London dates at Ministry of Sound and a New Year's Day 2026 day party at KOKO, after a 23-week Hï Ibiza season.",
      },
      {
        name: "Pxssy Palace",
        bio: "Queer techno night launched in 2014, centring queer, trans, intersex people of colour. Plays E1 and fabric; presented a Halloween daytime party at fabric London in October 2026.",
      },
      {
        name: "Central",
        bio: "Underground house party launched in 2022 with residents Checketts & Chapman. Reached Village Underground, Shoreditch, for its biggest night yet on 25 September 2026.",
      },

    ],
  },
  {
    rankingSlug: "best-small-music-venue-london-2026",
    nominees: [
      {
        name: "The Windmill Brixton",
        bio: "150-cap Brixton grassroots flagship — 22 Blenheim Gardens. The south London institution every band has played.",
      },
      {
        name: "The Shacklewell Arms",
        bio: "200-cap Dalston grassroots flagship — the east London answer to the Windmill.",
      },
      {
        name: "EartH Kitchen",
        bio: "The small room in Hackney's EartH complex — home of London Something's jungle nights.",
      },      {
        name: "The Lexington",
        bio: "200-cap indie room above a pub in Islington. One of London's most respected guitar-music venues since 2009.",
      },
      {
        name: "The Sebright Arms",
        bio: "120-150-cap basement gig room at 31-35 Coate Street, Hackney. Emerging indie, punk and rock in a wood-panelled East London basement.",
      },
      {
        name: "The Bedford",
        bio: "250-cap music club inside a Grade II-listed Balham pub, 77 Bedford Hill. Early gigs by The Clash and U2; Ed Sheeran's Live at the Bedford launchpad.",
      },
      {
        name: "The Half Moon",
        bio: "200-cap back-room venue on Lower Richmond Road, Putney, hosting live music since 1963. The Rolling Stones and U2 have played; eclectic rock, blues and folk programming.",
      },
      {
        name: "Omeara",
        bio: "320-cap basement venue under London Bridge, opened 2016 and co-owned by Mumford & Sons' Ben Lovett. Around 200 events a year, known for breaking new acts.",
      },
      {
        name: "Barfly Camden",
        bio: "200-cap live room above a bar on Chalk Farm Road; the Barfly (1996-2016) reopened under its original name in June 2026. Frank Turner reopened it - he played his first sold-out solo show there in 2006.",
      },
      {
        name: "Servant Jazz Quarters",
        bio: "80-100-cap basement at 10A Bradbury Street, Dalston, open since February 2011. Eclectic programming from jazz to pop; Sun Ra Arkestra, Moses Boyd and Laura Mvula have played.",
      },
      {
        name: "The Slaughtered Lamb",
        bio: "Candlelit ~100-cap basement at 34-35 Great Sutton Street, Clerkenwell. Folk and acoustic gigs on weeknights, DJs on Fridays; a favourite EP and album launch room.",
      },
      {
        name: "MAP café",
        bio: "80-cap basement room in Camden (feels busy at 50). Cosy intimate room for singer-songwriter shows.",
      },
      {
        name: "The Workshop, Star Inn",
        bio: "70-cap underground room near Old Street station. A first-London-show room for new bands.",
      },
      {
        name: "Ton of Brix",
        bio: "90-100-cap room in central Brixton with a large stage, plants and mirrors. Intimate seated or standing shows.",
      },

    ],
  },
  // ---------------------------------------------------------------
  // University societies: four documented UCL-vs-KCL/Imperial pairs
  // ---------------------------------------------------------------
  {
    rankingSlug: "best-university-society-london-2026",
    nominees: [
      {
        name: "UCL K-Pop Society",
        bio: "UCL's K-pop dance society — competing against 15+ universities on the national inter-uni K-pop circuit, term showcases at the Bloomsbury Theatre.",
      },
      {
        name: "Imperial K Pop Society",
        bio: "Imperial's K-pop society (dance team ICarus) — Steal The Stage 2025 podium, UCL's direct rival on the inter-uni circuit.",
      },
      {
        name: "UCL Dance Society",
        bio: "7 shows a year including the annual Bloomsbury Theatre show — 34 trophies at Kingsnation '26, and hosts its own inter-uni competition TranscenDance.",
      },
      {
        name: "KCL Dance Society",
        bio: "King's dance society (competition team Fusion) — 150+ dancers, hosts Just Dance It, the inter-uni competition UCL and Imperial travel to compete at.",
      },
      {
        name: "UCL African Caribbean Society",
        bio: "UCL's flagship ACS — competing with KCL on London's ACS awards and showcase circuit.",
      },
      {
        name: "KCL African and Caribbean Society",
        bio: "King's ACS — consecutive 'ACS of the Year' awards and the annual two-night Culture Shock showcase.",
      },
      {
        name: "UCL Electronic Music Society",
        bio: "Home for UCL's DJs, producers and two-steppers — tutorials, open decks and club takeovers.",
      },
      {
        name: "KCL DJ Society",
        bio: "King's DJ society — 300-capacity Platforms nights at Corsica Studios. The student club-night crown rival to UCL's electronic music society.",
      },      {
        name: "Imperial African Caribbean Society",
        bio: "Imperial's African Caribbean Society (ICACS), founded in 1998 — runs an inter-university boat party with other London ACS societies and co-hosts Black Ascent, the flagship careers event, with LSE ACS.",
      },
      {
        name: "KCL United Nations Association",
        bio: "King's Model UN society (KCLUNA) — 100+ members, 8 international delegations, 23 awards in a single season; took 'Best Middle-Sized Delegation' at London International MUN against 1,500+ delegates.",
      },
      {
        name: "UCL Indian Dance Society",
        bio: "UCL's Indian dance society — fields a competition team for Just Bollywood, the national inter-university Bollywood dance competition, taking 1st place in the Imperial-hosted edition; teaches Bollywood, Kathak and Bharatanatyam.",
      },
      {
        name: "UCL Film & TV Society",
        bio: "Runs the award-winning Festival of the Moving Image at the Bloomsbury Theatre — an 18-edition student film festival screening almost 100 films a year; Christopher Nolan was its president.",
      },
      {
        name: "LSESU African & Caribbean Society",
        bio: "LSE's African & Caribbean Society — hosts the Ablaze annual showcase, the Summer Shutdown and the end-of-year ACS Spring Ball, and co-hosts Black Ascent, the flagship careers event, with Imperial.",
      },

    ],
  },
  // ---------------------------------------------------------------
  // Underground rap: cypher-mates and mixtape-mates
  // ---------------------------------------------------------------
  {
    rankingSlug: "hottest-upcoming-rapper-london-2026",
    nominees: [
      {
        name: "Cristale",
        bio: "South London — viral 'Bong Bing' with Laa Lee, MOBO Best Newcomer nominee, broke through a freestyle over Drake & Headie One's 'Only You'.",
      },
      {
        name: "Kibo",
        bio: "Harrow — went bar-for-bar with Dave and Central Cee in the 2023 Victory Lap cypher; Dave co-signed him on camera.",
      },
      {
        name: "Rushy",
        bio: "West London — GRM Daily premiered 'LDN'; same Victory Lap cypher as Kibo. The documented head-to-head.",
      },
      {
        name: "Fimiguerrero",
        bio: "London underground — featured on Jim Legxacy's XL Recordings mixtape 'black british music', part of the Plaqueboymax-streamed new-gen circle.",
      },      {
        name: "Knucks",
        bio: "Kilburn — rapper-producer behind the debut album Alpha Place (featuring Stormzy) and the BPI Platinum single 'Los Pollos Hermanos'; MOBO-nominated, followed his 2020 London Class EP with breakout success.",
      },
      {
        name: "AntsLive",
        bio: "North London — broke through with the viral 'Number One Candidate' video shot on horseback in the Dolomites; named on Amazon Music's Breakthrough UK: Artists to Watch 2024.",
      },
      {
        name: "Lancey Foux",
        bio: "Stratford — East London MC with Skepta co-signs (joined Skepta's SK Level Europe tour); released the 2021 mixtapes First Degree and Live.Evil, then 2026's First Degree: 2nd Charge.",
      },
      {
        name: "Clavish",
        bio: "Stamford Hill — MOBO-nominated rapper (Best Newcomer 2022, later Best Hip Hop Act) who headlined two nights at Islington Academy.",
      },
      {
        name: "Kwengface",
        bio: "Peckham — MOBO Best Drill Act nominee; featured on Knucks' Alpha Place ('Lucious') and a key voice in the YP drill wave.",
      },
      {
        name: "Jawnino",
        bio: "London — underground MC who appeared on two Victory Lap cyphers, the Frost County link-up and the PinkPantheress session covered by GRM Daily.",
      },
      {
        name: "YT",
        bio: "London — jerk-rap breakout from Victory Lap's LAUZZA birthday cypher, dubbed a 'jerk rap-reinventer' by Dazed; 2026 MOBO Best Newcomer nominee.",
      },
      {
        name: "Jim Legxacy",
        bio: "South London — won 2026 MOBO Best Male Act and was a BRIT Best New Artist nominee, off the back of his 2023 breakout mixtape homeless nigga pop music; co-produced Dave and Central Cee's 'Sprinter'.",
      },
      {
        name: "Ashbeck",
        bio: "London — released the collaborative Rush Hour EP with Rushy and appeared on multiple Victory Lap cyphers; Dazed named him a chill-rap pioneer of the underground.",
      },
      {
        name: "Finessekid",
        bio: "London — featured on the Victory Lap cypher alongside Blanco, M'way and Ashbeck (GRM Daily); 2026 MOBO Best Newcomer nominee.",
      },

    ],
  },
  {
    rankingSlug: "best-freestyle-rapper-london-2026",
    nominees: [
      {
        name: "Kibo",
        bio: "Harrow — 'made freestyle rap his bread and butter' (NME). The anchor of this category.",
      },
      {
        name: "Cristale",
        bio: "South London — broke through a viral freestyle; MOBO Best Newcomer nominee.",
      },
      {
        name: "Rushy",
        bio: "West London — cypher-circuit rapper, same Victory Lap cypher as Kibo.",
      },
      {
        name: "Sinn6r",
        bio: "South-east London — militant bar-heavy style, new project 'Federal' (Nov 2025), Victory Lap studio regular.",
      },      {
        name: "Len",
        bio: "Harrow — went bar-for-bar with Dave and Central Cee in the 2023 Victory Lap cypher; co-released the Conglomerate mixtape with Lancey Foux and Fimiguerrero, which hit UK Albums #23.",
      },
      {
        name: "Big Zuu",
        bio: "West London — two-time Fire in the Booth guest via Charlie Sloth; built his reputation on radio sets alongside AJ Tracey before his TV presenting career.",
      },
      {
        name: "Ghetts",
        bio: "Newham — grime pioneer from N.A.S.T.Y Crew whose 2008 Freedom of Speech mixtape showcased his rapid-fire radio-set flow.",
      },
      {
        name: "BXKS",
        bio: "Luton — went bar-for-bar with Dave and Central Cee in the 2023 Victory Lap cypher; Dazed called her one of the best rappers of the new generation off her 2024 project One Time.",
      },
      {
        name: "kwes e",
        bio: "London — appeared on two Victory Lap cyphers: the PinkPantheress session covered by GRM Daily and the LAUZZA birthday cypher.",
      },
      {
        name: "Kirbs",
        bio: "London — went bar-for-bar with Dave and Central Cee in the 2023 Victory Lap cypher; performed 'Back to Business' at Victory Lap's live show at END. London.",
      },
      {
        name: "Dexter",
        bio: "London — freestyled in the Victory Lap PinkPantheress cypher alongside Niko B and Jawnino, covered by GRM Daily.",
      },
      {
        name: "Natanya",
        bio: "London — freestyled in the Victory Lap PinkPantheress cypher alongside Niko B and Jawnino, covered by GRM Daily.",
      },
      {
        name: "iKeda",
        bio: "London — opened the Victory Lap PinkPantheress cypher, covered by GRM Daily.",
      },
      {
        name: "maZz",
        bio: "London — freestyled in the Victory Lap PinkPantheress cypher alongside Niko B and Jawnino, covered by GRM Daily.",
      },
      {
        name: "JME",
        bio: "Tottenham — Boy Better Know veteran of classic pirate-radio sets (Heat FM's Meridian Crew, Rinse FM); delivered a GRM Daily Invite Only freestyle in 2026.",
      },

    ],
  },
  // ---------------------------------------------------------------
  // Cosplay: MCM London 2025's documented standouts
  // ---------------------------------------------------------------
  {
    rankingSlug: "best-anime-transformation-london-2026",
    nominees: [
      {
        name: "Rose Magpie",
        bio: "UK cosplayer (@rosemagpie) — Insomnia 69 Cosplay Championship 2022 winner, official cosplay judge at Heroes Dutch Comic Con, MCM London panel guest.",
      },
      {
        name: "Maria Jodicke",
        bio: "Cosplayer (@mariajodicke) — MCM London Comic Con 2025 standout, Radio Times-documented costume craft (the Dalek dress).",
      },
      {
        name: "MossyPyramidHead",
        bio: "Cosplayer (@MossyPyramidHead) — MCM London 2025, floral Pyramid Head × Overwatch Bastion fusion, Radio Times-documented.",
      },
      {
        name: "trashnim_",
        bio: "Cosplayer (@trashnim_) — MCM London 2025 Pinhead horror transformation, Radio Times-documented. The horror counterpart to MossyPyramidHead.",
      },      {
        name: "Jazzichan",
        bio: "Selected as the UK's representative for the 2024 World Cosplay Championship at MCM London Comic Con in October 2023.",
      },
      {
        name: "Hwanni",
        bio: "Selected alongside Jazzichan as the UK's representative for the 2024 World Cosplay Championship at MCM London Comic Con in October 2023.",
      },
      {
        name: "Tsupo",
        bio: "UK cosplayer who, with Clood, won the 2023 World Cosplay Championship grand prize with costumes from the anime Magi: The Labyrinth of Magic.",
      },
      {
        name: "Clood",
        bio: "UK cosplayer who, with Tsupo, won the 2023 World Cosplay Championship grand prize with costumes from the anime Magi: The Labyrinth of Magic.",
      },
      {
        name: "Richard von Wild",
        bio: "Listed as a cosplay guest at HYPER JAPAN 2025 in London.",
      },
      {
        name: "TheSparkofRevolution",
        bio: "One half of the UK cosplay duo Sparkie & Ceres, named a cosplay guest at HYPER JAPAN Manchester 2025.",
      },
      {
        name: "Cereselcosplay",
        bio: "One half of the UK cosplay duo Sparkie & Ceres, named a cosplay guest at HYPER JAPAN Manchester 2025.",
      },
      {
        name: "GayPanic Cosplay",
        bio: "Cardiff-based cosplayer active since 2016, profiled by Costume and Play in a 2025 interview about a decade in cosplay.",
      },

    ],
  },
  // ---------------------------------------------------------------
  // Football: the one circle with genuine public tribal warfare
  // ---------------------------------------------------------------
  {
    rankingSlug: "best-football-trash-talker-london-2026",
    nominees: [
      {
        name: "Robbie Lyle",
        bio: "Founder of AFTV (1.74M YouTube subscribers) — Arsenal's loudest voice; the channel was born from a 5–2 North London Derby win over Spurs.",
      },
      {
        name: "Troopz",
        bio: "AFTV star and Troopz TV host — known for explosive rants.",
      },
      {
        name: "Rory Jennings",
        bio: "Chelsea YouTuber and talkSPORT presenter — the banter merchant who publicly spars with Arsenal fan media on camera.",
      },
      {
        name: "Chris Cowlin",
        bio: "Spurs Chat — the Tottenham answer to AFTV. North London Derby tribalism as content fuel.",
      },      {
        name: "Ty (Taiwo Ogunlabi)",
        bio: "Arsenal fan-channel host — long-running AFTV regular known for his relentlessly optimistic takes and his defence of Arsène Wenger.",
      },
      {
        name: "Lee Judges",
        bio: "Arsenal fan-channel host — AFTV regular known for his passionate post-match rants; also runs his own channel, Lee Judges TV.",
      },
      {
        name: "White Yardie (Harry Gregory)",
        bio: "Comedian and AFTV regular — the Jamaican-born comic joined the Arsenal fan channel following Troopz's departure in November 2020.",
      },
      {
        name: "Moh",
        bio: "Arsenal fan-channel host — AFTV regular who coined the catchphrase \"Don't talk about spend, talk about net spend\" on the channel.",
      },
      {
        name: "Alex Harris",
        bio: "Chelsea fan-channel host — fronts Chelsea Fan TV, a \"voice of the fans\" channel built on fan cams and reactions outside Stamford Bridge.",
      },
      {
        name: "Nicky Hawkins",
        bio: "West Ham fan-channel host — co-founded West Ham Fan TV in 2014 with Ryan Archer and presents its fan cams and the \"Post Match Pint\" show.",
      },
      {
        name: "Gonzo",
        bio: "West Ham fan-channel host — founder of the Hammers Chat YouTube channel covering West Ham news and reactions.",
      },
      {
        name: "Ben Daniel",
        bio: "Tottenham fan-channel host — co-runs WeAreTottenhamTV with Simeon Daniel, a daily Spurs channel with weekly fan shows.",
      },
      {
        name: "George Achillea",
        bio: "Tottenham fan YouTuber — runs an opinion-driven Spurs channel that has ranked among the biggest independent Spurs fan channels.",
      },

    ],
  },
  {
    rankingSlug: "most-popular-football-club-london-2026",
    nominees: [
      {
        name: "Arsenal FC",
        bio: "North London. The AFTV army votes — but Spurs fans vote against them harder.",
      },
      {
        name: "Tottenham Hotspur",
        bio: "North London. Nobody mobilises a defensive vote like Spurs fans told Arsenal might win.",
      },
      {
        name: "Chelsea FC",
        bio: "West London. Rory Jennings' tribe — Fulham Road pride on the line.",
      },
      {
        name: "West Ham United",
        bio: "East London. London Stadium-era grievances and the loudest away end in the city.",
      },      {
        name: "Crystal Palace",
        bio: "South London club — Premier League, Selhurst Park.",
      },
      {
        name: "Fulham",
        bio: "West London club — Premier League, Craven Cottage.",
      },
      {
        name: "Brentford",
        bio: "West London club — Premier League, Gtech Community Stadium.",
      },
      {
        name: "Queens Park Rangers",
        bio: "West London club — Championship, Loftus Road.",
      },
      {
        name: "Charlton Athletic",
        bio: "South East London club — Championship, The Valley.",
      },
      {
        name: "Millwall",
        bio: "South East London club — Championship, The Den.",
      },
      {
        name: "Leyton Orient",
        bio: "East London club — League One, Brisbane Road.",
      },
      {
        name: "AFC Wimbledon",
        bio: "South West London club — League One, Plough Lane.",
      },
      {
        name: "Bromley",
        bio: "South East London club — League One, Hayes Lane; won the League Two title in 2025-26.",
      },
      {
        name: "Barnet",
        bio: "North London club — League Two, The Hive.",
      },
      {
        name: "Sutton United",
        bio: "South London club — National League, Gander Green Lane.",
      },

    ],
  },
  // ---------------------------------------------------------------
  // Beauty: verified London-based creators, 7 passed / 2 excluded
  // (Julia Lazareva unverifiable; Rei Lilith based in Czech Republic).
  // ---------------------------------------------------------------
  {
    rankingSlug: "most-popular-beauty-creator-london-2026",
    nominees: [
      {
        name: "Abby Roberts",
        bio: "London-based beauty creator — 16.8M TikTok followers, self-taught SFX/transformation MUA, brand collabs with Morphe, Too Faced, Charlotte Tilbury and L'Oréal.",
      },
      {
        name: "Nikki Wolff",
        bio: "London-based makeup artist (@nikki_makeup) — 1.7M+ Instagram followers, KVD Beauty Global Director of Artistry, MUA to Dua Lipa, Zendaya and the Kardashians.",
      },
      {
        name: "Lisa Eldridge",
        bio: "London-based makeup legend — Lancôme global creative director, own makeup line, Vogue covers, NYT bestselling author; clients from Kate Winslet to Taylor Swift.",
      },
      {
        name: "Uche Natori",
        bio: "London-based British-Nigerian beauty creator (@uchjn) — Fashion and Beauty Creator of the Year at the UK & Ireland TikTok Awards.",
      },      {
        name: "Patricia Bright",
        bio: "London-born beauty YouTuber with ~2.86M subscribers; she appeared as a beauty expert on BBC One's The Wheel.",
      },
      {
        name: "Saffron Barker",
        bio: "UK creator who competed on Strictly Come Dancing in 2019; her book topped the Sunday Times bestseller list and she launched a collection with Primark.",
      },
      {
        name: "Fleur De Force",
        bio: "British beauty creator and author of The Glam Guide; she launched a makeup collection with Feelunique and collaborated with MAC and Eylure.",
      },
      {
        name: "Tanya Burr",
        bio: "English YouTuber who began posting makeup and fashion videos in 2009; she launched Tanya Burr Cosmetics with Superdrug in 2014.",
      },
      {
        name: "Estée Lalonde",
        bio: "London-based beauty creator with ~1.14M YouTube subscribers; she published the book Bloom in 2016.",
      },
      {
        name: "Caroline Hirons",
        bio: "London-based aesthetician and skincare creator; her book Skincare won the 2021 British Book Awards Non-Fiction Lifestyle Book of the Year.",
      },
      {
        name: "Sali Hughes",
        bio: "Welsh beauty journalist and broadcaster; Guardian resident beauty columnist and author of Pretty Honest and Pretty Iconic.",
      },
      {
        name: "Sam Chapman",
        bio: "British MUA and beauty creator; co-creator of Pixiwoo and co-founder of Real Techniques, who launched a makeup collection with Beauty Pie.",
      },
      {
        name: "Wayne Goss",
        bio: "English makeup artist and YouTube creator; he created a Japanese-made brush line under his own name.",
      },
      {
        name: "Jess Hunt",
        bio: "British fashion and beauty influencer; she co-founded REFY in 2020, whose Brow Sculpt won the 2021 UK Cosmopolitan Summer Beauty Award.",
      },

    ],
  },
  {
    rankingSlug: "best-makeup-artist-london-2026",
    nominees: [
      {
        name: "Nikki Wolff",
        bio: "London-based makeup artist — KVD Beauty Global Director of Artistry, the red-carpet glow specialist behind Dua Lipa and Zendaya.",
      },
      {
        name: "Lisa Eldridge",
        bio: "London-based editorial MUA — Lancôme global creative director, Vogue covers, the luxury establishment's pick.",
      },
      {
        name: "Kaniz Ali",
        bio: "London-born award-winning MUA (Makeup Artist of the Year 2011/2015/2019) — bridal and Bollywood glam, MUA to Kareena Kapoor Khan and Sonam Kapoor, runs a London makeup academy.",
      },
      {
        name: "Nency Makeup",
        bio: "London-based editorial and bridal MUA (@nencymakeup) — high-fashion meets bridal, viral face-yoga content.",
      },      {
        name: "Charlotte Tilbury",
        bio: "London-born MUA who worked with Kate Moss and Naomi Campbell; she launched her eponymous beauty brand at Selfridges in 2013.",
      },
      {
        name: "Pat McGrath",
        bio: "British MUA and founder of Pat McGrath Labs; she led the creative direction of Louis Vuitton's first cosmetics collection.",
      },
      {
        name: "Isamaya Ffrench",
        bio: "British MUA who developed makeup lines for Tom Ford, Burberry and Byredo; she launched her eponymous brand in 2022.",
      },
      {
        name: "Val Garland",
        bio: "London-based MUA who became L'Oréal Paris's first Global Make-up Director in 2017; she is a judge on BBC's Glow Up.",
      },
      {
        name: "Mary Greenwell",
        bio: "London-based MUA who shot Princess Diana's Vogue covers; she has worked long-term with Chanel and Armani.",
      },
      {
        name: "Ruby Hammer",
        bio: "British MUA and co-founder of Ruby & Millie; she received an MBE for services to the cosmetics industry.",
      },
      {
        name: "Daniel Sandler",
        bio: "London-based international MUA; he founded Daniel Sandler Cosmetics in 2005, known for the Watercolour Liquid Blush.",
      },
      {
        name: "Lan Nguyen-Grealis",
        bio: "London Fashion Week lead MUA and author of Art & Makeup and ProMakeup Design; she has guest-judged BBC's Glow Up.",
      },
      {
        name: "Dominic Skinner",
        bio: "British MUA who joined MAC in 2004 and now serves as Director of Makeup Artistry; he judges BBC's Glow Up.",
      },
      {
        name: "Hannah Martin",
        bio: "British MUA and former Bobbi Brown senior pro artist; she did Princess Eugenie's wedding makeup and has a collection with Ciaté London.",
      },

    ],
  },
  {
    rankingSlug: "best-emerging-beauty-creator-london-2026",
    nominees: [
      {
        name: "Charlotte Roberts",
        bio: "London-based TikTok makeup-transformation star (@charlottelooks) — fantasy and SFX looks with millions of followers.",
      },
      {
        name: "Uche Natori",
        bio: "London-based British-Nigerian creator — UK & Ireland TikTok Awards winner.",
      },      {
        name: "Shania Parris",
        bio: "Winner of series 6 of BBC Three's Glow Up: Britain's Next Make-Up Star (2024); the Coventry MUA has ~190K TikTok followers, where a pointillism dot-work video went viral.",
      },
      {
        name: "Saphron Morgan",
        bio: "Essex MUA and winner of Glow Up series 5 (2023); she launched Saphron Morgan Beauty in 2021 and has since worked with brands including MAC Cosmetics and Sephora.",
      },
      {
        name: "Ella Freer",
        bio: "Runner-up of Glow Up series 6 (2024); the 20-year-old Leicester student built a community of over 100K TikTok followers ahead of the show.",
      },
      {
        name: "Connor McGee",
        bio: "Runner-up of Glow Up series 6 (2024); the Kent beauty manager and dance teacher competed in the show's final.",
      },
      {
        name: "Ailish McBride",
        bio: "Belfast cosmetics student and contestant on Glow Up series 7 (2025); she spoke to BBC Newsbeat about working as a partially colour-blind MUA.",
      },
      {
        name: "Ophelia Liu",
        bio: "London-based MUA and winner of Glow Up series 2 (2020); she has built an audience of ~600K Instagram followers and worked with clients including the English National Ballet.",
      },
      {
        name: "Sophie Baverstock",
        bio: "Winner of Glow Up series 3 (2021); the London-based MUA has gone on to work with MAC Cosmetics.",
      },
      {
        name: "Yong-Chin Breslin",
        bio: "Winner of Glow Up series 4 (2022); the London MUA rose through the BBC Three competition as one of its youngest champions.",
      },
      {
        name: "Danielle Marcan",
        bio: "London-based MUA and creator with ~2M+ Instagram followers; the Romanian-born creator became a Huda Beauty brand ambassador after her beauty tutorials went viral.",
      },
      {
        name: "Sasha Louise Pallari",
        bio: "UK MUA whose #FilterDrop campaign in 2020 pushed the ASA to tighten rules on filtered beauty advertising; she campaigns for transparency in beauty.",
      },
      {
        name: "James Mac Inerney",
        bio: "London-based MUA and runner-up of Glow Up series 2 (2020), where he competed as a retail worker turned makeup artist.",
      },

    ],
  },
  {
    rankingSlug: "best-caribbean-takeaway-london-2026",
    nominees: [
      {
        name: "Fish, Wings & Tings",
        bio: "Fish, Wings & Tings is a Caribbean eatery in Brixton Village, Brixton, serving reggae wings, stew oxtail and creole fish stew.",
      },
      {
        name: "JB's Soulfood",
        bio: "JB's Soulfood is a Caribbean takeaway on Peckham High Street, Peckham, serving jerk chicken, curry goat and patties.",
      },
      {
        name: "Kaieteur Kitchen",
        bio: "Kaieteur Kitchen is a Guyanese kitchen in Elephant & Castle, serving home-cooked Guyanese dishes including pepper pot.",
      },
      {
        name: "Paradise Cove",
        bio: "Paradise Cove is a Caribbean spot on Wandsworth Road, Battersea, serving Jamaican dishes including jerk chicken and curried goat.",
      },
      {
        name: "Ma Petite Jamaica",
        bio: "Ma Petite Jamaica is a Jamaican diner with sites in Camden and Shoreditch, serving jerk chicken and rum cocktails.",
      },
      {
        name: "Limin",
        bio: "Limin is a Caribbean restaurant and beach club on the South Bank, serving jerk chicken and sharing plates.",
      },
      {
        name: "Flavour Boss",
        bio: "Flavour Boss is a Caribbean takeaway in Croydon, London.",
      },
      {
        name: "Jerkiz",
        bio: "Jerkiz is a Jamaican takeaway on Evelina Road in Peckham, serving jerk chicken, curry goat and plantain.",
      },
      {
        name: "Tops Caribbean",
        bio: "Tops Caribbean is a Caribbean and Jamaican takeaway on Queen's Road in Peckham, serving jerk chicken and curry goat.",
      },
      {
        name: "New Tings Grill and Bar",
        bio: "New Tings Grill and Bar is a Caribbean grill on Acre Lane in Brixton, serving jerk chicken and peppered steak.",
      },
      {
        name: "Gabby's Caribbean Takeaway",
        bio: "Gabby's Caribbean Takeaway is a Caribbean takeaway on Lewisham High Street, Lewisham, serving jerk chicken and curry goat.",
      },
      {
        name: "Good Tings Caribbean Grill",
        bio: "Good Tings Caribbean Grill is a Caribbean grill on Tulse Hill, serving jerk chicken, curry goat and oxtail.",
      },
    ],
  },
  {
    rankingSlug: "best-carnival-sound-system-london-2026",
    nominees: [
      {
        name: "Channel One Sound System",
        bio: "Roots and dub sound system listed on the official Carnival site; the 2026 guide places it at Leamington Road Villas.",
      },
      {
        name: "Aba Shanti-I",
        bio: "Heavyweight roots and dub sound system listed on the official Carnival site; the 2026 guide places it at East Row and Southern Row.",
      },
      {
        name: "King Tubby's Sound System",
        bio: "Reggae and dub sound system on Clydesdale Road, named in the 2026 Carnival guide and filmed at the 60th Carnival in August 2026.",
      },
      {
        name: "Saxon Sound",
        bio: "Reggae and dancehall sound system on Chesterton Road, named in the 2026 Carnival guide; the sound that gave Britain Maxi Priest and Smiley Culture.",
      },
      {
        name: "Rampage Sound",
        bio: "Sound system with a long-running Carnival pitch at Colville Square, documented on the official Carnival site.",
      },
      {
        name: "Solution Sound System",
        bio: "Roots sound system documented on the official Carnival site as holding its Carnival pitch since 2012.",
      },
      {
        name: "Mastermind Roadshow",
        bio: "Hip hop, soul and R&B sound system on Canal Close, described in the 2026 guide as one of the longest-running names on the route.",
      },
      {
        name: "Different Strokes",
        bio: "Jungle, drum and bass and hip hop sound system on Lancaster Road, named in the 2026 Carnival guide.",
      },
      {
        name: "Gladdy Wax",
        bio: "Vintage reggae vinyl sound system on Portobello Road near Chesterton Road, named in the 2026 Carnival guide.",
      },
      {
        name: "Rapattack",
        bio: "Hip hop, house, funk and soul sound system on All Saints Road, named in the 2026 Carnival guide.",
      },
      {
        name: "Disya Jeneration",
        bio: "Multi-genre party sound named in the 2026 Carnival guide and filmed on the Carnival Monday 2026 route.",
      },
      {
        name: "Nasty Love",
        bio: "Reggae and bashment sound named in the 2026 Carnival guide and filmed on the Carnival Monday 2026 route.",
      },
      {
        name: "Volcano",
        bio: "Sound system filmed on the Notting Hill Carnival Monday 2026 route walkthrough.",
      },
      {
        name: "Gaz's Rockin' Blues",
        bio: "Ska sound system named in the 2026 Carnival sound-systems guide.",
      },
    ],
  },
  {
    rankingSlug: "best-cosplay-build-video-london-2026",
    nominees: [
      {
        name: "Greig Johnson Making — Red Dwarf blaster build video",
        bio: "UK-based prop maker and YouTuber — his build series documents a scratchbuilt Red Dwarf blaster made from plastic, drainpipe and old toys.",
      },
      {
        name: "Venus Callida — Steampunk Botanist build video",
        bio: "Cosplayer — her YouTube video documents the construction of a Steampunk Botanist cosplay, submitted for the London Comic Con masquerade competition.",
      },
      {
        name: "Shappi Workshop — Vora (Paladins) build tutorial video",
        bio: "Costume maker and cosplay judge — Daily Cosplay documented her Vora (Paladins) costume build tutorial video; her YouTube channel hosts 185 costume and tutorial videos.",
      },
      {
        name: "LittleJem — time-lapse cosplay build videos",
        bio: "UK-based cosplayer and propmaker — posts time-lapse costume creations and build videos on her YouTube channel.",
      },
    ],
  },
  {
    rankingSlug: "best-cosplay-performance-london-2026",
    nominees: [
      {
        name: "Matthew — Leather Armor Hunter (Monster Hunter: World) at MCM Birmingham Comic Con",
        bio: "UK cosplayer — won the Cosplay Central Crown Championships UK qualifier at MCM Birmingham Comic Con in December 2023 with a Monster Hunter: World Leather Armor Hunter costume, then won the 2024 global final.",
      },
      {
        name: "Kerberos Cosplay — Percival de Rolo (Critical Role) at MCM Birmingham Comic Con",
        bio: "UK cosplayer — took second place in the Cosplay Central Crown Championships UK qualifier at MCM Birmingham Comic Con 2023 as Percival de Rolo from Critical Role.",
      },
      {
        name: "The Crystal Wolf — Lagertha (Vikings) at MCM Birmingham Comic Con",
        bio: "UK cosplayer — third place in the Cosplay Central Crown Championships UK qualifier at MCM Birmingham Comic Con 2023 with a handmade Lagertha armour from Vikings.",
      },
      {
        name: "Hwanni & Jazzichan — WCS 2024 Team UK qualifier performance at MCM London Comic Con",
        bio: "UK cosplay duo — won the UK preliminary round for the World Cosplay Championship 2024 at MCM London Comic Con on 28 October 2023.",
      },
      {
        name: "Eleo Cosplay — Grand Champion winning performance at the C3 Cosplay City Championship final 2023",
        bio: "UK cosplayer — Grand Champion of the 2023 C3 Cosplay City Championship, as listed in the official Hall of Fame.",
      },
      {
        name: "Doomed Gav — Forge Grandmaster winning performance at the C3 Cosplay City Championship final 2023",
        bio: "UK cosplayer — Forge Grandmaster of the 2023 C3 Cosplay City Championship, as listed in the official Hall of Fame.",
      },
      {
        name: "raydiancy_ — Fabric Grandmaster winning performance at the C3 Cosplay City Championship final 2023",
        bio: "UK cosplayer — Fabric Grandmaster of the 2023 C3 Cosplay City Championship, as listed in the official Hall of Fame.",
      },
      {
        name: "Bat and Blossom Cosplay — Grand Champion winning performance at the C3 Cosplay City Championship final 2024",
        bio: "UK cosplay duo — Grand Champions of the 2024 C3 Cosplay City Championship at ACME Comic Con Scotland, as listed in the official Hall of Fame.",
      },
      {
        name: "Lady Honey Designs — Fabric Grandmaster winning performance at the C3 Cosplay City Championship final 2024",
        bio: "UK cosplayer — Fabric Grandmaster of the 2024 C3 Cosplay City Championship, as listed in the official Hall of Fame.",
      },
      {
        name: "Axios Cosplay — Forge Grandmaster winning performance at the C3 Cosplay City Championship final 2024",
        bio: "UK cosplayer — Forge Grandmaster of the 2024 C3 Cosplay City Championship, as listed in the official Hall of Fame.",
      },
      {
        name: "Diablo_coz & white.noiz — Rai-Con Winter Forge Masters winning performance 2024",
        bio: "UK cosplay duo — Rai-Con Winter Forge Masters 2024, listed as C3 runners-up in the official Hall of Fame.",
      },
      {
        name: "Cosmic Dandy — Rai-Con Winter Fabric Master winning performance 2024",
        bio: "UK cosplayer — Rai-Con Winter Fabric Master 2024, listed as a C3 runner-up in the official Hall of Fame.",
      },
      {
        name: "Star — ACME Spring Superstar winning performance 2024",
        bio: "UK cosplayer — ACME Spring Superstar 2024, listed as a C3 runner-up in the official Hall of Fame.",
      },
    ],
  },
  {
    rankingSlug: "best-fried-chicken-shop-london-2026",
    nominees: [
      {
        name: "Popeyes",
        bio: "Popeyes is a Louisiana-style fried chicken chain with restaurants across London, including one in Waterloo.",
      },
      {
        name: "Wingmans",
        bio: "Wingmans is a chicken restaurant in London known for its chicken wings and tenders.",
      },
      {
        name: "Eden's Cottage",
        bio: "Eden's Cottage is a fried chicken shop in Finsbury Park, London.",
      },
      {
        name: "Butchies",
        bio: "Butchies is a London fried chicken brand known for its buttermilk fried chicken burgers.",
      },
      {
        name: "Coqfighter",
        bio: "Coqfighter is a London fried chicken brand serving Korean-style fried chicken.",
      },
      {
        name: "Wingstop",
        bio: "Wingstop is an American chicken wing chain with restaurants in London, including Shaftesbury Avenue in the West End.",
      },
      {
        name: "Sam's Chicken",
        bio: "Sam's Chicken is a fried chicken chain with multiple branches across London.",
      },
      {
        name: "Wing Wing",
        bio: "Wing Wing is a Korean fried chicken shop on Woburn Place in Bloomsbury, London.",
      },
      {
        name: "Thunderbird",
        bio: "Thunderbird is a fried chicken brand with a branch at Charing Cross in London.",
      },
      {
        name: "Jollibee",
        bio: "Jollibee is a Filipino fried chicken chain with a branch at Leicester Square in London.",
      },
      {
        name: "Slim Chickens",
        bio: "Slim Chickens is an American chicken tender chain with a branch on Bond Street in Marylebone, London.",
      },
      {
        name: "Morley's",
        bio: "Morley's is a South London fried chicken chain, established in 1985, with branches across London including Brixton Hill, Rotherhithe and Tottenham.",
      },
    ],
  },
  {
    rankingSlug: "best-full-english-london-2026",
    nominees: [
      {
        name: "Kula",
        bio: "Kula is a cafe on James Street in Marylebone serving a fully loaded full English breakfast.",
      },
      {
        name: "Sandwich Street Kitchen",
        bio: "Sandwich Street Kitchen is a family-run cafe on Hastings Street in Bloomsbury serving classic full English breakfasts.",
      },
      {
        name: "Sketch",
        bio: "Sketch is a Mayfair restaurant on Conduit Street serving a full English breakfast in its Parlour and Glade dining rooms.",
      },
      {
        name: "The Breakfast Club",
        bio: "The Breakfast Club is a breakfast cafe chain with multiple sites across London serving full English breakfasts.",
      },
      {
        name: "Regency Café",
        bio: "Regency Cafe is a greasy spoon on Regency Street in Westminster, serving full English breakfasts since 1946.",
      },
      {
        name: "E Pellicci",
        bio: "E Pellicci is a family-run cafe on Bethnal Green Road in Bethnal Green, serving full English breakfasts since 1900.",
      },
      {
        name: "Polo Bar",
        bio: "Polo Bar is a 24-hour cafe opposite Liverpool Street station in the City, serving full English breakfasts around the clock since 1959.",
      },
      {
        name: "Fallow",
        bio: "Fallow is a restaurant on St James's Market in St James's serving a full English breakfast made with top-quality ingredients.",
      },
      {
        name: "The Wolseley",
        bio: "The Wolseley is a cafe-restaurant on Piccadilly in Mayfair serving a classic full English breakfast.",
      },
      {
        name: "Lumi",
        bio: "Lumi is a cafe on Camden High Street in Camden Town serving a full English-style fry-up.",
      },
      {
        name: "Heart of Balham",
        bio: "Heart of Balham is a Moroccan cafe on Balham High Road in Balham serving a halal full English breakfast.",
      },
      {
        name: "Titanic Cafe",
        bio: "Titanic Cafe is a greasy spoon on Holloway Road in Holloway serving classic full English breakfasts.",
      },
      {
        name: "Bar Bruno",
        bio: "Bar Bruno is a family-run cafe on Wardour Street in Soho serving Bruno's Big Breakfast fry-up.",
      },
      {
        name: "Riding House",
        bio: "Riding House is a restaurant in Bloomsbury serving a classic fry-up with Dingley Dell bacon and BBQ beans.",
      },
    ],
  },
  {
    rankingSlug: "best-genre-night-london-2026",
    nominees: [
      {
        name: "Horse Meat Disco",
        bio: "Long-running London queer disco party; staged a 2026 night at Eagle London in Vauxhall.",
      },
      {
        name: "Hospitality",
        bio: "Drum-and-bass club night and label brand with long-running London events.",
      },
      {
        name: "Metalheadz",
        bio: "Goldie's drum-and-bass club night and label; the 90s Blue Note Sessions helped define the genre.",
      },
      {
        name: "DMZ",
        bio: "Dubstep club night founded by Digital Mystikz.",
      },
      {
        name: "Glitterbox",
        bio: "Disco and house club night; staged a sold-out party at Ministry of Sound.",
      },
      {
        name: "Butterz",
        bio: "Grime label and club night founded by Elijah and Skilliam.",
      },
      {
        name: "Pxssy Palace",
        bio: "Queer club night centred on QTIPOC, run by the Pxssy Palace collective.",
      },
      {
        name: "Touching Bass",
        bio: "South London music community and party brand.",
      },
      {
        name: "Co-Op",
        bio: "Broken-beat club night at Plastic People, central to London's rare-groove renaissance.",
      },
      {
        name: "FWD",
        bio: "Pioneering dubstep and UK garage club night.",
      },
      {
        name: "FABRICLIVE",
        bio: "fabric's long-running Friday-night club brand.",
      },
      {
        name: "The Gallery",
        bio: "Cult trance night founded in 1995 by Tall Paul; returned to Ministry of Sound in November 2025 after a ten-year hiatus.",
      },
      {
        name: "Frisky",
        bio: "Heritage trance club brand; named as one of the brands returning to Ministry of Sound in 2026 in the From The Archives series.",
      },
      {
        name: "Rulin'",
        bio: "Heritage house club brand; named as one of the brands returning to Ministry of Sound in 2026 in the From The Archives series.",
      },
    ],
  },
  {
    rankingSlug: "best-international-student-community-london-2026",
    nominees: [
      {
        name: "KCL Southeast Asian Society",
        bio: "KCL society welcoming all students interested in exploring and addressing issues in Southeast Asia, running talks, workshops and social events including an annual Halloween movie event and Christmas events.",
      },
      {
        name: "KCL Taiwanese Society",
        bio: "KCL society founded and run by Taiwanese students to showcase Taiwan's culture and help incoming Taiwanese friends adapt to life in London, with talks, field trips, festival celebrations and panels.",
      },
      {
        name: "ABACUS",
        bio: "British-Chinese student society at LSE with a wider network recognised at Queen Mary, Goldsmiths, UCL, SOAS, Imperial, Brunel and KCL.",
      },
      {
        name: "UCL Japan Society",
        bio: "UCL society whose constitution documents cultural workshops, language lessons, Japan Day and social events for students engaging with Japanese culture.",
      },
      {
        name: "Royal Holloway CSSA",
        bio: "Royal Holloway's Chinese Students and Scholars Association, a public society page hosting cultural events and supporting Chinese students adapting to UK life.",
      },
      {
        name: "KCL Korean Society",
        bio: "Korean cultural community at King's documented by student media as an unofficial society with annual gatherings, Korean-language use and food and cultural activities.",
      },
      {
        name: "KCL United Nations Association",
        bio: "KCL international-affairs society running Model UN trips across the UK and Europe and its own London International MUN conference, building an international student community at King's.",
      },
    ],
  },
  {
    rankingSlug: "best-jollof-london-2026",
    nominees: [
      {
        name: "Enish",
        bio: "Enish is a Nigerian restaurant group with branches across London, serving jollof rice and other Nigerian dishes.",
      },
      {
        name: "Chuku's",
        bio: "Chuku's is a Nigerian restaurant in Tottenham, London, serving Nigerian sharing plates including jollof.",
      },
      {
        name: "Akoko",
        bio: "Akoko is a West African fine-dining restaurant in Fitzrovia, London, with jollof rice on its menu.",
      },
      {
        name: "805 Old Kent Road",
        bio: "805 is a Nigerian restaurant on Old Kent Road in Southwark, London, serving jollof rice and grilled dishes.",
      },
      {
        name: "The Flygerians",
        bio: "The Flygerians is a Nigerian food brand at Peckham Palms in Peckham, London, serving jollof rice.",
      },
      {
        name: "Ikoyi",
        bio: "Ikoyi is a West African fine-dining restaurant in St James's, London, known for its smoked jollof.",
      },
      {
        name: "Gold Coast Bar & Restaurant",
        bio: "Gold Coast Bar & Restaurant is a Ghanaian restaurant in South Norwood, London, serving jollof rice and other West African dishes.",
      },
      {
        name: "Asafo Ghanaian Restaurant",
        bio: "Asafo is a Ghanaian restaurant on Brixton Hill, London, serving jollof rice.",
      },
      {
        name: "The Grills and Jollof",
        bio: "The Grills and Jollof is a Nigerian restaurant in Lower Clapton, Hackney, serving jollof rice and grilled meats.",
      },
      {
        name: "Jollof House Kitchen",
        bio: "Jollof House Kitchen is a Nigerian food vendor based in Brixton, London, serving jollof rice.",
      },
      {
        name: "Teju's Street Food",
        bio: "Teju's Street Food is a Nigerian street-food spot on Peckham High Street, London, serving jollof rice and suya.",
      },
      {
        name: "Moyo",
        bio: "Moyo is a Nigerian-Japanese restaurant in Hendon, London, with jollof rice on its 2026 menu.",
      },
    ],
  },
  {
    rankingSlug: "best-kpop-cover-performance-london-2026",
    nominees: [
      {
        name: "HKZ Dance - ILLIT \"It's Me\"",
        bio: "Documented London K-pop dance cover of ILLIT's \"It's Me\" performed by Cherrie, Viola, Aimee, Theo and Bartek.",
      },
      {
        name: "HKZ Dance - BLACKPINK \"Don't Know What To Do\"",
        bio: "Documented London K-pop dance cover of BLACKPINK's \"Don't Know What To Do\" performed by Hayden, Anet, Nati and Cherrie.",
      },
      {
        name: "HKZ Dance - Gyubin \"Really Like You\"",
        bio: "Documented London K-pop dance cover of Gyubin's \"Really Like You\" performed by Cherrie with named backup dancers.",
      },
      {
        name: "HKZ Dance - VIVIZ \"SHHH!\"",
        bio: "Documented London K-pop dance cover of VIVIZ's \"SHHH!\" performed by Hermione, Cherrie and Tiffany.",
      },
      {
        name: "HKZ Dance - Jennie \"Like Jennie\"",
        bio: "Documented London K-pop dance cover of Jennie's \"Like Jennie\", with Cherrie credited as project leader alongside named dancers.",
      },
      {
        name: "ASTRAY - RIIZE \"Fame\"",
        bio: "Documented London K-pop dance cover of RIIZE's \"Fame\" performed by Sixtine, Ruby, Namixen, Zhnnieya, Leanne Trieu and others.",
      },
      {
        name: "IGNITE - NewJeans \"Ditto\"",
        bio: "Documented London K-pop dance cover of NewJeans' \"Ditto\" performed by IGNITE.",
      },
      {
        name: "IGNITE - NewJeans \"ETA\"",
        bio: "Documented London K-pop dance cover of NewJeans' \"ETA\" performed by IGNITE.",
      },
      {
        name: "KWD Crew - BTS \"Swim\"",
        bio: "Documented London K-pop dance cover of BTS' \"Swim\" performed by Shai, Jenny, Roseanne, Rosemarie, Marcia, Ruby and Shana.",
      },
      {
        name: "KWD Crew - EXO \"Crown\"",
        bio: "Documented London K-pop dance cover of EXO's \"Crown\", project-led by Zosia with dancers Carly, Katie, Shana and Kirsty.",
      },
      {
        name: "COVE - ILLIT \"Not Cute Anymore\"",
        bio: "Documented K-pop dance cover of ILLIT's \"Not Cute Anymore\" by COVE, a team identifying itself as London/Birmingham-based.",
      },
      {
        name: "Dynasti - ILLIT \"Not Cute Anymore\"",
        bio: "Documented London K-pop dance cover of ILLIT's \"Not Cute Anymore\" performed by Marissa, Ana, Angel, Julia and Ebela.",
      },
      {
        name: "AVID London - Kiss of Life \"Sticky\"",
        bio: "Documented London K-pop dance cover of Kiss of Life's \"Sticky\" performed by Evelyn, Grace, Natalie and Tong.",
      },
    ],
  },
  {
    rankingSlug: "best-late-night-kebab-london-2026",
    nominees: [
      {
        name: "Gökyüzü",
        bio: "Gokyuzu is a Turkish restaurant on Green Lanes in Harringay, open until 2am daily, serving kebabs and grills.",
      },
      {
        name: "Ranoush Juice",
        bio: "Ranoush Juice is a Lebanese eatery on Edgware Road, open until 3am, serving shawarma and juices.",
      },
      {
        name: "Cafe Helen",
        bio: "Cafe Helen is a Lebanese cafe on Edgware Road, open until 5am (6am on weekends), serving shawarma and Lebanese dishes.",
      },
      {
        name: "Star Kebab House",
        bio: "Star Kebab House is a kebab shop on Earl's Court Road, open until 3am (5am on weekends), serving doner and shish kebabs.",
      },
      {
        name: "Shawarma Bros",
        bio: "Shawarma Bros is a shawarma shop on Waterloo Road in Waterloo, open until 4am.",
      },
      {
        name: "Brick Lane Kebab",
        bio: "Brick Lane Kebab is a kebab shop on Brick Lane, open until 3am (5am on weekends), serving doner kebabs.",
      },
      {
        name: "Capital Kebab House",
        bio: "Capital Kebab House is a kebab shop on The Cut in Waterloo, open until 3am.",
      },
      {
        name: "Kebhouze",
        bio: "Kebhouze is a kebab shop on Oxford Street, open until 3am on weekends.",
      },
      {
        name: "Layalina Piccadilly",
        bio: "Layalina Piccadilly is a Lebanese street-food restaurant on Coventry Street in Piccadilly, open until 5am daily, serving shawarma and falafel.",
      },
      {
        name: "The Best Turkish Kebab",
        bio: "The Best Turkish Kebab is a kebab shop on Stoke Newington Road, open until 2am daily (3am on weekends), serving doner and lamb shish kebabs.",
      },
      {
        name: "King's Kebab House",
        bio: "King's Kebab House is a kebab and shawarma spot on Earl's Court Road in Earl's Court, open until 5am daily.",
      },
      {
        name: "Best Kebab",
        bio: "Best Kebab is a kebab shop on Cambridge Heath Road in Bethnal Green, open until 2am daily (5am on weekends).",
      },
    ],
  },
  {
    rankingSlug: "best-music-borough-london-2026",
    nominees: [
      {
        name: "Camden",
        bio: "Camden Town's venues and Amy Winehouse's legacy are documented as central to the borough's music history, from punk to the present day.",
      },
      {
        name: "Croydon",
        bio: "Home to Big Apple Records and dubstep's early history, and to the BRIT School; celebrated in the borough's official music heritage trail.",
      },
      {
        name: "Lambeth",
        bio: "Home to the O2 Academy Brixton, a major live music venue, and the birthplace of David Bowie in Brixton.",
      },
      {
        name: "Tower Hamlets",
        bio: "Bow E3 in the borough is documented as a birthplace of grime, home to early scene figures including Wiley, Dizzee Rascal and Tinchy Stryder.",
      },
      {
        name: "Haringey",
        bio: "Tottenham is the home ground of Boy Better Know, with Meridian Walk and the Skepta/Jme upbringing documented in the borough.",
      },
      {
        name: "Lewisham",
        bio: "Dire Straits formed and made their debut in Deptford, Lewisham, with the band returning to Deptford documented in 2009.",
      },
      {
        name: "Southwark",
        bio: "Peckham in the borough is documented for its gig venues and music links, including the Rye Lane soundtrack coverage of the area.",
      },
      {
        name: "Westminster",
        bio: "Home to Denmark Street (Tin Pan Alley), Ronnie Scott's jazz club and the former Marquee Club site.",
      },
      {
        name: "Kensington and Chelsea",
        bio: "Notting Hill Carnival, Europe's biggest street festival of Caribbean culture, takes place in the borough with sound-system culture at its core.",
      },
      {
        name: "Brent",
        bio: "Home to Wembley venues including OVO Arena Wembley, with a capacity of up to 12,500 and an active 2026 events programme.",
      },
      {
        name: "Hackney",
        bio: "Home to EartH in Dalston, which lists an active 2026 events programme on its official site.",
      },
      {
        name: "Newham",
        bio: "Home turf of Kano, Ghetts and the Newham Generals, documented as central figures of the borough's grime history.",
      },
      {
        name: "Ealing",
        bio: "Home to the Ealing Club, where the early Rolling Stones nucleus formed around Charlie Watts in the 1960s.",
      },
      {
        name: "Greenwich",
        bio: "Home to The O2 at North Greenwich, a 20,000-capacity arena hosting major concerts.",
      },
    ],
  },
  {
    rankingSlug: "best-new-rap-track-london-2026",
    nominees: [
      {
        name: "GBP — Central Cee feat. 21 Savage",
        bio: "Released on 17 January 2025 as Central Cee's single featuring 21 Savage.",
      },
      {
        name: "Flood — Little Simz feat. Obongjayar & Moonchild Sanelly",
        bio: "Released on 26 February 2025 as the lead single from Little Simz's album 'Lotus'.",
      },
      {
        name: "Bounce — Aitch",
        bio: "Released on 19 March 2025 as a single by Aitch.",
      },
      {
        name: "Crush — AJ Tracey feat. Jorja Smith",
        bio: "From AJ Tracey's album 'Don't Die Before You're Dead', released on 13 June 2025.",
      },
      {
        name: "Friday Prayer — AJ Tracey feat. Aitch & Headie One",
        bio: "From AJ Tracey's album 'Don't Die Before You're Dead', released on 13 June 2025.",
      },
      {
        name: "Raindance — Dave & Tems",
        bio: "The Dave and Tems single released on 23 October 2025; it topped the UK Singles Chart in January 2026.",
      },
      {
        name: "History — Dave feat. James Blake",
        bio: "Released on 23 October 2025 as a single by Dave featuring James Blake.",
      },
      {
        name: "How Dare They — Headie One feat. Digga",
        bio: "The video arrived on 1 September 2026; the track appears on the bonus edition of Headie One's 'MMM'.",
      },
      {
        name: "RICO — D-Block Europe & French Montana",
        bio: "Released in late August 2026 by D-Block Europe and French Montana.",
      },
      {
        name: "Unorthodox — Marnz Malone feat. J Hus",
        bio: "Released on 3 September 2026 by Marnz Malone featuring J Hus; produced by Gusto and Smokey C.",
      },
      {
        name: "GASS — Nemzzz feat. Travis Scott",
        bio: "Released on 4 September 2026 by Nemzzz featuring Travis Scott.",
      },
      {
        name: "Serena Williams — 163Margs",
        bio: "Released on 3 September 2026 by 163Margs.",
      },
      {
        name: "Which One — Drake & Central Cee",
        bio: "Released on 25 July 2025 by Drake and Central Cee; it debuted at No.23 on the Billboard Hot 100.",
      },
      {
        name: "Shanghigh Noon — Pozer",
        bio: "A track from Pozer's 2025 project 'Against All Odds'; Pozer won Best Drill Act at the 2025 MOBO Awards.",
      },
    ],
  },
  {
    rankingSlug: "best-rap-crew-london-2026",
    nominees: [
      {
        name: "N.A.S.T.Y Crew",
        bio: "Historical grime collective founded by DJ Marcus Nasty; Kano, D Double E, Footsie and Jammer are documented as members.",
      },
      {
        name: "Roll Deep",
        bio: "Historical East London grime crew formed around 2002 by MCs including Wiley, with a string of UK chart hits.",
      },
      {
        name: "Boy Better Know",
        bio: "North London collective founded by Jme and Skepta; members include Frisco, Jammer and Shorty.",
      },
      {
        name: "Ruff Sqwad",
        bio: "Bow E3 grime collective associated with Rapid, Dirty Danger, Slix and Tinchy Stryder.",
      },
      {
        name: "More Fire Crew",
        bio: "Historical Waltham Forest crew formed by Ozzie B and Neeko, later joined by Lethal Bizzle and Seani B; known for the 2002 hit 'Oi!'.",
      },
      {
        name: "So Solid Crew",
        bio: "Battersea garage and hip-hop collective; members include Megaman, Asher D, Lisa Maffia, Romeo and Harvey, with the UK number-one '21 Seconds'.",
      },
      {
        name: "Newham Generals",
        bio: "Forest Gate grime duo of D Double E and Footsie, documented on their official site.",
      },
      {
        name: "67",
        bio: "Brixton Hill drill group associated with LD, Monkey, Liquez, Dimzy and ASAP.",
      },
      {
        name: "Harlem Spartans",
        bio: "Kennington rap crew; documented members include Blanco, MizOrMac and Bis.",
      },
      {
        name: "OFB",
        bio: "Broadwater Farm and Tottenham collective; Bandokay, Double Lz, SJ and Headie One are documented as associated artists.",
      },
      {
        name: "Zone 2",
        bio: "Peckham drill collective; Kwengface, PS Hitsquad, Trizzac and Karma are documented members.",
      },
      {
        name: "Smoke Boys",
        bio: "Historical Croydon collective, inactive after their final 2020 mixtape; members included Knine, Inch, Deepee, Sleeks, Littlez and Swift.",
      },
      {
        name: "House of Pharaohs",
        bio: "South-East London collective; Sam Wise, BlazeYL, Bandanna, Kevin Taylor and Danny Stern are documented members.",
      },
      {
        name: "NiNE8 Collective",
        bio: "London music and arts collective including Lava La Rue, Biig Piig, NAYANA IZ and Mac Wetha.",
      },
    ],
  },
  {
    rankingSlug: "best-rap-producer-london-2026",
    nominees: [
      {
        name: "M1OnTheBeat",
        bio: "Produced Headie One's early projects, Digga D's 'Woi', 'Golden Boot' and the Drake/Headie One 'Only You Freestyle'.",
      },
      {
        name: "JAE5",
        bio: "Executive producer of J Hus's 'Common Sense' and producer of Dave's 'Location'; a MOBO Best Producer winner.",
      },
      {
        name: "Steel Banglez",
        bio: "Produced Krept & Konan's 'Go Down South' and Mist's 'Karla's Back'.",
      },
      {
        name: "Nana Rogues",
        bio: "Produced Drake's 'Passionfruit' and 'Skepta Interlude'; his credits also span Dave, J Hus and Stormzy.",
      },
      {
        name: "Ghosty",
        bio: "Featured in a 2021 UK drill producers special alongside Flyo and MK The Plug.",
      },
      {
        name: "Flyo",
        bio: "Featured in a 2021 UK drill producers special alongside Ghosty and MK The Plug.",
      },
      {
        name: "MK The Plug",
        bio: "Featured in a 2021 UK drill producers special alongside Ghosty and Flyo.",
      },
      {
        name: "Eight8",
        bio: "Produced Central Cee's 'gen z luv' and 'Moi' and holds credits on 'Can't Rush Greatness'.",
      },
      {
        name: "Conducta",
        bio: "Produced AJ Tracey's chart hit 'Ladbroke Grove'.",
      },
      {
        name: "Sir Spyro",
        bio: "Produced Stormzy's 'Big for Your Boots', 'Sounds of the Skeng' and 'Topper Top'.",
      },
      {
        name: "Carns Hill",
        bio: "Produced 67's 'Take It There'.",
      },
      {
        name: "Nyge",
        bio: "Executive producer of AJ Tracey's album 'Flu Game'.",
      },
      {
        name: "P2J",
        bio: "Produced Burna Boy's 'Anybody' and much of Wizkid's 'Made in Lagos'; he won a Grammy for 'Twice as Tall'.",
      },
    ],
  },
  {
    rankingSlug: "best-rave-venue-london-2026",
    nominees: [
      {
        name: "FOLD",
        bio: "Canning Town, capacity 600; 24-hour licensed nightclub listed as operating in an autumn-2026 London club guide.",
      },
      {
        name: "fabric",
        bio: "Farringdon, capacity 1,600; three-room nightclub with a 2026-2027 concert schedule listed.",
      },
      {
        name: "Ministry of Sound",
        bio: "Elephant & Castle, capacity 1,500; club with listed events running September to December 2026, marking its 35th year.",
      },
      {
        name: "E1",
        bio: "Wapping, capacity 1,600; warehouse venue with 2026 events listed through December.",
      },
      {
        name: "Drumsheds",
        bio: "Meridian Water, Edmonton, capacity 15,000; large-scale nightclub and events venue described as operating in an autumn-2026 club guide.",
      },
      {
        name: "Village Underground",
        bio: "Shoreditch, capacity 700; warehouse venue with a 2026-2027 concert schedule listed.",
      },
      {
        name: "Phonox",
        bio: "Brixton, capacity 500; nightclub with 2026 events listed from September to December.",
      },
      {
        name: "Colour Factory",
        bio: "Hackney Wick, capacity 750; multi-space venue with 2026 events listed through November.",
      },
      {
        name: "Venue MOT",
        bio: "Deptford, capacity 350; venue with 2026 events listed in September, October and November.",
      },
      {
        name: "The Cause",
        bio: "Tottenham, capacity 1,200; grassroots venue that hosted the 36-hour Waterworks Extended festival on 12-13 September 2026.",
      },
      {
        name: "The Steel Yard",
        bio: "City of London (Cannon Street), capacity 1,000; three-arch venue with 2026 events listed through January 2027.",
      },
      {
        name: "XOYO",
        bio: "Shoreditch, capacity 800; two-floor nightclub with 2026 events listed from September to December.",
      },
      {
        name: "KOKO",
        bio: "Camden, capacity 1,500; theatre venue running the KOKO Electronic autumn-winter 2026 season.",
      },
      {
        name: "HERE at Outernet",
        bio: "Tottenham Court Road, capacity 2,000; underground venue now operating as Outernet Live, with 2026 events listed through November.",
      },
    ],
  },
  {
    rankingSlug: "best-rookie-cosplayer-london-2026",
    nominees: [
      {
        name: "Bows_Arrows_Again",
        bio: "UK cosplayer — winner of the Ultimate Apprentice category at the 2025 C3 Cosplay City Championship.",
      },
      {
        name: "Kellserskr",
        bio: "UK cosplayer — C3 Cosplay City Championship Grand Champion 2025.",
      },
      {
        name: "Geckocos",
        bio: "UK cosplayer — C3 Cosplay City Championship Fabric Grandmaster 2025.",
      },
      {
        name: "Miss.t.makes",
        bio: "UK cosplayer — C3 Cosplay City Championship Forge Grandmaster 2025.",
      },
      {
        name: "EJ Knox",
        bio: "UK cosplayer — winner at POWER Con, listed in the 2025 C3 Cosplay City Championship Hall of Fame.",
      },
      {
        name: "Deviloustailor",
        bio: "UK cosplayer — winner at POWER Con, listed in the 2025 C3 Cosplay City Championship Hall of Fame.",
      },
      {
        name: "Cinnamon Cosplay",
        bio: "UK cosplayer — winner at Kaiju Con, listed in the 2025 C3 Cosplay City Championship Hall of Fame.",
      },
      {
        name: "Venom Beauty",
        bio: "UK cosplayer — winner at Kaiju Con, listed in the 2025 C3 Cosplay City Championship Hall of Fame.",
      },
      {
        name: "Shan Shan",
        bio: "UK cosplayer — winner at Kaiju Con, listed in the 2025 C3 Cosplay City Championship Hall of Fame.",
      },
      {
        name: "Hardly Hollow",
        bio: "UK cosplayer — winner at EPIC Comic Con, listed in the 2025 C3 Cosplay City Championship Hall of Fame.",
      },
      {
        name: "Pander Cosplay",
        bio: "UK cosplayer — winner at EPIC Comic Con, listed in the 2025 C3 Cosplay City Championship Hall of Fame.",
      },
      {
        name: "Maria Jodicke",
        bio: "Cosplayer featured by Radio Times for a handmade Dalek dress worn at MCM London Comic Con 2025.",
      },
      {
        name: "MossyPyramidHead",
        bio: "Cosplayer featured by Radio Times for a floral Pyramid Head costume worn at MCM London Comic Con 2025.",
      },
      {
        name: "trashnim_",
        bio: "Cosplayer featured by Radio Times for a Pinhead costume worn at MCM London Comic Con 2025.",
      },
      {
        name: "deeliteful_cosplay",
        bio: "Cosplayer credited by Radio Times for a handmade Okoye costume worn at MCM London Comic Con 2025.",
      },
    ],
  },
  {
    rankingSlug: "best-rookie-dance-crew-london-2026",
    nominees: [
      {
        name: "ETERNL",
        bio: "London K-pop cover crew with documented recent covers including 82MAJOR's \"Takeover\", performed by Paris, Stacie, Otto, Antonela, Paula and Nana.",
      },
      {
        name: "O.D.C",
        bio: "London K-pop dance crew with documented recent covers including CORTIS' \"GO!\", performed by Jamel, Moses, Morgan, Mario and Trev.",
      },
      {
        name: "IGNITE",
        bio: "London K-pop cover crew with documented recent covers of NewJeans' \"Ditto\" and \"ETA\", featuring dancer Spriha.",
      },
      {
        name: "KWD Crew",
        bio: "London K-pop cover crew with documented recent covers of BTS' \"Swim\" and EXO's \"Crown\", featuring dancers including Shana and project lead Zosia.",
      },
      {
        name: "COVE",
        bio: "K-pop cover team identifying itself as London/Birmingham-based, with a documented cover of ILLIT's \"Not Cute Anymore\".",
      },
      {
        name: "Cromer Crew",
        bio: "London K-pop cover crew with a documented recent cover of XG's \"Hypnotize\", performed by Vivienne, Mirei, Skylar, Shannon, Mimi, Jenelle and Sela.",
      },
      {
        name: "ECHO Crew",
        bio: "London K-pop cover crew with a documented recent cover of ILLIT's \"It's Me\", performed by Jamie, Ene, Zosia, Keira and Lee.",
      },
      {
        name: "ASTRAY",
        bio: "London K-pop cover crew with a documented recent cover of RIIZE's \"Fame\", performed by Sixtine, Ruby, Namixen, Zhnnieya, Leanne Trieu and others.",
      },
      {
        name: "HKZ Dance",
        bio: "London K-pop cover crew with documented recent covers including ILLIT's \"It's Me\", BLACKPINK's \"Don't Know What To Do\" and Jennie's \"Like Jennie\", featuring dancers Cherrie, Hayden, Anet, Nati and Bartek.",
      },
    ],
  },
  {
    rankingSlug: "best-society-president-london-2026",
    nominees: [
      {
        name: "Quoc Anh Nguyen",
        bio: "Elected President of the UCL Vietnamese Society for 2025/26 in the Students' Union UCL leadership race, winning the count run on 21 March 2025.",
      },
      {
        name: "Yuki Zhou",
        bio: "Elected President of the UCL Chinese Students and Scholars Association for 2025/26 in the Students' Union UCL leadership race, winning 85 of 115 ballots in the count run on 21 March 2025.",
      },
      {
        name: "Emir Deniz Durahim",
        bio: "Elected President of the UCL Turkish Society for 2025/26 in the Students' Union UCL leadership race, winning the count run on 21 March 2025.",
      },
      {
        name: "Yi Kang Chai",
        bio: "Elected President of the UCL Malaysian Society for 2025/26 in the Students' Union UCL leadership race, winning 41 of 81 ballots in the count run on 21 March 2025.",
      },
      {
        name: "Chin Siang Yew",
        bio: "Elected President of the UCL Singapore Society for 2025/26 in the Students' Union UCL leadership race, winning 82 of 91 ballots in the count run on 21 March 2025.",
      },
      {
        name: "Vishal Arun",
        bio: "Elected President of the UCL Hindu Society for 2025/26 in the Students' Union UCL leadership race, winning 76 of 114 ballots in the count run on 21 March 2025.",
      },
      {
        name: "Megan Liao",
        bio: "Elected President of the UCL Taiwanese Society for 2025/26 in the Students' Union UCL leadership race, winning 18 of 34 ballots in the count run on 21 March 2025.",
      },
      {
        name: "Maya Crasmaru",
        bio: "Elected President of the UCL English Society for 2025/26 in the Students' Union UCL leadership race, winning the count run on 21 March 2025.",
      },
      {
        name: "Girish Kharal",
        bio: "Elected President of the UCL Nepalese Society for 2025/26 in the Students' Union UCL leadership race, winning 17 of 23 ballots in the count run on 21 March 2025.",
      },
      {
        name: "Ines Aissi",
        bio: "Elected President of the UCL Muslimah Careers Society for 2025/26 in the Students' Union UCL leadership race, winning the count run on 21 March 2025.",
      },
      {
        name: "Conal Flannery",
        bio: "Elected President of the UCL Irish and Northern Irish Society for 2025/26 in the Students' Union UCL leadership race, winning 9 of 10 ballots in the count run on 21 March 2025.",
      },
      {
        name: "Aryan Virdi",
        bio: "Elected President of the UCL Punjabi Society for 2025/26 in the Students' Union UCL leadership race, winning 28 of 44 ballots in the count run on 21 March 2025.",
      },
      {
        name: "Hanna Johal",
        bio: "Elected President of the UCL Real Estate Society for 2025/26 in the Students' Union UCL leadership race, winning 7 of 10 ballots in the count run on 21 March 2025.",
      },
      {
        name: "Izzie Moull",
        bio: "Named President of the UCL Cheese Grater Magazine Society in the June 2026 issue of the student publication; the society was awarded Best Publication in London (SPA Regional Awards 2025) and Best Publication in the UK and Ireland (SPA National Awards 2026).",
      },
    ],
  },
  {
    rankingSlug: "best-student-dj-london-2026",
    nominees: [
    ],
  },
  {
    rankingSlug: "best-university-dance-crew-london-2026",
    nominees: [
      {
        name: "KCL Fusion",
        bio: "The national university competition team of KCL Dance Society, fielding teams in styles including Jazz, Contemporary, Hip Hop, Tap, Ballet, Lyrical, Commercial and Wildcard, with documented first-place wins at recent inter-university competitions.",
      },
      {
        name: "ICU Funkology",
        bio: "Imperial College's hip-hop and breaking dance society, whose constitution says it promotes hip-hop dance and breaking within Imperial and represents the university at external events and university competitions.",
      },
      {
        name: "UCL Dance Society Competition Team",
        bio: "The auditioned competition team of UCL Dance Society, which the society's constitution says competes at two external inter-university competitions; the society's Freshers Show 2025 documented hip-hop, locking, contemporary and commercial performances.",
      },
    ],
  },
  {
    rankingSlug: "biggest-sound-london-2026",
    nominees: [
      {
        name: "Channel One Sound System",
        bio: "Roots reggae and dub sound system listed on the official Notting Hill Carnival site, with a long-standing Carnival pitch.",
      },
      {
        name: "Saxon Studio International",
        bio: "Lewisham-based sound system founded in 1976, documented as a pioneer of UK sound-system culture and bass music.",
      },
      {
        name: "Sir Coxsone Outernational",
        bio: "London sound system built around founder Lloyd 'Coxsone' Cox, documented as a pioneering UK reggae sound.",
      },
      {
        name: "Aba Shanti-I",
        bio: "Roots reggae sound system listed on the official Notting Hill Carnival site, known for heavyweight dub sessions.",
      },
      {
        name: "Jah Shaka Sound System",
        bio: "Sound system of Jamaican-born UK reggae figure Jah Shaka, billed with Young Warrior Sound at Egg London for 'Dance for Shaka 2026'.",
      },
      {
        name: "Fatman Sound System",
        bio: "London sound system documented in UK sound-system history and filmed playing out in London in 2025.",
      },
      {
        name: "Unit 137",
        bio: "London sound system operating under the Unit 137 name, with an official site documenting its crew and events.",
      },
      {
        name: "The Heatwave",
        bio: "London dancehall sound-system collective documented by Clash Music for their mixtape and sound work.",
      },
      {
        name: "Reggae Roast",
        bio: "London sound-system collective with an announced 2026 live tour and album releases.",
      },
      {
        name: "Young Warrior Sound System",
        bio: "London sound system launched in 2011 with ties to the Jah Shaka family, billed with Jah Shaka Sound at Egg London for 'Dance for Shaka 2026'.",
      },
      {
        name: "King Tubby's Sound System",
        bio: "London sound system founded by Cecil Rennie in 1970, documented as holding Notting Hill Carnival pitches including Clydesdale Road.",
      },
      {
        name: "Rampage Sound",
        bio: "London sound system with a long-running Notting Hill Carnival pitch at Colville Square, documented on the official Carnival site.",
      },
      {
        name: "Solution Sound System",
        bio: "London roots sound system documented on the official Carnival site as holding its Notting Hill Carnival pitch since 2012.",
      },
    ],
  },
  {
    rankingSlug: "biggest-south-london-club-2026",
    nominees: [
      {
        name: "Crystal Palace",
        bio: "South London club; Premier League, Selhurst Park.",
      },
      {
        name: "Millwall",
        bio: "South London club; The Den.",
      },
      {
        name: "Charlton Athletic",
        bio: "South London EFL club; The Valley.",
      },
      {
        name: "AFC Wimbledon",
        bio: "South London EFL club; Plough Lane.",
      },
      {
        name: "Sutton United",
        bio: "South London EFL club; known for strong cup performances.",
      },
      {
        name: "Bromley",
        bio: "South London club; Hayes Lane.",
      },
      {
        name: "Dulwich Hamlet",
        bio: "South London non-league club; Isthmian Premier, Champion Hill.",
      },
      {
        name: "Welling United",
        bio: "South London non-league club; Isthmian Premier.",
      },
      {
        name: "Dartford",
        bio: "South-east London non-league club; Isthmian Premier.",
      },
      {
        name: "Carshalton Athletic",
        bio: "South London non-league club; Isthmian Premier.",
      },
      {
        name: "Cray Wanderers",
        bio: "South London non-league club; Isthmian Premier.",
      },
      {
        name: "Tooting & Mitcham United",
        bio: "South London non-league club; historic local rivalry with Dulwich Hamlet and Wimbledon.",
      },
      {
        name: "Fisher FC",
        bio: "South London non-league club; Isthmian South East Division.",
      },
    ],
  },
  {
    rankingSlug: "loudest-football-fanbase-london-2026",
    nominees: [
      {
        name: "Crystal Palace — Holmesdale Fanatics",
        bio: "Ultras group founded in 2005, based in Selhurst Park's Holmesdale Road Stand; tifo and vocal displays.",
      },
      {
        name: "Millwall supporters",
        bio: "The Den is famed for one of England's most intimidating, hostile atmospheres.",
      },
      {
        name: "Arsenal — Ashburton Army",
        bio: "Arsenal supporters' group; part of the vocal Emirates crowd on the North Bank.",
      },
      {
        name: "Dulwich Hamlet — The Rabble",
        bio: "Supporters behind the goal at Champion Hill; among the loudest followings in non-league football.",
      },
      {
        name: "West Ham supporters",
        bio: "London Stadium support; the Trevor Brooking Stand is the ground's loudest section.",
      },
      {
        name: "Tottenham supporters",
        bio: "Tottenham Hotspur Stadium support; the South Stand is the ground's loudest section.",
      },
      {
        name: "Chelsea supporters",
        bio: "Stamford Bridge support; the Matthew Harding Stand is the ground's loudest section.",
      },
      {
        name: "Charlton supporters",
        bio: "The Valley support; rated above average for home atmosphere.",
      },
      {
        name: "Brentford supporters",
        bio: "Gtech Community Stadium support; the West and East stands are the ground's loudest sections.",
      },
      {
        name: "Fulham supporters",
        bio: "Craven Cottage support; the Hammersmith End is the ground's loudest section.",
      },
      {
        name: "AFC Wimbledon supporters",
        bio: "Plough Lane support; fan-owned club with a vocal home following.",
      },
      {
        name: "Sutton United supporters",
        bio: "South London club with a loyal non-league home following.",
      },
      {
        name: "Bromley supporters",
        bio: "Hayes Lane support; community club with a growing home following.",
      },
      {
        name: "QPR supporters",
        bio: "Loftus Road support; one of London's tightest, most compact grounds.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-afrobeats-dj-london-2026",
    nominees: [
      {
        name: "Juls",
        bio: "British-Ghanaian DJ and producer credited with shaping modern Afrobeats; he won Best Producer at the 2025 MOBO Awards.",
      },
      {
        name: "DJ Abrantee",
        bio: "Credited with pioneering the Afrobeats movement in the UK; he launched the world's first Afrobeats radio show in April 2011 and broadcasts on Capital Xtra.",
      },
      {
        name: "Jeremiah Asiamah",
        bio: "Hosts the 1Xtra Rave Show on BBC Radio 1Xtra, spanning Afrobeats, Afro house and amapiano.",
      },
      {
        name: "Afro B",
        bio: "Hitmaker behind Drogba (Joanna) who coined the term Afrowave for his fusion of hip-hop, dancehall and Afrobeats.",
      },
      {
        name: "DJ Spinall",
        bio: "Started his career in the UK and became the official DJ for Mavin Records, promoting Afrobeats through tours and mixtapes.",
      },
      {
        name: "DJ Edu",
        bio: "Host of BBC Radio 1Xtra's Destination Africa and a prominent advocate for African music in the UK.",
      },
      {
        name: "DJ Neptizzle",
        bio: "Known for the Ultimate Afrobeats mixtape series; a staple of clubs and festivals across the UK.",
      },
      {
        name: "DJ P Montana",
        bio: "Known for versatile mixes promoting Afrobeats and UK underground music.",
      },
      {
        name: "DJ Abass",
        bio: "Media and entertainment consultant who has promoted Nigerian music and culture in the UK.",
      },
      {
        name: "DJ Cuppy",
        bio: "British-Nigerian DJ who presented BBC Radio 1Xtra's Sunday Breakfast Show and hosted Apple Music's Africa Now Radio.",
      },
      {
        name: "DJ SoGood",
        bio: "London-based Nigerian DJ interviewed about his UK DJ career.",
      },
      {
        name: "DJ Alexo",
        bio: "London-based Nigerian DJ interviewed about his UK DJ career.",
      },
      {
        name: "DJ Stevon",
        bio: "London-based DJ listed among the capital's Nigerian and Afrobeats DJs.",
      },
      {
        name: "DJ Yemstar",
        bio: "London-based DJ listed among the capital's Nigerian and Afrobeats DJs.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-amapiano-dj-london-2026",
    nominees: [
      {
        name: "Mixolis",
        bio: "London-based amapiano DJ with appearances at Ministry of Sound, Boiler Room, E1 and AMAFEST.",
      },
      {
        name: "Rosey Gold",
        bio: "London-based South African amapiano DJ and radio personality.",
      },
      {
        name: "OneThabs",
        bio: "Amapiano DJ active on the London scene.",
      },
      {
        name: "E305",
        bio: "DJ on London's amapiano circuit, named on the line-up for the Sounds on the South amapiano party at E1 London.",
      },
      {
        name: "Kwamzy",
        bio: "DJ on London's amapiano circuit, named on the line-up for the Sounds on the South amapiano party at E1 London.",
      },
      {
        name: "RedHour",
        bio: "DJ on London's amapiano circuit, named on the line-up for the Sounds on the South amapiano party at E1 London.",
      },
      {
        name: "SweetyNy",
        bio: "DJ on London's amapiano circuit, named on the line-up for the Sounds on the South amapiano party at E1 London.",
      },
      {
        name: "Babancube",
        bio: "DJ on London's amapiano circuit, named on the line-up for the Sounds on the South amapiano party at E1 London.",
      },
      {
        name: "Shakil",
        bio: "DJ on London's amapiano circuit, named on the line-up for the Sounds on the South amapiano party at E1 London.",
      },
      {
        name: "Planet Mumi",
        bio: "DJ on London's amapiano circuit, named on the line-up for the Sounds on the South amapiano party at E1 London.",
      },
      {
        name: "Riria",
        bio: "Tokyo-born, London-based DJ who mixes amapiano with UK garage and global bass; she took up a Rinse FM residency in 2025.",
      },
      {
        name: "DJ YB UK",
        bio: "London-based open-format DJ who lists amapiano and Afrobeats among his styles.",
      },
      {
        name: "DJ Delight NGB",
        bio: "UK-based DJ playing Afro-fusion, amapiano and Afrobeats.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-bakery-creator-london-2026",
    nominees: [
      {
        name: "Jemma Wilson",
        bio: "Jemma Wilson, known as Cupcake Jemma, is the co-owner of the London bakery Crumbs & Doilies and host of the Cupcake Jemma YouTube channel.",
      },
      {
        name: "Benjamina Ebuehi",
        bio: "London-based baker and cookbook author, known for her dessert recipes and online baking content.",
      },
      {
        name: "Ruby Bhogal",
        bio: "London-based baker and former Great British Bake Off finalist, known for her patisserie-style bakes.",
      },
      {
        name: "Liam Charles",
        bio: "Hackney-born baker and former Great British Bake Off contestant, now a television presenter and cookbook author.",
      },
      {
        name: "Edd Kimber",
        bio: "Winner of the first series of The Great British Bake Off; London-based baker and cookbook author.",
      },
      {
        name: "Manon Lagrève",
        bio: "Clapham-based French baker and former Great British Bake Off contestant, known for her patisserie.",
      },
      {
        name: "Syabira Yusoff",
        bio: "Winner of The Great British Bake Off 2022; London-based Malaysian-born baker.",
      },
      {
        name: "Lily Vanilli",
        bio: "East London baker known for her bespoke cakes and bakes.",
      },
      {
        name: "Crystelle Pereira",
        bio: "London-based baker and former Great British Bake Off finalist.",
      },
      {
        name: "Juliet Sear",
        bio: "London-based baker, cake artist and television presenter; author of baking books.",
      },
      {
        name: "Ravneet Gill",
        bio: "London-based pastry chef and cookbook author.",
      },
      {
        name: "Claire Ptak",
        bio: "Owner of the Violet Bakery in Hackney, London; she baked the wedding cake for Prince Harry and Meghan Markle.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-celebrity-chef-london-2026",
    nominees: [
      {
        name: "Gordon Ramsay",
        bio: "Celebrity chef and restaurateur with restaurants across London, including Restaurant Gordon Ramsay in Chelsea.",
      },
      {
        name: "Heston Blumenthal",
        bio: "Celebrity chef known for The Fat Duck; runs Dinner by Heston Blumenthal in London.",
      },
      {
        name: "Marcus Wareing",
        bio: "Celebrity chef and restaurateur; runs the restaurant Marcus in Knightsbridge, London.",
      },
      {
        name: "Michel Roux Jr",
        bio: "Celebrity chef; runs Le Gavroche in London and appears on television cooking shows.",
      },
      {
        name: "Rick Stein",
        bio: "Celebrity chef and television presenter with restaurants including a seafood restaurant in London.",
      },
      {
        name: "Giorgio Locatelli",
        bio: "Celebrity Italian chef; runs Locanda Locatelli in Marylebone, London.",
      },
      {
        name: "Richard Corrigan",
        bio: "Celebrity chef and restaurateur with restaurants in London, including Corrigan's Mayfair.",
      },
      {
        name: "Clare Smyth",
        bio: "Celebrity chef; runs Core by Clare Smyth in Notting Hill, London.",
      },
      {
        name: "Tom Kerridge",
        bio: "Celebrity chef and television presenter; launched a bar and restaurant at the Corinthia hotel in London.",
      },
      {
        name: "Ainsley Harriott",
        bio: "Celebrity chef and television presenter known for his BBC cooking shows.",
      },
      {
        name: "Raymond Blanc",
        bio: "Celebrity chef and restaurateur; founder of Brasserie Blanc restaurants.",
      },
      {
        name: "Gennaro Contaldo",
        bio: "Celebrity Italian chef and television presenter, known for his long-running TV cooking shows.",
      },
      {
        name: "Jamie Oliver",
        bio: "Celebrity chef and television presenter; founder of the Jamie Oliver restaurant group.",
      },
      {
        name: "Angela Hartnett",
        bio: "Celebrity chef; runs restaurants in London including Murano in Mayfair.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-club-photographer-london-2026",
    nominees: [
      {
        name: "Aiyush 'Yushy' Pachnanda",
        bio: "London photographer whose photobook Section 63 documents the capital's underground rave scene.",
      },
      {
        name: "Jaime Cano",
        bio: "Photographer who has documented London's underground rave scene.",
      },
      {
        name: "Teddy Fitzhugh",
        bio: "Photographer of London club nights whose work appears in the Club Archive series.",
      },
      {
        name: "Sarah Ginn",
        bio: "One of fabric's in-house photographers; her club photography featured in the House of Vans exhibition raising money for fabric's #SaveOurCulture campaign.",
      },
      {
        name: "Nick Ensing",
        bio: "One of fabric's in-house photographers; his club photography featured in the House of Vans exhibition raising money for fabric's #SaveOurCulture campaign.",
      },
      {
        name: "Danny Seaton",
        bio: "One of fabric's in-house photographers; his club photography featured in the House of Vans exhibition raising money for fabric's #SaveOurCulture campaign.",
      },
      {
        name: "Anna Mills",
        bio: "One of fabric's in-house photographers; her club photography featured in the House of Vans exhibition raising money for fabric's #SaveOurCulture campaign.",
      },
      {
        name: "Emilie Pria",
        bio: "One of fabric's in-house photographers; her club photography featured in the House of Vans exhibition raising money for fabric's #SaveOurCulture campaign.",
      },
      {
        name: "Evie Williams",
        bio: "One of fabric's in-house photographers; her club photography featured in the House of Vans exhibition raising money for fabric's #SaveOurCulture campaign.",
      },
      {
        name: "David Koppel",
        bio: "Photographed the Limelight's 1980s London club scene; the work was later compiled in a photo book.",
      },
      {
        name: "Mark McNulty",
        bio: "Photographer of the 90s UK house and rave scene, including Ministry of Sound and superclub culture.",
      },
      {
        name: "Rae Tait",
        bio: "Photographer behind the landmark group portrait of eight of London's leading queer nightlife collectives.",
      },
      {
        name: "Gavin Mills",
        bio: "Photographer credited on photography of a sold-out Glitterbox party at Ministry of Sound.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-cocktail-creator-london-2026",
    nominees: [
      {
        name: "Jack Sotti",
        bio: "London bartender and cocktail creator, known for his online cocktail videos.",
      },
      {
        name: "Nigel Kabvina",
        bio: "London-based mixologist and TikTok cocktail creator.",
      },
      {
        name: "Giorgio Bargiani",
        bio: "Head bartender at the Connaught Bar in Mayfair, London; named Bartenders' Bartender at Europe's 50 Best Bars 2026.",
      },
      {
        name: "Remy Savage",
        bio: "London bartender and bar owner; opened the Bauhaus Warehaus bar in London.",
      },
      {
        name: "Monica Berg",
        bio: "London-based bartender; co-owner of Tayēr + Elementary in London, named the world's best bar two years in a row.",
      },
      {
        name: "Alex Kratena",
        bio: "London-based bartender; co-owner of Tayēr + Elementary in London, named the world's best bar two years in a row.",
      },
      {
        name: "Ryan Chetiyawardana",
        bio: "London bartender known as Mr Lyan; founder of the Lyaness bar in London.",
      },
      {
        name: "Max Venning",
        bio: "London bartender; co-founder of the Three Sheets cocktail bar in Dalston.",
      },
      {
        name: "Noel Venning",
        bio: "London bartender; co-founder of the Three Sheets cocktail bar in Dalston.",
      },
      {
        name: "Angelos Bafas",
        bio: "London bartender featured in The Times' guide to the city's cocktail bars.",
      },
      {
        name: "Simone Caporale",
        bio: "London-based bartender named among the world's ten best bartenders.",
      },
      {
        name: "Matt Whiley",
        bio: "London bartender and cocktail creator.",
      },
      {
        name: "Tony Conigliaro",
        bio: "London cocktail creator; his drinks take centre stage at Bar Termini in Soho, London.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-comedian-london-2026",
    nominees: [
      {
        name: "Jimmy Carr",
        bio: "Stand-up touring the UK in 2025; host of 8 Out of 10 Cats.",
      },
      {
        name: "Michael McIntyre",
        bio: "London-born stand-up and host of Michael McIntyre's Big Show.",
      },
      {
        name: "Mo Gilligan",
        bio: "Stand-up and TV host with a 2025 UK live tour.",
      },
      {
        name: "Lou Sanders",
        bio: "Stand-up with a 2025 UK live tour.",
      },
      {
        name: "Babatunde Aléshé",
        bio: "Stand-up and actor with a 2025 UK live tour.",
      },
      {
        name: "James Acaster",
        bio: "Stand-up touring the UK in 2026 with a brand new show.",
      },
      {
        name: "Romesh Ranganathan",
        bio: "Stand-up announcing a 2027 arena tour including London's O2; co-host of Wolf and Owl.",
      },
      {
        name: "Russell Howard",
        bio: "Stand-up touring the UK with his latest show.",
      },
      {
        name: "Tom Davis",
        bio: "Stand-up and creator/star of King Gary; co-host of Wolf and Owl with Romesh Ranganathan.",
      },
      {
        name: "Jack Whitehall",
        bio: "Arena-touring stand-up; his Bad Influence tour played UK arenas.",
      },
      {
        name: "Ed Gamble",
        bio: "Stand-up and co-host of the Off Menu podcast.",
      },
      {
        name: "Rob Beckett",
        bio: "Stand-up and co-host of the Parenting Hell podcast.",
      },
      {
        name: "Josh Widdicombe",
        bio: "Stand-up and co-host of the Parenting Hell podcast.",
      },
      {
        name: "Nish Kumar",
        bio: "Stand-up and co-host of the Pod Save the UK podcast.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-comedy-creator-london-2026",
    nominees: [
      {
        name: "Munya Chawawa",
        bio: "British-Zimbabwean comedian known for satirical sketch characters; Taskmaster contestant.",
      },
      {
        name: "Harry Pinero",
        bio: "Peckham-born comedy creator known for street-interview sketches.",
      },
      {
        name: "Stephen Tries",
        bio: "British sketch comedy creator known for short character videos.",
      },
      {
        name: "Italian Bach",
        bio: "British comedy TikToker with around 2.4M followers.",
      },
      {
        name: "MC Hammersmith",
        bio: "London comedy-rapper character performing freestyle videos.",
      },
      {
        name: "Amelia Dimoldenberg",
        bio: "Creator and host of the interview series Chicken Shop Date.",
      },
      {
        name: "GK Barry",
        bio: "British comedy TikToker; I'm a Celebrity 2024 contestant.",
      },
      {
        name: "Nella Rose",
        bio: "London comedy creator and TV presenter.",
      },
      {
        name: "Chunkz",
        bio: "London creator known for prank and challenge comedy videos.",
      },
      {
        name: "Niko Omilana",
        bio: "Viral prank video creator and Beta Squad founder.",
      },
      {
        name: "Darkest Man",
        bio: "London comedy creator and Beta Squad affiliate.",
      },
      {
        name: "Calfreezy",
        bio: "London creator and Fellas Studios co-founder; comedy and lifestyle videos.",
      },
      {
        name: "Theo Baker",
        bio: "London creator and Fellas Studios member.",
      },
      {
        name: "KingKenny",
        bio: "Beta Squad comedy creator and Misfits boxer.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-comedy-podcast-host-london-2026",
    nominees: [
      {
        name: "Rob Beckett",
        bio: "Co-host of Parenting Hell, the UK's No.1 comedy podcast.",
      },
      {
        name: "Josh Widdicombe",
        bio: "Co-host of Parenting Hell, the UK's No.1 comedy podcast.",
      },
      {
        name: "Ed Gamble",
        bio: "Co-host of Off Menu with James Acaster.",
      },
      {
        name: "James Acaster",
        bio: "Co-host of Off Menu with Ed Gamble.",
      },
      {
        name: "Andy Zaltzman",
        bio: "Host of the satirical news podcast The Bugle.",
      },
      {
        name: "Richard Herring",
        bio: "Host of Richard Herring's Leicester Square Theatre Podcast.",
      },
      {
        name: "Jamie Morton",
        bio: "Host of My Dad Wrote A Porno.",
      },
      {
        name: "Romesh Ranganathan",
        bio: "Host of Hip Hop Saved My Life.",
      },
      {
        name: "Nish Kumar",
        bio: "Co-host of Pod Save the UK with Coco Khan.",
      },
      {
        name: "GK Barry",
        bio: "Host of the Saving Grace podcast.",
      },
      {
        name: "Amelia Dimoldenberg",
        bio: "Host of the Chicken Shop Date podcast.",
      },
      {
        name: "Dan Schreiber",
        bio: "Host of the fact-based comedy podcast No Such Thing As A Fish.",
      },
      {
        name: "James Harkin",
        bio: "Host of the fact-based comedy podcast No Such Thing As A Fish.",
      },
      {
        name: "William Hanson",
        bio: "Co-host of Help I Sexted My Boss with Jordan North.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-dancehall-dj-london-2026",
    nominees: [
      {
        name: "Becca Dudley",
        bio: "International reggae and dancehall DJ with appearances at Glastonbury, Notting Hill Carnival, City Splash and Reggaeland.",
      },
      {
        name: "Linett Kamala",
        bio: "Longstanding sound-system DJ associated with Notting Hill Carnival.",
      },
      {
        name: "Seani B",
        bio: "Host of BBC Radio 1Xtra's Dancehall Show.",
      },
      {
        name: "Robbo Ranx",
        bio: "UK dancehall and reggae DJ who presented on BBC Radio 1Xtra for 12 years.",
      },
      {
        name: "David Rodigan",
        bio: "Veteran reggae broadcaster and BBC Radio 1Xtra presenter.",
      },
      {
        name: "The Heatwave",
        bio: "London dancehall duo Gabriel and Benjamin, described as London's finest selectors, who held the first dancehall show on pirate-era Rinse FM and run the Hot Wuk parties.",
      },
      {
        name: "DJ FEMSTAR",
        bio: "London DJ whose listed styles include dancehall and reggae, with a KOKO residency.",
      },
      {
        name: "GAWDX",
        bio: "London open-format DJ specialising in dancehall and soca.",
      },
      {
        name: "DJ Spade",
        bio: "London DJ with Notting Hill Carnival and Berlin Carnival appearances.",
      },
      {
        name: "Ras Kwame",
        bio: "Capital Xtra DJ who hosts the weekly Reggae Recipe chart show covering reggae and dancehall.",
      },
      {
        name: "DJ Prime",
        bio: "Guest selector on Seani B's BBC Radio 1Xtra Dancehall Show.",
      },
      {
        name: "Tash LC",
        bio: "London-based NTS resident whose sets blend dancehall with Afro-jazz, highlife, kuduro and gqom.",
      },
      {
        name: "Silent Addy & Disco Neil",
        bio: "Bashment Sound duo who joined NTS Radio as new residents in summer 2025.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-dancer-london-2026",
    nominees: [
      {
        name: "Shirley Ballas",
        bio: "Head judge on Strictly Come Dancing.",
      },
      {
        name: "Motsi Mabuse",
        bio: "Judge on Strictly Come Dancing.",
      },
      {
        name: "Anton Du Beke",
        bio: "Judge on Strictly Come Dancing and former professional dancer.",
      },
      {
        name: "Craig Revel Horwood",
        bio: "Judge on Strictly Come Dancing.",
      },
      {
        name: "Dianne Buswell",
        bio: "Strictly Come Dancing professional; won the 2024 series with Chris McCausland.",
      },
      {
        name: "Vito Coppola",
        bio: "Strictly Come Dancing professional dancer.",
      },
      {
        name: "Nikita Kuzmin",
        bio: "Strictly Come Dancing professional dancer.",
      },
      {
        name: "Gorka Marquez",
        bio: "Strictly Come Dancing professional dancer.",
      },
      {
        name: "Johannes Radebe",
        bio: "Strictly Come Dancing professional dancer.",
      },
      {
        name: "Katya Jones",
        bio: "Strictly Come Dancing professional dancer.",
      },
      {
        name: "Nadiya Bychkova",
        bio: "Strictly Come Dancing professional dancer.",
      },
      {
        name: "Amy Dowden",
        bio: "Strictly Come Dancing professional dancer.",
      },
      {
        name: "Karen Hauer",
        bio: "Strictly Come Dancing professional dancer.",
      },
      {
        name: "Neil Jones",
        bio: "Strictly Come Dancing professional dancer.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-derby-player-london-2026",
    nominees: [
      {
        name: "Harry Kane",
        bio: "All-time leading Premier League scorer in north London derbies (10 goals in his first 10 against Arsenal).",
      },
      {
        name: "Thierry Henry",
        bio: "Arsenal legend with a record 43 goals in London derbies.",
      },
      {
        name: "Emmanuel Adebayor",
        bio: "Scored 8 north London derby goals, for both Arsenal and Tottenham.",
      },
      {
        name: "Robert Pires",
        bio: "Scored 7 north London derby goals for Arsenal.",
      },
      {
        name: "Gareth Bale",
        bio: "Scored 5 north London derby goals for Tottenham.",
      },
      {
        name: "Robin van Persie",
        bio: "Scored 25 London derby goals for Arsenal.",
      },
      {
        name: "Son Heung-min",
        bio: "Scored 22 London derby goals for Tottenham.",
      },
      {
        name: "Frank Lampard",
        bio: "Scored 32 London derby goals for Chelsea.",
      },
      {
        name: "Teddy Sheringham",
        bio: "Scored 32 London derby goals across spells with Tottenham and West Ham.",
      },
      {
        name: "Jermain Defoe",
        bio: "Scored 28 London derby goals for West Ham and Tottenham.",
      },
      {
        name: "Ian Wright",
        bio: "Scored 28 London derby goals for Arsenal and West Ham.",
      },
      {
        name: "Didier Drogba",
        bio: "Scored 23 London derby goals for Chelsea, including 8 against Arsenal.",
      },
      {
        name: "Pierre-Emerick Aubameyang",
        bio: "Scored 14 London derby goals for Arsenal.",
      },
      {
        name: "Bukayo Saka",
        bio: "Scored 13 London derby goals for Arsenal.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-drag-performer-london-2026",
    nominees: [
      {
        name: "Baga Chipz",
        bio: "East London drag artist; finished 3rd on RuPaul's Drag Race UK series 1.",
      },
      {
        name: "Divina de Campo",
        bio: "Drag artist from Brighouse; runner-up on RuPaul's Drag Race UK series 1.",
      },
      {
        name: "Cheryl Hole",
        bio: "Drag artist from Chelmsford; finished 4th on RuPaul's Drag Race UK series 1.",
      },
      {
        name: "Bimini Bon-Boulash",
        bio: "Drag artist from Great Yarmouth; runner-up on RuPaul's Drag Race UK series 2.",
      },
      {
        name: "Tayce",
        bio: "Drag artist from Newport; competed on RuPaul's Drag Race UK series 2.",
      },
      {
        name: "Tia Kofi",
        bio: "South London drag artist; finished 7th on RuPaul's Drag Race UK series 2.",
      },
      {
        name: "Asttina Mandella",
        bio: "East London drag artist; competed on RuPaul's Drag Race UK series 2.",
      },
      {
        name: "Krystal Versace",
        bio: "Winner of RuPaul's Drag Race UK series 3.",
      },
      {
        name: "Ella Vaday",
        bio: "Drag artist from Dagenham; runner-up on RuPaul's Drag Race UK series 3.",
      },
      {
        name: "Vanity Milan",
        bio: "South London drag artist; finished 4th on RuPaul's Drag Race UK series 3.",
      },
      {
        name: "Danny Beard",
        bio: "Winner of RuPaul's Drag Race UK series 4.",
      },
      {
        name: "Cheddar Gorgeous",
        bio: "Manchester drag artist; runner-up on RuPaul's Drag Race UK series 4.",
      },
      {
        name: "Cara Melle",
        bio: "London drag artist; finished 6th on RuPaul's Drag Race UK series 5.",
      },
      {
        name: "Kyran Thrax",
        bio: "Winner of RuPaul's Drag Race UK series 6.",
      },
      {
        name: "Bones",
        bio: "London drag artist; winner of RuPaul's Drag Race UK series 7.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-drill-artist-london-2026",
    nominees: [
      {
        name: "163Margs",
        bio: "Nominated for Best Drill Act at the 2025 MOBO Awards.",
      },
      {
        name: "Central Cee",
        bio: "His album 'Can't Rush Greatness' became his second UK No.1 album and reached No.9 on the Billboard 200.",
      },
      {
        name: "Headie One",
        bio: "'Edna' was the first UK drill album to reach No.1 on the UK Albums Chart.",
      },
      {
        name: "Kairo Keyz",
        bio: "Nominated for Best Drill Act at the 2025 MOBO Awards.",
      },
      {
        name: "K-Trap",
        bio: "His collaborative album 'Strength to Strength' with Headie One reached No.4 on the UK Albums Chart and topped the UK Hip-Hop/R&B chart.",
      },
      {
        name: "Pozer",
        bio: "Won Best Drill Act at the 2025 MOBO Awards. His single 'Kitchen Stove' has around 43 million Spotify streams.",
      },
      {
        name: "Digga D",
        bio: "His single 'Woi' was nominated for Song of the Year at the 2020 MOBO Awards.",
      },
      {
        name: "Unknown T",
        bio: "'Homerton B' reached No.48 in the UK and became the first UK drill track certified Silver by the BPI.",
      },
      {
        name: "M24",
        bio: "His single 'We Don't Dance' is BPI Silver-certified; his single 'London' reached No.32 in the UK.",
      },
      {
        name: "Kwengface",
        bio: "The Peckham veteran made his third appearance on Daily Duppy in 2026.",
      },
      {
        name: "Blanco",
        bio: "The former Harlem Spartans member released the projects 'English Dubbed' and 'City of God'.",
      },
      {
        name: "Loski",
        bio: "The former Harlem Spartans member's single 'Call Me Loose' reached the UK Top 50.",
      },
      {
        name: "Abra Cadabra",
        bio: "His single 'On Deck' was nominated for Song of the Year at the 2020 MOBO Awards.",
      },
      {
        name: "67",
        bio: "Their tracks 'Skengman' and 'Take It There' and the mixtape 'In Skengs We Trust' helped define the early UK drill sound.",
      },
      {
        name: "Russ Millions",
        bio: "'Body' with Tion Wayne was the first UK drill single to reach No.1 on the Official UK Singles Chart. He released 'Bike Back' in May 2026.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-emerging-actor-london-2026",
    nominees: [
      {
        name: "Ambika Mod",
        bio: "Co-lead of Netflix's One Day (2024).",
      },
      {
        name: "Leo Woodall",
        bio: "Co-lead of Netflix's One Day (2024).",
      },
      {
        name: "India Amarteifio",
        bio: "Played the young Queen Charlotte in Netflix's Queen Charlotte: A Bridgerton Story.",
      },
      {
        name: "Corey Mylchreest",
        bio: "Played the young King George in Queen Charlotte: A Bridgerton Story.",
      },
      {
        name: "Arsema Thomas",
        bio: "Played the young Lady Danbury in Queen Charlotte: A Bridgerton Story.",
      },
      {
        name: "David Jonsson",
        bio: "Won the 2025 EE BAFTA Rising Star Award; starred in Industry, Rye Lane and Alien: Romulus.",
      },
      {
        name: "Mia McKenna-Bruce",
        bio: "Won the 2024 EE BAFTA Rising Star Award for How to Have Sex.",
      },
      {
        name: "Vivian Oparah",
        bio: "Won a British Independent Film Award for Rye Lane (2023) and earned a BAFTA nomination.",
      },
      {
        name: "Aaron Pierre",
        bio: "Starred in Netflix's Rebel Ridge (2024) and voiced Mufasa in Mufasa: The Lion King.",
      },
      {
        name: "Ella Purnell",
        bio: "Leads Prime Video's Fallout and Sky's Sweetpea.",
      },
      {
        name: "Tom Blyth",
        bio: "Played young Coriolanus Snow in The Hunger Games prequel and leads Billy the Kid.",
      },
      {
        name: "Kit Connor",
        bio: "Plays Nick Nelson in Netflix's Heartstopper.",
      },
      {
        name: "Joe Locke",
        bio: "Plays Charlie Spring in Netflix's Heartstopper.",
      },
      {
        name: "Marisa Abela",
        bio: "2025 EE Rising Star nominee; starred as Amy Winehouse in Back to Black.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-fan-channel-host-london-2026",
    nominees: [
      {
        name: "Robbie Lyle",
        bio: "Founder and owner of AFTV (2012); pioneered supporter-led fan TV in the UK.",
      },
      {
        name: "Troopz",
        bio: "Former AFTV contributor; his 2017 rant after Arsenal's 5–1 Champions League defeat to Bayern Munich went viral.",
      },
      {
        name: "Lee Judges (Lee Gunner)",
        bio: "AFTV regular, often hosting the post-match fan interviews outside the Emirates.",
      },
      {
        name: "Mark Goldbridge",
        bio: "Founded The United Stand in 2014; his channels have a combined audience of 3.7M and were acquired by Gary Neville's The Overlap.",
      },
      {
        name: "Adam McKola",
        bio: "Manchester United fan creator and contributor to The United Stand.",
      },
      {
        name: "Stephen Howson",
        bio: "Founder of Stretford Paddock, the Man United fan channel that succeeded Full Time Devils.",
      },
      {
        name: "Paul Machin",
        bio: "Co-founder of The Redmen TV, the pioneering Liverpool fan-led YouTube channel.",
      },
      {
        name: "Chris Pajak",
        bio: "Co-founder of The Redmen TV alongside Paul Machin.",
      },
      {
        name: "Neil Atkinson",
        bio: "Founder of The Anfield Wrap, Liverpool's fan media network of podcasts and live shows.",
      },
      {
        name: "Statman Dave",
        bio: "Man United data creator; poached by MUTV.",
      },
      {
        name: "Drawty (Ben)",
        bio: "Long-standing member of The United Stand team.",
      },
      {
        name: "Rory Jennings",
        bio: "Chelsea fan creator; regular on talkSPORT and fan-debate shows.",
      },
      {
        name: "Chris Cowlin",
        bio: "Host of the Spurs Chat podcast; won Best Club Content Creator at the 2019 Football Blogging Awards.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-fashion-tiktoker-london-2026",
    nominees: [
      {
        name: "Lydia Millen",
        bio: "UK fashion creator — ~920k TikTok followers.",
      },
      {
        name: "Victoria Magrath",
        bio: "UK fashion creator — ~671k TikTok followers.",
      },
      {
        name: "Lara Adkins",
        bio: "UK fashion creator — ~689k TikTok followers.",
      },
      {
        name: "Maddie Close (Style With Maddi)",
        bio: "UK fashion creator — ~809k TikTok followers.",
      },
      {
        name: "Sinead Biddlecombe",
        bio: "UK fashion creator — ~365k TikTok followers.",
      },
      {
        name: "Imogen Cribb",
        bio: "UK fashion creator — ~315k TikTok followers.",
      },
      {
        name: "Lucy Appleton",
        bio: "UK fashion creator — ~710k TikTok followers.",
      },
      {
        name: "Beth Bartram",
        bio: "UK fashion creator — ~141k TikTok followers.",
      },
      {
        name: "Emily Shak",
        bio: "UK fashion creator — ~218k TikTok followers.",
      },
      {
        name: "Esi (SerendipEsi)",
        bio: "UK fashion creator — ~157k TikTok followers.",
      },
      {
        name: "Olivia Hirst",
        bio: "UK fashion creator — ~147k TikTok followers.",
      },
      {
        name: "Yasmin Devonport",
        bio: "UK fashion creator — ~89k TikTok followers.",
      },
      {
        name: "Agnes Pusztai (WhatGigiWears)",
        bio: "London-based fashion creator — ~668k Instagram and ~88k TikTok followers.",
      },
      {
        name: "Strateraa",
        bio: "London fashion TikToker and vintage streetwear seller.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-food-creator-london-2026",
    nominees: [
      {
        name: "Nigella Lawson",
        bio: "British food writer and television cook based in London; author of bestselling cookbooks and host of BBC cooking programmes.",
      },
      {
        name: "Yotam Ottolenghi",
        bio: "Israeli-British chef, restaurateur and cookbook author based in London; founder of the Ottolenghi delis and restaurants.",
      },
      {
        name: "Rachel Ama",
        bio: "London-based vegan food creator and cookbook author, known for sharing plant-based recipes with a large online audience.",
      },
      {
        name: "John Gregory-Smith",
        bio: "London-based food writer, chef and cookbook author, known for recipes from the Middle East and beyond.",
      },
      {
        name: "Craig and Shaun McAnuff (Original Flava)",
        bio: "Brothers behind Original Flava, the London-based Caribbean food brand; authors of Caribbean cookbooks.",
      },
      {
        name: "Gabie Kook",
        bio: "London-based food creator and chef, known for her YouTube cooking channel and links to London restaurants.",
      },
      {
        name: "Kate Ovens",
        bio: "London-based TikTok creator known for extreme food challenge videos, including collaborations with London restaurants.",
      },
      {
        name: "Thomas Straker",
        bio: "London-based chef and food creator, known for his cooking videos and bestselling cookbook.",
      },
      {
        name: "Rosie Birkett",
        bio: "London-based food writer, chef and stylist; author of cookbooks and former restaurant critic.",
      },
      {
        name: "Max La Manna",
        bio: "London-based vegan chef and cookbook author, known for low-waste plant-based recipes shared online.",
      },
      {
        name: "BOSH!",
        bio: "London-based vegan food brand founded by Henry Firth and Ian Theasby; authors of bestselling plant-based cookbooks with a large online following.",
      },
      {
        name: "Sorted Food",
        bio: "London-based online food community and YouTube channel run by a group of friends sharing recipes and food challenges.",
      },
      {
        name: "Gizzi Erskine",
        bio: "London-born chef, food writer and television presenter, known for her YouTube food series and newspaper columns.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-football-creator-london-2026",
    nominees: [
      {
        name: "KSI",
        bio: "Sidemen co-founder with 24.8M YouTube subscribers; rose to fame on FIFA gameplay videos before expanding into music and boxing.",
      },
      {
        name: "Chunkz",
        bio: "Beta Squad member; football challenge videos and appearances in the Match for Hope charity football matches (2024–2026).",
      },
      {
        name: "Theo Baker",
        bio: "Arsenal fan YouTuber known for football challenges with professionals, including a skills video with Alisha Lehmann.",
      },
      {
        name: "W2S (Harry Lewis)",
        bio: "Sidemen member; FIFA and football content, and a regular in the Sidemen Charity Match lineups.",
      },
      {
        name: "Miniminter (Simon Minter)",
        bio: "Sidemen member; Sunday League football series and the Sidemen Charity Match's record goalscorer.",
      },
      {
        name: "Zerkaa (Josh Zerker)",
        bio: "Sidemen co-founder; FIFA gaming content and a regular Sidemen Charity Match player.",
      },
      {
        name: "TBJZL (Tobi Brown)",
        bio: "Sidemen member; scored in the 2018 Sidemen Charity Match at The Valley.",
      },
      {
        name: "Behzinga (Ethan Payne)",
        bio: "Sidemen member and lifelong West Ham fan; scored at the London Stadium in the 2023 Sidemen Charity Match.",
      },
      {
        name: "Spencer Owen",
        bio: "Founded Hashtag United after building a football audience through his Spencer FC YouTube channel, launched in 2013.",
      },
      {
        name: "ChrisMD",
        bio: "London-based YouTuber (6.3M+ subscribers) known for FIFA gameplay and football challenge videos; an Arsenal supporter.",
      },
      {
        name: "Manny (FIFAManny)",
        bio: "FIFA and football YouTuber; scored twice for Sidemen FC in the 2016 Sidemen Charity Match.",
      },
      {
        name: "Yung Filly",
        bio: "Beta Squad member; played in the 2023 Sidemen Charity Match and Match for Hope football content.",
      },
      {
        name: "Mark Goldbridge",
        bio: "Man United fan creator who founded The United Stand in 2014; his That's Football channel secured Bundesliga broadcast rights for the UK.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-football-freestyler-london-2026",
    nominees: [
      {
        name: "Lia Lewis",
        bio: "British freestyler; Red Bull Street Style women's world champion in 2021.",
      },
      {
        name: "John Farnworth",
        bio: "British freestyler and multiple world record holder.",
      },
      {
        name: "Andrew Henderson",
        bio: "English freestyler; won the World Freestyle Football Championship in Malaysia in 2011.",
      },
      {
        name: "Séan Garnier",
        bio: "French freestyler; two-time freestyle world champion and Red Bull athlete.",
      },
      {
        name: "Mélody Donchet",
        bio: "French freestyler; six-time freestyle football world championship winner.",
      },
      {
        name: "Liv Cooke",
        bio: "British freestyler; former freestyle world champion and five-time world record holder.",
      },
      {
        name: "Erlend Fagerli",
        bio: "Norwegian freestyler; record three-time Red Bull Street Style men's world champion.",
      },
      {
        name: "Kitti Szász",
        bio: "Hungarian freestyler; two-time Red Bull Street Style women's world champion.",
      },
      {
        name: "Aguska Mnich",
        bio: "Polish freestyler; 2021 Red Bull Street Style women's world finalist.",
      },
      {
        name: "Caitlyn Schrepfer",
        bio: "American freestyler; 2021 Red Bull Street Style women's world semi-finalist.",
      },
      {
        name: "Jesse Marlet",
        bio: "Freestyler; 2021 Red Bull Street Style men's world finalist.",
      },
      {
        name: "Billy Wingrove",
        bio: "English freestyler; co-founder of the F2 Freestylers, whose YouTube channel has 14M subscribers.",
      },
      {
        name: "Jeremy Lynch",
        bio: "English freestyler; co-founder of the F2 Freestylers alongside Billy Wingrove.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-fpl-creator-london-2026",
    nominees: [
      {
        name: "Andy (Let's Talk FPL)",
        bio: "Runs the Let's Talk FPL channel, with 450k+ YouTube subscribers.",
      },
      {
        name: "Ben Crellin",
        bio: "FPL fixture-planner known for his planning spreadsheets; on a run of six straight top-10k finishes.",
      },
      {
        name: "FPL Focal",
        bio: "FPL creator who was briefly ranked #1 in the world at the game.",
      },
      {
        name: "FPL Harry",
        bio: "FPL YouTuber with 200k+ subscribers; five straight top-10k finishes.",
      },
      {
        name: "Big Man Bakar",
        bio: "FPL content creator; regular on Fantasy Football Hub's gameweek team-reveal shows.",
      },
      {
        name: "Az (FPL BlackBox)",
        bio: "Host of the FPL BlackBox show and an official FPL pundit.",
      },
      {
        name: "Pras (The FPL Wire)",
        bio: "The FPL Wire co-host; BBC Sport live FPL pundit and Fantasy Football Scout pro-pundit.",
      },
      {
        name: "Mark (FPL General)",
        bio: "Fantasy Football Scout's FPL General; hosts a weekly team-selection show.",
      },
      {
        name: "Ross (FPL Raptor)",
        bio: "FPL Raptor; a community favourite known for humble, analytical FPL content.",
      },
      {
        name: "Lateriser",
        bio: "The FPL Wire co-host with three top-200 overall finishes.",
      },
      {
        name: "Lee & Sam (FPL Family)",
        bio: "Hosts of the FPL Family chat show and podcast covering Fantasy Premier League.",
      },
      {
        name: "FPL Mate",
        bio: "FPL YouTuber and team-reveal creator; a fixture of community discussion each gameweek.",
      },
      {
        name: "Planet FPL",
        bio: "Long-running FPL podcast; a staple Monday listen in the community.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-grime-mc-london-2026",
    nominees: [
      {
        name: "Chip",
        bio: "Nominated for Best Grime Act at the 2025 MOBO Awards.",
      },
      {
        name: "D Double E",
        bio: "A former MOBO Best Grime Act winner, nominated again in 2025. Best known for 'Street Fighter Riddim', one of grime's most recognised instrumentals.",
      },
      {
        name: "Duppy",
        bio: "Nominated for Best Grime Act at the 2025 MOBO Awards.",
      },
      {
        name: "Kruz Leone",
        bio: "Nominated for Best Grime Act at the 2025 MOBO Awards.",
      },
      {
        name: "Manga Saint Hilare",
        bio: "Nominated for Best Grime Act at the 2025 MOBO Awards; previously shortlisted in the category at the 2020 MOBOs.",
      },
      {
        name: "Scorcher",
        bio: "Nominated for Best Grime Act at the 2025 MOBO Awards.",
      },
      {
        name: "Ghetts",
        bio: "His 2021 album 'Conflict of Interest' reached No.2 on the UK Albums Chart. He was shortlisted for Best Grime Act at the 2020 MOBO Awards.",
      },
      {
        name: "Stormzy",
        bio: "His debut album 'Gang Signs & Prayer' hit No.1 in the UK and won the BRIT Award for Album of the Year.",
      },
      {
        name: "Skepta",
        bio: "His album 'Konnichiwa' won the 2016 Mercury Prize.",
      },
      {
        name: "Jme",
        bio: "His debut album 'Integrity>' reached No.12 on the UK Albums Chart. He won Best Grime Act at the 2020 MOBO Awards.",
      },
      {
        name: "Kano",
        bio: "His album 'Made in the Manor' reached No.8 in the UK, was shortlisted for the Mercury Prize and won MOBO Best Album.",
      },
      {
        name: "P Money",
        bio: "The New Cross grime MC took part in Lord of the Mics 6 and was shortlisted for Best Grime Act at the 2020 MOBO Awards.",
      },
      {
        name: "Dizzee Rascal",
        bio: "His debut album 'Boy in da Corner' won the 2003 Mercury Prize.",
      },
      {
        name: "Frisco",
        bio: "The Tottenham-born BBK member released the album 'System Killer'.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-kpop-dancer-london-2026",
    nominees: [
      {
        name: "Cherrie",
        bio: "London-based K-pop cover dancer with HKZ Dance, appearing in the crew's covers of ILLIT's \"It's Me\", BLACKPINK's \"Don't Know What To Do\" and VIVIZ's \"SHHH!\". She placed fifth in the solo dance category at the New Malden K-pop Awards 2025.",
      },
      {
        name: "Hermione",
        bio: "K-pop cover dancer active in London who dances with HKZ Dance and led a documented London cover of TWICE's \"Heart Shaker\" with eight other dancers.",
      },
      {
        name: "Hayden",
        bio: "K-pop cover dancer with HKZ Dance in London, appearing in the crew's covers of BLACKPINK's \"Don't Know What To Do\" alongside Anet, Nati and Cherrie.",
      },
      {
        name: "Anet",
        bio: "K-pop cover dancer with HKZ Dance in London, appearing in the crew's cover of BLACKPINK's \"Don't Know What To Do\".",
      },
      {
        name: "Nati",
        bio: "K-pop cover dancer with HKZ Dance in London, appearing in the crew's cover of BLACKPINK's \"Don't Know What To Do\".",
      },
      {
        name: "Spriha",
        bio: "Dancer with London K-pop cover crew IGNITE, appearing in the crew's covers of NewJeans' \"Ditto\" and \"ETA\".",
      },
      {
        name: "Shana",
        bio: "Member of London K-pop cover crew KWD Crew, appearing in the crew's covers of BTS' \"Swim\" and EXO's \"Crown\".",
      },
      {
        name: "Zosia",
        bio: "London K-pop cover dancer who project-led KWD Crew's cover of EXO's \"Crown\" and dances with ECHO Crew, appearing in their cover of ILLIT's \"It's Me\".",
      },
      {
        name: "Skylar",
        bio: "London K-pop cover dancer with Cromer Crew, appearing in the crew's seven-member cover of XG's \"Hypnotize\".",
      },
      {
        name: "JUJU",
        bio: "UK-based dance creator whose TikTok videos surpassed 7 million views and who served as a judge at the New Malden K-pop Awards 2025.",
      },
      {
        name: "Vi",
        bio: "London-based K-pop cover dancer appearing in a documented London cover of Hearts2Hearts' \"Lemon Tang\" alongside Zosia, Amelie, Louis, Sophie, Gracie, Gladys and Ailani.",
      },
      {
        name: "Jamie",
        bio: "London K-pop cover dancer with ECHO Crew, appearing in the crew's five-member cover of ILLIT's \"It's Me\".",
      },
      {
        name: "Bartek",
        bio: "London K-pop cover dancer with HKZ Dance, appearing in the crew's cover of ILLIT's \"It's Me\" alongside Cherrie, Viola, Aimee and Theo.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-livestream-dj-london-2026",
    nominees: [
      {
        name: "DJ AG Online",
        bio: "UK DJ whose TikTok live sessions promote his London activity and AG Fest.",
      },
      {
        name: "DJ Katty London",
        bio: "DJ broadcasting live sets on TikTok Live.",
      },
      {
        name: "R3WIRE",
        bio: "Runs weekly livestreamed house and tech DJ sets on YouTube with four-deck mixing.",
      },
      {
        name: "DJ EZ",
        bio: "UK garage DJ whose marathon 24-hour sets were livestreamed via Boiler Room and Defected, raising money for the Mind charity.",
      },
      {
        name: "DJ Majestic",
        bio: "KISS FM DJ who played the virtual KISSFest across three virtual stages.",
      },
      {
        name: "Horse Meat Disco",
        bio: "Disco DJ collective who played livestreamed lockdown sets for United We Stream and Glitterbox's We Dance As One.",
      },
      {
        name: "John B",
        bio: "UK drum & bass DJ and producer who streams DJ sets three nights a week on Twitch.",
      },
      {
        name: "Sam Divine",
        bio: "UK house DJ who played Defected's 12-hour Virtual Festival livestream.",
      },
      {
        name: "Floating Points",
        bio: "London-based producer and DJ whose set aired via Boiler Room's Streaming From Isolation series.",
      },
      {
        name: "Joey Negro",
        bio: "Veteran UK house DJ and producer who played Defected's 12-hour Virtual Festival livestream.",
      },
      {
        name: "The Heatwave",
        bio: "London dancehall duo who headlined a livestreamed Mixmag Lab carnival special.",
      },
      {
        name: "Erol Alkan",
        bio: "London-based DJ who played the United We Stream lockdown livestream.",
      },
      {
        name: "DJ Paulette",
        bio: "Veteran UK DJ who played Glitterbox's We Dance As One love stream.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-meme-page-london-2026",
    nominees: [
      {
        name: "LADbible",
        bio: "UK viral publisher with around 14M Instagram and 12.9M TikTok followers.",
      },
      {
        name: "UNILAD",
        bio: "UK-based viral media publisher known for memes, videos and trending stories.",
      },
      {
        name: "The Poke",
        bio: "British comedy website curating funny tweets, headlines and viral posts.",
      },
      {
        name: "No Context Brits",
        bio: "@NoContextBrits; posts out-of-context British photos, with around 1.8M followers on X.",
      },
      {
        name: "Very British Problems",
        bio: "@SoVeryBritish; British humour account with around 964K Instagram followers.",
      },
      {
        name: "The Daily Mash",
        bio: "British satirical news website founded in 2007, publishing spoof current-affairs stories.",
      },
      {
        name: "NewsThump",
        bio: "British spoof news website founded in 2009.",
      },
      {
        name: "Pubity",
        bio: "Meme media brand with over 37M Instagram followers, founded by British creators Kit Chilvers and Iyrah Williams.",
      },
      {
        name: "Memezar",
        bio: "Meme page with over 23M Instagram followers, part of the British-founded Pubity Group.",
      },
      {
        name: "IMJUSTBAIT",
        bio: "UK banter and meme Instagram account with around 4.8M followers.",
      },
      {
        name: "LaughsUK",
        bio: "British memes Instagram page created in mid-2020 with over 95K followers.",
      },
      {
        name: "British Moments",
        bio: "Instagram account sharing snapshots of life in the UK with British humour.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-mens-style-creator-london-2026",
    nominees: [
      {
        name: "The Everyday Man",
        bio: "UK men's style blog covering classic menswear.",
      },
      {
        name: "Charlie Irons (Man About Town)",
        bio: "Menswear creator behind the Man About Town platform.",
      },
      {
        name: "Carl Thompson",
        bio: "UK men's fashion creator.",
      },
      {
        name: "Ali Gordon",
        bio: "UK men's style creator.",
      },
      {
        name: "Simon Crompton (Permanent Style)",
        bio: "Writer behind the Permanent Style menswear publication.",
      },
      {
        name: "Efe Efeturi",
        bio: "London menswear, travel and lifestyle creator — ~508k Instagram followers.",
      },
      {
        name: "Roel Rebello",
        bio: "London menswear and lifestyle creator — ~86k Instagram followers.",
      },
      {
        name: "Daily Touch of Class",
        bio: "London menswear and lifestyle account — ~64k Instagram followers.",
      },
      {
        name: "Stanley Dru",
        bio: "Menswear creator and M&S menswear ambassador.",
      },
      {
        name: "Tim Dessaint",
        bio: "Menswear creator and M&S menswear ambassador.",
      },
      {
        name: "Nathan Griffiths",
        bio: "Menswear creator and M&S menswear ambassador.",
      },
      {
        name: "Robin James",
        bio: "London-based creator posting men's fashion and grooming street-style videos.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-music-interviewer-london-2026",
    nominees: [
      {
        name: "Amelia Dimoldenberg",
        bio: "Created and hosts Chicken Shop Date, which began by interviewing grime artists; her YouTube channel has passed three million subscribers.",
      },
      {
        name: "Zeze Millz",
        bio: "Hackney-born host of The Zeze Millz Show, interviewing Black British music figures.",
      },
      {
        name: "Julie Adenuga",
        bio: "Broadcaster who has interviewed Stormzy, Jay-Z, Skepta, Wizkid, Burna Boy and Billie Eilish.",
      },
      {
        name: "Clara Amfo",
        bio: "Former BBC Radio 1 host whose Live Lounge interviews included Jay-Z, Ariana Grande, Kendrick Lamar and Pharrell Williams.",
      },
      {
        name: "Chuckie Online",
        bio: "Host of the Halfcast Podcast, which has featured interviews with music figures.",
      },
      {
        name: "Poet",
        bio: "Broadcaster and regular Halfcast Podcast co-host covering UK music culture.",
      },
      {
        name: "DJ Semtex",
        bio: "Capital Xtra DJ and author who has interviewed Eminem, Drake and Kendrick Lamar.",
      },
      {
        name: "Manny Norte",
        bio: "Capital Xtra presenter whose weekday show features interviews with major hip-hop stars.",
      },
      {
        name: "Kenny Allstar",
        bio: "BBC Radio 1Xtra host whose Voice of the Streets series features freestyles and in-depth interviews with UK rap artists.",
      },
      {
        name: "Ras Kwame",
        bio: "Capital Xtra DJ whose Reggae Recipe show features interviews with dancehall and reggae artists.",
      },
      {
        name: "Remel London",
        bio: "Award-winning Capital Xtra presenter whose shows champion UK hip-hop, grime and Afrobeats talent.",
      },
      {
        name: "DJ Ron",
        bio: "Host of the London Something Podcast, interviewing jungle figures.",
      },
      {
        name: "Sun O.C.",
        bio: "Host of Grimey Hours, the interview series covering grime culture.",
      },
      {
        name: "Grant Body-P",
        bio: "Presenter of the RePPiN4U Hip Hop Show, conducting artist interviews.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-music-producer-london-2026",
    nominees: [
      {
        name: "Fred again..",
        bio: "Named BRIT Producer of the Year in 2020; he produced Stormzy's 'Own It' and co-produced Headie One's 'Gang' project.",
      },
      {
        name: "Fraser T. Smith",
        bio: "A Grammy winner for his work on Adele's '21'; his credits include Kano's 'Made in the Manor' and Stormzy's 'Gang Signs & Prayer'.",
      },
      {
        name: "Naughty Boy",
        bio: "His single 'La La La' featuring Sam Smith topped the UK chart; he has worked with Emeli Sandé and Beyoncé.",
      },
      {
        name: "P2J",
        bio: "Produced Burna Boy's 'Anybody' and much of Wizkid's 'Made in Lagos'; he won a Grammy for 'Twice as Tall'.",
      },
      {
        name: "JAE5",
        bio: "Executive producer of J Hus's 'Common Sense' and producer of Dave's 'Location'; a MOBO Best Producer winner.",
      },
      {
        name: "Steel Banglez",
        bio: "Produced Krept & Konan's 'Go Down South' and Mist's 'Karla's Back'.",
      },
      {
        name: "Nana Rogues",
        bio: "Produced Drake's 'Passionfruit' and 'Skepta Interlude'; his credits also span Dave, J Hus and Stormzy.",
      },
      {
        name: "Conducta",
        bio: "Produced AJ Tracey's chart hit 'Ladbroke Grove'.",
      },
      {
        name: "M1OnTheBeat",
        bio: "Produced Headie One's early projects, Digga D's 'Woi', 'Golden Boot' and the Drake/Headie One 'Only You Freestyle'.",
      },
      {
        name: "Sir Spyro",
        bio: "Produced Stormzy's 'Big for Your Boots', 'Sounds of the Skeng' and 'Topper Top'.",
      },
      {
        name: "Rymez",
        bio: "Produced Wiley's UK No.1 single 'Heatwave', which sold 114,000 copies in its first week.",
      },
      {
        name: "Ceebeaats",
        bio: "Nominated for Best Producer at the 2025 MOBO Awards; she broke through producing Digga D's Gold-certified, MOBO-nominated 'Woi'.",
      },
      {
        name: "Inflo",
        bio: "The producer behind Sault; a MOBO Best Producer winner, nominated again in 2025.",
      },
      {
        name: "Juls",
        bio: "Won Best Producer at the 2025 MOBO Awards.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-nightlife-promoter-london-2026",
    nominees: [
      {
        name: "INFERNO",
        bio: "Queer techno party collective founded by Lewis G Burton; it marked its 10th anniversary in 2025.",
      },
      {
        name: "Queer House Party",
        bio: "Queer London party collective; one of eight collectives behind a landmark joint statement on the capital's queer venue crisis.",
      },
      {
        name: "Riposte",
        bio: "Queer London party collective; one of eight collectives behind a landmark joint statement on the capital's queer venue crisis.",
      },
      {
        name: "RIOT",
        bio: "Queer London party collective; one of eight collectives behind a landmark joint statement on the capital's queer venue crisis.",
      },
      {
        name: "BUMPAH",
        bio: "Queer London party collective; one of eight collectives behind a landmark joint statement on the capital's queer venue crisis.",
      },
      {
        name: "Coven",
        bio: "Queer London party collective; one of eight collectives behind a landmark joint statement on the capital's queer venue crisis.",
      },
      {
        name: "UHAUL Dyke Rescue",
        bio: "Queer London party collective; one of eight collectives behind a landmark joint statement on the capital's queer venue crisis.",
      },
      {
        name: "PLASTYK",
        bio: "Queer London party collective; one of eight collectives behind a landmark joint statement on the capital's queer venue crisis.",
      },
      {
        name: "Pxssy Palace",
        bio: "Collective behind London's Pxssy Palace queer club night; profiled in the Dazed 100.",
      },
      {
        name: "Horse Meat Disco",
        bio: "Long-running London queer disco party collective; staged a 2026 night at Eagle London in Vauxhall.",
      },
      {
        name: "Butterz",
        bio: "Grime label and party brand founded by Elijah and Skilliam; credited with changing the blueprint for independent UK labels.",
      },
      {
        name: "Touching Bass",
        bio: "South London music community and party brand co-founded by Alex Rita and Errol Anderson.",
      },
      {
        name: "Glitterbox",
        bio: "Disco and house party brand; staged a sold-out party at Ministry of Sound.",
      },
      {
        name: "Layo Paskin",
        bio: "Co-founded the London nightclub The End with Mr C in 1995.",
      },
      {
        name: "Jeremy Joseph",
        bio: "Founder of the London gay club brand G-A-Y, which became synonymous with Saturday nights at the Astoria.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-party-host-london-2026",
    nominees: [
      {
        name: "MC GQ",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
      {
        name: "Navigator",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
      {
        name: "MC Det",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
      {
        name: "MC Fearless",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
      {
        name: "Shabba D",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
      {
        name: "Bassman",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
      {
        name: "Stamina MC",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
      {
        name: "Funsta",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
      {
        name: "Eksman",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
      {
        name: "Harry Shotta",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
      {
        name: "Dynamite MC",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
      {
        name: "IC3",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
      {
        name: "SP:MC",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-podcast-host-london-2026",
    nominees: [
      {
        name: "Steven Bartlett",
        bio: "Host of The Diary of a CEO, a chart-topping UK interview podcast.",
      },
      {
        name: "Rory Stewart",
        bio: "Co-host of The Rest Is Politics with Alastair Campbell.",
      },
      {
        name: "Alastair Campbell",
        bio: "Co-host of The Rest Is Politics with Rory Stewart.",
      },
      {
        name: "Tom Holland",
        bio: "Co-host of The Rest Is History with Dominic Sandbrook.",
      },
      {
        name: "Dominic Sandbrook",
        bio: "Co-host of The Rest Is History with Tom Holland.",
      },
      {
        name: "Peter Crouch",
        bio: "Host of That Peter Crouch Podcast.",
      },
      {
        name: "Gary Lineker",
        bio: "Co-host of The Rest Is Football with Alan Shearer and Micah Richards.",
      },
      {
        name: "Alan Shearer",
        bio: "Co-host of The Rest Is Football with Gary Lineker and Micah Richards.",
      },
      {
        name: "Micah Richards",
        bio: "Co-host of The Rest Is Football with Gary Lineker and Alan Shearer.",
      },
      {
        name: "Marina Hyde",
        bio: "Co-host of The Rest Is Entertainment with Richard Osman.",
      },
      {
        name: "Richard Osman",
        bio: "Co-host of The Rest Is Entertainment with Marina Hyde.",
      },
      {
        name: "Louis Theroux",
        bio: "Host of The Louis Theroux Podcast.",
      },
      {
        name: "Ed Gamble",
        bio: "Co-host of the food-comedy podcast Off Menu with James Acaster.",
      },
      {
        name: "James Acaster",
        bio: "Co-host of Off Menu with Ed Gamble.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-queer-nightlife-personality-london-2026",
    nominees: [
      {
        name: "Jodie Harsh",
        bio: "London DJ and nightlife personality.",
      },
      {
        name: "Princess Julia",
        bio: "London nightlife figure featured in DJHistory's Dancefloor Pride series.",
      },
      {
        name: "Glyn Fussell",
        bio: "Co-founded the London queer club night Sink The Pink with Amy Zing in 2008.",
      },
      {
        name: "Amy Zing",
        bio: "Co-founded the London queer club night Sink The Pink with Glyn Fussell in 2008.",
      },
      {
        name: "Nadine Noor Ahmad",
        bio: "Co-founder of the Pxssy Palace collective.",
      },
      {
        name: "Skye Barr",
        bio: "Co-founder of the Pxssy Palace collective.",
      },
      {
        name: "Lewis G Burton",
        bio: "Founder of the queer techno party INFERNO.",
      },
      {
        name: "Errol Anderson",
        bio: "Co-founder of the South London music community Touching Bass.",
      },
      {
        name: "Alex Rita",
        bio: "Co-founder of the South London music community Touching Bass.",
      },
      {
        name: "James Hillard",
        bio: "Member of the Horse Meat Disco DJ collective.",
      },
      {
        name: "Jim Stanton",
        bio: "Member of the Horse Meat Disco DJ collective.",
      },
      {
        name: "Luke Howard",
        bio: "Member of the Horse Meat Disco DJ collective.",
      },
      {
        name: "Severino",
        bio: "Member of the Horse Meat Disco DJ collective.",
      },
      {
        name: "Jay Jay Revlon",
        bio: "London DJ and promoter; played Glitterbox's return to London.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-radio-newcomer-london-2026",
    nominees: [
      {
        name: "Riria",
        bio: "Tokyo-born, London-based DJ who became a Rinse FM resident in 2025.",
      },
      {
        name: "Kash & Pharxoh",
        bio: "1Xtra presenters named on the line-up for the station's first 1Xtra Takeover club night at EartH Hall, Hackney, in April 2026.",
      },
      {
        name: "Amirah Amour",
        bio: "Hosts a Monday morning show on Reprezent, the youth-led London radio station.",
      },
      {
        name: "Bisola",
        bio: "Hosts a Monday show of fresh music, games and interviews on Reprezent.",
      },
      {
        name: "Sinead Adams",
        bio: "Presents a Friday show on Caribbean and Black British culture on Reprezent.",
      },
      {
        name: "Skeen LDN",
        bio: "Brings grime to Reprezent every second Friday of the month.",
      },
      {
        name: "Rellik Tha Don",
        bio: "Focuses on new UK R&B on Reprezent.",
      },
      {
        name: "MIDRIB",
        bio: "Presents dubstep, techno, breakbeat and experimental dance music on Reprezent.",
      },
      {
        name: "Leah Davis",
        bio: "Described as a rising star, hosting a weekday show on Capital Xtra.",
      },
      {
        name: "Dare Balogun",
        bio: "Joined NTS Radio as a new resident in summer 2025.",
      },
      {
        name: "DJ CHINWAX",
        bio: "Joined NTS Radio as a new resident in summer 2025.",
      },
      {
        name: "Raisa K",
        bio: "Joined NTS Radio as a new resident in summer 2025.",
      },
      {
        name: "Silent Addy & Disco Neil",
        bio: "Bashment Sound duo who joined NTS Radio as new residents in summer 2025.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-rb-singer-london-2026",
    nominees: [
      {
        name: "Cleo Sol",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "Elmiene",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "FLO",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "Jaz Karis",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "Jorja Smith",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "Nippa",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "Odeal",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "Sasha Keable",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "Shae Universe",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "Sinéad Harnett",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "Ella Mai",
        bio: "Her single 'Boo'd Up' reached No.5 on the Billboard Hot 100; her self-titled debut album debuted at No.5 on the Billboard 200 and in the UK Top 20.",
      },
      {
        name: "Mahalia",
        bio: "Won Best Female Act and Best R&B/Soul Act at the 2020 MOBO Awards; her debut album 'Love and Compromise' is BPI Silver-certified.",
      },
      {
        name: "RAYE",
        bio: "Set a BRIT Awards record with six wins in 2024, including Album of the Year for 'My 21st Century Blues', which reached No.2 in the UK.",
      },
      {
        name: "Michael Kiwanuka",
        bio: "Won the 2020 Mercury Prize for his album 'KIWANUKA', which peaked at No.2 in the UK.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-reality-tv-personality-london-2026",
    nominees: [
      {
        name: "Ekin-Su Cülcüloğlu",
        bio: "Won Love Island in 2022.",
      },
      {
        name: "Dani Dyer",
        bio: "Won Love Island in 2018.",
      },
      {
        name: "Amber Gill",
        bio: "Won Love Island in 2019.",
      },
      {
        name: "Kem Cetinay",
        bio: "Won Love Island in 2017.",
      },
      {
        name: "Molly Smith",
        bio: "Won Love Island: All Stars in 2024.",
      },
      {
        name: "Mimii Ngulube",
        bio: "Won Love Island in 2024.",
      },
      {
        name: "Harry Clark",
        bio: "Won series 2 of The Traitors.",
      },
      {
        name: "Jake Brown",
        bio: "Won series 3 of The Traitors.",
      },
      {
        name: "Leanne Quigley",
        bio: "Won series 3 of The Traitors.",
      },
      {
        name: "Charlotte Berman",
        bio: "Finalist on series 3 of The Traitors.",
      },
      {
        name: "Francesca Rowan-Plowden",
        bio: "Finalist on series 3 of The Traitors.",
      },
      {
        name: "Jordan Sangha",
        bio: "Won Big Brother UK in 2023.",
      },
      {
        name: "Ali Bromley",
        bio: "Won Big Brother UK in 2024.",
      },
      {
        name: "David Potts",
        bio: "Won Celebrity Big Brother UK in 2024.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-restaurant-reviewer-london-2026",
    nominees: [
      {
        name: "Picky Glutton",
        bio: "London restaurant reviewer and blogger covering the city's restaurant scene.",
      },
      {
        name: "Silverspoon London",
        bio: "London-based food reviewer sharing restaurant reviews from across the capital.",
      },
      {
        name: "The Foodaholic",
        bio: "London food blogger reviewing restaurants across the city.",
      },
      {
        name: "Cheese and Biscuits",
        bio: "London restaurant review blog covering dining across the capital.",
      },
      {
        name: "Binny's Food and Travel Diaries",
        bio: "London-based food and travel blogger reviewing the city's restaurants.",
      },
      {
        name: "Halal Girl About Town",
        bio: "London food reviewer focused on halal-friendly restaurants across the city.",
      },
      {
        name: "Samphire and Salsify",
        bio: "London restaurant review blog covering the city's dining scene.",
      },
      {
        name: "London Eater",
        bio: "London-based food reviewer covering the capital's restaurant scene on social media.",
      },
      {
        name: "Clerkenwell Boy",
        bio: "London food Instagrammer known for reviewing restaurants across the capital.",
      },
      {
        name: "Giulia Mulè",
        bio: "London-based food content creator reviewing the city's restaurants.",
      },
      {
        name: "Leyla Kazim",
        bio: "London food writer and broadcaster covering the city's restaurant scene.",
      },
      {
        name: "James Thompson",
        bio: "London food reviewer sharing restaurant recommendations from across the capital.",
      },
      {
        name: "Moses Combe",
        bio: "London TikTok creator whose restaurant reviews were covered by The Times.",
      },
      {
        name: "Eating with Tod",
        bio: "London food creator whose reviews of the city's restaurants have been covered in the press.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-sneaker-creator-london-2026",
    nominees: [
      {
        name: "MikePairs (Michael Allen)",
        bio: "UK-based sneaker collector and founder of the Pairs platform.",
      },
      {
        name: "Titi Finlay",
        bio: "London-born artist, graphic designer and art director whose work centres on sneakers and gender-neutral sneaker culture.",
      },
      {
        name: "George Sullivan",
        bio: "Founder of The Sole Supplier, a UK sneaker and streetwear platform.",
      },
      {
        name: "Robert Franks",
        bio: "Co-founded London sneaker retailer Kick Game with his brother David in 2013.",
      },
      {
        name: "Martine Rose",
        bio: "London menswear designer behind ongoing Nike collaborations including the Shox MR4.",
      },
      {
        name: "Dan Kitchener",
        bio: "London-based street and mural artist who customised a Nike Air Max 90 for a Farfetch trainer guide.",
      },
      {
        name: "Helen Kirkum",
        bio: "London-based sneaker customiser named among the UK's must-see custom artists.",
      },
      {
        name: "7igures",
        bio: "UK sneaker and streetwear media platform covering British trainer culture on YouTube.",
      },
      {
        name: "Skepta",
        bio: "Grime MC with multiple Nike collaborations, including the Air Max 97 Sk and SK Air lines.",
      },
      {
        name: "Stormzy",
        bio: "Grime star who partnered with Adidas Originals on the SPRT collection.",
      },
      {
        name: "Beverley Tofuor",
        bio: "Founder of British footwear brand Tobe Footwear.",
      },
      {
        name: "Bugzy Malone",
        bio: "Manchester rapper behind the B Malone footwear brand.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-soap-star-london-2026",
    nominees: [
      {
        name: "Lacey Turner",
        bio: "Plays Stacey Slater in EastEnders; won Best Leading Performer at the 2025 British Soap Awards.",
      },
      {
        name: "Kellie Bright",
        bio: "Plays Linda Carter in EastEnders; nominee at the 2025 British Soap Awards.",
      },
      {
        name: "Eden Taylor-Draper",
        bio: "Plays Belle Dingle in Emmerdale; nominee at the 2025 British Soap Awards.",
      },
      {
        name: "Beth Cordingly",
        bio: "Plays Ruby Miligan in Emmerdale; nominee at the 2025 British Soap Awards.",
      },
      {
        name: "Navin Chowdhry",
        bio: "Played Nish Panesar in EastEnders; won Villain of the Year at the 2025 British Soap Awards.",
      },
      {
        name: "Jack P. Shepherd",
        bio: "Plays David Platt in Coronation Street; nominee at the 2025 British Soap Awards.",
      },
      {
        name: "Patsy Palmer",
        bio: "Plays Bianca Jackson in EastEnders; won Best Comedy Performance at the 2025 British Soap Awards.",
      },
      {
        name: "Nicola Wheeler",
        bio: "Plays Nicola King in Emmerdale; nominee at the 2025 British Soap Awards.",
      },
      {
        name: "Peter Ash",
        bio: "Played Paul Foreman in Coronation Street; nominee at the 2025 British Soap Awards.",
      },
      {
        name: "Steve McFadden",
        bio: "Plays Phil Mitchell in EastEnders; won Best Dramatic Performance at the 2025 British Soap Awards.",
      },
      {
        name: "William Roache",
        bio: "Has played Ken Barlow in Coronation Street since 1960.",
      },
      {
        name: "Barbara Knox",
        bio: "Plays Rita Tanner in Coronation Street and is among the longest-serving soap stars.",
      },
      {
        name: "Sally Dynevor",
        bio: "Plays Sally Metcalfe in Coronation Street.",
      },
      {
        name: "Simon Gregson",
        bio: "Plays Steve McDonald in Coronation Street.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-specialist-radio-host-london-2026",
    nominees: [
      {
        name: "Kenny Allstar",
        bio: "BBC Radio 1Xtra presenter who hosts the station's Rap Show.",
      },
      {
        name: "Nadia Jae",
        bio: "BBC Radio 1Xtra presenter.",
      },
      {
        name: "Trevor Nelson",
        bio: "BBC Radio 1Xtra presenter.",
      },
      {
        name: "David Rodigan",
        bio: "Veteran reggae broadcaster and BBC Radio 1Xtra presenter.",
      },
      {
        name: "Snoochie Shy",
        bio: "BBC Radio 1Xtra presenter.",
      },
      {
        name: "Sir Spyro",
        bio: "BBC Radio 1Xtra presenter.",
      },
      {
        name: "DJ Target",
        bio: "BBC Radio 1Xtra DJ and presenter.",
      },
      {
        name: "Remi Burgz",
        bio: "BBC Radio 1Xtra presenter who moved to the station's drive-time slot.",
      },
      {
        name: "Seani B",
        bio: "Host of BBC Radio 1Xtra's Dancehall Show.",
      },
      {
        name: "DJ Edu",
        bio: "Host of BBC Radio 1Xtra's Destination Africa, championing African music in the UK.",
      },
      {
        name: "Gilles Peterson",
        bio: "BBC Radio 6 Music presenter.",
      },
      {
        name: "SHERELLE",
        bio: "BBC Radio 6 Music presenter, DJ and producer.",
      },
      {
        name: "Jamz Supernova",
        bio: "BBC Radio 6 Music presenter.",
      },
      {
        name: "Don Letts",
        bio: "BBC Radio 6 Music presenter.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-stand-up-newcomer-london-2026",
    nominees: [
      {
        name: "Joe Kent-Walters",
        bio: "Won Best Newcomer at the Edinburgh Comedy Awards 2024; also won the 2023 BBC New Comedy Award.",
      },
      {
        name: "Ayo Adenekin",
        bio: "Joint winner of the ISH Edinburgh Comedy Award for Best Newcomer 2025.",
      },
      {
        name: "Amelia Hamilton",
        bio: "Joint winner of the ISH Edinburgh Comedy Award for Best Newcomer 2025.",
      },
      {
        name: "Abby Wambaugh",
        bio: "Winner of the ISH Edinburgh Comedy Award for Best Newcomer 2024.",
      },
      {
        name: "Dan Tiernan",
        bio: "Joint winner of the ISH Edinburgh Comedy Award for Best Newcomer 2023.",
      },
      {
        name: "Fiona Ridgewell",
        bio: "Joint winner of the ISH Edinburgh Comedy Award for Best Newcomer 2023.",
      },
      {
        name: "Roger O'Sullivan",
        bio: "Winner of the Comedians' Choice Award for Best Newcomer 2025.",
      },
      {
        name: "Emmanuel Sonubi",
        bio: "London-based stand-up; nominated for Best Newcomer at the Edinburgh Comedy Awards 2022.",
      },
      {
        name: "Vittorio Angelone",
        bio: "London-based Italian-Irish comic; Best Newcomer nominee at the Edinburgh Comedy Awards 2022.",
      },
      {
        name: "Celya AB",
        bio: "Winner of Chortle's Best Newcomer award; Paris-born, Birmingham-based comic.",
      },
      {
        name: "Ania Magliano",
        bio: "Edinburgh Comedy Award nominee and SNL UK cast member.",
      },
      {
        name: "Chloe Petts",
        bio: "Live at the Apollo stand-up.",
      },
      {
        name: "Bella Hull",
        bio: "Newcomer showcased in the Pleasance's 2025 newcomer season.",
      },
      {
        name: "Aurie Styla",
        bio: "Rising stand-up touring the UK with his Christmas show.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-streamer-london-2026",
    nominees: [
      {
        name: "TommyInnit",
        bio: "British Minecraft streamer with around 7.3M Twitch followers.",
      },
      {
        name: "Tubbo",
        bio: "British Minecraft streamer and former Dream SMP member.",
      },
      {
        name: "GeorgeNotFound",
        bio: "British Minecraft streamer with over 4.8M Twitch followers.",
      },
      {
        name: "Philza",
        bio: "British Minecraft streamer with around 3.2M Twitch followers.",
      },
      {
        name: "Mongraal",
        bio: "English Fortnite streamer and former professional player.",
      },
      {
        name: "Syndicate",
        bio: "British gaming streamer; the first Twitch user to reach 1M followers.",
      },
      {
        name: "Caedrel",
        bio: "British League of Legends streamer and community caster.",
      },
      {
        name: "Vikkstar123",
        bio: "London-based Sidemen member and gaming streamer.",
      },
      {
        name: "Miniminter",
        bio: "Sidemen member and London-based gaming streamer.",
      },
      {
        name: "Zerkaa",
        bio: "Sidemen co-founder and London-based streamer.",
      },
      {
        name: "Behzinga",
        bio: "Sidemen member streaming games and Just Chatting from London.",
      },
      {
        name: "W2S",
        bio: "Sidemen member and London-based gaming streamer.",
      },
      {
        name: "TBJZL",
        bio: "Sidemen member and London-based gaming streamer.",
      },
      {
        name: "Ali-A",
        bio: "British gaming YouTuber and streamer with around 18.9M YouTube subscribers.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-streetwear-influencer-london-2026",
    nominees: [
      {
        name: "Clint Ogbenna (Clint 419)",
        bio: "Founder of London streetwear label Corteiz.",
      },
      {
        name: "Loz Vassallo",
        bio: "London streetwear creator — ~259k Instagram followers.",
      },
      {
        name: "Charlotte Olivia",
        bio: "London fashion creator (@iamcharlotteolivia) — ~404k Instagram followers.",
      },
      {
        name: "MUBI Idriess",
        bio: "Streetwear creator based across London, Barcelona and Munich — ~363k Instagram followers.",
      },
      {
        name: "ARIOUS MARIO",
        bio: "London streetwear TikTok creator featured as a rising creator on StarScout.",
      },
      {
        name: "Strateraa",
        bio: "London fashion TikToker and vintage streetwear seller.",
      },
      {
        name: "Luca (Surfaceldn)",
        bio: "London streetwear TikToker behind the @surfaceldn account.",
      },
      {
        name: "Emily Beaney",
        bio: "London streetwear influencer — ~80k Instagram followers.",
      },
      {
        name: "Daniel Darko",
        bio: "London streetwear creator — ~81k Instagram followers.",
      },
      {
        name: "Bryan Perera",
        bio: "London streetwear creator — ~98k Instagram followers.",
      },
      {
        name: "Yosef",
        bio: "Streetwear creator based between London and Berlin — ~163k Instagram followers.",
      },
      {
        name: "Neto",
        bio: "London streetwear creator — ~155k Instagram followers.",
      },
      {
        name: "Mikey Trapstar",
        bio: "London streetwear creator associated with the Trapstar label — ~195k Instagram followers.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-student-performer-london-2026",
    nominees: [
      {
        name: "Flo Wilkes",
        bio: "King's College London pharmacology student and musician whose band won a 2025 Isle of Wight competition reportedly involving 5,000 competitors; her single \"Henry\" was featured on BBC Radio 1.",
      },
      {
        name: "Neebz",
        bio: "UK-based K-pop singer and dancer who placed second in the vocal category at the New Malden K-pop Awards 2025.",
      },
      {
        name: "Cherrie",
        bio: "London-based K-pop cover dancer with HKZ Dance and fifth-place solo dancer at the New Malden K-pop Awards 2025.",
      },
      {
        name: "Hermione",
        bio: "K-pop cover dancer active in London who dances with HKZ Dance and led a documented London cover of TWICE's \"Heart Shaker\".",
      },
      {
        name: "Hayden",
        bio: "K-pop cover dancer with HKZ Dance in London, appearing in the crew's covers of BLACKPINK's \"Don't Know What To Do\" alongside Anet, Nati and Cherrie.",
      },
      {
        name: "Spriha",
        bio: "Dancer with London K-pop cover crew IGNITE, appearing in the crew's covers of NewJeans' \"Ditto\" and \"ETA\".",
      },
      {
        name: "JUJU",
        bio: "UK-based dance creator whose TikTok videos surpassed 7 million views and who served as a judge at the New Malden K-pop Awards 2025.",
      },
      {
        name: "Skylar",
        bio: "London K-pop cover dancer with Cromer Crew, appearing in the crew's seven-member cover of XG's \"Hypnotize\".",
      },
    ],
  },
  {
    rankingSlug: "most-popular-tiktok-creator-london-2026",
    nominees: [
      {
        name: "Chunkz",
        bio: "London-based creator and founding member of the Beta Squad collective, known for prank and challenge videos across YouTube and TikTok.",
      },
      {
        name: "Niko Omilana",
        bio: "British YouTuber and Beta Squad founder known for viral prank videos; stood in the 2021 London mayoral election, finishing fifth.",
      },
      {
        name: "Sharky",
        bio: "London-based Beta Squad member and YouTuber with around 2M YouTube subscribers, known for challenge and football videos.",
      },
      {
        name: "AJ Shabeel",
        bio: "British YouTuber and Beta Squad member posting comedy, challenge and lifestyle videos.",
      },
      {
        name: "KingKenny",
        bio: "Beta Squad member, Misfits boxer and Celebrity Traitors series 2 contestant.",
      },
      {
        name: "Darkest Man",
        bio: "London-based comedy creator and Beta Squad affiliate, known for prank and football content.",
      },
      {
        name: "Nella Rose",
        bio: "London YouTuber and TV presenter with a large TikTok following, known for comedy and lifestyle content.",
      },
      {
        name: "Amelia Dimoldenberg",
        bio: "Creator and host of the YouTube interview series Chicken Shop Date; hosted SNL UK on Sky in September 2026.",
      },
      {
        name: "GK Barry",
        bio: "British TikToker who appeared on I'm a Celebrity...Get Me Out of Here! in 2024 and became a Loose Women panellist.",
      },
      {
        name: "Harry Pinero",
        bio: "Peckham-born YouTuber, TikToker and presenter known for comedic street-interview content.",
      },
      {
        name: "Italian Bach",
        bio: "British comedy TikToker with around 2.4M followers and 222M likes, known for short comedy sketches.",
      },
      {
        name: "Munya Chawawa",
        bio: "British-Zimbabwean comedian known for satirical sketch characters and viral parody videos.",
      },
      {
        name: "Calfreezy",
        bio: "London-based YouTuber and Fellas Studios co-founder posting comedy and lifestyle content on TikTok and YouTube.",
      },
      {
        name: "Theo Baker",
        bio: "London-based creator and Fellas Studios member known for comedy and football videos.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-tv-presenter-london-2026",
    nominees: [
      {
        name: "Claudia Winkleman",
        bio: "Hosted Strictly Come Dancing and presents The Traitors.",
      },
      {
        name: "AJ Odudu",
        bio: "Hosts Big Brother UK alongside Will Best.",
      },
      {
        name: "Will Best",
        bio: "Hosts Big Brother UK alongside AJ Odudu.",
      },
      {
        name: "Alison Hammond",
        bio: "Hosts This Morning, the Great British Bake Off and For the Love of Dogs.",
      },
      {
        name: "Rylan Clark",
        bio: "TV presenter featured in a UK's favourite TV presenters ranking.",
      },
      {
        name: "Stacey Solomon",
        bio: "TV presenter featured in a UK's favourite TV presenters ranking.",
      },
      {
        name: "Ant McPartlin",
        bio: "One half of the Ant & Dec presenting duo, featured in a UK's favourite TV presenters ranking.",
      },
      {
        name: "Declan Donnelly",
        bio: "One half of the Ant & Dec presenting duo, featured in a UK's favourite TV presenters ranking.",
      },
      {
        name: "Holly Willoughby",
        bio: "TV presenter featured in a UK's favourite TV presenters ranking.",
      },
      {
        name: "Amanda Holden",
        bio: "TV presenter featured in a UK's favourite TV presenters ranking.",
      },
      {
        name: "Dermot O'Leary",
        bio: "This Morning presenter featured in an ITV viewer poll.",
      },
      {
        name: "Cat Deeley",
        bio: "This Morning presenter featured in an ITV viewer poll.",
      },
      {
        name: "Lorraine Kelly",
        bio: "TV presenter featured in a UK's favourite TV presenters ranking.",
      },
      {
        name: "Ruth Langsford",
        bio: "TV presenter featured in a UK's favourite TV presenters ranking.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-uk-rapper-london-2026",
    nominees: [
      {
        name: "Bashy",
        bio: "Nominated for Best Hip Hop Act at the 2025 MOBO Awards.",
      },
      {
        name: "Cristale",
        bio: "Nominated for Best Hip Hop Act at the 2025 MOBO Awards.",
      },
      {
        name: "Headie One",
        bio: "'Edna' was the first UK drill album to reach No.1 on the UK Albums Chart. He was nominated for Best Hip Hop Act at the 2025 MOBOs.",
      },
      {
        name: "Nines",
        bio: "Won Album of the Year and Best Hip Hop Act at the 2020 MOBO Awards for 'Crabs in a Bucket'; nominated for Best Hip Hop Act again in 2025.",
      },
      {
        name: "Potter Payper",
        bio: "Won MOBO Album of the Year for his debut 'Real Back In Style', which entered the UK Albums Chart at No.2. Nominated for Best Hip Hop Act at the 2025 MOBOs.",
      },
      {
        name: "Skrapz",
        bio: "Nominated for Best Hip Hop Act at the 2025 MOBO Awards.",
      },
      {
        name: "Central Cee",
        bio: "His album 'Can't Rush Greatness' became his second UK No.1 album and reached No.9 on the Billboard 200.",
      },
      {
        name: "Dave",
        bio: "His first two albums both went platinum and topped the UK Albums Chart; his debut 'Psychodrama' won the Mercury Prize.",
      },
      {
        name: "Ghetts",
        bio: "His 2021 album 'Conflict of Interest' reached No.2 on the UK Albums Chart. He was shortlisted for Best Grime Act at the 2020 MOBO Awards.",
      },
      {
        name: "Little Simz",
        bio: "'Sometimes I Might Be Introvert' won the Mercury Prize; her album 'Lotus' was released on 6 June 2025.",
      },
      {
        name: "Stormzy",
        bio: "His debut album 'Gang Signs & Prayer' hit No.1 in the UK and won the BRIT Award for Album of the Year.",
      },
      {
        name: "AJ Tracey",
        bio: "His album 'Flu Game' reached No.2 in the UK and earned a BRIT nomination.",
      },
      {
        name: "J Hus",
        bio: "His album 'Big Conspiracy' debuted at No.1 on the UK Albums Chart.",
      },
      {
        name: "Knucks",
        bio: "His album 'Alpha Place' debuted at No.3 in the UK and shared the MOBO Album of the Year prize; his second album 'A Fine African Man' was released on 31 October 2025.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-underground-radio-dj-london-2026",
    nominees: [
      {
        name: "Oneman",
        bio: "Streatham DJ with a long-running Rinse FM presence who has mixed entries in the Fabriclive and Rinse series.",
      },
      {
        name: "Plastician",
        bio: "South London bass and grime DJ with FWD>> and Rinse FM residency history.",
      },
      {
        name: "Riria",
        bio: "Tokyo-born, London-based DJ with a Rinse FM residency from 2025, mixing amapiano with UK garage and global bass.",
      },
      {
        name: "I. JORDAN",
        bio: "DJ and producer named among the 140 new resident DJs joining Rinse FM.",
      },
      {
        name: "Jossy Mitsu",
        bio: "Birmingham-raised, London-based DJ, Rinse FM resident and 6 Figure Gang member.",
      },
      {
        name: "Tash LC",
        bio: "London-based DJ and NTS resident blending Afro-jazz, highlife, kuduro, gqom and dancehall.",
      },
      {
        name: "Moxie",
        bio: "London-based DJ and NTS broadcaster with a long-running Wednesday residency.",
      },
      {
        name: "Ben UFO",
        bio: "DJ and Hessle Audio co-founder spotlighted in Rinse FM's Class of 2024.",
      },
      {
        name: "Fabio & Grooverider",
        bio: "Pioneering drum & bass duo spotlighted in Rinse FM's Class of 2024.",
      },
      {
        name: "DJ Storm",
        bio: "Drum & bass DJ spotlighted in Rinse FM's Class of 2024.",
      },
      {
        name: "Lens",
        bio: "Drum & bass DJ and producer spotlighted in Rinse FM's Class of 2024.",
      },
      {
        name: "Skeptical",
        bio: "Drum & bass DJ and producer spotlighted in Rinse FM's Class of 2024.",
      },
      {
        name: "Skeen LDN",
        bio: "Brings grime to Reprezent, the youth-led London station, every second Friday of the month.",
      },
      {
        name: "MIDRIB",
        bio: "Presents two hours of dubstep, techno, breakbeat and experimental dance music on Reprezent.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-vintage-seller-london-2026",
    nominees: [
      {
        name: "Beyond Retro",
        bio: "Large vintage clothing shop on Brick Lane, east London.",
      },
      {
        name: "Rokit",
        bio: "Vintage clothing shop on Brick Lane known for second-hand and retro fashion.",
      },
      {
        name: "Absolute Vintage",
        bio: "Brick Lane vintage shop selling second-hand clothing.",
      },
      {
        name: "Nordic Poetry",
        bio: "High-end vintage boutique just off Brick Lane on Bethnal Green Road.",
      },
      {
        name: "St Cyr Vintage",
        bio: "Camden vintage shop known for one-off quality pieces.",
      },
      {
        name: "East End Thrift Store",
        bio: "Affordable vintage clothing store in the Docklands.",
      },
      {
        name: "Greenwich Vintage Market",
        bio: "Vintage market in Greenwich selling jewellery, homeware and clothing.",
      },
      {
        name: "Reign Vintage",
        bio: "Vintage clothing shop in Soho, central London.",
      },
      {
        name: "House of Vintage",
        bio: "East London vintage clothing shop.",
      },
      {
        name: "Serotonin",
        bio: "East London vintage clothing shop.",
      },
      {
        name: "Hunky Dory",
        bio: "East London vintage clothing store.",
      },
      {
        name: "Paper Dress Vintage",
        bio: "East London vintage shop.",
      },
      {
        name: "Mero Retro",
        bio: "East London vintage clothing shop.",
      },
      {
        name: "Atika London",
        bio: "London vintage clothing shop with strong visitor reviews.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-womens-football-creator-london-2026",
    nominees: [
      {
        name: "Alisha Lehmann",
        bio: "Swiss international forward; the most-followed women's footballer in the world on social media.",
      },
      {
        name: "Mary Earps",
        bio: "England goalkeeper with a large TikTok following built on dance trends and challenges with Lionesses teammates.",
      },
      {
        name: "Beth Mead",
        bio: "Arsenal and England forward; popular TikTok creator featuring her club and international teammates.",
      },
      {
        name: "Jen Beattie",
        bio: "Former Arsenal defender; TikTok creator posting clips from her life as a professional footballer.",
      },
      {
        name: "Chloe Kelly",
        bio: "England winger with 1.5M Instagram followers.",
      },
      {
        name: "Alessia Russo",
        bio: "England striker with 1.1M Instagram followers.",
      },
      {
        name: "Liv Cooke",
        bio: "British freestyle world champion and football content creator; Football Foundation ambassador.",
      },
      {
        name: "Alex Scott",
        bio: "140-cap former England international; BBC Football Focus presenter and pundit since retiring in 2018.",
      },
      {
        name: "Laura Woods",
        bio: "Presenter who led ITV's coverage of the 2023 Women's World Cup.",
      },
      {
        name: "Gabby Logan",
        bio: "Lead anchor of the BBC's football coverage for nearly two decades, including major women's tournaments.",
      },
      {
        name: "Reshmin Chowdhury",
        bio: "BBC and talkSPORT football presenter; presented The Women's Football Show and live WSL matches.",
      },
      {
        name: "Kelly Smith",
        bio: "Former England striker; BBC pundit and Soccer Aid participant.",
      },
      {
        name: "Fara Williams",
        bio: "England's record appearance holder; now a pundit and Soccer Aid participant.",
      },
      {
        name: "Izzy Christiansen",
        bio: "Former England midfielder; BBC pundit on women's football coverage.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-x-personality-london-2026",
    nominees: [
      {
        name: "Piers Morgan",
        bio: "Broadcaster with around 9M followers on X.",
      },
      {
        name: "Gary Lineker",
        bio: "Sports broadcaster with around 9M followers on X.",
      },
      {
        name: "James O'Brien",
        bio: "LBC radio host and commentator.",
      },
      {
        name: "Carol Vorderman",
        bio: "Broadcaster and campaigner.",
      },
      {
        name: "Alastair Campbell",
        bio: "Broadcaster and author.",
      },
      {
        name: "Owen Jones",
        bio: "Columnist and commentator.",
      },
      {
        name: "Ash Sarkar",
        bio: "Novara Media journalist and commentator.",
      },
      {
        name: "David Baddiel",
        bio: "Comedian and writer; self-described Twitter addict with around 800K followers.",
      },
      {
        name: "Marina Hyde",
        bio: "Guardian columnist and co-host of The Rest Is Entertainment podcast.",
      },
      {
        name: "Emily Maitlis",
        bio: "Broadcaster and former Newsnight presenter.",
      },
      {
        name: "Lewis Goodall",
        bio: "Broadcaster and journalist.",
      },
      {
        name: "Ian Dunt",
        bio: "Columnist and political commentator.",
      },
      {
        name: "Nigel Farage",
        bio: "MP and Reform UK leader with around 2.3M X followers.",
      },
      {
        name: "Dan Neidle",
        bio: "Tax expert and prominent online commentator.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-youtube-creator-london-2026",
    nominees: [
      {
        name: "KSI",
        bio: "London-born YouTuber with around 24.8M subscribers; also a boxer and co-founder of Prime.",
      },
      {
        name: "Miniminter",
        bio: "London-based Sidemen member; his channels cover FIFA, real-life and challenge videos.",
      },
      {
        name: "Zerkaa",
        bio: "Sidemen co-founder from London; posts reaction, gaming and challenge videos.",
      },
      {
        name: "TBJZL",
        bio: "London-based Sidemen member known for football, challenge and lifestyle videos.",
      },
      {
        name: "Behzinga",
        bio: "Sidemen member from London; known for challenge videos and fitness content.",
      },
      {
        name: "Vikkstar123",
        bio: "Sidemen member known for Minecraft and gaming videos.",
      },
      {
        name: "W2S",
        bio: "Sidemen member known for FIFA and challenge videos.",
      },
      {
        name: "Chunkz",
        bio: "Founding member of the Beta Squad; London-based creator known for prank and challenge videos.",
      },
      {
        name: "Niko Omilana",
        bio: "Beta Squad founder; viral prank YouTuber who finished fifth in the 2021 London mayoral election.",
      },
      {
        name: "Sharky",
        bio: "Beta Squad member with around 2M YouTube subscribers; posts challenge and football videos.",
      },
      {
        name: "AJ Shabeel",
        bio: "Beta Squad member; British YouTuber posting comedy and challenge videos.",
      },
      {
        name: "KingKenny",
        bio: "Beta Squad member and Misfits boxer; appeared on Celebrity Traitors series 2.",
      },
      {
        name: "Amelia Dimoldenberg",
        bio: "Creator and host of Chicken Shop Date; hosted SNL UK on Sky in September 2026.",
      },
      {
        name: "Nella Rose",
        bio: "London YouTuber and TV presenter known for comedy and lifestyle videos.",
      },
    ],
  },
];

async function getOrCreateSystemAccount() {
  const existing = await findUserByEmail(SYSTEM_ACCOUNT_EMAIL);
  if (existing) return existing;
  return createUser({
    email: SYSTEM_ACCOUNT_EMAIL,
    passwordHash: bcrypt.hashSync(randomUUID(), 10),
    name: SYSTEM_ACCOUNT_NAME,
    location: "London",
  });
}

// Called unconditionally from ensureMigrated() on every app start (see
// schema.ts). Best-effort: never allowed to throw, same convention as
// the other seed steps.
export async function seedOpeningSlates(): Promise<void> {
  try {
    const systemUser = await getOrCreateSystemAccount();

    for (const slate of SLATES) {
      const ranking = await findRankingBySlug(slate.rankingSlug);
      if (!ranking) continue;

      for (const nomineeSeed of slate.nominees) {
        const existing = await findNomineeByRankingAndName(
          ranking.id,
          nomineeSeed.name
        );
        // Backfill the official photo for nominees seeded before photos
        // existed. setNomineePhotoIfEmpty never overwrites a photo the
        // nominee (or anyone) already set.
        if (existing) {
          if (nomineeSeed.photoUrl) {
            await setNomineePhotoIfEmpty(existing.id, nomineeSeed.photoUrl);
          }
          continue;
        }

        const profile = await createProfile({
          rankingId: ranking.id,
          name: nomineeSeed.name,
          bio: nomineeSeed.bio,
          photoUrl: nomineeSeed.photoUrl,
          addedBy: systemUser.id,
        });

        await recordAuditLog({
          actorUserId: systemUser.id,
          action: AUDIT_ACTIONS.NOMINEE_CREATED,
          targetType: "profile",
          targetId: profile.id,
          details: {
            source: "opening_slate_seed",
            rankingSlug: slate.rankingSlug,
            nomineeName: nomineeSeed.name,
          },
        });
      }
    }
  } catch (err) {
    console.warn(
      "Opening Slates seeding failed:",
      err instanceof Error ? err.message : err
    );
  }
}
