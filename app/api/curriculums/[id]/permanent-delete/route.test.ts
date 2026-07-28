import { POST } from "./route";

const serviceMocks = vi.hoisted(() => ({
  permanentlyDeleteCurriculum: vi.fn(),
}));

vi.mock("@/lib/curriculum/service", () => serviceMocks);

const id = "10000000-0000-4000-8000-000000000009";

describe("curriculum permanent delete API", () => {
  afterEach(() => vi.clearAllMocks());

  it("permanently deletes only with validated confirmation", async () => {
    serviceMocks.permanentlyDeleteCurriculum.mockResolvedValue(id);
    const response = await POST(
      new Request(`http://localhost/api/curriculums/${id}/permanent-delete`, {
        body: JSON.stringify({ confirmation: "永久刪除" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.permanentlyDeleteCurriculum).toHaveBeenCalledWith(id, {
      confirmation: "永久刪除",
    });
  });

  it("rejects missing confirmation before calling the service", async () => {
    const response = await POST(
      new Request(`http://localhost/api/curriculums/${id}/permanent-delete`, {
        body: JSON.stringify({ confirmation: "" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(422);
    expect(serviceMocks.permanentlyDeleteCurriculum).not.toHaveBeenCalled();
  });
});
