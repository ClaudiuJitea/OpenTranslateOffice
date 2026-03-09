import { createBrowserRouter } from "react-router-dom";
import { AdminSettingsPage } from "../features/admin/AdminSettingsPage";
import { AdminWorkCalendarPage } from "../features/admin/AdminWorkCalendarPage";
import { AuthGuard } from "../features/auth/AuthGuard";
import { LoginPage } from "../features/auth/LoginPage";
import { CallRequestPage } from "../features/calls/CallRequestPage";
import { StaffCallRequestsPage } from "../features/calls/StaffCallRequestsPage";
import { DashboardWorkbenchPage } from "../features/dashboard/DashboardWorkbenchPage";
import { LandingPage } from "../features/landing/LandingPage";
import { IntakeSessionPage } from "../features/intake/IntakeSessionPage";
import { PortalLoginPage } from "../features/portal/PortalLoginPage";
import { PortalRequestPage } from "../features/portal/PortalRequestPage";
import { RequestSubmissionPage } from "../features/intake/RequestSubmissionPage";
import { AppShell } from "./layout/AppShell";

export const router = createBrowserRouter(
  [
    {
      path: "/",
      element: (
        <AppShell>
          <LandingPage />
        </AppShell>
      )
    },
    {
      path: "/request",
      element: (
        <AppShell>
          <RequestSubmissionPage />
        </AppShell>
      )
    },
    {
      path: "/request-call",
      element: (
        <AppShell>
          <CallRequestPage />
        </AppShell>
      )
    },
    {
      path: "/login",
      element: (
        <AppShell>
          <LoginPage />
        </AppShell>
      )
    },
    {
      path: "/intake/chat",
      element: (
        <AppShell>
          <IntakeSessionPage />
        </AppShell>
      )
    },
    {
      path: "/intake/:sessionId",
      element: (
        <AppShell>
          <IntakeSessionPage />
        </AppShell>
      )
    },
    {
      path: "/portal/login",
      element: (
        <AppShell>
          <PortalLoginPage />
        </AppShell>
      )
    },
    {
      path: "/portal/request",
      element: (
        <AppShell>
          <PortalRequestPage />
        </AppShell>
      )
    },
    {
      path: "/dashboard",
      element: (
        <AuthGuard roles={["EMPLOYEE", "ADMIN"]}>
          <AppShell>
            <DashboardWorkbenchPage />
          </AppShell>
        </AuthGuard>
      )
    },
    {
      path: "/calls",
      element: (
        <AuthGuard roles={["EMPLOYEE", "ADMIN"]}>
          <AppShell>
            <StaffCallRequestsPage />
          </AppShell>
        </AuthGuard>
      )
    },
    {
      path: "/admin",
      element: (
        <AuthGuard roles={["ADMIN"]}>
          <AppShell>
            <AdminSettingsPage />
          </AppShell>
        </AuthGuard>
      )
    },
    {
      path: "/admin/calendar",
      element: (
        <AuthGuard roles={["ADMIN"]}>
          <AppShell>
            <AdminWorkCalendarPage />
          </AppShell>
        </AuthGuard>
      )
    }
  ],
  {
    future: {
      v7_startTransition: true
    } as any
  }
);
