import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate } from 'react-router-dom';
import { z } from 'zod';

import { useAuth } from '../../features/auth/AuthContext';
import { SupabaseNotConfiguredNotice } from '../../features/auth/SupabaseNotConfiguredNotice';
import '../../features/auth/auth.css';

const schema = z
  .object({
    email: z.string().email('Enter a valid email address.'),
    password: z.string().min(8, 'Password must be at least 8 characters.'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const { isConfigured, session, signUpWithPassword, signInWithGoogle } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (!isConfigured) return <SupabaseNotConfiguredNotice />;
  if (session) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    const { error } = await signUpWithPassword(values.email, values.password);
    if (error) {
      setFormError(error);
    } else {
      setConfirmationSent(true);
    }
  };

  if (confirmationSent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Check your email</h1>
          <p className="auth-success">
            We sent a confirmation link. Follow it to activate your account, then sign in.
          </p>
          <Link to="/login">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <h1>Create an account</h1>
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
            autoComplete="new-password"
            {...register('password')}
          />
          {errors.password && <p className="auth-error">{errors.password.message}</p>}
        </div>

        <div className="auth-field">
          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && (
            <p className="auth-error">{errors.confirmPassword.message}</p>
          )}
        </div>

        <button className="auth-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </button>

        <button
          className="auth-button-secondary"
          type="button"
          onClick={() => void signInWithGoogle()}
        >
          Continue with Google
        </button>

        <div className="auth-links">
          <span />
          <Link to="/login">Already have an account?</Link>
        </div>
      </form>
    </div>
  );
}
