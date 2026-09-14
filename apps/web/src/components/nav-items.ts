import {
  LayoutDashboard,
  FileCode,
  Users,
  HeartPulse,
  GitCompare,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/contracts', label: 'Contracts', icon: FileCode },
  { href: '/builders', label: 'Builders', icon: Users },
  { href: '/health', label: 'Health', icon: HeartPulse },
  { href: '/comparison', label: 'Stylus vs Solidity', icon: GitCompare },
];
