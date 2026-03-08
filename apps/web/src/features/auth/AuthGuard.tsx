import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { useI18n } from "../../i18n/I18nProvider";

type Role = "CUSTOMER" | "EMPLOYEE" | "ADMIN";

export function AuthGuard({
  roles,
  children
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { user, isLoading } = useAuth();
  const { locale } = useI18n();
  const location = useLocation();

  if (isLoading) {
    return <div className="p-8">{locale === "pl" ? "Sprawdzanie sesji..." : "Checking session..."}</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!roles.includes(user.role)) {
    return <div className="p-8">{locale === "pl" ? "Brak dostepu" : "Forbidden"}</div>;
  }

  return <>{children}</>;
}
