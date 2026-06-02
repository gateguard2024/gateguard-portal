'use client'

import { useState, useCallback } from 'react'
import { useUser } from '@clerk/nextjs'
import { ActionCommandBar } from '@/components/nexus/ActionCommandBar'
import { DynamicModal } from '@/components/nexus/DynamicModal'

// ─── Constants ──────────────────────────────────────────────────────────────
const GLASS_STYLE = "bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl transition-all duration-300 hover:bg-white/10 hover:border-white/20";

export default function NexusHome() {
  const { user } = useUser()
  const firstName = user?.firstName ?? 'there'
  
  const [activeTab, setActiveTab] = useState('my-day')
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden" 
         style={{ background: 'radial-gradient(ellipse at 50% 40%, #0d2150 0%, #060e28 40%, #020810 70%, #000306 100%)' }}>
      
      {/* Grid Overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-20" 
           style={{ backgroundImage: 'linear-gradient(rgba(107,126,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(107,126,255,0.2) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        <h1 className="text-4xl font-bold text-white tracking-[0.22em] uppercase mb-1">Nexus</h1>
        <p className="text-xs text-blue-400/60 tracking-[0.2em] uppercase mb-8">by Gate Guard</p>

        <p className="text-lg mb-7 text-white/45">Hi {firstName}, <span className="text-white/80">what are we working on today?</span></p>

        <ActionCommandBar />

        {/* Dynamic Modal Area using Glass Style */}
        <div className={`w-full max-w-4xl mt-12 p-6 ${GLASS_STYLE}`}>
            <DynamicModal activeTab={activeTab} />
        </div>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 p-4 flex justify-center gap-2 bg-black/40 backdrop-blur-lg border-t border-white/5">
        {['My Day', 'Recent Work', 'New Opps/Leads', 'Jobs', 'Field', 'People'].map((tab) => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab.toLowerCase())}
            className={`px-6 py-2 rounded-full text-sm border transition-all ${
              activeTab === tab.toLowerCase() 
              ? 'border-blue-400/50 bg-blue-400/10 text-blue-200' 
              : 'border-white/5 text-white/30 hover:border-white/20'
            }`}
          >
            {tab}
          </button>
        ))}
      </nav>
    </div>
  )
}
