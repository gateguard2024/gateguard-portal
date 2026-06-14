-- Migration 111: Seed KB — Platform How-To: "How to Add and Edit Users"
--
-- The knowledge base (kb_articles) is the home for platform how-tos as well as
-- field data. This seeds the first platform how-to. Idempotent (WHERE NOT EXISTS).
-- Run on beta first, then prod. kb_articles already exists (migration 004) — no GRANT needed.
-- Content renders as plain text (whitespace preserved), so it is written as plain steps.

INSERT INTO public.kb_articles (category, title, description, content, difficulty, author, active)
SELECT
  'Platform How-To',
  'How to Add and Edit Users',
  'Add people and set what they can see and do, from the Internal admin hub. Covers office users, field techs, contractors, and subcontractors.',
  $content$WHERE TO GO

From the Dashboard, open the Internal tab, then choose "Users & Features." This is the admin hub for everyone who can log in or be assigned work.

The board has three groups:
- Platform Users — people with a portal login.
- Field Techs — technicians (employees or contractors).
- Organizations — your dealers, clients, and corporate.


ADD A PERSON

1. Click "+ Add Person."
2. Choose who you are adding:
   - Office / portal user — works in the portal; gets a login and a role.
   - Field technician — does the work; employee.
   - Contractor — does the work; 1099 individual.
   - Subcontractor company — an outside firm you hand whole jobs to.
3. Enter their name, email, and phone.
4. Choose their access:
   - Office user: pick a role (Admin, Supervisor, or User).
   - Technician / Contractor: pick how they sign in —
       "Just the field app" (a code, no email login),
       "Full login" (portal invite + Tech role), or
       "No login yet."
5. Review and click "Add Person." Office users and full-login techs get an email invite automatically.


EDIT A USER'S ROLE AND ACCESS

1. In the Platform Users list, tap the person's card.
2. In the editor, pick their role. The access package updates automatically to match.
3. To fine-tune, open "Advanced" and set individual features. Anything above your own access is locked — you cannot grant more than you have.
4. Changes save automatically.


WHAT THE ROLES MEAN

- Admin — sees everything in the organization and can manage users and access.
- Supervisor — sees everything in the organization but cannot manage users.
- User — sees only the work assigned to them (their leads, opportunities, quotes, and work orders).
- Tech — field tools only; sees only the work orders assigned to them.


IF SOMEONE IS NOT LISTED

Click "Sync logins" at the top of the board. This pulls in existing accounts that have not been mirrored yet. New signups appear automatically.


WHAT YOU CAN MANAGE

You can manage people in your own organization and any organization beneath you — never above. You can never give someone more access than you have yourself. Corporate sees and manages everything.$content$,
  'Basic',
  'GateGuard',
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.kb_articles
  WHERE title = 'How to Add and Edit Users' AND category = 'Platform How-To'
);
