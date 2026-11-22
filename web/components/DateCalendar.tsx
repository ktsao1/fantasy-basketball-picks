"use client";

import { useId, useRef, useState } from "react";
import { Chevron } from "@/components/ui";
import { dayShort, monthDay, weekday } from "@/lib/format";

export function DateCalendar({ dates, date, onChange, label, variant = "record" }: {
  dates: string[];
  date: string;
  onChange: (date: string) => void;
  label: string;
  variant?: "record" | "scoreboard";
}) {
  const id = useId();
  const popup = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [browsing, setBrowsing] = useState<string | null>(null);
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))].sort();
  const month = browsing ?? date.slice(0, 7);
  const index = months.indexOf(month);
  const [year, number] = month.split("-").map(Number);
  const first = new Date(year, number - 1, 1);
  const offset = first.getDay();
  const length = new Date(year, number, 0).getDate();
  const dateLabel = variant === "scoreboard" ? `${weekday(date)}, ${monthDay(date)}` : dayShort(date);
  return (
    <>
      <button type="button" ref={trigger} className={`popup-trigger calendar-trigger calendar-trigger-${variant}`} popoverTarget={id}
        onClick={() => setBrowsing(null)} aria-haspopup="dialog" aria-label={`Choose ${label.toLowerCase()}, ${dateLabel}`}>
        {dateLabel} <Chevron dir="down" />
      </button>
      <div id={id} ref={popup} popover="auto" className={`info-popup date-calendar date-calendar-${variant}`} role="dialog" aria-label={label}>
        <div className="calendar-head">
          <button className="icon-btn" type="button" disabled={index <= 0} onClick={() => setBrowsing(months[index - 1])} aria-label="Previous month"><Chevron dir="left" /></button>
          <strong aria-live="polite">{first.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong>
          <button className="icon-btn" type="button" disabled={index >= months.length - 1} onClick={() => setBrowsing(months[index + 1])} aria-label="Next month"><Chevron dir="right" /></button>
        </div>
        <div className="calendar-days">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => <small key={day} aria-hidden>{day}</small>)}
          {Array.from({ length: offset }, (_, i) => <span key={`offset-${i}`} aria-hidden />)}
          {Array.from({ length }, (_, i) => {
            const d = `${month}-${String(i + 1).padStart(2, "0")}`;
            return (
              <button key={d} type="button" disabled={!dates.includes(d)} aria-current={d === date ? "date" : undefined}
                aria-label={dayShort(d)} onClick={() => {
                  onChange(d);
                  popup.current?.hidePopover();
                  trigger.current?.focus();
                }}>{i + 1}</button>
            );
          })}
        </div>
      </div>
    </>
  );
}
