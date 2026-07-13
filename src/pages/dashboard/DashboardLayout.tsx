import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../../features/auth/AuthContext';
import './dashboard.css';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Overview', end: true },
  { to: '/dashboard/projects', label: 'Projects', end: false },
  { to: '/dashboard/projects/new', label: 'Create Project', end: true },
  { to: '/dashboard/generation-jobs', label: 'Generation Jobs', end: true },
  { to: '/dashboard/published', label: 'Published Experiences', end: true },
  { to: '/dashboard/settings', label: 'Account', end: true },
];

export default function DashboardLayout() {
  const { user, signOut } = useAuth();
  return (
    <div className="dash">
      <aside className="dash-nav">
        <div className="dash-brand">AR Studio</div>
        <nav aria-label="Dashboard">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                isActive ? 'dash-nav-link dash-nav-link--active' : 'dash-nav-link'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="dash-nav-footer">
          <span className="dash-user" title={user?.email ?? ''}>
            {user?.email}
          </span>
          <button className="dash-signout" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className="dash-main">
        <Outlet />
      </main>
    </div>
  );
}
