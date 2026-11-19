import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { authApi, setStoredToken } from '@/api';
import { useAuth } from '@/context/AuthContext';
import { landingPathFor } from '@/utils/roles';
import { takeOauthReturnTo } from '@/utils/oauthHandoff';
import { GOOGLE_ERRORS } from './googleErrors';

// Landing page exact colors
const lp = {
  navy: '#153243',
  navyRgb: '21, 50, 67',
  or: '#f18f01',
  orRgb: '241, 143, 1',
  ink: '#153243',
  bg: '#fefeff',
};

const rgba = (rgb, alpha) => `rgba(${rgb}, ${alpha})`;

const cardStyle = {
  backgroundColor: lp.bg,
  border: `1px solid ${rgba(lp.navyRgb, 0.2)}`,
  boxShadow: '0 1px 2px rgba(16, 27, 45, 0.45), 0 4px 16px rgba(16, 27, 45, 0.35)',
};

const primaryBtnStyle = {
  backgroundColor: lp.or,
  color: lp.ink,
  boxShadow: '0 4px 4px rgba(16, 27, 45, 0.12)',
  border: 'none',
  fontWeight: 700,
  padding: '12px 24px',
  borderRadius: '8px',
};

const outlineBtnStyle = {
  backgroundColor: lp.bg,
  color: lp.navy,
  border: `1px solid ${rgba(lp.navyRgb, 0.8)}`,
  fontWeight: 700,
  padding: '12px 24px',
  borderRadius: '8px',
};

const ghostBtnStyle = {
  color: lp.or,
  backgroundColor: 'transparent',
  fontWeight: 700,
  padding: '12px 24px',
  borderRadius: '8px',
};

/**
 * Landing page for the Google OAuth round trip.
 *
 * `api/auth/google_callback.php` redirects here with the application's JWT:
 *   success -> /auth/google-callback?token=<jwt>
 *   failure -> /login?error=<code>   (handled by the login page)
 *
 * All this page does is store the token (mirrored into the `jwt_token` cookie the
 * API reads), restore the session with `me.php`, then decide where to go.
 */
export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const token = searchParams.get('token');
    const callbackError = searchParams.get('error');

    const run = async () => {
      if (callbackError) {
        setError(GOOGLE_ERRORS[callbackError] || GOOGLE_ERRORS.default);
        return;
      }
      if (!token) {
        setError(GOOGLE_ERRORS.missing_token);
        return;
      }

      authApi.storeGoogleToken(token);

      const user = await refresh();
      if (!user) {
        // The token did not produce a session - it is expired, or it belongs to an
        // account the API will not return. Drop it, or it keeps being replayed on
        // every later request and signs the user out for good.
        setStoredToken(null);
        setError(GOOGLE_ERRORS.session_failed);
        return;
      }

      // The role comes from me.php, never from the token string in the URL.
      const wanted = takeOauthReturnTo();

      // Every signed-in account goes straight to its default app: admin → /admin,
      // company staff → /company, residents → /dashboard. No app picker is shown.
      navigate(landingPathFor(user.role, wanted), { replace: true });
      return;
    };

    run();
  }, [searchParams, refresh, navigate]);

  if (error) {
    return (
      <div className="container-app flex min-h-[70vh] items-center justify-center py-10 dashboard-bg">
        <Card className="w-full max-w-md" style={cardStyle}>
          <CardBody className="text-center" style={{ color: lp.navy }}>
            <span
              className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full"
              style={{ backgroundColor: rgba(lp.orRgb, 0.1), color: lp.or }}
            >
              <TriangleAlert className="h-6 w-6" aria-hidden="true" />
            </span>
            <h1 className="mt-4 text-xl font-bold" style={{ color: lp.navy }}>Google sign-in did not finish</h1>
            <p className="mt-2 text-base" role="alert" style={{ color: rgba(lp.navyRgb, 0.6) }}>
              {error}
            </p>
            <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
              <Button
                to="/login"
                variant="primary"
                style={primaryBtnStyle}
                onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
              >
                Back to login
              </Button>
              <Link
                to="/login"
                style={{
                  ...outlineBtnStyle,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '44px',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = rgba(lp.navyRgb, 0.05);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = lp.bg;
                }}
              >
                Try again
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="container-app flex min-h-[70vh] flex-col items-center justify-center gap-3 py-10 dashboard-bg">
      <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" style={{ color: lp.or }} />
      <p className="text-base font-semibold" role="status" aria-live="polite" style={{ color: lp.navy }}>
        Finishing Google sign-in…
      </p>
      <p className="text-sm" style={{ color: rgba(lp.navyRgb, 0.5) }}>One moment while we load your account.</p>
    </div>
  );
}
