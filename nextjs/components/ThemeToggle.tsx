'use client';

import { Sun, Moon } from 'lucide-react';

interface Props {
  className?: string;
}

// Rendering is theme-agnostic (both icons are always in the DOM, CSS shows
// one), so there is no hydration mismatch even though the theme attribute is
// set by an inline script before React loads.
export default function ThemeToggle({ className = '' }: Props) {
  function toggle() {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      // localStorage unavailable (private mode) — theme still switches for this page
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle light or dark theme"
      title="Toggle theme"
      className={`p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    >
      {/* moon shown in light mode (click to go dark); sun shown in dark mode */}
      <Moon className="w-4 h-4 dark:hidden" aria-hidden="true" />
      <Sun className="w-4 h-4 hidden dark:block" aria-hidden="true" />
    </button>
  );
}
