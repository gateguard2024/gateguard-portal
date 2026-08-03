import { getCurrentUser } from '@/lib/current-user'
import { redirect } from 'next/navigation'
import { AriaCapsBody } from '@/components/admin/AriaCapsBody'

/**
 * /admin/aria-caps — CORPORATE ONLY (G5).
 * Set each dealer org's monthly ARIA save cap. Server-gated + API is corporate-only.
 */
export const dynamic = 'force-dynamic'

export default async function AriaCapsPage() {
  const user = await getCurrentUser()
  if (!user.isCorporate) redirect('/')

  return (
    <div className="min-h-dvh" style={{ background: 'linear-gradient(180deg, #0a1224, #050b16)' }}>
      <div className="mx-auto w-full max-w-4xl px-5 py-8">
        <div className="mb-1 text-[10px] uppercase tracking-[0.24em]" style={{ color: 'rgba(196,181,253,0.86)' }}>Internal · Corporate</div>
        <h1 className="mb-1 text-2xl font-semibold" style={{ color: 'rgba(255,255,255,0.97)' }}>ARIA Save Caps</h1>
        <p className="mb-6 text-sm" style={{ color: 'rgba(200,215,235,0.7)' }}>
          Cap how many new properties each dealer can save to the Intel DB per calendar month. Blank = unlimited.
        </p>
        <AriaCapsBody />
      </div>
    </div>
  )
}
