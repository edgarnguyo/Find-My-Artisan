import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createBooking } from '../api/workers';
import { fetchClient } from '../api/account';
import { useAuth } from '../lib/authContext';
import { busyWindowAt, fromKenya, kenyaClock } from '../lib/kenyaTime';
import MaterialEstimate from './MaterialEstimate';

export default function BookingForm({ worker }) {
  const { user } = useAuth();
  const location = useLocation();
  const isClient = user?.role === 'client';
  // Start from the signed-in client's own details; they can still change them.
  const [name,      setName]      = useState(isClient ? user.name : '');
  const [contact,   setContact]   = useState(isClient ? user.email : '');
  const [date,      setDate]      = useState('');
  const [time,      setTime]      = useState('');
  const [budget,    setBudget]    = useState('');
  const [job,       setJob]       = useState('');
  // kg typed for each Kanairo-Klean material: { HDPE: '12' }.
  const [materialKg, setMaterialKg] = useState({});
  const [errors,    setErrors]    = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [sending,   setSending]   = useState(false);
  const [sendError, setSendError] = useState(null);

  // The phone number isn't kept with the sign-in, so fetch it. A phone is what
  // an artisan is most likely to call, so it replaces the email when there is one.
  useEffect(() => {
    if (!isClient) return;
    let current = true;
    fetchClient(user.id)
      .then(client => {
        if (current && client.phone) {
          setContact(c => (c === user.email ? client.phone : c));
        }
      })
      .catch(() => {});
    return () => { current = false; };
  }, [isClient, user?.id, user?.email]);

  useEffect(() => {
    if (!submitted) return;

    const timer = setTimeout(() => {
      setDate('');
      setTime('');
      setBudget('');
      setJob('');
      setMaterialKg({});
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
    // A blank box means "none of this"; anything typed must be a real amount.
    const badKg = Object.values(materialKg).some(kg => kg.trim() !== '' && !(Number(kg) > 0 && Number(kg) < 1e6));
    if (badKg) {
      newErrors.materials = 'Enter each amount in kg as a number above 0, or leave it blank.';
    }
    // The profile only knows the next 14 days; the server checks every date.
    if (!newErrors.date && !newErrors.time) {
      const clash = busyWindowAt(worker.busy, fromKenya(date, time));
      if (clash) {
        newErrors.busy = `${worker.name} is booked from ${kenyaClock(clash.start)} to ${kenyaClock(clash.end)} that day. Please pick another time.`;
      }
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
        name,
        contact,
        date,
        time,
        budget,
        job,
        // The server looks up each price at Kanairo-Klean, so only ids and kg are sent.
        materials: Object.entries(materialKg)
          .filter(([, kg]) => kg.trim() !== '')
          .map(([materialId, kg]) => ({ materialId, quantityKg: Number(kg) })),
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
          Your request has been sent. The artisan will contact you shortly.
        </div>
        <p className="booking-note">
          <Link to="/my-bookings">Track It Under My Bookings</Link>
        </p>
      </section>
    );
  }

  // Booking needs a client account, so the request is tied to someone who can
  // track it, cancel it and review the job afterwards.
  if (!isClient) {
    return (
      <section className="booking">
        <h2>Request This Artisan</h2>
        {user ? (
          <p className="booking-note">
            You are signed in as an artisan. Requests are sent from a client
            account, so sign out and sign in (or sign up) as a client to book.
          </p>
        ) : (
          <>
            <p className="booking-note">You need an account to send a request.</p>
            <Link to="/signin" state={{ from: location.pathname }} className="submit-btn">
              Sign In to Book
            </Link>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="booking">
      <h2>Request This Artisan</h2>

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="name">Your Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          {errors.name && <small className="error">{errors.name}</small>}
        </div>

        <div className="field">
          <label htmlFor="contact">Email or Phone</label>
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
            <label htmlFor="date">Preferred Date</label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
            {errors.date && <small className="error">{errors.date}</small>}
          </div>

          <div className="field">
            <label htmlFor="time">Preferred Time</label>
            <input
              id="time"
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
            />
            {errors.time && <small className="error">{errors.time}</small>}
          </div>
        </div>
        {/* Below the row, not under one field: it's about the date and time together. */}
        {errors.busy && <small className="error booking-busy-error">{errors.busy}</small>}

        <div className="field">
          <label htmlFor="budget">Budget in KES (Optional)</label>
          <input
            id="budget"
            type="text"
            placeholder="e.g. 3000"
            value={budget}
            onChange={e => setBudget(e.target.value)}
          />
        </div>

        <MaterialEstimate
          skill={worker.skill}
          quantities={materialKg}
          onChange={(id, kg) => setMaterialKg(q => ({ ...q, [id]: kg }))}
          error={errors.materials}
        />

        <div className="field">
          <label htmlFor="job">Describe the Job</label>
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
          {sending ? 'Sending…' : 'Send Request'}
        </button>
      </form>
    </section>
  );
}
