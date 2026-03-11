// Required Packages
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');

// Internal modules
const incidentRoute = require('./routes/incidentRoute');
const adviceRoute = require('./routes/adviceRoute');
const Incident = require('./models/incident');
const { deduplicateTrafficRecords } = require('./utils/optimiser');
const { scrapeAndConsolidate } = require('./services/scraperService');

const app = express()
const PORT = 3000;

// Allow server to parse in json input.
app.use(express.json());

// Connect MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('Connected to MongoDB.');


        /** Legacy function: Scrape archived traffic incident news */
        await scrapeAndConsolidate();
        // Crawl traffic news every 10 minutes. (Mock-up user submission);
        console.log(`[Set] Scrape traffic news in every 15 minutes.`)
        setInterval(async () => {
            await scrapeAndConsolidate();
            console.log(`[Set] Scrape traffic news after 15 minutes.`)
        }, 15 * 60 * 1000);



        // Trigger Optimiser if reaching threshold.
        const pendingCount = await Incident.countDocuments({ isAnalysed: false });
        console.log(`[Batch Optimiser]: Found ${pendingCount} pending documents.`);
        if (pendingCount >= 5) {
            console.log("[Batch Optimiser]: Triggered, met Pending Count threshold.");
            deduplicateTrafficRecords();
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

// Link to router: incidentRoute
app.use('/api/incidents', incidentRoute);

// Link to router: adviceRoute
app.use('/api/advice', adviceRoute);

// Error handler
app.use((err, req, res, next) => {
    res.status(err.status || 500);
    res.json({ 'error': err.message });
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});