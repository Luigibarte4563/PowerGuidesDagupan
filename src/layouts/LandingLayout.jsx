import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

/** Minimal layout for the landing page - no header/footer (they're in the page itself). Forces light theme. */
export default function LandingLayout() {
  const location = useLocation();

  useEffect(() => {
    // Force light theme for landing page
    const root = document.documentElement;
    root.dataset.theme = 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#fefeff');
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[12px] focus:bg-[#153243] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">
        Skip to main content
      </a>
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}