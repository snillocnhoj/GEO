// --- Helper Functions for Checks ---

/**
 * Counts links that point to other pages on the same website.
 * @param {Document} doc The JSDOM document object.
 * @param {string} url The URL of the page being checked.
 * @returns {number} The count of internal links.
 */
function countInternalLinks(doc, url) {
    try {
        const pageHost = new URL(url).hostname;
        return Array.from(doc.querySelectorAll('a[href]')).filter(link => {
            try {
                // Ensure the link has a hostname and it matches the page's hostname
                const linkHost = new URL(link.href, url).hostname;
                return linkHost === pageHost;
            } catch (e) {
                return false;
            }
        }).length;
    } catch (e) {
        return 0;
    }
}

/**
 * Checks if there are any links pointing to an external domain.
 * @param {Document} doc The JSDOM document object.
 * @param {string} url The URL of the page being checked.
 * @returns {boolean} True if outbound links are found.
 */
function hasOutboundLinks(doc, url) {
    try {
        const pageHost = new URL(url).hostname;
        return Array.from(doc.querySelectorAll('a[href]')).some(link => {
            try {
                 // Ensure the link has a hostname and it's different from the page's hostname
                const linkHost = new URL(link.href, url).hostname;
                return linkHost && linkHost !== pageHost;
            } catch (e) {
                return false;
            }
        });
    } catch (e) {
        return false;
    }
}

/**
 * Parses all JSON-LD script tags to find the defined schema types.
 * @param {Document} doc The JSDOM document object.
 * @returns {string[]} An array of schema types found (e.g., ['Article', 'FAQPage']).
 */
function getSchemaTypes(doc) {
    const schemas = [];
    doc.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
        try {
            const json = JSON.parse(script.textContent);
            // Schema can be a single object or an array in a @graph property
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
    return schemas.flat(); // Flatten in case a type is an array
}


// --- Individual Check Functions ---

function checkTitleTag(doc) {
    const passed = !!doc.querySelector('title')?.textContent;
    return { passed, details: passed ? 'OK' : 'No <title> tag found.' };
}

function checkMetaDescription(doc) {
    const passed = !!doc.querySelector('meta[name="description"]')?.content;
    return { passed, details: passed ? 'OK' : 'No <meta name="description"> tag found.' };
}

function checkH1Heading(doc) {
    const h1s = doc.querySelectorAll('h1').length;
    const passed = h1s === 1;
    return { passed, details: passed ? 'OK' : `Found ${h1s} <h1> tags (expected 1).` };
}

function checkViewport(doc) {
    const passed = !!doc.querySelector('meta[name="viewport"]');
    return { passed, details: passed ? 'OK' : 'Missing <meta name="viewport"> tag.' };
}

function checkInternalLinks(doc, url) {
    const count = countInternalLinks(doc, url);
    const passed = count > 2;
    return { passed, details: passed ? 'OK' : `Found only ${count} internal links (recommend > 2).` };
}

function checkAltText(doc) {
    const images = Array.from(doc.querySelectorAll('img'));
    const missingAlt = images.filter(img => !img.alt || !img.alt.trim());
    const passed = missingAlt.length === 0;
    return { passed, details: passed ? 'OK' : `Found ${missingAlt.length} images missing alt text. e.g., ${missingAlt.map(i => i.src).slice(0, 2).join(', ')}` };
}

function checkLists(doc) {
    const passed = doc.querySelectorAll('ul, ol').length > 0;
    return { passed, details: passed ? 'OK' : 'No bulleted or numbered lists found.' };
}

function checkReadability(text) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    const words = text.match(/\b\w+\b/g) || [];
    // Avoid division by zero
    const score = (sentences.length === 0 || words.length === 0) ? 0 : words.length / sentences.length;
    const passed = score < 25 && score > 0;
    return { passed, details: passed ? `Good (Avg. ${score.toFixed(1)} words/sentence).` : `High (Avg. ${score.toFixed(1)} words/sentence). Recommend < 25.` };
}

function checkAuthor(doc) {
    const passed = !!doc.querySelector('a[href*="author/"], a[rel="author"]');
    return { passed, details: passed ? 'OK' : 'No link to an author bio page found.' };
}

function checkExperience(text) {
    // This check uses a regex to find a wider variety of phrases indicating personal experience.
    const experienceRegex = /in our test|hands-on|my experience|we visited|I found that|our team reviewed|we tested|firsthand|I personally|from my experience|having used|our hands-on review/i;
    const passed = experienceRegex.test(text);
    return { passed, details: passed ? 'OK' : 'No phrases indicating first-hand experience found.' };
}

function checkFreshness(doc, text) {
    const passed = /updated|published/i.test(text) || !!doc.querySelector('meta[property*="time"]');
    return { passed, details: passed ? 'OK' : 'No "published" or "last updated" date found.' };
}

function checkContact(doc) {
    const passed = !!doc.querySelector('a[href*="contact"], a[href*="about"]');
    return { passed, details: passed ? 'OK' : 'No link to a Contact or About page found.' };
}

