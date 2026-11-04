"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getLoans, Loan, calculateLoanDaysRemaining, parseHotspotLoanMeta, returnHotspotLoan } from "@/lib/api";
import { LendModal } from "@/components/loans/LendModal";
import { ReturnLoanModal } from "@/components/loans/ReturnLoanModal";
import { 
  Plus, 
  Search, 
  RotateCcw, 
  MapPin, 
  User, 
  Calendar, 
  Phone, 
  FileText, 
  Package, 
  Compass, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Layers,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import Link from "next/link";
import { useNetworkState } from "@/hooks/useNetworkState";

interface GroupedHotspotLoan {
  groupId: string;
  rootHotspotId: string;
  rootHotspotLabel: string;
  cleanNotes: string;
  borrower_name: string;
  borrower_contact?: string | null;
  due_date: string;
  lent_at: string;
  returned_at?: string | null;
  loans: Loan[];
  totalUnits: number;
}

type LoanDisplayItem = 
  | { type: 'single'; loan: Loan }
  | { type: 'hotspot_group'; group: GroupedHotspotLoan };

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [filterType, setFilterType] = useState<'all' | 'components' | 'projects' | 'hotspots' | 'urgent'>('all');
  const [searchQuery, setSearchQuery] = useState("");

  const [showLendModal, setShowLendModal] = useState(false);
  const [lendType, setLendType] = useState<'component' | 'project' | 'hotspot'>('component');
  const [returnLoanItem, setReturnLoanItem] = useState<Loan | null>(null);
  const [returningGroupId, setReturningGroupId] = useState<string | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());

  const { isOnline } = useNetworkState();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getLoans();
      setLoans(data);
    } catch (err) {
      console.error("Failed to load loans:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleReturnHotspotGroup = async (group: GroupedHotspotLoan) => {
    if (!confirm(`Return all ${group.loans.length} component(s) from "${group.rootHotspotLabel}" back to their original compartments?`)) return;
    setReturningGroupId(group.groupId);
    try {
      await returnHotspotLoan(group.groupId);
      await load();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to return hotspot loan.");
    } finally {
      setReturningGroupId(null);
    }
  };

  const activeLoans = loans.filter(l => !l.returned_at);
  const historyLoans = loans.filter(l => !!l.returned_at);

  const currentTabList = activeTab === 'active' ? activeLoans : historyLoans;

  // Group currentTabList into single loans vs grouped hotspot loans
  const displayItems = useMemo<LoanDisplayItem[]>(() => {
    const groupMap = new Map<string, GroupedHotspotLoan>();
    const singles: Loan[] = [];

    currentTabList.forEach(l => {
      const meta = parseHotspotLoanMeta(l.notes);
      if (meta) {
        const existing = groupMap.get(meta.groupId);
        if (existing) {
          existing.loans.push(l);
          existing.totalUnits += l.quantity;
        } else {
          groupMap.set(meta.groupId, {
            groupId: meta.groupId,
            rootHotspotId: meta.rootHotspotId,
            rootHotspotLabel: meta.rootHotspotLabel,
            cleanNotes: meta.cleanNotes,
            borrower_name: l.borrower_name,
            borrower_contact: l.borrower_contact,
            due_date: l.due_date,
            lent_at: l.lent_at,
            returned_at: l.returned_at,
            loans: [l],
            totalUnits: l.quantity
          });
        }
      } else {
        singles.push(l);
      }
    });

    const items: LoanDisplayItem[] = [
      ...Array.from(groupMap.values()).map(g => ({ type: 'hotspot_group' as const, group: g })),
      ...singles.map(s => ({ type: 'single' as const, loan: s }))
    ];

    // Sort by due date (most urgent first for active, most recent first for history)
    items.sort((a, b) => {
      const dueA = a.type === 'single' ? a.loan.due_date : a.group.due_date;
      const dueB = b.type === 'single' ? b.loan.due_date : b.group.due_date;
      return dueA.localeCompare(dueB);
    });

    return items;
  }, [currentTabList]);

  // Filter display items
  const filteredDisplayItems = useMemo(() => {
    return displayItems.filter(item => {
      // Filter Type
      if (item.type === 'single') {
        if (filterType === 'hotspots') return false;
        if (filterType === 'components' && item.loan.loan_type !== 'component') return false;
        if (filterType === 'projects' && item.loan.loan_type !== 'project') return false;
        if (filterType === 'urgent') {
          const days = calculateLoanDaysRemaining(item.loan.due_date);
          if (days > 1) return false;
        }
      } else {
        // Hotspot group
        if (filterType === 'components' || filterType === 'projects') return false;
        if (filterType === 'urgent') {
          const days = calculateLoanDaysRemaining(item.group.due_date);
          if (days > 1) return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        if (item.type === 'single') {
          const l = item.loan;
          const borrower = l.borrower_name.toLowerCase();
          const contact = (l.borrower_contact || "").toLowerCase();
          const compName = (l.component_name || l.component?.name || "").toLowerCase();
          const projName = (l.project_name || l.project?.name || "").toLowerCase();
          const loc = (l.source_location_label || "").toLowerCase();
          const notes = (l.notes || "").toLowerCase();
          return borrower.includes(q) || contact.includes(q) || compName.includes(q) || projName.includes(q) || loc.includes(q) || notes.includes(q);
        } else {
          const g = item.group;
          const borrower = g.borrower_name.toLowerCase();
          const contact = (g.borrower_contact || "").toLowerCase();
          const rootLabel = g.rootHotspotLabel.toLowerCase();
          const notes = g.cleanNotes.toLowerCase();
          const compMatch = g.loans.some(l => (l.component_name || l.component?.name || "").toLowerCase().includes(q));
          return borrower.includes(q) || contact.includes(q) || rootLabel.includes(q) || notes.includes(q) || compMatch;
        }
      }

      return true;
    });
  }, [displayItems, filterType, searchQuery]);

  return (
    <div className="flex flex-col h-full p-6 bg-brand-bg overflow-y-auto themed-scrollbar">
      
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[28px] font-bold tracking-widest text-white uppercase">LOANS & BORROWERS</h1>
          <p className="mt-1 text-[10px] tracking-[0.2em] text-brand-gold uppercase">
            Component, container hotspot, and project lending ledger with origin location tracking.
          </p>
        </div>

        {isOnline && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => {
                setLendType('hotspot');
                setShowLendModal(true);
              }}
              className="flex items-center px-3.5 py-2 bg-[#25221d] hover:bg-[#332e27] border border-amber-600/40 hover:border-amber-500 text-amber-300 hover:text-white text-xs font-bold uppercase tracking-wider rounded-sm transition-all shadow-sm"
            >
              <Layers className="h-4 w-4 mr-1.5 text-amber-400" /> Lend Hotspot
            </button>

            <button
              onClick={() => {
                setLendType('component');
                setShowLendModal(true);
              }}
              className="flex items-center px-3.5 py-2 bg-brand-accent hover:bg-brand-accent-hover text-white text-xs font-bold uppercase tracking-wider rounded-sm transition-colors shadow-sm"
            >
              <Package className="h-4 w-4 mr-1.5" /> Lend Component
            </button>

            <button
              onClick={() => {
                setLendType('project');
                setShowLendModal(true);
              }}
              className="flex items-center px-3.5 py-2 bg-[#25221d] hover:bg-[#332e27] border border-[#3e3830] text-zinc-200 hover:text-white text-xs font-bold uppercase tracking-wider rounded-sm transition-colors"
            >
              <Compass className="h-4 w-4 mr-1.5 text-brand-accent" /> Lend Project
            </button>
          </div>
        )}
      </div>

      {/* Tabs & Controls */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#332f2a] pb-4">
        {/* Main Tabs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`px-4 py-2 rounded-t text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'active'
                ? 'border-brand-accent text-white bg-[#1a1816]'
                : 'border-transparent text-brand-text-muted hover:text-white'
            }`}
          >
            <span>Active Loans</span>
            <span className="px-1.5 py-0.2 rounded-full bg-brand-accent/20 text-brand-accent text-[10px] font-mono">
              {activeLoans.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-t text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'history'
                ? 'border-brand-accent text-white bg-[#1a1816]'
                : 'border-transparent text-brand-text-muted hover:text-white'
            }`}
          >
            <span>Loan History</span>
            <span className="px-1.5 py-0.2 rounded-full bg-[#2a2622] text-zinc-400 text-[10px] font-mono">
              {historyLoans.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search borrower, item, or container..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#191715] border border-[#332f2a] rounded pl-8 pr-3 py-1.5 text-xs text-white placeholder-brand-text-muted focus:border-brand-accent focus:outline-none"
          />
        </div>
      </div>

      {/* Filter Pills */}
      {activeTab === 'active' && (
        <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
              filterType === 'all'
                ? 'bg-brand-accent text-white'
                : 'bg-[#191715] border border-[#332f2a] text-brand-text-muted hover:text-white'
            }`}
          >
            All Items
          </button>

          <button
            type="button"
            onClick={() => setFilterType('hotspots')}
            className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 ${
              filterType === 'hotspots'
                ? 'bg-amber-600 text-white'
                : 'bg-[#191715] border border-[#332f2a] text-amber-400 hover:text-white'
            }`}
          >
            <Layers className="h-3 w-3" />
            <span>Hotspots / Containers</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('components')}
            className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
              filterType === 'components'
                ? 'bg-brand-accent text-white'
                : 'bg-[#191715] border border-[#332f2a] text-brand-text-muted hover:text-white'
            }`}
          >
            Individual Components
          </button>

          <button
            type="button"
            onClick={() => setFilterType('projects')}
            className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors ${
              filterType === 'projects'
                ? 'bg-brand-accent text-white'
                : 'bg-[#191715] border border-[#332f2a] text-brand-text-muted hover:text-white'
            }`}
          >
            Projects
          </button>

          <button
            type="button"
            onClick={() => setFilterType('urgent')}
            className={`px-3 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1 ${
              filterType === 'urgent'
                ? 'bg-amber-600 text-white'
                : 'bg-[#191715] border border-amber-900/40 text-amber-400 hover:text-white'
            }`}
          >
            <Clock className="h-3 w-3" />
            <span>Due Soon / Overdue</span>
          </button>
        </div>
      )}

      {/* Content List */}
      {loading ? (
        <div className="text-brand-text-muted text-sm py-8 text-center">Loading loans...</div>
      ) : filteredDisplayItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-brand-text-muted border border-[#332f2a] rounded-lg bg-[#141211]">
          <CheckCircle2 className="h-8 w-8 text-emerald-500/50 mb-2" />
          <p className="text-sm font-medium text-white">No loans match the current filter.</p>
          <p className="text-xs text-brand-text-muted mt-1">
            {activeTab === 'active' 
              ? "All workshop components, containers, and projects are currently accounted for in storage." 
              : "No historical loan records found."}
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDisplayItems.map(item => {
            // Case 1: Hotspot Group Card
            if (item.type === 'hotspot_group') {
              const group = item.group;
              const daysRemaining = calculateLoanDaysRemaining(group.due_date);
              const isReturned = !!group.returned_at;
              const isOverdue = !isReturned && daysRemaining < 0;
              const isToday = !isReturned && daysRemaining === 0;
              const isTomorrow = !isReturned && daysRemaining === 1;
              const isExpanded = expandedGroupIds.has(group.groupId);

              return (
                <div 
                  key={`group-${group.groupId}`}
                  className={`bg-[#1a1816] border rounded-lg p-5 flex flex-col justify-between transition-all duration-200 relative overflow-hidden ${
                    isOverdue 
                      ? 'border-red-900/60 shadow-lg shadow-red-950/20' 
                      : isToday 
                      ? 'border-orange-900/60 shadow-lg shadow-orange-950/20' 
                      : isTomorrow 
                      ? 'border-amber-900/60 shadow-lg shadow-amber-950/20' 
                      : 'border-amber-700/40 hover:border-amber-500/70 shadow-sm'
                  }`}
                >
                  {/* Status Indicator Stripe */}
                  {!isReturned && (
                    <div className={`absolute top-0 left-0 w-1 h-full ${
                      isOverdue ? 'bg-red-500' : isToday ? 'bg-orange-500' : isTomorrow ? 'bg-amber-400' : 'bg-amber-500'
                    }`} />
                  )}

                  <div>
                    {/* Top Bar: Hotspot Badge & Due Status */}
                    <div className="flex justify-between items-start mb-3 gap-2 pl-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          <span>Hotspot Container</span>
                        </span>
                        <span className="text-xs font-serif text-white font-bold">
                          {group.totalUnits} units
                        </span>
                      </div>

                      {isReturned ? (
                        <span className="px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                          Returned
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold rounded flex items-center gap-1 ${
                          isOverdue 
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                            : isToday 
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                            : isTomorrow 
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                            : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                        }`}>
                          {isOverdue && <AlertTriangle className="h-3 w-3" />}
                          {isOverdue 
                            ? `Overdue by ${Math.abs(daysRemaining)}d` 
                            : isToday 
                            ? 'Due Today' 
                            : isTomorrow 
                            ? 'Due Tomorrow' 
                            : `Due in ${daysRemaining}d`}
                        </span>
                      )}
                    </div>

                    {/* Hotspot Name */}
                    <div className="pl-2 mb-3">
                      <h3 className="font-bold text-white text-base leading-snug flex items-center gap-1.5">
                        <span className="text-amber-400">📦</span>
                        <span>{group.rootHotspotLabel}</span>
                      </h3>
                      <p className="text-[10px] text-brand-gold uppercase tracking-wider mt-0.5 font-medium">
                        Contains {group.loans.length} component(s) • {group.totalUnits} units total
                      </p>
                    </div>

                    {/* Borrower Details */}
                    <div className="pl-2 space-y-1.5 text-xs text-zinc-300 mb-4 bg-[#141211] p-3 rounded border border-[#2a2622]">
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span className="font-semibold text-white truncate">{group.borrower_name}</span>
                      </div>

                      {group.borrower_contact && (
                        <div className="flex items-center gap-2 text-brand-text-muted">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{group.borrower_contact}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-brand-text-muted">
                        <Calendar className="h-3.5 w-3.5 shrink-0" />
                        <span>Due: <strong className="text-zinc-200">{new Date(group.due_date).toLocaleDateString()}</strong></span>
                        <span className="text-[10px] text-zinc-500">(Lent: {new Date(group.lent_at).toLocaleDateString()})</span>
                      </div>

                      {group.cleanNotes && (
                        <div className="flex items-start gap-2 text-[11px] text-zinc-400 pt-1 border-t border-[#22201d]">
                          <FileText className="h-3 w-3 shrink-0 mt-0.5 text-brand-gold" />
                          <span className="line-clamp-2 italic">{group.cleanNotes}</span>
                        </div>
                      )}
                    </div>

                    {/* Expandable Contents List */}
                    <div className="pl-2 mb-3">
                      <button
                        type="button"
                        onClick={() => toggleGroupExpanded(group.groupId)}
                        className="w-full flex items-center justify-between text-xs text-brand-text-muted hover:text-white p-2 rounded bg-[#161412] border border-[#2e2a25] transition-colors"
                      >
                        <span className="font-semibold text-[11px] uppercase tracking-wider text-amber-300">
                          {isExpanded ? "Hide Components" : `View ${group.loans.length} Components Inside`}
                        </span>
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>

                      {isExpanded && (
                        <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto themed-scrollbar p-1 border border-[#2a2622] rounded bg-[#121110]">
                          {group.loans.map(subLoan => (
                            <div key={subLoan.id} className="p-2 bg-[#171513] rounded border border-[#2e2a25] flex items-center justify-between text-xs">
                              <div className="min-w-0 pr-2">
                                <div className="font-bold text-white truncate">
                                  {subLoan.component_name || "Component"}
                                </div>
                                <div className="text-[10px] text-brand-text-muted truncate flex items-center gap-1">
                                  <MapPin className="h-2.5 w-2.5 text-brand-accent shrink-0" />
                                  <span>{subLoan.source_location_label || "Compartment"}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono text-brand-gold font-bold text-xs">{subLoan.quantity}x</span>
                                {!subLoan.returned_at && isOnline && (
                                  <button
                                    type="button"
                                    onClick={() => setReturnLoanItem(subLoan)}
                                    className="p-1 text-emerald-400 hover:text-white hover:bg-emerald-600/30 rounded border border-emerald-500/30 transition-colors"
                                    title="Return this item individually"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bottom Actions: Return Entire Hotspot */}
                  {!isReturned && isOnline && (
                    <div className="pt-3 border-t border-[#332f2a] flex justify-end pl-2">
                      <button
                        type="button"
                        disabled={returningGroupId === group.groupId}
                        onClick={() => handleReturnHotspotGroup(group)}
                        className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 rounded text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>{returningGroupId === group.groupId ? "Returning..." : "Return Entire Hotspot"}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            // Case 2: Single Loan Card
            const loan = item.loan;
            const isComponent = loan.loan_type === 'component';
            const itemName = isComponent 
              ? (loan.component_name || loan.component?.name || "Component")
              : (loan.project_name || loan.project?.name || "Project");

            const daysRemaining = calculateLoanDaysRemaining(loan.due_date);
            const isReturned = !!loan.returned_at;

            const isOverdue = !isReturned && daysRemaining < 0;
            const isToday = !isReturned && daysRemaining === 0;
            const isTomorrow = !isReturned && daysRemaining === 1;

            return (
              <div 
                key={loan.id} 
                className={`bg-[#1a1816] border rounded-lg p-5 flex flex-col justify-between transition-all duration-200 relative overflow-hidden ${
                  isOverdue 
                    ? 'border-red-900/60 shadow-lg shadow-red-950/20' 
                    : isToday 
                    ? 'border-orange-900/60 shadow-lg shadow-orange-950/20' 
                    : isTomorrow 
                    ? 'border-amber-900/60 shadow-lg shadow-amber-950/20' 
                    : 'border-[#332f2a] hover:border-[#4a443c]'
                }`}
              >
                {/* Status Indicator Stripe */}
                {!isReturned && (
                  <div className={`absolute top-0 left-0 w-1 h-full ${
                    isOverdue ? 'bg-red-500' : isToday ? 'bg-orange-500' : isTomorrow ? 'bg-amber-400' : 'bg-brand-accent'
                  }`} />
                )}

                <div>
                  {/* Top Bar: Item Badge & Due Status */}
                  <div className="flex justify-between items-start mb-3 gap-2 pl-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold rounded ${
                        isComponent ? 'bg-brand-accent/20 text-brand-accent' : 'bg-emerald-500/20 text-emerald-400'
                      }`}>
                        {loan.loan_type}
                      </span>
                      {loan.quantity > 1 && (
                        <span className="text-xs font-serif text-white font-bold">
                          {loan.quantity}x
                        </span>
                      )}
                    </div>

                    {isReturned ? (
                      <span className="px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                        Returned
                      </span>
                    ) : (
                      <span className={`px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold rounded flex items-center gap-1 ${
                        isOverdue 
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                          : isToday 
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                          : isTomorrow 
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' 
                          : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      }`}>
                        {isOverdue && <AlertTriangle className="h-3 w-3" />}
                        {isOverdue 
                          ? `Overdue by ${Math.abs(daysRemaining)}d` 
                          : isToday 
                          ? 'Due Today' 
                          : isTomorrow 
                          ? 'Due Tomorrow' 
                          : `Due in ${daysRemaining}d`}
                      </span>
                    )}
                  </div>

                  {/* Item Name */}
                  <div className="pl-2 mb-3">
                    <h3 className="font-bold text-white text-base leading-snug">
                      {isComponent && loan.component_id ? (
                        <Link href={`/inventory/${loan.component_id}`} className="hover:text-brand-accent transition-colors">
                          {itemName}
                        </Link>
                      ) : !isComponent && loan.project_id ? (
                        <Link href={`/projects/${loan.project_id}`} className="hover:text-brand-accent transition-colors">
                          {itemName}
                        </Link>
                      ) : (
                        itemName
                      )}
                    </h3>
                  </div>

                  {/* Borrower Details */}
                  <div className="pl-2 space-y-1.5 text-xs text-zinc-300 mb-4 bg-[#141211] p-3 rounded border border-[#2a2622]">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-brand-accent shrink-0" />
                      <span className="font-semibold text-white truncate">{loan.borrower_name}</span>
                    </div>

                    {loan.borrower_contact && (
                      <div className="flex items-center gap-2 text-brand-text-muted">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{loan.borrower_contact}</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-brand-text-muted">
                      <Calendar className="h-3.5 w-3.5 shrink-0" />
                      <span>Due: <strong className="text-zinc-200">{new Date(loan.due_date).toLocaleDateString()}</strong></span>
                      <span className="text-[10px] text-zinc-500">(Lent: {new Date(loan.lent_at).toLocaleDateString()})</span>
                    </div>

                    {loan.notes && (
                      <div className="flex items-start gap-2 text-[11px] text-zinc-400 pt-1 border-t border-[#22201d]">
                        <FileText className="h-3 w-3 shrink-0 mt-0.5 text-brand-gold" />
                        <span className="line-clamp-2 italic">{loan.notes}</span>
                      </div>
                    )}
                  </div>

                  {/* Origin Location */}
                  <div className="pl-2 mb-4 text-xs text-brand-text-muted flex items-start gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-brand-gold block font-semibold">
                        Taken From (Enforced Origin):
                      </span>
                      <span className="text-zinc-200 font-medium">
                        {loan.source_location_label || "Storage Compartment"}
                      </span>
                    </div>
                  </div>

                  {/* Return Location (History tab) */}
                  {isReturned && loan.returned_location_label && (
                    <div className="pl-2 mb-4 text-xs text-brand-text-muted flex items-start gap-1.5 pt-2 border-t border-[#26221e]">
                      <RotateCcw className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] uppercase tracking-wider text-emerald-400 block font-semibold">
                          Returned To:
                        </span>
                        <span className="text-zinc-200 font-medium">
                          {loan.returned_location_label} ({new Date(loan.returned_at!).toLocaleDateString()})
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                {!isReturned && isOnline && (
                  <div className="pt-3 border-t border-[#332f2a] flex justify-end pl-2">
                    <button
                      type="button"
                      onClick={() => setReturnLoanItem(loan)}
                      className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 rounded text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Return Item</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showLendModal && (
        <LendModal
          isOpen={showLendModal}
          initialType={lendType}
          onClose={() => setShowLendModal(false)}
          onSuccess={() => {
            setShowLendModal(false);
            load();
          }}
        />
      )}

      {returnLoanItem && (
        <ReturnLoanModal
          loan={returnLoanItem}
          isOpen={!!returnLoanItem}
          onClose={() => setReturnLoanItem(null)}
          onSuccess={() => {
            setReturnLoanItem(null);
            load();
          }}
        />
      )}

    </div>
  );
}
