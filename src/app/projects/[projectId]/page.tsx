"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProjectDetails, updateProjectStatus, Project, ProjectComponent } from "@/lib/api";
import { CheckOutModal } from "@/components/projects/CheckOutModal";
import { CheckInModal } from "@/components/projects/CheckInModal";
import { EditProjectModal } from "@/components/projects/EditProjectModal";
import { 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  PackagePlus, 
  ChevronDown, 
  Check, 
  Edit2, 
  Lock,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import { useNetworkState } from "@/hooks/useNetworkState";

const STATUS_OPTIONS: {
  value: 'planning' | 'active' | 'archived';
  label: string;
  dotColor: string;
}[] = [
  { value: 'planning', label: 'Planning', dotColor: 'bg-amber-400' },
  { value: 'active', label: 'Active', dotColor: 'bg-emerald-400' },
  { value: 'archived', label: 'Archived', dotColor: 'bg-zinc-400' },
];

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const router = useRouter();
  const { isOnline } = useNetworkState();
  
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<ProjectComponent[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [checkInItem, setCheckInItem] = useState<ProjectComponent | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editInitialStatus, setEditInitialStatus] = useState<'planning' | 'active' | 'archived' | undefined>(undefined);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (typeof projectId !== 'string') return;
    load();
  }, [projectId]);

  const load = async () => {
    if (typeof projectId !== 'string') return;
    setLoading(true);
    try {
      const data = await getProjectDetails(projectId);
      setProject(data.project);
      setItems(data.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (status: 'planning' | 'active' | 'archived') => {
    if (!project) return;

    // Strict Rule: Archive transition and location_id must be atomic
    if (status === 'archived') {
      setEditInitialStatus('archived');
      setShowEditModal(true);
      return;
    }

    // Strict Rule: Planning phase means zero components in use
    if (status === 'planning') {
      const activeCount = items.filter(i => !i.returned_at).length;
      if (activeCount > 0) {
        alert(`Cannot transition to Planning phase: ${activeCount} active component(s) are currently in use. Check in all components before returning to Planning.`);
        return;
      }
    }

    try {
      const updated = await updateProjectStatus(project.id, status);
      setProject(updated);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to update status");
    }
  };

  if (loading) return <div className="p-6 text-brand-text-muted">Loading project...</div>;
  if (!project) return <div className="p-6 text-brand-text-muted">Project not found.</div>;

  const currentStatus = STATUS_OPTIONS.find(s => s.value === project.status) || STATUS_OPTIONS[0];

  const activeItems = items.filter(i => !i.returned_at);
  const historyItems = items.filter(i => !!i.returned_at);
  const isArchived = project.status === 'archived';

  return (
    <div className="flex flex-col h-full overflow-hidden bg-brand-bg">
      <div className="p-6 border-b border-[#332f2a] bg-[#1a1816] shrink-0">
        <button onClick={() => router.push('/projects')} className="flex items-center text-xs text-brand-text-muted hover:text-white uppercase tracking-widest mb-6 transition-colors">
          <ArrowLeft className="h-3 w-3 mr-2" /> Back to Projects
        </button>
        <div className="flex justify-between items-start">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-serif text-3xl md:text-4xl font-bold text-white tracking-wide">{project.name}</h1>
              {isOnline && (
                <button
                  type="button"
                  onClick={() => {
                    setEditInitialStatus(undefined);
                    setShowEditModal(true);
                  }}
                  className="p-1.5 text-brand-text-muted hover:text-brand-accent hover:bg-[#25221d] rounded border border-transparent hover:border-[#3a352e] transition-colors"
                  title="Edit project name, description, or phase"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="text-brand-text-muted text-sm leading-relaxed">{project.description || "No description provided."}</p>
          </div>
          {isOnline && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditInitialStatus(undefined);
                  setShowEditModal(true);
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-[#191715] hover:bg-[#221f1b] border border-[#332f2a] hover:border-brand-accent/60 text-brand-text-muted hover:text-white rounded text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <Edit2 className="h-3.5 w-3.5 text-brand-accent" />
                <span>Edit</span>
              </button>

              <div className="relative" ref={statusDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsStatusDropdownOpen(prev => !prev)}
                  className={`bg-[#191715] border ${
                    isStatusDropdownOpen ? 'border-brand-accent ring-1 ring-brand-accent/50' : 'border-[#332f2a] hover:border-[#4a443c]'
                  } text-white text-xs font-bold uppercase tracking-wider px-3 py-2 rounded flex items-center gap-2.5 transition-all focus:outline-none focus:border-brand-accent`}
                >
                  <span className={`h-2 w-2 rounded-full ${currentStatus.dotColor} shrink-0`} />
                  <span>{currentStatus.label}</span>
                  <ChevronDown className={`h-3.5 w-3.5 text-brand-text-muted transition-transform duration-150 ${isStatusDropdownOpen ? 'rotate-180 text-brand-accent' : ''}`} />
                </button>

                {isStatusDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-44 z-40 bg-[#191715] border border-[#3a352e] rounded-md shadow-2xl shadow-black/90 ring-1 ring-black/50 py-1 overflow-hidden">
                    <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand-text-muted bg-[#12110f] border-b border-[#2e2a25]">
                      Project Status
                    </div>
                    {STATUS_OPTIONS.map((opt) => {
                      const isSelected = project.status === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setIsStatusDropdownOpen(false);
                            handleStatusChange(opt.value);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors ${
                            isSelected ? 'bg-brand-accent/20 text-white font-medium' : 'text-brand-text hover:bg-[#201d1a] hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${opt.dotColor} shrink-0`} />
                            <span className="uppercase tracking-wider text-[11px] font-medium">{opt.label}</span>
                          </div>
                          {isSelected && <Check className="h-3.5 w-3.5 text-brand-accent" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button 
                onClick={() => setShowCheckOut(true)}
                disabled={isArchived}
                title={isArchived ? "Archived projects cannot accept new checkouts. Change status to Active to checkout components." : undefined}
                className={`flex items-center px-4 py-2 text-white text-xs font-bold uppercase tracking-widest rounded-sm transition-colors ${
                  isArchived 
                    ? "bg-[#25221d] text-zinc-500 border border-[#332f2a] cursor-not-allowed" 
                    : "bg-brand-accent hover:bg-brand-accent-hover shadow-sm"
                }`}
              >
                <PackagePlus className="h-4 w-4 mr-2" /> Check Out Component
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto themed-scrollbar p-6 space-y-8">
        
        {/* Physical Storage Location Banner for Archived Projects */}
        {isArchived && (
          <div className="bg-[#1a1816] border border-amber-900/50 rounded-lg p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl shadow-black/40">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Archived Build Stored At</span>
                  <span className="text-[9px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">Leaf Hotspot</span>
                </div>
                <div className="text-white font-medium text-base mt-0.5">
                  {project.location_label || "Physical Storage Location Assigned"}
                </div>
                <p className="text-xs text-brand-text-muted mt-1 max-w-2xl">
                  This build is archived and preserved in assembly. Check-ins are locked to prevent accidental dismantling. Switch project to Active if you need to dismantle or return components.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0">
              {project.location_room_id ? (
                <Link
                  href={`/rooms/${project.location_room_id}?locateHotspot=${project.location_id}`}
                  className="px-4 py-2 bg-brand-accent/20 hover:bg-brand-accent text-brand-accent hover:text-white border border-brand-accent/40 rounded text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors justify-center flex-1 md:flex-initial"
                >
                  <MapPin className="h-3.5 w-3.5" /> Locate on Map
                </Link>
              ) : (
                <Link
                  href="/rooms"
                  className="px-4 py-2 bg-brand-accent/20 hover:bg-brand-accent text-brand-accent hover:text-white border border-brand-accent/40 rounded text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors justify-center flex-1 md:flex-initial"
                >
                  <MapPin className="h-3.5 w-3.5" /> View Rooms
                </Link>
              )}
              {isOnline && (
                <button
                  type="button"
                  onClick={() => {
                    setEditInitialStatus('archived');
                    setShowEditModal(true);
                  }}
                  className="px-3 py-2 bg-[#25221d] hover:bg-[#332e27] border border-[#3e3830] text-zinc-300 hover:text-white rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors"
                  title="Relocate project to another leaf hotspot"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Relocate
                </button>
              )}
            </div>
          </div>
        )}

        {/* Active Checkouts */}
        <section>
          <div className="flex justify-between items-center border-b border-[#332f2a] pb-2 mb-4">
            <h2 className="flex items-center text-xs font-bold text-brand-text-muted uppercase tracking-widest">
              <Clock className="h-4 w-4 mr-2 text-brand-accent" /> Active Checkouts ({activeItems.length})
            </h2>
            {isArchived && activeItems.length > 0 && (
              <span className="text-[11px] text-amber-400 flex items-center gap-1.5 font-medium">
                <Lock className="h-3 w-3" /> Preserved in build — check-in locked
              </span>
            )}
          </div>
          
          {activeItems.length === 0 ? (
            <div className="text-sm text-brand-text-muted italic bg-[#1a1816] p-6 rounded border border-[#332f2a] text-center">
              No active checkouts for this project.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeItems.map(item => (
                <div key={item.id} className="bg-[#1a1816] border border-brand-accent/30 rounded p-4 flex flex-col gap-4 relative overflow-hidden group">
                  <div className={`absolute top-0 left-0 w-1 h-full ${isArchived ? 'bg-zinc-600' : 'bg-brand-accent'}`} />
                  <div className="flex gap-4 items-start pl-2">
                    {item.component?.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.component.photo_url} alt="" className="h-12 w-12 object-cover rounded border border-[#332f2a]" />
                    ) : (
                      <div className="h-12 w-12 bg-[#222] rounded flex items-center justify-center text-[#555] text-[10px]">No Img</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <Link href={`/inventory/${item.component_id}`} className="font-bold text-white hover:text-brand-accent truncate block">{item.component?.name}</Link>
                      <div className="text-[10px] text-brand-text-muted uppercase tracking-widest mt-1">Checked out: {new Date(item.checked_out_at).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-serif text-white">{item.quantity}</div>
                      <div className="text-[9px] text-brand-text-muted uppercase tracking-widest">Units</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pl-2 pt-4 border-t border-[#332f2a]">
                    <div className="flex items-center text-xs text-brand-text-muted">
                      <MapPin className="h-3 w-3 mr-1" /> {item.source_hotspot?.label || 'Unknown Source'}
                    </div>
                    {isOnline && (
                      isArchived ? (
                        <span 
                          className="px-2.5 py-1 bg-zinc-800/80 text-zinc-400 text-[10px] font-bold uppercase tracking-widest rounded border border-zinc-700/60 flex items-center gap-1 cursor-default"
                          title="Preserved in build. Transition project to Active to check in or dismantle."
                        >
                          <Lock className="h-3 w-3 text-amber-500/80" /> Preserved
                        </span>
                      ) : (
                        <button 
                          onClick={() => setCheckInItem(item)}
                          className="px-3 py-1 bg-brand-accent/20 text-brand-accent text-[10px] font-bold uppercase tracking-widest rounded hover:bg-brand-accent hover:text-white transition-colors"
                        >
                          Check In
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* History */}
        <section>
          <h2 className="flex items-center text-xs font-bold text-brand-text-muted uppercase tracking-widest border-b border-[#332f2a] pb-2 mb-4">
            <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> History ({historyItems.length})
          </h2>
          
          <div className="space-y-2 opacity-70">
            {historyItems.map(item => (
              <div key={item.id} className="bg-[#1a1816] border border-[#332f2a] rounded p-3 flex justify-between items-center text-sm">
                <div className="flex items-center gap-3">
                  <div className="font-bold text-brand-text-muted w-8 text-right">{item.quantity}x</div>
                  <div className="text-gray-400 font-medium">{item.component?.name}</div>
                </div>
                <div className="text-[10px] text-[#555] uppercase tracking-widest text-right">
                  Returned {new Date(item.returned_at!).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>

      {showCheckOut && (
        <CheckOutModal 
          projectId={project.id} 
          onClose={() => setShowCheckOut(false)} 
          onSuccess={() => {
            setShowCheckOut(false);
            load();
          }} 
        />
      )}

      {checkInItem && (
        <CheckInModal 
          item={checkInItem}
          onClose={() => setCheckInItem(null)}
          onSuccess={() => {
            setCheckInItem(null);
            load();
          }}
        />
      )}

      {showEditModal && (
        <EditProjectModal
          project={project}
          activeCount={activeItems.length}
          initialStatus={editInitialStatus}
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditInitialStatus(undefined);
          }}
          onSuccess={(updated) => {
            setProject(updated);
            setShowEditModal(false);
            setEditInitialStatus(undefined);
            load();
          }}
        />
      )}

    </div>
  );
}
