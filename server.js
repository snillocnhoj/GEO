const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- API Routes ---
// This section is now explicitly first to ensure these routes are matched before the frontend files.

// Health check route to wake up the server and test if it's running.
app.get('/health', (req, res) => {
    res.status(200).send('Server is awake and running!');
});

// The scraper route.
app.get('/api/scrape', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send('Please provide a URL parameter.');
    }

    try {
        const response = await axios.get(url, {
            timeout: 15000, // Add a 15-second timeout to the scrape request
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        res.status(200).send(response.data);
    } catch (error) {
        console.error(`Error fetching ${url}:`, error.message);
        // Provide a more specific error message back to the frontend
        if (error.code === 'ECONNABORTED') {
            res.status(504).send('The request to the target website timed out.');
        } else {
            res.status(502).send(`Failed to fetch the URL. The server may be blocking requests.`);
        }
    }
});


// --- Frontend Serving ---
// This section now comes after all API routes are defined.

// Serve the static files from the 'public' folder.
app.use(express.static(path.join(__dirname, 'public')));

// A "catch-all" route to send users to the index.html page for any other request.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.listen(PORT, () => {
    console.log(`GEO Thrill-O-Meter server listening on port ${PORT}`);
});