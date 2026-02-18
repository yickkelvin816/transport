// Required Packages
const express = require('express');
const router = express.Router();

// Internal modules
const Incident = require('../models/incident')

// GET all records, sort by reverse chronological order
router.get('/', async (req, res) => {
    try {
        const result = await Incident.find().sort({ timestamp: -1 });
        res.json(result);
    } catch (err) {
        res.status(500);
        res.json({ message: err.message });
    }
})












module.exports = router;