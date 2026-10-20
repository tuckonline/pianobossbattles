import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { cinematicDefinitions, cinematicAssets } from '../hosted/cinematic-presentation';

// Exact visual source: verified pre-V11 commit 6e8a8c6, not newly drawn assets.
for (const [name, blob] of Object.entries({
  'hero-finish.png':'07eff82f637d7a852779db5e8a039e8628920cf0',
  'hero-defeated.png':'de53025bd900678fb7298673bb87510516936aba',
  'boss-dominant.png':'7adb51854535d12ce20fb5d322a9fe4c1cb16f20',
  'boss-fallen.png':'7628d7a8437c5b64498749c96b8f84f8d28d55d0',
})) it(`${name} is byte-identical to the original Git artwork`,()=>{
  const bytes=readFileSync(`hosted/public/battle/cinematics/${name}`);
  expect(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')).toBe(blob);
  expect(Object.values(cinematicAssets)).toContain(`/battle/cinematics/${name}`);
});

for(const [result,title,points] of [
  ['victory','BOSS DEFEATED',[0,500,1000,1700,2300,4400,4800]],
  ['defeat','YOU WERE DEFEATED',[0,400,800,1350,1950,3700,4100]],
  ['timeout','TIME OUT',[0,100,450,550,700,2750,3100]],
] as const) it(`${result} retains the original title and every timing boundary`,()=>{
  const definition=cinematicDefinitions[result];
  expect(definition.title).toBe(title);
  expect([...definition.stages.map(stage=>stage.startMs),definition.durationMs]).toEqual(points);
  expect(definition.stages.at(-1)?.id).toBe('result'); // The original exit is now a persistent final frame.
  expect(definition.assets).not.toContain('/battle/cinematics/hero-victory.png');
});

it('original typography, effects, staging and TIME OUT styling are unchanged',()=>{
  const css=readFileSync('hosted/battle-cinematic.css','utf8').replace(/\r\n/g,'\n');
  const original=css.replace('.battle-cinematic[data-phase=holding],.battle-cinematic[data-phase=holding] *{will-change:auto}','').trimEnd();
  expect(createHash('sha256').update(original).digest('hex')).toBe('65e9ea7a4f6e9382bc6b5c32a50c6a4ff3e8386ba75b8c21cecde6fcb5de0aea');
});
