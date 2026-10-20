import { useState } from 'react';
import { fetchMaterials } from '../api/materials';
import { useAsync } from '../hooks/useAsync';

// Kanairo-Klean's fixed list of material types (their contract's MaterialType).
const TYPES = ['metal', 'plastic', 'paper', 'glass', 'e-waste'];

const kes = new Intl.NumberFormat('en-KE', { maximumFractionDigits: 2 });

export default function MaterialsPage() {
  const [type, setType] = useState('');
  // Bumped by "Try again", so useAsync asks the server again for the same type.
  const [attempt, setAttempt] = useState(0);
  const { data: materials, error, loading } = useAsync(() => fetchMaterials(type), [type, attempt]);

  return (
    <main className="materials-page">
      <h1>Scrap Materials</h1>
      <p className="materials-intro">
        Second-hand materials in stock at Kanairo-Klean collection yards, with live prices per kg.
      </p>

      <div className="filter-container">
        {['', ...TYPES].map((t) => (
          <button
            key={t || 'all'}
            className={type === t ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setType(t)}
          >
            {t || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading materials…</p>
      ) : error ? (
        <div className="materials-unavailable" role="alert">
          <p>{error.message}</p>
          <button className="btn-primary" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      ) : materials.length === 0 ? (
        <p>No {type} materials in stock right now.</p>
      ) : (
        <table className="materials-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Type</th>
              <th>In stock</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {materials.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.type}</td>
                <td>{kes.format(m.quantityKg)} kg</td>
                <td>KES {kes.format(m.pricePerKgKes)} / kg</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
