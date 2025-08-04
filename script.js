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
const scoreLegend = document.getElementById('score-legend');
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
        // Set button to disabled state immediately
        analyzeButton.textContent = 'Inspection in Progress...';
        analyzeButton.disabled = true;
        await crawlSite(startUrl);

    } catch (error) {
        console.error("A critical error occurred:", error);
        alert(`An unexpected error occurred: ${error.message}. Please check the URL and try again.`);
        uiReset(); // Reset UI on critical failure
        resultsSection.classList.remove('hidden');
        checklistContainer.innerHTML = '<h3>Site-Wide Compliance Checklist</h3><p>The analysis could not be completed.</p>';

    } finally {
        // This block will always run, re-enabling the button
        analyzeButton.textContent = 'Start Full Site Inspection!';
        analyzeButton.disabled = false;
    }
});


/**
 * The main CRAWLER function. It orchestrates the entire site analysis.
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
        if (crawledUrls.has(currentUrl)) {
            continue;
        }

        try {
            crawledUrls.add(currentUrl);
            uiUpdateProgress(crawledUrls.size, currentUrl);

            const response = await fetch(`/api/scrape?url=${encodeURIComponent(currentUrl)}`);
            if (!response.ok) {
                console.error(`Scraping service failed for ${currentUrl} with status: ${response.status}`);
                continue; 
            }
            
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
                } catch (e) { 
                    // Ignore invalid URLs
                }
            });
        } catch (error) {
            console.error(`Failed to crawl ${currentUrl}:`, error);
        }
    }

    displayFinalReport(allPageResults);
}

// --- UI Update Functions ---
function uiReset() {
    // Hide results, show progress
    resultsSection.classList.add('hidden');
    progressContainer.classList.remove('hidden');
    
    // Clear out previous results completely
    checklistContainer.innerHTML = '<h3>Site-Wide Compliance Checklist</h3>';
    
    // Hide the entire score wrapper initially
    scoreWrapper.classList.add('hidden');
    ctaButton.classList.add('hidden');
}

function uiUpdateProgress(crawledCount, currentUrl) {
    const percent = Math.round((crawledCount / MAX_PAGES_TO_CRAWL) * 100);
    progressBar.style.width = `${percent}%`;
    progressStatus.textContent = `Analyzing page ${crawledCount}/${MAX_PAGES_TO_CRAWL}: ${currentUrl.substring(0, 70)}...`;
}

/**
 * Gets the category object (label and class name) based on the score.
 * @param {number} score - The final calculated score.
 * @returns {Object} An object with label and className.
 */
function getScoreCategory(score) {
    if (score >= 90) return { label: 'Excellent', className: 'score-excellent' };
    if (score >= 80) return { label: 'Good', className: 'score-good' };
    if (score >= 70) return { label: 'Room to Improve', className: 'score-improve' };
    if (score >= 60) return { label: 'Needs Help', className: 'score-needs-help' };
    return { label: 'Needs Urgent Help', className: 'score-urgent' };
}

function displayFinalReport(allPageResults) {
    progressContainer.classList.add('hidden');
    resultsSection.classList.remove('hidden');

    // Handle case where no pages could be analyzed
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
                }
            });
        }
    });

    const averageScore = totalChecks > 0 ? Math.round((totalPasses / totalChecks) * 100) : 0;
    const scoreCategory = getScoreCategory(averageScore);

    // Update score elements
    scoreCircle.textContent = `${averageScore}`;
    scoreCircle.className = 'score-circle'; // Reset classes
    scoreCircle.classList.add(scoreCategory.className);
    
    scoreLegend.textContent = scoreCategory.label;
    scoreLegend.className = 'score-legend'; // Reset classes
    scoreLegend.classList.add(scoreCategory.className);

    // Update and show CTA button if needed
    if (averageScore <= 73) {
        ctaButton.classList.remove('hidden');
    }
    
    // Unhide the entire score wrapper now that it's populated
    scoreWrapper.classList.remove('hidden');

    // Populate the checklist
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