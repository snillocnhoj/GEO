// --- Constants & Data ---
const MAX_PAGES_TO_CRAWL = 10;
const INITIAL_PROGRESS_MESSAGES = ["Warming up the engines...","Scanning for E-E-A-T signals to build trust with AI...","Did you know? AI prioritizes sites that answer customer questions.","Checking if your content is 'quotable' for search results...","Analyzing your site's structure for readability..."];
const FINAL_MARKETING_MESSAGES = ["Brought to you by John Collins Consulting","Are you mentioned when AI answers questions about your industry?","We have deep industry experience","Good GEO turns your website into a primary source for AI.","We're trusted by attractions industry leaders","Did you know? AI favors content that demonstrates first-hand experience.","We'll help you raise your score!","Optimizing for AI today means more customers tomorrow.","Don't let AI choose your competitors over you.","Get ready, here it comes..."];
let progressInterval;

const MODAL_CONTENT = {
    "why-geo": {
        title: "Why is GEO so important?",
        text: "Generative Engine Optimization (GEO) is the next evolution of SEO. As users increasingly get answers directly from AI like Google's AI Overviews, your website must be structured to be a trusted source. Good GEO ensures your brand is not just listed, but is actively cited and recommended by AI, putting you in front of customers before they even see a list of competitors."
    },
    "Title Tag": {
        title: "Title Tag",
        text: "The <title> tag is the primary title of your webpage shown in browser tabs and search results. It is the single most important signal to all search engines about the page's core topic."
    },
    "Meta Description": {
        title: "Meta Description",
        text: "This provides the short summary that appears under your title in search results. A compelling description encourages clicks and gives generative AI a quick, clear summary of the page's purpose."
    },
    "H1 Heading": {
        title: "H1 Heading",
        text: "The <h1> is the main headline of your on-page content. Having exactly one reinforces the page's main topic for AI crawlers and helps them understand the content's hierarchy."
    },
    "Mobile-Friendly Viewport": {
        title: "Mobile-Friendly Viewport",
        text: "This tag signals that your site is designed to work well on mobile devices. User experience is a critical factor, and AI engines prioritize content from sites that are accessible and easy to use for everyone."
    },
    "Internal Linking": {
        title: "Internal Linking",
        text: "Good internal linking helps AI discover more of your content and understand how different topics on your site are related, establishing your overall authority on a subject."
    },
    "Image Alt Text": {
        title: "Image Alt Text",
        text: "AI cannot 'see' images. Alt text provides a literal description, giving crucial context about the image that helps the AI better understand the page's topic."
    },
    "Conversational Tone": {
        title: "Conversational Tone",
        text: "Generative search is designed to answer questions. Structuring your content with question-based headings makes it incredibly easy for an AI to select your content as a direct answer."
    },
    "Clear Structure (Lists)": {
        title: "Clear Structure (Lists)",
        text: "Lists break down information into simple, digestible steps or points. AI engines love this format because it's easy to parse, summarize, and feature."
    },
    "Readability": {
        title: "Readability",
        text: "Clear, concise language is easier for both humans and AI to understand and is less likely to be misinterpreted."
    },
    "Unique Data/Insights": {
        title: "Unique Data/Insights",
        text: "Citing original data or analysis is a powerful signal that your content is a primary source, making it much more valuable and likely to be featured by an AI."
    },
    "Author Byline/Bio": {
        title: "Author Byline/Bio",
        text: "This signals Expertise and Authoritativeness. It shows that the content was written by a real person with a verifiable background, which AI gives significant weight to."
    },
    "First-Hand Experience": {
        title: "First-Hand Experience",
        text: "This directly signals the 'E' for Experience. It shows the author has direct, hands-on experience with the topic, making the content more authentic and trustworthy."
    },
    "Content Freshness": {
        title: "Content Freshness",
        text: "Shows that the content is current and actively maintained, which is a key signal of a trustworthy and high-quality website."
    },
    "Contact Information": {
        title: "Contact Information",
        text: "A fundamental Trust signal. Legitimate businesses are transparent and provide ways for users to get in touch."
    },
    "Outbound Links": {
        title: "Outbound Links",
        text: "Linking to other authoritative sources shows your content is well-researched and credible, signaling Authoritativeness."
    },
    "Cited Sources": {
        title: "Cited Sources",
        text: "This is a strong signal of Trustworthiness. It shows you are backing up your claims with evidence, making your content more reliable."
    },
    "Schema Found": {
        title: "Schema Found",
        text: "Schema explicitly tells an AI what your content is (e.g., 'this is an article'). It is a critical component of technical GEO."
    },
    "Article or Org Schema": {
        title: "Article or Org Schema",
        text: "'Article' schema provides context like author and dates (E-E-A-T signals), while 'Organization' schema helps establish the entity behind the website (a Trust signal)."
    },
    "FAQ or How-To Schema": {
        title: "FAQ or How-To Schema",
        text: "This is one of the most powerful schema types, as it structures your content in a Q&A or step-by-step format that generative AI can lift directly into its answers."
    }
};

