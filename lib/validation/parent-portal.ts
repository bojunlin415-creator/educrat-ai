import { z } from "zod";

export const parentStudentIdSchema = z.object({
  studentId: z.string().uuid(),
});

export const parentDashboardQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
});

export type ParentDashboardQuery = z.infer<typeof parentDashboardQuerySchema>;
export type ParentStudentIdInput = z.infer<typeof parentStudentIdSchema>;
