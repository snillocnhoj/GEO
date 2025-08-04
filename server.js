const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- IMPORTANT: Paste your ScraperAPI Key here ---
const SCRAPER_API_KEY = 'YOUR_API_KEY_HERE'; // <--- PASTE YOUR KEY INSIDE THE QUOTES

// --- API Routes ---

// Health check route
app.get('/health', (req, res) => {
    res.status(200).send('Server is awake and running!');
});

// The scraper route, now using ScraperAPI
app.get('/api/scrape', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send('Please provide a URL parameter.');
    }

    if (!SCRAPER_API_KEY || SCRAPER_API_KEY === 'cae768c4539dd53786bc83bfb6fdd860') {
        return res.status(500).send('Server is missing ScraperAPI Key.');
    }

    // Construct the request URL for ScraperAPI
    const scraperApiUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;

    try {
        const response = await axios.get(scraperApiUrl, { timeout: 45000 }); // Increased timeout for the API
        res.status(200).send(response.data);
    } catch (error) {
        console.error(`ScraperAPI error for ${url}:`, error.message);
        res.status(502).send('The scraping service failed to retrieve the URL.');
    }
});


// --- Frontend Serving ---
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.listen(PORT, () => {
    console.log(`GEO Thrill-O-Meter server listening on port ${PORT}`);
});