// --- Constants ---
const MAX_PAGES_TO_CRAWL = 10; // Updated from 20 to 10

// --- DOM Elements ---
const urlInput = document.getElementById('urlInput');
const analyzeButton = document.getElementById('analyzeButton');
const progressContainer = document.getElementById('progress-container');
const progressStatus = document.getElementById('progress-status');
const progressBar = document.getElementById('progress-bar');
const resultsSection = document.getElementById('results');
const scoreElement = document.getElementById('score');
const checklistContainer = document.getElementById('checklist-container');


// --- Main Event Listener ---
analyzeButton.addEventListener('click', async () => {
    const rawUrl = urlInput.value.trim();
    if (!rawUrl) {
        alert('Please enter a website URL.');
        return;
    }

    try {
        const startUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
        await crawlSite(startUrl);
    } catch (error) {
        console.error("A critical error occurred:", error);
        alert(`An unexpected error occurred: ${error.message}. Please check the URL and try again.`);
        progressContainer.classList.add('hidden');
        resultsSection.classList.remove('hidden');
        scoreElement.textContent = "N/A";
        checklistContainer.innerHTML = '<h3>Site-Wide Compliance Checklist</h3><p>The analysis could not be completed.</p>';
    } finally {
        analyzeButton.textContent = 'Start Full Site Inspection!';
        analyzeButton.disabled = false;
    }
});


/**
 * The main CRAWLER function.
 * @param {string} startUrl The URL where the crawl begins.
 */
async function crawlSite(startUrl) {
    uiReset();

    const urlsToCrawl = [startUrl];
    const crawledUrls = new Set();
    const allPageResults = [];
    const siteOrigin = new URL(startUrl).origin;

    while (urlsToCrawl.length > 0 && crawledUrls.size < MAX_PAGES_TO_CRAWL) {
        const currentUrl = urlsToCrawl.shift();
        if (crawledUrls.has(currentUrl)) continue;

        try {
            crawledUrls.add(currentUrl);
            uiUpdateProgress(crawledUrls.size, currentUrl);

            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(currentUrl)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const checks = runAllChecks(doc, currentUrl);
            allPageResults.push({ url: currentUrl, checks });

            doc.querySelectorAll('a[href]').forEach(link => {
                try {
                    const absoluteUrl = new URL(link.getAttribute('href'), startUrl).href;
                    if (absoluteUrl.startsWith(siteOrigin) && !crawledUrls.has(absoluteUrl) && !urlsToCrawl.includes(absoluteUrl)) {
                       if (urlsToCrawl.length + crawledUrls.size < MAX_PAGES_TO_CRAWL) {
                            urlsToCrawl.push(absoluteUrl);
                       }
                    }
                } catch (e) { /* Ignore invalid URLs */ }
            });
        } catch (error) {
            console.error(`Failed to crawl ${currentUrl}:`, error);
        }
    }

    displayFinalReport(allPageResults);
}

// --- UI Update Functions ---
function uiReset() {
    analyzeButton.textContent = 'Inspection in Progress...';
    analyzeButton.disabled = true;
    resultsSection.classList.add('hidden');
    progressContainer.classList.remove('hidden');
    checklistContainer.innerHTML = '<h3>Site-Wide Compliance Checklist</h3>'; // Reset header
}

function uiUpdateProgress(crawledCount, currentUrl) {
    const percent = Math.round((crawledCount / MAX_PAGES_TO_CRAWL) * 100);
    progressBar.style.width = `${percent}%`;
    progressStatus.textContent = `Analyzing page ${crawledCount}/${MAX_PAGES_TO_CRAWL}: ${currentUrl.substring(0, 70)}...`;
}

/**
 * Aggregates all page results into a final site-wide report.
 * @param {Array} allPageResults - The collection of results from all crawled pages.
 */
