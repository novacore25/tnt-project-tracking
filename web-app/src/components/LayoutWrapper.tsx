"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { AuthProvider } from "@/providers/AuthProvider";

export function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Pages that should not display the sidebar and the margin
  const isAuthPage = !pathname || pathname === "/login" || pathname === "/pending" || pathname.startsWith("/auth") || pathname.startsWith("/portal");

  return (
    <AuthProvider>
      {!isAuthPage && <Sidebar />}
      <main className={`flex-1 min-w-0 flex flex-col h-screen overflow-y-auto bg-bg text-text`}>
        <div className={isAuthPage ? "w-full h-full" : "py-8 mx-auto w-full px-4 lg:px-8"}>
          {children}
        </div>
      </main>
    </AuthProvider>
  );
}
