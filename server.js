const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const { JSDOM } = require('jsdom');
const sgMail = require('@sendgrid/mail');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid'); // To generate unique report IDs

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

// --- Simple in-memory cache for reports ---
const reportCache = new Map();

// --- API KEYS ---
const SCRAPINGBEE_API_KEY = process.env.SCRAPINGBEE_API_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;
const TO_EMAIL = process.env.TO_EMAIL;

if (SENDGRID_API_KEY) { sgMail.setApiKey(SENDGRID_API_KEY); }

// --- Middleware ---
app.use(cors());
app.use(express.json());

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, message: 'Too many requests, please try again after 15 minutes', });

// --- API Routes ---
app.post('/api/analyze', apiLimiter, async (req, res) => {
    // ... analyze logic is the same, but it now stores the report
    const { startUrl } = req.body;
    if (!startUrl) { return res.status(400).json({ error: 'startUrl is required' }); }
    console.log(`Starting analysis for: ${startUrl}`);
    try {
        const results = await crawlSite(startUrl);
        const reportId = uuidv4(); // Generate a unique ID for this report
        reportCache.set(reportId, { report: results, url: startUrl });
        
        // Clean up old reports from cache after 1 hour
        setTimeout(() => reportCache.delete(reportId), 3600000); 

        res.status(200).json({ summary: results.summary, reportId: reportId });
    } catch (error) {
        console.error(`Analysis failed for ${startUrl}:`, error);
        res.status(500).json({ error: 'Failed to complete analysis.' });
    }
});

app.post('/api/send-report', async (req, res) => {
    const { reportId } = req.body;
    if (!reportId || !reportCache.has(reportId)) {
        return res.status(404).send('Report not found or expired.');
    }
    const { report, url } = reportCache.get(reportId);
    try {
        await sendEmailReport(url, report);
        res.status(200).send('Report sent successfully.');
    } catch (error) {
        res.status(500).send('Failed to send email.');
    }
});


// --- Frontend File Serving ---
// ... unchanged ...
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

