// Required Packages
const mongoose = require('mongoose');

// Internal modules
const { INCIDENT_TYPES, DISTRICTS } = require('../config/constants');

// Define Schema of trafficDB
const incidentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: INCIDENT_TYPES
    },
    description: [
        {
            timestamp: {
                type: Date
                //default: Date.now
            },
            text: {
                type: String,
                required: true
            }
        }
    ],
    venue: {
        type: String,
        required: true
    },
    district: {
        type: String,
        required: true,
        enum: DISTRICTS
    },
    severity: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    status: {
        type: String,
        enum: ['on-going', 'cleared', 'investigating'],
        default: 'investigating'
    },
    timestamp: {
        type: Date,
        default: Date.now
    }, // date and time of incident - first record

    // AI Optimisation Features
    embeddings: {
        type: [Number],
        default: []
    }, // vector representation
    isAnalysed: {
        type: Boolean,
        default: false
    } // flag for Batch Optimiser

})

// Optimization: Add a standard index for the flag to speed up batch processing
incidentSchema.index({ isAnalyzed: 1 });

module.exports = mongoose.model("Incident", incidentSchema);