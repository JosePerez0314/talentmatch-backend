import { openaikey } from "../services/openai.service.js";
import { CandidateExtracted } from "../types/candidates.types.js";
import { NormalizedCandidate } from "../types/normalizedCantidate.type.js";
import { PositionExtracted } from "../types/positions.types.js";

export const matchEngine = async (
  positionJson: PositionExtracted,
  candidateJson: CandidateExtracted,
): Promise<NormalizedCandidate> => {
  console.log("Calling OpenAI Responses API with Prompt ID...");

  // Implement the prompt
  try {
    const response = await openaikey.responses.create({
      model: "gpt-5.4-nano",
      prompt: {
        id: "pmpt_69d6a93093d4819586e56e0811bf54790c01fbd98d5eb510",
        variables: {
          position: JSON.stringify(positionJson),
          candidate: JSON.stringify(candidateJson),
        },
      },
      input: [
        {
          role: "system",
          content: "Return only valid JSON.",
        },
      ],
    });

    console.log(response.output_text);
    return JSON.parse(response.output_text);
  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw new Error("Failed to process resume with AI");
  }
};
