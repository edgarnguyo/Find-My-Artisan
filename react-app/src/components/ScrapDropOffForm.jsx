import { useState } from 'react';
import { fetchCollectionLocations, reportDropOff } from '../api/materials';
import { useAsync } from '../hooks/useAsync';

// Kanairo-Klean's fixed list of material types (their contract's MaterialType).
const TYPES = ['metal', 'plastic', 'paper', 'glass', 'e-waste'];

/**
 * On a completed job: report the scrap left over to Kanairo-Klean, so one of
 * their yards can reuse it. Opens from a button, so the yards are only fetched
 * when an artisan actually wants to report something.
 */
export default function ScrapDropOffForm({ artisanId, bookingId }) {
  const [open, setOpen] = useState(false);
  // What Kanairo sent back once the drop-off was recorded.
  const [reported, setReported] = useState(null);

  if (reported) {
    return (
      <p className="saved-note">
        Reported to Kanairo-Klean: {reported.quantityKg} kg {reported.materialType} at{' '}
        {reported.locationName} ({reported.status}).
      </p>
    );
  }
  if (!open) {
    return (
      <button type="button" className="link-button scrap-open" onClick={() => setOpen(true)}>
        Report Leftover Scrap
      </button>
    );
  }
  return (
    <DropOffFields
      artisanId={artisanId}
      bookingId={bookingId}
      onCancel={() => setOpen(false)}
      onReported={setReported}
    />
  );
}

function DropOffFields({ artisanId, bookingId, onCancel, onReported }) {
  const [attempt, setAttempt] = useState(0);
  const { data: locations, error: loadError, loading } = useAsync(fetchCollectionLocations, [attempt]);
  const [form, setForm] = useState({ locationId: '', materialType: 'metal', quantityKg: '', notes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = field => e => setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const dropOff = await reportDropOff({
        artisanId,
        bookingId,
        locationId: form.locationId,
        materialType: form.materialType,
        quantityKg: Number(form.quantityKg),
        notes: form.notes.trim() || undefined,
      });
      const location = locations.find(l => l.id === dropOff.locationId);
      onReported({ ...dropOff, locationName: location?.name ?? `yard ${dropOff.locationId}` });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  if (loading) return <p className="scrap-note">Loading Kanairo-Klean's yards…</p>;
  if (loadError) {
    return (
      <p className="scrap-note">
        {loadError.message}{' '}
        <button type="button" className="link-button" onClick={() => setAttempt(n => n + 1)}>
          Try again
        </button>{' '}
        <button type="button" className="link-button" onClick={onCancel}>Back</button>
      </p>
    );
  }

  const id = field => `${field}-${bookingId}`;
  return (
    <form className="scrap-form" onSubmit={handleSubmit}>
      <p className="scrap-note">Leftover scrap goes to a Kanairo-Klean yard for reuse.</p>
      <div className="scrap-fields">
        <label htmlFor={id('yard')}>
          Yard
          <select id={id('yard')} value={form.locationId} onChange={set('locationId')} required>
            <option value="" disabled>Choose a yard</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}, {l.county}</option>
            ))}
          </select>
        </label>
        <label htmlFor={id('type')}>
          Material
          <select id={id('type')} className="scrap-material" value={form.materialType} onChange={set('materialType')}>
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label htmlFor={id('kg')}>
          Weight (kg)
          <input
            id={id('kg')}
            type="number"
            min="0.1"
            step="0.1"
            value={form.quantityKg}
            onChange={set('quantityKg')}
            required
          />
        </label>
      </div>
      <label htmlFor={id('notes')}>
        Notes (optional)
        <input
          id={id('notes')}
          type="text"
          maxLength={500}
          placeholder="e.g. offcut copper wiring"
          value={form.notes}
          onChange={set('notes')}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="scrap-actions">
        <button type="submit" className="booking-action" disabled={saving}>
          {saving ? 'Sending…' : 'Report Scrap'}
        </button>
        <button type="button" className="link-button" onClick={onCancel}>Back</button>
      </div>
    </form>
  );
}
