import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const pageTitles: Record<string, string> = {
  '/admin/dashboard': 'Atölye Paneli',
  '/admin/workflow': 'Üretim Takibi',
  '/admin/express-registration': 'Ekspres Kayıt',
  '/admin/customers': 'Müşteri Defteri',
  '/admin/measurements': 'Ölçü Stüdyosu',
  '/admin/orders': 'Sipariş Defteri',
  '/admin/fabrics': 'Kumaş Arşivi',
  '/admin/appointments': 'Randevu Takvimi',
  '/admin/payments': 'Ödeme Takibi',
  '/admin/patterns': 'Kalıp Arşivi',
  '/admin/users': 'Kullanıcılar',
  '/admin/change-password': 'Şifre Değiştir',
  '/admin/settings': 'Ayarlar',
};

type TopbarProps = {
  onMenuClick?: () => void;
};

export function Topbar({ onMenuClick }: TopbarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const title = pageTitles[location.pathname] ?? 'Atölye Yönetimi';

  return (
    <header className="topbar">
      <div className="topbar-title-row">
        <button
          type="button"
          className="mobile-menu-button"
          aria-label="Admin menüsünü aç"
          onClick={onMenuClick}
        >
          <span />
          <span />
          <span />
        </button>
        <div>
          <span className="eyebrow">Admin Çalışma Alanı</span>
          <h1>{title}</h1>
        </div>
      </div>
      <div className="topbar-actions">
        <span className="workspace-chip">
          {user ? `${user.fullName} · ${user.username}` : 'Atölye Operasyonu'}
        </span>
        <div className="admin-chip">{user?.roleLabel ?? 'Yönetici'}</div>
      </div>
    </header>
  );
}
