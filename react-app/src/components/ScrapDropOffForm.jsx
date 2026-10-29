import { useState } from 'react';
import { fetchCollectionLocations, reportDropOff } from '../api/materials';
import { useAsync } from '../hooks/useAsync';

// Kanairo-Klean's fixed list of material types (their contract's MaterialType).
const TYPES = ['metal', 'plastic', 'paper', 'glass', 'e-waste'];

/**
 * On a completed job: the scrap already reported to Kanairo-Klean, and a form to
 * report more, so one of their yards can reuse it. Each material can be reported
 * once per job, so only the ones not yet sent are offered. The form opens from a
 * button, so the yards are only fetched when an artisan wants to report something.
 * onReported runs after Kanairo accepts one; the dashboard then reloads the jobs,
 * and the new report comes back from our database in `reports`.
 */
export default function ScrapDropOffForm({ bookingId, reports, onReported }) {
  const [open, setOpen] = useState(false);
  const reported = new Set(reports.map(r => r.materialType));
  const remaining = TYPES.filter(t => !reported.has(t));

  return (
    <>
      {reports.length > 0 && (
        <ul className="scrap-reports">
          {reports.map(r => (
            <li key={r.id}>
              Scrap reported to Kanairo-Klean: {r.quantityKg} kg {r.materialType} at {r.locationName}{' '}
              ({r.status === 'sending' ? 'not confirmed by Kanairo' : r.status})
            </li>
          ))}
        </ul>
      )}
      {remaining.length > 0 && (open ? (
        <DropOffFields
          bookingId={bookingId}
          materials={remaining}
          onCancel={() => setOpen(false)}
          onReported={() => {
            setOpen(false);
            onReported();
          }}
        />
      ) : (
        <button type="button" className="link-button scrap-open" onClick={() => setOpen(true)}>
          {reports.length > 0 ? 'Report More Scrap' : 'Report Leftover Scrap'}
        </button>
      ))}
    </>
  );
}

function DropOffFields({ bookingId, materials, onCancel, onReported }) {
  const [attempt, setAttempt] = useState(0);
  const { data: locations, error: loadError, loading } = useAsync(fetchCollectionLocations, [attempt]);
  const [form, setForm] = useState({ locationId: '', materialType: materials[0], quantityKg: '', notes: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = field => e => setForm({ ...form, [field]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await reportDropOff({
        bookingId,
        locationId: form.locationId,
        // Saved with the report, so the dashboard can name the yard later.
        locationName: locations.find(l => l.id === form.locationId)?.name,
        materialType: form.materialType,
        quantityKg: Number(form.quantityKg),
        notes: form.notes.trim() || undefined,
      });
      onReported();
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
            {materials.map(t => <option key={t} value={t}>{t}</option>)}
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
