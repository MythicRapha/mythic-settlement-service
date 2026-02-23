import { Connection, PublicKey } from "@solana/web3.js";
import crypto from "crypto";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";

// Key programs whose accounts form the L2 state
const L2_PROGRAMS = [
  new PublicKey("MythBrdgL2111111111111111111111111111111111"), // Bridge L2
  new PublicKey("HAqTmZbovDrPJP7Ry2httL9rL7hWE2GvJqjMUuxXfy1x"), // AMM
  new PublicKey("6JEsSV6shtnjDeyiNns3wXLDVxe9STiJVBW2yZQhKt5q"), // Launchpad
];

function hashAccount(pubkey: PublicKey, lamports: number, data: Buffer): Buffer {
  const hash = crypto.createHash("sha256");
  hash.update(pubkey.toBuffer());
  const lamportsBuf = Buffer.alloc(8);
  lamportsBuf.writeBigUInt64LE(BigInt(lamports));
  hash.update(lamportsBuf);
  hash.update(data);
  return hash.digest();
}

function buildMerkleRoot(leaves: Buffer[]): Buffer {
  if (leaves.length === 0) {
    // Empty state: hash of zeros
    return crypto.createHash("sha256").update(Buffer.alloc(32)).digest();
  }

  // Sort leaves for deterministic ordering
  leaves.sort((a, b) => a.compare(b));

  let level = leaves;
  while (level.length > 1) {
    const next: Buffer[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left; // duplicate last if odd
      const hash = crypto.createHash("sha256");
      hash.update(left);
      hash.update(right);
      next.push(hash.digest());
    }
    level = next;
  }

  return level[0];
}

export interface StateRootResult {
  root: Buffer;
  accountCount: number;
}

export async function computeStateRoot(
  l2Connection: Connection,
  slot: number
): Promise<StateRootResult> {
  const leaves: Buffer[] = [];

  for (const programId of L2_PROGRAMS) {
    try {
      const accounts = await l2Connection.getProgramAccounts(programId, {
        commitment: "confirmed",
      });

      for (const { pubkey, account } of accounts) {
        const leaf = hashAccount(
          pubkey,
          account.lamports,
          Buffer.from(account.data)
        );
        leaves.push(leaf);
      }
    } catch (err) {
      // Program might not have accounts yet, that's fine
      logger.debug(
        { programId: programId.toBase58(), err },
        "No accounts for program (may not be deployed yet)"
      );
    }
  }

  const root = buildMerkleRoot(leaves);

  logger.info(
    {
      slot,
      accountCount: leaves.length,
      root: root.toString("hex"),
    },
    "Computed state root"
  );

  return { root, accountCount: leaves.length };
}
