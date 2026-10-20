import { expect, it } from 'vitest';
import {deriveProgress, collectionProgress, masteryRule, type ProgressAttempt} from '../hosted/collection-progress';
const now=Date.parse('2026-09-26T12:00:00Z');
const attempt=(day:number,accuracy=95,hand='both',exerciseNumber=1):ProgressAttempt=>({exerciseNumber,accuracy,hand,createdAt:new Date(now-day*86400000).toISOString()});
it('requires three consecutive both-hands successes, ignoring separate-hand practice',()=>{
 expect(deriveProgress([])).toEqual({});
 expect(deriveProgress([attempt(2),attempt(1)],now)[1].state).toBe('learning');
 expect(deriveProgress([attempt(4),attempt(3,94),attempt(2),attempt(1)],now)[1].state).toBe('learning');
 expect(deriveProgress([attempt(3),attempt(2,100,'right'),attempt(2),attempt(1)],now)[1].state).toBe('mastered');
 expect(deriveProgress([attempt(3,100,'left'),attempt(2,100,'right'),attempt(1,100,'left')],now)[1].state).toBe('learning');
});
it('review becomes due at seven days and only qualifying both-hands practice renews it',()=>{
 const history=[attempt(9),attempt(8),attempt(7)];
 expect(deriveProgress(history,now-1)[1].state).toBe('mastered');
 expect(deriveProgress(history,now)[1].state).toBe('due');
 expect(deriveProgress([...history,attempt(0,94)],now)[1].state).toBe('due');
 expect(deriveProgress([...history,attempt(0,100,'left')],now)[1].state).toBe('due');
 expect(deriveProgress([...history,attempt(0)],now)[1].state).toBe('mastered');
});
it('counts exclusive statuses, ignores exercises outside catalogue and supports rule changes',()=>{
 const history=[attempt(3),attempt(2),attempt(1),attempt(1,70,'both',2),attempt(9,95,'both',3),attempt(8,95,'both',3),attempt(7,95,'both',3),attempt(0,100,'both',99)];
 const counts=collectionProgress([1,2,3,4].map(number=>({number})),deriveProgress(history,now),now);
 expect(counts).toEqual({mastered:1,learning:1,due:1,notStarted:1,total:4,percent:25});
 expect(collectionProgress([],{},now).percent).toBe(0);
 expect(deriveProgress([attempt(0)],now,{...masteryRule,consecutivePasses:1})[1].state).toBe('mastered');
});
