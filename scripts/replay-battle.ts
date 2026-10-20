import {readFile} from 'node:fs/promises';
import {parseBattleTrace,measureBattleTrace} from '../hosted/battle-replay';
const path=process.argv[2];
if(!path)throw Error('Usage: npx tsx scripts/replay-battle.ts <practice-recording.json>');
const trace=parseBattleTrace(await readFile(path,'utf8'));
console.log(JSON.stringify(measureBattleTrace(trace),null,2));
