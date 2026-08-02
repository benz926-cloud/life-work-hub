-- ============================================
-- Life Work Hub — Auth Triggers & Fixes
-- Run this AFTER the main schema.sql on Supabase
-- ============================================

-- Auto-create a profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Fix child_growth_records RLS policy
-- The existing policy uses a subquery which may have issues;
-- simpler approach: join through family_members
-- ============================================
DROP POLICY IF EXISTS "Users own data" ON child_growth_records;
CREATE POLICY "Users own data" ON child_growth_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM family_members fm
      WHERE fm.id = child_growth_records.family_member_id
      AND fm.user_id = auth.uid()
    )
  );
