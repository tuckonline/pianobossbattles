import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {battleSampleCatalog,battleSamplePlan} from '../hosted/battle-sample-plan';
import approvals from './fixtures/sonniss-approvals.json';
import type {BattleSound} from '../hosted/battle-audio';

describe('approved production sounds',()=>{
  it('ships only approved, traceable edits with bounded duration, level and clean edges',()=>{
    expect(Object.keys(battleSampleCatalog)).toHaveLength(30);
    for(const sample of Object.values(battleSampleCatalog)){
      if(sample.url.startsWith('/audio/grinwick/')){expect(sample.approval).toBe('Grinwick implementation: user authorized library selection');expect(sample.sourceSha256).toMatch(/^[a-f0-9]{64}$/);}else expect(approvals.find(a=>a.id===sample.approval)).toMatchObject({status:'approved',source_sha256:sample.sourceSha256});
      const file=readFileSync(`hosted/public${sample.url}`);
      expect(createHash('sha256').update(file).digest('hex')).toBe(sample.sha256);
      expect(file.toString('ascii',0,4)).toBe('RIFF');expect(file.readUInt32LE(24)).toBe(48000);
      expect(file.readUInt16LE(22)).toBe(1);expect(file.readUInt16LE(34)).toBe(16);
      const samples=Array.from({length:(file.length-44)/2},(_,i)=>file.readInt16LE(44+i*2)/32768);
      expect(samples.length/48000).toBeCloseTo(sample.duration,5);expect(sample.duration).toBeLessThanOrEqual(1.45);
      expect(Math.max(...samples.map(Math.abs))).toBeLessThanOrEqual(.502);
      expect(Math.sqrt(samples.reduce((sum,v)=>sum+v*v,0)/samples.length)).toBeLessThanOrEqual(.080);
      expect(samples[0]).toBe(0);expect(samples.at(-1)).toBe(0);
    }
  });
  it('uses every approved edit, rotates variants and keeps TIME OUT unchanged',()=>{
    const kinds:BattleSound[]=['heroSwing','bossSwing','heroImpact','hurt','heavy','power','victory','defeat','timeout'];
    const used=new Set(['crimson_musical_colossus','grinwick'].flatMap(b=>kinds.flatMap(k=>Array.from({length:12},(_,i)=>battleSamplePlan(k,i,b)).flat().map(l=>l.sample))));
    expect([...used].sort()).toEqual(Object.keys(battleSampleCatalog).sort());
    expect(battleSamplePlan('timeout',0)).toEqual([]);
    expect(battleSamplePlan('heroImpact',0)).not.toEqual(battleSamplePlan('heroImpact',1));
    expect(battleSamplePlan('heroImpact',0)).toHaveLength(1);
    expect(battleSamplePlan('heroImpact',2).find(l=>l.vocal)?.gain).toBeLessThan(.5);
  });
});
