import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { PublicLayout } from '../layouts/PublicLayout';
import { VipLayout } from '../layouts/VipLayout';
import { VipDashboard } from '../pages/vip/VipDashboard';
import { VipOrderFlow } from '../pages/vip/VipOrderFlow';
import { ChangePasswordPage } from '../pages/admin/ChangePasswordPage';
import { LoginPage } from '../pages/admin/LoginPage';
import { UsersPage } from '../pages/admin/UsersPage';
import { AppointmentsPage } from '../pages/AppointmentsPage';
import { CustomersPage } from '../pages/CustomersPage';
import { DashboardPage } from '../pages/DashboardPage';
import { ExpressRegistrationPage } from '../pages/ExpressRegistrationPage';
import { FabricManagementPage } from '../pages/FabricManagementPage';
import { FabricsPage } from '../pages/FabricsPage';
import { MeasurementsPage } from '../pages/MeasurementsPage';
import { OrdersPage } from '../pages/OrdersPage';
import { PatternsPage } from '../pages/PatternsPage';
import { PaymentsPage } from '../pages/PaymentsPage';
import { SettingsPage } from '../pages/SettingsPage';
import { WorkflowPage } from '../pages/WorkflowPage';
import { AppointmentPage } from '../pages/public/AppointmentPage';
import { AtelierPage } from '../pages/public/AtelierPage';
import { BlogDetailPage } from '../pages/public/BlogDetailPage';
import { BlogPage } from '../pages/public/BlogPage';
import { GalleryPage } from '../pages/public/GalleryPage';
import { HomePage } from '../pages/public/HomePage';
import { FabricScanPage, OrderScanPage } from '../pages/public/ScanPage';
import { ServicesPage } from '../pages/public/ServicesPage';
import { ProtectedRoute } from './ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'services', element: <ServicesPage /> },
      { path: 'atelier', element: <AtelierPage /> },
      { path: 'gallery', element: <GalleryPage /> },
      { path: 'appointment', element: <AppointmentPage /> },
      { path: 'blog', element: <BlogPage /> },
      { path: 'blog/:slug', element: <BlogDetailPage /> },
    ],
  },
  { path: '/admin/login', element: <LoginPage /> },
  {
    path: '/admin',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { index: true, element: <Navigate to="/admin/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'workflow', element: <WorkflowPage /> },
          { path: 'change-password', element: <ChangePasswordPage /> },
          {
            element: <ProtectedRoute allowedUsernames={['erdal.guda', 'ufuk.bas']} />,
            children: [
              { path: 'express-registration', element: <ExpressRegistrationPage /> },
            ],
          },
          {
            element: <ProtectedRoute roles={['ADMIN', 'SALES']} />,
            children: [
              { path: 'customers', element: <CustomersPage /> },
              { path: 'measurements', element: <MeasurementsPage /> },
              { path: 'orders', element: <OrdersPage /> },
              { path: 'appointments', element: <AppointmentsPage /> },
            ],
          },
          {
            element: <ProtectedRoute roles={['ADMIN']} />,
            children: [
              { path: 'fabrics', element: <FabricsPage /> },
              { path: 'fabric-management', element: <FabricManagementPage /> },
              { path: 'payments', element: <PaymentsPage /> },
              { path: 'patterns', element: <PatternsPage /> },
              { path: 'settings', element: <SettingsPage /> },
              { path: 'users', element: <UsersPage /> },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '/vip',
    element: <ProtectedRoute roles={['VIP_CUSTOMER']} />,
    children: [
      {
        element: <VipLayout />,
        children: [
          { index: true, element: <VipDashboard /> },
          { path: 'new-order', element: <VipOrderFlow /> },
        ],
      },
    ],
  },
  { path: '/scan/order/:orderNumber', element: <OrderScanPage /> },
  { path: '/scan/fabric/:fabricId', element: <FabricScanPage /> },
  { path: '/dashboard', element: <Navigate to="/admin/dashboard" replace /> },
  { path: '/workflow', element: <Navigate to="/admin/workflow" replace /> },
  { path: '/express-registration', element: <Navigate to="/admin/express-registration" replace /> },
  { path: '/customers', element: <Navigate to="/admin/customers" replace /> },
  { path: '/measurements', element: <Navigate to="/admin/measurements" replace /> },
  { path: '/orders', element: <Navigate to="/admin/orders" replace /> },
  { path: '/fabrics', element: <Navigate to="/admin/fabrics" replace /> },
  { path: '/fabric-management', element: <Navigate to="/admin/fabric-management" replace /> },
  { path: '/appointments', element: <Navigate to="/admin/appointments" replace /> },
  { path: '/payments', element: <Navigate to="/admin/payments" replace /> },
  { path: '/patterns', element: <Navigate to="/admin/patterns" replace /> },
  { path: '/settings', element: <Navigate to="/admin/settings" replace /> },
  { path: '/change-password', element: <Navigate to="/admin/change-password" replace /> },
  { path: '/users', element: <Navigate to="/admin/users" replace /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
