import { useId } from "react";
import { cityArtwork, type Place } from "@/lib/places";

export function CityStamp({ city, earned, origin = false }: { city: Place; earned: boolean; origin?: boolean }) {
  const mask = useId();
  const status = origin ? "Origin" : earned ? "Collected" : "Up next";
  return (
    <figure className={`city-stamp ${earned ? "" : "stamp-future"}`} role="img" aria-label={`${city.name}${city.region ? `, ${city.region}` : ""}: ${status.toLowerCase()}`}>
      <svg viewBox="0 0 144 184" aria-hidden="true">
        <defs><mask id={mask}>
          <rect width="144" height="184" fill="white" />
          {Array.from({ length: 12 }, (_, i) => <g key={i}><circle cx={10 + i * 12} cy="4" r="3" fill="black" /><circle cx={10 + i * 12} cy="180" r="3" fill="black" /></g>)}
          {Array.from({ length: 14 }, (_, i) => <g key={i}><circle cx="4" cy={16 + i * 12} r="3" fill="black" /><circle cx="140" cy={16 + i * 12} r="3" fill="black" /></g>)}
        </mask></defs>
        <g mask={`url(#${mask})`}>
          <rect x="4" y="4" width="136" height="176" rx="5" fill="#FEFFFD" stroke="#103F3C" strokeWidth="1.5" />
          <rect x="12" y="12" width="120" height="112" rx="4" fill={earned ? "#CDEBE1" : "#E4ECE7"} />
          <text x="22" y="30" fontSize="10" letterSpacing="1" fill="#12786F">{city.country || city.region || "GPS"}</text>
          <text x="113" y="30" fill="#EF8852" fontSize="16">✦</text>
          <image href={`/journey/game/cities/${cityArtwork(city)}.svg`} x="15" y="25" width="115" height="104" opacity={earned ? 1 : 0.42} />
          <circle cx="115" cy="114" r="12" fill={earned ? "#EF8852" : "#FEFFFD"} />
          {earned ? <path d="m109 114 4 4 8-9" fill="none" stroke="#103F3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M111 120V107m0 0q5-3 9 0v6q-4-3-9 0" fill="none" stroke="#506E68" strokeWidth="1.5" />}
        </g>
      </svg>
      <figcaption><span className="stamp-name" title={city.name}>{city.name}</span><span className="stamp-status">{status}</span></figcaption>
    </figure>
  );
}
