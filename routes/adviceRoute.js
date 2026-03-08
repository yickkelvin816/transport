// Required Packages
const express = require('express');
const router = express.Router();

// Internal modules
const Incident = require('../models/incident');
const { getEmbedding, getTravelAdvice } = require('../services/aiService');

/** POST /api/advice/
 * User-facing endpoint for natural language travel queries based in Hong Kong.
 * 1. Convert plaintext into vector embedding.
 * 2. Perform MongoDB vectorSearch to find occuring incidents semantically related to route/destination.
 * 3. Pass the user intent, real time traffic context to genAI.
 * 4. Return a JSON travel recommendation.
*/
router.post('/', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) {
            res.status(400);
            res.json({ error: "Query is required" });
            return
        }

        // Obtain query vector embedding.
        const queryVector = await getEmbedding(query);

        // Perform Vector Search in MongoDB
        const pipeline = [
            {
                $vectorSearch: {
                    index: "vector_index",
                    path: "embeddings",
                    queryVector: queryVector,
                    numCandidates: 10,
                    limit: 3
                }
            },
            {
                $project: {
                    title: 1, venue: 1, description: 1, status: 1, score: { $meta: "vectorSearchScore" }
                }
            }
        ];

        const relevantIncidents = await Incident.aggregate(pipeline);

        // Get AI Advice
        const advice = await getTravelAdvice(query, relevantIncidents);

        res.json(advice);

    } catch (err) {
        console.error("Advice Error:", err);
        res.status(500);
        res.json({ error: err.message });
    }
});











module.exports = router;