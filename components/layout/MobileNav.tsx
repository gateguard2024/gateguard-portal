'use client'

/**
 * MobileNav — Bottom tab bar for the portal on mobile devices.
 *
 * Shown only on screens < md (768px). Replaces the sidebar.
 * 5 primary tabs: Home | Feed | Messages | Tech | More
 * "More" opens a slide-up sheet with all other portal sections.
 */

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, MessageSquare, Zap, X, ChevronRight,
  Users, FileText, Wrench, Package, Star, CreditCard,
  Shield, Camera, BookOpen, ClipboardCheck, Megaphone,
  Settings, GraduationCap, Map, TrendingUp, Layers,
} from 'lucide-react'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Flame, Hash, Menu, Phone, Crosshair, Building2, BarChart3, ArrowRightLeft, UserCog } = require('lucide-react') as any

// ─── Tab definitions ──────────────────────────────────────────────────────────

const PRIMARY_TABS = [
  { id: 'home',     href: '/',              icon: LayoutDashboard, label: 'Home'     },
  { id: 'feed',     href: '/feed',          icon: Flame,           label: 'Feed'     },
  { id: 'messages', href: '/messages',      icon: Hash,            label: 'Messages' },
  { id: 'tech',     href: '/tech',          icon: Zap,             label: 'Tech'     },
  { id: 'more',     href: null,             icon: Menu,            label: 'More'     },
]

const MORE_SECTIONS = [
  {
    label: 'Work',
    items: [
      { label: 'CRM',         href: '/crm',         icon: MessageSquare   },
      { label: 'Quotes',      href: '/quotes',       icon: FileText        },
      { label: 'Work Orders', href: '/maintenance',  icon: Wrench          },
      { label: 'Dispatch',    href: '/dispatch',     icon: Building2       },
      { label: 'Customers',   href: '/customers',    icon: Users           },
      { label: 'Site Survey', href: '/survey',       icon: ClipboardCheck  },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { label: 'ARIA',    href: '/aria',    icon: Crosshair },
      { label: 'TRINITY', href: '/trinity', icon: Phone     },
    ],
  },
  {
    label: 'Dealer Network',
    items: [
      { label: 'Properties', href: '/sites',       icon: Building2     },
      { label: 'Scorecard',  href: '/scorecard',   icon: Star          },
      { label: 'Training',   href: '/training',    icon: GraduationCap },
      { label: 'Map',        href: '/map',          icon: Map           },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'Billing',       href: '/billing',                 icon: CreditCard },
      { label: 'Subscription',  href: '/settings/subscription',   icon: Settings   },
      { label: 'EOS',           href: '/eos',                     icon: Layers     },
      { label: 'SARA Bridge',   href: '/migrate',                 icon: ArrowRightLeft },
    ],
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function MobileNav() {
  const pathname              = usePathname()
  const router                = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)
  const [mounted, setMounted]   = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Close sheet on route change
  useEffect(() => { setMoreOpen(false) }, [pathname])

  // Lock body scroll when More sheet is open
  useEffect(() => {
    if (!mounted) return
    document.body.style.overflow = moreOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [moreOpen, mounted])

  if (!mounted) return null

  function isActive(tab: (typeof PRIMARY_TABS)[0]) {
    if (tab.id === 'more') return moreOpen
    if (tab.href === '/') return pathname === '/'
    return pathname.startsWith(tab.href!)
  }

  return (
    <>
      {/* ── Bottom tab bar ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
        style={{
          background:   '#0B1728',
          borderTop:    '0.5px solid rgba(107,126,255,0.2)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        aria-label="Mobile navigation"
      >
        <div className="flex items-stretch h-14">
          {PRIMARY_TABS.map(tab => {
            const active = isActive(tab)
            const TIcon  = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id === 'more') {
                    setMoreOpen(prev => !prev)
                  } else {
                    setMoreOpen(false)
                    router.push(tab.href!)
                  }
                }}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 relative"
                aria-label={tab.label}
                aria-current={active ? 'page' : undefined}
              >
                {/* Active indicator pill */}
                {active && (
                  <span
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full"
                    style={{ background: '#6B7EFF' }}
                  />
                )}
                <TIcon
                  size={22}
                  style={{ color: active ? '#6B7EFF' : 'rgba(255,255,255,0.45)' }}
                />
                <span
                  className="text-[10px] font-medium"
                  style={{ color: active ? '#6B7EFF' : 'rgba(255,255,255,0.45)' }}
                >
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* ── "More" slide-up sheet ── */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMoreOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} />

          {/* Sheet panel */}
          <div
            className="absolute left-0 right-0 bottom-14 rounded-t-2xl overflow-y-auto"
            style={{
              background:    '#0F172A',
              maxHeight:     '75vh',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Sheet handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-4 pb-3 border-b border-white/10">
              <span className="text-sm font-semibold text-white/90">All Sections</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="text-white/50 hover:text-white/80 p-1"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            {/* Nav sections */}
            <div className="p-4 space-y-5">
              {MORE_SECTIONS.map(section => (
                <div key={section.label}>
                  <p className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2 px-1">
                    {section.label}
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {section.items.map(item => {
                      const IIcon = item.icon
                      const active = pathname === item.href || pathname.startsWith(item.href + '/')
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl text-center"
                          style={{
                            background: active ? 'rgba(107,126,255,0.15)' : 'rgba(255,255,255,0.04)',
                            border:     active ? '0.5px solid rgba(107,126,255,0.4)' : '0.5px solid rgba(255,255,255,0.06)',
                          }}
                        >
                          <IIcon
                            size={20}
                            style={{ color: active ? '#6B7EFF' : 'rgba(255,255,255,0.6)' }}
                          />
                          <span
                            className="text-[11px] font-medium leading-tight"
                            style={{ color: active ? '#a5b4fc' : 'rgba(255,255,255,0.55)' }}
                          >
                            {item.label}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
