import {z} from 'zod';
import type {BossBattleConfig} from './boss-config';
export const playerAudioSchema=z.object({mode:z.enum(['focus','immersive','cinematic']),volume:z.number().min(0).max(.2)});
export type PlayerAudio=z.infer<typeof playerAudioSchema>;
export const defaultPlayerAudio:PlayerAudio={mode:'focus',volume:.08};
export function inheritedPlayerAudio(config:BossBattleConfig):PlayerAudio {
  return {mode:config.audioOutput==='practice'&&config.soundEnabled?'cinematic':'focus',volume:config.volume};
}
export function selectPlayerAudio(mode:PlayerAudio['mode'],previous:PlayerAudio):PlayerAudio {
  return {mode,volume:mode==='focus'?previous.volume:mode==='immersive'?.04:.08};
}
// This is only the local engine configuration. Never publish it to OBS or mutate
// the authoritative battle config; OBS keeps its independent enabled/volume mix.
export function playerAudioConfig(config:BossBattleConfig,preference:PlayerAudio):BossBattleConfig {
  return {...config,soundEnabled:config.audioOutput==='practice'&&preference.mode!=='focus',volume:preference.volume};
}
