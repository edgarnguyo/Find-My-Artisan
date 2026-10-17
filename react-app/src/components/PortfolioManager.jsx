import { useState } from 'react';
import { addPortfolioItem, removePortfolioItem } from '../api/workers';

const LIMIT = 12;

// The same rule as the server: only links that start with https://.
function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function formatDate(value) {
  // A plain date ('2026-03-14') is read as midnight UTC, so format it in UTC too.
  return new Date(value).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * The artisan's portfolio on their dashboard: past jobs with a photo, shown on
 * their public profile. Photos are links to images hosted elsewhere (Google
 * Photos, Imgur, a website), since the free hosting can't keep uploaded files.
 */
export default function PortfolioManager({ artisanId, initialItems }) {
  const [items, setItems] = useState(initialItems);
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [workDate, setWorkDate] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);
  // The preview image failed to load, so the link probably isn't a photo.
  const [previewBroken, setPreviewBroken] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!title.trim()) return setError('Give the job a title.');
    if (!isHttpsUrl(imageUrl)) return setError('The photo link must start with https://');
    setError(null);
    setSaving(true);
    try {
      const item = await addPortfolioItem(artisanId, {
        title,
        imageUrl,
        description,
        workDate: workDate || null,
      });
      setItems(current => [item, ...current]);
      setTitle('');
      setImageUrl('');
      setDescription('');
      setWorkDate('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(item) {
    if (!window.confirm(`Remove "${item.title}" from your portfolio?`)) return;
    setRemoving(item.id);
    try {
      await removePortfolioItem(artisanId, item.id);
      setItems(current => current.filter(i => i.id !== item.id));
    } catch (err) {
      alert(`Could not remove it: ${err.message}`);
    } finally {
      setRemoving(null);
    }
  }

  const full = items.length >= LIMIT;

  return (
    <section className="dashboard-card">
      <h2>Portfolio</h2>
      <p className="bookings-sub">
        Past jobs with a photo, shown on your profile ({items.length} of {LIMIT}).
      </p>

      {items.length > 0 && (
        <ul className="portfolio-list">
          {items.map(item => (
            <li key={item.id}>
              <img src={item.imageUrl} alt="" className="portfolio-thumb" />
              <span className="portfolio-list-text">
                <strong>{item.title}</strong>
                {item.workDate && <span className="busy-reason">{formatDate(item.workDate)}</span>}
              </span>
              <button
                className="link-button"
                onClick={() => handleRemove(item)}
                disabled={removing === item.id}
              >
                {removing === item.id ? 'Removing…' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {full ? (
        <p className="bookings-sub">Your portfolio is full. Remove a job to add another.</p>
      ) : (
        <form className="portfolio-form" onSubmit={handleAdd} noValidate>
          <div className="field">
            <label htmlFor="item-title">Job title</label>
            <input id="item-title" type="text" maxLength={100} placeholder="e.g. Bathroom refit in Kilimani"
              value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="item-url">Photo link</label>
            <input id="item-url" type="url" maxLength={500} placeholder="https://…"
              value={imageUrl}
              onChange={e => {
                setImageUrl(e.target.value);
                setPreviewBroken(false);
              }} />
          </div>
          {isHttpsUrl(imageUrl) && (
            previewBroken ? (
              <small className="error">That link doesn't open as a photo. Check it's a direct link to an image.</small>
            ) : (
              <img src={imageUrl} alt="Preview of the photo" className="portfolio-preview"
                onError={() => setPreviewBroken(true)} />
            )
          )}
          <div className="field-row">
            <div className="field">
              <label htmlFor="item-date">When (optional)</label>
              <input id="item-date" type="date" value={workDate} onChange={e => setWorkDate(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="item-description">What you did (optional)</label>
            <textarea id="item-description" rows={2} maxLength={500}
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {error && <small className="error">{error}</small>}

          <button type="submit" className="booking-action" disabled={saving}>
            {saving ? 'Adding…' : 'Add to portfolio'}
          </button>
        </form>
      )}
    </section>
  );
}
