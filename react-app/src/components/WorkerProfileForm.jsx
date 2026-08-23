import { useState } from 'react';
import { createMyWorker, updateMyWorker, saveMySkills } from '../api/artisan';

const TRADES = ['Electrician', 'Plumber', 'Carpenter', 'Painter'];
const HOURS = ['More than 30 hrs/week', 'Less than 30 hrs/week'];

/**
 * Create or edit the worker row the signed-in artisan owns.
 *
 * Rating, success rate and job count are deliberately absent: they are derived
 * by database triggers from reviews and completed bookings, so there is
 * nothing here for an artisan to type into them.
 */
export default function WorkerProfileForm({ worker, onSaved }) {
  const [name,     setName]     = useState(worker?.name ?? '');
  const [skill,    setSkill]    = useState(worker?.skill ?? TRADES[0]);
  const [location, setLocation] = useState(worker?.location ?? '');
  const [price,    setPrice]    = useState(worker?.price ?? '');
  const [bio,      setBio]      = useState(worker?.bio ?? '');
  const [photo,    setPhoto]    = useState(worker?.photo ?? '');
  const [hours,    setHours]    = useState(worker?.hoursPerWeek || HOURS[0]);
  const [extraSkills, setExtraSkills] = useState(
    (worker?.skills ?? []).filter(s => s !== (worker?.skill ?? ''))
  );

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);
  const [notice, setNotice] = useState(null);

  function toggleSkill(value) {
    setExtraSkills(current =>
      current.includes(value)
        ? current.filter(s => s !== value)
        : [...current, value]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (name.trim() === '' || location.trim() === '') {
      setError('Name and location are required.');
      return;
    }

    setSaving(true);
    try {
      const fields = { name, skill, location, price, bio, photo, hoursPerWeek: hours };
      const id = worker ? worker.id : await createMyWorker(fields);

      if (worker) await updateMyWorker(worker.id, fields);

      // The primary trade always stays in the list, so a profile never shows
      // fewer skills than the listings filter matches it on.
      await saveMySkills(id, [skill, ...extraSkills.filter(s => s !== skill)]);

      setNotice('Profile saved.');
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="dash-card">
      <h2>{worker ? 'Your listing' : 'Create your listing'}</h2>
      {!worker && (
        <p className="dash-hint">
          Clients cannot find you until this exists. It appears on /listings as
          soon as you save.
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="w-name">Display name</label>
          <input id="w-name" type="text" value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="w-skill">Main trade</label>
            <select id="w-skill" value={skill} onChange={e => setSkill(e.target.value)}>
              {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="field">
            <label htmlFor="w-hours">Working hours</label>
            <select id="w-hours" value={hours} onChange={e => setHours(e.target.value)}>
              {HOURS.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        </div>

        <fieldset className="field">
          <legend>Other trades you take on</legend>
          <div className="skill-checks">
            {TRADES.filter(t => t !== skill).map(t => (
              <label key={t} className="skill-check">
                <input
                  type="checkbox"
                  checked={extraSkills.includes(t)}
                  onChange={() => toggleSkill(t)}
                />
                {t}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="field">
          <label htmlFor="w-location">Location</label>
          <input
            id="w-location"
            type="text"
            placeholder="e.g. Westlands, Nairobi"
            value={location}
            onChange={e => setLocation(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="w-price">Typical price</label>
          <input
            id="w-price"
            type="text"
            placeholder="e.g. KES 2,500 – 7,000 / job"
            value={price}
            onChange={e => setPrice(e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="w-photo">Photo URL</label>
          <input id="w-photo" type="url" value={photo} onChange={e => setPhoto(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="w-bio">About your work</label>
          <textarea id="w-bio" rows={4} value={bio} onChange={e => setBio(e.target.value)} />
        </div>

        {error && <small className="error">{error}</small>}
        {notice && <div className="confirmation">{notice}</div>}

        <button type="submit" className="submit-btn" disabled={saving}>
          {saving ? 'Saving…' : worker ? 'Save listing' : 'Create listing'}
        </button>
      </form>
    </section>
  );
}
