import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardPage } from '@/pages/DashboardPage';
import { AnnouncementsPage } from '@/pages/AnnouncementsPage';
import { NewAnnouncementPage } from '@/pages/NewAnnouncementPage';
import { UsersPage } from '@/pages/UsersPage';
import { MaintenancePage } from '@/pages/MaintenancePage';
import { NewMaintenancePage } from '@/pages/NewMaintenancePage';
import { EventsPage } from '@/pages/EventsPage';
import { NewEventPage } from '@/pages/NewEventPage';
import { PollsPage } from '@/pages/PollsPage';
import { NewPollPage } from '@/pages/NewPollPage';
import { DuesPage } from '@/pages/DuesPage';
import { NewDuesPage } from '@/pages/NewDuesPage';
import { DocumentsPage } from '@/pages/DocumentsPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { LoginPage } from '@/pages/LoginPage';
import { RegisterPage } from '@/pages/RegisterPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: <Navigate to="/resident/dashboard" replace />,
          },

          // Role-specific dashboards
          {
            path: 'resident/dashboard',
            element: <ProtectedRoute allowedRoles={['RESIDENT']} />,
            children: [{ index: true, element: <DashboardPage /> }],
          },
          {
            path: 'admin/dashboard',
            element: <ProtectedRoute allowedRoles={['ADMIN']} />,
            children: [{ index: true, element: <DashboardPage /> }],
          },
          {
            path: 'board/dashboard',
            element: <ProtectedRoute allowedRoles={['BOARD_MEMBER']} />,
            children: [{ index: true, element: <DashboardPage /> }],
          },

          // Shared routes
          {
            path: 'announcements',
            element: <AnnouncementsPage />,
          },
          {
            path: 'announcements/new',
            element: <NewAnnouncementPage />,
          },
          {
            path: 'users',
            element: <ProtectedRoute allowedRoles={['ADMIN']} />,
            children: [{ index: true, element: <UsersPage /> }],
          },
          {
            path: 'maintenance',
            element: <MaintenancePage />,
          },
          {
            path: 'maintenance/new',
            element: <NewMaintenancePage />,
          },
          {
            path: 'events',
            element: <EventsPage />,
          },
          {
            path: 'events/new',
            element: <NewEventPage />,
          },
          {
            path: 'polls',
            element: <PollsPage />,
          },
          {
            path: 'polls/new',
            element: <NewPollPage />,
          },
          {
            path: 'dues',
            element: <DuesPage />,
          },
          {
            path: 'dues/new',
            element: <NewDuesPage />,
          },
          {
            path: 'documents',
            element: <DocumentsPage />,
          },
          {
            path: 'profile',
            element: <ProfilePage />,
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
