import { Link } from 'react-router-dom';
import logoWordmark from '@/assets/Union.svg';

/** Brand lockup at the top of every menu/header: just the wordmark, shown when
 *  the menu is closed (replacing the burger/menu icon). */
export default function Logo({ to = '/', variant = 'dark', showText = true, className = '' }) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 rounded-control focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${className}`}
      aria-label="PowerGuide - home"
    >
      {showText ? (
        <img
          src={logoWordmark}
          alt=""
          className="shrink-0"
          style={{ height: '28px', width: 'auto', maxWidth: '100%' }}
          aria-hidden="true"
        />
      ) : null}
    </Link>
  );
}
