export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      chapters: {
        Row: {
          chapter_no: number;
          created_at: string;
          curriculum_version_id: string;
          description: string | null;
          id: string;
          order_no: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          chapter_no: number;
          created_at?: string;
          curriculum_version_id: string;
          description?: string | null;
          id?: string;
          order_no: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          chapter_no?: number;
          curriculum_version_id?: string;
          description?: string | null;
          order_no?: number;
          title?: string;
        };
        Relationships: [];
      };
      curriculum_versions: {
        Row: {
          created_at: string;
          curriculum_id: string;
          id: string;
          published_at: string | null;
          remark: string | null;
          status: "draft" | "published" | "archived";
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          curriculum_id: string;
          id?: string;
          published_at?: string | null;
          remark?: string | null;
          status?: "draft" | "published" | "archived";
          updated_at?: string;
          version: number;
        };
        Update: {
          published_at?: string | null;
          remark?: string | null;
          status?: "draft" | "published" | "archived";
        };
        Relationships: [];
      };
      curriculums: {
        Row: {
          created_at: string;
          created_by: string;
          grade_id: string;
          id: string;
          name: string;
          organization_id: string;
          publisher_id: string;
          school_year: number;
          semester: 1 | 2;
          status: "draft" | "active" | "archived";
          subject_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          grade_id: string;
          id?: string;
          name: string;
          organization_id: string;
          publisher_id: string;
          school_year: number;
          semester: 1 | 2;
          status?: "draft" | "active" | "archived";
          subject_id: string;
          updated_at?: string;
        };
        Update: {
          grade_id?: string;
          name?: string;
          publisher_id?: string;
          school_year?: number;
          semester?: 1 | 2;
          status?: "draft" | "active" | "archived";
          subject_id?: string;
        };
        Relationships: [];
      };
      grades: {
        Row: {
          code: string;
          created_at: string;
          display_order: number;
          id: string;
          name: string;
          status: "active" | "inactive";
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          display_order: number;
          id?: string;
          name: string;
          status?: "active" | "inactive";
          updated_at?: string;
        };
        Update: {
          code?: string;
          display_order?: number;
          name?: string;
          status?: "active" | "inactive";
        };
        Relationships: [];
      };
      lessons: {
        Row: {
          chapter_id: string;
          created_at: string;
          estimated_minutes: number | null;
          id: string;
          learning_objectives: string[];
          lesson_no: number;
          order_no: number;
          status: "draft" | "active" | "archived";
          title: string;
          updated_at: string;
        };
        Insert: {
          chapter_id: string;
          created_at?: string;
          estimated_minutes?: number | null;
          id?: string;
          learning_objectives?: string[];
          lesson_no: number;
          order_no: number;
          status?: "draft" | "active" | "archived";
          title: string;
          updated_at?: string;
        };
        Update: {
          estimated_minutes?: number | null;
          learning_objectives?: string[];
          lesson_no?: number;
          order_no?: number;
          status?: "draft" | "active" | "archived";
          title?: string;
        };
        Relationships: [];
      };
      organization_members: {
        Row: {
          created_at: string;
          id: string;
          joined_at: string | null;
          organization_id: string;
          role:
            | "organization_owner"
            | "organization_admin"
            | "teacher"
            | "reviewer"
            | "branch_manager"
            | "student"
            | "guardian";
          status: "active" | "invited" | "suspended" | "removed";
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          joined_at?: string | null;
          organization_id: string;
          role:
            | "organization_owner"
            | "organization_admin"
            | "teacher"
            | "reviewer"
            | "branch_manager"
            | "student"
            | "guardian";
          status: "active" | "invited" | "suspended" | "removed";
          updated_at?: string;
          user_id: string;
        };
        Update: {
          joined_at?: string | null;
          organization_id?: string;
          role?:
            | "organization_owner"
            | "organization_admin"
            | "teacher"
            | "reviewer"
            | "branch_manager"
            | "student"
            | "guardian";
          status?: "active" | "invited" | "suspended" | "removed";
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          address: string | null;
          business_name: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          email: string | null;
          id: string;
          logo_path: string | null;
          name: string;
          phone: string | null;
          slug: string;
          status: "active" | "suspended" | "archived";
          tax_id: string | null;
          updated_at: string;
        };
        Insert: {
          address?: string | null;
          business_name?: string | null;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          logo_path?: string | null;
          name: string;
          phone?: string | null;
          slug: string;
          status?: "active" | "suspended" | "archived";
          tax_id?: string | null;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          business_name?: string | null;
          email?: string | null;
          name?: string;
          phone?: string | null;
          tax_id?: string | null;
        };
        Relationships: [];
      };
      publishers: {
        Row: {
          code: string;
          created_at: string;
          display_order: number;
          id: string;
          name: string;
          status: "active" | "inactive";
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          display_order: number;
          id?: string;
          name: string;
          status?: "active" | "inactive";
          updated_at?: string;
        };
        Update: {
          code?: string;
          display_order?: number;
          name?: string;
          status?: "active" | "inactive";
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string | null;
          id: string;
          locale: string;
          onboarding_completed: boolean;
          phone: string | null;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string | null;
          id: string;
          locale?: string;
          onboarding_completed?: boolean;
          phone?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          display_name?: string | null;
          locale?: string;
          onboarding_completed?: boolean;
          phone?: string | null;
          timezone?: string;
        };
        Relationships: [];
      };
      subjects: {
        Row: {
          code: string;
          created_at: string;
          display_order: number;
          id: string;
          name: string;
          status: "active" | "inactive";
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          display_order: number;
          id?: string;
          name: string;
          status?: "active" | "inactive";
          updated_at?: string;
        };
        Update: {
          code?: string;
          display_order?: number;
          name?: string;
          status?: "active" | "inactive";
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          active_organization_id: string | null;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          active_organization_id?: string | null;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active_organization_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "user_preferences_active_organization_id_fkey";
            columns: ["active_organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_curriculum_with_initial_version: {
        Args: {
          p_grade_id: string;
          p_name: string;
          p_publisher_id: string;
          p_school_year: number;
          p_semester: 1 | 2;
          p_status?: "draft" | "active";
          p_subject_id: string;
          p_version?: number;
          p_version_remark?: string | null;
        };
        Returns: string;
      };
      create_organization_with_owner: {
        Args: {
          p_address?: string | null;
          p_business_name?: string | null;
          p_email?: string | null;
          p_name: string;
          p_phone?: string | null;
          p_slug: string;
        };
        Returns: string;
      };
      database_health: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      get_active_organization_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
      has_organization_role: {
        Args: { p_organization_id: string; p_roles: string[] };
        Returns: boolean;
      };
      is_active_organization_member: {
        Args: { p_organization_id: string };
        Returns: boolean;
      };
      switch_active_organization: {
        Args: { p_organization_id: string };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
