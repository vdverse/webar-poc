import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { z } from 'zod';

import { useAuth } from '../../features/auth/AuthContext';
import { SupabaseNotConfiguredNotice } from '../../features/auth/SupabaseNotConfiguredNotice';
import '../../features/auth/auth.css';

const schema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const { isConfigured, session, signInWithPassword, signInWithGoogle } = useAuth();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (!isConfigured) return <SupabaseNotConfiguredNotice />;
  if (session) {
    const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    const { error } = await signInWithPassword(values.email, values.password);
    if (error) setFormError(error);
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <h1>Sign in</h1>
        {formError && <p className="auth-form-error">{formError}</p>}

        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="auth-error">{errors.email.message}</p>}
        </div>

        <div className="auth-field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
          />
          {errors.password && <p className="auth-error">{errors.password.message}</p>}
        </div>

        <button className="auth-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>

        <button
          className="auth-button-secondary"
          type="button"
          onClick={() => void signInWithGoogle()}
        >
          Continue with Google
        </button>

        <div className="auth-links">
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/register">Create an account</Link>
        </div>
      </form>
    </div>
  );
}
