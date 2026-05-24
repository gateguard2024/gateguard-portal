/**
 * Lightweight confetti trigger using canvas-confetti CDN fallback.
 * No npm dependency — loads from CDN on first call.
 */

let loaded = false

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (loaded || typeof window === 'undefined') { resolve(); return; }
    const existing = document.getElementById('confetti-cdn')
    if (existing) { loaded = true; resolve(); return; }
    const script = document.createElement('script')
    script.id = 'confetti-cdn'
    script.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js'
    script.onload = () => { loaded = true; resolve(); }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

export async function fireConfetti(type: 'milestone' | 'certified' | 'big' = 'milestone') {
  if (typeof window === 'undefined') return
  try {
    await loadScript()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const confetti = (window as any).confetti
    if (!confetti) return

    if (type === 'big' || type === 'certified') {
      // Two-burst cannon for big moments
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ['#2563eb','#6B7EFF','#fafaf9','#10b981'] })
      setTimeout(() => {
        confetti({ particleCount: 80, spread: 50, origin: { y: 0.7, x: 0.3 }, colors: ['#2563eb','#6B7EFF','#fafaf9'] })
        confetti({ particleCount: 80, spread: 50, origin: { y: 0.7, x: 0.7 }, colors: ['#2563eb','#6B7EFF','#fafaf9'] })
      }, 300)
    } else {
      confetti({ particleCount: 60, spread: 55, origin: { y: 0.65 }, colors: ['#2563eb','#6B7EFF','#fafaf9','#10b981'] })
    }
  } catch {
    // Non-critical — confetti is purely cosmetic
  }
}
