const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const { JSDOM } = require('jsdom');
const sgMail = require('@sendgrid/mail');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// --- THIS IS THE FIX ---
// This tells Express to trust the 'X-Forwarded-For' header from Render's proxy.
app.set('trust proxy', 1);
// --- END OF FIX ---


// --- API KEYS ARE READ SECURELY FROM THE ENVIRONMENT ---
const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;
const TO_EMAIL = process.env.TO_EMAIL;

if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
}

// --- Middleware ---
app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, 
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
});

// --- API Routes ---
app.post('/api/analyze', apiLimiter, async (req, res) => {
    if (!SCRAPINGBEE_API_KEY || !SENDGRID_API_KEY || !FROM_EMAIL || !TO_EMAIL) {
        console.error('One or more environment variables are not set on the server.');
        return res.status(500).json({ error: 'Server is not configured correctly.' });
    }
    
    const { startUrl } = req.body;
    if (!startUrl) {
        return res.status(400).json({ error: 'startUrl is required' });
    }

    console.log(`Starting analysis for: ${startUrl}`);
    
    try {
        const results = await crawlSite(startUrl);
        sendEmailReport(startUrl, results).catch(console.error);
        res.status(200).json(results);
    } catch (error) {
        console.error(`Analysis failed for ${startUrl}:`, error);
        res.status(500).json({ error: 'Failed to complete analysis.' });
    }
});


// --- Frontend File Serving ---
app.get('/style.css', (req, res) => { res.sendFile(path.join(__dirname, 'style.css')); });
app.get('/script.js', (req, res) => { res.sendFile(path.join(__dirname, 'script.js')); });
app.get('/logo.png', (req, res) => { res.sendFile(path.join(__dirname, 'logo.png')); });
app.get('/john-photo.png', (req, res) => { res.sendFile(path.join(__dirname, 'john-photo.png')); });
app.get('/twilight-skyline.png', (req, res) => { res.sendFile(path.join(__dirname, 'twilight-skyline.png')); });
app.get('/score-tower.png', (req, res) => { res.sendFile(path.join(__dirname, 'score-tower.png')); });
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.listen(PORT, () => {
    console.log(`GEO Thrill-O-Meter server listening on port ${PORT}`);
});


// --- Core Application Logic (Unchanged) ---
async function crawlSite(startUrl) {
    const allPageResults = [];
    const siteOrigin = new URL(startUrl).origin;
    const homePageHtml = await fetchHtml(startUrl);
    const homePageDom = new JSDOM(homePageHtml);
    const homePageDoc = homePageDom.window.document;
    allPageResults.push({ url: startUrl, checks: runAllChecks(homePageDoc, startUrl) });
    const crawledUrls = new Set([startUrl]);
    const menuUrlsToCrawl = findMenuLinks(homePageDoc, startUrl, crawledUrls);
    for (const url of menuUrlsToCrawl) {
        if (crawledUrls.size >= 10) break;
        if (crawledUrls.has(url)) continue;
        try {
            crawledUrls.add(url);
            const pageHtml = await fetchHtml(url);
            const pageDom = new JSDOM(pageHtml);
            const pageDoc = pageDom.window.document;
            allPageResults.push({ url: url, checks: runAllChecks(pageDoc, url) });
        } catch (error) {
            console.error(`Failed to crawl menu page ${url}:`, error.message);
        }
    }
    return calculateFinalResults(allPageResults);
}

async function fetchHtml(url) {
    const scraperUrl = 'https://app.scrapingbee.com/api/v1/';
    const params = {
        api_key: SCRAPINGBEE_API_KEY,
        url: url,
    };
    const response = await axios.get(scraperUrl, { params: params, timeout: 45000 });
    return response.data;
}

function calculateFinalResults(allPageResults) {
    const checkStats = {};
    let totalPasses = 0, totalChecks = 0;
    allPageResults.forEach(result => {
        result.checks.forEach(check => {
            if (!checkStats[check.name]) {
                checkStats[check.name] = { passed: 0, total: 0, passedOn: [], failedOn: [] };
            }
            checkStats[check.name].total++;
            totalChecks++;
            if (check.passed) {
                checkStats[check.name].passed++;
                totalPasses++;
                checkStats[check.name].passedOn.push(result.url);
            } else {
                checkStats[check.name].failedOn.push(result.url);
            }
        });
    });
    const averageScore = totalChecks > 0 ? Math.round((totalPasses / totalChecks) * 100) : 0;
    return { averageScore, checkStats, pagesCrawled: allPageResults.length };
}

async function sendEmailReport(url, results) {
    const { averageScore, checkStats, pagesCrawled } = results;
    let reportHtml = `<h1>GEO Inspection Report for ${url}</h1><h2>Overall Score: ${averageScore}/100</h2><p>Analyzed ${pagesCrawled} pages.</p><hr>`;
    for (const name in checkStats) {
        const stats = checkStats[name];
        const passPercent = Math.round((stats.passed / stats.total) * 100);
        const icon = passPercent >= 75 ? '✔️' : '❌';
        reportHtml += `<h3>${icon} ${name} - Passed on ${stats.passed} of ${stats.total} pages (${passPercent}%)</h3>`;
        if (stats.failedOn.length > 0) {
            reportHtml += `<p><strong>Omissions/Errors found on:</strong></p><ul>`;
            stats.failedOn.forEach(pageUrl => { reportHtml += `<li><a href="${pageUrl}">${pageUrl}</a></li>`; });
            reportHtml += `</ul>`;
        }
        reportHtml += `<br>`;
    }
    const msg = { to: TO_EMAIL, from: FROM_EMAIL, subject: `New GEO App Report: ${url} (Score: ${averageScore})`, html: reportHtml };
    try {
        await sgMail.send(msg);
        console.log(`Email report for ${url} sent successfully.`);
    } catch (error) {
        console.error('Error sending email report:', error.toString());
    }
}

