import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

export function Header({ isDark, onToggleTheme }: HeaderProps) {
  return (
    <div
      className={`px-6 pt-4 border-slate-200 ${isDark}
          ? "bg-zinc-800/80  glow-primary-subtle"
          : "bg-white/80  glow-primary-subtle-light"`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Logo */}
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-indigo-500 via-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              <span className="text-gradient">PageMedic</span>
            </h1>
            <p
              className={`text-sm ${
                isDark ? "text-zinc-400" : "text-slate-500"
              }`}
            >
              Powered by Playwright
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`hidden sm:inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${
              isDark
                ? "bg-zinc-900/80 border-zinc-700"
                : "bg-white border-slate-300"
            }`}
          >
            <span className={isDark ? "text-zinc-500" : "text-slate-400"}>
              Developed By
            </span>
            <span
              className={`ml-1 underline underline-offset-2 ${
                isDark ? "text-indigo-400" : "text-indigo-500"
              }`}
            >
              <a href="https://atefarmanshishir.netlify.app/">EvoSHiSHiR</a>
            </span>
          </span>
          <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
        </div>
      </div>
    </div>
  );
}
