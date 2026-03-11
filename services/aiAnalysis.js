// Required Packages
const { json } = require("express");
const { GoogleGenAI } = require("@google/genai");

// Access LLM API Key from .env
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

// Internal modules
const Incident = require('../models/incident');
const weights = require('../config/weights.json');

async function generateDistrictReport(district, year, month) {
    const incidents = await Incident.find({
        district: district,
        timestamp: {
            $gte: new Date(year, month - 1, 1),
            $lte: new Date(year, month, 0)
        }
    });

    if (incidents.length === 0) return;

    const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `
            <TASK>
            As an experienced Hong Kong local data analyst, calculate a Public Transport Reliability Score (0-10) for ${district} for ${month}/${year}.
            Analyze recurring venues and specific times that impact arrival confidence.
            </TASK>

            <WEIGHT_FACTORS>
            Apply these specific weights to the provided incident data:
            ${JSON.stringify(weights.factors)}
            Higher incident counts in high-weight categories should lower the reliabilityScore significantly.
            CAN search online for any historical weather data, road condition, illegal parking, period of crowds appear to help calculate.
            </WEIGHT_FACTORS>

            <RESOURCES>
            Incident Records for ${district}:
            ${JSON.stringify(incidents.map(i => ({
            type: i.type,
            venue: i.venue,
            severity: i.severity,
            time: i.timestamp
        })))}
            </RESOURCES>

            <RESPONSE_FORMAT>
            Return ONLY a JSON object matching this schema:
            {
            "reliabilityScore": "Float" (0.0-10.0),
            "summary": "String (Detailed summary of patterns for route planning)",
            "metrics": [{"type": "String", "avgResolutionTime": "Number" (in minutes), "count": "Number"}]
            }
            </RESPONSE_FORMAT>
    
            `,
        config: {
            thinkingConfig: {
                thinkingLevel: "medium",
                includeThoughts: false
            },
            tools: [
                { googleSearch: {} }
            ],
            responseMimeType: "application/json",
        }
    });

    try {
        const aiData = JSON.parse(response.text);
        console.log(aiData);

        await Analysis.findOneAndUpdate(
            {
                district,
                "period.year": year,
                "period.month": month
            },
            {
                reliabilityScore: aiData.reliabilityScore,
                summary: aiData.summary,
                metrics: aiData.metrics
            },
            { upsert: true, new: true }
        );
        console.log(`Report generated for ${district}`);

    } catch (err) {
        console.error("Analysis Parsing Error:", err);
    }


}

module.exports = { generateDistrictReport };