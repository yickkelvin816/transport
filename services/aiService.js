// Required Packages
const { GoogleGenAI } = require("@google/genai");
// Access LLM API Key from .env
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

// Internal modules
const { INCIDENT_TYPES, DISTRICTS, INCIDENT_STATUS } = require('../config/constants');


// Convert text into vector using text-embedding (Nano Banana)
// https://ai.google.dev/gemini-api/docs/embeddings
async function getEmbedding(text) {
    const response = await genAI.models.embedContent({
        model: "gemini-embedding-001",
        contents: text,
        config: {
            taskType: "SEMANTIC_SIMILARITY",
            outputDimensionality: 768
        }
    });
    const embeddings = response.embeddings[0].values;
    return embeddings;
}

async function askGeminiIfSame(newRecord, existingRecord) {
    console.log("Consulting Gemini...");
    const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
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

async function processBatchIncidents(rawNewsArray) {
    console.log("Consulting Gemini...");
    const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `
            You are a traffic data engineer. I will provide a JSON array of authentic Hong Kong traffic news and their first publication times.
            Tasks:
            1. Translate to British English, optimise the Title and Categorise.
            2. Retain the specific routes diversion or transportation intervals in description[] if necessary, but keep it concise. Short sentences preferred.
            3. If multiple entries describe the same incident, merge them into ONE object. 
            4. For merged incidents, the "firstPublishedAt" must be the EARLIEST timestamp provided among the updates.

            Input Data: ${JSON.stringify(rawNewsArray)}

            CRITICAL: Return ONLY a valid JSON array. Do not include "thought" or any conversational text.

            Return ONLY a JSON array:
            {
                "title": "English Title",
                "type": ${INCIDENT_TYPES},
                "description": [
                    { 
                        "text": "Status update 1 (earlier)", 
                        "timestamp": "YYYY-MM-DD HH:mm" 
                    },
                    { 
                        "text": "Status update 2 (latest)", 
                        "timestamp": "YYYY-MM-DD HH:mm" 
                    }
                ],
                "venue": "Closest proximity of incident, e.g. name of street, building"                 
                "district": "District Name",
                "severity": 1-5,
                "status": ${INCIDENT_STATUS},
                "timestamp": "YYYY-MM-DD HH:mm" first published date,
                "embeddings": [],
                "isAnalysed": false
            } `,
        config: {
            thinkingConfig: {
                thinkingLevel: "low",
            }
        }
    });

    try {
        return JSON.parse(response.text);
    } catch (error) {
        console.error("Batch AI Error:", error);
        return [];
    }
}


module.exports = { getEmbedding, askGeminiIfSame, processBatchIncidents };