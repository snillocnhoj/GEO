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

    uiReset();
    
    try {
        const startUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
        analyzeButton.textContent = 'Inspection in Progress...';
        analyzeButton.disabled = true;

        // Animate progress bar while waiting for the server
        animateProgressBar();

        // Make a single API call to our backend to do all the work
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
        progressBar.style.width = '100%'; // Ensure it finishes
    }
});


// --- UI Update Functions ---
function uiReset() {
    resultsSection.classList.add('hidden');
    progressContainer.classList.remove('hidden');
    progressBar.style.transition = 'none'; // Disable transition for reset
    progressBar.style.width = '0%';
    
    checklistContainer.innerHTML = '';
    scoreWrapper.classList.add('hidden');
}

function animateProgressBar() {
    // Fake a slow progress bar to give user feedback during the long backend call
    progressBar.style.transition = 'width 15s ease-in-out';
    progressBar.style.width = '90%';
    progressStatus.textContent = 'Analyzing site... This may take a moment.';
}

function displayFinalReport(results) {
    // Set progress bar to 100% on completion
    progressBar.style.transition = 'width 0.5s ease-in-out';
    progressBar.style.width = '100%';
    
    // Use a short timeout to hide progress and show results, allowing the 100% bar to be seen
    setTimeout(() => {
        progressContainer.classList.add('hidden');
        resultsSection.classList.remove('hidden');
    }, 500);

    const { averageScore, checkStats } = results;
    checklistContainer.innerHTML = '<h3>Site-Wide Compliance Checklist</h3>';
    
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