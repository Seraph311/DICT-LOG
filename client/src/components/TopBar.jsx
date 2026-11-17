import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { ROLE_LABELS } from '../lib/roles.js';

export default function TopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/', { replace: true });
    }
  }

  return (
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
        {user ? (
          <>
            <span className="user-name">{user.full_name}</span>
            <span className="role-badge">{ROLE_LABELS[user.role] ?? user.role}</span>
            <Link to={user.role === 'front_desk' ? '/visitors' : '/dashboard'} className="btn btn-ghost">
              {user.role === 'front_desk' ? 'Visitor log' : 'Dashboard'}
            </Link>
            <button type="button" className="btn btn-ghost" onClick={handleLogout}>
              Log out
            </button>
          </>
        ) : (
          <Link to="/login" className="btn btn-primary">
            Staff Login
          </Link>
        )}
      </div>
    </header>
  );
}
