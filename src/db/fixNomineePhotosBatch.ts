import { db } from "./client";

// One-time photo backfill for empty nominee photos + bad-chain replacements
// (2026-09-28). Two research waves:
//  wave 1: 5 batches covering 213 names; every hotlinked URL preflighted with
//          Referer: https://rephear.com/ (2xx + image/*).
//  wave 2: official social-media photos, DOWNLOADED and self-hosted under
//          /images/nominees/ (never hotlink expiring IG/TikTok CDNs).
//
// Safety:
// - FILLS only touch rows whose photo_url IS NULL (never overwrites).
// - REPLACES only touch rows whose photo_url still equals the known-bad URL.
// - CLEARS only touch rows whose photo_url still equals the known-wrong URL.
// A photo a nominee, owner, or admin deliberately set is never overwritten.
// Idempotent: re-running is a no-op once applied.

type Fill = { rankingSlug: string; name: string; photoUrl: string };
const FILLS: Fill[] = [
  { rankingSlug: "most-popular-uk-garage-dj-london-2026", name: "Wookie",
    photoUrl: "https://i.ytimg.com/vi/bV1NHltTlLA/hqdefault.jpg" }, // batch
  { rankingSlug: "most-popular-uk-garage-dj-london-2026", name: "Oppidan",
    photoUrl: "https://i.ytimg.com/vi_webp/IxNXZLkmuQw/maxresdefault.webp" }, // batch
  { rankingSlug: "most-popular-jungle-dj-london-2026", name: "Dillinja",
    photoUrl: "https://lastfm.freetls.fastly.net/i/u/ar0/3c6a219fa3fe2c0cd52e403a4b5687c3.png" }, // batch
  { rankingSlug: "most-popular-jungle-dj-london-2026", name: "Dead Man's Chest",
    photoUrl: "https://i.scdn.co/image/ab67616d0000b273b82a3d40490ef1b79eba64a1" }, // batch
  { rankingSlug: "most-popular-jungle-dj-london-2026", name: "Mantra",
    photoUrl: "https://rupturelondon.com/wp-content/uploads/mantra-rupture-london.jpg" }, // batch
  { rankingSlug: "best-underground-party-london-2026", name: "Garage Nation",
    photoUrl: "https://s1.ticketm.net/dam/a/14b/75adcd6e-bcd9-40b8-a410-bd3e53b8914b_SOURCE?auto=webp" }, // batch
  { rankingSlug: "best-underground-party-london-2026", name: "Clockwork Orange",
    photoUrl: "https://d31fr2pwly4c4s.cloudfront.net/4/5/5/2239289_13762269_Clockwork-Orange---Studio-338---London_400.jpg" }, // batch
  { rankingSlug: "best-underground-party-london-2026", name: "Glitterbox",
    photoUrl: "https://earmilk.com/wp-content/uploads/2018/03/glitterboxjpg-800x380.jpg" }, // copy
  { rankingSlug: "most-popular-nightlife-promoter-london-2026", name: "Glitterbox",
    photoUrl: "https://earmilk.com/wp-content/uploads/2018/03/glitterboxjpg-800x380.jpg" }, // copy
  { rankingSlug: "best-underground-party-london-2026", name: "Central",
    photoUrl: "https://ticketswap-image-cdn.b-cdn.net/public/202606/central-youandewan-b2b-liquid-earth-laurine-ron-obvious-village-underground-25-september-2026-1780920638.image.jpeg?width=750&height=420&format=webp&aspect_ratio=16%3A9" }, // batch
  { rankingSlug: "hottest-upcoming-rapper-london-2026", name: "YT",
    photoUrl: "https://images-prod.dazeddigital.com/1200/0-93-2400-1600/azure/dazed-prod/1430/4/1434146.jpg" }, // batch
  { rankingSlug: "most-popular-grime-mc-london-2026", name: "Ghetts",
    photoUrl: "https://www.nme.com/wp-content/uploads/2021/02/Ghetts-NME.jpg" }, // copy
  { rankingSlug: "best-freestyle-rapper-london-2026", name: "kwes e",
    photoUrl: "https://i.ytimg.com/vi/OynPlM2Z3nU/maxresdefault.jpg" }, // batch
  { rankingSlug: "best-freestyle-rapper-london-2026", name: "Kirbs",
    photoUrl: "https://viberate-upload.ams3.cdn.digitaloceanspaces.com/prod/entity/artist/kirbs-1-KFCgz" }, // batch
  { rankingSlug: "best-freestyle-rapper-london-2026", name: "Natanya",
    photoUrl: "https://exepose.com/wp-content/uploads/2025/12/NATANYA1420-copy-480x600.jpg" }, // batch
  { rankingSlug: "best-freestyle-rapper-london-2026", name: "maZz",
    photoUrl: "https://i.ytimg.com/vi/LOyik-73l7Y/maxresdefault.jpg" }, // batch
  { rankingSlug: "best-rookie-cosplayer-london-2026", name: "Maria Jodicke",
    photoUrl: "https://images.immediate.co.uk/production/volatile/sites/3/2025/10/dalek-pyramid-head-hellraiser-cosplayers-140c09f.jpg" }, // copy
  { rankingSlug: "best-caribbean-takeaway-london-2026", name: "Flavour Boss",
    photoUrl: "https://tb-static.uber.com/prod/image-proc/processed_images/c8d9d479bebc43bc8706961476c44696/3ac2b39ad528f8c8c5dc77c59abb683d.jpeg" }, // batch
  { rankingSlug: "best-caribbean-takeaway-london-2026", name: "Jerkiz",
    photoUrl: "https://images.squarespace-cdn.com/content/v1/5734f3ff4d088e2c5b08fe13/1534794098775-D8REM11HPKWO33Q973GR/jerkiz.png?format=1500w" }, // batch
  { rankingSlug: "best-caribbean-takeaway-london-2026", name: "Gabby's Caribbean Takeaway",
    photoUrl: "https://menu.reviews/media/images/deliveroo/gabbys-caribbean-peckham.jpg" }, // batch
  { rankingSlug: "biggest-sound-london-2026", name: "Channel One Sound System",
    photoUrl: "https://channelonesoundsystem.com/wp-content/uploads/bb-plugin/cache/Channel-One-Soundsystem-panorama-d9b5e8bbe2186886833d914a7d4382d6-09c61ba7khsn.jpg" }, // copy
  { rankingSlug: "biggest-sound-london-2026", name: "King Tubby's Sound System",
    photoUrl: "https://nhcarnival.org/wp-content/uploads/2023/07/KingTubby.png" }, // copy
  { rankingSlug: "biggest-sound-london-2026", name: "Rampage Sound",
    photoUrl: "https://i.guim.co.uk/img/media/a0a0529cafdc1d4837f3d14ef353b01812ba3820/0_0_5842_7303/master/5842.jpg?width=1200&dpr=1&s=none" }, // copy
  { rankingSlug: "biggest-sound-london-2026", name: "Solution Sound System",
    photoUrl: "https://nhcarnival.org/wp-content/uploads/2023/07/solution_sound_system_logo_2019-scaled.jpg" }, // copy
  { rankingSlug: "best-cosplay-performance-london-2026", name: "Lady Honey Designs — Fabric Grandmaster winning performance at the C3 Cosplay City Championship final 2024",
    photoUrl: "https://images.squarespace-cdn.com/content/v1/6761c8be198616670b503125/1734461692284-EVFSOS39OUC9QMOPK9ZS/Lady+Honey+Designs+C3+Fabric+Grandmasters+-+ACME+Comic+Con+Scotland+Autumn+28th+29th+September+2024++Glasgow+Scottish+Events+Campus+Hall+3+%26+4.jpg" }, // batch
  { rankingSlug: "best-cosplay-performance-london-2026", name: "Axios Cosplay — Forge Grandmaster winning performance at the C3 Cosplay City Championship final 2024",
    photoUrl: "https://images.squarespace-cdn.com/content/v1/6761c8be198616670b503125/1734461692288-V0AKPG4UH9OTMILID1HD/Axios+Cosplay+C3+Forge+Grandmasters+-+ACME+Comic+Con+Scotland+Autumn+28th+29th+September+2024++Glasgow+Scottish+Events+Campus+Hall+3+%26+4.jpg" }, // batch
  { rankingSlug: "best-fried-chicken-shop-london-2026", name: "Eden's Cottage",
    photoUrl: "https://dineawardslondon.com/images/p400/edens-cottage-image.jpg" }, // batch
  { rankingSlug: "best-full-english-london-2026", name: "Sketch",
    photoUrl: "https://www.luxuryrestaurantguide.com/app/uploads/2020/07/partner-logo-sketch.png" }, // batch
  { rankingSlug: "best-full-english-london-2026", name: "The Wolseley",
    photoUrl: "https://s3-media0.fl.yelpcdn.com/bphoto/XpgT7fYXNo145BCC5nAqpg/348s.jpg" }, // batch
  { rankingSlug: "best-full-english-london-2026", name: "Heart of Balham",
    photoUrl: "https://lh5.googleusercontent.com/p/AF1QipMRVHq-paZ7qs4ZzrDt2CbZ2FVAG-Jzjacmyiv_=w370-h369-k-no" }, // batch
  { rankingSlug: "best-jollof-london-2026", name: "Gold Coast Bar & Restaurant",
    photoUrl: "https://rs-menus-api.roocdn.com/images/3a08d218-5a5a-46ec-87c4-3af0f41aeaaf/image.jpeg?width=1200&height=630&fit=crop" }, // batch
  { rankingSlug: "best-jollof-london-2026", name: "Asafo Ghanaian Restaurant",
    photoUrl: "https://rs-menus-api.roocdn.com/images/6629f40c-7900-40af-a492-cb726fb445fe/image.jpeg?width=1200&height=630&fit=crop" }, // batch
  { rankingSlug: "best-jollof-london-2026", name: "The Grills and Jollof",
    photoUrl: "https://flipdish-web.imgix.net/br11574/23030da15570caa3349fca64fe2bd522.jpg?w=570" }, // batch
  { rankingSlug: "best-jollof-london-2026", name: "Teju's Street Food",
    photoUrl: "https://cdn.placejoys.com/70119-oy-photo-1.jpg" }, // batch
  { rankingSlug: "best-late-night-kebab-london-2026", name: "Gökyüzü",
    photoUrl: "https://homegirllondon.wpenginepowered.com/wp-content/uploads/2017/03/gokyuzu-turkish-restaurant-exterior.jpg" }, // batch
  { rankingSlug: "best-late-night-kebab-london-2026", name: "Ranoush Juice",
    photoUrl: "https://www.maroush.com/wp-content/uploads/2024/07/MR609-099-scaled.jpg" }, // batch
  { rankingSlug: "best-late-night-kebab-london-2026", name: "Cafe Helen",
    photoUrl: "https://loti.b-cdn.net/wp-content/uploads/2023/09/cafe-helen.jpg" }, // batch
  { rankingSlug: "best-late-night-kebab-london-2026", name: "Shawarma Bros",
    photoUrl: "https://rs-menus-api.roocdn.com/images/b282f309-3587-47c8-b0f5-1dd99340421f/image.jpeg?width=1200&height=630&fit=crop" }, // batch
  { rankingSlug: "best-late-night-kebab-london-2026", name: "Brick Lane Kebab",
    photoUrl: "https://assets.raconteur.net/uploads/2017/06/Brick-Lane-Kebab-900x574.jpg" }, // batch
  { rankingSlug: "best-late-night-kebab-london-2026", name: "Capital Kebab House",
    photoUrl: "https://cdn.localoria.com/107203-llphoto-1.jpg" }, // batch
  { rankingSlug: "best-late-night-kebab-london-2026", name: "Kebhouze",
    photoUrl: "https://www.foodserviceequipmentjournal.com/cloud/2024/05/29/1.-Kebhouze-external-shot.jpg" }, // batch
  { rankingSlug: "best-late-night-kebab-london-2026", name: "The Best Turkish Kebab",
    photoUrl: "https://tb-static.uber.com/prod/image-proc/processed_images/f4239c5d6dabbf0622632394c360a3a2/70aa2a4db7f990373ca9c376323e3dea.jpeg" }, // batch
  { rankingSlug: "best-late-night-kebab-london-2026", name: "King's Kebab House",
    photoUrl: "https://www.seethesmoke.com/assets/img/listings/kings-mediterranean-c.webp" }, // batch
  { rankingSlug: "best-new-rap-track-london-2026", name: "History — Dave feat. James Blake",
    photoUrl: "https://thenotesphere.com/wp-content/uploads/2025/10/G4Hlq5DW8AAoMyk.jpg" }, // batch
  { rankingSlug: "best-rap-crew-london-2026", name: "Boy Better Know",
    photoUrl: "https://overstandard.dk/wp-content/uploads/2025/08/9-822x1024.jpeg" }, // batch
  { rankingSlug: "best-rap-crew-london-2026", name: "More Fire Crew",
    photoUrl: "https://umcmanagement.co.uk/wp-content/uploads/2024/06/MFC-Stairs.jpg" }, // batch
  { rankingSlug: "best-rap-crew-london-2026", name: "67",
    photoUrl: "https://images.h-wing.net/wp-content/uploads/2016/12/03181007/67.jpg" }, // copy
  { rankingSlug: "best-rap-crew-london-2026", name: "Harlem Spartans",
    photoUrl: "https://i.ytimg.com/vi/xPF3YdUEbKo/maxresdefault.jpg" }, // batch
  { rankingSlug: "best-rap-crew-london-2026", name: "House of Pharaohs",
    photoUrl: "https://www.nme.com/wp-content/uploads/2020/01/house-of-pharaohs2-400x254.jpg" }, // batch
  { rankingSlug: "best-rap-producer-london-2026", name: "Eight8",
    photoUrl: "https://i.ytimg.com/vi/6ZRPi0d4rTc/maxresdefault.jpg" }, // batch
  { rankingSlug: "best-rave-venue-london-2026", name: "Ministry of Sound",
    photoUrl: "https://upload.wikimedia.org/wikipedia/en/1/10/Ministry-of-sound-logo-png-transparent.png" }, // batch
  { rankingSlug: "best-rave-venue-london-2026", name: "Venue MOT",
    photoUrl: "https://imgproxy.ra.co/_/quality:66/aHR0cHM6Ly9pbWFnZXMucmEuY28vYWExY2YyMGZmNjgwMzRiMWUxYzZlYTY0ZjkwOWY0YTc4YWMxYWRjNi5qcGc=" }, // batch
  { rankingSlug: "biggest-sound-london-2026", name: "Saxon Studio International",
    photoUrl: "https://viberate-upload.ams3.cdn.digitaloceanspaces.com/prod/entity/artist/saxon-sound-system-X3twJ" }, // batch
  { rankingSlug: "biggest-sound-london-2026", name: "The Heatwave",
    photoUrl: "https://cdn.amsterdam-dance-event.nl/images/images/transforms/artists-speakers/_1200x630_crop_center-center_none/21174/The_Heatwave_Press_Shots_D_145499.webp" }, // copy
  { rankingSlug: "most-popular-dancehall-dj-london-2026", name: "The Heatwave",
    photoUrl: "https://cdn.amsterdam-dance-event.nl/images/images/transforms/artists-speakers/_1200x630_crop_center-center_none/21174/The_Heatwave_Press_Shots_D_145499.webp" }, // copy
  { rankingSlug: "biggest-sound-london-2026", name: "Reggae Roast",
    photoUrl: "https://reggaeroast.co.uk/cdn/shop/products/RR_12_GanjaLogo_2_360x.png?v=1573151939" }, // batch
  { rankingSlug: "biggest-sound-london-2026", name: "Young Warrior Sound System",
    photoUrl: "https://i.ytimg.com/vi/2i2QRZxybmI/hqdefault.jpg" }, // batch
  { rankingSlug: "most-popular-afrobeats-dj-london-2026", name: "DJ Edu",
    photoUrl: "https://viberate-upload.ams3.cdn.digitaloceanspaces.com/prod/entity/artist/dj-edu-836-XJy7W" }, // batch
  { rankingSlug: "most-popular-specialist-radio-host-london-2026", name: "DJ Edu",
    photoUrl: "https://viberate-upload.ams3.cdn.digitaloceanspaces.com/prod/entity/artist/dj-edu-836-XJy7W" }, // batch
  { rankingSlug: "most-popular-afrobeats-dj-london-2026", name: "DJ Neptizzle",
    photoUrl: "https://image.rinse.fm/_/Neptizzle-July-2021.jpg?w=600&h=600" }, // batch
  { rankingSlug: "most-popular-afrobeats-dj-london-2026", name: "DJ SoGood",
    photoUrl: "https://assets.shoobs.com/media/W1siZiIsIjIwMjIvMDcvMDMvMTkvMjQvMTAvNGUyOTgzYzYtZmQzNS00ZTE4LTk2YzEtYTg2NTcxM2EzOGNmL0lNR183NTE3LmpwZyJdXQ/IMG_7517.jpg?sha=c82e7cbba128304d" }, // batch
  { rankingSlug: "most-popular-afrobeats-dj-london-2026", name: "DJ Yemstar",
    photoUrl: "https://image.cueup.io/unsafe/q:75/rt:auto/w:640/plain/https://cdn.cueup.io/user_uploads/images/575d60e4-8767-46c9-bc0b-31fb4ae88e59.jpg" }, // batch
  { rankingSlug: "most-popular-club-photographer-london-2026", name: "Aiyush 'Yushy' Pachnanda",
    photoUrl: "https://media.macphun.com/img/uploads/skylum/presets-authors/38/Aiyush.webp?q=75&w=1530" }, // batch
  { rankingSlug: "most-popular-club-photographer-london-2026", name: "Jaime Cano",
    photoUrl: "https://images-prod.dazeddigital.com/786/azure/dazed-prod/1340/7/1347617.jpg" }, // batch
  { rankingSlug: "most-popular-club-photographer-london-2026", name: "Teddy Fitzhugh",
    photoUrl: "https://images-prod.dazeddigital.com/1200/azure/dazed-prod/1140/9/1149917.jpg" }, // batch
  { rankingSlug: "most-popular-club-photographer-london-2026", name: "David Koppel",
    photoUrl: "https://a.1stdibscdn.com/david-koppel-photography-lemmy-johnny-rotten-for-sale/a_23762/1703868635743/Lemmy_0_master.jpg?width=768" }, // batch
  { rankingSlug: "most-popular-club-photographer-london-2026", name: "Gavin Mills",
    photoUrl: "https://www.worldphoto.org/sites/default/files/styles/max_2600x2600/public/Frankie%20Knuckles%20%26%20David%20Morales%20-%20Ibiza%202013.jpg?itok=QmxZuxSz" }, // batch
  { rankingSlug: "most-popular-cocktail-creator-london-2026", name: "Remy Savage",
    photoUrl: "https://images.squarespace-cdn.com/content/v1/6425e92f3467417faac76afc/98a0bf93-291a-40a2-9e62-9eb86b836772/Remy+Savage.jpg?format=2500w" }, // batch
  { rankingSlug: "most-popular-tiktok-creator-london-2026", name: "Calfreezy",
    photoUrl: "https://yt3.googleusercontent.com/obKri8LQKWqPIkDIU6nKWLmcCj9aNjNq_LV3bd3tGQjHLKQveo2vwEOhWIZs_uYyECc-Jhlg=s900-c-k-c0x00ffffff-no-rj" }, // copy
  { rankingSlug: "most-popular-dancehall-dj-london-2026", name: "Seani B",
    photoUrl: "https://reggaenorthca.com/wp-content/uploads/2026/04/Seani-B-1500.png" }, // copy
  { rankingSlug: "most-popular-dancehall-dj-london-2026", name: "GAWDX",
    photoUrl: "https://storage.googleapis.com/encore_profilepictures/240/6231283a20b1592ea0b2ebda.jpg" }, // batch
  { rankingSlug: "most-popular-dancehall-dj-london-2026", name: "Silent Addy & Disco Neil",
    photoUrl: "https://pbs.twimg.com/profile_images/1397998108332658689/76Oeyk0T_400x400.jpg" }, // copy
  { rankingSlug: "most-popular-dancer-london-2026", name: "Karen Hauer",
    photoUrl: "https://i2-prod.ok.co.uk/incoming/article30947732.ece/ALTERNATES/s1200/2_Strictly-Come-Dancing-2022.jpg" }, // batch
  { rankingSlug: "most-popular-grime-mc-london-2026", name: "Scorcher",
    photoUrl: "https://thefoxmagazine.com/wp-content/uploads/2021/11/249859033_180390147602265_3741517835951211721_n-1.jpg" }, // batch
  { rankingSlug: "most-popular-student-performer-london-2026", name: "Cherrie",
    photoUrl: "https://i.ytimg.com/vi/duTmB0itYzg/hqdefault.jpg" }, // copy
  { rankingSlug: "most-popular-student-performer-london-2026", name: "Hermione",
    photoUrl: "https://i.ytimg.com/vi/4ZGBxnVmrjY/hqdefault.jpg" }, // copy
  { rankingSlug: "most-popular-student-performer-london-2026", name: "Hayden",
    photoUrl: "https://i.ytimg.com/vi/AL7McmBoT1Y/hqdefault.jpg" }, // copy
  { rankingSlug: "most-popular-student-performer-london-2026", name: "Spriha",
    photoUrl: "https://i.ytimg.com/vi/CUBcmhtlZYE/hqdefault.jpg" }, // copy
  { rankingSlug: "most-popular-student-performer-london-2026", name: "Skylar",
    photoUrl: "https://i.ytimg.com/vi/Exly8zSr6AU/hqdefault.jpg" }, // copy
  { rankingSlug: "most-popular-music-interviewer-london-2026", name: "Manny Norte",
    photoUrl: "https://assets.capitalxtra.com/2025/02/mannyepg-1737132023-editorial-long-form-0.png" }, // batch
  { rankingSlug: "most-popular-music-interviewer-london-2026", name: "Remel London",
    photoUrl: "https://apprenticenation.co.uk/wp-content/uploads/2021/02/350A1468-2-scaled.jpg" }, // batch
  { rankingSlug: "most-popular-music-producer-london-2026", name: "Rymez",
    photoUrl: "https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgk8g1wSrJiWzQAahvo1QLhWA2U7s0TAZk09bh0qT15Wc34OsdIe-DhQyWMT7ImWPurvYU_y70a9hJ-68utk3WhoFwq-KV3RuZeFZGVucXzfN3YAgaa3OdV3E2vuWTWZVGMzX72W_bOQA/s16000-rw/RYMEZ.png" }, // batch
  { rankingSlug: "most-popular-music-producer-london-2026", name: "Ceebeaats",
    photoUrl: "https://www.image-line.com/wp-content/uploads/2023/05/ceebeaats.png" }, // batch
  { rankingSlug: "most-popular-music-producer-london-2026", name: "Inflo",
    photoUrl: "https://crackmagazine.net/wp-content/uploads/2022/06/ifnlo.jpg" }, // batch
  { rankingSlug: "most-popular-nightlife-promoter-london-2026", name: "Queer House Party",
    photoUrl: "https://d2ljoqkkoec4f6.cloudfront.net/wp-content/uploads/2023/04/11172734/QHP-landscape.jpg" }, // batch
  { rankingSlug: "most-popular-nightlife-promoter-london-2026", name: "Riposte",
    photoUrl: "https://imgproxy.ra.co/_/w:764/rt:fill/enlarge:true/quality:50/h:430/aHR0cHM6Ly9pbWFnZXMucmEuY28vOWY4OWZkM2Y4MjZiZDEyZTI0MGM1ZDU4NDk5ZTY2MTJiZGM0ODk5NC5wbmc=" }, // batch
  { rankingSlug: "most-popular-nightlife-promoter-london-2026", name: "BUMPAH",
    photoUrl: "https://images.ra.co/f6180b49d7affd9783fa830267109ea17390c836.jpg" }, // batch
  { rankingSlug: "most-popular-nightlife-promoter-london-2026", name: "PLASTYK",
    photoUrl: "https://imgproxy.ra.co/_/quality:66/w:1442/rt:fill/aHR0cHM6Ly9pbWFnZXMucmEuY28vMmFkMWNmMzQzMGU0ZTUwMDdiYzMzNjdiZDM2OWVlNzk2NjJjOGRhMi5wbmc=" }, // batch
  { rankingSlug: "most-popular-nightlife-promoter-london-2026", name: "Layo Paskin",
    photoUrl: "https://www.domusstay.com/wp-content/uploads/Zoe-Layo-0672-1920x1281.jpg" }, // batch
  { rankingSlug: "most-popular-nightlife-promoter-london-2026", name: "Jeremy Joseph",
    photoUrl: "https://www.londonmarathonevents.co.uk/sites/default/files/styles/original_optimised/public/9db14f44e4604e2aa0945b37ee2adbdf.jpg?itok=JD1FmK3S" }, // batch
  { rankingSlug: "most-popular-party-host-london-2026", name: "MC GQ",
    photoUrl: "https://cdn.prod.website-files.com/66fbea41b5ef08dc592dbf43/69a012599d36a12daf8145d6_MC%20GQ%20960%20x%20960.webp" }, // batch
  { rankingSlug: "most-popular-party-host-london-2026", name: "Navigator",
    photoUrl: "https://i.ytimg.com/vi/F1Hwuu0V9Ak/maxresdefault.jpg" }, // batch
  { rankingSlug: "most-popular-party-host-london-2026", name: "MC Fearless",
    photoUrl: "https://static.ra.co/images/profiles/square/mcfearless.jpg?dateUpdated=1549464369000" }, // batch
  { rankingSlug: "most-popular-party-host-london-2026", name: "Bassman",
    photoUrl: "https://viberate-upload.ams3.cdn.digitaloceanspaces.com/prod/entity/artist/mc-bassman-7PQIx" }, // batch
  { rankingSlug: "most-popular-party-host-london-2026", name: "Eksman",
    photoUrl: "https://goout.net/i/046/461791-383.jpg" }, // batch
  { rankingSlug: "most-popular-party-host-london-2026", name: "Harry Shotta",
    photoUrl: "https://image.rinse.fm/_/07145AE9-2031-42D1-8A17-67839961F089-Harry-Shotta.jpeg?w=600&h=600" }, // batch
  { rankingSlug: "most-popular-radio-newcomer-london-2026", name: "Kash & Pharxoh",
    photoUrl: "https://ichef.bbci.co.uk/images/ic/1024x576/p03qgl4v.jpg" }, // batch
  { rankingSlug: "most-popular-underground-radio-dj-london-2026", name: "Skeen LDN",
    photoUrl: "https://www.reprezent.org.uk/_next/image?url=https%3A%2F%2Femvrqvgxkhiwxafqslqp.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fmedia%2Fimages%2Fcrops%2FSkeen_LDN_2_desktop_1756276952899.webp&w=384&q=75" }, // copy
  { rankingSlug: "most-popular-radio-newcomer-london-2026", name: "MIDRIB",
    photoUrl: "https://www.reprezent.org.uk/_next/image?url=https%3A%2F%2Femvrqvgxkhiwxafqslqp.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fmedia%2Fimages%2Fcrops%2FMIDRIB_1_desktop_1756277737546.webp&w=384&q=75" }, // copy
  { rankingSlug: "most-popular-radio-newcomer-london-2026", name: "Dare Balogun",
    photoUrl: "https://static.ra.co/images/profiles/square/darebalogun.jpg?dateUpdated=1647858159000" }, // batch
  { rankingSlug: "most-popular-radio-newcomer-london-2026", name: "DJ CHINWAX",
    photoUrl: "https://res.cloudinary.com/shotgun/image/upload/c_limit,w_1200,h_630/f_jpg/q_auto/production/artworks/artists/dj_chinwax.jpg" }, // batch
  { rankingSlug: "most-popular-reality-tv-personality-london-2026", name: "Harry Clark",
    photoUrl: "https://resizer.ladbiblegroup.com/ogimage/v3/assets/bltcd74acc1d0a99f3a/blt91d9a4d877b00f35/690e09367512b839960edee1/Harry_Clark.png" }, // batch
  { rankingSlug: "most-popular-restaurant-reviewer-london-2026", name: "Moses Combe",
    photoUrl: "https://newsuk-the-times.cdn.zephr.com/imageserver/image/b3db73d5-cac9-486f-8455-93b53b7b4d74.jpg?strip=all&format=webp&crop=1600px%2C900px%2C0px%2C0px&resize=1200" }, // batch
  { rankingSlug: "most-popular-soap-star-london-2026", name: "Steve McFadden",
    photoUrl: "https://images.immediate.co.uk/production/volatile/sites/3/2025/02/phil-mitchell-b2dee6c.jpg?resize=1200%2C630" }, // batch
  { rankingSlug: "most-popular-stand-up-newcomer-london-2026", name: "Roger O'Sullivan",
    photoUrl: "https://backyardcomedyclub.co.uk/wp-content/uploads/2021/10/roger-osullivan-1024x919.jpg" }, // batch
  { rankingSlug: "most-popular-streamer-london-2026", name: "Philza",
    photoUrl: "https://fresherpost.com/wp-content/uploads/2023/01/phil-feat.jpg" }, // batch
  { rankingSlug: "most-popular-streamer-london-2026", name: "Ali-A",
    photoUrl: "https://naibuzz.com/wp-content/uploads/2016/12/Ali-A-3.jpg" }, // batch
  { rankingSlug: "most-popular-tiktok-creator-london-2026", name: "Sharky",
    photoUrl: "https://pbs.twimg.com/profile_images/2042275500286976005/tPKFwfMr_400x400.jpg" }, // copy
  { rankingSlug: "most-popular-underground-radio-dj-london-2026", name: "DJ Storm",
    photoUrl: "https://www.djbooga.com/content/images/2022/12/03-Storm-2000-04-Martin-Handrow.jpg" }, // batch
  { rankingSlug: "most-popular-underground-radio-dj-london-2026", name: "Lens",
    photoUrl: "https://i.ytimg.com/vi/5s6zRCkShlc/maxresdefault.jpg" }, // batch
  { rankingSlug: "most-popular-vintage-seller-london-2026", name: "East End Thrift Store",
    photoUrl: "https://www.keytofashion.com/wp-content/uploads/2019/04/ED521392-9B96-4FBE-899B-86F498B7CD38.jpeg" }, // batch
  { rankingSlug: "most-popular-vintage-seller-london-2026", name: "House of Vintage",
    photoUrl: "https://images.squarespace-cdn.com/content/v1/5e75375245d9d14f5cdba047/4affccbb-4d0a-4090-87b9-6abc958f7c41/MAIN-PAGE.JPG" }, // batch
  { rankingSlug: "most-popular-x-personality-london-2026", name: "Ian Dunt",
    photoUrl: "https://www.a-speakers.com/media/xxnhcgf1/hero-ian-dunt.jpg?width=1200&height=675&format=webp" }, // batch
  { rankingSlug: "most-popular-jungle-dj-london-2026", name: "Samurai Breaks",
    photoUrl: "/images/nominees/samurai-breaks.jpg" }, // social:self-hosted samurai-breaks.jpg
  { rankingSlug: "hottest-upcoming-rapper-london-2026", name: "Jawnino",
    photoUrl: "/images/nominees/jawnino.jpg" }, // social:self-hosted jawnino.jpg
  { rankingSlug: "best-freestyle-rapper-london-2026", name: "Dexter",
    photoUrl: "/images/nominees/dexter.jpg" }, // social:self-hosted dexter.jpg
  { rankingSlug: "best-freestyle-rapper-london-2026", name: "iKeda",
    photoUrl: "/images/nominees/ikeda.jpg" }, // social:self-hosted ikeda.jpg
  { rankingSlug: "best-rap-crew-london-2026", name: "Zone 2",
    photoUrl: "/images/nominees/zone-2.jpg" }, // social:self-hosted zone-2.jpg
  { rankingSlug: "best-rap-producer-london-2026", name: "Carns Hill",
    photoUrl: "/images/nominees/carns-hill.jpg" }, // social:self-hosted carns-hill.jpg
  { rankingSlug: "most-popular-grime-mc-london-2026", name: "Duppy",
    photoUrl: "/images/nominees/duppy.jpg" }, // social:self-hosted duppy.jpg
  { rankingSlug: "most-popular-party-host-london-2026", name: "Funsta",
    photoUrl: "/images/nominees/funsta.jpg" }, // social:self-hosted funsta.jpg
  { rankingSlug: "most-popular-party-host-london-2026", name: "IC3",
    photoUrl: "/images/nominees/ic3.jpg" }, // social:self-hosted ic3.jpg
  { rankingSlug: "most-popular-music-interviewer-london-2026", name: "Poet",
    photoUrl: "/images/nominees/poet.jpg" }, // social:self-hosted poet.jpg
  { rankingSlug: "most-popular-music-interviewer-london-2026", name: "Sun O.C.",
    photoUrl: "/images/nominees/sun-o-c.jpg" }, // social:self-hosted sun-o-c.jpg
  { rankingSlug: "best-university-society-london-2026", name: "Imperial African Caribbean Society",
    photoUrl: "/images/nominees/imperial-african-caribbean-society.jpg" }, // social:self-hosted imperial-african-caribbean-society.jpg
  { rankingSlug: "best-university-society-london-2026", name: "UCL Indian Dance Society",
    photoUrl: "/images/nominees/ucl-indian-dance-society.jpg" }, // social:self-hosted ucl-indian-dance-society.jpg
  { rankingSlug: "best-international-student-community-london-2026", name: "Royal Holloway CSSA",
    photoUrl: "/images/nominees/royal-holloway-cssa.jpg" }, // social:self-hosted royal-holloway-cssa.jpg
  { rankingSlug: "best-society-president-london-2026", name: "Ines Aissi",
    photoUrl: "/images/nominees/ines-aissi.jpg" }, // social:self-hosted ines-aissi.jpg
  { rankingSlug: "best-carnival-sound-system-london-2026", name: "Nasty Love",
    photoUrl: "/images/nominees/nasty-love.jpg" }, // social:self-hosted nasty-love.jpg
  { rankingSlug: "best-underground-party-london-2026", name: "Louder",
    photoUrl: "/images/nominees/louder.jpg" }, // social:self-hosted louder.jpg
  { rankingSlug: "best-caribbean-takeaway-london-2026", name: "Tops Caribbean",
    photoUrl: "/images/nominees/tops-caribbean.jpg" }, // social:self-hosted tops-caribbean.jpg
  { rankingSlug: "best-caribbean-takeaway-london-2026", name: "Good Tings Caribbean Grill",
    photoUrl: "/images/nominees/good-tings-caribbean.jpg" }, // social:self-hosted good-tings-caribbean.jpg
  { rankingSlug: "best-full-english-london-2026", name: "Fallow",
    photoUrl: "/images/nominees/fallow.jpg" }, // social:self-hosted fallow.jpg
  { rankingSlug: "most-popular-club-photographer-london-2026", name: "Nick Ensing",
    photoUrl: "/images/nominees/nick-ensing.jpg" }, // social:self-hosted nick-ensing.jpg
  { rankingSlug: "most-popular-club-photographer-london-2026", name: "Danny Seaton",
    photoUrl: "/images/nominees/danny-seaton.jpg" }, // social:self-hosted danny-seaton.jpg
  { rankingSlug: "most-popular-club-photographer-london-2026", name: "Anna Mills",
    photoUrl: "/images/nominees/anna-mills.jpg" }, // social:self-hosted anna-mills.jpg
  { rankingSlug: "most-popular-club-photographer-london-2026", name: "Rae Tait",
    photoUrl: "/images/nominees/rae-tait.jpg" }, // social:self-hosted rae-tait.jpg
  { rankingSlug: "best-makeup-artist-london-2026", name: "Daniel Sandler",
    photoUrl: "/images/nominees/daniel-sandler.jpg" }, // social:self-hosted daniel-sandler.jpg
  { rankingSlug: "most-popular-queer-nightlife-personality-london-2026", name: "Amy Zing",
    photoUrl: "/images/nominees/amy-zing.jpg" }, // social:self-hosted amy-zing.jpg
  { rankingSlug: "best-anime-transformation-london-2026", name: "Richard von Wild",
    photoUrl: "/images/nominees/richard-von-wild.jpg" }, // social:self-hosted richard-von-wild.jpg
  { rankingSlug: "best-cosplay-performance-london-2026", name: "Eleo Cosplay — Grand Champion winning performance at the C3 Cosplay City Championship final 2023",
    photoUrl: "/images/nominees/eleo-cosplay.jpg" }, // social:self-hosted eleo-cosplay.jpg
  { rankingSlug: "best-cosplay-performance-london-2026", name: "raydiancy_ — Fabric Grandmaster winning performance at the C3 Cosplay City Championship final 2023",
    photoUrl: "/images/nominees/raydiancy.jpg" }, // social:self-hosted raydiancy.jpg
  { rankingSlug: "best-cosplay-performance-london-2026", name: "Diablo_coz & white.noiz — Rai-Con Winter Forge Masters winning performance 2024",
    photoUrl: "/images/nominees/diablo-coz-white-noiz.jpg" }, // social:self-hosted diablo-coz-white-noiz.jpg
  { rankingSlug: "best-cosplay-performance-london-2026", name: "Cosmic Dandy — Rai-Con Winter Fabric Master winning performance 2024",
    photoUrl: "/images/nominees/cosmic-dandy.jpg" }, // social:self-hosted cosmic-dandy.jpg
  { rankingSlug: "best-cosplay-performance-london-2026", name: "Star — ACME Spring Superstar winning performance 2024",
    photoUrl: "/images/nominees/star.jpg" }, // social:self-hosted star.jpg
];

