import Image from "next/image";
import type { CompletionBadge as Badge } from "@/lib/completion";

export function CompletionBadge({ badge }: { badge: Badge }) {
  const unit = badge.kind === "country" ? "regions" : "cities";
  return <figure className={`completion-badge${badge.earned ? " is-earned" : ""}`}>
    <Image src={`/journey/game/achievements/${badge.kind === "country" ? "country" : "state"}-complete.svg`} width={100} height={113} alt="" />
    <figcaption><span className="completion-tier">{badge.kind} {badge.earned ? "complete" : "challenge"}</span>
      <strong>{badge.name}</strong>
      <span>{badge.total ? `${badge.completed.toLocaleString("en-US")} / ${badge.total.toLocaleString("en-US")} ${unit}` : "Not yet supported"}</span>
      {!badge.earned && badge.total > 0 && <progress value={badge.completed} max={badge.total} aria-label={`${badge.name} completion`} />}
    </figcaption>
  </figure>;
}
