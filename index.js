// Required Packages
const express = require('express');
const mongoose = require('mongoose');

// Internal modules
const incidentRoute = require('./routes/incidentRoute');
const Incident = require('./models/incident');

const app = express()
const PORT = 3000;

// Allow server to parse in json input.
app.use(express.json());

async function setupDatabase() {
    try {
        // TTL index - expire the document after 24 hours, sort by ascending order
        await Incident.collection.createIndex(
            { 'timestamp': 1 },
            { expireAfterSeconds: 86400 }
        )
    } catch (err) {
        console.error('Error setting up indexes:', err);
    }
}

// Analyse and Merge new records, added manually using CRUD.
const batchOptimiser = async () => {
    try {
        const pendingDocs = await Incident.find({ isAnalyzed: false })

        for (let newDoc of pendingDocs) {
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

            const bestMatch = matches[0];

            /* TO-BE DONE */
            // Consult Gemini the similiarity of two records
            const isSame = await askGeminiIfSame(newDoc, bestMatch);

            if (isSame && bestMatch) {
                // Push updates to exising record
                await Incident.findByIdAndUpdate(bestMatch._id, {
                    $push: { description: { text: newDoc.description[0].text, timestamp: newDoc.timestamp } },
                    $set: { status: newDoc.status }
                });
                // Delete duplicated record
                await Incident.findByIdAndDelete(newDoc._id);
                console.log(`Merged duplicate: ${newDoc.title} -> ${bestMatch.title}`);
            } else {
                // New Issue: set up new record
                const vector = await getEmbedding(newDoc.title);
                await Incident.updateOne(
                    { _id: newDoc._id },
                    { $set: { embeddings: vector, isAnalyzed: true } }
                );
                console.log(`Confirmed new incident: ${newDoc.title}`);
            }
        }
    } catch (err) {
        console.error('Deduplication Error:', err);
        console.error('Check genAI API rate limit', err);
    }
};

// Connect MongoDB
mongoose.connect('mongodb://3011-mongo/trafficDB')
    .then(async () => {
        console.log('Connected to MongoDB.');

        /* AI optimisation feature to be done */
        // await setupDatabase();
        // setInterval(batchOptimiser, 600000);
        // batchOptimiser();
    })
    .catch(err => {
        console.log(`Connection error: ${err}`);
    })

// Default landing
app.get('/', (req, res) => {
    res.send('Smart Transport System is currently running....');
})

// Link to router
app.use('/api/incidents', incidentRoute);

// Error handler
app.use((err, req, res, next) => {
    res.status(err.status || 500);
    res.json({ 'error': err.message });
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});