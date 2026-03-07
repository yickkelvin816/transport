// Required Packages
const express = require('express');
const router = express.Router();

// Internal modules
const Incident = require('../models/incident');
const { INCIDENT_TYPES, DISTRICTS, PRIORITY_LEVELS } = require('../config/constants');


// GET /api/incidents/
// Returns all incidents in reverse chronological order.
router.get('/', async (req, res) => {
    try {
        const result = await Incident.find().sort({ timestamp: -1 });
        if (!result) {
            res.status(400);
            res.json("No records");
        }
        res.json(result);
    } catch (err) {
        res.status(500);
        res.json({ message: err.message });
    }
})

// GET /api/incidents/live
// Returns all active incidents where the status is on-going or investigating, in reverse chronological order.
router.get('/live', async (req, res) => {
    try {
        const result = await Incident.find({ status: { $in: ['on-going', 'investigating'] } })
            .select('-embeddings -isAnalysed -__v')
            .sort({ timestamp: -1 });
        if (!result) {
            res.status(400);
            res.json("No records");
        }
        res.json(result);
    } catch (err) {
        res.status(500);
        res.json({ message: err.message });
    }
})

// GET /api/incidents/:id
// Retrieves a specific incident by Object ID
router.get('/:id', async (req, res) => {
    try {
        const result = await Incident.findById(req.params.id).select('-embeddings -isAnalysed -__v');
        if (!result) {
            res.status(404);
            res.json("No records");
        }
        res.json(result);
    } catch (err) {
        res.status(500);
        res.json({ "Error": "ObjectId must be in hexidecimal, and contains 24 characters." });
    }
})


