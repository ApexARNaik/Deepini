import { AppShell } from "@/components/AppShell";
import { Layers, Cuboid, TriangleAlert } from "lucide-react";

export default function Dashboard() {
  return (
    <AppShell>
      <div className="max-w-5xl">
        <h1 className="font-serif text-5xl font-bold text-white mb-2 leading-tight">
          Good evening.<br />
          Here&apos;s what&apos;s in your workshop.
        </h1>
        <p className="text-brand-text-muted text-lg mb-12">
          System nominal. 12 new items logged today.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Components Card */}
          <div className="bg-[#1f1f1f] border border-[#2a2a2a] p-6 rounded relative">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-[10px] tracking-widest text-brand-text-muted uppercase font-medium leading-loose max-w-[60%]">
                Total<br/>Components
              </h3>
              <div className="text-brand-text-muted">
                <Cuboid className="h-5 w-5" />
              </div>
            </div>
            <div className="text-4xl font-serif font-bold text-brand-gold mb-2">
              4,821
            </div>
            <div className="flex items-center text-xs text-brand-gold/80 font-medium">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
                <path d="M23 6l-9.5 9.5-5-5L1 18" />
                <path d="M17 6h6v6" />
              </svg>
              +12 this week
            </div>
          </div>

          {/* Total Units Card */}
          <div className="bg-[#1f1f1f] border border-[#2a2a2a] p-6 rounded relative">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-[10px] tracking-widest text-brand-text-muted uppercase font-medium leading-loose max-w-[60%]">
                Total<br/>Units
              </h3>
              <div className="text-brand-text-muted">
                <Layers className="h-5 w-5" />
              </div>
            </div>
            <div className="text-4xl font-serif font-bold text-brand-gold">
              12,405
            </div>
          </div>

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
                <span className="text-4xl font-serif font-bold text-white mr-2">14</span>
                <span className="text-brand-text-muted text-sm">items require attention</span>
              </div>
              <button className="bg-[#7a2020] hover:bg-[#8a2525] text-white text-[10px] font-bold px-4 py-2 uppercase tracking-wider rounded-sm transition-colors">
                View Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
