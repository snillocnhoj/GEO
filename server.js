const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const { JSDOM } = require('jsdom');
const sgMail = require('@sendgrid/mail');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

const reportCache = new Map();
const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;
const TO_EMAIL = process.env.TO_EMAIL;

if (SENDGRID_API_KEY) { sgMail.setApiKey(SENDGRID_API_KEY); }

app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: 'Too many requests, please try again after 15 minutes' });

app.post('/api/analyze', apiLimiter, async (req, res) => {
    if (!SCRAPINGBEE_API_KEY || !SENDGRID_API_KEY || !FROM_EMAIL || !TO_EMAIL) {
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
        setTimeout(() => reportCache.delete(reportId), 3600000); 
        res.status(200).json({ summary: results.summary, reportId: reportId });
    } catch (error) {
        console.error(`Analysis failed for ${startUrl}:`, error);
        res.status(500).json({ error: 'Failed to complete analysis.' });
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
    return processResults(allPageResults);
}
async function fetchHtml(url) {
    const scraperUrl = 'https://app.scrapingbee.com/api/v1/';
    const params = { api_key: SCRAPINGBEE_API_KEY, url: url };
    const response = await axios.get(scraperUrl, { params: params, timeout: 45000 });
    return response.data;
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

// --- DATA FOR THE EMAIL REPORT ---
const REPORT_DETAILS = {
    "Title Tag": {
        what: "The presence of a `&lt;title&gt;` tag in the page's HTML code.",
        why: "This is the primary title of your webpage shown in browser tabs and search results. It is the single most important signal to all search engines about the page's core topic."
    },
    "Meta Description": {
        what: "A `&lt;meta name=\"description\"&gt;` tag in the page's code.",
        why: "This provides the short summary that appears under your title in search results. A compelling description encourages clicks and gives generative AI a quick, clear summary of the page's purpose."
    },
    "H1 Heading": {
        what: "Checks that there is one, and *only one*, `&lt;h1&gt;` tag on the page.",
        why: "The `&lt;h1&gt;` is the main headline of your on-page content. Having exactly one reinforces the page's main topic for AI crawlers and helps them understand the content's hierarchy."
    },
    "Mobile-Friendly Viewport": {
        what: "The presence of the `&lt;meta name=\"viewport\"&gt;` tag.",
        why: "This tag signals that your site is designed to work well on mobile devices. User experience is a critical factor, and AI engines prioritize content from sites that are accessible and easy to use for everyone."
    },
    "Internal Linking": {
        what: "Counts links that point to other pages on the same website. The check passes if there are more than two.",
        why: "Good internal linking helps AI discover more of your content and understand how different topics on your site are related, establishing your overall authority on a subject."
    },
    "Image Alt Text": {
        what: "Checks if every `&lt;img&gt;` tag has a non-empty `alt` attribute.",
        why: "AI cannot 'see' images. Alt text provides a literal description, giving crucial context about the image that helps the AI better understand the page's topic."
    },
    "Conversational Tone": {
        what: "Scans subheadings (`&lt;h2&gt;`, `&lt;h3&gt;`) for question-based words OR checks for significant use of second-person pronouns ('you', 'your').",
        why: "Generative search is designed to answer questions. Structuring your content conversationally makes it incredibly easy for an AI to select your content as a direct answer."
    },
    "Clear Structure (Lists)": {
        what: "The presence of bulleted (`&lt;ul&gt;`) or numbered (`&lt;ol&gt;`) lists.",
        why: "Lists break down information into simple, digestible steps or points. AI engines love this format because it's easy to parse, summarize, and feature."
    },
    "Readability": {
        what: "Calculates the average number of words per sentence. It passes if the average is below 25.",
        why: "Clear, concise language is easier for both humans and AI to understand and is less likely to be misinterpreted."
    },
    "Unique Data/Insights": {
        what: "Scans for phrases indicating original research (e.g., 'our data'), HTML data tables (`&lt;table&gt;`), or embedded charts from platforms like Tableau or Google Sheets.",
        why: "Citing original data or analysis is a powerful signal that your content is a primary source, making it much more valuable and likely to be featured by an AI."
    },
    "Author Byline/Bio": {
        what: "A link that likely points to an author's biography page.",
        why: "This signals Expertise and Authoritativeness. It shows that the content was written by a real person with a verifiable background, which AI gives significant weight to."
    },
    "First-Hand Experience": {
        what: "Scans for phrases that signal personal involvement (e.g., 'in my experience', 'we tested', 'firsthand').",
        why: "This directly signals the 'E' for Experience in E-E-A-T. It shows the author has direct, hands-on experience with the topic, making the content more authentic and trustworthy."
    },
    "Content Freshness": {
        what: "A 'published' or 'last updated' date on the page.",
        why: "Shows that the content is current and actively maintained, which is a key signal of a trustworthy and high-quality website."
    },
    "Contact Information": {
        what: "A link to a 'Contact Us' or 'About Us' page.",
        why: "A fundamental Trust signal. Legitimate businesses are transparent and provide ways for users to get in touch."
    },
    "Outbound Links": {
        what: "Checks if the page links out to other, external websites.",
        why: "Linking to other authoritative sources shows your content is well-researched and credible, signaling Authoritativeness."
    },
    "Cited Sources": {
        what: "Looks for citation phrases ('source:', 'according to:') OR outbound links within paragraph text.",
        why: "This is a strong signal of Trustworthiness. It shows you are backing up your claims with evidence, making your content more reliable."
    },
    "Schema Found": {
        what: "Any Schema.org structured data (`&lt;script type=\"application/ld+json\"&gt;`) on the page.",
        why: "Schema explicitly tells an AI what your content is (e.g., 'this is an article'). It is a critical component of technical GEO."
    },
    "Article or Org Schema": {
        what: "Checks if the schema defines the page as an 'Article' or provides information about the 'Organization.'",
        why: "'Article' schema provides context like author and dates (E-E-A-T signals), while 'Organization' schema helps establish the entity behind the website (a Trust signal)."
    },
    "FAQ or How-To Schema": {
        what: "Specifically checks for 'FAQPage' or 'HowTo' schema.",
        why: "This is one of the most powerful schema types, as it structures your content in a Q&A or step-by-step format that generative AI can lift directly into its answers."
    }
};

// --- FINAL, CORRECTED Email Reporting Function ---
async function sendEmailReport(url, results, userEmail, origin) {
    const { summary, detailedReport, pagesCrawled } = results;
    const { averageScore } = summary;

    let reportHtml = `
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 800px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                <table style="width: 100%; border-bottom: 1px solid #ddd; padding-bottom: 20px; margin-bottom: 20px;">
                    <tr>
                        <td style="width: 100px; vertical-align: top;">
                            <img src="${origin}/john-photo.png" alt="John Collins" style="width: 80px; height: 80px; border-radius: 50%;">
                        </td>
                        <td style="padding-left: 20px;">
                            <p>Thanks for requesting your detailed GEO Compliance Report. I hope it's helpful.</p>
                            <p>I can help you with much of this if you're not able to manage, but if you forward this to your web folks (assuming you have them) they should be able to sort a lot of it out for you.</p>
                            <p>Take care, and I hope to see you at one of our industry events soon!</p>
                            <p>
                                <strong>John Collins</strong><br>
                                <a href="https://www.johncollins.biz/" target="_blank">
                                    <img src="${origin}/logo.png" alt="John Collins Consulting Logo" style="max-height: 30px; margin-top: 5px;">
                                </a>
                            </p>
                        </td>
                    </tr>
                </table>
                <h1 style="color: #3a0ca3;">Detailed GEO Report for ${url}</h1>
                <h2 style="color: #4361ee;">Overall Score: ${averageScore}/100</h2>
                <p><strong>Analyzed ${pagesCrawled} pages.</strong> Below is a detailed breakdown of each check.</p>
                <hr>
    `;

    for (const name in detailedReport) {
        const stats = detailedReport[name];
        const details = REPORT_DETAILS[name] || { what: 'N/A', why: 'N/A' };
        const passPercent = Math.round((stats.passedCount / stats.totalCount) * 100);
        const icon = passPercent >= 75 ? '✔️' : '❌';
        const color = passPercent >= 75 ? '#2a9d8f' : '#e76f51';
        
        reportHtml += `
            <div style="margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #eee;">
                <h3 style="color: ${color}; margin-bottom: 15px;">${icon} ${name} - <span style="font-weight: normal;">Passed on ${stats.passedCount} of ${stats.totalCount} pages (${passPercent}%)</span></h3>
                <div style="padding-left: 20px; border-left: 3px solid #ddd;">
                    <p><strong>What It's Looking For:</strong> ${details.what}</p>
                    <p><strong>Why It Matters for GEO:</strong> ${details.why}</p>
                </div>
        `;
        
        if (stats.failures.length > 0) {
            reportHtml += `<div style="margin-top: 15px; padding-left: 20px;"><strong>Pages with Omissions/Errors:</strong><ul style="list-style-type: none; padding-left: 0; margin-top: 5px;">`;
            stats.failures.forEach(failure => {
                reportHtml += `<li style="margin-bottom: 10px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">
                    <a href="${failure.url}" target="_blank" style="color: #4361ee;">${failure.url}</a><br>
                    <small style="color: #666;"><strong>Issue:</strong> ${failure.details.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</small>
                </li>`;
            });
            reportHtml += `</ul></div>`;
        }
        reportHtml += `</div>`;
    }
    
    reportHtml += `</div></body>`;
    
    const userReportMsg = {
        to: userEmail,
        from: FROM_EMAIL,
        replyTo: TO_EMAIL,
        subject: `Your Detailed GEO Inspection Report for ${url}`,
        html: reportHtml,
    };

    const leadNotificationMsg = {
        to: TO_EMAIL,
        from: FROM_EMAIL,
        subject: `GEO Report Request: ${userEmail} for ${url}`,
        html: `
            <p>A new GEO report was requested for the website: <strong>${url}</strong></p>
            <p>The user's email is: <strong>${userEmail}</strong></p>
            <hr>
            <h3>Full Report:</h3>
            ${reportHtml}
        `,
    };

    try {
        await sgMail.send([userReportMsg, leadNotificationMsg]);
        console.log(`Email report sent to ${userEmail} and notification sent to ${TO_EMAIL}.`);
    } catch (error) {
        console.error('Error sending email report:', error.toString());
    }
}


// --- Full, unchanged code for remaining functions is included below for safety ---
async function crawlSite(startUrl){const allPageResults=[],siteOrigin=(new URL(startUrl)).origin,homePageHtml=await fetchHtml(startUrl),homePageDom=new JSDOM(homePageHtml),homePageDoc=homePageDom.window.document;allPageResults.push({url:startUrl,checks:runAllChecks(homePageDoc,startUrl)});const crawledUrls=new Set([startUrl]),menuUrlsToCrawl=findMenuLinks(homePageDoc,startUrl,crawledUrls);for(const url of menuUrlsToCrawl){if(crawledUrls.size>=10)break;if(crawledUrls.has(url))continue;try{crawledUrls.add(url);const pageHtml=await fetchHtml(url),pageDom=new JSDOM(pageHtml),pageDoc=pageDom.window.document;allPageResults.push({url:url,checks:runAllChecks(pageDoc,url)})}catch(error){console.error(`Failed to crawl menu page ${url}:`,error.message)}}return processResults(allPageResults)}async function fetchHtml(url){const scraperUrl="https://app.scrapingbee.com/api/v1/",params={api_key:SCRAPINGBEE_API_KEY,url:url},response=await axios.get(scraperUrl,{params:params,timeout:45e3});return response.data}function processResults(allPageResults){const detailedReport={};let totalPasses=0,totalChecks=0;allPageResults.forEach(pageResult=>{pageResult.checks.forEach(checkResult=>{const{name:name,passed:passed,details:details}=checkResult;detailedReport[name]||(detailedReport[name]={passedCount:0,totalCount:0,failures:[]}),detailedReport[name].totalCount++,totalChecks++,passed?(detailedReport[name].passedCount++,totalPasses++):detailedReport[name].failures.push({url:pageResult.url,details:details})})});const averageScore=totalChecks>0?Math.round(totalPasses/totalChecks*100):0,summary={averageScore:averageScore,checkStats:Object.fromEntries(Object.entries(detailedReport).map(([name,data])=>[name,{passed:data.passedCount,total:data.totalCount}]))};return{summary:summary,detailedReport:detailedReport,pagesCrawled:allPageResults.length}}
function findMenuLinks(doc,startUrl,crawledUrls){const navLinkSelectors="nav a, [id*=\"nav\"] a, [id*=\"menu\"] a, [class*=\"nav\"] a, [class*=\"menu\"] a",links=new Set,siteOrigin=(new URL(startUrl)).origin;return doc.querySelectorAll(navLinkSelectors).forEach(link=>{try{const href=link.getAttribute("href");if(!href||href.startsWith("#"))return;const urlObject=new URL(href,startUrl);urlObject.hash="";const cleanUrl=urlObject.href;cleanUrl.startsWith(siteOrigin)&&!crawledUrls.has(cleanUrl)&&links.add(cleanUrl)}catch(e){}}),Array.from(links)}function runAllChecks(doc,url){const textContent=doc.body.textContent||"",schemaTypes=getSchemaTypes(doc);return[{name:"Title Tag",...checkTitleTag(doc)},{name:"Meta Description",...checkMetaDescription(doc)},{name:"H1 Heading",...checkH1Heading(doc)},{name:"Mobile-Friendly Viewport",...checkViewport(doc)},{name:"Internal Linking",...checkInternalLinks(doc,url)},{name:"Image Alt Text",...checkAltText(doc)},{name:"Conversational Tone",...checkConversationalTone(doc,textContent)},{name:"Clear Structure (Lists)",...checkLists(doc)},{name:"Readability",...checkReadability(textContent)},{name:"Unique Data/Insights",...checkUniqueData(doc,textContent)},{name:"Author Byline/Bio",...checkAuthor(doc)},{name:"First-Hand Experience",...checkExperience(textContent)},{name:"Content Freshness",...checkFreshness(doc,textContent)},{name:"Contact Information",...checkContact(doc)},{name:"Outbound Links",...checkOutboundLinks(doc,url)},{name:"Cited Sources",...checkCitations(doc,textContent)},{name:"Schema Found",...checkSchemaFound(schemaTypes)},{name:"Article or Org Schema",...checkArticleOrgSchema(schemaTypes)},{name:"FAQ or How-To Schema",...checkFaqHowToSchema(schemaTypes)}]}
function checkTitleTag(doc){const passed=!!doc.querySelector("title")?.textContent;return{passed:passed,details:passed?"OK":"No &lt;title&gt; tag found."}}function checkMetaDescription(doc){const passed=!!doc.querySelector('meta[name="description"]')?.content;return{passed:passed,details:passed?"OK":'No &lt;meta name="description"&gt; tag found.'}}function checkH1Heading(doc){const h1s=doc.querySelectorAll("h1").length,passed=1===h1s;return{passed:passed,details:passed?"OK":`Found ${h1s} &lt;h1&gt; tags (expected 1).`}}function checkViewport(doc){const passed=!!doc.querySelector('meta[name="viewport"]');return{passed:passed,details:passed?"OK":'Missing &lt;meta name="viewport"&gt; tag.'}}function checkInternalLinks(doc,url){const count=countInternalLinks(doc,url),passed=count>2;return{passed:passed,details:passed?"OK":`Found only ${count} internal links (recommend > 2).`}}function checkAltText(doc){const images=Array.from(doc.querySelectorAll("img")),missingAlt=images.filter(img=>!img.alt||!img.alt.trim()),passed=0===missingAlt.length;return{passed:passed,details:passed?"OK":`Found ${missingAlt.length} images missing alt text. e.g., ${missingAlt.map(i=>i.src).slice(0,2).join(", ")}`}}function checkLists(doc){const passed=doc.querySelectorAll("ul, ol").length>0;return{passed:passed,details:passed?"OK":"No bulleted or numbered lists found."}}function checkReadability(text){const sentences=text.match(/[^.!?]+[.!?]+/g)||[],words=text.match(/\b\w+\b/g)||[],score=0===sentences.length||0===words.length?0:words.length/sentences.length,passed=score<25&&score>0;return{passed:passed,details:passed?`Good (Avg. ${score.toFixed(1)} words/sentence).`:`High (Avg. ${score.toFixed(1)} words/sentence). Recommend < 25.`}}function checkAuthor(doc){const passed=!!doc.querySelector('a[href*="author/"], a[rel="author"]');return{passed:passed,details:passed?"OK":"No link to an author bio page found."}}function checkExperience(text){const passed=/in our test|hands-on|my experience|we visited|I found that|our team reviewed|we tested|firsthand|I personally|from my experience/i.test(text);return{passed:passed,details:passed?"OK":"No phrases indicating first-hand experience found."}}function checkFreshness(doc,text){const passed=/updated|published/i.test(text)||!!doc.querySelector('meta[property*="time"]');return{passed:passed,details:passed?"OK":'No "published" or "last updated" date found.'}}function checkContact(doc){const passed=!!doc.querySelector('a[href*="contact"], a[href*="about"]');return{passed:passed,details:passed?"OK":"No link to a Contact or About page found."}}function checkOutboundLinks(doc,url){const passed=hasOutboundLinks(doc,url);return{passed:passed,details:passed?"OK":"No links to external websites found."}}function checkSchemaFound(types){const passed=types.length>0;return{passed:passed,details:passed?`Found: ${types.join(", ")}`:"No Schema.org data found."}}function checkArticleOrgSchema(types){const passed=types.includes("Article")||types.includes("Organization");return{passed:passed,details:passed?"OK":"Missing essential Article or Organization schema."}}function checkFaqHowToSchema(types){const passed=types.includes("FAQPage")||types.includes("HowTo");return{passed:passed,details:passed?"OK":"Missing high-value FAQ or How-To schema."}}function checkConversationalTone(doc,text){const headings=doc.querySelectorAll("h2, h3"),questionWords="what how why when where is can do are which who does should".split(" "),hasQuestionHeadings=Array.from(headings).some(h=>{const headingText=h.textContent.trim().toLowerCase();return questionWords.some(word=>headingText.startsWith(word))});if(hasQuestionHeadings)return{passed:!0,details:"OK (Found question-based subheadings)."};const pronounCount=(text.match(/\byou\b|\byour\b/gi)||[]).length;return pronounCount>5?{passed:!0,details:`OK (Found ${pronounCount} second-person pronouns).`}:{passed:!1,details:"No question-based subheadings or significant use of second-person pronouns (you/your) found."}}function checkUniqueData(doc,text){const hasKeywords=/our data|our research|we surveyed|according to our study|we analyzed|our findings show|in our analysis/i.test(text);if(hasKeywords)return{passed:!0,details:"OK (Found keywords indicating original research)."};const hasTable=doc.querySelector("table");if(hasTable)return{passed:!0,details:"OK (Found an HTML &lt;table&gt; element)."};const vizPlatforms="tableau datawrapper sheets.google.com fusiontables.google.com".split(" "),hasEmbeddedViz=Array.from(doc.querySelectorAll("iframe")).some(iframe=>{const src=iframe.getAttribute("src")||"";return vizPlatforms.some(platform=>src.includes(platform))});return hasEmbeddedViz?{passed:!0,details:"OK (Found an embedded data visualization)."}:{passed:!1,details:"No signals of original data, research, or visualizations found."}}function checkCitations(doc,text){const hasKeywords=/source:|according to:|citation:/i.test(text);if(hasKeywords)return{passed:!0,details:"OK (Found citation keywords)."};const hasParagraphLinks=Array.from(doc.querySelectorAll("p a")).some(link=>{try{const pageHost=(new URL(doc.baseURI)).hostname,linkHost=(new URL(link.href)).hostname;return linkHost&&linkHost!==pageHost}catch(e){return!1}});return hasParagraphLinks?{passed:!0,details:"OK (Found outbound links within paragraph text)."}:{passed:!1,details:"No cited sources or contextual outbound links found in paragraphs."}}function hasOutboundLinks(doc,url){try{const pageHost=(new URL(url)).hostname;return Array.from(doc.querySelectorAll("a[href]")).some(link=>{try{const linkHost=(new URL(link.href)).hostname;return linkHost&&linkHost!==pageHost}catch(e){return!1}})}catch(e){return!1}}function countInternalLinks(doc,url){try{const pageHost=(new URL(url)).hostname;return Array.from(doc.querySelectorAll("a[href]")).filter(link=>{try{const linkHost=(new URL(link.href)).hostname;return linkHost===pageHost}catch(e){return!1}}).length}catch(e){return 0}}function getSchemaTypes(doc){const schemas=[];return doc.querySelectorAll('script[type="application/ld+json"]').forEach(script=>{try{const json=JSON.parse(script.textContent),graph=json["@graph"]||[json];graph.forEach(item=>{item["@type"]&&schemas.push(item["@type"])})}catch(e){console.error("Error parsing JSON-LD:",e)}}),schemas.flat()}