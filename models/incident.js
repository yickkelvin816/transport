// Required Packages
const mongoose = require('mongoose');

// Define Schema of trafficDB
const incidentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            'Accident',            // Traffic accidents (Minor/Major)
            'Vehicle Breakdown',   // 壞車 (Very common in tunnels/bridges)
            'Road Works',          // 道路工程 / 渠務工程
            'Emergency Repair',    // 水管爆裂 / 緊急維修
            'Road Closure',        // 封路 (Usually for events or major repairs)
            'Traffic Jam',         // 交通擠塞 (Purely volume-related, no specific incident)
            'Public Transport',    // MTR/Bus delays or special service notices
            'Special Event',       // 年宵 / 煙花 / 馬拉松 (Planned events)
            'Weather Related',     // Flooding / Landslide / Strong Wind measures
            'Others'
        ]
    },
    description: [
        {
            timestamp: {
                type: Date,
                default: Date.now
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
        enum: [
            'Central and Western', 'Wan Chai', 'Eastern', 'Southern', 'Yau Tsim Mong',
            'Sham Shui Po', 'Kowloon City', 'Wong Tai Sin', 'Kwun Tong', 'Tsuen Wan',
            'Tuen Mun', 'Yuen Long', 'North', 'Tai Po', 'Sai Kung', 'Sha Tin',
            'Kwai Tsing', 'Islands'
        ]
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