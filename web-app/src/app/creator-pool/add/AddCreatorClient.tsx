"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { addCreatorFull } from "@/app/actions/creatorActions";
import { useAuth } from "@/providers/AuthProvider";
import { ArrowLeft, Save } from "lucide-react";
import Link from 'next/link';
import { useDatabaseStore } from '@/store/useDatabaseStore';

export default function AddCreatorClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const { fetchData } = useDatabaseStore();

  const [formData, setFormData] = useState({
    username: '',
    nama: '',
    followers: '',
    level: '',
    gmv_30d: '',
    niche: '',
    whatsapp: '',
    email: '',
    ratecard: ''
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Fill from URL params (from Chrome Extension)
    if (searchParams) {
      setFormData({
        username: searchParams.get('username') || '',
        nama: searchParams.get('name') || '',
        followers: searchParams.get('followers') || '',
        level: searchParams.get('level') || '',
        gmv_30d: searchParams.get('gmv_30d') || '',
        niche: searchParams.get('niche') || '',
        whatsapp: searchParams.get('no_whatsapp') || '',
        email: searchParams.get('email') || '',
        ratecard: searchParams.get('ratecard') || ''
      });
    }
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    if (!formData.username.trim()) return alert('Username wajib diisi');
    
    setIsLoading(true);
    try {
      await addCreatorFull(formData);
      await fetchData();
      alert('Data kreator berhasil disimpan!');
      router.push('/creator-pool');
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Link href="/creator-pool">
            <Button variant="ghost" size="icon"><ArrowLeft size={18}/></Button>
          </Link>
          <CardTitle>Import Kreator Baru</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Username (tanpa @)</label>
            <input name="username" value={formData.username} onChange={handleChange} className="input w-full" placeholder="contoh: budi_santoso" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Nama Tampilan</label>
            <input name="nama" value={formData.nama} onChange={handleChange} className="input w-full" placeholder="Budi Santoso" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Followers</label>
            <input name="followers" value={formData.followers} onChange={handleChange} className="input w-full" type="number" placeholder="100000" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Level</label>
            <input name="level" value={formData.level} onChange={handleChange} className="input w-full" placeholder="LVL 2" />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">GMV 30 Hari (Rp)</label>
          <input name="gmv_30d" value={formData.gmv_30d} onChange={handleChange} className="input w-full" placeholder="15000000" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Kategori / Niche</label>
          <input name="niche" value={formData.niche} onChange={handleChange} className="input w-full" placeholder="Beauty & Personal Care" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">WhatsApp</label>
            <input name="whatsapp" value={formData.whatsapp} onChange={handleChange} className="input w-full" placeholder="08123456789" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Email</label>
            <input name="email" value={formData.email} onChange={handleChange} className="input w-full" placeholder="email@domain.com" />
          </div>
        </div>

        <Button className="w-full mt-6" onClick={handleSave} disabled={isLoading}>
          {isLoading ? 'Menyimpan...' : (
            <><Save size={16} className="mr-2"/> Simpan ke Database</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
