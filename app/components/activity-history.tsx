import { useRef, useState, type KeyboardEvent } from "react";
import Image from "next/image";
import { addDays, dateLabel, distanceColors, monthDates, navigateHistory, periodActivity, shiftMonth, weekdayIndex, yearDates, type HistoryView, type ActivityCell } from "@/lib/history";
import { formatImportedDistance, type DistanceUnit } from "@/lib/distance";
import { YearActivityGrid } from "@/app/components/year-activity-grid";
import type { Day } from "@/lib/journey";

const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function activityValue(cell: ActivityCell, unit: DistanceUnit): string {
  return cell.status === "recorded" ? formatImportedDistance(cell.meters!, unit) : cell.status === "future" ? "Upcoming" : "Not recorded";
}

export function ActivityHistory({ days, today, unit }: { days: Day[]; today: string; unit: DistanceUnit }) {
  const [selectedDate, setSelectedDate] = useState(() => addDays(today, -1));
  const [view, setView] = useState<HistoryView>("month");
  const calendar = useRef<HTMLDivElement>(null);
  const cells = periodActivity(view === "month" ? monthDates(selectedDate) : yearDates(selectedDate), days, today);
  const selected = cells.find((cell) => cell.date === selectedDate)!;
  const periodTitle = dateLabel(selectedDate, view === "month" ? { month: "long", year: "numeric" } : { year: "numeric" });

  function select(date: string, focus = false) {
    setSelectedDate(date);
    // Navigation can render a different period before its day is focused.
    if (focus) requestAnimationFrame(() => calendar.current?.querySelector<HTMLButtonElement>(`[data-date="${date}"]`)?.focus());
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const next = navigateHistory(date, event.key, view);
    if (!next) return;
    event.preventDefault();
    select(next, true);
  }

  const offset = weekdayIndex(cells[0].date);
  const rows = view === "month" ? Array.from({ length: Math.ceil((offset + cells.length) / 7) }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => cells[week * 7 + day - offset])) : [];

  return (
    <section className="activity-history" aria-labelledby="history-title">
      <div className="section-heading"><h2 id="history-title">Your rhythm</h2>
        <div className="history-view-switch" role="group" aria-label="Activity history view">
          <button type="button" aria-pressed={view === "month"} onClick={() => setView("month")}>Month</button>
          <button type="button" aria-pressed={view === "year"} onClick={() => setView("year")}>Year</button>
        </div>
      </div>
      <div className="history-period">
        <h3 id="history-period-title">{periodTitle}</h3>
        <button type="button" className="icon-button" aria-label={`Previous ${view}`} onClick={() => select(shiftMonth(selectedDate, view === "year" ? -12 : -1))}><Image src="/journey/icons/chevron-right.svg" width={24} height={24} alt="" className="previous-period" /></button>
        <button type="button" className="icon-button" aria-label={`Next ${view}`} onClick={() => select(shiftMonth(selectedDate, view === "year" ? 12 : 1))}><Image src="/journey/icons/chevron-right.svg" width={24} height={24} alt="" /></button>
      </div>
      <div ref={calendar} key={view} className="history-content">
      {view === "year" ? (
        <YearActivityGrid cells={cells} selectedDate={selectedDate} today={today} label={(cell) => activityValue(cell, unit)} onSelect={select} onNavigate={navigate} />
      ) : (
      <div role="grid" className="month-calendar" aria-labelledby="history-period-title">
        <div role="row" className="calendar-weekdays">{weekdays.map((day) => <span role="columnheader" key={day} aria-label={day}>{day[0]}</span>)}</div>
        {rows.map((row, index) => <div role="row" className="calendar-week" key={index}>
          {row.map((cell, column) => <div role="gridcell" key={cell?.date ?? `blank-${column}`} aria-selected={cell ? cell.date === selectedDate : undefined}>
            {cell && <button type="button" className={`calendar-day day-${cell.status}`} data-date={cell.date} data-band={cell.band ?? "neutral"}
              style={cell.band === null ? undefined : { backgroundColor: distanceColors[cell.band] }}
              tabIndex={cell.date === selectedDate ? 0 : -1} aria-current={cell.date === today ? "date" : undefined}
              aria-label={`${dateLabel(cell.date, { month: "long", day: "numeric", year: "numeric" })}: ${activityValue(cell, unit)}`}
              onClick={() => select(cell.date)} onKeyDown={(event) => navigate(event, cell.date)}>{Number(cell.date.slice(-2))}</button>}
          </div>)}
        </div>)}
      </div>
      )}
      </div>
      <div className="history-legend" aria-hidden="true"><span>Less</span><i className="legend-zero" />{distanceColors.map((color) => <i key={color} style={{ backgroundColor: color }} />)}<span>More</span></div>
      <p className="sr-only">Colors show distance from low to high within this {view}. Unrecorded and upcoming dates have no distance.</p>
      <div className="history-readout" aria-live="polite" aria-atomic="true"><span>{dateLabel(selectedDate, { month: "short", day: "numeric" })}</span><strong>{activityValue(selected, unit)}</strong></div>
    </section>
  );
}
