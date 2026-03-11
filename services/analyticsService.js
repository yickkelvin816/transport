// Internal modules
const Incident = require('../models/incident');


// Fetch Historical Context for the last 12 months
async function getDistrictHistoricalContext(targetDistrict) {
    try {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const districtHistory = await Incident.aggregate([
            {
                $match: {
                    district: targetDistrict, // Filter by the district in the user's route
                    timestamp: { $gte: oneYearAgo }
                }
            },
            {
                $facet: {
                    "yearlySummary": [
                        {
                            $group: {
                                _id: null,
                                totalIncidents: { $sum: 1 },
                                avgDistrictResolveTime: {
                                    $avg: {
                                        $cond: [
                                            { $eq: ["$status", "cleared"] },
                                            {
                                                $dateDiff: {
                                                    startDate: "$timestamp",
                                                    endDate: { $arrayElemAt: ["$description.timestamp", -1] },
                                                    unit: "minute"
                                                }
                                            },
                                            null
                                        ]
                                    }
                                }
                            }
                        }
                    ],
                    "topAccidentTypes": [
                        {
                            $addFields: {
                                lastUpdate: { $arrayElemAt: ["$description.timestamp", -1] }
                            }
                        },
                        {
                            $group: {
                                _id: "$type",
                                count: { $sum: 1 },
                                avgResolveTime: {
                                    $avg: {
                                        $cond: [
                                            { $eq: ["$status", "cleared"] },
                                            { $dateDiff: { startDate: "$timestamp", endDate: "$lastUpdate", unit: "minute" } },
                                            null
                                        ]
                                    }
                                }
                            }
                        },
                        { $sort: { count: -1 } },
                        { $limit: 5 }
                    ]
                }
            }
        ]);
        return districtHistory
    }
    catch (err) {
        console.error(`Database Search Helper Error (${targetDistrict}):`, err);
        throw err;
    }
}

module.exports = { getDistrictHistoricalContext };