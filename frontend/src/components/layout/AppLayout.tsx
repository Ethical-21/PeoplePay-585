/**
 * PeoplePay585 — App Layout
 * Main layout wrapper with top navbar and full-width content area.
 */

import { Outlet } from 'react-router-dom';
import TopNavbar from './TopNavbar';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <TopNavbar />
      <main className="min-h-[calc(100vh-56px)]">
        <div className="p-6 max-w-[1400px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
