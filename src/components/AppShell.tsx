"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
  PanelLeftOpen
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Room Map", href: "/rooms", icon: Map },
  { name: "Inventory", href: "/inventory", icon: Archive },
  { name: "Projects", href: "/projects", icon: Compass },
  { name: "Low Stock", href: "/low-stock", icon: TriangleAlert },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSidebarPinned, setIsSidebarPinned] = useState(true);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  
  const isSidebarExpanded = isSidebarPinned || isSidebarHovered;

  return (
    <div className="flex h-screen w-full bg-brand-bg overflow-hidden text-brand-text font-sans">
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
              onClick={() => setIsSidebarPinned(!isSidebarPinned)}
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
        <header className="h-16 md:h-20 shrink-0 flex items-center justify-between px-4 md:px-8 border-b border-[#332f2a] bg-brand-bg">
          <div className="flex-1 max-w-2xl flex items-center relative">
            <Search className="h-5 w-5 text-brand-text-muted absolute left-0" />
            <input 
              type="text" 
              placeholder="Search components, tags, notes..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-none py-2 pl-9 md:pl-10 pr-4 text-sm text-white placeholder-brand-text-muted focus:outline-none focus:ring-0"
            />
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


    </div>
  );
}
