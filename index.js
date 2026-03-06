// Required Packages
const express = require('express');
const mongoose = require('mongoose');

// Internal modules
const incidentRoute = require('./routes/incidentRoute');
const Incident = require('./models/incident');
const { batchOptimiser } = require('./utils/optimiser');
const { scrapeAndConsolidate } = require('./services/scraperService');

const app = express()
const PORT = 3000;

// Allow server to parse in json input.
app.use(express.json());

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('Connected to MongoDB.');

        await scrapeAndConsolidate();

        // Crawl traffic news every 10 minutes. (Mock-up user submission);
        console.log(`[Set] Scrape traffic news every 10 minutes.`)
        setInterval(async () => {
            await scrapeAndConsolidate();
        }, 10 * 60 * 1000);

        // Trigger Optimiser if reaching threshold.
        const pendingCount = await Incident.countDocuments({ isAnalysed: false });
        console.log(`Debug: Found ${pendingCount} pending documents.`);
        if (pendingCount >= 5) {
            console.log("Triggering Batch Optimiser. Pending Count threshold met.");
            // batchOptimiser();
        }
    })
    .catch(err => {
        console.log(`Connection error: ${err}`);
    })

// Log request IP address.
app.use((req, res, next) => {
    req.clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    next();
});

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