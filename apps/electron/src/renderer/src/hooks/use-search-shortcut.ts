import { type RefObject, useEffect } from "react";

/** Focus the page search field on Cmd/Ctrl+K. */
export function useSearchShortcut(
  inputRef: RefObject<HTMLInputElement | null>,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.select();
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [inputRef, enabled]);
}
