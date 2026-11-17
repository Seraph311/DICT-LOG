import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_LABELS } from '../lib/roles.js';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark" aria-hidden="true">
            DICT
          </span>
          <span className="brand-text">
            <span className="brand-eyebrow">Camarines Norte Provincial Office</span>
            <span className="brand-title">Visitor Logsheet</span>
          </span>
        </Link>

        <div className="user-box">
          {(user?.role === 'reviewer' || user?.role === 'administrator') && (
            <Link to="/dashboard" className="btn btn-ghost">
              Dashboard
            </Link>
          )}
          {(user?.role === 'front_desk' || user?.role === 'administrator') && (
            <Link to="/visitors" className="btn btn-ghost">
              Visitor log
            </Link>
          )}
          <span className="user-name">{user?.full_name}</span>
          <span className="role-badge">{ROLE_LABELS[user?.role] ?? user?.role}</span>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>

      <main className="page">{children}</main>

      <footer className="footer">
        <span>DICT Camarines Norte Provincial Office</span>
        <span>Academic prototype — synthetic data only</span>
      </footer>
    </div>
  );
}
