import { z } from "zod";

export const teacherDashboardQuerySchema = z
  .object({
    classId: z.uuid().optional(),
  })
  .strict();

export const teacherDashboardStudentsQuerySchema = z
  .object({
    classId: z.uuid().optional(),
    ranking: z
      .enum([
        "highest_accuracy",
        "highest_activity",
        "most_improved",
        "needs_attention",
      ])
      .optional(),
  })
  .strict();

export type TeacherDashboardQuery = z.infer<typeof teacherDashboardQuerySchema>;
export type TeacherDashboardStudentsQuery = z.infer<
  typeof teacherDashboardStudentsQuerySchema
>;
