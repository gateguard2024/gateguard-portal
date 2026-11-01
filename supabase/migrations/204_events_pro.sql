-- Migration 204: Events — pro fields + lock the tables down.
--
-- 1) Security: migration 162 granted the event tables to anon/authenticated with
--    row-level security OFF, so anyone holding the public anon key could read
--    every event, guest name and email straight from the Data API. All Nexus
--    access goes through /api/events (service role), so turn RLS on with a
--    service-role-only policy. The browser never reads these tables directly.
-- 2) New fields: guest phone + check-in time, a link from an event to the sales
--    deal it supports, a day-of schedule (run_of_show), venue contact + booth #,
--    and supply categories / unit costs / needed-by offsets on templates.
-- 3) Starter plans: Property Launch Party, Apartment Association Show, Home Show,
--    Office Presentation — full step-by-step checklists (venue, food, print,
--    presentation, booth, email, staffing, follow-up), order lists with costs,
--    email campaigns and a day-of schedule. Safe to re-run.
-- ALTER only (no new tables) — no GRANT needed. Run on beta first, then prod.

ALTER TABLE public.event_guests     ADD COLUMN IF NOT EXISTS phone          text;
ALTER TABLE public.event_guests     ADD COLUMN IF NOT EXISTS checked_in_at  timestamptz;
ALTER TABLE public.property_events  ADD COLUMN IF NOT EXISTS opportunity_id uuid;
CREATE INDEX IF NOT EXISTS property_events_org_date_idx ON public.property_events (org_id, event_date);
CREATE INDEX IF NOT EXISTS event_guests_event_idx ON public.event_guests (event_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['property_events','event_checklist_items','event_supplies','event_campaign_steps','event_guests',
                           'event_ops_links','event_templates','event_template_tasks','event_template_supplies','event_template_campaign']
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_service', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t || '_service', t);
    END IF;
  END LOOP;
END $$;

-- ── New columns for the pro planner ─────────────────────────────────────────
ALTER TABLE public.property_events ADD COLUMN IF NOT EXISTS run_of_show jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.property_events ADD COLUMN IF NOT EXISTS venue_address text;
ALTER TABLE public.property_events ADD COLUMN IF NOT EXISTS venue_contact text;
ALTER TABLE public.property_events ADD COLUMN IF NOT EXISTS venue_phone text;
ALTER TABLE public.property_events ADD COLUMN IF NOT EXISTS booth_number text;
ALTER TABLE public.event_supplies ADD COLUMN IF NOT EXISTS category text DEFAULT 'other';
ALTER TABLE public.event_templates ADD COLUMN IF NOT EXISTS run_of_show jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.event_template_supplies ADD COLUMN IF NOT EXISTS category text DEFAULT 'other';
ALTER TABLE public.event_template_supplies ADD COLUMN IF NOT EXISTS unit_cost numeric;
ALTER TABLE public.event_template_supplies ADD COLUMN IF NOT EXISTS offset_days int;

-- ── Starter plans (Gate Guard corporate, visible to everyone) ───────────────
-- Each block only seeds its steps if that template has none yet, so re-running is safe.

-- Property Launch Party
INSERT INTO public.event_templates (id, org_id, name, event_type, description, default_duration_min, default_budget, is_starter, run_of_show)
VALUES ('a3333333-0000-4000-8000-000000000003', NULL, 'Property Launch Party', 'launch_party', 'Celebrate a new community or a finished install at the property — residents, the management team and owners see the new gates, cameras and visitor passes live.', 180, 3500, true, '[{"offset_min": -120, "item": "Load-in: signage, tables, demo station", "owner": "Team"}, {"offset_min": -60, "item": "Caterer arrives; test the demo", "owner": "Ops"}, {"offset_min": -15, "item": "Staff huddle: roles and goals", "owner": "Host"}, {"offset_min": 0, "item": "Doors open \u2014 check-in and sign-up", "owner": "Greeter"}, {"offset_min": 30, "item": "Welcome and live demo", "owner": "Host"}, {"offset_min": 60, "item": "Q&A, resident app sign-ups", "owner": "Team"}, {"offset_min": 150, "item": "Raffle drawing and thank-you", "owner": "Host"}, {"offset_min": 180, "item": "Teardown and pack out", "owner": "Team"}]'::jsonb)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.event_template_tasks (template_id, category, title, owner_role, offset_days)
SELECT * FROM (VALUES
 ('a3333333-0000-4000-8000-000000000003'::uuid,'venue','Confirm date and space with the property manager (clubhouse, pool deck, leasing office)','host',-42),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'marketing','Build the guest list: property team, regional manager, owner reps, residents, local brokers','host',-35),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'venue','Get property approval and send a certificate of insurance if they need one','ops',-30),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'print','Design the invite flyer and resident door hanger','marketing',-28),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'food','Get 2–3 catering quotes','host',-28),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'marketing','Send the save-the-date','marketing',-21),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'print','Order banners, yard signs and table signs','marketing',-21),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'presentation','Plan the live demo: open the gate from a phone, camera wall, issue a visitor pass','ops',-21),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'booth','Order branded giveaways and a raffle prize','marketing',-18),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'marketing','Send invitations and post on the resident portal / community board','marketing',-14),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'food','Book the caterer and drinks; collect dietary needs','host',-14),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'staffing','Assign roles: greeter, demo lead, resident sign-up, photos','host',-14),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'venue','Rent tables, chairs, linens or a tent if needed','host',-10),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'presentation','Test the demo equipment on site','ops',-7),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'print','Print the sign-in sheet / QR code, one-pagers and resident how-to cards','marketing',-7),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'food','Give the caterer the final headcount','host',-5),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'marketing','Send the reminder email','marketing',-3),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'logistics','Pack the event kit (banners, giveaways, demo kit, extension cords, tape)','host',-2),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'venue','Confirm load-in time, parking and who has keys','host',-1),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'venue','Set up: signage, check-in table, food area, demo station','host',0),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'staffing','Take photos and short videos for social and the case study','marketing',0),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'followup','Send the thank-you email with photos','host',1),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'followup','Turn attendees into leads and log notes from conversations','host',2),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'followup','Pay vendors and enter actual costs','host',3),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'followup','Review results: attendance, leads, cost per lead','host',7)
) v(template_id, category, title, owner_role, offset_days)
WHERE NOT EXISTS (SELECT 1 FROM public.event_template_tasks WHERE template_id = 'a3333333-0000-4000-8000-000000000003'::uuid);
INSERT INTO public.event_template_supplies (template_id, category, item, qty, vendor, unit_cost, offset_days)
SELECT * FROM (VALUES
 ('a3333333-0000-4000-8000-000000000003'::uuid,'print','Retractable banner',2,'Vistaprint',150::numeric,-21),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'print','Yard signs',6,'Vistaprint',20::numeric,-21),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'print','Invite flyers / door hangers',300,'Vistaprint',0.4::numeric,-21),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'print','Table signs + QR stands',4,'Office print',15::numeric,-7),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'print','One-pagers',100,'Office print',0.5::numeric,-7),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'food','Catering (per headcount)',1,'Local caterer',1200::numeric,-14),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'food','Drinks and ice',1,'Local caterer',300::numeric,-14),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'giveaways','Branded giveaways',150,'Promo vendor',3::numeric,-18),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'giveaways','Raffle prize',1,'Retail',200::numeric,-18),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'booth','Branded tablecloth',2,'Vistaprint',90::numeric,-21),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'rental','Tables, chairs, linens',1,'Party rental',250::numeric,-10),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'presentation','Demo gate / camera kit',1,'Internal',0::numeric,-7)
) v(template_id, category, item, qty, vendor, unit_cost, offset_days)
WHERE NOT EXISTS (SELECT 1 FROM public.event_template_supplies WHERE template_id = 'a3333333-0000-4000-8000-000000000003'::uuid);
INSERT INTO public.event_template_campaign (template_id, step, offset_days, email_subject, email_html, sort_order)
SELECT * FROM (VALUES
 ('a3333333-0000-4000-8000-000000000003'::uuid,'save_the_date',-21,'Save the date: celebrating {{property}}','<p>Hi {{first_name}},</p><p>We’re celebrating the new {{property}} on <strong>{{event_date}}</strong> at {{event_time}} — food, drinks and a live look at the community’s new gate and camera system.</p><p>Formal invite coming soon.</p><p>— {{host_name}}<br>Gate Guard</p>',1),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'invite',-14,'You’re invited: {{property}} launch party','<p>Hi {{first_name}},</p><p>Join us {{event_date}} at {{event_time}} at {{venue}}. We’ll have food and drinks, and we’ll show residents how to open the gate from their phone and send visitor passes.</p><p>Reply to this email to let us know you’re coming.</p><p>— {{host_name}}<br>Gate Guard</p>',2),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'reminder',-3,'This week: {{property}} launch party','<p>Hi {{first_name}},</p><p>Quick reminder — the launch party is {{event_date}} at {{event_time}} at {{venue}}. Still able to make it? Just reply.</p><p>— {{host_name}}<br>Gate Guard</p>',3),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'confirmation',-1,'See you tomorrow at {{property}}','<p>Hi {{first_name}},</p><p>Looking forward to seeing you tomorrow at {{event_time}} at {{venue}}.</p><p>— {{host_name}}<br>Gate Guard</p>',4),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'thank_you',1,'Thanks for celebrating with us','<p>Hi {{first_name}},</p><p>Thanks for coming to the {{property}} launch! A few photos are attached. If you’d like the same setup at another community, reply and I’ll set up a walkthrough.</p><p>— {{host_name}}<br>Gate Guard</p>',5),
 ('a3333333-0000-4000-8000-000000000003'::uuid,'follow_up',7,'Next steps after the {{property}} launch','<p>Hi {{first_name}},</p><p>Following up from the launch — happy to put together a quote or a site walk for any of your other properties. What week works?</p><p>— {{host_name}}<br>Gate Guard</p>',6)
) v(template_id, step, offset_days, email_subject, email_html, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.event_template_campaign WHERE template_id = 'a3333333-0000-4000-8000-000000000003'::uuid);

