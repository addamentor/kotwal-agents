import { NavLink } from 'react-router-dom';
import { Bot, Compass, LayoutGrid, LogOut, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';

const NAV = [
  { to: '/', label: 'My Agents', icon: LayoutGrid, end: true },
  { to: '/catalog', label: 'Shared Catalog', icon: Compass, end: false },
];

// Link back to the main chat app. Overridable via env for each environment.
const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined) || 'https://app.aikotwal.com';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const initials = (user?.email || 'U').charAt(0).toUpperCase();

  return (
    <aside className="w-64 shrink-0 bg-sidebar h-full border-r border-sidebar-border flex flex-col">
      <div className="px-5 py-4 border-b border-sidebar-border flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Bot className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.32em] text-muted-foreground font-semibold">Kotwal</p>
          <p className="text-sm font-semibold leading-tight truncate">Agents</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => cn(
              'w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3 space-y-2">
        <a
          href={APP_URL}
          className="flex items-center justify-between rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition-colors"
        >
          <span>Open Chat App</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">{initials}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{user?.email || 'User'}</p>
            <p className="truncate text-[10px] text-muted-foreground">{user?.role || 'member'}</p>
          </div>
        </div>
        <button
          onClick={() => void logout()}
          className="w-full flex items-center justify-between rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
        >
          <span>Logout</span>
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
