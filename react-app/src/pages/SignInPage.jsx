import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { saveUser } from '../api/users';

// Same trades as the listings filter.
const SKILLS = ['Plumber', 'Electrician', 'Carpenter', 'Painter'];

export default function SignInPage() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('client');
  const [skill, setSkill] = useState('');
  const [workLocation, setWorkLocation] = useState('');
  const [price, setPrice] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Send the user back where they were headed before we interrupted them.
  const next = location.state?.from ?? '/bookings';
  const isSignup = mode === 'signup';
  const isArtisan = isSignup && role === 'artisan';

  // Runs before Supabase creates the account, so a missing detail can never
  // leave an account in Supabase with nothing saved in MySQL.
  function validate() {
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (!isSignup) return null;
    if (!name.trim()) return 'Please enter your name.';
    if (isArtisan && !skill) return 'Please choose your skill.';
    if (isArtisan && !workLocation.trim()) return 'Please enter where you work.';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    try {
      const { data, error: authError } = isSignup
        ? await signUp(email, password)
        : await signIn(email, password);

      if (authError) {
        setError(authError.message);
        return;
      }

      // Make sure the account is in MySQL. Sign-up saves the new row with its
      // details; sign-in adds any account whose sign-up happened while the API was
      // down (an existing row is fine). identities is empty when sign-up hit an
      // already-registered email: Supabase then returns a placeholder user with a
      // fake id, so skip it.
      const isRealUser = !isSignup || data.user?.identities?.length > 0;
      if (data.user && isRealUser) {
        const account = { id: data.user.id, email: data.user.email };
        if (isSignup) {
          account.name = name.trim();
          account.role = role;
          if (isArtisan) {
            account.artisan = {
              skill,
              location: workLocation.trim(),
              price: price.trim(),
              bio: bio.trim(),
            };
          }
        }

        try {
          await saveUser(account);
        } catch (saveError) {
          setError(
            isSignup
              ? `Account created, but saving it to MySQL failed: ${saveError.message}`
              : `Signed in, but saving your account to MySQL failed: ${saveError.message}`
          );
          return;
        }
      }

      // With email confirmation switched on, signUp returns a user but no
      // session — there is nothing to redirect to until they confirm.
      if (isSignup && !data.session) {
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
        <h1>{isSignup ? 'Create an account' : 'Sign in'}</h1>
        <p className="auth-sub">
          {isSignup
            ? 'Join as a client to book artisans, or as an artisan to list your services.'
            : 'Sign in to see the artisans you have booked.'}
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {isSignup && (
            <>
              <div className="field">
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  maxLength={100}
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <fieldset className="field">
                <legend>I'm joining as</legend>
                <div className="role-options">
                  <label className="role-option">
                    <input
                      type="radio"
                      name="role"
                      value="client"
                      checked={role === 'client'}
                      onChange={() => setRole('client')}
                    />
                    A client
                  </label>
                  <label className="role-option">
                    <input
                      type="radio"
                      name="role"
                      value="artisan"
                      checked={role === 'artisan'}
                      onChange={() => setRole('artisan')}
                    />
                    An artisan
                  </label>
                </div>
              </fieldset>
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
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          {isArtisan && (
            <>
              <div className="field-row">
                <div className="field">
                  <label htmlFor="skill">Skill</label>
                  <select id="skill" value={skill} onChange={e => setSkill(e.target.value)}>
                    <option value="">Choose…</option>
                    {SKILLS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="work-location">Location</label>
                  <input
                    id="work-location"
                    type="text"
                    placeholder="e.g. Westlands, Nairobi"
                    maxLength={100}
                    value={workLocation}
                    onChange={e => setWorkLocation(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="price">Price (optional)</label>
                <input
                  id="price"
                  type="text"
                  placeholder="e.g. KES 2,000 – 6,000 / job"
                  maxLength={50}
                  value={price}
                  onChange={e => setPrice(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="bio">About your work (optional)</label>
                <textarea
                  id="bio"
                  rows={3}
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                />
              </div>
            </>
          )}

          {error && <small className="error">{error}</small>}
          {notice && <div className="confirmation">{notice}</div>}

          <button type="submit" className="submit-btn" disabled={busy}>
            {busy ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          {isSignup ? 'Already have an account? ' : 'No account yet? '}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setMode(isSignup ? 'signin' : 'signup');
              setError(null);
              setNotice(null);
            }}
          >
            {isSignup ? 'Sign in' : 'Create one'}
          </button>
        </p>

        <p className="auth-switch">
          <Link to="/listings">Browse artisans without an account</Link>
        </p>
      </section>
    </main>
  );
}
