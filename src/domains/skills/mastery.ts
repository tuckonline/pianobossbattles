export interface MasteryEvidence {
  skillId: string;
  score: number;
  occurredAt: Date;
  seconds: number;
}
export interface MasteryState {
  mastery: number;
  confidence: number;
  exposures: number;
  successes: number;
  failures: number;
  lastPracticed: Date | null;
  nextReview: Date | null;
  trend: number[];
}
export interface MasteryService {
  update(previous: MasteryState, evidence: MasteryEvidence): MasteryState;
}
// The final pedagogical algorithm is intentionally not selected in the platform foundation.
export class ExposureOnlyMastery implements MasteryService {
  update(previous: MasteryState, evidence: MasteryEvidence): MasteryState {
    return {
      ...previous,
      exposures: previous.exposures + 1,
      lastPracticed: evidence.occurredAt,
    };
  }
}
