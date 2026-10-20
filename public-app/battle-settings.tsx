import { bossDifficulties, bossDifficultyLabel, type BossBattleConfig } from "../hosted/boss-config";
import { battleMusicalBeats, countdownLabel, gameModeRegistry, timerAllowances, usesProgressiveTempo } from "../hosted/battle-modes";
import { createBattle } from "../hosted/boss-battle";
import { exerciseChain, type ChainEntry } from "../hosted/schmitt-chain";
import { practicePass, type Hand } from "../hosted/sight-library";

export const timePressures = timerAllowances.slice(0, 3).map((preset, i) => ({ label: ["Relaxed", "Normal", "Tight"][i], multiplier: preset.multiplier }));
const pressureLabel = (value: number) => timePressures.find(p => p.multiplier === value)?.label ?? `Custom (${value}×)`;
export function modeCapabilities(config: BossBattleConfig) {
  return config.enabled ? gameModeRegistry[config.gameMode] : { health: false, timed: false };
}
export function modeSettingSummary(config: BossBattleConfig, hand: Hand) {
  const { health, timed } = modeCapabilities(config);
  return [
    ...(!config.enabled ? [{ label: "Pacing", value: "Self-Paced" }] : []),
    ...(health ? [{ label: "Combat Difficulty", value: bossDifficultyLabel(config.bossDamagePerMistake) }] : []),
    ...(timed && config.explicitTimeLimitSeconds ? [{ label: "Manual time limit", value: `${config.explicitTimeLimitSeconds} seconds per loop` }] : timed ? [
      { label: "Target BPM", value: usesProgressiveTempo(config) ? "60 → 80 → 110 → 140 BPM" : `${config.selectedBpm} BPM` },
      { label: "Time Pressure", value: pressureLabel(config.allowanceMultiplier) },
    ] : []),
    { label: "Hands", value: hand === "both" ? "Both hands" : hand === "left" ? "Left hand" : "Right hand" },
  ];
}
// Use the same chain durations, cadence rules and timer preparation as startRun.
// This is a static estimate; only the existing gameplay owner runs the clock.
export function modeTimePreview(config: BossBattleConfig, entries: ChainEntry[], hand: Hand) {
  if (!modeCapabilities(config).timed || !entries.length) return undefined;
  const chain = exerciseChain(entries, hand), first = chain.plan[0];
  const timer = createBattle(config, chain.notes, false, chain.beats, chain.loops,
    battleMusicalBeats(practicePass(first.exercise, first.loops > 1))).timer!;
  return { label: usesProgressiveTempo(config) ? "First-loop allowance" : "Time allowance", value: timer.issue ?? countdownLabel(timer.limitMs) };
}
export function BattleSettings({ config, hand, update, onHandChange }: {
  config: BossBattleConfig; hand: Hand; update: (patch: Partial<BossBattleConfig>) => void; onHandChange: (hand: Hand) => void;
}) {
  const { health, timed } = modeCapabilities(config);
  const progressive = usesProgressiveTempo(config);
  const difficulties = bossDifficulties.filter(d => d.damage <= 10 || d.damage === config.bossDamagePerMistake);
  return <>
    <div className="settings-row" role="group" aria-label="Battle settings">
      <div className="section-label"><span className="section-number">2</span><b>Battle settings</b><small>Fine-tune the challenge.</small></div>
      <div className="compact-fields">
        {health && <label>Combat Difficulty<select value={config.bossDamagePerMistake} onChange={e => update({ bossDamagePerMistake: Number(e.target.value) })}>
          {!difficulties.some(d => d.damage === config.bossDamagePerMistake) && <option value={config.bossDamagePerMistake}>Custom (saved)</option>}
          {difficulties.map(d => <option key={d.damage} value={d.damage}>{d.label}{d.damage > 10 ? " (saved)" : ""}</option>)}
        </select></label>}
        {timed && <>
          <label>Target BPM<input type="number" min={20} max={300} disabled={progressive || !!config.explicitTimeLimitSeconds} aria-describedby="tempo-help" value={progressive ? 60 : config.selectedBpm} onChange={e => update({ selectedBpm: Math.min(300, Math.max(20, Math.round(Number(e.target.value) || 60))) })}/></label>
          <label>Time Pressure<select disabled={!!config.explicitTimeLimitSeconds} value={config.allowanceMultiplier} onChange={e => update({ allowanceMultiplier: Number(e.target.value) })}>
            {!timePressures.some(p => p.multiplier === config.allowanceMultiplier) && <option value={config.allowanceMultiplier}>{pressureLabel(config.allowanceMultiplier)}</option>}
            {timePressures.map(p => <option key={p.multiplier} value={p.multiplier}>{p.label}</option>)}
          </select></label>
        </>}
        <label>Hands<select value={hand} onChange={e => onHandChange(e.target.value as Hand)}><option value="both">Both hands</option><option value="right">Right hand</option><option value="left">Left hand</option></select></label>
      </div>
    </div>
    <small id="tempo-help" className="tempo-help">{!config.enabled ? "Self-paced. Wait for each correct note; mistakes affect accuracy, not HP." : config.gameMode === "survival" ? "Finish the music with HP remaining. No time limit." : config.gameMode === "ultimateBoss" ? "Finish the entire setlist before time expires, with HP remaining. Existing shields and boss enrage still apply." : "Target tempo and time pressure set the allowance for your music."}{progressive && " Each loop advances from Easy to Normal to Hard to Expert; your fixed BPM is retained."}</small>
    {timed && !!config.explicitTimeLimitSeconds && <p className="tempo-help">Saved manual limit: {config.explicitTimeLimitSeconds} seconds per loop. This overrides BPM and Time Pressure. <button onClick={() => update({ explicitTimeLimitSeconds: 0 })}>Use BPM-based timing</button></p>}
    {config.enabled && config.gameMode === "timeAttack" && <label className="check tempo-progression"><input type="checkbox" checked={config.progressiveTempo} onChange={e => update({ progressiveTempo: e.target.checked })}/>Easy → Normal → Hard → Expert across loops</label>}
  </>;
}