-- Apartment Association Show (Booth)
INSERT INTO public.event_templates (id, org_id, name, event_type, description, default_duration_min, default_budget, is_starter, run_of_show)
VALUES ('a4444444-0000-4000-8000-000000000004', NULL, 'Apartment Association Show (Booth)', 'association_show', 'Exhibit at an apartment association trade show — booth, live demo, lead capture and follow-up.', 480, 8000, true, '[{"offset_min": -90, "item": "Arrive, check the booth, test the demo", "owner": "Team"}, {"offset_min": -15, "item": "Staff huddle: targets and goals", "owner": "Host"}, {"offset_min": 0, "item": "Show floor opens", "owner": "Team"}, {"offset_min": 120, "item": "Shift change", "owner": "Team"}, {"offset_min": 240, "item": "Lunch rotation", "owner": "Team"}, {"offset_min": 420, "item": "Raffle drawing", "owner": "Host"}, {"offset_min": 480, "item": "Floor closes \u2014 upload scans, teardown", "owner": "Team"}]'::jsonb)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.event_template_tasks (template_id, category, title, owner_role, offset_days)
SELECT * FROM (VALUES
 ('a4444444-0000-4000-8000-000000000004'::uuid,'booth','Register and book the booth; note the booth number','host',-90),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'booth','Read the exhibitor kit: deadlines, booth rules, electrical, freight','host',-75),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'venue','Order booth electrical, internet and furniture from the show decorator','ops',-60),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'print','Design the booth backdrop and graphics','marketing',-60),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'staffing','Book staff hotel and travel','host',-45),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'print','Order the backdrop, banner and table throw','marketing',-45),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'presentation','Plan the live booth demo (working gate operator / camera wall)','ops',-45),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'booth','Order giveaways and a raffle prize','marketing',-30),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'marketing','Get the attendee / exhibitor list and pick target companies','host',-30),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'print','Order brochures, one-pagers and business cards','marketing',-30),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'marketing','Send the pre-show email: “Visit us at booth #”','marketing',-21),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'logistics','Book freight to the advance warehouse','ops',-21),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'presentation','Write the demo script and talking points; train booth staff','host',-14),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'booth','Set up lead capture (badge scanner app or QR form)','marketing',-14),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'marketing','Book meetings with target prospects at the show','host',-10),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'logistics','Pack and ship the booth kit','ops',-7),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'marketing','Post the booth number on social','marketing',-3),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'booth','Booth setup and demo test','team',-1),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'staffing','Run the booth schedule; collect leads every shift','host',0),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'booth','Teardown and return freight','ops',0),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'followup','Upload badge scans / leads the same day','host',1),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'followup','Thank-you email to every lead','marketing',2),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'followup','Second follow-up and meeting asks','host',7),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'followup','Review results: cost per lead, deals opened','host',14)
) v(template_id, category, title, owner_role, offset_days)
WHERE NOT EXISTS (SELECT 1 FROM public.event_template_tasks WHERE template_id = 'a4444444-0000-4000-8000-000000000004'::uuid);
INSERT INTO public.event_template_supplies (template_id, category, item, qty, vendor, unit_cost, offset_days)
SELECT * FROM (VALUES
 ('a4444444-0000-4000-8000-000000000004'::uuid,'print','Booth backdrop',1,'Trade show vendor',1200::numeric,-45),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'print','Table throw',1,'Vistaprint',250::numeric,-45),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'print','Retractable banner',1,'Vistaprint',150::numeric,-45),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'print','Brochures',300,'Print shop',1::numeric,-30),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'print','Business cards',500,'Vistaprint',0.1::numeric,-30),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'giveaways','Branded giveaways',300,'Promo vendor',2.5::numeric,-30),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'giveaways','Raffle prize',1,'Retail',250::numeric,-30),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'giveaways','Candy and bowl',1,'Retail',40::numeric,-3),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'venue','Booth electrical',1,'Show decorator',300::numeric,-60),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'venue','Booth carpet and furniture',1,'Show decorator',600::numeric,-60),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'booth','Lead scanner rental',1,'Show organizer',350::numeric,-14),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'logistics','Freight / shipping',1,'Freight carrier',800::numeric,-21),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'staffing','Hotel and travel',1,'Travel',1500::numeric,-45),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'presentation','Demo gate / camera kit',1,'Internal',0::numeric,-7)
) v(template_id, category, item, qty, vendor, unit_cost, offset_days)
WHERE NOT EXISTS (SELECT 1 FROM public.event_template_supplies WHERE template_id = 'a4444444-0000-4000-8000-000000000004'::uuid);
INSERT INTO public.event_template_campaign (template_id, step, offset_days, email_subject, email_html, sort_order)
SELECT * FROM (VALUES
 ('a4444444-0000-4000-8000-000000000004'::uuid,'pre_show',-21,'Visit Gate Guard at booth {{booth}}','<p>Hi {{first_name}},</p><p>We’ll be at {{venue}} on {{event_date}} — booth <strong>{{booth}}</strong>. Stop by for a live demo of gate, access and camera systems built for apartment communities.</p><p>— {{host_name}}<br>Gate Guard</p>',1),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'meeting_ask',-10,'15 minutes at {{venue}}?','<p>Hi {{first_name}},</p><p>Will you be at the show on {{event_date}}? I’d love 15 minutes at booth {{booth}} to show you what we’re doing for communities like yours. Reply with a time that works.</p><p>— {{host_name}}<br>Gate Guard</p>',2),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'reminder',-2,'See you at booth {{booth}}','<p>Hi {{first_name}},</p><p>The show is almost here — find us at booth {{booth}}. We’ll have a live demo running all day.</p><p>— {{host_name}}<br>Gate Guard</p>',3),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'thank_you',2,'Great meeting you at the show','<p>Hi {{first_name}},</p><p>Thanks for stopping by booth {{booth}}! As promised, here’s a quick follow-up. Reply and I’ll put together a quote or a site walk.</p><p>— {{host_name}}<br>Gate Guard</p>',4),
 ('a4444444-0000-4000-8000-000000000004'::uuid,'follow_up',7,'Following up from the show','<p>Hi {{first_name}},</p><p>Circling back from the show — do you have a property where gate or camera issues are costing you time? I can have a proposal to you this week.</p><p>— {{host_name}}<br>Gate Guard</p>',5)
) v(template_id, step, offset_days, email_subject, email_html, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.event_template_campaign WHERE template_id = 'a4444444-0000-4000-8000-000000000004'::uuid);

