import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import logoWordmark from '@/assets/Union.svg';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#faq', label: 'FAQs' },
  { href: '#contact', label: 'Contact' },
];

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = () => setMenuOpen((open) => !open);
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`nav sticky top-0 z-50 h-20 bg-[#153243] shadow-[0_4px_4px_rgba(239,230,221,0.04)] ${menuOpen ? 'open' : ''}`} role="banner">
      <div className="wrap mx-auto max-w-[1240px] px-[clamp(20px,6.94vw,100px)] h-full grid grid-cols-[1fr_auto_1fr] items-center">
        <Link to="#top" className="logo inline-flex items-center gap-2 text-white text-[24px] font-bold no-underline" aria-label="PowerGuide - Home">
          <img
            src={logoWordmark}
            alt=""
            className="shrink-0"
            style={{ height: '28px', width: 'auto', maxWidth: '100%' }}
            aria-hidden="true"
          />
        </Link>

        <div id="menu" role="navigation" aria-label="Main navigation">
          <nav className="nav__c flex items-center gap-8" aria-label="Sections">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="font-bold text-white transition-colors pb-1 border-b-2 border-transparent hover:border-[#f18f01]"
                onClick={closeMenu}
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="nav__r flex items-center gap-8 justify-self-end">
            <Link
              to="/login"
              className="font-bold text-white transition-colors pb-1 border-b-2 border-transparent hover:border-[#f18f01]"
              onClick={closeMenu}
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="btn btn--w inline-flex items-center justify-center rounded-[8px] bg-white text-[#171818] font-bold text-[16px] leading-[1.2] px-6 py-3 border border-[#153243]/80 shadow-[0_4px_4px_rgba(0,0,0,0.1)] hover:brightness-110 transition-filter"
              onClick={closeMenu}
            >
              Create an Account
            </Link>
          </div>
        </div>

        <button
          type="button"
          className="burger inline-flex items-center justify-center bg-transparent border-0 cursor-pointer justify-self-end"
          aria-label={menuOpen ? 'Close menu' : 'Menu'}
          aria-expanded={menuOpen}
          aria-controls="menu"
          onClick={toggleMenu}
        >
          <span className="relative block" />
        </button>
      </div>
    </header>
  );
}