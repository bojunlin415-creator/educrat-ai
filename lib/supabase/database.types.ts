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
      assignment_recipient_classes: {
        Row: {
          assigned_at: string;
          assignment_id: string;
          class_id: string;
          membership_id: string;
          organization_id: string;
          recipient_id: string;
          student_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      assignment_recipient_legacy_compatibility: {
        Row: {
          assignment_id: string;
          created_at: string;
          legacy_student_id: string;
          organization_id: string;
          recipient_id: string;
          student_account_link_id: string;
          student_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      assignment_student_recipients: {
        Row: {
          assigned_at: string;
          assignment_id: string;
          id: string;
          identity_authority:
            "canonical" | "canonical_with_legacy_compatibility";
          organization_id: string;
          status: "in_progress" | "not_started" | "overdue" | "submitted";
          student_id: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      assignment_submission_canonical_ownerships: {
        Row: {
          assignment_id: string;
          created_at: string;
          identity_authority: "canonical_student";
          organization_id: string;
          recipient_id: string;
          student_id: string;
          submission_id: string;
        };
        Insert: never;
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
          school: string | null;
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
          school?: string | null;
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
          school?: string | null;
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
      students: {
        Row: {
          birthday: string | null;
          created_at: string;
          english_name: string | null;
          gender: "female" | "male" | "non_binary" | "undisclosed";
          grade: string;
          id: string;
          name: string;
          organization_id: string;
          school: string | null;
          status: "active" | "archived";
          student_no: string;
          updated_at: string;
        };
        Insert: {
          birthday?: string | null;
          created_at?: string;
          english_name?: string | null;
          gender: "female" | "male" | "non_binary" | "undisclosed";
          grade: string;
          id?: string;
          name: string;
          organization_id: string;
          school?: string | null;
          status?: "active" | "archived";
          student_no: string;
          updated_at?: string;
        };
        Update: {
          birthday?: string | null;
          english_name?: string | null;
          gender?: "female" | "male" | "non_binary" | "undisclosed";
          grade?: string;
          name?: string;
          school?: string | null;
          status?: "active" | "archived";
          student_no?: string;
        };
        Relationships: [];
      };
      student_class_members: {
        Row: {
          class_id: string;
          id: string;
          joined_at: string;
          left_at: string | null;
          organization_id: string;
          status: "active" | "left";
          student_id: string;
        };
        Insert: {
          class_id: string;
          id?: string;
          joined_at?: string;
          left_at?: string | null;
          organization_id: string;
          status?: "active" | "left";
          student_id: string;
        };
        Update: {
          joined_at?: string;
          left_at?: string | null;
          status?: "active" | "left";
        };
        Relationships: [];
      };
      student_account_links: {
        Row: {
          account_id: string;
          correlation_id: string;
          created_at: string;
          created_by: string;
          id: string;
          link_type:
            | "account_claim"
            | "admin_verified"
            | "manual_verified"
            | "migration_verified";
          organization_id: string;
          status: "active" | "expired" | "pending" | "revoked";
          student_id: string;
          updated_at: string;
          valid_from: string;
          valid_to: string | null;
          verified_at: string | null;
          version: "le-001.v1";
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      student_account_link_audit_events: {
        Row: {
          account_id: string;
          action:
            "STUDENT_ACCOUNT_LINK_CREATED" | "STUDENT_ACCOUNT_LINK_REVOKED";
          actor_id: string;
          correlation_id: string;
          created_at: string;
          id: string;
          link_id: string;
          metadata: Json;
          organization_id: string;
          student_id: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      class_student_audit_events: {
        Row: {
          action:
            | "CLASS_ARCHIVED"
            | "CLASS_CREATED"
            | "CLASS_RESTORED"
            | "CLASS_UPDATED"
            | "STUDENT_ARCHIVED"
            | "STUDENT_ASSIGNED"
            | "STUDENT_CREATED"
            | "STUDENT_REMOVED"
            | "STUDENT_RESTORED"
            | "STUDENT_UPDATED";
          actor_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          organization_id: string;
          target_id: string;
          target_type: "class" | "membership" | "student";
        };
        Insert: {
          action: Database["public"]["Tables"]["class_student_audit_events"]["Row"]["action"];
          actor_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          organization_id: string;
          target_id: string;
          target_type: "class" | "membership" | "student";
        };
        Update: never;
        Relationships: [];
      };
      learning_events: {
        Row: {
          answered_at: string;
          assignment_id: string;
          attempt_number: number;
          class_id: string;
          correct: boolean;
          created_at: string;
          curriculum_id: string;
          curriculum_version_id: string;
          difficulty: number;
          earned_score: number;
          grade: string;
          id: string;
          knowledge_point_id: string;
          learning_objective_id: string | null;
          max_score: number;
          organization_id: string;
          question_id: string;
          student_id: string;
          subject: string;
          submission_id: string;
          time_spent_seconds: number;
        };
        Insert: {
          answered_at: string;
          assignment_id: string;
          attempt_number: number;
          class_id: string;
          correct: boolean;
          created_at?: string;
          curriculum_id: string;
          curriculum_version_id: string;
          difficulty: number;
          earned_score: number;
          grade: string;
          id?: string;
          knowledge_point_id: string;
          learning_objective_id?: string | null;
          max_score: number;
          organization_id: string;
          question_id: string;
          student_id: string;
          subject: string;
          submission_id: string;
          time_spent_seconds: number;
        };
        Update: never;
        Relationships: [];
      };
      learning_audit_events: {
        Row: {
          action: "LEARNING_EVENT_CREATED" | "LEARNING_SUMMARY_VIEWED";
          actor_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          organization_id: string;
          student_id: string | null;
        };
        Insert: {
          action: "LEARNING_EVENT_CREATED" | "LEARNING_SUMMARY_VIEWED";
          actor_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          organization_id: string;
          student_id?: string | null;
        };
        Update: never;
        Relationships: [];
      };
      student_knowledge_mastery: {
        Row: {
          accuracy: number;
          attempt_count: number;
          correct_count: number;
          grade: string;
          id: string;
          incorrect_count: number;
          knowledge_point_id: string;
          last_answered_at: string;
          mastery_level:
            "beginner" | "developing" | "mastered" | "proficient" | "unknown";
          mastery_score: number;
          organization_id: string;
          student_id: string;
          subject: string;
          updated_at: string;
        };
        Insert: {
          accuracy?: number;
          attempt_count?: number;
          correct_count?: number;
          grade: string;
          id?: string;
          incorrect_count?: number;
          knowledge_point_id: string;
          last_answered_at: string;
          mastery_level?:
            "beginner" | "developing" | "mastered" | "proficient" | "unknown";
          mastery_score?: number;
          organization_id: string;
          student_id: string;
          subject: string;
          updated_at?: string;
        };
        Update: {
          accuracy?: number;
          attempt_count?: number;
          correct_count?: number;
          grade?: string;
          incorrect_count?: number;
          knowledge_point_id?: string;
          last_answered_at?: string;
          mastery_level?:
            "beginner" | "developing" | "mastered" | "proficient" | "unknown";
          mastery_score?: number;
          subject?: string;
        };
        Relationships: [];
      };
      student_subject_summary: {
        Row: {
          accuracy: number;
          average_score: number;
          grade: string;
          id: string;
          knowledge_count: number;
          last_activity: string;
          mastery_distribution: Json;
          organization_id: string;
          question_count: number;
          student_id: string;
          subject: string;
          updated_at: string;
        };
        Insert: {
          accuracy?: number;
          average_score?: number;
          grade: string;
          id?: string;
          knowledge_count?: number;
          last_activity: string;
          mastery_distribution?: Json;
          organization_id: string;
          question_count?: number;
          student_id: string;
          subject: string;
          updated_at?: string;
        };
        Update: {
          accuracy?: number;
          average_score?: number;
          grade?: string;
          knowledge_count?: number;
          last_activity?: string;
          mastery_distribution?: Json;
          question_count?: number;
          subject?: string;
        };
        Relationships: [];
      };
      teacher_class_summary: {
        Row: {
          accuracy: number;
          activity_trend: Json;
          class_id: string;
          grade: string;
          id: string;
          knowledge_distribution: Json;
          last_activity: string;
          organization_id: string;
          question_count: number;
          student_count: number;
          subject: string;
          teacher_id: string;
          updated_at: string;
          weak_knowledge_ranking: Json;
        };
        Insert: {
          accuracy?: number;
          activity_trend?: Json;
          class_id: string;
          grade: string;
          id?: string;
          knowledge_distribution?: Json;
          last_activity: string;
          organization_id: string;
          question_count?: number;
          student_count?: number;
          subject: string;
          teacher_id: string;
          updated_at?: string;
          weak_knowledge_ranking?: Json;
        };
        Update: {
          accuracy?: number;
          activity_trend?: Json;
          grade?: string;
          knowledge_distribution?: Json;
          last_activity?: string;
          question_count?: number;
          student_count?: number;
          subject?: string;
          teacher_id?: string;
          weak_knowledge_ranking?: Json;
        };
        Relationships: [];
      };
      learning_recommendations: {
        Row: {
          created_at: string;
          grade: string;
          id: string;
          knowledge_point_id: string;
          organization_id: string;
          reason: string;
          recommended_curriculum_type: "advanced" | "remedial";
          recommended_difficulty: "easy" | "hard" | "normal";
          recommended_question_count: number;
          student_id: string;
          subject: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          grade: string;
          id?: string;
          knowledge_point_id: string;
          organization_id: string;
          reason: string;
          recommended_curriculum_type: "advanced" | "remedial";
          recommended_difficulty: "easy" | "hard" | "normal";
          recommended_question_count: number;
          student_id: string;
          subject: string;
          updated_at?: string;
        };
        Update: {
          reason?: string;
          recommended_curriculum_type?: "advanced" | "remedial";
          recommended_difficulty?: "easy" | "hard" | "normal";
          recommended_question_count?: number;
        };
        Relationships: [];
      };
      learning_paths: {
        Row: {
          created_at: string;
          current_knowledge_point_id: string;
          grade: string;
          id: string;
          next_step: string;
          organization_id: string;
          recommended_ability: string;
          recommended_curriculum: string;
          student_id: string;
          subject: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          current_knowledge_point_id: string;
          grade: string;
          id?: string;
          next_step: string;
          organization_id: string;
          recommended_ability: string;
          recommended_curriculum: string;
          student_id: string;
          subject: string;
          updated_at?: string;
        };
        Update: {
          next_step?: string;
          recommended_ability?: string;
          recommended_curriculum?: string;
        };
        Relationships: [];
      };
      learning_recommendation_audit_events: {
        Row: {
          action: "LEARNING_PATH_VIEWED" | "LEARNING_RECOMMENDATION_CREATED";
          actor_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          organization_id: string;
          student_id: string;
        };
        Insert: {
          action: "LEARNING_PATH_VIEWED" | "LEARNING_RECOMMENDATION_CREATED";
          actor_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          organization_id: string;
          student_id: string;
        };
        Update: never;
        Relationships: [];
      };
      report_audit_events: {
        Row: {
          action: "REPORT_EXPORTED" | "REPORT_VIEWED";
          actor_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          organization_id: string;
        };
        Insert: {
          action: "REPORT_EXPORTED" | "REPORT_VIEWED";
          actor_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          organization_id: string;
        };
        Update: never;
        Relationships: [];
      };
      report_cache: {
        Row: {
          expires_at: string | null;
          generated_at: string;
          id: string;
          organization_id: string;
          payload: Json;
          report_type: "organization" | "student" | "teacher";
          scope_key: string;
        };
        Insert: {
          expires_at?: string | null;
          generated_at?: string;
          id?: string;
          organization_id: string;
          payload?: Json;
          report_type: "organization" | "student" | "teacher";
          scope_key: string;
        };
        Update: {
          expires_at?: string | null;
          generated_at?: string;
          payload?: Json;
        };
        Relationships: [];
      };
      parent_portal_audit_events: {
        Row: {
          action:
            | "GUARDIAN_CONSENT_GRANTED"
            | "GUARDIAN_INVITATION_ACCEPTED"
            | "GUARDIAN_INVITATION_CREATED"
            | "GUARDIAN_RELATIONSHIP_CREATED"
            | "GUARDIAN_RELATIONSHIP_REVOKED"
            | "PARENT_DASHBOARD_VIEWED"
            | "PARENT_STUDENT_REPORT_VIEWED";
          actor_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          organization_id: string;
        };
        Insert: {
          action:
            | "GUARDIAN_CONSENT_GRANTED"
            | "GUARDIAN_INVITATION_ACCEPTED"
            | "GUARDIAN_INVITATION_CREATED"
            | "GUARDIAN_RELATIONSHIP_CREATED"
            | "GUARDIAN_RELATIONSHIP_REVOKED"
            | "PARENT_DASHBOARD_VIEWED"
            | "PARENT_STUDENT_REPORT_VIEWED";
          actor_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          organization_id: string;
        };
        Update: never;
        Relationships: [];
      };
      access_control_audit_events: {
        Row: {
          action:
            | "ACCESS_SETTINGS_VIEWED"
            | "MEMBER_DISABLED"
            | "MEMBER_ENABLED"
            | "ROLE_ASSIGNED"
            | "ROLE_CONTEXT_SWITCHED"
            | "ROLE_REMOVED";
          actor_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          organization_id: string;
          target_membership_id: string | null;
        };
        Insert: {
          action:
            | "ACCESS_SETTINGS_VIEWED"
            | "MEMBER_DISABLED"
            | "MEMBER_ENABLED"
            | "ROLE_ASSIGNED"
            | "ROLE_CONTEXT_SWITCHED"
            | "ROLE_REMOVED";
          actor_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          organization_id: string;
          target_membership_id?: string | null;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "access_control_audit_events_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "access_control_audit_events_target_membership_id_fkey";
            columns: ["target_membership_id"];
            isOneToOne: false;
            referencedRelation: "organization_members";
            referencedColumns: ["id"];
          },
        ];
      };
      guardian_invitations: {
        Row: {
          accepted_at: string | null;
          consent_version: string | null;
          consumed_by_account_id: string | null;
          created_at: string;
          created_by: string;
          expires_at: string;
          guardian_email_normalized: string;
          id: string;
          organization_id: string;
          relationship_type:
            | "authorized_caregiver"
            | "legal_guardian"
            | "other_verified_guardian"
            | "parent";
          status: "accepted" | "expired" | "pending" | "revoked";
          student_id: string;
          token_hash: string;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          consent_version?: string | null;
          consumed_by_account_id?: string | null;
          created_at?: string;
          created_by: string;
          expires_at: string;
          guardian_email_normalized: string;
          id?: string;
          organization_id: string;
          relationship_type:
            | "authorized_caregiver"
            | "legal_guardian"
            | "other_verified_guardian"
            | "parent";
          status?: "accepted" | "expired" | "pending" | "revoked";
          student_id: string;
          token_hash: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          consent_version?: string | null;
          consumed_by_account_id?: string | null;
          status?: "accepted" | "expired" | "pending" | "revoked";
        };
        Relationships: [
          {
            foreignKeyName: "guardian_invitations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "guardian_invitations_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      student_guardians: {
        Row: {
          activated_at: string | null;
          activated_by: string | null;
          consent_granted_at: string | null;
          consent_version: string | null;
          created_at: string;
          expires_at: string | null;
          guardian_account_id: string;
          guardian_user_id: string;
          id: string;
          organization_id: string;
          relationship_type:
            | "authorized_caregiver"
            | "legal_guardian"
            | "other_verified_guardian"
            | "parent";
          requested_at: string;
          requested_by: string | null;
          revocation_reason: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          status: "active" | "pending" | "revoked" | "verified";
          student_id: string;
          updated_at: string;
          verified_at: string | null;
          verified_by: string | null;
          verification_method: string | null;
        };
        Insert: {
          activated_at?: string | null;
          activated_by?: string | null;
          consent_granted_at?: string | null;
          consent_version?: string | null;
          created_at?: string;
          expires_at?: string | null;
          guardian_account_id: string;
          guardian_user_id: string;
          id?: string;
          organization_id: string;
          relationship_type:
            | "authorized_caregiver"
            | "legal_guardian"
            | "other_verified_guardian"
            | "parent";
          requested_at?: string;
          requested_by?: string | null;
          revocation_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          status?: "active" | "pending" | "revoked" | "verified";
          student_id: string;
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
          verification_method?: string | null;
        };
        Update: {
          activated_at?: string | null;
          activated_by?: string | null;
          consent_granted_at?: string | null;
          consent_version?: string | null;
          expires_at?: string | null;
          relationship_type?:
            | "authorized_caregiver"
            | "legal_guardian"
            | "other_verified_guardian"
            | "parent";
          requested_at?: string;
          requested_by?: string | null;
          revocation_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          status?: "active" | "pending" | "revoked" | "verified";
          verified_at?: string | null;
          verified_by?: string | null;
          verification_method?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "student_guardians_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_guardians_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_dashboard_audit_events: {
        Row: {
          action: "TEACHER_DASHBOARD_VIEWED" | "TEACHING_INSIGHT_VIEWED";
          actor_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          organization_id: string;
        };
        Insert: {
          action: "TEACHER_DASHBOARD_VIEWED" | "TEACHING_INSIGHT_VIEWED";
          actor_id: string;
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
      add_assignment_canonical_recipients: {
        Args: {
          p_assignment_id: string;
          p_class_ids: string[];
          p_direct_student_ids: string[];
          p_expected_class_student_ids: string[];
          p_write_legacy_compatibility: boolean;
        };
        Returns: Json;
      };
      can_authenticated_access_assignment: {
        Args: {
          p_assigned_by: string;
          p_assignment_id: string;
          p_organization_id: string;
        };
        Returns: boolean;
      };
      can_authenticated_read_assignment_submission: {
        Args: {
          p_assignment_id: string;
          p_legacy_student_id: string;
          p_organization_id: string;
          p_submission_id: string;
        };
        Returns: boolean;
      };
      can_authenticated_read_legacy_assignment_recipient: {
        Args: {
          p_assignment_id: string;
          p_legacy_student_id: string;
          p_organization_id: string;
        };
        Returns: boolean;
      };
      accept_guardian_invitation: {
        Args: { p_consent_version: string; p_token_hash: string };
        Returns: string;
      };
      assign_organization_member_role: {
        Args: { p_membership_id: string; p_reason: string; p_role: string };
        Returns: string;
      };
      create_verified_student_account_link: {
        Args: {
          p_account_id: string;
          p_correlation_id?: string;
          p_link_type: string;
          p_student_id: string;
        };
        Returns: string;
      };
      create_assignment_with_canonical_recipients: {
        Args: {
          p_class_ids: string[];
          p_curriculum_id: string;
          p_curriculum_version_id: string;
          p_description: string;
          p_direct_student_ids: string[];
          p_due_at: string;
          p_expected_class_student_ids: string[];
          p_publish_at: string;
          p_title: string;
          p_write_legacy_compatibility: boolean;
        };
        Returns: string;
      };
      get_assignment_recipient_projection: {
        Args: { p_assignment_id: string };
        Returns: {
          assigned_at: string;
          assignment_id: string;
          canonical_student_id: string | null;
          identity_authority:
            | "CANONICAL"
            | "CANONICAL_WITH_LEGACY_COMPATIBILITY"
            | "LEGACY_ONLY_HISTORICAL";
          recipient_id: string | null;
          recipient_status:
            "in_progress" | "not_started" | "overdue" | "submitted";
          source_class_ids: string[];
        }[];
      };
      get_authenticated_student_assignment_recipients: {
        Args: { p_assignment_id?: string | null };
        Returns: {
          assigned_at: string;
          assignment_id: string;
          canonical_student_id: string | null;
          identity_authority:
            | "CANONICAL"
            | "CANONICAL_WITH_LEGACY_COMPATIBILITY"
            | "LEGACY_ONLY_HISTORICAL";
          recipient_id: string | null;
          recipient_status:
            "in_progress" | "not_started" | "overdue" | "submitted";
          source_class_ids: string[];
        }[];
      };
      get_learner_convergence_snapshot: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      is_authenticated_canonical_assignment_recipient: {
        Args: {
          p_assignment_id: string;
          p_organization_id: string;
        };
        Returns: boolean;
      };
      persist_authenticated_student_submission: {
        Args: {
          p_assignment_id: string;
          p_content: Json;
          p_submit: boolean;
          p_use_canonical_identity: boolean;
        };
        Returns: Json;
      };
      resolve_canonical_student_for_authenticated_account: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      save_authenticated_student_submission: {
        Args: {
          p_assignment_id: string;
          p_content: Json;
          p_submit: boolean;
        };
        Returns: Json;
      };
      save_legacy_authenticated_student_submission: {
        Args: {
          p_assignment_id: string;
          p_content: Json;
          p_submit: boolean;
        };
        Returns: Json;
      };
      revoke_student_account_link: {
        Args: {
          p_correlation_id?: string;
          p_link_id: string;
          p_reason_code: string;
        };
        Returns: string;
      };
      revoke_guardian_relationship: {
        Args: { p_reason: string; p_relationship_id: string };
        Returns: string;
      };
      remove_organization_member_role: {
        Args: { p_membership_id: string; p_reason: string };
        Returns: string;
      };
      set_organization_member_access_status: {
        Args: {
          p_membership_id: string;
          p_reason: string;
          p_status: string;
        };
        Returns: string;
      };
      write_access_control_audit: {
        Args: {
          p_action: string;
          p_actor_id: string;
          p_metadata?: Json;
          p_organization_id: string;
          p_target_membership_id?: string | null;
        };
        Returns: string;
      };
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
