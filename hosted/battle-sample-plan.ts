import catalog from './battle-samples.json';
import type {BattleSound} from './battle-audio';
export {catalog as battleSampleCatalog};
export type SampleId=keyof typeof catalog;
export type SampleLayer={sample:SampleId;gain:number;vocal?:boolean};
const primary:Partial<Record<BattleSound,SampleId[]>>={
  heroSwing:['blade-swing','blade-swing','blade-flourish'],
  bossSwing:['claw-snap','fire-sweep'],
  heroImpact:['blade-metal','blade-cut','blade-steel','blade-thud'],
  hurt:['body-hit','armour-steel','armour-metal','armour-thump'],
  heavy:['crush','fire-sweep'],power:['azure-flourish','azure-ice'],
  victory:['victory-shimmer'],defeat:['defeat-fire'],
};
// Variations advance only for played cues. Vocal accents are additionally rate
// limited by the engine, never attached to every evaluated note.
export function battleSamplePlan(kind:BattleSound,index:number,bossId='crimson_musical_colossus'):SampleLayer[]{
  if(bossId==='grinwick'){
    const own:Partial<Record<BattleSound,SampleLayer[]>>={
      bossSwing:[{sample:'grin-swipe',gain:.8}],hurt:[{sample:'grin-impact',gain:1},{sample:'hero-gasp',gain:.3,vocal:true}],
      heavy:[{sample:'grin-pounce',gain:1},{sample:'grin-frenzy',gain:.5}],
      pressureTaunt:[{sample:'grin-cackle',gain:.7,vocal:true}],pressureTension:[{sample:'grin-frenzy',gain:.5}],
      victory:[{sample:'victory-shimmer',gain:.8},{sample:'grin-hurt',gain:.5,vocal:true}],
      defeat:[{sample:'grin-frenzy',gain:.8},{sample:'grin-cackle',gain:.65,vocal:true}],
    };
    if(own[kind])return own[kind]!;
    if(kind==='heroImpact')return [{sample:primary.heroImpact![index%4],gain:1},...(index%3===2?[{sample:'grin-hurt' as SampleId,gain:.38,vocal:true}]:[])];
  }
  if(kind==='pressureTaunt')return [{sample:'boss-exhale',gain:.35}];
  const choices=primary[kind];if(!choices)return [];
  const layers:SampleLayer[]=[{sample:choices[index%choices.length],gain:1}];
  if(kind==='heroImpact'&&index%3===2)layers.push({sample:(['boss-exhale','boss-pain','boss-raptor'] as const)[Math.floor(index/3)%3],gain:.38,vocal:true});
  if(kind==='hurt')layers.push({sample:index%2?'hero-gasp':'hero-effort',gain:.38,vocal:true});
  if(kind==='heavy')layers.push({sample:'orc-effort',gain:.35,vocal:true});
  if(kind==='defeat')layers.push({sample:'defeat-growl',gain:.45,vocal:true});
  return layers;
}
