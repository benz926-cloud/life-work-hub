-- ============================================
-- Life Work Hub - Database Schema
-- PostgreSQL (Supabase)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== Profiles =====
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== AI Inbox Items =====
CREATE TABLE inbox_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  category TEXT CHECK (category IN ('task', 'shopping', 'inspiration', 'ai_processing')) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'archived')) DEFAULT 'pending',
  ai_result TEXT,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inbox_user ON inbox_items(user_id);
CREATE INDEX idx_inbox_category ON inbox_items(user_id, category);
CREATE INDEX idx_inbox_status ON inbox_items(user_id, status);

-- ===== Wardrobe =====
CREATE TABLE wardrobe_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('top', 'bottom', 'outerwear', 'dress', 'shoes', 'accessory')) NOT NULL,
  color TEXT NOT NULL,
  secondary_color TEXT,
  season TEXT[] NOT NULL DEFAULT '{}',
  style TEXT[] NOT NULL DEFAULT '{}',
  image_url TEXT,
  brand TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wardrobe_user ON wardrobe_items(user_id);

CREATE TABLE outfits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  weather TEXT,
  temperature REAL,
  items UUID[] NOT NULL DEFAULT '{}',
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outfits_user_date ON outfits(user_id, date);

-- ===== Finance =====
CREATE TABLE finance_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
  amount REAL NOT NULL CHECK (amount > 0),
  category TEXT CHECK (category IN ('food','transport','shopping','housing','entertainment','health','education','family','other')) NOT NULL,
  description TEXT DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_finance_user_date ON finance_records(user_id, date);
CREATE INDEX idx_finance_user_type ON finance_records(user_id, type);

CREATE TABLE savings_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  target_amount REAL NOT NULL,
  current_amount REAL DEFAULT 0,
  deadline DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== Family Members =====
CREATE TABLE family_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  role TEXT CHECK (role IN ('self', 'spouse', 'child', 'parent')) NOT NULL,
  age INTEGER,
  avatar_url TEXT,
  notes TEXT,
  health_conditions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_family_user ON family_members(user_id);

-- ===== Health Records =====
CREATE TABLE health_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  steps INTEGER,
  sleep_hours REAL,
  heart_rate INTEGER,
  weight REAL,
  blood_pressure_systolic INTEGER,
  blood_pressure_diastolic INTEGER,
  blood_sugar REAL,
  calories_burned INTEGER,
  active_minutes INTEGER,
  source TEXT CHECK (source IN ('apple_health', 'manual', 'device')) DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_health_user_date ON health_records(user_id, date);
CREATE INDEX idx_health_member ON health_records(family_member_id, date);

-- ===== Child Growth =====
CREATE TABLE child_growth_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  family_member_id UUID REFERENCES family_members(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  height_cm REAL,
  weight_kg REAL,
  vision_left REAL,
  vision_right REAL,
  subject_scores JSONB DEFAULT '{}',
  milestones TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_growth_member ON child_growth_records(family_member_id, date);

-- ===== Checkins / Habits =====
CREATE TABLE checkin_habits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('fitness', 'learning', 'health', 'work', 'other')) NOT NULL,
  source TEXT CHECK (source IN ('keep', 'duolingo', 'beike', 'manual')) DEFAULT 'manual',
  target_days_per_week INTEGER DEFAULT 7,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_habits_user ON checkin_habits(user_id);

CREATE TABLE checkin_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  habit_id UUID REFERENCES checkin_habits(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  completed BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, habit_id, date)
);

CREATE INDEX idx_checkins_user_date ON checkin_records(user_id, date);

-- ===== Work: Approvals =====
CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  applicant TEXT NOT NULL,
  source TEXT CHECK (source IN ('feishu', 'other')) DEFAULT 'feishu',
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  amount REAL,
  reason TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_approvals_user_status ON approvals(user_id, status);

-- ===== Work: Alerts =====
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  level TEXT CHECK (level IN ('critical', 'warning', 'info')) NOT NULL,
  source TEXT CHECK (source IN ('feishu', 'industry_platform', 'italent', 'system')) NOT NULL,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_user_level ON alerts(user_id, level);
CREATE INDEX idx_alerts_user_resolved ON alerts(user_id, resolved);

-- ===== Work: Tasks =====
CREATE TABLE work_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT CHECK (status IN ('todo', 'in_progress', 'review', 'done')) DEFAULT 'todo',
  priority TEXT CHECK (priority IN ('urgent', 'normal', 'low')) DEFAULT 'normal',
  assignee TEXT,
  due_date DATE,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_work_tasks_user_status ON work_tasks(user_id, status);

-- ===== Work: KPI Reports =====
CREATE TABLE kpi_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT DEFAULT '',
  trend TEXT CHECK (trend IN ('up', 'down', 'stable')) DEFAULT 'stable',
  change_percent REAL,
  period TEXT CHECK (period IN ('daily', 'weekly', 'monthly')) DEFAULT 'daily',
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== Content Feeds =====
CREATE TABLE content_feeds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('bilibili', 'xiaohongshu', 'youtube')) NOT NULL,
  author TEXT DEFAULT '',
  summary TEXT,
  thumbnail_url TEXT,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feeds_platform ON content_feeds(platform);
CREATE INDEX idx_feeds_user ON content_feeds(user_id);

CREATE TABLE saved_contents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  feed_id UUID REFERENCES content_feeds(id) ON DELETE CASCADE NOT NULL,
  category TEXT CHECK (category IN ('fashion','travel','food','health','skill','english','knowledge','other')) NOT NULL,
  notes TEXT,
  converted_to_knowledge BOOLEAN DEFAULT false,
  saved_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saved_user ON saved_contents(user_id);
CREATE INDEX idx_saved_category ON saved_contents(user_id, category);

CREATE TABLE knowledge_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  saved_content_id UUID REFERENCES saved_contents(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('checklist', 'quiz', 'action_plan', 'summary')) NOT NULL,
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscription_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  platform TEXT CHECK (platform IN ('bilibili', 'xiaohongshu', 'youtube')) NOT NULL,
  category TEXT CHECK (category IN ('fashion','travel','food','health','skill','english','knowledge','other')) NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== Travel =====
CREATE TABLE travel_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  destination TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT CHECK (status IN ('planning', 'upcoming', 'in_progress', 'completed')) DEFAULT 'planning',
  itinerary JSONB,
  checklist JSONB,
  budget REAL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===== System Integrations =====
CREATE TABLE system_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT CHECK (name IN ('feishu','industry_platform','italent','apple_health','keep','duolingo')) NOT NULL,
  connected BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- ===== RLS Policies (Supabase) =====
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wardrobe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfits ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_growth_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE travel_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_integrations ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see their own data
CREATE POLICY "Users own data" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users own data" ON inbox_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON wardrobe_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON outfits FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON finance_records FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON savings_goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON family_members FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON health_records FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON child_growth_records FOR ALL USING (family_member_id IN (SELECT id FROM family_members WHERE user_id = auth.uid()));
CREATE POLICY "Users own data" ON checkin_habits FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON checkin_records FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON approvals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON alerts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON work_tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON kpi_reports FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON content_feeds FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON saved_contents FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON knowledge_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON subscription_rules FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON travel_plans FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own data" ON system_integrations FOR ALL USING (auth.uid() = user_id);
