import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../lib/authContext';

export default function SignInPage() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [contact, setContact] = useState('');
  const [role, setRole] = useState('client');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Send the user back where they were headed before we interrupted them.
  // A new artisan has nothing under /bookings, so start them on their own
  // dashboard instead.
  const fallback = role === 'artisan' ? '/artisan' : '/bookings';
  const next = location.state?.from ?? fallback;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (mode === 'signup' && fullName.trim() === '') {
      setError('Please enter your name.');
      return;
    }

    setBusy(true);
    try {
      const { data, error: authError } =
        mode === 'signin'
          ? await signIn(email, password)
          : await signUp(email, password, { fullName, contact, role });

      if (authError) {
        setError(authError.message);
        return;
      }

      // With email confirmation switched on, signUp returns a user but no
      // session — there is nothing to redirect to until they confirm.
      if (mode === 'signup' && !data.session) {
        setNotice('Account created. Check your email to confirm, then sign in.');
        setMode('signin');
        return;
      }

      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>{mode === 'signin' ? 'Sign in' : 'Create an account'}</h1>
        <p className="auth-sub">
          {mode === 'signin'
            ? 'Sign in to see the artisans you have booked.'
            : 'Book artisans as a client, or list your own trade as an artisan.'}
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {mode === 'signup' && (
            <>
              <fieldset className="role-picker">
                <legend>I am signing up as</legend>
                <label className={`role-option${role === 'client' ? ' selected' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="client"
                    checked={role === 'client'}
                    onChange={() => setRole('client')}
                  />
                  <span className="role-title">A client</span>
                  <span className="role-hint">I want to hire an artisan</span>
                </label>
                <label className={`role-option${role === 'artisan' ? ' selected' : ''}`}>
                  <input
                    type="radio"
                    name="role"
                    value="artisan"
                    checked={role === 'artisan'}
                    onChange={() => setRole('artisan')}
                  />
                  <span className="role-title">An artisan</span>
                  <span className="role-hint">I want to be hired for work</span>
                </label>
              </fieldset>

              <div className="field">
                <label htmlFor="fullName">Full name</label>
                <input
                  id="fullName"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="contact">Phone (optional)</label>
                <input
                  id="contact"
                  type="text"
                  autoComplete="tel"
                  value={contact}
                  onChange={e => setContact(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {error && <small className="error">{error}</small>}
          {notice && <div className="confirmation">{notice}</div>}

          <button type="submit" className="submit-btn" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'signin' ? "No account yet? " : 'Already have an account? '}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError(null);
              setNotice(null);
            }}
          >
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </p>

        <p className="auth-switch">
          <Link to="/listings">Browse artisans without an account</Link>
        </p>
      </section>
    </main>
  );
}
