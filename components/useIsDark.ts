"use client";

import { useEffect, useState } from "react";

/** Следит за классом .dark на <html> (переключатель темы шлёт событие themechange). */
export function useIsDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const read = () => setDark(document.documentElement.classList.contains("dark"));
    read();
    window.addEventListener("themechange", read);
    return () => window.removeEventListener("themechange", read);
  }, []);
  return dark;
}
