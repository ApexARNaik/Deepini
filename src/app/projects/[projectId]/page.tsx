"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getProjectDetails, updateProjectStatus, Project, ProjectComponent } from "@/lib/api";
import { CheckOutModal } from "@/components/projects/CheckOutModal";
import { CheckInModal } from "@/components/projects/CheckInModal";
import { ArrowLeft, CheckCircle2, Clock, MapPin, PackagePlus } from "lucide-react";
import Link from "next/link";
import { useNetworkState } from "@/hooks/useNetworkState";

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const router = useRouter();
  const { isOnline } = useNetworkState();
  
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<ProjectComponent[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [checkInItem, setCheckInItem] = useState<ProjectComponent | null>(null);

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

  const handleStatusChange = async (status: 'planning' | 'active' | 'completed') => {
    if (!project) return;
    try {
      const updated = await updateProjectStatus(project.id, status);
      setProject(updated);
    } catch (err) {
      console.error(err);
      alert("Failed to update status");
    }
  };

  if (loading) return <div className="p-6 text-brand-text-muted">Loading project...</div>;
  if (!project) return <div className="p-6 text-brand-text-muted">Project not found.</div>;

  const activeItems = items.filter(i => !i.returned_at);
  const historyItems = items.filter(i => !!i.returned_at);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-brand-bg">
      <div className="p-6 border-b border-[#222] bg-[#151515] shrink-0">
        <button onClick={() => router.push('/projects')} className="flex items-center text-xs text-brand-text-muted hover:text-white uppercase tracking-widest mb-6 transition-colors">
          <ArrowLeft className="h-3 w-3 mr-2" /> Back to Projects
        </button>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="font-serif text-4xl font-bold text-white mb-2">{project.name}</h1>
            <p className="text-brand-text-muted">{project.description}</p>
          </div>
          {isOnline && (
            <div className="flex items-center gap-4">
              <select 
                value={project.status} 
                onChange={e => handleStatusChange(e.target.value as any)}
                className="bg-[#222] border border-[#333] text-brand-text-muted text-xs font-bold uppercase tracking-widest p-2 rounded focus:outline-none focus:border-brand-accent"
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
              <button 
                onClick={() => setShowCheckOut(true)}
                className="flex items-center px-4 py-2 bg-brand-accent text-white text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-brand-accent-hover transition-colors"
              >
                <PackagePlus className="h-4 w-4 mr-2" /> Check Out Component
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-12">
        
        {/* Active Checkouts */}
        <section>
          <h2 className="flex items-center text-xs font-bold text-brand-text-muted uppercase tracking-widest border-b border-[#333] pb-2 mb-4">
            <Clock className="h-4 w-4 mr-2 text-brand-accent" /> Active Checkouts ({activeItems.length})
          </h2>
          
          {activeItems.length === 0 ? (
            <div className="text-sm text-brand-text-muted italic bg-[#151515] p-6 rounded border border-[#222] text-center">
              No active checkouts for this project.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeItems.map(item => (
                <div key={item.id} className="bg-[#151515] border border-brand-accent/30 rounded p-4 flex flex-col gap-4 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-brand-accent" />
                  <div className="flex gap-4 items-start pl-2">
                    {item.component?.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.component.photo_url} alt="" className="h-12 w-12 object-cover rounded border border-[#333]" />
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
                  <div className="flex justify-between items-center pl-2 pt-4 border-t border-[#222]">
                    <div className="flex items-center text-xs text-brand-text-muted">
                      <MapPin className="h-3 w-3 mr-1" /> {item.source_hotspot?.label || 'Unknown Source'}
                    </div>
                    {isOnline && (
                      <button 
                        onClick={() => setCheckInItem(item)}
                        className="px-3 py-1 bg-brand-accent/20 text-brand-accent text-[10px] font-bold uppercase tracking-widest rounded hover:bg-brand-accent hover:text-white transition-colors"
                      >
                        Check In
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* History */}
        <section>
          <h2 className="flex items-center text-xs font-bold text-brand-text-muted uppercase tracking-widest border-b border-[#333] pb-2 mb-4">
            <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> History ({historyItems.length})
          </h2>
          
          <div className="space-y-2 opacity-70">
            {historyItems.map(item => (
              <div key={item.id} className="bg-[#111] border border-[#222] rounded p-3 flex justify-between items-center text-sm">
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

    </div>
  );
}
