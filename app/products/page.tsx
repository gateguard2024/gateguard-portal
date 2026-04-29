"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { TopBar } from "@/components/layout/TopBar";
import {
  Plus, Search, Edit2, Package, Camera, Shield, Wifi, Cpu,
  Layers, Upload, X, Check, Trash2, Server, Hammer, CheckCircle2,
  Loader2, RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductCategory = "Camera" | "Access Control" | "Gate Operator" | "Callbox / Intercom" | "Network" | "Wire & Hardware" | "Labor";

interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  category: ProductCategory;
  subcategory: string;
  description: string;
  specs: string;
  msrp: number;
  dealerCost: number;
  sellPrice: number;
  adiSku: string;
  imageUrl: string;
  active: boolean;
}

// ─── Error helper — Supabase errors are plain objects, not Error instances ────
const getErrMsg = (err: unknown): string => {
  if (!err) return "Unknown error";
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
    if (typeof e.error_description === "string") return e.error_description;
    try { return JSON.stringify(e); } catch { /* ignore */ }
  }
  return String(err);
};

// ─── DB ↔ App mappers ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromDb = (row: any): Product => ({
  id:          row.id,
  sku:         row.sku,
  name:        row.name,
  brand:       row.brand ?? "",
  category:    row.category as ProductCategory,
  subcategory: row.subcategory ?? "",
  description: row.description ?? "",
  specs:       row.specs ?? "",
  msrp:        Number(row.msrp) ?? 0,
  dealerCost:  Number(row.dealer_cost) ?? 0,
  sellPrice:   Number(row.sell_price) ?? 0,
  adiSku:      row.adi_sku ?? "",
  imageUrl:    row.image_url ?? "",
  active:      row.active ?? true,
});

const toDb = (p: Omit<Product, "id">) => ({
  sku:         p.sku,
  name:        p.name,
  brand:       p.brand,
  category:    p.category,
  subcategory: p.subcategory,
  description: p.description,
  specs:       p.specs,
  msrp:        p.msrp,
  dealer_cost: p.dealerCost,
  sell_price:  p.sellPrice,
  adi_sku:     p.adiSku,
  image_url:   p.imageUrl,
  active:      p.active,
});

// ─── Brand color palette for placeholders ─────────────────────────────────────
const BRAND_COLORS: Record<string, string> = {
  "Eagle Eye Networks":      "#1B4F72",
  "LTS Security":            "#1A5276",
  "Ubiquiti":                "#0559C9",
  "Brivo":                   "#0F4C81",
  "Altronix":                "#1F618D",
  "Securitron (ASSA ABLOY)": "#117A65",
  "DITEK":                   "#1E8449",
  "Optex":                   "#6C3483",
  "DoorKing":                "#784212",
  "FAAC":                    "#943126",
  "Viking Electronics":      "#7B241C",
  "2N":                      "#1A252F",
  "Shelly":                  "#E67E22",
  "Belden":                  "#1C2833",
  "ADI Pro":                 "#17202A",
  "GateGuard":               "#2563EB",
  "Bosch":                   "#B03A2E",
};

const brandInitials = (brand: string) =>
  brand.split(/[\s/]+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);

