// Internal modules
const { scrapeAndConsolidate } = require('../services/scraperService');

/**
 * Legacy function
 * This automated crawler extract the archived traffic news in fixed date range.
 */

async function loopDates(start, end) {
    let current = new Date(start);

    while (current <= end) {
        // 1. Convert to ISO (2025-03-01T00:00:00.000Z)
        // 2. Take the first 10 characters (2025-03-01)
        // 3. Remove all dashes using regex
        const pureNumericDate = current.toISOString().split('T')[0].replace(/-/g, '');
        console.log(`Handling date: ${pureNumericDate}`);
        await scrapeAndConsolidate(pureNumericDate);

        // Increment day
        current.setDate(current.getDate() + 1);
    }
}

module.exports = { loopDates };