// GET /api/incidents/archive/:yyyy/:mm?/:dd?/:field?
// Return historical records and/or statistical analysis on given data range, specific in URL segment.
router.get('/archive/:yyyy{/:mm}{/:dd}{/:field}', async (req, res) => {
    const paramsList = Object.values(req.params).filter(p => p !== undefined);

    let yyyy = paramsList[0];
    let mm = null;
    let dd = null;
    let field = null;

    const lastValue = paramsList[paramsList.length - 1];
    // check if last value is non-numeric string
    if (paramsList.length > 1 && isNaN(parseInt(lastValue))) {
        field = paramsList.pop();
    }
    mm = paramsList[1] || null;
    dd = paramsList[2] || null;

    let query;

    function isValidDate(y, m, d) {
        const year = parseInt(y);
        const month = (m && !isNaN(parseInt(m))) ? parseInt(m) - 1 : 0; // js months in list 0-11
        const day = (d && !isNaN(parseInt(d))) ? parseInt(d) : 1;
        const dateObj = new Date(year, month, day);
        return dateObj.getFullYear() === year && (m ? dateObj.getMonth() === month : true) && (d ? dateObj.getDate() === day : true);
    }

    // Date Validation
    if (!isValidDate(yyyy, mm, dd)) {
        res.status(400);
        res.json({ message: "Invalid date parameters. Please ensure the date format follows YYYY-MM-DD." });
    }
    let startDate, endDate;
    if (yyyy && mm && dd) {
        startDate = new Date(yyyy, mm - 1, dd, 0, 0, 0);
        endDate = new Date(yyyy, mm - 1, dd, 23, 59, 59);
    } else if (yyyy && mm) {
        startDate = new Date(yyyy, mm - 1, 1);
        endDate = new Date(yyyy, mm, 0, 23, 59, 59); // Last day of that month
    } else {
        startDate = new Date(yyyy, 0, 1);
        endDate = new Date(yyyy, 11, 31, 23, 59, 59);
    }
    query = { timestamp: { $gte: startDate, $lte: endDate } };

    // Field Validation
    if (field) {
        // Transform "Tai-Po" back to "Tai Po" for DB matching
        const formattedField = field.replace(/-/g, ' ');

        if (DISTRICTS.includes(formattedField)) {
            query = { district: formattedField };
        } else if (INCIDENT_TYPES.includes(formattedField)) {
            query = { type: formattedField };
        } else if (PRIORITY_LEVELS[field]) {
            query = { severity: PRIORITY_LEVELS[field] };
        } else if (field === 'summary') {
            const analytics = await Incident.aggregate([
                { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
                {
                    $facet: {
                        "topDistricts": [
                            { $group: { _id: "$district", count: { $sum: 1 } } },
                            { $sort: { count: -1 } },
                            { $limit: 3 }
                        ],
                        "commonTypes": [
                            { $group: { _id: "$type", count: { $sum: 1 } } },
                            { $sort: { count: -1 } },
                            { $limit: 3 }
                        ],
                        "avgSolveTime": [
                            { $match: { status: "cleared" } },
                            {
                                $addFields: {
                                    lastUpdate: { $arrayElemAt: ["$description.timestamp", -1] }
                                }
                            },
                            {
                                $project: {
                                    severityGroup: {
                                        $switch: {
                                            branches: [
                                                { case: { $lte: ["$severity", 2] }, then: "1-2" },
                                                { case: { $lte: ["$severity", 4] }, then: "3-4" }
                                            ],
                                            default: "5"
                                        }
                                    },
                                    duration: { $dateDiff: { startDate: "$timestamp", endDate: "$lastUpdate", unit: "minute" } }
                                }
                            },
                            { $group: { _id: "$severityGroup", avgMinutes: { $avg: "$duration" } } }
                        ]
                    }
                }
            ]);
            res.json(analytics);
            return;
        } else {
            res.status(400);
            res.json({ Error: "Invalid filter field" });
            return;
        }
    }

    const results = await Incident.find(query).select('-embeddings -isAnalysed -__v');
    if (!results) {
        res.status(400);
        res.json("No records");
    }
    res.json(results);
});

// POST /api/incidents/
// Create a new incident record
router.post('/', async (req, res) => {
    try {
        const incident = new Incident({
            title: req.body.title,
            type: req.body.type,
            description: req.body.description, // Expects [{timestamp, text}] send from HTTPRequest
            venue: req.body.venue,
            district: req.body.district,
            severity: req.body.severity,
            status: req.body.status || 'investigating', // Defaults to investigating 
            isAnalysed: false
        });

        const newIncident = await Incident.save();

        // Trigger batchOoptimiser if pending counts reach threshold
        const pendingCount = await Incident.countDocuments({ isAnalysed: false });
        if (pendingCount >= 5) {
            console.log("Triggering Batch Optimiser. Pending Count threshold met.");
            // batchOptimiser();
        }

        console.log(`Record INSERTED | Incident ID: ${newIncident.id} | IP: ${req.clientIP}`);
        res.status(200).json({ message: "Insert success.", ObjectID: newIncident.id, UpdateID: newIncident.description[0].id });
    } catch (err) {
        res.status(400);
        res.json({ message: "Validation failed", error: err.message });
    }
});

// DELETE /api/incidents/:id
// Manually delete a record by Object ID
router.delete('/:id', async (req, res) => {
    try {
        const result = await Incident.findByIdAndDelete(req.params.id);
        if (!result) {
            return res.status(404).json({ message: "Incident not found. Check your ObjectID." });
        }
        console.log(`Record DELETED. Incident ID: ${req.params.id} | IP: ${req.clientIP}`);
        res.json({ message: "Record deleted." });
    } catch (err) {
        res.status(500);
        res.json({ message: "Server error during deletion", error: err.message });
    }
});

// DELETE /api/incidents/:id/update/:updateId
// Manually delete an update of an incident by Object ID
router.delete('/:id/update/:updateId', async (req, res) => {
    try {
        const result = await Incident.findByIdAndUpdate(
            req.params.id,
            {
                $pull: { description: { _id: req.params.updateId } },
                $set: { isAnalysed: false }
            },
            { new: true }
        );

        if (!result) return res.status(404).json({ message: "Incident not found" });

        // If no descriptions left, delete the whole incident
        if (result.description.length < 1) {
            await Incident.findByIdAndDelete(req.params.id);
            console.log(`Record DELETED. ID: ${req.params.id} | IP: ${req.clientIp}`);
            return res.json({ message: "Incident removed (last update deleted)." });
        }

        console.log(`Update item DELETED. ID: ${req.params.id} | IP: ${req.clientIp}`);
        res.json({ message: "Update item removed." });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// PATCH /api/incidents/:id/update/:updateId
router.patch('/:id/update/:updateId', async (req, res) => {
    try {
        const { text } = req.body;

        const result = await Incident.findOneAndUpdate(
            { _id: req.params.id, "description._id": req.params.updateId },
            {
                $set: {
                    "description.$.text": text, // The '$' matches the correct array index
                    isAnalysed: false
                }
            },
            { new: true }
        );

        if (!result) return res.status(404).json({ message: "Incident or Update ID not found" });

        console.log(`Update item MODIFIED. ID: ${req.params.id} | IP: ${req.clientIp}`);
        res.json('Update item modified.');
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

























module.exports = router;