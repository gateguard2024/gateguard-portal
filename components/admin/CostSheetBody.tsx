'use client'

/**
 * CostSheetBody — Gate Guard's cost model, rendered from the corporate-gated
 * /api/admin/costs route. Cost values only arrive if the server says the viewer
 * is corporate (403 otherwise), so a dealer's browser never receives them even
 * if this component were somehow mounted. Step 4 makes these editable + adds the
 * dealer waterfall (our cost + 10% = dealer cost, then suggested retail).
 */
import { useEffect, useState } from 'react'

interface CostLine { name: string; unit: string; cost: number }
interface PartCost { name: string; cost: number; hours: number }
interface CostData { recurring: CostLine[]; parts: PartCost[]; dealer_cost_margin: number }

const money = (n: number) => '$' + n.toLocaleString()

const panel: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(8,18,34,0.70), rgba(3,9,22,0.48))',
  border: '1px solid rgba(139,92,246,0.16)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
}

export function CostSheetBody() {
  const [data, setData] = useState<CostData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/admin/costs')
      .then(async r => {
        if (!alive) return
        if (r.status === 403) { setError('Cost data is corporate only.'); return }
        if (!r.ok) { setError('Could not load costs.'); return }
        setData(await r.json())
      })
      .catch(() => alive && setError('Could not load costs.'))
    return () => { alive = false }
  }, [])

  if (error) {
    return (
      <div className="rounded-3xl p-4" style={panel}>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.62)' }}>{error}</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="rounded-3xl p-4" style={panel}>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.54)' }}>Loading cost model…</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(248,113,113,0.32)' }}>
        <div className="flex items-center gap-2">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: 'rgba(248,113,113,0.22)', color: '#fecaca' }}>Corporate only</span>
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.66)' }}>
            Gate Guard&apos;s true cost — never shown to dealers. Drives the calculators&apos; margin math.
          </span>
        </div>
      </div>

      {/* Monthly recurring cost */}
      <div className="overflow-hidden rounded-3xl" style={panel}>
        <div className="border-b px-4 py-3" style={{ borderColor: 'rgba(139,92,246,0.16)' }}>
          <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>Monthly recurring cost</div>
          <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>What Gate Guard pays each month per line</div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: 'rgba(196,181,253,0.7)' }}>
              <th className="px-4 py-2 text-left font-semibold uppercase tracking-wider">Item</th>
              <th className="px-4 py-2 text-left font-semibold uppercase tracking-wider">Billed</th>
              <th className="px-4 py-2 text-right font-semibold uppercase tracking-wider">Cost</th>
            </tr>
          </thead>
          <tbody>
            {data.recurring.map(l => (
              <tr key={l.name} style={{ borderTop: '1px solid rgba(139,92,246,0.10)' }}>
                <td className="px-4 py-2 font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>{l.name}</td>
                <td className="px-4 py-2" style={{ color: 'rgba(255,255,255,0.55)' }}>{l.unit}</td>
                <td className="px-4 py-2 text-right font-semibold" style={{ color: '#a7f3d0' }}>{money(l.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* One-time install hardware */}
      <div className="overflow-hidden rounded-3xl" style={panel}>
        <div className="border-b px-4 py-3" style={{ borderColor: 'rgba(139,92,246,0.16)' }}>
          <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.94)' }}>One-time install hardware</div>
          <div className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>Part cost + install hours — feeds the install profit check</div>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: 'rgba(196,181,253,0.7)' }}>
              <th className="px-4 py-2 text-left font-semibold uppercase tracking-wider">Part</th>
              <th className="px-4 py-2 text-right font-semibold uppercase tracking-wider">Cost</th>
              <th className="px-4 py-2 text-right font-semibold uppercase tracking-wider">Install hrs</th>
            </tr>
          </thead>
          <tbody>
            {data.parts.map(p => (
              <tr key={p.name} style={{ borderTop: '1px solid rgba(139,92,246,0.10)' }}>
                <td className="px-4 py-2 font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>{p.name}</td>
                <td className="px-4 py-2 text-right font-semibold" style={{ color: '#a7f3d0' }}>{money(p.cost)}</td>
                <td className="px-4 py-2 text-right" style={{ color: 'rgba(255,255,255,0.55)' }}>{p.hours ? `${p.hours}h` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl px-4 py-3" style={panel}>
        <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Next (step 4): make these editable and add the dealer waterfall — our cost + {Math.round(data.dealer_cost_margin * 100)}% margin = dealer cost, then suggested retail.
        </p>
      </div>
    </div>
  )
}
