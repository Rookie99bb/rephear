import { db } from "./client";

// One-time photo correction for university-society nominees (2026-09-25).
//
// Many society nominees were seeded with their parent university's generic
// logo (or a stale LSE mark) instead of the society's own logo, and all 14
// society-president nominees shared one UCL logo. The seed data in
// openingSlates.ts now carries the correct photos, but seedOpeningSlates()
// deliberately never overwrites an existing photo (setNomineePhotoIfEmpty),
// so this startup step repairs the rows that are already in the database.
//
// Safety: a profile is only touched when its current photo is one of the
// known-wrong seed URLs (or empty). A photo that a nominee, owner, or admin
// deliberately set is never overwritten. Idempotent: re-running is a no-op
// once every target row already carries the fixed URL.

type PhotoFix = { rankingSlug: string; name: string; photoUrl: string };

const WRONG_PHOTOS = [
  "https://cdn.ucl.ac.uk/logos/ucl/ucl-logo--primary.svg",
  "https://upload.wikimedia.org/wikipedia/commons/1/14/King%27s_College_London_logo.svg",
  "https://upload.wikimedia.org/wikipedia/commons/c/c7/London_school_of_economics_logo_with_name.svg",
  "https://upload.wikimedia.org/wikipedia/en/e/ef/Royal_Holloway%2C_University_of_London_logo.png",
  "https://upload.wikimedia.org/wikipedia/commons/c/c5/Shield_of_Imperial_College_London.svg",
  "https://upload.wikimedia.org/wikipedia/commons/4/42/London_School_of_Economics_Coat_of_Arms.svg",
  "",
];

