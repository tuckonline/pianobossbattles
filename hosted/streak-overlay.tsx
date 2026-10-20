import {GameCelebrations} from "./game-ui";
import {defaultGameSettings} from "./game-core";
import type {OverlaySnapshot} from "./obs-state";

export function StreakOverlay({game, stale, userId}: {
  game?: OverlaySnapshot["game"]; stale: boolean; userId?: string;
}) {
  return <main className="obs-canvas obs-streak-canvas" aria-label="OBS streak tracker">
    <GameCelebrations alerts={stale ? [] : game?.alerts.filter(e => e.kind === "milestone") ?? []}
      settings={game?.settings ?? defaultGameSettings} scene={game?.sessionId ?? ""}
      receiptKey={userId ? `obs:${userId}` : undefined}
      preview={game?.preview} standalone />
  </main>;
}
