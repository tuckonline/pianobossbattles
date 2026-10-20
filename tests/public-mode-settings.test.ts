import { expect, it } from 'vitest';
import { modeSettingSummary, modeTimePreview, timePressures } from '../public-app/battle-settings';
import { defaultBossBattleConfig } from '../hosted/boss-config';
import { schmittLibrary } from '../hosted/schmitt-library';
import { battleMusicalBeats } from '../hosted/battle-modes';
const config={...defaultBossBattleConfig,enabled:true};
it('mode summaries omit hidden selections, preserving original settings',()=>{
 const saved={...config,gameMode:'ultimateBoss' as const,selectedBpm:80,bossDamagePerMistake:6,allowanceMultiplier:1.3,progressiveTempo:true};
 const before=structuredClone(saved);
 expect(modeSettingSummary({...saved,enabled:false},'both')).toEqual([{label:'Pacing',value:'Self-Paced'},{label:'Hands',value:'Both hands'}]);
 expect(modeSettingSummary({...saved,gameMode:'survival'},'left')).toEqual([{label:'Combat Difficulty',value:'Hard'},{label:'Hands',value:'Left hand'}]);
 expect(modeSettingSummary({...saved,gameMode:'timeAttack'},'both').map(s=>s.label)).toEqual(['Target BPM','Time Pressure','Hands']);
 expect(modeSettingSummary(saved,'both')).toContainEqual({label:'Target BPM',value:'80 BPM'});
 expect(modeSettingSummary(saved,'both')).toContainEqual({label:'Time Pressure',value:'Normal'});
 expect(saved).toEqual(before);
});
it('preview allowance includes every exercise and loop, at each existing time pressure',()=>{
 const entries=[{exercise:schmittLibrary[6],loops:2},{exercise:schmittLibrary[7],loops:3}];
 const beats=entries.reduce((sum,e)=>sum+battleMusicalBeats(e.exercise,e.loops)!,0);
 for(const gameMode of ['timeAttack','ultimateBoss'] as const)for(const p of timePressures){
  const seconds=Math.ceil(beats*60/80*p.multiplier);
  expect(modeTimePreview({...config,gameMode,selectedBpm:80,allowanceMultiplier:p.multiplier},entries,'both')).toEqual({label:'Time allowance',value:`${Math.floor(seconds/60).toString().padStart(2,'0')}:${(seconds%60).toString().padStart(2,'0')}`});
 }
 expect(modeTimePreview(config,entries,'both')).toBeUndefined();
 expect(modeTimePreview({...config,enabled:false,gameMode:'ultimateBoss'},entries,'both')).toBeUndefined();
});
it('manual and progressive timing are labelled honestly without erasing saved preferences',()=>{
 const manual={...config,gameMode:'timeAttack' as const,explicitTimeLimitSeconds:31};
 expect(modeSettingSummary(manual,'both')[0]).toEqual({label:'Manual time limit',value:'31 seconds per loop'});
 expect(modeTimePreview(manual,[{exercise:schmittLibrary[0],loops:3}],'both')?.value).toBe('01:33');
 expect(modeTimePreview({...manual,explicitTimeLimitSeconds:0,progressiveTempo:true},[{exercise:schmittLibrary[0],loops:3}],'both')?.label).toBe('First-loop allowance');
});
