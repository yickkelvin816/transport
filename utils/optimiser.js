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
        const count = await Incident.countDocuments({ isAnalysed: false });
        console.log(`Debug: Found ${count} unanalyzed incidents.`);

        if (count === 0) {
            console.log("No pending records to process. Ending cycle.");
            return;
        }

        const pendingDocs = await Incident.find({ isAnalysed: false })
        for (let newDoc of pendingDocs) {
            console.log(`2: Processing Record - ${newDoc.title}`);

            const vector = await getEmbedding(newDoc.title);
            // Vector search in database for best match similiar records
            const matches = await Incident.aggregate([
                {
                    "$vectorSearch": {
                        "index": "vector_index",
                        "path": "embeddings",
                        "queryVector": vector,
                        "numCandidates": 10,
                        "limit": 1
                    }
                }
            ]);
            console.log("3: Embedding Generated");

            // Only consult genAI if similiar match record exists
            if (matches && matches.length > 0) {
                const bestMatch = matches[0];
                console.log(`Match found`);

                // Consult Gemini the similiarity of two records
                const aiResponse = await askGeminiIfSame(newDoc, bestMatch);

                if (aiResponse.decision === "duplicate") {
                    // Exact same info, delete the new record
                    await Incident.findByIdAndDelete(newDoc._id);
                    console.log(`[AI: DUPLICATE] Discarded repeat: ${newDoc.title}`);
                    continue;
                }
                if (aiResponse.decision === "merge") {
                    // Related update, push to the existing record's description array
                    await Incident.findByIdAndUpdate(bestMatch._id, {
                        $push: {
                            description: {
                                text: newDoc.description[0].text,
                                timestamp: newDoc.timestamp || new Date()
                            }
                        },
                        $set: { status: newDoc.status, isAnalysed: true }
                    });
                    // Delete new record
                    await Incident.findByIdAndDelete(newDoc._id);
                    console.log(`[AI: MERGE] Added update to Incident: ${bestMatch._id}`);
                    continue;
                }
            }

            // Default: Distinct new incident or no match found
            await Incident.updateOne(
                { _id: newDoc._id },
                { $set: { embeddings: vector, isAnalysed: true } }
            );
            console.log(`[AI: DISTINCT] Confirmed new unique incident: ${newDoc.title}`);
        }
    } catch (err) {
        console.error('Deduplication Error:', err);
    } finally {
        isOptimising = false;
    }
};

module.exports = { batchOptimiser };