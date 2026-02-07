import { memo, RefObject } from "react";

export interface GameState {
  gameId: string;
  color: string;
  opponent: string;
  gameState: string;
}

interface GameViewProps {
  currentGame: GameState;
  gameOver: boolean;
  myTurn: boolean;
  statusMessage: string | null;
  containerRef: RefObject<HTMLDivElement | null>;
  onResign: () => void;
  onLeaveGame: () => void;
}

export const GameView = memo(function GameView({
  currentGame,
  gameOver,
  myTurn,
  statusMessage,
  containerRef,
  onResign,
  onLeaveGame,
}: GameViewProps) {
  return (
    <section className="flex flex-col items-center gap-6 animate-fade-up">
      <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-[var(--cream-muted)] animate-fade-up animate-fade-up-delay-1">
        <span>
          You play{" "}
          <strong className="text-[var(--cream)]">{currentGame.color}</strong>
        </span>
        <span>·</span>
        <span>
          Opponent:{" "}
          <strong className="text-[var(--cream)]">{currentGame.opponent}</strong>
        </span>
      </div>

      <div
        className={`board-frame animate-fade-up animate-fade-up-delay-2 ${myTurn ? "turn-indicator-active" : ""}`}
        ref={containerRef}
      >
        <div
          id="myBoard"
          className="min-w-[280px] w-[min(90vw,420px)] sm:w-[min(80vw,400px)] aspect-square"
        />
      </div>

      <div
        className="text-center animate-fade-up animate-fade-up-delay-3"
        role="status"
      >
        {gameOver ? (
          <p className="text-[var(--gold)] font-medium">Game over.</p>
        ) : myTurn ? (
          <p className="text-[var(--gold)]">Your turn</p>
        ) : (
          <p className="text-[var(--cream-muted)]">Opponent’s turn</p>
        )}
      </div>

      {!gameOver && (
        <div className="flex items-center gap-3 animate-fade-up animate-fade-up-delay-3">
          <button
            type="button"
            onClick={onResign}
            className="rounded-[var(--radius)] border border-[var(--felt-light)] bg-[var(--felt)] px-4 py-3 sm:px-3 sm:py-2 text-sm text-[var(--cream-muted)] hover:text-[var(--cream)] active:bg-[var(--felt-light)] touch-manipulation"
          >
            Resign
          </button>
          <button
            type="button"
            onClick={onLeaveGame}
            className="rounded-[var(--radius)] border border-[var(--felt-light)] bg-[var(--felt)] px-4 py-3 sm:px-3 sm:py-2 text-sm text-[var(--cream-muted)] hover:text-[var(--cream)] active:bg-[var(--felt-light)] touch-manipulation"
          >
            Leave game
          </button>
        </div>
      )}

      {statusMessage && (
        <p className="text-sm text-[var(--cream-muted)]" role="alert">
          {statusMessage}
        </p>
      )}
    </section>
  );
});
