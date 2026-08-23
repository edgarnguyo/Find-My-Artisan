import { useState } from 'react';
import { createReview } from '../api/reviews';
import { useAuth } from '../lib/authContext';

const STARS = [1, 2, 3, 4, 5];

/**
 * Rate one completed job.
 *
 * `booking` is required, not optional: the insert policy checks that the
 * review points at a completed booking of yours with this artisan, so there is
 * no way to review someone who never worked for you.
 */
export default function ReviewForm({ booking, onDone }) {
  const { profile, user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (rating === 0) {
      setError('Choose a rating from 1 to 5 stars.');
      return;
    }

    setSaving(true);
    try {
      await createReview({
        workerId: booking.workerId,
        bookingId: booking.id,
        author: profile?.fullName || user?.email || 'Client',
        rating,
        comment,
      });
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="review-form" onSubmit={handleSubmit} noValidate>
      <h4>Rate this job</h4>

      <div className="star-picker" role="radiogroup" aria-label="Rating">
        {STARS.map(star => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} star${star === 1 ? '' : 's'}`}
            className={`star${star <= (hovered || rating) ? ' filled' : ''}`}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setRating(star)}
          >
            ★
          </button>
        ))}
      </div>

      <div className="field">
        <label htmlFor={`comment-${booking.id}`}>Comment (optional)</label>
        <textarea
          id={`comment-${booking.id}`}
          rows={3}
          value={comment}
          onChange={e => setComment(e.target.value)}
        />
      </div>

      {error && <small className="error">{error}</small>}

      <button type="submit" className="btn-primary small" disabled={saving}>
        {saving ? 'Sending…' : 'Submit review'}
      </button>
    </form>
  );
}
