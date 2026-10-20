import {exerciseChain,type ChainEntry} from './schmitt-chain';
import {BattleStoryDirector,storyChallenge,storyChallengeKey,type StoryChallenge,type StoryRecord,type StoryReceipt} from './battle-story';
import {advancePressure,pressureDelays,pressureWaitMs,loopTailMs,resumePressure} from './battle-pressure';
import {shortsRecorder} from './shorts-recorder';
import {
  outboxKeys,
  outboxLock,
  readOutbox,
  recoveryReceipts,
} from "./game-outbox";
import { useSyncExternalStore, useEffect } from "react";
import { command } from "../src/components/ui/actions";
import {
  GAME_RULES,
  evaluateGame,
  replayEvents,
  defaultGameSettings,
  type GameSettings,
  type Celebration,
} from "./game-core";
import type { GameState, GameSync } from "./game-service";
import { normalizeGameSettings } from "./game-settings";
import { createBattle, reduceBattle, battleView, configureBattle, battleCountingIn, battleRunNotes, practiceLoopCount } from "./boss-battle";
import {battleMusicalBeats,timedTempoStages} from './battle-modes';
import {battleRecorder} from './battle-replay';
import {
  assessPractice,
  practicePass,
  type Exercise,
  type Hand,
} from "./sight-library";
export type GameLive = {
  attemptId: string;
  sessionId: string;
  combo: number;
  best: number;
  attemptBest?: number;
  correct: number;
  incorrect: number;
  provisionalXP: number;
  status: string;
  sequence: number;
};
const emptyLive: GameLive = {
  attemptId: "",
  sessionId: "",
  combo: 0,
  best: 0,
  correct: 0,
  incorrect: 0,
  provisionalXP: 0,
  status: "ready",
  sequence: 0,
};
const emptyPlayer: GameState = {
  xp: 0,
  curveVersion: GAME_RULES.curveVersion,
  settings: defaultGameSettings,
  best: 0,
  sessionBest: 0,
  exerciseBest: 0,
  unlocks: [],
  celebrations: [],
};
// Also tolerate an older API response during a deployment or reconnect. Never
// expose incomplete saved settings to React, including recovery/refresh paths.
async function gameCommand<T extends GameState>(input: Parameters<typeof command>[0]): Promise<T> {
  const player = await command<T>(input);
  return { ...player, settings: normalizeGameSettings(player.settings) };
}
class GameClient {
  private listeners = new Set<() => void>();
  state = {
    battle: createBattle(),
    player: emptyPlayer,
    live: emptyLive,
    alerts: [] as Celebration[],
    error: "",
    ready: false,
    pending: 0,
    saving: false,
    lastSaved: "",
    storageError: "",
    recoveryError: "",
    preview: false,
    showSummary: false,
  };
  private current: GameSync | null = null;
  private pendingSettings: GameSettings | null = null;
  private battleNotes = 0;
  private story?:{director:BattleStoryDirector;challenge:StoryChallenge;passes:StoryReceipt['passes'];completed:number;combo:number;passCombo:number;best:number;queued:boolean};
  private storyRecords:StoryRecord[]=[];
  private storyQueue=new Map<string,StoryReceipt>();
  private storyRecord(key:string){
    let record=this.storyRecords.find(r=>r.key===key);
    // Include unsaved attempts even if an earlier save response arrives while a
    // newer result is queued. A slower network must not lower the local target.
    for(const {challenge,result} of this.storyQueue.values()){
      if(storyChallengeKey(challenge)!==key)continue;
      record={key,last:!record||result.finishedAt>record.last.finishedAt?result:record.last,
        best:!record||result.correct>record.best.correct?result:record.best};
    }
    return record;
  }
  private observeStory(){
    const s=this.story,b=this.state.battle;
    if(!s||s.director.view.attemptId!==b.attemptId||!b.config.enabled)return;
    const view=s.director.observe(b,{exerciseId:this.battleSelection.exerciseNumber,completed:s.completed,bestCombo:s.best},Date.now());
    this.state.battle={...b,story:view};
    if(view.summary&&!s.queued){
      s.queued=true;
      const receipt:StoryReceipt={action:'battleStorySave',expectedUserId:this.owner,challenge:s.challenge,result:view.summary,passes:s.passes.map(p=>({...p}))};
      this.storyQueue.set(b.attemptId,receipt);
      this.persist();
    }
  }
  private battleBeats:number|null = null;
  private pressureTimer:ReturnType<typeof setTimeout>|undefined;
  private pressureExercise:Exercise|undefined;
  private pressureCursor=0;
  private pressureTail=0;
  private introTimer:ReturnType<typeof setTimeout>|undefined;
  private battleClock:ReturnType<typeof setInterval>|undefined;
  private battleSelection = {key:"",exerciseNumber:0,loops:1};
  private battleRun: {exerciseNumber:number; hand:Hand; loops:number; pass:number; awaitingLoop:boolean; chain?:ChainEntry[]; index:number; totalLoops:number} | null = null;
  prepareBattle(exercise: Exercise, hand: Hand, loops = 1) {
    shortsRecorder.select({number:exercise.number,title:exercise.title??`Exercise ${exercise.number}`});
    if (this.battleRun) return;
    const key = `${exercise.number}:${hand}:${practiceLoopCount(loops)}`;
    if (key === this.battleSelection.key) return;
    const differentExercise=this.battleSelection.exerciseNumber!==exercise.number;
    this.battleNotes = battleRunNotes(exercise, hand, loops);
    this.battleBeats = battleMusicalBeats(exercise, loops);
    this.battleSelection = {key,exerciseNumber:exercise.number,loops:practiceLoopCount(loops)};
    if (!this.current && (differentExercise || !["victory","defeat"].includes(this.state.battle.status))) {
      this.state.battle = createBattle((this.pendingSettings ?? this.state.player.settings).bossBattle, this.battleNotes, false, this.battleBeats,this.battleSelection.loops);
      this.emit();
    }
  }
  private queue = new Map<string, GameSync>();
  private busy = false;
  private owner = "";
  private tabId = crypto.randomUUID();
  private initializing: Promise<void> | null = null;
  private leaseReady: Promise<void> | null = null;
  private lastRecovery = 0;
  private lastRefresh = 0;
  private outboxKey() {
    return `pianopath-game-outbox:${this.owner}:${this.tabId}`;
  }
  private timer: ReturnType<typeof setInterval> | undefined;
  private started = 0;
  private activeMs = 0;
  private sessionId = "";
  private carryCombo = 0;
  private carryBest = 0;
  private attemptStartCombo = 0;
  private refs = 0;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  snapshot = () => this.state;
  private emit() {
    this.observeStory();
    if (this.pendingSettings) this.state.player = {...this.state.player,settings:this.pendingSettings};
    this.state = { ...this.state };
    shortsRecorder.observe(this.state);
    this.listeners.forEach((fn) => fn());
  }
  private persist() {
    if (!this.owner) return;
    try {
      localStorage.setItem(
        this.outboxKey(),
        JSON.stringify({
          version: 2,
          pending: [...this.queue.values()],
          checkpoint: this.current,
          storyPending:[...this.storyQueue.values()],
        }),
      );
      this.state.storageError = "";
    } catch {
      this.state.storageError =
        "Local recovery storage is unavailable. Keep this page open until progress is saved online.";
    }
    try {
      sessionStorage.setItem(
        `pianopath-game-session:${this.owner}`,
        this.sessionId,
      );
    } catch {}
    this.updatePending();
  }
  private updatePending() {
    let count = this.queue.size + this.storyQueue.size + (this.pendingSettings ? 1 : 0);
    try {
      for (const key of outboxKeys(localStorage, this.owner)) {
        if (key === this.outboxKey()) continue;
        const box=readOutbox(localStorage.getItem(key)!);count += box.pending.length+(box.storyPending?.length??0);
      }
    } catch {
      this.state.recoveryError =
        "Some local progress could not be read. It has been kept for recovery; download a backup from Profile.";
    }
    this.state.pending = count;
  }
  private holdLease() {
    if (!this.leaseReady)
      this.leaseReady = new Promise<void>((resolve) => {
        if (!navigator.locks) {
          this.state.recoveryError =
            "Automatic recovery needs a browser with Web Locks, such as current Chrome or Edge.";
          resolve();
          return;
        }
        // Deliberately held for the document lifetime, including route changes.
        void navigator.locks.request(outboxLock(this.outboxKey()), async () => {
          resolve();
          await new Promise<void>(() => {});
        });
      });
    return this.leaseReady;
  }
  private wake = () => {
    void this.retry();
  };
  private hide = () => {
    if (document.visibilityState === "hidden") {
      this.persist();
      void this.flush();
    }
  };
  private warnBeforeClose = (event: BeforeUnloadEvent) => {
    if (this.queue.size && this.state.storageError) {
      event.preventDefault();
      event.returnValue = "";
    }
  };
  async connect() {
    this.refs++;
    if (this.refs > 1) return;
    window.addEventListener("online", this.wake);
    document.addEventListener("visibilitychange", this.hide);
    window.addEventListener("beforeunload", this.warnBeforeClose);
    this.timer = setInterval(() => void this.retry(), 1000);
    this.battleClock=setInterval(()=>{
      const before=this.state.battle;
      if(!before.timer?.running)return;
      this.state.battle=reduceBattle(before,{type:'tick',attemptId:before.scoringAttemptId,now:performance.now()});
      if(this.state.battle!==before)this.emit();
    },200);
    await this.retry();
  }
  async retry() {
    if (!this.state.ready) {
      if (!this.initializing)
        this.initializing = this.initialize().finally(() => {
          this.initializing = null;
        });
      await this.initializing;
    }
    await this.flush();
  }
  private async initialize() {
    try {
      const initial = await gameCommand<GameState & { userId: string }>({
        action: "gameState",
      });
      this.owner = initial.userId;
      this.storyRecords=await command<StoryRecord[]>({action:'battleStoryRecords'});
      void shortsRecorder.connect(this.owner);
      this.state.player = initial;
      await this.holdLease();
      // Ask the browser to protect the journal from automatic storage eviction.
      void navigator.storage?.persist?.().catch(() => false);
      try {
        this.sessionId =
          sessionStorage.getItem(`pianopath-game-session:${this.owner}`) ?? "";
      } catch {}
      if (this.sessionId) {
        const restored = await gameCommand<GameState>({
          action: "gameState",
          sessionId: this.sessionId,
        });
        this.state.player = restored;
        if (restored.summary?.ended) this.sessionId = "";
      }
      await this.recover();
      this.carryCombo = this.state.player.streak ?? 0;
      this.carryBest = Math.max(this.carryCombo, this.state.player.sessionBest);
      this.state.live = {...emptyLive, combo:this.carryCombo, best:this.carryBest};
      this.state.ready = true;
      this.state.battle = createBattle(this.state.player.settings.bossBattle, this.battleNotes, false, this.battleBeats,this.battleSelection.loops);
      this.state.saving = true;
      this.state.error = "";
      this.state.lastSaved = new Date().toISOString();
      this.updatePending();
      this.emit();
    } catch {
      this.state.error =
        "Cannot confirm saved progress. Reconnecting automatically…";
      this.emit();
    }
  }
  disconnect() {
    this.refs = Math.max(0, this.refs - 1);
    if (this.refs) return;
    this.abandon();
    clearInterval(this.timer);
    clearInterval(this.battleClock);
    this.timer = undefined;
    window.removeEventListener("online", this.wake);
    document.removeEventListener("visibilitychange", this.hide);
    window.removeEventListener("beforeunload", this.warnBeforeClose);
  }
  private async recover() {
    if (!navigator.locks) return;
    this.state.recoveryError = "";
    for (const key of outboxKeys(localStorage, this.owner)) {
      if (key === this.outboxKey()) continue;
      await navigator.locks.request(
        outboxLock(key),
        { ifAvailable: true },
        async (lock) => {
          if (!lock) return; // Another live practice tab owns these receipts.
          const raw = localStorage.getItem(key);
          if (!raw) return;
          let pending: GameSync[],storyPending:StoryReceipt[];
          try {
            const box=readOutbox(raw);pending = recoveryReceipts(box);storyPending=box.storyPending??[];
          } catch {
            this.state.recoveryError =
              "Some local progress could not be read. It has been kept for recovery; download a backup from Profile.";
            return;
          }
          // Persist finalization before sending. A second crash reuses the exact
          // same sequence and reward IDs, including completed-attempt bonuses.
          localStorage.setItem(
            key,
            JSON.stringify({ version: 2, pending, checkpoint: null,storyPending }),
          );
          while (pending.length) {
            this.state.player = await gameCommand<GameState>({
              ...pending[0],
              expectedUserId: this.owner,
            });
            this.state.lastSaved = new Date().toISOString();
            pending = pending.slice(1);
            localStorage.setItem(
              key,
              JSON.stringify({ version: 2, pending, checkpoint: null,storyPending }),
            );
          }
          while(storyPending.length){
            this.storyRecords=await command<StoryRecord[]>(storyPending[0]);
            storyPending=storyPending.slice(1);
            localStorage.setItem(key,JSON.stringify({version:2,pending,checkpoint:null,storyPending}));
          }
          localStorage.removeItem(key);
        },
      );
    }
  }
  localBackup() {
    const journals: Record<string, string> = {};
    for (const key of outboxKeys(localStorage, this.owner))
      journals[key] = localStorage.getItem(key)!;
    return journals;
  }
  start(exercise: Exercise, hand: Hand, loops = 1, entries?:ChainEntry[]) {
    this.abandon();
    if (!this.state.ready) return false;
    const chain=entries?exerciseChain(entries,hand):undefined;
    if(chain){exercise=chain.plan[0].exercise;loops=chain.plan[0].loops;}
    const config=(this.pendingSettings??this.state.player.settings).bossBattle;
    const prepared=createBattle(chain?{...config,multiRoundEnabled:false}:config,chain?.notes??battleRunNotes(exercise,hand,loops),false,chain?chain.beats:battleMusicalBeats(exercise,loops),chain?.loops??practiceLoopCount(loops),battleMusicalBeats(practicePass(exercise,practiceLoopCount(loops)>1)));
    if(prepared.config.enabled&&prepared.timer?.issue){this.state.error=prepared.timer.issue;this.state.battle=prepared;this.emit();return false;}
    this.battleRun = {exerciseNumber:exercise.number, hand, loops:practiceLoopCount(loops), pass:1, awaitingLoop:false,chain:chain?.plan,index:0,totalLoops:chain?.loops??practiceLoopCount(loops)};
    this.battleNotes = prepared.expectedNotes;
    this.battleBeats = prepared.musicalBeats??null;
    this.state.battle=prepared;
    this.startAttempt(exercise, hand, false);
    return true;
  }
  nextLoop(exercise: Exercise, hand: Hand) {
    const run = this.battleRun;
    if (!run?.awaitingLoop || this.current || run.hand !== hand) return;
    if(run.pass<run.loops){if(run.exerciseNumber!==exercise.number)return;run.pass++;}
    else {const next=run.chain?.[run.index+1];if(!next||next.exercise.number!==exercise.number)return;run.index++;run.exerciseNumber=exercise.number;run.loops=next.loops;run.pass=1;}
    run.awaitingLoop = false;
    this.startAttempt(exercise, hand, true);
  }
  private startAttempt(exercise: Exercise, hand: Hand, continueBattle: boolean) {
    const run = this.battleRun!;
    this.battleSelection.exerciseNumber=exercise.number;
    if (!this.sessionId) this.sessionId = crypto.randomUUID();
    this.state.preview = false;
    this.state.showSummary = false;
    this.current = {
      action: "gameSync",
      attemptId: crypto.randomUUID(),
      sessionId: this.sessionId,
      sequence: 1,
      exerciseNumber: exercise.number,
      hand,
      omitClosing: exercise.collection === "schmitt-op16" && run.pass < run.loops,
      played: [],
      status: "playing",
      activeMs: 0,
    };
    this.started = performance.now();
    this.activeMs = 0;
    this.state.battle = continueBattle
      ? reduceBattle(this.state.battle, {type:"next-loop",attemptId:this.state.battle.scoringAttemptId,nextAttemptId:this.current.attemptId,beats:battleMusicalBeats(practicePass(exercise,this.current.omitClosing))})
      : reduceBattle(this.state.battle, {type:"start",attemptId:this.current.attemptId,combo:this.carryCombo,countdown:true});
    if(run.chain)this.state.battle={...this.state.battle,chain:{index:run.index+1,total:run.chain.length,exerciseNumber:exercise.number,rootExerciseNumber:run.chain[0].exercise.number,nextExerciseNumber:run.chain[run.index+1]?.exercise.number,pass:run.pass,passes:run.loops}};
    if(!continueBattle){
      const challenge=storyChallenge(this.state.battle.config,hand,(run.chain??[{exercise,loops:run.loops}]).map(e=>({number:e.exercise.number,loops:e.loops})));
      this.story={challenge,director:new BattleStoryDirector(this.state.battle.attemptId,challenge,this.storyRecord(storyChallengeKey(challenge))),
        passes:[],completed:0,combo:0,passCombo:0,best:0,queued:false};
    }
    if(this.story&&!this.story.director.view.summary){this.story.passCombo=this.story.combo;this.story.passes.push({id:this.current.attemptId,notes:0});}
    this.pressureExercise=practicePass(exercise,this.current.omitClosing);
    this.pressureCursor=0;
    this.state.battle={...this.state.battle,pressure:undefined};
    if(!battleCountingIn(this.state.battle))this.beginPressure(null,continueBattle?this.pressureTail:0);
    this.attemptStartCombo = this.carryCombo;
    battleRecorder.start({number:exercise.number,title:exercise.title??`Exercise ${exercise.number}`},this.state.battle,this.carryCombo);
    if(continueBattle)battleRecorder.capture(this.state.battle,this.carryCombo);
    this.state.live = {
      ...emptyLive,
      combo: this.carryCombo,
      best: this.carryBest,
      attemptBest: 0,
      attemptId: this.current.attemptId,
      sessionId: this.sessionId,
      status: battleCountingIn(this.state.battle)?"countdown":"playing",
    };
    this.armCountdown();
    this.enqueue();
    this.emit();
    void this.flush();
  }
  private beginPressure(previousCursor:number|null,extraWait=0) {
    clearTimeout(this.pressureTimer);
    const b=this.state.battle,ex=this.pressureExercise;
    this.state.battle={...b,pressure:undefined};
    if(!ex||!this.current||!b.config.enabled||!b.config.pressureReactions||b.status!=="active")return;
    const wait=pressureWaitMs(ex,this.current.hand,this.pressureCursor,previousCursor,b.timer?.tempoStage===undefined?b.config.selectedBpm:timedTempoStages[b.timer.tempoStage].bpm);
    if(wait===null)return;
    const now=Date.now();
    this.state.battle={...b,pressure:{id:`${this.current.attemptId}:${this.current.played.length}`,stage:0,at:now,dueAt:now+Math.max(wait,extraWait)}};
    this.armPressure();
  }
  private armPressure() {
    clearTimeout(this.pressureTimer);
    const b=this.state.battle,p=b.pressure;
    if(!p||p.stage===3||p.pausedAt!==undefined||b.status!=="active"||!b.config.pressureReactions)return;
    this.pressureTimer=setTimeout(()=>{
      const current=this.state.battle;
      if(current.pressure?.id!==p.id||current.status!=="active"||!current.config.pressureReactions)return;
      const next=advancePressure(current.pressure,Date.now());
      this.state.battle={...current,pressure:next};
      if(next!==current.pressure)this.emit();
      this.armPressure();
    },Math.max(1,p.dueAt+pressureDelays[p.stage]-Date.now()));
  }
  acceptsNotes() { return !!this.current && this.current.status === "playing" && !battleCountingIn(this.state.battle); }
  private armCountdown() {
    clearTimeout(this.introTimer);
    const battle=this.state.battle,c=battle.countdown;
    if(!battleCountingIn(battle)||c?.pausedAt||!this.current)return;
    const attemptId=battle.attemptId;
    this.introTimer=setTimeout(()=>{
      if(this.state.battle.attemptId!==attemptId||!this.current||this.current.status!=="playing")return;
      const next=reduceBattle(this.state.battle,{type:"fight",attemptId:this.current.attemptId,at:Date.now()});
      if(battleCountingIn(next)){this.armCountdown();return;}
      this.state.battle=next;
      this.started=performance.now();
      this.beginPressure(null);
      this.state.live={...this.state.live,status:"playing"};
      battleRecorder.capture(next,this.carryCombo);
      this.enqueue();this.emit();
    },Math.max(0,c!.fightAt-Date.now()));
  }
  update(
    exercise: Exercise,
    hand: Hand,
    played: number[],
    approved?: ReturnType<typeof assessPractice>,
  ) {
    if (!this.current || !this.acceptsNotes()) return;
    this.current.played = [...played];
    const result = evaluateGame(
      practicePass(exercise, this.current.omitClosing),
      hand,
      played,
      {
        playerId: this.owner,
        sessionId: this.sessionId,
        attemptId: this.current.attemptId,
        timestamp: Date.now(),
      },
      approved,
    );
    const streak = replayEvents(result.events, this.attemptStartCombo);
    this.state.battle = reduceBattle(this.state.battle, {type:"evaluate",attemptId:this.current.attemptId,events:result.events,comboByEvent:streak.comboByEvent});
    const assessed=approved??assessPractice(practicePass(exercise,this.current.omitClosing),hand,played);
    const story=this.story,run=this.battleRun;
    if(story&&!story.director.view.summary&&run&&this.state.battle.config.enabled){
      // Freeze at the last event actually accepted by combat, including a
      // terminal event delivered partway through a batched/chord update.
      const notes=Math.min(played.length,(this.state.battle.lastSequence??-1)+1);
      story.passes[story.passes.length-1].notes=notes;
      const events=result.events.filter(e=>e.sequence<notes),streak=replayEvents(events,story.passCombo);
      story.combo=streak.combo;story.best=Math.max(story.best,streak.best);
      if(notes===played.length&&assessed.complete&&run.pass===run.loops)story.completed=Math.max(story.completed,run.index+1);
    }
    if(result.correct>this.state.live.correct){const prior=this.pressureCursor;this.pressureCursor=assessed.cursor;this.beginPressure(prior);}
    this.carryCombo = streak.combo;
    this.carryBest = Math.max(this.carryBest, streak.best);
    battleRecorder.capture(this.state.battle,this.carryCombo,result.events);
    this.state.live = {
      attemptId: this.current.attemptId,
      sessionId: this.sessionId,
      combo: this.carryCombo,
      best: this.carryBest,
      attemptBest: result.best,
      correct: result.correct,
      incorrect: result.incorrect,
      provisionalXP: result.noteXP,
      status: "playing",
      sequence: played.length,
    };
    // Streak announcements come from newly accepted server-side crossings.
    this.enqueue();
    this.emit();
  }
  private enqueue() {
    if (!this.current) return;
    this.current.sequence++;
    this.current.activeMs = Math.round(
      this.activeMs +
        (this.current.status === "playing" && !battleCountingIn(this.state.battle)
          ? performance.now() - this.started
          : 0),
    );
    this.queue.set(this.current.attemptId, {
      ...this.current,
      played: [...this.current.played],
    });
    this.persist();
  }
  pause() {
    if (!this.current || this.current.status !== "playing") return;
    if(!battleCountingIn(this.state.battle))this.activeMs += performance.now() - this.started;
    clearTimeout(this.introTimer);
    clearTimeout(this.pressureTimer);
    if(this.state.battle.pressure)this.state.battle={...this.state.battle,pressure:{...this.state.battle.pressure,pausedAt:Date.now()}};
    this.current.status = "paused";
    this.state.battle = reduceBattle(this.state.battle, {type:"pause",attemptId:this.current.attemptId});
    battleRecorder.capture(this.state.battle,this.carryCombo);
    this.state.live = { ...this.state.live, status: "paused" };
    this.enqueue();
    this.emit();
    void this.flush();
  }
  resume() {
    if (!this.current || this.current.status !== "paused") return;
    this.started = performance.now();
    this.current.status = "playing";
    this.state.battle = reduceBattle(this.state.battle, {type:"resume",attemptId:this.current.attemptId});
    battleRecorder.capture(this.state.battle,this.carryCombo);
    this.state.live = { ...this.state.live, status: battleCountingIn(this.state.battle)?"countdown":"playing" };
    this.armCountdown();
    if(this.state.battle.pressure)this.state.battle={...this.state.battle,pressure:resumePressure(this.state.battle.pressure,Date.now())};
    this.armPressure();
    this.enqueue();
    this.emit();
  }
  finish() {
    if (!this.current || battleCountingIn(this.state.battle)) return;
    this.activeMs +=
      this.current.status === "playing" && !battleCountingIn(this.state.battle) ? performance.now() - this.started : 0;
    clearTimeout(this.pressureTimer);
    this.pressureTail=this.pressureExercise?loopTailMs(this.pressureExercise,this.current.hand,this.state.battle.config.selectedBpm):0;
    this.state.battle={...this.state.battle,pressure:undefined};
    this.current.status = "completed";
    const moreLoops = !!this.battleRun && (this.battleRun.pass < this.battleRun.loops || this.battleRun.index+1 < (this.battleRun.chain?.length??0));
    this.state.battle = reduceBattle(this.state.battle, {type:moreLoops ? "tick" : "complete",attemptId:this.current.attemptId});
    battleRecorder.capture(this.state.battle,this.carryCombo);
    if(!moreLoops)battleRecorder.stop('Exercise completed');
    if (moreLoops) this.battleRun!.awaitingLoop = true;
    else this.battleRun = null;
    this.state.live = { ...this.state.live, status: "completed" };
    this.enqueue();
    this.current = null;
    this.emit();
    void this.flush();
  }
  abandon() {
    clearTimeout(this.pressureTimer);
    this.state.battle={...this.state.battle,pressure:undefined};
    clearTimeout(this.introTimer);
    const hadRun = !!this.battleRun;
    this.battleRun = null;
    if (!this.current) {
      // Stop/navigation can happen while a completed pass is being saved.
      if (hadRun) {
        this.state.battle = reduceBattle(this.state.battle, {type:"abandon",attemptId:this.state.battle.scoringAttemptId});
        battleRecorder.capture(this.state.battle,this.carryCombo);battleRecorder.stop('Exercise abandoned');
        this.emit();
      }
      return;
    }
    this.activeMs +=
      this.current.status === "playing" && !battleCountingIn(this.state.battle) ? performance.now() - this.started : 0;
    this.current.status = "abandoned";
    this.state.battle = reduceBattle(this.state.battle, {type:"abandon",attemptId:this.current.attemptId});
    battleRecorder.capture(this.state.battle,this.carryCombo);battleRecorder.stop('Exercise abandoned');
    this.state.live = { ...this.state.live, status: "abandoned" };
    this.enqueue();
    this.current = null;
    this.emit();
    void this.flush();
  }
  resetBattle() {
    this.abandon();
    // Explicit restart only; normal post-result MIDI and Stop preserve the held
    // cinematic. Publish readiness through the same live snapshot transport.
    this.state.battle=createBattle((this.pendingSettings??this.state.player.settings).bossBattle,this.battleNotes,false,this.battleBeats,this.battleSelection.loops);
    this.emit();
  }
  private alert(e: Celebration) {
    this.state.alerts = [
      ...this.state.alerts.filter((x) => Date.now() - x.createdAt < 30000),
      e,
    ].slice(-24);
  }
  async flush() {
    if (this.busy || !this.state.ready) return;
    this.busy = true;
    this.state.saving = this.queue.size > 0 || this.storyQueue.size>0 || this.state.pending > 0 || !!this.pendingSettings;
    if (this.state.saving) this.emit();
    try {
      if (this.pendingSettings) {
        const settings = this.pendingSettings;
        this.state.player = await gameCommand<GameState>({action:"gameSettings",settings});
        if (this.pendingSettings === settings) this.pendingSettings = null;
        this.state.lastSaved = new Date().toISOString();
      }
      for (const [id, item] of [...this.queue]) {
        const player = await gameCommand<GameState>({
          ...item,
          expectedUserId: this.owner,
        });
        this.state.player = player;
        for (const e of player.celebrations) this.alert(e);
        if (this.queue.get(id)?.sequence === item.sequence)
          this.queue.delete(id);
        this.state.lastSaved = new Date().toISOString();
        this.persist();
      }
      for(const [id,receipt] of [...this.storyQueue]){
        this.storyRecords=await command<StoryRecord[]>(receipt);
        this.storyQueue.delete(id);this.state.lastSaved=new Date().toISOString();this.persist();
      }
      if (Date.now() - this.lastRecovery > 2000) {
        this.lastRecovery = Date.now();
        await this.recover();
      }
      // A Profile tab also reflects progress saved by another practice tab.
      if (!this.current && Date.now() - this.lastRefresh > 10000) {
        this.lastRefresh = Date.now();
        this.state.player = await gameCommand<GameState>({
          action: "gameState",
          sessionId: this.sessionId || undefined,
        });
        this.state.lastSaved = new Date().toISOString();
      }
      this.state.error = "";
    } catch (e) {
      this.state.error = `Progress save pending: ${(e as Error).message}. Retrying automatically.`;
    } finally {
      this.busy = false;
      this.state.saving = false;
      this.updatePending();
      this.emit();
    }
  }
  private selectedExercise = 0;
  async selectExercise(exerciseNumber: number) {
    this.selectedExercise = exerciseNumber;
    try {
      const result = await gameCommand<GameState>({
        action: "gameState",
        exerciseNumber,
      });
      if (this.selectedExercise !== exerciseNumber) return;
      this.state.player = {
        ...this.state.player,
        exerciseBest: result.exerciseBest,
      };
      this.emit();
    } catch {
      /* Existing records remain available after the next checkpoint. */
    }
  }
  async settings(settings: GameSettings) {
    const counting=battleCountingIn(this.state.battle);
    this.state.battle = configureBattle(this.state.battle, settings.bossBattle, this.battleNotes, !!this.battleRun);
    if(counting&&!battleCountingIn(this.state.battle)){clearTimeout(this.introTimer);this.started=performance.now();this.state.live={...this.state.live,status:this.current?.status??"ready"};}
    if(!settings.bossBattle.pressureReactions||!settings.bossBattle.enabled){clearTimeout(this.pressureTimer);this.state.battle={...this.state.battle,pressure:undefined};}
    else if(!this.state.battle.pressure)this.beginPressure(null);
    await this.saveSettings(settings);
  }
  async notationAppearance(notationPreset:GameSettings['notationPreset']) {
    await this.saveSettings({...this.state.player.settings,notationPreset});
  }
  async shortsDisplay(display:GameSettings['shortsDisplay']) {
    // Presentation preferences never configure, reset or advance a battle.
    await this.saveSettings({...this.state.player.settings,shortsDisplay:display});
  }
  private async saveSettings(settings:GameSettings) {
    this.pendingSettings = settings;
    this.state.player = { ...this.state.player, settings };
    this.updatePending();
    this.emit();
    await this.flush();
  }
  async endSession() {
    this.abandon();
    while (this.busy) await new Promise((r) => setTimeout(r, 100));
    await this.flush();
    if (this.busy || this.queue.size) {
      this.state.error = "Wait for pending XP saves before ending the session.";
      this.emit();
      return;
    }
    if (this.sessionId) {
      this.state.player = await gameCommand<GameState>({
        action: "gameSessionEnd",
        sessionId: this.sessionId,
      });
      this.sessionId = "";
      this.persist();
      this.state.showSummary = true;
      this.emit();
    }
  }
  preview(
    kind: "combo" | "achievement" | "level" | "reset" | "exit",
    achievementId?: string,
  ) {
    if (this.current) return;
    if (kind === "exit") {
      this.state.preview = false;
      this.state.live = { ...emptyLive, combo:this.carryCombo, best:this.carryBest };
      this.state.alerts = [];
      this.emit();
      return;
    }
    this.state.preview = true;
    this.state.showSummary = false;
    if (kind === "reset") {
      this.state.live = { ...emptyLive };
      this.state.alerts = [];
    } else if (kind === "combo")
      this.state.live = {
        ...emptyLive,
        attemptId: "preview",
        combo: this.state.live.combo + 10,
        best: this.state.live.combo + 10,
        sequence: this.state.live.sequence + 1,
      };
    if (kind !== "reset")
      this.alert({
        id: crypto.randomUUID(),
        kind: kind === "combo" ? "milestone" : kind,
        title:
          kind === "level"
            ? "LEVEL UP! · 10"
            : kind === "achievement"
              ? (achievementId ?? "Flawless Victory")
              : `${this.state.live.combo} notes in a row`,
        description: "Preview only · no XP or records awarded",
        xp: kind === "achievement" ? 125 : undefined,
        priority: 90,
        createdAt: Date.now(),
      });
    this.emit();
  }
  private cinematicDismissedId = "";
  dismissCinematic(id:string) { this.cinematicDismissedId=id; this.emit(); }
  overlay() {
    return {
      cinematicDismissedId: this.cinematicDismissedId,
      battle: battleView(this.state.battle),
      live: this.state.live,
      settings: this.state.player.settings,
      alerts: this.state.alerts.slice(-8),
      preview: this.state.preview,
      sessionId: this.state.live.sessionId || this.sessionId,
      summary: this.state.showSummary ? this.state.player.summary : undefined,
    };
  }
}
export const gameClient = new GameClient();
export function useGame() {
  const state = useSyncExternalStore(gameClient.subscribe, gameClient.snapshot);
  useEffect(() => {
    void gameClient.connect();
    return () => gameClient.disconnect();
  }, []);
  return state;
}
