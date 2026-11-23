import Image from "next/image";
import { CompletionBadge } from "@/app/components/completion-badge";
import { useState } from "react";
import { PassportCountryPicker } from "@/app/components/passport-country-picker";
import { CityStamp } from "@/app/components/city-stamp";
import type { CountryPassport, PassportStamp } from "@/lib/passport";
import { placeKey } from "@/lib/places";

function StampGrid({ stamps }: { stamps: PassportStamp[] }) {
  return <ul className="stamp-grid">{stamps.map((stamp) => <li key={placeKey(stamp.city)}>
    <CityStamp city={stamp.city} earned={stamp.earned} origin={stamp.origin} />
  </li>)}</ul>;
}

export function Passport({ countries, currentCountry }: { countries: CountryPassport[]; currentCountry?: string }) {
  const [selectedCountry, setSelectedCountry] = useState(currentCountry ?? countries.find((country) => country.country === "US")?.country ?? countries[0]?.country ?? "");
  const selected = countries.find((country) => country.country === selectedCountry) ?? countries[0];
  if (!selected) return <section className="passport" aria-labelledby="passport-title">
    <div className="section-heading"><h2 id="passport-title">Your passport</h2><p>0 arrivals</p></div>
    <p className="passport-empty">Your first stamp awaits</p>
  </section>;
  const { collection, name } = selected;
  const { preview, moreCollected, moreUpcoming, arrivalCount } = collection;
  const regionChallenge = selected.completion?.regions.find((badge) => badge.region === selected.focusRegion);
  const isCurrentCountry = selected.country === currentCountry;
  const hasMore = moreCollected.length > 0 || moreUpcoming.length > 0;
  return (
    <section className="passport" aria-labelledby="passport-title">
      <div className="section-heading"><h2 id="passport-title">Your passport</h2><p>{arrivalCount} {arrivalCount === 1 ? "arrival" : "arrivals"}</p></div>
      <PassportCountryPicker countries={countries} value={selected.country} currentCountry={currentCountry} onChange={setSelectedCountry} />
      <div key={selected.country} role="region" aria-label={name}>
        <StampGrid stamps={preview} />
        {hasMore && <details className="passport-more">
          <summary><span className="passport-expand-label">View all stamps</span><span className="passport-collapse-label">Show less</span><Image src="/journey/icons/chevron-down.svg" width={20} height={20} alt="" /></summary>
          <div className="passport-extra">
            {moreCollected.length > 0 && <div><h3>More collected</h3><StampGrid stamps={moreCollected} /></div>}
            {moreUpcoming.length > 0 && <div><h3>Next discoveries</h3><StampGrid stamps={moreUpcoming} /></div>}
          </div>
        </details>}
        {selected.completion && <div className="passport-milestones" aria-label="State and country challenges">
          <h3 className="passport-country-title">Grand discoveries</h3>
          <div className="completion-grid">
            {regionChallenge && <CompletionBadge badge={regionChallenge} current={isCurrentCountry} />}
            <CompletionBadge badge={selected.completion.country} current={isCurrentCountry} />
            {selected.completion.regions.filter((badge) => badge.earned && badge.region !== selected.focusRegion).map((badge) => <CompletionBadge key={badge.id} badge={badge} />)}
          </div>
          {!selected.completion.country.supported && <p className="completion-coverage">{selected.completion.regions.filter((badge) => !badge.supported).map((badge) => badge.name).join(", ")} not yet supported</p>}
        </div>}
      </div>
    </section>
  );
}
