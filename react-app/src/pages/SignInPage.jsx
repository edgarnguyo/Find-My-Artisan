import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../lib/authContext';
import { COUNTIES } from '../data/counties';

// Same trades as the listings filter.
const SKILLS = ['Plumber', 'Electrician', 'Carpenter', 'Painter'];

export default function SignInPage() {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('client');
  const [phone, setPhone] = useState('');
  const [skill, setSkill] = useState('');
  const [workLocation, setWorkLocation] = useState('');
  const [county, setCounty] = useState('');
  const [price, setPrice] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Send the user back where they were headed before we interrupted them.
  const next = location.state?.from ?? '/my-bookings';
  const isSignup = mode === 'signup';
  const isClient = isSignup && role === 'client';
  const isArtisan = isSignup && role === 'artisan';

  // Quick checks in the browser for a faster message. The server checks the
  // same things again, because anyone can send a request without this form.
  function validate() {
    if (!email.trim()) return 'Please enter your email.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (!isSignup) return null;
    if (!name.trim()) return 'Please enter your name.';
    if (isArtisan && !skill) return 'Please choose your skill.';
    // Meditrac books artisans by phone, so the API contract requires a number.
    if (isArtisan && !phone.trim()) return 'Please enter your phone number.';
    if (isArtisan && !workLocation.trim()) return 'Please enter the area you work in.';
    if (isArtisan && !county) return 'Please choose your county.';
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    try {
      let signedIn;
      if (isSignup) {
        const details = { email, password, role, name, location: workLocation };
        if (isClient) {
          details.phone = phone;
        } else {
          details.skill = skill;
          details.county = county;
          details.phone = phone;
          details.price = price;
          details.bio = bio;
        }
        signedIn = await signUp(details);
      } else {
        signedIn = await signIn(email, password);
      }
      // Clients go on to their bookings. Artisans don't book, so they go home.
      navigate(signedIn.role === 'client' ? next : (location.state?.from ?? '/'), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const locationField = (
    <div className="field">
      <label htmlFor="work-location">
        {isArtisan ? 'Area' : 'Location (optional)'}
      </label>
      <input
        id="work-location"
        type="text"
        placeholder="e.g. Westlands"
        maxLength={100}
        value={workLocation}
        onChange={e => setWorkLocation(e.target.value)}
      />
    </div>
  );

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

          {isClient && (
            <div className="field-row">
              <div className="field">
                <label htmlFor="phone">Phone (optional)</label>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="e.g. 0712 345 678"
                  maxLength={30}
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
              {locationField}
            </div>
          )}

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
                {locationField}
              </div>

              <div className="field">
                <label htmlFor="county">County</label>
                <select id="county" value={county} onChange={e => setCounty(e.target.value)}>
                  <option value="">Choose…</option>
                  {COUNTIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="artisan-phone">Phone</label>
                <input
                  id="artisan-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="e.g. 0712 345 678"
                  maxLength={20}
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                />
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
