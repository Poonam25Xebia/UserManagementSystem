import { useEffect, useState } from "react";
import { getCurrentUser } from "./api-client";
import { getSessionToken } from "./session";
import type { UserProfileResponse } from "../types/profile.types";

export function useCurrentUser() {
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = getSessionToken();

    if (!token) {
      setLoading(false);
      return;
    }

    getCurrentUser(token).then((result) => {
      if (cancelled) return;
      if (result.ok) setProfile(result.data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { profile, loading };
}
