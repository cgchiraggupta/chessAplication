import { memo } from "react";

interface LobbyViewProps {
  username: string;
  onUsernameChange: (value: string) => void;
  onFindGame: () => void;
  onCancelSearch: () => void;
  connected: boolean;
  findingGame: boolean;
  scriptsReady: boolean;
  waitSeconds: number;
  statusMessage: string | null;
}

export const LobbyView = memo(function LobbyView({
  username,
  onUsernameChange,
  onFindGame,
  onCancelSearch,
  connected,
  findingGame,
  scriptsReady,
  waitSeconds,
  statusMessage,
}: LobbyViewProps) {
  return (
    <section className="w-full max-w-md px-4 sm:px-0 animate-fade-up text-center">
      <p
        className="text-[var(--cream-muted)] text-base sm:text-lg mb-6 sm:mb-8"
        style={{ fontFamily: "var(--font-cormorant)" }}
      >
        Play a rapid game. You'll be matched with another player.
      </p>
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Your username"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onFindGame()}
          className="w-full rounded-[var(--radius)] border border-[var(--felt-light)] bg-[var(--felt)] px-4 py-3 text-base sm:text-sm text-[var(--cream)] placeholder-[var(--cream-muted)] focus:border-[var(--gold)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]"
          disabled={!connected || findingGame}
          autoComplete="username"
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button
          onClick={onFindGame}
          disabled={!connected || findingGame || !scriptsReady}
          className="w-full rounded-[var(--radius)] bg-[var(--gold)] px-4 py-3 sm:py-3 font-medium text-base sm:text-sm text-[var(--ink)] transition hover:bg-[var(--gold-dim)] hover:text-[var(--cream)] active:bg-[var(--gold-dim)] disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        >
          {findingGame ? "Finding opponent…" : "Find a game"}
        </button>
        {findingGame && (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center justify-center gap-2 text-sm text-[var(--cream-muted)]">
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[var(--cream-muted)] border-t-[var(--gold)]"
                aria-hidden
              />
              <span>Waiting {waitSeconds}s</span>
            </div>
            <button
              type="button"
              onClick={onCancelSearch}
              className="text-sm text-[var(--cream-muted)] underline hover:text-[var(--cream)]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
      {statusMessage && (
        <p
          className="mt-4 text-sm text-[var(--cream-muted)] animate-fade-up"
          role="status"
        >
          {statusMessage}
        </p>
      )}
    </section>
  );
});
