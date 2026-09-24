"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useDatabaseStore } from "@/store/useDatabaseStore";

export function DataLoader() {
  const pathname = usePathname();
  const isExcluded = !pathname || pathname === "/login" || pathname === "/pending" || pathname.startsWith("/auth") || pathname.startsWith("/portal");
  const { fetchData } = useDatabaseStore();
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!isExcluded && !hasFetched.current) {
      fetchData().catch(() => {});
      hasFetched.current = true;
    }
  }, [isExcluded, fetchData]);

  return null;
}