function checkOutboundLinks(doc, url) {
    const passed = hasOutboundLinks(doc, url);
    return { passed, details: passed ? 'OK' : 'No links to external websites found.' };
}

function checkSchemaFound(types) {
    const passed = types.length > 0;
    return { passed, details: passed ? `Found: ${types.join(', ')}` : 'No Schema.org data found.' };
}

function checkArticleOrgSchema(types) {
    const passed = types.includes('Article') || types.includes('Organization');
    return { passed, details: passed ? 'OK' : 'Missing essential Article or Organization schema.' };
}

function checkFaqHowToSchema(types) {
    const passed = types.includes('FAQPage') || types.includes('HowTo');
    return { passed, details: passed ? 'OK' : 'Missing high-value FAQ or How-To schema.' };
}

/**
 * Checks for conversational tone by looking for question-based headings or significant
 * use of second-person pronouns (you, your). This helps AI identify content that
 * directly addresses user queries.
 */
function checkConversationalTone(doc, text) {
    const headings = doc.querySelectorAll('h2, h3');
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'is', 'can', 'do', 'are', 'which', 'who', 'does', 'should'];
    const hasQuestionHeadings = Array.from(headings).some(h => {
        const headingText = h.textContent.trim().toLowerCase();
        return questionWords.some(word => headingText.startsWith(word));
    });
    if (hasQuestionHeadings) return { passed: true, details: 'OK (Found question-based subheadings).' };

    const pronounCount = (text.match(/\byou\b|\byour\b/gi) || []).length;
    if (pronounCount > 5) {
        return { passed: true, details: `OK (Found ${pronounCount} second-person pronouns).` };
    }
    return { passed: false, details: 'No question-based subheadings or significant use of second-person pronouns (you/your) found.' };
}

/**
 * Checks for signals of original data, such as keywords, HTML tables, or embedded
 * data visualizations. This is a strong signal of authority for AI.
 */
function checkUniqueData(doc, text) {
    const hasKeywords = /our data|our research|we surveyed|according to our study|we analyzed|our findings show|in our analysis/i.test(text);
    if (hasKeywords) return { passed: true, details: 'OK (Found keywords indicating original research).' };

    const hasTable = doc.querySelector('table');
    if (hasTable) return { passed: true, details: 'OK (Found an HTML <table> element).' };

    const vizPlatforms = ['tableau', 'datawrapper', 'sheets.google.com', 'fusiontables.google.com'];
    const hasEmbeddedViz = Array.from(doc.querySelectorAll('iframe')).some(iframe => {
        const src = iframe.getAttribute('src') || '';
        return vizPlatforms.some(platform => src.includes(platform));
    });
    if (hasEmbeddedViz) return { passed: true, details: 'OK (Found an embedded data visualization).' };

    return { passed: false, details: 'No signals of original data, research, or visualizations found.' };
}

function checkCitations(doc, text) {
    const hasKeywords = /source:|according to:|citation:/i.test(text);
    if (hasKeywords) return { passed: true, details: 'OK (Found citation keywords).' };

    const hasParagraphLinks = Array.from(doc.querySelectorAll('p a')).some(link => {
        try {
            const pageHost = new URL(doc.baseURI).hostname;
            const linkHost = new URL(link.href, doc.baseURI).hostname;
            return linkHost && linkHost !== pageHost;
        } catch (e) {
            return false;
        }
    });
    if (hasParagraphLinks) return { passed: true, details: 'OK (Found outbound links within paragraph text).' };

    return { passed: false, details: 'No cited sources or contextual outbound links found in paragraphs.' };
}

/**
 * Runs all 19 GEO checks against a single page's document object.
 * This function is now formatted as a multi-line array for better readability.
 * @param {Document} doc The JSDOM document object for the page.
 * @param {string} url The URL of the page being analyzed.
 * @returns {Array<Object>} An array of check result objects.
 */
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
        { name: 'Conversational Tone', ...checkConversationalTone(doc, textContent) },
        { name: 'Clear Structure (Lists)', ...checkLists(doc) },
        { name: 'Readability', ...checkReadability(textContent) },
        { name: 'Unique Data/Insights', ...checkUniqueData(doc, textContent) },
        { name: 'Author Byline/Bio', ...checkAuthor(doc) },
        { name: 'First-Hand Experience', ...checkExperience(textContent) },
        { name: 'Content Freshness', ...checkFreshness(doc, textContent) },
        { name: 'Contact Information', ...checkContact(doc) },
        { name: 'Outbound Links', ...checkOutboundLinks(doc, url) },
        { name: 'Cited Sources', ...checkCitations(doc, textContent) },
        { name: 'Schema Found', ...checkSchemaFound(schemaTypes) },
        { name: 'Article or Org Schema', ...checkArticleOrgSchema(schemaTypes) },
        { name: 'FAQ or How-To Schema', ...checkFaqHowToSchema(schemaTypes) },
    ];
}

module.exports = { runAllChecks };