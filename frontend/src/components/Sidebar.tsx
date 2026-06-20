import { NavLink } from 'react-router-dom';
import logo from '../assets/visuals/logo.png';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';

type NavigationItem = {
  label: string;
  path: string;
  roles?: UserRole[];
  allowedUsernames?: string[];
};

const navigationItems: NavigationItem[] = [
  { label: 'Panel', path: '/admin/dashboard' },
  { label: 'Üretim Takibi', path: '/admin/workflow' },
  { label: 'Ekspres Kayıt', path: '/admin/express-registration', allowedUsernames: ['erdal.guda', 'ufuk.bas'] },
  { label: 'Müşteriler', path: '/admin/customers', roles: ['ADMIN', 'SALES'] },
  { label: 'Ölçüler', path: '/admin/measurements', roles: ['ADMIN', 'SALES'] },
  { label: 'Siparişler', path: '/admin/orders', roles: ['ADMIN', 'SALES'] },
  { label: 'Kumaş Kütüphanesi', path: '/admin/fabric-management', roles: ['ADMIN'] },
  { label: 'Randevular', path: '/admin/appointments', roles: ['ADMIN', 'SALES'] },
  { label: 'Ödemeler', path: '/admin/payments', roles: ['ADMIN'] },
  { label: 'Kalıplar', path: '/admin/patterns', roles: ['ADMIN'] },
  { label: 'Kullanıcılar', path: '/admin/users', roles: ['ADMIN'] },
  { label: 'Şifre Değiştir', path: '/admin/change-password' },
  { label: 'Ayarlar', path: '/admin/settings', roles: ['ADMIN'] },
];

type SidebarProps = {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
};

export function Sidebar({ isMobileOpen = false, onMobileClose }: SidebarProps) {
  const { user, hasRole, logout } = useAuth();
  const visibleItems = navigationItems.filter((item) => {
    const roleAllowed = !item.roles || hasRole(...item.roles);
    const usernameAllowed = !item.allowedUsernames || item.allowedUsernames.includes(user?.username ?? '');
    return roleAllowed && usernameAllowed;
  });

  return (
    <>
      <button
        type="button"
        className={isMobileOpen ? 'sidebar-backdrop open' : 'sidebar-backdrop'}
        aria-label="Menüyü kapat"
        onClick={onMobileClose}
      />
      <aside className={isMobileOpen ? 'sidebar mobile-open' : 'sidebar'}>
        <div className="brand-block">
          <span className="brand-mark">
            <img src={logo} alt="Erdal Güda" />
          </span>
          <div>
            <strong>Erdal Güda</strong>
            <span>Atölye Yönetimi</span>
          </div>
        </div>

        {user && (
          <div className="sidebar-user-block">
            <span>Oturum</span>
            <strong>{user.fullName}</strong>
            <small>{user.roleLabel}</small>
            <small>{user.username}</small>
          </div>
        )}

        <div className="sidebar-label">Atölye modülleri</div>
        <nav className="sidebar-nav" aria-label="Admin navigasyonu">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              onClick={onMobileClose}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span>Web sitesi</span>
          <NavLink className="website-link" to="/" onClick={onMobileClose}>
            Web Sitesini Gör
          </NavLink>
          <button className="sidebar-logout-button" type="button" onClick={logout}>
            Çıkış Yap
          </button>
        </div>
      </aside>
    </>
  );
}
