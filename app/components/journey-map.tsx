import { legProgress, type City } from "@/lib/journey";

const stops = [{ x: 91, y: 94 }, { x: 126, y: 200 }, { x: 270, y: 296 }];
const curves = [
  { d: "M91 94C15 135 40 180 126 200", a: stops[0], b: { x: 15, y: 135 }, c: { x: 40, y: 180 }, z: stops[1] },
  { d: "M126 200C160 240 220 264 270 296", a: stops[1], b: { x: 160, y: 240 }, c: { x: 220, y: 264 }, z: stops[2] },
];

function pointOnCurve(index: number, t: number) {
  const { a, b, c, z } = curves[index];
  const u = 1 - t;
  return {
    x: u ** 3 * a.x + 3 * u ** 2 * t * b.x + 3 * u * t ** 2 * c.x + t ** 3 * z.x,
    y: u ** 3 * a.y + 3 * u ** 2 * t * b.y + 3 * u * t ** 2 * c.y + t ** 3 * z.y,
  };
}

export function JourneyMap({ route, meters }: { route: City[]; meters: number }) {
  const currentLeg = meters < route[1].cumulativeMeters ? 0 : 1;
  const marker = pointOnCurve(currentLeg, legProgress(route, meters, currentLeg + 1));
  return (
    <svg className="journey-map" viewBox="0 0 358 358" role="img" aria-label={`Illustrated journey from ${route[0].name} through ${route[1].name} to ${route[2].name}. Decorative geography, not walking directions.`}>
      <rect width="358" height="358" rx="28" fill="#E2F0E9" />
      <path d="M0 42Q28 6 93 31T203 17Q268 0 310 42T358 67V283Q317 267 263 324T118 335Q52 304 0 337Z" fill="#D4E9D7" />
      <path d="M-10 225Q51 200 79 245T170 273T282 220T375 250" fill="none" stroke="#B8DFD7" strokeWidth="50" />
      <path d="M-10 225Q51 200 79 245T170 273T282 220T375 250" fill="none" stroke="#8CCFC8" strokeWidth="32" />
      <path d="M-10 220Q51 195 79 240T170 268T282 215T375 245" fill="none" stroke="#C9EAE0" strokeWidth="2" />
      {[[27, 56], [38, 84], [269, 52], [291, 76], [306, 49], [39, 285], [58, 306], [320, 183], [303, 168], [202, 329], [224, 311], [177, 124], [196, 145]].map(([x, y]) => (
        <image key={`${x}-${y}`} href="/journey/game/scenery/tree.svg" x={x - 10} y={y - 12} width="22" height="28" />
      ))}
      {[[123, 68], [144, 90], [21, 150], [255, 133], [275, 152], [65, 320]].map(([x, y]) => (
        <image key={`${x}-${y}`} href="/journey/game/scenery/house.svg" x={x} y={y} width="29" height="28" />
      ))}
      {curves.map((curve, index) => (
        <g key={curve.d}>
          <path d={curve.d} fill="none" stroke="#B6CDB8" strokeWidth="13" strokeLinecap="round" />
          <path d={curve.d} fill="none" stroke="#FEFFFD" strokeWidth="10" strokeLinecap="round" />
          <path d={curve.d} fill="none" stroke="#81AB96" strokeWidth="2" strokeDasharray="1 8" strokeLinecap="round" />
          <path d={curve.d} pathLength="1" fill="none" stroke="#12786F" strokeWidth="6" strokeLinecap="round" strokeDasharray="1" strokeDashoffset={1 - legProgress(route, meters, index + 1)} />
        </g>
      ))}
      {stops.map((stop, index) => <circle key={index} cx={stop.x} cy={stop.y} r="8" fill={meters >= route[index].cumulativeMeters ? "#12786F" : "#FEFFFD"} stroke="#FEFFFD" strokeWidth="3" />)}
      <image href="/journey/game/cities/washington.svg" x="55" y="7" width="79" height="79" />
      <image href="/journey/game/cities/alexandria.svg" x="65" y="119" width="79" height="79" />
      <image href="/journey/game/cities/occoquan.svg" x="222" y="206" width="96" height="96" />
      <rect x="130" y="22" width="124" height="27" rx="13" fill="#FEFFFD" />
      <text x="192" y="40" textAnchor="middle" fontSize="11" fontWeight="600">{route[0].name}, {route[0].region}</text>
      <rect x="157" y="159" width="88" height="27" rx="13" fill="#FEFFFD" />
      <text x="201" y="177" textAnchor="middle" fontSize="12" fontWeight="700">{route[1].name}</text>
      <rect x="221" y="313" width="99" height="28" rx="14" fill="#103F3C" />
      <text x="270" y="332" textAnchor="middle" fontSize="12" fontWeight="700" fill="#FEFFFD">{route[2].name}</text>
      <image href="/journey/game/traveler.svg" x={marker.x - 17} y={marker.y - 32} width="34" height="39" />
      <text x="18" y="337" fontSize="7" fill="#506E68" letterSpacing="1">ILLUSTRATED MAP</text>
      <text x="329" y="27" textAnchor="middle" fontSize="9" fill="#506E68">N</text>
      <path d="M329 44V33m-3 3 3-4 3 4" fill="none" stroke="#506E68" strokeWidth="1.3" />
    </svg>
  );
}
