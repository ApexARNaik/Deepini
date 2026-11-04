"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getLoans, Loan, calculateLoanDaysRemaining, parseHotspotLoanMeta, returnHotspotLoan, GroupedHotspotLoan, returnLentComponent } from "@/lib/api";
import { LendModal } from "@/components/loans/LendModal";
import { ReturnLoanModal } from "@/components/loans/ReturnLoanModal";
import { EditLoanModal } from "@/components/loans/EditLoanModal";
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
  ChevronUp,
  Pencil,
  Users
} from "lucide-react";
import Link from "next/link";
import { useNetworkState } from "@/hooks/useNetworkState";

type LoanDisplayItem = 
  | { type: 'single'; loan: Loan }
  | { type: 'hotspot_group'; group: GroupedHotspotLoan };

interface BorrowerGroup {
  key: string;
  name: string;
  contact?: string;
  items: LoanDisplayItem[];
  totalItems: number;
  totalUnits: number;
  earliestDueDate: string;
  daysRemaining: number;
  isOverdue: boolean;
  isToday: boolean;
  isTomorrow: boolean;
  isReturned: boolean;
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [filterType, setFilterType] = useState<'all' | 'components' | 'projects' | 'hotspots' | 'urgent'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<'grouped' | 'individual'>('grouped');

  const [showLendModal, setShowLendModal] = useState(false);
  const [lendType, setLendType] = useState<'component' | 'project' | 'hotspot'>('component');
  const [returnLoanItem, setReturnLoanItem] = useState<Loan | null>(null);
  const [returningGroupId, setReturningGroupId] = useState<string | null>(null);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [editingTarget, setEditingTarget] = useState<LoanDisplayItem | null>(null);

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

