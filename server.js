const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const { JSDOM } = require('jsdom');
const sgMail = require('@sendgrid/mail');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

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

app.set('trust proxy', 1);

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
        res.status(200).json(results.summary); // Send only the summary to the frontend
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


// --- Core Application Logic ---
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
    
    return processResults(allPageResults);
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

// --- NEW: processResults function to create both summary and detailed report ---
function processResults(allPageResults) {
    const detailedReport = {};
    let totalPasses = 0;
    let totalChecks = 0;

    allPageResults.forEach(pageResult => {
        pageResult.checks.forEach(checkResult => {
            const { name, passed, details } = checkResult;
            if (!detailedReport[name]) {
                detailedReport[name] = { passedCount: 0, totalCount: 0, failures: [] };
            }
            detailedReport[name].totalCount++;
            totalChecks++;
            if (passed) {
                detailedReport[name].passedCount++;
                totalPasses++;
            } else {
                detailedReport[name].failures.push({ url: pageResult.url, details: details });
            }
        });
    });

    const averageScore = totalChecks > 0 ? Math.round((totalPasses / totalChecks) * 100) : 0;
    
    // Create a simplified summary for the frontend
    const summary = {
        averageScore,
        checkStats: Object.fromEntries(
            Object.entries(detailedReport).map(([name, data]) => [name, { passed: data.passedCount, total: data.totalCount }])
        )
    };
    
    return { summary, detailedReport, pagesCrawled: allPageResults.length };
}


// --- NEW: Completely rebuilt email report generator ---
async function sendEmailReport(url, results) {
    const { summary, detailedReport, pagesCrawled } = results;
    const { averageScore } = summary;

    let reportHtml = `
        <body style="font-family: Arial, sans-serif; line-height: 1.6;">
            <div style="max-width: 800px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                <h1 style="color: #3a0ca3;">GEO Inspection Report for ${url}</h1>
                <h2 style="color: #4361ee;">Overall Score: ${averageScore}/100</h2>
                <p><strong>Analyzed ${pagesCrawled} pages.</strong> Below is a detailed breakdown of each check.</p>
                <hr>
    `;

    for (const name in detailedReport) {
        const stats = detailedReport[name];
        const passPercent = Math.round((stats.passedCount / stats.totalCount) * 100);
        const icon = passPercent >= 75 ? '✔️' : '❌';
        const color = passPercent >= 75 ? 'green' : 'red';
        
        reportHtml += `<h3 style="color: ${color};">${icon} ${name} - Passed on ${stats.passedCount} of ${stats.totalCount} pages (${passPercent}%)</h3>`;
        
        if (stats.failures.length > 0) {
            reportHtml += `<p><strong>Details of Omissions/Errors:</strong></p><ul style="list-style-type: none; padding-left: 0;">`;
            stats.failures.forEach(failure => {
                reportHtml += `<li style="margin-bottom: 10px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">
                    <strong>Page:</strong> <a href="${failure.url}">${failure.url}</a><br>
                    <strong>Issue:</strong> ${failure.details}
                </li>`;
            });
            reportHtml += `</ul>`;
        }
        reportHtml += `<br>`;
    }
    
    reportHtml += `</div></body>`;
    
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


// --- Analysis helper functions are now updated to return detailed failure info ---

function findMenuLinks(doc, startUrl, crawledUrls) {
    // ... logic unchanged ...
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
        { name: 'Title Tag', ...checkTitleTag(doc) },
        { name: 'Meta Description', ...checkMetaDescription(doc) },
        { name: 'H1 Heading', ...checkH1Heading(doc) },
        { name: 'Mobile-Friendly Viewport', ...checkViewport(doc) },
        { name: 'Internal Linking', ...checkInternalLinks(doc, url) },
        { name: 'Image Alt Text', ...checkAltText(doc) },
        { name: 'Conversational Tone', ...checkConversationalTone(doc) },
        { name: 'Clear Structure (Lists)', ...checkLists(doc) },
        { name: 'Readability', ...checkReadability(textContent) },
        { name: 'Unique Data/Insights', ...checkUniqueData(doc, textContent) },
        { name: 'Author Byline/Bio', ...checkAuthor(doc) },
        { name: 'First-Hand Experience', ...checkExperience(textContent) },
        { name: 'Content Freshness', ...checkFreshness(doc, textContent) },
        { name: 'Contact Information', ...checkContact(doc) },
        { name: 'Outbound Links', ...checkOutboundLinks(doc, url) },
        { name: 'Cited Sources', ...checkCitations(textContent) },
        { name: 'Schema Found', ...checkSchemaFound(schemaTypes) },
        { name: 'Article or Org Schema', ...checkArticleOrgSchema(schemaTypes) },
        { name: 'FAQ or How-To Schema', ...checkFaqHowToSchema(schemaTypes) },
    ];
}

