import { openaikey } from "../services/openaiService.js";

export const matchEngine = async (positionJson, candidateJson) => {
    console.log("Calling OpenAI Responses API with Prompt ID...");

    // Implement the prompt
    try {
        const response = await openaikey.responses.create({
            model: "gpt-5.4-nano",
            prompt: {
                id: "pmpt_69d6a93093d4819586e56e0811bf54790c01fbd98d5eb510",
                variables: {
                    position: positionJson,
                    candidate: candidateJson
                }
            },
            input: [
                {
                    role: "system",
                    content: "Return only valid JSON."
                }
            ]
        });

        console.log(response.output_text);
        return JSON.parse(response.output_text);
    } catch (error) {
        console.error("OpenAI API Error:", error.message);
        throw new Error("Failed to process resume with AI");
    }
}
