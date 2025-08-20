const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const { JSDOM } = require('jsdom');
const sgMail = require('@sendgrid/mail');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { runAllChecks } = require('./analyzer-checks.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// --- In-memory cache for reports ---
const reportCache = new Map();

// --- API KEYS & CONFIGURATION ---
const SCRAPER_API_KEY = process.env.SCRAPER_API_KEY;
const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;
const TO_EMAIL = process.env.TO_EMAIL;
const SCRAPER_SERVICE = process.env.SCRAPER_SERVICE || 'scrapingbee';

if (SENDGRID_API_KEY) { sgMail.setApiKey(SENDGRID_API_KEY); }

// --- Middleware ---
app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: 'Too many requests, please try again after 15 minutes' });

// --- API Routes ---
app.post('/api/analyze', apiLimiter, async (req, res) => {
    const scraperKeyMissing = (SCRAPER_SERVICE === 'scraperapi' && !SCRAPER_API_KEY) || (SCRAPER_SERVICE === 'scrapingbee' && !SCRAPINGBEE_API_KEY);
    if (scraperKeyMissing || !SENDGRID_API_KEY || !FROM_EMAIL || !TO_EMAIL) {
        console.error('One or more environment variables are not set on the server.');
        return res.status(500).json({ error: 'Server is not configured correctly.' });
    }
    const { startUrl } = req.body;
    if (!startUrl) { return res.status(400).json({ error: 'startUrl is required' }); }
    console.log(`Starting analysis for: ${startUrl}`);
    try {
        const results = await crawlSite(startUrl);
        const reportId = uuidv4();
        reportCache.set(reportId, { report: results, url: startUrl });
        setTimeout(() => reportCache.delete(reportId), 86400000);
        res.status(200).json({ summary: results.summary, reportId: reportId });
    } catch (error) {
        console.error(`Analysis failed for ${startUrl}:`, error);
        res.status(500).json({ error: 'Failed to complete analysis. The URL may be invalid or the site may be blocking automated tools.' });
    }
});

app.post('/api/send-report', async (req, res) => {
    const { reportId, userEmail } = req.body;
    if (!reportId || !reportCache.has(reportId)) {
        return res.status(404).send('Report not found or expired.');
    }
    if (!userEmail) {
        return res.status(400).send('Email address is required.');
    }
    const { report, url } = reportCache.get(reportId);
    try {
        const origin = `${req.protocol}://${req.get('host')}`;
        await sendEmailReport(url, report, userEmail, origin);
        res.status(200).send('Report sent successfully.');
    } catch (error) {
        res.status(500).send('Failed to send email.');
    }
});

// --- Frontend File Serving ---
app.use(express.static(__dirname));
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

app.listen(PORT, () => {
    console.log(`GEO Thrill-O-Meter server listening on port ${PORT}`);
});

// --- Core Application Logic ---

async function crawlSite(startUrl) {
    const allPageResults = [];
    const siteOrigin = new URL(startUrl).origin;

    const homePageHtml = await fetchHtml(startUrl);
    const homePageDom = new JSDOM(homePageHtml, { url: startUrl });
    const homePageDoc = homePageDom.window.document;
    allPageResults.push({ url: startUrl, checks: runAllChecks(homePageDoc, startUrl) });

    const crawledUrls = new Set([startUrl]);
    const menuUrlsToCrawl = findMenuLinks(homePageDoc, startUrl, crawledUrls).slice(0, 9);

    const pagePromises = menuUrlsToCrawl.map(url => {
        return (async () => {
            if (crawledUrls.has(url)) return null;
            crawledUrls.add(url);
            try {
                const pageHtml = await fetchHtml(url);
                const pageDom = new JSDOM(pageHtml, { url: url });
                const pageDoc = pageDom.window.document;
                return { url: url, checks: runAllChecks(pageDoc, url) };
            } catch (error) {
                console.error(`Failed to crawl or process page ${url}:`, error.message);
                return null;
            }
        })();
    });

    const additionalResults = await Promise.all(pagePromises);
    const finalResults = allPageResults.concat(additionalResults.filter(result => result !== null));

    return processResults(finalResults);
}

