// Required Packages
const express = require('express');
const mongoose = require('mongoose');

// Internal modules
const incidentRoute = require('./routes/incidentRoute');
const Incident = require('./models/incident');
const { batchOptimiser } = require('./utils/optimiser');

const app = express()
const PORT = 3000;

// Allow server to parse in json input.
app.use(express.json());

// Connect MongoDB
mongoose.connect('mongodb://3011-mongo/trafficDB')
    .then(async () => {
        console.log('Connected to MongoDB.');

        // Trigger Optimiser if reaching threshold.
        const pendingCount = await Incident.countDocuments({ isAnalysed: false });
        if (pendingCount >= 5) {
            console.log("Triggering Batch Optimiser. Pending Count threshold met.");
            batchOptimiser();
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