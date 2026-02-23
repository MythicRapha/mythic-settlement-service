import dotenv from "dotenv";
import path from "path";

dotenv.config();

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return val;
}

export const config = {
  l2RpcUrl: requireEnv("L2_RPC_URL"),
  l1RpcUrl: requireEnv("L1_RPC_URL"),
  settlementProgramId: requireEnv("SETTLEMENT_PROGRAM_ID"),
  authorityKeypairPath: requireEnv("AUTHORITY_KEYPAIR_PATH"),
  dbPath: process.env.DB_PATH || "./data/settlement.db",
  slotsPerSettlement: parseInt(process.env.SLOTS_PER_SETTLEMENT || "100", 10),
  logLevel: process.env.LOG_LEVEL || "info",
};
