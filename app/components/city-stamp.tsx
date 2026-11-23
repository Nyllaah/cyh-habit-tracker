import { useId } from "react";
import { capitalKind, cityArtwork, type Place } from "@/lib/places";

export function CityStamp({ city, earned, origin = false }: { city: Place; earned: boolean; origin?: boolean }) {
  const mask = useId();
  const capital = capitalKind(city);
  const status = origin ? "Origin" : earned ? "Collected" : "Up next";
  return (
    <figure className={`city-stamp ${capital ? "stamp-capital" : ""} ${earned ? "" : "stamp-future"}`} role="img" aria-label={`${city.name}${city.region ? `, ${city.region}` : ""}${capital ? `, ${capital} capital milestone` : ""}: ${status.toLowerCase()}`}>
      <svg viewBox="0 0 144 184" aria-hidden="true">
        <defs>
          {capital && <linearGradient id={`${mask}-gold`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#FFF1AD" /><stop offset="1" stopColor="#FFC66F" /></linearGradient>}
          <mask id={mask}>
          <rect width="144" height="184" fill="white" />
          {Array.from({ length: 12 }, (_, i) => <g key={i}><circle cx={10 + i * 12} cy="4" r="3" fill="black" /><circle cx={10 + i * 12} cy="180" r="3" fill="black" /></g>)}
          {Array.from({ length: 14 }, (_, i) => <g key={i}><circle cx="4" cy={16 + i * 12} r="3" fill="black" /><circle cx="140" cy={16 + i * 12} r="3" fill="black" /></g>)}
        </mask></defs>
        <g mask={`url(#${mask})`}>
          <rect x="4" y="4" width="136" height="176" rx="5" fill={capital ? "#FFF9EB" : "#FEFFFD"} stroke={capital ? earned ? "#CB7B14" : "#B6A17A" : "#103F3C"} strokeWidth={capital ? "2" : "1.5"} />
          {capital && <rect x="8" y="8" width="128" height="168" rx="3" fill="none" stroke={earned ? "#EBBC5C" : "#DFD1B3"} />}
          <rect x="12" y="12" width="120" height="112" rx="4" fill={capital ? earned ? `url(#${mask}-gold)` : "#F0E7D5" : earned ? "#CDEBE1" : "#E4ECE7"} />
          {capital && earned && <path d="m20 84 54-54m-30 82 62-62" stroke="#FEFFFD" strokeWidth="9" opacity=".25" />}
          <text x="22" y="30" fontSize={capital ? "8.5" : "10"} letterSpacing={capital ? ".5" : "1"} fill={capital ? "#7B430D" : "#12786F"}>{city.country || city.region || "GPS"}{capital ? " · CAPITAL" : ""}</text>
          {capital && <g opacity={earned ? 1 : .5}><circle cx="116" cy="27" r="11" fill="#B95F13" /><path d="m116 19 2.2 4.6 5.1.7-3.7 3.6.9 5.1-4.5-2.4-4.5 2.4.9-5.1-3.7-3.6 5.1-.7Z" fill="#FFF1AD" /></g>}
          <image href={`/journey/game/cities/${cityArtwork(city)}.svg`} x="15" y="25" width="115" height="104" opacity={earned ? 1 : 0.42} />
          <circle cx="115" cy="114" r="12" fill={earned ? "#EF8852" : "#FEFFFD"} />
          {earned ? <path d="m109 114 4 4 8-9" fill="none" stroke="#103F3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M111 120V107m0 0q5-3 9 0v6q-4-3-9 0" fill="none" stroke="#506E68" strokeWidth="1.5" />}
        </g>
      </svg>
      <figcaption><span className="stamp-name" title={city.name}>{city.name}</span><span className="stamp-status">{status}</span></figcaption>
    </figure>
  );
}
