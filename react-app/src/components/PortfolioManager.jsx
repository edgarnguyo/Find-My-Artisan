import { useState } from 'react';
import { addPortfolioItem, deletePortfolioItem } from '../api/artisan';

const MAX_BYTES = 5 * 1024 * 1024;

/** Upload and remove photos of finished work. */
export default function PortfolioManager({ worker, onChanged }) {
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [removing, setRemoving] = useState(null);

  async function handleUpload(e) {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError('Choose a photo first.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('That file is not an image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('Photos must be 5 MB or smaller.');
      return;
    }

    setUploading(true);
    try {
      await addPortfolioItem(worker.id, file, caption);
      setFile(null);
      setCaption('');
      // Clear the file input, which React does not control.
      e.target.reset();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    setRemoving(id);
    try {
      await deletePortfolioItem(id);
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <section className="dash-card">
      <h2>Portfolio</h2>
      <p className="dash-hint">
        Photos of work you have finished. These replace the stock images on your
        public profile.
      </p>

      <form onSubmit={handleUpload} className="portfolio-upload">
        <div className="field">
          <label htmlFor="portfolio-file">Photo</label>
          <input
            id="portfolio-file"
            type="file"
            accept="image/*"
            onChange={e => setFile(e.target.files[0] ?? null)}
          />
        </div>

        <div className="field">
          <label htmlFor="portfolio-caption">Caption</label>
          <input
            id="portfolio-caption"
            type="text"
            placeholder="e.g. Rewired a three-bedroom flat"
            value={caption}
            onChange={e => setCaption(e.target.value)}
          />
        </div>

        {error && <small className="error">{error}</small>}

        <button type="submit" className="submit-btn" disabled={uploading}>
          {uploading ? 'Uploading…' : 'Add photo'}
        </button>
      </form>

      {worker.portfolio.length === 0 ? (
        <p className="dash-empty">No photos yet.</p>
      ) : (
        <div className="portfolio-grid">
          {worker.portfolio.map(item => (
            <figure key={item.id} className="portfolio-tile">
              <img src={item.imageUrl} alt={item.caption ?? 'Finished work'} />
              <figcaption>{item.caption}</figcaption>
              <button
                type="button"
                className="link-button"
                disabled={removing === item.id}
                onClick={() => handleDelete(item.id)}
              >
                {removing === item.id ? 'Removing…' : 'Remove'}
              </button>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
