// Required Packages
const { GoogleGenAI } = require("@google/genai");
// Access LLM API Key from .env
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

// Convert text into vector using text-embedding (Nano Banana)
// https://ai.google.dev/gemini-api/docs/embeddings
async function getEmbedding(text) {
    const response = await genAI.models.generateContent({
        model: "gemini-embedding-001",
        contents: text,
    });
    return response.embeddings;
}

async function askGeminiIfSame(newRecord, existingRecord) {
    console.log("Consulting Gemini...");
    const response = await genAI.models.generateContent({
        model: "gemini-3-flash",
        contents: `
            Analyze these two Hong Kong traffic reports:
            
            NEW RECORD:
            Title: ${newRecord.title}
            Description: ${newRecord.description[0].text}
            Venue: ${newRecord.venue}
            Time: ${newRecord.timestamp}

            EXISTING INCIDENT:
            Title: ${existingRecord.title}
            Latest Update: ${existingRecord.description[existingRecord.description.length - 1].text}
            Venue: ${existingRecord.venue}
            Time: ${existingRecord.timestamp}

            Determine the relationship. 
            - "duplicate": The new record provides no new info compared to the existing record.
            - "merge": The new record is a legitimate follow-up or status change for the same event.
            - "distinct": This is a completely different incident.

            Respond ONLY in JSON format: {"decision": "duplicate" | "merge" | "distinct"}
            `,
        config: {
            thinkingConfig: {
                thinkingLevel: "low",
            }
        }
    });

    try {
        return JSON.parse(response.text);
    } catch (err) {
        console.error("AI Response Parsing Error:", err);
        return { decision: "distinct", reason: "Parsing failed" };
    }
}

module.exports = { getEmbedding, askGeminiIfSame };