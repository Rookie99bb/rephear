import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const loginPage = fs.readFileSync(
  path.join(process.cwd(), "src/app/login/page.tsx"),
  "utf8",
);

assert.match(loginPage, /if \(status === "authenticated"\)/);
assert.match(loginPage, /router\.replace\("\/"\)/);
assert.match(loginPage, /<GoogleSignInButton callbackUrl="\/" \/>/);
assert.doesNotMatch(loginPage, /useSearchParams|safeNextPath|nextPath/);
assert.doesNotMatch(loginPage, /router\.push\(/);

console.log("Login redirect checks passed.");