-- Home Show (Booth)
INSERT INTO public.event_templates (id, org_id, name, event_type, description, default_duration_min, default_budget, is_starter, run_of_show)
VALUES ('a5555555-0000-4000-8000-000000000005', NULL, 'Home Show (Booth)', 'home_show', 'Consumer home / HOA show booth — reach HOA board members and homeowners with gate, access and camera solutions.', 480, 4000, true, '[{"offset_min": -60, "item": "Arrive and set up", "owner": "Team"}, {"offset_min": 0, "item": "Show opens", "owner": "Team"}, {"offset_min": 180, "item": "Shift change", "owner": "Team"}, {"offset_min": 420, "item": "Raffle drawing", "owner": "Host"}, {"offset_min": 480, "item": "Show closes \u2014 teardown", "owner": "Team"}]'::jsonb)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.event_template_tasks (template_id, category, title, owner_role, offset_days)
SELECT * FROM (VALUES
 ('a5555555-0000-4000-8000-000000000005'::uuid,'booth','Book the booth; note the booth number','host',-60),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'booth','Read the exhibitor kit: deadlines, rules, electrical','host',-55),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'print','Design and order banner, table throw and flyers','marketing',-40),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'venue','Order booth electrical if needed','ops',-40),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'booth','Order giveaways and a raffle prize','marketing',-30),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'booth','Set up a raffle / sign-up form (QR code)','marketing',-21),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'presentation','Prep the demo: video doorbell, smart gate, camera on a tablet','ops',-14),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'staffing','Make the staff booth schedule','host',-14),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'marketing','Post on social and email HOA contacts','marketing',-7),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'logistics','Pack the booth kit','host',-2),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'booth','Booth setup','team',-1),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'staffing','Run the booth; collect sign-ups','host',0),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'followup','Enter sign-ups as leads','host',1),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'followup','Thank-you email and raffle winner announcement','marketing',2),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'followup','Follow up with HOA board contacts','host',7)
) v(template_id, category, title, owner_role, offset_days)
WHERE NOT EXISTS (SELECT 1 FROM public.event_template_tasks WHERE template_id = 'a5555555-0000-4000-8000-000000000005'::uuid);
INSERT INTO public.event_template_supplies (template_id, category, item, qty, vendor, unit_cost, offset_days)
SELECT * FROM (VALUES
 ('a5555555-0000-4000-8000-000000000005'::uuid,'print','Retractable banner',1,'Vistaprint',150::numeric,-40),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'print','Table throw',1,'Vistaprint',250::numeric,-40),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'print','Flyers',500,'Vistaprint',0.3::numeric,-40),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'print','QR sign-up stand',2,'Office print',15::numeric,-21),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'giveaways','Branded giveaways',300,'Promo vendor',1.5::numeric,-30),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'giveaways','Raffle prize',1,'Retail',150::numeric,-30),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'venue','Booth electrical',1,'Show organizer',150::numeric,-40),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'presentation','Demo kit + tablet',1,'Internal',0::numeric,-7)
) v(template_id, category, item, qty, vendor, unit_cost, offset_days)
WHERE NOT EXISTS (SELECT 1 FROM public.event_template_supplies WHERE template_id = 'a5555555-0000-4000-8000-000000000005'::uuid);
INSERT INTO public.event_template_campaign (template_id, step, offset_days, email_subject, email_html, sort_order)
SELECT * FROM (VALUES
 ('a5555555-0000-4000-8000-000000000005'::uuid,'invite',-7,'Come see us at the home show','<p>Hi {{first_name}},</p><p>We’ll be at {{venue}} on {{event_date}}, booth {{booth}}. Stop by to see smart gates, video intercoms and cameras for HOAs and gated neighborhoods.</p><p>— {{host_name}}<br>Gate Guard</p>',1),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'thank_you',2,'Thanks for visiting our booth','<p>Hi {{first_name}},</p><p>Thanks for stopping by at {{venue}}! If your HOA is looking at gate or camera upgrades, reply and I’ll set up a free walkthrough.</p><p>— {{host_name}}<br>Gate Guard</p>',2),
 ('a5555555-0000-4000-8000-000000000005'::uuid,'follow_up',7,'Free gate & camera walkthrough for your community','<p>Hi {{first_name}},</p><p>Following up from the home show — I’d be glad to walk your community and recommend options. What day works?</p><p>— {{host_name}}<br>Gate Guard</p>',3)
) v(template_id, step, offset_days, email_subject, email_html, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.event_template_campaign WHERE template_id = 'a5555555-0000-4000-8000-000000000005'::uuid);

