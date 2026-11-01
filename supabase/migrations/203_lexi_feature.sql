-- Migration 203: Lexi as a feature, so Gate Guard can turn it on per dealer.
-- Off for every dealer tier by default; corporate always has it. Turn it on for a
-- dealer on Admin → Dealers → (dealer) → Features → "Lexi — AI Assistant":
--   View = Lexi answers questions; Edit = Lexi can also make changes (tasks, jobs…).
-- Data only (no new tables). Run on beta first, then prod.

INSERT INTO public.feature_catalog (key, label, section, section_label, href, description, sort_order, is_beta, tier_defaults)
VALUES ('ai.lexi', 'Lexi — AI Assistant', 'ai_agents', 'AI Agents', '/?tab=lexi',
  'The Nexus AI assistant (center tab): answers from your data, does tasks with undo, voice, reports. View = ask only; Edit = can also make changes.',
  89, true,
  '{"corporate":"edit","master_agent":"none","master_dealer":"none","full_dealer":"none","service_dealer":"none","install_contractor":"none","sales_partner":"none"}'::jsonb)
ON CONFLICT (key) DO UPDATE SET label = EXCLUDED.label, description = EXCLUDED.description, href = EXCLUDED.href, section = EXCLUDED.section, section_label = EXCLUDED.section_label;
