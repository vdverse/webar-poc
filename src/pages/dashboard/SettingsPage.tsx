import { useAuth } from '../../features/auth/AuthContext';

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  return (
    <div>
      <h1 className="dash-page-title">Account</h1>
      <p className="dash-page-sub">Your account details.</p>
      <dl className="review-summary">
        <div className="review-row">
          <dt>Email</dt>
          <dd>{user?.email}</dd>
        </div>
        <div className="review-row">
          <dt>Email verified</dt>
          <dd>{user?.email_confirmed_at ? 'Yes' : 'Not yet — check your inbox'}</dd>
        </div>
        <div className="review-row">
          <dt>Plan</dt>
          <dd>Free</dd>
        </div>
      </dl>
      <div className="wizard-actions">
        <button className="dash-button-secondary" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
