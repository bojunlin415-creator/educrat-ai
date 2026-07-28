import { POST } from "./route";
import { CurriculumError } from "@/lib/curriculum/errors";

const serviceMocks = vi.hoisted(() => ({
  restoreArchivedCurriculum: vi.fn(),
  restoreDeletedCurriculum: vi.fn(),
}));

vi.mock("@/lib/curriculum/service", () => serviceMocks);

const id = "10000000-0000-4000-8000-000000000009";

describe("curriculum restore API", () => {
  afterEach(() => vi.clearAllMocks());

  it("restores archived curricula by default", async () => {
    serviceMocks.restoreArchivedCurriculum.mockResolvedValue({
      id,
      name: "教材",
    });
    const response = await POST(
      new Request(`http://localhost/api/curriculums/${id}/restore`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.restoreArchivedCurriculum).toHaveBeenCalledWith(id);
    expect(serviceMocks.restoreDeletedCurriculum).not.toHaveBeenCalled();
  });

  it("restores deleted curricula from recycle bin mode", async () => {
    serviceMocks.restoreDeletedCurriculum.mockResolvedValue({
      id,
      name: "教材",
    });
    const response = await POST(
      new Request(
        `http://localhost/api/curriculums/${id}/restore?from=recycle-bin`,
        { method: "POST" },
      ),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.restoreDeletedCurriculum).toHaveBeenCalledWith(id);
  });

  it("returns a safe domain error when deleted curriculum restore hits an active name conflict", async () => {
    serviceMocks.restoreDeletedCurriculum.mockRejectedValue(
      new CurriculumError("restore_name_conflict"),
    );
    const response = await POST(
      new Request(
        `http://localhost/api/curriculums/${id}/restore?from=recycle-bin`,
        { method: "POST" },
      ),
      { params: Promise.resolve({ id }) },
    );
    const payload = (await response.json()) as {
      code?: string;
      message?: string;
    };

    expect(response.status).toBe(409);
    expect(payload.code).toBe("restore_name_conflict");
    expect(payload.message).not.toMatch(
      /postgres|supabase|23505|unique_violation|curriculum_restore_name_taken/i,
    );
  });
});
