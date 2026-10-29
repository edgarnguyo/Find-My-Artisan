import { formatKesAmount, materialsTotal, quoteTotal } from '../lib/tradeMaterials';

// What each quote status means, said to the client or to the artisan.
const STATUS_TEXT = {
  client: {
    sent: 'Waiting for your answer',
    accepted: 'You accepted this quote',
    declined: 'You declined this quote',
  },
  artisan: {
    sent: 'Waiting for the client',
    accepted: 'The client accepted',
    declined: 'The client declined. You can send a new quote.',
  },
};

/**
 * The artisan's quote on a booking: the total, whether it has been answered,
 * and the lines (labour, then each material at the Kanairo-Klean price from
 * when it was sent), which open on a click. `viewer` is 'client' or
 * 'artisan'; `children` are the buttons that go under it.
 */
export default function BookingQuote({ quote, viewer, children }) {
  if (!quote) return null;

  return (
    <div className={`booking-quote quote-${quote.status}`}>
      <details>
        <summary>
          Quote: <strong>{formatKesAmount(quoteTotal(quote))}</strong>
          <span className="booking-quote-status"> · {STATUS_TEXT[viewer][quote.status]}</span>
        </summary>
        <ul>
          {quote.labourKes > 0 && <li>Labour: {formatKesAmount(quote.labourKes)}</li>}
          {quote.materials.map(m => (
            <li key={m.materialId}>
              {m.quantityKg} kg {m.name} × {formatKesAmount(m.pricePerKgKes)}/kg ={' '}
              {formatKesAmount(materialsTotal([m]))}
            </li>
          ))}
        </ul>
        {quote.notes && <p className="booking-quote-notes">“{quote.notes}”</p>}
        {quote.materials.length > 0 && <p>Materials at Kanairo-Klean prices when the quote was sent.</p>}
      </details>
      {children}
    </div>
  );
}