// --- DOM Elements ---
const urlInput = document.getElementById('urlInput');
const analyzeButton = document.getElementById('analyzeButton');
const progressContainer = document.getElementById('progress-container');
const progressStatus = document.getElementById('progress-status');
const progressBar = document.getElementById('progress-bar');
const resultsSection = document.getElementById('results');
const scoreWrapper = document.getElementById('score-wrapper');
const scoreCircle = document.getElementById('score-circle');
const scoreInterpretation = document.getElementById('score-interpretation');
const ctaButton = document.getElementById('cta-button');
const checklistContainer = document.getElementById('checklist-container');
const ticketWebsiteName = document.getElementById('ticket-website-name');
const whyGeoButton = document.getElementById('why-geo-button');
const infoModal = document.getElementById('info-modal');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');
const modalCloseButton = document.getElementById('modal-close-button');


// --- Event Listeners ---
urlInput.addEventListener('input', () => {
    if (ticketWebsiteName) {
        ticketWebsiteName.textContent = urlInput.value.replace(/^https?:\/\//, '') || "your-website.com";
    }
});

analyzeButton.addEventListener('click', async () => {
    const rawUrl = urlInput.value.trim();
    if (!rawUrl) {
        alert('Please enter a website URL.');
        return;
    }

    uiReset();
    
    try {
        const startUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
        analyzeButton.disabled = true;
        animateProgressBar();

        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ startUrl: startUrl })
        });

        if (!response.ok) {
            throw new Error('Analysis failed on the server.');
        }

        const results = await response.json();
        displayFinalReport(results);

    } catch (error) {
        console.error("A critical error occurred:", error);
        progressContainer.classList.add('hidden');
        resultsSection.classList.remove('hidden');
        checklistContainer.innerHTML = '<h3>Site-Wide Compliance Checklist</h3><p>The analysis could not be completed.</p>';
    } finally {
        analyzeButton.disabled = false;
        clearInterval(progressInterval);
    }
});

whyGeoButton.addEventListener('click', () => openModal('why-geo'));
modalCloseButton.addEventListener('click', closeModal);
infoModal.addEventListener('click', (event) => {
    if (event.target === infoModal) {
        closeModal();
    }
});

// --- Modal Functions ---
function openModal(checkName) {
    const content = MODAL_CONTENT[checkName];
    if (content) {
        modalTitle.textContent = content.title;
        modalText.textContent = content.text;
        infoModal.classList.remove('hidden');
        document.body.classList.add('modal-open');
    }
}
function closeModal() {
    infoModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
}

