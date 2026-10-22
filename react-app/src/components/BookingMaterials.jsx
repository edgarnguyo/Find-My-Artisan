import { formatKesAmount, materialsTotal } from '../lib/tradeMaterials';

/**
 * The materials estimate saved with a booking, at the Kanairo-Klean prices from
 * when it was made. The total shows straight away; the lines open on a click.
 */
export default function BookingMaterials({ materials }) {
  if (!materials?.length) return null;

  return (
    <details className="booking-materials">
      <summary>
        Materials estimate: <strong>{formatKesAmount(materialsTotal(materials))}</strong>
      </summary>
      <ul>
        {materials.map(m => (
          <li key={m.materialId}>
            {m.quantityKg} kg {m.name} × {formatKesAmount(m.pricePerKgKes)}/kg ={' '}
            {formatKesAmount(materialsTotal([m]))}
          </li>
        ))}
      </ul>
      <p>Kanairo-Klean prices when the request was sent.</p>
    </details>
  );
}
