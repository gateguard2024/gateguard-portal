-- Migration 078: Gamification — achievements, dealer tiers, quests

-- Tech achievements table
CREATE TABLE IF NOT EXISTS tech_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid REFERENCES technicians(id) ON DELETE CASCADE,
  achievement_id text NOT NULL,
  achievement_name text NOT NULL,
  description text,
  earned_at timestamptz DEFAULT now(),
  UNIQUE(technician_id, achievement_id)
);

-- Dealer tier points table (computed points that drive Bronze→Elite tiers)
CREATE TABLE IF NOT EXISTS dealer_tier_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  total_points integer DEFAULT 0,
  tier text DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','certified','elite')),
  tier_updated_at timestamptz DEFAULT now(),
  points_breakdown jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- Quests definitions
CREATE TABLE IF NOT EXISTS quests (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text,
  target_metric text NOT NULL,
  target_value integer NOT NULL,
  reward_points integer DEFAULT 50,
  duration_days integer DEFAULT 30,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Quest progress per org
CREATE TABLE IF NOT EXISTS quest_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quest_id text REFERENCES quests(id) ON DELETE CASCADE,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  current_value integer DEFAULT 0,
  completed_at timestamptz,
  started_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  UNIQUE(quest_id, org_id)
);

-- Win feed for NEXUS proactive delivery
CREATE TABLE IF NOT EXISTS nexus_wins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  win_type text NOT NULL, -- 'five_star_wo', 'deal_closed', 'cert_earned', 'streak', 'tier_up', 'quest_complete'
  title text NOT NULL,
  description text,
  meta jsonb DEFAULT '{}',
  shown_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Seed default quests
INSERT INTO quests (id, title, description, target_metric, target_value, reward_points, duration_days) VALUES
  ('q_surveys_5', 'Survey Sprint', 'Complete 5 site surveys this month', 'surveys_completed', 5, 100, 30),
  ('q_quotes_3', 'Quote Blitz', 'Get 3 quotes approved in a week', 'quotes_approved', 3, 150, 7),
  ('q_zero_overdue', 'Clean Slate', 'Zero overdue work orders for 30 days', 'overdue_wos', 0, 200, 30),
  ('q_certs_2', 'Knowledge Builder', 'Earn 2 training certifications', 'certs_earned', 2, 120, 60),
  ('q_five_star_5', 'Five Star Run', 'Collect 5 five-star job ratings', 'five_star_ratings', 5, 175, 30)
ON CONFLICT (id) DO NOTHING;

-- RLS policies
ALTER TABLE tech_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE dealer_tier_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE quests ENABLE ROW LEVEL SECURITY;
ALTER TABLE quest_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE nexus_wins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON tech_achievements;
DROP POLICY IF EXISTS "service_role_all" ON dealer_tier_points;
DROP POLICY IF EXISTS "service_role_all" ON quests;
DROP POLICY IF EXISTS "service_role_all" ON quest_progress;
DROP POLICY IF EXISTS "service_role_all" ON nexus_wins;

CREATE POLICY "service_role_all" ON tech_achievements USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON dealer_tier_points USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON quests USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON quest_progress USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON nexus_wins USING (true) WITH CHECK (true);
