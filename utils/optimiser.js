// Internal modules
const Incident = require('../models/incident');
const { getEmbedding, askGeminiIfSame } = require('../services/aiService')

// lock - prevent data race
let isOptimising = false;

// Analyse and Merge new records, added manually using CRUD.
const batchOptimiser = async () => {
    if (isOptimising) {
        console.log("Optimiser is running. Skip this cycle.");
        return;
    };
    console.log("1");
    isOptimising = true;
    try {
        const count = await Incident.countDocuments({ isAnalyzed: false });
        console.log(`Debug: Found ${count} unanalyzed incidents.`);

        if (count === 0) {
            console.log("No pending records to process. Ending cycle.");
            return;
        }

        const pendingDocs = await Incident.find({ isAnalyzed: false })
        for (let newDoc of pendingDocs) {
            console.log(`2: Processing Record - ${newDoc.title}`);
            // Vector search in database for best match similiar records
            const matches = await Incident.aggregate([
                {
                    "$vectorSearch": {
                        "index": "vector_index",
                        "path": "embeddings",
                        "queryVector": await getEmbedding(newDoc.title),
                        "numCandidates": 10,
                        "limit": 1
                    }
                }
            ]);
            console.log("3: Embedding Generated");
            const bestMatch = matches[0];

            // Consult Gemini the similiarity of two records
            const aiResponse = await askGeminiIfSame(newDoc, bestMatch);

            if (bestMatch && aiResponse.decision === "duplicate") {
                // Exact same info, delete the new record
                await Incident.findByIdAndDelete(newDoc._id);
                console.log(`[AI: DUPLICATE] Discarded repeat: ${newDoc.title}`);

            } else if (bestMatch && aiResponse.decision === "merge") {
                // Related update, push to the existing record's description array
                await Incident.findByIdAndUpdate(bestMatch._id, {
                    $push: {
                        description: {
                            text: newDoc.description[0].text,
                            timestamp: newDoc.timestamp || new Date()
                        }
                    },
                    $set: { status: newDoc.status, isAnalyzed: true }
                });
                // Delete new record
                await Incident.findByIdAndDelete(newDoc._id);
                console.log(`[AI: MERGE] Added update to Incident: ${bestMatch._id}`);

            } else {
                // Distinct new incident or no match found
                await Incident.updateOne(
                    { _id: newDoc._id },
                    { $set: { embeddings: queryVector, isAnalyzed: true } }
                );
                console.log(`[AI: DISTINCT] Confirmed new unique incident: ${newDoc.title}`);
            }
        }
    } catch (err) {
        console.error('Deduplication Error:', err);
    } finally {
        isOptimising = false;
    }
};

module.exports = { batchOptimiser };