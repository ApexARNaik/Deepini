"use client";

import { useEffect, useState } from "react";
import { Layers, Cuboid, TriangleAlert, Compass } from "lucide-react";
import { getInventory, ComponentWithTotals, getProjects } from "@/lib/api";
import Link from "next/link";

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalComponents: 0,
    totalUnits: 0,
    lowStockCount: 0,
    activeProjects: 0,
    loading: true
  });

  useEffect(() => {
    async function loadStats() {
      try {
        const [inventory, projects] = await Promise.all([getInventory(), getProjects()]);
        
        let totalComponents = 0;
        let totalUnits = 0;
        let lowStockCount = 0;

        for (const comp of inventory) {
          totalComponents += 1;
          totalUnits += comp.totals.total_owned_qty || 0;
          
          if (comp.low_stock_threshold !== null && comp.low_stock_threshold !== undefined) {
            if (comp.totals.total_owned_qty <= comp.low_stock_threshold) {
              lowStockCount += 1;
            }
          }
        }

        const activeProjects = projects.filter(p => p.status === 'active').length;

        setStats({
          totalComponents,
          totalUnits,
          lowStockCount,
          activeProjects,
          loading: false
        });
      } catch (err) {
        console.error("Failed to load dashboard stats", err);
        setStats(s => ({ ...s, loading: false }));
      }
    }
    
    loadStats();
  }, []);

  return (
    <div className="max-w-5xl p-4 md:p-6">
        <div className="mb-12">
          <h1 className="font-serif text-[28px] font-bold tracking-widest text-white uppercase">
            Dashboard
          </h1>
          <p className="mt-1 text-[10px] tracking-[0.2em] text-brand-gold uppercase">
            {stats.loading ? "Loading system statistics..." : "System nominal. Ready for operations."}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Total Components Card */}
          <Link href="/inventory" className="block bg-[#1f1f1f] border border-[#2a2a2a] p-6 rounded relative hover:border-brand-accent transition-colors group">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-[10px] tracking-widest text-brand-text-muted group-hover:text-white transition-colors uppercase font-medium leading-loose max-w-[60%]">
                Total<br/>Components
              </h3>
              <div className="text-brand-text-muted group-hover:text-brand-accent transition-colors">
                <Cuboid className="h-5 w-5" />
              </div>
            </div>
            <div className="text-4xl font-serif font-bold text-brand-gold mb-2">
              {stats.loading ? "-" : stats.totalComponents.toLocaleString()}
            </div>
            <div className="flex items-center text-xs text-brand-gold/80 font-medium opacity-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
                <path d="M23 6l-9.5 9.5-5-5L1 18" />
                <path d="M17 6h6v6" />
              </svg>
              +0 this week
            </div>
          </Link>

          {/* Total Units Card */}
          <Link href="/inventory" className="block bg-[#1f1f1f] border border-[#2a2a2a] p-6 rounded relative hover:border-brand-accent transition-colors group">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-[10px] tracking-widest text-brand-text-muted group-hover:text-white transition-colors uppercase font-medium leading-loose max-w-[60%]">
                Total<br/>Units
              </h3>
              <div className="text-brand-text-muted group-hover:text-brand-accent transition-colors">
                <Layers className="h-5 w-5" />
              </div>
            </div>
            <div className="text-4xl font-serif font-bold text-brand-gold">
              {stats.loading ? "-" : stats.totalUnits.toLocaleString()}
            </div>
          </Link>

          {/* Active Projects Card */}
          <Link href="/projects" className="block bg-[#1f1f1f] border border-[#2a2a2a] p-6 rounded relative hover:border-brand-accent transition-colors group">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-[10px] tracking-widest text-brand-text-muted group-hover:text-white transition-colors uppercase font-medium leading-loose max-w-[60%]">
                Active<br/>Projects
              </h3>
              <div className="text-brand-text-muted group-hover:text-brand-accent transition-colors">
                <Compass className="h-5 w-5" />
              </div>
            </div>
            <div className="text-4xl font-serif font-bold text-brand-gold">
              {stats.loading ? "-" : stats.activeProjects}
            </div>
          </Link>

          {/* Low Stock Alerts Card */}
          <div className="bg-[#2a1616] border border-[#3a2020] p-6 rounded relative flex flex-col justify-between">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-[10px] tracking-widest text-brand-error-text uppercase font-medium">
                Low Stock Alerts
              </h3>
              <div className="text-brand-error-text">
                <TriangleAlert className="h-5 w-5" />
              </div>
            </div>
            
            <div className="flex items-end justify-between mt-auto">
              <div className="flex items-baseline">
                <span className="text-4xl font-serif font-bold text-white mr-2">
                  {stats.loading ? "-" : stats.lowStockCount}
                </span>
                <span className="text-brand-text-muted text-sm">items require attention</span>
              </div>
              <Link href="/low-stock" className="bg-[#7a2020] hover:bg-[#8a2525] text-white text-[10px] font-bold px-4 py-2 uppercase tracking-wider rounded-sm transition-colors">
                View Report
              </Link>
            </div>
          </div>
        </div>
      </div>
  );
}
