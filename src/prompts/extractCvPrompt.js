import { openaikey } from "../services/openaiService";

export const extractCandidateData = async (extractedText) => {
    console.log("Calling OpenAI Responses API with Prompt ID...");

    // Implement the prompt
    try {
        const response = await openaikey.responses.create({
            model: "gpt-5.4-nano",
            prompt: {
                id: "pmpt_69d1628aedc081968906e966be99f5d70eee7d5bcc4d3d8b",
                variables: {
                    cvtext: extractedText
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
