// Required Packages
const axios = require('axios');
const cheerio = require('cheerio');

// Internal modules
const Incident = require('../models/incident');
const { getEmbedding, processBatchIncidents } = require('./aiService');

/** DISCLAIMER AND NOTICE OF COMPLIANCE :
 * This scraper is developed strictly for educational, non-commercial research purpose as part of academic coursework
 * for COMP3011 Web Services and Web Data of University of Leeds.
 * It is indended to simulate real-time user generated data for testing AI deduplicataion logic.
 * 1. Source Attribution: All traffic news data is property of Radio Television Hong Kong (RTHK).
 * 2. Identification: This crawler identifies itself via a custom User-Agent header.
 * 3. Ethics: To respect RTHK server resources, a 10-minute polling interval is enforced.
 * * This project is not affiliated with RTHK.
**/

async function scrapeAndConsolidate() {
    // Default: crawl only today's traffic incidents in Hong Kong Time.
    const { data } = await axios.get('https://programme.rthk.hk/channel/radio/trafficnews/index.php?d=20260307');
    const $ = cheerio.load(data);
    const tempBatch = [];

    // Locate and crawl information of all traffic incidents in container
    $('#content ul.dec li.inner').each((i, el) => {
        const fullText = $(el).text().trim();
        const dateText = $(el).find('div.date').text().trim();

        // Separate dateText from fullText
        const messageBody = fullText.replace(dateText, '').trim();

        // Push into list of new incidents
        if (messageBody) {
            tempBatch.push({
                rawText: messageBody,
                publishedAt: dateText
            });
        }
    });

    if (tempBatch.length > 0) {
        console.log(`${tempBatch.length} new records fetched.`)
        // Consult genAI and obtain JSON file to insert into database
        const consolidatedData = await processBatchIncidents(tempBatch);

        for (const item of consolidatedData) {
            // Check for duplicates
            const exists = await Incident.findOne({ title: item.title });

            if (!exists) {
                // Generate embedding for new title
                const vector = await getEmbedding(item.title);

                // Format the descriptions to ensure timestamps are valid Date objects
                const formattedDescriptions = item.description.map(desc => ({
                    text: desc.text,
                    timestamp: new Date(desc.timestamp)
                }));

                await Incident.create({
                    title: item.title,
                    type: item.type,
                    description: formattedDescriptions,
                    venue: item.venue,
                    district: item.district,
                    severity: item.severity,
                    status: item.status,
                    timestamp: new Date(item.timestamp),
                    embeddings: vector,
                    isAnalysed: true
                });
            }
            console.log(`New record: ${item.title}`);
        }
    }
}

module.exports = { scrapeAndConsolidate };