const FIXES: PhotoFix[] = [
  // ---- best-international-student-community-london-2026 ----
  {
    rankingSlug: "best-international-student-community-london-2026",
    name: "KCL Southeast Asian Society",
    photoUrl:
      "https://www.kclsu.org/asset/Organisation/11645/Screenshot%202023-11-20%20at%2017.00.14.png",
  },
  {
    rankingSlug: "best-international-student-community-london-2026",
    name: "KCL Taiwanese Society",
    photoUrl: "https://www.kclsu.org/asset/Organisation/7639/IMG_8406.jpeg",
  },
  {
    rankingSlug: "best-international-student-community-london-2026",
    name: "ABACUS",
    photoUrl:
      "https://studentsunionucl.org/sites/default/files/2024-07/IMG_9853.jpeg",
  },
  {
    rankingSlug: "best-international-student-community-london-2026",
    name: "UCL Japan Society",
    photoUrl:
      "https://studentsunionucl.org/sites/default/files/csc-directory-images/japan_soc_new_logo.png",
  },
  {
    rankingSlug: "best-international-student-community-london-2026",
    name: "Royal Holloway CSSA",
    photoUrl: "",
  },
  {
    rankingSlug: "best-international-student-community-london-2026",
    name: "KCL Korean Society",
    photoUrl: "",
  },
  {
    rankingSlug: "best-international-student-community-london-2026",
    name: "London School of Economics and Political Science",
    photoUrl:
      "https://blogsmedia.lse.ac.uk/blogs.dir/65/files/2023/11/LSE-social-media-logo-2.jpg",
  },
  // ---- best-university-society-london-2026 ----
  {
    rankingSlug: "best-university-society-london-2026",
    name: "KCL Dance Society",
    photoUrl:
      "https://www.kclsu.org/asset/Organisation/6449/Screenshot%202026-06-30%20at%2022.30.26.png",
  },
  {
    rankingSlug: "best-university-society-london-2026",
    name: "Imperial African Caribbean Society",
    photoUrl: "",
  },
  {
    rankingSlug: "best-university-society-london-2026",
    name: "KCL United Nations Association",
    photoUrl:
      "https://images.squarespace-cdn.com/content/v1/5e7526073373e1644f760717/8ad4419a-358f-499d-ae3f-06b4c855784b/Copy+of+KCLUNA+Transparent+Logo+%287%29.png?format=1500w",
  },
  {
    rankingSlug: "best-university-society-london-2026",
    name: "UCL Indian Dance Society",
    photoUrl: "",
  },
  {
    rankingSlug: "best-university-society-london-2026",
    name: "UCL Film & TV Society",
    photoUrl:
      "https://studentsunionucl.org/sites/default/files/styles/banner_image_1900/public/2025-07/Untitled%20design-4%20copy.png?h=ae183e10&itok=gLOq6yR2",
  },
  {
    rankingSlug: "best-university-society-london-2026",
    name: "LSESU African & Caribbean Society",
    photoUrl:
      "https://www.lsesu.com/asset/Organisation/6090/IMG_0484.jpeg?thumbnail_width=540&thumbnail_height=540&resize_type=ResizeFitAllFill",
  },
  // ---- best-society-president-london-2026 ----
  {
    rankingSlug: "best-society-president-london-2026",
    name: "Quoc Anh Nguyen",
    photoUrl:
      "https://studentsunionucl.org/sites/default/files/styles/candidate_photo/public/2025-03/IMG_3850.jpeg?itok=-qrG_t1V",
  },
  {
    rankingSlug: "best-society-president-london-2026",
    name: "Yuki Zhou",
    photoUrl:
      "https://studentsunionucl.org/sites/default/files/styles/candidate_photo/public/2025-03/%E6%88%AA%E5%B1%8F2025-03-07%2015.11.47.png?itok=Zs8C_0an",
  },
  {
    rankingSlug: "best-society-president-london-2026",
    name: "Emir Deniz Durahim",
    photoUrl:
      "https://studentsunionucl.org/sites/default/files/styles/candidate_photo/public/2025-03/IMG_0638.JPG?itok=ZhjekQUo",
  },
  {
    rankingSlug: "best-society-president-london-2026",
    name: "Yi Kang Chai",
    photoUrl:
      "https://studentsunionucl.org/sites/default/files/styles/candidate_photo/public/2025-03/Manifesto%20pic%202.jpg?itok=sTAEu4pc",
  },
  {
    rankingSlug: "best-society-president-london-2026",
    name: "Chin Siang Yew",
    photoUrl:
      "https://studentsunionucl.org/sites/default/files/styles/candidate_photo/public/2025-03/30A66E40-0573-4BB3-8492-C4FB73ED7DC5-94652-000023307D0B1820.JPG?itok=zQCPf33M",
  },
  {
    rankingSlug: "best-society-president-london-2026",
    name: "Vishal Arun",
    photoUrl:
      "https://studentsunionucl.org/sites/default/files/styles/candidate_photo/public/2025-03/IMG_5817.jpeg?itok=MQkia45G",
  },
  {
    rankingSlug: "best-society-president-london-2026",
    name: "Megan Liao",
    photoUrl:
      "https://studentsunionucl.org/sites/default/files/styles/candidate_photo/public/2025-03/IMG_9072.jpg?itok=OraDGbzM",
  },
  {
    rankingSlug: "best-society-president-london-2026",
    name: "Maya Crasmaru",
    photoUrl:
      "https://studentsunionucl.org/sites/default/files/styles/candidate_photo/public/2025-03/Screenshot%202025-03-08%20at%2021.40.32_1.png?itok=r8BwuDOp",
  },
  {
    rankingSlug: "best-society-president-london-2026",
    name: "Girish Kharal",
    photoUrl:
      "https://studentsunionucl.org/sites/default/files/styles/candidate_photo/public/2025-03/Nomination%20.jpg?itok=vsMcrVYo",
  },
  {
    rankingSlug: "best-society-president-london-2026",
    name: "Ines Aissi",
    photoUrl: "",
  },
  {
    rankingSlug: "best-society-president-london-2026",
    name: "Conal Flannery",
    photoUrl:
      "https://studentsunionucl.org/sites/default/files/styles/candidate_photo/public/2025-03/IMG_1335.jpeg?itok=Bp-ZOHdk",
  },
  {
    rankingSlug: "best-society-president-london-2026",
    name: "Aryan Virdi",
    photoUrl:
      "https://studentsunionucl.org/sites/default/files/styles/candidate_photo/public/2025-03/IMG_1069_0.jpeg?itok=oxlC8ga7",
  },
  {
    rankingSlug: "best-society-president-london-2026",
    name: "Hanna Johal",
    photoUrl:
      "https://studentsunionucl.org/sites/default/files/styles/candidate_photo/public/2025-03/Hanna%20Johal.jpg?itok=ButNtWEv",
  },
  {
    rankingSlug: "best-society-president-london-2026",
    name: "Izzie Moull",
    photoUrl:
      "https://studentsunionucl.org/sites/default/files/styles/candidate_photo/public/2025-03/Screenshot%202025-03-05%20at%208.28.30%20pm.png?itok=QHq0uN8l",
  },
];

export async function fixSocietyNomineePhotos(): Promise<void> {
  const wrongList = WRONG_PHOTOS.map(() => "?").join(", ");
  let fixed = 0;
  for (const fix of FIXES) {
    const result = await db
      .prepare(
        `UPDATE profiles
         SET photo_url = ?
         WHERE ranking_id = (SELECT id FROM rankings WHERE slug = ?)
           AND name = ?
           AND deleted_at IS NULL
           AND (photo_url IN (${wrongList}) OR photo_url IS NULL)`
      )
      .run(fix.photoUrl, fix.rankingSlug, fix.name, ...WRONG_PHOTOS);
    fixed += result.changes;
  }
  if (fixed > 0) console.log(`[fixSocietyNomineePhotos] updated ${fixed} profile photo(s)`);
}
