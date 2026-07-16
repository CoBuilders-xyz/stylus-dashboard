import Link from 'next/link';
import {
  LayoutDashboard,
  FileCode,
  Users,
  HeartPulse,
  GitCompare,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/contracts', label: 'Contracts', icon: FileCode },
  { href: '/builders', label: 'Builders', icon: Users },
  { href: '/health', label: 'Health', icon: HeartPulse },
  { href: '/comparison', label: 'Stylus vs Solidity', icon: GitCompare },
];

export function Sidebar() {
  return (
    <aside className="hidden w-64 border-r border-border bg-card p-4 lg:block">
      <div className="mb-8">
        <h1 className="text-lg font-bold text-primary">Stylus Dashboard</h1>
        <p className="text-xs text-muted-foreground">Arbitrum MultiVM Ecosystem</p>
      </div>
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
