import { Navigate, Outlet, useLocation } from "react-router";
import { getSessionToken } from "../lib/session";

export function RequireAuth() {
  const location = useLocation();
  const token = getSessionToken();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
