// --- Constants ---
const MAX_PAGES_TO_CRAWL = 10;

// --- DOM Elements ---
const urlInput = document.getElementById('urlInput');
const analyzeButton = document.getElementById('analyzeButton');
const progressContainer = document.getElementById('progress-container');
const progressStatus = document.getElementById('progress-status');
const progressBar = document.getElementById('progress-bar');
const resultsSection = document.getElementById('results');
const scoreWrapper = document.getElementById('score-wrapper');
const scoreCircle = document.getElementById('score-circle');
const ctaButton = document.getElementById('cta-button');
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
        analyzeButton.textContent = 'Inspection in Progress...';
        analyzeButton.disabled = true;
        await crawlSite(startUrl);

    } catch (error) {
        console.error("A critical error occurred:", error);
        alert(`An unexpected error occurred: ${error.message}. Please check the URL and try again.`);
        uiReset(); 
        resultsSection.classList.remove('hidden');
        checklistContainer.innerHTML = '<h3>Site-Wide Compliance Checklist</h3><p>The analysis could not be completed.</p>';

    } finally {
        analyzeButton.textContent = 'Start Full Site Inspection!';
        analyzeButton.disabled = false;
    }
});


/**
 * The main CRAWLER function. Now updated to be more selective.
 * @param {string} startUrl The URL where the crawl begins.
 */
async function crawlSite(startUrl) {
    uiReset();

    const crawledUrls = new Set();
    const allPageResults = [];
    const siteOrigin = new URL(startUrl).origin;
    
    try {
        // --- STEP 1: Always crawl and analyze the homepage first ---
        crawledUrls.add(startUrl);
        uiUpdateProgress(crawledUrls.size, startUrl);
        const homePageHtml = await fetchHtml(startUrl);
        const homePageDoc = new DOMParser().parseFromString(homePageHtml, 'text/html');
        const homePageChecks = runAllChecks(homePageDoc, startUrl);
        allPageResults.push({ url: startUrl, checks: homePageChecks });

        // --- STEP 2: Intelligently find ONLY menu links from the homepage ---
        const menuUrlsToCrawl = findMenuLinks(homePageDoc, startUrl, crawledUrls);

        // --- STEP 3: Loop through and crawl only the menu pages ---
        while (menuUrlsToCrawl.length > 0 && crawledUrls.size < MAX_PAGES_TO_CRAWL) {
            const currentUrl = menuUrlsToCrawl.shift();
            if (crawledUrls.has(currentUrl)) continue;

            crawledUrls.add(currentUrl);
            uiUpdateProgress(crawledUrls.size, currentUrl);
            
            try {
                const pageHtml = await fetchHtml(currentUrl);
                const pageDoc = new DOMParser().parseFromString(pageHtml, 'text/html');
                const pageChecks = runAllChecks(pageDoc, currentUrl);
                allPageResults.push({ url: currentUrl, checks: pageChecks });
            } catch (error) {
                console.error(`Failed to crawl menu page ${currentUrl}:`, error);
            }
        }
    } catch (error) {
         console.error(`Failed to crawl homepage ${startUrl}:`, error);
    }
    
    displayFinalReport(allPageResults);
}


/**
 * Helper function to fetch HTML for a given URL.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<string>} The HTML content.
 */
async function fetchHtml(url) {
    const response = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
        throw new Error(`Scraping service failed with status: ${response.status}`);
    }
    return await response.text();
}


/**
 * NEW: Smartly finds links within common navigation elements.
 * @param {Document} doc - The parsed HTML document of the homepage.
 * @param {string} startUrl - The base URL for resolving relative links.
 * @param {Set<string>} crawledUrls - A set of already crawled URLs to avoid duplication.
 * @returns {Array<string>} A unique array of menu link URLs.
 */
