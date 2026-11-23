import type { KeyboardEvent } from "react";
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
  const weeks = yearColumns(selectedDate);
  const byDate = new Map(cells.map((cell) => [cell.date, cell]));

  return <div className="year-grid" role="grid" aria-labelledby="history-period-title">
    <div className="year-week year-weekdays" role="row">
      <span role="columnheader"><span className="sr-only">Month</span></span>
      {weekdays.map((weekday) => <span role="columnheader" key={weekday} aria-label={weekday}>{weekday.slice(0, 1)}</span>)}
    </div>
    {weeks.map((week, index) => {
      const monthStart = week.find((date) => date?.endsWith("-01"));
      return <div className="year-week" role="row" key={index}>
        <span className="year-month-label" role="rowheader">{monthStart ? dateLabel(monthStart, { month: "short" }) : <span className="sr-only">Week {index + 1}</span>}</span>
        {week.map((date, weekday) => {
          const cell = date ? byDate.get(date) : undefined;
          return <div role="gridcell" aria-selected={cell ? cell.date === selectedDate : undefined} key={weekday}>
            {cell && <button type="button" className={`year-day day-${cell.status}`} data-date={cell.date} data-band={cell.band ?? "neutral"}
              style={cell.band === null ? undefined : { backgroundColor: distanceColors[cell.band] }}
              tabIndex={cell.date === selectedDate ? 0 : -1} aria-current={cell.date === today ? "date" : undefined}
              aria-label={`${dateLabel(cell.date, { month: "long", day: "numeric", year: "numeric" })}: ${label(cell)}`}
              onClick={() => onSelect(cell.date)} onKeyDown={(event) => onNavigate(event, cell.date)} />}
          </div>;
        })}
      </div>;
    })}
  </div>;
}
