import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../api/auth';
import { useAuthStore } from '../store/auth.store';
import { ClientError } from '../api/base';

export const LoginPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const me = await login({ email, password, tenantSlug: tenantSlug || undefined });
      setAuth(me);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ClientError ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="card" onSubmit={onSubmit}>
      <h1>Sign in</h1>
      {error && <div className="error">{error}</div>}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="tenantSlug">
          Tenant slug <span className="muted">(only if shared across tenants)</span>
        </label>
        <input
          id="tenantSlug"
          type="text"
          value={tenantSlug}
          onChange={(e) => setTenantSlug(e.target.value)}
        />
      </div>
      <button className="primary" type="submit" disabled={submitting}>
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="muted" style={{ marginTop: '1rem' }}>
        New here? <Link to="/auth/register">Create a workspace</Link>
      </p>
    </form>
  );
};
