const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// This route will handle the scraping logic
app.get('/api/scrape', async (req, res) => {
    const { url } = req.query;
    if (!url) {
        return res.status(400).send('Please provide a URL parameter.');
    }

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });
        res.status(200).send(response.data);
    } catch (error) {
        console.error(error);
        res.status(500).send(`Failed to fetch the URL: ${error.message}`);
    }
});

// This serves your frontend files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});