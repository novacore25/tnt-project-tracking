"use client";

import React, { useState, useMemo } from "react";
import { 
  TrendingUp, 
  CheckSquare, 
  Square, 
  RotateCcw, 
  Eye, 
  DollarSign, 
  Users, 
  Video, 
  Radio, 
  ShoppingBag, 
  Sparkles 
} from "lucide-react";

export interface MonthlyChartItem {
  month: string; // 'YYYY-MM'
  gmvOrganic: number;
  gmvLive: number;
  gmvVT: number;
  ordersLive: number;
  ordersVT: number;
  itemsSold: number;
  totalViews: number;
  totalLikes: number;
  revPerActiveCreator: number;
  revPerVideo: number;
  likeER: number;
  gmvAds: number;
  totalActiveCreators: number;
  totalCreators: number;
  totalPendingCreators: number;
  totalLiveCreators: number;
  totalPendingLiveCreators: number;
  totalVideos: number;
  totalVideoCreators: number;
  totalLiveSessions: number;
}

export interface MetricDefinition {
  id: string;
  label: string;
  shortLabel: string;
  category: "financial" | "creator" | "content" | "efficiency";
  color: string;
  fillColor: string;
  unit: string;
  getValue: (d: MonthlyChartItem) => number;
  formatTooltip: (val: number) => string;
}

