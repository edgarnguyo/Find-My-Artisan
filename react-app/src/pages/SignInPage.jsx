import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../lib/authContext';

export default function SignInPage() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Send the user back where they were headed before we interrupted them.
  const next = location.state?.from ?? '/bookings';

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setBusy(true);
    try {
      const { data, error: authError } =
        mode === 'signin'
          ? await signIn(email, password)
          : await signUp(email, password);

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
            : 'Create an account to keep track of your bookings.'}
        </p>

        <form onSubmit={handleSubmit} noValidate>
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
