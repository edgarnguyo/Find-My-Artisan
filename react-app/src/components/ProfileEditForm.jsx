import { useState } from 'react';
import { updateProfile } from '../api/workers';
import { COUNTIES } from '../data/counties';

/**
 * The details an artisan can change about themselves. Phone, area, county and
 * hourly rate are also what Meditrac sees through the API. Name and skill
 * aren't here: the reviews and verified badge were earned in that trade.
 */
export default function ProfileEditForm({ worker }) {
  const [location, setLocation] = useState(worker.location ?? '');
  const [county, setCounty] = useState(worker.county ?? '');
  const [phone, setPhone] = useState(worker.phone ?? '');
  const [price, setPrice] = useState(worker.price ?? '');
  const [rate, setRate] = useState(worker.hourlyRateKes ?? '');
  const [bio, setBio] = useState(worker.bio ?? '');
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Same checks as the server, for a quicker message.
  function validate() {
    if (!location.trim()) return 'Please enter the area you work in.';
    if (!county) return 'Please choose your county.';
    if (!phone.trim()) return 'Please enter your phone number.';
    if (rate !== '' && (!Number.isInteger(Number(rate)) || Number(rate) < 1 || Number(rate) > 100000)) {
      return 'Hourly rate must be a whole number of shillings, from 1 to 100,000.';
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaved(false);
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateProfile(worker.id, {
        location,
        county,
        phone,
        price,
        bio,
        // An empty box clears the rate; otherwise send a number, not "900".
        hourlyRateKes: rate === '' ? null : Number(rate),
      });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="dashboard-card">
      <h2>Your Details</h2>
      <p className="bookings-sub">Shown on your public profile.</p>

      <form className="edit-profile-form" onSubmit={handleSubmit} noValidate>
        <div className="field-row">
          <div className="field">
            <label htmlFor="edit-location">Area</label>
            <input id="edit-location" type="text" maxLength={100} placeholder="e.g. Westlands"
              value={location} onChange={e => setLocation(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="edit-county">County</label>
            <select id="edit-county" value={county} onChange={e => setCounty(e.target.value)}>
              <option value="">Choose…</option>
              {COUNTIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <label htmlFor="edit-phone">Phone</label>
            <input id="edit-phone" type="tel" maxLength={20} autoComplete="tel"
              value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="edit-rate">Hourly Rate, KES (Optional)</label>
            <input id="edit-rate" type="number" min={1} max={100000} step={1} inputMode="numeric"
              value={rate} onChange={e => setRate(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="edit-price">Price per Job (Optional)</label>
          <input id="edit-price" type="text" maxLength={50} placeholder="e.g. KES 2,000 – 6,000 / job"
            value={price} onChange={e => setPrice(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="edit-bio">About Your Work (Optional)</label>
          <textarea id="edit-bio" rows={4} maxLength={2000}
            value={bio} onChange={e => setBio(e.target.value)} />
        </div>

        {error && <small className="error">{error}</small>}
        {saved && <p className="saved-note" role="status">Saved. Your profile shows the changes now.</p>}

        <button type="submit" className="booking-action" disabled={saving}>
          {saving ? 'Saving…' : 'Save details'}
        </button>
      </form>
    </section>
  );
}
