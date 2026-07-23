import { ReactNode } from 'react';
import Sidebar from './Sidebar';

/** Shell: fixed sidebar + scrollable content area. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto px-8 py-8">{children}</main>
    </div>
  );
}
