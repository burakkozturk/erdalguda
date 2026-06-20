import { NavLink } from 'react-router-dom';
import logo from '../assets/visuals/logo.png';

const allLinks = [
  { label: 'Ana Sayfa', path: '/', end: true },
  { label: 'Hizmetler', path: '/services', end: false },
  { label: 'Atölye', path: '/atelier', end: false },
  { label: 'Galeri', path: '/gallery', end: false },
  { label: 'Blog', path: '/blog', end: false },
  { label: 'Randevu', path: '/appointment', end: false },
];

function navLinkClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'public-nav-link active' : 'public-nav-link';
}

export function PublicNavbar() {
  return (
    <header className="public-navbar">
      {/* Centered brand / logo */}
      <NavLink className="public-brand-center" to="/" aria-label="Erdal Güda ana sayfa">
        <span className="public-logo-frame">
          <img src={logo} alt="Erdal Güda" />
        </span>
      </NavLink>

      {/* All nav links in a single centered row */}
      <nav className="public-nav-links" aria-label="Site navigasyonu">
        {allLinks.map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            end={link.end}
            className={navLinkClass}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