function displayFinalReport(allPageResults) {
    progressContainer.classList.add('hidden');
    resultsSection.classList.remove('hidden');

    if (allPageResults.length === 0) {
        scoreElement.textContent = "N/A";
        checklistContainer.innerHTML += '<p>Could not retrieve any pages to analyze.</p>';
        return;
    }
    
    const checkStats = {};
    let totalPasses = 0;
    let totalChecks = 0;

    allPageResults.forEach(result => {
        result.checks.forEach(check => {
            if (!checkStats[check.name]) {
                checkStats[check.name] = { passed: 0, total: 0, desc: check.desc };
            }
            checkStats[check.name].total++;
            totalChecks++;
            if (check.passed) {
                checkStats[check.name].passed++;
                totalPasses++;
            }
        });
    });

    const averageScore = Math.round((totalPasses / totalChecks) * 100) || 0;
    scoreElement.textContent = `${averageScore}/100`;

    for (const name in checkStats) {
        const stats = checkStats[name];
        const passPercent = Math.round((stats.passed / stats.total) * 100);
        
        const checkItem = document.createElement('div');
        const icon = passPercent >= 75 ? '✔️' : '❌';
        checkItem.className = `check-item ${passPercent >= 75 ? 'passed' : 'failed'}`;
        
        checkItem.innerHTML = `
            <div class="check-item-icon">${icon}</div>
            <div class="check-item-text">
                <strong>${name}</strong>
                <span>Passed on ${stats.passed} of ${stats.total} pages (${passPercent}%)</span>
            </div>
        `;
        checklistContainer.appendChild(checkItem);
    }
}


