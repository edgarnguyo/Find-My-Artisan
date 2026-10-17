import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchClient, updateClient, updateArtisanName, changePassword, deleteAccount } from '../api/account';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../lib/authContext';

// Account settings for both roles: details, password, and deleting the account.
export default function AccountPage() {
  const { user } = useAuth();
  const isArtisan = user.role === 'artisan';

  return (
    <main className="bookings-page">
      <header className="bookings-header">
        <h1>Account</h1>
        <p className="bookings-sub">
          Signed in as {user.email} ({isArtisan ? 'artisan' : 'client'})
        </p>
      </header>

      {isArtisan ? <ArtisanDetails /> : <ClientDetails />}
      <PasswordForm />
      <DeleteAccount />
    </main>
  );
}

// A form's "Saved" or error line under its button.
function FormStatus({ error, saved }) {
  if (error) return <small className="error">{error}</small>;
  if (saved) return <p className="saved-note" role="status">{saved}</p>;
  return null;
}

function ClientDetails() {
  const { user } = useAuth();
  const load = useCallback(() => fetchClient(user.id), [user.id]);
  const { data: client, error, loading } = useAsync(load, [user.id]);

  return (
    <section className="dashboard-card">
      <h2>Your details</h2>
      <p className="bookings-sub">Your name goes on the reviews you write from now on.</p>
      {loading ? (
        <div className="skeleton-card" />
      ) : error ? (
        <p className="error">Could not load your details: {error.message}</p>
      ) : (
        <ClientDetailsForm client={client} />
      )}
    </section>
  );
}

// A separate component so its fields start from the loaded details.
function ClientDetailsForm({ client }) {
  const { updateUser } = useAuth();
  const [name, setName] = useState(client.name);
  const [phone, setPhone] = useState(client.phone ?? '');
  const [location, setLocation] = useState(client.location ?? '');
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaved(null);
    if (!name.trim()) return setError('Please enter your name.');
    setError(null);
    setSaving(true);
    try {
      const updated = await updateClient(client.id, { name, phone, location });
      updateUser({ name: updated.name });
      setSaved('Saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="edit-profile-form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="acc-name">Full name</label>
        <input id="acc-name" type="text" maxLength={100} autoComplete="name"
          value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="acc-phone">Phone (optional)</label>
          <input id="acc-phone" type="tel" maxLength={30} autoComplete="tel"
            value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="acc-location">Location (optional)</label>
          <input id="acc-location" type="text" maxLength={100} placeholder="e.g. Westlands"
            value={location} onChange={e => setLocation(e.target.value)} />
        </div>
      </div>
      <FormStatus error={error} saved={saved} />
      <button type="submit" className="booking-action" disabled={saving}>
        {saving ? 'Saving…' : 'Save details'}
      </button>
    </form>
  );
}

function ArtisanDetails() {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user.name);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaved(null);
    if (!name.trim()) return setError('Please enter your name.');
    setError(null);
    setSaving(true);
    try {
      await updateArtisanName(user.id, name);
      updateUser({ name: name.trim() });
      setSaved('Saved. Clients see the new name on your profile.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="dashboard-card">
      <h2>Your name</h2>
      <p className="bookings-sub">
        Your area, phone, prices and portfolio are on{' '}
        <Link to="/dashboard/profile">your profile page</Link>.
      </p>
      <form className="edit-profile-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="acc-name">Name shown to clients</label>
          <input id="acc-name" type="text" maxLength={100} autoComplete="name"
            value={name} onChange={e => setName(e.target.value)} />
        </div>
        <FormStatus error={error} saved={saved} />
        <button type="submit" className="booking-action" disabled={saving}>
          {saving ? 'Saving…' : 'Save name'}
        </button>
      </form>
    </section>
  );
}

function PasswordForm() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaved(null);
    if (!current) return setError('Enter your current password.');
    if (next.length < 6) return setError('The new password must be at least 6 characters.');
    if (next !== repeat) return setError("The two new passwords don't match.");
    setError(null);
    setSaving(true);
    try {
      await changePassword(user.role, user.id, current, next);
      setCurrent('');
      setNext('');
      setRepeat('');
      setSaved('Password changed. Use the new one next time you sign in.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="dashboard-card">
      <h2>Password</h2>
      <form className="edit-profile-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="pw-current">Current password</label>
          <input id="pw-current" type="password" autoComplete="current-password"
            value={current} onChange={e => setCurrent(e.target.value)} />
        </div>
        <div className="field-row">
          <div className="field">
            <label htmlFor="pw-new">New password</label>
            <input id="pw-new" type="password" autoComplete="new-password"
              value={next} onChange={e => setNext(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="pw-repeat">New password again</label>
            <input id="pw-repeat" type="password" autoComplete="new-password"
              value={repeat} onChange={e => setRepeat(e.target.value)} />
          </div>
        </div>
        <FormStatus error={error} saved={saved} />
        <button type="submit" className="booking-action" disabled={saving}>
          {saving ? 'Saving…' : 'Change password'}
        </button>
      </form>
    </section>
  );
}

function DeleteAccount() {
  const { user, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const isArtisan = user.role === 'artisan';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!password) return setError('Enter your password to confirm.');
    if (!window.confirm('Delete your account for good? This cannot be undone.')) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteAccount(user.role, user.id, password);
      // This page needs an account, so once signed out RequireAuth takes the
      // visitor to the home page.
      signOut();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  }

  return (
    <section className="dashboard-card danger-card">
      <h2>Delete account</h2>
      <p className="bookings-sub">
        {isArtisan
          ? 'Your profile, portfolio, reviews and job history are removed for good. Decline or complete any open jobs first.'
          : 'Your open bookings are cancelled. Artisans keep the record of past jobs and your reviews, no longer linked to you.'}
      </p>
      <form className="edit-profile-form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="delete-password">Your password</label>
          <input id="delete-password" type="password" autoComplete="current-password"
            value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <FormStatus error={error} />
        <button type="submit" className="booking-action danger-button" disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete my account'}
        </button>
      </form>
    </section>
  );
}
