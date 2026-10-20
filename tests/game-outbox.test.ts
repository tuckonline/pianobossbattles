import { expect, it } from "vitest";
import { readOutbox, recoveryReceipts } from "../hosted/game-outbox";
import type { GameSync } from "../hosted/game-sync";
const receipt = (status: GameSync["status"] = "playing"): GameSync => ({
  action: "gameSync",
  attemptId: crypto.randomUUID(),
  sessionId: crypto.randomUUID(),
  exerciseNumber: 11001,
  hand: "both",
  omitClosing: false,
  played: [60, 48],
  sequence: 8,
  status,
  activeMs: 1200,
});
it("upgrades legacy journals and preserves notes without inventing completion", () => {
  const item = receipt();
  const recovered = recoveryReceipts(readOutbox(JSON.stringify([item])));
  expect(recovered).toEqual([{ ...item, status: "abandoned", sequence: 9 }]);
});
it("a second crash replays exactly the same recovery sequence", () => {
  const item = receipt("paused");
  const pending = recoveryReceipts({
    version: 2,
    pending: [item],
    checkpoint: item,
  });
  expect(recoveryReceipts({ version: 2, pending, checkpoint: null })).toEqual(
    pending,
  );
});
it("keeps the newest occurrence snapshot and completed rewards eligible", () => {
  const item = receipt("completed");
  expect(
    recoveryReceipts({
      version: 2,
      pending: [item],
      checkpoint: { ...item, sequence: 7, status: "playing" },
    }),
  ).toEqual([item]);
});
it("rejects corrupted journals rather than silently replacing them", () => {
  expect(() => readOutbox("broken")).toThrow();
  expect(() =>
    readOutbox(JSON.stringify([{ ...receipt(), played: [256] }])),
  ).toThrow();
});
