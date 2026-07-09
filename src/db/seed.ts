import { runMigrations } from "./schema";
import { seedIfEmpty } from "./seedData";

runMigrations();
seedIfEmpty();
console.log("Seed complete (no-op if the database already had data).");
