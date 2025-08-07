// --- Constants ---
const MAX_PAGES_TO_CRAWL = 10;
const PROGRESS_MESSAGES = [
    "Warming up the engines...",
    "Scanning for E-E-A-T signals to build trust with AI...",
    "Did you know? AI prioritizes sites that answer customer questions.",
    "Checking if your content is 'quotable' for search results...",
    "Analyzing your site's structure for readability...",
    "A high score means more visibility in AI Overviews!",
    "Compiling final report..."
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
const scoreCircle = document.getElementById('score-circle'); // Reverted to scoreCircle
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
    let messageIndex = 0;
    progressStatus.textContent = PROGRESS_MESSAGES[messageIndex];
    
    setTimeout(() => {
        progressBar.style.transition = 'width 25s ease-in-out';
        progressBar.style.width = '90%';
    }, 100);

    progressInterval = setInterval(() => {
        messageIndex++;
        // NEW LOGIC: Cycle between last two messages
        if (messageIndex >= PROGRESS_MESSAGES.length) {
            // It will now alternate between the last and second-to-last message
            messageIndex = PROGRESS_MESSAGES.length - 2; 
        }
        progressStatus.textContent = PROGRESS_MESSAGES[messageIndex];
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

    scoreCircle.textContent = `${averageScore}`; // Reverted to scoreCircle
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