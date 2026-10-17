import { useState } from 'react';
import { reviewBooking } from '../api/workers';

const STARS = [1, 2, 3, 4, 5];

/**
 * A client's review of a completed job, opened from My bookings. The stars are
 * radio buttons, so they work with the keyboard and screen readers too.
 * onDone runs after the review is saved; onCancel closes the form.
 */
export default function ReviewForm({ booking, clientId, onDone, onCancel }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (rating === 0) {
      setError('Choose from 1 to 5 stars.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await reviewBooking(booking.id, clientId, rating, comment);
      onDone();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="review-form" onSubmit={handleSubmit} noValidate>
      <fieldset className="star-picker">
        <legend>How did {booking.worker?.name ?? 'the artisan'} do?</legend>
        {STARS.map(n => (
          <label key={n} className={n <= rating ? 'is-on' : ''}>
            <input
              type="radio"
              name={`rating-${booking.id}`}
              value={n}
              checked={rating === n}
              onChange={() => setRating(n)}
            />
            <span aria-hidden="true">★</span>
            <span className="visually-hidden">{n} star{n === 1 ? '' : 's'}</span>
          </label>
        ))}
      </fieldset>

      <label htmlFor={`comment-${booking.id}`}>Comment (optional)</label>
      <textarea
        id={`comment-${booking.id}`}
        rows={3}
        maxLength={1000}
        value={comment}
        onChange={e => setComment(e.target.value)}
      />

      {error && <small className="error">{error}</small>}

      <div className="review-form-actions">
        <button type="submit" className="booking-action" disabled={saving}>
          {saving ? 'Saving…' : 'Post review'}
        </button>
        <button type="button" className="link-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
