export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="font-sans bg-slate-50 text-slate-900 min-h-screen w-full">
      {children}
    </div>
  );
}
