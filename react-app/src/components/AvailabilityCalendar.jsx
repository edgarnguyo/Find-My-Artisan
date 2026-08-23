const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatTime(value) {
  return value.slice(0, 5);
}

/**
 * The artisan's real weekly schedule, read from worker_availability.
 *
 * An artisan who has not set one yet gets an honest empty state instead of a
 * pattern generated from their id.
 */
export default function AvailabilityCalendar({ worker }) {
  const slots = worker.availability ?? [];
  const byDay = new Map(slots.map(slot => [slot.weekday, slot]));

  return (
    <section className="availability">
      <h2>Availability</h2>

      {slots.length === 0 ? (
        <p className="availability-empty">
          This artisan has not published a schedule yet. Send a request with the
          date you need and they will confirm.
        </p>
      ) : (
        <>
          <div className="availability-days">
            {DAYS.map((day, i) => (
              <span
                key={day}
                className={`availability-day${byDay.has(i) ? ' is-available' : ''}`}
                title={
                  byDay.has(i)
                    ? `${formatTime(byDay.get(i).start)} – ${formatTime(byDay.get(i).end)}`
                    : 'Not working'
                }
              >
                {day}
              </span>
            ))}
          </div>

          <ul className="availability-hours-list">
            {slots.map(slot => (
              <li key={slot.weekday}>
                <span className="availability-hours-day">{DAYS[slot.weekday]}</span>
                {formatTime(slot.start)} – {formatTime(slot.end)}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
