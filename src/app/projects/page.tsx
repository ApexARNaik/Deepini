"use client";

import { useState, useEffect } from "react";
import { Project, getProjects, createProject } from "@/lib/api";
import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { useNetworkState } from "@/hooks/useNetworkState";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<(Project & { active_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const { isOnline } = useNetworkState();
  
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getProjects();
      setProjects(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await createProject(newName, newDesc);
      setShowNewModal(false);
      setNewName("");
      setNewDesc("");
      load();
    } catch (err) {
      console.error(err);
      alert("Failed to create project");
    }
  };

  return (
    <div className="flex flex-col h-full p-6 bg-brand-bg overflow-y-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="font-serif text-[28px] font-bold tracking-widest text-white uppercase">PROJECTS</h1>
          <p className="mt-1 text-[10px] tracking-[0.2em] text-brand-gold uppercase">Checkout ledger and active build tracking.</p>
        </div>
        {isOnline && (
          <button 
            onClick={() => setShowNewModal(true)}
            className="flex items-center px-4 py-2 bg-brand-accent text-white text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-brand-accent-hover transition-colors"
          >
            <Plus className="h-4 w-4 mr-1" /> New Project
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-brand-text-muted">Loading projects...</div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-brand-text-muted border border-[#332f2a] rounded-lg">
          <p>No projects found. Create one to start checking out components.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map(p => (
            <Link key={p.id} href={`/projects/${p.id}`} className="block group">
              <div className="bg-[#1a1816] border border-[#332f2a] hover:border-[#332f2a] rounded-lg p-6 transition-all duration-200 h-full flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="font-bold text-lg text-white group-hover:text-brand-accent transition-colors">{p.name}</h2>
                  <span className={`px-2 py-1 text-[9px] uppercase tracking-widest rounded-sm font-bold ${
                    p.status === 'planning' ? 'bg-[#333] text-gray-300' :
                    p.status === 'active' ? 'bg-brand-accent/20 text-brand-accent' :
                    'bg-green-500/20 text-green-400'
                  }`}>
                    {p.status}
                  </span>
                </div>
                <p className="text-sm text-brand-text-muted flex-1 line-clamp-3 mb-6">
                  {p.description || "No description provided."}
                </p>
                <div className="flex justify-between items-end border-t border-[#332f2a] pt-4 mt-auto">
                  <div>
                    <div className="text-2xl font-serif text-white leading-none mb-1">{p.active_count}</div>
                    <div className="text-[9px] text-brand-text-muted uppercase tracking-widest">Active Components</div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-brand-text-muted group-hover:text-white transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#1a1816] border border-[#332f2a] p-6 rounded-lg w-full max-w-md">
            <h2 className="text-lg font-bold text-white mb-4">Create New Project</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-brand-text-muted mb-1">Project Name</label>
                <input required autoFocus type="text" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-[#1a1816] border border-[#332f2a] p-2 text-white focus:border-brand-accent focus:outline-none" />
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-brand-text-muted mb-1">Description</label>
                <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} className="w-full h-24 bg-[#1a1816] border border-[#332f2a] p-2 text-white focus:border-brand-accent focus:outline-none resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowNewModal(false)} className="px-4 py-2 text-xs text-brand-text-muted hover:text-white uppercase tracking-widest">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-brand-accent text-white text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-brand-accent-hover">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
