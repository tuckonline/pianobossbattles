import { useSyncExternalStore } from "react";
import { gameClient } from "./game-client";
import { bossDifficultyLabel } from "./boss-config";
import {BattleCountdown,ComboPower,ShieldInventory} from './battle-mode-ui';
import {gameModeRegistry,enrageMultipliers} from './battle-modes';
import { BattleHealthBar } from "./boss-ui";
import { usePracticeCinematicActive } from './battle-cinematic-ui';
import {useStoryEvent,BattleStoryNotice} from './battle-story-ui';
import {storySummaryLines} from './battle-story';

const battleSnapshot = () => gameClient.snapshot().battle;

// Subscribe here so HP updates do not rerender the sheet music. The existing
// GamePanel owns connection/recovery; this is a read-only view of that state.
export function PracticeBattleStatus() {
  const battle = useSyncExternalStore(gameClient.subscribe, battleSnapshot);
  const cinematicActive=usePracticeCinematicActive();
  const story=useStoryEvent(battle,cinematicActive);
  if (!battle.config.enabled) return null;
  const { status, result, config } = battle;
  const mode=gameModeRegistry[config.gameMode];
  const outcome = status === "victory" ? "Victory — boss defeated!"
    : status === "defeat" ? result === "abandoned" ? "Battle stopped"
      : result === "unfinished" ? "Exercise finished — boss survived"
      : result === "timeout" ? "Time up — boss survived" : "Defeat — your HP reached 0"
    : status === "paused" ? "Battle paused"
    : battle.waiting ? "Battle begins next attempt"
    : status === "active" ? "Battle in progress"
    : "Ready to battle";
  return <section className="practice-battle-status" aria-label="Practice battle status"
    data-score-occlusion data-battle-status={status}>
    <div className="practice-battle-outcome">
      <span>{mode.title}</span>
      {!cinematicActive&&(story?<BattleStoryNotice event={story}/>:<strong role="status">{outcome}</strong>)}
      {!cinematicActive&&battle.story?.summary&&<small>{storySummaryLines(battle.story).join(' · ')}</small>}
      {config.multiRoundEnabled&&battle.round&&<small>{battle.exerciseEnded?'Battle complete · ':`Round ${battle.round.number} · `}{battle.roundWins??0} victories / {battle.roundLosses??0} defeats</small>}
    </div>
    <div className="practice-battle-player">{mode.health&&<BattleHealthBar label="Your HP" hp={battle.playerHp} max={config.playerMaxHp} side="player" />}
      {battle.timer&&<BattleCountdown timer={battle.timer}/>}{mode.shields&&<ShieldInventory count={battle.shields??0}/>}</div>
    <BattleHealthBar label="Boss HP" hp={battle.bossHp} max={battle.bossMaxHp} side="boss" />
    <div className="practice-battle-difficulty">
      <strong>{bossDifficultyLabel(config.bossDamagePerMistake)}</strong>
      <span>{mode.health?`−${Math.min(config.playerMaxHp,Math.ceil(config.bossDamagePerMistake*(mode.enrage?enrageMultipliers[battle.phase??'normal']:1)))} HP per mistake${mode.enrage?` · ${battle.phase}`:''}`:'Mistakes cost time only'}</span>
      <ComboPower battle={battle}/>
    </div>
  </section>;
}
