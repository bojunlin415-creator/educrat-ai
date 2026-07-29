import { POST as approvePost } from "./approve/route";
import { POST as createVersionPost } from "./versions/new/route";
import { POST as publishPost } from "./publish/route";
import { POST as reopenDraftPost } from "./reopen-draft/route";
import { POST as reviewPost } from "./review/route";
import { POST as submitReviewPost } from "./submit-review/route";

const serviceMocks = vi.hoisted(() => ({
  createNextCurriculumVersion: vi.fn(),
  publishCurriculum: vi.fn(),
  reopenCurriculumDraft: vi.fn(),
  reviewCurriculum: vi.fn(),
  submitCurriculumReview: vi.fn(),
}));

vi.mock("@/lib/curriculum/service", () => serviceMocks);
vi.mock("@/lib/curriculum/cache", () => ({
  revalidateCurriculumPaths: vi.fn(),
}));

const id = "10000000-0000-4000-8000-000000000009";
const routeContext = { params: Promise.resolve({ id }) };

function curriculum(name = "發布流程教材") {
  return { id, name };
}

describe("PB-001 curriculum publish workflow API", () => {
  afterEach(() => vi.clearAllMocks());

  it("submits a draft curriculum for review", async () => {
    serviceMocks.submitCurriculumReview.mockResolvedValue(curriculum());
    const response = await submitReviewPost(
      new Request(`http://localhost/api/curriculums/${id}/submit-review`, {
        method: "POST",
      }),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(serviceMocks.submitCurriculumReview).toHaveBeenCalledWith(id);
  });

  it("records reviewer approval through the review endpoint", async () => {
    serviceMocks.reviewCurriculum.mockResolvedValue(curriculum());
    const response = await reviewPost(
      new Request(`http://localhost/api/curriculums/${id}/review`, {
        method: "POST",
      }),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(serviceMocks.reviewCurriculum).toHaveBeenCalledWith(id);
  });

  it("keeps approve as a server-side alias for review", async () => {
    serviceMocks.reviewCurriculum.mockResolvedValue(curriculum());
    const response = await approvePost(
      new Request(`http://localhost/api/curriculums/${id}/approve`, {
        method: "POST",
      }),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(serviceMocks.reviewCurriculum).toHaveBeenCalledWith(id);
  });

  it("publishes a reviewed curriculum", async () => {
    serviceMocks.publishCurriculum.mockResolvedValue(curriculum());
    const response = await publishPost(
      new Request(`http://localhost/api/curriculums/${id}/publish`, {
        method: "POST",
      }),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(serviceMocks.publishCurriculum).toHaveBeenCalledWith(id);
  });

  it("reopens an in-review curriculum as draft", async () => {
    serviceMocks.reopenCurriculumDraft.mockResolvedValue(curriculum());
    const response = await reopenDraftPost(
      new Request(`http://localhost/api/curriculums/${id}/reopen-draft`, {
        method: "POST",
      }),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(serviceMocks.reopenCurriculumDraft).toHaveBeenCalledWith(id);
  });

  it("creates the next editable version for published or archived curriculum", async () => {
    serviceMocks.createNextCurriculumVersion.mockResolvedValue(curriculum());
    const response = await createVersionPost(
      new Request(`http://localhost/api/curriculums/${id}/versions/new`, {
        method: "POST",
      }),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(serviceMocks.createNextCurriculumVersion).toHaveBeenCalledWith(id);
  });
});
