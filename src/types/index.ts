// ===== User & Profile =====
export interface Profile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

// ===== AI Inbox =====
export type InboxCategory = "task" | "shopping" | "inspiration" | "ai_processing";
export type InboxStatus = "pending" | "in_progress" | "completed" | "archived";

export interface InboxItem {
  id: string;
  user_id: string;
  content: string;
  category: InboxCategory;
  status: InboxStatus;
  ai_result?: string;
  priority: "high" | "medium" | "low";
  created_at: string;
  updated_at: string;
}

// ===== Wardrobe =====
export type ClothingType = "top" | "bottom" | "outerwear" | "dress" | "shoes" | "accessory";
export type Season = "spring" | "summer" | "autumn" | "winter";
export type ClothingStyle = "casual" | "business" | "sport" | "formal" | "street";

export interface WardrobeItem {
  id: string;
  user_id: string;
  name: string;
  type: ClothingType;
  color: string;
  secondary_color?: string;
  season: Season[];
  style: ClothingStyle[];
  image_url?: string;
  brand?: string;
  notes?: string;
  created_at: string;
}

export interface Outfit {
  id: string;
  user_id: string;
  date: string;
  weather?: string;
  temperature?: number;
  items: string[]; // wardrobe item IDs
  rating?: number;
  notes?: string;
  created_at: string;
}

// ===== Finance =====
export type TransactionType = "income" | "expense";
export type ExpenseCategory =
  | "food"
  | "transport"
  | "shopping"
  | "housing"
  | "entertainment"
  | "health"
  | "education"
  | "family"
  | "other";

export interface FinanceRecord {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  category: ExpenseCategory;
  description: string;
  date: string;
  created_at: string;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline?: string;
  created_at: string;
}

// ===== Health =====
export interface HealthRecord {
  id: string;
  user_id: string;
  family_member_id?: string;
  date: string;
  steps?: number;
  sleep_hours?: number;
  heart_rate?: number;
  weight?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  blood_sugar?: number;
  calories_burned?: number;
  active_minutes?: number;
  source: "apple_health" | "manual" | "device";
  created_at: string;
}

// ===== Family =====
export type FamilyMemberRole = "self" | "spouse" | "child" | "parent";

export interface FamilyMember {
  id: string;
  user_id: string;
  name: string;
  role: FamilyMemberRole;
  age?: number;
  avatar_url?: string;
  notes?: string;
  health_conditions?: string[];
  created_at: string;
}

export interface ChildGrowthRecord {
  id: string;
  family_member_id: string;
  date: string;
  height_cm?: number;
  weight_kg?: number;
  vision_left?: number;
  vision_right?: number;
  subject_scores?: Record<string, number>;
  milestones?: string[];
  notes?: string;
  created_at: string;
}

// ===== Checkins / Habits =====
export interface CheckinHabit {
  id: string;
  user_id: string;
  name: string;
  category: "fitness" | "learning" | "health" | "work" | "other";
  source?: "keep" | "duolingo" | "beike" | "manual";
  target_days_per_week?: number;
  active: boolean;
  created_at: string;
}

export interface CheckinRecord {
  id: string;
  user_id: string;
  habit_id: string;
  date: string;
  completed: boolean;
  notes?: string;
  created_at: string;
}

// ===== Work =====
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type AlertLevel = "critical" | "warning" | "info";
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type AlertSource = "feishu" | "industry_platform" | "italent" | "system";

export interface Approval {
  id: string;
  user_id: string;
  title: string;
  applicant: string;
  source: "feishu" | "other";
  status: ApprovalStatus;
  amount?: number;
  reason?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  user_id: string;
  title: string;
  description: string;
  level: AlertLevel;
  source: AlertSource;
  resolved: boolean;
  created_at: string;
}

export interface WorkTask {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: "urgent" | "normal" | "low";
  assignee?: string;
  due_date?: string;
  source?: string;
  created_at: string;
  updated_at: string;
}

export interface KPIReport {
  id: string;
  user_id: string;
  name: string;
  value: number;
  unit: string;
  trend: "up" | "down" | "stable";
  change_percent?: number;
  period: "daily" | "weekly" | "monthly";
  source: string;
  created_at: string;
}

// ===== Content Aggregation =====
export type ContentPlatform = "bilibili" | "xiaohongshu" | "youtube";
export type ContentCategory =
  | "fashion"
  | "travel"
  | "food"
  | "health"
  | "skill"
  | "english"
  | "knowledge"
  | "other";

export interface ContentFeed {
  id: string;
  user_id: string;
  title: string;
  url: string;
  platform: ContentPlatform;
  author: string;
  summary?: string;
  thumbnail_url?: string;
  likes?: number;
  comments?: number;
  published_at: string;
  fetched_at: string;
}

export interface SavedContent {
  id: string;
  user_id: string;
  feed_id: string;
  category: ContentCategory;
  notes?: string;
  converted_to_knowledge: boolean;
  saved_at: string;
}

export interface KnowledgeItem {
  id: string;
  user_id: string;
  saved_content_id?: string;
  type: "checklist" | "quiz" | "action_plan" | "summary";
  title: string;
  content: Record<string, unknown>; // JSON structured content
  created_at: string;
}

export interface SubscriptionRule {
  id: string;
  user_id: string;
  platform: ContentPlatform;
  category: ContentCategory;
  keywords: string[];
  active: boolean;
  created_at: string;
}

// ===== Travel =====
export interface TravelPlan {
  id: string;
  user_id: string;
  destination: string;
  start_date: string;
  end_date: string;
  status: "planning" | "upcoming" | "in_progress" | "completed";
  itinerary?: Record<string, unknown>;
  checklist?: Record<string, unknown>;
  budget?: number;
  notes?: string;
  created_at: string;
}

// ===== System =====
export interface SystemIntegration {
  id: string;
  user_id: string;
  name: "feishu" | "industry_platform" | "italent" | "apple_health" | "keep" | "duolingo";
  connected: boolean;
  last_sync_at?: string;
  settings?: Record<string, unknown>;
  created_at: string;
}

// ===== Component Props =====
export interface SidebarNavItem {
  id: string;
  label: string;
  icon: string;
  section?: string;
  badge?: number;
  isNew?: boolean;
}

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  trend?: "up" | "down" | "stable";
  change?: string;
  href?: string;
}
