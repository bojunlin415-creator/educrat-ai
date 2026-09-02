import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const liveDescribe =
  process.env.LEARNER_ASSIGNMENT_RECIPIENT_LIVE_VERIFY === "1"
    ? describe
    : describe.skip;

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`missing_environment:${name}`);
  return value;
}

liveDescribe("LE-001 Phase 5E Development recipient boundary", () => {
  it("verifies RPC, grants, empty data health, and anonymous denial without creating data", async () => {
    const supabaseUrl = requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const publishableKey = requiredEnvironment(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
    const authenticatedClient = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const passwords = [
      process.env.E2E_AUTH_PASSWORD,
      process.env.E2E_AUTH_NEW_PASSWORD,
    ].filter((value): value is string => Boolean(value?.trim()));
    let authenticated = false;
    for (const password of passwords) {
      const { error } = await authenticatedClient.auth.signInWithPassword({
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
      const [canonical, provenance, legacy] = await Promise.all([
        authenticatedClient
          .from("assignment_student_recipients")
          .select("id,identity_authority", { count: "exact" }),
        authenticatedClient
          .from("assignment_recipient_classes")
          .select("recipient_id", { count: "exact" }),
        authenticatedClient
          .from("assignment_students")
          .select("assignment_id", { count: "exact" }),
      ]);
      expect(canonical.error).toBeNull();
      expect(provenance.error).toBeNull();
      expect(legacy.error).toBeNull();

      const missingAssignment = randomUUID();
      const projection = await authenticatedClient.rpc(
        "get_assignment_recipient_projection",
        { p_assignment_id: missingAssignment },
      );
      expect(projection.error).toMatchObject({ code: "P0002" });
      expect(projection.error?.message).toContain("assignment_not_found");

      const internalCompatibility = await authenticatedClient
        .from("assignment_recipient_legacy_compatibility")
        .select("recipient_id", { count: "exact" });
      expect(internalCompatibility.error?.code).toBe("42501");

      await authenticatedClient.auth.signOut();
      const anonymousProjection = await authenticatedClient.rpc(
        "get_assignment_recipient_projection",
        { p_assignment_id: missingAssignment },
      );
      expect(anonymousProjection.error?.code).toBe("42501");
      expect(anonymousProjection.error?.message).toContain(
        "permission denied for function get_assignment_recipient_projection",
      );

      const canonicalRows = canonical.data ?? [];
      const metrics = Object.freeze({
        canonicalRecipientCount: canonical.count ?? canonicalRows.length,
        compatibilityMappedCount: canonicalRows.filter(
          (row) =>
            row.identity_authority === "canonical_with_legacy_compatibility",
        ).length,
        legacyHistoricalCount: legacy.count ?? legacy.data?.length ?? 0,
        managedAccountlessRecipientCount: canonicalRows.filter(
          (row) => row.identity_authority === "canonical",
        ).length,
        provenanceCount: provenance.count ?? provenance.data?.length ?? 0,
        projectRef: new URL(supabaseUrl).hostname.split(".")[0],
      });
      console.info("[assignment-recipient-live]", JSON.stringify(metrics));

      expect(metrics.projectRef).toBe("gqurnljrvwyhruhutvni");
      expect(metrics.canonicalRecipientCount).toBe(0);
      expect(metrics.compatibilityMappedCount).toBe(0);
      expect(metrics.legacyHistoricalCount).toBe(0);
      expect(metrics.managedAccountlessRecipientCount).toBe(0);
      expect(metrics.provenanceCount).toBe(0);
    } finally {
      await authenticatedClient.auth.signOut();
    }
  }, 30_000);
});
