import { useState } from "react";
import { command } from "../src/components/ui/actions";
import { gameClient, useGame } from "./game-client";
import { achievements, levelInfo } from "./game-core";
import { AchievementArt } from "./achievement-art";
import type { HostedActor } from "./service";
import Link from "./navigation";
import "./game-profile.css";

export function ProgressSaveStatus() {
  const state = useGame();
  const problem = state.storageError || state.recoveryError || state.error;
  const waiting = !state.ready || state.saving || state.pending > 0;
  const title = problem
    ? "Progress needs syncing"
    : !state.ready
      ? "Checking saved progress…"
      : waiting
        ? "Saving progress…"
        : "All progress saved";
  return (
    <div
      className={`progress-save-status ${problem ? "needs-sync" : waiting ? "is-saving" : "is-saved"}`}
    >
      <span className="save-dot" aria-hidden="true" />
      <div role="status" aria-live="polite">
        <strong>{title}</strong>
        {problem ? (
          <small>{problem}</small>
        ) : state.pending > 0 ? (
          <small>
            {state.pending} practice checkpoint{state.pending === 1 ? "" : "s"}{" "}
            waiting to sync. Recovery copies are kept in this browser when
            storage is available.
          </small>
        ) : state.lastSaved ? (
          <small>
            Cloud confirmed ·{" "}
            {new Date(state.lastSaved).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </small>
        ) : null}
      </div>
      {problem && (
        <button onClick={() => void gameClient.retry()}>Retry save</button>
      )}
      <Link href="/student/profile">Your profile</Link>
    </div>
  );
}

export function ProgressProfile({ actor }: { actor: HostedActor }) {
  const state = useGame();
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");
  const info = levelInfo(state.player.xp, state.player.curveVersion);
  async function download() {
    setDownloading(true);
    setMessage("");
    try {
      await gameClient.retry();
      const cloud = await command<Record<string, unknown>>({
        action: "gameBackup",
      });
      let localRecovery: Record<string, string> = {};
      let recoveryWarning = "";
      try {
        localRecovery = gameClient.localBackup();
      } catch {
        recoveryWarning = "Browser recovery storage could not be read.";
      }
      const file = new Blob(
        [JSON.stringify({ ...cloud, localRecovery, recoveryWarning }, null, 2)],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(file),
        a = document.createElement("a");
      a.href = url;
      a.download = `pianopath-progress-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage(
        recoveryWarning ||
          "Backup downloaded. Keep it somewhere safe; it contains your account details and practice history.",
      );
    } catch {
      // Still offer a recovery file while offline; never label it a full backup.
      try {
        const file = new Blob(
          [
            JSON.stringify(
              {
                format: "pianopath-offline-recovery",
                version: 1,
                account: { id: actor.id },
                exportedAt: new Date().toISOString(),
                localRecovery: gameClient.localBackup(),
              },
              null,
              2,
            ),
          ],
          { type: "application/json" },
        );
        const url = URL.createObjectURL(file),
          a = document.createElement("a");
        a.href = url;
        a.download = "pianopath-offline-recovery.json";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage(
          "Offline recovery file downloaded. Reconnect to download the full cloud backup.",
        );
      } catch {
        setMessage(
          "Backup unavailable. Keep this page open and retry when connected.",
        );
      }
    } finally {
      setDownloading(false);
    }
  }
  return (
    <div className="progress-profile">
      <header>
        <p className="eyebrow">YOUR PIANO JOURNEY</p>
        <h1>Your profile</h1>
        <p>Practice worth keeping.</p>
      </header>
      <section className="panel profile-account" aria-label="Signed-in account">
        <div>
          <h2>{actor.name}</h2>
          <p>{actor.email}</p>
        </div>
        <span className="badge">Signed in with ChatGPT</span>
        <p className="profile-wide">
          Your saved progress belongs to this account. Use the same ChatGPT
          account on another browser or computer to see it again.
        </p>
      </section>
      <section className="profile-level" aria-label="Saved pianist progress">
        <div>
          <p>PIANIST LEVEL</p>
          <h2>
            {state.ready ? info.level : "—"}{" "}
            <span>{state.ready ? info.title : "Connecting…"}</span>
          </h2>
        </div>
        <strong>
          {state.ready ? state.player.xp.toLocaleString() : "—"} XP saved
        </strong>
        <div
          className="profile-xp-track"
          role="progressbar"
          aria-label="Progress to next level"
          aria-valuenow={Math.round(info.percent)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${info.percent}%` }} />
        </div>
        <p>
          {state.ready
            ? info.maxed
              ? "Expert level reached"
              : `${info.remaining.toLocaleString()} XP to level ${info.level + 1}`
            : "Loading your saved level"}
        </p>
        <p>
          Lifetime best combo{" "}
          <strong>{state.ready ? state.player.best : "—"}</strong>
        </p>
      </section>
      <section className="panel" aria-label="Progress protection">
        <h2>Saved for your next session</h2>
        <p>
          Confirmed XP, levels, achievements, and combo records are stored
          online. During practice, checkpoints are also saved in this browser
          and retried automatically if the connection drops.
        </p>
        <p>
          After a browser close or reboot, reopen PianoPath with the same
          browser profile and account while online. Unsent practice is recovered
          automatically. An interrupted exercise keeps its earned note XP;
          completion rewards require a completed exercise.
        </p>
        <p className="muted">
          Clearing browser data or using private browsing can remove unsynced
          recovery copies. A sudden power loss before the browser writes to disk
          cannot be guaranteed. Wait for “All progress saved” before switching
          devices.
        </p>
        <button onClick={download} disabled={downloading || !state.ready}>
          {downloading ? "Preparing backup…" : "Download progress backup"}
        </button>
        <p className="muted">
          Includes saved XP records, achievements, sessions, and local recovery
          data. Keep this file for support-assisted recovery; uploading an
          edited file cannot change your XP.
        </p>
        {message && <p role="status">{message}</p>}
      </section>
      <section aria-label="Your achievements">
        <div className="profile-section-heading">
          <h2>Achievements</h2>
          <span>
            {state.ready ? state.player.unlocks.length : "—"} /{" "}
            {achievements.length} unlocked
          </span>
        </div>
        <div className="profile-achievements">
          {achievements.map((a) => {
            const unlocked = state.player.unlocks.find(
              (u) => u.achievementId === a.id,
            );
            return (
              <article
                className={`profile-achievement ${unlocked ? "unlocked" : "locked"}`}
                key={a.id}
              >
                <AchievementArt id={a.id} locked={!unlocked} />
                <div>
                  <span className="eyebrow">
                    {!state.ready
                      ? "LOADING"
                      : unlocked
                        ? "UNLOCKED"
                        : "LOCKED"}
                  </span>
                  <h3>{a.title}</h3>
                  <p>{a.description}</p>
                  <small>
                    {unlocked
                      ? `Earned ${new Date(unlocked.unlockedAt).toLocaleDateString()}`
                      : `+${a.reward} XP when unlocked`}
                  </small>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