  const handleReturnAllForBorrower = async (bGroup: BorrowerGroup) => {
    const unreturnedItems = bGroup.items.filter(item => 
      item.type === 'hotspot_group' ? !item.group.returned_at : !item.loan.returned_at
    );
    if (unreturnedItems.length === 0) return;

    if (!confirm(`Return all ${unreturnedItems.length} active item(s) (${bGroup.totalUnits} total units) lent to "${bGroup.name}" back to their original storage locations?`)) {
      return;
    }

    setLoading(true);
    try {
      for (const item of unreturnedItems) {
        if (item.type === 'hotspot_group') {
          await returnHotspotLoan(item.group.groupId);
        } else if (item.loan.source_location_id) {
          await returnLentComponent(item.loan.id, item.loan.source_location_id);
        }
      }
      await load();
    } catch (err: any) {
      console.error("Failed to return all borrower items:", err);
      alert(err.message || "Failed to return some items.");
      await load();
    } finally {
      setLoading(false);
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

  // Compute counts for filter pills based on the currently selected tab
  const filterCounts = useMemo(() => {
    let hotspots = 0;
    let components = 0;
    let projects = 0;
    let urgent = 0;

    displayItems.forEach(item => {
      if (item.type === 'hotspot_group') {
        hotspots++;
        const days = calculateLoanDaysRemaining(item.group.due_date);
        if (days <= 1 && !item.group.returned_at) urgent++;
      } else {
        if (item.loan.loan_type === 'component') components++;
        if (item.loan.loan_type === 'project') projects++;
        const days = calculateLoanDaysRemaining(item.loan.due_date);
        if (days <= 1 && !item.loan.returned_at) urgent++;
      }
    });

    return { total: displayItems.length, hotspots, components, projects, urgent };
  }, [displayItems]);

  // Filter display items
  const filteredDisplayItems = useMemo(() => {
    return displayItems.filter(item => {
      // Filter Type
      if (item.type === 'single') {
        if (filterType === 'hotspots') return false;
        if (filterType === 'components' && item.loan.loan_type !== 'component') return false;
        if (filterType === 'projects' && item.loan.loan_type !== 'project') return false;
        if (filterType === 'urgent') {
          if (item.loan.returned_at) return false;
          const days = calculateLoanDaysRemaining(item.loan.due_date);
          if (days > 1) return false;
        }
      } else {
        // Hotspot group
        if (filterType === 'components' || filterType === 'projects') return false;
        if (filterType === 'urgent') {
          if (item.group.returned_at) return false;
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

  // Group filteredDisplayItems by Borrower
  const borrowerGroups = useMemo<BorrowerGroup[]>(() => {
    const map = new Map<string, BorrowerGroup>();

    filteredDisplayItems.forEach((item) => {
      const name = (item.type === 'single' ? item.loan.borrower_name : item.group.borrower_name) || "Unknown Borrower";
      const contact = item.type === 'single' ? item.loan.borrower_contact : item.group.borrower_contact;
      const dueDate = item.type === 'single' ? item.loan.due_date : item.group.due_date;
      const isRet = item.type === 'single' ? !!item.loan.returned_at : !!item.group.returned_at;
      const units = item.type === 'single' ? item.loan.quantity : item.group.totalUnits;

      const key = name.trim().toLowerCase();
      const existing = map.get(key);

      if (existing) {
        existing.items.push(item);
        existing.totalItems += 1;
        existing.totalUnits += units;
        if (!existing.contact && contact) existing.contact = contact;
        if (!isRet && (!existing.earliestDueDate || dueDate < existing.earliestDueDate)) {
          existing.earliestDueDate = dueDate;
        }
        if (!isRet) existing.isReturned = false;
      } else {
        map.set(key, {
          key,
          name,
          contact: contact || undefined,
          items: [item],
          totalItems: 1,
          totalUnits: units,
          earliestDueDate: dueDate,
          daysRemaining: calculateLoanDaysRemaining(dueDate),
          isOverdue: false,
          isToday: false,
          isTomorrow: false,
          isReturned: isRet,
        });
      }
    });

    const groups = Array.from(map.values()).map((g) => {
      const days = calculateLoanDaysRemaining(g.earliestDueDate);
      return {
        ...g,
        daysRemaining: days,
        isOverdue: !g.isReturned && days < 0,
        isToday: !g.isReturned && days === 0,
        isTomorrow: !g.isReturned && days === 1,
      };
    });

    groups.sort((a, b) => {
      if (activeTab === 'active') {
        return a.earliestDueDate.localeCompare(b.earliestDueDate);
      } else {
        return b.earliestDueDate.localeCompare(a.earliestDueDate);
      }
    });

    return groups;
  }, [filteredDisplayItems, activeTab]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-2">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#332f2a]">
        {/* Main Tabs (flush with border-b) */}
        <div className="flex items-center gap-2 -mb-px">
          <button
            type="button"
            onClick={() => {
              setActiveTab('active');
              setFilterType('all');
            }}
            className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'active'
                ? 'border-brand-accent text-white font-semibold'
                : 'border-transparent text-brand-text-muted hover:text-white'
            }`}
          >
            <span>Active Loans</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeTab === 'active'
                ? 'bg-brand-accent/20 text-brand-accent'
                : 'bg-[#2a2622] text-zinc-400'
            }`}>
              {activeLoans.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('history');
              setFilterType('all');
            }}
            className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'history'
                ? 'border-brand-accent text-white font-semibold'
                : 'border-transparent text-brand-text-muted hover:text-white'
            }`}
          >
            <span>Loan History</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeTab === 'history'
                ? 'bg-brand-accent/20 text-brand-accent'
                : 'bg-[#2a2622] text-zinc-400'
            }`}>
              {historyLoans.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72 pb-3 sm:pb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search borrower, item, or container..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#191715] border border-[#332f2a] rounded pl-8 pr-3 py-1.5 text-xs text-white placeholder-brand-text-muted focus:border-brand-accent focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Filter Pills and View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-1">
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 ${
              filterType === 'all'
                ? 'bg-brand-accent text-white shadow-sm'
                : 'bg-[#191715] border border-[#332f2a] text-brand-text-muted hover:text-white hover:border-[#4a443c]'
            }`}
          >
            <span>All Items</span>
            <span className="text-[10px] opacity-75 font-mono">({filterCounts.total})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('hotspots')}
            className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 ${
              filterType === 'hotspots'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-[#191715] border border-[#332f2a] text-amber-400 hover:text-white hover:border-amber-600/50'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Hotspots / Containers</span>
            <span className="text-[10px] opacity-75 font-mono">({filterCounts.hotspots})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('components')}
            className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 ${
              filterType === 'components'
                ? 'bg-brand-accent text-white shadow-sm'
                : 'bg-[#191715] border border-[#332f2a] text-brand-text-muted hover:text-white hover:border-[#4a443c]'
            }`}
          >
            <Package className="h-3.5 w-3.5" />
            <span>Components</span>
            <span className="text-[10px] opacity-75 font-mono">({filterCounts.components})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('projects')}
            className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 ${
              filterType === 'projects'
                ? 'bg-brand-accent text-white shadow-sm'
                : 'bg-[#191715] border border-[#332f2a] text-brand-text-muted hover:text-white hover:border-[#4a443c]'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Projects</span>
            <span className="text-[10px] opacity-75 font-mono">({filterCounts.projects})</span>
          </button>

          {activeTab === 'active' && filterCounts.urgent > 0 && (
            <button
              type="button"
              onClick={() => setFilterType('urgent')}
              className={`px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 ${
                filterType === 'urgent'
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-[#191715] border border-red-900/40 text-red-400 hover:text-white hover:border-red-600/50'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Due Soon / Overdue</span>
              <span className="text-[10px] opacity-75 font-mono">({filterCounts.urgent})</span>
            </button>
          )}
        </div>

        {/* View Switcher: Group by Person vs Individual Items */}
        <div className="flex items-center bg-[#141210] border border-[#332f2a] rounded p-0.5 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('grouped')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-all ${
              viewMode === 'grouped'
                ? 'bg-brand-accent text-white shadow-sm'
                : 'text-brand-text-muted hover:text-white'
            }`}
            title="Group all lends of a person together"
          >
            <Users className="h-3.5 w-3.5" />
            <span>By Person ({borrowerGroups.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('individual')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-all ${
              viewMode === 'individual'
                ? 'bg-brand-accent text-white shadow-sm'
                : 'text-brand-text-muted hover:text-white'
            }`}
            title="Show individual item cards"
          >
            <Package className="h-3.5 w-3.5" />
            <span>Individual ({filteredDisplayItems.length})</span>
          </button>
        </div>
      </div>

      {/* Content List */}
      {loading ? (
        <div className="text-brand-text-muted text-sm py-12 text-center">Loading loans...</div>
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
      ) : viewMode === 'grouped' ? (
        /* Grouped by Borrower View */
        <div className="space-y-4">
          {borrowerGroups.map((bGroup) => (
            <div
              key={`borrower-${bGroup.key}`}
              className={`bg-[#1a1816] border rounded-xl p-5 flex flex-col justify-between transition-all duration-200 relative overflow-hidden shadow-md ${
                bGroup.isOverdue
                  ? 'border-red-900/60 shadow-red-950/20'
                  : bGroup.isToday
                  ? 'border-orange-900/60 shadow-orange-950/20'
                  : bGroup.isTomorrow
                  ? 'border-amber-900/60 shadow-amber-950/20'
                  : 'border-[#332f2a] hover:border-[#4a443c]'
              }`}
            >
              {/* Status Indicator Stripe */}
              {!bGroup.isReturned && (
                <div className={`absolute top-0 left-0 w-1.5 h-full ${
                  bGroup.isOverdue ? 'bg-red-500' : bGroup.isToday ? 'bg-orange-500' : bGroup.isTomorrow ? 'bg-amber-400' : 'bg-brand-accent'
                }`} />
              )}

              <div>
                {/* Borrower Header */}
                <div className="pl-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#2d2924]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${
                      bGroup.isOverdue
                        ? 'bg-red-500/10 border-red-500/30 text-red-400'
                        : 'bg-brand-accent/15 border-brand-accent/30 text-brand-accent'
                    }`}>
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-white tracking-wide truncate">
                          {bGroup.name}
                        </h2>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#141210] text-brand-gold border border-[#2d2924]">
                          {bGroup.totalItems} {bGroup.totalItems === 1 ? 'item' : 'items'} ({bGroup.totalUnits} {bGroup.totalUnits === 1 ? 'unit' : 'units'})
                        </span>
                      </div>
                      {bGroup.contact && (
                        <p className="text-xs text-brand-text-muted flex items-center gap-1.5 mt-0.5 truncate">
                          <Phone className="h-3 w-3 text-brand-gold shrink-0" />
                          <span className="truncate">{bGroup.contact}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Due Status & Return All */}
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                    {bGroup.isReturned ? (
                      <span className="px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                        All Returned
                      </span>
                    ) : (
                      <span className={`px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded flex items-center gap-1.5 ${
                        bGroup.isOverdue
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : bGroup.isToday
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : bGroup.isTomorrow
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      }`}>
                        {bGroup.isOverdue && <AlertTriangle className="h-3 w-3" />}
                        {bGroup.isOverdue
                          ? `Overdue by ${Math.abs(bGroup.daysRemaining)}d`
                          : bGroup.isToday
                          ? 'Due Today'
                          : bGroup.isTomorrow
                          ? 'Due Tomorrow'
                          : `Due in ${bGroup.daysRemaining}d`}
                      </span>
                    )}

                    {!bGroup.isReturned && isOnline && (
                      <button
                        type="button"
                        onClick={() => handleReturnAllForBorrower(bGroup)}
                        className="px-3.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shadow-sm"
                        title={`Return all ${bGroup.totalItems} item(s) lent to ${bGroup.name}`}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>Return All ({bGroup.totalItems})</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* List of items borrowed by this person */}
                <div className="pl-2 pt-3.5 space-y-2.5">
                  {bGroup.items.map((item) => {
                    if (item.type === 'hotspot_group') {
                      const group = item.group;
                      const groupDays = calculateLoanDaysRemaining(group.due_date);
                      const isRet = !!group.returned_at;
                      const groupOverdue = !isRet && groupDays < 0;
                      const groupToday = !isRet && groupDays === 0;
                      const groupTomorrow = !isRet && groupDays === 1;
                      const isExp = expandedGroupIds.has(group.groupId);

                      return (
                        <div
                          key={`b-item-hs-${group.groupId}`}
                          className="p-3.5 bg-[#141210] border border-amber-600/30 hover:border-amber-500/60 rounded-lg transition-colors space-y-2.5"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="p-1.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                                <Layers className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-white text-sm truncate">
                                    {group.rootHotspotLabel}
                                  </span>
                                  <span className="px-1.5 py-0.2 text-[9px] uppercase tracking-wider font-bold rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                                    Hotspot Container
                                  </span>
                                </div>
                                <p className="text-[11px] text-brand-gold font-mono mt-0.5">
                                  {group.loans.length} components • {group.totalUnits} units total
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              {isRet ? (
                                <span className="px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold rounded bg-zinc-800 text-zinc-400">
                                  Returned
                                </span>
                              ) : (
                                <span className={`px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold rounded ${
                                  groupOverdue ? 'bg-red-500/20 text-red-400' : groupToday ? 'bg-orange-500/20 text-orange-400' : groupTomorrow ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-300'
                                }`}>
                                  Due {new Date(group.due_date).toLocaleDateString()}
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={() => toggleGroupExpanded(group.groupId)}
                                className="px-2 py-1 bg-[#1e1c19] hover:bg-[#282521] text-zinc-300 hover:text-white border border-[#38332c] rounded text-[11px] font-medium flex items-center gap-1 transition-colors"
                              >
                                <span>{isExp ? "Hide" : "View"} {group.loans.length} items</span>
                                {isExp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              </button>

                              <button
                                type="button"
                                onClick={() => setEditingTarget({ type: 'hotspot_group', group })}
                                className="p-1.5 bg-[#1e1c19] hover:bg-[#282521] text-zinc-300 hover:text-white border border-[#38332c] hover:border-brand-gold/60 rounded transition-colors"
                                title="Edit loan details"
                              >
                                <Pencil className="h-3 w-3 text-amber-400" />
                              </button>

                              {!isRet && isOnline && (
                                <button
                                  type="button"
                                  disabled={returningGroupId === group.groupId}
                                  onClick={() => handleReturnHotspotGroup(group)}
                                  className="px-2.5 py-1 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/30 rounded text-xs font-semibold uppercase tracking-wider flex items-center gap-1 transition-colors disabled:opacity-50"
                                  title="Return this entire container"
                                >
                                  <RotateCcw className="h-3 w-3" />
                                  <span>{returningGroupId === group.groupId ? "Returning..." : "Return"}</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Expanded Hotspot Components List */}
                          {isExp && (
                            <div className="pt-2 border-t border-[#2d2924] space-y-1.5 pl-2">
                              {group.loans.map((subLoan) => (
                                <div
                                  key={subLoan.id}
                                  className="flex items-center justify-between text-xs py-1 border-b border-[#22201d] last:border-b-0"
                                >
                                  <div className="flex items-center gap-2 min-w-0 pr-2">
                                    <span className="font-mono text-brand-gold font-bold shrink-0">{subLoan.quantity}x</span>
                                    {subLoan.component_id ? (
                                      <Link
                                        href={`/inventory/${subLoan.component_id}`}
                                        className="font-medium text-white hover:text-brand-accent transition-colors truncate"
                                      >
                                        {subLoan.component_name || subLoan.component?.name || "Component"}
                                      </Link>
                                    ) : (
                                      <span className="font-medium text-white truncate">
                                        {subLoan.component_name || subLoan.component?.name || "Component"}
                                      </span>
                                    )}
                                    {subLoan.source_location_label && (
                                      <span className="text-[10px] text-brand-text-muted truncate hidden md:inline">
                                        ({subLoan.source_location_label})
                                      </span>
                                    )}
                                  </div>

                                  {!subLoan.returned_at && isOnline && (
                                    <button
                                      type="button"
                                      onClick={() => setReturnLoanItem(subLoan)}
                                      className="p-1 text-emerald-400 hover:text-white hover:bg-emerald-600/30 rounded border border-emerald-500/30 transition-colors shrink-0"
                                      title="Return this item individually"
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Single Loan (Component or Project)
                    const loan = item.loan;
                    const isComp = loan.loan_type === 'component';
                    const itmName = isComp
                      ? (loan.component_name || loan.component?.name || "Component")
                      : (loan.project_name || loan.project?.name || "Project");
                    const loanDays = calculateLoanDaysRemaining(loan.due_date);
                    const isRet = !!loan.returned_at;
                    const loanOverdue = !isRet && loanDays < 0;
                    const loanToday = !isRet && loanDays === 0;
                    const loanTomorrow = !isRet && loanDays === 1;

                    return (
                      <div
                        key={`b-item-single-${loan.id}`}
                        className="p-3.5 bg-[#141210] border border-[#2e2a25] hover:border-[#423d34] rounded-lg transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className={`p-1.5 rounded shrink-0 ${
                            isComp ? 'bg-brand-accent/20 text-brand-accent' : 'bg-emerald-500/20 text-emerald-400'
                          }`}>
                            {isComp ? <Package className="h-4 w-4" /> : <Compass className="h-4 w-4" />}
                          </span>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {isComp && loan.component_id ? (
                                <Link
                                  href={`/inventory/${loan.component_id}`}
                                  className="font-bold text-white text-sm hover:text-brand-accent transition-colors truncate"
                                >
                                  {itmName}
                                </Link>
                              ) : !isComp && loan.project_id ? (
                                <Link
                                  href={`/projects/${loan.project_id}`}
                                  className="font-bold text-white text-sm hover:text-brand-accent transition-colors truncate"
                                >
                                  {itmName}
                                </Link>
                              ) : (
                                <span className="font-bold text-white text-sm truncate">{itmName}</span>
                              )}

                              {loan.quantity > 1 && (
                                <span className="text-xs font-mono font-bold text-brand-gold">
                                  {loan.quantity}x
                                </span>
                              )}

                              <span className={`px-1.5 py-0.2 text-[9px] uppercase tracking-wider font-bold rounded ${
                                isComp ? 'bg-brand-accent/15 text-brand-accent' : 'bg-emerald-500/15 text-emerald-400'
                              }`}>
                                {loan.loan_type}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-brand-text-muted mt-0.5 flex-wrap">
                              {loan.source_location_label && (
                                <span className="flex items-center gap-1 text-zinc-400 truncate">
                                  <MapPin className="h-3 w-3 text-amber-400 shrink-0" />
                                  <span className="truncate">{loan.source_location_label}</span>
                                </span>
                              )}
                              {loan.notes && (
                                <span className="flex items-center gap-1 italic text-zinc-400 truncate max-w-[200px]">
                                  <FileText className="h-2.5 w-2.5 text-brand-gold shrink-0" />
                                  <span className="truncate">{loan.notes}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {isRet ? (
                            <span className="px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold rounded bg-zinc-800 text-zinc-400">
                              Returned
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold rounded ${
                              loanOverdue ? 'bg-red-500/20 text-red-400' : loanToday ? 'bg-orange-500/20 text-orange-400' : loanTomorrow ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-300'
                            }`}>
                              Due {new Date(loan.due_date).toLocaleDateString()}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={() => setEditingTarget({ type: 'single', loan })}
                            className="p-1.5 bg-[#1e1c19] hover:bg-[#282521] text-zinc-300 hover:text-white border border-[#38332c] hover:border-brand-gold/60 rounded transition-colors"
                            title="Edit loan details"
                          >
                            <Pencil className="h-3 w-3 text-brand-gold" />
                          </button>

                          {!isRet && isOnline && (
                            <button
                              type="button"
                              onClick={() => setReturnLoanItem(loan)}
                              className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 rounded text-xs font-semibold uppercase tracking-wider flex items-center gap-1 transition-colors"
                              title="Return this item"
                            >
                              <RotateCcw className="h-3 w-3" />
                              <span>Return</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
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

                  {/* Bottom Actions: Edit & Return Entire Hotspot */}
                  <div className="pt-3 border-t border-[#332f2a] flex items-center justify-between pl-2">
                    <button
                      type="button"
                      onClick={() => setEditingTarget({ type: 'hotspot_group', group })}
                      className="px-3 py-1.5 bg-[#201d1a] hover:bg-[#2c2823] text-zinc-300 hover:text-white border border-[#38332c] hover:border-brand-gold/60 rounded text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                      title="Edit borrower details, due date, or notes"
                    >
                      <Pencil className="h-3.5 w-3.5 text-amber-400" />
                      <span>Edit</span>
                    </button>

                    {!isReturned && isOnline && (
                      <button
                        type="button"
                        disabled={returningGroupId === group.groupId}
                        onClick={() => handleReturnHotspotGroup(group)}
                        className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 rounded text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>{returningGroupId === group.groupId ? "Returning..." : "Return Entire Hotspot"}</span>
                      </button>
                    )}
                  </div>
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

                {/* Bottom Actions: Edit & Return Item */}
                <div className="pt-3 border-t border-[#332f2a] flex items-center justify-between pl-2">
                  <button
                    type="button"
                    onClick={() => setEditingTarget({ type: 'single', loan })}
                    className="px-3 py-1.5 bg-[#201d1a] hover:bg-[#2c2823] text-zinc-300 hover:text-white border border-[#38332c] hover:border-brand-gold/60 rounded text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                    title="Edit borrower details, due date, or notes"
                  >
                    <Pencil className="h-3.5 w-3.5 text-brand-gold" />
                    <span>Edit</span>
                  </button>

                  {!isReturned && isOnline && (
                    <button
                      type="button"
                      onClick={() => setReturnLoanItem(loan)}
                      className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 rounded text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Return Item</span>
                    </button>
                  )}
                </div>
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

      {editingTarget && (
        <EditLoanModal
          isOpen={!!editingTarget}
          loan={editingTarget.type === 'single' ? editingTarget.loan : null}
          group={editingTarget.type === 'hotspot_group' ? editingTarget.group : null}
          onClose={() => setEditingTarget(null)}
          onSuccess={() => {
            setEditingTarget(null);
            load();
          }}
        />
      )}

    </div>
  );
}
