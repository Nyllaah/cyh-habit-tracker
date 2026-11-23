import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import { dateLabel, distanceColors, yearColumns, type ActivityCell } from "@/lib/history";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type Props = {
  cells: ActivityCell[];
  selectedDate: string;
  today: string;
  label: (cell: ActivityCell) => string;
  onSelect: (date: string) => void;
  onNavigate: (event: KeyboardEvent<HTMLButtonElement>, date: string) => void;
};

export function YearActivityGrid({ cells, selectedDate, today, label, onSelect, onNavigate }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const columns = yearColumns(selectedDate);
  const byDate = new Map(cells.map((cell) => [cell.date, cell]));
  const months = cells.filter((cell) => cell.date.endsWith("-01"));

  useEffect(() => {
    const container = scroller.current;
    const selected = container?.querySelector<HTMLButtonElement>(`[data-date="${selectedDate}"]`);
    if (!container || !selected) return;
    const bounds = container.getBoundingClientRect();
    const target = selected.getBoundingClientRect();
    // Move only this strip; entering Year must not scroll the whole page.
    container.scrollLeft += target.left - bounds.left - container.clientWidth / 2 + target.width / 2;
  }, [selectedDate]);

  return (
    <>
      <div ref={scroller} className="year-scroll" role="region" aria-label="Year activity, scroll to explore">
        <div className="year-strip" style={{ "--week-count": columns.length } as CSSProperties}>
          <div className="year-months" aria-hidden="true">
            {months.map((cell) => <span key={cell.date} style={{ gridColumn: columns.findIndex((week) => week.includes(cell.date)) + 2 }}>{dateLabel(cell.date, { month: "short" })}</span>)}
          </div>
          <div role="grid" aria-labelledby="history-period-title" aria-rowcount={7} aria-colcount={columns.length + 1}>
            {weekdays.map((weekday, row) => <div className="year-weekday" role="row" key={weekday}>
              <span className="year-row-label" role="rowheader" aria-label={weekday}>{row % 2 === 0 ? weekday.slice(0, 3) : <span className="sr-only">{weekday}</span>}</span>
              {columns.map((week, column) => {
                const cell = week[row] ? byDate.get(week[row]!) : undefined;
                return <div role="gridcell" aria-selected={cell ? cell.date === selectedDate : undefined} key={column}>
                  {cell && <button type="button" className={`year-day day-${cell.status}`} data-date={cell.date} data-band={cell.band ?? "neutral"}
                    style={cell.band === null ? undefined : { backgroundColor: distanceColors[cell.band] }}
                    tabIndex={cell.date === selectedDate ? 0 : -1} aria-current={cell.date === today ? "date" : undefined}
                    aria-label={`${dateLabel(cell.date, { month: "long", day: "numeric", year: "numeric" })}: ${label(cell)}`}
                    onClick={() => onSelect(cell.date)} onKeyDown={(event) => onNavigate(event, cell.date)} />}
                </div>;
              })}
            </div>)}
          </div>
        </div>
      </div>
      <p className="year-scroll-hint">Swipe to explore</p>
    </>
  );
}
