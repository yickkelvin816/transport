// Required Packages
const axios = require('axios');
const cheerio = require('cheerio');

// Internal modules
const Incident = require('../models/incident');
const { getEmbedding, processBatchIncidents } = require('./aiService');

const targetDate = new Date();

/** DISCLAIMER AND NOTICE OF COMPLIANCE :
 * This scraper is developed strictly for educational, non-commercial research purpose as part of academic coursework
 * for COMP3011 Web Services and Web Data of University of Leeds.
 * It is indended to simulate real-time user generated data for testing AI deduplicataion logic.
 * 1. Source Attribution: All traffic news data is property of Radio Television Hong Kong (RTHK).
 * 2. Identification: This crawler identifies itself via a custom User-Agent header.
 * 3. Ethics: To respect RTHK server resources, a 10-minute polling interval is enforced.
 * * This project is not affiliated with RTHK.
**/

async function scrapeAndConsolidate(dateString = "20260308") {
    // Default: crawl only today's traffic incidents in Hong Kong Time.
    console.log(`Scraper Service: fetching current traffic news... ${dateString}`);
    const { data } = await axios.get(`https://programme.rthk.hk/channel/radio/trafficnews/index.php?d=${dateString}`);
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
    console.log(`${tempBatch.length} new records fetched.`)

    if (tempBatch.length > 0) {
        // Consult genAI and obtain JSON file to insert into database

        const CHUNK_SIZE = 100;
        for (let i = 0; i < tempBatch.length; i += CHUNK_SIZE) {
            const chunk = tempBatch.slice(i, i + CHUNK_SIZE);
            console.log(`Processing chunk ${Math.floor(i / CHUNK_SIZE) + 1} of ${Math.ceil(tempBatch.length / CHUNK_SIZE)}...`);

            try {
                const consolidatedData = await processBatchIncidents(chunk);

                for (const item of consolidatedData) {
                    // Generate embedding for the incoming incident title
                    const vector = await getEmbedding(item.title);

                    // Create new incident. Assume each of the incidents is distinct.
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
                        embeddings: vector, // Store the vector for future comparisons
                        isAnalysed: true
                    });

                    console.log(`New record created: ${item.title}`);

                }
                console.log(`${consolidatedData.length} records added.`)
            } catch (aiError) {
                console.error("Chunk processing failed:", aiError.message);
            } finally {
                console.log(`Scapper service ends.`);
            }
        }
    }
}

module.exports = { scrapeAndConsolidate };