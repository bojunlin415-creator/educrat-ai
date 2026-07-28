import {
  createGenerationFailure,
  createGenerationMetadata,
  createGenerationSuccess,
  type GenerationResult,
  type GenerationRequest,
} from "@/lib/ai-generation/domain/model";
import type { CurriculumGenerationOutput } from "@/lib/ai-generation/domain/structured-output";
import type { AIProvider } from "@/lib/ai-generation/interfaces/ai-provider";
import { assemblePrompt } from "@/lib/ai-generation/application/prompt-builder";
import { validateGenerationRequest } from "@/lib/ai-generation/application/request-validator";
import { validateCurriculumOutput } from "@/lib/ai-generation/application/output-validator";
import { validatePromptCopyrightSafety } from "@/lib/ai-generation/application/copyright-safety-validator";

export async function generateOriginalCurriculum(
  request: GenerationRequest,
  provider: AIProvider,
): Promise<GenerationResult<CurriculumGenerationOutput>> {
  if (!validateGenerationRequest(request)) {
    return createGenerationFailure({ code: "INVALID_REQUEST" });
  }

  const health = await provider.health();
  if (health.status === "UNAVAILABLE") {
    return createGenerationFailure({ code: "PROVIDER_UNAVAILABLE" });
  }

  const prompt = assemblePrompt(request);
  if (!validatePromptCopyrightSafety(prompt).safe) {
    return createGenerationFailure({ code: "PROMPT_BUILD_FAILED" });
  }
  try {
    const providerResult = await provider.generate({
      prompt,
      requestId: request.requestId,
    });
    const metadata = createGenerationMetadata({
      correlationId: request.correlationId,
      model: provider.modelName(),
      provider: provider.providerName(),
      requestId: request.requestId,
      usage: providerResult.usage,
      version: request.version,
    });
    const validationResult = validateCurriculumOutput(
      request.context,
      providerResult.rawOutput,
    );
    if (!validationResult.success) {
      return createGenerationFailure(
        { code: validationResult.reason },
        metadata,
      );
    }
    return createGenerationSuccess(validationResult.output, metadata);
  } catch {
    return createGenerationFailure({ code: "PROVIDER_ERROR" });
  }
}

export const generateCurriculum = generateOriginalCurriculum;
