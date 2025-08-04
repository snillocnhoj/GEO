// A simple Node.js serverless function that acts as our own private proxy.
const axios = require('axios');

module.exports = async (req, res) => {
    // Get the target URL from the query string (e.g., /api/scrape?url=...)
    const { url } = req.query;

    if (!url) {
        res.status(400).send('Please provide a URL parameter.');
        return;
    }

    try {
        // Use axios to fetch the content of the target URL
        const response = await axios.get(url, {
            headers: {
                // Pretend to be a regular browser to avoid getting blocked
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        // Set CORS headers to allow our frontend to access this function
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        
        // Send the fetched HTML back to our frontend app
        res.status(200).send(response.data);

    } catch (error) {
        // If something goes wrong, send back an error status
        console.error(error);
        res.status(500).send(`Failed to fetch the URL: ${error.message}`);
    }
};