import OpenAI from "openai";

export const openaikey = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});