-- Office Presentation
INSERT INTO public.event_templates (id, org_id, name, event_type, description, default_duration_min, default_budget, is_starter, run_of_show)
VALUES ('a6666666-0000-4000-8000-000000000006', NULL, 'Office Presentation', 'office_presentation', 'Present to a management company at their office — tailored deck, live demo, leave-behinds and a clear next step.', 60, 400, true, '[{"offset_min": -20, "item": "Arrive, set up laptop and screen", "owner": "Host"}, {"offset_min": 0, "item": "Introductions", "owner": "Host"}, {"offset_min": 10, "item": "Their goals and problems", "owner": "Host"}, {"offset_min": 20, "item": "Presentation and live demo", "owner": "Host"}, {"offset_min": 45, "item": "Pricing and options", "owner": "Host"}, {"offset_min": 55, "item": "Agree on the next step and date", "owner": "Host"}]'::jsonb)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.event_template_tasks (template_id, category, title, owner_role, offset_days)
SELECT * FROM (VALUES
 ('a6666666-0000-4000-8000-000000000006'::uuid,'venue','Book the date with your contact; confirm the room and screen / AV','host',-14),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'marketing','Confirm who’s attending and their roles (regional, VP ops, maintenance)','host',-10),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'presentation','Research their portfolio (ARIA) — current gate, camera and access vendors','host',-10),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'presentation','Build the deck: their properties, case studies, pricing','host',-7),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'print','Order leave-behind folders and one-pagers','marketing',-7),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'marketing','Send the calendar invite and agenda','host',-5),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'food','Order breakfast or lunch for the room','host',-3),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'presentation','Rehearse; test laptop, adapters, clicker and the demo login','host',-2),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'venue','Confirm attendance, parking and check-in','host',-1),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'venue','Arrive 20 minutes early and set up','host',0),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'followup','Send the thank-you with the deck and next steps','host',1),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'followup','Send the proposal / quote','host',3),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'followup','Follow-up call','host',7)
) v(template_id, category, title, owner_role, offset_days)
WHERE NOT EXISTS (SELECT 1 FROM public.event_template_tasks WHERE template_id = 'a6666666-0000-4000-8000-000000000006'::uuid);
INSERT INTO public.event_template_supplies (template_id, category, item, qty, vendor, unit_cost, offset_days)
SELECT * FROM (VALUES
 ('a6666666-0000-4000-8000-000000000006'::uuid,'print','Leave-behind folders',15,'Office print',4::numeric,-7),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'print','One-pagers',20,'Office print',0.5::numeric,-7),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'food','Breakfast or lunch',1,'Local caterer',200::numeric,-3),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'food','Coffee',1,'Local café',40::numeric,-3),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'presentation','HDMI / USB-C adapters + clicker',1,'Internal',0::numeric,-2),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'presentation','Demo tablet',1,'Internal',0::numeric,-2)
) v(template_id, category, item, qty, vendor, unit_cost, offset_days)
WHERE NOT EXISTS (SELECT 1 FROM public.event_template_supplies WHERE template_id = 'a6666666-0000-4000-8000-000000000006'::uuid);
INSERT INTO public.event_template_campaign (template_id, step, offset_days, email_subject, email_html, sort_order)
SELECT * FROM (VALUES
 ('a6666666-0000-4000-8000-000000000006'::uuid,'invite',-5,'Agenda for our meeting on {{event_date}}','<p>Hi {{first_name}},</p><p>Looking forward to {{event_date}} at {{event_time}}. Here’s the plan: your goals, a short demo, and options for your communities. I’ll bring lunch.</p><p>— {{host_name}}<br>Gate Guard</p>',1),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'confirmation',-1,'See you tomorrow','<p>Hi {{first_name}},</p><p>Confirming tomorrow at {{event_time}} at {{venue}}. Anything you’d like me to cover?</p><p>— {{host_name}}<br>Gate Guard</p>',2),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'thank_you',1,'Thank you — deck and next steps','<p>Hi {{first_name}},</p><p>Thanks for having us. The deck is attached, and here are the next steps we discussed. I’ll have the proposal over by the end of the week.</p><p>— {{host_name}}<br>Gate Guard</p>',3),
 ('a6666666-0000-4000-8000-000000000006'::uuid,'follow_up',7,'Checking in on the proposal','<p>Hi {{first_name}},</p><p>Checking in — any questions on the proposal? Happy to walk a property together.</p><p>— {{host_name}}<br>Gate Guard</p>',4)
) v(template_id, step, offset_days, email_subject, email_html, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.event_template_campaign WHERE template_id = 'a6666666-0000-4000-8000-000000000006'::uuid);

