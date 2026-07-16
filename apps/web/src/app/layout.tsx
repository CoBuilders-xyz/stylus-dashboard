import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/sidebar';
import { Providers } from '@/components/providers';

export const metadata: Metadata = {
  title: 'Stylus Ecosystem Dashboard',
  description:
    'Public dashboard providing visibility into Stylus adoption across Arbitrum MultiVM stack',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen">
        <Providers>
          <Sidebar />
          <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
