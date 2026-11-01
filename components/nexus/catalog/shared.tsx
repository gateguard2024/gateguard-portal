'use client'
/**
 * Catalog — shared types, look and helpers for the Catalog list, the product
 * page and the product editor. Light look (same tokens as Tasks / Operations).
 */
import React, { useState } from 'react'

// ── Look ─────────────────────────────────────────────────────────────────────
export const BG = '#F5F5F7'
export const CARD = '#FFFFFF'
export const PANEL = '#F7F8FA'
export const BORDER = 'rgba(0,0,0,0.12)'
export const LINE = 'rgba(0,0,0,0.08)'
export const TEXT = '#1D1D1F'
export const TEXT2 = '#3A3A3C'
export const MUTED = '#6E6E73'
export const BRAND = '#0071E3'
export const CYAN = '#0071E3'
export const GREEN = '#1A7F37'
export const ORANGE = '#B25000'
export const RED = '#D70015'
export const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif'
export const SHADOW = '0 1px 2px rgba(10,20,40,.06), 0 8px 24px rgba(10,20,40,.08)'

// ── Option sets ──────────────────────────────────────────────────────────────
export const CATEGORIES = ['Camera', 'Access Control', 'Gate Operator', 'Callbox / Intercom', 'Network', 'Wire & Hardware', 'Labor'] as const
export const UNITS = ['each', 'ft', 'box', 'roll', 'hour', 'set', 'pair'] as const
export const DESIGN_ROLES = ['', 'camera', 'board', 'gateway', 'reader', 'switch', 'power', 'intercom', 'gate', 'sensor', 'lock', 'network', 'other']
export const DESIGN_CABLES = ['', '110V 12/2', '240V 12/3', '16/2', '18/2', '18/6', '22/4', '22/2 shielded', 'CAT6', 'CAT5e']
export const DESIGN_COLORS = ['#0071E3', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#0891B2', '#64748B', '#111827']
export const BRAND_COLORS: Record<string, string> = {
  'Eagle Eye Networks': '#1B4F72', 'LTS Security': '#1A5276', 'Ubiquiti': '#0559C9',
  'Brivo': '#0F4C81', 'Altronix': '#1F618D', 'Securitron (ASSA ABLOY)': '#117A65',
  'DITEK': '#1E8449', 'Optex': '#6C3483', 'DoorKing': '#784212', 'FAAC': '#943126',
  'Viking Electronics': '#7B241C', '2N': '#1A252F', 'Shelly': '#E67E22',
  'Belden': '#1C2833', 'ADI Pro': '#17202A', 'GateGuard': '#0071E3', 'Bosch': '#B03A2E',
}

// ── Types ────────────────────────────────────────────────────────────────────
export interface Terminal { name: string; dx: number; dy: number; lx?: number; ly?: number }
export interface DesignMeta {
  role?: string; abbr?: string; color?: string; isBoard?: boolean
  placementImageUrl?: string; wiringImageUrl?: string; terminals?: Terminal[]; defaultCable?: string
}
export interface Accessory { product_id: string; qty: number; required: boolean }

// Raw DB row (snake_case, drift-tolerant — every field optional).
export interface ProductRow {
  id: string
  name: string
  sku?: string | null
  brand?: string | null
  category?: string | null
  subcategory?: string | null
  description?: string | null
  specs?: string | null
  msrp?: number | null
  dealer_cost?: number | null
  sell_price?: number | null
  adi_sku?: string | null
  image_url?: string | null
  manual_url?: string | null
  active?: boolean | null
  field_service?: boolean | null
  tags?: string[] | null
  org_id?: string | null
  labor_hours?: number | null
  unit?: string | null
  warranty_months?: number | null
  accessories?: Accessory[] | null
  updated_at?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  design_meta?: any
}

// Editor form (non-null).
export interface ProductForm {
  id?: string
  sku: string; brand: string; name: string; category: string; subcategory: string
  description: string; specs: string
  msrp: number; dealerCost: number; sellPrice: number; ggCost: number | null
  adiSku: string; imageUrl: string; active: boolean; fieldService: boolean; tags: string[]
  laborHours: number | null; unit: string; warrantyMonths: number | null; accessories: Accessory[]
  designMeta: DesignMeta
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export const brandInitials = (brand: string) => (brand || '?').split(/[\s/]+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)
export const fmt$ = (n: number | null | undefined) => (n != null && Number(n) > 0 ? `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—')
export const calcMargin = (cost: number, sell: number) => (sell > 0 && cost > 0 ? Math.round(((sell - cost) / sell) * 100) : null)
export const marginColor = (m: number | null) => (m === null ? MUTED : m >= 40 ? GREEN : m >= 25 ? ORANGE : RED)
export const catOf = (p: ProductRow) => (p.category && p.category.trim() ? p.category : 'Other')
export const priceAtMargin = (cost: number, pct: number) => (cost > 0 && pct < 100 ? Math.round((cost / (1 - pct / 100)) * 100) / 100 : 0)

export const rowToForm = (r: ProductRow, ggCost: number | null = null): ProductForm => ({
  id: r.id, sku: r.sku ?? '', brand: r.brand ?? '', name: r.name ?? '', category: r.category ?? 'Camera', subcategory: r.subcategory ?? '',
  description: r.description ?? '', specs: r.specs ?? '',
  msrp: Number(r.msrp) || 0, dealerCost: Number(r.dealer_cost) || 0, sellPrice: Number(r.sell_price) || 0, ggCost,
  adiSku: r.adi_sku ?? '', imageUrl: r.image_url ?? '', active: r.active ?? true, fieldService: r.field_service ?? false,
  tags: Array.isArray(r.tags) ? r.tags : [],
  laborHours: r.labor_hours != null ? Number(r.labor_hours) : null, unit: r.unit || 'each',
  warrantyMonths: r.warranty_months != null ? Number(r.warranty_months) : null,
  accessories: Array.isArray(r.accessories) ? r.accessories : [],
  designMeta: r.design_meta && typeof r.design_meta === 'object' ? r.design_meta : {},
})

export const emptyForm = (): ProductForm => ({
  sku: '', brand: 'GateGuard', name: '', category: 'Camera', subcategory: '', description: '', specs: '',
  msrp: 0, dealerCost: 0, sellPrice: 0, ggCost: null, adiSku: '', imageUrl: '', active: true, fieldService: false, tags: [],
  laborHours: null, unit: 'each', warrantyMonths: null, accessories: [], designMeta: {},
})

/** Link that opens a product page from anywhere in Nexus. */
export const productHref = (id: string) => `/?tab=catalog&product=${id}`

// ── Small UI ─────────────────────────────────────────────────────────────────
export function ProductThumb({ url, brand, size = 40 }: { url?: string | null; brand: string; size?: number }) {
  const [err, setErr] = useState(false)
  const color = BRAND_COLORS[brand] ?? '#5A6B85'
  if (url && !err) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={brand} onError={() => setErr(true)} className="object-contain rounded-lg bg-white shrink-0" style={{ width: size, height: size, border: `1px solid ${LINE}` }} />
  }
  return <div className="rounded-lg flex items-center justify-center shrink-0 font-semibold text-white" style={{ width: size, height: size, background: color, fontSize: size * 0.3 }}>{brandInitials(brand)}</div>
}

export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-medium block" style={{ color: MUTED }}>
        {label}{required && <span className="ml-0.5" style={{ color: RED }}>*</span>}{hint && <span className="ml-1 font-normal" style={{ color: '#8E8E93' }}>{hint}</span>}
      </label>
      {children}
    </div>
  )
}

export const inputStyle: React.CSSProperties = { backgroundColor: '#fff', border: `1px solid ${BORDER}`, color: TEXT }
export const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#0071E3]/40'
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
