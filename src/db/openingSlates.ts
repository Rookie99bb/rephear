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
        photoUrl: "https://studentsunionucl.org/sites/default/files/inline-images/IMG_1322.jpeg",
      },
      {
        name: "Imperial K Pop Society",
        bio: "Imperial College's K-pop dance team ICarus — 2nd place Girl Group at Steal The Stage 2025, competing on London's inter-uni K-pop circuit against UCL.",
        photoUrl: "https://cdn.sanity.io/images/k7lmfnyj/production/64e41821e5240cc0717c45ae347e7bd87ec874c1-425x425.jpg?rect=0,60,425,319&w=800&h=600&q=75&auto=format",
      },
      {
        name: "Dal Segno",
        bio: "1st Place Group Dance at the New Malden K-POP Awards 2025.",
        photoUrl: "https://yt3.ggpht.com/ytc/AIdro_l1_HUjOAI8U2GgL0pSsYC_dVHN94aJngkjCr5hd4Aowow=s400-c-k-c0x00ffffff-no-rj",
      },
      {
        name: "IVIX",
        photoUrl: "https://i.ytimg.com/vi/gWDRKhyUj3k/hqdefault.jpg",
        bio: "K-pop dance crew — 3rd-place tie in Group Dance at the New Malden K-POP Awards 2025.",
      },
      {
        name: "NV",
        photoUrl: "https://i.ytimg.com/vi/q2OGZ6WMimA/hqdefault.jpg",
        bio: "K-pop dance crew — 3rd-place tie in Group Dance at the New Malden K-POP Awards 2025; 1st Place (Dance) at the 2026 edition.",
      },      {
        name: "AZIZA Dance Crew",
        photoUrl: "https://i.ytimg.com/vi/vKg-pegY1Jw/hqdefault.jpg",
        bio: "London K-pop cover dance crew; one of six dance teams at the 2022 K-Pop World Festival UK Round at Rich Mix, London, organised by the Korean Cultural Centre UK.",
      },
      {
        name: "COVE",
        photoUrl: "https://i.ytimg.com/vi/KoRYfVGrJhI/hqdefault.jpg",
        bio: "London and Birmingham K-pop dance team founded in 2022, a troupe of 40+ dancers who travel across the country street dancing and entering competitions (Instagram @projectcove).",
      },
      {
        name: "BKT",
        photoUrl: "https://i.ytimg.com/vi/E1xdyLado2w/hqdefault.jpg",
        bio: "London-based non-profit K-pop event organisers founded in 2021 by Katie and Bee; host 1-2 Random Play Dances in London per month and ran the RPD at MCM Comic Con London.",
      },
      {
        name: "LVL19",
        photoUrl: "https://i.ytimg.com/vi/OVCYxbGVkvU/hqdefault.jpg",
        bio: "London K-pop cover crew; a dance team at the 2022 K-Pop World Festival UK Round at Rich Mix, London (KCCUK), still posting London one-take covers (Instagram @lvl19dance).",
      },
      {
        name: "44city",
        photoUrl: "https://i.ytimg.com/vi/VEA2H4AJFb0/hqdefault.jpg",
        bio: "London K-pop dance cover group posting weekly one-take K-pop covers filmed in public across London (Instagram @_44city, TikTok @44c1ty).",
      },
      {
        name: "UJJN",
        photoUrl: "https://i.ytimg.com/vi/e32rPeXD9v4/hqdefault.jpg",
        bio: "Long-running London K-pop dance crew; performed at the KBS K-POP World Festival prelims at the 2017 London Korean Festival and again at the 2022 K-Pop World Festival UK Round at Rich Mix.",
      },
      {
        name: "CYPHX",
        photoUrl: "https://i.ytimg.com/vi/mkp0fJ75F3s/hqdefault.jpg",
        bio: "London-based K-pop dance cover group filming K-pop in public covers around London (YouTube: \"We are CYPHX, a London based dance cover group\").",
      },
      {
        name: "KVLT Dance Crew",
        photoUrl: "https://i.ytimg.com/vi/C5UvCaK2e7I/hqdefault.jpg",
        bio: "London K-pop cover crew posting K-pop in public dance covers filmed in London (Instagram @the__kvlt).",
      },
      {
        name: "KMDC",
        photoUrl: "https://i.ytimg.com/vi/fRgqt3jP1eU/hqdefault.jpg",
        bio: "London K-pop dance classes and community running since 2018, with studios in Marylebone, Elephant & Castle and The Place; describe themselves as one of London's largest K-pop dance communities.",
      },
      {
        name: "YDA DANCE",
        photoUrl: "https://i.ytimg.com/vi/pjx2ftzJSD0/hqdefault.jpg",
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
        photoUrl: "https://static.ra.co/images/profiles/square/higgo.jpg?dateUpdated=1710930590000",
      },
      {
        name: "Conducta",
        bio: "UK garage's pace-setter — producer of AJ Tracey's 'Ladbroke Grove', ran London's Kiwi Rekords 2019–2024. The benchmark the new wave is chasing.",
        photoUrl: "https://static.ra.co/images/news/2021/conducta.png",
      },
      {
        name: "Riria",
        bio: "Tokyo-born, London-based — Rinse FM resident, viral Boiler Room set, Mixmag Top Breakthrough DJ 2025, bridging UK garage and amapiano.",
        photoUrl: "https://image.rinse.fm/_/riria-1.jpg?w=600&h=600",
      },      {
        name: "DJ EZ",
        photoUrl: "https://ukf.com/wp-content/uploads/2023/11/EZ-3-1.jpg",
        bio: "Tottenham-born UK garage DJ — long-running Kiss 100 show, mixed the 2m-copy-selling Pure Garage series and Fabriclive 71, Boiler Room sets watched by millions.",
      },
      {
        name: "Sammy Virji",
        photoUrl: "https://assets.beatportal.com/images/transforms/content-item/_1200x630_crop_center-center_none/LEAD-1756884292.jpg",
        bio: "London-born UK garage DJ/producer — 'If U Need It' (UK chart hit), DJ Mag Best Producer 2025, early releases on Conducta's Kiwi Rekords.",
      },
      {
        name: "MJ Cole",
        photoUrl: "https://www.nme.com/wp-content/uploads/2025/03/mj_cole_sincere.jpg",
        bio: "London producer/DJ — 'Sincere' single and Mercury Prize-nominated Sincere album (2000), MOBO Best Producer 2001, remixes for Mariah Carey and Amy Winehouse.",
      },
      {
        name: "Wookie",
        bio: "UK garage producer/DJ (Jason Chue) — 'Battle' (UK Top 10, 2000), remixes for Sia, Disclosure and Jessie J, cited as an influence by Disclosure and Conducta.",
      },
      {
        name: "El-B",
        photoUrl: "https://cdn.mos.cms.futurecdn.net/KkfYBUCY7agin2eAKTKBGS.jpeg",
        bio: "South London producer/DJ (Lewis Beadle) — dark 2-step garage on his Ghost Recordings label, co-founder of Groove Chronicles, cited by Burial as a key influence and seen as a dubstep pioneer.",
      },
      {
        name: "Zed Bias",
        photoUrl: "https://www.clashmusic.com/wp-content/uploads/2013/11/ZedBias-1123.jpeg",
        bio: "Producer/DJ (Dave Jones), Manchester-based — 'Neighbourhood' (UK #25, 2000), Maddslinky and Phuturistix aliases, MOBO Best Garage Act nominee 2001.",
      },
      {
        name: "Interplanetary Criminal",
        photoUrl: "https://www.roxy.cz/upload/temp/interplanetary-criminal-web-nzf7upnajzmm-crop-480-480.jpg",
        bio: "Manchester-based UK garage DJ/producer (Zach Bruce) — 'B.O.T.A. (Baddest of Them All)' with Eliza Rose (UK #1, 2022), co-founder of ATW Records, DJ Mag Best DJ 2025.",
      },
      {
        name: "Flava D",
        photoUrl: "https://imgproxy.ra.co/_/quality:66/aHR0cHM6Ly9zdGF0aWMucmEuY28vaW1hZ2VzL25ld3MvMjAxNi9mbGF2YWRmYWJyaWNsaXZlLmpwZw==",
        bio: "Bournemouth-born UK garage/bassline producer and DJ (Danielle Gooding) — 'Hold On', Fabriclive 88, six-month BBC Radio 1 residency and XOYO residency.",
      },
      {
        name: "MPH",
        photoUrl: "https://ukf.com/wp-content/uploads/2024/02/MPH-scaled.jpeg",
        bio: "Canterbury-born UK garage producer/DJ (Myles Fairbairn) — releases on Night Bass, support from Skream, Disclosure and Chris Lake, Calvin Harris remix.",
      },
      {
        name: "Oppidan",
        bio: "North London-born, Bristol-based UK garage DJ/producer (Isobel Fielding) — 'Armed & Dangerous' (ft. Cutty Ranks), Night Bass and UKF releases, DJ Mag Breakthrough Producer nominee 2023.",
      },
      {
        name: "Oneman",
        photoUrl: "https://image.rinse.fm/_/oneman.jpg?w=2400&h=1167",
        bio: "Streatham, London DJ (Steven Bishop) — Rinse FM regular since 2006, two Fabriclive mix albums, sets blending UK garage with grime, dubstep and UK funky.",
      },
      {
        name: "Preditah",
        photoUrl: "https://djmag.com/sites/default/files/styles/djm_23_1005x565/public/article/image/preditah1.jpg.webp?itok=hOOj1n-u",
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
        photoUrl: "https://crackmag.wpenginepowered.com/wp-content/uploads/2021/08/TIM-REAPER-CRACK-MIX-FRONT-scaled.jpg",
      },
      {
        name: "SHERELLE",
        bio: "Walthamstow-born 160bpm+ selector — viral Boiler Room, DJ Mag Best British DJ 2020, BBC 6 Music resident. Shared the HERE at Outernet 2025 bill with Tim Reaper.",
        photoUrl: "https://static.ra.co/images/profiles/square/sherelle.jpg?dateUpdated=1758810268673",
      },      {
        name: "Nia Archives",
        photoUrl: "https://thefader-res.cloudinary.com/private_images/c_limit,w_1024/c_crop,h_533,w_1024,x_0,y_72,f_auto,q_auto:eco/nia-archives_nxjb8a/nia-archives_nxjb8a.jpg",
        bio: "Yorkshire jungle DJ/producer — 'Silence Is Loud' debut album (2024), first jungle artist to earn three BRIT Award nominations.",
      },
      {
        name: "Sully",
        photoUrl: "https://image.rinse.fm/_/Sully-March-2024.jpg?w=2400&h=1167",
        bio: "Norwich producer and DJ — intricate drum programming and murky soundscapes fusing jungle with UK garage and dubstep, releases on Keysound and Astrophonica.",
      },
      {
        name: "Double O",
        photoUrl: "https://cdn.prod.website-files.com/66fbea41b5ef08dc592dbf43/6a0b07e0d46e16ba26819d02_Double%20O-p-800.webp",
        bio: "London-based jungle DJ/producer (David Henry) — co-founder of the Rupture night and label (since 2006), 25+ year selector, 2025 debut album Firm Meditation.",
      },
      {
        name: "4am Kru",
        photoUrl: "https://cdn.amsterdam-dance-event.nl/images/images/transforms/_1200x630_crop_center-center_none/2671371/Please-use-logo-for-assets.-Press-Pic-Approved.webp",
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
        photoUrl: "https://djmag.com/sites/default/files/styles/djm_23_1005x565/public/2023-05/goldie-timeless-remixes-press-photo.jpeg.webp?itok=L-QAH_Ec1837288038",
        bio: "West Midlands-born jungle pioneer (Clifford Price) — co-founded Metalheadz (1994), 'Timeless' album (UK #7, 1995), MBE 2016.",
      },
      {
        name: "DJ Hype",
        photoUrl: "https://cdn.prod.website-files.com/61b90defe354e5660486c19b/61b90defe354e56d9c86cf3b_newhype_650.jpeg",
        bio: "London jungle DJ/producer (Kevin Ford) — represented England at the 1989 DMCs, Kiss 100 and Fantasy FM shows, Ganja Records/True Playaz label boss.",
      },
      {
        name: "Fabio",
        photoUrl: "https://image.rinse.fm/_/Fabio-Grooverider_Press-Shot_1600x.jpg?w=1200&h=630",
        bio: "Brixton DJ (Fitzroy Heslop) — Rage residency at Heaven with Grooverider, Kiss 100 and BBC Radio 1 shows, now Rinse FM residency.",
      },
      {
        name: "Grooverider",
        photoUrl: "https://image.rinse.fm/_/Fabio-Grooverider_Press-Shot_1600x.jpg?w=1200&h=630",
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
        photoUrl: "https://fixr-cdn.fixr.co/images/sales_account/logo/34bc63abcaa449b5b221e6257226cf9e.jpeg",
      },
      {
        name: "London Something",
        bio: "DJ Ron's jungle night at EartH Kitchen Hackney — booking the veteran guard: Aries, Breakage, Brockie.",
        photoUrl: "https://skiddle.imgix.net/2/6/1/2261604_25053dcc_london-something-drum-bass-kenny-ken-kelvin-373-ic3-more_1024.jpg?auto=format%2Ccompress",
      },
      {
        name: "AMAPIANOLAND",
        bio: "Calls itself London's #1 Amapiano & Afrobeats party — sold-out OUTERNET, Studio 338 and Boxpark Croydon.",
        photoUrl: "https://static.designmynight.com/uploads/2025/04/490178340_122219032988187182_3823829516233464287_n-1200x615-optimised.png",
      },
      {
        name: "Invasion Parties",
        bio: "Calls AFROLIFE London's biggest amapiano & afrohouse party (1000+ ravers) — Steel Yard, E1, Scala. The public claim-war with AMAPIANOLAND is real.",
        photoUrl: "https://img.evbuc.com/https%3A%2F%2Fcdn.evbuc.com%2Fimages%2F205659009%2F305005643115%2F1%2Foriginal.20211229-232206?w=2000&auto=format%2Ccompress&q=75&sharp=10&rect=0%2C0%2C10417%2C10417&s=75d5dd85e512f87325b2f8155b87e070",
      },      {
        name: "Rupture",
        photoUrl: "https://imgproxy.ra.co/_/rt:fill/h:630/w:1200/quality:50/aHR0cHM6Ly9pbWFnZXMucmEuY28vOTI3YmFlMTkxZmUyMGU5YjM5OTEwOWVkNGZjNTIzOGMwYzE3ZTU5My5qcGc=",
        bio: "Mantra & Double O's jungle and drum & bass night, running since 2006. Home of the Rupture label; a book celebrating its 20 years, We Are Rupture, arrives November 2026.",
      },
      {
        name: "Horse Meat Disco",
        photoUrl: "https://zero-media.s3.amazonaws.com/uploads/2015/07/horse-meat-disco-la-cannibale-milano-zero-notte-e1438696449282.jpg",
        bio: "Weekly Sunday queer disco party at The Eagle, Vauxhall, since New Year's Day 2004. Residents James Hillard, Jim Stanton, Severino and Luke Howard; a Glastonbury fixture with international residencies.",
      },
      {
        name: "The Doctor's Orders",
        photoUrl: "https://thedoctorsorders.com/wp-content/uploads/2014/06/IMG_3785-1-scaled.jpg",
        bio: "Spin Doctor's hip-hop party running since 2005; the UK's longest-running hip-hop night. Celebrated its 20th birthday at Electric Brixton in June 2025 with 9th Wonder and The Beatnuts.",
      },
      {
        name: "Metalheadz",
        photoUrl: "https://skiddle.imgix.net/2/c/c/1701356_777e07dc_metalheadz-30th-anniversary-tour-bournemouth_1024.jpg?auto=format,compress",
        bio: "Goldie's drum & bass institution; the 90s Blue Note Sessions nights helped shape the genre. Marked 30 years of Platinum Breakz at Electric Brixton in April 2026.",
      },
      {
        name: "Garage Nation",
        bio: "UK garage institution from the late 90s, still running with residents DJ Luck & MC Neat. Plays a Halloween daytime session at Ministry of Sound in October 2026.",
      },
      {
        name: "Blackout Club",
        photoUrl: "https://pbs.twimg.com/media/GhKugIvXIAAp6Qf.jpg",
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
        photoUrl: "https://image.rinse.fm/_/Pxssy-Palace.jpeg?w=1200&h=630",
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
        photoUrl: "https://licklist.s3-eu-west-2.amazonaws.com/images/original/000/000/073/126/005-62edhbsjgaahwolj.jpg",
      },
      {
        name: "The Shacklewell Arms",
        bio: "200-cap Dalston grassroots flagship — the east London answer to the Windmill.",
        photoUrl: "https://d2s8km3brsjp0y.cloudfront.net/eyJidWNrZXQiOiJ3aGF0cHViIiwia2V5IjoiRUxDXC9FTEMrMTQ1MzctMTczNzE0MC0yMDczLTI0MDAuanBnIiwiZWRpdHMiOnsicmVzaXplIjp7IndpZHRoIjo4MDAsImhlaWdodCI6NjAwLCJmaXQiOiJjb3ZlciJ9LCJyb3RhdGUiOm51bGx9fQ==",
      },
      {
        name: "EartH Kitchen",
        bio: "The small room in Hackney's EartH complex — home of London Something's jungle nights.",
        photoUrl: "https://cdn.venuescanner.com/photos/c58L8/ae71524e48943f09b12a1e2593841b39.jpg",
      },      {
        name: "The Lexington",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5b/Lexington%2C_Pentonville%2C_N1_%283432818106%29.jpg",
        bio: "200-cap indie room above a pub in Islington. One of London's most respected guitar-music venues since 2009.",
      },
      {
        name: "The Sebright Arms",
        photoUrl: "https://farm8.staticflickr.com/7067/6841063956_36c9056a4b.jpg",
        bio: "120-150-cap basement gig room at 31-35 Coate Street, Hackney. Emerging indie, punk and rock in a wood-panelled East London basement.",
      },
      {
        name: "The Bedford",
        photoUrl: "https://d2s8km3brsjp0y.cloudfront.net/eyJidWNrZXQiOiJ3aGF0cHViIiwia2V5IjoiU1dMXC9TV0wrMjY5Ni04MTQyMy0xMjk3LTk3My5qcGciLCJlZGl0cyI6eyJyZXNpemUiOnsid2lkdGgiOjEyOTcsImhlaWdodCI6OTczLCJmaXQiOiJjb3ZlciJ9LCJyb3RhdGUiOm51bGx9fQ==",
        bio: "250-cap music club inside a Grade II-listed Balham pub, 77 Bedford Hill. Early gigs by The Clash and U2; Ed Sheeran's Live at the Bedford launchpad.",
      },
      {
        name: "The Half Moon",
        photoUrl: "https://www.hospitalityandcateringnews.com/wp-content/uploads/2026/04/putneys-legendary-pub-gets-a-revamp.jpg",
        bio: "200-cap back-room venue on Lower Richmond Road, Putney, hosting live music since 1963. The Rolling Stones and U2 have played; eclectic rock, blues and folk programming.",
      },
      {
        name: "Omeara",
        photoUrl: "https://www.nme.com/wp-content/uploads/2020/05/Omeara.jpg",
        bio: "320-cap basement venue under London Bridge, opened 2016 and co-owned by Mumford & Sons' Ben Lovett. Around 200 events a year, known for breaking new acts.",
      },
      {
        name: "Barfly Camden",
        photoUrl: "https://www.nme.com/wp-content/uploads/2026/06/barfly_1_credit-Kevin-OSullivan-8.jpg",
        bio: "200-cap live room above a bar on Chalk Farm Road; the Barfly (1996-2016) reopened under its original name in June 2026. Frank Turner reopened it - he played his first sold-out solo show there in 2006.",
      },
      {
        name: "Servant Jazz Quarters",
        photoUrl: "https://cdn.squaremeal.co.uk/restaurants/17525/images/90088771-1156441251370328-7901045935091684293-n_27022024025242.jpg?w=800",
        bio: "80-100-cap basement at 10A Bradbury Street, Dalston, open since February 2011. Eclectic programming from jazz to pop; Sun Ra Arkestra, Moses Boyd and Laura Mvula have played.",
      },
      {
        name: "The Slaughtered Lamb",
        photoUrl: "https://www.urbanpubsandbars.com/cdn-cgi/image/format=auto/https://cdn.prod.website-files.com/64cd0b3dbdde72b77a84b66e/6835ea79de2a2d2f33434683_3cea0d4c-8281-4a40-8dce-a2452d0552f2.jpg",
        bio: "Candlelit ~100-cap basement at 34-35 Great Sutton Street, Clerkenwell. Folk and acoustic gigs on weeknights, DJs on Fridays; a favourite EP and album launch room.",
      },
      {
        name: "MAP café",
        bio: "80-cap basement room in Camden (feels busy at 50). Cosy intimate room for singer-songwriter shows.",
        photoUrl: "https://www.kentishtowner.co.uk/wp-content/uploads/sites/13/2018/08/Map-Studio-Cafe-Interior.jpg",
      },
      {
        name: "The Workshop, Star Inn",
        bio: "70-cap underground room near Old Street station. A first-London-show room for new bands.",
        photoUrl: "https://starinshoreditch.co.uk/wp-content/uploads/2021/06/Road-Trip-and-The-Workshop-377-1024x683-1.jpeg",
      },
      {
        name: "Ton of Brix",
        bio: "90-100-cap room in central Brixton with a large stage, plants and mirrors. Intimate seated or standing shows.",
        photoUrl: "https://d23n7gucj1ok25.cloudfront.net/Screenshot-2024-12-16-at-17.34.43-4.png",
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
        photoUrl: "https://studentsunionucl.org/sites/default/files/inline-images/IMG_1322.jpeg",
      },
      {
        name: "Imperial K Pop Society",
        bio: "Imperial's K-pop society (dance team ICarus) — Steal The Stage 2025 podium, UCL's direct rival on the inter-uni circuit.",
        photoUrl: "https://cdn.sanity.io/images/k7lmfnyj/production/64e41821e5240cc0717c45ae347e7bd87ec874c1-425x425.jpg?rect=0,60,425,319&w=800&h=600&q=75&auto=format",
      },
      {
        name: "UCL Dance Society",
        bio: "7 shows a year including the annual Bloomsbury Theatre show — 34 trophies at Kingsnation '26, and hosts its own inter-uni competition TranscenDance.",
        photoUrl: "https://studentsunionucl.org/sites/default/files/inline-images/58c6904b-36dc-4aa9-b0ad-9343f42f365b.JPG",
      },
      {
        name: "KCL Dance Society",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/14/King%27s_College_London_logo.svg",
        bio: "King's dance society (competition team Fusion) — 150+ dancers, hosts Just Dance It, the inter-uni competition UCL and Imperial travel to compete at.",
      },
      {
        name: "UCL African Caribbean Society",
        bio: "UCL's flagship ACS — competing with KCL on London's ACS awards and showcase circuit.",
        photoUrl: "https://studentsunionucl.org/sites/default/files/csc-directory-images/ucl_acs_logo_2018_0.png",
      },
      {
        name: "KCL African and Caribbean Society",
        bio: "King's ACS — consecutive 'ACS of the Year' awards and the annual two-night Culture Shock showcase.",
        photoUrl: "https://www.kclsu.org/asset/Organisation/6141/Photo%2028-07-2017,%2015%2039%2001.jpg",
      },
      {
        name: "UCL Electronic Music Society",
        bio: "Home for UCL's DJs, producers and two-steppers — tutorials, open decks and club takeovers.",
        photoUrl: "https://studentsunionucl.org/sites/default/files/2025-09/97241BE6-E0F1-42B1-B398-92FDA577CBE8-6546-000002F4C8A1EFC1.jpg",
      },
      {
        name: "KCL DJ Society",
        bio: "King's DJ society — 300-capacity Platforms nights at Corsica Studios. The student club-night crown rival to UCL's electronic music society.",
        photoUrl: "https://www.kclsu.org/asset/Organisation/6498/WhatsApp%20Image%202025-08-26%20at%2014.03.28.jpeg",
      },      {
        name: "Imperial African Caribbean Society",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c5/Shield_of_Imperial_College_London.svg",
        bio: "Imperial's African Caribbean Society (ICACS), founded in 1998 — runs an inter-university boat party with other London ACS societies and co-hosts Black Ascent, the flagship careers event, with LSE ACS.",
      },
      {
        name: "KCL United Nations Association",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/14/King%27s_College_London_logo.svg",
        bio: "King's Model UN society (KCLUNA) — 100+ members, 8 international delegations, 23 awards in a single season; took 'Best Middle-Sized Delegation' at London International MUN against 1,500+ delegates.",
      },
      {
        name: "UCL Indian Dance Society",
        photoUrl: "https://cdn.ucl.ac.uk/logos/ucl/ucl-logo--primary.svg",
        bio: "UCL's Indian dance society — fields a competition team for Just Bollywood, the national inter-university Bollywood dance competition, taking 1st place in the Imperial-hosted edition; teaches Bollywood, Kathak and Bharatanatyam.",
      },
      {
        name: "UCL Film & TV Society",
        photoUrl: "https://cdn.ucl.ac.uk/logos/ucl/ucl-logo--primary.svg",
        bio: "Runs the award-winning Festival of the Moving Image at the Bloomsbury Theatre — an 18-edition student film festival screening almost 100 films a year; Christopher Nolan was its president.",
      },
      {
        name: "LSESU African & Caribbean Society",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/42/London_School_of_Economics_Coat_of_Arms.svg",
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
        photoUrl: "https://www.clashmusic.com/wp-content/uploads/2024/04/Clash127_4.5IG-_SingleImage75-scaled.jpg",
      },
      {
        name: "Kibo",
        bio: "Harrow — went bar-for-bar with Dave and Central Cee in the 2023 Victory Lap cypher; Dave co-signed him on camera.",
        photoUrl: "https://www.clashmusic.com/wp-content/uploads/2026/08/Kibo-retouched-2-1024x731.jpg",
      },
      {
        name: "Rushy",
        bio: "West London — GRM Daily premiered 'LDN'; same Victory Lap cypher as Kibo. The documented head-to-head.",
        photoUrl: "https://www.clashmusic.com/wp-content/uploads/2024/03/Rushy-2-683x1024.jpg",
      },
      {
        name: "Fimiguerrero",
        bio: "London underground — featured on Jim Legxacy's XL Recordings mixtape 'black british music', part of the Plaqueboymax-streamed new-gen circle.",
        photoUrl: "https://static.ra.co/images/news/2026/fimig.png",
      },      {
        name: "Knucks",
        photoUrl: "https://playasyouearn.com/wp-content/uploads/2019/07/DSC06442-copy-683x1024.jpg",
        bio: "Kilburn — rapper-producer behind the debut album Alpha Place (featuring Stormzy) and the BPI Platinum single 'Los Pollos Hermanos'; MOBO-nominated, followed his 2020 London Class EP with breakout success.",
      },
      {
        name: "AntsLive",
        photoUrl: "https://www.prolificnorth.co.uk/wp-content/uploads/2025/04/AntsLive-in-AVX-small.jpg",
        bio: "North London — broke through with the viral 'Number One Candidate' video shot on horseback in the Dolomites; named on Amazon Music's Breakthrough UK: Artists to Watch 2024.",
      },
      {
        name: "Lancey Foux",
        photoUrl: "https://www.nme.com/wp-content/uploads/2021/11/Lancey-Foux-header.jpg",
        bio: "Stratford — East London MC with Skepta co-signs (joined Skepta's SK Level Europe tour); released the 2021 mixtapes First Degree and Live.Evil, then 2026's First Degree: 2nd Charge.",
      },
      {
        name: "Clavish",
        photoUrl: "https://www.musicweek.com/cimages/e15c9d071793c916b745524cecfe6eed.jpg",
        bio: "Stamford Hill — MOBO-nominated rapper (Best Newcomer 2022, later Best Hip Hop Act) who headlined two nights at Islington Academy.",
      },
      {
        name: "Kwengface",
        photoUrl: "https://www.nme.com/wp-content/uploads/2025/07/kwengface-press-sho-tPhotocredit-Lucero.jpg",
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
        photoUrl: "https://crackmag.wpenginepowered.com/wp-content/uploads/2023/07/Jim-LEGXACY-Portrait-Gallery-V1-2023-3.jpg",
        bio: "South London — won 2026 MOBO Best Male Act and was a BRIT Best New Artist nominee, off the back of his 2023 breakout mixtape homeless nigga pop music; co-produced Dave and Central Cee's 'Sprinter'.",
      },
      {
        name: "Ashbeck",
        photoUrl: "https://i.ytimg.com/vi/W-iVCVYrLL8/maxresdefault.jpg",
        bio: "London — released the collaborative Rush Hour EP with Rushy and appeared on multiple Victory Lap cyphers; Dazed named him a chill-rap pioneer of the underground.",
      },
      {
        name: "Finessekid",
        photoUrl: "https://images.h-wing.net/wp-content/uploads/2025/10/14212150/image-7.webp",
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
        photoUrl: "https://www.clashmusic.com/wp-content/uploads/2026/08/Kibo-retouched-2-1024x731.jpg",
      },
      {
        name: "Cristale",
        bio: "South London — broke through a viral freestyle; MOBO Best Newcomer nominee.",
        photoUrl: "https://www.clashmusic.com/wp-content/uploads/2024/04/Clash127_4.5IG-_SingleImage75-scaled.jpg",
      },
      {
        name: "Rushy",
        bio: "West London — cypher-circuit rapper, same Victory Lap cypher as Kibo.",
        photoUrl: "https://www.clashmusic.com/wp-content/uploads/2024/03/Rushy-2-683x1024.jpg",
      },
      {
        name: "Sinn6r",
        bio: "South-east London — militant bar-heavy style, new project 'Federal' (Nov 2025), Victory Lap studio regular.",
        photoUrl: "https://www.linesapp.co/_next/image?url=https%3A%2F%2Fstorage.googleapis.com%2Fbondilines.appspot.com%2Fevent%2Fimages%2Fa8cdd490-ff00-431d-98c1-5e44f994b6b6.webp&w=768&q=80",
      },      {
        name: "Len",
        photoUrl: "https://d2ljoqkkoec4f6.cloudfront.net/wp-content/uploads/2022/08/25125839/FF_Len1-545x750.jpg",
        bio: "Harrow — went bar-for-bar with Dave and Central Cee in the 2023 Victory Lap cypher; co-released the Conglomerate mixtape with Lancey Foux and Fimiguerrero, which hit UK Albums #23.",
      },
      {
        name: "Big Zuu",
        photoUrl: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/fb/8b/dc/fb8bdce6-3d55-09d9-b4eb-16149f26bbd6/pr_source.png/400x400bb.jpg",
        bio: "West London — two-time Fire in the Booth guest via Charlie Sloth; built his reputation on radio sets alongside AJ Tracey before his TV presenting career.",
      },
      {
        name: "Ghetts",
        photoUrl: "https://www.nme.com/wp-content/uploads/2021/02/Ghetts-NME.jpg",
        bio: "Newham — grime pioneer from N.A.S.T.Y Crew whose 2008 Freedom of Speech mixtape showcased his rapid-fire radio-set flow.",
      },
      {
        name: "BXKS",
        photoUrl: "https://bynder.southbankcentre.co.uk/transform/d0a579ad-3116-4a2f-be79-f06f849dafb5/BXKS-X-ORII-162776?io=transform%3Afill%2Cwidth%3A1600%2Cheight%3A1000",
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
        photoUrl: "https://crackmag.wpenginepowered.com/wp-content/uploads/2020/02/JME-920x330.png",
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
        photoUrl: "https://cogconnected.com/wp-content/uploads/2024/07/rose-magpie-lux-feature.jpg",
      },
      {
        name: "Maria Jodicke",
        bio: "Cosplayer (@mariajodicke) — MCM London Comic Con 2025 standout, Radio Times-documented costume craft (the Dalek dress).",
        photoUrl: "https://images.immediate.co.uk/production/volatile/sites/3/2025/10/dalek-pyramid-head-hellraiser-cosplayers-140c09f.jpg",
      },
      {
        name: "MossyPyramidHead",
        bio: "Cosplayer (@MossyPyramidHead) — MCM London 2025, floral Pyramid Head × Overwatch Bastion fusion, Radio Times-documented.",
        photoUrl: "https://images.immediate.co.uk/production/volatile/sites/3/2025/10/dalek-pyramid-head-hellraiser-cosplayers-140c09f.jpg",
      },
      {
        name: "trashnim_",
        bio: "Cosplayer (@trashnim_) — MCM London 2025 Pinhead horror transformation, Radio Times-documented. The horror counterpart to MossyPyramidHead.",
        photoUrl: "https://images.squarespace-cdn.com/content/v1/5cc994c90b77bd0f5aeb927c/1752176222504-W4P9NWNTB1JPW7ECWT9N/PinHead_1.jpg?format=500w",
      },      {
        name: "Jazzichan",
        photoUrl: "https://wcc.worldcosplaysummit.jp/en/wp-content/uploads/sites/3/2024/04/WCS2024_eyecatch_uk.jpg",
        bio: "Selected as the UK's representative for the 2024 World Cosplay Championship at MCM London Comic Con in October 2023.",
      },
      {
        name: "Hwanni",
        photoUrl: "https://wcc.worldcosplaysummit.jp/en/wp-content/uploads/sites/3/2024/04/WCS2024_eyecatch_uk.jpg",
        bio: "Selected alongside Jazzichan as the UK's representative for the 2024 World Cosplay Championship at MCM London Comic Con in October 2023.",
      },
      {
        name: "Tsupo",
        bio: "UK cosplayer who, with Clood, won the 2023 World Cosplay Championship grand prize with costumes from the anime Magi: The Labyrinth of Magic.",
        photoUrl: "https://i.ytimg.com/vi/zSqQGoQDp3w/maxresdefault.jpg",
      },
      {
        name: "Clood",
        bio: "UK cosplayer who, with Tsupo, won the 2023 World Cosplay Championship grand prize with costumes from the anime Magi: The Labyrinth of Magic.",
        photoUrl: "https://i.ytimg.com/vi/zSqQGoQDp3w/maxresdefault.jpg",
      },
      {
        name: "Richard von Wild",
        bio: "Listed as a cosplay guest at HYPER JAPAN 2025 in London.",
      },
      {
        name: "TheSparkofRevolution",
        bio: "One half of the UK cosplay duo Sparkie & Ceres, named a cosplay guest at HYPER JAPAN Manchester 2025.",
        photoUrl: "https://static.wixstatic.com/media/c7ddea_18d1f417d689428f858e1a3844cd5e16~mv2.jpg/v1/fit/w_696,h_464,q_90,enc_avif,quality_auto/c7ddea_18d1f417d689428f858e1a3844cd5e16~mv2.jpg",
      },
      {
        name: "Cereselcosplay",
        photoUrl: "https://cereselcosplay.com/assets/about/640538026_3821790041287927_3309519802455046134_n.jpg",
        bio: "One half of the UK cosplay duo Sparkie & Ceres, named a cosplay guest at HYPER JAPAN Manchester 2025.",
      },
      {
        name: "GayPanic Cosplay",
        bio: "Cardiff-based cosplayer active since 2016, profiled by Costume and Play in a 2025 interview about a decade in cosplay.",
        photoUrl: "https://graph.facebook.com/2373470909547995/picture?type=large",
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
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a3/Ty%2C_Claude_and_Robbie_AFTV_2017.png",
      },
      {
        name: "Troopz",
        bio: "AFTV star and Troopz TV host — known for explosive rants.",
        photoUrl: "https://icdn.benchwarmers.ie/wp-content/uploads/2017/04/this-win-changes-nothing-no-new.jpg",
      },
      {
        name: "Rory Jennings",
        bio: "Chelsea YouTuber and talkSPORT presenter — the banter merchant who publicly spars with Arsenal fan media on camera.",
        photoUrl: "https://yt3.googleusercontent.com/DVBpCXUmrtXLaWviRzQ_OvEBsD2-hQrEz_lXKfuERJNt6BJJomfizuOEipxpAsBW20wMvhqmrZ8=s900-c-k-c0x00ffffff-no-rj",
      },
      {
        name: "Chris Cowlin",
        bio: "Spurs Chat — the Tottenham answer to AFTV. North London Derby tribalism as content fuel.",
        photoUrl: "https://www.soccerphile.com/public/web_images/content_images/chriscowlin3.jpg",
      },      {
        name: "Ty (Taiwo Ogunlabi)",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a3/Ty%2C_Claude_and_Robbie_AFTV_2017.png",
        bio: "Arsenal fan-channel host — long-running AFTV regular known for his relentlessly optimistic takes and his defence of Arsène Wenger.",
      },
      {
        name: "Lee Judges",
        photoUrl: "https://i.ytimg.com/vi/42vK6WuO05A/hqdefault.jpg",
        bio: "Arsenal fan-channel host — AFTV regular known for his passionate post-match rants; also runs his own channel, Lee Judges TV.",
      },
      {
        name: "White Yardie (Harry Gregory)",
        photoUrl: "https://www.glee.co.uk/wp-content/uploads/2024/03/White-Yardie-2026-WEB-1.jpg",
        bio: "Comedian and AFTV regular — the Jamaican-born comic joined the Arsenal fan channel following Troopz's departure in November 2020.",
      },
      {
        name: "Moh",
        photoUrl: "https://jacobpotterjournalism.files.wordpress.com/2017/08/moh.png?w=600",
        bio: "Arsenal fan-channel host — AFTV regular who coined the catchphrase \"Don't talk about spend, talk about net spend\" on the channel.",
      },
      {
        name: "Alex Harris",
        photoUrl: "https://i.ytimg.com/vi/7TvCo04kKUM/hqdefault.jpg",
        bio: "Chelsea fan-channel host — fronts Chelsea Fan TV, a \"voice of the fans\" channel built on fan cams and reactions outside Stamford Bridge.",
      },
      {
        name: "Nicky Hawkins",
        photoUrl: "https://i.ytimg.com/vi/Y7WRmAWOWl0/maxresdefault.jpg",
        bio: "West Ham fan-channel host — co-founded West Ham Fan TV in 2014 with Ryan Archer and presents its fan cams and the \"Post Match Pint\" show.",
      },
      {
        name: "Gonzo",
        photoUrl: "https://cdn.claretandhugh.info/wp-content/uploads/Gonzo-BBC-interview--1024x625.png",
        bio: "West Ham fan-channel host — founder of the Hammers Chat YouTube channel covering West Ham news and reactions.",
      },
      {
        name: "Ben Daniel",
        photoUrl: "https://wearetottenhamtv.com/wp-content/uploads/2025/08/This-Was-A-Reality-Check-1024x576.jpg",
        bio: "Tottenham fan-channel host — co-runs WeAreTottenhamTV with Simeon Daniel, a daily Spurs channel with weekly fan shows.",
      },
      {
        name: "George Achillea",
        photoUrl: "https://pbs.twimg.com/profile_images/1833177118462664704/eykKsyGV.jpg",
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
        photoUrl: "https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg",
      },
      {
        name: "Tottenham Hotspur",
        bio: "North London. Nobody mobilises a defensive vote like Spurs fans told Arsenal might win.",
        photoUrl: "https://upload.wikimedia.org/wikipedia/fr/7/7b/Logo_Tottenham_Hotspur_Football_Club_2024.svg",
      },
      {
        name: "Chelsea FC",
        bio: "West London. Rory Jennings' tribe — Fulham Road pride on the line.",
        photoUrl: "https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg",
      },
      {
        name: "West Ham United",
        bio: "East London. London Stadium-era grievances and the loudest away end in the city.",
        photoUrl: "https://upload.wikimedia.org/wikipedia/en/c/c2/West_Ham_United_FC_logo.svg",
      },      {
        name: "Crystal Palace",
        photoUrl: "https://resources.premierleague.com/premierleague25/badges-alt/31.svg",
        bio: "South London club — Premier League, Selhurst Park.",
      },
      {
        name: "Fulham",
        photoUrl: "https://www.fulhamfc.com/favicon/apple-touch-icon.png",
        bio: "West London club — Premier League, Craven Cottage.",
      },
      {
        name: "Brentford",
        photoUrl: "https://www.brentfordfc.com/icon.png?37699a781b2cc33a",
        bio: "West London club — Premier League, Gtech Community Stadium.",
      },
      {
        name: "Queens Park Rangers",
        photoUrl: "https://www.qpr.co.uk/favicon.ico",
        bio: "West London club — Championship, Loftus Road.",
      },
      {
        name: "Charlton Athletic",
        photoUrl: "https://cc-cdn.cafc.co.uk/sites/default/files/favicons/apple-touch-icon.png?tl5gjz",
        bio: "South East London club — Championship, The Valley.",
      },
      {
        name: "Millwall",
        photoUrl: "https://upload.wikimedia.org/wikipedia/it/thumb/2/2d/Millwall_FC_logo.svg/1280px-Millwall_FC_logo.svg.png",
        bio: "South East London club — Championship, The Den.",
      },
      {
        name: "Leyton Orient",
        photoUrl: "https://www.leytonorient.com/favicon.ico",
        bio: "East London club — League One, Brisbane Road.",
      },
      {
        name: "AFC Wimbledon",
        photoUrl: "https://www.afcwimbledon.co.uk/favicon.ico",
        bio: "South West London club — League One, Plough Lane.",
      },
      {
        name: "Bromley",
        photoUrl: "https://www.bromleyfc.co.uk/favicon.ico",
        bio: "South East London club — League One, Hayes Lane; won the League Two title in 2025-26.",
      },
      {
        name: "Barnet",
        photoUrl: "https://barnetfc.com/wp-content/uploads/2021/04/cropped-BFC-192x192.png",
        bio: "North London club — League Two, The Hive.",
      },
      {
        name: "Sutton United",
        photoUrl: "https://cdn.suttonunited.net/wp-content/uploads/2016/06/27171402/cropped-icon-192x192.png",
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
        photoUrl: "https://images-prod.dazeddigital.com/1280/azure/dazed-prod/1290/3/1293658.jpg",
      },
      {
        name: "Nikki Wolff",
        bio: "London-based makeup artist (@nikki_makeup) — 1.7M+ Instagram followers, KVD Beauty Global Director of Artistry, MUA to Dua Lipa, Zendaya and the Kardashians.",
        photoUrl: "https://chantecaille.co.uk/cdn/shop/files/Nikki_600x800_UP_600x_7cfeb0aa-19d9-4b92-9c71-f7c39f492c98_600x.jpg?v=1632398617",
      },
      {
        name: "Lisa Eldridge",
        bio: "London-based makeup legend — Lancôme global creative director, own makeup line, Vogue covers, NYT bestselling author; clients from Kate Winslet to Taylor Swift.",
        photoUrl: "https://cdn.entertainmentdaily.com/uploads/2021/04/22280845-low_res-makeup-a-glamorous-history.jpg",
      },
      {
        name: "Uche Natori",
        bio: "London-based British-Nigerian beauty creator (@uchjn) — Fashion and Beauty Creator of the Year at the UK & Ireland TikTok Awards.",
        photoUrl: "https://www.bellanaija.com/wp-content/uploads/2024/12/439631615_1167160514296975_4265686570595188783_n-e1733393931687-1000x600.jpg",
      },      {
        name: "Patricia Bright",
        photoUrl: "https://glittermagazine.co/wp-content/uploads/2019/02/49643382_1609029085867537_8347708324045373556_n-819x1024.jpg",
        bio: "London-born beauty YouTuber with ~2.86M subscribers; she appeared as a beauty expert on BBC One's The Wheel.",
      },
      {
        name: "Saffron Barker",
        photoUrl: "https://i2-prod.ok.co.uk/article18810114.ece/ALTERNATES/s1200e/2_Saffron-Barker.jpg",
        bio: "UK creator who competed on Strictly Come Dancing in 2019; her book topped the Sunday Times bestseller list and she launched a collection with Primark.",
      },
      {
        name: "Fleur De Force",
        photoUrl: "https://www.thefamouspeople.com/profiles/images/og-fleur-de-force-41768.jpg",
        bio: "British beauty creator and author of The Glam Guide; she launched a makeup collection with Feelunique and collaborated with MAC and Eylure.",
      },
      {
        name: "Tanya Burr",
        photoUrl: "https://vz.cnwimg.com/wp-content/uploads/2016/04/GettyImages-490188926.jpg?x87003",
        bio: "English YouTuber who began posting makeup and fashion videos in 2009; she launched Tanya Burr Cosmetics with Superdrug in 2014.",
      },
      {
        name: "Estée Lalonde",
        photoUrl: "https://files.thehandbook.com/uploads/2022/05/2021-09-29-hh-esteexdaisy-09-0197-scaled.jpg",
        bio: "London-based beauty creator with ~1.14M YouTube subscribers; she published the book Bloom in 2016.",
      },
      {
        name: "Caroline Hirons",
        photoUrl: "https://www.carolinehirons.com/cdn/shop/files/Frame_1000007223.jpg?v=1755161516&width=1500",
        bio: "London-based aesthetician and skincare creator; her book Skincare won the 2021 British Book Awards Non-Fiction Lifestyle Book of the Year.",
      },
      {
        name: "Sali Hughes",
        photoUrl: "https://cdn2.penguin.com.au/faces/117916au.jpg",
        bio: "Welsh beauty journalist and broadcaster; Guardian resident beauty columnist and author of Pretty Honest and Pretty Iconic.",
      },
      {
        name: "Sam Chapman",
        photoUrl: "https://www.topsante.co.uk/wp-content/uploads/sites/8/2019/01/sam-chapman-pixiwoo.jpg",
        bio: "British MUA and beauty creator; co-creator of Pixiwoo and co-founder of Real Techniques, who launched a makeup collection with Beauty Pie.",
      },
      {
        name: "Wayne Goss",
        photoUrl: "https://cdn.shopify.com/s/files/1/0605/2973/7893/files/wayne.jpg",
        bio: "English makeup artist and YouTube creator; he created a Japanese-made brush line under his own name.",
      },
      {
        name: "Jess Hunt",
        photoUrl: "https://emirateswoman.com/wp-content/uploads/2023/09/Jess-Hunt-Refy-Founder-social.jpg",
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
        photoUrl: "https://chantecaille.co.uk/cdn/shop/files/Nikki_600x800_UP_600x_7cfeb0aa-19d9-4b92-9c71-f7c39f492c98_600x.jpg?v=1632398617",
      },
      {
        name: "Lisa Eldridge",
        bio: "London-based editorial MUA — Lancôme global creative director, Vogue covers, the luxury establishment's pick.",
        photoUrl: "https://cdn.entertainmentdaily.com/uploads/2021/04/22280845-low_res-makeup-a-glamorous-history.jpg",
      },
      {
        name: "Kaniz Ali",
        bio: "London-born award-winning MUA (Makeup Artist of the Year 2011/2015/2019) — bridal and Bollywood glam, MUA to Kareena Kapoor Khan and Sonam Kapoor, runs a London makeup academy.",
        photoUrl: "https://www.khushmag.com/Images/ExtraImages/Kaniz-Ali-Beauty-Heroes.jpg",
      },
      {
        name: "Nency Makeup",
        photoUrl: "https://cdn.wezoree.com/upload/user_photos/13848/preview-makeup-artists-nency-portfolio-photo-270975.jpg",
        bio: "London-based editorial and bridal MUA (@nencymakeup) — high-fashion meets bridal, viral face-yoga content.",
      },      {
        name: "Charlotte Tilbury",
        photoUrl: "https://images.ctfassets.net/wlke2cbybljx/246fTw1a9pWd6n4mNg46rd/91f67cc6942f2aec703747807af4fcef/23_BeautyProfile-App-image-card.jpg?fm=jpg",
        bio: "London-born MUA who worked with Kate Moss and Naomi Campbell; she launched her eponymous beauty brand at Selfridges in 2013.",
      },
      {
        name: "Pat McGrath",
        photoUrl: "https://firstclasse.com.my/wp-content/uploads/2025/08/Pat-McGrath-shot-by-Steven-Meisel-for-Louis-Vuitton.jpg",
        bio: "British MUA and founder of Pat McGrath Labs; she led the creative direction of Louis Vuitton's first cosmetics collection.",
      },
      {
        name: "Isamaya Ffrench",
        photoUrl: "https://theindustry.beauty/wp-content/uploads/2022/06/Isamaya-Ffrench-Industrial-1024x576.jpg",
        bio: "British MUA who developed makeup lines for Tom Ford, Burberry and Byredo; she launched her eponymous brand in 2022.",
      },
      {
        name: "Val Garland",
        photoUrl: "https://pbs.twimg.com/profile_images/665951223724564480/SSNciOfy.jpg",
        bio: "London-based MUA who became L'Oréal Paris's first Global Make-up Director in 2017; she is a judge on BBC's Glow Up.",
      },
      {
        name: "Mary Greenwell",
        photoUrl: "https://www.papermag.com/media-library/image.jpg?id=61236132&width=1200&height=600&coordinates=0%2C195%2C0%2C1805",
        bio: "London-based MUA who shot Princess Diana's Vogue covers; she has worked long-term with Chanel and Armani.",
      },
      {
        name: "Ruby Hammer",
        photoUrl: "https://rubyhammer.com/cdn/shop/files/Untitled_2000_x_1400px.png?v=1690474880&width=2000",
        bio: "British MUA and co-founder of Ruby & Millie; she received an MBE for services to the cosmetics industry.",
      },
      {
        name: "Daniel Sandler",
        bio: "London-based international MUA; he founded Daniel Sandler Cosmetics in 2005, known for the Watercolour Liquid Blush.",
      },
      {
        name: "Lan Nguyen-Grealis",
        photoUrl: "https://alpha.uscreencdn.com/images/programs/2786626/horizontal/a33705c2-6936-4bfe-ab7f-74d5402dd027.jpg",
        bio: "London Fashion Week lead MUA and author of Art & Makeup and ProMakeup Design; she has guest-judged BBC's Glow Up.",
      },
      {
        name: "Dominic Skinner",
        photoUrl: "https://www.attitude.co.uk/wp-content/uploads/sites/5/2021/06/Dominic-Skinner.jpg",
        bio: "British MUA who joined MAC in 2004 and now serves as Director of Makeup Artistry; he judges BBC's Glow Up.",
      },
      {
        name: "Hannah Martin",
        photoUrl: "https://i2-prod.ok.co.uk/incoming/article36144831.ece/ALTERNATES/s615/0_Hannah-Martin.jpg",
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
        photoUrl: "https://i.axod.net/Kztm0M6G5rTldPvIUHWiScvW4a6zJQ.jpeg",
      },
      {
        name: "Uche Natori",
        bio: "London-based British-Nigerian creator — UK & Ireland TikTok Awards winner.",
        photoUrl: "https://www.bellanaija.com/wp-content/uploads/2024/12/439631615_1167160514296975_4265686570595188783_n-e1733393931687-1000x600.jpg",
      },      {
        name: "Shania Parris",
        photoUrl: "https://www.ucb.ac.uk/media/usrkm1bz/microsoftteams-image-1.png?rxy=0.5208952086779314,0.19800110271383356&width=1200&height=600&v=1dc9c1268fa97f0",
        bio: "Winner of series 6 of BBC Three's Glow Up: Britain's Next Make-Up Star (2024); the Coventry MUA has ~190K TikTok followers, where a pointillism dot-work video went viral.",
      },
      {
        name: "Saphron Morgan",
        photoUrl: "https://thecinemaholic.com/wp-content/uploads/2023/09/Screenshot-720.png",
        bio: "Essex MUA and winner of Glow Up series 5 (2023); she launched Saphron Morgan Beauty in 2021 and has since worked with brands including MAC Cosmetics and Sephora.",
      },
      {
        name: "Ella Freer",
        photoUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Southampton-Solent-University-logo.svg",
        bio: "Runner-up of Glow Up series 6 (2024); the 20-year-old Leicester student built a community of over 100K TikTok followers ahead of the show.",
      },
      {
        name: "Connor McGee",
        photoUrl: "https://artworks.thetvdb.com/banners/v4/actor/9125955/photo/661747b9d33f5.jpg",
        bio: "Runner-up of Glow Up series 6 (2024); the Kent beauty manager and dance teacher competed in the show's final.",
      },
      {
        name: "Ailish McBride",
        photoUrl: "https://ichef.bbci.co.uk/news/1024/branded_news/fc65/live/d717cd80-2b1e-11f0-a926-032a6ac0e498.jpg",
        bio: "Belfast cosmetics student and contestant on Glow Up series 7 (2025); she spoke to BBC Newsbeat about working as a partially colour-blind MUA.",
      },
      {
        name: "Ophelia Liu",
        photoUrl: "https://www.ravensbourne.ac.uk/sites/default/files/styles/embed_/public/2021-01/Orphelia%20-%20cropped.jpg.webp?itok=PsKLlbNe",
        bio: "London-based MUA and winner of Glow Up series 2 (2020); she has built an audience of ~600K Instagram followers and worked with clients including the English National Ballet.",
      },
      {
        name: "Sophie Baverstock",
        photoUrl: "https://www.thelist.com/img/gallery/who-is-the-glow-ups-sophie-baverstock/l-intro-1627563358.jpg",
        bio: "Winner of Glow Up series 3 (2021); the London-based MUA has gone on to work with MAC Cosmetics.",
      },
      {
        name: "Yong-Chin Breslin",
        photoUrl: "https://thecinemaholic.com/wp-content/uploads/2022/08/Screenshot_13-3.jpg",
        bio: "Winner of Glow Up series 4 (2022); the London MUA rose through the BBC Three competition as one of its youngest champions.",
      },
      {
        name: "Danielle Marcan",
        photoUrl: "https://www.latex247.co.uk/wp-content/uploads/2025/05/danielle-marcan-atsuko-kudo-latex-fashion-clothing-bafta-awards.webp",
        bio: "London-based MUA and creator with ~2M+ Instagram followers; the Romanian-born creator became a Huda Beauty brand ambassador after her beauty tutorials went viral.",
      },
      {
        name: "Sasha Louise Pallari",
        photoUrl: "https://images.bauerhosting.com/legacy/media/601a/9aa0/1c02/4caa/0fe8/8f4f/filterdrop.jpg?ar=16%3A9&fit=crop&crop=top&auto=format&w=1200&q=80",
        bio: "UK MUA whose #FilterDrop campaign in 2020 pushed the ASA to tighten rules on filtered beauty advertising; she campaigns for transparency in beauty.",
      },
      {
        name: "James Mac Inerney",
        photoUrl: "https://i0.wp.com/tresamagazine.com/wp-content/uploads/2020/07/img_6101_facetune_25-03-2020-20-48-24-1-e1596040872968.jpeg?fit=1200%2C1200&ssl=1",
        bio: "London-based MUA and runner-up of Glow Up series 2 (2020), where he competed as a retail worker turned makeup artist.",
      },

    ],
  },
  {
    rankingSlug: "best-caribbean-takeaway-london-2026",
    nominees: [
      {
        name: "Fish, Wings & Tings",
        photoUrl: "https://southlondon.co.uk/wp-content/uploads/2023/09/sl22_love-letter_fish-wings-and-tings.jpg",
        bio: "Fish, Wings & Tings is a Caribbean eatery in Brixton Village, Brixton, serving reggae wings, stew oxtail and creole fish stew.",
      },
      {
        name: "JB's Soulfood",
        photoUrl: "https://cdn.squaremeal.co.uk/article/10514/images/best-caribbean-london-jbs-soulfood_21082025032700.jpg?w=1000&auto=format,compress",
        bio: "JB's Soulfood is a Caribbean takeaway on Peckham High Street, Peckham, serving jerk chicken, curry goat and patties.",
      },
      {
        name: "Kaieteur Kitchen",
        photoUrl: "https://cdn.squaremeal.co.uk/article/10514/images/best-caribbean-london-kaieteur-kitchen_21082025032700.jpg?w=1000&auto=format,compress",
        bio: "Kaieteur Kitchen is a Guyanese kitchen in Elephant & Castle, serving home-cooked Guyanese dishes including pepper pot.",
      },
      {
        name: "Paradise Cove",
        photoUrl: "https://cdn.squaremeal.co.uk/article/10514/images/best-caribbean-london-paradise-cove_21082025032700.jpg?w=1000&auto=format,compress",
        bio: "Paradise Cove is a Caribbean spot on Wandsworth Road, Battersea, serving Jamaican dishes including jerk chicken and curried goat.",
      },
      {
        name: "Ma Petite Jamaica",
        photoUrl: "https://www.hot-dinners.com/media/reviews/photos/thumbnail/500x333c/33/4a/f3/ma-petite-jamaica-camden-39-1675872049.jpg",
        bio: "Ma Petite Jamaica is a Jamaican diner with sites in Camden and Shoreditch, serving jerk chicken and rum cocktails.",
      },
      {
        name: "Limin",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7c/Limin%2C_Bankside%2C_SE1.jpg",
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
        photoUrl: "https://channelonesoundsystem.com/wp-content/uploads/bb-plugin/cache/Channel-One-Soundsystem-panorama-d9b5e8bbe2186886833d914a7d4382d6-09c61ba7khsn.jpg",
        bio: "Roots and dub sound system listed on the official Carnival site; the 2026 guide places it at Leamington Road Villas.",
      },
      {
        name: "Aba Shanti-I",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/78/Aba_Shanti-I.JPG",
        bio: "Heavyweight roots and dub sound system listed on the official Carnival site; the 2026 guide places it at East Row and Southern Row.",
      },
      {
        name: "King Tubby's Sound System",
        photoUrl: "https://nhcarnival.org/wp-content/uploads/2023/07/KingTubby.png",
        bio: "Reggae and dub sound system on Clydesdale Road, named in the 2026 Carnival guide and filmed at the 60th Carnival in August 2026.",
      },
      {
        name: "Saxon Sound",
        photoUrl: "https://nhcarnival.org/wp-content/uploads/2023/07/Saxon.jpg",
        bio: "Reggae and dancehall sound system on Chesterton Road, named in the 2026 Carnival guide; the sound that gave Britain Maxi Priest and Smiley Culture.",
      },
      {
        name: "Rampage Sound",
        photoUrl: "https://i.guim.co.uk/img/media/a0a0529cafdc1d4837f3d14ef353b01812ba3820/0_0_5842_7303/master/5842.jpg?width=1200&dpr=1&s=none",
        bio: "Sound system with a long-running Carnival pitch at Colville Square, documented on the official Carnival site.",
      },
      {
        name: "Solution Sound System",
        photoUrl: "https://nhcarnival.org/wp-content/uploads/2023/07/solution_sound_system_logo_2019-scaled.jpg",
        bio: "Roots sound system documented on the official Carnival site as holding its Carnival pitch since 2012.",
      },
      {
        name: "Mastermind Roadshow",
        photoUrl: "https://nhcarnival.org/wp-content/uploads/2023/07/Mastermind_Logo_Gold_Transparent_3x-scaled.png",
        bio: "Hip hop, soul and R&B sound system on Canal Close, described in the 2026 guide as one of the longest-running names on the route.",
      },
      {
        name: "Different Strokes",
        photoUrl: "https://nhcarnival.org/wp-content/uploads/2025/01/Different-Strokes.webp",
        bio: "Jungle, drum and bass and hip hop sound system on Lancaster Road, named in the 2026 Carnival guide.",
      },
      {
        name: "Gladdy Wax",
        photoUrl: "https://nhcarnival.org/wp-content/uploads/2023/07/Screenshot_2026-04-06_at_19.19.24.png",
        bio: "Vintage reggae vinyl sound system on Portobello Road near Chesterton Road, named in the 2026 Carnival guide.",
      },
      {
        name: "Rapattack",
        photoUrl: "https://nhcarnival.org/wp-content/uploads/2023/07/Rapattack.jpg",
        bio: "Hip hop, house, funk and soul sound system on All Saints Road, named in the 2026 Carnival guide.",
      },
      {
        name: "Disya Jeneration",
        photoUrl: "https://nhcarnival.org/wp-content/uploads/2025/01/Disya.jpg",
        bio: "Multi-genre party sound named in the 2026 Carnival guide and filmed on the Carnival Monday 2026 route.",
      },
      {
        name: "Nasty Love",
        bio: "Reggae and bashment sound named in the 2026 Carnival guide and filmed on the Carnival Monday 2026 route.",
      },
      {
        name: "Volcano",
        photoUrl: "https://nhcarnival.org/wp-content/uploads/2023/07/Volcano.jpg",
        bio: "Sound system filmed on the Notting Hill Carnival Monday 2026 route walkthrough.",
      },
      {
        name: "Gaz's Rockin' Blues",
        photoUrl: "https://images.justgiving.com/image/38b601c6-b347-4288-a65d-4c69d91fa8c8.jpg?template=size1200x630face",
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
        photoUrl: "https://yt3.googleusercontent.com/x-prTsSQxzcX6oStl4cLhQ3QpcPIUiMg10d1EpwC_hEwP105L9OG_vSLMnXNXxdrsVUIyotU6A=s400-c-k-c0x00ffffff-no-rj",
      },
      {
        name: "Venus Callida — Steampunk Botanist build video",
        bio: "Cosplayer — her YouTube video documents the construction of a Steampunk Botanist cosplay, submitted for the London Comic Con masquerade competition.",
        photoUrl: "https://yt3.googleusercontent.com/P_Q8PJ8uN8ZQFUDtPuB_Bj7q-UrfFgwKBBHpm_2hxmFAzBItP6jgPr65OyqALaeGERSaiFzDAQ=s400-c-k-c0x00ffffff-no-rj",
      },
      {
        name: "Shappi Workshop — Vora (Paladins) build tutorial video",
        photoUrl: "https://www.patreon.com/ig/card-teaser-image/creator/1030152.png?v=yekq53",
        bio: "Costume maker and cosplay judge — Daily Cosplay documented her Vora (Paladins) costume build tutorial video; her YouTube channel hosts 185 costume and tutorial videos.",
      },
      {
        name: "LittleJem — time-lapse cosplay build videos",
        photoUrl: "https://lds-img.finalfantasyxiv.com/blog_image/eu_blog/assets_c/2024/10/202410_Thumbnail-thumb-1920x1080-18365.png",
        bio: "UK-based cosplayer and propmaker — posts time-lapse costume creations and build videos on her YouTube channel.",
      },
    ],
  },
  {
    rankingSlug: "best-cosplay-performance-london-2026",
    nominees: [
      {
        name: "Matthew — Leather Armor Hunter (Monster Hunter: World) at MCM Birmingham Comic Con",
        photoUrl: "https://media.thepopverse.com/media/matthew-pgfj2ijubqdehopbm05puhykrq.png",
        bio: "UK cosplayer — won the Cosplay Central Crown Championships UK qualifier at MCM Birmingham Comic Con in December 2023 with a Monster Hunter: World Leather Armor Hunter costume, then won the 2024 global final.",
      },
      {
        name: "Kerberos Cosplay — Percival de Rolo (Critical Role) at MCM Birmingham Comic Con",
        photoUrl: "https://images.squarespace-cdn.com/content/v1/67ab6a0b0732b56dc39f7b91/d46ce7aa-0032-4d31-babd-4f273625863b/Percy-1.jpg",
        bio: "UK cosplayer — took second place in the Cosplay Central Crown Championships UK qualifier at MCM Birmingham Comic Con 2023 as Percival de Rolo from Critical Role.",
      },
      {
        name: "The Crystal Wolf — Lagertha (Vikings) at MCM Birmingham Comic Con",
        photoUrl: "https://www.fiz-x.com/wp-content/uploads/2020/10/Hot-RED-SONJA-Cosplay-1.jpg",
        bio: "UK cosplayer — third place in the Cosplay Central Crown Championships UK qualifier at MCM Birmingham Comic Con 2023 with a handmade Lagertha armour from Vikings.",
      },
      {
        name: "Hwanni & Jazzichan — WCS 2024 Team UK qualifier performance at MCM London Comic Con",
        bio: "UK cosplay duo — won the UK preliminary round for the World Cosplay Championship 2024 at MCM London Comic Con on 28 October 2023.",
        photoUrl: "https://pbs.twimg.com/profile_images/1527976409322373120/QZTSk1ID_400x400.jpg",
      },
      {
        name: "Eleo Cosplay — Grand Champion winning performance at the C3 Cosplay City Championship final 2023",
        bio: "UK cosplayer — Grand Champion of the 2023 C3 Cosplay City Championship, as listed in the official Hall of Fame.",
      },
      {
        name: "Doomed Gav — Forge Grandmaster winning performance at the C3 Cosplay City Championship final 2023",
        photoUrl: "https://images.squarespace-cdn.com/content/v1/6761c8be198616670b503125/1734461692362-URMOBNXR9JKE3ZGUL2Z4/C3+Cosplay+City+Championship+Forge+Grandmaster+-+Doomed+Gav+-+Photographer+Acoustica+-+ACME+Comic+Con.jpg",
        bio: "UK cosplayer — Forge Grandmaster of the 2023 C3 Cosplay City Championship, as listed in the official Hall of Fame.",
      },
      {
        name: "raydiancy_ — Fabric Grandmaster winning performance at the C3 Cosplay City Championship final 2023",
        bio: "UK cosplayer — Fabric Grandmaster of the 2023 C3 Cosplay City Championship, as listed in the official Hall of Fame.",
      },
      {
        name: "Bat and Blossom Cosplay — Grand Champion winning performance at the C3 Cosplay City Championship final 2024",
        bio: "UK cosplay duo — Grand Champions of the 2024 C3 Cosplay City Championship at ACME Comic Con Scotland, as listed in the official Hall of Fame.",
        photoUrl: "https://p16-common-sign.tiktokcdn-us.com/tos-maliva-avt-0068/970818e556e130528aeefb3feb08efc1~tplv-tiktokx-cropcenter:1080:1080.jpeg?dr=9640&refresh_token=04e270cf&x-expires=1790456400&x-signature=zNgDG%2BPiEGZbXzM53rvdRKbkk64%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=useast5",
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
        photoUrl: "https://www.networkrail.co.uk/wp-content/uploads/2024/09/Popeyes-in-London-Waterloo-station-1024x576.jpg",
        bio: "Popeyes is a Louisiana-style fried chicken chain with restaurants across London, including one in Waterloo.",
      },
      {
        name: "Wingmans",
        photoUrl: "https://cdn.thefork.com/tf-lab/image/upload/w_3840,c_fill,q_auto,f_auto/customer/e101ad24-fc54-4533-9712-2346eec9daf2/8096151d-726c-4814-9b36-0ddd21423e02.jpg",
        bio: "Wingmans is a chicken restaurant in London known for its chicken wings and tenders.",
      },
      {
        name: "Eden's Cottage",
        bio: "Eden's Cottage is a fried chicken shop in Finsbury Park, London.",
      },
      {
        name: "Butchies",
        photoUrl: "https://markethalls.co.uk/wp-content/uploads/2022/02/002-Sandwich-900x900.jpg",
        bio: "Butchies is a London fried chicken brand known for its buttermilk fried chicken burgers.",
      },
      {
        name: "Coqfighter",
        photoUrl: "https://media.soho-london.co.uk/uploads/2024/01/2-56.jpg",
        bio: "Coqfighter is a London fried chicken brand serving Korean-style fried chicken.",
      },
      {
        name: "Wingstop",
        photoUrl: "https://www.foodserviceequipmentjournal.com/cloud/2025/03/05/IMG_7095.jpeg",
        bio: "Wingstop is an American chicken wing chain with restaurants in London, including Shaftesbury Avenue in the West End.",
      },
      {
        name: "Sam's Chicken",
        photoUrl: "https://res.cloudinary.com/dh6pkczfx/image/upload/c_fill,h_430,w_720/v1763551221/vk8g9fxxez22uafpgqxo.jpg",
        bio: "Sam's Chicken is a fried chicken chain with multiple branches across London.",
      },
      {
        name: "Wing Wing",
        photoUrl: "https://oneadv.co.uk/wp-content/uploads/2022/04/wing-wing-instagram-post-3-scaled.jpg",
        bio: "Wing Wing is a Korean fried chicken shop on Woburn Place in Bloomsbury, London.",
      },
      {
        name: "Thunderbird",
        photoUrl: "https://itin-dev.wanderlogstatic.com/freeImageSmall/42ERqWYRP7QZ3H0dclpQqQ4LX0lTSSb6",
        bio: "Thunderbird is a fried chicken brand with a branch at Charing Cross in London.",
      },
      {
        name: "Jollibee",
        photoUrl: "https://lh5.googleusercontent.com/p/AF1QipPaunbap8aoI3NYIeZakvMngUnn5ADHoSdouaJP=w408-h269-k-no",
        bio: "Jollibee is a Filipino fried chicken chain with a branch at Leicester Square in London.",
      },
      {
        name: "Slim Chickens",
        photoUrl: "https://foodchainmagazine.com/wp-content/uploads/sites/10/2018/06/SC-138-a.jpg",
        bio: "Slim Chickens is an American chicken tender chain with a branch on Bond Street in Marylebone, London.",
      },
      {
        name: "Morley's",
        photoUrl: "https://halalxplorer.com/wp-content/uploads/2022/10/DSC_3834-min-scaled-thegem-product-justified-square-xl.jpg",
        bio: "Morley's is a South London fried chicken chain, established in 1985, with branches across London including Brixton Hill, Rotherhithe and Tottenham.",
      },
    ],
  },
  {
    rankingSlug: "best-full-english-london-2026",
    nominees: [
      {
        name: "Kula",
        photoUrl: "https://kula-cafe.com/wp-content/uploads/2025/07/Recharge-at-Kula-Cafe-The-Best-Brunch-Cafe-Near-Oxford-Street.webp",
        bio: "Kula is a cafe on James Street in Marylebone serving a fully loaded full English breakfast.",
      },
      {
        name: "Sandwich Street Kitchen",
        photoUrl: "https://sandwichstreetkitchen.co.uk/wp-content/uploads/2023/10/Eggs-Benedict-2-scaled.jpg",
        bio: "Sandwich Street Kitchen is a family-run cafe on Hastings Street in Bloomsbury serving classic full English breakfasts.",
      },
      {
        name: "Sketch",
        bio: "Sketch is a Mayfair restaurant on Conduit Street serving a full English breakfast in its Parlour and Glade dining rooms.",
      },
      {
        name: "The Breakfast Club",
        photoUrl: "https://www.tagvenue.com/resize/5b/29/fit-900-600;81428-the-caf-room.jpg",
        bio: "The Breakfast Club is a breakfast cafe chain with multiple sites across London serving full English breakfasts.",
      },
      {
        name: "Regency Café",
        photoUrl: "https://homegirllondon.wpenginepowered.com/wp-content/uploads/2023/11/regency-cafe-london-exterior.jpg",
        bio: "Regency Cafe is a greasy spoon on Regency Street in Westminster, serving full English breakfasts since 1946.",
      },
      {
        name: "E Pellicci",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/London_Borough_of_Tower_Hamlets_-_E._Pellicci_Cafe_-_20230330173314.jpg/250px-London_Borough_of_Tower_Hamlets_-_E._Pellicci_Cafe_-_20230330173314.jpg",
        bio: "E Pellicci is a family-run cafe on Bethnal Green Road in Bethnal Green, serving full English breakfasts since 1900.",
      },
      {
        name: "Polo Bar",
        photoUrl: "https://www.urban75.org/blog/images/polo-bar-cafe-liverpool-st-01.jpg",
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
        photoUrl: "https://lh5.googleusercontent.com/p/AF1QipPjF1WD9VQJJkPvTs6chb3h57SO9NQ1_lfLLNMH=w650-h486-k-no",
        bio: "Lumi is a cafe on Camden High Street in Camden Town serving a full English-style fry-up.",
      },
      {
        name: "Heart of Balham",
        bio: "Heart of Balham is a Moroccan cafe on Balham High Road in Balham serving a halal full English breakfast.",
      },
      {
        name: "Titanic Cafe",
        photoUrl: "https://www.foodieexplorers.co.uk/wp-content/uploads/2025/04/Compress_20250426_174103_3686.jpg",
        bio: "Titanic Cafe is a greasy spoon on Holloway Road in Holloway serving classic full English breakfasts.",
      },
      {
        name: "Bar Bruno",
        photoUrl: "https://img10.misterbandb.com/xyzILv4ixKdvKciBNcQ2_4q2EeY=/480x0/filters:quality(70)/location_photos/data/12525/original/bar-bruno-gay-london-1506937390.jpg",
        bio: "Bar Bruno is a family-run cafe on Wardour Street in Soho serving Bruno's Big Breakfast fry-up.",
      },
      {
        name: "Riding House",
        photoUrl: "https://cdn.squaremeal.co.uk/private-group-dining/710/images/thumbnail-blooms-dining-hall-optimised_08092023084938.jpg?w=800",
        bio: "Riding House is a restaurant in Bloomsbury serving a classic fry-up with Dingley Dell bacon and BBQ beans.",
      },
    ],
  },
  {
    rankingSlug: "best-genre-night-london-2026",
    nominees: [
      {
        name: "Horse Meat Disco",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/cf/Horse_Meat_Disco_DJ_group_photo.jpg",
        bio: "Long-running London queer disco party; staged a 2026 night at Eagle London in Vauxhall.",
      },
      {
        name: "Hospitality",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c2/Hospitality.jpg",
        bio: "Drum-and-bass club night and label brand with long-running London events.",
      },
      {
        name: "Metalheadz",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f4/Goldie_2003_crop.jpg",
        bio: "Goldie's drum-and-bass club night and label; the 90s Blue Note Sessions helped define the genre.",
      },
      {
        name: "DMZ",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b4/Mala_live.jpg",
        bio: "Dubstep club night founded by Digital Mystikz.",
      },
      {
        name: "Glitterbox",
        photoUrl: "https://earmilk.com/wp-content/uploads/2018/03/glitterboxjpg-800x380.jpg",
        bio: "Disco and house club night; staged a sold-out party at Ministry of Sound.",
      },
      {
        name: "Butterz",
        photoUrl: "https://djmag.com/sites/default/files/styles/djm_23_961x540/public/article/image/Butterz%20.jpg.webp?itok=vEBjqWkT",
        bio: "Grime label and club night founded by Elijah and Skilliam.",
      },
      {
        name: "Pxssy Palace",
        photoUrl: "https://bricksmagazine.co.uk/wp-content/uploads/2025/06/BRICKS-X-PXSSY-PALACE-COVER-RESIZED-819x1024.jpg",
        bio: "Queer club night centred on QTIPOC, run by the Pxssy Palace collective.",
      },
      {
        name: "Touching Bass",
        photoUrl: "https://images.squarespace-cdn.com/content/v1/5534a426e4b0ed810ce8f891/3e27cad5-2143-4223-ad3a-4bdca1192631/Touching+Bass+%2B+London+Comp+Artists%28Group+Shot%29+2+%E2%80%94+Jessica+Eliza+Ross_Alex+Rita+%28large%29.jpg",
        bio: "South London music community and party brand.",
      },
      {
        name: "Co-Op",
        photoUrl: "https://i.ytimg.com/vi/uL4JMhhNdRA/hqdefault.jpg",
        bio: "Broken-beat club night at Plastic People, central to London's rare-groove renaissance.",
      },
      {
        name: "FWD",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/3b/DJ_Hatcha_2008.jpg",
        bio: "Pioneering dubstep and UK garage club night.",
      },
      {
        name: "FABRICLIVE",
        photoUrl: "https://pbs.twimg.com/profile_images/1321438907343491072/tjaKgP-i.jpg",
        bio: "fabric's long-running Friday-night club brand.",
      },
      {
        name: "The Gallery",
        photoUrl: "https://dv7zfk0hwmxgu.cloudfront.net/sites/default/files/styles/auto_1500_width/public/article-images/138879/slideshow-1676728266.jpg",
        bio: "Cult trance night founded in 1995 by Tall Paul; returned to Ministry of Sound in November 2025 after a ten-year hiatus.",
      },
      {
        name: "Frisky",
        bio: "Heritage trance club brand; named as one of the brands returning to Ministry of Sound in 2026 in the From The Archives series.",
      },
      {
        name: "Rulin'",
        photoUrl: "https://pictures-of-lily.com/wp-content/uploads/2021/09/POLP-EP-46-DJ-HARVEY.jpeg",
        bio: "Heritage house club brand; named as one of the brands returning to Ministry of Sound in 2026 in the From The Archives series.",
      },
    ],
  },
  {
    rankingSlug: "best-international-student-community-london-2026",
    nominees: [
      {
        name: "KCL Southeast Asian Society",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/14/King%27s_College_London_logo.svg",
        bio: "KCL society welcoming all students interested in exploring and addressing issues in Southeast Asia, running talks, workshops and social events including an annual Halloween movie event and Christmas events.",
      },
      {
        name: "KCL Taiwanese Society",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/14/King%27s_College_London_logo.svg",
        bio: "KCL society founded and run by Taiwanese students to showcase Taiwan's culture and help incoming Taiwanese friends adapt to life in London, with talks, field trips, festival celebrations and panels.",
      },
      {
        name: "ABACUS",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c7/London_school_of_economics_logo_with_name.svg",
        bio: "British-Chinese student society at LSE with a wider network recognised at Queen Mary, Goldsmiths, UCL, SOAS, Imperial, Brunel and KCL.",
      },
      {
        name: "UCL Japan Society",
        photoUrl: "https://cdn.ucl.ac.uk/logos/ucl/ucl-logo--primary.svg",
        bio: "UCL society whose constitution documents cultural workshops, language lessons, Japan Day and social events for students engaging with Japanese culture.",
      },
      {
        name: "Royal Holloway CSSA",
        photoUrl: "https://upload.wikimedia.org/wikipedia/en/e/ef/Royal_Holloway%2C_University_of_London_logo.png",
        bio: "Royal Holloway's Chinese Students and Scholars Association, a public society page hosting cultural events and supporting Chinese students adapting to UK life.",
      },
      {
        name: "KCL Korean Society",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/14/King%27s_College_London_logo.svg",
        bio: "Korean cultural community at King's documented by student media as an unofficial society with annual gatherings, Korean-language use and food and cultural activities.",
      },
      {
        name: "KCL United Nations Association",
        photoUrl: "https://roarnews.co.uk/wp-content/uploads/2025/11/MUN-photo-2--786x1024.jpeg",
        bio: "KCL international-affairs society running Model UN trips across the UK and Europe and its own London International MUN conference, building an international student community at King's.",
      },
      {
        name: "University College London",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0f/UCL_Crest.svg",
        bio: "Founded in 1826 and based in Bloomsbury, central London, UCL is a Russell Group research university spanning sciences, engineering, humanities, law and medicine, with a large and diverse international student body.",
      },
      {
        name: "King's College London",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/14/King%27s_College_London_logo.svg",
        bio: "Founded in 1829 and based at the Strand in central London, King's is a Russell Group university known for humanities, law, health and social sciences, with campuses across London.",
      },
      {
        name: "Imperial College London",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/de/Imperial_logo.svg",
        bio: "Based in South Kensington and founded in 1907, Imperial is a Russell Group university focused on science, engineering, medicine and business.",
      },
      {
        name: "London School of Economics and Political Science",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c7/London_school_of_economics_logo_with_name.svg",
        bio: "Founded in 1895 and based in Westminster, central London, LSE is a University of London institution specialising in the social sciences, from economics and politics to law and sociology.",
      },
      {
        name: "Queen Mary University of London",
        photoUrl: "https://upload.wikimedia.org/wikipedia/en/3/38/Queen_Mary_University_of_London_logo.svg",
        bio: "A Russell Group university based in Mile End, east London, and a member of the University of London, known for research across humanities, sciences, law and medicine.",
      },
      {
        name: "SOAS University of London",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f4/SOAS_Crest.png",
        bio: "Founded in 1916 and based in Bloomsbury, SOAS is a University of London institution specialising in the study of Asia, Africa and the Middle East.",
      },
      {
        name: "Goldsmiths, University of London",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/40/Goldsmiths_College%2C_London_arms.svg",
        bio: "Based in New Cross, south-east London, Goldsmiths is a University of London college known for creative arts, design, media, computing and social sciences.",
      },
      {
        name: "University of the Arts London",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/ab/University_of_the_Arts_London_Logo.svg",
        bio: "A specialist arts university made up of six colleges including Central Saint Martins and London College of Fashion, with sites across London.",
      },
    ],
  },
  {
    rankingSlug: "best-jollof-london-2026",
    nominees: [
      {
        name: "Enish",
        photoUrl: "https://cdn.businessday.ng/2022/05/Olushola-Medupin.png",
        bio: "Enish is a Nigerian restaurant group with branches across London, serving jollof rice and other Nigerian dishes.",
      },
      {
        name: "Chuku's",
        photoUrl: "https://cdn.prod.website-files.com/6741e6efd98e45dcdbb3ba9f/67461d60c56003f2d8e96088_65157a4a67d6634dfe9ae14f_Y3OwwBZ2duCWW5go2MVgzV8PL7dqPTI89YypcxlR2NObdrjfEGT45r5rcGzqd0S9pRLtOsLv_Pkya3Nj1jKXY5pWiyPWwXy3t1OV0ZXQnadc_rrC3mWkrUph6GmU9XymkS0gNbHWSlFQ8S1hrma_Ek4.webp",
        bio: "Chuku's is a Nigerian restaurant in Tottenham, London, serving Nigerian sharing plates including jollof.",
      },
      {
        name: "Akoko",
        photoUrl: "https://www.codehospitality.co.uk/wp-content/uploads/2021/04/Untitled-design-31-2.jpg",
        bio: "Akoko is a West African fine-dining restaurant in Fitzrovia, London, with jollof rice on its menu.",
      },
      {
        name: "805 Old Kent Road",
        photoUrl: "https://dineawardslondon.com/images/p400/805-restaurants-old-kent-rd-design-1.jpg",
        bio: "805 is a Nigerian restaurant on Old Kent Road in Southwark, London, serving jollof rice and grilled dishes.",
      },
      {
        name: "The Flygerians",
        photoUrl: "https://images.immediate.co.uk/production/volatile/sites/2/2024/09/The-Flygerians-5617dc5.jpg?resize=1200%2C630",
        bio: "The Flygerians is a Nigerian food brand at Peckham Palms in Peckham, London, serving jollof rice.",
      },
      {
        name: "Ikoyi",
        photoUrl: "https://cdn.shopify.com/s/files/1/0711/5292/6820/files/018-jc-ih-o.jpg",
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
        photoUrl: "https://itin-dev.wanderlogstatic.com/freeImage/esE2ASmUM38oVBgvUqc6yF9gN9jNzVLS",
        bio: "Jollof House Kitchen is a Nigerian food vendor based in Brixton, London, serving jollof rice.",
      },
      {
        name: "Teju's Street Food",
        bio: "Teju's Street Food is a Nigerian street-food spot on Peckham High Street, London, serving jollof rice and suya.",
      },
      {
        name: "Moyo",
        photoUrl: "https://rs-menus-api.roocdn.com/images/28ba1a8b-8d18-4b68-8be1-c4bf66f14a65/image.jpeg?width=1200&height=630&fit=crop",
        bio: "Moyo is a Nigerian-Japanese restaurant in Hendon, London, with jollof rice on its 2026 menu.",
      },
    ],
  },
  {
    rankingSlug: "best-kpop-cover-performance-london-2026",
    nominees: [
      {
        name: "HKZ Dance - ILLIT \"It's Me\"",
        photoUrl: "https://i.ytimg.com/vi/duTmB0itYzg/hqdefault.jpg",
        bio: "Documented London K-pop dance cover of ILLIT's \"It's Me\" performed by Cherrie, Viola, Aimee, Theo and Bartek.",
      },
      {
        name: "HKZ Dance - BLACKPINK \"Don't Know What To Do\"",
        photoUrl: "https://i.ytimg.com/vi/AL7McmBoT1Y/hqdefault.jpg",
        bio: "Documented London K-pop dance cover of BLACKPINK's \"Don't Know What To Do\" performed by Hayden, Anet, Nati and Cherrie.",
      },
      {
        name: "HKZ Dance - Gyubin \"Really Like You\"",
        photoUrl: "https://i.ytimg.com/vi/uTcA3n3-9BY/hqdefault.jpg",
        bio: "Documented London K-pop dance cover of Gyubin's \"Really Like You\" performed by Cherrie with named backup dancers.",
      },
      {
        name: "HKZ Dance - VIVIZ \"SHHH!\"",
        photoUrl: "https://i.ytimg.com/vi/4YEMSTlDxK8/hqdefault.jpg",
        bio: "Documented London K-pop dance cover of VIVIZ's \"SHHH!\" performed by Hermione, Cherrie and Tiffany.",
      },
      {
        name: "HKZ Dance - Jennie \"Like Jennie\"",
        photoUrl: "https://i.ytimg.com/vi/i7C7hHXHj_0/hqdefault.jpg",
        bio: "Documented London K-pop dance cover of Jennie's \"Like Jennie\", with Cherrie credited as project leader alongside named dancers.",
      },
      {
        name: "ASTRAY - RIIZE \"Fame\"",
        photoUrl: "https://i.ytimg.com/vi/_oXEG5-zxaM/hqdefault.jpg",
        bio: "Documented London K-pop dance cover of RIIZE's \"Fame\" performed by Sixtine, Ruby, Namixen, Zhnnieya, Leanne Trieu and others.",
      },
      {
        name: "IGNITE - NewJeans \"Ditto\"",
        photoUrl: "https://i.ytimg.com/vi/CUBcmhtlZYE/hqdefault.jpg",
        bio: "Documented London K-pop dance cover of NewJeans' \"Ditto\" performed by IGNITE.",
      },
      {
        name: "IGNITE - NewJeans \"ETA\"",
        photoUrl: "https://i.ytimg.com/vi/l-YQYwQH-6I/hqdefault.jpg",
        bio: "Documented London K-pop dance cover of NewJeans' \"ETA\" performed by IGNITE.",
      },
      {
        name: "KWD Crew - BTS \"Swim\"",
        photoUrl: "https://i.ytimg.com/vi/iKydCTgWg7Y/hqdefault.jpg",
        bio: "Documented London K-pop dance cover of BTS' \"Swim\" performed by Shai, Jenny, Roseanne, Rosemarie, Marcia, Ruby and Shana.",
      },
      {
        name: "KWD Crew - EXO \"Crown\"",
        photoUrl: "https://i.ytimg.com/vi/3v94nkItQqQ/hqdefault.jpg",
        bio: "Documented London K-pop dance cover of EXO's \"Crown\", project-led by Zosia with dancers Carly, Katie, Shana and Kirsty.",
      },
      {
        name: "COVE - ILLIT \"Not Cute Anymore\"",
        photoUrl: "https://i.ytimg.com/vi/KoRYfVGrJhI/hqdefault.jpg",
        bio: "Documented K-pop dance cover of ILLIT's \"Not Cute Anymore\" by COVE, a team identifying itself as London/Birmingham-based.",
      },
      {
        name: "Dynasti - ILLIT \"Not Cute Anymore\"",
        photoUrl: "https://i.ytimg.com/vi/cShKrbQgXs8/hqdefault.jpg",
        bio: "Documented London K-pop dance cover of ILLIT's \"Not Cute Anymore\" performed by Marissa, Ana, Angel, Julia and Ebela.",
      },
      {
        name: "AVID London - Kiss of Life \"Sticky\"",
        photoUrl: "https://i.ytimg.com/vi/tK-bsTvMBjU/hqdefault.jpg",
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
        photoUrl: "https://static.wixstatic.com/media/432568_770fb67242174c07a8c66bbedcd48c38~mv2.jpg/v1/fill/w_724,h_483,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/432568_770fb67242174c07a8c66bbedcd48c38~mv2.jpg",
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
        photoUrl: "https://cdn.venuescanner.com/photos/c59Ax/d009c48e9aed536e8cc31b46a04735e7.jpg",
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
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6f/Camden_Stables_Market%2C_Camden_Town%2C_London._-_geograph.org.uk_-_428746.jpg",
        bio: "Camden Town's venues and Amy Winehouse's legacy are documented as central to the borough's music history, from punk to the present day.",
      },
      {
        name: "Croydon",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/03/East_Croydon_town_centre_-_geograph.org.uk_-_5087704.jpg",
        bio: "Home to Big Apple Records and dubstep's early history, and to the BRIT School; celebrated in the borough's official music heritage trail.",
      },
      {
        name: "Lambeth",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c3/Brixton_Academy%2C_Brixton%2C_SW9_%283380443064%29.jpg",
        bio: "Home to the O2 Academy Brixton, a major live music venue, and the birthplace of David Bowie in Brixton.",
      },
      {
        name: "Tower Hamlets",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b0/London_%2C_Tower_Hamlets_-_Tower_of_London_-_geograph.org.uk_-_4227572.jpg",
        bio: "Bow E3 in the borough is documented as a birthplace of grime, home to early scene figures including Wiley, Dizzee Rascal and Tinchy Stryder.",
      },
      {
        name: "Haringey",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/26/Tottenham_High_Road%2C_North_London_-_geograph.org.uk_-_2192255.jpg",
        bio: "Tottenham is the home ground of Boy Better Know, with Meridian Walk and the Skepta/Jme upbringing documented in the borough.",
      },
      {
        name: "Lewisham",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f5/Deptford_Market.jpg",
        bio: "Dire Straits formed and made their debut in Deptford, Lewisham, with the band returning to Deptford documented in 2009.",
      },
      {
        name: "Southwark",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/90/Peckham_Arch_and_Peckham_Library_across_Peckham_High_Street_%28geograph_4040005%29.jpg",
        bio: "Peckham in the borough is documented for its gig venues and music links, including the Rye Lane soundtrack coverage of the area.",
      },
      {
        name: "Westminster",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/78/Denmark_Street_in_2010%2C_by_Martin_Addison%2C_geograph.org.uk_1957933.jpg",
        bio: "Home to Denmark Street (Tin Pan Alley), Ronnie Scott's jazz club and the former Marquee Club site.",
      },
      {
        name: "Kensington and Chelsea",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1c/Notting_hill_carnival.jpg",
        bio: "Notting Hill Carnival, Europe's biggest street festival of Caribbean culture, takes place in the borough with sound-system culture at its core.",
      },
      {
        name: "Brent",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5f/Wembley_Arena.jpg",
        bio: "Home to Wembley venues including OVO Arena Wembley, with a capacity of up to 12,500 and an active 2026 events programme.",
      },
      {
        name: "Hackney",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/3d/London_Fields%2C_Dalston_-_geograph.org.uk_-_6301608.jpg",
        bio: "Home to EartH in Dalston, which lists an active 2026 events programme on its official site.",
      },
      {
        name: "Newham",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c3/London_%2C_Newham_-_City_Scenery_-_geograph.org.uk_-_4066203.jpg",
        bio: "Home turf of Kano, Ghetts and the Newham Generals, documented as central figures of the borough's grime history.",
      },
      {
        name: "Ealing",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/80/Entrance_to_the_Ealing_Club.jpg",
        bio: "Home to the Ealing Club, where the early Rolling Stones nucleus formed around Charlie Watts in the 1960s.",
      },
      {
        name: "Greenwich",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8b/The_O2%2C_Greenwich%2C_London.jpg",
        bio: "Home to The O2 at North Greenwich, a 20,000-capacity arena hosting major concerts.",
      },
    ],
  },
  {
    rankingSlug: "best-new-rap-track-london-2026",
    nominees: [
      {
        name: "GBP — Central Cee feat. 21 Savage",
        photoUrl: "https://i.ytimg.com/vi/_Cu9Df_9Zvg/hqdefault.jpg",
        bio: "Released on 17 January 2025 as Central Cee's single featuring 21 Savage.",
      },
      {
        name: "Flood — Little Simz feat. Obongjayar & Moonchild Sanelly",
        photoUrl: "https://i.ytimg.com/vi/GvrNPiz7rHw/hqdefault.jpg",
        bio: "Released on 26 February 2025 as the lead single from Little Simz's album 'Lotus'.",
      },
      {
        name: "Bounce — Aitch",
        photoUrl: "https://i.ytimg.com/vi/J0iUejwVPC0/hqdefault.jpg",
        bio: "Released on 19 March 2025 as a single by Aitch.",
      },
      {
        name: "Crush — AJ Tracey feat. Jorja Smith",
        photoUrl: "https://i.ytimg.com/vi/BouNQ9lREyA/hqdefault.jpg",
        bio: "From AJ Tracey's album 'Don't Die Before You're Dead', released on 13 June 2025.",
      },
      {
        name: "Friday Prayer — AJ Tracey feat. Aitch & Headie One",
        photoUrl: "https://i.ytimg.com/vi/jORPAOWLzZU/hqdefault.jpg",
        bio: "From AJ Tracey's album 'Don't Die Before You're Dead', released on 13 June 2025.",
      },
      {
        name: "Raindance — Dave & Tems",
        photoUrl: "https://i.ytimg.com/vi/SOJpE1KMUbo/hqdefault.jpg",
        bio: "The Dave and Tems single released on 23 October 2025; it topped the UK Singles Chart in January 2026.",
      },
      {
        name: "History — Dave feat. James Blake",
        bio: "Released on 23 October 2025 as a single by Dave featuring James Blake.",
      },
      {
        name: "How Dare They — Headie One feat. Digga",
        photoUrl: "https://i.ytimg.com/vi/1Z21czo5rPU/hqdefault.jpg",
        bio: "The video arrived on 1 September 2026; the track appears on the bonus edition of Headie One's 'MMM'.",
      },
      {
        name: "RICO — D-Block Europe & French Montana",
        photoUrl: "https://i.ytimg.com/vi/H5GqULhjKX0/hqdefault.jpg",
        bio: "Released in late August 2026 by D-Block Europe and French Montana.",
      },
      {
        name: "Unorthodox — Marnz Malone feat. J Hus",
        photoUrl: "https://i.ytimg.com/vi/kX0k404DyzM/hqdefault.jpg",
        bio: "Released on 3 September 2026 by Marnz Malone featuring J Hus; produced by Gusto and Smokey C.",
      },
      {
        name: "GASS — Nemzzz feat. Travis Scott",
        photoUrl: "https://i.ytimg.com/vi/veav1xL-NAc/hqdefault.jpg",
        bio: "Released on 4 September 2026 by Nemzzz featuring Travis Scott.",
      },
      {
        name: "Serena Williams — 163Margs",
        photoUrl: "https://pbs.twimg.com/profile_images/2099656124320329728/0yAUuD9Y_400x400.jpg",
        bio: "Released on 3 September 2026 by 163Margs.",
      },
      {
        name: "Which One — Drake & Central Cee",
        photoUrl: "https://i.ytimg.com/vi/9-dEHfSCZUQ/hqdefault.jpg",
        bio: "Released on 25 July 2025 by Drake and Central Cee; it debuted at No.23 on the Billboard Hot 100.",
      },
      {
        name: "Shanghigh Noon — Pozer",
        photoUrl: "https://i.ytimg.com/vi/5AYqR_j1ktg/hqdefault.jpg",
        bio: "A track from Pozer's 2025 project 'Against All Odds'; Pozer won Best Drill Act at the 2025 MOBO Awards.",
      },
    ],
  },
  {
    rankingSlug: "best-rap-crew-london-2026",
    nominees: [
      {
        name: "N.A.S.T.Y Crew",
        photoUrl: "https://getdarker.com/wp-content/uploads/2016/09/nastycrew_gd.jpg",
        bio: "Historical grime collective founded by DJ Marcus Nasty; Kano, D Double E, Footsie and Jammer are documented as members.",
      },
      {
        name: "Roll Deep",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/01/RollDeep.jpg",
        bio: "Historical East London grime crew formed around 2002 by MCs including Wiley, with a string of UK chart hits.",
      },
      {
        name: "Boy Better Know",
        bio: "North London collective founded by Jme and Skepta; members include Frisco, Jammer and Shorty.",
      },
      {
        name: "Ruff Sqwad",
        photoUrl: "https://trenchtrenchtrench.com/assets/articles/ruff-sqwad-should-be-taught-in-music-education-at-all-levels/RUFF-SQWAD-MUSIC-CLASS.jpg",
        bio: "Bow E3 grime collective associated with Rapid, Dirty Danger, Slix and Tinchy Stryder.",
      },
      {
        name: "More Fire Crew",
        bio: "Historical Waltham Forest crew formed by Ozzie B and Neeko, later joined by Lethal Bizzle and Seani B; known for the 2002 hit 'Oi!'.",
      },
      {
        name: "So Solid Crew",
        photoUrl: "https://en-academic.com/pictures/enwiki/83/SoSolidCrew2003.jpg",
        bio: "Battersea garage and hip-hop collective; members include Megaman, Asher D, Lisa Maffia, Romeo and Harvey, with the UK number-one '21 Seconds'.",
      },
      {
        name: "Newham Generals",
        photoUrl: "https://www.clashmusic.com/wp-content/uploads/2016/09/newham-generals-portrait.jpeg",
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
        photoUrl: "https://drillarchive.com/media/thumbnails/6148c47c503651241d597f920d72036507715082.jpg",
        bio: "Broadwater Farm and Tottenham collective; Bandokay, Double Lz, SJ and Headie One are documented as associated artists.",
      },
      {
        name: "Zone 2",
        bio: "Peckham drill collective; Kwengface, PS Hitsquad, Trizzac and Karma are documented members.",
      },
      {
        name: "Smoke Boys",
        photoUrl: "https://www.nme.com/wp-content/uploads/2020/10/Smoke-Boys.jpg",
        bio: "Historical Croydon collective, inactive after their final 2020 mixtape; members included Knine, Inch, Deepee, Sleeks, Littlez and Swift.",
      },
      {
        name: "House of Pharaohs",
        bio: "South-East London collective; Sam Wise, BlazeYL, Bandanna, Kevin Taylor and Danny Stern are documented members.",
      },
      {
        name: "NiNE8 Collective",
        photoUrl: "https://media.hero-magazine.com/wp-content/uploads/2026/05/22133756/260326_UGG_SS26_12_GROUP_175-aspect-ratio-1280-720.jpeg",
        bio: "London music and arts collective including Lava La Rue, Biig Piig, NAYANA IZ and Mac Wetha.",
      },
    ],
  },
  {
    rankingSlug: "best-rap-producer-london-2026",
    nominees: [
      {
        name: "M1OnTheBeat",
        photoUrl: "https://crackmagazine.net/wp-content/uploads/2024/01/Magazine-M1ONTHEBEAT-Parallax-V1-2023.jpg",
        bio: "Produced Headie One's early projects, Digga D's 'Woi', 'Golden Boot' and the Drake/Headie One 'Only You Freestyle'.",
      },
      {
        name: "JAE5",
        photoUrl: "https://image.okayafrica.com/149986.webp?imageId=149986&width=960&height=1280&format=jpg",
        bio: "Executive producer of J Hus's 'Common Sense' and producer of Dave's 'Location'; a MOBO Best Producer winner.",
      },
      {
        name: "Steel Banglez",
        photoUrl: "https://thefader-res.cloudinary.com/private_images/w_2400,c_limit,f_auto,q_auto:best/TheFADER_BEATCONSTRUCTION_3_30_2018_square_igzgod/steel-banglez-beat-construction-interview-mist-mostack.jpg",
        bio: "Produced Krept & Konan's 'Go Down South' and Mist's 'Karla's Back'.",
      },
      {
        name: "Nana Rogues",
        photoUrl: "https://concord.com/wp-content/uploads/2025/01/Nana-Rogues-for-Roster.webp",
        bio: "Produced Drake's 'Passionfruit' and 'Skepta Interlude'; his credits also span Dave, J Hus and Stormzy.",
      },
      {
        name: "Ghosty",
        photoUrl: "https://sizestores.s3.eu-west-1.amazonaws.com/wp-content/uploads/2021/06/BE0BFA9B-1F9E-44EB-A949-98535D8412D0.jpg",
        bio: "Featured in a 2021 UK drill producers special alongside Flyo and MK The Plug.",
      },
      {
        name: "Flyo",
        photoUrl: "https://image.rinse.fm/_/DSC_7022-Flyo13.JPG?w=600&h=600",
        bio: "Featured in a 2021 UK drill producers special alongside Ghosty and MK The Plug.",
      },
      {
        name: "MK The Plug",
        photoUrl: "https://sizestores.s3.eu-west-1.amazonaws.com/wp-content/uploads/2021/06/MK-THE-PLUG.png",
        bio: "Featured in a 2021 UK drill producers special alongside Ghosty and Flyo.",
      },
      {
        name: "Eight8",
        bio: "Produced Central Cee's 'gen z luv' and 'Moi' and holds credits on 'Can't Rush Greatness'.",
      },
      {
        name: "Conducta",
        photoUrl: "https://fourfourmag.com/wp-content/uploads/2021/04/conducta-sh-1-1024x768.jpg",
        bio: "Produced AJ Tracey's chart hit 'Ladbroke Grove'.",
      },
      {
        name: "Sir Spyro",
        photoUrl: "https://i.discogs.com/NKtq7wEXVyKPRE-LQUdRvYmDwXtgVZuDkv_ohM38QBg/rs:fit/g:sm/q:90/h:508/w:460/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9BLTEyMTI5/NzYtMTQzMDYxODk5/OS0zOTI3LmpwZWc.jpeg",
        bio: "Produced Stormzy's 'Big for Your Boots', 'Sounds of the Skeng' and 'Topper Top'.",
      },
      {
        name: "Carns Hill",
        bio: "Produced 67's 'Take It There'.",
      },
      {
        name: "Nyge",
        photoUrl: "https://trenchtrenchtrench.com/assets/articles/nyge-interview/NYGE-1.JPG",
        bio: "Executive producer of AJ Tracey's album 'Flu Game'.",
      },
      {
        name: "P2J",
        photoUrl: "https://notjustok.com/wp-content/uploads/2021/08/p2j.jpeg",
        bio: "Produced Burna Boy's 'Anybody' and much of Wizkid's 'Made in Lagos'; he won a Grammy for 'Twice as Tall'.",
      },
    ],
  },
  {
    rankingSlug: "best-rave-venue-london-2026",
    nominees: [
      {
        name: "FOLD",
        photoUrl: "https://www.clashmusic.com/wp-content/uploads/2018/08/unnamed1_316.jpg",
        bio: "Canning Town, capacity 600; 24-hour licensed nightclub listed as operating in an autumn-2026 London club guide.",
      },
      {
        name: "fabric",
        photoUrl: "https://music-b26f.kxcdn.com/wp-content/uploads/2016/11/fabric-night-club.jpg",
        bio: "Farringdon, capacity 1,600; three-room nightclub with a 2026-2027 concert schedule listed.",
      },
      {
        name: "Ministry of Sound",
        bio: "Elephant & Castle, capacity 1,500; club with listed events running September to December 2026, marking its 35th year.",
      },
      {
        name: "E1",
        photoUrl: "https://www.e1ldn.co/logo.svg",
        bio: "Wapping, capacity 1,600; warehouse venue with 2026 events listed through December.",
      },
      {
        name: "Drumsheds",
        photoUrl: "https://cdn.londonandpartners.com/3/661466d/YXBwLnNoYXJpbnBpeC5jb20vaW1hZ2VfZXh0ZXJuYWxfdXJscy85MmJlMGZlNy1lNDQzLTQzNWEtYWZlMy0yMzFhMzhlYzczMzY/92be0fe7-e443-435a-afe3-231a38ec7336.jpg",
        bio: "Meridian Water, Edmonton, capacity 15,000; large-scale nightclub and events venue described as operating in an autumn-2026 club guide.",
      },
      {
        name: "Village Underground",
        photoUrl: "https://www.tagvenue.com/resize/54/10/fit-900-600;88485-village-underground-room.jpg",
        bio: "Shoreditch, capacity 700; warehouse venue with a 2026-2027 concert schedule listed.",
      },
      {
        name: "Phonox",
        photoUrl: "https://phonox.co.uk/wp-content/uploads/2015/06/phonoxslider.jpg",
        bio: "Brixton, capacity 500; nightclub with 2026 events listed from September to December.",
      },
      {
        name: "Colour Factory",
        photoUrl: "https://kickoffclub.co.uk/assets/venues/colour-factory.webp",
        bio: "Hackney Wick, capacity 750; multi-space venue with 2026 events listed through November.",
      },
      {
        name: "Venue MOT",
        bio: "Deptford, capacity 350; venue with 2026 events listed in September, October and November.",
      },
      {
        name: "The Cause",
        photoUrl: "https://ratemyrave.com/wp-content/uploads/2021/03/tc-1622675814748726864374.jpg?w=1024",
        bio: "Tottenham, capacity 1,200; grassroots venue that hosted the 36-hour Waterworks Extended festival on 12-13 September 2026.",
      },
      {
        name: "The Steel Yard",
        photoUrl: "https://www.tagvenue.com/resize/8c/0d/widen-1680-noupsize;49636-arch-1-and-2-room.jpg",
        bio: "City of London (Cannon Street), capacity 1,000; three-arch venue with 2026 events listed through January 2027.",
      },
      {
        name: "XOYO",
        photoUrl: "https://cdn.prod.website-files.com/6968c9cf247eaa3ab09af7b1/69835960f55c3ea51553f574_Copy%20of%20DSC00231_0006_Layer%200.jpg",
        bio: "Shoreditch, capacity 800; two-floor nightclub with 2026 events listed from September to December.",
      },
      {
        name: "KOKO",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Koko_London.jpg/1280px-Koko_London.jpg",
        bio: "Camden, capacity 1,500; theatre venue running the KOKO Electronic autumn-winter 2026 season.",
      },
      {
        name: "HERE at Outernet",
        photoUrl: "https://www.outernet.com/assets/images/here-interior-jake-davis-Processed.jpg",
        bio: "Tottenham Court Road, capacity 2,000; underground venue now operating as Outernet Live, with 2026 events listed through November.",
      },
    ],
  },
  {
    rankingSlug: "best-rookie-cosplayer-london-2026",
    nominees: [
      {
        name: "Bows_Arrows_Again",
        photoUrl: "https://images.squarespace-cdn.com/content/v1/6761c8be198616670b503125/d9ca239d-56fc-4d49-9b38-7d07dd2fedbe/Bows.Arrows.Again+C3+Ultimate+Apprentice+2025+-+Nate+Cleary.jpg",
        bio: "UK cosplayer — winner of the Ultimate Apprentice category at the 2025 C3 Cosplay City Championship.",
      },
      {
        name: "Kellserskr",
        photoUrl: "https://images.squarespace-cdn.com/content/v1/6761c8be198616670b503125/c3210f91-4704-4c6a-952b-9cd4d8cf3633/Kellserskr+C3+Grand+Champion+2025+-+Nate+Cleary.jpg",
        bio: "UK cosplayer — C3 Cosplay City Championship Grand Champion 2025.",
      },
      {
        name: "Geckocos",
        photoUrl: "https://images.squarespace-cdn.com/content/v1/6761c8be198616670b503125/dc628240-4211-43df-819e-7245599339a9/Geckocos+C3+Fabric+Grandmaster+2025+-+Nate+Cleary.jpg",
        bio: "UK cosplayer — C3 Cosplay City Championship Fabric Grandmaster 2025.",
      },
      {
        name: "Miss.t.makes",
        photoUrl: "https://images.squarespace-cdn.com/content/v1/6761c8be198616670b503125/9c46348b-7777-43fb-8a61-a9ab6d2d5514/Miss.t.makes+C3+Forge+Grandmaster+2025+-+Nate+Cleary.jpg",
        bio: "UK cosplayer — C3 Cosplay City Championship Forge Grandmaster 2025.",
      },
      {
        name: "EJ Knox",
        photoUrl: "https://yt3.ggpht.com/Mx5e0Lo_MszV2Nguv2aXoBD7q6U3HB2gOGKg0DR5nAp-7U6-_cTtfJ4ohX_9tAAKNa3K07bNlw=s800-c-k-c0x00ffffff-no-rj-mo",
        bio: "UK cosplayer — winner at POWER Con, listed in the 2025 C3 Cosplay City Championship Hall of Fame.",
      },
      {
        name: "Deviloustailor",
        bio: "UK cosplayer — winner at POWER Con, listed in the 2025 C3 Cosplay City Championship Hall of Fame.",
      },
      {
        name: "Cinnamon Cosplay",
        photoUrl: "https://yt3.googleusercontent.com/ytc/AIdro_n9yTXSJ__mEG1bmDKB_u_BpRZflANtPNfEVDE0VxMmQQ=s800-c-k-c0x00ffffff-no-rj-mo",
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
        photoUrl: "https://yt3.ggpht.com/zq25oFjafKfLwj9NqR6BWzUT8WJWVTlT_w-m-HvXGh18efcILGSyABns0sxqjdWOR27_cuDeim4=s800-c-k-c0x00ffffff-no-rj-mo",
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
        photoUrl: "https://images.immediate.co.uk/production/volatile/sites/3/2025/10/dalek-pyramid-head-hellraiser-cosplayers-140c09f.jpg?quality=90&fit=1100,733",
        bio: "Cosplayer featured by Radio Times for a floral Pyramid Head costume worn at MCM London Comic Con 2025.",
      },
      {
        name: "trashnim_",
        photoUrl: "https://yt3.ggpht.com/RVHSe7zhJK-2KKidvKkxJ-iXaXZJx7f-zUnbZWaYRSAIDtU7-rRJ1gI06s-R6Fje0A6uv1t9=s800-c-k-c0x00ffffff-no-rj-mo",
        bio: "Cosplayer featured by Radio Times for a Pinhead costume worn at MCM London Comic Con 2025.",
      },
      {
        name: "deeliteful_cosplay",
        photoUrl: "https://images.immediate.co.uk/production/volatile/sites/3/2025/10/marvel-cosplayers-1613968.jpg?quality=90&fit=1100,733",
        bio: "Cosplayer credited by Radio Times for a handmade Okoye costume worn at MCM London Comic Con 2025.",
      },
    ],
  },
  {
    rankingSlug: "best-rookie-dance-crew-london-2026",
    nominees: [
      {
        name: "ETERNL",
        photoUrl: "https://i.ytimg.com/vi/E6Xmpgsv31g/hqdefault.jpg",
        bio: "London K-pop cover crew with documented recent covers including 82MAJOR's \"Takeover\", performed by Paris, Stacie, Otto, Antonela, Paula and Nana.",
      },
      {
        name: "O.D.C",
        photoUrl: "https://i.ytimg.com/vi/QbLcKgZXO1M/hqdefault.jpg",
        bio: "London K-pop dance crew with documented recent covers including CORTIS' \"GO!\", performed by Jamel, Moses, Morgan, Mario and Trev.",
      },
      {
        name: "IGNITE",
        photoUrl: "https://i.ytimg.com/vi/zFfwvyRNM6Q/hqdefault.jpg",
        bio: "London K-pop cover crew with documented recent covers of NewJeans' \"Ditto\" and \"ETA\", featuring dancer Spriha.",
      },
      {
        name: "KWD Crew",
        photoUrl: "https://i.ytimg.com/vi/AAlXpYJJZwA/hqdefault.jpg",
        bio: "London K-pop cover crew with documented recent covers of BTS' \"Swim\" and EXO's \"Crown\", featuring dancers including Shana and project lead Zosia.",
      },
      {
        name: "COVE",
        photoUrl: "https://i.ytimg.com/vi/OP1FiFpRWig/hqdefault.jpg",
        bio: "K-pop cover team identifying itself as London/Birmingham-based, with a documented cover of ILLIT's \"Not Cute Anymore\".",
      },
      {
        name: "Cromer Crew",
        photoUrl: "https://i.ytimg.com/vi/Exly8zSr6AU/hqdefault.jpg",
        bio: "London K-pop cover crew with a documented recent cover of XG's \"Hypnotize\", performed by Vivienne, Mirei, Skylar, Shannon, Mimi, Jenelle and Sela.",
      },
      {
        name: "ECHO Crew",
        photoUrl: "https://i.ytimg.com/vi/V9R427sWmoc/hqdefault.jpg",
        bio: "London K-pop cover crew with a documented recent cover of ILLIT's \"It's Me\", performed by Jamie, Ene, Zosia, Keira and Lee.",
      },
      {
        name: "ASTRAY",
        photoUrl: "https://img.youtube.com/vi/3ICTCxgpMIE/maxresdefault.jpg",
        bio: "London K-pop cover crew with a documented recent cover of RIIZE's \"Fame\", performed by Sixtine, Ruby, Namixen, Zhnnieya, Leanne Trieu and others.",
      },
      {
        name: "HKZ Dance",
        photoUrl: "https://yt3.ggpht.com/JzAgJnpOxFIVLOqWo1oLLuNTno1MZC6cFQ3Z8ptWykczZp7c9F3wf0w8Lt8H7nALxLobdKF7=s800-c-k-c0x00ffffff-no-rj",
        bio: "London K-pop cover crew with documented recent covers including ILLIT's \"It's Me\", BLACKPINK's \"Don't Know What To Do\" and Jennie's \"Like Jennie\", featuring dancers Cherrie, Hayden, Anet, Nati and Bartek.",
      },
    ],
  },
  {
    rankingSlug: "best-society-president-london-2026",
    nominees: [
      {
        name: "Quoc Anh Nguyen",
        photoUrl: "https://cdn.ucl.ac.uk/logos/ucl/ucl-logo--primary.svg",
        bio: "Elected President of the UCL Vietnamese Society for 2025/26 in the Students' Union UCL leadership race, winning the count run on 21 March 2025.",
      },
      {
        name: "Yuki Zhou",
        photoUrl: "https://cdn.ucl.ac.uk/logos/ucl/ucl-logo--primary.svg",
        bio: "Elected President of the UCL Chinese Students and Scholars Association for 2025/26 in the Students' Union UCL leadership race, winning 85 of 115 ballots in the count run on 21 March 2025.",
      },
      {
        name: "Emir Deniz Durahim",
        photoUrl: "https://cdn.ucl.ac.uk/logos/ucl/ucl-logo--primary.svg",
        bio: "Elected President of the UCL Turkish Society for 2025/26 in the Students' Union UCL leadership race, winning the count run on 21 March 2025.",
      },
      {
        name: "Yi Kang Chai",
        photoUrl: "https://cdn.ucl.ac.uk/logos/ucl/ucl-logo--primary.svg",
        bio: "Elected President of the UCL Malaysian Society for 2025/26 in the Students' Union UCL leadership race, winning 41 of 81 ballots in the count run on 21 March 2025.",
      },
      {
        name: "Chin Siang Yew",
        photoUrl: "https://cdn.ucl.ac.uk/logos/ucl/ucl-logo--primary.svg",
        bio: "Elected President of the UCL Singapore Society for 2025/26 in the Students' Union UCL leadership race, winning 82 of 91 ballots in the count run on 21 March 2025.",
      },
      {
        name: "Vishal Arun",
        photoUrl: "https://cdn.ucl.ac.uk/logos/ucl/ucl-logo--primary.svg",
        bio: "Elected President of the UCL Hindu Society for 2025/26 in the Students' Union UCL leadership race, winning 76 of 114 ballots in the count run on 21 March 2025.",
      },
      {
        name: "Megan Liao",
        photoUrl: "https://cdn.ucl.ac.uk/logos/ucl/ucl-logo--primary.svg",
        bio: "Elected President of the UCL Taiwanese Society for 2025/26 in the Students' Union UCL leadership race, winning 18 of 34 ballots in the count run on 21 March 2025.",
      },
      {
        name: "Maya Crasmaru",
        photoUrl: "https://cdn.ucl.ac.uk/logos/ucl/ucl-logo--primary.svg",
        bio: "Elected President of the UCL English Society for 2025/26 in the Students' Union UCL leadership race, winning the count run on 21 March 2025.",
      },
      {
        name: "Girish Kharal",
        photoUrl: "https://cdn.ucl.ac.uk/logos/ucl/ucl-logo--primary.svg",
        bio: "Elected President of the UCL Nepalese Society for 2025/26 in the Students' Union UCL leadership race, winning 17 of 23 ballots in the count run on 21 March 2025.",
      },
      {
        name: "Ines Aissi",
        photoUrl: "https://cdn.ucl.ac.uk/logos/ucl/ucl-logo--primary.svg",
        bio: "Elected President of the UCL Muslimah Careers Society for 2025/26 in the Students' Union UCL leadership race, winning the count run on 21 March 2025.",
      },
      {
        name: "Conal Flannery",
        photoUrl: "https://cdn.ucl.ac.uk/logos/ucl/ucl-logo--primary.svg",
        bio: "Elected President of the UCL Irish and Northern Irish Society for 2025/26 in the Students' Union UCL leadership race, winning 9 of 10 ballots in the count run on 21 March 2025.",
      },
      {
        name: "Aryan Virdi",
        photoUrl: "https://cdn.ucl.ac.uk/logos/ucl/ucl-logo--primary.svg",
        bio: "Elected President of the UCL Punjabi Society for 2025/26 in the Students' Union UCL leadership race, winning 28 of 44 ballots in the count run on 21 March 2025.",
      },
      {
        name: "Hanna Johal",
        photoUrl: "https://cdn.ucl.ac.uk/logos/ucl/ucl-logo--primary.svg",
        bio: "Elected President of the UCL Real Estate Society for 2025/26 in the Students' Union UCL leadership race, winning 7 of 10 ballots in the count run on 21 March 2025.",
      },
      {
        name: "Izzie Moull",
        photoUrl: "https://cdn.ucl.ac.uk/logos/ucl/ucl-logo--primary.svg",
        bio: "Named President of the UCL Cheese Grater Magazine Society in the June 2026 issue of the student publication; the society was awarded Best Publication in London (SPA Regional Awards 2025) and Best Publication in the UK and Ireland (SPA National Awards 2026).",
      },
    ],
  },
  {
    rankingSlug: "best-student-dj-london-2026",
    nominees: [
      {
        name: "Fred again..",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/3b/FredAgainCPBowl100825-13_%2854713954728%29.jpg",
        bio: "London-born producer and DJ; won the Grammy for Best Dance/Electronic Album in 2024 for 'Actual Life 3'.",
      },
      {
        name: "Disclosure",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6a/Disclosure.jpg",
        bio: "London-based electronic duo of brothers Guy and Howard Lawrence; debut album 'Settle' (2013) reached No. 1 on the UK Albums Chart.",
      },
      {
        name: "Jamie xx",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e7/Jamie_xx_%282015%29.jpg",
        bio: "London producer, DJ and member of The xx; debut solo album 'In Colour' (2015) was shortlisted for the Mercury Prize.",
      },
      {
        name: "Four Tet",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e7/Four_Tet_%282011%29.jpg",
        bio: "London electronic musician Kieran Hebden, recording as Four Tet; founder of the Text Records label.",
      },
      {
        name: "Chase & Status",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/12/Chase_and_Status-SMS-2018-15.jpg",
        bio: "London electronic duo Saul Milton and Will Kennard; founders of the MTA Records label.",
      },
      {
        name: "Andy C",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/79/Andy_C_live_in_2011_%28cropped%29.jpg",
        bio: "London drum & bass DJ and co-founder of RAM Records; held a 13-week residency at XOYO London in 2018.",
      },
      {
        name: "Goldie",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f4/Goldie_2003_crop.jpg",
        bio: "London DJ, producer and visual artist; co-founder of the Metalheadz label and a pioneer of jungle.",
      },
      {
        name: "Shy FX",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Shy_FX.jpg",
        bio: "London jungle and drum & bass DJ/producer; his 1994 single 'Original Nuttah' is a genre classic and he co-founded Digital Soundboy.",
      },
      {
        name: "DJ EZ",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ed/DJ_EZ_in_2016.png",
        bio: "London DJ and UK garage pioneer; hosted a long-running weekly show on Kiss 100.",
      },
      {
        name: "Carl Cox",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/65/CarlCox.jpg",
        bio: "British techno DJ; held a 15-year residency at Space Ibiza and runs the Intec label.",
      },
      {
        name: "Nicole Moudaber",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a0/Nicole_Moudaber_01.jpg",
        bio: "London-based techno DJ and producer; founder of MOOD Records and host of the 'In the MOOD' radio show.",
      },
      {
        name: "Annie Mac",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b9/Annie_Mac.jpg",
        bio: "Irish DJ and broadcaster based in London; presented her BBC Radio 1 dance show from 2004 to 2021.",
      },
      {
        name: "Pete Tong",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/dc/Pete_Tong.jpg",
        bio: "London-based DJ and BBC Radio 1 broadcaster; has hosted the Essential Mix since 1993 and received an MBE in 2014.",
      },
      {
        name: "Horse Meat Disco",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/cf/Horse_Meat_Disco_DJ_group_photo.jpg",
        bio: "London DJ collective; have run their Sunday disco party at Eagle London since 2004.",
      },
      {
        name: "Juls",
        photoUrl: "https://image.rinse.fm/_/Juls-Baby-2-2.jpg",
        bio: "London-born Ghanaian DJ and producer; won Producer of the Year at the 2025 MOBO Awards and is resident DJ at KOKO.",
      },
    ],
  },
  {
    rankingSlug: "best-university-dance-crew-london-2026",
    nominees: [
      {
        name: "KCL Fusion",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/14/King%27s_College_London_logo.svg",
        bio: "The national university competition team of KCL Dance Society, fielding teams in styles including Jazz, Contemporary, Hip Hop, Tap, Ballet, Lyrical, Commercial and Wildcard, with documented first-place wins at recent inter-university competitions.",
      },
      {
        name: "ICU Funkology",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/06/Imperial_College_London_new_logo.png",
        bio: "Imperial College's hip-hop and breaking dance society, whose constitution says it promotes hip-hop dance and breaking within Imperial and represents the university at external events and university competitions.",
      },
      {
        name: "UCL Dance Society Competition Team",
        photoUrl: "https://cdn.ucl.ac.uk/logos/ucl/ucl-logo--primary.svg",
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
        photoUrl: "https://lh3.googleusercontent.com/ci/AL18g_TLW1dFnvORCLJqAD2jw8U_vX9UyFhuMQTqaIdWk5Fvv8qIZpcwtKklI98Vnr6NRsaJnEMs1mzH=s1600",
        bio: "London sound system built around founder Lloyd 'Coxsone' Cox, documented as a pioneering UK reggae sound.",
      },
      {
        name: "Aba Shanti-I",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5c/Aba-Shanti-I.tif/lossy-page1-330px-Aba-Shanti-I.tif.jpg",
        bio: "Roots reggae sound system listed on the official Notting Hill Carnival site, known for heavyweight dub sessions.",
      },
      {
        name: "Jah Shaka Sound System",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/05/SHAKA.JPG",
        bio: "Sound system of Jamaican-born UK reggae figure Jah Shaka, billed with Young Warrior Sound at Egg London for 'Dance for Shaka 2026'.",
      },
      {
        name: "Fatman Sound System",
        photoUrl: "https://thumbnailer.mixcloud.com/unsafe/136x136/profile/c/3/6/e/b578-0a94-443e-b2a7-0339e8b09d2d",
        bio: "London sound system documented in UK sound-system history and filmed playing out in London in 2025.",
      },
      {
        name: "Unit 137",
        photoUrl: "https://www.unit137.com/wp-content/uploads/2019/08/about-events-unit137-soundsystem-800x500-v1.jpg",
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
        photoUrl: "https://thumb.wikimedia.org/wikipedia/en/thumb/a/a2/Crystal_Palace_FC_logo_%282022%29.svg/960px-Crystal_Palace_FC_logo_%282022%29.svg.png",
        bio: "South London club; Premier League, Selhurst Park.",
      },
      {
        name: "Millwall",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/en/thumb/9/98/Millwall_FC_crest.svg/960px-Millwall_FC_crest.svg.png",
        bio: "South London club; The Den.",
      },
      {
        name: "Charlton Athletic",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/en/thumb/f/f5/Charlton_Athletic_FC_crest.svg/960px-Charlton_Athletic_FC_crest.svg.png",
        bio: "South London EFL club; The Valley.",
      },
      {
        name: "AFC Wimbledon",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/en/thumb/1/1b/AFC_Wimbledon_%282020%29_logo.svg/960px-AFC_Wimbledon_%282020%29_logo.svg.png",
        bio: "South London EFL club; Plough Lane.",
      },
      {
        name: "Sutton United",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/en/thumb/e/eb/Sutton_United_FC_crest.svg/960px-Sutton_United_FC_crest.svg.png",
        bio: "South London EFL club; known for strong cup performances.",
      },
      {
        name: "Bromley",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/en/thumb/3/35/Bromley_FC_crest.svg/960px-Bromley_FC_crest.svg.png",
        bio: "South London club; Hayes Lane.",
      },
      {
        name: "Dulwich Hamlet",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/07/Dulwich_Hamlet_F.C._logo.png/1280px-Dulwich_Hamlet_F.C._logo.png",
        bio: "South London non-league club; Isthmian Premier, Champion Hill.",
      },
      {
        name: "Welling United",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/en/thumb/3/3e/Welling_United_F.C._logo.svg/960px-Welling_United_F.C._logo.svg.png",
        bio: "South London non-league club; Isthmian Premier.",
      },
      {
        name: "Dartford",
        photoUrl: "https://upload.wikimedia.org/wikipedia/en/9/9e/Dartford_FC.svg",
        bio: "South-east London non-league club; Isthmian Premier.",
      },
      {
        name: "Carshalton Athletic",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/en/thumb/6/69/Carshalton_Athletic_F.C._logo.svg/960px-Carshalton_Athletic_F.C._logo.svg.png",
        bio: "South London non-league club; Isthmian Premier.",
      },
      {
        name: "Cray Wanderers",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/en/thumb/f/f8/Cray_Wanderers_F.C._logo.svg/960px-Cray_Wanderers_F.C._logo.svg.png",
        bio: "South London non-league club; Isthmian Premier.",
      },
      {
        name: "Tooting & Mitcham United",
        photoUrl: "https://tmunited.org/wp-content/uploads/2025/03/logo_tmu_new.png",
        bio: "South London non-league club; historic local rivalry with Dulwich Hamlet and Wimbledon.",
      },
      {
        name: "Fisher FC",
        photoUrl: "https://upload.wikimedia.org/wikipedia/en/d/d8/Fisher_F.C._logo.png",
        bio: "South London non-league club; Isthmian South East Division.",
      },
    ],
  },
  {
    rankingSlug: "loudest-football-fanbase-london-2026",
    nominees: [
      {
        name: "Crystal Palace — Holmesdale Fanatics",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f3/HOLMSDALE_FANATICS.jpg",
        bio: "Ultras group founded in 2005, based in Selhurst Park's Holmesdale Road Stand; tifo and vocal displays.",
      },
      {
        name: "Millwall supporters",
        photoUrl: "https://upload.wikimedia.org/wikipedia/it/2/2d/Millwall_FC_logo.svg",
        bio: "The Den is famed for one of England's most intimidating, hostile atmospheres.",
      },
      {
        name: "Arsenal — Ashburton Army",
        photoUrl: "https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg",
        bio: "Arsenal supporters' group; part of the vocal Emirates crowd on the North Bank.",
      },
      {
        name: "Dulwich Hamlet — The Rabble",
        photoUrl: "https://img-res.pitchero.com/?url=images.pitchero.com%2Fui%2F259163%2Fimage_5cb08095f2381.png&h=550&w=980&t=fit&o=jpg",
        bio: "Supporters behind the goal at Champion Hill; among the loudest followings in non-league football.",
      },
      {
        name: "West Ham supporters",
        photoUrl: "https://upload.wikimedia.org/wikipedia/en/c/c2/West_Ham_United_FC_logo.svg",
        bio: "London Stadium support; the Trevor Brooking Stand is the ground's loudest section.",
      },
      {
        name: "Tottenham supporters",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/96/Chelsea_v_Spurs_2_May_2016_-_fans_on_terrace.jpg/1280px-Chelsea_v_Spurs_2_May_2016_-_fans_on_terrace.jpg",
        bio: "Tottenham Hotspur Stadium support; the South Stand is the ground's loudest section.",
      },
      {
        name: "Chelsea supporters",
        photoUrl: "https://upload.wikimedia.org/wikipedia/en/c/cc/Chelsea_FC.svg",
        bio: "Stamford Bridge support; the Matthew Harding Stand is the ground's loudest section.",
      },
      {
        name: "Charlton supporters",
        photoUrl: "https://upload.wikimedia.org/wikipedia/en/f/f5/Charlton_Athletic_FC_crest.svg",
        bio: "The Valley support; rated above average for home atmosphere.",
      },
      {
        name: "Brentford supporters",
        photoUrl: "https://pbs.twimg.com/profile_images/2087480242256363520/dUzTHPKk_400x400.jpg",
        bio: "Gtech Community Stadium support; the West and East stands are the ground's loudest sections.",
      },
      {
        name: "Fulham supporters",
        photoUrl: "https://www.fulhamsupporterstrust.com/wp-content/uploads/2019/04/cropped-JH-Stand-scaled-1.jpg",
        bio: "Craven Cottage support; the Hammersmith End is the ground's loudest section.",
      },
      {
        name: "AFC Wimbledon supporters",
        photoUrl: "https://upload.wikimedia.org/wikipedia/en/1/1b/AFC_Wimbledon_%282020%29_logo.svg",
        bio: "Plough Lane support; fan-owned club with a vocal home following.",
      },
      {
        name: "Sutton United supporters",
        photoUrl: "https://media.thehardtackle.com/uploads/2017/02/Sutton-United-v-Arsenal-The-Emirates-FA-Cup-Fifth-Round-1.jpg",
        bio: "South London club with a loyal non-league home following.",
      },
      {
        name: "Bromley supporters",
        photoUrl: "https://upload.wikimedia.org/wikipedia/en/3/35/Bromley_FC_crest.svg",
        bio: "Hayes Lane support; community club with a growing home following.",
      },
      {
        name: "QPR supporters",
        photoUrl: "https://upload.wikimedia.org/wikipedia/en/3/31/Queens_Park_Rangers_crest.svg",
        bio: "Loftus Road support; one of London's tightest, most compact grounds.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-afrobeats-dj-london-2026",
    nominees: [
      {
        name: "Juls",
        photoUrl: "https://cdn.prod.website-files.com/633a38706320c88f5e8c4ac8/6734dc1154688f6d26ab170f_6734dabc98d9d6c80f77b206_Screenshot%25202024-11-13%2520at%25205.45.58%25E2%2580%25AFPM.jpeg",
        bio: "British-Ghanaian DJ and producer credited with shaping modern Afrobeats; he won Best Producer at the 2025 MOBO Awards.",
      },
      {
        name: "DJ Abrantee",
        photoUrl: "https://www.nydjlive.com/wp-content/uploads/2021/07/Sarkodie-and-DJ-Abrantee-scaled.jpeg",
        bio: "Credited with pioneering the Afrobeats movement in the UK; he launched the world's first Afrobeats radio show in April 2011 and broadcasts on Capital Xtra.",
      },
      {
        name: "Jeremiah Asiamah",
        photoUrl: "https://radiotoday.co.uk/wp-content/uploads/2020/01/j.png",
        bio: "Hosts the 1Xtra Rave Show on BBC Radio 1Xtra, spanning Afrobeats, Afro house and amapiano.",
      },
      {
        name: "Afro B",
        photoUrl: "https://images.thebrag.com/cdn-cgi/image/fit=crop,width=1200,height=628/https://images-r2-1.thebrag.com/td/uploads/2021/11/afro-b-gtk.jpg",
        bio: "Hitmaker behind Drogba (Joanna) who coined the term Afrowave for his fusion of hip-hop, dancehall and Afrobeats.",
      },
      {
        name: "DJ Spinall",
        photoUrl: "https://magazine-resources.tidal.com/uploads/2016/10/DJSpinall_1200.jpg",
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
        photoUrl: "https://i.audiomack.com/montanathedj/4f9e8efd50.webp?width=1200",
        bio: "Known for versatile mixes promoting Afrobeats and UK underground music.",
      },
      {
        name: "DJ Abass",
        photoUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhfsYUgxNIkPY4C5AVKhXvWxyQorYw-3fV7VvT7nTGSMvWnEonBC59kMACS8tcFHT2m8hDYjuMp4XQpVZzwVKRo-YFam9sAtUKKn0bYJRvpkIWnHbo6eSSqH1tUZNAcouq9T31as7davQ/s400/221927_10150184696891812_503876811_7095321_4367911_n.jpg",
        bio: "Media and entertainment consultant who has promoted Nigerian music and culture in the UK.",
      },
      {
        name: "DJ Cuppy",
        photoUrl: "https://www.bellanaija.com/wp-content/uploads/2019/03/Cuppy-In-The-Mix-1000x600.jpg",
        bio: "British-Nigerian DJ who presented BBC Radio 1Xtra's Sunday Breakfast Show and hosted Apple Music's Africa Now Radio.",
      },
      {
        name: "DJ SoGood",
        bio: "London-based Nigerian DJ interviewed about his UK DJ career.",
      },
      {
        name: "DJ Alexo",
        photoUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEj14CRZQ6iXiPKD-AK3PiogIQR67lHP19GjNAvHmrvNyEbP_9Pg5nr9MYueOPSW11Kba9AmcB2u7vEZV2A1k7DGlXmLhQhZibJ0yCIfdmBTijDoC7P7mcdl1xtnDHx62V6mL9p3si8rrQ/s1600/Screen+Shot+2013-02-07+at+18.54.03.png",
        bio: "London-based Nigerian DJ interviewed about his UK DJ career.",
      },
      {
        name: "DJ Stevon",
        photoUrl: "https://naijaeventexperts.com/wp-content/uploads/2023/11/Dj-Stevon.png",
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
        photoUrl: "https://static.ra.co/images/profiles/square/mixolis.jpg?dateUpdated=1752151685223",
        bio: "London-based amapiano DJ with appearances at Ministry of Sound, Boiler Room, E1 and AMAFEST.",
      },
      {
        name: "Rosey Gold",
        photoUrl: "https://images.squarespace-cdn.com/content/v1/560c221ee4b0be9267dba750/89c4a42c-926c-45b8-ac8f-4d94bc0a3a7f/IMG_8550.jpg",
        bio: "London-based South African amapiano DJ and radio personality.",
      },
      {
        name: "OneThabs",
        photoUrl: "https://static.ra.co/images/profiles/square/onethabs.jpg?dateUpdated=1",
        bio: "Amapiano DJ active on the London scene.",
      },
      {
        name: "E305",
        photoUrl: "https://pbs.twimg.com/profile_images/1663838795295227904/aamwldsb_400x400.jpg",
        bio: "DJ on London's amapiano circuit, named on the line-up for the Sounds on the South amapiano party at E1 London.",
      },
      {
        name: "Kwamzy",
        photoUrl: "https://static.ra.co/images/profiles/square/djkwamzy.jpg?dateUpdated=1769440991547",
        bio: "DJ on London's amapiano circuit, named on the line-up for the Sounds on the South amapiano party at E1 London.",
      },
      {
        name: "RedHour",
        photoUrl: "https://static.ra.co/images/profiles/square/redhour.jpg?dateUpdated=1",
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
        photoUrl: "https://image.rinse.fm/_/riria.00_13_08_23.Still005.png?w=1200&h=630",
        bio: "Tokyo-born, London-based DJ who mixes amapiano with UK garage and global bass; she took up a Rinse FM residency in 2025.",
      },
      {
        name: "DJ YB UK",
        photoUrl: "https://www.addtoevent.co.uk/sites/default/files/styles/one-fourth/public/img_9094.png",
        bio: "London-based open-format DJ who lists amapiano and Afrobeats among his styles.",
      },
      {
        name: "DJ Delight NGB",
        photoUrl: "https://www.360naijahits.com.ng/wp-content/uploads/2026/09/IMG-20260917-WA0031-350x350.jpg",
        bio: "UK-based DJ playing Afro-fusion, amapiano and Afrobeats.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-bakery-creator-london-2026",
    nominees: [
      {
        name: "Jemma Wilson",
        photoUrl: "https://yt3.googleusercontent.com/om0imbOyhylWwhZbRKb8DhAdepPA7NKbK_2pp3bldvob-GRgqPi9buaM4NmPv6eDYlL2WSRai1g=s900-c-k-c0x00ffffff-no-rj",
        bio: "Jemma Wilson, known as Cupcake Jemma, is the co-owner of the London bakery Crumbs & Doilies and host of the Cupcake Jemma YouTube channel.",
      },
      {
        name: "Benjamina Ebuehi",
        photoUrl: "https://loveincorporated.blob.core.windows.net/contentimages/main/2b71e8ad-e740-468f-9e8d-7f02f2468863-benjaminaebuehigreatbritishbakeoff.jpg",
        bio: "London-based baker and cookbook author, known for her dessert recipes and online baking content.",
      },
      {
        name: "Ruby Bhogal",
        photoUrl: "https://thegreatbritishbakeoff.co.uk/wp-content/uploads/2018/08/New-Project.jpg",
        bio: "London-based baker and former Great British Bake Off finalist, known for her patisserie-style bakes.",
      },
      {
        name: "Liam Charles",
        photoUrl: "https://www.handshake-worthy.com/photos/bakers/liam-charles.jpg",
        bio: "Hackney-born baker and former Great British Bake Off contestant, now a television presenter and cookbook author.",
      },
      {
        name: "Edd Kimber",
        photoUrl: "https://pbs.twimg.com/profile_images/859493576375455749/eZD3ITJi_400x400.jpg",
        bio: "Winner of the first series of The Great British Bake Off; London-based baker and cookbook author.",
      },
      {
        name: "Manon Lagrève",
        photoUrl: "https://cdn.shopify.com/s/files/1/0850/1821/4728/files/manon-lagreve-header_480x480.jpg?v=1744643027",
        bio: "Clapham-based French baker and former Great British Bake Off contestant, known for her patisserie.",
      },
      {
        name: "Syabira Yusoff",
        photoUrl: "https://cdnx.premiumread.com/?url=https://www.malaymail.com/malaymail/uploads/images/2022/11/16/68886.jpeg&w=1000&q=100&f=jpg&t=6",
        bio: "Winner of The Great British Bake Off 2022; London-based Malaysian-born baker.",
      },
      {
        name: "Lily Vanilli",
        photoUrl: "https://www.deliciousmagazine.co.uk/wp-content/uploads/2024/11/Lily-Vanilli-portrait-768x768.jpg",
        bio: "East London baker known for her bespoke cakes and bakes.",
      },
      {
        name: "Crystelle Pereira",
        photoUrl: "https://thegreatbritishbakeoff.co.uk/wp-content/uploads/2021/09/CRYSTELLE.jpg",
        bio: "London-based baker and former Great British Bake Off finalist.",
      },
      {
        name: "Juliet Sear",
        photoUrl: "https://images.plex.tv/photo?size=large-1920&scale=1&url=https%3A%2F%2Fmetadata-static.plex.tv%2Fe%2Fgracenote%2Feb2e98689a1413cb263229136dab7d90.jpg",
        bio: "London-based baker, cake artist and television presenter; author of baking books.",
      },
      {
        name: "Ravneet Gill",
        photoUrl: "https://www.goodfoodshow.com/wp-content/smush-webp/2022/04/Ravneet-Gill-1024-x-1024.jpg.webp",
        bio: "London-based pastry chef and cookbook author.",
      },
      {
        name: "Claire Ptak",
        photoUrl: "https://tmhmedia.themodernhouse.com/uploads/MH.CAH_.ClairePtak-31.jpg",
        bio: "Owner of the Violet Bakery in Hackney, London; she baked the wedding cake for Prince Harry and Meghan Markle.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-celebrity-chef-london-2026",
    nominees: [
      {
        name: "Gordon Ramsay",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/02/Gordon_Ramsay_colour_Allan_Warren.jpg",
        bio: "Celebrity chef and restaurateur with restaurants across London, including Restaurant Gordon Ramsay in Chelsea.",
      },
      {
        name: "Heston Blumenthal",
        photoUrl: "https://loveincorporated.blob.core.windows.net/contentimages/gallery/d864195a-2950-429b-9ab5-c651cf7c95d1-Heston%20Blumenthal.jpg",
        bio: "Celebrity chef known for The Fat Duck; runs Dinner by Heston Blumenthal in London.",
      },
      {
        name: "Marcus Wareing",
        photoUrl: "https://reportergourmet.com/upload/chef/299/d_Marcus-Wareing.png",
        bio: "Celebrity chef and restaurateur; runs the restaurant Marcus in Knightsbridge, London.",
      },
      {
        name: "Michel Roux Jr",
        photoUrl: "https://www.cacao-barry.com/sites/default/files/styles/teaser_overview_image/public/2023-06/micheR_0.jpg.webp?itok=TGNs-msP",
        bio: "Celebrity chef; runs Le Gavroche in London and appears on television cooking shows.",
      },
      {
        name: "Rick Stein",
        photoUrl: "https://saga.co.uk/helix-contentlibrary/exceptional/2024/02/rick-stein-holding-fish-in-a-harbour-shutterstock-richard-young.jpg?mw=1440&hash=2028CDAC762E36F14EAACA767EAE2688",
        bio: "Celebrity chef and television presenter with restaurants including a seafood restaurant in London.",
      },
      {
        name: "Giorgio Locatelli",
        photoUrl: "https://italiasquisita.net/files/chunks/67879b1ca0d556722c0003fc/photo-resp-915_67879b99a0d5567236000408.jpg",
        bio: "Celebrity Italian chef; runs Locanda Locatelli in Marylebone, London.",
      },
      {
        name: "Richard Corrigan",
        photoUrl: "https://www.thetaste.ie/wp-content/uploads/2018/05/Richard-Corrigan--e1525267437585.jpg",
        bio: "Celebrity chef and restaurateur with restaurants in London, including Corrigan's Mayfair.",
      },
      {
        name: "Clare Smyth",
        photoUrl: "https://tiempoderelojes.com/wp-content/uploads/2025/07/Hublot_Friend_of_the_Brand_3_Michelin_Star_Chef_Clare_Smyth_in_her_restaurant_Core_by_Clare_Smyth_5-1638x2048.jpg.webp",
        bio: "Celebrity chef; runs Core by Clare Smyth in Notting Hill, London.",
      },
      {
        name: "Tom Kerridge",
        photoUrl: "https://www.abouttimemagazine.co.uk/wp-content/uploads/2016/10/TKE-2015-1-002-1200x1800.jpg",
        bio: "Celebrity chef and television presenter; launched a bar and restaurant at the Corinthia hotel in London.",
      },
      {
        name: "Ainsley Harriott",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f9/Ainsleytaste.jpg",
        bio: "Celebrity chef and television presenter known for his BBC cooking shows.",
      },
      {
        name: "Raymond Blanc",
        photoUrl: "https://wholesalemanager.co.uk/wp-content/uploads/2024/05/raymond-blacn-2-6464f19d54b5a.jpeg",
        bio: "Celebrity chef and restaurateur; founder of Brasserie Blanc restaurants.",
      },
      {
        name: "Gennaro Contaldo",
        photoUrl: "https://www.deliciousmagazine.co.uk/wp-content/uploads/2019/05/gennaro-768x960.jpg",
        bio: "Celebrity Italian chef and television presenter, known for his long-running TV cooking shows.",
      },
      {
        name: "Jamie Oliver",
        photoUrl: "https://cdn.jamieoliver.com/jog/uploads/2021/06/72dpi_71957_7_S2_Ep9_Jamie_-Keep-Cooking-Family-Favourites-1-720x300.jpg",
        bio: "Celebrity chef and television presenter; founder of the Jamie Oliver restaurant group.",
      },
      {
        name: "Angela Hartnett",
        photoUrl: "https://dm1igrl0afsra.cloudfront.net/AcuCustom/Sitename/DAM/051/uxGYLciQwivkiXR4nPBW.jpg",
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
        photoUrl: "https://velocitypress.uk/wp-content/uploads/2022/11/SarahGinn1000.jpg",
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
        photoUrl: "https://liverpoolmusiccity.com/wp-content/uploads/2024/05/MarkMcNulty.jpg",
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
        photoUrl: "https://pbs.twimg.com/profile_images/2339804881/d8tbiav8d8d6hiqa3sen_400x400.jpeg",
        bio: "London bartender and cocktail creator, known for his online cocktail videos.",
      },
      {
        name: "Nigel Kabvina",
        photoUrl: "https://media.checkfluence.com/influencers/photos/simplyni-1717477844-aqkmIuT0T5y3eazRkv40Vc5y5FyVfA.jpg",
        bio: "London-based mixologist and TikTok cocktail creator.",
      },
      {
        name: "Giorgio Bargiani",
        photoUrl: "https://mma.prnewswire.com/media/2996841/50Best_Giorgio_Bargiani.jpg",
        bio: "Head bartender at the Connaught Bar in Mayfair, London; named Bartenders' Bartender at Europe's 50 Best Bars 2026.",
      },
      {
        name: "Remy Savage",
        bio: "London bartender and bar owner; opened the Bauhaus Warehaus bar in London.",
      },
      {
        name: "Monica Berg",
        photoUrl: "https://www.the50.com/stories/filestore/jpg/Blog19-MonicaBerg-Social-60.jpg",
        bio: "London-based bartender; co-owner of Tayēr + Elementary in London, named the world's best bar two years in a row.",
      },
      {
        name: "Alex Kratena",
        photoUrl: "https://images.ctfassets.net/6zncp07wiqyq/SfVP75aRy7qDonu7ty6bd/a5e883dba267eb368d78983827f008e2/media_uihnwms1_inspiration-and-resources-_-blogs-inspiration-_-careers-_-learning-from-successful-famous-bartenders-_-alex-1.jpg",
        bio: "London-based bartender; co-owner of Tayēr + Elementary in London, named the world's best bar two years in a row.",
      },
      {
        name: "Ryan Chetiyawardana",
        photoUrl: "https://images.ctfassets.net/6zncp07wiqyq/6R2kFnIK12Z5eciGxLKyRC/b4b9396bec588899aa5ef9874fb0e011/our-experts_industry-experts_ryan-chetiyawardana-mr-lyan__1_.jpg",
        bio: "London bartender known as Mr Lyan; founder of the Lyaness bar in London.",
      },
      {
        name: "Max Venning",
        photoUrl: "https://media.slman.com/48GDhaNQnSullnilM4p0bjzJBgY=/1600x900/smart/https%3A%2F%2Fslman.com%2Fsites%2Fslman%2Ffiles%2Farticles%2F2024%2F07%2Fsl-man-site-assets-240724-hero-my-life-in-booze-max-venning.png",
        bio: "London bartender; co-founder of the Three Sheets cocktail bar in Dalston.",
      },
      {
        name: "Noel Venning",
        photoUrl: "https://pbs.twimg.com/profile_images/794146043046793216/8XjwrKL2_400x400.jpg",
        bio: "London bartender; co-founder of the Three Sheets cocktail bar in Dalston.",
      },
      {
        name: "Angelos Bafas",
        photoUrl: "https://www.thespiritsbusiness.com/content/uploads/2026/06/Angelos-Bafas.jpg",
        bio: "London bartender featured in The Times' guide to the city's cocktail bars.",
      },
      {
        name: "Simone Caporale",
        photoUrl: "https://www.cathaypacific.com/content/dam/focal-point/cx/inspiration/2025/07/Dining_Interview_Simone_Caporale-SIPS_team-courtesyimages-1.renditionimage.600.900.jpg",
        bio: "London-based bartender named among the world's ten best bartenders.",
      },
      {
        name: "Matt Whiley",
        photoUrl: "https://whotels.com/wp-content/uploads/2025/01/W-Brisbane-HR-16x10-16-m.jpg",
        bio: "London bartender and cocktail creator.",
      },
      {
        name: "Tony Conigliaro",
        photoUrl: "https://www.bitterbooze.com/wp-content/uploads/2015/06/Tony-Conigliaro-mixologist.jpg",
        bio: "London cocktail creator; his drinks take centre stage at Bar Termini in Soho, London.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-comedian-london-2026",
    nominees: [
      {
        name: "Jimmy Carr",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/69/Jimmy_Carr_2024_%28cropped%29.png",
        bio: "Stand-up touring the UK in 2025; host of 8 Out of 10 Cats.",
      },
      {
        name: "Michael McIntyre",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c6/Michael_McIntyre_-_Soho_Theatre_-_Monday_15th_May_2017_McIntyreSoho150517-3_%2834521895292%29_%28cropped%29.jpg",
        bio: "London-born stand-up and host of Michael McIntyre's Big Show.",
      },
      {
        name: "Mo Gilligan",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Mo_Gilligan_2023_Image_by_Thomas_Morgan_%28cropped-J1%29.jpg",
        bio: "Stand-up and TV host with a 2025 UK live tour.",
      },
      {
        name: "Lou Sanders",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/30/Lou_Sanders_at_BAFTA_2026_02.jpg",
        bio: "Stand-up with a 2025 UK live tour.",
      },
      {
        name: "Babatunde Aléshé",
        photoUrl: "https://image.assets.pressassociation.io/v2/image/production/bef8e3bd1d633000c57b12aeacc95b11Y29udGVudHNlYXJjaGFwaSwxNzY0MTkyNjE4/2.75269485.jpg?w=640",
        bio: "Stand-up and actor with a 2025 UK live tour.",
      },
      {
        name: "James Acaster",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/85/James_Acaster_Union_Hall_09_%28cropped%29.jpg",
        bio: "Stand-up touring the UK in 2026 with a brand new show.",
      },
      {
        name: "Romesh Ranganathan",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/87/RomeshRanganathan-byPhilipRomano.jpg",
        bio: "Stand-up announcing a 2027 arena tour including London's O2; co-host of Wolf and Owl.",
      },
      {
        name: "Russell Howard",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/50/Russell_Howard_2017_%28cropped%29.png",
        bio: "Stand-up touring the UK with his latest show.",
      },
      {
        name: "Tom Davis",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/22/Tom_Davis_2018.jpg",
        bio: "Stand-up and creator/star of King Gary; co-host of Wolf and Owl with Romesh Ranganathan.",
      },
      {
        name: "Jack Whitehall",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/51/Jack_Whitehall_%28cropped%29.jpg",
        bio: "Arena-touring stand-up; his Bad Influence tour played UK arenas.",
      },
      {
        name: "Ed Gamble",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/ca/Ed_Gamble-2.jpg",
        bio: "Stand-up and co-host of the Off Menu podcast.",
      },
      {
        name: "Rob Beckett",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/77/Rob_Beckett_in_Roald_Dahl%E2%80%99s_Most_Marvellous_Book_2016.jpg",
        bio: "Stand-up and co-host of the Parenting Hell podcast.",
      },
      {
        name: "Josh Widdicombe",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/04/Josh_Widdicombe_%2827394462077%29_%28cropped%29.jpg",
        bio: "Stand-up and co-host of the Parenting Hell podcast.",
      },
      {
        name: "Nish Kumar",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/55/Nish_Kumar%2C_2019_Freedom_of_Expression_Awards_%2840575331383%29_%28cropped%29.jpg",
        bio: "Stand-up and co-host of the Pod Save the UK podcast.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-comedy-creator-london-2026",
    nominees: [
      {
        name: "Munya Chawawa",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/25/Munya_Chawawa_in_2020.png",
        bio: "British-Zimbabwean comedian known for satirical sketch characters; Taskmaster contestant.",
      },
      {
        name: "Harry Pinero",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5b/Harry_Pinero_%28cropped%29.png",
        bio: "Peckham-born comedy creator known for street-interview sketches.",
      },
      {
        name: "Stephen Tries",
        photoUrl: "https://yt3.googleusercontent.com/ytc/AIdro_nI2GujEmrOtUFn4dKCPKh_25x-vePLZUeRdoLXQm5QUiQ=s900-c-k-c0x00ffffff-no-rj",
        bio: "British sketch comedy creator known for short character videos.",
      },
      {
        name: "Italian Bach",
        photoUrl: "https://yt3.googleusercontent.com/buYLxLaJBp1gOWU96P9bMblJsr82YR591GREaJM36d_gWusS-jJDY8bAibAhShIvPurApPMbAQ=s900-c-k-c0x00ffffff-no-rj",
        bio: "British comedy TikToker with around 2.4M followers.",
      },
      {
        name: "MC Hammersmith",
        photoUrl: "https://yt3.googleusercontent.com/jwZF0q45WLt-1Q5d20f4ssR5Le0HaQZwpmhS_De4YUaWme5n23tM5bck0pJy6j4RIXTz722F=s900-c-k-c0x00ffffff-no-rj",
        bio: "London comedy-rapper character performing freestyle videos.",
      },
      {
        name: "Amelia Dimoldenberg",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/23/Amelia_Dimoldenberg-08902.jpg",
        bio: "Creator and host of the interview series Chicken Shop Date.",
      },
      {
        name: "GK Barry",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/bb/GK_Barry_at_SXSW_London_2026_%28cropped%29.jpg",
        bio: "British comedy TikToker; I'm a Celebrity 2024 contestant.",
      },
      {
        name: "Nella Rose",
        photoUrl: "https://images.immediate.co.uk/production/volatile/sites/3/2026/04/777994S9Ep4The-Great-Celebrity-Bake-Off-for-SU2C-Series-9-Ep4-0c38620.jpg?quality=90&fit=700,466",
        bio: "London comedy creator and TV presenter.",
      },
      {
        name: "Chunkz",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/81/Chunkz_in_2021.png",
        bio: "London creator known for prank and challenge comedy videos.",
      },
      {
        name: "Niko Omilana",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/3c/Niko_Omilana_in_2023.png",
        bio: "Viral prank video creator and Beta Squad founder.",
      },
      {
        name: "Darkest Man",
        photoUrl: "https://yt3.googleusercontent.com/w42Ew-Hv42SOhfWMuSFEixtyRExW1xKZ6yMSppd1W9KorPWFrduLr4gMwEzBmXAhKUwHDJkw=s900-c-k-c0x00ffffff-no-rj",
        bio: "London comedy creator and Beta Squad affiliate.",
      },
      {
        name: "Calfreezy",
        photoUrl: "https://yt3.googleusercontent.com/obKri8LQKWqPIkDIU6nKWLmcCj9aNjNq_LV3bd3tGQjHLKQveo2vwEOhWIZs_uYyECc-Jhlg=s900-c-k-c0x00ffffff-no-rj",
        bio: "London creator and Fellas Studios co-founder; comedy and lifestyle videos.",
      },
      {
        name: "Theo Baker",
        photoUrl: "https://yt3.googleusercontent.com/P72QjRRCBlBB3UaO2T4iiIUWMSE_YaW83jStPEye-giPmSc_2Nt0YOhyZDhflnbwbzssBln_xA=s900-c-k-c0x00ffffff-no-rj",
        bio: "London creator and Fellas Studios member.",
      },
      {
        name: "KingKenny",
        photoUrl: "https://yt3.googleusercontent.com/ytc/AIdro_k1w7-5xnNJLotZUWfI-JfRjRVzD3gQFitPTlr1cCsmgg=s900-c-k-c0x00ffffff-no-rj",
        bio: "Beta Squad comedy creator and Misfits boxer.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-comedy-podcast-host-london-2026",
    nominees: [
      {
        name: "Rob Beckett",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/77/Rob_Beckett_in_Roald_Dahl%E2%80%99s_Most_Marvellous_Book_2016.jpg",
        bio: "Co-host of Parenting Hell, the UK's No.1 comedy podcast.",
      },
      {
        name: "Josh Widdicombe",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/04/Josh_Widdicombe_%2827394462077%29_%28cropped%29.jpg",
        bio: "Co-host of Parenting Hell, the UK's No.1 comedy podcast.",
      },
      {
        name: "Ed Gamble",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/ca/Ed_Gamble-2.jpg",
        bio: "Co-host of Off Menu with James Acaster.",
      },
      {
        name: "James Acaster",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/85/James_Acaster_Union_Hall_09_%28cropped%29.jpg",
        bio: "Co-host of Off Menu with Ed Gamble.",
      },
      {
        name: "Andy Zaltzman",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Andy_Zaltzman_%28cropped%29.jpg",
        bio: "Host of the satirical news podcast The Bugle.",
      },
      {
        name: "Richard Herring",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/31/Richard_Herring%2C_As_It_Occurs_To_Me%2C_Leicester_Square_Theatre_20_Jun_2011_crop.jpg",
        bio: "Host of Richard Herring's Leicester Square Theatre Podcast.",
      },
      {
        name: "Jamie Morton",
        photoUrl: "https://api.photon.aremedia.net.au/wp-content/uploads/sites/8/nznow/2019/12/17/44127/My-Dad-Wrote-A-Porno-Jamie-Morton.jpg?resize=980%2C551&format=auto",
        bio: "Host of My Dad Wrote A Porno.",
      },
      {
        name: "Romesh Ranganathan",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/87/RomeshRanganathan-byPhilipRomano.jpg",
        bio: "Host of Hip Hop Saved My Life.",
      },
      {
        name: "Nish Kumar",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/55/Nish_Kumar%2C_2019_Freedom_of_Expression_Awards_%2840575331383%29_%28cropped%29.jpg",
        bio: "Co-host of Pod Save the UK with Coco Khan.",
      },
      {
        name: "GK Barry",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/bb/GK_Barry_at_SXSW_London_2026_%28cropped%29.jpg",
        bio: "Host of the Saving Grace podcast.",
      },
      {
        name: "Amelia Dimoldenberg",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/23/Amelia_Dimoldenberg-08902.jpg",
        bio: "Host of the Chicken Shop Date podcast.",
      },
      {
        name: "Dan Schreiber",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/89/Dan_Schreiber_20231205.jpg",
        bio: "Host of the fact-based comedy podcast No Such Thing As A Fish.",
      },
      {
        name: "James Harkin",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a9/James_Harkin_%28podcaster%29_%28cropped%29.jpg",
        bio: "Host of the fact-based comedy podcast No Such Thing As A Fish.",
      },
      {
        name: "William Hanson",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c9/William_Hanson.jpg",
        bio: "Co-host of Help I Sexted My Boss with Jordan North.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-dancehall-dj-london-2026",
    nominees: [
      {
        name: "Becca Dudley",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/9c/Becca_dudley_2017_1.jpg",
        bio: "International reggae and dancehall DJ with appearances at Glastonbury, Notting Hill Carnival, City Splash and Reggaeland.",
      },
      {
        name: "Linett Kamala",
        photoUrl: "https://www.clashmusic.com/wp-content/uploads/2023/08/Linett-Kamala-8-Photo-credit-Kingsley-Davis-%C2%A9-Lin-Kam-Art-2023-684x1024.jpg",
        bio: "Longstanding sound-system DJ associated with Notting Hill Carnival.",
      },
      {
        name: "Seani B",
        bio: "Host of BBC Radio 1Xtra's Dancehall Show.",
      },
      {
        name: "Robbo Ranx",
        photoUrl: "https://speakrj.nyc3.cdn.digitaloceanspaces.com/instagram/robboranxradio.jpg",
        bio: "UK dancehall and reggae DJ who presented on BBC Radio 1Xtra for 12 years.",
      },
      {
        name: "David Rodigan",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0a/Sir_David_Rodigan_al_MusicaW_Festival.jpg",
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
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f3/Mykaell_Riley_Ras_Kwame_bass_culture_expo_70-50_launch.jpg",
        bio: "Capital Xtra DJ who hosts the weekly Reggae Recipe chart show covering reggae and dancehall.",
      },
      {
        name: "DJ Prime",
        bio: "Guest selector on Seani B's BBC Radio 1Xtra Dancehall Show.",
      },
      {
        name: "Tash LC",
        photoUrl: "https://media2.ntslive.co.uk/resize/1600x1600/fa651466-47c1-4299-943c-e07ed42385e6_1765843200.jpeg",
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
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6e/Shirley_Ballas_20241205.jpg/1280px-Shirley_Ballas_20241205.jpg",
        bio: "Head judge on Strictly Come Dancing.",
      },
      {
        name: "Motsi Mabuse",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/81/2022-06-22-Motsi_Mabuse_LEA_Live_Entertainment_Award_15_-0167.jpg/1280px-2022-06-22-Motsi_Mabuse_LEA_Live_Entertainment_Award_15_-0167.jpg",
        bio: "Judge on Strictly Come Dancing.",
      },
      {
        name: "Anton Du Beke",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6f/Anton_Du_Beke_in_2019.png",
        bio: "Judge on Strictly Come Dancing and former professional dancer.",
      },
      {
        name: "Craig Revel Horwood",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/06/Craig-Revel-Horwood-2022.png",
        bio: "Judge on Strictly Come Dancing.",
      },
      {
        name: "Dianne Buswell",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5f/Dianne_Buswell_at_BAFTA_2026_%28cropped%29.jpg",
        bio: "Strictly Come Dancing professional; won the 2024 series with Chris McCausland.",
      },
      {
        name: "Vito Coppola",
        photoUrl: "https://yourlocallink.co.uk/wp-content/uploads/2025/07/RED-HOT-VITO-WEB-1104-2-1281x1024.jpg",
        bio: "Strictly Come Dancing professional dancer.",
      },
      {
        name: "Nikita Kuzmin",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/80/NikitaKuzmin.png",
        bio: "Strictly Come Dancing professional dancer.",
      },
      {
        name: "Gorka Marquez",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/89/Gorka_M%C3%A1rquez_-_Soccer_Aid_for_UNICEF_2025.jpg",
        bio: "Strictly Come Dancing professional dancer.",
      },
      {
        name: "Johannes Radebe",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Johannes_Radebe_in_2024.jpg",
        bio: "Strictly Come Dancing professional dancer.",
      },
      {
        name: "Katya Jones",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a6/Katya_Jones_at_BAFTAs_2026_05.jpg/1280px-Katya_Jones_at_BAFTAs_2026_05.jpg",
        bio: "Strictly Come Dancing professional dancer.",
      },
      {
        name: "Nadiya Bychkova",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/e2/Nadiya_Bychkova_2.jpg/1280px-Nadiya_Bychkova_2.jpg",
        bio: "Strictly Come Dancing professional dancer.",
      },
      {
        name: "Amy Dowden",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ea/Amy_Dowden_-_2023_%2852720307368%29_%28cropped%29.jpg",
        bio: "Strictly Come Dancing professional dancer.",
      },
      {
        name: "Karen Hauer",
        bio: "Strictly Come Dancing professional dancer.",
      },
      {
        name: "Neil Jones",
        photoUrl: "https://i2-prod.ok.co.uk/article22049301.ece/ALTERNATES/s1200e/2_Neil-Jones.jpg",
        bio: "Strictly Come Dancing professional dancer.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-derby-player-london-2026",
    nominees: [
      {
        name: "Harry Kane",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a3/Harry_Kane_England_v_Ghana_23_June_2026-219_%28cropped%29.jpg/1280px-Harry_Kane_England_v_Ghana_23_June_2026-219_%28cropped%29.jpg",
        bio: "All-time leading Premier League scorer in north London derbies (10 goals in his first 10 against Arsenal).",
      },
      {
        name: "Thierry Henry",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b9/Thierry_Henry_%2851649035951%29_%28cropped%29.jpg",
        bio: "Arsenal legend with a record 43 goals in London derbies.",
      },
      {
        name: "Emmanuel Adebayor",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/47/Emmanuel_Adebayor_-_Lech_-_Manchester_026.jpg/1280px-Emmanuel_Adebayor_-_Lech_-_Manchester_026.jpg",
        bio: "Scored 8 north London derby goals, for both Arsenal and Tottenham.",
      },
      {
        name: "Robert Pires",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/7f/Robert_Pires_2011.jpg/1280px-Robert_Pires_2011.jpg",
        bio: "Scored 7 north London derby goals for Arsenal.",
      },
      {
        name: "Gareth Bale",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/ff/2022_FIFA_World_Cup_United_States_1%E2%80%931_Wales_-_%2832%29_2.png",
        bio: "Scored 5 north London derby goals for Tottenham.",
      },
      {
        name: "Robin van Persie",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/65/Loco-Fener_%2810%29.jpg",
        bio: "Scored 25 London derby goals for Arsenal.",
      },
      {
        name: "Son Heung-min",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/BFA_2023_-2_Heung-Min_Son_%28cropped%29.jpg/1280px-BFA_2023_-2_Heung-Min_Son_%28cropped%29.jpg",
        bio: "Scored 22 London derby goals for Tottenham.",
      },
      {
        name: "Frank Lampard",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8c/Frank_Lampard_2019.jpg",
        bio: "Scored 32 London derby goals for Chelsea.",
      },
      {
        name: "Teddy Sheringham",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/0/07/Teddy_Sheringham_-_53492983124_%28original%29.jpg/1280px-Teddy_Sheringham_-_53492983124_%28original%29.jpg",
        bio: "Scored 32 London derby goals across spells with Tottenham and West Ham.",
      },
      {
        name: "Jermain Defoe",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/9e/Jermain-Defoe_%28cropped%29.jpg",
        bio: "Scored 28 London derby goals for West Ham and Tottenham.",
      },
      {
        name: "Ian Wright",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/70/Ian_Wright_at_SXSW_London_June_2025_%28cropped%29.jpg",
        bio: "Scored 28 London derby goals for Arsenal and West Ham.",
      },
      {
        name: "Didier Drogba",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/77/Didier_Drogba_%282019%29_%28cropped2%29.jpg",
        bio: "Scored 23 London derby goals for Chelsea, including 8 against Arsenal.",
      },
      {
        name: "Pierre-Emerick Aubameyang",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/37/1_Pierre-Emerick_Aubameyang_%28cropped%29.jpg",
        bio: "Scored 14 London derby goals for Arsenal.",
      },
      {
        name: "Bukayo Saka",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/2/2f/Bukayo_Saka_England_v_Ghana_23_June_2026-057_%28cropped%29.jpg/1280px-Bukayo_Saka_England_v_Ghana_23_June_2026-057_%28cropped%29.jpg",
        bio: "Scored 13 London derby goals for Arsenal.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-drag-performer-london-2026",
    nominees: [
      {
        name: "Baga Chipz",
        photoUrl: "https://www.attitude.co.uk/wp-content/uploads/sites/5/2021/06/Photo_03-06-2020_5_58_43_pm.jpg",
        bio: "East London drag artist; finished 3rd on RuPaul's Drag Race UK series 1.",
      },
      {
        name: "Divina de Campo",
        photoUrl: "https://www.intertalentgroup.com/app/uploads/2025/07/QVNIMTIwNjYzODE4.jpg",
        bio: "Drag artist from Brighouse; runner-up on RuPaul's Drag Race UK series 1.",
      },
      {
        name: "Cheryl Hole",
        photoUrl: "https://www.attitude.co.uk/wp-content/uploads/sites/5/2019/11/18680759-high_res-ru-pauls-drag-race-uk.jpg",
        bio: "Drag artist from Chelmsford; finished 4th on RuPaul's Drag Race UK series 1.",
      },
      {
        name: "Bimini Bon-Boulash",
        photoUrl: "https://www.scenemag.co.uk/content/images/size/w1200/2025/08/newFile-6.jpg",
        bio: "Drag artist from Great Yarmouth; runner-up on RuPaul's Drag Race UK series 2.",
      },
      {
        name: "Tayce",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Tayce_%28cropped%29.png/1280px-Tayce_%28cropped%29.png",
        bio: "Drag artist from Newport; competed on RuPaul's Drag Race UK series 2.",
      },
      {
        name: "Tia Kofi",
        photoUrl: "https://www.attitude.co.uk/wp-content/uploads/sites/5/2021/02/tia_feat.jpg",
        bio: "South London drag artist; finished 7th on RuPaul's Drag Race UK series 2.",
      },
      {
        name: "Asttina Mandella",
        photoUrl: "https://i2-prod.ok.co.uk/incoming/article23408935.ece/ALTERNATES/s615b/0_Asttina-Mandella.jpg",
        bio: "East London drag artist; competed on RuPaul's Drag Race UK series 2.",
      },
      {
        name: "Krystal Versace",
        photoUrl: "https://images.bauerhosting.com/celebrity/sites/4/2022/09/krystal-versace.jpg?auto=format&w=1440&q=80",
        bio: "Winner of RuPaul's Drag Race UK series 3.",
      },
      {
        name: "Ella Vaday",
        photoUrl: "https://assets.capitalfm.com/2021/33/who-is-ella-vaday-1629275044-view-0.png",
        bio: "Drag artist from Dagenham; runner-up on RuPaul's Drag Race UK series 3.",
      },
      {
        name: "Vanity Milan",
        photoUrl: "https://www.attitude.co.uk/wp-content/uploads/sites/5/2022/12/404046-1-819x1024.jpg",
        bio: "South London drag artist; finished 4th on RuPaul's Drag Race UK series 3.",
      },
      {
        name: "Danny Beard",
        photoUrl: "https://www.nationaldiversityawards.co.uk/media/221nf35a/dannybeard.png?width=432&height=361&mode=max",
        bio: "Winner of RuPaul's Drag Race UK series 4.",
      },
      {
        name: "Cheddar Gorgeous",
        photoUrl: "https://www.attitude.co.uk/wp-content/uploads/sites/5/2022/10/Screenshot-2022-10-28-at-10.19.09-e1666948887681.png",
        bio: "Manchester drag artist; runner-up on RuPaul's Drag Race UK series 4.",
      },
      {
        name: "Cara Melle",
        photoUrl: "https://artworks.thetvdb.com/banners/v4/actor/7975487/photo/6557c08b5cf70.jpg",
        bio: "London drag artist; finished 6th on RuPaul's Drag Race UK series 5.",
      },
      {
        name: "Kyran Thrax",
        photoUrl: "https://www.essex.ac.uk/-/media/header-images/2024/10/kyran-thrax-header.jpg?w=600&hash=88B8A9915E8EF0D855DD94A47FD59FC2",
        bio: "Winner of RuPaul's Drag Race UK series 6.",
      },
      {
        name: "Bones",
        photoUrl: "https://gayexpress.co.nz/wp-content/uploads/2025/08/Bones.jpg",
        bio: "London drag artist; winner of RuPaul's Drag Race UK series 7.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-drill-artist-london-2026",
    nominees: [
      {
        name: "163Margs",
        photoUrl: "https://i.audiomack.com/163margs/31cdd1dd64.webp?width=456",
        bio: "Nominated for Best Drill Act at the 2025 MOBO Awards.",
      },
      {
        name: "Central Cee",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Central_cee-5.jpg/960px-Central_cee-5.jpg",
        bio: "His album 'Can't Rush Greatness' became his second UK No.1 album and reached No.9 on the Billboard 200.",
      },
      {
        name: "Headie One",
        photoUrl: "https://www.nme.com/wp-content/uploads/2019/04/Headie-One-Pic-3.jpg",
        bio: "'Edna' was the first UK drill album to reach No.1 on the UK Albums Chart.",
      },
      {
        name: "Kairo Keyz",
        photoUrl: "https://trenchtrenchtrench.com/assets/articles/kairo-keyz-went-up/kairo-keyz-credit-fiona-duffy-2.jpg",
        bio: "Nominated for Best Drill Act at the 2025 MOBO Awards.",
      },
      {
        name: "K-Trap",
        photoUrl: "https://www.nme.com/wp-content/uploads/2020/11/K-Trap-inline.jpg",
        bio: "His collaborative album 'Strength to Strength' with Headie One reached No.4 on the UK Albums Chart and topped the UK Hip-Hop/R&B chart.",
      },
      {
        name: "Pozer",
        photoUrl: "https://www.nme.com/wp-content/uploads/2024/05/pozer-artist-1.jpg",
        bio: "Won Best Drill Act at the 2025 MOBO Awards. His single 'Kitchen Stove' has around 43 million Spotify streams.",
      },
      {
        name: "Digga D",
        photoUrl: "https://1883magazine.com/wp-content/uploads/2023/09/0002679-R1-30-31A.jpg",
        bio: "His single 'Woi' was nominated for Song of the Year at the 2020 MOBO Awards.",
      },
      {
        name: "Unknown T",
        photoUrl: "https://thefader-res.cloudinary.com/private_images/w_760,c_limit,f_auto,q_auto:best/unknown-t-rules-east-london_hprszz/kay-ibrahim.jpg",
        bio: "'Homerton B' reached No.48 in the UK and became the first UK drill track certified Silver by the BPI.",
      },
      {
        name: "M24",
        photoUrl: "https://d2ljoqkkoec4f6.cloudfront.net/wp-content/uploads/2022/10/06111253/M242-545x750.jpg",
        bio: "His single 'We Don't Dance' is BPI Silver-certified; his single 'London' reached No.32 in the UK.",
      },
      {
        name: "Kwengface",
        photoUrl: "https://www.nme.com/wp-content/uploads/2025/07/kwengface-press-sho-tPhotocredit-Lucero.jpg",
        bio: "The Peckham veteran made his third appearance on Daily Duppy in 2026.",
      },
      {
        name: "Blanco",
        photoUrl: "https://www.nme.com/wp-content/uploads/2021/08/Blanco-harlem.jpg",
        bio: "The former Harlem Spartans member released the projects 'English Dubbed' and 'City of God'.",
      },
      {
        name: "Loski",
        photoUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEhe2WXufyW5xVEgiLYa4QHC5rUMHqW7qql1X7FbRF4KOlRrGIzvztMgb63q6ylY7TUUChl9-bfrK-1BsRNP6MiV_KAa7xF-CtppTAeP27oRjgpLGn_tjp9TSL1Q3fxFghoYRgYsJ4MBDPnnBEYntFtLD5tgakF4PNUyBzdg83h8GE3QkVF2OcUixCHhVA/w1200-h630-p-k-no-nu/1601844608_99a4368b57035fdcf5594545a6abc050.jpg",
        bio: "The former Harlem Spartans member's single 'Call Me Loose' reached the UK Top 50.",
      },
      {
        name: "Abra Cadabra",
        photoUrl: "https://optimise2.assets-servd.host/dmy-mag/production/DSC_2855.jpg?w=1200&h=630&fm=jpg&auto=compress&fit=crop&crop=focalpoint&fp-x=0.4937&fp-y=0.4147&dm=1693995224&s=6af5e30d0852760e56f22fe515f28187",
        bio: "His single 'On Deck' was nominated for Song of the Year at the 2020 MOBO Awards.",
      },
      {
        name: "67",
        photoUrl: "https://images.h-wing.net/wp-content/uploads/2016/12/03181007/67.jpg",
        bio: "Their tracks 'Skengman' and 'Take It There' and the mixtape 'In Skengs We Trust' helped define the early UK drill sound.",
      },
      {
        name: "Russ Millions",
        photoUrl: "https://www.nme.com/wp-content/uploads/2023/02/Russ-Millions-Press-Shot-2023.jpeg",
        bio: "'Body' with Tion Wayne was the first UK drill single to reach No.1 on the Official UK Singles Chart. He released 'Bike Back' in May 2026.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-emerging-actor-london-2026",
    nominees: [
      {
        name: "Ambika Mod",
        photoUrl: "https://images.immediate.co.uk/production/volatile/sites/3/2022/11/GettyImages-1420000106-496853a.jpg?resize=1191%2C624",
        bio: "Co-lead of Netflix's One Day (2024).",
      },
      {
        name: "Leo Woodall",
        photoUrl: "https://images.immediate.co.uk/production/volatile/sites/3/2024/02/Leo-Woodall-Exclusive-e875351.jpg?resize=1200%2C630",
        bio: "Co-lead of Netflix's One Day (2024).",
      },
      {
        name: "India Amarteifio",
        photoUrl: "https://www.mefeater.com/wp-content/uploads/2023/12/India-Ria-Amarteifio-attends-The-26th-British-Independent-Film-Awards.jpg",
        bio: "Played the young Queen Charlotte in Netflix's Queen Charlotte: A Bridgerton Story.",
      },
      {
        name: "Corey Mylchreest",
        photoUrl: "https://assets.capitalfm.com/2023/18/corey-mylchreest-1683190132-list-handheld-0.png",
        bio: "Played the young King George in Queen Charlotte: A Bridgerton Story.",
      },
      {
        name: "Arsema Thomas",
        photoUrl: "https://assets.capitalfm.com/2023/18/who-plays-young-lady-danbury-in-queen-charlotte-a-bridgerton-story---arsema-thomas-1683110551-view-0.png",
        bio: "Played the young Lady Danbury in Queen Charlotte: A Bridgerton Story.",
      },
      {
        name: "David Jonsson",
        photoUrl: "https://www.unitedagents.co.uk/wp-content/uploads/2026/02/david-reiss-bw.jpg",
        bio: "Won the 2025 EE BAFTA Rising Star Award; starred in Industry, Rye Lane and Alien: Romulus.",
      },
      {
        name: "Mia McKenna-Bruce",
        photoUrl: "https://m.media-amazon.com/images/M/MV5BYmU4Yjg5MDQtNTEzNy00ZDU2LThkZjMtZmMyNjc3MzIyZDU1XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg",
        bio: "Won the 2024 EE BAFTA Rising Star Award for How to Have Sex.",
      },
      {
        name: "Vivian Oparah",
        photoUrl: "https://image.tmdb.org/t/p/w500/o09cSj0uSV1qRmnCBQ8whZCXH5z.jpg",
        bio: "Won a British Independent Film Award for Rye Lane (2023) and earned a BAFTA nomination.",
      },
      {
        name: "Aaron Pierre",
        photoUrl: "https://comicbook.com/wp-content/uploads/sites/4/2024/09/ac079706-96d0-40b9-b12b-2d70dfef7271.jpg?w=1200",
        bio: "Starred in Netflix's Rebel Ridge (2024) and voiced Mufasa in Mufasa: The Lion King.",
      },
      {
        name: "Ella Purnell",
        photoUrl: "https://www.comingsoon.net/wp-content/uploads/sites/3/2022/03/ella-2.jpg",
        bio: "Leads Prime Video's Fallout and Sky's Sweetpea.",
      },
      {
        name: "Tom Blyth",
        photoUrl: "https://www.dnamagazine.com.au/wp-content/uploads/2023/11/TBOSAS.jpg",
        bio: "Played young Coriolanus Snow in The Hunger Games prequel and leads Billy the Kid.",
      },
      {
        name: "Kit Connor",
        photoUrl: "https://www.out.com/media-library/heartstopper-kit-connor-comes-out-as-bisexual-twitter-forced-out-jpg.jpg?id=32772118&width=1200&height=600&coordinates=0%2C0%2C0%2C48",
        bio: "Plays Nick Nelson in Netflix's Heartstopper.",
      },
      {
        name: "Joe Locke",
        photoUrl: "https://www.attitude.co.uk/wp-content/uploads/sites/5/2023/08/joe-locke-heartstopper-2740fed.jpg",
        bio: "Plays Charlie Spring in Netflix's Heartstopper.",
      },
      {
        name: "Marisa Abela",
        photoUrl: "https://ntvb.tmsimg.com/assets/assets/1314826_v9_bc.jpg?w=270&h=360",
        bio: "2025 EE Rising Star nominee; starred as Amy Winehouse in Back to Black.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-fan-channel-host-london-2026",
    nominees: [
      {
        name: "Robbie Lyle",
        photoUrl: "https://techround.co.uk/wp-content/uploads/fly-images/74056/robbie-lyle-1600x1066.jpg",
        bio: "Founder and owner of AFTV (2012); pioneered supporter-led fan TV in the UK.",
      },
      {
        name: "Troopz",
        photoUrl: "https://icdn.justarsenal.com/wp-content/uploads/2020/08/AFTV-Troopz.jpg",
        bio: "Former AFTV contributor; his 2017 rant after Arsenal's 5–1 Champions League defeat to Bayern Munich went viral.",
      },
      {
        name: "Lee Judges (Lee Gunner)",
        photoUrl: "https://i.ytimg.com/vi/42vK6WuO05A/hqdefault.jpg",
        bio: "AFTV regular, often hosting the post-match fan interviews outside the Emirates.",
      },
      {
        name: "Mark Goldbridge",
        photoUrl: "https://icdn.caughtoffside.com/wp-content/uploads/2022/08/Screenshot-2022-08-13-at-18.24.02.jpg",
        bio: "Founded The United Stand in 2014; his channels have a combined audience of 3.7M and were acquired by Gary Neville's The Overlap.",
      },
      {
        name: "Adam McKola",
        photoUrl: "https://pbs.twimg.com/profile_images/1976747753775517696/FLr0LcDo.jpg",
        bio: "Manchester United fan creator and contributor to The United Stand.",
      },
      {
        name: "Stephen Howson",
        photoUrl: "https://media.vibetag.com/upload/videos/2024/01/w_autovideothumb_53c0ac850962ffaaf28f59215d5aff35.jpg",
        bio: "Founder of Stretford Paddock, the Man United fan channel that succeeded Full Time Devils.",
      },
      {
        name: "Paul Machin",
        photoUrl: "https://i.ytimg.com/vi/Unk5GHzoy_s/maxresdefault.jpg",
        bio: "Co-founder of The Redmen TV, the pioneering Liverpool fan-led YouTube channel.",
      },
      {
        name: "Chris Pajak",
        photoUrl: "https://cdn.theredmentv.com/wp-content/uploads/2026/03/21150721/260321-Chris-Featured.jpg",
        bio: "Co-founder of The Redmen TV alongside Paul Machin.",
      },
      {
        name: "Neil Atkinson",
        photoUrl: "https://i.ytimg.com/vi/UcmwUfNRz4o/maxresdefault.jpg",
        bio: "Founder of The Anfield Wrap, Liverpool's fan media network of podcasts and live shows.",
      },
      {
        name: "Statman Dave",
        photoUrl: "https://pbs.twimg.com/profile_images/1642870469480128516/aAlo5-Kx.jpg",
        bio: "Man United data creator; poached by MUTV.",
      },
      {
        name: "Drawty (Ben)",
        photoUrl: "https://pbs.twimg.com/profile_images/2091532046111760384/-IFf4P18_400x400.jpg",
        bio: "Long-standing member of The United Stand team.",
      },
      {
        name: "Rory Jennings",
        photoUrl: "https://talksport.com/wp-content/uploads/2025/07/jennings-shirt.jpeg?w=620",
        bio: "Chelsea fan creator; regular on talkSPORT and fan-debate shows.",
      },
      {
        name: "Chris Cowlin",
        photoUrl: "https://www.soccerphile.com/public/web_images/content_images/chriscowlin3.jpg",
        bio: "Host of the Spurs Chat podcast; won Best Club Content Creator at the 2019 Football Blogging Awards.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-fashion-tiktoker-london-2026",
    nominees: [
      {
        name: "Lydia Millen",
        photoUrl: "https://lydiaelisemillen.com/wp-content/uploads/2023/02/KM-LYDIA-MILLEN-2023_SHOT_01_0120-1200x800.jpg",
        bio: "UK fashion creator — ~920k TikTok followers.",
      },
      {
        name: "Victoria Magrath",
        photoUrl: "https://www.inthefrow.com/wp-content/uploads/2016/01/IntheFrow-JanLook3-Amber-Rose-Photography-1.jpg",
        bio: "UK fashion creator — ~671k TikTok followers.",
      },
      {
        name: "Lara Adkins",
        photoUrl: "https://www.freefocus.co.uk/wp-content/uploads/2024/11/Snapinsta.app_466848002_18474324925003388_4856847795974662257_n_1080.jpg",
        bio: "UK fashion creator — ~689k TikTok followers.",
      },
      {
        name: "Maddie Close (Style With Maddi)",
        photoUrl: "https://cdn.prod.website-files.com/5ef387c475859118661dbbc7/6888777f412065c0518fa900_Maddie%20Close%20MAIN.jpeg",
        bio: "UK fashion creator — ~809k TikTok followers.",
      },
      {
        name: "Sinead Biddlecombe",
        photoUrl: "https://lh7-us.googleusercontent.com/jhGt8w9ZgUTtlVb4lIV-rnYKwLNPQsFORA3GeVvX2RpuWsXhtafsv4YjFcYeqQt1TQmv15wV5iPPweTqRVYfK03DepBdpxwsGQKvG92AX8RbzrXGpHvgiEtN0GIha1uH7PEpveG5N7JQ6hfoJ1blRww",
        bio: "UK fashion creator — ~365k TikTok followers.",
      },
      {
        name: "Imogen Cribb",
        photoUrl: "https://www.thecityceleb.com/wp-content/uploads/2026/02/17709169717052863870097873849258.webp",
        bio: "UK fashion creator — ~315k TikTok followers.",
      },
      {
        name: "Lucy Appleton",
        photoUrl: "https://www.k4fashion.com/wp-content/uploads/2024/04/Lucy-Appleton-In-White-Crop-Top-With-Denim-Shorts.jpg",
        bio: "UK fashion creator — ~710k TikTok followers.",
      },
      {
        name: "Beth Bartram",
        photoUrl: "https://medias.spotern.com/spots/w720/250/250908-1573553900.jpg",
        bio: "UK fashion creator — ~141k TikTok followers.",
      },
      {
        name: "Emily Shak",
        photoUrl: "https://medias.spotern.com/spots/share/278/278449-1576743265.png",
        bio: "UK fashion creator — ~218k TikTok followers.",
      },
      {
        name: "Esi (SerendipEsi)",
        photoUrl: "https://p19-common-sign.tiktokcdn-us.com/tos-useast2a-p-0037-euttp/340574b4c9f14bce9f0ac434bef2847e_1719868090~tplv-tiktokx-origin.image?dr=9636&x-expires=1790452800&x-signature=upOWfrGHwa0%2B6JPBtD%2FeKbqzBrk%3D&t=4d5b0474&ps=13740610&shp=81f88b70&shcp=43f4a2f9&idc=useast5",
        bio: "UK fashion creator — ~157k TikTok followers.",
      },
      {
        name: "Olivia Hirst",
        photoUrl: "https://i.axod.net/pcbs6P2CwMcyZfDdG9Wno9rE_zP9q9tOXrxV77Xcdx2Gv3_Sy7b_jrDgZoRV3iNScuiPl8a6ZnMowI2Dt28eEnWT6ysVxh9fAu_3rUEUS51F54V1v-GWTKb2XhtKLclnzPtnZkgCTi5r4zAQk3oAiejg_z_A4nH7eFhs.jpeg",
        bio: "UK fashion creator — ~147k TikTok followers.",
      },
      {
        name: "Yasmin Devonport",
        photoUrl: "https://p16-common.tiktokcdn.com/tos-useast2a-avt-0068-euttp/8ab037c15d82f7c6c2a6d4890bc2c167~tplv-tiktokx-cropcenter:720:720.webp",
        bio: "UK fashion creator — ~89k TikTok followers.",
      },
      {
        name: "Agnes Pusztai (WhatGigiWears)",
        photoUrl: "https://www.thefoxmgmt.com/ci-archive/assets/65f81fdeda7090f446db84bb_Bildschirmfoto_2024-03-18_um_12.03.55.png",
        bio: "London-based fashion creator — ~668k Instagram and ~88k TikTok followers.",
      },
      {
        name: "Strateraa",
        photoUrl: "https://yt3.ggpht.com/86oAtyvv5HuGG1EpwOGbA4BFpmO5tfk2r_N5xogLJrAC_YfWz2JoJfGDe9WD1BW3efM98BL6rw=s800-c-k-c0x00ffffff-no-rj",
        bio: "London fashion TikToker and vintage streetwear seller.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-food-creator-london-2026",
    nominees: [
      {
        name: "Nigella Lawson",
        photoUrl: "https://api.photon.aremedia.net.au/wp-content/uploads/sites/8/nznow/2019/01/25/1548386781232_Nigella-Lawson-cooking.jpg?resize=1024%2C729",
        bio: "British food writer and television cook based in London; author of bestselling cookbooks and host of BBC cooking programmes.",
      },
      {
        name: "Yotam Ottolenghi",
        photoUrl: "https://thehappyfoodie.co.uk/wp-content/uploads/2021/08/yotam-ottolenghi-chef-0dddb07a-55fb-490c-bda9-c25fa4c6f83f_s900x0_c2417x1412_l0x459-836x1024.jpg",
        bio: "Israeli-British chef, restaurateur and cookbook author based in London; founder of the Ottolenghi delis and restaurants.",
      },
      {
        name: "Rachel Ama",
        photoUrl: "https://yt3.ggpht.com/WYtFWLkYpkOKswtsb6OV0i0E-nom-QERkPE0pR-ErRIqUzYVMz9rvPuU0epIx6Y2RjEHTSsVJp4=s240-c-k-c0x00ffffff-no-rj",
        bio: "London-based vegan food creator and cookbook author, known for sharing plant-based recipes with a large online audience.",
      },
      {
        name: "John Gregory-Smith",
        photoUrl: "https://www.johngregorysmith.com/wp-content/uploads/2019/10/773d1d22-1abb-4447-bed6-efd3df439648-819x1024.jpeg",
        bio: "London-based food writer, chef and cookbook author, known for recipes from the Middle East and beyond.",
      },
      {
        name: "Craig and Shaun McAnuff (Original Flava)",
        photoUrl: "https://originalflava.com/wp-content/uploads/2025/04/about.png",
        bio: "Brothers behind Original Flava, the London-based Caribbean food brand; authors of Caribbean cookbooks.",
      },
      {
        name: "Gabie Kook",
        photoUrl: "https://yt3.ggpht.com/WeUXatEqGQpVo2vBWjzN65sMA00SzRAg4hHWpCa5Ulu5rSY8DNOSpGepomo3se_aXRVcyHMUtQ=s240-c-k-c0x00ffffff-no-rj",
        bio: "London-based food creator and chef, known for her YouTube cooking channel and links to London restaurants.",
      },
      {
        name: "Kate Ovens",
        photoUrl: "https://i.ytimg.com/vi/5UWId3ZZlh0/oar2.jpg?sqp=-oaymwEkCJUDENAFSFqQAgHyq4qpAxMIARUAAAAAJQAAyEI9AICiQ3gB&rs=AO",
        bio: "London-based TikTok creator known for extreme food challenge videos, including collaborations with London restaurants.",
      },
      {
        name: "Thomas Straker",
        photoUrl: "https://cdn.thetab.com/wp-content/uploads/2023/11/25192116/straker-1.jpg",
        bio: "London-based chef and food creator, known for his cooking videos and bestselling cookbook.",
      },
      {
        name: "Rosie Birkett",
        photoUrl: "https://www.abouttimemagazine.co.uk/wp-content/uploads/2018/09/Screen-Shot-2018-09-26-at-12.26.03.png",
        bio: "London-based food writer, chef and stylist; author of cookbooks and former restaurant critic.",
      },
      {
        name: "Max La Manna",
        photoUrl: "https://www.healthwellbeing.com/wp-content/uploads/2023/07/YouCanCookThis-1.jpg",
        bio: "London-based vegan chef and cookbook author, known for low-waste plant-based recipes shared online.",
      },
      {
        name: "BOSH!",
        photoUrl: "https://holly.co/assets/images/content/88e26dff-befc-4bcb-94b2-a5eeb27e2c03-original.webp",
        bio: "London-based vegan food brand founded by Henry Firth and Ian Theasby; authors of bestselling plant-based cookbooks with a large online following.",
      },
      {
        name: "Sorted Food",
        photoUrl: "https://www.presenterstudio.com/media/k2/items/cache/52ec984cc72302fd412e2aa145a6526c_L.jpg",
        bio: "London-based online food community and YouTube channel run by a group of friends sharing recipes and food challenges.",
      },
      {
        name: "Gizzi Erskine",
        photoUrl: "https://www.arenaentertainments.co.uk/wp-content/uploads/2019/02/Gizzi-Erskine-460x312.jpg",
        bio: "London-born chef, food writer and television presenter, known for her YouTube food series and newspaper columns.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-football-creator-london-2026",
    nominees: [
      {
        name: "KSI",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/be/KSI_in_2024_%282%29.png",
        bio: "Sidemen co-founder with 24.8M YouTube subscribers; rose to fame on FIFA gameplay videos before expanding into music and boxing.",
      },
      {
        name: "Chunkz",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/81/Chunkz_in_2021.png",
        bio: "Beta Squad member; football challenge videos and appearances in the Match for Hope charity football matches (2024–2026).",
      },
      {
        name: "Theo Baker",
        photoUrl: "https://static.wikia.nocookie.net/youtube/images/2/20/Theo_Baker.jpg/revision/latest?cb=20220223141030",
        bio: "Arsenal fan YouTuber known for football challenges with professionals, including a skills video with Alisha Lehmann.",
      },
      {
        name: "W2S (Harry Lewis)",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ec/W2S_blue_jumper.jpg",
        bio: "Sidemen member; FIFA and football content, and a regular in the Sidemen Charity Match lineups.",
      },
      {
        name: "Miniminter (Simon Minter)",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/eb/Miniminter_in_June_2024_at_Soccer_Aid_2024_charity_match.png",
        bio: "Sidemen member; Sunday League football series and the Sidemen Charity Match's record goalscorer.",
      },
      {
        name: "Zerkaa (Josh Zerker)",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/48/Zerkaa_2018.jpg",
        bio: "Sidemen co-founder; FIFA gaming content and a regular Sidemen Charity Match player.",
      },
      {
        name: "TBJZL (Tobi Brown)",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/bb/TBJZL_2025.jpg",
        bio: "Sidemen member; scored in the 2018 Sidemen Charity Match at The Valley.",
      },
      {
        name: "Behzinga (Ethan Payne)",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Ethan_Payne_in_2023.png",
        bio: "Sidemen member and lifelong West Ham fan; scored at the London Stadium in the 2023 Sidemen Charity Match.",
      },
      {
        name: "Spencer Owen",
        photoUrl: "https://static.wikia.nocookie.net/youtube/images/a/a7/Spencer_FC.jpg/revision/latest?cb=20221211220801",
        bio: "Founded Hashtag United after building a football audience through his Spencer FC YouTube channel, launched in 2013.",
      },
      {
        name: "ChrisMD",
        photoUrl: "https://static.wikia.nocookie.net/youtube/images/8/82/ChrisDixon.jpg/revision/latest?cb=20210303220219",
        bio: "London-based YouTuber (6.3M+ subscribers) known for FIFA gameplay and football challenge videos; an Arsenal supporter.",
      },
      {
        name: "Manny (FIFAManny)",
        photoUrl: "https://static.wikia.nocookie.net/youtube/images/9/97/MannyIcon.jpg/revision/latest?cb=20230331210124",
        bio: "FIFA and football YouTuber; scored twice for Sidemen FC in the 2016 Sidemen Charity Match.",
      },
      {
        name: "Yung Filly",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a7/Yung_Filly_in_2024.png",
        bio: "Beta Squad member; played in the 2023 Sidemen Charity Match and Match for Hope football content.",
      },
      {
        name: "Mark Goldbridge",
        photoUrl: "https://icdn.caughtoffside.com/wp-content/uploads/2022/08/Screenshot-2022-08-13-at-18.24.02-770x538.jpg.webp",
        bio: "Man United fan creator who founded The United Stand in 2014; his That's Football channel secured Bundesliga broadcast rights for the UK.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-football-freestyler-london-2026",
    nominees: [
      {
        name: "Lia Lewis",
        photoUrl: "https://shekicks.net/wp-content/uploads/2021/11/Lia-Lewis-freestyle.jpg",
        bio: "British freestyler; Red Bull Street Style women's world champion in 2021.",
      },
      {
        name: "John Farnworth",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/9c/1_john_farnworth.jpg",
        bio: "British freestyler and multiple world record holder.",
      },
      {
        name: "Andrew Henderson",
        photoUrl: "https://the18.com/sites/default/files/article-img/andrew-henderson-world-champion-freestyle-2015-rio-neymar-messi.jpg",
        bio: "English freestyler; won the World Freestyle Football Championship in Malaysia in 2011.",
      },
      {
        name: "Séan Garnier",
        photoUrl: "https://www.footpack.fr/wp-content/uploads/2015/04/sean-garnier-interview-footpack-1024x682.jpg",
        bio: "French freestyler; two-time freestyle world champion and Red Bull athlete.",
      },
      {
        name: "Mélody Donchet",
        photoUrl: "https://www.eurofootnews.net/wp-content/uploads/2021/11/image0-392.jpeg",
        bio: "French freestyler; six-time freestyle football world championship winner.",
      },
      {
        name: "Liv Cooke",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/30/Liv_Cooke_wikipedia_photo_September_2022.jpg",
        bio: "British freestyler; former freestyle world champion and five-time world record holder.",
      },
      {
        name: "Erlend Fagerli",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/81/Erlend_Fagerli.jpg",
        bio: "Norwegian freestyler; record three-time Red Bull Street Style men's world champion.",
      },
      {
        name: "Kitti Szász",
        photoUrl: "https://sportime.hu/wp-content/uploads/2020/10/0673f9e52806f04102177bb10f7ffbb6.jpg",
        bio: "Hungarian freestyler; two-time Red Bull Street Style women's world champion.",
      },
      {
        name: "Aguska Mnich",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/46/European_Freestyle_Football_Championship_2024%2C_Sopot_Pulse_2024_%28P094%29.jpg",
        bio: "Polish freestyler; 2021 Red Bull Street Style women's world finalist.",
      },
      {
        name: "Caitlyn Schrepfer",
        photoUrl: "https://images.mlssoccer.com/image/private/t_keep-aspect-ratio-e-mobile/f_auto/mls-lag-prd/vndejipifrdktt9w50qx.jpg",
        bio: "American freestyler; 2021 Red Bull Street Style women's world semi-finalist.",
      },
      {
        name: "Jesse Marlet",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/bc/Jesse_Marlet_%28NED%29_performs_in_front_of_the_Super_Ball_2023_crowd.jpg",
        bio: "Freestyler; 2021 Red Bull Street Style men's world finalist.",
      },
      {
        name: "Billy Wingrove",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ea/F2_socceraid_2019.jpg",
        bio: "English freestyler; co-founder of the F2 Freestylers, whose YouTube channel has 14M subscribers.",
      },
      {
        name: "Jeremy Lynch",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ea/F2_socceraid_2019.jpg",
        bio: "English freestyler; co-founder of the F2 Freestylers alongside Billy Wingrove.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-fpl-creator-london-2026",
    nominees: [
      {
        name: "Andy (Let's Talk FPL)",
        photoUrl: "https://pbs.twimg.com/profile_images/2009238226695761920/GWQNsKuG_400x400.jpg",
        bio: "Runs the Let's Talk FPL channel, with 450k+ YouTube subscribers.",
      },
      {
        name: "Ben Crellin",
        photoUrl: "https://pbs.twimg.com/profile_images/574886482126598147/x0WD_pYx_400x400.jpeg",
        bio: "FPL fixture-planner known for his planning spreadsheets; on a run of six straight top-10k finishes.",
      },
      {
        name: "FPL Focal",
        photoUrl: "https://pbs.twimg.com/profile_images/1678392611952906247/CU_pn9tq_400x400.jpg",
        bio: "FPL creator who was briefly ranked #1 in the world at the game.",
      },
      {
        name: "FPL Harry",
        photoUrl: "https://pbs.twimg.com/profile_images/1963273545770807296/OpyFKgsC_400x400.jpg",
        bio: "FPL YouTuber with 200k+ subscribers; five straight top-10k finishes.",
      },
      {
        name: "Big Man Bakar",
        photoUrl: "https://pbs.twimg.com/profile_images/1459686915498819587/cYF4VOWO_400x400.jpg",
        bio: "FPL content creator; regular on Fantasy Football Hub's gameweek team-reveal shows.",
      },
      {
        name: "Az (FPL BlackBox)",
        photoUrl: "https://pbs.twimg.com/profile_images/1831452082383073280/6XUEfCLa_400x400.jpg",
        bio: "Host of the FPL BlackBox show and an official FPL pundit.",
      },
      {
        name: "Pras (The FPL Wire)",
        photoUrl: "https://pbs.twimg.com/profile_images/1795868568048799744/CSm3QhvI_400x400.jpg",
        bio: "The FPL Wire co-host; BBC Sport live FPL pundit and Fantasy Football Scout pro-pundit.",
      },
      {
        name: "Mark (FPL General)",
        photoUrl: "https://pbs.twimg.com/profile_images/996319810245091330/vPwgnxhk_400x400.jpg",
        bio: "Fantasy Football Scout's FPL General; hosts a weekly team-selection show.",
      },
      {
        name: "Ross (FPL Raptor)",
        photoUrl: "https://pbs.twimg.com/profile_images/2070953965827620864/SiHp1iGy_400x400.jpg",
        bio: "FPL Raptor; a community favourite known for humble, analytical FPL content.",
      },
      {
        name: "Lateriser",
        photoUrl: "https://pbs.twimg.com/profile_images/1041289003381604352/feioKyKN_400x400.jpg",
        bio: "The FPL Wire co-host with three top-200 overall finishes.",
      },
      {
        name: "Lee & Sam (FPL Family)",
        photoUrl: "https://pbs.twimg.com/profile_images/1690802174983360512/30KeeKBc_400x400.jpg",
        bio: "Hosts of the FPL Family chat show and podcast covering Fantasy Premier League.",
      },
      {
        name: "FPL Mate",
        photoUrl: "https://pbs.twimg.com/profile_images/1841137797052198913/T8sEuK7Z_400x400.jpg",
        bio: "FPL YouTuber and team-reveal creator; a fixture of community discussion each gameweek.",
      },
      {
        name: "Planet FPL",
        photoUrl: "https://pbs.twimg.com/profile_images/1572129679569461249/AbK2OBxa_400x400.jpg",
        bio: "Long-running FPL podcast; a staple Monday listen in the community.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-grime-mc-london-2026",
    nominees: [
      {
        name: "Chip",
        photoUrl: "https://www.blackhistorymonth.org.uk/wp-content/uploads/2021/05/CHIP-623x395.jpg",
        bio: "Nominated for Best Grime Act at the 2025 MOBO Awards.",
      },
      {
        name: "D Double E",
        photoUrl: "https://footpatrolblog.s3.eu-west-1.amazonaws.com/wp-content/uploads/2019/05/D-Double-E-Signing-Blog-5-1.jpg",
        bio: "A former MOBO Best Grime Act winner, nominated again in 2025. Best known for 'Street Fighter Riddim', one of grime's most recognised instrumentals.",
      },
      {
        name: "Duppy",
        bio: "Nominated for Best Grime Act at the 2025 MOBO Awards.",
      },
      {
        name: "Kruz Leone",
        photoUrl: "https://cdn-images.dzcdn.net/images/artist/06c52ae66700d8293bb086259161f93d/500x500.jpg",
        bio: "Nominated for Best Grime Act at the 2025 MOBO Awards.",
      },
      {
        name: "Manga Saint Hilare",
        photoUrl: "https://www.clashmusic.com/wp-content/uploads/2018/09/Manga-8_0.jpg",
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
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Stormzy_-_Openair_Frauenfeld_2019_02.jpg/1280px-Stormzy_-_Openair_Frauenfeld_2019_02.jpg",
        bio: "His debut album 'Gang Signs & Prayer' hit No.1 in the UK and won the BRIT Award for Album of the Year.",
      },
      {
        name: "Skepta",
        photoUrl: "https://thefader-res.cloudinary.com/private_images/w_1260,c_limit,f_auto,q_auto:best/JME_4851_kzxpe2/sketa-on-his-2016-mercury-prize-win-its-a-revolution-for-freedom.jpg",
        bio: "His album 'Konnichiwa' won the 2016 Mercury Prize.",
      },
      {
        name: "Jme",
        photoUrl: "https://thequietus.com/app/uploads/2024/03/JME_Comp_Square_-_Main_600_600_1436879423.jpg",
        bio: "His debut album 'Integrity>' reached No.12 on the UK Albums Chart. He won Best Grime Act at the 2020 MOBO Awards.",
      },
      {
        name: "Kano",
        photoUrl: "https://pbs.twimg.com/profile_images/1151922588559581192/JbDYsqI3.png",
        bio: "His album 'Made in the Manor' reached No.8 in the UK, was shortlisted for the Mercury Prize and won MOBO Best Album.",
      },
      {
        name: "P Money",
        photoUrl: "https://www.clashmusic.com/wp-content/uploads/2017/07/p-monry_0.jpg",
        bio: "The New Cross grime MC took part in Lord of the Mics 6 and was shortlisted for Best Grime Act at the 2020 MOBO Awards.",
      },
      {
        name: "Dizzee Rascal",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Dizzee_Rascal_-_Ilosaarirock_2018_-_05.jpg/1280px-Dizzee_Rascal_-_Ilosaarirock_2018_-_05.jpg",
        bio: "His debut album 'Boy in da Corner' won the 2003 Mercury Prize.",
      },
      {
        name: "Frisco",
        photoUrl: "https://pbs.twimg.com/profile_images/1905531976129421312/Lii4h4w0_400x400.jpg",
        bio: "The Tottenham-born BBK member released the album 'System Killer'.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-kpop-dancer-london-2026",
    nominees: [
      {
        name: "Cherrie",
        photoUrl: "https://i.ytimg.com/vi/duTmB0itYzg/hqdefault.jpg",
        bio: "London-based K-pop cover dancer with HKZ Dance, appearing in the crew's covers of ILLIT's \"It's Me\", BLACKPINK's \"Don't Know What To Do\" and VIVIZ's \"SHHH!\". She placed fifth in the solo dance category at the New Malden K-pop Awards 2025.",
      },
      {
        name: "Hermione",
        photoUrl: "https://i.ytimg.com/vi/4ZGBxnVmrjY/hqdefault.jpg",
        bio: "K-pop cover dancer active in London who dances with HKZ Dance and led a documented London cover of TWICE's \"Heart Shaker\" with eight other dancers.",
      },
      {
        name: "Hayden",
        photoUrl: "https://i.ytimg.com/vi/AL7McmBoT1Y/hqdefault.jpg",
        bio: "K-pop cover dancer with HKZ Dance in London, appearing in the crew's covers of BLACKPINK's \"Don't Know What To Do\" alongside Anet, Nati and Cherrie.",
      },
      {
        name: "Anet",
        photoUrl: "https://i.ytimg.com/vi/AL7McmBoT1Y/hqdefault.jpg",
        bio: "K-pop cover dancer with HKZ Dance in London, appearing in the crew's cover of BLACKPINK's \"Don't Know What To Do\".",
      },
      {
        name: "Nati",
        photoUrl: "https://i.ytimg.com/vi/AL7McmBoT1Y/hqdefault.jpg",
        bio: "K-pop cover dancer with HKZ Dance in London, appearing in the crew's cover of BLACKPINK's \"Don't Know What To Do\".",
      },
      {
        name: "Spriha",
        photoUrl: "https://i.ytimg.com/vi/CUBcmhtlZYE/hqdefault.jpg",
        bio: "Dancer with London K-pop cover crew IGNITE, appearing in the crew's covers of NewJeans' \"Ditto\" and \"ETA\".",
      },
      {
        name: "Shana",
        photoUrl: "https://i.ytimg.com/vi/iKydCTgWg7Y/hqdefault.jpg",
        bio: "Member of London K-pop cover crew KWD Crew, appearing in the crew's covers of BTS' \"Swim\" and EXO's \"Crown\".",
      },
      {
        name: "Zosia",
        photoUrl: "https://i.ytimg.com/vi/uoVPBftqVVk/hqdefault.jpg",
        bio: "London K-pop cover dancer who project-led KWD Crew's cover of EXO's \"Crown\" and dances with ECHO Crew, appearing in their cover of ILLIT's \"It's Me\".",
      },
      {
        name: "Skylar",
        photoUrl: "https://i.ytimg.com/vi/Exly8zSr6AU/hqdefault.jpg",
        bio: "London K-pop cover dancer with Cromer Crew, appearing in the crew's seven-member cover of XG's \"Hypnotize\".",
      },
      {
        name: "JUJU",
        bio: "UK-based dance creator whose TikTok videos surpassed 7 million views and who served as a judge at the New Malden K-pop Awards 2025.",
      },
      {
        name: "Vi",
        photoUrl: "https://i.ytimg.com/vi/NCFnojazmLw/hqdefault.jpg",
        bio: "London-based K-pop cover dancer appearing in a documented London cover of Hearts2Hearts' \"Lemon Tang\" alongside Zosia, Amelie, Louis, Sophie, Gracie, Gladys and Ailani.",
      },
      {
        name: "Jamie",
        photoUrl: "https://i.ytimg.com/vi/uoVPBftqVVk/hqdefault.jpg",
        bio: "London K-pop cover dancer with ECHO Crew, appearing in the crew's five-member cover of ILLIT's \"It's Me\".",
      },
      {
        name: "Bartek",
        photoUrl: "https://i.ytimg.com/vi/duTmB0itYzg/hqdefault.jpg",
        bio: "London K-pop cover dancer with HKZ Dance, appearing in the crew's cover of ILLIT's \"It's Me\" alongside Cherrie, Viola, Aimee and Theo.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-livestream-dj-london-2026",
    nominees: [
      {
        name: "DJ AG Online",
        photoUrl: "https://i.ytimg.com/vi/eQaYgmJrGgQ/hqdefault.jpg",
        bio: "UK DJ whose TikTok live sessions promote his London activity and AG Fest.",
      },
      {
        name: "DJ Katty London",
        photoUrl: "https://i.ytimg.com/vi/PT_lDeBioM0/hqdefault.jpg",
        bio: "DJ broadcasting live sets on TikTok Live.",
      },
      {
        name: "R3WIRE",
        photoUrl: "https://pbs.twimg.com/profile_images/2101027552986808320/dm6MtHbe_400x400.jpg",
        bio: "Runs weekly livestreamed house and tech DJ sets on YouTube with four-deck mixing.",
      },
      {
        name: "DJ EZ",
        photoUrl: "https://d23sy9fe9womrt.cloudfront.net/6/18706_1_dj-ez-live-in-the-mixmag-dj-lab-now_ban.jpg",
        bio: "UK garage DJ whose marathon 24-hour sets were livestreamed via Boiler Room and Defected, raising money for the Mind charity.",
      },
      {
        name: "DJ Majestic",
        photoUrl: "https://www.radikal.com/wp-content/uploads/2021/12/majestic-1-e1639076086341.jpg",
        bio: "KISS FM DJ who played the virtual KISSFest across three virtual stages.",
      },
      {
        name: "Horse Meat Disco",
        photoUrl: "https://www.grandpalais.fr/sites/default/files/styles/wide/public/medias/images/2025-05/Visuel_HorseMeatDisco_110x733.jpg?itok=k6kYv8-K",
        bio: "Disco DJ collective who played livestreamed lockdown sets for United We Stream and Glitterbox's We Dance As One.",
      },
      {
        name: "John B",
        photoUrl: "https://cdn-images.dzcdn.net/images/artist/0d3130d4b6d4dbf52fdc7b03599dd3fa/500x500.jpg",
        bio: "UK drum & bass DJ and producer who streams DJ sets three nights a week on Twitch.",
      },
      {
        name: "Sam Divine",
        photoUrl: "https://i.ytimg.com/vi/OfyXcVDQ4dc/maxresdefault.jpg",
        bio: "UK house DJ who played Defected's 12-hour Virtual Festival livestream.",
      },
      {
        name: "Floating Points",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/Floating_Points_at_Coachella_2017_%28cropped%29.jpg/960px-Floating_Points_at_Coachella_2017_%28cropped%29.jpg",
        bio: "London-based producer and DJ whose set aired via Boiler Room's Streaming From Isolation series.",
      },
      {
        name: "Joey Negro",
        photoUrl: "https://www.nme.com/wp-content/uploads/2020/07/GettyImages-827933096-1392x884.jpg",
        bio: "Veteran UK house DJ and producer who played Defected's 12-hour Virtual Festival livestream.",
      },
      {
        name: "The Heatwave",
        photoUrl: "https://cdn.amsterdam-dance-event.nl/images/images/transforms/artists-speakers/_1200x630_crop_center-center_none/21174/The_Heatwave_Press_Shots_D_145499.webp",
        bio: "London dancehall duo who headlined a livestreamed Mixmag Lab carnival special.",
      },
      {
        name: "Erol Alkan",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/3f/ErolAlkan.jpg/960px-ErolAlkan.jpg",
        bio: "London-based DJ who played the United We Stream lockdown livestream.",
      },
      {
        name: "DJ Paulette",
        photoUrl: "https://djpaulette.co.uk/wp-content/uploads/2019/08/PRIDE-RESIZE-ONLINE-683x1024.jpg",
        bio: "Veteran UK DJ who played Glitterbox's We Dance As One love stream.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-meme-page-london-2026",
    nominees: [
      {
        name: "LADbible",
        photoUrl: "https://pbs.twimg.com/profile_images/1502328419341807616/nyRcE6w0_400x400.jpg",
        bio: "UK viral publisher with around 14M Instagram and 12.9M TikTok followers.",
      },
      {
        name: "UNILAD",
        photoUrl: "https://pbs.twimg.com/profile_images/1603411021946933249/AdgqD110_400x400.jpg",
        bio: "UK-based viral media publisher known for memes, videos and trending stories.",
      },
      {
        name: "The Poke",
        photoUrl: "https://pbs.twimg.com/profile_images/556060000410296321/BXU9aiar_400x400.png",
        bio: "British comedy website curating funny tweets, headlines and viral posts.",
      },
      {
        name: "No Context Brits",
        photoUrl: "https://pbs.twimg.com/profile_images/1989286782416887808/Yd_hknNG_400x400.jpg",
        bio: "@NoContextBrits; posts out-of-context British photos, with around 1.8M followers on X.",
      },
      {
        name: "Very British Problems",
        photoUrl: "https://pbs.twimg.com/profile_images/2996456104/b707959f192bba5c31c07058f91a183b_400x400.png",
        bio: "@SoVeryBritish; British humour account with around 964K Instagram followers.",
      },
      {
        name: "The Daily Mash",
        photoUrl: "https://pbs.twimg.com/profile_images/1140912525501960192/NbvPzgXJ_400x400.png",
        bio: "British satirical news website founded in 2007, publishing spoof current-affairs stories.",
      },
      {
        name: "NewsThump",
        photoUrl: "https://pbs.twimg.com/profile_images/1579780501065408512/Gagm3ZDW_400x400.jpg",
        bio: "British spoof news website founded in 2009.",
      },
      {
        name: "Pubity",
        photoUrl: "https://pbs.twimg.com/profile_images/1778055517925146624/nJXOa2UM_400x400.jpg",
        bio: "Meme media brand with over 37M Instagram followers, founded by British creators Kit Chilvers and Iyrah Williams.",
      },
      {
        name: "Memezar",
        photoUrl: "https://yt3.ggpht.com/UJy6ZG3AconjEr9wayDTWD_ymdLPorHIVpld4I1lHHoQI0SP-QvcTeOhkrNYlp4fwhS4UY5u4A=s800-c-k-c0x00ffffff-no-rj",
        bio: "Meme page with over 23M Instagram followers, part of the British-founded Pubity Group.",
      },
      {
        name: "IMJUSTBAIT",
        photoUrl: "https://is5-ssl.mzstatic.com/image/thumb/Purple128/v4/13/60/11/136011e2-0c53-8634-b7af-d36480b48462/source/512x512bb.jpg",
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
        photoUrl: "https://theeverydayman.co.uk/wp-content/uploads/2014/06/Web-Logo-Large.png",
        bio: "UK men's style blog covering classic menswear.",
      },
      {
        name: "Charlie Irons (Man About Town)",
        photoUrl: "https://siddh.socialveins.com/profiles/charlieirons/1776248725735-profile.webp",
        bio: "Menswear creator behind the Man About Town platform.",
      },
      {
        name: "Carl Thompson",
        photoUrl: "https://images.squarespace-cdn.com/content/v1/54661df4e4b0c1af99306b69/1783332295009-SIVHY34KOX8G8DHQMRI8/Octobre+Editions+Styling+x+Carl+Thompson.JPG",
        bio: "UK men's fashion creator.",
      },
      {
        name: "Ali Gordon",
        photoUrl: "https://imagnav.com/wp-content/uploads/2025/11/SnapInsta.to_567285695_18539652154005995_1957358835069192402_n-e1762546794353-874x1024.webp",
        bio: "UK men's style creator.",
      },
      {
        name: "Simon Crompton (Permanent Style)",
        photoUrl: "https://www.permanentstyle.com/wp-content/uploads/2019/03/simon-crompton-of-permanent-style-500x625.jpg",
        bio: "Writer behind the Permanent Style menswear publication.",
      },
      {
        name: "Efe Efeturi",
        photoUrl: "https://www.taylorstitch.com/cdn/shop/files/q324_oxford_styling_EfeEfeturi_003_600x.progressive.jpg",
        bio: "London menswear, travel and lifestyle creator — ~508k Instagram followers.",
      },
      {
        name: "Roel Rebello",
        photoUrl: "https://fits4.com/wp-content/uploads/2023/10/Roel-roelrebello_-819x1024.jpg",
        bio: "London menswear and lifestyle creator — ~86k Instagram followers.",
      },
      {
        name: "Daily Touch of Class",
        photoUrl: "https://mym-db.com/storage/mym/app/9600_Dailytouchofclass_avatard.jpg",
        bio: "London menswear and lifestyle account — ~64k Instagram followers.",
      },
      {
        name: "Stanley Dru",
        photoUrl: "https://images.squarespace-cdn.com/content/v1/698b32d49e7cce010aa426f3/1772547130894-7AAIQF3HVI8GR2AINVHI/Stanley2.jpg",
        bio: "Menswear creator and M&S menswear ambassador.",
      },
      {
        name: "Tim Dessaint",
        photoUrl: "https://onbrand.shopltk.com/hs-fs/hubfs/B2B%20Blog/Male%20Influencer%20Blog%20Images/Tim%20Dessaint-1.png?width=810&height=1440&name=Tim%20Dessaint-1.png",
        bio: "Menswear creator and M&S menswear ambassador.",
      },
      {
        name: "Nathan Griffiths",
        photoUrl: "https://d5ik1gor6xydq.cloudfront.net/sellers/1338034/portfolio/17811706705218093.webp",
        bio: "Menswear creator and M&S menswear ambassador.",
      },
      {
        name: "Robin James",
        photoUrl: "https://manforhimself.com/wp-content/uploads/2019/10/mens-smart-casual-outfit-guide-menswear-man-for-hismelf-robin-james-17.jpg",
        bio: "London-based creator posting men's fashion and grooming street-style videos.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-music-interviewer-london-2026",
    nominees: [
      {
        name: "Amelia Dimoldenberg",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/22/Amelia_Dimoldenberg-08901.jpg",
        bio: "Created and hosts Chicken Shop Date, which began by interviewing grime artists; her YouTube channel has passed three million subscribers.",
      },
      {
        name: "Zeze Millz",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0f/Zeze_Millz_at_Avatar_fire_and_ash_premiere_London_2025.jpg",
        bio: "Hackney-born host of The Zeze Millz Show, interviewing Black British music figures.",
      },
      {
        name: "Julie Adenuga",
        photoUrl: "https://media.guim.co.uk/e23a3eeb01e24d209a40488b9f5e338857fe3379/0_595_3678_2207/1000.jpg",
        bio: "Broadcaster who has interviewed Stormzy, Jay-Z, Skepta, Wizkid, Burna Boy and Billie Eilish.",
      },
      {
        name: "Clara Amfo",
        photoUrl: "https://media.timeout.com/images/106141341/image.jpg",
        bio: "Former BBC Radio 1 host whose Live Lounge interviews included Jay-Z, Ariana Grande, Kendrick Lamar and Pharrell Williams.",
      },
      {
        name: "Chuckie Online",
        photoUrl: "https://ents24.imgix.net/image/000/175/014/06c634ea9d3cdc27dd41462ddd2d46af250803fb.jpg?auto=format&crop=faces&w=1200&h=630",
        bio: "Host of the Halfcast Podcast, which has featured interviews with music figures.",
      },
      {
        name: "Poet",
        bio: "Broadcaster and regular Halfcast Podcast co-host covering UK music culture.",
      },
      {
        name: "DJ Semtex",
        photoUrl: "https://i.discogs.com/JKSPbQoaFgiOwMoF27L_J2TYUMYlVxe100NBDwh_yLw/rs:fit/g:sm/q:40/h:300/w:300/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9BLTE0MjAw/OC0xNTgxOTU3MDU4/LTE0MzIuanBlZw.jpeg",
        bio: "Capital Xtra DJ and author who has interviewed Eminem, Drake and Kendrick Lamar.",
      },
      {
        name: "Manny Norte",
        bio: "Capital Xtra presenter whose weekday show features interviews with major hip-hop stars.",
      },
      {
        name: "Kenny Allstar",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Kenny_Alstar.jpg",
        bio: "BBC Radio 1Xtra host whose Voice of the Streets series features freestyles and in-depth interviews with UK rap artists.",
      },
      {
        name: "Ras Kwame",
        photoUrl: "https://pbs.twimg.com/profile_images/1962211317076402176/SZLcOey5_400x400.jpg",
        bio: "Capital Xtra DJ whose Reggae Recipe show features interviews with dancehall and reggae artists.",
      },
      {
        name: "Remel London",
        bio: "Award-winning Capital Xtra presenter whose shows champion UK hip-hop, grime and Afrobeats talent.",
      },
      {
        name: "DJ Ron",
        photoUrl: "https://cdn.prod.website-files.com/61b90defe354e5660486c19b/61badea8d8acfdcb5b7253f1_FL-02.28-DJRon-BLOG.jpeg",
        bio: "Host of the London Something Podcast, interviewing jungle figures.",
      },
      {
        name: "Sun O.C.",
        bio: "Host of Grimey Hours, the interview series covering grime culture.",
      },
      {
        name: "Grant Body-P",
        photoUrl: "https://i.ytimg.com/vi/obWWlCvIDCo/maxresdefault.jpg",
        bio: "Presenter of the RePPiN4U Hip Hop Show, conducting artist interviews.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-music-producer-london-2026",
    nominees: [
      {
        name: "Fred again..",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2f/Fred_Again_2025_%28cropped%29.jpg",
        bio: "Named BRIT Producer of the Year in 2020; he produced Stormzy's 'Own It' and co-produced Headie One's 'Gang' project.",
      },
      {
        name: "Fraser T. Smith",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/58/Fraser_T_Smith_Portrait.jpg",
        bio: "A Grammy winner for his work on Adele's '21'; his credits include Kano's 'Made in the Manor' and Stormzy's 'Gang Signs & Prayer'.",
      },
      {
        name: "Naughty Boy",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e1/Naughtyboyasianawards.png",
        bio: "His single 'La La La' featuring Sam Smith topped the UK chart; he has worked with Emeli Sandé and Beyoncé.",
      },
      {
        name: "P2J",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f2/P2J.jpg",
        bio: "Produced Burna Boy's 'Anybody' and much of Wizkid's 'Made in Lagos'; he won a Grammy for 'Twice as Tall'.",
      },
      {
        name: "JAE5",
        photoUrl: "https://i.audiomack.com/jae5/42d53ad687.webp?width=400",
        bio: "Executive producer of J Hus's 'Common Sense' and producer of Dave's 'Location'; a MOBO Best Producer winner.",
      },
      {
        name: "Steel Banglez",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2f/SteelBanglez_presshot.jpg",
        bio: "Produced Krept & Konan's 'Go Down South' and Mist's 'Karla's Back'.",
      },
      {
        name: "Nana Rogues",
        photoUrl: "https://cdn.amsterdam-dance-event.nl/images/images/transforms/artists-speakers/_1200x630_crop_center-center_none/22565/NanaR-01560_158295.webp",
        bio: "Produced Drake's 'Passionfruit' and 'Skepta Interlude'; his credits also span Dave, J Hus and Stormzy.",
      },
      {
        name: "Conducta",
        photoUrl: "https://www.clashmusic.com/wp-content/uploads/2019/01/CONDUCTA-PRESS-2019-1.jpg",
        bio: "Produced AJ Tracey's chart hit 'Ladbroke Grove'.",
      },
      {
        name: "M1OnTheBeat",
        photoUrl: "https://crackmag.wpenginepowered.com/wp-content/uploads/2024/01/Magazine-M1ONTHEBEAT-Portrait-Gallery-2.jpg",
        bio: "Produced Headie One's early projects, Digga D's 'Woi', 'Golden Boot' and the Drake/Headie One 'Only You Freestyle'.",
      },
      {
        name: "Sir Spyro",
        photoUrl: "https://radiox.ch/.imaging/mte/radiox-theme/xlarge/dam/radiox-website/ADW-assets/SirSpyro.jpg/jcr:content/SirSpyro.jpg",
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
        photoUrl: "https://storage.googleapis.com/twtdata-blog/original_images/hometwitterappreports_dataprofile_image_JulsOnIt.jpeg",
        bio: "Won Best Producer at the 2025 MOBO Awards.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-nightlife-promoter-london-2026",
    nominees: [
      {
        name: "INFERNO",
        photoUrl: "https://images-prod.dazeddigital.com/1200/0-0-2985-1990/azure/dazed-prod/1320/0/1320784.JPG",
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
        photoUrl: "https://electronicgroove.com/wp-content/uploads/2025/11/LGBTQ-COLLECTIVES-by-Rae-Tait.jpg",
        bio: "Queer London party collective; one of eight collectives behind a landmark joint statement on the capital's queer venue crisis.",
      },
      {
        name: "BUMPAH",
        bio: "Queer London party collective; one of eight collectives behind a landmark joint statement on the capital's queer venue crisis.",
      },
      {
        name: "Coven",
        photoUrl: "https://images-prod.dazeddigital.com/1023/0-238-1023-682/azure/dazed-prod/1450/5/1455557.jpg",
        bio: "Queer London party collective; one of eight collectives behind a landmark joint statement on the capital's queer venue crisis.",
      },
      {
        name: "UHAUL Dyke Rescue",
        photoUrl: "https://freight.cargo.site/t/original/i/79c41c77a0e7fa59745af7af294f9e3da4eccf34bb6521c8599ea26b2f7d74b2/FM2025_Khris_Cowley_Saturday194.jpg",
        bio: "Queer London party collective; one of eight collectives behind a landmark joint statement on the capital's queer venue crisis.",
      },
      {
        name: "PLASTYK",
        bio: "Queer London party collective; one of eight collectives behind a landmark joint statement on the capital's queer venue crisis.",
      },
      {
        name: "Pxssy Palace",
        photoUrl: "https://image.rinse.fm/_/Pxssy-Palace.jpeg?w=1200&h=630",
        bio: "Collective behind London's Pxssy Palace queer club night; profiled in the Dazed 100.",
      },
      {
        name: "Horse Meat Disco",
        photoUrl: "https://pbs.twimg.com/profile_images/1233009286529372160/b3amYQZI_400x400.jpg",
        bio: "Long-running London queer disco party collective; staged a 2026 night at Eagle London in Vauxhall.",
      },
      {
        name: "Butterz",
        photoUrl: "https://upload.wikimedia.org/wikipedia/en/d/d2/Butterz_Logo_2013.png",
        bio: "Grime label and party brand founded by Elijah and Skilliam; credited with changing the blueprint for independent UK labels.",
      },
      {
        name: "Touching Bass",
        photoUrl: "http://www.northseajazz.com/-/media/northseajazz/rotterdam/shows/2019/touching-bass.jpg",
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
        photoUrl: "https://pbs.twimg.com/profile_images/949323310738878464/6wDIUEZN_400x400.jpg",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
      {
        name: "MC Fearless",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
      {
        name: "Shabba D",
        photoUrl: "https://instastatistics.com/shabbadan/opengraph-image",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
      {
        name: "Bassman",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
      {
        name: "Stamina MC",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/99/MC_Stamina.jpg",
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
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/00/DynamiteMC.jpg",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
      {
        name: "IC3",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
      {
        name: "SP:MC",
        photoUrl: "http://images.fabriclondon.com/wp-content/uploads/2012/07/SPMC_650.jpg",
        bio: "Drum-and-bass/jungle MC who hosts club and rave sets.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-podcast-host-london-2026",
    nominees: [
      {
        name: "Steven Bartlett",
        photoUrl: "https://stevenbartlett.com/images/doac-tiles/doac-tile11.jpg",
        bio: "Host of The Diary of a CEO, a chart-topping UK interview podcast.",
      },
      {
        name: "Rory Stewart",
        photoUrl: "https://www.rorystewart.co.uk/wp-content/uploads/2019/05/rory-stewart-720x480.jpg",
        bio: "Co-host of The Rest Is Politics with Alastair Campbell.",
      },
      {
        name: "Alastair Campbell",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2d/Alastair_Campbell_-_Chatham_House_2012_crop.jpg",
        bio: "Co-host of The Rest Is Politics with Rory Stewart.",
      },
      {
        name: "Tom Holland",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/3b/Writer_Tom_Holland,_February_2020.jpg",
        bio: "Co-host of The Rest Is History with Dominic Sandbrook.",
      },
      {
        name: "Dominic Sandbrook",
        photoUrl: "https://oxfordliteraryfestival.org/images/author/5902/dominic_sandbrook_by_john_cairns_25.3__event.gif",
        bio: "Co-host of The Rest Is History with Tom Holland.",
      },
      {
        name: "Peter Crouch",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/74/Chelsea_3_Stoke_0_(13677350585)_-_Peter_Crouch_(cropped).jpg",
        bio: "Host of That Peter Crouch Podcast.",
      },
      {
        name: "Gary Lineker",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7b/Gary_Lineker_2011.jpg",
        bio: "Co-host of The Rest Is Football with Alan Shearer and Micah Richards.",
      },
      {
        name: "Alan Shearer",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/ba/Alan_Shearer_2008.jpg",
        bio: "Co-host of The Rest Is Football with Gary Lineker and Micah Richards.",
      },
      {
        name: "Micah Richards",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Lech_-_Manchester_042.jpg",
        bio: "Co-host of The Rest Is Football with Gary Lineker and Alan Shearer.",
      },
      {
        name: "Marina Hyde",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1f/Marina_Hyde_at_the_British_Library_(cropped).jpg",
        bio: "Co-host of The Rest Is Entertainment with Richard Osman.",
      },
      {
        name: "Richard Osman",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/72/Richard_Osman_2022.png",
        bio: "Co-host of The Rest Is Entertainment with Marina Hyde.",
      },
      {
        name: "Louis Theroux",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7d/Louis_Theroux_at_Nordiske_Mediedager_2009.jpg",
        bio: "Host of The Louis Theroux Podcast.",
      },
      {
        name: "Ed Gamble",
        photoUrl: "https://www.justthetonic.com/artistimages/ed-gamble/feature/EdGamble-smaller.jpg",
        bio: "Co-host of the food-comedy podcast Off Menu with James Acaster.",
      },
      {
        name: "James Acaster",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/37/AcasterVaud011118_(45011799794)_(cropped).jpg",
        bio: "Co-host of Off Menu with Ed Gamble.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-queer-nightlife-personality-london-2026",
    nominees: [
      {
        name: "Jodie Harsh",
        photoUrl: "https://commons.wikimedia.org/wiki/Special:FilePath/Jodie_Harsh_at_SXSW_London_2026.jpg",
        bio: "London DJ and nightlife personality.",
      },
      {
        name: "Princess Julia",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Princess_Julia%2C_Oct_2011.jpg",
        bio: "London nightlife figure featured in DJHistory's Dancefloor Pride series.",
      },
      {
        name: "Glyn Fussell",
        photoUrl: "https://i0.wp.com/www.ldnfashion.com/wp-content/uploads/2022/06/ezgif-3-113a23af8f.jpeg?resize=1440%2C1440&ssl=1",
        bio: "Co-founded the London queer club night Sink The Pink with Amy Zing in 2008.",
      },
      {
        name: "Amy Zing",
        bio: "Co-founded the London queer club night Sink The Pink with Glyn Fussell in 2008.",
      },
      {
        name: "Nadine Noor Ahmad",
        photoUrl: "https://images-prod.dazeddigital.com/1067/azure/dazed-prod/1320/8/1328020.JPG",
        bio: "Co-founder of the Pxssy Palace collective.",
      },
      {
        name: "Skye Barr",
        bio: "Co-founder of the Pxssy Palace collective.",
      },
      {
        name: "Lewis G Burton",
        photoUrl: "https://static.ra.co/images/profiles/square/lewisg-burton.jpg?dateUpdated=1522944920000",
        bio: "Founder of the queer techno party INFERNO.",
      },
      {
        name: "Errol Anderson",
        photoUrl: "https://images.ctfassets.net/taoiy3h84mql/3GjWGmK1XXk2NtwGKBjsfR/a48ed31468b21191f4bfa7c5644f0bbd/GuestShowErrol_-_Errol_Anderson.JPG?w=1200&h=630&fit",
        bio: "Co-founder of the South London music community Touching Bass.",
      },
      {
        name: "Alex Rita",
        photoUrl: "http://www.northseajazz.com/-/media/northseajazz/rotterdam/shows/2019/touching-bass.jpg",
        bio: "Co-founder of the South London music community Touching Bass.",
      },
      {
        name: "James Hillard",
        photoUrl: "https://media.k-dj.jp/kdj/djs/jameshillard/profilel.jpg",
        bio: "Member of the Horse Meat Disco DJ collective.",
      },
      {
        name: "Jim Stanton",
        photoUrl: "https://jaegeroslo.no/wp-content/uploads/2022/06/HORSEMEATDISCO_ROMURPHY_PRESSSHOTS-2-600x600.jpg",
        bio: "Member of the Horse Meat Disco DJ collective.",
      },
      {
        name: "Luke Howard",
        photoUrl: "https://media.k-dj.jp/kdj/djs/lukehoward/profilel.jpg",
        bio: "Member of the Horse Meat Disco DJ collective.",
      },
      {
        name: "Severino",
        photoUrl: "https://media.k-dj.jp/kdj/djs/severino/profilel.jpg",
        bio: "Member of the Horse Meat Disco DJ collective.",
      },
      {
        name: "Jay Jay Revlon",
        photoUrl: "https://www.dnamagazine.com.au/wp-content/uploads/2024/02/JAYJAY-1000x550.jpg",
        bio: "London DJ and promoter; played Glitterbox's return to London.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-radio-newcomer-london-2026",
    nominees: [
      {
        name: "Riria",
        photoUrl: "https://image.rinse.fm/_/riria-1.jpg?w=1200&h=600",
        bio: "Tokyo-born, London-based DJ who became a Rinse FM resident in 2025.",
      },
      {
        name: "Kash & Pharxoh",
        bio: "1Xtra presenters named on the line-up for the station's first 1Xtra Takeover club night at EartH Hall, Hackney, in April 2026.",
      },
      {
        name: "Amirah Amour",
        photoUrl: "https://www.reprezent.org.uk/_next/image?url=https%3A%2F%2Femvrqvgxkhiwxafqslqp.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fmedia%2Fimages%2Fcrops%2FAMIRAH%2520AMOUR%2520(JULY%25202026)_desktop_1786383937260.webp&w=384&q=100",
        bio: "Hosts a Monday morning show on Reprezent, the youth-led London radio station.",
      },
      {
        name: "Bisola",
        photoUrl: "https://www.reprezent.org.uk/_next/image?url=https%3A%2F%2Femvrqvgxkhiwxafqslqp.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fmedia%2Fimages%2Fcrops%2FBisola_1_desktop_1780411118874.webp&w=640&q=75",
        bio: "Hosts a Monday show of fresh music, games and interviews on Reprezent.",
      },
      {
        name: "Sinead Adams",
        photoUrl: "https://www.reprezent.org.uk/_next/image?url=https%3A%2F%2Femvrqvgxkhiwxafqslqp.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fmedia%2Fimages%2Fcrops%2FSINEAD%2520ADAMS_desktop_1780407458322.webp&w=1200&q=75",
        bio: "Presents a Friday show on Caribbean and Black British culture on Reprezent.",
      },
      {
        name: "Skeen LDN",
        photoUrl: "https://www.reprezent.org.uk/_next/image?url=https%3A%2F%2Femvrqvgxkhiwxafqslqp.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fmedia%2Fimages%2Fcrops%2FSkeen_LDN_2_desktop_1756276952899.webp&w=384&q=75",
        bio: "Brings grime to Reprezent every second Friday of the month.",
      },
      {
        name: "Rellik Tha Don",
        photoUrl: "https://www.reprezent.org.uk/_next/image?url=https%3A%2F%2Femvrqvgxkhiwxafqslqp.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fmedia%2Fimages%2Fcrops%2FRellik_Tha_Don_1_desktop_1784663318100.webp&w=384&q=100",
        bio: "Focuses on new UK R&B on Reprezent.",
      },
      {
        name: "MIDRIB",
        bio: "Presents dubstep, techno, breakbeat and experimental dance music on Reprezent.",
      },
      {
        name: "Leah Davis",
        photoUrl: "https://global.com/ni/wp-content/uploads/2023/01/Leah-Davis-Image-scaled-e1673285359843-2000x1069-1.jpeg",
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
        photoUrl: "https://images.prismic.io/rewirefestival/aWpa9wIvOtkhBp6X_RaisaKPressShot.png?auto=format,compress&rect=0,36,1920,1008&w",
        bio: "Joined NTS Radio as a new resident in summer 2025.",
      },
      {
        name: "Silent Addy & Disco Neil",
        photoUrl: "https://pbs.twimg.com/profile_images/1397998108332658689/76Oeyk0T_400x400.jpg",
        bio: "Bashment Sound duo who joined NTS Radio as new residents in summer 2025.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-rb-singer-london-2026",
    nominees: [
      {
        name: "Cleo Sol",
        photoUrl: "https://thatgrapejuice.net/wp-content/uploads/2012/05/cleo-sol-.jpg",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "Elmiene",
        photoUrl: "https://soulbounce.com/wp-content/uploads/2024/11/elmiene-npr-music-tiny-desk-concert-still-800.jpeg",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "FLO",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5d/FLO_at_the_FLO_Live_Tour_in_London_%282%29_%28cropped%29.jpg/960px-FLO_at_the_FLO_Live_Tour_in_London_%282%29_%28cropped%29.jpg",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "Jaz Karis",
        photoUrl: "https://rnbrhythms.info/wp-content/uploads/2025/04/IMG_2766.jpeg",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "Jorja Smith",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/3/34/Jorja_Smith_11_26_2018_-5_%2845772599074%29.jpg/960px-Jorja_Smith_11_26_2018_-5_%2845772599074%29.jpg",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "Nippa",
        photoUrl: "https://cloudimages2.broadwayworld.com/columnpiccloud/Nippa-Links-With-Jordan-Ward-for-New-Single-KACEY-1787926513.jpg?format=jpeg&quality=80&width=1200",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "Odeal",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ee/Odeal-10-18-25.jpg/960px-Odeal-10-18-25.jpg",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "Sasha Keable",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/47/Sasha_Keable_at_2026_Montreux_Jazz_Festival_2.png/960px-Sasha_Keable_at_2026_Montreux_Jazz_Festival_2.png",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "Shae Universe",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7d/Shae_Universe_at_EssenceFest_2025.jpg",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "Sinéad Harnett",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/ba/SineadHarnett_%28cropped%29.jpg/960px-SineadHarnett_%28cropped%29.jpg",
        bio: "Nominated for Best R&B/Soul Act at the 2025 MOBO Awards.",
      },
      {
        name: "Ella Mai",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/9d/Ella_Mai_2019_by_Glenn_Francis.jpg/960px-Ella_Mai_2019_by_Glenn_Francis.jpg",
        bio: "Her single 'Boo'd Up' reached No.5 on the Billboard Hot 100; her self-titled debut album debuted at No.5 on the Billboard 200 and in the UK Top 20.",
      },
      {
        name: "Mahalia",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f1/Boardmaster21_%2876%29_%2851385229597%29_%28cropped%29.jpg/960px-Boardmaster21_%2876%29_%2851385229597%29_%28cropped%29.jpg",
        bio: "Won Best Female Act and Best R&B/Soul Act at the 2020 MOBO Awards; her debut album 'Love and Compromise' is BPI Silver-certified.",
      },
      {
        name: "RAYE",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/12/Raye8888.jpg",
        bio: "Set a BRIT Awards record with six wins in 2024, including Album of the Year for 'My 21st Century Blues', which reached No.2 in the UK.",
      },
      {
        name: "Michael Kiwanuka",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ef/Glasto24_2806_300624_%2847_of_382%29_%2853837926593%29_%28cropped%29.jpg/960px-Glasto24_2806_300624_%2847_of_382%29_%2853837926593%29_%28cropped%29.jpg",
        bio: "Won the 2020 Mercury Prize for his album 'KIWANUKA', which peaked at No.2 in the UK.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-reality-tv-personality-london-2026",
    nominees: [
      {
        name: "Ekin-Su Cülcüloğlu",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/f/f0/Ekin-Su_C%C3%BClc%C3%BClo%C4%9Flu_at_the_National_Television_Awards.jpg/960px-Ekin-Su_C%C3%BClc%C3%BClo%C4%9Flu_at_the_National_Television_Awards.jpg",
        bio: "Won Love Island in 2022.",
      },
      {
        name: "Dani Dyer",
        photoUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/c/ce/Dani_Dyer_at_BAFTAs_2026_02_%28cropped%29.jpg/960px-Dani_Dyer_at_BAFTAs_2026_02_%28cropped%29.jpg",
        bio: "Won Love Island in 2018.",
      },
      {
        name: "Amber Gill",
        photoUrl: "https://imgix.bustle.com/uploads/image/2019/5/28/ddbb1bec-c0da-4e57-aaaf-240b6a9cae26-amber-gill.jpg?w=1200",
        bio: "Won Love Island in 2019.",
      },
      {
        name: "Kem Cetinay",
        photoUrl: "https://imgs.capitalfm.com/images/552751?crop=16_9&width=660&relax=1&format=webp&signature=sIkLL0wUVO1hcQ8HncEu1FOQw9k=",
        bio: "Won Love Island in 2017.",
      },
      {
        name: "Molly Smith",
        photoUrl: "https://images.immediate.co.uk/production/volatile/sites/3/2020/02/Molly-Smith-a84a222.jpg?quality=90&fit=700,467",
        bio: "Won Love Island: All Stars in 2024.",
      },
      {
        name: "Mimii Ngulube",
        photoUrl: "https://imgs.capitalfm.com/images/653990?crop=16_9&width=660&relax=1&format=webp&signature=gKu1vT7rYzLx5CbJf96xB9NenFo=",
        bio: "Won Love Island in 2024.",
      },
      {
        name: "Harry Clark",
        bio: "Won series 2 of The Traitors.",
      },
      {
        name: "Jake Brown",
        photoUrl: "https://imgs.capitalfm.com/images/696594?crop=16_9&width=660&relax=1&format=webp&signature=zSpmLc_pxAzl9A-NAd1FzhsJVPQ=",
        bio: "Won series 3 of The Traitors.",
      },
      {
        name: "Leanne Quigley",
        photoUrl: "https://imgs.capitalfm.com/images/696598?crop=16_9&width=660&relax=1&format=webp&signature=pd3QIBi95edgu3P2luS9Cit9buM=",
        bio: "Won series 3 of The Traitors.",
      },
      {
        name: "Charlotte Berman",
        photoUrl: "https://imgs.capitalfm.com/images/696589?crop=16_9&width=660&relax=1&format=webp&signature=G9FN5j-tJG5Xb-vDft17QLUDnFg=",
        bio: "Finalist on series 3 of The Traitors.",
      },
      {
        name: "Francesca Rowan-Plowden",
        photoUrl: "https://imgs.capitalfm.com/images/696592?crop=16_9&width=660&relax=1&format=webp&signature=u235wZOtoRY9N1DBjBiG_1wAPbM=",
        bio: "Finalist on series 3 of The Traitors.",
      },
      {
        name: "Jordan Sangha",
        photoUrl: "https://images.immediate.co.uk/production/volatile/sites/3/2023/10/Big-Brother-2023-contestant-Jordan-f02fba5.jpg?quality=90&amp;fit=700,466",
        bio: "Won Big Brother UK in 2023.",
      },
      {
        name: "Ali Bromley",
        photoUrl: "https://images.immediate.co.uk/production/volatile/sites/3/2024/10/ali-big-brother-3029b67.jpg?quality=90&fit=700,467",
        bio: "Won Big Brother UK in 2024.",
      },
      {
        name: "David Potts",
        photoUrl: "https://images.immediate.co.uk/production/volatile/sites/3/2024/03/David-Potts-05272fb.jpg?quality=90&fit=700,466",
        bio: "Won Celebrity Big Brother UK in 2024.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-restaurant-reviewer-london-2026",
    nominees: [
      {
        name: "Picky Glutton",
        photoUrl: "https://pbs.twimg.com/profile_images/1505850378/IMG_1847_400x400.JPG",
        bio: "London restaurant reviewer and blogger covering the city's restaurant scene.",
      },
      {
        name: "Silverspoon London",
        photoUrl: "https://www.vuelio.com/uk/wp-content/uploads/2018/03/Angie-Silver-700x400.jpg",
        bio: "London-based food reviewer sharing restaurant reviews from across the capital.",
      },
      {
        name: "The Foodaholic",
        photoUrl: "https://pbs.twimg.com/profile_images/929183348/foodaholicBanner1_400x400.jpg",
        bio: "London food blogger reviewing restaurants across the city.",
      },
      {
        name: "Cheese and Biscuits",
        photoUrl: "https://scontent-lax3-2.cdninstagram.com/v/t51.2885-19/10542851_746104648783565_1918716881_a.jpg?stp=dst-jpg_s100x100_tt6&_nc_cat=100&ccb=7-5&_nc_sid=bf7eb4&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4xNTAuQzMifQ%3D%3D&_nc_ohc=EWtfPb_mcL0Q7kNvwGvIHb-&_nc_oc=Adrvc_VdjaUCj24e6Hnso2Grnc-cNBqtSHZ009GKbYMHNyYOokxK-SX0KAXz9mQPOlGzea7fBfyIzYRatIcY_tgM&_nc_zt=24&_nc_ht=scontent-lax3-2.cdninstagram.com&_nc_ss=7960f&oh=00_AQIV84W2shDY4M8HfPylz4DOMkfr6HjUHItErpcvLVXFeA&oe=6ABB701B",
        bio: "London restaurant review blog covering dining across the capital.",
      },
      {
        name: "Binny's Food and Travel Diaries",
        photoUrl: "https://www.vuelio.com/uk/wp-content/uploads/2017/11/Binnys-Kitchen-700x400.jpg",
        bio: "London-based food and travel blogger reviewing the city's restaurants.",
      },
      {
        name: "Halal Girl About Town",
        photoUrl: "https://scontent-iad3-1.cdninstagram.com/v/t51.2885-19/10848170_328874933982381_1370964284_a.jpg?stp=dst-jpg_s100x100_tt6&_nc_cat=108&ccb=7-5&_nc_sid=bf7eb4&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4xNTAuQzMifQ%3D%3D&_nc_ohc=xvtPDfnyhhkQ7kNvwEOmzxT&_nc_oc=AdqgJALZtfKmUvstIYSK7JdRx211uqNjZ9zQGFdceOwEPdemeaL6JpmSIm2IQnSq3YgXPYOgdGOh1MeiNDZ7WErp&_nc_zt=24&_nc_ht=scontent-iad3-1.cdninstagram.com&_nc_ss=7960f&oh=00_AQIa8QT5qe5PqZ2GZkTo39FcwUFBWDy52GRcd9kV6sVa5w&oe=6ABB7220",
        bio: "London food reviewer focused on halal-friendly restaurants across the city.",
      },
      {
        name: "Samphire and Salsify",
        photoUrl: "https://scontent-iad6-1.cdninstagram.com/v/t51.2885-19/455718326_1041271853532220_5194039279719647457_n.jpg?stp=dst-jpg_s100x100_tt6&_nc_cat=107&ccb=7-5&_nc_sid=bf7eb4&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4xMDgwLkMzIn0%3D&_nc_ohc=ZIP9RCIR8YcQ7kNvwGb2_f3&_nc_oc=AdpN0oWZEG2Itv4m995UtwKphAzQCXHeQhiiu6eAhuhcVjYwnDnvZlfuYX1fg1knuQAmHVb_XeP1eCcAKl7A_HMk&_nc_zt=24&_nc_ht=scontent-iad6-1.cdninstagram.com&_nc_ss=7960f&oh=00_AQJSOfhMnER2r3-R2qlRYpBzsLQ38MQYdXEuEgflnzqfNQ&oe=6ABB6145",
        bio: "London restaurant review blog covering the city's dining scene.",
      },
      {
        name: "London Eater",
        photoUrl: "https://scontent-atl3-1.cdninstagram.com/v/t51.82787-19/574106530_18546201442050199_7359355382702392028_n.jpg?stp=dst-jpg_s100x100_tt6&_nc_cat=103&ccb=7-5&_nc_sid=bf7eb4&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4xMDgwLkMzIn0%3D&_nc_ohc=057thaI-8PsQ7kNvwGM2gfW&_nc_oc=AdoKgokRB9bJrXxrwPJ0hVNl0c6fPuXYDisAImb6z7JS1twShHU-45laKU3Hl6m3TO1-FK5qCL2m8fzc5Ld-obkY&_nc_zt=24&_nc_ht=scontent-atl3-1.cdninstagram.com&_nc_gid=YYkouHplw_IgaNxNR6YAKg&_nc_ss=7960f&oh=00_AQKVdc-HnbnEomFuoxljuKjKv_9tglO_7DSkeLF0plVeGA&oe=6ABB7A0C",
        bio: "London-based food reviewer covering the capital's restaurant scene on social media.",
      },
      {
        name: "Clerkenwell Boy",
        photoUrl: "https://scontent-lax3-1.cdninstagram.com/v/t51.2885-19/411076805_1010475626696865_4348950130517668742_n.jpg?stp=dst-jpg_s100x100_tt6&_nc_cat=102&ccb=7-5&_nc_sid=bf7eb4&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4xMDgwLkMzIn0%3D&_nc_ohc=PWlW8PBXcEIQ7kNvwExfklg&_nc_oc=Adoh9v_gvV37K6ocf4C7Gov4E-SDKwMzDXR92G4sbv0u5bPvTQzlTmVUpsMcW9KGtAH37BK5-_QeSkac0CGkUUL1&_nc_zt=24&_nc_ht=scontent-lax3-1.cdninstagram.com&_nc_ss=7960f&oh=00_AQJZdDxeCjphk21M4MC1F--p7wxucOVsYxoiFZVWRtuI5A&oe=6ABB4D36",
        bio: "London food Instagrammer known for reviewing restaurants across the capital.",
      },
      {
        name: "Giulia Mulè",
        photoUrl: "https://www.mondomulia.com/wp-content/uploads/2020/05/peach-blossom-tree-spring-3-scaled.jpg",
        bio: "London-based food content creator reviewing the city's restaurants.",
      },
      {
        name: "Leyla Kazim",
        photoUrl: "https://images.immediate.co.uk/production/volatile/sites/3/2023/12/MasterChef-Battle-of-the-Critics-cast-d960b04.jpg?quality=90&resize=980,654",
        bio: "London food writer and broadcaster covering the city's restaurant scene.",
      },
      {
        name: "James Thompson",
        photoUrl: "https://scontent-iad3-1.cdninstagram.com/v/t51.2885-19/78790348_574894819995504_1764173003836358656_n.jpg?stp=dst-jpg_s100x100_tt6&_nc_cat=108&ccb=7-5&_nc_sid=bf7eb4&efg=eyJ2ZW5jb2RlX3RhZyI6InByb2ZpbGVfcGljLnd3dy4xMDgwLkMzIn0%3D&_nc_ohc=XaJRvi4SKXMQ7kNvwHJbYCZ&_nc_oc=Adp-wcXUaisK7UyvhGtUr2k5OeFZHiz_LC8RwXXdeh7CiogIrA7rka29TiVT_AQIN71GrU5z3cG34jJvT5iuakRT&_nc_zt=24&_nc_ht=scontent-iad3-1.cdninstagram.com&_nc_ss=7960f&oh=00_AQJPv9XL5LoqpiULih-77AgLzaMIraGnDKWZ3b_5ybnvoA&oe=6ABB5080",
        bio: "London food reviewer sharing restaurant recommendations from across the capital.",
      },
      {
        name: "Moses Combe",
        bio: "London TikTok creator whose restaurant reviews were covered by The Times.",
      },
      {
        name: "Eating with Tod",
        photoUrl: "https://cdn.thetab.com/wp-content/uploads/2025/12/18162135/2-30.png",
        bio: "London food creator whose reviews of the city's restaurants have been covered in the press.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-sneaker-creator-london-2026",
    nominees: [
      {
        name: "MikePairs (Michael Allen)",
        photoUrl: "https://yt3.googleusercontent.com/ytc/AIdro_mDuGIK9xsh6EEXOZ-zn2WoPgYL9fvQASv0nR0Sn6sZ-kg=s900-c-k-c0x00ffffff-no-rj",
        bio: "UK-based sneaker collector and founder of the Pairs platform.",
      },
      {
        name: "Titi Finlay",
        photoUrl: "https://static.wixstatic.com/media/03383c_66e68c7ecd414d62a4b6579171b98476~mv2.jpg/v1/fill/w_680,h_385,al_c,q_80,usm_0.66_1.00_0.01,enc_avif,quality_auto/Image-empty-state.jpg",
        bio: "London-born artist, graphic designer and art director whose work centres on sneakers and gender-neutral sneaker culture.",
      },
      {
        name: "George Sullivan",
        photoUrl: "https://images.squarespace-cdn.com/content/590eeff5b8a79b2147a783be/1742119857794-YZM1L9MMO6U4LDTM7ABJ/George+Sullivan.jpeg?content-type=image%2Fjpeg",
        bio: "Founder of The Sole Supplier, a UK sneaker and streetwear platform.",
      },
      {
        name: "Robert Franks",
        photoUrl: "https://www.theindustry.fashion/wp-content/uploads/kickgamefounder2-1024x640.jpg",
        bio: "Co-founded London sneaker retailer Kick Game with his brother David in 2013.",
      },
      {
        name: "Martine Rose",
        photoUrl: "https://cdn.prod.website-files.com/5fed0f51ffc65593dde6cef2/65305d6de953942322b25a4a_martine_rose0002.jpeg",
        bio: "London menswear designer behind ongoing Nike collaborations including the Shox MR4.",
      },
      {
        name: "Dan Kitchener",
        photoUrl: "https://yt3.googleusercontent.com/ytc/AIdro_lZU-zXGDnCseSVFH9_eMSaSja9ArBm_T7iy-Rx3T5Z_J0=s900-c-k-c0x00ffffff-no-rj",
        bio: "London-based street and mural artist who customised a Nike Air Max 90 for a Farfetch trainer guide.",
      },
      {
        name: "Helen Kirkum",
        photoUrl: "https://scalemag.online/wp-content/uploads/2021/02/scale-HELEN_KIRKUM_ZIG2.jpg",
        bio: "London-based sneaker customiser named among the UK's must-see custom artists.",
      },
      {
        name: "7igures",
        photoUrl: "https://yt3.googleusercontent.com/ftBvbbXgfsTVzLXh2cAwyjd5IjAoE1esKUc8Vt7xDfCit-nm0i9zaAxOsF2_zKk933QE8F25YQ=s900-c-k-c0x00ffffff-no-rj",
        bio: "UK sneaker and streetwear media platform covering British trainer culture on YouTube.",
      },
      {
        name: "Skepta",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Skepta_2025_%28cropped%29.jpg/960px-Skepta_2025_%28cropped%29.jpg",
        bio: "Grime MC with multiple Nike collaborations, including the Air Max 97 Sk and SK Air lines.",
      },
      {
        name: "Stormzy",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Stormzy_-_Openair_Frauenfeld_2019_02.jpg/330px-Stormzy_-_Openair_Frauenfeld_2019_02.jpg",
        bio: "Grime star who partnered with Adidas Originals on the SPRT collection.",
      },
      {
        name: "Beverley Tofuor",
        photoUrl: "https://i.ytimg.com/vi/_dXaovSYdRU/hqdefault.jpg",
        bio: "Founder of British footwear brand Tobe Footwear.",
      },
      {
        name: "Bugzy Malone",
        photoUrl: "https://www.blackhistorymonth.org.uk/wp-content/uploads/2021/07/Bugzy-Malone-623x400.png",
        bio: "Manchester rapper behind the B Malone footwear brand.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-soap-star-london-2026",
    nominees: [
      {
        name: "Lacey Turner",
        photoUrl: "https://cdn.apollo.audio/one/media/5d6d/3405/16ef/e66c/1832/295a/lacey-turner.jpg?quality=80&format=jpg&crop=151,0,1817,2962&resize=crop",
        bio: "Plays Stacey Slater in EastEnders; won Best Leading Performer at the 2025 British Soap Awards.",
      },
      {
        name: "Kellie Bright",
        photoUrl: "https://dev.mos.cms.futurecdn.net/JyoXaTGMijiwCk7jTLKsKa-630-80.jpg",
        bio: "Plays Linda Carter in EastEnders; nominee at the 2025 British Soap Awards.",
      },
      {
        name: "Eden Taylor-Draper",
        photoUrl: "https://cdn.entertainmentdaily.com/2019/07/29113320/Eden-Taylor-Draper--e1564396424590.jpg",
        bio: "Plays Belle Dingle in Emmerdale; nominee at the 2025 British Soap Awards.",
      },
      {
        name: "Beth Cordingly",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/Beth_Cordingly_BAFTA_09.jpg/250px-Beth_Cordingly_BAFTA_09.jpg",
        bio: "Plays Ruby Miligan in Emmerdale; nominee at the 2025 British Soap Awards.",
      },
      {
        name: "Navin Chowdhry",
        photoUrl: "https://d27o7y1r7mnbwc.cloudfront.net/media/uploads/clients/navin-chowdhry/images/gallery/2025-03-21_144923_3.jpg",
        bio: "Played Nish Panesar in EastEnders; won Villain of the Year at the 2025 British Soap Awards.",
      },
      {
        name: "Jack P. Shepherd",
        photoUrl: "https://cdn.apollo.audio/one/media/5b59/e03e/1029/dd13/6ad7/5a8e/coronation-street-jack-p-shepherd.jpg?quality=80&format=jpg",
        bio: "Plays David Platt in Coronation Street; nominee at the 2025 British Soap Awards.",
      },
      {
        name: "Patsy Palmer",
        photoUrl: "https://images.plex.tv/photo?size=large-1280&url=https%3A%2F%2Fmetadata-static.plex.tv%2Fpeople%2F5d776d69fb0d55001f59fa0c.jpg",
        bio: "Plays Bianca Jackson in EastEnders; won Best Comedy Performance at the 2025 British Soap Awards.",
      },
      {
        name: "Nicola Wheeler",
        photoUrl: "https://cdn.entertainmentdaily.com/uploads/2022/06/Emmerdale-Nicola-Wheeler-This-Morning-768x434.jpg",
        bio: "Plays Nicola King in Emmerdale; nominee at the 2025 British Soap Awards.",
      },
      {
        name: "Peter Ash",
        photoUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEigqX8SUvDDtXncTzwXIMtsfWS9vT3xZVSQiENEC1y6FyxXmNceQWtyH7bVR5wi-C8V_LA7x0qM9DWvNJlKlHFruhdTJpOMMcxD7SOgc_7iSACXN-P6bjOb0EhW22cvD-1R-U-f310OhBtQ/w1200-h630-p-k-no-nu/batch_paul.jpg",
        bio: "Played Paul Foreman in Coronation Street; nominee at the 2025 British Soap Awards.",
      },
      {
        name: "Steve McFadden",
        bio: "Plays Phil Mitchell in EastEnders; won Best Dramatic Performance at the 2025 British Soap Awards.",
      },
      {
        name: "William Roache",
        photoUrl: "https://www.glasgowtimes.co.uk/resources/images/10972566.jpg?type=og-image",
        bio: "Has played Ken Barlow in Coronation Street since 1960.",
      },
      {
        name: "Barbara Knox",
        photoUrl: "https://cdn.tvpassport.com/image/people/270x360/v2/220378_v9_bb.jpg",
        bio: "Plays Rita Tanner in Coronation Street and is among the longest-serving soap stars.",
      },
      {
        name: "Sally Dynevor",
        photoUrl: "https://i2-prod.ok.co.uk/article14638247.ece/ALTERNATES/s615b/647123_1438180548_sally-dynevor-portrait_11617b3cea7166b71fae210245895cd8",
        bio: "Plays Sally Metcalfe in Coronation Street.",
      },
      {
        name: "Simon Gregson",
        photoUrl: "https://image.tmdb.org/t/p/h632/2txGEXujkmgAqJr1OzSYbFyXjXd.jpg",
        bio: "Plays Steve McDonald in Coronation Street.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-specialist-radio-host-london-2026",
    nominees: [
      {
        name: "Kenny Allstar",
        photoUrl: "https://www.musicweek.com/cimages/fd95930b86f5b01fe61bdd08588f100d.jpg",
        bio: "BBC Radio 1Xtra presenter who hosts the station's Rap Show.",
      },
      {
        name: "Nadia Jae",
        photoUrl: "https://www.mcsaatchitalent.com/wp-content/uploads/2022/03/Headshot-scaled.jpg",
        bio: "BBC Radio 1Xtra presenter.",
      },
      {
        name: "Trevor Nelson",
        photoUrl: "https://www.blackhistorymonth.org.uk/wp-content/uploads/2021/04/SOUL-NATION-PRESENTS-TREVOR-NELSON-623x438.jpg",
        bio: "BBC Radio 1Xtra presenter.",
      },
      {
        name: "David Rodigan",
        photoUrl: "https://d23sy9fe9womrt.cloudfront.net/0/37700_1_david-rodigan-40th-anniversary-tour-tickets-and-information_ban.jpg",
        bio: "Veteran reggae broadcaster and BBC Radio 1Xtra presenter.",
      },
      {
        name: "Snoochie Shy",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/32/Snoochie_Shy_on_MTV_UK.jpg/1280px-Snoochie_Shy_on_MTV_UK.jpg",
        bio: "BBC Radio 1Xtra presenter.",
      },
      {
        name: "Sir Spyro",
        photoUrl: "https://bbcinsight.pages.dev/_bbc-assets/ichef.bbci.co.uk/images/ic/400x400/p0lzsznz.jpg",
        bio: "BBC Radio 1Xtra presenter.",
      },
      {
        name: "DJ Target",
        photoUrl: "https://image.tmdb.org/t/p/w500/51qPFjRZy8pjoSkZtXYN6owcdlv.jpg",
        bio: "BBC Radio 1Xtra DJ and presenter.",
      },
      {
        name: "Remi Burgz",
        photoUrl: "https://cdn-profiles.tunein.com/p1398118/images/logog.jpg?t=6",
        bio: "BBC Radio 1Xtra presenter who moved to the station's drive-time slot.",
      },
      {
        name: "Seani B",
        photoUrl: "https://reggaenorthca.com/wp-content/uploads/2026/04/Seani-B-1500.png",
        bio: "Host of BBC Radio 1Xtra's Dancehall Show.",
      },
      {
        name: "DJ Edu",
        bio: "Host of BBC Radio 1Xtra's Destination Africa, championing African music in the UK.",
      },
      {
        name: "Gilles Peterson",
        photoUrl: "https://greenbelt-artist-images.s3.eu-west-2.amazonaws.com/4631.jpg",
        bio: "BBC Radio 6 Music presenter.",
      },
      {
        name: "SHERELLE",
        photoUrl: "https://cdn.amsterdam-dance-event.nl/images/images/transforms/artists-speakers/_1200x630_crop_center-center_none/1624123/sherelle.webp",
        bio: "BBC Radio 6 Music presenter, DJ and producer.",
      },
      {
        name: "Jamz Supernova",
        photoUrl: "https://malta-festival.pl/wp-content/uploads/2024/08/KF-JAMZ-zdjecie-glowne-1.jpg",
        bio: "BBC Radio 6 Music presenter.",
      },
      {
        name: "Don Letts",
        photoUrl: "https://musicrepublicmagazine.com/wp-content/uploads/2025/06/28e3c58d_THE-DON-HEADSHOT.jpeg",
        bio: "BBC Radio 6 Music presenter.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-stand-up-newcomer-london-2026",
    nominees: [
      {
        name: "Joe Kent-Walters",
        photoUrl: "https://www.chortle.co.uk/images/photos/small/jkw-joe-kent-walters-BBC-new-comedy.jpg",
        bio: "Won Best Newcomer at the Edinburgh Comedy Awards 2024; also won the 2023 BBC New Comedy Award.",
      },
      {
        name: "Ayo Adenekin",
        photoUrl: "https://cdn.comedy.co.uk/images/library/comedies/900x450_eps/b/bbc_new_comedy_award_2025_07_ayo_adenekan.jpg",
        bio: "Joint winner of the ISH Edinburgh Comedy Award for Best Newcomer 2025.",
      },
      {
        name: "Amelia Hamilton",
        photoUrl: "https://thephoenixremix.com/wp-content/uploads/2025/05/amelia-hamilton.png?w=890",
        bio: "Joint winner of the ISH Edinburgh Comedy Award for Best Newcomer 2025.",
      },
      {
        name: "Abby Wambaugh",
        photoUrl: "https://cloudimages.broadwayworld.com/columnpiccloud/ABBY-WAMBAUGH-THE-FIRST-3-MINUTES-OF-17-SHOWS-Comes-to-London-1731570559.jpg",
        bio: "Winner of the ISH Edinburgh Comedy Award for Best Newcomer 2024.",
      },
      {
        name: "Dan Tiernan",
        photoUrl: "https://www.chortle.co.uk/images/photos/small/dt-dan-tiernan-25.jpg",
        bio: "Joint winner of the ISH Edinburgh Comedy Award for Best Newcomer 2023.",
      },
      {
        name: "Fiona Ridgewell",
        photoUrl: "https://theweereview.com/wp-content/uploads/2023/08/52920046433_5fc0ec974f_z.jpg",
        bio: "Joint winner of the ISH Edinburgh Comedy Award for Best Newcomer 2023.",
      },
      {
        name: "Roger O'Sullivan",
        bio: "Winner of the Comedians' Choice Award for Best Newcomer 2025.",
      },
      {
        name: "Emmanuel Sonubi",
        photoUrl: "https://www.chortle.co.uk/images/photos/small/es-emmanuel-sonubi-26.jpg",
        bio: "London-based stand-up; nominated for Best Newcomer at the Edinburgh Comedy Awards 2022.",
      },
      {
        name: "Vittorio Angelone",
        photoUrl: "https://cdn.comedy.co.uk/images/library/people/900x450/v/vittorio_angelone_wdytya.jpg",
        bio: "London-based Italian-Irish comic; Best Newcomer nominee at the Edinburgh Comedy Awards 2022.",
      },
      {
        name: "Celya AB",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/18/Celya_AB_at_Soho_Theatre_in_London_-_2025_-_04_%28cropped%29.jpg",
        bio: "Winner of Chortle's Best Newcomer award; Paris-born, Birmingham-based comic.",
      },
      {
        name: "Ania Magliano",
        photoUrl: "https://www.chortle.co.uk/images/photos/small/am-ania-magliano-wip-ed25.jpg",
        bio: "Edinburgh Comedy Award nominee and SNL UK cast member.",
      },
      {
        name: "Chloe Petts",
        photoUrl: "https://cdn.comedy.co.uk/images/library/people/900x450/c/chloe_petts_2023.jpg",
        bio: "Live at the Apollo stand-up.",
      },
      {
        name: "Bella Hull",
        photoUrl: "https://www.chortle.co.uk/images/photos/small/bh-bella-hull-drs.jpg",
        bio: "Newcomer showcased in the Pleasance's 2025 newcomer season.",
      },
      {
        name: "Aurie Styla",
        photoUrl: "https://www.chortle.co.uk/images/photos/small/as-aurie-styla.jpg",
        bio: "Rising stand-up touring the UK with his Christmas show.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-streamer-london-2026",
    nominees: [
      {
        name: "TommyInnit",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/be/HMX_3271_%2853332035431%29.jpg",
        bio: "British Minecraft streamer with around 7.3M Twitch followers.",
      },
      {
        name: "Tubbo",
        photoUrl: "https://www.dexerto.com/cdn-image/wp-content/uploads/2024/02/28/Tubbo-Twitch-Wilbur-Soot-response.jpg",
        bio: "British Minecraft streamer and former Dream SMP member.",
      },
      {
        name: "GeorgeNotFound",
        photoUrl: "https://www.dexerto.com/cdn-image/wp-content/uploads/2021/07/06/georgenotfound-trending.jpg",
        bio: "British Minecraft streamer with over 4.8M Twitch followers.",
      },
      {
        name: "Philza",
        bio: "British Minecraft streamer with around 3.2M Twitch followers.",
      },
      {
        name: "Mongraal",
        photoUrl: "https://www.thefamouspeople.com/profiles/images/og-mongraal-63797.jpg",
        bio: "English Fortnite streamer and former professional player.",
      },
      {
        name: "Syndicate",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Tom_Cassell_2023.jpg/250px-Tom_Cassell_2023.jpg",
        bio: "British gaming streamer; the first Twitch user to reach 1M followers.",
      },
      {
        name: "Caedrel",
        photoUrl: "https://media.esports.gg/uploads/2024/10/Caedrel-and-Sjokz.jpg",
        bio: "British League of Legends streamer and community caster.",
      },
      {
        name: "Vikkstar123",
        photoUrl: "https://www.dexerto.com/cdn-image/wp-content/uploads/2021/09/02/PewDiePie-jealous-of-Vikkstar-new-mansion.jpg",
        bio: "London-based Sidemen member and gaming streamer.",
      },
      {
        name: "Miniminter",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/31/KSI_and_Miniminter.jpg",
        bio: "Sidemen member and London-based gaming streamer.",
      },
      {
        name: "Zerkaa",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/Zerkaa_2018_%28cropped%29.jpg/250px-Zerkaa_2018_%28cropped%29.jpg",
        bio: "Sidemen co-founder and London-based streamer.",
      },
      {
        name: "Behzinga",
        photoUrl: "https://www.thecityceleb.com/wp-content/uploads/2025/09/behzingagram_1720109726_3404849624008267936_566511898-720x405.webp",
        bio: "Sidemen member streaming games and Just Chatting from London.",
      },
      {
        name: "W2S",
        photoUrl: "https://famecop.com/storage/2021/06/w2s-1024x1024.jpg",
        bio: "Sidemen member and London-based gaming streamer.",
      },
      {
        name: "TBJZL",
        photoUrl: "https://pbs.twimg.com/profile_images/1590644290618892289/oYAR_NzR.jpg",
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
        photoUrl: "https://snobette.com/wp-content/uploads/2023/08/supreme-corteiz-clint-fall-2023-.jpg",
        bio: "Founder of London streetwear label Corteiz.",
      },
      {
        name: "Loz Vassallo",
        photoUrl: "https://pub-35b3ecdefba74bc8ae94d0b4aa9aee67.r2.dev/creator-photos/lozvassallo.jpg",
        bio: "London streetwear creator — ~259k Instagram followers.",
      },
      {
        name: "Charlotte Olivia",
        photoUrl: "https://p16-common-sign.tiktokcdn-us.com/tos-maliva-avt-0068/2ce672d04d9a41125ed8f69d825fc10c~tplv-tiktokx-cropcenter:720:720.jpeg?dr=9640&refresh_token=efe376fc&x-expires=1790452800&x-signature=1JIlIW3g%2BKoizZ4bnLDJRUnuqqw%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=useast5",
        bio: "London fashion creator (@iamcharlotteolivia) — ~404k Instagram followers.",
      },
      {
        name: "MUBI Idriess",
        photoUrl: "https://framerusercontent.com/images/hbd6W7eFWXhffUkRij32ZVOM8I.jpg?width=1129&height=1602",
        bio: "Streetwear creator based across London, Barcelona and Munich — ~363k Instagram followers.",
      },
      {
        name: "ARIOUS MARIO",
        photoUrl: "https://i.pinimg.com/originals/be/af/19/beaf190af4a818f740ff2b041e1eb295.jpg",
        bio: "London streetwear TikTok creator featured as a rising creator on StarScout.",
      },
      {
        name: "Strateraa",
        photoUrl: "https://yt3.ggpht.com/86oAtyvv5HuGG1EpwOGbA4BFpmO5tfk2r_N5xogLJrAC_YfWz2JoJfGDe9WD1BW3efM98BL6rw=s800-c-k-c0x00ffffff-no-rj",
        bio: "London fashion TikToker and vintage streetwear seller.",
      },
      {
        name: "Surfaceldn",
        photoUrl: "https://www.thecityceleb.com/wp-content/uploads/2026/05/17799724867816970759358248158708.jpg",
        bio: "London streetwear TikToker behind the @surfaceldn account.",
      },
      {
        name: "Emily Beaney",
        photoUrl: "https://yt3.ggpht.com/ZPcdk4ZGoKRSZ1tusWOH_I0PWX6MDghLDziES7twkgaizIuVb4a0mcDhDGPfaagJXVvUhUlZew=s800-c-k-c0x00ffffff-no-rj",
        bio: "London streetwear influencer — ~80k Instagram followers.",
      },
      {
        name: "Daniel Darko",
        photoUrl: "https://yt3.ggpht.com/9wDmAZ4uaSKhIJx_pklq0f96xbqPGxcE2_FXbs2Rj78IQNt5neGrk25u4fl1zzo4XVCo3kfwXDg=s800-c-k-c0x00ffffff-no-rj",
        bio: "London streetwear creator — ~81k Instagram followers.",
      },
      {
        name: "Bryan Perera",
        photoUrl: "https://yt3.ggpht.com/CsofGOKbiEiyb_tOhx5E1FJ1pd7OoMLuNo3mXtZcZ_4z1HlJc-GCOC6vjdO2aVS-efBUbLzZ=s800-c-k-c0x00ffffff-no-rj",
        bio: "London streetwear creator — ~98k Instagram followers.",
      },
      {
        name: "Yosef",
        photoUrl: "https://i.pinimg.com/originals/1a/24/8e/1a248e8b3c9951eab10d0cf698338c04.jpg",
        bio: "Streetwear creator based between London and Berlin — ~163k Instagram followers.",
      },
      {
        name: "Neto",
        photoUrl: "https://yt3.ggpht.com/wo7ftWsP9rRjSYyLXYs-3LAkLVDvXWcSgNEJi3dNFkdz1HPzWO8-gBrq3JDScPX80MVnz_yltQ=s800-c-k-c0x00ffffff-no-rj",
        bio: "London streetwear creator — ~155k Instagram followers.",
      },
      {
        name: "Mikey Trapstar",
        photoUrl: "https://media.checkfluence.com/influencers/photos/mikeytrapstar-1725396244-158YNMWHWArJEGqB0XVEinzShbiNku.jpg",
        bio: "London streetwear creator associated with the Trapstar label — ~195k Instagram followers.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-student-performer-london-2026",
    nominees: [
      {
        name: "Flo Wilkes",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/King%27s_College%2C_London_full_achievement.svg/960px-King%27s_College%2C_London_full_achievement.svg.png",
        bio: "King's College London pharmacology student and musician whose band won a 2025 Isle of Wight competition reportedly involving 5,000 competitors; her single \"Henry\" was featured on BBC Radio 1.",
      },
      {
        name: "Neebz",
        photoUrl: "https://musiciansunion.org.uk/MusiciansUnion/media/ProfilePictures/808877/profile_large.jpg",
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
        photoUrl: "https://assets.capitalxtra.com/2020/47/chunkz-7-1606401372-view-1.png",
        bio: "London-based creator and founding member of the Beta Squad collective, known for prank and challenge videos across YouTube and TikTok.",
      },
      {
        name: "Niko Omilana",
        photoUrl: "https://cdn.prod.website-files.com/638912fd82e62a2d54bac436/64dbaf15544f29b1d006a1f6_New-London-Mayoral-polls-have-revealed-that-YouTube-prankster-Niko-Omilana-is-the-highest-ranking-independent-candidate.jpeg",
        bio: "British YouTuber and Beta Squad founder known for viral prank videos; stood in the 2021 London mayoral election, finishing fifth.",
      },
      {
        name: "Sharky",
        bio: "London-based Beta Squad member and YouTuber with around 2M YouTube subscribers, known for challenge and football videos.",
      },
      {
        name: "AJ Shabeel",
        photoUrl: "https://www.thefamouspeople.com/profiles/images/og-aj-shabeel-130343.jpg",
        bio: "British YouTuber and Beta Squad member posting comedy, challenge and lifestyle videos.",
      },
      {
        name: "KingKenny",
        photoUrl: "https://i2-prod.birminghammail.co.uk/incoming/article33877548.ece/ALTERNATES/s615b/0_Kenny.jpg",
        bio: "Beta Squad member, Misfits boxer and Celebrity Traitors series 2 contestant.",
      },
      {
        name: "Darkest Man",
        photoUrl: "https://www.thecityceleb.com/wp-content/uploads/2026/03/17725244221628221120230211446626.webp",
        bio: "London-based comedy creator and Beta Squad affiliate, known for prank and football content.",
      },
      {
        name: "Nella Rose",
        photoUrl: "https://resizer.ladbiblegroup.com/unsafe/rs:fit:640:0:0:0/g:sm/q:70/aHR0cHM6Ly9ldS1pbWFnZXMuY29udGVudHN0YWNrLmNvbS92My9hc3NldHMvYmx0Y2Q3NGFjYzFkMGE5OWYzYS9ibHRjMTc5Y2NhYWExMGY0OGY4LzY1NjcwYTFhY2Y3MmJiMDQwYWM0NGFiNi9uZWxsYS1yb3NlLWZ1dHVyZS5wbmc.webp",
        bio: "London YouTuber and TV presenter with a large TikTok following, known for comedy and lifestyle content.",
      },
      {
        name: "Amelia Dimoldenberg",
        photoUrl: "https://cdn.prod.website-files.com/638912fd82e62a2d54bac436/672f82a7eb79837ff441cbae_AD_4nXd4fw-rIRl0j9VFkDXtLlmrzvt42Q6WmUUumm6-eCvbIyaHDuzn7yTyw3VqYNFkq11idr87BpyDxXHtl12RLatYzziX6J8SYjgSzlMlE-VHGUjRw5xNJje_D22nKBhtzN29E0wCnw.jpeg",
        bio: "Creator and host of the YouTube interview series Chicken Shop Date; hosted SNL UK on Sky in September 2026.",
      },
      {
        name: "GK Barry",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c2/GK_Barry_in_2025.png/960px-GK_Barry_in_2025.png",
        bio: "British TikToker who appeared on I'm a Celebrity...Get Me Out of Here! in 2024 and became a Loose Women panellist.",
      },
      {
        name: "Harry Pinero",
        photoUrl: "https://wallofentertainment.com/wp-content/uploads/2024/09/harry_pinero-min.jpg",
        bio: "Peckham-born YouTuber, TikToker and presenter known for comedic street-interview content.",
      },
      {
        name: "Italian Bach",
        photoUrl: "https://yt3.ggpht.com/MrZ3VlQt-yPLenxZihhBfA_0ogen0VScpdAmDPKcI54_-xrV_WH8gD0czb_-jN3jF_sCdV809ZNaYA=s800-c-fcrop64=1,00002000ffffdfff-nd-v1",
        bio: "British comedy TikToker with around 2.4M followers and 222M likes, known for short comedy sketches.",
      },
      {
        name: "Munya Chawawa",
        photoUrl: "https://thetopsecretcomedyclub.co.uk/wp-content/uploads/2023/05/Munya-Chawawa-Comedian.jpeg",
        bio: "British-Zimbabwean comedian known for satirical sketch characters and viral parody videos.",
      },
      {
        name: "Calfreezy",
        bio: "London-based YouTuber and Fellas Studios co-founder posting comedy and lifestyle content on TikTok and YouTube.",
      },
      {
        name: "Theo Baker",
        photoUrl: "https://cdn.socialpruf.com/tiktok/thumbnails/7629388003349105922?optimizer=image&width=512",
        bio: "London-based creator and Fellas Studios member known for comedy and football videos.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-tv-presenter-london-2026",
    nominees: [
      {
        name: "Claudia Winkleman",
        photoUrl: "https://www.thespiritsbusiness.com/content/uploads/2024/07/Claudia-Winkleman-SB-Awards.jpg",
        bio: "Hosted Strictly Come Dancing and presents The Traitors.",
      },
      {
        name: "AJ Odudu",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c2/AJ_Odudu_at_BAFTAs_2026_02.jpg",
        bio: "Hosts Big Brother UK alongside Will Best.",
      },
      {
        name: "Will Best",
        photoUrl: "http://cdn.thetab.com/wp-content/uploads/2023/10/25133401/unnamed-177.jpg",
        bio: "Hosts Big Brother UK alongside AJ Odudu.",
      },
      {
        name: "Alison Hammond",
        photoUrl: "https://images.bauerhosting.com/celebrity/sites/4/2025/03/alison-hammond-scaled.jpg?auto=format&w=1440&q=80",
        bio: "Hosts This Morning, the Great British Bake Off and For the Love of Dogs.",
      },
      {
        name: "Rylan Clark",
        photoUrl: "https://i2-prod.ok.co.uk/article14535490.ece/ALTERNATES/s1200e/1039531_Rylan_GBBO_3cd513d2d4b9b425c23e7cba54725ce3",
        bio: "TV presenter featured in a UK's favourite TV presenters ranking.",
      },
      {
        name: "Stacey Solomon",
        photoUrl: "https://www.arenaentertainments.co.uk/wp-content/uploads/2017/07/Stacey-Solomon-3.jpg",
        bio: "TV presenter featured in a UK's favourite TV presenters ranking.",
      },
      {
        name: "Ant McPartlin",
        photoUrl: "https://www.antanddec.com/uploads/images/_twoThirdsFixed/BGT.jpg?v=1776874632",
        bio: "One half of the Ant & Dec presenting duo, featured in a UK's favourite TV presenters ranking.",
      },
      {
        name: "Declan Donnelly",
        photoUrl: "https://www.antanddec.com/uploads/images/_twoThirdsFixed/BGT.jpg?v=1776874632",
        bio: "One half of the Ant & Dec presenting duo, featured in a UK's favourite TV presenters ranking.",
      },
      {
        name: "Holly Willoughby",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Holly_Willoughby_%282013%29_%28cropped%29.jpg/250px-Holly_Willoughby_%282013%29_%28cropped%29.jpg",
        bio: "TV presenter featured in a UK's favourite TV presenters ranking.",
      },
      {
        name: "Amanda Holden",
        photoUrl: "https://i2-prod.ok.co.uk/incoming/article14666248.ece/ALTERNATES/s615b/609526_1416308523_Amanda-Holden-back-on-Britains-Got-Talent-2015-with-Simon-Cowell_778a7b3c75def7dca5de10115f47cb88",
        bio: "TV presenter featured in a UK's favourite TV presenters ranking.",
      },
      {
        name: "Dermot O'Leary",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Dermot_Oleary_by_Walterlan_Papetti.jpg/960px-Dermot_Oleary_by_Walterlan_Papetti.jpg",
        bio: "This Morning presenter featured in an ITV viewer poll.",
      },
      {
        name: "Cat Deeley",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/24/Cat_Deeley_2011.jpg",
        bio: "This Morning presenter featured in an ITV viewer poll.",
      },
      {
        name: "Lorraine Kelly",
        photoUrl: "https://media.glide.mailplus.co.uk/prod/images/gm_preview/976f6cd0aa73-lorraine-kelly.jpg",
        bio: "TV presenter featured in a UK's favourite TV presenters ranking.",
      },
      {
        name: "Ruth Langsford",
        photoUrl: "https://cdn.mos.cms.futurecdn.net/8kCNCtqLfDrrnvMUuUiyiN-2560-80.jpg",
        bio: "TV presenter featured in a UK's favourite TV presenters ranking.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-uk-rapper-london-2026",
    nominees: [
      {
        name: "Bashy",
        photoUrl: "https://www.nme.com/wp-content/uploads/2024/07/bashy-Dennis-Morris.jpg",
        bio: "Nominated for Best Hip Hop Act at the 2025 MOBO Awards.",
      },
      {
        name: "Cristale",
        photoUrl: "https://www.nme.com/wp-content/uploads/2024/01/cristale-artist-2.jpg",
        bio: "Nominated for Best Hip Hop Act at the 2025 MOBO Awards.",
      },
      {
        name: "Headie One",
        photoUrl: "https://www.nme.com/wp-content/uploads/2019/04/Headie-One-Pic-3.jpg",
        bio: "'Edna' was the first UK drill album to reach No.1 on the UK Albums Chart. He was nominated for Best Hip Hop Act at the 2025 MOBOs.",
      },
      {
        name: "Nines",
        photoUrl: "https://www.nme.com/wp-content/uploads/2021/10/nines-2000x1270-1.jpg",
        bio: "Won Album of the Year and Best Hip Hop Act at the 2020 MOBO Awards for 'Crabs in a Bucket'; nominated for Best Hip Hop Act again in 2025.",
      },
      {
        name: "Potter Payper",
        photoUrl: "https://www.antonioolmos.com/img-get/I00003I1PeICFDGg/s/1200/I00003I1PeICFDGg.jpg",
        bio: "Won MOBO Album of the Year for his debut 'Real Back In Style', which entered the UK Albums Chart at No.2. Nominated for Best Hip Hop Act at the 2025 MOBOs.",
      },
      {
        name: "Skrapz",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b6/Skrapz_%282014%29.png",
        bio: "Nominated for Best Hip Hop Act at the 2025 MOBO Awards.",
      },
      {
        name: "Central Cee",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Central_cee-5.jpg/960px-Central_cee-5.jpg",
        bio: "His album 'Can't Rush Greatness' became his second UK No.1 album and reached No.9 on the Billboard 200.",
      },
      {
        name: "Dave",
        photoUrl: "https://imgs.capitalxtra.com/images/77530?crop=16_9&width=660&relax=1&format=webp&signature=pTvyz29Y0vB_rBjGbIUE0f_56CY=",
        bio: "His first two albums both went platinum and topped the UK Albums Chart; his debut 'Psychodrama' won the Mercury Prize.",
      },
      {
        name: "Ghetts",
        photoUrl: "https://www.nme.com/wp-content/uploads/2021/02/Ghetts-NME.jpg",
        bio: "His 2021 album 'Conflict of Interest' reached No.2 on the UK Albums Chart. He was shortlisted for Best Grime Act at the 2020 MOBO Awards.",
      },
      {
        name: "Little Simz",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Little_Simz_-_Openair_Frauenfeld_2019_05.jpg/1280px-Little_Simz_-_Openair_Frauenfeld_2019_05.jpg",
        bio: "'Sometimes I Might Be Introvert' won the Mercury Prize; her album 'Lotus' was released on 6 June 2025.",
      },
      {
        name: "Stormzy",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Stormzy_-_Openair_Frauenfeld_2019_02.jpg/1280px-Stormzy_-_Openair_Frauenfeld_2019_02.jpg",
        bio: "His debut album 'Gang Signs & Prayer' hit No.1 in the UK and won the BRIT Award for Album of the Year.",
      },
      {
        name: "AJ Tracey",
        photoUrl: "https://www.nme.com/wp-content/uploads/2019/02/AJ-Quote-3.jpg",
        bio: "His album 'Flu Game' reached No.2 in the UK and earned a BRIT nomination.",
      },
      {
        name: "J Hus",
        photoUrl: "https://www.nme.com/wp-content/uploads/2018/01/JHUS_OROSE_BLACKWHITE_29_85121122_193558141.jpg",
        bio: "His album 'Big Conspiracy' debuted at No.1 on the UK Albums Chart.",
      },
      {
        name: "Knucks",
        photoUrl: "https://d2ljoqkkoec4f6.cloudfront.net/wp-content/uploads/2022/07/14132945/Knucks_1.jpg",
        bio: "His album 'Alpha Place' debuted at No.3 in the UK and shared the MOBO Album of the Year prize; his second album 'A Fine African Man' was released on 31 October 2025.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-underground-radio-dj-london-2026",
    nominees: [
      {
        name: "Oneman",
        photoUrl: "https://image.rinse.fm/_/oneman.jpg?w=2400&h=1167",
        bio: "Streatham DJ with a long-running Rinse FM presence who has mixed entries in the Fabriclive and Rinse series.",
      },
      {
        name: "Plastician",
        photoUrl: "https://i.discogs.com/PKxWWlHVyNrATAsIV2KrhAuNAA0DUJxYEtwRrjedCkA/rs:fit/g:sm/q:90/h:320/w:480/czM6Ly9kaXNjb2dz/LWRhdGFiYXNlLWlt/YWdlcy9BLTUyOTkw/Ni0xMzQ5NzA4OTQ1/LTQ3MDMuanBlZw.jpeg",
        bio: "South London bass and grime DJ with FWD>> and Rinse FM residency history.",
      },
      {
        name: "Riria",
        photoUrl: "https://image.rinse.fm/_/IMG_7418-2-R-F.JPG?w=600&h=600",
        bio: "Tokyo-born, London-based DJ with a Rinse FM residency from 2025, mixing amapiano with UK garage and global bass.",
      },
      {
        name: "I. JORDAN",
        photoUrl: "https://image.rinse.fm/_/I.-JORDAN-November-2024.jpeg?w=1200&h=630",
        bio: "DJ and producer named among the 140 new resident DJs joining Rinse FM.",
      },
      {
        name: "Jossy Mitsu",
        photoUrl: "https://static.ra.co/images/profiles/square/jossymitsu.jpg?dateUpdated=1539110961807",
        bio: "Birmingham-raised, London-based DJ, Rinse FM resident and 6 Figure Gang member.",
      },
      {
        name: "Tash LC",
        photoUrl: "https://djmag.com/sites/default/files/styles/djm_23_1005x565/public/article/image/Tash%20LC.jpg.webp?itok=sPOJIsgQ",
        bio: "London-based DJ and NTS resident blending Afro-jazz, highlife, kuduro, gqom and dancehall.",
      },
      {
        name: "Moxie",
        photoUrl: "https://static.ra.co/images/profiles/square/moxie.jpg?dateUpdated=1710929757000",
        bio: "London-based DJ and NTS broadcaster with a long-running Wednesday residency.",
      },
      {
        name: "Ben UFO",
        photoUrl: "https://cdn.sanity.io/images/pge26oqu/production/3d4daf288fd7efc23c9ba2e2c6098f8eda0aca8f-318x318.jpg?bg=000000&w=1200&h=630&fit=fill",
        bio: "DJ and Hessle Audio co-founder spotlighted in Rinse FM's Class of 2024.",
      },
      {
        name: "Fabio & Grooverider",
        photoUrl: "https://imgproxy.ra.co/_/quality:66/aHR0cHM6Ly9pbWFnZXMucmEuY28vMWY4OWM3MjRjNTM3NmQ3MTM2OGIzNjVlYmMxZWM3N2Q3NzhhYzRlNi5qcGc=",
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
        photoUrl: "https://static.ra.co/images/profiles/square/skeptical.jpg?dateUpdated=1527636064927",
        bio: "Drum & bass DJ and producer spotlighted in Rinse FM's Class of 2024.",
      },
      {
        name: "Skeen LDN",
        bio: "Brings grime to Reprezent, the youth-led London station, every second Friday of the month.",
      },
      {
        name: "MIDRIB",
        photoUrl: "https://www.reprezent.org.uk/_next/image?url=https%3A%2F%2Femvrqvgxkhiwxafqslqp.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fmedia%2Fimages%2Fcrops%2FMIDRIB_1_desktop_1756277737546.webp&w=384&q=75",
        bio: "Presents two hours of dubstep, techno, breakbeat and experimental dance music on Reprezent.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-vintage-seller-london-2026",
    nominees: [
      {
        name: "Beyond Retro",
        photoUrl: "https://www.theindustry.fashion/wp-content/uploads/2021/10/Beyond-Retro-Store-Sign-1024x1022.png",
        bio: "Large vintage clothing shop on Brick Lane, east London.",
      },
      {
        name: "Rokit",
        photoUrl: "https://www.rokit.co.uk/cdn/shop/files/rokit-logo.png?v=1633950568",
        bio: "Vintage clothing shop on Brick Lane known for second-hand and retro fashion.",
      },
      {
        name: "Absolute Vintage",
        photoUrl: "https://media.triple.guide/triple-cms/c_limit,f_auto,h_1024,w_1024/975fe08b-e890-4528-8a64-3934518d88d1.jpeg",
        bio: "Brick Lane vintage shop selling second-hand clothing.",
      },
      {
        name: "Nordic Poetry",
        photoUrl: "https://loti.b-cdn.net/wp-content/uploads/2022/03/nordic-poetry.png",
        bio: "High-end vintage boutique just off Brick Lane on Bethnal Green Road.",
      },
      {
        name: "St Cyr Vintage",
        photoUrl: "https://walnutlatte.com/wp-content/uploads/IMG_6814-768x1024.jpeg",
        bio: "Camden vintage shop known for one-off quality pieces.",
      },
      {
        name: "East End Thrift Store",
        bio: "Affordable vintage clothing store in the Docklands.",
      },
      {
        name: "Greenwich Vintage Market",
        photoUrl: "https://dynamic-media-cdn.tripadvisor.com/media/photo-o/0c/e5/45/33/the-greenwich-vintage.jpg?w=1200&h=1200&s=1",
        bio: "Vintage market in Greenwich selling jewellery, homeware and clothing.",
      },
      {
        name: "Reign Vintage",
        photoUrl: "https://i0.wp.com/reignvintage.com/wp-content/uploads/2021/02/ReignVintage.jpg?fit=800%2C608&ssl=1",
        bio: "Vintage clothing shop in Soho, central London.",
      },
      {
        name: "House of Vintage",
        bio: "East London vintage clothing shop.",
      },
      {
        name: "Serotonin",
        photoUrl: "https://bsmnt.s3.eu-west-2.amazonaws.com/bsmnt/wp-content/uploads/2022/02/sero_webland-1024x682.jpg",
        bio: "East London vintage clothing shop.",
      },
      {
        name: "Hunky Dory",
        photoUrl: "https://tripsteri.fi/wp-content/uploads/2016/12/cropped-cropped-cropped-hunkydoryvintage1.jpg",
        bio: "East London vintage clothing store.",
      },
      {
        name: "Paper Dress Vintage",
        photoUrl: "https://paperdressvintage.co.uk/wp-content/uploads/2021/04/84a5f205-3bdf-4f0f-b260-e7d647c612df-600x600.jpg",
        bio: "East London vintage shop.",
      },
      {
        name: "Mero Retro",
        photoUrl: "https://cdn.shopify.com/s/files/1/0107/2422/files/Window-Spring2017_window4.jpg?v=1493922537",
        bio: "East London vintage clothing shop.",
      },
      {
        name: "Atika London",
        photoUrl: "https://p16-common-sign.tiktokcdn-us.com/tos-maliva-avt-0068/7321299944432730118~tplv-tiktokx-cropcenter:720:720.jpeg?dr=9640&refresh_token=ebeadb89&x-expires=1790452800&x-signature=JzAB6z7ObKapHcVrNdEdi6MGzN8%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=useast5",
        bio: "London vintage clothing shop with strong visitor reviews.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-womens-football-creator-london-2026",
    nominees: [
      {
        name: "Alisha Lehmann",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0e/Lewes_FC_Women_0_West_Ham_Utd_Women_5_pre_season_12_08_2018-614_%2829081676397%29_%28cropped%29.jpg",
        bio: "Swiss international forward; the most-followed women's footballer in the world on social media.",
      },
      {
        name: "Mary Earps",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c5/Mary_Earps_Man_Utd.jpg",
        bio: "England goalkeeper with a large TikTok following built on dance trends and challenges with Lionesses teammates.",
      },
      {
        name: "Beth Mead",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f7/Eng_Women_0_Czech_Rep_0_11_10_2022-225_%2852426070932%29_%28cropped%29.jpg",
        bio: "Arsenal and England forward; popular TikTok creator featuring her club and international teammates.",
      },
      {
        name: "Jen Beattie",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/01/Jennifer_Beattie_2020.jpg",
        bio: "Former Arsenal defender; TikTok creator posting clips from her life as a professional footballer.",
      },
      {
        name: "Chloe Kelly",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/96/On_29.07.England_Lionesses_Bus_Celebration_-_The_Mall%2C_Lond2025_11_%28cropped-J1%29.jpg",
        bio: "England winger with 1.5M Instagram followers.",
      },
      {
        name: "Alessia Russo",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/8a/Valerenga-Arsenal_WUCL_12-12-2024_CG3A4421_05_%28cropped-J1%29.jpg",
        bio: "England striker with 1.1M Instagram followers.",
      },
      {
        name: "Liv Cooke",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/30/Liv_Cooke_wikipedia_photo_September_2022.jpg",
        bio: "British freestyle world champion and football content creator; Football Foundation ambassador.",
      },
      {
        name: "Alex Scott",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/4a/Alex_Scott_BBC_Sport_01_06_2019_%28cropped%29.jpg",
        bio: "140-cap former England international; BBC Football Focus presenter and pundit since retiring in 2018.",
      },
      {
        name: "Laura Woods",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/62/Laura_Woods_%28English_presenter%29_2022_%28sq_cropped%29.jpg",
        bio: "Presenter who led ITV's coverage of the 2023 Women's World Cup.",
      },
      {
        name: "Gabby Logan",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/63/Gabby_Logan_outside_LEEDS_2023_offices_at_Brewery_Place_%28cropped%29.jpg",
        bio: "Lead anchor of the BBC's football coverage for nearly two decades, including major women's tournaments.",
      },
      {
        name: "Reshmin Chowdhury",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d6/James_Collins%2C_Reshmin_Chowdhury_and_Chris_Coleman_04032026_%282%29.jpg",
        bio: "BBC and talkSPORT football presenter; presented The Women's Football Show and live WSL matches.",
      },
      {
        name: "Kelly Smith",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/9a/Arsenal_LFC_v_Kelly_Smith_All-Stars_XI_%28038%29_%28cropped%29.jpg",
        bio: "Former England striker; BBC pundit and Soccer Aid participant.",
      },
      {
        name: "Fara Williams",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/25/Lewes_FC_Women_2_Southampton_Women_2_28_08_2022-109_%2852318350759%29_%28cropped%29.jpg",
        bio: "England's record appearance holder; now a pundit and Soccer Aid participant.",
      },
      {
        name: "Izzy Christiansen",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/23/20171004_UWCL_SKN-MCW_StPoelten_850_1183.jpg",
        bio: "Former England midfielder; BBC pundit on women's football coverage.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-x-personality-london-2026",
    nominees: [
      {
        name: "Piers Morgan",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/89/Piers_Morgan_at_2026_SXSW_London_05_%28cropped%29.jpg",
        bio: "Broadcaster with around 9M followers on X.",
      },
      {
        name: "Gary Lineker",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7b/Gary_Lineker_2011.jpg",
        bio: "Sports broadcaster with around 9M followers on X.",
      },
      {
        name: "James O'Brien",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1c/James_O%E2%80%99Brien_%2853996110046%29_%28cropped%29.jpg",
        bio: "LBC radio host and commentator.",
      },
      {
        name: "Carol Vorderman",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/38/Carol_Vorderman_%28cropped%29.png",
        bio: "Broadcaster and campaigner.",
      },
      {
        name: "Alastair Campbell",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7e/Alastair_Campbell_at_the_2024_Edinburgh_International_Book_Festival_%28cropped%29.jpg",
        bio: "Broadcaster and author.",
      },
      {
        name: "Owen Jones",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a0/Owen_Jones_April_2024.jpg",
        bio: "Columnist and commentator.",
      },
      {
        name: "Ash Sarkar",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b1/Ash_Sarkar_13.6.2026_%28cropped%29.jpg",
        bio: "Novara Media journalist and commentator.",
      },
      {
        name: "David Baddiel",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/99/David_Baddiel_at_the_2025_Edinburgh_International_Book_Festival-02_%28cropped%29.jpg",
        bio: "Comedian and writer; self-described Twitter addict with around 800K followers.",
      },
      {
        name: "Marina Hyde",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/18/Marina_Hyde_at_the_British_Library.jpg",
        bio: "Guardian columnist and co-host of The Rest Is Entertainment podcast.",
      },
      {
        name: "Emily Maitlis",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/de/Emily_Maitlis_Reporting_from_Leadership_Debate_Bristol_2010.jpg",
        bio: "Broadcaster and former Newsnight presenter.",
      },
      {
        name: "Lewis Goodall",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/aa/Lewis_Goodall_2026.jpg",
        bio: "Broadcaster and journalist.",
      },
      {
        name: "Ian Dunt",
        bio: "Columnist and political commentator.",
      },
      {
        name: "Nigel Farage",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Official_portrait_of_Nigel_Farage_MP_%283x4_cropped%29.jpg",
        bio: "MP and Reform UK leader with around 2.3M X followers.",
      },
      {
        name: "Dan Neidle",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/9e/Dan_Neidle_jpg.jpg",
        bio: "Tax expert and prominent online commentator.",
      },
    ],
  },
  {
    rankingSlug: "most-popular-youtube-creator-london-2026",
    nominees: [
      {
        name: "KSI",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/be/KSI_in_2024_%282%29.png",
        bio: "London-born YouTuber with around 24.8M subscribers; also a boxer and co-founder of Prime.",
      },
      {
        name: "Miniminter",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/eb/Miniminter_in_June_2024_at_Soccer_Aid_2024_charity_match.png",
        bio: "London-based Sidemen member; his channels cover FIFA, real-life and challenge videos.",
      },
      {
        name: "Zerkaa",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/4/48/Zerkaa_2018.jpg",
        bio: "Sidemen co-founder from London; posts reaction, gaming and challenge videos.",
      },
      {
        name: "TBJZL",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/bb/TBJZL_2025.jpg",
        bio: "London-based Sidemen member known for football, challenge and lifestyle videos.",
      },
      {
        name: "Behzinga",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/fa/Ethan_Payne_in_2023.png",
        bio: "Sidemen member from London; known for challenge videos and fitness content.",
      },
      {
        name: "Vikkstar123",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a2/Vikkstar123_2022_%28cropped%29.jpg",
        bio: "Sidemen member known for Minecraft and gaming videos.",
      },
      {
        name: "W2S",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ec/W2S_blue_jumper.jpg",
        bio: "Sidemen member known for FIFA and challenge videos.",
      },
      {
        name: "Chunkz",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/81/Chunkz_in_2021.png",
        bio: "Founding member of the Beta Squad; London-based creator known for prank and challenge videos.",
      },
      {
        name: "Niko Omilana",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/3c/Niko_Omilana_in_2023.png",
        bio: "Beta Squad founder; viral prank YouTuber who finished fifth in the 2021 London mayoral election.",
      },
      {
        name: "Sharky",
        photoUrl: "https://pbs.twimg.com/profile_images/2042275500286976005/tPKFwfMr_400x400.jpg",
        bio: "Beta Squad member with around 2M YouTube subscribers; posts challenge and football videos.",
      },
      {
        name: "AJ Shabeel",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/dd/Aj_Shabeel_in_2024.jpg",
        bio: "Beta Squad member; British YouTuber posting comedy and challenge videos.",
      },
      {
        name: "KingKenny",
        photoUrl: "https://yt3.googleusercontent.com/ytc/AIdro_k1w7-5xnNJLotZUWfI-JfRjRVzD3gQFitPTlr1cCsmgg=s900-c-k-c0x00ffffff-no-rj",
        bio: "Beta Squad member and Misfits boxer; appeared on Celebrity Traitors series 2.",
      },
      {
        name: "Amelia Dimoldenberg",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/2/23/Amelia_Dimoldenberg-08902.jpg",
        bio: "Creator and host of Chicken Shop Date; hosted SNL UK on Sky in September 2026.",
      },
      {
        name: "Nella Rose",
        photoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f7/Nella_Rose_2021.jpg",
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