// ─── Product image component ──────────────────────────────────────────────────
function ProductImage({ product, size = 40, className }: { product: Product; size?: number; className?: string }) {
  const [imgError, setImgError] = useState(false);
  const color = BRAND_COLORS[product.brand] ?? "#64748B";
  const initials = brandInitials(product.brand);

  if (product.imageUrl && !imgError) {
    return (
      <img
        src={product.imageUrl}
        alt={product.name}
        onError={() => setImgError(true)}
        className={cn("object-contain rounded-lg bg-white", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={cn("rounded-lg flex items-center justify-center shrink-0 font-bold text-white", className)}
      style={{ width: size, height: size, background: color, fontSize: size * 0.3 }}
    >
      {initials}
    </div>
  );
}

// ─── Seed Data ────────────────────────────────────────────────────────────────
// Used only on first load when the DB table is empty.

const SEED: Omit<Product, "id">[] = [
  // CAMERAS
  { sku:"EEN-BRIDGE-300",  name:"Eagle Eye Bridge 300",                brand:"Eagle Eye Networks",      category:"Camera",          subcategory:"Cloud Bridge",    description:"Cloud VMS bridge, connects IP cameras to Eagle Eye cloud",    specs:"Up to 12 cameras, H.264/H.265, local buffering",           msrp:499,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"EEN-BRIDGE-600",  name:"Eagle Eye Bridge 600",                brand:"Eagle Eye Networks",      category:"Camera",          subcategory:"Cloud Bridge",    description:"High-capacity cloud bridge for multi-camera sites",           specs:"Up to 32 cameras, 4K support, LTE failover",               msrp:899,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"EEN-CAM-4MP-D",   name:"Eagle Eye 4MP Dome Camera",           brand:"Eagle Eye Networks",      category:"Camera",          subcategory:"IP Dome",         description:"Native cloud camera, direct-to-cloud streaming",              specs:"4MP, H.265, IR 30ft, IP67, PoE",                           msrp:249,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"EEN-CAM-4MP-B",   name:"Eagle Eye 4MP Bullet Camera",         brand:"Eagle Eye Networks",      category:"Camera",          subcategory:"IP Bullet",       description:"Outdoor bullet for perimeter/parking, cloud-native",          specs:"4MP, H.265, IR 100ft, IP67, PoE",                          msrp:249,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"CMIP3CD42WI-28",  name:"LTS Platinum 4MP AI Turret",          brand:"LTS Security",            category:"Camera",          subcategory:"IP Turret",       description:"AI Color 24/7 turret, full-color night vision",               specs:"4MP, H.265+, Color Night, IR 100ft, IP67",                 msrp:139,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"CMIP3CD42WI-28L", name:"LTS Platinum 4MP AI Turret Deterrence",brand:"LTS Security",           category:"Camera",          subcategory:"IP Turret",       description:"4MP AI turret with built-in siren + strobe deterrence",       specs:"4MP, H.265+, Active Deterrence, IP67",                     msrp:159,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"CMIP3CD82WI-28",  name:"LTS Platinum 8MP AI Turret",          brand:"LTS Security",            category:"Camera",          subcategory:"IP Turret",       description:"4K AI Color 24/7 turret camera",                              specs:"8MP 4K, H.265+, Color Night, IR 130ft, IP67",              msrp:189,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"CMIP7CD42WI-28",  name:"LTS Platinum 4MP AI Dome",            brand:"LTS Security",            category:"Camera",          subcategory:"IP Dome",         description:"4MP vandal-resistant dome with AI analytics",                 specs:"4MP, H.265+, Vandal IK10, Color Night, PoE",               msrp:149,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"CMIP7CD82WI-28",  name:"LTS Platinum 8MP AI Dome",            brand:"LTS Security",            category:"Camera",          subcategory:"IP Dome",         description:"4K vandal dome for lobbies and indoor coverage",               specs:"8MP 4K, H.265+, Vandal IK10, IP67",                        msrp:199,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"PTZIP424W-X25IR", name:"LTS 4MP PTZ 25x Optical Zoom",        brand:"LTS Security",            category:"Camera",          subcategory:"PTZ",             description:"4MP PTZ with 25x optical zoom and 60fps recording",            specs:"4MP, 25x Optical, 60fps, IR 330ft, IP66, PoE",             msrp:799,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  // ACCESS CONTROL
  { sku:"UA-READER-LITE",  name:"UniFi Access Reader Lite",            brand:"Ubiquiti",                category:"Access Control",  subcategory:"Reader",          description:"Slim NFC/Bluetooth reader for standard doors",                specs:"13.56MHz NFC, Bluetooth, PoE, AES-128",                    msrp:99,   dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"UA-PRO-G2",       name:"UniFi Access Reader Pro Gen2",        brand:"Ubiquiti",                category:"Access Control",  subcategory:"Reader",          description:"Touchscreen reader with built-in camera",                     specs:"NFC/BT, HD camera, touchscreen, PoE",                      msrp:179,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"UA-HUB",          name:"UniFi Access Hub",                    brand:"Ubiquiti",                category:"Access Control",  subcategory:"Controller",      description:"8-door access controller, PoE powered",                       specs:"8 door ports, PoE in, 1.3GHz CPU, 1GB RAM",                msrp:199,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"UA-INTERCOM",     name:"UniFi Access Intercom",               brand:"Ubiquiti",                category:"Access Control",  subcategory:"Intercom",        description:"IP video intercom integrated with UniFi Access",              specs:"1080p camera, NFC/BT, two-way audio, IP55",                msrp:199,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"BRIVO-ACS100",    name:"Brivo ACS100 Panel/Reader",           brand:"Brivo",                   category:"Access Control",  subcategory:"Panel",           description:"Combined 1-door panel and credential reader in one unit",     specs:"Cloud-managed, Bluetooth, WiFi optional",                  msrp:299,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"BRIVO-ACS300",    name:"Brivo ACS300 2-Door Controller",      brand:"Brivo",                   category:"Access Control",  subcategory:"Panel",           description:"Modern 2-door controller, PoE powered, cloud-managed",        specs:"2-door, PoE, Bluetooth, WiFi, OSDP",                       msrp:349,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"BRIVO-ACS6000",   name:"Brivo ACS6000 Multi-Door Panel",      brand:"Brivo",                   category:"Access Control",  subcategory:"Panel",           description:"Next-gen IP panel, up to 8 doors",                            specs:"8 doors, WiFi optional, OSDP, 100K credentials",           msrp:599,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"AL600ULACM",      name:"Altronix AL600ULACM Power Controller",brand:"Altronix",                category:"Access Control",  subcategory:"Power Supply",    description:"8-output access power controller, 12/24VDC 6A",               specs:"8 fused relay outputs, 12/24VDC, 6A, 115VAC",              msrp:229,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"NETWAY1BT",       name:"Altronix NetWay1BT PoE Injector",     brand:"Altronix",                category:"Access Control",  subcategory:"PoE",             description:"Single port 802.3bt 90W PoE injector",                        specs:"1 port, 90W 802.3bt, 10/100/1000Mbps",                     msrp:119,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"NETWAY8",         name:"Altronix NetWay8 8-Port PoE Midspan", brand:"Altronix",                category:"Access Control",  subcategory:"PoE",             description:"8-port PoE midspan for IP cameras and access devices",        specs:"8 ports, 150W total, 802.3af/at",                          msrp:299,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"M32-MAGLOCK",     name:"Securitron M32 Magnalock 600lb",      brand:"Securitron (ASSA ABLOY)", category:"Access Control",  subcategory:"Mag Lock",        description:"Compact electromagnetic lock for interior doors",              specs:"600lb holding force, 12/24VDC, surface mount",             msrp:109,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"M62-MAGLOCK",     name:"Securitron M62 Magnalock 1200lb",     brand:"Securitron (ASSA ABLOY)", category:"Access Control",  subcategory:"Mag Lock",        description:"Heavy-duty maglock for commercial perimeter doors",            specs:"1200lb holding force, 12/24VDC, outdoor sealed",           msrp:149,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"DTK-4LVLPCR",     name:"DITEK Card Reader Surge Protector",   brand:"DITEK",                   category:"Access Control",  subcategory:"Surge Protection", description:"Surge protection for card readers",                          specs:"4-pair protection, panel mount, DIN rail",                 msrp:59,   dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"DTK-ESS",         name:"DITEK Door Strike/Mag Lock Protector",brand:"DITEK",                   category:"Access Control",  subcategory:"Surge Protection", description:"Surge protector for electric strikes and mag locks",         specs:"In-door-frame mount, 12/24VDC",                            msrp:49,   dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"LX-402",          name:"Optex LX-402 Outdoor PIR Sensor",     brand:"Optex",                   category:"Access Control",  subcategory:"Sensor",          description:"Short-range outdoor PIR, triggers gates/cameras/lighting",    specs:"40x50ft, 120° detection, form C relay, IP55",              msrp:89,   dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"LX-802N",         name:"Optex LX-802N Outdoor PIR Sensor",    brand:"Optex",                   category:"Access Control",  subcategory:"Sensor",          description:"Long-range outdoor PIR for wide area detection",              specs:"80x100ft, pet immune, form C relay",                       msrp:99,   dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  // GATE OPERATORS
  { sku:"DKS-9100",        name:"DoorKing 9100 Residential Swing",     brand:"DoorKing",                category:"Gate Operator",   subcategory:"Swing",           description:"Residential swing gate operator",                             specs:"1/2HP, 300lb capacity, AC powered",                        msrp:699,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"DKS-9200",        name:"DoorKing 9200 Commercial Swing",      brand:"DoorKing",                category:"Gate Operator",   subcategory:"Swing",           description:"Commercial swing operator for heavy-use applications",         specs:"3/4HP, 700lb capacity, AC powered, reversing",             msrp:1199, dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"DKS-6300",        name:"DoorKing 6300 Slide Gate Operator",   brand:"DoorKing",                category:"Gate Operator",   subcategory:"Slide",           description:"Commercial slide gate operator, chain driven",                 specs:"1HP, up to 800lb gate, AC powered",                        msrp:1499, dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"DKS-1601",        name:"DoorKing 1601 Barrier Gate",          brand:"DoorKing",                category:"Gate Operator",   subcategory:"Barrier",         description:"Traffic control barrier arm, 10ft or 14ft arm",               specs:"120VAC, 3-5 second cycle, adjustable arm",                 msrp:1299, dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"FAAC-390",        name:"FAAC 390 Residential Swing Operator", brand:"FAAC",                    category:"Gate Operator",   subcategory:"Swing",           description:"Electromechanical swing operator for residential gates",       specs:"Max 6ft/400lb gate, 24VDC, self-locking",                  msrp:699,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"FAAC-400",        name:"FAAC 400 Series Swing Operator",      brand:"FAAC",                    category:"Gate Operator",   subcategory:"Swing",           description:"Commercial-grade hydraulic swing gate operator",               specs:"Max 7ft/750lb gate, 120VAC hydraulic",                     msrp:999,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"FAAC-402",        name:"FAAC 402 Hydraulic Dual Swing Kit",   brand:"FAAC",                    category:"Gate Operator",   subcategory:"Swing",           description:"Dual swing gate hydraulic operator kit (2 operators)",         specs:"Max 7ft/750lb per leaf, 120VAC, pair",                     msrp:1999, dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"FAAC-746",        name:"FAAC 746 Slide Gate Operator",        brand:"FAAC",                    category:"Gate Operator",   subcategory:"Slide",           description:"Commercial slide gate operator, rack & pinion",                specs:"Max 1320lb gate, 120VAC, high-cycle",                      msrp:1299, dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"FAAC-844",        name:"FAAC 844 Heavy Duty Slide Operator",  brand:"FAAC",                    category:"Gate Operator",   subcategory:"Slide",           description:"Heavy-duty high-traffic slide gate operator",                  specs:"Max 2200lb gate, 120VAC, industrial grade",                msrp:1799, dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"FAAC-B614",       name:"FAAC B614 Barrier Arm Operator",      brand:"FAAC",                    category:"Gate Operator",   subcategory:"Barrier",         description:"Standard traffic barrier arm, 13ft arm capacity",             specs:"120VAC, 4-6 sec cycle, crash-rated optional",              msrp:1499, dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"FAAC-B680H",      name:"FAAC B680H Heavy Duty Barrier",       brand:"FAAC",                    category:"Gate Operator",   subcategory:"Barrier",         description:"High-security heavy duty barrier, crash tested",               specs:"120VAC, 2 sec cycle, IWA14-1 crash rated",                 msrp:2999, dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"VIK-SW-24",       name:"Viking SW-24 Swing Gate Operator",    brand:"Viking Electronics",      category:"Gate Operator",   subcategory:"Swing",           description:"Residential/light commercial swing gate operator",             specs:"24VDC, solar compatible, max 850lb",                       msrp:799,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  // CALLBOXES
  { sku:"DKS-1812",        name:"DoorKing 1812 Residential Entry",     brand:"DoorKing",                category:"Callbox / Intercom", subcategory:"Telephone Entry", description:"Standard residential telephone entry system",               specs:"Surface mount, phone dialing, keypad, LED",                msrp:349,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"DKS-1833",        name:"DoorKing 1833 Multi-Tenant Entry",    brand:"DoorKing",                category:"Callbox / Intercom", subcategory:"Telephone Entry", description:"Multi-tenant telephone entry, 500 residents",               specs:"500 phone numbers, keypad, POTS/VoIP/LTE",                msrp:699,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"DKS-1835",        name:"DoorKing 1835 Multi-Tenant Premium",  brand:"DoorKing",                category:"Callbox / Intercom", subcategory:"Telephone Entry", description:"Large multi-tenant, 3000 numbers, 8000 codes",              specs:"3000 residents, display, POTS/VoIP/LTE",                  msrp:999,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"2N-IP-VERSO-2",   name:"2N IP Verso 2.0",                     brand:"2N",                      category:"Callbox / Intercom", subcategory:"IP Intercom",    description:"Next-gen modular intercom with AI face recognition",          specs:"Full HD, AI face, NFC, BT, PoE, IP54",                    msrp:549,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"2N-IP-FORCE-2",   name:"2N IP Force 2.0",                     brand:"2N",                      category:"Callbox / Intercom", subcategory:"IP Intercom",    description:"Heavy-duty vandal/weather proof IP intercom, IP69/IK10",      specs:"HD camera, NFC, IK10, IP69, PoE, SIP",                    msrp:699,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"2N-IP-UNI",       name:"2N IP Uni",                           brand:"2N",                      category:"Callbox / Intercom", subcategory:"IP Intercom",    description:"Compact budget IP intercom, 1-2 buttons",                     specs:"SIP/VoIP, PoE, IP54, 1-2 call buttons",                   msrp:199,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"2N-IP-SOLO",      name:"2N IP Solo",                          brand:"2N",                      category:"Callbox / Intercom", subcategory:"IP Intercom",    description:"Single-button IP intercom with HD camera",                    specs:"HD camera, SIP, PoE, IP65, surface mount",                msrp:299,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"VIK-E50",         name:"Viking E-50 Video Entry Phone",       brand:"Viking Electronics",      category:"Callbox / Intercom", subcategory:"Video Entry",    description:"Compact video entry speaker phone with color camera",          specs:"Color composite video, hands-free, relay output",          msrp:249,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"VIK-K1700-IP",    name:"Viking K-1700 VoIP Entry",            brand:"Viking Electronics",      category:"Callbox / Intercom", subcategory:"VoIP Entry",     description:"Heavy-duty stainless steel VoIP entry system",                 specs:"14GA stainless, 12-button keypad, SIP, vandal",            msrp:499,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  // NETWORK
  { sku:"USW-FLEX",        name:"UniFi Switch Flex 5-Port PoE",        brand:"Ubiquiti",                category:"Network",         subcategory:"Switch",          description:"Compact 5-port managed PoE switch, indoor/outdoor",           specs:"5 ports, 1 PoE in/4 PoE out, 802.3af/at",                 msrp:109,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"USW-LITE-8-POE",  name:"UniFi Switch Lite 8 PoE",             brand:"Ubiquiti",                category:"Network",         subcategory:"Switch",          description:"8-port managed PoE switch for small installations",            specs:"8 ports, 4 PoE, 52W total, fanless",                      msrp:109,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"USW-PRO-24-POE",  name:"UniFi Switch Pro 24 PoE",             brand:"Ubiquiti",                category:"Network",         subcategory:"Switch",          description:"24-port managed PoE+ switch, rack-mount",                     specs:"24 ports, 16 PoE+, 400W, SFP+ uplinks",                  msrp:399,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"USW-PRO-48-POE",  name:"UniFi Switch Pro 48 PoE",             brand:"Ubiquiti",                category:"Network",         subcategory:"Switch",          description:"48-port managed PoE+ switch for larger installs",              specs:"48 ports, 32 PoE+, 600W, SFP+ uplinks",                  msrp:599,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"U6-LITE",         name:"UniFi U6 Lite Access Point",          brand:"Ubiquiti",                category:"Network",         subcategory:"Access Point",    description:"Compact WiFi 6 indoor AP, ceiling mount",                     specs:"WiFi 6, 2.4+5GHz, 1.5Gbps, PoE",                         msrp:99,   dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"U6-PRO",          name:"UniFi U6 Pro Access Point",           brand:"Ubiquiti",                category:"Network",         subcategory:"Access Point",    description:"High-performance WiFi 6 AP, indoor/outdoor",                  specs:"WiFi 6, 5.3Gbps, 4x4 MU-MIMO, PoE",                      msrp:179,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"U7-PRO",          name:"UniFi U7 Pro Access Point",           brand:"Ubiquiti",                category:"Network",         subcategory:"Access Point",    description:"WiFi 7 tri-band AP, highest throughput available",             specs:"WiFi 7, 2.4+5+6GHz, 8.6Gbps, PoE++",                    msrp:229,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"UDM-SE",          name:"UniFi Dream Machine SE",              brand:"Ubiquiti",                category:"Network",         subcategory:"Gateway",         description:"All-in-one gateway with 8-port PoE switch built in",           specs:"8 PoE ports, 10G SFP+, UniFi OS, IDS/IPS",               msrp:499,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"UDM-PRO",         name:"UniFi Dream Machine Pro",             brand:"Ubiquiti",                category:"Network",         subcategory:"Gateway",         description:"Enterprise gateway with 8-port switch, rack-mount",            specs:"8 ports, 10G SFP+, UniFi OS, 1.3Gbps IDS",               msrp:379,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  // WIRE & HARDWARE
  { sku:"BLD-CAT6-BLK",   name:"Belden Cat6 23AWG CMR 1000ft Black",  brand:"Belden",                  category:"Wire & Hardware",  subcategory:"Cat6 Cable",     description:"Riser-rated Cat6 for camera and network runs",                specs:"23AWG solid, 4-pair, UTP, CMR, 550MHz",                   msrp:229,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"BLD-CAT6-WHT",   name:"Belden Cat6 23AWG CMR 1000ft White",  brand:"Belden",                  category:"Wire & Hardware",  subcategory:"Cat6 Cable",     description:"Riser-rated Cat6 for interior structured cabling",             specs:"23AWG solid, 4-pair, UTP, CMR, 550MHz",                   msrp:229,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"BLD-18-2-SH",    name:"Belden 18/2 Shielded Access Wire 500ft",brand:"Belden",                category:"Wire & Hardware",  subcategory:"Access Wire",    description:"2-conductor shielded wire for access control wiring",          specs:"18AWG, 2-conductor, foil shield, CMR",                    msrp:149,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"BLD-22-4-SH",    name:"Belden 22/4 Shielded Alarm Wire 1000ft",brand:"Belden",               category:"Wire & Hardware",  subcategory:"Access Wire",    description:"4-conductor shielded for alarm and access panels",             specs:"22AWG, 4-conductor, foil shield, CMR",                    msrp:189,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"ADI-CAT6-BLK",   name:"ADI Pro Cat6 23AWG CMR 1000ft",       brand:"ADI Pro",                 category:"Wire & Hardware",  subcategory:"Cat6 Cable",     description:"ADI-brand riser Cat6, cost-effective alternative to Belden",  specs:"23AWG solid, 4-pair, UTP, CMR, 550MHz",                   msrp:189,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"ADI-18-2-SH",    name:"ADI Pro 18/2 Shielded Wire 500ft",    brand:"ADI Pro",                 category:"Wire & Hardware",  subcategory:"Access Wire",    description:"ADI-brand 2-conductor shielded access control wire",           specs:"18AWG, 2-conductor, foil shield, CMR",                    msrp:109,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"SHELLY-PLUS-1",  name:"Shelly Plus 1 Smart Relay",           brand:"Shelly",                  category:"Wire & Hardware",  subcategory:"Smart Relay",    description:"WiFi smart relay with dry contact, fits in junction box",     specs:"16A, dry contact, 110-240VAC, WiFi, MQTT",                msrp:18,   dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"SHELLY-PRO-1",   name:"Shelly Pro 1 DIN Rail Relay",         brand:"Shelly",                  category:"Wire & Hardware",  subcategory:"Smart Relay",    description:"DIN-rail mount relay for panel/enclosure installation",        specs:"16A, dry contact, DIN rail, WiFi + LAN",                  msrp:35,   dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  { sku:"UBI-FLEX-ENC",   name:"Ubiquiti UniFi Flex Outdoor Enclosure",brand:"Ubiquiti",               category:"Wire & Hardware",  subcategory:"Enclosure",      description:"IP55 outdoor enclosure for UniFi switches/equipment",         specs:"IP55, gasketed, DIN rail inside, weatherproof",           msrp:149,  dealerCost:0, sellPrice:0, adiSku:"", imageUrl:"", active:true },
  // LABOR
  { sku:"LAB-HRLY",       name:"Standard Labor (per hour)",            brand:"GateGuard",               category:"Labor",           subcategory:"Hourly",          description:"Standard installation and service labor rate",                specs:"Billed in 0.25hr increments",                             msrp:0,    dealerCost:0, sellPrice:125, adiSku:"", imageUrl:"", active:true },
  { sku:"LAB-GATE-SWING", name:"Gate Operator Install — Swing",        brand:"GateGuard",               category:"Labor",           subcategory:"Installation",    description:"Install and program a swing gate operator (single)",           specs:"Includes mounting, wiring, programming, testing",          msrp:0,    dealerCost:0, sellPrice:650, adiSku:"", imageUrl:"", active:true },
  { sku:"LAB-GATE-SLIDE", name:"Gate Operator Install — Slide",        brand:"GateGuard",               category:"Labor",           subcategory:"Installation",    description:"Install and program a slide gate operator",                    specs:"Includes rack alignment, wiring, programming, testing",    msrp:0,    dealerCost:0, sellPrice:750, adiSku:"", imageUrl:"", active:true },
  { sku:"LAB-GATE-BARRIER",name:"Barrier Gate Install",                brand:"GateGuard",               category:"Labor",           subcategory:"Installation",    description:"Install and program a barrier arm operator",                   specs:"Includes mounting, wiring, loop detectors, programming",   msrp:0,    dealerCost:0, sellPrice:550, adiSku:"", imageUrl:"", active:true },
  { sku:"LAB-CAM",        name:"Camera Install (per camera)",          brand:"GateGuard",               category:"Labor",           subcategory:"Installation",    description:"Mount, wire, and configure a single IP camera",                specs:"Includes mounting, cable run up to 100ft, NVR config",     msrp:0,    dealerCost:0, sellPrice:150, adiSku:"", imageUrl:"", active:true },
  { sku:"LAB-ACCESS-DR",  name:"Access Control — Per Door",            brand:"GateGuard",               category:"Labor",           subcategory:"Installation",    description:"Install reader, controller, and door hardware for one door",   specs:"Includes reader, lock, REX, wiring, programming",          msrp:0,    dealerCost:0, sellPrice:350, adiSku:"", imageUrl:"", active:true },
  { sku:"LAB-CALLBOX",    name:"Callbox / Intercom Install",           brand:"GateGuard",               category:"Labor",           subcategory:"Installation",    description:"Mount and program a telephone entry or IP intercom system",    specs:"Includes mount, wiring, programming, resident setup",      msrp:0,    dealerCost:0, sellPrice:395, adiSku:"", imageUrl:"", active:true },
  { sku:"LAB-PROG",       name:"Programming & Commissioning (per hr)", brand:"GateGuard",               category:"Labor",           subcategory:"Programming",     description:"System programming, credential setup, software config",        specs:"Cloud provisioning, user setup, integration testing",      msrp:0,    dealerCost:0, sellPrice:145, adiSku:"", imageUrl:"", active:true },
  { sku:"LAB-SVC-CALL",   name:"Service Call — Diagnostic",            brand:"GateGuard",               category:"Labor",           subcategory:"Service",         description:"On-site diagnostic and repair service call",                   specs:"Includes first hour; additional time billed at hourly rate",msrp:0,    dealerCost:0, sellPrice:185, adiSku:"", imageUrl:"", active:true },
  { sku:"LAB-TRUCK",      name:"Truck Roll / Travel Fee",              brand:"GateGuard",               category:"Labor",           subcategory:"Service",         description:"Trip charge for on-site service or installation",              specs:"Per dispatch trip, within standard service area",          msrp:0,    dealerCost:0, sellPrice:85,  adiSku:"", imageUrl:"", active:true },
  { sku:"LAB-WIRE-FT",    name:"Low Voltage Wire Pull (per foot)",     brand:"GateGuard",               category:"Labor",           subcategory:"Installation",    description:"Wire pull labor for Cat6 or access control cable runs",        specs:"Per linear foot, includes conduit fish if needed",         msrp:0,    dealerCost:0, sellPrice:2,   adiSku:"", imageUrl:"", active:true },
  { sku:"LAB-CONDUIT-FT", name:"Conduit Installation (per foot)",      brand:"GateGuard",               category:"Labor",           subcategory:"Installation",    description:"Install EMT or PVC conduit for protected wire runs",           specs:"Per linear foot, includes fittings",                       msrp:0,    dealerCost:0, sellPrice:4,   adiSku:"", imageUrl:"", active:true },
  { sku:"LAB-NVR-SETUP",  name:"NVR / VMS Setup & Configuration",      brand:"GateGuard",               category:"Labor",           subcategory:"Programming",     description:"Initial setup of NVR/VMS, camera discovery, recording config", specs:"Includes camera naming, recording schedule, remote access", msrp:0,    dealerCost:0, sellPrice:295, adiSku:"", imageUrl:"", active:true },
  { sku:"LAB-PANEL-MOUNT",name:"Enclosure / Panel Mount & Wire",       brand:"GateGuard",               category:"Labor",           subcategory:"Installation",    description:"Mount and wire a control panel or network enclosure",          specs:"Includes DIN rail, terminal blocks, cable management",     msrp:0,    dealerCost:0, sellPrice:225, adiSku:"", imageUrl:"", active:true },
];

const CATEGORIES: ProductCategory[] = ["Camera","Access Control","Gate Operator","Callbox / Intercom","Network","Wire & Hardware","Labor"];

const CAT_COLORS: Record<string, string> = {
  "Camera":             "bg-blue-100 text-blue-700",
  "Access Control":     "bg-emerald-100 text-emerald-700",
  "Gate Operator":      "bg-orange-100 text-orange-700",
  "Callbox / Intercom": "bg-purple-100 text-purple-700",
  "Network":            "bg-teal-100 text-teal-700",
  "Wire & Hardware":    "bg-amber-100 text-amber-700",
  "Labor":              "bg-rose-100 text-rose-700",
};
const CAT_ICONS: Record<string, React.ElementType> = {
  "Camera": Camera, "Access Control": Shield, "Gate Operator": Cpu,
  "Callbox / Intercom": Wifi, "Network": Server, "Wire & Hardware": Layers, "Labor": Hammer,
};

const emptyProduct = (): Omit<Product,"id"> => ({
  sku:"", name:"", brand:"GateGuard", category:"Camera", subcategory:"",
  description:"", specs:"", msrp:0, dealerCost:0, sellPrice:0,
  adiSku:"", imageUrl:"", active:true,
});

const fmt$ = (n: number) => n > 0 ? `$${n.toLocaleString()}` : "—";
const calcMargin = (cost: number, sell: number) =>
  sell > 0 && cost > 0 ? Math.round(((sell - cost) / sell) * 100) : null;

// ─── Inline Sell Price Cell ───────────────────────────────────────────────────
function SellCell({ product, onChange }: { product: Product; onChange:(id:string,v:number)=>void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(product.sellPrice || ""));
  const m = calcMargin(product.dealerCost, product.sellPrice);

  const commit = () => {
    onChange(product.id, Number(val.replace(/[^0-9.]/g,"")) || 0);
    setEditing(false);
  };

  if (editing) return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground">$</span>
      <input autoFocus value={val} onChange={e=>setVal(e.target.value)}
        onBlur={commit} onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape"){setEditing(false);setVal(String(product.sellPrice||""));}}}
        className="w-20 text-sm font-semibold text-blue-600 border border-blue-400 rounded-md px-2 py-0.5 focus:outline-none bg-white"/>
    </div>
  );

  return (
    <button onClick={()=>setEditing(true)} className="group flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors text-left" title="Click to edit">
      <span className={cn("text-sm font-semibold", product.sellPrice>0?"text-blue-600":"text-muted-foreground")}>
        {product.sellPrice>0?fmt$(product.sellPrice):"Set price"}
      </span>
      {m!==null&&<span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full",m>=40?"bg-emerald-100 text-emerald-600":m>=25?"bg-amber-100 text-amber-600":"bg-red-100 text-red-600")}>{m}%</span>}
      <Edit2 size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"/>
    </button>
  );
}

// ─── Product Modal ────────────────────────────────────────────────────────────
const iCls = "w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors";
function Field({label,required,children}:{label:string;required?:boolean;children:React.ReactNode}){
  return <div className="space-y-1.5"><label className="text-xs font-medium text-foreground">{label}{required&&<span className="text-red-500 ml-0.5">*</span>}</label>{children}</div>;
}

function ProductModal({ product, onSave, onClose, saving }: { product:Partial<Product>&{id?:string}; onSave:(p:Product)=>void; onClose:()=>void; saving?:boolean }) {
  const isEdit = !!product.id;
  const [form, setForm] = useState<Omit<Product,"id">>({
    sku:product.sku??"", name:product.name??"", brand:product.brand??"",
    category:product.category??"Camera", subcategory:product.subcategory??"",
    description:product.description??"", specs:product.specs??"",
    msrp:product.msrp??0, dealerCost:product.dealerCost??0,
    sellPrice:product.sellPrice??0, adiSku:product.adiSku??"",
    imageUrl:product.imageUrl??"", active:product.active??true,
  });
  const set = (k:keyof typeof form, v:string|number|boolean)=>setForm(p=>({...p,[k]:v}));
  const m = calcMargin(form.dealerCost, form.sellPrice);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white z-10">
          <h2 className="text-base font-bold">{isEdit?"Edit Product":"Add Product"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-muted-foreground"><X size={16}/></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="SKU / Model #" required><input value={form.sku} onChange={e=>set("sku",e.target.value)} placeholder="e.g. CMIP3CD42WI-28" className={iCls}/></Field>
            <Field label="Brand" required><input value={form.brand} onChange={e=>set("brand",e.target.value)} placeholder="e.g. LTS Security" className={iCls}/></Field>
          </div>
          <Field label="Product Name" required><input value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Full product name" className={iCls}/></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Category"><select value={form.category} onChange={e=>set("category",e.target.value as ProductCategory)} className={iCls}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></Field>
            <Field label="Subcategory"><input value={form.subcategory} onChange={e=>set("subcategory",e.target.value)} placeholder="e.g. IP Dome, Barrier, Switch" className={iCls}/></Field>
          </div>
          <Field label="Description"><textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={2} className={iCls+" resize-none"}/></Field>
          <Field label="Key Specs"><textarea value={form.specs} onChange={e=>set("specs",e.target.value)} rows={2} className={iCls+" resize-none"}/></Field>
          <div className="grid grid-cols-4 gap-3">
            <Field label="MSRP ($)"><input type="number" value={form.msrp||""} onChange={e=>set("msrp",Number(e.target.value))} className={iCls}/></Field>
            <Field label="Your Cost ($)"><input type="number" value={form.dealerCost||""} onChange={e=>set("dealerCost",Number(e.target.value))} className={iCls+" border-amber-300"}/></Field>
            <Field label="Sell Price ($)"><input type="number" value={form.sellPrice||""} onChange={e=>set("sellPrice",Number(e.target.value))} className={iCls+" border-blue-300"}/></Field>
            <Field label="Margin"><div className={cn("px-3 py-2 rounded-lg text-sm font-bold text-center border border-border",m===null?"text-muted-foreground bg-slate-50":m>=40?"text-emerald-600 bg-emerald-50":m>=25?"text-amber-600 bg-amber-50":"text-red-600 bg-red-50")}>{m!==null?`${m}%`:"—"}</div></Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="ADI SKU"><input value={form.adiSku} onChange={e=>set("adiSku",e.target.value)} placeholder="ADI part #" className={iCls}/></Field>
            <Field label="Image URL">
              <input value={form.imageUrl} onChange={e=>set("imageUrl",e.target.value)} placeholder="Paste image URL from ADI or manufacturer site" className={iCls}/>
            </Field>
          </div>
          {form.imageUrl && (
            <div className="flex items-center gap-3 p-3 bg-slate-50 border border-border rounded-xl">
              <img src={form.imageUrl} alt="preview" className="w-14 h-14 object-contain rounded-lg border border-border bg-white" onError={e=>(e.currentTarget.src="")}/>
              <p className="text-xs text-muted-foreground">Image preview</p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button onClick={()=>set("active",!form.active)} className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors",form.active?"bg-blue-600":"bg-slate-200")}>
              <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",form.active?"translate-x-6":"translate-x-1")}/>
            </button>
            <span className="text-sm font-medium">{form.active?"Active":"Inactive"}</span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-slate-50/50 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-slate-100 transition-colors">Cancel</button>
          <button onClick={()=>{if(!form.sku||!form.name||!form.brand)return;onSave({...form,id:product.id??`new`});}}
            disabled={!form.sku||!form.name||!form.brand||saving}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-2">
            {saving&&<Loader2 size={13} className="animate-spin"/>}
            {isEdit?"Save Changes":"Add Product"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── CSV Import Modal ─────────────────────────────────────────────────────────
function ImportModal({ onImport, onClose, saving }: { onImport:(rows:Omit<Product,"id">[])=>void; onClose:()=>void; saving?:boolean }) {
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<Omit<Product,"id">[]>([]);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const parse = (text: string) => {
    setError("");
    const lines = text.trim().split("\n");
    if (lines.length < 2) { setError("Need a header row + at least one data row."); return; }
    const rows: Omit<Product,"id">[] = [];
    for (let i=1;i<lines.length;i++) {
      const c = lines[i].split(",").map(x=>x.replace(/^"|"$/g,"").trim());
      if (c.length<7||!c[0]) continue;
      rows.push({ sku:c[0], name:c[1]??"", brand:c[2]??"",
        category:(c[3] as ProductCategory)??"Camera", subcategory:c[4]??"",
        description:c[5]??"", specs:c[6]??"",
        msrp:Number(c[7]?.replace(/[^0-9.]/g,""))||0,
        dealerCost:Number(c[8]?.replace(/[^0-9.]/g,""))||0,
        sellPrice:Number(c[9]?.replace(/[^0-9.]/g,""))||0,
        adiSku:c[10]??"", imageUrl:c[11]??"",
        active:c[12]?.toLowerCase()!=="n" });
    }
    if (!rows.length) { setError("No valid rows found."); return; }
    setPreview(rows);
  };

  // Temporary ids for preview only
  const previewWithIds: Product[] = preview.map((r,i) => ({...r, id:`prev-${i}`}));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white">
          <h2 className="text-base font-bold">Import Products from CSV</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-muted-foreground"><X size={16}/></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-slate-50 rounded-xl p-3 border border-border">
            <p className="text-xs font-semibold mb-1">Expected columns:</p>
            <p className="text-[10px] font-mono text-muted-foreground">SKU, Name, Brand, Category, Subcategory, Description, Specs, MSRP, Cost, SellPrice, ADI SKU, Image URL, Active</p>
          </div>
          <div onClick={()=>fileRef.current?.click()} className="border-2 border-dashed border-border rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
            <Upload size={24} className="mx-auto text-muted-foreground mb-2"/>
            <p className="text-sm font-medium">Drop a CSV or click to browse</p>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>{const t=ev.target?.result as string;setCsv(t);parse(t);};r.readAsText(f);}}/>
          </div>
          <textarea value={csv} onChange={e=>{setCsv(e.target.value);parse(e.target.value);}} rows={4} placeholder="Or paste CSV here…" className="w-full px-3 py-2 text-xs font-mono border border-border rounded-lg bg-slate-50 focus:outline-none resize-none"/>
          {error&&<p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          {preview.length>0&&(
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-border flex items-center justify-between">
                <p className="text-xs font-semibold">{preview.length} products ready</p>
                <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12}/> Ready to import</span>
              </div>
              <div className="overflow-x-auto max-h-40">
                <table className="w-full text-xs"><thead className="bg-slate-50 border-b border-border"><tr>{["","SKU","Name","Brand","Category"].map(h=><th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-border">{previewWithIds.slice(0,8).map(r=>(
                    <tr key={r.id}>
                      <td className="px-3 py-1.5"><ProductImage product={r} size={28}/></td>
                      <td className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground">{r.sku}</td>
                      <td className="px-3 py-1.5 font-medium">{r.name}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.brand}</td>
                      <td className="px-3 py-1.5"><span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium",CAT_COLORS[r.category]??"bg-slate-100 text-slate-600")}>{r.category}</span></td>
                    </tr>))}
                  {preview.length>8&&<tr><td colSpan={5} className="px-3 py-2 text-xs text-center text-muted-foreground">+{preview.length-8} more…</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-slate-50/50 sticky bottom-0">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-slate-100 transition-colors">Cancel</button>
          <button onClick={()=>{if(preview.length>0){onImport(preview);onClose();}}} disabled={!preview.length||saving}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-2">
            {saving&&<Loader2 size={13} className="animate-spin"/>}
            Import {preview.length>0?`${preview.length} Products`:""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [dbError, setDbError]   = useState<string|null>(null);

  const [search,       setSearch]       = useState("");
  const [filterCat,    setFilterCat]    = useState("All");
  const [filterBrand,  setFilterBrand]  = useState("All");
  const [filterActive, setFilterActive] = useState("All");
  const [modal,        setModal]        = useState<"add"|"edit"|"import"|null>(null);
  const [editing,      setEditing]      = useState<Product|null>(null);
  const [selected,     setSelected]     = useState<Set<string>>(new Set());

  // ── Load from Supabase, seed if empty ──────────────────────────────────────
  const loadProducts = useCallback(async () => {
    setLoading(true);
    setDbError(null);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("category")
        .order("name");

      if (error) throw error;

      if (!data || data.length === 0) {
        // First run — seed the table
        const seedRows = SEED.map(p => toDb(p));
        const { data: inserted, error: seedErr } = await supabase
          .from("products")
          .upsert(seedRows, { onConflict: "sku" })
          .select();

        if (seedErr) throw seedErr;
        setProducts((inserted ?? []).map(fromDb));
      } else {
        setProducts(data.map(fromDb));
      }
    } catch (err: unknown) {
      const msg = getErrMsg(err);
      setDbError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const filtered = products.filter(p=>{
    const q=search.toLowerCase();
    return (!q||p.sku.toLowerCase().includes(q)||p.name.toLowerCase().includes(q)||p.brand.toLowerCase().includes(q)||p.description.toLowerCase().includes(q))
      &&(filterCat==="All"||p.category===filterCat)
      &&(filterBrand==="All"||p.brand===filterBrand)
      &&(filterActive==="All"||(filterActive==="Active"?p.active:!p.active));
  });
  const brands      = Array.from(new Set(products.map(p=>p.brand))).sort();
  const activeCount = products.filter(p=>p.active).length;
  const pricesSet   = products.filter(p=>p.sellPrice>0).length;
  const imagesSet   = products.filter(p=>p.imageUrl).length;

  // ── Mutations wired to Supabase ────────────────────────────────────────────

  const handleSave = async (p: Product) => {
    setSaving(true);
    try {
      const isNew = p.id === "new";
      const row = toDb(p);

      if (isNew) {
        const { data, error } = await supabase
          .from("products")
          .insert(row)
          .select()
          .single();
        if (error) throw error;
        setProducts(prev => [...prev, fromDb(data)]);
      } else {
        const { data, error } = await supabase
          .from("products")
          .update(row)
          .eq("id", p.id)
          .select()
          .single();
        if (error) throw error;
        setProducts(prev => prev.map(x => x.id === p.id ? fromDb(data) : x));
      }
      setModal(null);
      setEditing(null);
    } catch (err: unknown) {
      const msg = getErrMsg(err);
      setDbError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async (rows: Omit<Product,"id">[]) => {
    setSaving(true);
    try {
      const dbRows = rows.map(r => toDb(r));
      const { data, error } = await supabase
        .from("products")
        .upsert(dbRows, { onConflict: "sku" })
        .select();
      if (error) throw error;
      const imported = (data ?? []).map(fromDb);
      setProducts(prev => {
        const skus = new Set(imported.map(p => p.sku));
        return [...prev.filter(p => !skus.has(p.sku)), ...imported];
      });
    } catch (err: unknown) {
      const msg = getErrMsg(err);
      setDbError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSellPrice = async (id: string, v: number) => {
    // Optimistic update
    setProducts(prev => prev.map(p => p.id===id ? {...p, sellPrice:v} : p));
    const { error } = await supabase
      .from("products")
      .update({ sell_price: v })
      .eq("id", id);
    if (error) {
      setDbError(getErrMsg(error));
      loadProducts();
    }
  };

  const toggleActive = async (id: string) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    const newVal = !product.active;
    // Optimistic update
    setProducts(prev => prev.map(p => p.id===id ? {...p, active:newVal} : p));
    const { error } = await supabase
      .from("products")
      .update({ active: newVal })
      .eq("id", id);
    if (error) {
      setDbError(getErrMsg(error));
      loadProducts();
    }
  };

  const deleteSelected = async () => {
    const ids = Array.from(selected);
    // Optimistic update
    setProducts(prev => prev.filter(p => !selected.has(p.id)));
    setSelected(new Set());
    const { error } = await supabase
      .from("products")
      .delete()
      .in("id", ids);
    if (error) {
      setDbError(getErrMsg(error));
      loadProducts();
    }
  };

  const deleteOne = async (id: string) => {
    // Optimistic update
    setProducts(prev => prev.filter(p => p.id !== id));
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", id);
    if (error) {
      setDbError(getErrMsg(error));
      loadProducts();
    }
  };

  const toggleSelect = (id: string) => setSelected(prev=>{const s=new Set(prev);s.has(id)?s.delete(id):s.add(id);return s;});
  const allSel = filtered.length>0&&filtered.every(p=>selected.has(p.id));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Product Catalog" actions={
        <>
          <button onClick={()=>setModal("import")} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-slate-50 transition-colors">
            <Upload size={14}/> Import CSV
          </button>
          <button onClick={()=>{setEditing(null);setModal("add");}} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            <Plus size={15}/> Add Product
          </button>
        </>
      }/>

      <div className="flex-1 p-6 space-y-4">

        {/* DB Error banner */}
        {dbError && (
          <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <span className="font-semibold shrink-0">DB Error:</span>
            <span className="flex-1 text-xs font-mono break-all">{dbError}</span>
            <button onClick={()=>setDbError(null)} className="shrink-0 text-red-400 hover:text-red-600"><X size={14}/></button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 size={20} className="animate-spin"/>
            <span className="text-sm">Loading products from database…</span>
          </div>
        )}

        {!loading && (
          <>
            {/* Stats */}
            <div className="flex gap-3">
              {[
                {label:"Total Products",  value:String(products.length), sub:`${activeCount} active`},
                {label:"Sell Prices Set",  value:`${pricesSet}/${products.length}`, sub:"Click price to edit inline", color:pricesSet===products.length?"text-emerald-600":"text-amber-600"},
                {label:"Images Added",     value:`${imagesSet}/${products.length}`, sub:"Edit product → paste image URL", color:imagesSet===products.length?"text-emerald-600":"text-amber-600"},
                {label:"Brands",           value:String(brands.length)},
              ].map(s=>(
                <div key={s.label} className="bg-white border border-border rounded-xl px-4 py-3 flex-1">
                  <p className="text-[11px] text-muted-foreground font-medium mb-1">{s.label}</p>
                  <p className={cn("text-xl font-bold", s.color??"text-foreground")}>{s.value}</p>
                  {s.sub&&<p className="text-[10px] text-muted-foreground mt-0.5">{s.sub}</p>}
                </div>
              ))}
            </div>

            {/* Category pills */}
            <div className="flex gap-2 flex-wrap">
              {["All",...CATEGORIES].map(cat=>(
                <button key={cat} onClick={()=>setFilterCat(cat)}
                  className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                    filterCat===cat?"bg-blue-600 text-white border-blue-600":"border-border text-muted-foreground hover:text-foreground hover:bg-slate-50")}>
                  {cat==="All"?`All (${products.length})`:`${cat} (${products.filter(p=>p.category===cat).length})`}
                </button>
              ))}
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search SKU, name, brand…"
                  className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"/>
              </div>
              <select value={filterBrand} onChange={e=>setFilterBrand(e.target.value)} className="px-3 py-1.5 text-sm border border-border rounded-lg bg-white focus:outline-none">
                <option value="All">All Brands</option>
                {brands.map(b=><option key={b}>{b}</option>)}
              </select>
              <select value={filterActive} onChange={e=>setFilterActive(e.target.value)} className="px-3 py-1.5 text-sm border border-border rounded-lg bg-white focus:outline-none">
                <option>All</option><option>Active</option><option>Inactive</option>
              </select>
              <button onClick={loadProducts} title="Refresh" className="p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-slate-50 transition-colors">
                <RefreshCw size={13}/>
              </button>
              <p className="text-xs text-muted-foreground whitespace-nowrap">{filtered.length} products</p>
              {selected.size>0&&(
                <button onClick={deleteSelected} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-medium border border-red-200 hover:bg-red-100 transition-colors">
                  <Trash2 size={12}/> Delete ({selected.size})
                </button>
              )}
            </div>

            {/* Hint */}
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
              <Edit2 size={12}/>
              <span><strong>Quick edit sell price:</strong> click any sell price cell directly in the table — no modal needed. For images, click the ✏️ edit icon on any row and paste the image URL from ADI or the manufacturer site.</span>
            </div>

            {/* Table */}
            <div className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-slate-50">
                      <th className="w-10 px-4 py-3">
                        <input type="checkbox" checked={allSel} onChange={()=>setSelected(allSel?new Set():new Set(filtered.map(p=>p.id)))} className="rounded border-border text-blue-600"/>
                      </th>
                      {["","SKU","Product Name","Brand","Category","Specs","MSRP","Cost","Sell Price ✏️","Active",""].map(h=>(
                        <th key={h} className="px-3 py-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map(p=>(
                      <tr key={p.id} className={cn("hover:bg-slate-50/60 transition-colors",selected.has(p.id)&&"bg-blue-50/40")}>
                        <td className="px-4 py-2.5"><input type="checkbox" checked={selected.has(p.id)} onChange={()=>toggleSelect(p.id)} className="rounded border-border text-blue-600"/></td>
                        <td className="px-3 py-2.5"><ProductImage product={p} size={36}/></td>
                        <td className="px-3 py-2.5"><span className="font-mono text-xs text-muted-foreground">{p.sku}</span></td>
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-foreground text-xs leading-tight max-w-[200px] truncate block">{p.name}</span>
                          <span className="text-[10px] text-muted-foreground">{p.subcategory}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{p.brand}</td>
                        <td className="px-3 py-2.5"><span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap",CAT_COLORS[p.category]??"bg-slate-100 text-slate-600")}>{p.category}</span></td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[160px] truncate">{p.specs||"—"}</td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmt$(p.msrp)}</td>
                        <td className="px-3 py-2.5">
                          {p.dealerCost>0?<span className="text-xs font-medium">{fmt$(p.dealerCost)}</span>
                            :<span className="px-2 py-0.5 rounded text-[10px] bg-amber-50 text-amber-600 border border-amber-200 font-medium">Fill in</span>}
                        </td>
                        <td className="px-3 py-2.5"><SellCell product={p} onChange={handleSellPrice}/></td>
                        <td className="px-3 py-2.5">
                          <button onClick={()=>toggleActive(p.id)} className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors",p.active?"bg-blue-600":"bg-slate-200")}>
                            <span className={cn("inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",p.active?"translate-x-[18px]":"translate-x-0.5")}/>
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            <button onClick={()=>{setEditing(p);setModal("edit");}} className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit2 size={13}/></button>
                            <button onClick={()=>deleteOne(p.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 size={13}/></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filtered.length===0&&!loading&&(
                <div className="py-16 text-center">
                  <Package size={32} className="mx-auto text-slate-300 mb-3"/>
                  <p className="text-sm font-medium text-muted-foreground">No products match your filters</p>
                  <button onClick={()=>{setSearch("");setFilterCat("All");setFilterBrand("All");setFilterActive("All");}} className="mt-3 text-xs text-blue-600 hover:underline">Clear filters</button>
                </div>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              All changes save directly to Supabase · Images: right-click any product photo on ADI → Copy Image Address → paste into Edit modal
            </p>
          </>
        )}
      </div>

      {modal==="add"&&<ProductModal product={emptyProduct()} onSave={handleSave} onClose={()=>setModal(null)} saving={saving}/>}
      {modal==="edit"&&editing&&<ProductModal product={editing} onSave={handleSave} onClose={()=>{setModal(null);setEditing(null);}} saving={saving}/>}
      {modal==="import"&&<ImportModal onImport={handleImport} onClose={()=>setModal(null)} saving={saving}/>}
    </div>
  );
}
