import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const liveDescribe =
  process.env.LEARNER_SUBMISSION_SELF_LIVE_VERIFY === "1"
    ? describe
    : describe.skip;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing_environment:${name}`);
  return value;
}

liveDescribe("LE-001 Phase 5F Development submission boundary", () => {
  it("verifies the RPC and direct-write boundary without creating fixtures", async () => {
    const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const client = createClient(
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
      const { error } = await client.auth.signInWithPassword({
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
      const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
      expect(projectRef).toBe("gqurnljrvwyhruhutvni");

      const [links, recipients, assignments] = await Promise.all([
        client.rpc("get_learner_convergence_snapshot"),
        client
          .from("assignment_student_recipients")
          .select("id", { count: "exact", head: true }),
        client
          .from("assignments")
          .select("id", { count: "exact", head: true })
          .in("status", ["scheduled", "active"]),
      ]);
      expect(links.error).toBeNull();
      expect(recipients.error).toBeNull();
      expect(assignments.error).toBeNull();

      const studentOnlyRead = await client.rpc(
        "get_authenticated_student_assignment_recipients",
        { p_assignment_id: null },
      );
      expect(studentOnlyRead.error).toMatchObject({ code: "42501" });
      expect(studentOnlyRead.error?.message).toContain(
        "submission_self_forbidden",
      );

      const directSubmissionWrite = await client
        .from("assignment_submissions")
        .insert({
          assignment_id: randomUUID(),
          content: {},
          organization_id: randomUUID(),
          status: "draft",
          student_id: randomUUID(),
        });
      expect(directSubmissionWrite.error).toMatchObject({ code: "42501" });

      const directOwnershipRead = await client
        .from("assignment_submission_canonical_ownerships")
        .select("submission_id")
        .limit(1);
      expect(directOwnershipRead.error).toMatchObject({ code: "42501" });

      const internalPersistence = await client.rpc(
        "persist_authenticated_student_submission",
        {
          p_assignment_id: randomUUID(),
          p_content: {},
          p_submit: false,
          p_use_canonical_identity: true,
        },
      );
      expect(internalPersistence.error).toMatchObject({ code: "42501" });

      const snapshot = links.data as {
        accountLinks?: readonly { status?: string }[];
      };
      console.info(
        "[submission-self-live]",
        JSON.stringify({
          activeAccountLinkCount:
            snapshot.accountLinks?.filter((link) => link.status === "active")
              .length ?? 0,
          activeAssignmentCount: assignments.count ?? 0,
          canonicalRecipientCount: recipients.count ?? 0,
          linkedStudentCredentialFixtureAvailable: false,
          projectRef,
        }),
      );

      await client.auth.signOut();
      const anonymousWrite = await client.rpc(
        "save_authenticated_student_submission",
        {
          p_assignment_id: randomUUID(),
          p_content: {},
          p_submit: false,
        },
      );
      expect(anonymousWrite.error).toMatchObject({ code: "42501" });
    } finally {
      await client.auth.signOut();
    }
  }, 30_000);
});
