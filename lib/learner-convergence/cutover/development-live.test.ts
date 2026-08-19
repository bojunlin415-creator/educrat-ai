import { createClient } from "@supabase/supabase-js";
import { learnerParitySnapshotSchema } from "@/lib/learner-convergence/application/validation";
import { evaluatePhase4DevelopmentReadiness } from "@/lib/learner-convergence/cutover/development-readiness";
import { analyzeLearnerShadowSuite } from "@/lib/learner-convergence/shadow/analyze";

const liveDescribe =
  process.env.LEARNER_CONVERGENCE_LIVE_VERIFY === "1"
    ? describe
    : describe.skip;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing_environment:${name}`);
  return value;
}

liveDescribe("LE-001 Phase 5 Development cutover readiness", () => {
  it("evaluates current read-only Phase 4 evidence without promotion", async () => {
    const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const supabase = createClient(
      supabaseUrl,
      requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const email = requiredEnvironment("E2E_AUTH_EMAIL");
    const passwords = [
      process.env.E2E_AUTH_PASSWORD,
      process.env.E2E_AUTH_NEW_PASSWORD,
    ].filter((value): value is string => Boolean(value?.trim()));
    let authenticated = false;
    for (const password of passwords) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!error) {
        authenticated = true;
        break;
      }
    }
    if (!authenticated) throw new Error("development_auth_failed");

    try {
      const { data, error } = await supabase.rpc(
        "get_learner_convergence_snapshot",
      );
      if (error) {
        throw new Error(`snapshot_rpc_failed:${error.code ?? "unknown"}`);
      }
      const snapshot = learnerParitySnapshotSchema.parse(data);
      const [assignmentScope, adaptiveScope] = await Promise.all([
        supabase
          .from("assignment_classes")
          .select("class_id")
          .eq("organization_id", snapshot.organizationId),
        supabase
          .from("learning_recommendations")
          .select("student_id")
          .eq("organization_id", snapshot.organizationId),
      ]);
      if (assignmentScope.error) {
        throw new Error(
          `assignment_scope_query_failed:${assignmentScope.error.code ?? "unknown"}`,
        );
      }
      if (adaptiveScope.error) {
        throw new Error(
          `adaptive_scope_query_failed:${adaptiveScope.error.code ?? "unknown"}`,
        );
      }
      const phase4 = analyzeLearnerShadowSuite({
        adaptiveLegacyAccountIds: [
          ...new Set(adaptiveScope.data.map((row) => row.student_id)),
        ],
        assignmentClassIds: [
          ...new Set(assignmentScope.data.map((row) => row.class_id)),
        ],
        snapshot,
      });
      const readiness = evaluatePhase4DevelopmentReadiness(phase4);
      const projectRef = new URL(supabaseUrl).hostname.split(".")[0];

      console.info(
        "[learner-cutover-readiness-live]",
        JSON.stringify({
          baseline: {
            canonicalEnrollments: snapshot.canonicalEnrollments.length,
            canonicalStudents: snapshot.canonicalStudents.length,
            legacyEnrollments: snapshot.legacyEnrollments.length,
            verifiedAccountLinks: snapshot.accountLinks.filter(
              (link) => link.status === "active",
            ).length,
          },
          matrix: readiness.map((result) => ({
            blockers: result.blockingReasons,
            consumer: result.consumer,
            readiness: result.readiness,
          })),
          projectRef,
        }),
      );

      expect(projectRef).toBe("gqurnljrvwyhruhutvni");
      expect(readiness).toHaveLength(11);
      expect(
        readiness.every(
          (result) =>
            ![
              "CANONICAL_PRIMARY",
              "CUTOVER_READY",
              "DUAL_READ_READY",
              "DUAL_WRITE_READY",
              "LEGACY_FROZEN",
              "SHADOW_STABLE",
            ].includes(result.readiness),
        ),
      ).toBe(true);
    } finally {
      await supabase.auth.signOut();
    }
  }, 30_000);
});
