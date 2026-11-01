import type { MidiEvent } from "../blocks/schema";

export const goldRules = {
  goldPerHour: 50,
  millisecondsPerGold: 72000,
  idleGapMs: 10000,
  saveIntervalMs: 15000,
  firstTrial: 2,
  firstBoss: 5,
} as const;
export type GoldAward = { amount: number; reason: string };
export type EconomySnapshot = { version: 1; revision: number; gold: number; owned: string[]; practiceMs?: number };
export type EconomyState = EconomySnapshot & { practiceMs: number; milestones: string[] };
export const emptyEconomy = (): EconomyState => ({ version: 1, revision: 0, gold: 0, owned: [], practiceMs: 0, milestones: [] });
export const publicEconomy = ({ version, revision, gold, owned, practiceMs }: EconomyState): EconomySnapshot =>
  ({ version, revision, gold, owned, practiceMs });

// Carry fractional gold between checkpoints and exercises. No completion bonus,
// score threshold, replay penalty or per-note multiplier affects practice pay.
export function creditPractice(state: EconomyState, activeMs: number): number {
  if (!Number.isSafeInteger(activeMs) || activeMs < 0) throw Error("Invalid practice duration");
  const before = Math.floor(state.practiceMs / goldRules.millisecondsPerGold);
  state.practiceMs += activeMs;
  const earned = Math.floor(state.practiceMs / goldRules.millisecondsPerGold) - before;
  state.gold += earned;
  return earned;
}
export function creditMilestone(state: EconomyState, challengeId: string, boss: boolean, passed: boolean): GoldAward {
  if (!passed || state.milestones.includes(challengeId))
    return { amount: 0, reason: "Practice gold saves separately as you play. This milestone has no new bonus." };
  const amount = boss ? goldRules.firstBoss : goldRules.firstTrial;
  state.milestones.push(challengeId);
  state.gold += amount;
  return { amount, reason: "One-time first-clear bonus. Practice gold saves separately as you play." };
}

// A small activity meter, independent of grading. Count elapsed time between
// real MIDI strikes/releases, once for both hands. Never extrapolate after a
// final event; ignore long idle gaps, pedal messages and unmatched releases.
export class PracticeActivity {
  private last: number | undefined;
  private held = new Set<string>();
  reset() { this.last = undefined; this.held.clear(); }
  record(event: MidiEvent, now: number): number {
    if (!Number.isFinite(now) || event.pitch === undefined) return 0;
    const key = `${event.channel}:${event.pitch}`;
    if (event.type === "NOTE_ON" && event.velocity) {
      if (this.held.has(key)) return 0;
      this.held.add(key);
    } else if (event.type === "NOTE_OFF") {
      if (!this.held.delete(key)) return 0;
    } else return 0;
    if (this.last !== undefined && now < this.last) return 0;
    const gap = this.last === undefined ? 0 : now - this.last;
    this.last = now;
    return gap <= goldRules.idleGapMs ? gap : 0;
  }
}