// --- Core Application Logic (unchanged) ---
async function crawlSite(startUrl) { /* ... */ }
async function fetchHtml(url) { /* ... */ }
function processResults(allPageResults) { /* ... */ }
async function sendEmailReport(url, results) { /* ... */ }
// ... and all other analysis functions ...
async function crawlSite(startUrl){const allPageResults=[],siteOrigin=(new URL(startUrl)).origin,homePageHtml=await fetchHtml(startUrl),homePageDom=new JSDOM(homePageHtml),homePageDoc=homePageDom.window.document;allPageResults.push({url:startUrl,checks:runAllChecks(homePageDoc,startUrl)});const crawledUrls=new Set([startUrl]),menuUrlsToCrawl=findMenuLinks(homePageDoc,startUrl,crawledUrls);for(const url of menuUrlsToCrawl){if(crawledUrls.size>=10)break;if(crawledUrls.has(url))continue;try{crawledUrls.add(url);const pageHtml=await fetchHtml(url),pageDom=new JSDOM(pageHtml),pageDoc=pageDom.window.document;allPageResults.push({url:url,checks:runAllChecks(pageDoc,url)})}catch(error){console.error(`Failed to crawl menu page ${url}:`,error.message)}}return processResults(allPageResults)}async function fetchHtml(url){const scraperUrl="https://app.scrapingbee.com/api/v1/",params={api_key:SCRAPINGBEE_API_KEY,url:url},response=await axios.get(scraperUrl,{params:params,timeout:45e3});return response.data}function processResults(allPageResults){const detailedReport={};let totalPasses=0,totalChecks=0;allPageResults.forEach(pageResult=>{pageResult.checks.forEach(checkResult=>{const{name:name,passed:passed,details:details}=checkResult;detailedReport[name]||(detailedReport[name]={passedCount:0,totalCount:0,failures:[]}),detailedReport[name].totalCount++,totalChecks++,passed?(detailedReport[name].passedCount++,totalPasses++):detailedReport[name].failures.push({url:pageResult.url,details:details})})});const averageScore=totalChecks>0?Math.round(totalPasses/totalChecks*100):0,summary={averageScore:averageScore,checkStats:Object.fromEntries(Object.entries(detailedReport).map(([name,data])=>[name,{passed:data.passedCount,total:data.totalCount}]))};return{summary:summary,detailedReport:detailedReport,pagesCrawled:allPageResults.length}}async function sendEmailReport(url,results){const{summary:summary,detailedReport:detailedReport,pagesCrawled:pagesCrawled}=results,{averageScore:averageScore}=summary;let reportHtml=`
        <body style="font-family: Arial, sans-serif; line-height: 1.6;">
            <div style="max-width: 800px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                <h1 style="color: #3a0ca3;">GEO Inspection Report for ${url}</h1>
                <h2 style="color: #4361ee;">Overall Score: ${averageScore}/100</h2>
                <p><strong>Analyzed ${pagesCrawled} pages.</strong> Below is a detailed breakdown of each check.</p>
                <hr>
    `;for(const name in detailedReport){const stats=detailedReport[name],passPercent=Math.round(stats.passedCount/stats.totalCount*100),icon=passPercent>=75?"✔️":"❌",color=passPercent>=75?"green":"red";reportHtml+=`<h3 style="color: ${color};">${icon} ${name} - Passed on ${stats.passedCount} of ${stats.totalCount} pages (${passPercent}%)</h3>`,stats.failures.length>0&&(reportHtml+='<p><strong>Details of Omissions/Errors:</strong></p><ul style="list-style-type: none; padding-left: 0;">',stats.failures.forEach(failure=>{reportHtml+=`<li style="margin-bottom: 10px; padding: 10px; background-color: #f8f9fa; border-radius: 4px;">
                    <strong>Page:</strong> <a href="${failure.url}">${failure.url}</a><br>
                    <strong>Issue:</strong> ${failure.details}
                </li>`}),reportHtml+="</ul>"),reportHtml+="<br>"}reportHtml+='</div></body>';const msg={to:TO_EMAIL,from:FROM_EMAIL,subject:`New GEO App Report: ${url} (Score: ${averageScore})`,html:reportHtml};try{await sgMail.send(msg),console.log(`Email report for ${url} sent successfully.`)}catch(error){console.error("Error sending email report:",error.toString())}}function findMenuLinks(doc,startUrl,crawledUrls){const navLinkSelectors="nav a, [id*=\"nav\"] a, [id*=\"menu\"] a, [class*=\"nav\"] a, [class*=\"menu\"] a",links=new Set,siteOrigin=(new URL(startUrl)).origin;return doc.querySelectorAll(navLinkSelectors).forEach(link=>{try{const href=link.getAttribute("href");if(!href||href.startsWith("#"))return;const urlObject=new URL(href,startUrl);urlObject.hash="";const cleanUrl=urlObject.href;cleanUrl.startsWith(siteOrigin)&&!crawledUrls.has(cleanUrl)&&links.add(cleanUrl)}catch(e){}}),Array.from(links)}function runAllChecks(doc,url){const textContent=doc.body.textContent||"",schemaTypes=getSchemaTypes(doc);return[{name:"Title Tag",...checkTitleTag(doc)},{name:"Meta Description",...checkMetaDescription(doc)},{name:"H1 Heading",...checkH1Heading(doc)},{name:"Mobile-Friendly Viewport",...checkViewport(doc)},{name:"Internal Linking",...checkInternalLinks(doc,url)},{name:"Image Alt Text",...checkAltText(doc)},{name:"Conversational Tone",...checkConversationalTone(doc,textContent)},{name:"Clear Structure (Lists)",...checkLists(doc)},{name:"Readability",...checkReadability(textContent)},{name:"Unique Data/Insights",...checkUniqueData(doc,textContent)},{name:"Author Byline/Bio",...checkAuthor(doc)},{name:"First-Hand Experience",...checkExperience(textContent)},{name:"Content Freshness",...checkFreshness(doc,textContent)},{name:"Contact Information",...checkContact(doc)},{name:"Outbound Links",...checkOutboundLinks(doc,url)},{name:"Cited Sources",...checkCitations(doc,textContent)},{name:"Schema Found",...checkSchemaFound(schemaTypes)},{name:"Article or Org Schema",...checkArticleOrgSchema(schemaTypes)},{name:"FAQ or How-To Schema",...checkFaqHowToSchema(schemaTypes)}]}function checkTitleTag(doc){const passed=!!doc.querySelector("title")?.textContent;return{passed:passed,details:passed?"OK":"No <title> tag found."}}function checkMetaDescription(doc){const passed=!!doc.querySelector('meta[name="description"]')?.content;return{passed:passed,details:passed?"OK":'No <meta name="description"> tag found.'}}function checkH1Heading(doc){const h1s=doc.querySelectorAll("h1").length,passed=1===h1s;return{passed:passed,details:passed?"OK":`Found ${h1s} <h1> tags (expected 1).`}}function checkViewport(doc){const passed=!!doc.querySelector('meta[name="viewport"]');return{passed:passed,details:passed?"OK":'Missing <meta name="viewport"> tag.'}}function checkInternalLinks(doc,url){const count=countInternalLinks(doc,url),passed=count>2;return{passed:passed,details:passed?"OK":`Found only ${count} internal links (recommend > 2).`}}function checkAltText(doc){const images=Array.from(doc.querySelectorAll("img")),missingAlt=images.filter(img=>!img.alt||!img.alt.trim()),passed=0===missingAlt.length;return{passed:passed,details:passed?"OK":`Found ${missingAlt.length} images missing alt text. e.g., ${missingAlt.map(i=>i.src).slice(0,2).join(", ")}`}}function checkLists(doc){const passed=doc.querySelectorAll("ul, ol").length>0;return{passed:passed,details:passed?"OK":"No bulleted or numbered lists found."}}function checkReadability(text){const sentences=text.match(/[^.!?]+[.!?]+/g)||[],words=text.match(/\b\w+\b/g)||[],score=0===sentences.length||0===words.length?0:words.length/sentences.length,passed=score<25&&score>0;return{passed:passed,details:passed?`Good (Avg. ${score.toFixed(1)} words/sentence).`:`High (Avg. ${score.toFixed(1)} words/sentence). Recommend < 25.`}}function checkAuthor(doc){const passed=!!doc.querySelector('a[href*="author/"], a[rel="author"]');return{passed:passed,details:passed?"OK":"No link to an author bio page found."}}function checkExperience(text){const passed=/in our test|hands-on|my experience|we visited|I found that|our team reviewed|we tested|firsthand|I personally|from my experience/i.test(text);return{passed:passed,details:passed?"OK":"No phrases indicating first-hand experience found."}}function checkFreshness(doc,text){const passed=/updated|published/i.test(text)||!!doc.querySelector('meta[property*="time"]');return{passed:passed,details:passed?"OK":'No "published" or "last updated" date found.'}}function checkContact(doc){const passed=!!doc.querySelector('a[href*="contact"], a[href*="about"]');return{passed:passed,details:passed?"OK":"No link to a Contact or About page found."}}function checkOutboundLinks(doc,url){const passed=hasOutboundLinks(doc,url);return{passed:passed,details:passed?"OK":"No links to external websites found."}}function checkSchemaFound(types){const passed=types.length>0;return{passed:passed,details:passed?`Found: ${types.join(", ")}`:"No Schema.org data found."}}function checkArticleOrgSchema(types){const passed=types.includes("Article")||types.includes("Organization");return{passed:passed,details:passed?"OK":"Missing essential Article or Organization schema."}}function checkFaqHowToSchema(types){const passed=types.includes("FAQPage")||types.includes("HowTo");return{passed:passed,details:passed?"OK":"Missing high-value FAQ or How-To schema."}}function checkConversationalTone(doc,text){const headings=doc.querySelectorAll("h2, h3"),questionWords="what how why when where is can do are which who does should".split(" "),hasQuestionHeadings=Array.from(headings).some(h=>{const headingText=h.textContent.trim().toLowerCase();return questionWords.some(word=>headingText.startsWith(word))});if(hasQuestionHeadings)return{passed:!0,details:"OK (Found question-based subheadings)."};const pronounCount=(text.match(/\byou\b|\byour\b/gi)||[]).length;return pronounCount>5?{passed:!0,details:`OK (Found ${pronounCount} second-person pronouns).`}:{passed:!1,details:"No question-based subheadings or significant use of second-person pronouns (you/your) found."}}function checkUniqueData(doc,text){const hasKeywords=/our data|our research|we surveyed|according to our study|we analyzed|our findings show|in our analysis/i.test(text);if(hasKeywords)return{passed:!0,details:"OK (Found keywords indicating original research)."};const hasTable=doc.querySelector("table");if(hasTable)return{passed:!0,details:"OK (Found an HTML <table> element)."};const vizPlatforms="tableau datawrapper sheets.google.com fusiontables.google.com".split(" "),hasEmbeddedViz=Array.from(doc.querySelectorAll("iframe")).some(iframe=>{const src=iframe.getAttribute("src")||"";return vizPlatforms.some(platform=>src.includes(platform))});return hasEmbeddedViz?{passed:!0,details:"OK (Found an embedded data visualization)."})