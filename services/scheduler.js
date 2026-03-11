// Internal modules
const { SCRAPE_INTERVAL, ANALYSIS_CHECK_INTERVAL } = require('../config/intervals');
const { scrapeAndConsolidate } = require('./scraperService');
const { analyzeMonthlyTrafficPatterns } = require('./aiAnalysis');
const { DISTRICTS } = require('../config/constants');

const startSchedulers = () => {
    console.log("Transport Analytics Schedulers Initialized...");

    // 1. Regular Traffic News Scraper
    setInterval(async () => {
        console.log(`[Scheduled Task]: Scraping RTHK Traffic News at ${new Date().toLocaleTimeString()}`);
        await scrapeAndConsolidate();
    }, SCRAPE_INTERVAL);

    // 2. Monthly AI Analysis Trigger (Logical Check)
    // Runs once an hour to check if the "trigger conditions" are met
    // Assume all previous records exists.
    setInterval(async () => {
        const now = new Date();

        // Trigger ONLY on the 1ST of the month at midnight (0:00 - 0:59)
        if (now.getDate() === 1 && now.getHours() === 0) {
            // Calculate previous month details
            const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
            const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

            console.log(`[Trigger]: 1st of month detected. Starting batch analysis for ${lastMonth}/${year}...`);

            // Loop through districts to generate unique reliability reports
            for (const district of DISTRICTS) {
                try {
                    await analyzeMonthlyTrafficPatterns(district, year, lastMonth);
                } catch (err) {
                    console.error(`Failed analysis for ${district}:`, err);
                }
            }
            console.log("All district analyses complete for the month.");
        }
    }, ANALYSIS_CHECK_INTERVAL);
};

module.exports = { startSchedulers };