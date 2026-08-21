import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createBooking } from '../api/workers';
import { useAuth } from '../lib/authContext';

export default function BookingForm({ worker }) {
  const { user } = useAuth();
  const [name,      setName]      = useState('');
  const [contact,   setContact]   = useState('');
  const [date,      setDate]      = useState('');
  const [time,      setTime]      = useState('');
  const [budget,    setBudget]    = useState('');
  const [job,       setJob]       = useState('');
  const [errors,    setErrors]    = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [sending,   setSending]   = useState(false);
  const [sendError, setSendError] = useState(null);

  useEffect(() => {
    if (!submitted) return;

    const timer = setTimeout(() => {
      setName('');
      setContact('');
      setDate('');
      setTime('');
      setBudget('');
      setJob('');
      setErrors({});
      setSendError(null);
      setSubmitted(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [submitted]);

  function validate() {
    const newErrors = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phonePattern = /^[\d\s+()-]{7,}$/;

    if (name.trim() === '') {
      newErrors.name = 'Please enter your name.';
    }
    if (contact.trim() === '') {
      newErrors.contact = 'Please enter your email or phone number.';
    } else if (!emailPattern.test(contact) && !phonePattern.test(contact)) {
      newErrors.contact = 'Enter a valid email (name@domain.com) or phone (min 7 digits).';
    }
    if (date.trim() === '') {
      newErrors.date = 'Please choose a preferred date.';
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (new Date(date) < today) {
        newErrors.date = 'Date cannot be in the past.';
      }
    }
    if (time.trim() === '') {
      newErrors.time = 'Please choose a preferred time.';
    }
    if (job.trim() === '') {
      newErrors.job = 'Please describe the job.';
    }

    return newErrors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const newErrors = validate();

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setSendError(null);
    setSending(true);

    try {
      await createBooking({
        workerId: worker.id,
        userId: user?.id ?? null,
        name,
        contact,
        date,
        time,
        budget,
        job,
      });
      setSubmitted(true);
    } catch (err) {
      setSendError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (submitted) {
    return (
      <section className="booking">
        <div className="confirmation">
          ✅ Your request has been sent. The artisan will contact you shortly.
        </div>
        {user ? (
          <p className="booking-note">
            <Link to="/bookings">Track it under My bookings</Link>
          </p>
        ) : (
          <p className="booking-note">
            <Link to="/signin">Sign in</Link> before booking next time and you
            can track your requests here.
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="booking">
      <h2>Request this artisan</h2>

      {!user && (
        <p className="booking-note">
          <Link to="/signin">Sign in</Link> to keep track of this booking
          afterwards.
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="name">Your name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          {errors.name && <small className="error">{errors.name}</small>}
        </div>

        <div className="field">
          <label htmlFor="contact">Email or phone</label>
          <input
            id="contact"
            type="text"
            value={contact}
            onChange={e => setContact(e.target.value)}
          />
          {errors.contact && <small className="error">{errors.contact}</small>}
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="date">Preferred date</label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
            {errors.date && <small className="error">{errors.date}</small>}
          </div>

          <div className="field">
            <label htmlFor="time">Preferred time</label>
            <input
              id="time"
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
            />
            {errors.time && <small className="error">{errors.time}</small>}
          </div>
        </div>

        <div className="field">
          <label htmlFor="budget">Budget (optional)</label>
          <input
            id="budget"
            type="text"
            placeholder={`e.g. ${worker.price}`}
            value={budget}
            onChange={e => setBudget(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="job">Describe the job</label>
          <textarea
            id="job"
            rows={4}
            value={job}
            onChange={e => setJob(e.target.value)}
          />
          {errors.job && <small className="error">{errors.job}</small>}
        </div>

        {sendError && (
          <small className="error">
            Could not send your request: {sendError}
          </small>
        )}

        <button type="submit" className="submit-btn" disabled={sending}>
          {sending ? 'Sending…' : 'Send request'}
        </button>
      </form>
    </section>
  );
}
