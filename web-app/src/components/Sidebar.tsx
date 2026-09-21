"use client";

import Link from 'next/link';
import { LayoutDashboard, Users, FolderKanban, Receipt, Wallet, Settings, Package, LogOut, Shield, Activity, Puzzle, ChevronLeft, ChevronRight } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { cn } from '@/utils/cn';
import { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { signOut } from 'next-auth/react';

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, activePhase: true },
  { name: 'Creator Pool', href: '/creator-pool', icon: Users, activePhase: true },
  { name: 'Migrasi Data', href: '/import-data', icon: FolderKanban, activePhase: true },
  { name: 'Campaign', href: '/campaigns', icon: FolderKanban, activePhase: true },
  { name: 'Master Produk', href: '/skus', icon: Package, activePhase: true },
  { name: 'Input Penjualan', href: '/input-penjualan', icon: Receipt, activePhase: true },
  { name: 'Ads Report', href: '/ads-report', icon: FolderKanban, activePhase: true },
  { name: 'Unduh Ekstensi', href: '/extension', icon: Puzzle, activePhase: true },
  { name: 'Pengaturan', href: '/settings', icon: Settings, activePhase: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { profile } = useAuth();
  // Default to false (collapsed) per user request
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Optional: Load state from local storage if desired, but defaults to false
    const savedState = localStorage.getItem('sidebar_expanded');
    if (savedState) {
      setIsExpanded(savedState === 'true');
    }
  }, []);

  const toggleSidebar = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    localStorage.setItem('sidebar_expanded', String(newState));
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/login' });
  };

  const [hoveredItem, setHoveredItem] = useState<{ name: string, top: number } | null>(null);

  const handleMouseEnter = (e: React.MouseEvent, name: string, activePhase: boolean) => {
    if (isExpanded) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setHoveredItem({
      name: name + (!activePhase ? " (Lock)" : ""),
      top: rect.top + rect.height / 2
    });
  };

  const handleMouseLeave = () => {
    setHoveredItem(null);
  };

  return (
    <>
      <div className={cn("navdemo", isExpanded ? "expanded" : "collapsed")}>
        <div className={cn("navbrand", !isExpanded && "flex-col gap-2 pt-6 pb-2")}>
          {isExpanded ? (
            <div>
              TNT App
              <small>Campaign Management</small>
            </div>
          ) : (
            <div className="flex items-center justify-center mb-2">
            <img src="/icon-tnt-rounded.png" alt="TNT Logo" className="w-8 h-8 object-cover rounded-md" />
          </div>
          )}
          
          <button 
            onClick={toggleSidebar}
            className="bg-white text-n300 p-1.5 rounded-md hover:bg-gray-200 transition-colors"
            title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {isExpanded ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>
        
        {/* Profil User */}
        {profile && (
          <div className={cn("flex items-center gap-[11px] py-[8px] mb-[4px]", isExpanded ? "px-[12px]" : "justify-center px-0")}>
            <div className="avatar bg-p300 shadow-sm border border-white/10 text-[13px] shrink-0">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.nama} className="w-full h-full object-cover rounded-full" />
              ) : (
                profile.nama?.charAt(0).toUpperCase()
              )}
            </div>
            {isExpanded && (
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-white truncate">{profile.nama}</p>
                <p className="text-[11px] text-white/50 capitalize font-medium">{profile.role}</p>
              </div>
            )}
          </div>
        )}

        <nav className="flex-1 flex flex-col overflow-y-auto mt-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.activePhase ? item.href : '#'}
                className={cn(
                  'navitem',
                  isActive && 'active',
                  !item.activePhase && 'opacity-50 cursor-not-allowed'
                )}
                onClick={(e) => {
                  if (!item.activePhase) {
                    e.preventDefault();
                    alert('Menu ini akan tersedia pada Fase berikutnya.');
                  }
                }}
                onMouseEnter={(e) => handleMouseEnter(e, item.name, item.activePhase)}
                onMouseLeave={handleMouseLeave}
              >
                <Icon className="ico" />
                {isExpanded && <span>{item.name}</span>}
                {!item.activePhase && isExpanded && (
                  <span className="ml-auto text-[10px] bg-white/10 text-white/40 px-1.5 py-0.5 rounded">Lock</span>
                )}
              </Link>
            );
          })}
          
          {/* Khusus Manager, Finance, Executive */}
          {['manager', 'finance', 'executive'].includes(profile?.role) && (
            <div className="mt-2">
              <div className="navsection">Manager Tools</div>
              
              {/* Manajemen Akun: Hanya Manager & Executive */}
              {['manager', 'executive'].includes(profile?.role) && (
                <Link
                  href="/manajemen-akun"
                  className={cn(
                    'navitem tool',
                    pathname.startsWith('/manajemen-akun') && 'active'
                  )}
                  onMouseEnter={(e) => handleMouseEnter(e, 'Manajemen Akun', true)}
                  onMouseLeave={handleMouseLeave}
                >
                  <Shield className="ico" />
                  {isExpanded && <span>Manajemen Akun</span>}
                </Link>
              )}
              
              <Link
                href="/activity-log"
                className={cn(
                  'navitem tool',
                  pathname.startsWith('/activity-log') && 'active'
                )}
                onMouseEnter={(e) => handleMouseEnter(e, 'Activity Log', true)}
                onMouseLeave={handleMouseLeave}
              >
                <Activity className="ico" />
                {isExpanded && <span>Activity Log</span>}
              </Link>
            </div>
          )}

          {/* Khusus Finance & Executive */}
          {['finance', 'executive'].includes(profile?.role) && (
            <div className="mt-2">
              <div className="navsection">Finance</div>
              <Link
                href="/budgeting"
                className={cn(
                  'navitem tool text-emerald-400 hover:text-emerald-300',
                  pathname.startsWith('/budgeting') && 'active bg-emerald-500/20 text-emerald-300'
                )}
                onMouseEnter={(e) => handleMouseEnter(e, 'Dashboard Pembayaran', true)}
                onMouseLeave={handleMouseLeave}
              >
                <Wallet className="ico text-emerald-400" />
                {isExpanded && <span>Dashboard Pembayaran</span>}
              </Link>
            </div>
          )}
        </nav>
        
        <div className="mt-4 pt-4 border-t border-white/10 mb-4">
          <button 
            onClick={handleLogout}
            className="navitem w-full"
            onMouseEnter={(e) => handleMouseEnter(e, 'Logout', true)}
            onMouseLeave={handleMouseLeave}
          >
            <LogOut className="ico" />
            {isExpanded && <span>Logout</span>}
          </button>
          {isExpanded && (
            <p className="text-[10px] text-center text-white/30 mt-4 font-medium tracking-wide">
              TNT Agency &copy; {new Date().getFullYear()}
            </p>
          )}
        </div>
      </div>

      {/* Global Fixed Tooltip for Collapsed State */}
      {hoveredItem && !isExpanded && (
        <div 
          className="fixed z-[100] bg-gray-800 text-white text-[12px] font-semibold px-3 py-1.5 rounded shadow-md pointer-events-none whitespace-nowrap"
          style={{ top: hoveredItem.top, left: 78, transform: 'translateY(-50%)' }}
        >
          {hoveredItem.name}
        </div>
      )}
    </>
  );
}
