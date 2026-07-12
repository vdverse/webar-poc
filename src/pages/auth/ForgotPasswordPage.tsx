import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { z } from 'zod';

import { useAuth } from '../../features/auth/AuthContext';
import { SupabaseNotConfiguredNotice } from '../../features/auth/SupabaseNotConfiguredNotice';
import '../../features/auth/auth.css';

const schema = z.object({ email: z.string().email('Enter a valid email address.') });
type FormValues = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const { isConfigured, requestPasswordReset } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (!isConfigured) return <SupabaseNotConfiguredNotice />;

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    const { error } = await requestPasswordReset(values.email);
    // Deliberately show the same success state whether or not the email is
    // registered, so this form can't be used to enumerate accounts.
    if (error) setFormError(error);
    else setSent(true);
  };

  if (sent) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Check your email</h1>
          <p className="auth-success">
            If an account exists for that address, a password reset link is on its way.
          </p>
          <Link to="/login">Back to sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <h1>Reset your password</h1>
        <p>Enter your email and we'll send you a reset link.</p>
        {formError && <p className="auth-form-error">{formError}</p>}

        <div className="auth-field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p className="auth-error">{errors.email.message}</p>}
        </div>

        <button className="auth-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </button>

        <div className="auth-links">
          <Link to="/login">Back to sign in</Link>
        </div>
      </form>
    </div>
  );
}
