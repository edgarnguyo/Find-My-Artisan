import { useState } from 'react';
import { fetchMaterials } from '../api/materials';
import { sendQuote } from '../api/workers';
import { useAsync } from '../hooks/useAsync';
import { splitByTrade, formatKesAmount, materialsTotal } from '../lib/tradeMaterials';

// A labour charge or kg amount as typed: blank, or a number in range.
function amountError(text, max) {
  if (text.trim() === '') return false;
  const n = Number(text);
  return !(n >= 0 && n < max);
}

/**
 * The artisan's quote for a job, on the dashboard: a labour charge, Kanairo-Klean
 * materials at live prices with a kg box for each, notes, and the running total.
 * Materials the artisan's trade usually uses come first; every other Kanairo
 * material is under "Other materials". Opening it on a job that already has a
 * quote starts from that quote, so the artisan can change it and send it again.
 */
export default function QuoteForm({ booking, onSent, onCancel }) {
  const previous = booking.quote;
  const [labour, setLabour] = useState(previous ? String(previous.labourKes) : '');
  // kg typed for each material: { HDPE: '12' }.
  const [kg, setKg] = useState(() =>
    Object.fromEntries((previous?.materials ?? []).map(m => [m.materialId, String(m.quantityKg)]))
  );
  const [notes, setNotes] = useState(previous?.notes ?? '');
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);
  // Bumped by "Try again", so useAsync asks the server again.
  const [attempt, setAttempt] = useState(0);
  const { data, error: loadError, loading } = useAsync(() => fetchMaterials(), [attempt]);

  const materials = data ?? [];
  const { forTrade, other } = splitByTrade(materials, booking.worker.skill);
  // Only rows with a usable number count towards the total.
  const chosen = materials
    .map(m => ({ ...m, quantityKg: Number(kg[m.id]) }))
    .filter(m => m.quantityKg > 0);
  const labourKes = Number(labour) || 0;
  const total = labourKes + materialsTotal(chosen);

  // Materials on the old quote that Kanairo no longer lists. They are left out.
  const listed = new Set(materials.map(m => m.id));
  const gone = data ? (previous?.materials ?? []).filter(m => !listed.has(m.materialId)) : [];

  async function handleSubmit(e) {
    e.preventDefault();
    if (amountError(labour, 1e8)) {
      setError('Enter the labour charge as a number in KES, or leave it blank.');
      return;
    }
    if (Object.values(kg).some(v => amountError(v, 1e6))) {
      setError('Enter each amount in kg as a number, or leave it blank.');
      return;
    }
    if (labourKes === 0 && chosen.length === 0) {
      setError('Add a labour charge, some materials, or both.');
      return;
    }

    setError(null);
    setSending(true);
    try {
      await sendQuote(booking.id, {
        labourKes,
        // The server looks up each price at Kanairo-Klean, so only ids and kg are sent.
        materials: chosen.map(m => ({ materialId: m.id, quantityKg: m.quantityKg })),
        notes: notes.trim() || undefined,
      });
      onSent();
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  }

  const row = m => (
    <li key={m.id}>
      <label htmlFor={`quote-${booking.id}-${m.id}`}>
        <span className="material-estimate-name">{m.name}</span>
        <span className="material-estimate-price">{formatKesAmount(m.pricePerKgKes)} / kg</span>
      </label>
      <div className="material-estimate-kg">
        <input
          id={`quote-${booking.id}-${m.id}`}
          type="number"
          min="0"
          step="0.5"
          inputMode="decimal"
          placeholder="0"
          value={kg[m.id] ?? ''}
          onChange={e => setKg(q => ({ ...q, [m.id]: e.target.value }))}
        />
        <span>kg</span>
      </div>
    </li>
  );

  return (
    <form className="quote-form" onSubmit={handleSubmit} noValidate>
      <fieldset className="material-estimate">
        <legend>{previous ? 'Change Your Quote' : 'Send a Quote'}</legend>
        <p className="material-estimate-note">
          Price the job now that you've seen it. Materials use Kanairo-Klean's
          live prices; the client sees the total and each line.
        </p>

        <div className="quote-labour">
          <label htmlFor={`labour-${booking.id}`}>Labour (KES)</label>
          <input
            id={`labour-${booking.id}`}
            type="number"
            min="0"
            step="50"
            inputMode="decimal"
            placeholder="0"
            value={labour}
            onChange={e => setLabour(e.target.value)}
          />
        </div>

        <h3 className="quote-heading">Materials from Kanairo-Klean</h3>
        {loading ? (
          <p className="material-estimate-note">Loading material prices…</p>
        ) : loadError ? (
          <div className="material-estimate-unavailable" role="status">
            <p>Material prices are unavailable right now. You can still send a quote for labour only.</p>
            <button type="button" className="booking-action" onClick={() => setAttempt(n => n + 1)}>
              Try Again
            </button>
          </div>
        ) : materials.length === 0 ? (
          <p className="material-estimate-note">Kanairo-Klean has no materials in stock right now.</p>
        ) : (
          <>
            {forTrade.length > 0 && <ul className="material-estimate-list">{forTrade.map(row)}</ul>}
            {other.length > 0 && (forTrade.length === 0 ? (
              <ul className="material-estimate-list">{other.map(row)}</ul>
            ) : (
              // Open from the start when the old quote used one of these.
              <details className="quote-other" open={other.some(m => kg[m.id])}>
                <summary>Other materials ({other.length})</summary>
                <ul className="material-estimate-list">{other.map(row)}</ul>
              </details>
            ))}
          </>
        )}
        {gone.length > 0 && (
          <p className="material-estimate-note">
            Kanairo-Klean no longer lists {gone.map(m => m.name).join(', ')}, so{' '}
            {gone.length === 1 ? 'it was' : 'they were'} left out.
          </p>
        )}

        <div className="field quote-notes">
          <label htmlFor={`notes-${booking.id}`}>Notes for the Client (Optional)</label>
          <textarea
            id={`notes-${booking.id}`}
            rows={2}
            maxLength={500}
            placeholder="e.g. Includes replacing the waste pipe under the sink."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <p className="material-estimate-total" aria-live="polite">
          Quote total: <strong>{formatKesAmount(total)}</strong>
        </p>
        {error && <small className="error">{error}</small>}

        <div className="quote-actions">
          <button type="submit" className="booking-action" disabled={sending}>
            {sending ? 'Sending…' : previous ? 'Send New Quote' : 'Send Quote'}
          </button>
          <button type="button" className="link-button" onClick={onCancel}>
            Back
          </button>
        </div>
      </fieldset>
    </form>
  );
}
