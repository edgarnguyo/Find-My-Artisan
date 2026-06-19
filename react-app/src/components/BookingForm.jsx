import { useState, useEffect } from 'react';

// useState(initialValue) returns a pair: [currentValue, setterFunction].
// Every time you call the setter, React re-renders this component with
// the new value. This is a "controlled form" — React owns the value of
// each input; the input just displays whatever React says.

export default function BookingForm() {
  const [name,      setName]      = useState('');
  const [contact,   setContact]   = useState('');
  const [job,       setJob]       = useState('');
  const [errors,    setErrors]    = useState({});
  const [submitted, setSubmitted] = useState(false);

  // useEffect(fn, [deps]) runs `fn` after the component renders,
  // but ONLY when a value in the deps array has changed since the
  // last render. Here the dep is `submitted`, so this effect only
  // runs when `submitted` flips from false to true.
  //
  // The effect starts a 3-second timer. When the timer fires it
  // resets the form back to empty. The returned cleanup function
  // cancels the timer if the component unmounts before 3 seconds
  // are up — without it you'd get a memory leak.
  useEffect(() => {
    if (!submitted) return;

    const timer = setTimeout(() => {
      setName('');
      setContact('');
      setJob('');
      setErrors({});
      setSubmitted(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [submitted]);

  function validate() {
    const newErrors = {};
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phonePattern = /^[\d\s+()\-]{7,}$/;

    if (name.trim() === '') {
      newErrors.name = 'Please enter your name.';
    }
    if (contact.trim() === '') {
      newErrors.contact = 'Please enter your email or phone number.';
    } else if (!emailPattern.test(contact) && !phonePattern.test(contact)) {
      newErrors.contact = 'Enter a valid email (name@domain.com) or phone (min 7 digits).';
    }
    if (job.trim() === '') {
      newErrors.job = 'Please describe the job.';
    }

    return newErrors;
  }

  function handleSubmit(e) {
    e.preventDefault();
    const newErrors = validate();

    // Object.keys returns an array of the object's own keys.
    // If there are no keys, the errors object is empty → all fields passed.
    if (Object.keys(newErrors).length === 0) {
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

      {/* onSubmit={handleSubmit} wires our function to the form's submit event.
          onChange on each input keeps state in sync with what the user types.
          value={name} makes the input "controlled" — React sets what it shows. */}
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
