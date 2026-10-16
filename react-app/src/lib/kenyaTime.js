// The site works in Kenya time (UTC+3 all year, no daylight saving), whatever
// time zone the visitor's computer is set to. The API sends busy times in UTC
// ("2026-10-22T07:00:00Z"); these helpers turn them into Kenya dates and clock
// times, and turn the booking form's date and time into a moment in time.
const ZONE = 'Africa/Nairobi';

/** 'YYYY-MM-DD' for the Kenya date a moment falls on. */
export function kenyaDate(value) {
  // en-CA writes dates as YYYY-MM-DD, the same shape as <input type="date">.
  return new Date(value).toLocaleDateString('en-CA', { timeZone: ZONE });
}

/** '10:00' for the Kenya clock time of a moment. */
export function kenyaClock(value) {
  return new Date(value).toLocaleTimeString('en-GB', {
    timeZone: ZONE, hour: '2-digit', minute: '2-digit',
  });
}

/** 'Wed 22 Oct' for a moment, in Kenya. */
export function kenyaDayLabel(value) {
  return new Date(value).toLocaleDateString('en-GB', {
    timeZone: ZONE, weekday: 'short', day: 'numeric', month: 'short',
  });
}

/** 'Wed' and '22' for a moment, in Kenya: the two lines of a calendar cell. */
export function kenyaWeekday(value) {
  return new Date(value).toLocaleDateString('en-GB', { timeZone: ZONE, weekday: 'short' });
}

export function kenyaDayOfMonth(value) {
  return new Date(value).toLocaleDateString('en-GB', { timeZone: ZONE, day: 'numeric' });
}

/** The moment a Kenya date ('2026-10-22') and time ('10:00') stand for. */
export function fromKenya(date, time) {
  return new Date(`${date}T${time.slice(0, 5)}:00+03:00`);
}

/** The busy window a moment falls inside, or undefined if it's free. */
export function busyWindowAt(busy, moment) {
  return busy.find(w => new Date(w.start) <= moment && moment < new Date(w.end));
}