-- Original starters: give them a day-of schedule and the new categories
UPDATE public.event_templates SET run_of_show = '[{"offset_min": -60, "item": "Set up room, test screen and demo", "owner": "Host"}, {"offset_min": -15, "item": "Caterer arrives", "owner": "Host"}, {"offset_min": 0, "item": "Guests arrive \u2014 sign-in and lunch", "owner": "Host"}, {"offset_min": 20, "item": "Presentation and live demo", "owner": "Host"}, {"offset_min": 60, "item": "Q&A", "owner": "Host"}, {"offset_min": 90, "item": "Wrap up and book follow-ups", "owner": "Host"}]'::jsonb WHERE id = 'a1111111-0000-4000-8000-000000000001' AND run_of_show = '[]'::jsonb;
UPDATE public.event_templates SET run_of_show = '[{"offset_min": -90, "item": "Arrive and set up the booth", "owner": "Team"}, {"offset_min": 0, "item": "Show floor opens", "owner": "Team"}, {"offset_min": 240, "item": "Lunch rotation", "owner": "Team"}, {"offset_min": 480, "item": "Floor closes \u2014 teardown", "owner": "Team"}]'::jsonb WHERE id = 'a2222222-0000-4000-8000-000000000002' AND run_of_show = '[]'::jsonb;
UPDATE public.event_template_tasks SET category = 'booth' WHERE template_id IN ('a1111111-0000-4000-8000-000000000001','a2222222-0000-4000-8000-000000000002') AND category = 'supplies';
UPDATE public.event_template_tasks SET category = 'presentation' WHERE template_id IN ('a1111111-0000-4000-8000-000000000001','a2222222-0000-4000-8000-000000000002') AND category = 'ops';
UPDATE public.event_template_tasks SET category = 'food' WHERE template_id = 'a1111111-0000-4000-8000-000000000001' AND title ILIKE '%catering%';
UPDATE public.event_template_tasks SET category = 'print' WHERE template_id IN ('a1111111-0000-4000-8000-000000000001','a2222222-0000-4000-8000-000000000002') AND (title ILIKE 'Print%' OR title ILIKE '%graphics%');
UPDATE public.event_template_supplies SET category = CASE WHEN item ILIKE '%cater%' THEN 'food' WHEN item ILIKE '%banner%' OR item ILIKE '%printed%' OR item ILIKE '%backdrop%' THEN 'print' WHEN item ILIKE '%giveaway%' THEN 'giveaways' ELSE 'booth' END WHERE template_id IN ('a1111111-0000-4000-8000-000000000001','a2222222-0000-4000-8000-000000000002') AND (category IS NULL OR category = 'other');
