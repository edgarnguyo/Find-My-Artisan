import { useState } from 'react';
import { kenyaDate, kenyaClock, kenyaDayLabel, kenyaWeekday, kenyaDayOfMonth } from '../lib/kenyaTime';

const DAY_MS = 24 * 60 * 60 * 1000;

// The next 14 days, from the artisan's busy list: the same times Meditrac sees
// from GET /artisans/:id. Any time not listed is free.
export default function AvailabilityCalendar({ worker }) {
  // Read the clock once, when the calendar first appears, so re-renders show
  // the same 14 days.
  const [now] = useState(() => Date.now());
  const days = [...Array(14)].map((_, i) => {
    const moment = new Date(now + i * DAY_MS);
    return { key: kenyaDate(moment), moment };
  });

  // A window that runs past midnight marks both days.
  const busyDays = new Set(worker.busy.flatMap(w => [kenyaDate(w.start), kenyaDate(w.end)]));

  return (
    <section className="availability">
      <h2>Availability</h2>
      <div className="availability-days">
        {days.map(day => {
          const busy = busyDays.has(day.key);
          return (
            <span
              key={day.key}
              className={`availability-day${busy ? ' is-busy' : ' is-available'}`}
              title={busy ? 'Booked for part of the day' : 'Free'}
            >
              <span className="availability-weekday">{kenyaWeekday(day.moment)}</span>
              {kenyaDayOfMonth(day.moment)}
            </span>
          );
        })}
      </div>

      {worker.busy.length === 0 ? (
        <p className="availability-hours">Free for the next 14 days.</p>
      ) : (
        <>
          <p className="availability-hours">Already booked (Kenya time):</p>
          <ul className="availability-busy">
            {worker.busy.map(w => (
              <li key={w.start}>
                {kenyaDayLabel(w.start)}, {kenyaClock(w.start)}–{kenyaClock(w.end)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
