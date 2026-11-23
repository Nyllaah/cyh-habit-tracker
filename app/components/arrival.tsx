import { useEffect, useRef, type RefObject } from "react";
import { CityStamp } from "@/app/components/city-stamp";
import type { City } from "@/lib/journey";

type Props = {
  city: City;
  next?: City;
  arrivalCount: number;
  fallbackFocus: RefObject<HTMLButtonElement | null>;
  onContinue: () => void;
};

export function Arrival({ city, next, arrivalCount, fallbackFocus, onContinue }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const fallback = fallbackFocus.current;
    const previousFocus = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    element?.showModal();
    continueButton.current?.focus();
    return () => {
      element?.close();
      const target = previousFocus?.isConnected ? previousFocus : fallback;
      target?.focus({ preventScroll: true });
    };
  }, [fallbackFocus]);

  return (
    <dialog ref={dialog} className="arrival-dialog" aria-labelledby="arrival-title"
      onCancel={(event) => { event.preventDefault(); onContinue(); }}
      onKeyDown={(event) => { if (event.key === "Tab") { event.preventDefault(); continueButton.current?.focus(); } }}>
      <p className="arrival-eyebrow">A new place. Yours.</p>
      <div className="arrival-art">
        <span className="spark spark-one" aria-hidden="true">✦</span>
        <div className="arrival-stamp"><CityStamp city={city} earned /></div>
        <span className="spark spark-two" aria-hidden="true">✦</span>
        <span className="spark spark-three" aria-hidden="true">✦</span>
        <span className="spark spark-four" aria-hidden="true">✦</span>
      </div>
      <h2 id="arrival-title">{city.name} unlocked</h2>
      {next && <p className="arrival-next">Next stop: {next.name}</p>}
      <button ref={continueButton} type="button" className="primary-button" onClick={onContinue}>Continue journey</button>
      <p className="arrival-count">{arrivalCount} {arrivalCount === 1 ? "destination" : "destinations"} collected</p>
    </dialog>
  );
}
