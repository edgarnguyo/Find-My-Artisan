import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import {
  updateMyProfile,
  updateMyEmail,
  updateMyPassword,
  deleteMyAccount,
} from '../api/profiles';

export default function AccountPage() {
  const { user, profile, reloadProfile } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // The profile arrives one request after the session does, so the form is
  // seeded when it lands rather than on first render. Doing it during render
  // (the same trick useAsync uses for changed deps) keeps the inputs from
  // flashing empty first, and `seededFor` stops it overwriting edits.
  const [seededFor, setSeededFor] = useState(null);
  if (profile && seededFor !== profile.id) {
    setSeededFor(profile.id);
    setFullName(profile.fullName);
    setContact(profile.contact);
    setEmail(profile.email ?? '');
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setSaving(true);

    try {
      await updateMyProfile({ fullName, contact });

      if (email && email !== profile?.email) {
        await updateMyEmail(email);
        setNotice('Saved. Check your new address for a confirmation link.');
      } else {
        setNotice('Saved.');
      }

      if (password) {
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters.');
        }
        await updateMyPassword(password);
        setPassword('');
        setNotice('Saved, including your new password.');
      }

      await reloadProfile();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);

    try {
      await deleteMyAccount();
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <main className="account-page">
      <header className="account-header">
        <h1>Your account</h1>
        <p className="account-sub">
          Signed in as {user?.email}
          {profile && ` · ${profile.role === 'artisan' ? 'Artisan' : 'Client'} account`}
        </p>
      </header>

      <section className="account-card">
        <h2>Details</h2>

        <form onSubmit={handleSaveProfile} noValidate>
          <div className="field">
            <label htmlFor="account-name">Full name</label>
            <input
              id="account-name"
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="account-contact">Phone</label>
            <input
              id="account-contact"
              type="text"
              value={contact}
              onChange={e => setContact(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="account-email">Email</label>
            <input
              id="account-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <small className="field-hint">
              Changing this sends a confirmation link to the new address.
            </small>
          </div>

          <div className="field">
            <label htmlFor="account-password">New password</label>
            <input
              id="account-password"
              type="password"
              autoComplete="new-password"
              placeholder="Leave blank to keep your current one"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && <small className="error">{error}</small>}
          {notice && <div className="confirmation">{notice}</div>}

          <button type="submit" className="submit-btn" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </section>

      <section className="account-card danger">
        <h2>Delete account</h2>
        <p>
          This removes your profile, your bookings and — if you are an artisan —
          your listing and portfolio. It cannot be undone.
        </p>

        <div className="field">
          <label htmlFor="confirm-delete">Type DELETE to confirm</label>
          <input
            id="confirm-delete"
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="danger-btn"
          disabled={confirmText !== 'DELETE' || deleting}
          onClick={handleDelete}
        >
          {deleting ? 'Deleting…' : 'Delete my account'}
        </button>
      </section>
    </main>
  );
}
