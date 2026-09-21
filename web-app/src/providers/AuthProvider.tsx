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
  canEditCampaign: (campaignId: number) => boolean;
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

  const canEditCampaign = (campaignId: number) => {
    if (isLoading) return false;
    if (!profile) return false;
    if (['manager', 'finance', 'executive'].includes(profile.role)) return true;
    
    // Anggota checks
    if (userCampaigns.some(uc => uc.all_campaigns)) return true;
    return userCampaigns.some(uc => uc.campaign_id === campaignId);
  };

  const isManager = profile?.role === 'manager';
  const isFinance = profile?.role === 'finance';
  const isExecutive = profile?.role === 'executive';
  const isAnggota = profile?.role === 'anggota';

  return (
    <AuthContext.Provider value={{ profile, userCampaigns, isLoading, canEditCampaign, isManager, isFinance, isExecutive, isAnggota }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
