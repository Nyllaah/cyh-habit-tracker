import { useEffect, useRef, useState, type RefObject, type CSSProperties, type ReactNode } from "react";

type Props = { fallbackFocus: RefObject<HTMLButtonElement | null>; onContinue: () => void; children: ReactNode; footer: ReactNode };
export function CelebrationDialog({ fallbackFocus, onContinue, children, footer }: Props) {
  const [closing, setClosing] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const confetti = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const fallback = fallbackFocus.current;
    const previousFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    element?.showModal();
    // A manual popover paints above the modal without being clipped by it.
    const celebration = confetti.current;
    const supportsPopover = typeof celebration?.showPopover === "function" && typeof celebration?.hidePopover === "function";
    if (supportsPopover && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) celebration?.showPopover();
    continueButton.current?.focus();
    return () => {
      if (supportsPopover) celebration?.hidePopover();
      element?.close();
      const target = previousFocus?.isConnected ? previousFocus : fallback;
      target?.focus({ preventScroll: true });
    };
  }, [fallbackFocus]);

  useEffect(() => {
    if (!closing) return;
    // Keep the modal mounted through its short exit, then advance the queue.
    const timer = window.setTimeout(onContinue, 180);
    return () => window.clearTimeout(timer);
  }, [closing, onContinue]);

  function dismiss() {
    if (closing) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) onContinue();
    else setClosing(true);
  }

  return (
    <dialog ref={dialog} className={`arrival-dialog${closing ? " is-closing" : ""}`} aria-labelledby="arrival-title"
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onKeyDown={(event) => { if (event.key === "Tab") { event.preventDefault(); continueButton.current?.focus(); } }}>
      <div ref={confetti} popover="manual" className="arrival-confetti" aria-hidden="true">
        {Array.from({ length: 48 }, (_, index) => <i key={index} style={{
          left: `${(index * 37) % 100}%`,
          backgroundColor: ["#EF8852", "#20B8A6", "#E8C36B", "#12786F"][index % 4],
          animationDelay: `${index % 7 * 40}ms`,
          "--drift": `${index % 2 ? 35 + index : -35 - index}px`,
          "--turn": `${180 + index * 31}deg`,
        } as CSSProperties} />)}
      </div>
      {children}
      <button ref={continueButton} type="button" className="primary-button" onClick={dismiss}>Continue journey</button>
      {footer}
    </dialog>
  );
}
