// --- Constants ---
const MAX_PAGES_TO_CRAWL = 10;
const INITIAL_PROGRESS_MESSAGES = [
    "Warming up the engines...",
    "Scanning for E-E-A-T signals to build trust with AI...",
    "Did you know? AI prioritizes sites that answer customer questions.",
    "Checking if your content is 'quotable' for search results...",
    "Analyzing your site's structure for readability...",
];
// NEW: Final marketing phrases for the last stage
const FINAL_MARKETING_MESSAGES = [
    "Brought to you by John Collins Consulting",
    "We have deep industry experience",
    "We're trusted by attractions industry leaders",
    "We'll help you raise your score!",
    "Get ready, here it comes..."
];
let progressInterval;

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


// --- Main Event Listener ---
analyzeButton.addEventListener('click', async () => {
    const rawUrl = urlInput.value.trim();
    if (!rawUrl) {
        alert('Please enter a website URL.');
        return;
    }

    uiReset();
    
    try {
        const startUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
        analyzeButton.textContent = 'Inspection in Progress...';
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
        analyzeButton.textContent = 'Start Full Site Inspection!';
        analyzeButton.disabled = false;
        clearInterval(progressInterval);
        progressBar.style.width = '100%';
    }
});


// --- UI Update Functions ---
function uiReset() {
    resultsSection.classList.add('hidden');
    progressContainer.classList.remove('hidden');
    progressBar.style.transition = 'none';
    progressBar.style.width = '0%';
    
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
        progressBar.style.transition = 'width 25s ease-in-out';
        progressBar.style.width = '90%';
    }, 100);

    const initialInterval = setInterval(() => {
        initialMessageIndex++;
        if (initialMessageIndex >= INITIAL_PROGRESS_MESSAGES.length) {
            clearInterval(initialInterval);
            
            // --- NEW ALTERNATING LOGIC ---
            progressStatus.textContent = "Compiling final report...";
            progressInterval = setInterval(() => {
                finalAlternatingCounter++;
                if (finalAlternatingCounter % 2 === 0) {
                    // On even counts, show "Compiling..."
                    progressStatus.textContent = "Compiling final report...";
                } else {
                    // On odd counts, show the next marketing message
                    progressStatus.textContent = FINAL_MARKETING_MESSAGES[finalMessageIndex];
                    finalMessageIndex = (finalMessageIndex + 1) % FINAL_MARKETING_MESSAGES.length;
                }
            }, 3000); // Alternate every 3 seconds

        } else {
            progressStatus.textContent = INITIAL_PROGRESS_MESSAGES[initialMessageIndex];
        }
    }, 4000); 
}

function getScoreInterpretation(score) {
    if (score >= 90) return "Your site is a prime candidate for AI features! You have a powerful advantage over competitors.";
    if (score >= 80) return "Your site has a strong foundation. Let's discuss how to leverage this advantage.";
    if (score <= 73) return "Your site is missing key signals and is likely being ignored by generative AI. This represents a significant lost opportunity.";
    return "";
}

function displayFinalReport(results) {
    clearInterval(progressInterval);
    progressStatus.textContent = "Analysis complete!";
    
    progressBar.style.transition = 'width 0.5s ease-in-out';
    progressBar.style.width = '100%';
    
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
        checkItem.innerHTML = `<div class="check-item-icon">${icon}</div><div class="check-item-text"><strong>${name}</strong><span>Passed on ${stats.passed} of ${stats.total} pages (${passPercent}%)</span></div>`;
        checklistContainer.appendChild(checkItem);
    }
}