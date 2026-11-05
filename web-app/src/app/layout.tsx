import type { Metadata } from "next";
import "./globals.css";
import { LayoutWrapper } from "@/components/LayoutWrapper";
import { DataLoader } from "@/components/DataLoader";
import { GlobalLoadingOverlay } from "@/components/GlobalLoadingOverlay";

export const metadata: Metadata = {
  title: "TNT Campaign Management",
  description: "Internal dashboard for TNT affiliate campaigns",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@100..800&family=Plus+Jakarta+Sans:wght@200..800&display=swap" rel="stylesheet" />
      </head>
      <body className={`font-sans bg-bg text-text min-h-screen flex antialiased`}>
        <GlobalLoadingOverlay />
        <LayoutWrapper>
          <DataLoader />
          {children}
        </LayoutWrapper>
      </body>
    </html>
  );
}
