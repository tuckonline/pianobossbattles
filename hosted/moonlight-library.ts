import type { Exercise } from './sight-library';
import lessons from './data/moonlight.json' with { type: 'json' };

export type MoonlightLesson = Exercise & {
  courseStage: 'Prepare' | 'Short passages' | 'Connect' | 'Finale' | 'Custom passage';
  sourceMeasures: [number, number] | null;
};
export const moonlightLibrary = lessons as MoonlightLesson[];
