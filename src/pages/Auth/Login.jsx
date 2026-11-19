import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Eye, EyeOff, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { GOOGLE_ERRORS } from './googleErrors';
import { landingPathFor, normaliseRole, ROLE_LABELS } from '@/utils/roles';
import { toUserMessage } from '@/utils/errorMessage';
import { collectErrors, hasErrors, clearFieldError, validateEmail, validateRequired } from '@/utils/validators';
import './auth.css';

/** Phase 2 - login page (`POST /api/auth/login.php`). */
export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const googleErrorCode = new URLSearchParams(location.search).get('error');

  const successMessage = location.state?.registered
    ? 'Your account was created. Log in to start reporting.'
    : '';

  const expiredMessage = location.state?.expired
    ? 'Your session expired after a period of inactivity. Please sign in again.'
    : '';

  const staleRoleMessage = location.state?.staleRole
    ? `Your access was changed while you were signed in. Sign in again to continue as ${
        ROLE_LABELS[normaliseRole(location.state.staleRole)] || 'your updated role'
      }.`
    : '';

  const googleError = googleErrorCode ? GOOGLE_ERRORS[googleErrorCode] || GOOGLE_ERRORS.default : '';

  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const update = (field) => (event) => {
    const { value } = event.target;
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => clearFieldError(current, field));
    setFormError('');
  };

  const validate = () =>
    collectErrors({
      email: () => validateEmail(values.email, 'Email'),
      password: () => validateRequired(values.password, 'Password'),
    });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');

    const validationErrors = validate();
    if (hasErrors(validationErrors)) {
      setErrors(validationErrors);
      return;
    }

    setSubmitting(true);
    try {
      const user = await login({ email: values.email.trim(), password: values.password });
      navigate(landingPathFor(user?.role, from), { replace: true });
    } catch (error) {
      setFormError(toUserMessage(error, 'Invalid email or password.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <header>
        <Link className="auth-back" to="/">
          <svg width="14" height="12" viewBox="0 0 14 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M13 6H1M6 1 1 6l5 5" />
          </svg>
          Back
        </Link>
        <h1 className="auth-h1">Get Started Now</h1>
        <p className="auth-lead">Please log in to your account to continue</p>
      </header>

      {formError ? <div className="auth-banner">{formError}</div> : null}
      {googleError ? <div className="auth-banner">{googleError}</div> : null}
      {successMessage ? <div className="auth-banner">{successMessage}</div> : null}
      {expiredMessage ? <div className="auth-banner">{expiredMessage}</div> : null}
      {staleRoleMessage ? <div className="auth-banner">{staleRoleMessage}</div> : null}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="auth-fields">
          <div className="auth-field">
            <label>Email
              <input
                name="email"
                type="email"
                placeholder="example@gmail.com"
                autoComplete="email"
                required
                value={values.email}
                onChange={update('email')}
              />
              {errors.email && <span className="auth-field-error">{errors.email}</span>}
            </label>
          </div>
          <div className="auth-field">
            <label>Password
              <div className="auth-field-input">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••••"
                  autoComplete="current-password"
                  required
                  value={values.password}
                  onChange={update('password')}
                />
                <button
                  type="button"
                  className="auth-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff /> : <Eye />}
                </button>
              </div>
              {errors.password && <span className="auth-field-error">{errors.password}</span>}
            </label>
          </div>
        </div>

        <a className="auth-forgot" href="#" onClick={(e) => e.preventDefault()}>
          Forgot Password?
        </a>

        <p className="auth-msg" role="status" aria-live="polite"></p>

        <div className="auth-actions">
          <button className="auth-btn" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Log In'}
          </button>
          <p className="auth-alt">
            Don’t have an account?{' '}
            <Link to="/register">Sign up</Link>
          </p>
          <div className="auth-or">Or</div>
          <button className="auth-btn btn--w" type="button" onClick={() => {
            const base = `${import.meta.env.VITE_API_BASE_URL || '/backend'}/api/auth/google.php`;
            window.location.href = base;
          }}>
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.4-4.7 7.1l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.5z" />
              <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6z" />
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.9l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
            </svg>
            Continue with Google
          </button>
        </div>
      </form>

      <p className="mt-6 text-center text-xs text-navy-400">
        <Link to="/" className="rounded font-semibold text-navy-600 transition hover:text-navy-900">
          Back to the home page
        </Link>
      </p>
    </>
  );
}
