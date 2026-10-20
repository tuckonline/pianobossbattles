// Presentation tuning only. These values never enter the evaluator/reducer.
export type ReactionWeight='light'|'medium'|'heavy';
export const combatMotion={
  hitStop:{light:12,medium:32,signature:72,bossHeavy:80},
  player:{reactionPeakMs:65,recoveryMs:145,launch:'cubic-bezier(.32,0,.18,1)',settle:'cubic-bezier(.2,.65,.3,1)'},
  boss:{reactionPeakMs:115,recoveryMs:245,launch:'cubic-bezier(.55,.02,.32,1)',settle:'cubic-bezier(.24,.48,.32,1)'},
};
export function reactionMotion(side:'player'|'boss',weight:ReactionWeight='light',pressure=1){
  const profile=combatMotion[side],factor=weight==='heavy'?1.6:weight==='medium'?1.1:.65;
  return {...profile,force:factor*(1+Math.min(4,Math.max(0,pressure-1))*.06),
    durationMs:side==='boss'?(weight==='heavy'?360:weight==='medium'?270:210):(weight==='heavy'?300:180),
    recoveryMs:profile.recoveryMs*(weight==='heavy'?1.15:weight==='light'?.7:1)};
}
