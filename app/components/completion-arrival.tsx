import type { RefObject } from "react";
import { CelebrationDialog } from "@/app/components/celebration-dialog";
import { CompletionBadge } from "@/app/components/completion-badge";
import type { CompletionBadge as Badge } from "@/lib/completion";

export function CompletionArrival({ badge, fallbackFocus, onContinue }: { badge: Badge; fallbackFocus: RefObject<HTMLButtonElement | null>; onContinue: () => void }) {
  return <CelebrationDialog fallbackFocus={fallbackFocus} onContinue={onContinue} footer={<p className="arrival-count">Every {badge.kind === "country" ? "state & district" : "municipality"} collected</p>}>
    <p className="arrival-eyebrow">{{ state: "State", district: "District", country: "Country" }[badge.kind]} complete!</p>
    <div className="arrival-art completion-arrival-art"><CompletionBadge badge={badge} /></div>
    <h2 id="arrival-title">{badge.name} conquered!</h2>
  </CelebrationDialog>;
}
