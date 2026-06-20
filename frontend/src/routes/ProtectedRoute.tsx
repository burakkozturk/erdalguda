import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/auth';

type ProtectedRouteProps = {
  roles?: UserRole[];
  allowedUsernames?: string[];
};

export function ProtectedRoute({ roles, allowedUsernames }: ProtectedRouteProps) {
  const location = useLocation();
  const { user, isAuthenticated, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return (
      <div className="auth-loading-screen">
        <span className="eyebrow">Oturum kontrol ediliyor</span>
        <strong>Atölye çalışma alanı hazırlanıyor...</strong>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  // VIP customers navigating to /admin get redirected to their portal
  if (user?.role === 'VIP_CUSTOMER' && location.pathname.startsWith('/admin')) {
    return <Navigate to="/vip" replace />;
  }

  if (roles && roles.length > 0 && !hasRole(...roles)) {
    if (user?.role === 'VIP_CUSTOMER') {
      return <Navigate to="/vip" replace />;
    }
    return (
      <div className="unauthorized-state">
        <span className="eyebrow">Yetkisiz erişim</span>
        <h2>Bu sayfaya erişim yetkiniz bulunmuyor.</h2>
        <p>Gerekli olduğunu düşünüyorsanız yönetici ile iletişime geçin.</p>
      </div>
    );
  }

  if (allowedUsernames && allowedUsernames.length > 0 && !allowedUsernames.includes(user?.username ?? '')) {
    return (
      <div className="unauthorized-state">
        <span className="eyebrow">Yetkisiz erişim</span>
        <h2>Bu sayfaya erişim yetkiniz bulunmuyor.</h2>
        <p>Gerekli olduğunu düşünüyorsanız yönetici ile iletişime geçin.</p>
      </div>
    );
  }

  return <Outlet />;
}