type Replace = { rankingSlug: string; name: string; oldUrl: string; newUrl: string };
const REPLACES: Replace[] = [
  { rankingSlug: "best-university-society-london-2026", name: "KCL Dance Society",
    oldUrl: "https://www.kclsu.org/asset/Organisation/6449/Screenshot%202026-06-30%20at%2022.30.26.png",
    newUrl: "https://web.archive.org/web/20160424220349im_/http://kcldancesoc.co.uk/wp-content/uploads/2015/09/cropped-Logo-192x192.png" },
  { rankingSlug: "best-university-society-london-2026", name: "KCL DJ Society",
    oldUrl: "https://www.kclsu.org/asset/Organisation/6498/WhatsApp%20Image%202025-08-26%20at%2014.03.28.jpeg",
    newUrl: "https://thumbnailer.mixcloud.com/unsafe/300x300/profile/1/4/f/7/f566-19c1-43ba-8e30-89f1e2" },
  { rankingSlug: "most-popular-queer-nightlife-personality-london-2026", name: "James Hillard",
    oldUrl: "https://media.k-dj.jp/kdj/djs/jameshillard/profilel.jpg",
    newUrl: "https://goout.net/i/081/814588-800.jpg" },
  { rankingSlug: "most-popular-queer-nightlife-personality-london-2026", name: "Luke Howard",
    oldUrl: "https://media.k-dj.jp/kdj/djs/lukehoward/profilel.jpg",
    newUrl: "https://image.rinse.fm/_/Horse-Meat-Disco-Luke-June-2021.png?w=600&h=600" },
  { rankingSlug: "most-popular-queer-nightlife-personality-london-2026", name: "Severino",
    oldUrl: "https://media.k-dj.jp/kdj/djs/severino/profilel.jpg",
    newUrl: "https://d2cup43q5qzhdv.cloudfront.net/Severino-Panzetta.jpeg?mtime=20200716003611&focal=no" },
  { rankingSlug: "most-popular-streetwear-influencer-london-2026", name: "Charlotte Olivia",
    oldUrl: "https://p16-common-sign.tiktokcdn-us.com/tos-maliva-avt-0068/2ce672d04d9a41125ed8f69d825fc10c~tplv-tiktokx-cropce",
    newUrl: "https://medias.spotern.com/spots/w360/295/295827-1580374801.jpg" },
  { rankingSlug: "best-fried-chicken-shop-london-2026", name: "Slim Chickens",
    oldUrl: "https://foodchainmagazine.com/wp-content/uploads/sites/10/2018/06/SC-138-a.jpg",
    newUrl: "https://assets.manchesterarndale.com/app/uploads/2022/02/slim-chickens.png" },
  { rankingSlug: "best-full-english-london-2026", name: "Polo Bar",
    oldUrl: "https://www.urban75.org/blog/images/polo-bar-cafe-liverpool-st-01.jpg",
    newUrl: "https://api.elcambiador.com/serveImage.php?path=3/6/7/3/3673/3673-007.jpg&w=1200" },
  { rankingSlug: "most-popular-vintage-seller-london-2026", name: "Atika London",
    oldUrl: "https://p16-common-sign.tiktokcdn-us.com/tos-maliva-avt-0068/7321299944432730118~tplv-tiktokx-cropce",
    newUrl: "https://cdn.shopify.com/s/files/1/0097/4146/7705/files/atika_480x480.jpg?v=1675875765" },
];

