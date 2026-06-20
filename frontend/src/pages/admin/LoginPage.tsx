import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import logo from '../../assets/visuals/logo.png';
import { useAuth } from '../../context/AuthContext';

type LocationState = {
  from?: {
    pathname: string;
  };
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, login, user } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as LocationState | null)?.from?.pathname ?? null;

  if (isAuthenticated) {
    if (user?.role === 'VIP_CUSTOMER') {
      return <Navigate to="/vip" replace />;
    }
    return <Navigate to={from ?? '/admin/dashboard'} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!username.trim()) {
      setError('Kullanıcı adı zorunludur.');
      return;
    }

    if (!password) {
      setError('Şifre zorunludur.');
      return;
    }

    setIsSubmitting(true);
    try {
      const loggedUser = await login(username.trim(), password);
      const destination = loggedUser.role === 'VIP_CUSTOMER' ? '/vip' : (from ?? '/admin/dashboard');
      navigate(destination, { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Giriş yapılamadı.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-brand">
          <span>
            <img src={logo} alt="Erdal Güda" />
          </span>
          <div>
            <strong>Erdal Güda</strong>
            <small>Atölye Yönetimi</small>
          </div>
        </div>

        <div className="login-heading">
          <span className="eyebrow">Güvenli giriş</span>
          <h1>Atölye Yönetim Girişi</h1>
          <p>Erdal Güda üretim ve müşteri yönetim paneline giriş yapın.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Kullanıcı Adı</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>
          <label>
            <span>Şifre</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        <div className="credential-hint">
          <strong>Geliştirme hesapları</strong>
          <span>Yönetici: erdal.guda / erdalguda123</span>
          <span>Satış / Ölçü: ufuk.bas / erdalguda123</span>
          <span>Makinacı: kemal.erbas / erdalguda123</span>
        </div>

        <Link className="website-link-login" to="/">
          Web sitesine dön
        </Link>
      </section>
    </main>
  );
}
