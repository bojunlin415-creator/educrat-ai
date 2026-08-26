import { createClient } from "@supabase/supabase-js";
import { learnerParitySnapshotSchema } from "@/lib/learner-convergence/application/validation";
import { compareAssignmentClassExpansionAuthorities } from "@/lib/learner-convergence/assignment-class-expansion/parity";

const liveDescribe =
  process.env.LEARNER_ASSIGNMENT_EXPANSION_LIVE_VERIFY === "1"
    ? describe
    : describe.skip;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing_environment:${name}`);
  return value;
}

liveDescribe(
  "LE-001 Phase 5D Development Assignment expansion evidence",
  () => {
    it("verifies canonical class candidates read-only without materializing recipients", async () => {
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
        const metrics = compareAssignmentClassExpansionAuthorities({
          classIds,
          snapshot,
        });
        const projectRef = new URL(supabaseUrl).hostname.split(".")[0];

        console.info(
          "[assignment-class-expansion-live]",
          JSON.stringify({ classCount: classIds.length, metrics, projectRef }),
        );

        expect(projectRef).toBe("gqurnljrvwyhruhutvni");
        expect(metrics.tenantMismatchCount).toBe(0);
        expect(metrics.shadowErrorCount).toBe(0);
        expect(metrics.unexpectedCanonicalOnlyCount).toBe(0);
        expect(metrics.expectedCanonicalOnlyCount).toBeGreaterThanOrEqual(0);
      } finally {
        await supabase.auth.signOut();
      }
    }, 30_000);
  },
);
