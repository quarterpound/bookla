import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth.store';
import { logout } from '../api/auth';

export const HomePage = () => {
  const { user, tenant, setAuth } = useAuthStore();
  const navigate = useNavigate();

  const onLogout = async () => {
    await logout();
    setAuth(null);
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="shell">
      <div className="toolbar">
        <strong>{tenant?.name}</strong>
        <button className="primary" style={{ width: 'auto' }} onClick={onLogout}>
          Sign out
        </button>
      </div>
      <h1>Welcome, {user?.name ?? user?.email}</h1>
      <p className="muted">
        You are signed in to <code>{tenant?.slug}</code> as <code>{user?.role}</code> /{' '}
        <code>{user?.subRole}</code>.
      </p>
      <p>This is the scaffold home page. Build your features on top of it.</p>
    </div>
  );
};
