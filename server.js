const express = require('express');
const axios =require('axios');
const path = require('path');
const cors = require('cors');
const { JSDOM } = require('jsdom');
const sgMail = require('@sendgrid/mail');

const app = express();
const PORT = process.env.PORT || 3000;

// --- API KEYS ARE READ SECURELY FROM THE ENVIRONMENT ---
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;
const TO_EMAIL = process.env.TO_EMAIL;

// Configure SendGrid once at the start
if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
}

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- API Routes ---
app.post('/api/analyze', async (req, res) => {
    if (!SCRAPER_API_KEY || !SENDGRID_API_KEY || !FROM_EMAIL || !TO_EMAIL) {
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
        // We don't wait for the email to send before responding to the user
        sendEmailReport(startUrl, results).catch(console.error);
        res.status(200).json(results);
    } catch (error) {
        console.error(`Analysis failed for ${startUrl}:`, error);
        res.status(500).json({ error: 'Failed to complete analysis.' });
    }
});


// --- CORRECTED FRONTEND FILE SERVING ---
// This section now correctly serves your files from the root directory.

app.get('/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'style.css'));
});

app.get('/script.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'script.js'));
});

// The Root route for index.html MUST be the last frontend route.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
// --- END OF CORRECTION ---


app.listen(PORT, () => {
    console.log(`GEO Thrill-O-Meter server listening on port ${PORT}`);
});


// --- Core Application Logic (Now on the Server) ---

async function crawlSite(startUrl) {
    const allPageResults = [];
    const siteOrigin = new URL(startUrl).origin;
    
    const homePageHtml = await fetchHtml(startUrl);
    const homePageDom = new JSDOM(homePageHtml);
    const homePageDoc = homePageDom.window.document;
    
    allPageResults.push({
        url: startUrl,
        checks: runAllChecks(homePageDoc, startUrl)
    });
    
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
            allPageResults.push({
                url: url,
                checks: runAllChecks(pageDoc, url)
            });
        } catch (error) {
            console.error(`Failed to crawl menu page ${url}:`, error.message);
        }
    }
    
    return calculateFinalResults(allPageResults);
}

