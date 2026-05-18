import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../api/auth';
import { useAuthStore } from '../store/auth.store';
import { ClientError } from '../api/base';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({
    tenantName: '',
    tenantSlug: '',
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const me = await register({
        tenantName: form.tenantName,
        tenantSlug: form.tenantSlug,
        name: form.name || undefined,
        email: form.email,
        password: form.password,
      });
      setAuth(me);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ClientError ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="card" onSubmit={onSubmit}>
      <h1>Create your workspace</h1>
      {error && <div className="error">{error}</div>}
      <div className="field">
        <label htmlFor="tenantName">Workspace name</label>
        <input id="tenantName" required value={form.tenantName} onChange={update('tenantName')} />
      </div>
      <div className="field">
        <label htmlFor="tenantSlug">Workspace URL slug</label>
        <input
          id="tenantSlug"
          required
          placeholder="acme"
          pattern="[a-z0-9-]+"
          value={form.tenantSlug}
          onChange={update('tenantSlug')}
        />
      </div>
      <div className="field">
        <label htmlFor="name">
          Your name <span className="muted">(optional)</span>
        </label>
        <input id="name" value={form.name} onChange={update('name')} />
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" required value={form.email} onChange={update('email')} />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={update('password')}
        />
      </div>
      <button className="primary" type="submit" disabled={submitting}>
        {submitting ? 'Creating…' : 'Create workspace'}
      </button>
      <p className="muted" style={{ marginTop: '1rem' }}>
        Already have an account? <Link to="/auth/login">Sign in</Link>
      </p>
    </form>
  );
};
