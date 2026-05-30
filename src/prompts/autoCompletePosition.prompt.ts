import { openaikey } from "../services/openai.service.js";

export const autoCompletePosition = async (
  extractedPosition: any,
): Promise<any[]> => {
  console.log("Calling OpenAI Responses API with Prompt ID...");

  try {
    const response = await openaikey.responses.create({
      model: "gpt-5.4-nano",
      prompt: {
        id: "pmpt_6a16384686008197b2f90e1e8fad2e2605b712e8b0143570",
        variables: {
          positionpdf: extractedPosition,
        },
      },
      input: [
        {
          role: "system",
          content: "Return only valid JSON",
        },
      ],
    });

    console.log(response.output_text);
    return JSON.parse(response.output_text);
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Failed to complete position data");
  }
};
