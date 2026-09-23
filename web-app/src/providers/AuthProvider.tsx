"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { getAuthProfileAction } from '@/app/actions/storeActions';

type Profile = {
  id: string;
  nama: string;
  email: string;
  avatar_url: string | null;
  role: string;
  status: string;
};

type UserCampaign = {
  campaign_id: number;
  all_campaigns: boolean;
};

type AuthContextType = {
  profile: Profile | null;
  userCampaigns: UserCampaign[];
  isLoading: boolean;
  canEditCampaign: (campaignId: number | string) => boolean;
  isManager: boolean;
  isFinance: boolean;
  isExecutive: boolean;
  isAnggota: boolean;
};

const AuthContext = createContext<AuthContextType>({
  profile: null,
  userCampaigns: [],
  isLoading: true,
  canEditCampaign: () => false,
  isManager: false,
  isFinance: false,
  isExecutive: false,
  isAnggota: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userCampaigns, setUserCampaigns] = useState<UserCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadAuth() {
      try {
        const res = await getAuthProfileAction();
        if (mounted && res.profile) {
          setProfile(res.profile);
          setUserCampaigns(res.userCampaigns || []);
        }
      } catch (error) {
        console.error('Error loading auth state:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const canEditCampaign = (campaignId: number | string) => {
    if (isLoading) return false;
    if (!profile) return false;
    if (['manager', 'finance', 'executive', 'admin'].includes(profile.role)) return true;
    
    // Anggota / staff checks
    if (userCampaigns.some(uc => Boolean(uc.all_campaigns))) return true;
    const targetCid = Number(campaignId);
    return userCampaigns.some(uc => Number(uc.campaign_id) === targetCid);
  };

  const isManager = profile?.role === 'manager' || profile?.role === 'admin';
  const isFinance = profile?.role === 'finance' || profile?.role === 'executive' || profile?.role === 'admin';
  const isExecutive = profile?.role === 'executive' || profile?.role === 'admin';
  const isAnggota = profile?.role === 'anggota' || profile?.role === 'staff';

  return (
    <AuthContext.Provider value={{ profile, userCampaigns, isLoading, canEditCampaign, isManager, isFinance, isExecutive, isAnggota }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
