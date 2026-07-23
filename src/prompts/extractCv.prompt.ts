import { openaikey } from "../services/openai.service.js";
import { CandidateExtracted } from "../types/candidates.types.js";

export const extractCandidateData = async (
  extractedText: string,
): Promise<CandidateExtracted> => {
  console.log("Calling OpenAI Responses API with Prompt ID...");

  // Implement the prompt
  try {
    const response = await openaikey.responses.create({
      model: "gpt-5.4-nano",
      prompt: {
        id: "pmpt_69d1628aedc081968906e966be99f5d70eee7d5bcc4d3d8b",
        variables: {
          cvtext: extractedText,
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
    if (response.usage) {
      console.log(
        `[extractCv] tokens — input: ${response.usage.input_tokens}, output: ${response.usage.output_tokens}, total: ${response.usage.total_tokens}`,
      );
    }
    return JSON.parse(response.output_text);
  } catch (error) {
    console.error("OpenAI API Error:", error);
    throw new Error("Failed to process resume with AI");
  }
};
