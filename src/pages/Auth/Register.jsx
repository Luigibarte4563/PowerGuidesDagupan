import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { AuthAlert } from '@/components/ui/Alert';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { landingPathFor } from '@/utils/roles';
import { toUserMessage } from '@/utils/errorMessage';
import { collectErrors, hasErrors, clearFieldError, validateEmail, validateMatch, validatePassword, validateRequired, passwordStrength } from '@/utils/validators';
import './auth.css';

/** Phase 2 - register page (`POST /api/auth/register.php`). */
export default function Register() {
  const { register, loginWithRegisteredAccount } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState({ firstName: '', middleName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const strength = useMemo(() => passwordStrength(values.password), [values.password]);
  const [agreed, setAgreed] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const update = (field) => (event) => {
    const { value } = event.target;
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => clearFieldError(current, field));
    setFormError('');
  };

  const validate = () =>
    collectErrors({
      firstName: () => validateRequired(values.firstName, 'First name'),
      lastName: () => validateRequired(values.lastName, 'Last name'),
      email: () => validateEmail(values.email, 'Email'),
      password: () => validatePassword(values.password),
      confirmPassword: () => validateMatch(values.confirmPassword, values.password, 'Passwords'),
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
      // Only database attributes are sent: confirmPassword is client-side only.
      const result = await register({
        firstName: values.firstName.trim(),
        middleName: values.middleName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        password: values.password,
      });

      let user = null;
      if (!result.autoLoggedIn) {
        user = await loginWithRegisteredAccount({
          email: values.email.trim(),
          password: values.password,
        });
      }
      navigate(landingPathFor(user?.role), { replace: true });
    } catch (error) {
      setFormError(toUserMessage(error, 'We could not create your account.'));
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
        <h1 className="auth-h1">Create an Account</h1>
        <p className="auth-lead">Create your account to continue</p>
      </header>

      {formError ? <AuthAlert>{formError}</AuthAlert> : null}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className="auth-fields">
          <div className="auth-field">
            <label>First Name
              <input
                name="firstName"
                placeholder="Enter your first name"
                autoComplete="given-name"
                required
                value={values.firstName}
                onChange={update('firstName')}
              />
              {errors.firstName && <span className="auth-field-error">{errors.firstName}</span>}
            </label>
          </div>
          <div className="auth-field">
            <label>Middle Name
              <input
                name="middleName"
                placeholder="Enter your middle name (optional)"
                autoComplete="additional-name"
                value={values.middleName}
                onChange={update('middleName')}
              />
            </label>
          </div>
          <div className="auth-field">
            <label>Last Name
              <input
                name="lastName"
                placeholder="Enter your last name"
                autoComplete="family-name"
                required
                value={values.lastName}
                onChange={update('lastName')}
              />
              {errors.lastName && <span className="auth-field-error">{errors.lastName}</span>}
            </label>
          </div>
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
                  autoComplete="new-password"
                  minLength={6}
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
              {values.password && (
                <div className="auth-strength">
                  <div className="auth-strength-meter">
                    {[1, 2, 3, 4].map((n) => (
                      <span
                        key={n}
                        className={`auth-strength-bar ${n <= strength.score ? `auth-strength-bar--filled auth-strength-bar--${strength.tone}` : ''}`}
                      />
                    ))}
                  </div>
                  <span className={`auth-strength-label auth-strength-label--${strength.tone}`}>
                    {strength.label}
                  </span>
                </div>
              )}
            </label>
          </div>
          <div className="auth-field">
            <label>Confirm Password
              <div className="auth-field-input">
                <input
                  name="confirm"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••••"
                  autoComplete="new-password"
                  required
                  value={values.confirmPassword}
                  onChange={update('confirmPassword')}
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
              {errors.confirmPassword && <span className="auth-field-error">{errors.confirmPassword}</span>}
              {!errors.confirmPassword && values.confirmPassword && values.confirmPassword === values.password && (
                <span className="auth-field-match">
                  Passwords match <CheckCircle2 className="auth-match-icon" aria-hidden="true" />
                </span>
              )}
            </label>
          </div>
        </div>

        <label className="auth-agree">
          <input name="terms" type="checkbox" required checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            I agree to the <a href="#" onClick={(e) => { e.preventDefault(); setTermsOpen(true); }}>Terms &amp; Privacy Policy</a>
          </span>
        </label>

        <p className="auth-msg" role="status" aria-live="polite"></p>

        <div className="auth-actions">
          <button className="auth-btn" type="submit" disabled={!agreed || submitting}>
            {submitting ? 'Creating your account…' : 'Create Account'}
          </button>
          <p className="auth-alt">
            Already have an account?{' '}
            <Link to="/login">Log In</Link>
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
            Create using Google
          </button>
        </div>
      </form>

      <TermsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        onAgree={() => {
          setAgreed(true);
          setTermsOpen(false);
        }}
      />
    </>
  );
}

/** The consent text behind the "Terms and Conditions" link on the register form. */
function TermsModal({ open, onClose, onAgree }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Terms and Conditions"
      description="PowerGuide Dagupan - community reporting service"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={onAgree}>Agree and continue</Button>
        </>
      }
    >
      <div className="space-y-4 text-sm leading-relaxed text-navy-600">
        <section>
          <h3 className="text-sm font-bold text-navy-900">1. What PowerGuide is</h3>
          <p className="mt-1">
            PowerGuide Dagupan is a crowdsourced community service for reporting and tracking power
            outages, flooding and electrical hazards. It is not an official utility or emergency
            service and does not replace official announcements from the electric company or local
            government.
          </p>
        </section>
        <section>
          <h3 className="text-sm font-bold text-navy-900">2. Your account</h3>
          <p className="mt-1">
            Register with accurate information and keep your credentials secure. You are responsible
            for all activity made through your account.
          </p>
        </section>
        <section>
          <h3 className="text-sm font-bold text-navy-900">3. Your reports</h3>
          <p className="mt-1">
            Only report incidents you have personally observed. Do not post false, misleading or
            duplicated reports. Reports may include a location, photos and a description, and may be
            verified, edited or removed by the utility company or moderators.
          </p>
        </section>
        <section>
          <h3 className="text-sm font-bold text-navy-900">4. Location and photos</h3>
          <p className="mt-1">
            Reports and alerts rely on the location you save or attach. By submitting a report you
            consent to its location, photos and details being shown to other community users and to
            the electric company for verification and response.
          </p>
        </section>
        <section>
          <h3 className="text-sm font-bold text-navy-900">5. Acceptable use</h3>
          <p className="mt-1">
            Do not use PowerGuide to harass others, post unlawful content or interfere with the
            service. Accounts that abuse the platform may be suspended.
          </p>
        </section>
        <section>
          <h3 className="text-sm font-bold text-navy-900">6. Availability and safety</h3>
          <p className="mt-1">
            The service is provided &ldquo;as is&rdquo; without a guarantee of accuracy or uptime.
            Never rely on it for life-safety decisions - keep away from downed lines and flooded
            areas and follow official emergency guidance.
          </p>
        </section>
        <section>
          <h3 className="text-sm font-bold text-navy-900">7. Changes</h3>
          <p className="mt-1">
            These terms may be updated from time to time. Continuing to use PowerGuide after a change
            means you accept the updated terms.
          </p>
        </section>
      </div>
    </Modal>
  );
}
