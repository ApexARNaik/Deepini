"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Tag, 
  getTags, 
  upsertTag, 
  deleteTag, 
  updateTag 
} from "@/lib/api";
import { 
  X, 
  Tag as TagIcon, 
  Trash2, 
  Edit3, 
  Check, 
  Plus, 
  Search, 
  AlertTriangle, 
  Loader2, 
  RotateCw,
  Sparkles
} from "lucide-react";

interface TagManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTagsChanged?: () => void;
}

export function TagManagerModal({ isOpen, onClose, onTagsChanged }: TagManagerModalProps) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inline editing state
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // Deletion confirmation state
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const editInputRef = useRef<HTMLInputElement>(null);
  const newTagInputRef = useRef<HTMLInputElement>(null);

  const fetchAllTags = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await getTags();
      setTags(data);
    } catch (err: any) {
      console.error("Failed to fetch tags:", err);
      setErrorMsg(err.message || "Failed to load tags");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAllTags();
      setSearchQuery("");
      setNewTagName("");
      setEditingTagId(null);
      setTagToDelete(null);
      setErrorMsg(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (editingTagId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTagId]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        if (tagToDelete) {
          setTagToDelete(null);
        } else if (editingTagId) {
          setEditingTagId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, tagToDelete, editingTagId, onClose]);

  const handleCreateTag = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = newTagName.trim();
    if (!trimmed) return;

    if (tags.some(t => t.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(`Tag "${trimmed}" already exists.`);
      return;
    }

    setIsCreating(true);
    setErrorMsg(null);
    try {
      const created = await upsertTag(trimmed);
      setTags(prev => [created, ...prev.filter(t => t.id !== created.id)]);
      setNewTagName("");
      onTagsChanged?.();
    } catch (err: any) {
      console.error("Failed to create tag:", err);
      setErrorMsg(err.message || "Failed to create tag");
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEdit = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
    setErrorMsg(null);
  };

  const handleSaveEdit = async (tagId: string) => {
    const trimmed = editingTagName.trim();
    if (!trimmed) {
      setEditingTagId(null);
      return;
    }

    const currentTag = tags.find(t => t.id === tagId);
    if (currentTag && currentTag.name.toLowerCase() === trimmed.toLowerCase()) {
      setEditingTagId(null);
      return;
    }

    if (tags.some(t => t.id !== tagId && t.name.toLowerCase() === trimmed.toLowerCase())) {
      setErrorMsg(`Another tag named "${trimmed}" already exists.`);
      return;
    }

    setIsUpdating(true);
    setErrorMsg(null);
    try {
      const updated = await updateTag(tagId, trimmed);
      setTags(prev => prev.map(t => (t.id === tagId ? { ...t, name: updated.name } : t)));
      setEditingTagId(null);
      onTagsChanged?.();
    } catch (err: any) {
      console.error("Failed to update tag:", err);
      setErrorMsg(err.message || "Failed to update tag");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!tagToDelete) return;
    setIsDeleting(true);
    setErrorMsg(null);
    try {
      await deleteTag(tagToDelete.id);
      setTags(prev => prev.filter(t => t.id !== tagToDelete.id));
      setTagToDelete(null);
      onTagsChanged?.();
    } catch (err: any) {
      console.error("Failed to delete tag:", err);
      setErrorMsg(err.message || "Failed to delete tag");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  const filteredTags = tags.filter(t => 
    t.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-xl bg-[#181614] border border-[#38332c] rounded-lg shadow-2xl shadow-black/90 flex flex-col max-h-[85vh] overflow-hidden ring-1 ring-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#12110f] border-b border-[#2d2924] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded bg-brand-accent/15 border border-brand-accent/30 flex items-center justify-center text-brand-accent">
              <TagIcon className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-wide flex items-center gap-2">
                Tag Manager
                <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-[#27231e] text-brand-text-muted border border-[#3a342c]">
                  {tags.length} total
                </span>
              </h2>
              <p className="text-xs text-brand-text-muted mt-0.5">
                Create, edit, or permanently remove global tags from suggestions.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-brand-text-muted hover:text-white p-1.5 rounded-md hover:bg-[#28241f] transition-colors"
            data-tooltip="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action Controls */}
        <div className="p-4 bg-[#151311] border-b border-[#2a2621] space-y-3 shrink-0">
          {/* Create New Tag */}
          <form onSubmit={handleCreateTag} className="flex gap-2">
            <div className="relative flex-1">
              <input
                ref={newTagInputRef}
                type="text"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                placeholder="Create a new tag (e.g. Microcontroller, ESP32)..."
                className="w-full bg-[#1b1916] border border-[#3a342c] px-3 py-2 text-xs text-white placeholder-brand-text-muted/60 focus:border-brand-accent focus:outline-none rounded transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={!newTagName.trim() || isCreating}
              className="px-3.5 py-2 bg-brand-accent text-white hover:bg-brand-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold uppercase tracking-wider rounded transition-all flex items-center gap-1.5 shrink-0"
            >
              {isCreating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>Create</span>
            </button>
          </form>

          {/* Search / Filter & Refresh */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-brand-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter tags..."
                className="w-full bg-[#100f0e] border border-[#2e2924] pl-8 pr-7 py-1.5 text-xs text-brand-text placeholder-brand-text-muted/50 focus:border-brand-accent/70 focus:outline-none rounded transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-text-muted hover:text-white p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={fetchAllTags}
              disabled={isLoading}
              className="p-2 bg-[#1b1916] border border-[#2e2924] text-brand-text-muted hover:text-white hover:bg-[#23201c] rounded transition-colors disabled:opacity-50"
              data-tooltip="Refresh tags"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-brand-accent' : ''}`} />
            </button>
          </div>

          {/* Error Message banner */}
          {errorMsg && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-950/40 border border-red-900/60 rounded text-xs text-red-300 animate-in fade-in">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />
              <span className="flex-1 truncate">{errorMsg}</span>
              <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white">
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Tag List */}
        <div className="flex-1 overflow-y-auto themed-scrollbar p-3 divide-y divide-[#24211d]">
          {isLoading && tags.length === 0 ? (
            <div className="py-12 text-center text-xs text-brand-text-muted flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-brand-accent" />
              <span>Loading tags...</span>
            </div>
          ) : filteredTags.length === 0 ? (
            <div className="py-12 text-center text-xs text-brand-text-muted flex flex-col items-center justify-center gap-2">
              <TagIcon className="h-6 w-6 text-brand-text-muted/40 stroke-1" />
              {searchQuery ? (
                <span>No tags match &quot;{searchQuery}&quot;</span>
              ) : (
                <span>No tags created yet. Add one above!</span>
              )}
            </div>
          ) : (
            filteredTags.map(tag => {
              const isEditing = editingTagId === tag.id;
              return (
                <div 
                  key={tag.id} 
                  className="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-[#1f1c19] rounded transition-colors group"
                >
                  {isEditing ? (
                    /* Inline Editing Mode */
                    <div className="flex items-center gap-2 flex-1 mr-2">
                      <TagIcon className="h-3.5 w-3.5 text-brand-accent shrink-0" />
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingTagName}
                        onChange={e => setEditingTagName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") handleSaveEdit(tag.id);
                          if (e.key === "Escape") setEditingTagId(null);
                        }}
                        className="flex-1 bg-[#12110f] border border-brand-accent px-2 py-1 text-xs text-white rounded focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(tag.id)}
                        disabled={isUpdating || !editingTagName.trim()}
                        className="p-1 text-emerald-400 hover:bg-emerald-950/50 rounded transition-colors"
                        data-tooltip="Save Name (Enter)"
                      >
                        {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTagId(null)}
                        className="p-1 text-brand-text-muted hover:text-white hover:bg-[#28241f] rounded transition-colors"
                        data-tooltip="Cancel (Esc)"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    /* Standard Display Mode */
                    <>
                      <div className="flex items-center gap-2.5 truncate min-w-0">
                        <TagIcon className="h-3.5 w-3.5 text-brand-gold/70 shrink-0 group-hover:text-brand-accent transition-colors" />
                        <span className="text-xs font-medium text-white truncate">
                          {tag.name}
                        </span>
                        {tag.usage_count && tag.usage_count > 0 ? (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#25211c] text-brand-text-muted rounded border border-[#363028] shrink-0">
                            {tag.usage_count} {tag.usage_count === 1 ? 'item' : 'items'}
                          </span>
                        ) : (
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-[#1a1816] text-[#6d665a] rounded shrink-0">
                            Unused
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(tag)}
                          className="p-1.5 text-brand-text-muted hover:text-white hover:bg-[#2c2722] rounded transition-colors"
                          data-tooltip={`Rename "${tag.name}"`}
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTagToDelete(tag)}
                          className="p-1.5 text-brand-text-muted hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors"
                          data-tooltip={`Delete "${tag.name}"`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#12110f] border-t border-[#2d2924] flex items-center justify-between text-xs text-brand-text-muted shrink-0">
          <div className="flex items-center gap-1 text-[11px]">
            <Sparkles className="h-3 w-3 text-brand-gold/80" />
            <span>Changes take effect immediately across suggestions</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#221f1b] border border-[#38332c] text-brand-text hover:text-white hover:bg-[#2d2924] rounded text-xs font-medium transition-colors"
          >
            Done
          </button>
        </div>

        {/* Delete Confirmation Sub-Dialog */}
        {tagToDelete && (
          <div className="absolute inset-0 z-20 bg-black/85 backdrop-blur-sm p-6 flex flex-col items-center justify-center text-center animate-in fade-in duration-150">
            <div className="max-w-md bg-[#191715] border border-rose-900/60 p-6 rounded-lg shadow-2xl space-y-4">
              <div className="h-11 w-11 rounded-full bg-rose-950/60 border border-rose-800/80 flex items-center justify-center text-rose-400 mx-auto">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-white">
                  Delete tag &quot;{tagToDelete.name}&quot;?
                </h3>
                <p className="text-xs text-brand-text-muted">
                  {tagToDelete.usage_count && tagToDelete.usage_count > 0 ? (
                    <>
                      This tag is currently attached to <strong className="text-white">{tagToDelete.usage_count} {tagToDelete.usage_count === 1 ? 'item' : 'items'}</strong>. 
                      Deleting it will remove it from those items and delete it permanently from suggestions.
                    </>
                  ) : (
                    <>
                      This tag is unused. Deleting it will permanently remove it from suggestions.
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setTagToDelete(null)}
                  className="px-4 py-2 bg-[#221f1b] border border-[#38332c] text-brand-text hover:text-white rounded text-xs font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-rose-950/50"
                >
                  {isDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span>Delete Permanently</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
