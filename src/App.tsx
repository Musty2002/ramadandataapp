import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { PushNotificationProvider } from "@/components/PushNotificationProvider";
import { NetworkStatusIndicator } from "@/components/NetworkStatus";
import SplashScreen from "@/components/SplashScreen";
import { useAppReady } from "@/hooks/useAppReady";
import { AppLockGate } from "@/components/AppLockGate";
import { useNativeFeatures } from "@/hooks/useNativeFeatures";
import { useKeepAlive } from "@/hooks/useKeepAlive";
import { useCapacitorNetworkSync } from "@/hooks/useCapacitorNetworkSync";
import { isNativePlatform } from "@/hooks/usePlatform";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Check if we're in a development/preview environment (Lovable preview or localhost)
function isPreviewEnvironment(): boolean {
  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname.includes('lovable.app') ||
    hostname.includes('lovableproject.com') ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1'
  );
}

// Allow access if native platform OR in preview/development environment
function shouldAllowAccess(): boolean {
  return isNativePlatform() || isPreviewEnvironment();
}

// Pages
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Services from "./pages/Services";
import History from "./pages/History";
import Profile from "./pages/Profile";
import EditProfile from "./pages/EditProfile";
import Security from "./pages/Security";
import Support from "./pages/Support";
import Settings from "./pages/Settings";
import Referral from "./pages/Referral";
import Data from "./pages/Data";
import Airtime from "./pages/Airtime";
import Electricity from "./pages/Electricity";
import TV from "./pages/TV";
import Transfer from "./pages/Transfer";
import AddMoney from "./pages/AddMoney";
import BvnNin from "./pages/BvnNin";
import Notifications from "./pages/Notifications";
import Website from "./pages/Website";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import DeleteAccount from "./pages/DeleteAccount";
import NotFound from "./pages/NotFound";
import ExamPins from "./pages/ExamPins";
import DownloadApp from "./pages/DownloadApp";

// Admin pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminTransactions from "./pages/admin/AdminTransactions";
import AdminDataPlans from "./pages/admin/AdminDataPlans";
import AdminAirtimePlans from "./pages/admin/AdminAirtimePlans";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminNotifications from "./pages/admin/AdminNotifications";
import AdminReferrals from "./pages/admin/AdminReferrals";


// Configure QueryClient with offline-first caching
// Aggressive caching for mobile app performance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10, // 10 minutes - data stays fresh longer
      gcTime: 1000 * 60 * 60 * 24, // 24 hours - keep in cache for a full day
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false, // Don't refetch on every focus (mobile)
      refetchOnReconnect: true, // Refetch when coming back online
      refetchOnMount: false, // Use cached data on mount
      networkMode: 'offlineFirst', // Use cache first, fetch in background
    },
    mutations: {
      retry: 3,
      retryDelay: 1000,
      networkMode: 'online',
    },
  },
});

function RootRedirect() {
  const hostname = window.location.hostname.toLowerCase();
  const isAdminHost = hostname === "admin.ramadandataapp.com.ng";

  // Non-admin web users should be redirected to download app (unless in preview)
  if (!isAdminHost && !shouldAllowAccess()) {
    return <Navigate to="/download-app" replace />;
  }

  return <Navigate to={isAdminHost ? "/admin" : "/dashboard"} replace />;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // Block web access for security - redirect to download app page (unless in preview)
  if (!shouldAllowAccess()) {
    return <Navigate to="/download-app" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Wrap with AppLockGate to enforce PIN/biometric on cold start
  return <AppLockGate>{children}</AppLockGate>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // Block web access for security - redirect to download app page (unless in preview)
  if (!shouldAllowAccess()) {
    return <Navigate to="/download-app" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/download-app" element={<DownloadApp />} />
      <Route path="/website" element={<Website />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/terms-of-service" element={<TermsOfService />} />
      <Route path="/delete-account" element={<DeleteAccount />} />
      <Route
        path="/auth"
        element={
          <PublicRoute>
            <Auth />
          </PublicRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/services"
        element={
          <ProtectedRoute>
            <Services />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <History />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile/edit"
        element={
          <ProtectedRoute>
            <EditProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/security"
        element={
          <ProtectedRoute>
            <Security />
          </ProtectedRoute>
        }
      />
      <Route
        path="/support"
        element={
          <ProtectedRoute>
            <Support />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/referral"
        element={
          <ProtectedRoute>
            <Referral />
          </ProtectedRoute>
        }
      />
      <Route
        path="/data"
        element={
          <ProtectedRoute>
            <Data />
          </ProtectedRoute>
        }
      />
      <Route
        path="/airtime"
        element={
          <ProtectedRoute>
            <Airtime />
          </ProtectedRoute>
        }
      />
      <Route
        path="/electricity"
        element={
          <ProtectedRoute>
            <Electricity />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tv"
        element={
          <ProtectedRoute>
            <TV />
          </ProtectedRoute>
        }
      />
      <Route
        path="/transfer"
        element={
          <ProtectedRoute>
            <Transfer />
          </ProtectedRoute>
        }
      />
      <Route
        path="/add-money"
        element={
          <ProtectedRoute>
            <AddMoney />
          </ProtectedRoute>
        }
      />
      <Route
        path="/bvn-nin"
        element={
          <ProtectedRoute>
            <BvnNin />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exam-pins"
        element={
          <ProtectedRoute>
            <ExamPins />
          </ProtectedRoute>
        }
      />
      
      {/* Admin Routes - Separate standalone dashboard */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/users" element={<AdminUsers />} />
      <Route path="/admin/transactions" element={<AdminTransactions />} />
      <Route path="/admin/data-plans" element={<AdminDataPlans />} />
      <Route path="/admin/airtime-plans" element={<AdminAirtimePlans />} />
      <Route path="/admin/notifications" element={<AdminNotifications />} />
      <Route path="/admin/referrals" element={<AdminReferrals />} />
      <Route path="/admin/settings" element={<AdminSettings />} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function NativeWrapper({ children }: { children: React.ReactNode }) {
  // Initialize native features (keyboard handling only - network handled by TanStack Query)
  useNativeFeatures();
  
  // Sync Capacitor network/app state with TanStack Query for reliable reconnection
  useCapacitorNetworkSync(queryClient);
  
  // Keep edge functions warm to prevent cold starts (simple 4-min ping)
  useKeepAlive();
  
  return <>{children}</>;
}

const App = () => {
  const { showSplash, hasCheckedStorage, markReady } = useAppReady();
  
  // Skip splash screen for admin routes
  const isAdminRoute = window.location.pathname.startsWith('/admin');

  // Don't render anything until we've checked storage
  // This prevents flash of content before splash on native
  if (!hasCheckedStorage) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1929] via-[#0d2137] to-[#0a1929]" />
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          {showSplash && !isAdminRoute && (
            <SplashScreen onComplete={markReady} minDisplayTime={4000} />
          )}
          <BrowserRouter>
            <AuthProvider>
              <NativeWrapper>
                <PushNotificationProvider>
                  <NetworkStatusIndicator />
                  <AppRoutes />
                </PushNotificationProvider>
              </NativeWrapper>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;