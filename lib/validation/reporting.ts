import { z } from "zod";

export const studentReportQuerySchema = z
  .object({
    studentId: z.uuid().optional(),
  })
  .strict();

export const teacherReportQuerySchema = z
  .object({
    classId: z.uuid(),
  })
  .strict();

export const organizationReportQuerySchema = z.object({}).strict();

export type OrganizationReportQuery = z.infer<
  typeof organizationReportQuerySchema
>;
export type StudentReportQuery = z.infer<typeof studentReportQuerySchema>;
export type TeacherReportQuery = z.infer<typeof teacherReportQuerySchema>;
