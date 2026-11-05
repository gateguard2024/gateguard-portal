// lib/mail-signature.ts
// Email signatures can be plain text (old) or HTML with a logo/photo. Pictures pasted or
// uploaded into the signature are stored as data: URLs; when an email is sent they go
// out as inline attachments (cid:) — Gmail and Outlook block data: images, but show
// inline ones everywhere without the reader having to click "show images".

export type InlineImage = { cid: string; contentType: string; content: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
export const MAX_SIGNATURE_BYTES = 600_000

export function isHtmlSignature(sig: string): boolean {
  return /<\s*(img|div|p|br|table|span|a|b|strong|i|em|font)\b/i.test(sig)
}

// Keep formatting; drop anything that could run code or pull in other pages.
export function cleanSignatureHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|form|textarea|select|button|svg|math)\b[\s\S]*?<\/\s*\1\s*>/gi, '')
    .replace(/<\/?\s*(script|style|iframe|object|embed|form|input|button|textarea|select|meta|link|base|svg|math)\b[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*("|')\s*(javascript|vbscript):[^"']*\2/gi, '$1="#"')
    .replace(/<img\b(?![^>]*\bsrc\s*=\s*["'](data:image\/(png|jpe?g|gif|webp);base64,|https:\/\/))[^>]*>/gi, '')
}

export function signatureText(html: string): string {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr|li|h\d)>/gi, '\n').replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, '$1').replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim()
}

// → what to add to an outgoing email.
export function signatureParts(raw: string): { html: string; text: string; inline: InlineImage[] } {
  const sig = (raw ?? '').trim()
  if (!sig) return { html: '', text: '', inline: [] }
  if (!isHtmlSignature(sig)) return { html: esc(sig).replace(/\n/g, '<br>'), text: sig, inline: [] }
  const inline: InlineImage[] = []
  let n = 0
  const html = cleanSignatureHtml(sig).replace(/src\s*=\s*(["'])data:(image\/(?:png|jpe?g|gif|webp));base64,([A-Za-z0-9+/=\s]+)\1/gi, (_m, q, type, b64) => {
    const cid = `sig${++n}.${Date.now().toString(36)}@gateguard`
    inline.push({ cid, contentType: type.toLowerCase().replace('jpg', 'jpeg'), content: String(b64).replace(/\s/g, '') })
    return `src=${q}cid:${cid}${q}`
  })
  return { html, text: signatureText(html), inline }
}
