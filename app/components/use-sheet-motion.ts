import { useEffect, useRef, useState } from "react";

// Keep the native dialog mounted until its 200 ms exit finishes.
export function useSheetMotion() {
  const [closing, setClosing] = useState(false);
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function finish(action: () => boolean | void) {
    if (pending.current) return;
    pending.current = true;
    const complete = () => {
      // A rejected city selection leaves the drawer available for another try.
      if (action() === false) {
        pending.current = false;
        setClosing(false);
      }
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      complete();
    } else {
      setClosing(true);
      timer.current = setTimeout(complete, 200);
    }
  }

  return { closing, finish };
}