export const METRIC_CONFIGS: MetricDefinition[] = [
  // Kreator & Pipeline
  {
    id: "kreator_ditambah",
    label: "Kreator Ditambah",
    shortLabel: "Kr Ditambah",
    category: "creator",
    color: "#ea580c", // Orange 600
    fillColor: "rgba(234, 88, 12, 0.12)",
    unit: "orang",
    getValue: (d) => d.totalPendingCreators || 0,
    formatTooltip: (v) => `${v.toLocaleString("id-ID")} kreator`
  },
  {
    id: "kreator_approve",
    label: "Kreator Approve",
    shortLabel: "Kr Approve",
    category: "creator",
    color: "#059669", // Emerald 600
    fillColor: "rgba(5, 150, 105, 0.12)",
    unit: "orang",
    getValue: (d) => d.totalCreators || 0,
    formatTooltip: (v) => `${v.toLocaleString("id-ID")} kreator`
  },
  {
    id: "kreator_live_ditambah",
    label: "Kreator Live Ditambah",
    shortLabel: "Kr Live Ditambah",
    category: "creator",
    color: "#4f46e5", // Indigo 600
    fillColor: "rgba(79, 70, 229, 0.12)",
    unit: "orang",
    getValue: (d) => d.totalPendingLiveCreators || 0,
    formatTooltip: (v) => `${v.toLocaleString("id-ID")} kreator`
  },
  {
    id: "kreator_live_approve",
    label: "Kr Live Approve",
    shortLabel: "Kr Live Approve",
    category: "creator",
    color: "#db2777", // Pink 600
    fillColor: "rgba(219, 39, 119, 0.12)",
    unit: "orang",
    getValue: (d) => d.totalLiveCreators || 0,
    formatTooltip: (v) => `${v.toLocaleString("id-ID")} kreator`
  },
  {
    id: "kreator_aktif",
    label: "Kreator Aktif",
    shortLabel: "Kr Aktif",
    category: "creator",
    color: "#0284c7", // Sky 600
    fillColor: "rgba(2, 132, 199, 0.12)",
    unit: "orang",
    getValue: (d) => d.totalActiveCreators || 0,
    formatTooltip: (v) => `${v.toLocaleString("id-ID")} kreator aktif`
  },
  {
    id: "kreator_w_vt",
    label: "Kreator w/ VT",
    shortLabel: "Kr w/ VT",
    category: "creator",
    color: "#0891b2", // Cyan 600
    fillColor: "rgba(8, 145, 178, 0.12)",
    unit: "orang",
    getValue: (d) => d.totalVideoCreators || 0,
    formatTooltip: (v) => `${v.toLocaleString("id-ID")} kreator`
  },

  // Finansial & GMV
  {
    id: "gmv_total",
    label: "GMV Total (Juta)",
    shortLabel: "GMV Total (Jt)",
    category: "financial",
    color: "#0891b2", // Teal / Cyan
    fillColor: "rgba(8, 145, 178, 0.14)",
    unit: "Juta Rp",
    getValue: (d) => Number((((d.gmvOrganic || 0) + (d.gmvAds || 0)) / 1000000).toFixed(2)),
    formatTooltip: (v) => `Rp ${(v * 1000000).toLocaleString("id-ID")}`
  },
  {
    id: "gmv_organik",
    label: "Sales Organik (Juta)",
    shortLabel: "Sales (Jt)",
    category: "financial",
    color: "#10b981", // Emerald 500
    fillColor: "rgba(16, 185, 129, 0.12)",
    unit: "Juta Rp",
    getValue: (d) => Number(((d.gmvOrganic || 0) / 1000000).toFixed(2)),
    formatTooltip: (v) => `Rp ${(v * 1000000).toLocaleString("id-ID")}`
  },
  {
    id: "gmv_ads",
    label: "Ads GMV (Juta)",
    shortLabel: "Ads (Jt)",
    category: "financial",
    color: "#8b5cf6", // Violet 500
    fillColor: "rgba(139, 92, 246, 0.12)",
    unit: "Juta Rp",
    getValue: (d) => Number(((d.gmvAds || 0) / 1000000).toFixed(2)),
    formatTooltip: (v) => `Rp ${(v * 1000000).toLocaleString("id-ID")}`
  },
  {
    id: "gmv_vt",
    label: "GMV VT (Juta)",
    shortLabel: "GMV VT (Jt)",
    category: "financial",
    color: "#14b8a6", // Teal 500
    fillColor: "rgba(20, 184, 166, 0.12)",
    unit: "Juta Rp",
    getValue: (d) => Number(((d.gmvVT || 0) / 1000000).toFixed(2)),
    formatTooltip: (v) => `Rp ${(v * 1000000).toLocaleString("id-ID")}`
  },
  {
    id: "gmv_live",
    label: "GMV Live (Juta)",
    shortLabel: "GMV Live (Jt)",
    category: "financial",
    color: "#f43f5e", // Rose 500
    fillColor: "rgba(244, 63, 94, 0.12)",
    unit: "Juta Rp",
    getValue: (d) => Number(((d.gmvLive || 0) / 1000000).toFixed(2)),
    formatTooltip: (v) => `Rp ${(v * 1000000).toLocaleString("id-ID")}`
  },

  // Konten (VT & Live)
  {
    id: "total_vt",
    label: "Total VT",
    shortLabel: "Total VT",
    category: "content",
    color: "#0d9488", // Dark Teal
    fillColor: "rgba(13, 148, 136, 0.12)",
    unit: "video",
    getValue: (d) => d.totalVideos || 0,
    formatTooltip: (v) => `${v.toLocaleString("id-ID")} VT`
  },
  {
    id: "total_live",
    label: "Total Live",
    shortLabel: "Total Live",
    category: "content",
    color: "#c2410c", // Rust Orange
    fillColor: "rgba(194, 65, 12, 0.12)",
    unit: "sesi",
    getValue: (d) => d.totalLiveSessions || 0,
    formatTooltip: (v) => `${v.toLocaleString("id-ID")} sesi`
  },

  // Efisiensi, Item & ER
  {
    id: "item_sold",
    label: "Item Sold",
    shortLabel: "Item Sold",
    category: "efficiency",
    color: "#7c3aed", // Purple 600
    fillColor: "rgba(124, 58, 237, 0.12)",
    unit: "pcs",
    getValue: (d) => d.itemsSold || 0,
    formatTooltip: (v) => `${v.toLocaleString("id-ID")} pcs`
  },
  {
    id: "orders_vt",
    label: "Order VT",
    shortLabel: "Order VT",
    category: "efficiency",
    color: "#6366f1", // Indigo 500
    fillColor: "rgba(99, 102, 241, 0.12)",
    unit: "order",
    getValue: (d) => d.ordersVT || 0,
    formatTooltip: (v) => `${v.toLocaleString("id-ID")} order`
  },
  {
    id: "orders_live",
    label: "Order Live",
    shortLabel: "Order Live",
    category: "efficiency",
    color: "#ec4899", // Pink 500
    fillColor: "rgba(236, 72, 153, 0.12)",
    unit: "order",
    getValue: (d) => d.ordersLive || 0,
    formatTooltip: (v) => `${v.toLocaleString("id-ID")} order`
  },
  {
    id: "rpv_vt",
    label: "RPV / VT (Ribu)",
    shortLabel: "RPV / VT (Rb)",
    category: "efficiency",
    color: "#e11d48", // Rose 600
    fillColor: "rgba(225, 29, 72, 0.12)",
    unit: "Ribu Rp",
    getValue: (d) => Number(((d.revPerVideo || 0) / 1000).toFixed(1)),
    formatTooltip: (v) => `Rp ${(v * 1000).toLocaleString("id-ID")}`
  },
  {
    id: "rev_kr",
    label: "Rev / Kr (Ribu)",
    shortLabel: "Rev / Kr (Rb)",
    category: "efficiency",
    color: "#2563eb", // Blue 600
    fillColor: "rgba(37, 99, 235, 0.12)",
    unit: "Ribu Rp",
    getValue: (d) => Number(((d.revPerActiveCreator || 0) / 1000).toFixed(1)),
    formatTooltip: (v) => `Rp ${(v * 1000).toLocaleString("id-ID")}`
  },
  {
    id: "like_er",
    label: "Like ER (%)",
    shortLabel: "Like ER (%)",
    category: "efficiency",
    color: "#d97706", // Amber 600
    fillColor: "rgba(217, 119, 6, 0.14)",
    unit: "%",
    getValue: (d) => d.likeER || 0,
    formatTooltip: (v) => `${v}%`
  },
  {
    id: "total_views",
    label: "Views (Ribu)",
    shortLabel: "Views (Rb)",
    category: "efficiency",
    color: "#475569", // Slate 600
    fillColor: "rgba(71, 85, 105, 0.12)",
    unit: "Ribu Views",
    getValue: (d) => Number(((d.totalViews || 0) / 1000).toFixed(1)),
    formatTooltip: (v) => `${(v * 1000).toLocaleString("id-ID")} views`
  }
];

