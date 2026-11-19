import { Link, Outlet } from 'react-router-dom';
import logoWordmark from '@/assets/Union.svg';

/**
 * Auth layout matching the provided auth.css design:
 * - left side: logo + brand message + copyright (dark navy)
 * - right panel: card (child route renders header + form inside it)
 * - no header / no footer
 */
export default function AuthLayout() {
  return (
    <div className="auth-shell">
      <aside className="auth-side" role="complementary" aria-label="PowerGuide brand">
        <Link to="/" className="logo" aria-label="PowerGuide - Home">
          <img
            src={logoWordmark}
            alt=""
            className="shrink-0"
            style={{ height: '28px', width: 'auto', maxWidth: '100%' }}
            aria-hidden="true"
          />
        </Link>
        <h2 className="text-justify">Know Before your Lights goes <em>Out</em></h2>
        <p className="text-justify">With the <em>right information</em> at the <em>right time</em>, you can make <em>smarter decisions</em> and face every blackout with <em>greater confidence</em>.</p>
        <small>© 2026 PowerGuide. Team META. All Rights Reserved.</small>
      </aside>

      <main className="auth-panel" role="main">
        <div className="auth-card">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
