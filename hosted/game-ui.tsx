import {BossSelector} from './boss-selector';
import { usePracticeCinematicActive } from './battle-cinematic-ui';
import { BattleAudioControls, PracticeAudioOutput } from './battle-audio-ui';
import { battleAudio } from './battle-audio';
import { CinematicControls, CinematicDeveloperPreview } from './cinematic-controls';
import { AchievementArt } from "./achievement-art";
import { BattleModeControls } from './battle-mode-ui';
import { bossDifficulties } from "./boss-config";
import { BattleAnimationPreview } from "./battle-animation-preview";
import { useEffect, useRef, useState, type CSSProperties } from "react";

import {
  achievements,
  levelInfo,
  defaultGameSettings,
  CelebrationQueue,
  type Celebration,
  type GameSettings,
} from "./game-core";

import { gameClient, useGame, type GameLive } from "./game-client";

import type { GameState, GameSummary } from "./game-service";

import "./game.css";

export function GameHUD({
  player,
  live,
  settings = defaultGameSettings,
  preview = false,
}: {
  player: GameState;
  live: GameLive;
  settings?: GameSettings;
  preview?: boolean;
}) {
  const info = levelInfo(player.xp, player.curveVersion);

  const [pulse, setPulse] = useState(false),
    [broken, setBroken] = useState(false);
  const previous = useRef(live.combo);

  useEffect(() => {
    setBroken(live.combo === 0 && previous.current > 0);
    setPulse(live.combo > previous.current);
    previous.current = live.combo;
    const t = setTimeout(() => {
      setPulse(false);
      setBroken(false);
    }, 150);
    return () => clearTimeout(t);
  }, [live.combo, live.sequence]);

  return (
    <div
      className={`game-hud ${settings.expanded ? "game-expanded" : ""} ${preview ? "game-preview" : ""}`}
    >
      {preview && <b>PREVIEW · no rewards</b>}

      {settings.xp && (
        <div className="game-level">
          <strong>
            Lv. {info.level} <span>{info.title}</span>
          </strong>
          <small>
            {player.xp.toLocaleString()} XP ·{" "}
            {info.maxed
              ? "Expert · Max level"
              : `${info.remaining.toLocaleString()} to next`}
          </small>
          <div
            className="game-xp-track"
            role="progressbar"
            aria-label="Pianist level progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(info.percent)}
            aria-valuetext={
              info.maxed
                ? "Expert, maximum level"
                : `${Math.round(info.percent)}% to level ${info.level + 1}`
            }
          >
            <i style={{ width: `${info.percent}%` }} />
          </div>
        </div>
      )}

      {settings.combo && (
        <div
          className={`game-combo ${pulse ? "game-note-pulse" : ""} ${broken ? "game-break" : ""}`}
        >
          <strong>{live.combo}</strong>
          <span>COMBO</span>
          <small>
            Session best {Math.max(player.sessionBest, live.best)} · Lifetime{" "}
            {Math.max(player.best, live.best)}
          </small>
        </div>
      )}

      {settings.expanded && (
        <small className="game-record-detail">
          Attempt best {live.attemptBest ?? live.best} · Exercise best{" "}
          {Math.max(player.exerciseBest, live.attemptBest ?? live.best)}
        </small>
      )}
    </div>
  );
}

function sound(e: Celebration, s: GameSettings) {
  const allowed =
    e.kind === "level"
      ? s.soundLevel
      : e.kind === "achievement"
        ? s.soundAchievement
        : e.kind === "record"
          ? s.soundRecord
          : s.soundMilestone;

  if (!s.sound || !allowed) return;

  try {
    const ctx = new AudioContext();
    void ctx
      .resume()
      .then(() => {
        [523.25, 659.25, 783.99].forEach((freq, i) => {
          const o = ctx.createOscillator(),
            g = ctx.createGain();
          o.type = "sine";
          o.frequency.value = freq;
          o.connect(g);
          g.connect(ctx.destination);
          const t = ctx.currentTime + i * 0.09;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(s.volume * 0.12, t + 0.025);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
          o.start(t);
          o.stop(t + 0.31);
        });
      })
      .catch(() => void ctx.close());

    setTimeout(() => void ctx.close(), 1000);
  } catch {
    /* Browser autoplay restrictions leave celebrations silent. */
  }
}

