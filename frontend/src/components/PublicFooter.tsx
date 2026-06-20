import { Link } from 'react-router-dom';

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div>
        <span className="footer-mark">Erdal Güda</span>
        <p>Modern erkekler için kişiye özel terzilik, rafine kalıp ve özenli gardırop çalışmaları.</p>
      </div>
      <div className="footer-links">
        <Link to="/services">Hizmetler</Link>
        <Link to="/atelier">Atölye</Link>
        <Link to="/gallery">Galeri</Link>
        <Link to="/appointment">Randevu</Link>
        <Link to="/admin/dashboard">Admin</Link>
      </div>
    </footer>
  );
}
