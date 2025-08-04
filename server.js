const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors()); // Enable CORS for all routes

// --- IMPORTANT: Paste your ScraperAPI Key here ---
const SCRAPER_API_KEY = 'cae768c4539dd53786bc83bfb6fdd860'; // <--- PASTE YOUR KEY INSIDE THE QUOTES

// --- API Routes ---
app.get('/api/scrape', async (req, res) => {
    console.log('API endpoint /api/scrape was hit!');

    const { url } = req.query;
    if (!url) {
        return res.status(400).send('Please provide a URL parameter.');
    }

    if (!SCRAPER_API_KEY || SCRAPER_API_KEY === 'YOUR_API_KEY_HERE') {
        console.error('ScraperAPI Key is missing or is still the placeholder.');
        return res.status(500).send('Server is missing ScraperAPI Key.');
    }

    const scraperApiUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
    console.log(`Attempting to scrape via: ${scraperApiUrl}`);

    try {
        const response = await axios.get(scraperApiUrl, { timeout: 45000 });
        console.log('Successfully received response from ScraperAPI.');
        res.status(200).send(response.data);
    } catch (error) {
        console.error(`ScraperAPI error for ${url}:`, error.message);
        res.status(502).send('The scraping service failed to retrieve the URL.');
    }
});


// --- Frontend File Serving ---
// We now have an explicit route for each file. This is more reliable.

app.get('/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'style.css'));
});

app.get('/script.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'script.js'));
});

// The Root route for index.html MUST be the last one.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


app.listen(PORT, () => {
    console.log(`GEO Thrill-O-Meter server listening on port ${PORT}`);
});