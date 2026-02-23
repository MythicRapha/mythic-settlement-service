import { Connection } from "@solana/web3.js";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import { getLastPostedSlot } from "./db/index.js";
import { computeStateRoot } from "./merkle.js";
import { postStateRoot } from "./poster.js";

const POLL_INTERVAL_MS = 5_000;

export async function startWatcher(): Promise<void> {
  const l2Connection = new Connection(config.l2RpcUrl, "confirmed");

  logger.info(
    {
      l2Rpc: config.l2RpcUrl,
      slotsPerSettlement: config.slotsPerSettlement,
      pollInterval: POLL_INTERVAL_MS,
    },
    "Starting settlement watcher"
  );

  let running = true;

  const shutdown = () => {
    logger.info("Shutting down watcher...");
    running = false;
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  while (running) {
    try {
      const currentSlot = await l2Connection.getSlot("confirmed");
      const lastPosted = getLastPostedSlot();

      // Find next settlement slot: next multiple of slotsPerSettlement after lastPosted
      const nextSettlementSlot =
        lastPosted === 0
          ? Math.floor(currentSlot / config.slotsPerSettlement) *
            config.slotsPerSettlement
          : lastPosted + config.slotsPerSettlement;

      if (currentSlot >= nextSettlementSlot && nextSettlementSlot > lastPosted) {
        logger.info(
          {
            currentSlot,
            lastPosted,
            nextSettlementSlot,
          },
          "Settlement slot reached, computing state root"
        );

        const { root, accountCount } = await computeStateRoot(
          l2Connection,
          nextSettlementSlot
        );

        try {
          const signature = await postStateRoot(
            nextSettlementSlot,
            root,
            accountCount
          );
          logger.info(
            {
              slot: nextSettlementSlot,
              signature,
              root: root.toString("hex"),
            },
            "Settlement posted successfully"
          );
        } catch (postErr) {
          logger.error(
            { err: postErr, slot: nextSettlementSlot },
            "Failed to post state root to L1"
          );
        }
      } else {
        const slotsUntil = nextSettlementSlot - currentSlot;
        logger.debug(
          {
            currentSlot,
            lastPosted,
            nextSettlementSlot,
            slotsUntil: slotsUntil > 0 ? slotsUntil : 0,
          },
          "Waiting for next settlement slot"
        );
      }
    } catch (err) {
      logger.error({ err }, "Error in watcher loop");
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  logger.info("Watcher stopped");
}
