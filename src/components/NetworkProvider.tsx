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
    <>
      {!isOnline && (
        <div className="bg-red-500/90 text-white text-xs font-bold uppercase tracking-widest p-2 flex items-center justify-center z-[100] relative shadow-md">
          <WifiOff className="h-4 w-4 mr-2" />
          You&apos;re offline &mdash; browsing cached data, editing disabled.
        </div>
      )}
      {children}
    </>
  );
}
