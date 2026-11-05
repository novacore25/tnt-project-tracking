"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useDatabaseStore } from "@/store/useDatabaseStore";
import { useAuth } from "@/providers/AuthProvider";

export function DataLoader() {
  const pathname = usePathname();
  const isExcluded = !pathname || pathname === "/login" || pathname === "/pending" || pathname.startsWith("/auth") || pathname.startsWith("/portal");
  const { profile, isLoading } = useAuth();
  const { fetchData } = useDatabaseStore();
  const hasFetched = useRef(false);

  useEffect(() => {
    // Keamanan ketat: HANYA fetch data ke database jika user sudah disetujui ('approved')
    if (!isExcluded && !isLoading && profile && profile.status === 'approved' && !hasFetched.current) {
      fetchData().catch(() => {});
      hasFetched.current = true;
    }
  }, [isExcluded, isLoading, profile, fetchData]);

  return null;
}
