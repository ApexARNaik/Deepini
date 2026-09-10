"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Map, 
  Archive, 
  Compass, 
  TriangleAlert, 
  Settings,
  Search,
  Bell,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  Loader2,
  Package,
  MapPin,
  Eye,
  ArrowRight,
  ExternalLink
} from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { getInventory, getRooms, ComponentWithTotals, Room, isPersonalItem } from "@/lib/api";
import { ComponentQuickViewModal } from "@/components/inventory/ComponentQuickViewModal";
import { ImagePreviewModal } from "@/components/inventory/ImagePreviewModal";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Room Map", href: "/rooms", icon: Map },
  { name: "Inventory", href: "/inventory", icon: Archive },
  { name: "Projects", href: "/projects", icon: Compass },
  { name: "Low Stock", href: "/low-stock", icon: TriangleAlert },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ components: ComponentWithTotals[]; rooms: Room[] }>({
    components: [],
    rooms: []
  });
  const [quickViewComponentId, setQuickViewComponentId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; subtitle?: string } | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const debouncedSearch = useDebounce(searchQuery.trim(), 250);

  useEffect(() => {
    if (!debouncedSearch) {
      setSearchResults({ components: [], rooms: [] });
      setIsSearching(false);
      return;
    }

    let isCancelled = false;
    setIsSearching(true);

    Promise.all([
      getInventory(debouncedSearch).catch((err) => {
        console.error("Search inventory error:", err);
        return [] as ComponentWithTotals[];
      }),
      getRooms().catch((err) => {
        console.error("Search rooms error:", err);
        return [] as Room[];
      })
    ]).then(([comps, allRooms]) => {
      if (isCancelled) return;
      const lower = debouncedSearch.toLowerCase();
      const matchedRooms = allRooms.filter(r => r.name.toLowerCase().includes(lower));
      setSearchResults({
        components: comps,
        rooms: matchedRooms
      });
      setIsSearching(false);
    });

    return () => {
      isCancelled = true;
    };
  }, [debouncedSearch]);

  // Click outside to close search dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Close search dropdown on route navigation
  useEffect(() => {
    setIsSearchOpen(false);
  }, [pathname]);

  const handleNavigateToAllResults = () => {
    setIsSearchOpen(false);
    if (searchQuery.trim()) {
      router.push(`/inventory?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push("/inventory");
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsSearchOpen(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleNavigateToAllResults();
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem("deepini_sidebar_pinned");
      if (saved !== null) {
        setIsSidebarPinned(saved === "true");
      }
    } catch {
      // Ignore localStorage access errors
    }
  }, []);

  const handleToggleSidebarPin = () => {
    setIsSidebarPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("deepini_sidebar_pinned", String(next));
      } catch {}
      return next;
    });
  };
  
  const isSidebarExpanded = isSidebarPinned || isSidebarHovered;

  return (
    <div className="flex h-full w-full bg-brand-bg overflow-hidden text-brand-text font-sans">
      {/* Sidebar (Desktop) */}
      <div 
        className={`${isSidebarExpanded ? "w-64" : "w-[72px]"} transition-all duration-300 hidden md:flex flex-shrink-0 flex-col bg-[#1a1816] border-r border-[#332f2a] relative z-20`}
        onMouseEnter={() => setIsSidebarHovered(true)}
        onMouseLeave={() => setIsSidebarHovered(false)}
      >
        {/* Logo Area */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-[#332f2a] shrink-0 overflow-hidden transition-all duration-300">
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity min-w-0">
            <div className="bg-brand-accent text-white font-serif font-bold h-8 w-8 flex items-center justify-center shrink-0">
              D
            </div>
            <div className={`transition-all duration-300 flex flex-col justify-center ${isSidebarExpanded ? "opacity-100 w-32 ml-3" : "opacity-0 w-0 ml-0 overflow-hidden"}`}>
              <div className="font-serif font-bold text-white tracking-widest text-lg leading-none uppercase">Deepini</div>
              <div className="text-[8px] tracking-[0.1em] text-brand-gold mt-1 uppercase font-semibold leading-[1.2] whitespace-normal">
                Personal Component<br/>Archive
              </div>
            </div>
          </Link>
          
          {isSidebarExpanded && (
            <button 
              onClick={handleToggleSidebarPin}
              className="text-brand-text-muted hover:text-white transition-colors h-8 w-8 flex items-center justify-center rounded hover:bg-[#24211e] shrink-0"
              title={isSidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
            >
              {isSidebarPinned ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center py-3 mx-2 px-3 text-sm font-medium transition-colors overflow-hidden ${
                  isActive 
                    ? "text-brand-accent bg-[#24211e]/50 border-l-2 border-brand-accent rounded-r" 
                    : "text-brand-text-muted hover:text-white hover:bg-[#24211e]/30 border-l-2 border-transparent"
                }`}
                title={!isSidebarExpanded ? item.name : undefined}
              >
                <div className="w-6 flex justify-center shrink-0 mr-3">
                  <item.icon className={`h-5 w-5 ${isActive ? "text-brand-accent" : "text-brand-text-muted"}`} />
                </div>
                <span className={`transition-all duration-300 whitespace-nowrap ${isSidebarExpanded ? "opacity-100" : "opacity-0"}`}>
                  {item.name}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User & Notifications (Bottom Left) */}
        <div className={`p-4 border-t border-[#332f2a] flex ${isSidebarExpanded ? "flex-row justify-between" : "flex-col justify-center gap-4"} items-center shrink-0 transition-all duration-300`}>
          <div className="relative">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              title="Profile Settings"
              className="h-8 w-8 rounded bg-[#24211e] flex items-center justify-center hover:bg-[#333333] hover:text-brand-accent transition-colors border border-[#332f2a]"
            >
              <User className="h-4 w-4" />
            </button>
            {isDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40"
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className="absolute bottom-full left-0 mb-2 w-48 rounded-sm shadow-lg bg-brand-bg ring-1 ring-black ring-opacity-5 border border-brand-border z-50">
                  <div className="py-1 flex flex-col" role="menu" aria-orientation="vertical">

                    <button
                      onClick={() => {
                        sessionStorage.removeItem("unlocked");
                        window.location.reload();
                      }}
                      className="w-full text-left px-4 py-3 text-xs tracking-wider uppercase font-semibold text-brand-text hover:bg-brand-border/30 hover:text-brand-error-text transition-colors"
                      role="menuitem"
                    >
                      Lock Workspace
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          
          <button 
            onClick={() => alert("No new notifications")}
            title="Notifications"
            className="text-brand-text-muted hover:text-white transition-colors h-8 w-8 flex items-center justify-center"
          >
            <Bell className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-brand-bg relative">
        {/* Top Header */}
        <header className="h-16 md:h-20 shrink-0 flex items-center justify-between px-4 md:px-8 border-b border-[#332f2a] bg-brand-bg relative z-30">
          <div ref={searchContainerRef} className="flex-1 max-w-2xl relative">
            <div className="flex items-center w-full relative">
              <Search className="h-4 w-4 text-brand-text-muted absolute left-3 pointer-events-none" />
              <input 
                type="text" 
                placeholder="Search components, tags, notes, rooms... (Enter to view all)" 
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (e.target.value.trim()) {
                    setIsSearchOpen(true);
                  } else {
                    setIsSearchOpen(false);
                  }
                }}
                onFocus={() => {
                  if (searchQuery.trim()) {
                    setIsSearchOpen(true);
                  }
                }}
                onKeyDown={handleSearchKeyDown}
                className="w-full bg-[#1a1816] border border-[#332f2a] rounded-sm py-2 pl-9 pr-14 text-sm text-white placeholder-brand-text-muted focus:outline-none focus:border-brand-accent focus:ring-1 focus:ring-brand-accent transition-all"
              />
              <div className="absolute right-2.5 flex items-center gap-1.5">
                {isSearching && (
                  <Loader2 className="h-4 w-4 text-brand-accent animate-spin" />
                )}
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setIsSearchOpen(false);
                    }}
                    className="text-brand-text-muted hover:text-white p-0.5 rounded transition-colors"
                    title="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Dropdown Results */}
            {isSearchOpen && debouncedSearch && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#171513] border border-[#332f2a] rounded-md shadow-2xl z-50 overflow-hidden flex flex-col max-h-[75vh]">
                {/* Header / Query Status */}
                <div className="px-4 py-2 bg-[#1f1c19] border-b border-[#2e2a25] flex items-center justify-between text-xs text-brand-text-muted shrink-0">
                  <span>
                    {isSearching ? "Searching for " : "Results for "}
                    <span className="text-white font-semibold">&ldquo;{debouncedSearch}&rdquo;</span>
                  </span>
                  <span className="text-[11px] text-brand-text-muted hidden sm:inline">
                    Press <kbd className="px-1.5 py-0.5 bg-[#2a2622] text-brand-gold rounded border border-[#3a352f] text-[10px] font-mono">Enter</kbd> to view in Inventory
                  </span>
                </div>

                <div className="overflow-y-auto divide-y divide-[#26231f]">
                  {/* Rooms Section */}
                  {searchResults.rooms.length > 0 && (
                    <div className="p-2 bg-[#141210]">
                      <div className="text-[10px] uppercase font-bold tracking-widest text-brand-gold px-3 py-1 flex items-center gap-1.5">
                        <MapPin className="h-3 w-3 text-brand-gold" />
                        Rooms ({searchResults.rooms.length})
                      </div>
                      <div className="space-y-0.5 mt-1">
                        {searchResults.rooms.slice(0, 3).map((room) => (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => {
                              setIsSearchOpen(false);
                              router.push(`/rooms/${room.id}`);
                            }}
                            className="w-full text-left px-3 py-2 rounded flex items-center justify-between hover:bg-[#25221e] group transition-colors"
                          >
                            <span className="text-sm font-medium text-white group-hover:text-brand-accent transition-colors">
                              {room.name}
                            </span>
                            <ArrowRight className="h-3.5 w-3.5 text-brand-text-muted group-hover:text-brand-accent group-hover:translate-x-0.5 transition-all" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Components Section */}
                  <div className="p-2">
                    <div className="text-[10px] uppercase font-bold tracking-widest text-brand-text-muted px-3 py-1 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Package className="h-3 w-3 text-brand-accent" />
                        Components & Items ({searchResults.components.length})
                      </span>
                      {searchResults.components.length > 6 && (
                        <span className="text-[10px] text-brand-gold font-normal">
                          Showing top 6
                        </span>
                      )}
                    </div>

                    {searchResults.components.length === 0 && !isSearching ? (
                      <div className="py-6 px-4 text-center">
                        <p className="text-sm text-brand-text-muted">No components match &ldquo;{debouncedSearch}&rdquo;</p>
                      </div>
                    ) : (
                      <div className="space-y-1 mt-1">
                        {searchResults.components.slice(0, 6).map((comp) => {
                          const personal = isPersonalItem(comp);
                          const inStorage = comp.totals?.in_storage_qty ?? 0;
                          return (
                            <div
                              key={comp.id}
                              className="flex items-center justify-between gap-3 px-3 py-2 rounded hover:bg-[#25221e] group transition-colors"
                            >
                              {/* Clickable info area */}
                              <div
                                onClick={() => {
                                  setIsSearchOpen(false);
                                  router.push(`/inventory/${comp.id}`);
                                }}
                                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                              >
                                {comp.photo_url ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewImage({
                                        url: comp.photo_url!,
                                        title: comp.name,
                                        subtitle: personal ? "Personal Item Photo" : "Component Image"
                                      });
                                    }}
                                    className="h-10 w-10 rounded overflow-hidden border border-[#332f2a] hover:border-brand-accent shrink-0 bg-black/40 cursor-zoom-in group/img block"
                                    title="Click to view full image"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={comp.photo_url}
                                      alt={comp.name}
                                      className="h-full w-full object-cover group-hover/img:scale-110 transition-transform duration-200"
                                    />
                                  </button>
                                ) : (
                                  <div className="h-10 w-10 rounded bg-[#2a2622] border border-[#332f2a] flex items-center justify-center shrink-0">
                                    <Package className="h-5 w-5 text-brand-text-muted" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-white group-hover:text-brand-accent transition-colors truncate">
                                      {comp.name}
                                    </span>
                                    {personal && (
                                      <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-amber-900/40 text-amber-300 border border-amber-800/60 shrink-0">
                                        Personal
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-brand-text-muted">
                                    <span className="text-brand-gold font-medium">
                                      In Stock: {inStorage}
                                    </span>
                                    {comp.tags && comp.tags.length > 0 && (
                                      <>
                                        <span>•</span>
                                        <span className="truncate">
                                          {comp.tags.slice(0, 2).map((t: any) => t.name).join(", ")}
                                        </span>
                                      </>
                                    )}
                                    {comp.notes && (
                                      <>
                                        <span>•</span>
                                        <span className="truncate italic text-brand-text-muted/70 max-w-[160px]">
                                          {comp.notes}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Actions: Quick View & Open */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setQuickViewComponentId(comp.id);
                                    setIsSearchOpen(false);
                                  }}
                                  title="Quick Preview"
                                  className="p-1.5 text-brand-text-muted hover:text-brand-accent hover:bg-[#332f2a] rounded transition-colors"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsSearchOpen(false);
                                    router.push(`/inventory/${comp.id}`);
                                  }}
                                  title="View Full Page"
                                  className="p-1.5 text-brand-text-muted hover:text-white hover:bg-[#332f2a] rounded transition-colors"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer: View all results in Inventory */}
                <div className="p-2 bg-[#1b1815] border-t border-[#2e2a25] shrink-0">
                  <button
                    type="button"
                    onClick={handleNavigateToAllResults}
                    className="w-full text-center py-2 px-3 rounded text-xs font-semibold uppercase tracking-wider text-brand-accent hover:text-white hover:bg-brand-accent/20 transition-all flex items-center justify-center gap-2"
                  >
                    <span>View all results in Inventory</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Profile & Notifications */}
          <div className="flex md:hidden items-center gap-3 ml-4">
            <button 
              onClick={() => alert("No new notifications")}
              title="Notifications"
              className="text-brand-text-muted hover:text-white transition-colors h-8 w-8 flex items-center justify-center"
            >
              <Bell className="h-4 w-4" />
            </button>
            <div className="relative">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                title="Profile Settings"
                className="h-8 w-8 rounded bg-[#24211e] flex items-center justify-center hover:bg-[#333333] hover:text-brand-accent transition-colors border border-[#332f2a]"
              >
                <User className="h-4 w-4" />
              </button>
              {isDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  <div className="absolute top-full right-0 mt-2 w-48 rounded-sm shadow-lg bg-brand-bg ring-1 ring-black ring-opacity-5 border border-brand-border z-50">
                    <div className="py-1 flex flex-col" role="menu" aria-orientation="vertical">

                      <button
                        onClick={() => {
                          sessionStorage.removeItem("unlocked");
                          window.location.reload();
                        }}
                        className="w-full text-left px-4 py-3 text-xs tracking-wider uppercase font-semibold text-brand-text hover:bg-brand-border/30 hover:text-brand-error-text transition-colors"
                        role="menuitem"
                      >
                        Lock Workspace
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 pb-24 md:pb-8 lg:pb-12">
          {children}
        </main>

        {/* Bottom Navigation (Mobile) */}
        <div className="md:hidden fixed bottom-0 w-full h-16 bg-[#1a1816] border-t border-[#332f2a] flex items-center justify-around z-30 px-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                  isActive ? "text-brand-accent" : "text-brand-text-muted hover:text-white"
                }`}
              >
                <item.icon className={`h-5 w-5 ${isActive ? "text-brand-accent" : "text-brand-text-muted"}`} />
                <span className="text-[9px] uppercase tracking-wider font-semibold">
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Component Quick View Modal */}
      <ComponentQuickViewModal
        componentId={quickViewComponentId}
        isOpen={!!quickViewComponentId}
        onClose={() => setQuickViewComponentId(null)}
      />

      {/* Full Image Preview Modal */}
      <ImagePreviewModal
        isOpen={!!previewImage}
        imageUrl={previewImage?.url || null}
        title={previewImage?.title}
        subtitle={previewImage?.subtitle}
        onClose={() => setPreviewImage(null)}
      />
    </div>
  );
}