type Clear = { rankingSlug: string; name: string; oldUrl: string };
const CLEARS: Clear[] = [
  { rankingSlug: "best-anime-transformation-london-2026", name: "Maria Jodicke",
    oldUrl: "https://images.immediate.co.uk/production/volatile/sites/3/2025/10/dalek-pyramid-head-hellraiser-cosplayers-140c09f.jpg" },
  { rankingSlug: "best-anime-transformation-london-2026", name: "MossyPyramidHead",
    oldUrl: "https://images.immediate.co.uk/production/volatile/sites/3/2025/10/dalek-pyramid-head-hellraiser-cosplayers-140c09f.jpg" },
  { rankingSlug: "best-rookie-cosplayer-london-2026", name: "MossyPyramidHead",
    oldUrl: "https://images.immediate.co.uk/production/volatile/sites/3/2025/10/dalek-pyramid-head-hellraiser-cosplayers-140c09f.jpg?quality=90&fit=1100,733" },
];

export async function fixNomineePhotosBatch(): Promise<void> {
  let filled = 0, replaced = 0, cleared = 0;
  for (const f of FILLS) {
    const r = await db.prepare(
      `UPDATE profiles SET photo_url = ?
       WHERE ranking_id = (SELECT id FROM rankings WHERE slug = ?)
         AND name = ? AND deleted_at IS NULL AND photo_url IS NULL`
    ).run(f.photoUrl, f.rankingSlug, f.name);
    filled += r.changes;
  }
  for (const r of REPLACES) {
    const res = await db.prepare(
      `UPDATE profiles SET photo_url = ?
       WHERE ranking_id = (SELECT id FROM rankings WHERE slug = ?)
         AND name = ? AND deleted_at IS NULL AND photo_url = ?`
    ).run(r.newUrl, r.rankingSlug, r.name, r.oldUrl);
    replaced += res.changes;
  }
  for (const c of CLEARS) {
    const res = await db.prepare(
      `UPDATE profiles SET photo_url = ''
       WHERE ranking_id = (SELECT id FROM rankings WHERE slug = ?)
         AND name = ? AND deleted_at IS NULL AND photo_url = ?`
    ).run(c.rankingSlug, c.name, c.oldUrl);
    cleared += res.changes;
  }
  if (filled + replaced + cleared > 0)
    console.log(`[fixNomineePhotosBatch] filled=${filled} replaced=${replaced} cleared=${cleared}`);
}