// --- UI Update Functions ---
function uiReset() {
    resultsSection.classList.add('hidden');
    progressContainer.classList.remove('hidden');
    if (progressBar) {
        progressBar.style.transition = 'none';
        progressBar.style.width = '0%';
    }
    checklistContainer.innerHTML = '';
    scoreWrapper.classList.add('hidden');
    clearInterval(progressInterval);
}

function animateProgressBar() {
    let initialMessageIndex = 0;
    let finalMessageIndex = 0;
    let finalAlternatingCounter = 0;
    
    progressStatus.textContent = INITIAL_PROGRESS_MESSAGES[initialMessageIndex];
    
    setTimeout(() => {
        if (progressBar) {
            progressBar.style.transition = 'width 25s ease-in-out';
            progressBar.style.width = '90%';
        }
    }, 100);

    const initialInterval = setInterval(() => {
        initialMessageIndex++;
        if (initialMessageIndex >= INITIAL_PROGRESS_MESSAGES.length) {
            clearInterval(initialInterval);
            progressStatus.textContent = "Compiling final report...";
            progressInterval = setInterval(() => {
                finalAlternatingCounter++;
                if (finalAlternatingCounter % 2 === 0) {
                    progressStatus.textContent = "Compiling final report...";
                } else {
                    progressStatus.textContent = FINAL_MARKETING_MESSAGES[finalMessageIndex];
                    finalMessageIndex = (finalMessageIndex + 1) % FINAL_MARKETING_MESSAGES.length;
                }
            }, 3000);
        } else {
            progressStatus.textContent = INITIAL_PROGRESS_MESSAGES[initialMessageIndex];
        }
    }, 4000); 
}

function getScoreInterpretation(score) {
    if (score >= 90) return "Your site is a prime candidate for AI features! Prepare for maximum thrills!";
    if (score >= 80) return "Your site has a strong foundation. A few more loops and you'll be soaring!";
    if (score <= 73) return "Your site has potential, but there are a few unexpected drops ahead.";
    return "";
}

function displayFinalReport(results) {
    clearInterval(progressInterval);
    progressStatus.textContent = "Analysis complete!";
    
    if (progressBar) {
        progressBar.style.transition = 'width 0.5s ease-in-out';
        progressBar.style.width = '100%';
    }
    
    setTimeout(() => {
        progressContainer.classList.add('hidden');
        resultsSection.classList.remove('hidden');
    }, 500);

    const { averageScore, checkStats } = results;
    checklistContainer.innerHTML = '<h3>Site-Wide Compliance Checklist</h3>';
    
    if (!checkStats || Object.keys(checkStats).length === 0) {
        checklistContainer.innerHTML += '<p>Could not retrieve any pages to analyze.</p>';
        return;
    }

    scoreCircle.textContent = `${averageScore}`;
    scoreInterpretation.textContent = getScoreInterpretation(averageScore);

    if (averageScore <= 73) {
        ctaButton.classList.remove('hidden');
    } else {
        ctaButton.classList.add('hidden');
    }
    
    scoreWrapper.classList.remove('hidden');

    for (const name in checkStats) {
        const stats = checkStats[name];
        const passPercent = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
        const icon = passPercent >= 75 ? '✔️' : '❌';
        const checkItem = document.createElement('div');
        checkItem.className = `check-item ${passPercent >= 75 ? 'passed' : 'failed'}`;
        checkItem.innerHTML = `
            <div class="check-item-icon">${icon}</div>
            <div class="check-item-text">
                <div>
                    <strong>${name}</strong>
                    <span>Passed on ${stats.passed} of ${stats.total} pages (${passPercent}%)</span>
                </div>
                <button class="check-item-info-button" data-check-name="${name}">?</button>
            </div>
        `;
        checklistContainer.appendChild(checkItem);
    }
    
    document.querySelectorAll('.check-item-info-button').forEach(button => {
        button.addEventListener('click', (event) => {
            const checkName = event.target.getAttribute('data-check-name');
            openModal(checkName);
        });
    });
}