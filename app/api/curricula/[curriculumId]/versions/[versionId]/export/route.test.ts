import { CurriculumError } from "@/lib/curriculum/errors";
import { SubjectCapabilityError } from "@/lib/subjects";
import { GET } from "./route";

const serviceMocks = vi.hoisted(() => ({
  exportCurriculumVersionPdf: vi.fn(),
}));

vi.mock("@/lib/curriculum/export", () => serviceMocks);

const curriculumId = "10000000-0000-4000-8000-000000000009";
const versionId = "10000000-0000-4000-8000-000000000010";

describe("curriculum version export API", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns a runtime-generated PDF response", async () => {
    serviceMocks.exportCurriculumVersionPdf.mockResolvedValue({
      data: new TextEncoder().encode("%PDF-1.7\nbody"),
      filename: "國小五年級-數學-分數加減-題目卷.pdf",
      mode: "worksheet",
    });

    const response = await GET(
      new Request(
        `http://localhost/api/curricula/${curriculumId}/versions/${versionId}/export?mode=worksheet`,
      ),
      { params: Promise.resolve({ curriculumId, versionId }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("content-disposition")).toContain("filename*=");
    expect(await response.text()).toContain("%PDF-1.7");
    expect(serviceMocks.exportCurriculumVersionPdf).toHaveBeenCalledWith({
      curriculumId,
      mode: "worksheet",
      versionId,
    });
  });

  it("returns a safe domain error for invalid modes", async () => {
    serviceMocks.exportCurriculumVersionPdf.mockRejectedValue(
      new CurriculumError("invalid_export_mode"),
    );
    const response = await GET(
      new Request(
        `http://localhost/api/curricula/${curriculumId}/versions/${versionId}/export?mode=raw`,
      ),
      { params: Promise.resolve({ curriculumId, versionId }) },
    );
    const payload = (await response.json()) as { code?: string };
    expect(response.status).toBe(400);
    expect(payload.code).toBe("invalid_export_mode");
  });

  it("fails closed for missing versions or cross-tenant access", async () => {
    serviceMocks.exportCurriculumVersionPdf.mockRejectedValue(
      new CurriculumError("not_found"),
    );
    const response = await GET(
      new Request(
        `http://localhost/api/curricula/${curriculumId}/versions/${versionId}/export?mode=combined`,
      ),
      { params: Promise.resolve({ curriculumId, versionId }) },
    );
    expect(response.status).toBe(404);
  });

  it("returns a structured error when PDF export is unavailable", async () => {
    serviceMocks.exportCurriculumVersionPdf.mockRejectedValue(
      new SubjectCapabilityError({
        capability: "pdf_export",
        reason: "NOT_APPROVED",
        subject: "science",
      }),
    );
    const response = await GET(
      new Request(
        `http://localhost/api/curricula/${curriculumId}/versions/${versionId}/export?mode=worksheet`,
      ),
      { params: Promise.resolve({ curriculumId, versionId }) },
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        capability: "pdf_export",
        code: "subject_capability_unavailable",
        subject: "science",
      },
      success: false,
    });
  });
});
