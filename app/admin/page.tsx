// app/admin/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, AlertCircle } from 'lucide-react';
import PageTransition from '@/app/components/page-transitions';
import { loginAction } from '@/app/actions/auth';

declare global {
  interface Window {
    turnstile: {
      render: (element: string | HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      getResponse: (widgetId?: string) => string;
    };
  }
}

export default function AdminLogin() {
  const router = useRouter();
  const turnstileWidgetIdRef = useRef<string | undefined>(undefined);
  const scriptLoadedRef = useRef(false);

  // Form state
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  // Validation state
  const [fieldErrors, setFieldErrors] = useState({ username: '', password: '' });
  const [touched, setTouched] = useState({ username: false, password: false });

  // Error and CAPTCHA state
  const [errorMsg, setErrorMsg] = useState('');
  const [errorType, setErrorType] = useState<'session-expired' | 'auth' | 'captcha' | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState('');

  // Load Turnstile widget on mount
  useEffect(() => {
    // Check for session expiration in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('expired') === 'true') {
      setErrorMsg('Your session has expired. Please log in again.');
      setErrorType('session-expired');
    }

    // Load Cloudflare Turnstile script only once
    if (scriptLoadedRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      // Script loaded; render widget when DOM is ready
      const renderWidget = () => {
        const container = document.getElementById('captcha-container');
        if (container && window.turnstile) {
          // Render explicit widget
          const widgetId = window.turnstile.render('#captcha-container', {
            sitekey: process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY,
            theme: 'light',
            callback: handleCaptchaSuccess,
            'expired-callback': handleCaptchaExpire,
            'error-callback': handleCaptchaError,
            size: 'normal',
          });
          turnstileWidgetIdRef.current = widgetId;
        }
      };

      // Use requestAnimationFrame to ensure DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderWidget);
      } else {
        renderWidget();
      }
    };

    document.head.appendChild(script);
    scriptLoadedRef.current = true;

    return () => {
      // Cleanup: remove Turnstile widget on unmount
      if (turnstileWidgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(turnstileWidgetIdRef.current);
        } catch (e) {
          // Widget may have already been removed
        }
      }
    };
  }, []);

  // Helper: Extract description from redundant auth error
  const getAuthErrorDescription = (error: string): string => {
    if (error.startsWith('Unable to sign in. ')) {
      return error.replace('Unable to sign in. ', '');
    }
    return error;
  };

  // CAPTCHA callbacks
  const handleCaptchaSuccess = (token: string) => {
    setCaptchaToken(token);
    setCaptchaError('');
    // Clear old CAPTCHA-related errors from previous attempt
    if (errorType === 'captcha') {
      setErrorMsg('');
      setErrorType(null);
    }
  };

  const handleCaptchaExpire = () => {
    setCaptchaToken(null);
    setCaptchaError('');
  };

  const handleCaptchaError = (errorCode: string) => {
    setCaptchaToken(null);
    setCaptchaError('Verification failed. Please try again.');
    console.warn(`[CAPTCHA] Error: ${errorCode}`);
  };

  // Field validation
  const validateField = (name: 'username' | 'password', value: string): string => {
    if (name === 'username') {
      if (!value.trim()) return 'Username is required.';
    } else if (name === 'password') {
      if (!value) return 'Password is required.';
    }
    return '';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target as HTMLInputElement & { name: 'username' | 'password' };
    setFormData({ ...formData, [name]: value });

    // Clear auth/captcha errors when user corrects input
    if (errorType === 'auth' || errorType === 'captcha') {
      setErrorMsg('');
      setErrorType(null);
    }

    // Clear field error if field was touched and now has valid content
    if (touched[name]) {
      const error = validateField(name, value);
      setFieldErrors({ ...fieldErrors, [name]: error });
    }
  };

  const handleFieldBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target as HTMLInputElement & { name: 'username' | 'password' };
    setTouched({ ...touched, [name]: true });
    const error = validateField(name, value);
    setFieldErrors({ ...fieldErrors, [name]: error });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all fields
    const usernameError = validateField('username', formData.username);
    const passwordError = validateField('password', formData.password);

    setFieldErrors({ username: usernameError, password: passwordError });
    setTouched({ username: true, password: true });

    if (usernameError || passwordError) {
      return;
    }

    // Check CAPTCHA
    if (!captchaToken) {
      setCaptchaError('Please complete the verification.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');
    setErrorType(null);

    try {
      const formDataObj = new FormData();
      formDataObj.append('username', formData.username);
      formDataObj.append('password', formData.password);
      formDataObj.append('captchaToken', captchaToken);

      const result = await loginAction(formDataObj);

      if (result?.error) {
        // Server-side error (could be CAPTCHA or credentials)
        setErrorMsg(result.error);
        setErrorType('auth');
        setIsLoading(false);

        // Reset CAPTCHA widget for retry
        if (turnstileWidgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.reset(turnstileWidgetIdRef.current);
          } catch (e) {
            console.error('[CAPTCHA] Failed to reset widget:', e);
          }
        }
        setCaptchaToken(null);
      } else if (result?.success) {
        // Successful login
        window.history.replaceState(null, '', '/admin');
        router.push('/admin/dashboard');
      } else {
        // Unexpected response
        setErrorMsg('Unexpected response from server.');
        setErrorType('auth');
        setIsLoading(false);
      }
    } catch (err: any) {
      console.error('[LOGIN] Error:', err);
      setErrorMsg('Server connection failed. Please check the VS Code terminal for compilation errors.');
      setErrorType('auth');
      setIsLoading(false);
    }
  };

  const siteKey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY;
  const hasConfiguredTurnstile = siteKey && siteKey.trim().length > 0;

  const canSubmit =
    formData.username.trim().length > 0 &&
    formData.password.trim().length > 0 &&
    Boolean(captchaToken) &&
    hasConfiguredTurnstile &&
    !isLoading;

  return (
    <PageTransition>
      <div className="relative min-h-screen w-full flex items-center justify-center font-sans selection:bg-brand-blue selection:text-white px-4 sm:px-6 lg:px-8 overflow-hidden">

        <video autoPlay loop muted playsInline className="absolute inset-0 w-full h-full object-cover z-0">
          <source src="/images/admin_bg.mp4" type="video/mp4" />
        </video>

        <div className="absolute inset-0 z-0 backdrop-blur-[3px]" />

        <div className="max-w-md w-full relative z-10">
          <div className="bg-white py-10 px-6 shadow-2xl rounded-2xl border border-white/20 sm:px-10 relative">

            <Link href="/" className="absolute top-6 left-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-brand-blue transition-colors outline-none">
              <ArrowLeft size={16} /> Back
            </Link>

            <div className="text-center mt-6">
              <Image src="/images/admin/GoldenTopperlogo.svg" alt="Golden Topper" width={180} height={50} className="mx-auto drop-shadow-sm" />
              <h2 className="mt-6 text-2xl font-serif text-brand-blue tracking-tight">Admin Portal</h2>
              <p className="mt-2 text-sm text-gray-500">Sign in to access the management dashboard</p>
            </div>

            <form onSubmit={handleLogin} noValidate className="space-y-6 mt-8">

              {/* Session Expired Alert */}
              {errorType === 'session-expired' && (
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 flex gap-3">
                  <AlertCircle size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-700">{errorMsg}</p>
                </div>
              )}

              {/* Authentication Error Alert */}
              {(errorType === 'auth' || errorType === 'captcha') && errorMsg && (
                <div className="bg-red-50 p-4 rounded-lg border border-red-200 flex gap-3">
                  <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">Unable to sign in</p>
                    <p className="text-sm text-red-600 mt-0.5">{getAuthErrorDescription(errorMsg)}</p>
                  </div>
                </div>
              )}

              {/* Username Field */}
              <div>
                <label htmlFor="username" className="block text-sm font-semibold text-brand-blue mb-1.5">Username</label>
                <input
                  type="text"
                  name="username"
                  id="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  onBlur={handleFieldBlur}
                  aria-invalid={!!fieldErrors.username}
                  aria-describedby={fieldErrors.username ? 'username-error' : undefined}
                  className={`appearance-none bg-white block w-full px-4 py-3 rounded-lg shadow-sm placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:border-brand-blue sm:text-sm transition-colors ${
                    fieldErrors.username
                      ? 'border-2 border-red-500 focus:ring-red-500'
                      : 'border border-gray-300 focus:ring-brand-blue'
                  }`}
                  placeholder="Enter your username"
                />
                {fieldErrors.username && (
                  <p id="username-error" className="text-sm text-red-600 mt-2 flex items-center gap-1">
                    <AlertCircle size={14} />
                    {fieldErrors.username}
                  </p>
                )}
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-brand-blue mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    id="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    onBlur={handleFieldBlur}
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                    className={`appearance-none bg-white block w-full px-4 py-3 rounded-lg shadow-sm placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:border-brand-blue sm:text-sm transition-colors pr-12 ${
                      fieldErrors.password
                        ? 'border-2 border-red-500 focus:ring-red-500'
                        : 'border border-gray-300 focus:ring-brand-blue'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-blue transition-colors outline-none"
                  >
                    {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="password-error" className="text-sm text-red-600 mt-2 flex items-center gap-1">
                    <AlertCircle size={14} />
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              {/* Cloudflare Turnstile Widget */}
              {hasConfiguredTurnstile ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex justify-center w-full">
                    <div id="captcha-container" />
                  </div>
                  {captchaError && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle size={14} />
                      {captchaError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    ⚠️ Turnstile not configured. Add <code className="font-mono text-xs">NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY</code> to .env.local
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className={`w-full flex justify-center py-3.5 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold tracking-wider uppercase text-white transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-brand-blue ${
                    canSubmit
                      ? 'bg-brand-blue hover:bg-blue-700 active:bg-blue-800 cursor-pointer'
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isLoading ? 'Authenticating...' : 'Sign In'}
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}