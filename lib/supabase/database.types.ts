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
      assignments: {
        Row: {
          assigned_by: string;
          created_at: string;
          curriculum_id: string;
          curriculum_version_id: string;
          description: string | null;
          due_at: string;
          id: string;
          organization_id: string;
          publish_at: string;
          status: "active" | "cancelled" | "closed" | "draft" | "scheduled";
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_by: string;
          created_at?: string;
          curriculum_id: string;
          curriculum_version_id: string;
          description?: string | null;
          due_at: string;
          id?: string;
          organization_id: string;
          publish_at: string;
          status?: "active" | "cancelled" | "closed" | "draft" | "scheduled";
          title: string;
          updated_at?: string;
        };
        Update: {
          description?: string | null;
          due_at?: string;
          publish_at?: string;
          status?: "active" | "cancelled" | "closed" | "draft" | "scheduled";
          title?: string;
        };
        Relationships: [];
      };
      assignment_audit_events: {
        Row: {
          action:
            | "ASSIGNMENT_ASSIGNED"
            | "ASSIGNMENT_CREATED"
            | "ASSIGNMENT_SUBMITTED"
            | "ASSIGNMENT_UPDATED";
          actor_id: string;
          assignment_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          organization_id: string;
        };
        Insert: {
          action:
            | "ASSIGNMENT_ASSIGNED"
            | "ASSIGNMENT_CREATED"
            | "ASSIGNMENT_SUBMITTED"
            | "ASSIGNMENT_UPDATED";
          actor_id: string;
          assignment_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          organization_id: string;
        };
        Update: never;
        Relationships: [];
      };
      assignment_classes: {
        Row: {
          assigned_at: string;
          assignment_id: string;
          class_id: string;
          organization_id: string;
        };
        Insert: {
          assigned_at?: string;
          assignment_id: string;
          class_id: string;
          organization_id: string;
        };
        Update: never;
        Relationships: [];
      };
      assignment_students: {
        Row: {
          assigned_at: string;
          assignment_id: string;
          opened_at: string | null;
          organization_id: string;
          status: "in_progress" | "not_started" | "overdue" | "submitted";
          student_id: string;
          submitted_at: string | null;
        };
        Insert: {
          assigned_at?: string;
          assignment_id: string;
          opened_at?: string | null;
          organization_id: string;
          status?: "in_progress" | "not_started" | "overdue" | "submitted";
          student_id: string;
          submitted_at?: string | null;
        };
        Update: {
          opened_at?: string | null;
          status?: "in_progress" | "not_started" | "overdue" | "submitted";
          submitted_at?: string | null;
        };
        Relationships: [];
      };
      assignment_submissions: {
        Row: {
          assignment_id: string;
          content: Json;
          created_at: string;
          id: string;
          organization_id: string;
          status: "draft" | "submitted";
          student_id: string;
          submitted_at: string | null;
          updated_at: string;
        };
        Insert: {
          assignment_id: string;
          content?: Json;
          created_at?: string;
          id?: string;
          organization_id: string;
          status?: "draft" | "submitted";
          student_id: string;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Update: {
          content?: Json;
          status?: "draft" | "submitted";
          submitted_at?: string | null;
        };
        Relationships: [];
      };
      chapters: {
        Row: {
          chapter_no: number;
          created_at: string;
          curriculum_version_id: string;
          description: string | null;
          id: string;
          order_no: number;
          status: "draft" | "active" | "archived";
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
          status?: "draft" | "active" | "archived";
          title: string;
          updated_at?: string;
        };
        Update: {
          chapter_no?: number;
          curriculum_version_id?: string;
          description?: string | null;
          order_no?: number;
          status?: "draft" | "active" | "archived";
          title?: string;
        };
        Relationships: [];
      };
      classes: {
        Row: {
          code: string;
          created_at: string;
          description: string | null;
          grade: string;
          id: string;
          name: string;
          organization_id: string;
          school_year: number;
          semester: 1 | 2;
          status: "active" | "archived" | "inactive";
          subject: string;
          teacher_id: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          description?: string | null;
          grade: string;
          id?: string;
          name: string;
          organization_id: string;
          school_year: number;
          semester: 1 | 2;
          status?: "active" | "archived" | "inactive";
          subject: string;
          teacher_id: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          description?: string | null;
          grade?: string;
          name?: string;
          school_year?: number;
          semester?: 1 | 2;
          status?: "active" | "archived" | "inactive";
          subject?: string;
          teacher_id?: string;
        };
        Relationships: [];
      };
      class_enrollments: {
        Row: {
          class_id: string;
          id: string;
          joined_at: string;
          left_at: string | null;
          organization_id: string;
          status: "active" | "inactive" | "left";
          student_id: string;
        };
        Insert: {
          class_id: string;
          id?: string;
          joined_at?: string;
          left_at?: string | null;
          organization_id: string;
          status?: "active" | "inactive" | "left";
          student_id: string;
        };
        Update: {
          left_at?: string | null;
          status?: "active" | "inactive" | "left";
        };
        Relationships: [];
      };
      classroom_audit_events: {
        Row: {
          action:
            | "CLASS_ARCHIVED"
            | "CLASS_CREATED"
            | "CLASS_UPDATED"
            | "ENROLLMENT_CREATED"
            | "ENROLLMENT_REMOVED";
          actor_id: string;
          class_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          organization_id: string;
        };
        Insert: {
          action:
            | "CLASS_ARCHIVED"
            | "CLASS_CREATED"
            | "CLASS_UPDATED"
            | "ENROLLMENT_CREATED"
            | "ENROLLMENT_REMOVED";
          actor_id: string;
          class_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          organization_id: string;
        };
        Update: never;
        Relationships: [];
      };
      curriculum_versions: {
        Row: {
          created_at: string;
          curriculum_id: string;
          id: string;
          published_at: string | null;
          remark: string | null;
          status: "draft" | "in_review" | "published" | "archived";
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          curriculum_id: string;
          id?: string;
          published_at?: string | null;
          remark?: string | null;
          status?: "draft" | "in_review" | "published" | "archived";
          updated_at?: string;
          version: number;
        };
        Update: {
          published_at?: string | null;
          remark?: string | null;
          status?: "draft" | "in_review" | "published" | "archived";
        };
        Relationships: [];
      };
      curriculums: {
        Row: {
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          deleted_by: string | null;
          deletion_reason: string | null;
          grade_id: string;
          id: string;
          name: string;
          organization_id: string;
          publisher_id: string;
          school_year: number;
          semester: 1 | 2;
          status: "draft" | "in_review" | "published" | "archived";
          subject_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          grade_id: string;
          id?: string;
          name: string;
          organization_id: string;
          publisher_id: string;
          school_year: number;
          semester: 1 | 2;
          status?: "draft" | "in_review" | "published" | "archived";
          subject_id: string;
          updated_at?: string;
        };
        Update: {
          deleted_at?: string | null;
          deleted_by?: string | null;
          deletion_reason?: string | null;
          grade_id?: string;
          name?: string;
          publisher_id?: string;
          school_year?: number;
          semester?: 1 | 2;
          status?: "draft" | "in_review" | "published" | "archived";
          subject_id?: string;
        };
        Relationships: [];
      };
      curriculum_lifecycle_audit_events: {
        Row: {
          action:
            | "CURRICULUM_ARCHIVED"
            | "CURRICULUM_AI_EDITED"
            | "CURRICULUM_AI_GENERATED"
            | "CURRICULUM_AI_SAVED"
            | "CURRICULUM_EXPORTED"
            | "CURRICULUM_PERMANENTLY_DELETED"
            | "CURRICULUM_PUBLISHED"
            | "CURRICULUM_RESTORED"
            | "CURRICULUM_REVIEWED"
            | "CURRICULUM_SOFT_DELETED"
            | "CURRICULUM_SUBMITTED";
          acting_role: string;
          actor_id: string;
          actor_type: "ACCOUNT";
          correlation_id: string;
          created_at: string;
          current_hash: string;
          curriculum_id: string;
          event_id: string;
          metadata: Json;
          occurred_at: string;
          organization_id: string;
          previous_hash: string | null;
          reason: string;
          request_id: string;
          result: "DENIED" | "FAILED" | "SUCCEEDED";
          state_after: string;
          state_before: string;
          version: number;
        };
        Insert: {
          action:
            | "CURRICULUM_ARCHIVED"
            | "CURRICULUM_AI_EDITED"
            | "CURRICULUM_AI_GENERATED"
            | "CURRICULUM_AI_SAVED"
            | "CURRICULUM_EXPORTED"
            | "CURRICULUM_PERMANENTLY_DELETED"
            | "CURRICULUM_PUBLISHED"
            | "CURRICULUM_RESTORED"
            | "CURRICULUM_REVIEWED"
            | "CURRICULUM_SOFT_DELETED"
            | "CURRICULUM_SUBMITTED";
          acting_role: string;
          actor_id: string;
          actor_type?: "ACCOUNT";
          correlation_id: string;
          created_at?: string;
          current_hash: string;
          curriculum_id: string;
          event_id: string;
          metadata?: Json;
          occurred_at: string;
          organization_id: string;
          previous_hash?: string | null;
          reason: string;
          request_id: string;
          result: "DENIED" | "FAILED" | "SUCCEEDED";
          state_after: string;
          state_before: string;
          version?: number;
        };
        Update: never;
        Relationships: [];
      };
      curriculum_ai_drafts: {
        Row: {
          client_request_id: string;
          content: Json;
          created_at: string;
          curriculum_id: string;
          curriculum_version_id: string;
          edited: boolean;
          generated_by: string;
          id: string;
          organization_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          client_request_id: string;
          content: Json;
          created_at?: string;
          curriculum_id: string;
          curriculum_version_id: string;
          edited?: boolean;
          generated_by: string;
          id?: string;
          organization_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          client_request_id?: string;
          content?: Json;
          edited?: boolean;
          title?: string;
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
          difficulty: number | null;
          estimated_minutes: number | null;
          id: string;
          keywords: string[];
          learning_objectives: string[];
          lesson_no: number;
          order_no: number;
          status: "draft" | "active" | "archived";
          teaching_notes: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          chapter_id: string;
          created_at?: string;
          difficulty?: number | null;
          estimated_minutes?: number | null;
          id?: string;
          keywords?: string[];
          learning_objectives?: string[];
          lesson_no: number;
          order_no: number;
          status?: "draft" | "active" | "archived";
          teaching_notes?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          difficulty?: number | null;
          estimated_minutes?: number | null;
          keywords?: string[];
          learning_objectives?: string[];
          lesson_no?: number;
          order_no?: number;
          status?: "draft" | "active" | "archived";
          teaching_notes?: string | null;
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
      create_chapter: {
        Args: {
          p_chapter_no: number;
          p_curriculum_version_id: string;
          p_description?: string | null;
          p_status?: "draft" | "active";
          p_title: string;
        };
        Returns: string;
      };
      create_curriculum_with_initial_version: {
        Args: {
          p_grade_id: string;
          p_name: string;
          p_publisher_id: string;
          p_school_year: number;
          p_semester: 1 | 2;
          p_status?: "draft";
          p_subject_id: string;
          p_version?: number;
          p_version_remark?: string | null;
        };
        Returns: string;
      };
      create_next_curriculum_version: {
        Args: { p_curriculum_id: string };
        Returns: string;
      };
      publish_curriculum: {
        Args: { p_curriculum_id: string };
        Returns: string;
      };
      reopen_curriculum_draft: {
        Args: { p_curriculum_id: string };
        Returns: string;
      };
      review_curriculum: {
        Args: { p_curriculum_id: string };
        Returns: string;
      };
      submit_curriculum_review: {
        Args: { p_curriculum_id: string };
        Returns: string;
      };
      create_ai_generated_curriculum_draft: {
        Args: {
          p_chapter_description: string | null;
          p_chapter_title: string;
          p_client_request_id: string;
          p_content: Json;
          p_difficulty: number;
          p_edited: boolean;
          p_grade_id: string;
          p_keywords: string[];
          p_learning_objectives: string[];
          p_lesson_title: string;
          p_name: string;
          p_publisher_id: string;
          p_school_year: number;
          p_semester: 1 | 2;
          p_subject_id: string;
          p_teaching_notes: string | null;
          p_version_remark: string | null;
        };
        Returns: Json;
      };
      archive_curriculum: {
        Args: { p_curriculum_id: string };
        Returns: string;
      };
      create_lesson: {
        Args: {
          p_chapter_id: string;
          p_estimated_minutes?: number | null;
          p_learning_objectives?: string[];
          p_lesson_no: number;
          p_status?: "draft" | "active";
          p_teaching_notes?: string | null;
          p_title: string;
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
      delete_chapter: {
        Args: { p_chapter_id: string };
        Returns: string;
      };
      delete_lesson: {
        Args: { p_lesson_id: string };
        Returns: string;
      };
      permanently_delete_curriculum: {
        Args: { p_curriculum_id: string };
        Returns: string;
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
      reorder_chapters: {
        Args: {
          p_curriculum_version_id: string;
          p_ordered_ids: string[];
        };
        Returns: string[];
      };
      reorder_lessons: {
        Args: { p_chapter_id: string; p_ordered_ids: string[] };
        Returns: string[];
      };
      restore_archived_curriculum: {
        Args: { p_curriculum_id: string };
        Returns: string;
      };
      restore_deleted_curriculum: {
        Args: { p_curriculum_id: string };
        Returns: string;
      };
      soft_delete_curriculum: {
        Args: { p_curriculum_id: string; p_reason?: string | null };
        Returns: string;
      };
      switch_active_organization: {
        Args: { p_organization_id: string };
        Returns: string;
      };
      update_chapter: {
        Args: {
          p_chapter_id: string;
          p_chapter_no: number;
          p_description?: string | null;
          p_status?: "draft" | "active";
          p_title: string;
        };
        Returns: string;
      };
      update_lesson: {
        Args: {
          p_estimated_minutes?: number | null;
          p_learning_objectives?: string[];
          p_lesson_id: string;
          p_lesson_no: number;
          p_status?: "draft" | "active";
          p_teaching_notes?: string | null;
          p_title: string;
        };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