function celebrationDuration(
  e: Celebration,
  s: GameSettings,
  standalone: boolean,
) {
  const base =
    e.kind === "level"
      ? 4500
      : e.kind === "achievement"
        ? 3600
        : e.kind === "milestone" && e.priority < 50
          ? 900
          : 2200;
  return (standalone ? Math.max(2500, base) : base) * s.duration;
}
export function GameCelebrations({
  alerts,
  settings,
  scene,
  preview = false,
  standalone = false,
  receiptKey,
  blocked = false,
}: {
  alerts: Celebration[];
  settings: GameSettings;
  scene: string;
  preview?: boolean;
  standalone?: boolean;
  receiptKey?: string;
  blocked?: boolean;
}) {
  const queue = useRef(new CelebrationQueue()),
    mounted = useRef(0);
  const [current, setCurrent] = useState<Celebration>();
  const currentRef = useRef<Celebration | undefined>(undefined);

  useEffect(() => {
    mounted.current = Date.now();
  }, []);
  const practiceBlocked=usePracticeCinematicActive();
  blocked=blocked||practiceBlocked;
  const blockedRef=useRef(blocked);blockedRef.current=blocked;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    queue.current.clear();
    currentRef.current = undefined;
    setCurrent(undefined);
  }, [scene, preview]);

  useEffect(() => {
    for (const e of alerts) {
      if (e.createdAt < mounted.current - 1000) continue;
      if (e.kind === "achievement" && !settings.achievements) continue;
      if (e.kind === "milestone" && !settings.milestones) continue;
      queue.current.push(e);
    }
  }, [alerts, settings]);

  useEffect(() => {
    let until = 0,pausedAt=0;

    const timer = setInterval(() => {
      const now=Date.now();
      if(blockedRef.current){if(!pausedAt)pausedAt=now;return;}
      if(pausedAt){queue.current.deferBy(now-pausedAt);until=currentRef.current?now+celebrationDuration(currentRef.current,settingsRef.current,standalone):0;pausedAt=0;}
      if (currentRef.current && Date.now() < until) return;

      let e = queue.current.next(Date.now());
      // Presentation receipts survive refreshes. Preview/replay is deliberately
      // excluded and can never consume a real achievement announcement.
      while (e && !preview && receiptKey && e.kind === "achievement") {
        const key = `pianopath:achievement-shown:${receiptKey}:${e.id}`;
        try {
          if (localStorage.getItem(key)) { e = queue.current.next(Date.now()); continue; }
          localStorage.setItem(key, "1");
        } catch { /* Server unlocks and in-memory deduplication still apply. */ }
        break;
      }
      currentRef.current = e;
      setCurrent(e);

      if (e) {
        const s = settingsRef.current;
        until = Date.now() + celebrationDuration(e, s, standalone);
        sound(e, s);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [standalone, preview, receiptKey]);

  if (!current || blocked) return null;

  const seconds = celebrationDuration(current, settings, standalone) / 1000;
  return (
    <aside
      aria-live="polite"
      className={`game-celebration ${standalone ? "game-celebration-standalone" : ""} game-${current.kind} game-intensity-${settings.intensity} ${settings.recording ? "game-recording" : ""}`}
      style={
        {
          "--game-brightness": settings.brightness,
          "--game-duration": `${seconds}s`,
        } as CSSProperties
      }
      key={current.id}
    >
      <div className="game-emblem" aria-hidden="true">
        <AchievementArt id={achievements.find(a => current.id === `achievement:${a.id}` || current.title === a.title)?.id ?? (current.kind === "record" ? "breakthrough" : current.kind === "milestone" ? "unstoppable" : "level_10_pianist")} />
      </div>

      <div>
        <small>
          {preview ? "PREVIEW · " : ""}
          {current.kind === "achievement"
            ? "ACHIEVEMENT UNLOCKED"
            : current.kind === "milestone" ? "NOTE STREAK" : current.kind.toUpperCase()}
        </small>
        <strong>{current.title}</strong>
        {(current.kind !== "milestone" || preview) && <p>
          {current.description}
          {!standalone && current.xp ? ` · +${current.xp} XP` : ""}
        </p>}
        {standalone && !!current.xp && <span className="achievement-xp">+{current.xp} XP</span>}
      </div>
    </aside>
  );
}

export function GameSummaryView({
  summary: s,
  preview = false,
}: {
  summary: GameSummary;
  preview?: boolean;
}) {
  return (
    <section className="game-summary" aria-label="Recording session summary">
      <small>{preview ? "PREVIEW" : "SESSION COMPLETE"}</small>
      <h2>
        {s.ended ? "Practice session complete" : "Your practice, in progress"}
      </h2>

      <div className="game-summary-grid">
        <div>
          <b>
            Level {levelInfo(s.startingXP, s.curveVersion).level} →{" "}
            {levelInfo(s.endingXP, s.curveVersion).level}
          </b>
          <span>+{s.earnedXP} XP earned</span>
        </div>
        <div>
          <b>{s.best}</b>
          <span>Longest combo</span>
        </div>
        <div>
          <b>{s.accuracy.toFixed(1)}%</b>
          <span>
            {s.correct} correct / {s.scored} evaluated notes
          </span>
        </div>
        <div>
          <b>{s.completed}</b>
          <span>Completed exercises</span>
        </div>
        <div>
          <b>{s.personalBests}</b>
          <span>New personal bests</span>
        </div>
        <div>
          <b>
            {Math.floor(s.activeMs / 60000)}m{" "}
            {Math.floor(s.activeMs / 1000) % 60}s
          </b>
          <span>Active practice, excluding pauses</span>
        </div>
      </div>

      <p>
        {s.achievements
          .map((id) => achievements.find((a) => a.id === id)?.title)
          .filter(Boolean)
          .join(" · ") || "Every correctly evaluated note counts."}
      </p>
      <small>
        Accuracy = correct notes ÷ (correct notes + incorrect key presses).
        Pitch-only practice has no timed misses.
      </small>
    </section>
  );
}

export function GamePanel({
  busy,
  exerciseNumber,
}: {
  busy: boolean;
  exerciseNumber: number;
}) {
  const state = useGame(),
    s = state.player.settings;

  const set = (
    key: keyof GameSettings,
    value: GameSettings[keyof GameSettings],
  ) => void gameClient.settings({ ...s, [key]: value });

  const [controls, setControls] = useState(false);
  useEffect(() => {
    if (state.ready) void gameClient.selectExercise(exerciseNumber);
  }, [state.ready, exerciseNumber]);

  return (
    <section className="game-panel" aria-label="Pianist progression">
      <PracticeAudioOutput/>
      <GameHUD
        player={state.player}
        live={state.live}
        settings={s}
        preview={state.preview}
      />

      {state.error && <p role="status">{state.error}</p>}

      {!state.ready && <p role="status">Connecting progression…</p>}

      <GameCelebrations
        alerts={state.alerts}
        receiptKey={state.player.userId ? `practice:${state.player.userId}` : undefined}
        settings={s}
        scene={state.live.sessionId}
        preview={state.preview}
      />

      <details
        open={controls}
        onToggle={(e) => setControls(e.currentTarget.open)}
        className={s.recording && !controls ? "game-recording-controls" : ""}
      >
        <summary>Progression &amp; recording controls</summary>

        <div className="boss-controls">
          <label className="check"><input type="checkbox" checked={s.bossBattle.enabled} disabled={!state.ready}
            onChange={e=>set("bossBattle",{...s.bossBattle,enabled:e.target.checked})}/>Boss Battle Mode</label>
          <BossSelector config={s.bossBattle} battle={state.battle} disabled={!state.ready} onChange={config=>set("bossBattle",config)}/>
          <BattleModeControls config={s.bossBattle} active={state.battle} disabled={!state.ready} onChange={config=>set("bossBattle",config)}/>
          <div className="boss-options"><label>Boss difficulty
            <select aria-label="Boss difficulty" value={s.bossBattle.bossDamagePerMistake} disabled={!state.ready}
              onChange={e=>set("bossBattle",{...s.bossBattle,bossDamagePerMistake:Number(e.target.value)})}>
              {!bossDifficulties.some(d=>d.damage===s.bossBattle.bossDamagePerMistake) && <option value={s.bossBattle.bossDamagePerMistake}>Custom — {s.bossBattle.bossDamagePerMistake} HP per mistake</option>}
              {bossDifficulties.map(d=><option key={d.damage} value={d.damage}>{d.label} — {d.damage} HP per mistake</option>)}
            </select>
          </label></div>
          <p>{state.battle.expectedNotes} scored notes · Boss HP: {state.battle.bossMaxHp}. Every correct expected note deals 1 damage. {s.bossBattle.gameMode==='timeAttack'?'Mistakes do not damage your HP in Time Attack.':`You have ${s.bossBattle.playerMaxHp} HP; the selected difficulty deals ${s.bossBattle.bossDamagePerMistake} base damage per mistake.`}</p>
          {s.bossBattle.enabled && <div className="boss-options">
            <label className="check"><input type="checkbox" checked={s.bossBattle.showDamageNumbers} onChange={e=>set("bossBattle",{...s.bossBattle,showDamageNumbers:e.target.checked})}/>Damage numbers</label>
            <label className="check"><input type="checkbox" checked={s.bossBattle.pressureReactions} onChange={e=>set("bossBattle",{...s.bossBattle,pressureReactions:e.target.checked})}/>Battle Pressure Reactions</label>
            <small>Cosmetic reactions wait for the next note timing at your practice tempo, then add 1.5 / 3 / 5 seconds of grace. Reaction sounds use OBS output only.</small>
            <label className="check"><input type="checkbox" checked={s.bossBattle.soundEnabled} onChange={e=>{if(e.target.checked)battleAudio.unlock();set("bossBattle",{...s.bossBattle,soundEnabled:e.target.checked});}}/>Battle sounds (optional)</label>
            <label>Battle volume ({Math.round(s.bossBattle.volume/.2*100)}%) <input aria-label="Battle volume" type="range" min="0" max="100" step="1" value={Math.round(s.bossBattle.volume/.2*100)} onChange={e=>set("bossBattle",{...s.bossBattle,volume:+e.target.value/500})}/></label>
            <label>Combat effects <input aria-label="Combat effects intensity" type="range" min="0" max="1.5" step="0.1" value={s.bossBattle.effectIntensity} onChange={e=>set("bossBattle",{...s.bossBattle,effectIntensity:+e.target.value})}/></label>
          </div>}
          <BattleAudioControls config={s.bossBattle} onChange={value=>set('bossBattle',value)}/>
          <BattleAnimationPreview/>
          <CinematicControls settings={s} onChange={value=>set("cinematics",value)}/>
          {new URLSearchParams(location.search).get("cinematicPreview")==="1"&&<CinematicDeveloperPreview/>}
        </div>

        <div className="game-settings">
          {(
            [
              ["xp", "Show XP"],
              ["combo", "Show combo"],
              ["achievements", "Achievement notifications"],
              ["milestones", "Streak celebrations"],
              ["expanded", "Expanded banner"],
              ["recording", "Recording mode (hide editing controls)"],
              ["sound", "Enable celebration sounds"],
              ["soundAchievement", "Achievement sound"],
              ["soundLevel", "Level-up sound"],
              ["soundRecord", "Personal-best sound"],
              ["soundMilestone", "Major-combo sound"],
            ] as [keyof GameSettings, string][]
          ).map(([key, label]) => (
            <label className="check" key={key}>
              <input
                type="checkbox"
                checked={!!s[key]}
                onChange={(e) => {
                  set(key, e.target.checked);
                  if (key === "recording" && e.target.checked)
                    setControls(false);
                }}
              />
              {label}
            </label>
          ))}

          <label>
            Celebration intensity
            <select
              value={s.intensity}
              onChange={(e) =>
                set("intensity", e.target.value as GameSettings["intensity"])
              }
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>

          <label>
            Animation duration
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={s.duration}
              onChange={(e) => set("duration", +e.target.value)}
            />
          </label>

          <label>
            Sound volume
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={s.volume}
              onChange={(e) => set("volume", +e.target.value)}
            />
          </label>

          <label>
            Celebration accent brightness
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={s.brightness}
              onChange={(e) => set("brightness", +e.target.value)}
            />
          </label>

          <label>
            Practice timezone
            <input
              defaultValue={s.timezone}
              onBlur={(e) => {
                try {
                  new Intl.DateTimeFormat("en", { timeZone: e.target.value });
                  set("timezone", e.target.value);
                } catch {
                  e.target.value = s.timezone;
                }
              }}
            />
          </label>
        </div>

        <p>
          Tempo rewards are unavailable in note-only practice. Completion
          bonuses require finishing the score. Note XP is saved in the
          background; the live combo is provisional until confirmed.
        </p>

        <div className="row">
          <button disabled={busy} onClick={() => void gameClient.endSession()}>
            End recording session &amp; show summary
          </button>
        </div>

        <p>
          Level milestones: 5 · 15,000 XP → 10 · 100,000 XP → 25 · 501,250 XP
          (Advanced Beginner) → 100 · Expert. Each level costs more XP than the
          last. Earned XP is preserved under the slower progression curve.
        </p>
        <div className="game-obs-sources">
          <strong>OBS Browser Sources</strong>
          <p><a href="/obs/recording" target="_blank" rel="noreferrer">Unified recording view ↗</a> · Banner, score, battle and notifications in one source.</p>
          <p>Start at 1920 × 750. Resize the Browser Source to adjust the score area; keep your keyboard camera as a separate OBS source below it.</p>
          <p>
            <a href="/obs" target="_blank" rel="noreferrer">
              Main banner ↗
            </a>{" · "}<a href="/obs/score" target="_blank" rel="noreferrer">Score only ↗</a>{" "}
            ·{" "}
            <a href="/obs/celebrations" target="_blank" rel="noreferrer">
              Transparent celebrations ↗
            </a>
            {" · "}<a href="/obs/streaks" target="_blank" rel="noreferrer">Streak tracker ↗</a>
          </p>
          <small>
            For the separate-source layout, add celebrations as a Browser Source, 250 × 250, beneath your
            banner. It stays fully transparent between events. Keep it loaded while
            recording; use the previews below to position it. Sign in through
            OBS Interact if prompted.
          </small>
          <small>Streak tracker: a separate 320 × 220 Browser Source. Each threshold announces once per streak, then fades out. After a wrong or missed note, you can earn those notifications again. Your streak continues across loops and exercises.</small>
        </div>
        <h3>Recording-safe preview</h3>
        <p>
          Preview changes visuals only. No XP, achievements or records are
          saved.
        </p>

        <div className="row">
          {(["combo", "achievement", "level", "reset", "exit"] as const).map(
            (kind) => (
              <button
                className="secondary"
                disabled={busy}
                key={kind}
                onClick={() => gameClient.preview(kind)}
              >
                {
                  {
                    combo: "Preview +10 combo",
                    achievement: "Preview achievement",
                    level: "Preview level-up",
                    reset: "Reset preview",
                    exit: "Exit preview",
                  }[kind]
                }
              </button>
            ),
          )}
        </div>

        <h3>
          Achievements · {state.player.unlocks.length} / {achievements.length}
        </h3>

        <div className="game-achievements">
          {achievements.map((a) => {
            const unlocked = state.player.unlocks.some(
              (u) => u.achievementId === a.id,
            );
            return (
              <div key={a.id}>
                <strong>
                  {unlocked ? "✓ " : ""}
                  {a.title}
                </strong>
                <small>
                  {a.description} · {a.reward} XP
                </small>
                {unlocked && (
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => gameClient.preview("achievement", a.title)}
                  >
                    Replay visual
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <small>
          Lifetime best combo: {state.player.best} · Current exercise record:{" "}
          {state.player.exerciseBest}
        </small>
      </details>

      {state.showSummary && state.player.summary && (
        <GameSummaryView summary={state.player.summary} />
      )}
    </section>
  );
}
