import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useAuth } from '@/context/AuthContext';
import { navItemsForRole } from '@/routes/navItems';
import { useSavedLocation } from '@/hooks/useSavedLocation';
import { ROLE } from '@/utils/roles';
import LocationSetupModal from '@/components/dashboard/LocationSetupModal';

/**
 * Full-height, dark map workspaces (the Outages layout family). These pages
 * render edge-to-edge with no padded container; every other page keeps the
 * standard padded `max-w-7xl` column inside the same shell. Detail routes
 * (`/dashboard/outages/:id`, ...) stay in the padded column.
 */
const WORKSPACE_PATHS = new Set([
  '/dashboard/outages',
  '/dashboard/hazards',
  '/dashboard/floods',
  '/dashboard/heatmap',
  '/dashboard/maintenance',
  '/dashboard/power-stations',
  '/dashboard/risk-areas',
]);

/** Dashboard chrome: persistent sidebar + top bar with the routed page inside. */
export default function DashboardLayout() {
  const { role, refresh } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { location: savedLocation, isLoading, hasLocation } = useSavedLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const isWorkspace = WORKSPACE_PATHS.has(location.pathname);
  const isResident = role === ROLE.USER;
  const needsLocationSetup = isResident && !isLoading && !hasLocation;
  const [showLocationModal, setShowLocationModal] = useState(needsLocationSetup);

  // Keep modal state in sync with location data
  useEffect(() => {
    if (!isLoading) {
      setShowLocationModal(isResident && !hasLocation);
    }
  }, [isLoading, isResident, hasLocation]);

  const handleLocationSaved = () => {
    setShowLocationModal(false);
    refresh(); // Refresh user data to get updated location
  };

  // Prevent access to dashboard pages until location is set for residents
  if (needsLocationSetup) {
    return (
      <div
        data-theme="dark"
        data-surface="dark"
        className="flex h-screen overflow-hidden font-montserrat text-white dashboard-bg"
      >
        <LocationSetupModal open={true} onClose={handleLocationSaved} onSkip={() => navigate('/login')} />
      </div>
    );
  }

  return (
    <div
      data-theme="dark"
      data-surface="dark"
      className="flex h-screen overflow-hidden font-montserrat text-white dashboard-bg"
    >
      <a href="#dashboard-content" className="skip-link">
        Skip to main content
      </a>

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        items={navItemsForRole(role)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenSidebar={() => setSidebarOpen(true)} />
        <main
          id="dashboard-content"
          className="min-w-0 flex-1 overflow-y-auto overscroll-contain dashboard-grid"
        >
          {isWorkspace ? (
            <Outlet context={{ openSidebar: () => setSidebarOpen(true) }} />
          ) : (
            <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              <Outlet />
            </div>
          )}
        </main>
      </div>

      {showLocationModal && (
        <LocationSetupModal open={true} onClose={handleLocationSaved} onSkip={() => navigate('/login')} />
      )}
    </div>
  );
}
