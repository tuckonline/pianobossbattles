import type { Exercise } from "../hosted/sight-library";
import "./hand-position-guide.css";

const noteName = (pitch: number) => `${["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"][pitch % 12]}${Math.floor(pitch / 12) - 1}`;
export function HandPositionGuide({ exercise }: { exercise: Exercise }) {
  if (exercise.generatedFingering !== "fixed-position") return null;
  const hands = (["right", "left"] as const).flatMap(hand => {
    const position = exercise.handPositions?.[hand], first = exercise[hand].flat().find(n => !n.rest);
    return position && first ? [{ hand, position, first }] : [];
  });
  if (!hands.length) return null;
  return <details className="hand-position-guide" aria-label="Starting hand position" open>
    <summary>Starting Hand Position — {hands[0].position.name}</summary>
    {hands.map(({ hand, position, first }) => <p key={hand}>
      <strong>{hand === "right" ? "Right hand" : "Left hand"}:</strong>{" "}
      Place finger {hand === "right" ? "1 (thumb)" : "5 (pinky)"} on{" "}
      {position.anchorPitch === 60 ? "Middle C (C4)" : position.anchorPitch === 48 ? "C3, one octave below Middle C" : noteName(position.anchorPitch)}.
      {" "}Your first note is {noteName(first.pitch)}, with finger {first.finger}.
      {position.hint && ` ${position.hint}`}
    </p>)}
    <p>Rest the remaining fingers naturally over the next four notes. Keep this position throughout the exercise.</p>
    <small>Finger numbers guide your technique; finger choice does not affect your score. Select the heading to hide this guide.</small>
  </details>;
}
