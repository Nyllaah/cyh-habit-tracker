import Image from "next/image";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { CountryPassport } from "@/lib/passport";

export function PassportCountryPicker({ countries, value, currentCountry, onChange }: {
  countries: CountryPassport[];
  value: string;
  currentCountry?: string;
  onChange: (country: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const selected = countries.find((country) => country.country === value)!;

  useEffect(() => {
    if (!open) return;
    list.current?.focus({ preventScroll: true });
    function dismiss(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function show() {
    setActiveIndex(countries.findIndex((country) => country.country === value));
    setOpen(true);
  }

  function choose(index: number) {
    onChange(countries[index].country);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(activeIndex);
      return;
    }
    let next = activeIndex;
    if (event.key === "ArrowDown") next = (activeIndex + 1) % countries.length;
    else if (event.key === "ArrowUp") next = (activeIndex - 1 + countries.length) % countries.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = countries.length - 1;
    else if (/^[a-z]$/i.test(event.key)) {
      const match = countries.findIndex((country) => country.name.toLowerCase().startsWith(event.key.toLowerCase()));
      if (match >= 0) next = match;
    } else return;
    event.preventDefault();
    setActiveIndex(next);
  }

  return <div className="passport-country-picker" ref={container} onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="passport-country-trigger" aria-label={`Passport country: ${selected.name}`} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => open ? setOpen(false) : show()} onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); show(); }
      }}>
      <span>{selected.name}</span>{value === currentCountry && <span className="country-current">Current</span>}
      <Image src="/journey/icons/chevron-down.svg" width={20} height={20} alt="" />
    </button>
    {open && <div ref={list} id={id} className="passport-country-options" role="listbox" aria-label="Passport country" tabIndex={0} aria-activedescendant={`${id}-${activeIndex}`} onKeyDown={navigate}>
      {countries.map((country, index) => <div key={country.country} id={`${id}-${index}`} role="option" aria-selected={country.country === value} className={`passport-country-option${index === activeIndex ? " is-active" : ""}`} onClick={() => choose(index)}>
        <span>{country.name}</span>{country.country === currentCountry && <span className="country-current">Current</span>}
        <span className="country-selected" aria-hidden="true">{country.country === value ? "✓" : ""}</span>
      </div>)}
    </div>}
  </div>;
}
