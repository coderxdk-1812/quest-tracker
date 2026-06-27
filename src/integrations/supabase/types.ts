export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      daily_quests: {
        Row: {
          baselines: Json
          claimed: Json
          created_at: string
          expires_at: string
          generated_at: string
          id: string
          quests: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          baselines?: Json
          claimed?: Json
          created_at?: string
          expires_at: string
          generated_at?: string
          id?: string
          quests?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          baselines?: Json
          claimed?: Json
          created_at?: string
          expires_at?: string
          generated_at?: string
          id?: string
          quests?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      game_state: {
        Row: {
          active_boosts: Json
          active_theme: string
          ai_tokens_used: number
          coins: number
          created_at: string
          dark_mode: boolean
          earned_badges: string[]
          equipped_badge: string | null
          focus_sessions_completed: number
          last_active_date: string | null
          level: number
          purchased_items: string[]
          streak: number
          streak_freezes: number
          total_tasks_completed: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          active_boosts?: Json
          active_theme?: string
          ai_tokens_used?: number
          coins?: number
          created_at?: string
          dark_mode?: boolean
          earned_badges?: string[]
          equipped_badge?: string | null
          focus_sessions_completed?: number
          last_active_date?: string | null
          level?: number
          purchased_items?: string[]
          streak?: number
          streak_freezes?: number
          total_tasks_completed?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          active_boosts?: Json
          active_theme?: string
          ai_tokens_used?: number
          coins?: number
          created_at?: string
          dark_mode?: boolean
          earned_badges?: string[]
          equipped_badge?: string | null
          focus_sessions_completed?: number
          last_active_date?: string | null
          level?: number
          purchased_items?: string[]
          streak?: number
          streak_freezes?: number
          total_tasks_completed?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_aura: string | null
          active_theme: string
          avatar_url: string | null
          created_at: string
          custom_title: string | null
          dark_mode: boolean
          display_name: string | null
          earned_badges: string[]
          equipped_badge: string | null
          id: string
          purchased_items: string[]
          show_badges: boolean
          show_level: boolean
          show_streak: boolean
          show_tasks_completed: boolean
          show_xp: boolean
          updated_at: string
          user_id: string | null
          username: string | null
        }
        Insert: {
          active_aura?: string | null
          active_theme?: string
          avatar_url?: string | null
          created_at?: string
          custom_title?: string | null
          dark_mode?: boolean
          display_name?: string | null
          earned_badges?: string[]
          equipped_badge?: string | null
          id: string
          purchased_items?: string[]
          show_badges?: boolean
          show_level?: boolean
          show_streak?: boolean
          show_tasks_completed?: boolean
          show_xp?: boolean
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Update: {
          active_aura?: string | null
          active_theme?: string
          avatar_url?: string | null
          created_at?: string
          custom_title?: string | null
          dark_mode?: boolean
          display_name?: string | null
          earned_badges?: string[]
          equipped_badge?: string | null
          id?: string
          purchased_items?: string[]
          show_badges?: boolean
          show_level?: boolean
          show_streak?: boolean
          show_tasks_completed?: boolean
          show_xp?: boolean
          updated_at?: string
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          coins_granted: number
          completed_at: string
          completed_on: string
          created_at: string
          id: string
          reversed: boolean
          task_id: string | null
          user_id: string
          xp_granted: number
        }
        Insert: {
          coins_granted?: number
          completed_at?: string
          completed_on?: string
          created_at?: string
          id?: string
          reversed?: boolean
          task_id?: string | null
          user_id: string
          xp_granted?: number
        }
        Update: {
          coins_granted?: number
          completed_at?: string
          completed_on?: string
          created_at?: string
          id?: string
          reversed?: boolean
          task_id?: string | null
          user_id?: string
          xp_granted?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          completed: boolean
          completed_at: string | null
          created_at: string
          deadline: string | null
          description: string | null
          id: string
          priority: string
          subject: string | null
          subject_color: string | null
          tags: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: string
          subject?: string | null
          subject_color?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          id?: string
          priority?: string
          subject?: string | null
          subject_color?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      timetable_entries: {
        Row: {
          created_at: string
          day: number | null
          days: number[]
          end_time: string
          id: string
          is_recurring: boolean
          room: string | null
          specific_date: string | null
          start_time: string
          subject: string
          subject_color: string | null
          teacher: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day?: number | null
          days?: number[]
          end_time: string
          id?: string
          is_recurring?: boolean
          room?: string | null
          specific_date?: string | null
          start_time: string
          subject: string
          subject_color?: string | null
          teacher?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day?: number | null
          days?: number[]
          end_time?: string
          id?: string
          is_recurring?: boolean
          room?: string | null
          specific_date?: string | null
          start_time?: string
          subject?: string
          subject_color?: string | null
          teacher?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
