"use client";

import React, { useState, useEffect, useRef } from "react";
import { getLoanNotifications, LoanNotification, Loan, getInventory, ComponentWithTotals } from "@/lib/api";
import { 
  Bell, 
  X, 
  Clock, 
  AlertTriangle, 
  RotateCcw, 
  MapPin, 
  ExternalLink, 
  Package, 
  Compass, 
  CheckCircle2,
  Calendar
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onReturnLoan: (loan: Loan) => void;
  anchorRef?: React.RefObject<HTMLButtonElement | null>;
}

export function NotificationCenter({ isOpen, onClose, onReturnLoan, anchorRef }: Props) {
  const router = useRouter();
  const [loanNotifications, setLoanNotifications] = useState<LoanNotification[]>([]);
  const [lowStockItems, setLowStockItems] = useState<ComponentWithTotals[]>([]);
  const [loading, setLoading] = useState(true);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    Promise.all([
      getLoanNotifications().catch(() => [] as LoanNotification[]),
      getInventory().then(comps => comps.filter(c => 
        c.low_stock_threshold !== undefined && 
        c.low_stock_threshold !== null && 
        c.totals.in_storage_qty <= c.low_stock_threshold
      )).catch(() => [] as ComponentWithTotals[])
    ]).then(([notifs, lowStock]) => {
      setLoanNotifications(notifs);
      setLowStockItems(lowStock);
    }).finally(() => {
      setLoading(false);
    });
  }, [isOpen]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current && 
        !popoverRef.current.contains(event.target as Node) &&
        (!anchorRef?.current || !anchorRef.current.contains(event.target as Node))
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, anchorRef]);

  if (!isOpen) return null;

  const totalCount = loanNotifications.length + lowStockItems.length;

  return (
    <div 
      ref={popoverRef}
      className="fixed bottom-16 left-4 md:left-20 w-[92vw] max-w-md z-50 bg-[#161412] border border-[#3a352e] rounded-lg shadow-2xl shadow-black/95 flex flex-col max-h-[80vh] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150"
    >
      {/* Popover Header */}
      <div className="p-4 border-b border-[#2e2a25] bg-[#12110f] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Bell className="h-4 w-4 text-brand-accent" />
          <h3 className="font-serif text-sm font-bold text-white tracking-wider uppercase">
            Notifications
          </h3>
          {totalCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-brand-accent/20 border border-brand-accent/40 text-brand-accent text-[10px] font-mono font-bold">
              {totalCount}
            </span>
          )}
        </div>
        <button 
          onClick={onClose}
          className="text-brand-text-muted hover:text-white p-1 rounded transition-colors"
          title="Close notifications"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Popover Body */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 themed-scrollbar">
        {loading ? (
          <div className="p-8 text-center text-xs text-brand-text-muted">
            Checking active notifications...
          </div>
        ) : totalCount === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-brand-text-muted">
            <CheckCircle2 className="h-8 w-8 text-emerald-500/60" />
            <div className="text-xs font-medium text-white">All caught up!</div>
            <div className="text-[11px] text-brand-text-muted max-w-xs">
              No loans are due or overdue, and all components are above low-stock thresholds.
            </div>
          </div>
        ) : (
          <>
            {/* Loan Return Reminders */}
            {loanNotifications.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-brand-text-muted px-1">
                  Loan Return Reminders ({loanNotifications.length})
                </div>

                {loanNotifications.map(notif => {
                  const isOverdue = notif.type === 'overdue';
                  const isToday = notif.type === 'due_today';
                  const isTomorrow = notif.type === 'due_tomorrow';

                  return (
                    <div 
                      key={notif.id}
                      className={`p-3.5 rounded-md border text-xs flex flex-col gap-2.5 transition-all ${
                        isOverdue 
                          ? 'bg-red-950/20 border-red-900/50 hover:border-red-700/60' 
                          : isToday 
                          ? 'bg-orange-950/20 border-orange-900/50 hover:border-orange-700/60' 
                          : 'bg-amber-950/20 border-amber-900/50 hover:border-amber-700/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            isOverdue 
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                              : isToday 
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}>
                            {notif.title}
                          </span>
                          <span className="text-[10px] text-brand-text-muted flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(notif.loan.due_date).toLocaleDateString()}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onReturnLoan(notif.loan);
                          }}
                          className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors shrink-0"
                          title="Return this loan"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Return</span>
                        </button>
                      </div>

                      <div>
                        <div className="font-bold text-white text-sm">
                          {notif.loan.loan_type === 'project' 
                            ? (notif.loan.project_name || "Project")
                            : (notif.loan.component_name || "Component")}
                          {notif.loan.quantity > 1 && ` (${notif.loan.quantity} units)`}
                        </div>
                        <div className="text-[11px] text-zinc-300 mt-0.5">
                          Lent to: <span className="font-medium text-white">{notif.loan.borrower_name}</span>
                          {notif.loan.borrower_contact && ` • ${notif.loan.borrower_contact}`}
                        </div>
                      </div>

                      {notif.loan.source_location_label && (
                        <div className="flex items-center gap-1 text-[10px] text-brand-text-muted pt-1.5 border-t border-[#2a2622]">
                          <MapPin className="h-3 w-3 text-amber-400/80 shrink-0" />
                          <span className="truncate">Taken from: {notif.loan.source_location_label}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Low Stock Alerts */}
            {lowStockItems.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#26221e]">
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-400/90 px-1 flex items-center justify-between">
                  <span>Low Stock Warnings ({lowStockItems.length})</span>
                  <Link href="/low-stock" onClick={onClose} className="hover:underline flex items-center gap-1 text-brand-accent">
                    View all <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                </div>

                <div className="space-y-1.5 max-h-40 overflow-y-auto themed-scrollbar">
                  {lowStockItems.slice(0, 5).map(c => (
                    <Link
                      key={c.id}
                      href={`/inventory/${c.id}`}
                      onClick={onClose}
                      className="p-2 bg-[#12110f] hover:bg-[#1c1916] border border-[#2c2824] rounded flex items-center justify-between text-xs transition-colors"
                    >
                      <div className="font-medium text-white truncate pr-2">{c.name}</div>
                      <div className="text-right shrink-0">
                        <span className="text-red-400 font-bold">{c.totals.in_storage_qty}</span>
                        <span className="text-[10px] text-brand-text-muted"> / {c.low_stock_threshold} min</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Popover Footer */}
      <div className="p-3 border-t border-[#2e2a25] bg-[#12110f] flex items-center justify-between shrink-0 text-xs">
        <Link 
          href="/loans" 
          onClick={onClose}
          className="text-brand-accent hover:underline font-bold uppercase tracking-widest text-[10px] flex items-center gap-1"
        >
          <span>Open Loans Ledger</span>
          <ExternalLink className="h-3 w-3" />
        </Link>
        <button 
          type="button" 
          onClick={onClose}
          className="text-brand-text-muted hover:text-white text-[10px] uppercase tracking-wider"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
