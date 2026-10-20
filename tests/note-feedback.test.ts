import { expect, it } from "vitest";
import { assessPractice, sightLibrary } from "../hosted/sight-library";

it("marks only missing chord tones red, then replaces red with green on correction", () => {
  const ex = sightLibrary[0]; // C3 + C4, then D3 + D4.
  expect(assessPractice(ex, "both", []).feedback).toEqual([]);
  const partial = assessPractice(ex, "both", [48, 61]);
  expect(partial.feedback).toEqual([
    { beat: 0, pitch: 48, status: "correct" },
    { beat: 0, pitch: 60, status: "incorrect" },
  ]);
  const fixed = assessPractice(ex, "both", [48, 61, 60]);
  expect(fixed.feedback.every((n) => n.status === "correct")).toBe(true);
  expect(fixed.mistakes).toBe(1);
  expect(fixed.cursor).toBe(1);
  expect(fixed.feedback.some((n) => n.beat > 0)).toBe(false);
});

it("keeps repeated pitches at different beats and selected hands independent", () => {
  const ex = sightLibrary[0];
  const state = assessPractice(ex, "right", [61, 60, 62]);
  expect(state.feedback).toEqual([
    { beat: 0, pitch: 60, status: "correct" },
    { beat: 4, pitch: 62, status: "correct" },
  ]);
  expect(assessPractice(ex, "right", []).feedback).toEqual([]);
});
