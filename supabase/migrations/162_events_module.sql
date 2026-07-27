-- Migration 162: Events module — property events + reusable templates.
-- Event types: lunch_learn, launch_party, meet_greet, trade_show, open_house, other.

-- ── Core event ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.property_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,
  created_by TEXT,
  host_user_id TEXT,
  host_name TEXT,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'lunch_learn',
  site_id UUID,
  aria_property_id UUID,
  property_name TEXT,
  status TEXT NOT NULL DEFAULT 'planning',
  event_date DATE,
  start_time TEXT,
  end_time TEXT,
  venue TEXT,
  goal TEXT,
  expected_attendance INT,
  actual_attendance INT,
  budget NUMERIC,
  actual_cost NUMERIC,
  outcome_notes TEXT,
  template_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT ALL ON TABLE public.property_events TO postgres, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.event_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  category TEXT DEFAULT 'logistics',
  title TEXT NOT NULL,
  owner_user_id TEXT,
  owner_name TEXT,
  due_date DATE,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT ALL ON TABLE public.event_checklist_items TO postgres, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.event_supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  item TEXT NOT NULL,
  qty INT DEFAULT 1,
  vendor TEXT,
  cost NUMERIC,
  needed_by DATE,
  status TEXT DEFAULT 'needed',
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT ALL ON TABLE public.event_supplies TO postgres, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.event_campaign_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  step TEXT NOT NULL,
  audience TEXT,
  send_at DATE,
  status TEXT DEFAULT 'draft',
  email_subject TEXT,
  email_html TEXT,
  sent_message_id TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT ALL ON TABLE public.event_campaign_steps TO postgres, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.event_guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  name TEXT,
  email TEXT,
  company TEXT,
  rsvp TEXT DEFAULT 'invited',
  lead_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT ALL ON TABLE public.event_guests TO postgres, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.event_ops_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  work_order_id UUID,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT ALL ON TABLE public.event_ops_links TO postgres, anon, authenticated, service_role;

-- ── Templates ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID,                    -- NULL = corporate starter, visible to all
  name TEXT NOT NULL,
  event_type TEXT NOT NULL,
  description TEXT,
  default_duration_min INT,
  default_budget NUMERIC,
  is_starter BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT ALL ON TABLE public.event_templates TO postgres, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.event_template_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL,
  category TEXT DEFAULT 'logistics',
  title TEXT NOT NULL,
  owner_role TEXT,
  offset_days INT DEFAULT 0        -- days relative to event_date (negative = before)
);
GRANT ALL ON TABLE public.event_template_tasks TO postgres, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.event_template_supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL,
  item TEXT NOT NULL,
  qty INT DEFAULT 1,
  vendor TEXT
);
GRANT ALL ON TABLE public.event_template_supplies TO postgres, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.event_template_campaign (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL,
  step TEXT NOT NULL,
  offset_days INT DEFAULT 0,
  email_subject TEXT,
  email_html TEXT,                 -- carries {{merge_vars}}
  sort_order INT DEFAULT 0
);
GRANT ALL ON TABLE public.event_template_campaign TO postgres, anon, authenticated, service_role;

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_property_events_org ON public.property_events(org_id);
CREATE INDEX IF NOT EXISTS idx_property_events_date ON public.property_events(event_date);
CREATE INDEX IF NOT EXISTS idx_event_checklist_event ON public.event_checklist_items(event_id);
CREATE INDEX IF NOT EXISTS idx_event_supplies_event ON public.event_supplies(event_id);
CREATE INDEX IF NOT EXISTS idx_event_campaign_event ON public.event_campaign_steps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_guests_event ON public.event_guests(event_id);
CREATE INDEX IF NOT EXISTS idx_event_ops_event ON public.event_ops_links(event_id);
CREATE INDEX IF NOT EXISTS idx_evt_tpl_tasks ON public.event_template_tasks(template_id);
CREATE INDEX IF NOT EXISTS idx_evt_tpl_supplies ON public.event_template_supplies(template_id);
CREATE INDEX IF NOT EXISTS idx_evt_tpl_campaign ON public.event_template_campaign(template_id);

