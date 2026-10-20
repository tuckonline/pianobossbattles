import { z } from "zod";
import {storyViewSchema} from './battle-story';
import { bossConfigSchema } from "./boss-config";
const roundSchema=z.object({id:z.string().max(100),attemptId:z.string().max(50),number:z.number().int().positive(),
  playerMaxHp:z.number().int().min(1).max(10000),playerHp:z.number().int().min(0).max(10000),bossMaxHp:z.number().int().min(1).max(10000000),bossHp:z.number().int().min(0).max(10000000),
  status:z.enum(['active','paused','ended']),startedAt:z.number(),endedAt:z.number().optional(),result:z.enum(['victory','defeat','unfinished','abandoned']).optional(),startRevision:z.number().int().nonnegative(),endRevision:z.number().int().nonnegative().optional()});
const noteCue=z.object({id:z.string().max(200),groupId:z.string().max(120),revision:z.number().int().min(1),
  firstAt:z.number(),lastAt:z.number(),readyAt:z.number(),pitches:z.array(z.number().int().min(0).max(127)).min(1).max(128),
  hits:z.number().int().min(1).max(128),expectedSize:z.number().int().min(1).max(128),complete:z.boolean()});
export const battleViewSchema = z.object({
  story:storyViewSchema.optional(),
  chain:z.object({index:z.number().int().positive(),total:z.number().int().positive(),exerciseNumber:z.number().int(),rootExerciseNumber:z.number().int(),nextExerciseNumber:z.number().int().optional(),pass:z.number().int().min(1).max(100),passes:z.number().int().min(1).max(100)}).optional(),
  pressure:z.object({id:z.string().max(150),dueAt:z.number(),stage:z.union([z.literal(0),z.literal(1),z.literal(2),z.literal(3)]),at:z.number(),pausedAt:z.number().optional()}).optional(),
  countdown:z.object({startedAt:z.number(),fightAt:z.number(),releasedAt:z.number().optional(),pausedAt:z.number().optional()}).optional(),
  loop:z.object({number:z.number().int().min(1).max(10000000),at:z.number()}).optional(),
  config: bossConfigSchema,
  musicalBeats:z.number().positive().nullable().optional(),
  loopCount:z.number().int().min(1).max(10000000).optional(),
  timer:z.object({limitMs:z.number().nonnegative(),elapsedMs:z.number().nonnegative(),running:z.boolean(),started:z.boolean(),sampledAt:z.number(),issue:z.string().max(300).optional(),tempoStage:z.number().int().min(0).max(3).optional()}).optional(),
  shields:z.number().int().min(0).max(3).optional(),phase:z.enum(['normal','aggressive','enraged']).optional(),
  power:z.object({charge:z.number().int().nonnegative(),threshold:z.number().int().positive(),activations:z.number().int().nonnegative()}).optional(),
  round:roundSchema.optional(),recentRounds:z.array(roundSchema).max(8).optional(),
  roundWins:z.number().int().nonnegative().optional(),roundLosses:z.number().int().nonnegative().optional(),remainingNotes:z.number().int().nonnegative().optional(),remainingKnown:z.boolean().optional(),exerciseEnded:z.boolean().optional(),
  status: z.enum(["idle","ready","active","paused","victory","defeat"]),
  attemptId: z.string().max(50), expectedNotes:z.number().int().min(0).max(10000000),
  playerHp:z.number().int().min(0).max(10000), bossHp:z.number().int().min(0).max(10000000),
  bossMaxHp:z.number().int().min(1).max(10000000),
  correctHits:z.number().int().min(0).max(10000000), mistakes:z.number().int().min(0).max(10000000),
  revision:z.number().int().min(0),lastAction:z.enum(["player","boss"]).optional(),
  lastAt:z.number(),result:z.enum(["knockout","unfinished","abandoned","timeout"]).optional(),waiting:z.boolean(),
  noteAttacks:z.array(z.object({
    id:z.string().max(200),groupId:z.string().max(120),revision:z.number().int().min(1),
    firstAt:z.number(),lastAt:z.number(),readyAt:z.number(),pitches:z.array(z.number().int().min(0).max(127)).min(1).max(128),
    hits:z.number().int().min(1).max(128),expectedSize:z.number().int().min(1).max(128),complete:z.boolean(),
  })).max(8).optional(),
  combatCues:z.array(z.object({revision:z.number().int().min(1),at:z.number(),roundId:z.string().max(100).optional(),sourceEventId:z.string().max(200).optional(),side:z.enum(["player","boss"]),outcome:z.enum(["correct","incorrect","missed"]),
    playerHp:z.number().int().min(0).max(10000),bossHp:z.number().int().min(0).max(10000000),note:noteCue.optional(),damage:z.number().int().nonnegative().optional(),blocked:z.boolean().optional(),special:z.boolean().optional()})).max(32).optional(),
});