function findMenuLinks(doc, startUrl, crawledUrls) {
    // This selector targets links inside <nav> tags or elements with "nav" or "menu" in their ID/class.
    const navLinkSelectors = 'nav a, [id*="nav"] a, [id*="menu"] a, [class*="nav"] a, [class*="menu"] a';
    const links = new Set(); // Use a Set to automatically handle duplicates
    const siteOrigin = new URL(startUrl).origin;

    doc.querySelectorAll(navLinkSelectors).forEach(link => {
        try {
            const href = link.getAttribute('href');
            if (!href || href.startsWith('#')) return; // Ignore empty or anchor links

            const absoluteUrl = new URL(href, startUrl).href;
            
            // Add if it's an internal link and not already crawled
            if (absoluteUrl.startsWith(siteOrigin) && !crawledUrls.has(absoluteUrl)) {
                links.add(absoluteUrl);
            }
        } catch (e) { /* Ignore invalid hrefs */ }
    });

    return Array.from(links); // Convert the Set back to an array
}


// --- UI Update Functions ---
function uiReset() {
    resultsSection.classList.add('hidden');
    progressContainer.classList.remove('hidden');
    
    checklistContainer.innerHTML = '';
    scoreWrapper.classList.add('hidden');
}

function uiUpdateProgress(crawledCount, currentUrl) {
    const totalToCrawl = MAX_PAGES_TO_CRAWL; // We can improve this later if needed
    const percent = Math.round((crawledCount / totalToCrawl) * 100);
    progressBar.style.width = `${percent}%`;
    progressStatus.textContent = `Analyzing page ${crawledCount}/${totalToCrawl} (max): ${currentUrl.substring(0, 60)}...`;
}

function displayFinalReport(allPageResults) {
    progressContainer.classList.add('hidden');
    resultsSection.classList.remove('hidden');
    checklistContainer.innerHTML = '<h3>Site-Wide Compliance Checklist</h3>';

    if (allPageResults.length === 0) {
        checklistContainer.innerHTML += '<p>Could not retrieve any pages to analyze.</p>';
        return;
    }
    
    const checkStats = {};
    let totalPasses = 0;
    let totalChecks = 0;

    allPageResults.forEach(result => {
        if (result.checks) {
            result.checks.forEach(check => {
                if (!checkStats[check.name]) {
                    checkStats[check.name] = { passed: 0, total: 0 };
                }
                checkStats[check.name].total++;
                totalChecks++;
                if (check.passed) {
                    checkStats[check.name].passed++;
                    totalPasses++;
                }
            });
        }
    });

    const averageScore = totalChecks > 0 ? Math.round((totalPasses / totalChecks) * 100) : 0;

    scoreCircle.textContent = `${averageScore}`;

    if (averageScore <= 73) {
        ctaButton.classList.remove('hidden');
    } else {
        ctaButton.classList.add('hidden');
    }
    
    scoreWrapper.classList.remove('hidden');

    for (const name in checkStats) {
        const stats = checkStats[name];
        const passPercent = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
        
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


// --- Analysis Functions (Unchanged) ---
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
            } catch (e) { return false; }
        });
    } catch (e) { return false; }
}
function countInternalLinks(doc, url) {
    try {
        const pageHost = new URL(url).hostname;
        return Array.from(doc.querySelectorAll('a[href]')).filter(link => {
            try {
                const linkHost = new URL(link.href).hostname;
                return linkHost === pageHost;
            } catch (e) { return false; }
        }).length;
    } catch (e) { return 0; }
}
function checkReadability(text) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    const words = text.match(/\b\w+\b/g) || [];
    if (sentences.length === 0 || words.length === 0) return true;
    const average = words.length / sentences.length;
    return average < 25;
}
function getSchemaTypes(doc) {
    const schemas = [];
    const schemaScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    schemaScripts.forEach(script => {
        try {
            const json = JSON.parse(script.textContent);
            const graph = json['@graph'] || [json];
            graph.forEach(item => {
                if (item['@type']) {
                    schemas.push(item['@type']);
                }
            });
        } catch (e) {
            console.error("Error parsing JSON-LD:", e);
        }
    });
    return schemas.flat();
}