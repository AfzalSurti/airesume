import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, Briefcase, Users, Search, Sparkles, LogOut } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { ThemeToggle } from './ThemeToggle'
import { Avatar } from './Avatar'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/candidates', label: 'Candidates', icon: Users },
  { to: '/matching', label: 'JD Search', icon: Search },
]

export function Layout() {
  const { user, logout } = useAuth()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Sparkles size={17} />
          </div>
          <span className="brand-name">AI Recruiter</span>
        </div>

        <nav className="nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <ThemeToggle className="btn-block" />
          <div className="user-row">
            <Avatar name={user?.name} />
            <div>
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{user?.role}</div>
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-block" onClick={logout}>
            <LogOut size={15} />
            Log out
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
