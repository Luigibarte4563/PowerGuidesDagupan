import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { landingPathFor, roleLabel } from '@/utils/roles';
import { Spinner } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';

/**
 * Keeps signed-in users out of login/register and remembers the target page.
 *
 * The landing path is role-aware (`landingPathFor`), not a hard-coded `/dashboard`:
 * an electric_company account that is bounced to /login - by RequireRole, by an expired
 * session, or by hitting Back - must come back to /company. `landingPathFor` also
 * validates `from`, so a stale target the role cannot reach is discarded instead of
 * bouncing the user into a redirect loop.
 *
 * A signed-in visitor is NOT teleported to their home any more: that made /login look
 * broken ("logging in as another user sent me to /admin") because the bounce happened
 * before the form could appear. Instead they get a choice - continue to their own app,
 * or sign out, which reveals the login form underneath.
 */
export default function PublicOnlyRoute() {
  const { isAuthenticated, isLoading, role, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const from = location.state?.from;

  // Landing page exact colors (RGB for opacity calculations)
  // --navy: #153243 = rgb(21, 50, 67)
  // --or: #f18f01 = rgb(241, 143, 1)
  // --ink (text): #153243 = rgb(21, 50, 67)
  // --bg: #fefeff = rgb(254, 254, 255)
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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center dashboard-bg">
        <Spinner className="h-8 w-8" style={{ color: lp.or }} />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 dashboard-bg">
        <Card className="w-full max-w-md bg-solid" style={cardStyle}>
          <CardBody className="text-center" style={{ color: lp.navy }}>
            <h1 className="text-xl font-bold" style={{ color: lp.navy }}>
              You are already signed in
            </h1>
            <p className="mt-3 text-base leading-relaxed" style={{ color: rgba(lp.navyRgb, 0.6) }}>
              Signed in as{' '}
              <span className="font-semibold" style={{ color: lp.navy }}>{user?.name || 'a user'}</span> (
              <span className="font-medium" style={{ color: lp.navy }}>{roleLabel(role)}</span>).{' '}
              Continue to your app, or sign out to use a different account.
            </p>

            <div className="mt-6 grid gap-3">
              <Button
                size="lg"
                fullWidth
                onClick={() => navigate(landingPathFor(role, from), { replace: true })}
                style={{
                  backgroundColor: lp.or,
                  color: lp.ink,
                  boxShadow: '0 4px 4px rgba(16, 27, 45, 0.12)',
                  border: 'none',
                  fontWeight: 700,
                  padding: '12px 24px',
                  borderRadius: '8px',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.08)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = 'none'; }}
              >
                Continue as {user?.firstName || 'this user'}
              </Button>
              <Button
                size="lg"
                fullWidth
                variant="outline"
                loading={signingOut}
                onClick={async () => {
                  setSigningOut(true);
                  try {
                    await logout();
                  } finally {
                    setSigningOut(false);
                  }
                }}
                style={{
                  backgroundColor: lp.bg,
                  color: lp.navy,
                  border: `1px solid ${rgba(lp.navyRgb, 0.8)}`,
                  fontWeight: 700,
                  padding: '12px 24px',
                  borderRadius: '8px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = rgba(lp.navyRgb, 0.05);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = lp.bg;
                }}
              >
                Use a different account
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  return <Outlet />;
}