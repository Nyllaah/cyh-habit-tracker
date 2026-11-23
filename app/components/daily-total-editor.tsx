import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Image from "next/image";
import { entryValue, formatImportedDistance, parseDistanceEntry, type DistanceUnit } from "@/lib/distance";

type Props = {
  meters: number;
  importedMeters?: number;
  hasCorrection: boolean;
  unit: DistanceUnit;
  onSave: (meters: number) => void;
  onUseImported: () => void;
  onClose: () => void;
};

export function DailyTotalEditor({ meters, importedMeters, hasCorrection, unit, onSave, onUseImported, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [originalMeters] = useState(meters);
  const [value, setValue] = useState(() => entryValue(meters, unit));
  const [error, setError] = useState("");

  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    input.current?.focus();
    input.current?.select();
    return () => {
      element?.close();
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  function containTab(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input");
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = parseDistanceEntry(value, unit, originalMeters);
    if (result === null) {
      setError(unit === "metric" ? "Enter a whole number of meters." : "Enter a positive distance or zero.");
      input.current?.focus();
      return;
    }
    onSave(result);
  }

  return (
    <dialog ref={dialog} className="total-sheet" aria-labelledby="total-title" aria-describedby="total-description" onKeyDown={containTab} onCancel={onClose} onClick={(event) => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
      <form onSubmit={save} noValidate>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-heading">
          <h2 id="total-title">Today&apos;s total</h2>
          <button type="button" className="icon-button" aria-label="Close daily total editor" onClick={onClose}><Image src="/journey/icons/close.svg" width={24} height={24} alt="" /></button>
        </div>
        <p id="total-description" className="sheet-description">Replaces the imported total</p>
        <label className="distance-input" htmlFor="daily-total">
          <span className="sr-only">{unit === "metric" ? "Today's total in meters" : "Today's total in miles"}</span>
          <input ref={input} id="daily-total" type="text" enterKeyHint="done" inputMode={unit === "metric" ? "numeric" : "decimal"} autoComplete="off" value={value} onChange={(event) => { setValue(event.target.value); setError(""); }} aria-invalid={!!error} aria-describedby={error ? "distance-error" : "total-description"} />
          <span aria-hidden="true">{unit === "metric" ? "m" : "mi"}</span>
        </label>
        {error && <p id="distance-error" className="input-error" role="alert">{error}</p>}
        <p className="imported-value">{importedMeters === undefined ? "Not synced yet" : `Imported: ${formatImportedDistance(importedMeters, unit)}`}</p>
        {hasCorrection && importedMeters !== undefined && <button type="button" className="text-button" onClick={onUseImported}>Use imported total</button>}
        <button type="submit" className="primary-button">Save total</button>
        <button type="button" className="cancel-button" onClick={onClose}>Cancel</button>
      </form>
    </dialog>
  );
}
