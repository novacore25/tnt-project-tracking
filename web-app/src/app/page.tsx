"use client";

import { useDatabaseStore } from "@/store/useDatabaseStore";
import Link from "next/link";
import { TrendingUp, Activity, Video, DollarSign, Download, FolderKanban } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { exportToExcel } from "@/utils/exportToExcel";

export default function Dashboard() {
  const { vw_campaign_summary } = useDatabaseStore();
  const { profile } = useAuth();
  const isManager = profile?.role === 'manager' || profile?.role === 'executive';

  const getCountdown = (endDateStr: string) => {
    const end = new Date(endDateStr).getTime();
    const now = new Date().getTime();
    const diff = end - now;
    if (diff <= 0) return 'Selesai';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return `${days} Hari Lagi`;
  };

  const handleExport = () => {
    const dataToExport = vw_campaign_summary.map(c => ({
      "Nama Campaign": c.nama,
      "Tipe": c.tipe_campaign,
      "Status": c.status,
      "Start Date": c.start_date,
      "End Date": c.end_date,
      "Target GMV": c.target_gmv || 0,
      "Achievement GMV": c.total_gmv_achievement || 0,
      "Persentase GMV (%)": c.target_gmv ? Math.round(((c.total_gmv_achievement || 0) / c.target_gmv) * 100) : 0,
      "Target Video": c.target_video || 0,
      "Achievement Video": c.achievement_video || 0,
      "Plafon Ads": c.budget_ads_plafon || 0,
      "Sisa Budget Ads": c.sisa_budget_ads || 0
    }));
    exportToExcel(dataToExport, "Summary_Campaign_Export");
  };

  return (
    <div className="space-y-[32px]">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight mb-[4px]">Main Dashboard</h1>
          <p className="text-[14px] text-text-soft">Ringkasan performa seluruh campaign aktif.</p>
        </div>
        {isManager && (
          <button onClick={handleExport} className="btn btn-success">
            <Download className="ico" /> Export Excel
          </button>
        )}
      </div>

      {vw_campaign_summary.length === 0 ? (
        <div className="empty">
          <div className="eicon"><FolderKanban className="w-6 h-6 text-text-mute" /></div>
          <h4>Belum Ada Campaign</h4>
          <p>Belum ada data campaign aktif yang berjalan atau database belum disinkronisasi.</p>
        </div>
      ) : (
        <div className="space-y-[24px]">
          {/* Summary Cards */}
          <div className="grid gap-[16px] md:grid-cols-4">
            <div className="metric">
              <div className="mlabel">
                Total Campaign Aktif
                <div className="micon bg-p50 text-p300"><Activity className="ico" /></div>
              </div>
              <div className="mval">{vw_campaign_summary.filter(c => c.status === 'aktif').length}</div>
            </div>
            
            <div className="metric">
              <div className="mlabel">
                Total GMV (All)
                <div className="micon bg-g50 text-g300"><TrendingUp className="ico" /></div>
              </div>
              <div className="mval text-g300">
                Rp {(vw_campaign_summary.reduce((a, b) => a + (Number(b.total_gmv_achievement) || 0), 0) / 1000000).toFixed(1)}M
              </div>
              <div className="msub font-bold text-g400">
                Rp {Math.round(vw_campaign_summary.reduce((a, b) => a + (Number(b.total_gmv_achievement) || 0), 0)).toLocaleString('id-ID')}
              </div>
            </div>
            
            <div className="metric">
              <div className="mlabel">
                Total Video Tayang
                <div className="micon bg-[#f3eaf7] text-pu300"><Video className="ico" /></div>
              </div>
              <div className="mval">{vw_campaign_summary.reduce((a, b) => a + (Number(b.achievement_video) || 0), 0).toLocaleString('id-ID')}</div>
            </div>
            
            <div className="metric">
              <div className="mlabel">
                Sisa Budget Ads
                <div className="micon bg-o50 text-o300"><DollarSign className="ico" /></div>
              </div>
              <div className="mval text-o300">
                Rp {(vw_campaign_summary.reduce((a, b) => a + (Number(b.sisa_budget_ads) || 0), 0) / 1000000).toFixed(1)}M
              </div>
              <div className="msub font-bold text-o400">
                Rp {Math.round(vw_campaign_summary.reduce((a, b) => a + (Number(b.sisa_budget_ads) || 0), 0)).toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          {/* Table Detail */}
          <div className="tbl-wrap mt-[32px]">
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Tipe</th>
                  <th>Countdown</th>
                  <th className="text-right">Achievement GMV</th>
                  <th className="text-right">% Capai</th>
                  <th className="text-right">Video</th>
                  <th className="text-right">Sisa Ads</th>
                </tr>
              </thead>
              <tbody>
                {vw_campaign_summary.map((c) => {
                  const percentGmv = c.target_gmv ? Math.round(((c.total_gmv_achievement || 0) / c.target_gmv) * 100) : 0;
                  const percentVideo = c.target_video ? Math.round(((c.achievement_video || 0) / c.target_video) * 100) : 0;
                  
                  return (
                    <tr key={c.campaign_id}>
                      <td>
                        <Link href={`/campaigns/${c.campaign_id}/listing`} className="u-link">
                          {c.nama}
                        </Link>
                      </td>
                      <td>
                        <span className={`badge ${c.tipe_campaign === 'sales' ? 'b-sales' : 'b-awareness'}`}>
                          {c.tipe_campaign}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${getCountdown(c.end_date) === 'Selesai' ? 'b-neutral' : 'b-pending'}`}>
                          {getCountdown(c.end_date)}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="font-bold">Rp {(c.total_gmv_achievement || 0).toLocaleString()}</div>
                        <div className="text-[11px] text-text-mute font-medium mt-[2px]">Target: {c.target_gmv ? `Rp ${c.target_gmv.toLocaleString()}` : '-'}</div>
                      </td>
                      <td className="text-right">
                        <div className={`font-bold ${percentGmv >= 100 ? 'text-g300' : 'text-text'}`}>
                          {percentGmv}%
                        </div>
                      </td>
                      <td className="text-right">
                        <div className="font-bold">{c.achievement_video || 0} <span className="text-text-mute font-normal text-[12px]">/ {c.target_video || '-'}</span></div>
                        <div className="text-[11px] text-text-mute font-medium mt-[2px]">{percentVideo}%</div>
                      </td>
                      <td className="text-right">
                        <span className={(c.sisa_budget_ads || 0) < 0 ? 'money-neg' : 'font-bold'}>
                          Rp {(c.sisa_budget_ads || 0).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
