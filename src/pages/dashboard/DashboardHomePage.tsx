import { useAuth } from '../../features/auth/AuthContext';
import './dashboard.css';

/**
 * Deliberately minimal. Batch 1 only needs to prove the auth/session wiring
 * (ProtectedRoute, sign-out) end-to-end; project CRUD, the wizard, and the
 * real dashboard UI are Batch 2 per docs/image-to-3d-ar-plan.md.
 */
export default function DashboardHomePage() {
  const { user, signOut } = useAuth();

  return (
    <div className="dashboard-stub">
      <h1>Dashboard</h1>
      <p>Signed in as {user?.email}.</p>
      <p className="dashboard-stub-hint">
        Project creation, the upload wizard, and generation are implemented in
        the next batch. This page exists to verify authentication and route
        protection end-to-end.
      </p>
      <button className="dashboard-stub-button" onClick={() => void signOut()}>
        Sign out
      </button>
    </div>
  );
}
