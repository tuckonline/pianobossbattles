import type { Exercise } from "../../../hosted/sight-library";
export type MusicCatalogItem = {
  id: string; title: string; composer?: string; category: "song" | "exercise";
  difficulty?: number; difficultyLabel?: string; key?: string; tempo?: number;
  accessType: "starter" | "legacy" | "purchasable" | "imported" | "generated";
  goldPrice?: number; exerciseNumber?: number; ownerId?: string;
  collection: string; sourceUrl?: string; available: boolean;
};
// Metadata only. Full scores live in the server bundle and are authorized on load.
export const royalCatalog: MusicCatalogItem[] = [
  { id: "behr-in-may", title: "In May", composer: "Franz Behr", category: "song", difficulty: 2, key: "C major", tempo: 65, accessType: "purchasable", goldPrice: 150, collection: "Royal repertoire", available: true, sourceUrl: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2155" },
  { id: "czerny-op821-2", title: "Eight-Measure Exercise, Op. 821 No. 2", composer: "Carl Czerny", category: "exercise", difficulty: 3, key: "C major", tempo: 60, accessType: "purchasable", goldPrice: 200, collection: "Royal repertoire", available: true, sourceUrl: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=2061" },
];
export function hasMusicAccess(item: MusicCatalogItem, owned: readonly string[], userId: string) {
  if (!item.available) return false;
  if (item.accessType === "purchasable") return owned.includes(item.id);
  if (item.accessType === "imported") return item.ownerId === userId;
  return true;
}
export function legacyMusicItem(e: Exercise & { available: boolean }): MusicCatalogItem {
  const starter = e.collection === "beginner-pieces" || e.collection === "classical-foundations";
  return { id: `legacy:${e.number}`, title: e.title ?? `Exercise ${e.number}`, composer: e.composer,
    category: ["beginner-pieces", "repertoire", "bach", "moonlight"].includes(e.collection ?? "") ? "song" : "exercise",
    difficultyLabel: e.difficulty, tempo: e.tempoBpm, accessType: starter ? "starter" : "legacy",
    exerciseNumber: e.number, collection: e.collection ?? "sight-reading", available: e.available };
}
