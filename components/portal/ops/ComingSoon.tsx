'use client'

/**
 * ComingSoon — body for property-portal tabs that are designed but not built.
 * Client component so it can read the shell palette `C` (a server page can't:
 * values exported from a 'use client' file arrive as client references).
 */
import Link from 'next/link'
import Image from 'next/image'
import { C } from '@/components/portal/ops/OpsShell'

export function ComingSoon({ title, body, link }: { title: string; body: string; link?: { label: string; href: string } }) {
  return (
    <section style={{ minHeight: 'calc(100vh - 140px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px 16px' }}>
      <Image src="/logo-sm.png" alt="GateGuard" width={112} height={112} priority />
      <div style={{ marginTop: 20, fontSize: 13, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.blue }}>Coming soon</div>
      <h1 style={{ margin: '6px 0 0', fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: C.ink }}>{title}</h1>
      <p style={{ margin: '8px 0 0', maxWidth: 440, color: C.ink3, fontSize: 15 }}>{body}</p>
      {link && (
        <Link href={link.href} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, marginTop: 12, color: C.blue, fontWeight: 600, textDecoration: 'none' }}>
          {link.label} →
        </Link>
      )}
    </section>
  )
}

export default ComingSoon