// THIS IS THE UPDATED FUNCTION
async function fetchHtml(url) {
    console.log(`Using scraper service: ${SCRAPER_SERVICE}`);
    try {
        if (SCRAPER_SERVICE === 'scraperapi') {
            if (!SCRAPER_API_KEY) throw new Error('ScraperAPI key is not configured.');
            // ADDED '&wait=2000' to wait 2 seconds for animations to finish
            const scraperApiUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}&render=true&wait=2000`;
            const response = await axios.get(scraperApiUrl, { timeout: 60000 });
            return response.data;
        }
        // Default to scrapingbee
        if (!SCRAPINGBEE_API_KEY) throw new Error('ScrapingBee key is not configured.');
        const scraperUrl = 'https://app.scrapingbee.com/api/v1/';
        const params = {
            api_key: SCRAPINGBEE_API_KEY,
            url: url,
            render_js: true,
            // ADDED THIS PARAMETER to wait 2 seconds for animations to finish
            wait_for: 2000
        };
        const response = await axios.get(scraperUrl, { params: params, timeout: 60000 });
        return response.data;
    } catch (error) {
        console.error(`Failed to fetch HTML for ${url}:`, error.response ? error.response.data : error.message);
        throw new Error(`Could not fetch HTML from ${url}. The site may be blocking scrapers or returning an error.`);
    }
}

function processResults(allPageResults) {
    const detailedReport = {};
    let totalPasses = 0, totalChecks = 0;
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
    const summary = {
        averageScore,
        checkStats: Object.fromEntries(
            Object.entries(detailedReport).map(([name, data]) => [name, { passed: data.passedCount, total: data.totalCount }])
        )
    };
    return { summary, detailedReport, pagesCrawled: allPageResults.length };
}

const REPORT_DETAILS = {
    "Title Tag": { what: "The presence of a `&lt;title&gt;` tag in the page's HTML code.", why: "This is the primary title of your webpage shown in browser tabs and search results. It is the single most important signal to all search engines about the page's core topic." },
    "Meta Description": { what: "A `&lt;meta name=\"description\"&gt;` tag in the page's code.", why: "This provides the short summary that appears under your title in search results. A compelling description encourages clicks and gives generative AI a quick, clear summary of the page's purpose." },
    "H1 Heading": { what: "Checks that there is one, and *only one*, `&lt;h1&gt;` tag on the page.", why: "The `&lt;h1&gt;` is the main headline of your on-page content. Having exactly one reinforces the page's main topic for AI crawlers and helps them understand the content's hierarchy." },
    "Mobile-Friendly Viewport": { what: "The presence of the `&lt;meta name=\"viewport\"&gt;` tag.", why: "This tag signals that your site is designed to work well on mobile devices. User experience is a critical factor, and AI engines prioritize content from sites that are accessible and easy to use for everyone." },
    "Internal Linking": { what: "Counts links that point to other pages on the same website. The check passes if there are more than two.", why: "Good internal linking helps AI discover more of your content and understand how different topics on your site are related, establishing your overall authority on a subject." },
    "Image Alt Text": { what: "Checks if every `&lt;img&gt;` tag has a non-empty `alt` attribute.", why: "AI cannot 'see' images. Alt text provides a literal description, giving crucial context about the image that helps the AI better understand the page's topic." },
    "Conversational Tone": { what: "Scans subheadings (`&lt;h2&gt;`, `&lt;h3&gt;`) for question-based words OR checks for significant use of second-person pronouns ('you', 'your').", why: "Generative search is designed to answer questions. Structuring your content conversationally makes it incredibly easy for an AI to select your content as a direct answer." },
    "Clear Structure (Lists)": { what: "The presence of bulleted (`&lt;ul&gt;`) or numbered (`&lt;ol&gt;`) lists.", why: "Lists break down information into simple, digestible steps or points. AI engines love this format because it's easy to parse, summarize, and feature." },
    "Readability": { what: "Calculates the average number of words per sentence. It passes if the average is below 25.", why: "Clear, concise language is easier for both humans and AI to understand and is less likely to be misinterpreted." },
    "Unique Data/Insights": { what: "Scans for phrases indicating original research (e.g., 'our data'), HTML data tables (`&lt;table&gt;`), or embedded charts from platforms like Tableau or Google Sheets.", why: "Citing original data or analysis is a powerful signal that your content is a primary source, making it much more valuable and likely to be featured by an AI." },
    "Author Byline/Bio": { what: "A link that likely points to an author's biography page.", why: "This signals Expertise and Authoritativeness. It shows that the content was written by a real person with a verifiable background, which AI gives significant weight to." },
    "First-Hand Experience": { what: "Scans for phrases that signal personal involvement (e.g., 'in my experience', 'we tested', 'firsthand').", why: "This directly signals the 'E' for Experience in E-E-A-T. It shows the author has direct, hands-on experience with the topic, making the content more authentic and trustworthy." },
    "Content Freshness": { what: "A 'published' or 'last updated' date on the page.", why: "Shows that the content is current and actively maintained, which is a key signal of a trustworthy and high-quality website." },
    "Contact Information": { what: "A link to a 'Contact Us' or 'About Us' page.", why: "A fundamental Trust signal. Legitimate businesses are transparent and provide ways for users to get in touch." },
    "Outbound Links": { what: "Checks if the page links out to other, external websites.", why: "Linking to other authoritative sources shows your content is well-researched and credible, signaling Authoritativeness." },
    "Cited Sources": { what: "Looks for citation phrases ('source:', 'according to:') OR outbound links within paragraph text.", why: "This is a strong signal of Trustworthiness. It shows you are backing up your claims with evidence, making your content more reliable." },
    "Schema Found": { what: "Any Schema.org structured data (`&lt;script type=\"application/ld+json\"&gt;`) on the page.", why: "Schema explicitly tells an AI what your content is (e.g., 'this is an article'). It is a critical component of technical GEO." },
    "Article or Org Schema": { what: "Checks if the schema defines the page as an 'Article' or provides information about the 'Organization.'", why: "'Article' schema provides context like author and dates (E-E-A-T signals), while 'Organization' schema helps establish the entity behind the website (a Trust signal)." },
    "FAQ or How-To Schema": { what: "Specifically checks for 'FAQPage' or 'HowTo' schema.", why: "This is one of the most powerful schema types, as it structures your content in a Q&A or step-by-step format that generative AI can lift directly into its answers." }
};

