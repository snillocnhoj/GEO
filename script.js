// --- Constants ---
const MAX_PAGES_TO_CRAWL = 10;
const INITIAL_PROGRESS_MESSAGES = [
    "Loading up the ride vehicles...",
    "Checking the safety harnesses...",
    "Consulting the park map for all the attractions...",
    "Calibrating the thrill sensors...",
    "Getting ready for the big drop...",
];
const FINAL_MARKETING_MESSAGES = [
    "Brought to you by John Collins Consulting",
    "Are you mentioned when AI answers questions about your industry?",
    "We have deep industry experience",
    "Good GEO turns your website into a primary source for AI.",
    "We're trusted by attractions industry leaders",
    "Did you know? AI favors content that demonstrates first-hand experience.",
    "We'll help you raise your score!",
    "Optimizing for AI today means more customers tomorrow.",
    "Don't let AI choose your competitors over you.",
    "Get ready, here it comes..."
];
let progressInterval;
let coasterAnimationInterval;

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
const coasterCar = document.getElementById('coaster-car');
const scoreSnapshotContainer = document.getElementById('score-snapshot-container');
const scoreSnapshotDiv = document.getElementById('score-snapshot');
const downloadSnapshotButton = document.getElementById('download-snapshot');


// --- Event Listeners ---
urlInput.addEventListener('input', () => {
    ticketWebsiteName.textContent = urlInput.value || "https://your-website.com";
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
        analyzeButton.textContent = 'ADMIT ONE - Start Full Site Inspection!';
        analyzeButton.disabled = false;
        clearInterval(progressInterval);
        clearInterval(coasterAnimationInterval);
        if (progressBar) progressBar.style.width = '100%';
        if (coasterCar) coasterCar.style.left = 'calc(100% - 15px)';
    }
});


// --- UI Update Functions ---
function uiReset() {
    resultsSection.classList.add('hidden');
    progressContainer.classList.remove('hidden');
    if (progressBar) {
        progressBar.style.transition = 'none';
        progressBar.style.width = '0%';
    }
    if (coasterCar) coasterCar.style.left = '-15px';

    checklistContainer.innerHTML = '';
    scoreWrapper.classList.add('hidden');
    scoreSnapshotContainer.style.display = 'none';

    clearInterval(progressInterval);
    clearInterval(coasterAnimationInterval);
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

    if (coasterCar) {
        let currentPos = 0;
        coasterAnimationInterval = setInterval(() => {
            currentPos += 1;
            if(currentPos <= 90) {
                 coasterCar.style.left = `calc(${currentPos}% - 15px)`;
            }
            if(currentPos >= 90) {
                clearInterval(coasterAnimationInterval);
            }
        }, 250); // Matches the 25s total transition time for 90%
    }
}


function getScoreInterpretation(score) {
    if (score >= 90) return "Your site is a prime candidate for AI features! Prepare for maximum thrills!";
    if (score >= 80) return "Your site has a strong foundation. A few more loops and you'll be soaring!";
    if (score <= 73) return "Your site has potential, but there are a few unexpected drops ahead.";
    return "";
}

function displayFinalReport(results) {
    clearInterval(progressInterval);
    clearInterval(coasterAnimationInterval);
    progressStatus.textContent = "The ride has finished! Checking your photos...";

    progressBar.style.transition = 'width 0.5s ease-in-out';
    progressBar.style.width = '100%';
    if (coasterCar) coasterCar.style.left = 'calc(100% - 15px)';

    setTimeout(() => {
        progressContainer.classList.add('hidden');
        resultsSection.classList.remove('hidden');
        scoreSnapshotContainer.style.display = 'block';
        generateScoreSnapshot(results);
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

// --- Score Snapshot Functions ---
function generateScoreSnapshot(results) {
    const { averageScore } = results;
    const siteUrl = urlInput.value.trim();
    
    scoreSnapshotDiv.innerHTML = `
        <div style="padding: 20px; text-align: center; background: #0c0a1a; color: white; border-radius: 10px; font-family: 'Open Sans', sans-serif;">
            <img src="logo.png" style="max-width: 100px; margin-bottom: 15px;">
            <h4 style="font-family: 'Bangers', cursive; font-size: 1.8rem; color: #4cc9f0; margin: 0;">My GEO Thrill Score</h4>
            <p style="font-size: 1.1rem; margin: 5px 0 15px;">for ${siteUrl}</p>
            <div style="font-family: 'Bangers', cursive; font-size: 4rem; color: #fff; margin-bottom: 15px;">${averageScore}</div>
            <p style="font-size: 0.8rem; color: #ccc;">Analyzed by the GEO Thrill-O-Meter</p>
        </div>
    `;
}

if (downloadSnapshotButton) {
    downloadSnapshotButton.addEventListener('click', () => {
        html2canvas(scoreSnapshotDiv).then(canvas => {
            const link = document.createElement('a');
            link.download = 'geo-score-snapshot.png';
            link.href = canvas.toDataURL();
            link.click();
        });
    });
}

function shareScore(platform) {
    const siteUrl = urlInput.value.trim();
    const text = encodeURIComponent(`I just tested my website's GEO score with the Thrill-O-Meter! Check it out:`);
    const url = `https://geo-thrill-o-matic.onrender.com/`; // Link back to your app
    let shareUrl = '';

    if (platform === 'linkedin') {
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    } else if (platform === 'twitter') {
        shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${text}`;
    }

    if(shareUrl) {
        window.open(shareUrl, '_blank');
    }
}