import Image from "next/image";
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
        <Image src="/pagemedic.svg" alt="PageMedic" width={330} height={50} />
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