async function sendEmailReport(url, results, userEmail, origin) {
    const { summary, detailedReport, pagesCrawled } = results;
    const { averageScore } = summary;
    let reportHtml = `<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;"><div style="max-width: 800px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;"><table style="width: 100%; border-bottom: 1px solid #ddd; padding-bottom: 20px; margin-bottom: 20px;"><tr><td style="width: 100px; vertical-align: top;"><img src="${origin}/john-photo.png" alt="John Collins" style="width: 80px; height: 80px; border-radius: 50%;"></td><td style="padding-left: 20px;"><p>Thanks for requesting your detailed GEO Compliance Report. I hope it's helpful.</p><p>I can help you with much of this if you're not able to manage, but if you forward this to your web folks (assuming you have them) they should be able to sort a lot of it out for you.</p><p>Take care, and I hope to see you at one of our industry events soon!</p><p style="margin-top: 20px;"><strong>John</strong><br><a href="https://www.johncollins.biz/" target="_blank" style="text-decoration: none; color: #333;">John Collins Consulting</a><br><a href="https://www.johncollins.biz/" target="_blank"><img src="${origin}/logo.png" alt="John Collins Consulting Logo" style="max-height: 30px; margin-top: 5px;"></a></p><p style="font-size: 0.9em; color: #555; margin-top: 15px;"><em>P.S. If you need any assistance with your strategic marketing messaging or promotions or any other marketing needs, just reach out. I'm happy to help.</em></p></td></tr></table><h1 style="color: #3a0ca3;">Detailed GEO Report for ${url}</h1><h2 style="color: #4361ee;">Overall Score: ${averageScore}/100</h2><p><strong>Analyzed ${pagesCrawled} pages.</strong> Below is a detailed breakdown of each check.</p><hr>`;
    for (const name in detailedReport) {
        const stats = detailedReport[name];
        const details = REPORT_DETAILS[name] || { what: 'N/A', why: 'N/A' };
        const passPercent = Math.round((stats.passedCount / stats.totalCount) * 100);
        const icon = passPercent >= 75 ? '✔️' : '❌';
        const color = passPercent >= 75 ? '#2a9d8f' : '#e76f51';
        reportHtml += `<div style="margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee;"><h3 style="color: ${color}; margin-bottom: 15px;">${icon} ${name} - <span style="font-weight: normal;">Passed on ${stats.passedCount} of ${stats.totalCount} pages (${passPercent}%)</span></h3><div style="padding-left: 20px; border-left: 3px solid #ddd;"><p><strong>What It's Looking For:</strong> ${details.what}</p><p><strong>Why It Matters for GEO:</strong> ${details.why}</p></div>`;
        if (stats.failures.length > 0) {
            reportHtml += `<div style="margin-top: 15px; padding-left: 20px;"><strong>Pages with Omissions/Errors:</strong><ul style="list-style-type: none; padding-left: 0; margin-top: 5px;">`;
            stats.failures.forEach(failure => {
                reportHtml += `<li style="margin-bottom: 10px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;"><a href="${failure.url}" target="_blank" style="color: #4361ee;">${failure.url}</a><br><small style="color: #666;"><strong>Issue:</strong> ${failure.details.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</small></li>`;
            });
            reportHtml += `</ul></div>`;
        }
        reportHtml += `</div>`;
    }
    reportHtml += `</div></body>`;
    const userReportMsg = { to: userEmail, from: FROM_EMAIL, replyTo: TO_EMAIL, subject: `Your Detailed GEO Inspection Report for ${url}`, html: reportHtml };
    const leadNotificationMsg = { to: TO_EMAIL, from: FROM_EMAIL, subject: `GEO Report Request: ${userEmail} for ${url}`, html: `<p>A new GEO report was requested for the website: <strong>${url}</strong></p><p>The user's email is: <strong>${userEmail}</strong></p><hr><h3>Full Report:</h3>${reportHtml}` };
    try {
        await sgMail.send([userReportMsg, leadNotificationMsg]);
        console.log(`Email report sent to ${userEmail} and notification sent to ${TO_EMAIL}.`);
    } catch (error) {
        console.error('Error sending email report:', error.toString());
    }
}

