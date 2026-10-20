import seed from "./catalog-seed.json";
import { sightLibrary, type Exercise } from "../hosted/sight-library";
import { practiceLibrary } from "../hosted/practice-library";
import { classicalLibrary } from "../hosted/classical-library";
import { moonlightLibrary } from "../hosted/moonlight-library";
import { scalesLibrary } from "../hosted/scales-library";
import burgmuller from "../hosted/data/burgmuller-op100.json";

// Authoring definitions from versioned source only; no original player data.
export const catalog: Exercise[] = [...new Map(
  [...sightLibrary, ...practiceLibrary, ...classicalLibrary, ...moonlightLibrary, ...scalesLibrary,
    ...(burgmuller as Exercise[]), ...(seed as Exercise[])].map(e => [e.number, e]),
).values()];
