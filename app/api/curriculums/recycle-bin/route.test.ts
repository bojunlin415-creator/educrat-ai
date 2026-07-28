import { CurriculumError } from "@/lib/curriculum/errors";
import { GET } from "./route";

const serviceMocks = vi.hoisted(() => ({
  getDeletedCurriculums: vi.fn(),
}));

vi.mock("@/lib/curriculum/service", () => serviceMocks);

const reference = {
  code: "teaching-progress-template-1",
  displayName: "教學進度模板 1",
  id: "10000000-0000-4000-8000-000000000003",
  referenceType: "REFERENCE" as const,
};

describe("curriculum recycle bin API", () => {
  afterEach(() => vi.clearAllMocks());

  it("lists deleted curricula through the server data layer", async () => {
    serviceMocks.getDeletedCurriculums.mockResolvedValue([
      { id: "curriculum-1", reference },
    ]);
    const response = await GET();
    const payload = (await response.json()) as {
      curriculums?: Array<{ reference?: typeof reference }>;
    };

    expect(response.status).toBe(200);
    expect(serviceMocks.getDeletedCurriculums).toHaveBeenCalledWith();
    expect(payload.curriculums?.[0]).toEqual(
      expect.objectContaining({ reference }),
    );
  });

  it("does not leak recycle bin data to unauthorized users", async () => {
    serviceMocks.getDeletedCurriculums.mockRejectedValue(
      new CurriculumError("forbidden"),
    );
    const response = await GET();

    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("stack");
  });
});
