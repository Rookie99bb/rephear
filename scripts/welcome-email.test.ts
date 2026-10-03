import { ensureMigrated } from "../src/db/schema";
import { createUser } from "../src/db/users";
import { findOrCreateGoogleUser } from "../src/lib/auth";

let failures = 0;
function check(name: string, condition: boolean): void {
  if (condition) console.log(`  ok - ${name}`);
  else {
    failures++;
    console.error(`  FAIL - ${name}`);
  }
}

async function main(): Promise<void> {
  await ensureMigrated();

  const deliveries: Array<{ email: string; name: string }> = [];
  const captureWelcome = (recipient: { email: string; name: string }) => {
    deliveries.push(recipient);
  };

  const created = await findOrCreateGoogleUser(
    { email: "NEW-GOOGLE@EXAMPLE.COM ", name: "New Google" },
    captureWelcome
  );
  check("first Google registration sends one welcome email", deliveries.length === 1);
  check("welcome email targets the normalized account email", deliveries[0]?.email === "new-google@example.com");
  check("new Google account is created", created.email === "new-google@example.com");

  const returned = await findOrCreateGoogleUser(
    { email: "new-google@example.com", name: "Changed Provider Name" },
    captureWelcome
  );
  check("existing Google user does not receive a duplicate welcome email", deliveries.length === 1);
  check("existing account is reused", returned.id === created.id);

  const passwordUser = await createUser({
    email: "password-user@example.com",
    passwordHash: "hash",
    name: "Password User",
  });
  const linked = await findOrCreateGoogleUser(
    { email: "password-user@example.com", name: "Google Name" },
    captureWelcome
  );
  check("Google login linking an existing email sends no welcome email", deliveries.length === 1);
  check("password account is linked rather than duplicated", linked.id === passwordUser.id);

  if (failures > 0) process.exit(1);
  console.log("Welcome-email regression suite passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
