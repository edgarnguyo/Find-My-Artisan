import { useState, useEffect } from 'react';

function saveBookingRequest(request) {
  const requests = JSON.parse(localStorage.getItem('bookingRequests') || '[]');
  requests.push(request);
  localStorage.setItem('bookingRequests', JSON.stringify(requests));
}

export default function BookingForm({ worker }) {
  const [name,      setName]      = useState('');
  const [contact,   setContact]   = useState('');
  const [date,      setDate]      = useState('');
  const [time,      setTime]      = useState('');
  const [budget,    setBudget]    = useState('');
  const [job,       setJob]       = useState('');
  const [errors,    setErrors]    = useState({});
  const [submitted, setSubmitted] = useState(false);

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

  function handleSubmit(e) {
    e.preventDefault();
    const newErrors = validate();

    if (Object.keys(newErrors).length === 0) {
      saveBookingRequest({
        workerId: worker.id,
        workerName: worker.name,
        name,
        contact,
        date,
        time,
        budget,
        job,
        submittedAt: new Date().toISOString(),
      });
      setSubmitted(true);
    } else {
      setErrors(newErrors);
    }
  }

  if (submitted) {
    return (
      <section className="booking">
        <div className="confirmation">
          ✅ Your request has been sent. The artisan will contact you shortly.
        </div>
      </section>
    );
  }

  return (
    <section className="booking">
      <h2>Request this artisan</h2>

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

        <button type="submit" className="submit-btn">Send request</button>
      </form>
    </section>
  );
}
