/* eslint-disable @next/next/no-img-element -- Local game portraits. */
import {bossProfiles,type BossId} from './boss-registry';
import type {BossBattleConfig} from './boss-config';
import type {BattleView} from './boss-battle';
export function BossSelector({config,battle,disabled,onChange}:{config:BossBattleConfig;battle:BattleView;disabled:boolean;onChange:(config:BossBattleConfig)=>void}){
 const locked=disabled||battle.status==='active'||battle.status==='paused'||!!battle.countdown&&!battle.countdown.releasedAt;
 return <fieldset disabled={locked} className="boss-selector"><legend>Select Boss</legend>{Object.entries(bossProfiles).map(([id,boss])=><label key={id} className={config.bossId===id?'selected':''}><input type="radio" name="selected-boss" value={id} checked={config.bossId===id} onChange={()=>onChange({...config,bossId:id as BossId})}/><img src={boss.portrait} alt=""/><span><strong>{boss.name}</strong><small>{boss.description}</small></span></label>)}{locked&&<small>Boss selection is locked for this attempt.</small>}</fieldset>;
}
