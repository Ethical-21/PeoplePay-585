/**
 * PeoplePay585 — Application Root
 * Routing, auth protection, query client setup.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import EmployeeDetailPage from './pages/EmployeeDetailPage';
import DepartmentsPage from './pages/DepartmentsPage';
import ContractsPage from './pages/ContractsPage';
import ContractDetailPage from './pages/ContractDetailPage';
import AttendancePage from './pages/AttendancePage';
import AttendanceDetailPage from './pages/AttendanceDetailPage';
import TimeOffPage from './pages/TimeOffPage';
import TimeOffRequestDetailPage from './pages/TimeOffRequestDetailPage';
import TimeOffAllocationsPage from './pages/TimeOffAllocationsPage';
import TimeOffAllocationDetailPage from './pages/TimeOffAllocationDetailPage';
import TimeOffTypesPage from './pages/TimeOffTypesPage';
import TimeOffTypeDetailPage from './pages/TimeOffTypeDetailPage';
import SalaryStructuresPage from './pages/SalaryStructuresPage';
import SalaryRulesPage from './pages/SalaryRulesPage';
import SalaryRuleDetailPage from './pages/SalaryRuleDetailPage';
import PayrunsPage from './pages/PayrunsPage';
import PayrunDetailPage from './pages/PayrunDetailPage';
import PayslipsPage from './pages/PayslipsPage';
import UserManagementPage from './pages/UserManagementPage';
import SchedulesPage from './pages/SchedulesPage';
import ScheduleDetailPage from './pages/ScheduleDetailPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

function ProtectedRoute({ children, minRole }: { children: React.ReactNode; minRole?: string }) {
  const { isAuthenticated, isLoading, isMinRole } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (minRole && !isMinRole(minRole)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-slate-900">Access Denied</h2>
          <p className="text-sm text-slate-500 mt-1">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/employees" element={<ProtectedRoute minRole="hr_manager"><EmployeesPage /></ProtectedRoute>} />
        <Route path="/employees/:id" element={<ProtectedRoute minRole="hr_manager"><EmployeeDetailPage /></ProtectedRoute>} />
        <Route path="/departments" element={<ProtectedRoute minRole="hr_manager"><DepartmentsPage /></ProtectedRoute>} />
        <Route path="/contracts" element={<ProtectedRoute minRole="employee"><ContractsPage /></ProtectedRoute>} />
        <Route path="/contracts/:id" element={<ProtectedRoute minRole="employee"><ContractDetailPage /></ProtectedRoute>} />
        <Route path="/schedules" element={<ProtectedRoute minRole="hr_manager"><SchedulesPage /></ProtectedRoute>} />
        <Route path="/schedules/new" element={<ProtectedRoute minRole="hr_manager"><ScheduleDetailPage /></ProtectedRoute>} />
        <Route path="/schedules/:id" element={<ProtectedRoute minRole="hr_manager"><ScheduleDetailPage /></ProtectedRoute>} />
        <Route path="/attendance" element={<ProtectedRoute minRole="employee"><AttendancePage /></ProtectedRoute>} />
        <Route path="/attendance/new" element={<ProtectedRoute minRole="hr_manager"><AttendanceDetailPage /></ProtectedRoute>} />
        <Route path="/attendance/:id" element={<ProtectedRoute minRole="employee"><AttendanceDetailPage /></ProtectedRoute>} />
        <Route path="/timeoff" element={<Navigate to="/timeoff/requests" replace />} />
        <Route path="/timeoff/requests" element={<TimeOffPage />} />
        <Route path="/timeoff/requests/new" element={<TimeOffRequestDetailPage />} />
        <Route path="/timeoff/requests/:id" element={<TimeOffRequestDetailPage />} />
        <Route path="/timeoff/allocations" element={<ProtectedRoute minRole="hr_manager"><TimeOffAllocationsPage /></ProtectedRoute>} />
        <Route path="/timeoff/allocations/new" element={<ProtectedRoute minRole="hr_manager"><TimeOffAllocationDetailPage /></ProtectedRoute>} />
        <Route path="/timeoff/allocations/:id" element={<ProtectedRoute minRole="hr_manager"><TimeOffAllocationDetailPage /></ProtectedRoute>} />
        <Route path="/timeoff/types" element={<ProtectedRoute minRole="hr_manager"><TimeOffTypesPage /></ProtectedRoute>} />
        <Route path="/timeoff/types/new" element={<ProtectedRoute minRole="hr_manager"><TimeOffTypeDetailPage /></ProtectedRoute>} />
        <Route path="/timeoff/types/:id" element={<ProtectedRoute minRole="hr_manager"><TimeOffTypeDetailPage /></ProtectedRoute>} />
        <Route path="/salary/structures" element={<ProtectedRoute minRole="hr_payroll_user"><SalaryStructuresPage /></ProtectedRoute>} />
        <Route path="/salary/rules" element={<ProtectedRoute minRole="hr_payroll_user"><SalaryRulesPage /></ProtectedRoute>} />
        <Route path="/salary/rules/new" element={<ProtectedRoute minRole="hr_payroll_manager"><SalaryRuleDetailPage /></ProtectedRoute>} />
        <Route path="/salary/rules/:id" element={<ProtectedRoute minRole="hr_payroll_user"><SalaryRuleDetailPage /></ProtectedRoute>} />
        <Route path="/payruns" element={<ProtectedRoute minRole="hr_payroll_user"><PayrunsPage /></ProtectedRoute>} />
        <Route path="/payruns/:id" element={<ProtectedRoute minRole="hr_payroll_user"><PayrunDetailPage /></ProtectedRoute>} />
        <Route path="/payslips" element={<PayslipsPage />} />
        <Route path="/users" element={<ProtectedRoute minRole="admin"><UserManagementPage /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { borderRadius: '10px', background: '#1e293b', color: '#fff', fontSize: '14px' },
            }}
          />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