-- ── Seed starter templates ───────────────────────────────────────────────────
-- Lunch & Learn
INSERT INTO public.event_templates (id, org_id, name, event_type, description, default_duration_min, default_budget, is_starter)
VALUES ('a1111111-0000-4000-8000-000000000001', NULL, 'Property Manager Lunch & Learn', 'lunch_learn',
        'Catered 90-minute session for property managers — demo + Q&A.', 90, 1200, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_template_tasks (template_id, category, title, owner_role, offset_days) VALUES
 ('a1111111-0000-4000-8000-000000000001','logistics','Reserve community/conference room','host',-21),
 ('a1111111-0000-4000-8000-000000000001','marketing','Finalize invite list','host',-18),
 ('a1111111-0000-4000-8000-000000000001','supplies','Order catering (confirm headcount)','host',-10),
 ('a1111111-0000-4000-8000-000000000001','marketing','Print one-pagers & sign-in sheet','marketing',-7),
 ('a1111111-0000-4000-8000-000000000001','ops','Confirm demo gate/camera install timing','ops',-5),
 ('a1111111-0000-4000-8000-000000000001','logistics','Send reminder + confirm final headcount','host',-3),
 ('a1111111-0000-4000-8000-000000000001','logistics','Load supplies + set up room','host',0)
ON CONFLICT DO NOTHING;

INSERT INTO public.event_template_supplies (template_id, item, qty, vendor) VALUES
 ('a1111111-0000-4000-8000-000000000001','Pull-up banner + tablecloth',1,'Vistaprint'),
 ('a1111111-0000-4000-8000-000000000001','Catering (lunch, per headcount)',1,'Local caterer'),
 ('a1111111-0000-4000-8000-000000000001','Printed one-pagers',50,'Office print'),
 ('a1111111-0000-4000-8000-000000000001','Demo gate/camera kit',1,'Internal')
ON CONFLICT DO NOTHING;

INSERT INTO public.event_template_campaign (template_id, step, offset_days, email_subject, email_html, sort_order) VALUES
 ('a1111111-0000-4000-8000-000000000001','save_the_date',-21,'Save the date: Lunch & Learn at {{property}}',
   '<p>Hi {{first_name}},</p><p>Save the date — we''re hosting a lunch & learn at <strong>{{property}}</strong> on <strong>{{event_date}}</strong> at {{event_time}}. Lunch is on us.</p><p>— {{host_name}}, Gate Guard</p>',1),
 ('a1111111-0000-4000-8000-000000000001','invite',-14,'You''re invited: Lunch & Learn at {{property}}',
   '<p>Hi {{first_name}},</p><p>Join us {{event_date}} at {{event_time}} for a catered lunch & learn at {{property}}. We''ll show how Gate Guard keeps your gates working and residents safe.</p><p><a href="{{rsvp_link}}">RSVP here</a></p><p>— {{host_name}}</p>',2),
 ('a1111111-0000-4000-8000-000000000001','reminder',-3,'Reminder: Lunch & Learn this week at {{property}}',
   '<p>Hi {{first_name}},</p><p>Quick reminder — our lunch & learn is {{event_date}} at {{event_time}}. Still able to make it? <a href="{{rsvp_link}}">Confirm here</a>.</p><p>— {{host_name}}</p>',3),
 ('a1111111-0000-4000-8000-000000000001','confirmation',-1,'See you tomorrow at {{property}}',
   '<p>Hi {{first_name}},</p><p>Looking forward to seeing you tomorrow at {{event_time}} at {{property}}. Lunch is provided.</p><p>— {{host_name}}</p>',4),
 ('a1111111-0000-4000-8000-000000000001','thank_you',1,'Thanks for coming — next steps',
   '<p>Hi {{first_name}},</p><p>Thanks for joining us at {{property}}! As promised, here''s a quick recap and next steps. Reply anytime and I''ll set up a walkthrough.</p><p>— {{host_name}}</p>',5)
ON CONFLICT DO NOTHING;

-- Trade Show (lighter starter)
INSERT INTO public.event_templates (id, org_id, name, event_type, description, default_duration_min, default_budget, is_starter)
VALUES ('a2222222-0000-4000-8000-000000000002', NULL, 'Trade Show Booth', 'trade_show',
        'Multi-day trade show booth presence with lead capture.', 480, 6500, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_template_tasks (template_id, category, title, owner_role, offset_days) VALUES
 ('a2222222-0000-4000-8000-000000000002','logistics','Book booth + confirm floor space','host',-45),
 ('a2222222-0000-4000-8000-000000000002','marketing','Design + order booth graphics','marketing',-30),
 ('a2222222-0000-4000-8000-000000000002','supplies','Order giveaways + lead-capture tablets','host',-21),
 ('a2222222-0000-4000-8000-000000000002','logistics','Arrange shipping/freight of booth','ops',-14),
 ('a2222222-0000-4000-8000-000000000002','logistics','Book staff travel + hotel','host',-14),
 ('a2222222-0000-4000-8000-000000000002','marketing','Pre-show email to target attendees','marketing',-7)
ON CONFLICT DO NOTHING;

INSERT INTO public.event_template_supplies (template_id, item, qty, vendor) VALUES
 ('a2222222-0000-4000-8000-000000000002','Booth backdrop + banners',1,'Trade show vendor'),
 ('a2222222-0000-4000-8000-000000000002','Branded giveaways',200,'Promo vendor'),
 ('a2222222-0000-4000-8000-000000000002','Lead-capture tablets',2,'Internal')
ON CONFLICT DO NOTHING;

INSERT INTO public.event_template_campaign (template_id, step, offset_days, email_subject, email_html, sort_order) VALUES
 ('a2222222-0000-4000-8000-000000000002','invite',-14,'Meet Gate Guard at {{property}}',
   '<p>Hi {{first_name}},</p><p>We''ll be at {{property}} on {{event_date}} — stop by our booth to see how Gate Guard secures multifamily communities. <a href="{{rsvp_link}}">Book a booth slot</a>.</p><p>— {{host_name}}</p>',1),
 ('a2222222-0000-4000-8000-000000000002','thank_you',1,'Great meeting you at {{property}}',
   '<p>Hi {{first_name}},</p><p>Thanks for stopping by our booth! Here''s the follow-up I promised — reply and I''ll get you a tailored quote.</p><p>— {{host_name}}</p>',2)
ON CONFLICT DO NOTHING;
