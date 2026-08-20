"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Key } from "lucide-react";

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const unlocked = sessionStorage.getItem("unlocked") === "true";
    if (unlocked) {
      setIsUnlocked(true);
    }
    setIsChecking(false);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const correctPassword = process.env.NEXT_PUBLIC_APP_PASSWORD || "Pass123";
    if (password === correctPassword) {
      sessionStorage.setItem("unlocked", "true");
      setIsUnlocked(true);
    } else {
      setError("Incorrect password");
    }
  };

  if (isChecking) {
    return null; // Or a loading spinner
  }

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen w-full bg-[#121212] text-brand-text">
      {/* Left section - Image and Hero Text */}
      <div 
        className="relative hidden w-1/2 flex-col justify-between bg-cover bg-center p-12 lg:flex"
        style={{
          backgroundImage: `linear-gradient(to right, rgba(18, 18, 18, 0.4), rgba(18, 18, 18, 0.9)), url('https://images.unsplash.com/photo-1581092160562-40aa08e78837?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80')`
        }}
      >
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-wider text-white">DEEPINI</h1>
          <p className="mt-2 text-xs tracking-[0.2em] text-brand-gold uppercase">Personal Component Archive</p>
        </div>
        
        <div className="mb-12 max-w-md">
          <p className="mb-4 text-xs tracking-widest text-brand-gold uppercase">Private Workshop Inventory</p>
          <h2 className="font-serif text-5xl font-bold leading-tight text-white">
            Know what you have.<br />
            Know where it is.
          </h2>
          <p className="mt-6 text-brand-text-muted leading-relaxed">
            A visual map of your components, storage, and projects — all in one place.
          </p>
        </div>
      </div>

      {/* Right section - Login Form */}
      <div className="flex w-full flex-col justify-center px-8 lg:w-1/2 lg:px-24 xl:px-32 relative">
        <div className="absolute top-12 right-12 text-xs tracking-widest text-brand-text-muted">
          ARCHIVE / 01
        </div>
        
        {/* Subtle grid background effect on the right panel */}
        <div 
          className="absolute inset-0 opacity-[0.03] pointer-events-none" 
          style={{
            backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
            backgroundSize: `40px 40px`
          }}
        />

        <div className="relative z-10 max-w-md w-full mx-auto lg:mx-0">
          <div className="mb-8 flex items-center text-brand-gold">
            <Key className="mr-3 h-4 w-4" />
            <span className="text-xs tracking-widest uppercase">Private Workspace</span>
          </div>
          
          <h2 className="mb-3 font-serif text-4xl font-bold text-white">Enter the workshop</h2>
          <p className="mb-10 text-brand-text-muted">Your inventory is waiting.</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-3 block text-xs tracking-widest text-brand-text-muted uppercase">
                Access Key
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                className={`w-full bg-[#1a1a1a] border ${error ? 'border-brand-error-text' : 'border-brand-border'} p-4 text-white placeholder-brand-text-muted/50 focus:border-brand-accent focus:outline-none transition-colors`}
                placeholder="Enter your password"
                autoFocus
              />
              {error && <p className="mt-2 text-sm text-brand-error-text">{error}</p>}
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-between bg-brand-accent px-6 py-4 text-sm font-medium tracking-wider text-white transition-colors hover:bg-brand-accent-hover"
            >
              <span>ENTER WORKSHOP</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-16 text-center text-[10px] tracking-widest text-brand-text-muted/50 uppercase">
            Private workspace · Single-user inventory
          </p>
        </div>
      </div>
    </div>
  );
}