/**
 * Finds links in the main navigation menu to crawl.
 * This function uses a series of CSS selectors as a heuristic to identify the primary navigation.
 * It starts with the most specific selectors and falls back to more generic ones.
 */
function findMenuLinks(doc, startUrl, crawledUrls) {
    // Added more flexible selectors to find navs in divs and other elements
    const selectors = [
        'nav[id*="main"] a',           // Standard navs with "main" in ID
        'nav[id*="primary"] a',        // Standard navs with "primary" in ID
        '[id*="main-nav"] a',          // NEW: Catches elements like <div id="main-nav">
        '[id*="primary-nav"] a',       // NEW: Catches elements like <div id="primary-nav">
        '[class*="main-nav"] a',       // NEW: Catches elements like <div class="main-nav">
        '[class*="primary-nav"] a',    // NEW: Catches elements like <div class="primary-nav">
        'header nav a',                // Navs within a header
        '[role="navigation"] a',       // NEW: Accessibility-focused selector
        'nav a'                        // Any remaining navs
    ];
    let links = new Set();
    const siteOrigin = new URL(startUrl).origin;

    const extractLinks = (selector) => {
        const foundLinks = new Set();
        doc.querySelectorAll(selector).forEach(link => {
            try {
                const href = link.getAttribute('href');
                if (!href || href.startsWith('#')) return;

                const urlObject = new URL(href, startUrl);
                urlObject.hash = ''; // Remove fragments
                const cleanUrl = urlObject.href;

                if (cleanUrl.startsWith(siteOrigin) && !crawledUrls.has(cleanUrl)) {
                    foundLinks.add(cleanUrl);
                }
            } catch (e) { /* Ignore invalid hrefs */ }
        });
        return foundLinks;
    };

    for (const selector of selectors) {
        links = extractLinks(selector);
        if (links.size > 0) {
            console.log(`Found ${links.size} links using selector: ${selector}`);
            break;
        }
    }
    return Array.from(links);
}