// --- NEW: Each check is now its own function returning a detailed object ---
function checkTitleTag(doc) { const passed = !!doc.querySelector('title')?.textContent; return { passed, details: passed ? 'OK' : 'No <title> tag found.' }; }
function checkMetaDescription(doc) { const passed = !!doc.querySelector('meta[name="description"]')?.content; return { passed, details: passed ? 'OK' : 'No <meta name="description"> tag found.' }; }
function checkH1Heading(doc) { const h1s = doc.querySelectorAll('h1').length; const passed = h1s === 1; return { passed, details: passed ? 'OK' : `Found ${h1s} <h1> tags (expected 1).` }; }
function checkViewport(doc) { const passed = !!doc.querySelector('meta[name="viewport"]'); return { passed, details: passed ? 'OK' : 'Missing <meta name="viewport"> tag.' }; }
function checkInternalLinks(doc, url) { const count = countInternalLinks(doc, url); const passed = count > 2; return { passed, details: passed ? 'OK' : `Found only ${count} internal links (recommend > 2).` }; }
function checkAltText(doc) { const images = Array.from(doc.querySelectorAll('img')); const missingAlt = images.filter(img => !img.alt || !img.alt.trim()); const passed = missingAlt.length === 0; return { passed, details: passed ? 'OK' : `Found ${missingAlt.length} images missing alt text. e.g., ${missingAlt.map(i => i.src).slice(0,2).join(', ')}` }; }
function checkConversationalTone(doc) { const headings = doc.querySelectorAll('h2, h3'); const questionWords = ['what', 'how', 'why', 'when', 'where', 'is', 'can', 'do', 'are', 'which', 'who', 'does', 'should']; const passed = Array.from(headings).some(h => { const headingText = h.textContent.trim().toLowerCase(); return questionWords.some(word => headingText.startsWith(word)); }); return { passed, details: passed ? 'OK' : 'No question-based subheadings (h2/h3) found.' }; }
function checkLists(doc) { const passed = doc.querySelectorAll('ul, ol').length > 0; return { passed, details: passed ? 'OK' : 'No bulleted or numbered lists found.' }; }
function checkReadability(text) { const sentences = text.match(/[^.!?]+[.!?]+/g) || []; const words = text.match(/\b\w+\b/g) || []; const score = (sentences.length === 0 || words.length === 0) ? 0 : words.length / sentences.length; const passed = score < 25 && score > 0; return { passed, details: passed ? `Good (Avg. ${score.toFixed(1)} words/sentence).` : `High (Avg. ${score.toFixed(1)} words/sentence). Recommend < 25.` }; }
function checkUniqueData(doc, text) { const passed = /our data|our research|we surveyed|according to our study|we analyzed|our findings show|in our analysis/i.test(text) || doc.querySelector('table'); return { passed, details: passed ? 'OK' : 'No signals of original data or research found.' }; }
function checkAuthor(doc) { const passed = !!doc.querySelector('a[href*="author/"], a[rel="author"]'); return { passed, details: passed ? 'OK' : 'No link to an author bio page found.' }; }
function checkExperience(text) { const passed = /in our test|hands-on|my experience|we visited|I found that|our team reviewed|we tested|firsthand|I personally|from my experience/i.test(text); return { passed, details: passed ? 'OK' : 'No phrases indicating first-hand experience found.' }; }
function checkFreshness(doc, text) { const passed = /updated|published/i.test(text) || !!doc.querySelector('meta[property*="time"]'); return { passed, details: passed ? 'OK' : 'No "published" or "last updated" date found.' }; }
function checkContact(doc) { const passed = !!doc.querySelector('a[href*="contact"], a[href*="about"]'); return { passed, details: passed ? 'OK' : 'No link to a Contact or About page found.' }; }
function checkOutboundLinks(doc, url) { const passed = hasOutboundLinks(doc, url); return { passed, details: passed ? 'OK' : 'No links to external websites found.' }; }
function checkCitations(text) { const passed = /source:|according to:|citation:/i.test(text); return { passed, details: passed ? 'OK' : 'No cited sources found.' }; }
function checkSchemaFound(types) { const passed = types.length > 0; return { passed, details: passed ? `Found: ${types.join(', ')}` : 'No Schema.org data found.' }; }
function checkArticleOrgSchema(types) { const passed = types.includes('Article') || types.includes('Organization'); return { passed, details: passed ? 'OK' : 'Missing essential Article or Organization schema.' }; }
function checkFaqHowToSchema(types) { const passed = types.includes('FAQPage') || types.includes('HowTo'); return { passed, details: passed ? 'OK' : 'Missing high-value FAQ or How-To schema.' }; }

function hasOutboundLinks(doc, url) { try { const pageHost = new URL(url).hostname; return Array.from(doc.querySelectorAll('a[href]')).some(link => { try { const linkHost = new URL(link.href).hostname; return linkHost && linkHost !== pageHost; } catch (e) { return false; } }); } catch (e) { return false; } }
function countInternalLinks(doc, url) { try { const pageHost = new URL(url).hostname; return Array.from(doc.querySelectorAll('a[href]')).filter(link => { try { const linkHost = new URL(link.href).hostname; return linkHost === pageHost; } catch (e) { return false; } }).length; } catch (e) { return 0; } }
function getSchemaTypes(doc) { const schemas = []; doc.querySelectorAll('script[type="application/ld+json"]').forEach(script => { try { const json = JSON.parse(script.textContent); const graph = json['@graph'] || [json]; graph.forEach(item => { if (item['@type']) { schemas.push(item['@type']); } }); } catch (e) { console.error("Error parsing JSON-LD:", e); } }); return schemas.flat(); }