function findMenuLinks(doc, startUrl, crawledUrls) {
    const navLinkSelectors = 'nav a, [id*="nav"] a, [id*="menu"] a, [class*="nav"] a, [class*="menu"] a';
    const links = new Set();
    const siteOrigin = new URL(startUrl).origin;
    doc.querySelectorAll(navLinkSelectors).forEach(link => {
        try {
            const href = link.getAttribute('href');
            if (!href || href.startsWith('#')) return;
            const urlObject = new URL(href, startUrl);
            urlObject.hash = '';
            const cleanUrl = urlObject.href;
            if (cleanUrl.startsWith(siteOrigin) && !crawledUrls.has(cleanUrl)) {
                links.add(cleanUrl);
            }
        } catch (e) { /* Ignore invalid hrefs */ }
    });
    return Array.from(links);
}

function runAllChecks(doc, url) {
    const textContent = doc.body.textContent || "";
    const schemaTypes = getSchemaTypes(doc);
    return [
        { name: 'Title Tag', passed: !!doc.querySelector('title')?.textContent },
        { name: 'Meta Description', passed: !!doc.querySelector('meta[name="description"]')?.content },
        { name: 'H1 Heading', passed: doc.querySelectorAll('h1').length === 1 },
        { name: 'Mobile-Friendly Viewport', passed: !!doc.querySelector('meta[name="viewport"]') },
        { name: 'Internal Linking', passed: countInternalLinks(doc, url) > 2 },
        { name: 'Image Alt Text', passed: checkAltText(doc) },
        { name: 'Conversational Tone', passed: checkConversationalTone(doc) },
        { name: 'Clear Structure (Lists)', passed: doc.querySelectorAll('ul, ol').length > 0 },
        { name: 'Readability', passed: checkReadability(textContent) },
        { name: 'Unique Data/Insights', passed: /our data|our research|we surveyed|according to our study|we analyzed|our findings show|in our analysis/i.test(textContent) || doc.querySelector('table') },
        { name: 'Author Byline/Bio', passed: !!doc.querySelector('a[href*="author/"], a[rel="author"]') },
        { name: 'First-Hand Experience', passed: /in our test|hands-on|my experience|we visited|I found that|our team reviewed|we tested|firsthand|I personally|from my experience/i.test(textContent) },
        { name: 'Content Freshness', passed: /updated|published/i.test(textContent) || !!doc.querySelector('meta[property*="time"]') },
        { name: 'Contact Information', passed: !!doc.querySelector('a[href*="contact"], a[href*="about"]') },
        { name: 'Outbound Links', passed: checkOutboundLinks(doc, url) },
        { name: 'Cited Sources', passed: /source:|according to:|citation:/i.test(textContent) },
        { name: 'Schema Found', passed: schemaTypes.length > 0 },
        { name: 'Article or Org Schema', passed: schemaTypes.includes('Article') || schemaTypes.includes('Organization') },
        { name: 'FAQ or How-To Schema', passed: schemaTypes.includes('FAQPage') || schemaTypes.includes('HowTo') },
    ];
}

function checkAltText(doc) { const images = Array.from(doc.querySelectorAll('img')); if (images.length === 0) return true; return images.every(img => img.alt && img.alt.trim() !== ''); }
function checkConversationalTone(doc) { const headings = doc.querySelectorAll('h2, h3'); const questionWords = ['what', 'how', 'why', 'when', 'where', 'is', 'can', 'do', 'are', 'which', 'who', 'does', 'should']; return Array.from(headings).some(h => { const headingText = h.textContent.trim().toLowerCase(); return questionWords.some(word => headingText.startsWith(word)); }); }
function checkOutboundLinks(doc, url) { try { const pageHost = new URL(url).hostname; return Array.from(doc.querySelectorAll('a[href]')).some(link => { try { const linkHost = new URL(link.href).hostname; return linkHost && linkHost !== pageHost; } catch (e) { return false; } }); } catch (e) { return false; } }
function countInternalLinks(doc, url) { try { const pageHost = new URL(url).hostname; return Array.from(doc.querySelectorAll('a[href]')).filter(link => { try { const linkHost = new URL(link.href).hostname; return linkHost === pageHost; } catch (e) { return false; } }).length; } catch (e) { return 0; } }
function checkReadability(text) { const sentences = text.match(/[^.!?]+[.!?]+/g) || []; const words = text.match(/\b\w+\b/g) || []; if (sentences.length === 0 || words.length === 0) return true; return words.length / sentences.length < 25; }
function getSchemaTypes(doc) { const schemas = []; doc.querySelectorAll('script[type="application/ld+json"]').forEach(script => { try { const json = JSON.parse(script.textContent); const graph = json['@graph'] || [json]; graph.forEach(item => { if (item['@type']) { schemas.push(item['@type']); } }); } catch (e) { console.error("Error parsing JSON-LD:", e); } }); return schemas.flat(); }