import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function VipLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isImmersive = location.pathname.startsWith('/vip/new-order');

  function handleLogout() {
    logout();
    navigate('/admin/login', { replace: true });
  }

  return (
    <div style={{
      height: isImmersive ? '100vh' : undefined,
      minHeight: isImmersive ? undefined : '100vh',
      overflow: isImmersive ? 'hidden' : undefined,
      display: 'flex',
      flexDirection: 'column',
      background: '#f5f4f0',
      fontFamily: "'Georgia', serif",
    }}>
      {/* Header */}
      <header
        style={{
          background: '#152753',
          padding: '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '70px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #c9a84c, #e8c96e)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: "'Georgia', serif",
              fontWeight: 700,
              fontSize: '16px',
              color: '#152753',
              letterSpacing: '1px',
              flexShrink: 0,
            }}
          >
            EG
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span
              style={{
                fontSize: '10px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                color: '#c9a84c',
                fontFamily: "'Georgia', serif",
              }}
            >
              VIP Portal
            </span>
            <span
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: '#ffffff',
                fontFamily: "'Georgia', serif",
                letterSpacing: '0.5px',
              }}
            >
              Erdal Güda
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <Link
            to="/vip"
            style={{
              color: '#c9a84c',
              textDecoration: 'none',
              fontSize: '14px',
              letterSpacing: '0.5px',
              fontFamily: "'Georgia', serif",
              transition: 'opacity 0.2s',
            }}
          >
            Portalım
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              background: 'transparent',
              border: '1px solid rgba(201, 168, 76, 0.4)',
              color: '#c9a84c',
              padding: '7px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '13px',
              fontFamily: "'Georgia', serif",
              letterSpacing: '0.5px',
              transition: 'all 0.2s',
            }}
          >
            Çıkış
          </button>
        </nav>
      </header>

      {/* Welcome strip */}
      <div
        style={{
          background: 'linear-gradient(90deg, #1a3166 0%, #152753 60%, #0f1e3d 100%)',
          padding: '14px 32px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            color: 'rgba(201, 168, 76, 0.7)',
            fontFamily: "'Georgia', serif",
          }}
        >
          Hoş geldiniz,
        </span>
        <span
          style={{
            fontSize: '14px',
            color: '#ffffff',
            fontFamily: "'Georgia', serif",
            fontWeight: 600,
            letterSpacing: '0.5px',
          }}
        >
          {user?.fullName ?? ''}
        </span>
      </div>

      {/* Main content */}
      <main
        style={isImmersive ? {
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
        } : {
          maxWidth: '900px',
          margin: '0 auto',
          padding: '40px 24px',
        }}
      >
        <Outlet />
      </main>
    </div>
  );
}