// Helper to generate smooth cubic Bezier curve points
function getBezierPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

interface MonthlyPerformanceChartProps {
  monthlyData: MonthlyChartItem[];
}

export default function MonthlyPerformanceChart({ monthlyData }: MonthlyPerformanceChartProps) {
  // Sort data chronologically (oldest to newest) for line chart progression
  const chartData = useMemo(() => {
    return [...monthlyData].sort((a, b) => new Date(a.month + "-01").getTime() - new Date(b.month + "-01").getTime());
  }, [monthlyData]);

  // Default active metrics to replicate the screenshot
  const [selectedMetrics, setSelectedMetrics] = useState<Record<string, boolean>>({
    kreator_ditambah: true,
    kreator_approve: true,
    kreator_live_ditambah: true,
    kreator_live_approve: true,
    gmv_total: true,
    item_sold: true,
    rpv_vt: true,
    like_er: true,
    total_vt: true,
    total_live: true
  });

  const [activeTab, setActiveTab] = useState<"all" | "financial" | "creator" | "content" | "efficiency">("all");
  const [hoveredMonthIndex, setHoveredMonthIndex] = useState<number | null>(null);

  const toggleMetric = (id: string) => {
    setSelectedMetrics(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const selectAll = () => {
    const next: Record<string, boolean> = {};
    METRIC_CONFIGS.forEach(m => { next[m.id] = true; });
    setSelectedMetrics(next);
  };

  const clearAll = () => {
    const next: Record<string, boolean> = {};
    METRIC_CONFIGS.forEach(m => { next[m.id] = false; });
    setSelectedMetrics(next);
  };

  const filteredPills = useMemo(() => {
    if (activeTab === "all") return METRIC_CONFIGS;
    return METRIC_CONFIGS.filter(m => m.category === activeTab);
  }, [activeTab]);

  const activeMetricList = useMemo(() => {
    return METRIC_CONFIGS.filter(m => selectedMetrics[m.id]);
  }, [selectedMetrics]);

  // Dimension setup for SVG viewBox
  const width = 1000;
  const height = 340;
  const paddingLeft = 60;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 50;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Calculate global max value across all selected metrics for proportional Y-scale
  const maxY = useMemo(() => {
    let max = 0;
    chartData.forEach(d => {
      activeMetricList.forEach(m => {
        const val = m.getValue(d);
        if (val > max) max = val;
      });
    });
    if (max <= 0) return 100;
    // Round up nicely
    const power = Math.pow(10, Math.floor(Math.log10(max)));
    const multiple = Math.ceil(max / power);
    return Math.max(10, multiple * power);
  }, [chartData, activeMetricList]);

  // Y-axis tick intervals
  const yTicks = useMemo(() => {
    const count = 5;
    const ticks = [];
    for (let i = 0; i <= count; i++) {
      ticks.push(Math.round((maxY / count) * i));
    }
    return ticks;
  }, [maxY]);

  // Month coordinate mapping
  const monthPointsX = useMemo(() => {
    const len = chartData.length;
    if (len <= 1) return [paddingLeft + chartWidth / 2];
    return chartData.map((_, idx) => paddingLeft + (idx / (len - 1)) * chartWidth);
  }, [chartData, chartWidth, paddingLeft]);

  if (chartData.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6 mb-6 transition-all">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Tren Performa Campaign (Bulanan)
              </h3>
              <p className="text-xs text-slate-500">
                Pilih atau sembunyikan metrik untuk membandingkan grafik tren antar bulan secara real-time.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Category Tabs */}
          <div className="inline-flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === "all" ? "bg-white text-indigo-700 shadow-xs font-bold" : "hover:text-slate-900"
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("financial")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === "financial" ? "bg-white text-indigo-700 shadow-xs font-bold" : "hover:text-slate-900"
              }`}
            >
              Finansial
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("creator")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === "creator" ? "bg-white text-indigo-700 shadow-xs font-bold" : "hover:text-slate-900"
              }`}
            >
              Kreator
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("content")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === "content" ? "bg-white text-indigo-700 shadow-xs font-bold" : "hover:text-slate-900"
              }`}
            >
              VT & Live
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("efficiency")}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                activeTab === "efficiency" ? "bg-white text-indigo-700 shadow-xs font-bold" : "hover:text-slate-900"
              }`}
            >
              Efisiensi & ER
            </button>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden sm:block" />

          <button
            type="button"
            onClick={selectAll}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
            <span>Pilih Semua</span>
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Checkbox Pills Grid */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {filteredPills.map((m) => {
          const isChecked = !!selectedMetrics[m.id];
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggleMetric(m.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer select-none shadow-xs ${
                isChecked
                  ? "bg-white border-slate-300 text-slate-800 ring-1 ring-slate-200/60"
                  : "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              }`}
            >
              <span
                className="w-3.5 h-3.5 rounded flex items-center justify-center transition-all"
                style={{
                  backgroundColor: isChecked ? m.color : "#cbd5e1"
                }}
              >
                {isChecked ? (
                  <svg className="w-2.5 h-2.5 text-white stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                )}
              </span>
              <span>{m.label}</span>
            </button>
          );
        })}
      </div>

      {/* SVG Chart Container */}
      <div className="relative w-full overflow-x-auto select-none bg-slate-50/50 rounded-xl border border-slate-100 p-2 sm:p-4">
        {activeMetricList.length === 0 ? (
          <div className="h-[280px] flex flex-col items-center justify-center text-center text-slate-400">
            <Eye className="w-8 h-8 mb-2 stroke-[1.5]" />
            <p className="text-sm font-semibold">Tidak ada metrik yang dipilih</p>
            <p className="text-xs text-slate-400 mt-0.5">Centang minimal satu metrik di atas untuk menampilkan grafik.</p>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full h-auto min-w-[700px] overflow-visible"
          >
            <defs>
              {activeMetricList.map((m) => (
                <linearGradient key={`grad-${m.id}`} id={`grad-${m.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={m.color} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={m.color} stopOpacity="0.0" />
                </linearGradient>
              ))}
            </defs>

            {/* Horizontal Grid lines */}
            {yTicks.map((val, idx) => {
              const yPos = paddingTop + chartHeight - (val / maxY) * chartHeight;
              return (
                <g key={`grid-${idx}`}>
                  <line
                    x1={paddingLeft}
                    y1={yPos}
                    x2={width - paddingRight}
                    y2={yPos}
                    stroke="#e2e8f0"
                    strokeDasharray={idx === 0 ? "none" : "3 3"}
                    strokeWidth={idx === 0 ? "1.5" : "1"}
                  />
                  <text
                    x={paddingLeft - 10}
                    y={yPos + 4}
                    textAnchor="end"
                    fontSize="11"
                    fontWeight="500"
                    fill="#94a3b8"
                  >
                    {val.toLocaleString("id-ID")}
                  </text>
                </g>
              );
            })}

            {/* Vertical Month lines */}
            {chartData.map((d, idx) => {
              const xPos = monthPointsX[idx];
              const dateObj = new Date(d.month + "-01");
              const monthLabel = dateObj.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
              const isHovered = hoveredMonthIndex === idx;

              return (
                <g key={`col-${idx}`}>
                  <line
                    x1={xPos}
                    y1={paddingTop}
                    x2={xPos}
                    y2={paddingTop + chartHeight}
                    stroke={isHovered ? "#6366f1" : "#f1f5f9"}
                    strokeWidth={isHovered ? "2" : "1"}
                    strokeDasharray={isHovered ? "4 4" : "none"}
                  />
                  <text
                    x={xPos}
                    y={height - paddingBottom + 24}
                    textAnchor="middle"
                    fontSize="12"
                    fontWeight={isHovered ? "700" : "600"}
                    fill={isHovered ? "#312e81" : "#64748b"}
                  >
                    {monthLabel}
                  </text>
                </g>
              );
            })}

            {/* Draw Area Fill & Line Splines */}
            {activeMetricList.map((m) => {
              const points = chartData.map((d, idx) => {
                const val = m.getValue(d);
                const x = monthPointsX[idx];
                const y = paddingTop + chartHeight - (val / maxY) * chartHeight;
                return { x, y };
              });

              const splinePath = getBezierPath(points);
              const firstPt = points[0];
              const lastPt = points[points.length - 1];
              const baselineY = paddingTop + chartHeight;
              const areaPath = `${splinePath} L ${lastPt.x} ${baselineY} L ${firstPt.x} ${baselineY} Z`;

              return (
                <g key={`metric-draw-${m.id}`}>
                  {/* Area fill */}
                  <path
                    d={areaPath}
                    fill={`url(#grad-${m.id})`}
                    className="transition-opacity duration-300"
                  />
                  {/* Stroke path */}
                  <path
                    d={splinePath}
                    fill="none"
                    stroke={m.color}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Data points */}
                  {points.map((pt, pIdx) => {
                    const isHovered = hoveredMonthIndex === pIdx;
                    return (
                      <circle
                        key={`pt-${m.id}-${pIdx}`}
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? "5.5" : "3.5"}
                        fill="#ffffff"
                        stroke={m.color}
                        strokeWidth={isHovered ? "3" : "2"}
                        className="transition-all cursor-pointer"
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Transparent touch/hover bars for each month column */}
            {chartData.map((_, idx) => {
              const colWidth = chartWidth / (chartData.length || 1);
              const xPos = monthPointsX[idx] - colWidth / 2;
              return (
                <rect
                  key={`hover-bar-${idx}`}
                  x={xPos}
                  y={paddingTop}
                  width={colWidth}
                  height={chartHeight + 30}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredMonthIndex(idx)}
                  onMouseLeave={() => setHoveredMonthIndex(null)}
                />
              );
            })}
          </svg>
        )}

        {/* Hover Floating Details Card */}
        {hoveredMonthIndex !== null && chartData[hoveredMonthIndex] && (
          <div className="mt-4 p-4 bg-white rounded-xl border border-indigo-100 shadow-md animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
              <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                Rincian Bulan:{" "}
                {new Date(chartData[hoveredMonthIndex].month + "-01").toLocaleDateString("id-ID", {
                  month: "long",
                  year: "numeric"
                })}
              </span>
              <span className="text-[11px] font-semibold text-slate-400">
                {activeMetricList.length} Metrik Aktif
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {activeMetricList.map((m) => {
                const val = m.getValue(chartData[hoveredMonthIndex]);
                const formatted = m.formatTooltip(val);
                return (
                  <div
                    key={`detail-${m.id}`}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/60 flex flex-col justify-between"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                      <span className="text-[11px] font-semibold text-slate-600 truncate" title={m.label}>
                        {m.shortLabel}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-900 truncate" title={formatted}>
                      {formatted}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
