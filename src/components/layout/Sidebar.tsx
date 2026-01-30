import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, UserCircle, Settings, History, Brain, LogOut } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '@/hooks/useAuth';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: MessageSquare, label: 'Playground', path: '/playground' },
  { icon: UserCircle, label: 'Personalities', path: '/personalities' },
  { icon: Brain, label: 'Tools', path: '/tools' },
  { icon: History, label: 'Logs', path: '/logs' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside className="w-64 border-r border-border bg-card flex flex-col h-screen sticky top-0">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <span className="text-primary-foreground font-mono font-bold">G</span>
          </div>
          <span className="font-mono font-bold text-lg tracking-tight">GEMINI BOT</span>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2 rounded-md transition-colors font-mono text-sm",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )
            }
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </NavLink>
        ))}
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors font-mono text-sm text-red-500 hover:bg-red-500/10"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </nav>
      <div className="p-4 border-t border-border">
        <div className="bg-secondary/50 rounded-lg p-3">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Status</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xs font-mono font-medium">Node Active</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
