import { ensureMigrated } from "./schema";

ensureMigrated().then(() => {
  console.log("Migrations applied.");
});
