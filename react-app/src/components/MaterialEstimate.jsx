import { useState } from 'react';
import { fetchMaterials } from '../api/materials';
import { useAsync } from '../hooks/useAsync';
import { materialTypesFor, formatKesAmount, materialsTotal } from '../lib/tradeMaterials';

/**
 * The booking form's optional materials section: Kanairo-Klean's live prices for
 * the materials this trade uses, a kg box for each, and the running total.
 * `quantities` is { materialId: '12' } as typed; the form owns it so it can
 * send it and clear it. Shows nothing for a trade Kanairo sells nothing for.
 */
export default function MaterialEstimate({ skill, quantities, onChange, error }) {
  const types = materialTypesFor(skill);
  // Bumped by "Try again", so useAsync asks the server again.
  const [attempt, setAttempt] = useState(0);
  const { data, error: loadError, loading } = useAsync(
    () => (types.length ? fetchMaterials() : Promise.resolve([])),
    [skill, attempt]
  );

  if (types.length === 0) return null;

  const materials = (data ?? []).filter(m => types.includes(m.type));
  // Only rows with a usable number count towards the total.
  const chosen = materials
    .map(m => ({ ...m, quantityKg: Number(quantities[m.id]) }))
    .filter(m => m.quantityKg > 0);

  return (
    <fieldset className="material-estimate">
      <legend>Materials (Optional)</legend>
      <p className="material-estimate-note">
        Live prices from Kanairo-Klean's scrap yards. Add what you think the job
        needs and the artisan sees your estimate with the request.
      </p>

      {loading ? (
        <p className="material-estimate-note">Loading material prices…</p>
      ) : loadError ? (
        <div className="material-estimate-unavailable" role="status">
          <p>Material prices are unavailable right now. You can still send the request without an estimate.</p>
          <button type="button" className="booking-action" onClick={() => setAttempt(n => n + 1)}>
            Try Again
          </button>
        </div>
      ) : materials.length === 0 ? (
        <p className="material-estimate-note">Kanairo-Klean has none of these materials in stock right now.</p>
      ) : (
        <>
          <ul className="material-estimate-list">
            {materials.map(m => (
              <li key={m.id}>
                <label htmlFor={`material-${m.id}`}>
                  <span className="material-estimate-name">{m.name}</span>
                  <span className="material-estimate-price">{formatKesAmount(m.pricePerKgKes)} / kg</span>
                </label>
                <div className="material-estimate-kg">
                  <input
                    id={`material-${m.id}`}
                    type="number"
                    min="0"
                    step="0.5"
                    inputMode="decimal"
                    placeholder="0"
                    value={quantities[m.id] ?? ''}
                    onChange={e => onChange(m.id, e.target.value)}
                  />
                  <span>kg</span>
                </div>
              </li>
            ))}
          </ul>
          <p className="material-estimate-total" aria-live="polite">
            Materials estimate: <strong>{formatKesAmount(materialsTotal(chosen))}</strong>
          </p>
        </>
      )}
      {error && <small className="error">{error}</small>}
    </fieldset>
  );
}