async function fetchHtml(url) {
    const scraperApiUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`;
    const response = await axios.get(scraperApiUrl, { timeout: 45000 });
    return response.data;
}

function calculateFinalResults(allPageResults) {
    const checkStats = {};
    let totalPasses = 0;
    let totalChecks = 0;

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


// --- Email Reporting Function ---
async function sendEmailReport(url, results) {
    const { averageScore, checkStats, pagesCrawled } = results;
    
    let reportHtml = `<h1>GEO Inspection Report for ${url}</h1>`;
    reportHtml += `<h2>Overall Score: ${averageScore}/100</h2>`;
    reportHtml += `<p>Analyzed ${pagesCrawled} pages.</p><hr>`;

    for (const name in checkStats) {
        const stats = checkStats[name];
        const passPercent = Math.round((stats.passed / stats.total) * 100);
        const icon = passPercent >= 75 ? '✔️' : '❌';
        
        reportHtml += `<h3>${icon} ${name} - Passed on ${stats.passed} of ${stats.total} pages (${passPercent}%)</h3>`;
        if (stats.failedOn.length > 0) {
            reportHtml += `<p><strong>Omissions/Errors found on:</strong></p><ul>`;
            stats.failedOn.forEach(pageUrl => {
                reportHtml += `<li><a href="${pageUrl}">${pageUrl}</a></li>`;
            });
            reportHtml += `</ul>`;
        }
        reportHtml += `<br>`;
    }
    
    const msg = {
        to: TO_EMAIL,
        from: FROM_EMAIL,
        subject: `New GEO App Report: ${url} (Score: ${averageScore})`,
        html: reportHtml,
    };

    try {
        await sgMail.send(msg);
        console.log(`Email report for ${url} sent successfully.`);
    } catch (error) {
        console.error('Error sending email report:', error.toString());
    }
}


// --- Analysis helper functions ---
function findMenuLinks(e,t,n){const o='nav a, [id*="nav"] a, [id*="menu"] a, [class*="nav"] a, [class*="menu"] a',r=new Set,s=new URL(t).origin;return e.querySelectorAll(o).forEach(e=>{try{const o=e.getAttribute("href");if(!o||o.startsWith("#"))return;const a=new URL(o,t).href;a.startsWith(s)&&!n.has(a)&&r.add(a)}catch(e){}}),Array.from(r)}
function runAllChecks(e,t){const n=e.body.textContent||"",o=getSchemaTypes(e);return[{name:"Title Tag",passed:!!e.querySelector("title")?.textContent},{name:"Meta Description",passed:!!e.querySelector('meta[name="description"]')?.content},{name:"H1 Heading",passed:1===e.querySelectorAll("h1").length},{name:"Mobile-Friendly Viewport",passed:!!e.querySelector('meta[name="viewport"]')},{name:"Internal Linking",passed:countInternalLinks(e,t)>2},{name:"Image Alt Text",passed:checkAltText(e)},{name:"Conversational Tone",passed:checkConversationalTone(e)},{name:"Clear Structure (Lists)",passed:e.querySelectorAll("ul, ol").length>0},{name:"Readability",passed:checkReadability(n)},{name:"Unique Data/Insights",passed:/our data|our research|we surveyed/i.test(n)||e.querySelector("table")},{name:"Author Byline/Bio",passed:!!e.querySelector('a[href*="author/"], a[rel="author"]')},{name:"First-Hand Experience",passed:/in our test|hands-on|my experience|we visited/i.test(n)},{name:"Content Freshness",passed:/updated|published/i.test(n)||!!e.querySelector('meta[property*="time"]')},{name:"Contact Information",passed:!!e.querySelector('a[href*="contact"], a[href*="about"]')},{name:"Outbound Links",passed:checkOutboundLinks(e,t)},{name:"Cited Sources",passed:/source:|according to:|citation:/i.test(n)},{name:"Schema Found",passed:o.length>0},{name:"Article or Org Schema",passed:o.includes("Article")||o.includes("Organization")},{name:"FAQ or How-To Schema",passed:o.includes("FAQPage")||o.includes("HowTo")}]}
function checkAltText(e){const t=Array.from(e.querySelectorAll("img"));return 0===t.length||t.every(e=>e.alt&&""!==e.alt.trim())}
function checkConversationalTone(e){const t=e.querySelectorAll("h2, h3"),n=["what","how","why","when","where","is","can","do"];return Array.from(t).some(e=>{const t=e.textContent.trim().toLowerCase();return n.some(n=>t.startsWith(n))})}
function checkOutboundLinks(e,t){try{const n=new URL(t).hostname;return Array.from(e.querySelectorAll("a[href]")).some(e=>{try{const t=new URL(e.href).hostname;return t&&t!==n}catch(e){return!1}})}catch(e){return!1}}
function countInternalLinks(e,t){try{const n=new URL(t).hostname;return Array.from(e.querySelectorAll("a[href]")).filter(e=>{try{const t=new URL(e.href).hostname;return t===n}catch(e){return!1}}).length}catch(e){return 0}}
function checkReadability(e){const t=e.match(/[^.!?]+[.!?]+/g)||[],n=e.match(/\b\w+\b/g)||[];if(0===t.length||0===n.length)return!0;return n.length/t.length<25}
function getSchemaTypes(e){const t=[];return e.querySelectorAll('script[type="application/ld+json"]').forEach(n=>{try{const o=JSON.parse(n.textContent),r=o["@graph"]||[o];r.forEach(e=>{e["@type"]&&t.push(e["@type"])})}catch(e){console.error("Error parsing JSON-LD:",e)}}),t.flat()}