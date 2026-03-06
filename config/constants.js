module.exports = {
    DISTRICTS: [
        'Central and Western', 'Wan Chai', 'Eastern', 'Southern', 'Yau Tsim Mong',
        'Sham Shui Po', 'Kowloon City', 'Wong Tai Sin', 'Kwun Tong', 'Tsuen Wan',
        'Tuen Mun', 'Yuen Long', 'North', 'Tai Po', 'Sai Kung', 'Sha Tin',
        'Kwai Tsing', 'Islands', 'TBC'
    ],
    INCIDENT_TYPES: [
        'Accident', 'Vehicle Breakdown', 'Road Works', 'Emergency Repair',
        'Road Closure', 'Traffic Jam', 'Public Transport', 'Special Event',
        'Weather Related', 'TBC'
    ],
    PRIORITY_LEVELS: {
        'low-priority': { $lte: 2 },
        'mid-priority': { $eq: 3 },
        'high-priority': { $gte: 4 }
    },
    INCIDENT_STATUS: ['on-going', 'cleared', 'investigating']
};