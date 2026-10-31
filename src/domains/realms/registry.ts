import type { Realm, RealmProgress } from "./types";
export const clockworkKingdom: Realm = {
  id: "clockwork-kingdom",
  title: "The Clockwork Kingdom",
  description:
    "A silent kingdom waits for its pulse. Restore five mechanisms, then awaken the throne of time.",
  challenges: [
    {
      id: "steady-pulse",
      title: "The Steady Pulse",
      subtitle: "Quarter notes & a steady beat",
      kind: "tempo",
      objective: "Finish with at least 70% pitch and rhythm accuracy.",
      requires: [],
      level: 1,
      measures: 8,
      hands: "right",
      reward: "Pulse Spark",
    },
    {
      id: "broken-clockwork",
      title: "Broken Clockwork",
      subtitle: "Eighth notes & continuity",
      kind: "streak",
      objective:
        "Reach an 8-note timed streak and 70% pitch and rhythm accuracy.",
      requires: ["steady-pulse"],
      level: 2,
      measures: 8,
      hands: "right",
      streak: 8,
      reward: "Brass Gear",
    },
    {
      id: "syncopation-trap",
      title: "The Syncopation Trap",
      subtitle: "Dotted rhythm & offbeats",
      kind: "precision",
      objective:
        "Reach 70% pitch and rhythm accuracy through dotted and offbeat phrases.",
      requires: ["broken-clockwork"],
      level: 3,
      measures: 8,
      hands: "right",
      reward: "Pendulum Shard",
    },
    {
      id: "hands-of-time",
      title: "Hands of Time",
      subtitle: "Two staves, one pulse",
      kind: "coordination",
      objective: "Reach 70% accuracy on each staff and 70% rhythm accuracy.",
      requires: ["syncopation-trap"],
      level: 2,
      measures: 8,
      hands: "both",
      reward: "Twin Keys",
    },
    {
      id: "perfect-mechanism",
      title: "The Perfect Mechanism",
      subtitle: "Four phrases to restore",
      kind: "phrase",
      objective:
        "Earn 3 of 4 phrase crystals with 70% pitch and rhythm accuracy.",
      requires: ["hands-of-time"],
      level: 3,
      measures: 16,
      hands: "both",
      crystals: 3,
      reward: "Harmony Crystal",
    },
    {
      id: "clockwork-king",
      title: "The Clockwork King",
      subtitle: "The Grand Trial of Time",
      kind: "boss",
      objective:
        "Master 3 of 4 phases and finish with 70% pitch and rhythm accuracy.",
      requires: [
        "steady-pulse",
        "broken-clockwork",
        "syncopation-trap",
        "hands-of-time",
        "perfect-mechanism",
      ],
      level: 3,
      measures: 32,
      hands: "both",
      reward: "Crown of Harmony",
    },
  ],
};
export const realms = [clockworkKingdom];
export function challengeById(id: string) {
  const challenge = realms
    .flatMap((r) => r.challenges)
    .find((c) => c.id === id);
  if (!challenge) throw Error("Unknown musical challenge.");
  return challenge;
}
export const emptyProgress = (): RealmProgress => ({
  version: 1,
  challenges: {},
  rewards: [],
  bossDefeated: false,
});
export function unlocked(id: string, progress: RealmProgress) {
  return challengeById(id).requires.every(
    (prerequisite) => progress.challenges[prerequisite]?.completed,
  );
}
