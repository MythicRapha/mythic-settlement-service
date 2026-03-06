import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import fs from "fs";
import crypto from "crypto";
import { config } from "./config/index.js";
import { logger } from "./utils/logger.js";
import {
  getLastStateRoot,
  setLastPostedSlot,
  setLastStateRoot,
  recordPostedRoot,
} from "./db/index.js";

const SETTLEMENT_CONFIG_SEED = Buffer.from("settlement_config");
const STATE_ROOT_SEED = Buffer.from("state_root");

let l1Connection: Connection;
let authorityKeypair: Keypair;
let programId: PublicKey;

export function initPoster(): void {
  l1Connection = new Connection(config.l1RpcUrl, "confirmed");
  programId = new PublicKey(config.settlementProgramId);

  const keypairData = JSON.parse(
    fs.readFileSync(config.authorityKeypairPath, "utf-8")
  );
  authorityKeypair = Keypair.fromSecretKey(Uint8Array.from(keypairData));

  logger.info(
    {
      authority: authorityKeypair.publicKey.toBase58(),
      programId: programId.toBase58(),
      l1Rpc: config.l1RpcUrl,
    },
    "Settlement poster initialized"
  );
}

function serializePostStateRootArgs(
  l2Slot: number,
  stateRoot: Buffer,
  transactionCount: number,
  transactionBatchHash: Buffer,
  aiAttestationCount: number,
  previousStateRoot: Buffer
): Buffer {
  // Discriminator (u8): 1
  // l2_slot: u64 LE
  // state_root: [u8; 32]
  // transaction_count: u32 LE
  // transaction_batch_hash: [u8; 32]
  // ai_attestation_count: u16 LE
  // previous_state_root: [u8; 32]
  const buf = Buffer.alloc(1 + 8 + 32 + 4 + 32 + 2 + 32); // 111 bytes
  let offset = 0;

  buf.writeUInt8(1, offset); // discriminator
  offset += 1;

  buf.writeBigUInt64LE(BigInt(l2Slot), offset);
  offset += 8;

  stateRoot.copy(buf, offset);
  offset += 32;

  buf.writeUInt32LE(transactionCount, offset);
  offset += 4;

  transactionBatchHash.copy(buf, offset);
  offset += 32;

  buf.writeUInt16LE(aiAttestationCount, offset);
  offset += 2;

  previousStateRoot.copy(buf, offset);

  return buf;
}

export async function postStateRoot(
  l2Slot: number,
  stateRoot: Buffer,
  txCount: number
): Promise<string> {
  const previousStateRoot = getLastStateRoot();

  // Compute a batch hash (hash of the state root + slot as a simple batch identifier)
  const batchHash = crypto
    .createHash("sha256")
    .update(stateRoot)
    .update(Buffer.from(l2Slot.toString()))
    .digest();

  const instructionData = serializePostStateRootArgs(
    l2Slot,
    stateRoot,
    txCount,
    batchHash,
    0, // ai_attestation_count: 0 for now
    previousStateRoot
  );

  // Derive PDAs
  const [configPda] = PublicKey.findProgramAddressSync(
    [SETTLEMENT_CONFIG_SEED],
    programId
  );

  const l2SlotBytes = Buffer.alloc(8);
  l2SlotBytes.writeBigUInt64LE(BigInt(l2Slot));

  const [stateRootPda] = PublicKey.findProgramAddressSync(
    [STATE_ROOT_SEED, l2SlotBytes],
    programId
  );

  const instruction = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: authorityKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: stateRootPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);

  logger.info(
    {
      l2Slot,
      stateRoot: stateRoot.toString("hex"),
      configPda: configPda.toBase58(),
      stateRootPda: stateRootPda.toBase58(),
    },
    "Submitting PostStateRoot to L1"
  );

  const signature = await sendAndConfirmTransaction(
    l1Connection,
    transaction,
    [authorityKeypair],
    { commitment: "confirmed", skipPreflight: true }
  );

  // Update local state
  setLastPostedSlot(l2Slot);
  setLastStateRoot(stateRoot);
  recordPostedRoot(l2Slot, stateRoot.toString("hex"), txCount, signature);

  logger.info(
    {
      l2Slot,
      signature,
      stateRoot: stateRoot.toString("hex"),
    },
    "State root posted to L1"
  );

  return signature;
}
