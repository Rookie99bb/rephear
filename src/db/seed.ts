import { ensureMigrated } from "./schema";

// ensureMigrated() already runs migrations then seedIfEmpty() in
// sequence (see schema.ts), so this script just needs to trigger it.
ensureMigrated().then(() => {
  console.log("Seed complete (no-op if the database already had data).");
});
