import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import TopBar from '../components/TopBar.jsx';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="center-screen" role="status">
        <span className="spinner" aria-hidden="true" />
        Loading…
      </div>
    );
  }

  if (user) {
    return (
      <Navigate
        to={user.role === 'front_desk' ? '/visitors' : '/dashboard'}
        replace
      />
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedInUser = await login(username.trim(), password);
      navigate(
        location.state?.from || (loggedInUser.role === 'front_desk' ? '/visitors' : '/dashboard'),
        { replace: true },
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app">
      <TopBar />
      <div className="login-page">
      <aside className="login-aside">
        <span className="brand-mark brand-mark-large" aria-hidden="true">
          DICT
        </span>
        <p className="brand-eyebrow">Camarines Norte Provincial Office</p>
        <h1>Visitor Logsheet</h1>
        <p className="login-aside-text">
          Log, search, and maintain visitor records in one place.
        </p>
        <ul className="login-points">
          <li>Front desk visitor logging and corrections</li>
          <li>Role-based access to records</li>
          <li>Every change recorded in the audit log</li>
        </ul>
      </aside>

      <section className="login-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <h2>Sign in</h2>
          <p className="muted">Use your office account to continue.</p>

          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              autoComplete="username"
              autoFocus
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
      </div>
    </div>
  );
}
