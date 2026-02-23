import { initDb } from "./db/index.js";
import { initPoster } from "./poster.js";
import { startWatcher } from "./watcher.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  logger.info("Mythic Settlement Service starting...");

  initDb();
  logger.info("Database initialized");

  initPoster();
  logger.info("Poster initialized");

  await startWatcher();
}

main().catch((err) => {
  logger.fatal({ err }, "Settlement service crashed");
  process.exit(1);
});
