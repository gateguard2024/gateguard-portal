-- Migration 095b: AI Agent features + feature_settings key
-- Adds 8 AI Army agents as feature-gated items and the admin Feature Settings entry.
-- Run AFTER 095_feature_flags.sql
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.feature_catalog (key, label, section, section_label, href, description, sort_order, is_beta, tier_defaults)
VALUES

-- Feature Settings admin page (was missing from 095 seed)
('dealer.feature_settings', 'Feature Settings', 'dealer', 'Dealer Network', '/admin/settings/features',
  'Global tier defaults and Stripe subscription hooks', 79, false,
  '{"corporate":"edit","master_agent":"none","master_dealer":"none","full_dealer":"none","service_dealer":"none","install_contractor":"none","sales_partner":"none"}'::jsonb),

-- AI Agents section
('ai.aria', 'ARIA — Lead Intel', 'ai_agents', 'AI Agents', '/aria',
  'AI-powered lead research, deep property intelligence, SCOUT outreach', 90, false,
  '{"corporate":"edit","master_agent":"edit","master_dealer":"edit","full_dealer":"edit","service_dealer":"none","install_contractor":"none","sales_partner":"edit"}'::jsonb),

('ai.trinity', 'TRINITY — Voice AI', 'ai_agents', 'AI Agents', '/trinity',
  'AI voice agent for inbound/outbound calls and lead qualification', 91, true,
  '{"corporate":"edit","master_agent":"edit","master_dealer":"edit","full_dealer":"view","service_dealer":"none","install_contractor":"none","sales_partner":"none"}'::jsonb),

('ai.scout', 'SCOUT — Market Intel', 'ai_agents', 'AI Agents', '/scout',
  'Automated market and territory intelligence sweeps', 92, true,
  '{"corporate":"edit","master_agent":"edit","master_dealer":"edit","full_dealer":"view","service_dealer":"none","install_contractor":"none","sales_partner":"view"}'::jsonb),

('ai.beacon', 'BEACON — Client Comms', 'ai_agents', 'AI Agents', '/beacon',
  'AI-drafted client communications, follow-ups, and touchpoints', 93, true,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"none","install_contractor":"none","sales_partner":"edit"}'::jsonb),

('ai.forge', 'FORGE — Quote Builder', 'ai_agents', 'AI Agents', '/quotes/new',
  'AI-assisted CPQ — scenario templates, dependency checks, margin engine', 94, false,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"none","install_contractor":"none","sales_partner":"edit"}'::jsonb),

('ai.atlas', 'ATLAS — DirecTV', 'ai_agents', 'AI Agents', '/atlas',
  'DirecTV for Business quoting and provisioning automation', 95, true,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"view","service_dealer":"none","install_contractor":"none","sales_partner":"edit"}'::jsonb),

('ai.sage', 'SAGE — Training', 'ai_agents', 'AI Agents', '/training',
  'AI training coach — adaptive courses and certification prep', 96, true,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"edit","install_contractor":"edit","sales_partner":"view"}'::jsonb),

('ai.relay', 'RELAY — Tier-1 Support', 'ai_agents', 'AI Agents', '/relay',
  'AI Tier-1 support agent — handles routine dealer and tech queries', 97, true,
  '{"corporate":"edit","master_agent":"none","master_dealer":"edit","full_dealer":"edit","service_dealer":"edit","install_contractor":"edit","sales_partner":"none"}'::jsonb)

ON CONFLICT (key) DO UPDATE SET
  label         = EXCLUDED.label,
  section       = EXCLUDED.section,
  section_label = EXCLUDED.section_label,
  href          = EXCLUDED.href,
  description   = EXCLUDED.description,
  sort_order    = EXCLUDED.sort_order,
  is_beta       = EXCLUDED.is_beta,
  tier_defaults = EXCLUDED.tier_defaults,
  updated_at    = now();
