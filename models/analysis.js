// Required Packages
const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema({
    district: { type: String, required: true },
    period: {
        year: { type: Number, required: true },
        month: { type: Number, required: true }
    },
    reliabilityScore: { type: Number, min: 0, max: 10 },
    summary: String,
    metrics: [{
        type: { type: String },
        avgResolutionTime: { type: Number },
        count: { type: Number }
    }],
    generatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Analysis", analysisSchema);