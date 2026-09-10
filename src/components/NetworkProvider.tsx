"use client";

import { useEffect } from "react";
import { useNetworkState } from "@/hooks/useNetworkState";
import { syncToLocalDB } from "@/lib/sync";
import { WifiOff } from "lucide-react";

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const { isOnline } = useNetworkState();

  useEffect(() => {
    if (isOnline) {
      syncToLocalDB();
    }
  }, [isOnline]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {!isOnline && (
        <div className="w-full bg-red-600 text-white text-[11px] font-semibold tracking-wider py-1 px-4 flex items-center justify-center gap-2 z-50 shrink-0 shadow-sm border-b border-red-700/60 select-none">
          <WifiOff className="h-3.5 w-3.5 shrink-0 animate-pulse" />
          <span>You&apos;re offline &mdash; browsing cached data, editing disabled.</span>
        </div>
      )}
      <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col">
        {children}
      </div>
    </div>
  );
}
