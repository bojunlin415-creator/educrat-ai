import { createClient } from "@supabase/supabase-js";
import { learnerParitySnapshotSchema } from "@/lib/learner-convergence/application/validation";
import { compareClassRosterAuthorities } from "@/lib/learner-convergence/class-roster/parity";

const liveDescribe =
  process.env.LEARNER_CLASS_ROSTER_LIVE_VERIFY === "1"
    ? describe
    : describe.skip;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing_environment:${name}`);
  return value;
}

liveDescribe("LE-001 Phase 5A Development Class roster evidence", () => {
  it("verifies canonical-only managed records without leaking learner data", async () => {
    const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const supabase = createClient(
      supabaseUrl,
      requiredEnvironment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const passwords = [
      process.env.E2E_AUTH_PASSWORD,
      process.env.E2E_AUTH_NEW_PASSWORD,
    ].filter((value): value is string => Boolean(value?.trim()));
    let authenticated = false;
    for (const password of passwords) {
      const { error } = await supabase.auth.signInWithPassword({
        email: requiredEnvironment("E2E_AUTH_EMAIL"),
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
      const classIds = [
        ...new Set([
          ...snapshot.canonicalEnrollments.map((entry) => entry.classId),
          ...snapshot.legacyEnrollments.map((entry) => entry.classId),
        ]),
      ];
      const metrics = compareClassRosterAuthorities({ classIds, snapshot });
      const { data: activeMemberships, error: activeMembershipError } =
        await supabase
          .from("student_class_members")
          .select("id,class_id,student_id,organization_id,status")
          .eq("organization_id", snapshot.organizationId)
          .eq("status", "active");
      if (activeMembershipError) {
        throw new Error(
          `canonical_roster_query_failed:${activeMembershipError.code ?? "unknown"}`,
        );
      }
      const projectRef = new URL(supabaseUrl).hostname.split(".")[0];

      console.info(
        "[class-roster-live]",
        JSON.stringify({
          activeRosterCount: activeMemberships.length,
          metrics,
          projectRef,
        }),
      );

      expect(projectRef).toBe("gqurnljrvwyhruhutvni");
      expect(metrics).toMatchObject({
        canonicalCount: 2,
        expectedCanonicalOnlyManagedLearnerCount: 2,
        identityConflictCount: 0,
        legacyCount: 0,
        legacyOnlyCount: 0,
        shadowErrorCount: 0,
        tenantMismatchCount: 0,
        unexpectedCanonicalOnlyCount: 0,
      });
      expect(
        activeMemberships.every((entry) => entry.status === "active"),
      ).toBe(true);
    } finally {
      await supabase.auth.signOut();
    }
  }, 30_000);
});
