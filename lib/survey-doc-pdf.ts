/**
 * lib/survey-doc-pdf.ts — SERVER-ONLY. Renders the Pre-Proposal Survey record to a
 * PDF Buffer (for email attachment) via pdfkit, embedding the captured photos.
 *
 * Kept separate from any client-imported module so pdfkit (which needs Node's `fs`)
 * never lands in a browser bundle. Only server routes import this file.
 */
import PDFDocument from 'pdfkit'
import { resolveSurvey, staticMapUrl, type SurveyDocConfig, type AreaPhoto } from '@/lib/survey-doc'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = Record<string, any>

const NAVY = '#12233b', MUT = '#5a6c84', BODY = '#27364a', ORANGE = '#c2410c', INK = '#1a2432', LINE = '#e5ebf1'
const MAX_IMAGES = 40

async function fetchImg(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  } catch { return null }
}

export async function surveyPdfBuffer(survey: AnyRec, cfg: SurveyDocConfig = {}): Promise<Buffer> {
  const r = resolveSurvey(survey, cfg)

  // Site-layout image: the uploaded aerial, else a Mapbox satellite map with pins
  // placed from photo GPS (when available).
  const aerialUrl = r.aerialUrl || (r.hasGeo ? staticMapUrl(r.pins) : '')

  // Prefetch every photo we might embed (hero, aerial, area photos, index) up to a cap.
  const urls = new Set<string>()
  if (r.heroUrl) urls.add(r.heroUrl)
  if (aerialUrl) urls.add(aerialUrl)
  for (const p of r.photoIndex) if (p.url) urls.add(p.url)
  const capped = Array.from(urls).slice(0, MAX_IMAGES)
  const imgMap = new Map<string, Buffer>()
  await Promise.all(capped.map(async u => { const b = await fetchImg(u); if (b) imgMap.set(u, b) }))

  return await new Promise<Buffer>((resolve, reject) => {
    const pdf = new PDFDocument({ size: 'LETTER', margin: 48 })
    const chunks: Buffer[] = []
    pdf.on('data', (c: Buffer) => chunks.push(c))
    pdf.on('end', () => resolve(Buffer.concat(chunks)))
    pdf.on('error', reject)

    const L = pdf.page.margins.left
    const R = pdf.page.width - pdf.page.margins.right
    const W = R - L
    const bottom = () => pdf.page.height - pdf.page.margins.bottom
    const ensure = (h: number) => { if (pdf.y + h > bottom()) pdf.addPage() }
    const rule = (color = LINE, w = 1) => { const y = pdf.y; pdf.moveTo(L, y).lineTo(R, y).strokeColor(color).lineWidth(w).stroke(); pdf.y = y + 1 }
    const kicker = (t: string) => { pdf.font('Helvetica-Bold').fontSize(9).fillColor(ORANGE).text(t.toUpperCase(), { characterSpacing: 1 }); pdf.moveDown(0.1) }
    const heading = (t: string) => { pdf.font('Helvetica-Bold').fontSize(18).fillColor(NAVY).text(t); pdf.moveDown(0.4) }
    const para = (t: string, size = 10) => { pdf.font('Helvetica').fontSize(size).fillColor(BODY).text(t, { lineGap: 2 }); pdf.moveDown(0.4) }
    const section = () => { pdf.moveDown(0.4); rule(LINE, 1); pdf.moveDown(0.6) }

    const drawImage = (buf: Buffer, x: number, y: number, w: number, h: number) => {
      try { pdf.save(); pdf.rect(x, y, w, h).clip(); pdf.image(buf, x, y, { cover: [w, h] }); pdf.restore() } catch { /* skip bad image */ }
    }

    // ── Cover ─────────────────────────────────────────────
    const top = pdf.y
    pdf.font('Helvetica-Bold').fontSize(16).fillColor(NAVY).text('GATEGUARD', L, top)
    pdf.font('Helvetica').fontSize(8).fillColor(MUT).text(`SURVEY RECORD ${r.recordNo}\nVERSION ${r.version} · ISSUED ${r.issuedDate}`, L, top + 1, { align: 'right', width: W })
    pdf.moveDown(0.8); rule(ORANGE, 2); pdf.moveDown(0.8)

    const hero = r.heroUrl ? imgMap.get(r.heroUrl) : null
    if (hero) { ensure(220); drawImage(hero, L, pdf.y, W, 210); pdf.y += 220 }

    kicker('GateGuard Pre-Proposal Survey')
    pdf.font('Helvetica-Bold').fontSize(28).fillColor(NAVY).text(r.property)
    if (r.address) pdf.font('Helvetica').fontSize(11).fillColor(MUT).text(r.address)
    pdf.moveDown(0.6); rule(LINE, 1); pdf.moveDown(0.5)

    const cell = (label: string, value: string, sub: string, x: number, y: number, w: number) => {
      pdf.font('Helvetica-Bold').fontSize(8).fillColor(MUT).text(label.toUpperCase(), x, y, { width: w, characterSpacing: 0.5 })
      pdf.font('Helvetica-Bold').fontSize(12).fillColor(INK).text(value || '—', x, y + 12, { width: w })
      if (sub) pdf.font('Helvetica').fontSize(9).fillColor(MUT).text(sub, x, y + 28, { width: w })
    }
    const cy = pdf.y
    const colW = (W - 24) / 2
    cell('Prepared for', r.preparedForName, [r.preparedForContact, r.contactTitle].filter(Boolean).join(', '), L, cy, colW)
    cell('Survey date', r.surveyDate, r.walkWindow ? `On-site walk, ${r.walkWindow}` : '', L + colW + 24, cy, colW)
    cell('Surveyed by', r.surveyedBy, r.surveyorRole, L, cy + 46, colW)
    cell('Record', `${r.totalPhotos} photos`, r.recordSummary, L + colW + 24, cy + 46, colW)
    pdf.y = cy + 92

    // ── Executive summary ─────────────────────────────────
    if (r.execSummary) {
      pdf.addPage(); kicker('01 · Summary'); heading('Executive summary'); para(r.execSummary)
      pdf.moveDown(0.2)
      pdf.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('PROPERTY'); pdf.moveDown(0.2)
      for (const f of r.facts) { pdf.font('Helvetica').fontSize(10).fillColor(BODY).text(`${f.label}:  `, { continued: true }); pdf.font('Helvetica-Bold').fillColor(INK).text(f.value) }
    }

    // ── Findings ──────────────────────────────────────────
    pdf.addPage(); kicker('02 · Findings'); heading('Summary of findings'); para(r.findingsIntro)
    for (const st of r.stats) {
      ensure(40)
      pdf.font('Helvetica-Bold').fontSize(20).fillColor(NAVY).text(String(st.num), { continued: true })
      pdf.font('Helvetica-Bold').fontSize(11).fillColor('#185fa5').text('   ' + String(st.label || ''))
      if (st.sub) pdf.font('Helvetica').fontSize(9).fillColor(MUT).text(String(st.sub))
      pdf.moveDown(0.3)
    }
    if (r.priorityFindings.length) {
      pdf.moveDown(0.3); pdf.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('PRIORITY FINDINGS'); pdf.moveDown(0.3)
      for (const f of r.priorityFindings) {
        ensure(40)
        pdf.font('Helvetica-Bold').fontSize(10).fillColor(ORANGE).text(`${f.ref}  `, { continued: true })
        pdf.fillColor(INK).text(String(f.title || ''), { continued: true })
        pdf.font('Helvetica-Bold').fontSize(8).fillColor(f.priority === 'HIGH' ? '#b4330f' : '#9a6b00').text(`    ${f.priority}`)
        if (f.detail) pdf.font('Helvetica').fontSize(9.5).fillColor(BODY).text(String(f.detail), { lineGap: 1 })
        pdf.moveDown(0.3)
      }
    }

    // ── Site layout ───────────────────────────────────────
    const aerialBuf = aerialUrl ? imgMap.get(aerialUrl) : null
    if (aerialBuf || r.pins.length) {
      pdf.addPage(); kicker('03 · Overview'); heading('Site layout')
      if (aerialBuf) { ensure(300); drawImage(aerialBuf, L, pdf.y, W, 290); pdf.y += 300 }
      for (const p of r.pins) {
        pdf.font('Helvetica-Bold').fontSize(10).fillColor(ORANGE).text(`${p.pin}  `, { continued: true })
        pdf.fillColor(INK).text(String(p.area || ''), { continued: true })
        pdf.font('Helvetica').fontSize(9).fillColor(MUT).text(`   ${p.kind === 'amenity' ? 'Amenity' : 'Vehicle entrance'}`)
      }
    }

    // ── Openings ──────────────────────────────────────────
    if (r.openings.length) {
      pdf.addPage(); kicker('04 · Access'); heading('Openings as found')
      for (const o of r.openings) {
        ensure(30)
        pdf.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(`${o.opening} `, { continued: true })
        pdf.font('Helvetica').fontSize(9).fillColor(MUT).text(`(${o.type}${o.pin ? ` · pin ${o.pin}` : ''})  `, { continued: true })
        pdf.font('Helvetica-Bold').fontSize(9).fillColor(String(o.status).toUpperCase().includes('NON') ? '#b4330f' : MUT).text(String(o.status || ''))
        if (o.notes) pdf.font('Helvetica').fontSize(9.5).fillColor(BODY).text(String(o.notes), { lineGap: 1 })
        pdf.moveDown(0.25)
      }
      for (const [t, v] of [['Hardware in place', r.hardwareNote], ['Head-end', r.headendNote], ['Video', r.videoNote]] as const) {
        if (v) { pdf.moveDown(0.2); pdf.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text(t.toUpperCase()); pdf.font('Helvetica').fontSize(9.5).fillColor(BODY).text(v) }
      }
    }

    // ── Area records with photos ──────────────────────────
    for (const a of r.areas) {
      pdf.addPage()
      pdf.font('Helvetica-Bold').fontSize(20).fillColor(ORANGE).text(String(a.no || ''), { continued: true })
      pdf.fillColor(NAVY).text('  ' + String(a.title || ''))
      if (a.subtitle) pdf.font('Helvetica-Bold').fontSize(8).fillColor(MUT).text(String(a.subtitle).toUpperCase())
      pdf.moveDown(0.3)
      if (a.narrative) para(a.narrative)
      if (a.equipment && a.equipment.length) {
        pdf.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('EQUIPMENT OBSERVED'); pdf.moveDown(0.1)
        for (const e of a.equipment) {
          pdf.font('Helvetica-Bold').fontSize(9).fillColor(ORANGE).text(`${e.tag}  `, { continued: true })
          pdf.fillColor(INK).text(String(e.label || ''), { continued: !!e.sub })
          if (e.sub) pdf.font('Helvetica').fillColor(MUT).text(`  ${e.sub}`)
        }
        pdf.moveDown(0.3)
      }
      if (a.observations && a.observations.length) {
        pdf.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text('OBSERVATIONS'); pdf.moveDown(0.1)
        for (const o of a.observations) pdf.font('Helvetica').fontSize(9.5).fillColor(BODY).text(`• ${o}`)
        pdf.moveDown(0.3)
      }
      const photos = (a.photos || []).filter(p => p.url && imgMap.get(p.url))
      if (photos.length) {
        const gap = 10, cols = 3, pw = (W - gap * (cols - 1)) / cols, ph = pw * 0.75
        for (let i = 0; i < photos.length; i += cols) {
          ensure(ph + 24)
          const rowY = pdf.y
          for (let c = 0; c < cols && i + c < photos.length; c++) {
            const p = photos[i + c]; const buf = imgMap.get(p.url!)!
            const x = L + c * (pw + gap)
            drawImage(buf, x, rowY, pw, ph)
            pdf.font('Helvetica-Bold').fontSize(8).fillColor(INK).text(String(p.caption || ''), x, rowY + ph + 2, { width: pw })
          }
          pdf.y = rowY + ph + 20
        }
      }
    }

    // ── Scope schedule ────────────────────────────────────
    if (r.schedule.length) {
      pdf.addPage(); kicker('Schedule'); heading('Scope schedule')
      for (const row of r.schedule) {
        ensure(22)
        pdf.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(`${row.device} `, { continued: true })
        pdf.font('Helvetica').fontSize(9).fillColor(MUT).text(`×${row.qty} · ${row.make} · ${row.condition} → `, { continued: true })
        pdf.font('Helvetica-Bold').fillColor(NAVY).text(String(row.disposition || ''))
      }
      if (r.scheduleNote) { pdf.moveDown(0.3); pdf.font('Helvetica').fontSize(8.5).fillColor(MUT).text(r.scheduleNote) }
    }

    // ── Open items + recommendations ──────────────────────
    if (r.openItems.length) {
      pdf.addPage(); kicker('Register'); heading('Open items')
      for (const o of r.openItems) { ensure(24); pdf.font('Helvetica-Bold').fontSize(10).fillColor(ORANGE).text(`${o.ref}  `, { continued: true }); pdf.fillColor(INK).text(String(o.item || '')); if (o.why) pdf.font('Helvetica').fontSize(9.5).fillColor(BODY).text(`${o.why}${o.owner ? `  · Owner: ${o.owner}` : ''}`); pdf.moveDown(0.25) }
    }
    if (r.recommendations.length) {
      pdf.addPage(); kicker('Next steps'); heading('Recommendations')
      for (const rec of r.recommendations) {
        ensure(30)
        pdf.font('Helvetica-Bold').fontSize(10).fillColor(ORANGE).text(`${rec.ref}  `, { continued: true })
        pdf.fillColor(INK).text(String(rec.title || ''), { continued: true })
        pdf.font('Helvetica-Bold').fontSize(8).fillColor(rec.priority === 'HIGH' ? '#b4330f' : '#9a6b00').text(`    ${rec.priority}`)
        if (rec.detail) pdf.font('Helvetica').fontSize(9.5).fillColor(BODY).text(String(rec.detail))
        if (rec.owner) pdf.font('Helvetica-Bold').fontSize(8).fillColor(MUT).text(`OWNER · ${rec.owner}`)
        pdf.moveDown(0.3)
      }
    }

    // ── Photo index ───────────────────────────────────────
    const idx = r.photoIndex.filter((p: AreaPhoto) => p.url && imgMap.get(p.url))
    if (idx.length) {
      pdf.addPage(); kicker('Appendix'); heading('Photo index')
      const gap = 10, cols = 4, pw = (W - gap * (cols - 1)) / cols, ph = pw * 0.75
      for (let i = 0; i < idx.length; i += cols) {
        ensure(ph + 22)
        const rowY = pdf.y
        for (let c = 0; c < cols && i + c < idx.length; c++) {
          const p = idx[i + c]; const buf = imgMap.get(p.url!)!
          const x = L + c * (pw + gap)
          drawImage(buf, x, rowY, pw, ph)
          pdf.font('Helvetica-Bold').fontSize(7).fillColor(INK).text(`${p.code} ${p.caption || ''}`, x, rowY + ph + 2, { width: pw })
        }
        pdf.y = rowY + ph + 18
      }
    }

    pdf.end()
  })
}
