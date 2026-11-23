import Image from "next/image";
import { useState } from "react";
import { CityStamp } from "@/app/components/city-stamp";
import type { CountryPassport, PassportStamp } from "@/lib/passport";
import { placeKey } from "@/lib/places";

function StampGrid({ stamps }: { stamps: PassportStamp[] }) {
  return <ul className="stamp-grid">{stamps.map((stamp) => <li key={placeKey(stamp.city)}>
    <CityStamp city={stamp.city} earned={stamp.earned} origin={stamp.origin} />
  </li>)}</ul>;
}

export function Passport({ countries, currentCountry }: { countries: CountryPassport[]; currentCountry?: string }) {
  const [selectedCountry, setSelectedCountry] = useState(currentCountry ?? countries.find((country) => country.country === "US")?.country ?? countries[0].country);
  const selected = countries.find((country) => country.country === selectedCountry) ?? countries[0];
  const { collection, name } = selected;
  const { preview, moreCollected, moreUpcoming, arrivalCount } = collection;
  const hasMore = moreCollected.length > 0 || moreUpcoming.length > 0;
  return (
    <section className="passport" aria-labelledby="passport-title">
      <div className="section-heading"><h2 id="passport-title">Your passport</h2><p>{arrivalCount} {arrivalCount === 1 ? "arrival" : "arrivals"}</p></div>
      <div className="passport-country-switch" role="group" aria-label="Passport country">
        {countries.map((country) => <button key={country.country} type="button" aria-pressed={country.country === selected.country}
          aria-label={`View ${country.name} stamps${country.country === currentCountry ? ", current journey" : ""}`} onClick={() => setSelectedCountry(country.country)}>
          <span>{country.name}</span>{country.country === currentCountry && <small>Current</small>}
        </button>)}
      </div>
      <div key={selected.country} role="region" aria-labelledby="passport-country-title">
        <h3 id="passport-country-title" className="passport-country-title">{name}</h3>
        <StampGrid stamps={preview} />
        {hasMore && <details className="passport-more">
          <summary><span className="passport-expand-label">View all stamps</span><span className="passport-collapse-label">Show less</span><Image src="/journey/icons/chevron-down.svg" width={20} height={20} alt="" /></summary>
          <div className="passport-extra">
            {moreCollected.length > 0 && <div><h3>More collected</h3><StampGrid stamps={moreCollected} /></div>}
            {moreUpcoming.length > 0 && <div><h3>Next discoveries</h3><StampGrid stamps={moreUpcoming} /></div>}
          </div>
        </details>}
      </div>
    </section>
  );
}
