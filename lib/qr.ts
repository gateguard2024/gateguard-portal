/**
 * Tiny QR code maker (no package needed) — byte mode, error correction M,
 * versions 1–10 (up to 213 characters; a unit link is ~40). Follows the QR spec
 * (ISO/IEC 18004) the same way Project Nayuki's reference encoder does.
 * qrMatrix(text) → rows of true (dark) / false; qrSvgPath(m) → one SVG path.
 * Checked by decoding with OpenCV in the tests (ui/t237.py).
 */
const ECC = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26]      // EC codewords per block (level M), v1–v10
const BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
const TOTAL = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346]
const ALIGN: number[][] = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]]

const mul = (x: number, y: number) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x } return z }
function rsDivisor(deg: number) {
  const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1
  for (let i = 0; i < deg; i++) { for (let j = 0; j < deg; j++) { r[j] = mul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1] } root = mul(root, 2) }
  return r
}
function rsRemainder(data: number[], div: number[]) {
  const r = new Array(div.length).fill(0)
  for (const b of data) { const f = b ^ (r.shift() as number); r.push(0); div.forEach((d, i) => { r[i] ^= mul(d, f) }) }
  return r
}
const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0

export function qrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text))
  let v = 0
  for (let k = 1; k <= 10; k++) {
    const cap = (TOTAL[k - 1] - ECC[k - 1] * BLOCKS[k - 1]) * 8
    if (4 + (k < 10 ? 8 : 16) + bytes.length * 8 <= cap) { v = k; break }
  }
  if (!v) throw new Error('Too long for a QR label')
  const dataCap = TOTAL[v - 1] - ECC[v - 1] * BLOCKS[v - 1]
  // data bits
  const bits: number[] = []
  const put = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1) }
  put(4, 4); put(bytes.length, v < 10 ? 8 : 16); for (const b of bytes) put(b, 8)
  put(0, Math.min(4, dataCap * 8 - bits.length)); while (bits.length % 8) bits.push(0)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2))
  for (let pad = 0xec; data.length < dataCap; pad ^= 0xec ^ 0x11) data.push(pad)
  // error correction + interleave
  const nb = BLOCKS[v - 1], ecl = ECC[v - 1], raw = TOTAL[v - 1]
  const nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb), div = rsDivisor(ecl)
  const blocks: number[][] = []
  for (let i = 0, k = 0; i < nb; i++) {
    const dat = data.slice(k, k + shortLen - ecl + (i < nShort ? 0 : 1)); k += dat.length
    const ecc = rsRemainder(dat, div)
    if (i < nShort) dat.push(0)
    blocks.push(dat.concat(ecc))
  }
  const cw: number[] = []
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - ecl || j >= nShort) cw.push(b[i]) })

  // matrix + function patterns
  const n = v * 4 + 17
  const m: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false))
  const fn: boolean[][] = Array.from({ length: n }, () => new Array(n).fill(false))
  const set = (x: number, y: number, d: boolean) => { m[y][x] = d; fn[y][x] = true }
  for (let i = 0; i < n; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0) }
  for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy
      if (x >= 0 && x < n && y >= 0 && y < n) set(x, y, d !== 2 && d !== 4)
    }
  }
  const al = ALIGN[v - 1], last = al.length - 1
  for (let i = 0; i < al.length; i++) for (let j = 0; j < al.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
  }
  const format = (mask: number) => {
    const d = (0 << 3) | mask // level M = 0
    let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537)
    const b = ((d << 10) | r) ^ 0x5412
    for (let i = 0; i <= 5; i++) set(8, i, bit(b, i))
    set(8, 7, bit(b, 6)); set(8, 8, bit(b, 7)); set(7, 8, bit(b, 8))
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(b, i))
    for (let i = 0; i < 8; i++) set(n - 1 - i, 8, bit(b, i))
    for (let i = 8; i < 15; i++) set(8, n - 15 + i, bit(b, i))
    set(8, n - 8, true)
  }
  format(0)
  if (v >= 7) {
    let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25)
    const b = (v << 12) | r
    for (let i = 0; i < 18; i++) { const a = n - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, bit(b, i)); set(c, a, bit(b, i)) }
  }
  // place data
  let i = 0
  for (let right = n - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < n; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? n - 1 - vert : vert
      if (!fn[y][x] && i < cw.length * 8) { m[y][x] = bit(cw[i >>> 3], 7 - (i & 7)); i++ }
    }
  }
  // pick the mask with the lowest penalty
  const masked = (k: number) => {
    const out = m.map((row) => row.slice())
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (fn[y][x]) continue
      const c = [(x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0, (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
        ((x * y) % 2) + ((x * y) % 3) === 0, (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (((x + y) % 2) + ((x * y) % 3)) % 2 === 0][k]
      if (c) out[y][x] = !out[y][x]
    }
    return out
  }
  const penalty = (g: boolean[][]) => {
    let p = 0, dark = 0
    for (let a = 0; a < n; a++) {
      let runR = 1, runC = 1
      for (let b = 1; b < n; b++) {
        if (g[a][b] === g[a][b - 1]) { runR++; if (runR === 5) p += 3; else if (runR > 5) p++ } else runR = 1
        if (g[b][a] === g[b - 1][a]) { runC++; if (runC === 5) p += 3; else if (runC > 5) p++ } else runC = 1
      }
    }
    for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) { const c = g[y][x]; if (c === g[y][x + 1] && c === g[y + 1][x] && c === g[y + 1][x + 1]) p += 3 }
    for (const row of g) for (const c of row) if (c) dark++
    p += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10
    return p
  }
  let bestP = Infinity, bestK = 0
  for (let k = 0; k < 8; k++) { format(k); const pk = penalty(masked(k)); if (pk < bestP) { bestP = pk; bestK = k } }
  format(bestK)
  const out = masked(bestK)
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (fn[y][x]) out[y][x] = m[y][x]
  return out
}

/** One SVG path (1 unit per module, `margin` modules of quiet zone). viewBox = 0 0 size size. */
export function qrSvgPath(mtx: boolean[][], margin = 4): { d: string; size: number } {
  let d = ''
  mtx.forEach((row, y) => row.forEach((on, x) => { if (on) d += `M${x + margin} ${y + margin}h1v1h-1z` }))
  return { d, size: mtx.length + margin * 2 }
}
