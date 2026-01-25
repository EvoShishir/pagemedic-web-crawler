interface CrawlButtonsProps {
  isCrawling: boolean;
  isDiscovering: boolean;
  startUrl: string;
  onStop: () => void;
  isDark: boolean;
}

export function CrawlButtons({
  isCrawling,
  isDiscovering,
  startUrl,
  onStop,
  isDark,
}: CrawlButtonsProps) {
  const isActive = isCrawling || isDiscovering;

  return (
    <div className="flex items-center gap-3 my-4">
      <button
        type="submit"
        disabled={isActive || !startUrl}
        className="cursor-pointer group relative px-6 py-3 bg-linear-to-r border border-indigo-600/80 from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 rounded-xl font-medium text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-indigo-500/25 transition-all duration-200 btn-press"
      >
        <span className="flex items-center gap-2">
          {isDiscovering ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Discovering...
            </>
          ) : isCrawling ? (
            <>
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Crawling...
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Discover Links
            </>
          )}
        </span>
      </button>

      {isActive && (
        <button
          type="button"
          onClick={onStop}
          className={`cursor-pointer px-6 py-3 border rounded-xl font-medium transition-all duration-200 btn-press ${
            isDark
              ? "bg-zinc-800 border-zinc-600/80 text-zinc-300 hover:bg-red-950 hover:border-red-700 hover:text-red-400"
              : "bg-white border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
          }`}
        >
          <span className="flex items-center gap-2">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
              />
            </svg>
            Stop
          </span>
        </button>
      )}
    </div>
  );
}
