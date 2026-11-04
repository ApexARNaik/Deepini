"use client";

import React, { useState, useEffect } from "react";
import { Loan, GroupedHotspotLoan, updateLoan, updateHotspotLoanGroup } from "@/lib/api";
import { 
  X, 
  User, 
  Phone, 
  Calendar, 
  FileText, 
  Pencil, 
  Loader2, 
  Package, 
  Compass, 
  Layers, 
  Clock,
  AlertCircle,
  MapPin
} from "lucide-react";

interface EditLoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  loan?: Loan | null;
  group?: GroupedHotspotLoan | null;
}

export function EditLoanModal({
  isOpen,
  onClose,
  onSuccess,
  loan,
  group
}: EditLoanModalProps) {
  const [borrowerName, setBorrowerName] = useState("");
  const [borrowerContact, setBorrowerContact] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize fields whenever modal opens or loan/group changes
  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    if (group) {
      setBorrowerName(group.borrower_name || "");
      setBorrowerContact(group.borrower_contact || "");
      setDueDate(group.due_date ? group.due_date.split('T')[0] : "");
      setNotes(group.cleanNotes || "");
    } else if (loan) {
      setBorrowerName(loan.borrower_name || "");
      setBorrowerContact(loan.borrower_contact || "");
      setDueDate(loan.due_date ? loan.due_date.split('T')[0] : "");
      setNotes(loan.notes || "");
    }
  }, [isOpen, loan, group]);

  if (!isOpen || (!loan && !group)) return null;

  // Extension helper: adds days from current due date (or today)
  const addDaysToDueDate = (days: number) => {
    const baseDate = dueDate ? new Date(dueDate) : new Date();
    // In case of invalid date, fallback to now
    const validBase = isNaN(baseDate.getTime()) ? new Date() : baseDate;
    validBase.setDate(validBase.getDate() + days);
    const yyyy = validBase.getFullYear();
    const mm = String(validBase.getMonth() + 1).padStart(2, '0');
    const dd = String(validBase.getDate()).padStart(2, '0');
    setDueDate(`${yyyy}-${mm}-${dd}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!borrowerName.trim()) {
      setError("Borrower name is required.");
      return;
    }
    if (!dueDate) {
      setError("Due date is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (group) {
        await updateHotspotLoanGroup(group.groupId, {
          borrower_name: borrowerName.trim(),
          borrower_contact: borrowerContact.trim() || null,
          due_date: dueDate,
          cleanNotes: notes.trim() || null
        });
      } else if (loan) {
        await updateLoan(loan.id, {
          borrower_name: borrowerName.trim(),
          borrower_contact: borrowerContact.trim() || null,
          due_date: dueDate,
          notes: notes.trim() || null
        });
      }
      onSuccess();
    } catch (err: any) {
      console.error("Failed to update loan:", err);
      setError(err.message || "Failed to save loan updates. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const isGroup = !!group;
  const isComponent = loan?.loan_type === 'component';
  const itemName = isGroup 
    ? group.rootHotspotLabel 
    : isComponent 
    ? (loan?.component_name || loan?.component?.name || "Component")
    : (loan?.project_name || loan?.project?.name || "Project");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-[#191715] border border-[#3e3830] rounded-lg shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2e2a25] flex items-center justify-between bg-[#1f1c19]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Pencil className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-serif text-base font-bold text-white uppercase tracking-wider">
                Edit Loan Details
              </h2>
              <p className="text-[10px] uppercase tracking-widest text-brand-gold">
                {isGroup ? "Container Hotspot Loan" : isComponent ? "Component Loan" : "Project Loan"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-brand-text-muted hover:text-white p-1 rounded hover:bg-[#2b2722] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Item Summary Card */}
        <div className="p-6 pb-2">
          <div className="bg-[#141210] border border-[#2e2a25] rounded p-3 flex items-start gap-3">
            <div className="p-2 rounded bg-[#24211e] text-brand-gold shrink-0 mt-0.5">
              {isGroup ? (
                <Layers className="h-5 w-5 text-amber-400" />
              ) : isComponent ? (
                <Package className="h-5 w-5 text-brand-accent" />
              ) : (
                <Compass className="h-5 w-5 text-emerald-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold rounded ${
                  isGroup 
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' 
                    : isComponent 
                    ? 'bg-brand-accent/20 text-brand-accent' 
                    : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {isGroup ? "Hotspot Container" : loan?.loan_type}
                </span>
                {!isGroup && loan && loan.quantity > 1 && (
                  <span className="text-xs font-mono font-bold text-white">
                    {loan.quantity}x
                  </span>
                )}
                {isGroup && (
                  <span className="text-xs font-mono font-bold text-brand-gold">
                    {group.loans.length} components ({group.totalUnits} units)
                  </span>
                )}
              </div>
              <h3 className="text-sm font-bold text-white truncate">
                {itemName}
              </h3>
              {!isGroup && loan?.source_location_label && (
                <p className="text-[10px] text-brand-text-muted truncate mt-0.5 flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5 text-brand-gold" />
                  <span>Origin: {loan.source_location_label}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 pt-3 space-y-4">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Borrower Name */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-brand-gold mb-1.5 flex items-center gap-1.5">
              <User className="h-3 w-3" />
              <span>Borrower Name *</span>
            </label>
            <input
              type="text"
              required
              value={borrowerName}
              onChange={(e) => setBorrowerName(e.target.value)}
              placeholder="e.g. Alex Rivera, Student Lab Team A..."
              className="w-full bg-[#141210] border border-[#332f2a] rounded px-3 py-2 text-xs text-white placeholder-brand-text-muted focus:outline-none focus:border-brand-accent transition-colors"
            />
          </div>

          {/* Borrower Contact */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <Phone className="h-3 w-3 text-brand-gold" />
              <span>Contact Info (Phone, Telegram, Email)</span>
            </label>
            <input
              type="text"
              value={borrowerContact}
              onChange={(e) => setBorrowerContact(e.target.value)}
              placeholder="e.g. +1 555-0199 or @alexrivera"
              className="w-full bg-[#141210] border border-[#332f2a] rounded px-3 py-2 text-xs text-white placeholder-brand-text-muted focus:outline-none focus:border-brand-accent transition-colors"
            />
          </div>

          {/* Due Date & Extension Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] uppercase tracking-wider font-semibold text-brand-gold flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                <span>Due Date *</span>
              </label>
              <span className="text-[10px] text-brand-text-muted flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                Quick extend:
              </span>
            </div>

            <div className="space-y-2">
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-[#141210] border border-[#332f2a] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-accent transition-colors [color-scheme:dark]"
              />

              {/* Quick Extension Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => addDaysToDueDate(3)}
                  className="px-2.5 py-1 rounded bg-[#201d1a] hover:bg-[#2c2823] border border-[#38332c] hover:border-brand-gold/60 text-[10px] font-semibold text-zinc-300 hover:text-white transition-colors"
                >
                  +3 Days
                </button>
                <button
                  type="button"
                  onClick={() => addDaysToDueDate(7)}
                  className="px-2.5 py-1 rounded bg-[#201d1a] hover:bg-[#2c2823] border border-[#38332c] hover:border-brand-gold/60 text-[10px] font-semibold text-zinc-300 hover:text-white transition-colors"
                >
                  +1 Week
                </button>
                <button
                  type="button"
                  onClick={() => addDaysToDueDate(14)}
                  className="px-2.5 py-1 rounded bg-[#201d1a] hover:bg-[#2c2823] border border-[#38332c] hover:border-brand-gold/60 text-[10px] font-semibold text-zinc-300 hover:text-white transition-colors"
                >
                  +2 Weeks
                </button>
                <button
                  type="button"
                  onClick={() => addDaysToDueDate(30)}
                  className="px-2.5 py-1 rounded bg-[#201d1a] hover:bg-[#2c2823] border border-[#38332c] hover:border-brand-gold/60 text-[10px] font-semibold text-zinc-300 hover:text-white transition-colors"
                >
                  +1 Month
                </button>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-[11px] uppercase tracking-wider font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
              <FileText className="h-3 w-3 text-brand-gold" />
              <span>Notes / Lending Reason</span>
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Extended for robotics hackathon project; items in good condition."
              className="w-full bg-[#141210] border border-[#332f2a] rounded px-3 py-2 text-xs text-white placeholder-brand-text-muted focus:outline-none focus:border-brand-accent transition-colors resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#2e2a25] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-[#201d1a] hover:bg-[#2a2622] text-zinc-300 hover:text-white rounded text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-brand-accent hover:bg-brand-accent-hover text-white rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

