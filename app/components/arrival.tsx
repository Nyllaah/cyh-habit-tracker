import { useEffect, useRef, useState, type RefObject, type CSSProperties } from "react";
import { CityStamp } from "@/app/components/city-stamp";
import type { City } from "@/lib/journey";
import { capitalKind } from "@/lib/places";

type Props = {
  city: City;
  next?: City;
  arrivalCount: number;
  fallbackFocus: RefObject<HTMLButtonElement | null>;
  onContinue: () => void;
};

export function Arrival({ city, next, arrivalCount, fallbackFocus, onContinue }: Props) {
  const capital = capitalKind(city);
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
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) celebration?.showPopover();
    continueButton.current?.focus();
    return () => {
      celebration?.hidePopover();
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
      <p className="arrival-eyebrow">{capital ? "Capital milestone" : "A new place. Yours."}</p>
      <div className="arrival-art">
        <span className="spark spark-one" aria-hidden="true">✦</span>
        <div className="arrival-stamp"><CityStamp city={city} earned /></div>
        <span className="spark spark-two" aria-hidden="true">✦</span>
        <span className="spark spark-three" aria-hidden="true">✦</span>
        <span className="spark spark-four" aria-hidden="true">✦</span>
      </div>
      <h2 id="arrival-title">{city.name} unlocked</h2>
      {next && <p className="arrival-next">Next stop: {next.name}</p>}
      <button ref={continueButton} type="button" className="primary-button" onClick={dismiss}>Continue journey</button>
      <p className="arrival-count">{arrivalCount} {arrivalCount === 1 ? "destination" : "destinations"} collected</p>
    </dialog>
  );
}
