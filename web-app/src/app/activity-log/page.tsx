"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { Loader2 } from "lucide-react";
import { exportToCSV } from "@/utils/exportCsv";
import { Button } from "@/components/ui/Button";
import { fetchActivityLogsAction } from "@/app/actions/activityActions";

export default function ActivityLogPage() {
  const { profile, isLoading: authLoading } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (profile?.role !== 'manager') {
      setIsLoading(false);
      return;
    }

    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const data = await fetchActivityLogsAction(500);
        setLogs(data);
      } catch (err) {
        console.error('Error fetching logs:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [profile, authLoading]);

  if (authLoading || isLoading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;
  }

  if (profile?.role !== 'manager') {
    return <div className="p-8 text-center text-red-500 font-bold">Akses Ditolak. Hanya Manager yang dapat melihat halaman ini.</div>;
  }

  const handleExport = () => {
    const exportData = logs.map(l => ({
      'Tanggal': new Date(l.created_at).toLocaleString('id-ID'),
      'User': l.user_name || 'System',
      'Aksi': l.action,
      'Tabel': l.table_name,
      'Deskripsi': l.description || '-'
    }));
    exportToCSV(exportData, 'activity_logs');
  };

  return (
    <div className="p-6 space-y-6 w-full mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Activity Log</h1>
          <p className="text-sm text-slate-500">Riwayat aktivitas di dalam sistem (500 log terakhir).</p>
        </div>
        <Button variant="outline" onClick={handleExport}>Export CSV</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Waktu</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Aksi</TableHead>
                <TableHead>Modul</TableHead>
                <TableHead>Deskripsi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length > 0 ? (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm">{new Date(log.created_at).toLocaleString('id-ID')}</TableCell>
                    <TableCell className="font-medium text-sm">{log.user_name || 'System'}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                        log.action === 'CREATE' ? 'bg-green-100 text-green-700' :
                        log.action === 'DELETE' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {log.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{log.table_name}</TableCell>
                    <TableCell className="text-sm">{log.description || '-'}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">Belum ada riwayat aktivitas.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
