import type { RefObject } from "react";
import { CelebrationDialog } from "@/app/components/celebration-dialog";
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
  return <CelebrationDialog fallbackFocus={fallbackFocus} onContinue={onContinue} footer={<p className="arrival-count">{arrivalCount} {arrivalCount === 1 ? "destination" : "destinations"} collected</p>}>
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
    </CelebrationDialog>;
}
