import { useEffect, useState } from "react";

/**
 * Tracks whether the document is visible.
 * Useful on mobile where backgrounding can pause timers/network.
 */
export function useDocumentVisibility() {
  const [isVisible, setIsVisible] = useState(
    typeof document !== "undefined" ? document.visibilityState === "visible" : true
  );

  useEffect(() => {
    const onChange = () => setIsVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  return { isVisible };
}
