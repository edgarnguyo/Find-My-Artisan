const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getAvailableDayIndexes(worker) {
  const isFullTime = worker.hoursPerWeek === 'More than 30 hrs/week';
  const count = isFullTime ? 5 : 3;
  const start = worker.id % 7;

  const indexes = new Set();
  for (let i = 0; i < count; i++) {
    indexes.add((start + i) % 7);
  }
  return indexes;
}

export default function AvailabilityCalendar({ worker }) {
  const availableDayIndexes = getAvailableDayIndexes(worker);
  const isFullTime = worker.hoursPerWeek === 'More than 30 hrs/week';
  const hours = isFullTime ? '8:00 AM – 5:00 PM' : '9:00 AM – 2:00 PM';

  return (
    <section className="availability">
      <h2>Availability</h2>
      <div className="availability-days">
        {DAYS.map((day, i) => (
          <span
            key={day}
            className={`availability-day${availableDayIndexes.has(i) ? ' is-available' : ''}`}
          >
            {day}
          </span>
        ))}
      </div>
      <p className="availability-hours">Typical hours: {hours}</p>
    </section>
  );
}
