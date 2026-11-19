import React, { useCallback, useMemo, useState } from 'react';
import zxcvbn from 'zxcvbn';
import { Eye, EyeOff } from 'lucide-react';

type PasswordStrength = {
  score: number;
  label: string;
  color: string;
};

const STRENGTH_LEVELS: PasswordStrength[] = [
  { score: 0, label: 'Too weak', color: '#ef4444' },
  { score: 1, label: 'Weak', color: '#f97316' },
  { score: 2, label: 'Fair', color: '#eab308' },
  { score: 3, label: 'Good', color: '#84cc16' },
  { score: 4, label: 'Strong', color: '#22c55e' },
];

const REQUIREMENTS = [
  { id: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { id: 'number', label: 'Contains a number', test: (p: string) => /\d/.test(p) },
  { id: 'uppercase', label: 'Contains an uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'symbol', label: 'Contains a symbol', test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

interface PasswordCreationFormProps {
  onSubmit: (password: string) => void;
  disabled?: boolean;
}

export function PasswordCreationForm({ onSubmit, disabled }: PasswordCreationFormProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const strength = useMemo(() => {
    if (!password) return STRENGTH_LEVELS[0];
    const result = zxcvbn(password);
    return STRENGTH_LEVELS[Math.min(result.score, 4)];
  }, [password]);

  const requirementsMet = useMemo(
    () =>
      REQUIREMENTS.map((req) => ({
        ...req,
        met: req.test(password),
      })),
    [password]
  );

  const allRequirementsMet = requirementsMet.every((r) => r.met);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const showConfirmError =
    confirmTouched &&
    confirmPassword.length > 0 &&
    confirmPassword.length >= password.length &&
    !passwordsMatch;

  const isValid = allRequirementsMet && passwordsMatch && password.length > 0;

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (isValid) {
        onSubmit(password);
      }
    },
    [isValid, password, onSubmit]
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 max-w-md"
      noValidate
    >
      {/* Password field */}
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-semibold text-navy-900">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-[10px] bg-[#EEEEEE] border-0 px-4 py-3 text-base font-sans text-navy-900 focus:outline-none focus:ring-2 focus:ring-[#f18f01] transition-colors"
            aria-describedby="password-strength-text"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-navy-600 hover:text-navy-900 focus:outline-none focus:ring-2 focus:ring-[#f18f01] rounded-md transition-colors disabled:opacity-50 disabled:pointer-events-none"
            disabled={disabled}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>

        {/* Strength meter */}
        <div className="space-y-1 pt-1">
          <div className="flex gap-1">
            {[1, 2, 3, 4].map((seg) => (
              <div
                key={seg}
                className={`h-2 w-full rounded-sm transition-colors duration-200 ${
                  seg <= strength.score
                    ? `bg-[${strength.color}]`
                    : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
          <p
            id="password-strength-text"
            className={`text-sm font-semibold ${strength.color}`}
            aria-live="polite"
          >
            {strength.label}
          </p>
        </div>

        {/* Requirements checklist */}
        <div className="space-y-1 pt-1">
          {requirementsMet.map((req) => (
            <div
              key={req.id}
              className="flex items-center gap-2 text-xs"
            >
              <span
                className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center ${
                  req.met ? 'bg-[#15803D] text-white' : 'bg-gray-300'
                }`}
              >
                {req.met ? (
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                )}
              </span>
              <span className={req.met ? 'text-[#15803D] font-medium' : 'text-gray-500'}>
                {req.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Confirm Password field */}
      <div className="space-y-2">
        <label htmlFor="confirm-password" className="text-sm font-semibold text-navy-900">
          Confirm Password
        </label>
        <div className="relative">
          <input
            id="confirm-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => setConfirmTouched(true)}
            className="w-full rounded-[10px] bg-[#EEEEEE] border-0 px-4 py-3 text-base font-sans text-navy-900 focus:outline-none focus:ring-2 focus:ring-[#f18f01] transition-colors"
            aria-describedby="confirm-password-message"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-navy-600 hover:text-navy-900 focus:outline-none focus:ring-2 focus:ring-[#f18f01] rounded-md transition-colors disabled:opacity-50 disabled:pointer-events-none"
            disabled={disabled}
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>

        {/* Confirm password message */}
        {confirmPassword.length > 0 && (
          <p
            id="confirm-password-message"
            className="text-sm font-semibold"
            aria-live="polite"
          >
            {passwordsMatch ? (
              <span className="flex items-center gap-1 text-[#15803D]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
                Passwords match
              </span>
            ) : showConfirmError ? (
              <span className="flex items-center gap-1 text-[#ef4444]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Passwords don't match
              </span>
            ) : null}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!isValid || disabled}
        className="w-full rounded-[10px] bg-[#f18f01] px-4 py-3 text-base font-semibold text-[#191400] focus:outline-none focus:ring-2 focus:ring-[#f18f01] transition-colors disabled:opacity-50 disabled:pointer-events-none hover:!bg-[#f6c200]:not(:disabled)"
      >
        Create account
      </button>
    </form>
  );
}