// --- Analysis Functions (Unchanged from before) ---
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
        { name: 'Unique Data/Insights', passed: /our data|our research|we surveyed/i.test(textContent) || doc.querySelector('table') },
        { name: 'Author Byline/Bio', passed: !!doc.querySelector('a[href*="author/"], a[rel="author"]') },
        { name: 'First-Hand Experience', passed: /in our test|hands-on|my experience|we visited/i.test(textContent) },
        { name: 'Content Freshness', passed: /updated|published/i.test(textContent) || !!doc.querySelector('meta[property*="time"]') },
        { name: 'Contact Information', passed: !!doc.querySelector('a[href*="contact"], a[href*="about"]') },
        { name: 'Outbound Links', passed: checkOutboundLinks(doc, url) },
        { name: 'Cited Sources', passed: /source:|according to:|citation:/i.test(textContent) },
        { name: 'Schema Found', passed: schemaTypes.length > 0 },
        { name: 'Article or Org Schema', passed: schemaTypes.includes('Article') || schemaTypes.includes('Organization') },
        { name: 'FAQ or How-To Schema', passed: schemaTypes.includes('FAQPage') || schemaTypes.includes('HowTo') },
    ];
}
function checkAltText(doc) {
    const images = Array.from(doc.querySelectorAll('img'));
    if (images.length === 0) return true;
    return images.every(img => img.alt && img.alt.trim() !== '');
}
function checkConversationalTone(doc) {
    const headings = doc.querySelectorAll('h2, h3');
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'is', 'can', 'do'];
    return Array.from(headings).some(h => {
        const headingText = h.textContent.trim().toLowerCase();
        return questionWords.some(word => headingText.startsWith(word));
    });
}
function checkOutboundLinks(doc, url) {
    try {
        const pageHost = new URL(url).hostname;
        return Array.from(doc.querySelectorAll('a[href]')).some(link => {
            try {
                const linkHost = new URL(link.href).hostname;
                return linkHost && linkHost !== pageHost;
            } catch { return false; }
// --- Constants ---
const MAX_PAGES_TO_CRAWL = 10;

// --- DOM Elements ---
const urlInput = document.getElementById('urlInput');
const analyzeButton = document.getElementById('analyzeButton');
const progressContainer = document.getElementById('progress-container');
const progressStatus = document.getElementById('progress-status');
const progressBar = document.getElementById('progress-bar');
const resultsSection = document.getElementById('results');
const scoreElement = document.getElementById('score');
const checklistContainer = document.getElementById('checklist-container');


// --- Main Event Listener ---
analyzeButton.addEventListener('click', async () => {
    const rawUrl = urlInput.value.trim();
    if (!rawUrl) {
        alert('Please enter a website URL.');
        return;
    }

    try {
        const startUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
        await crawlSite(startUrl);
    } catch (error) {
        console.error("A critical error occurred:", error);
        alert(`An unexpected error occurred: ${error.message}. Please check the URL and try again.`);
        progressContainer.classList.add('hidden');
        resultsSection.classList.remove('hidden');
        scoreElement.textContent = "N/A";
        checklistContainer.innerHTML = '<h3>Site-Wide Compliance Checklist</h3><p>The analysis could not be completed.</p>';
    } finally {
        analyzeButton.textContent = 'Start Full Site Inspection!';
        analyzeButton.disabled = false;
    }
});


/**
 * The main CRAWLER function.
 * @param {string} startUrl The URL where the crawl begins.
 */
async function crawlSite(startUrl) {
    uiReset();

    const urlsToCrawl = [startUrl];
    const crawledUrls = new Set();
    const allPageResults = [];
    const siteOrigin = new URL(startUrl).origin;

    while (urlsToCrawl.length > 0 && crawledUrls.size < MAX_PAGES_TO_CRAWL) {
        const currentUrl = urlsToCrawl.shift();
        if (crawledUrls.has(currentUrl)) continue;

        try {
            crawledUrls.add(currentUrl);
            uiUpdateProgress(crawledUrls.size, currentUrl);

            // --- THIS IS THE ONLY LINE THAT CHANGES ---
            // We now point to our own backend service instead of the public proxy.
            const response = await fetch(`/api/scrape?url=${encodeURIComponent(currentUrl)}`);
            // --- END OF CHANGE ---
            
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const checks = runAllChecks(doc, currentUrl);
            allPageResults.push({ url: currentUrl, checks });

            doc.querySelectorAll('a[href]').forEach(link => {
                try {
                    const absoluteUrl = new URL(link.getAttribute('href'), startUrl).href;
                    if (absoluteUrl.startsWith(siteOrigin) && !crawledUrls.has(absoluteUrl) && !urlsToCrawl.includes(absoluteUrl)) {
                       if (urlsToCrawl.length + crawledUrls.size < MAX_PAGES_TO_CRAWL) {
                            urlsToCrawl.push(absoluteUrl);
                       }
                    }
                } catch (e) { /* Ignore invalid URLs */ }
            });
        } catch (error) {
            console.error(`Failed to crawl ${currentUrl}:`, error);
        }
    }

    displayFinalReport(allPageResults);
}

// --- UI Update Functions (Unchanged) ---
function uiReset() { /* ... */ }
function uiUpdateProgress(crawledCount, currentUrl) { /* ... */ }
function displayFinalReport(allPageResults) { /* ... */ }
// --- Analysis Functions (Unchanged) ---
function runAllChecks(doc, url) { /* ... */ }
function checkAltText(doc) { /* ... */ }
function checkConversationalTone(doc) { /* ... */ }
function checkOutboundLinks(doc, url) { /* ... */ }
function countInternalLinks(doc, url) { /* ... */ }
function checkReadability(text) { /* ... */ }
function getSchemaTypes(doc) { /* ... */ }

// NOTE: I've collapsed the unchanged functions for brevity, but they are still the same as the previous version. 
// You can just paste the full code block above into your script.js file.
// The full code is included below for easy copy-pasting.
function uiReset(){analyzeButton.textContent="Inspection in Progress...",analyzeButton.disabled=!0,resultsSection.classList.add("hidden"),progressContainer.classList.remove("hidden"),checklistContainer.innerHTML="<h3>Site-Wide Compliance Checklist</h3>"}function uiUpdateProgress(e,t){const n=Math.round(e/10*100);progressBar.style.width=`${n}%`,progressStatus.textContent=`Analyzing page ${e}/10: ${t.substring(0,70)}...`}function displayFinalReport(e){progressContainer.classList.add("hidden"),resultsSection.classList.remove("hidden");const t={};let n=0,o=0;e.forEach(e=>{e.checks.forEach(r=>{t[r.name]||(t[r.name]={passed:0,total:0,desc:r.desc}),t[r.name].total++,o++,r.passed&&(t[r.name].passed++,n++)})});const r=Math.round(n/o*100)||0;scoreElement.textContent=`${r}/100`;for(const c in t){const s=t[c],a=Math.round(s.passed/s.total*100),l=document.createElement("div"),d=a>=75?"✔️":"❌";l.className=`check-item ${a>=75?"passed":"failed"}`,l.innerHTML=`\n            <div class="check-item-icon">${d}</div>\n            <div class="check-item-text">\n                <strong>${c}</strong>\n                <span>Passed on ${s.passed} of ${s.total} pages (${a}%)</span>\n            </div>\n        `,checklistContainer.appendChild(l)}}function runAllChecks(e,t){const n=e.body.textContent||"",o=getSchemaTypes(e);return[{name:"Title Tag",passed:!!e.querySelector("title")?.textContent},{name:"Meta Description",passed:!!e.querySelector('meta[name="description"]')?.content},{name:"H1 Heading",passed:1===e.querySelectorAll("h1").length},{name:"Mobile-Friendly Viewport",passed:!!e.querySelector('meta[name="viewport"]')},{name:"Internal Linking",passed:countInternalLinks(e,t)>2},{name:"Image Alt Text",passed:checkAltText(e)},{name:"Conversational Tone",passed:checkConversationalTone(e)},{name:"Clear Structure (Lists)",passed:e.querySelectorAll("ul, ol").length>0},{name:"Readability",passed:checkReadability(n)},{name:"Unique Data/Insights",passed:/our data|our research|we surveyed/i.test(n)||e.querySelector("table")},{name:"Author Byline/Bio",passed:!!e.querySelector('a[href*="author/"], a[rel="author"]')},{name:"First-Hand Experience",passed:/in our test|hands-on|my experience|we visited/i.test(n)},{name:"Content Freshness",passed:/updated|published/i.test(n)||!!e.querySelector('meta[property*="time"]')},{name:"Contact Information",passed:!!e.querySelector('a[href*="contact"], a[href*="about"]')},{name:"Outbound Links",passed:checkOutboundLinks(e,t)},{name:"Cited Sources",passed:/source:|according to:|citation:/i.test(n)},{name:"Schema Found",passed:o.length>0},{name:"Article or Org Schema",passed:o.includes("Article")||o.includes("Organization")},{name:"FAQ or How-To Schema",passed:o.includes("FAQPage")||o.includes("HowTo")}]}function checkAltText(e){const t=Array.from(e.querySelectorAll("img"));return 0===t.length||t.every(e=>e.alt&&""!==e.alt.trim())}function checkConversationalTone(e){const t=e.querySelectorAll("h2, h3"),n=["what","how","why","when","where","is","can","do"];return Array.from(t).some(e=>{const t=e.textContent.trim().toLowerCase();return n.some(n=>t.startsWith(n))})}function checkOutboundLinks(e,t){try{const n=new URL(t).hostname;return Array.from(e.querySelectorAll("a[href]")).some(e=>{try{const t=new URL(e.href).hostname;return t&&t!==n}catch(e){return!1}})}catch(e){return!1}}function countInternalLinks(e,t){try{const n=new URL(t).hostname;return Array.from(e.querySelectorAll("a[href]")).filter(e=>{try{const t=new URL(e.href).hostname;return t===n}catch(e){return!1}}).length}catch(e){return 0}}function checkReadability(e){const t=e.match(/[^.!?]+[.!?]+/g)||[],n=e.match(/\b\w+\b/g)||[];if(0===t.length||0===n.length)return!0;const o=n.length/t.length;return o<25}function getSchemaTypes(e){const t=[];return e.querySelectorAll('script[type="application/ld+json"]').forEach(n=>{try{const o=JSON.parse(n.textContent),r=o["@graph"]||[o];r.forEach(e=>{e["@type"]&&t.push(e["@type"])})}catch(e){console.error("Error parsing JSON-LD:",e)}}),t.flat()}