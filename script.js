// --- Constants & Data ---
const TICKET_COLORS = ['#fdd835', '#4cc9f0', '#f72585', '#7209b7'];
let currentReportId = null; // To store the ID of the last report

// ... (rest of the constants are the same) ...
const MAX_PAGES_TO_CRAWL = 10;
const INITIAL_PROGRESS_MESSAGES = ["Warming up the engines...","Scanning for E-E-A-T signals to build trust with AI...","Did you know? AI prioritizes sites that answer customer questions.","Checking if your content is 'quotable' for search results...","Analyzing your site's structure for readability..."];
const FINAL_MARKETING_MESSAGES = ["Brought to you by John Collins Consulting","Are you mentioned when AI answers questions about your industry?","We have deep industry experience","Good GEO turns your website into a primary source for AI.","We're trusted by attractions industry leaders","Did you know? AI favors content that demonstrates first-hand experience.","We'll help you raise your score!","Optimizing for AI today means more customers tomorrow.","Don't let AI choose your competitors over you.","Get ready, here it comes..."];
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
const ticketWebsiteName = document.getElementById('ticket-website-name');
const whyGeoButton = document.getElementById('why-geo-button');
const infoModal = document.getElementById('info-modal');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');
const modalCloseButton = document.getElementById('modal-close-button');
const thrillTicket = document.getElementById('thrill-ticket');


// --- Event Listeners ---
urlInput.addEventListener('input', () => { /* ... unchanged ... */ });
analyzeButton.addEventListener('click', async () => { /* ... unchanged ... */ });
whyGeoButton.addEventListener('click', () => openModal('why-geo'));
modalCloseButton.addEventListener('click', closeModal);
infoModal.addEventListener('click', (event) => { /* ... unchanged ... */ });


// --- NEW: Event listener for the "Send My Report" button ---
ctaButton.addEventListener('click', async () => {
    if (!currentReportId) {
        alert('Could not find the report to send. Please run the analysis again.');
        return;
    }
    ctaButton.textContent = 'SENDING...';
    ctaButton.disabled = true;
    try {
        const response = await fetch('/api/send-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportId: currentReportId })
        });
        if (response.ok) {
            ctaButton.textContent = 'REPORT SENT! ✅';
        } else {
            throw new Error('Server failed to send the report.');
        }
    } catch (error) {
        alert('There was an error sending your report. Please try again.');
        ctaButton.textContent = 'SEND MY REPORT!';
        ctaButton.disabled = false;
    }
});


// --- Modal Functions (unchanged) ---
function openModal(checkName) { /* ... */ }
function closeModal() { /* ... */ }

// --- UI Update Functions ---
function uiReset() {
    // ... unchanged ...
}

function animateProgressBar() {
    // --- UPDATED with ticket color animation ---
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
        if (thrillTicket) {
            thrillTicket.style.backgroundColor = TICKET_COLORS[initialMessageIndex % TICKET_COLORS.length];
        }
        if (initialMessageIndex >= INITIAL_PROGRESS_MESSAGES.length) {
            clearInterval(initialInterval);
            progressStatus.textContent = "Compiling final report...";
            progressInterval = setInterval(() => {
                finalAlternatingCounter++;
                if (thrillTicket) {
                     thrillTicket.style.backgroundColor = TICKET_COLORS[finalAlternatingCounter % TICKET_COLORS.length];
                }
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

function displayFinalReport(results) {
    // --- UPDATED to handle new server response ---
    clearInterval(progressInterval);
    if (thrillTicket) { thrillTicket.style.backgroundColor = '#fdd835'; } // Reset ticket color
    progressStatus.textContent = "Analysis complete!";
    
    if (progressBar) {
        progressBar.style.transition = 'width 0.5s ease-in-out';
        progressBar.style.width = '100%';
    }
    
    setTimeout(() => {
        progressContainer.classList.add('hidden');
        resultsSection.classList.remove('hidden');
    }, 500);
    
    const { summary, reportId } = results; // Get the summary and the new reportId
    currentReportId = reportId; // Store the reportId for the send button
    
    const { averageScore, checkStats } = summary;
    
    // ... rest of the display logic is the same ...
    checklistContainer.innerHTML = '<h3>Site-Wide Compliance Checklist</h3>';
    if (!checkStats || Object.keys(checkStats).length === 0) {
        checklistContainer.innerHTML += '<p>Could not retrieve any pages to analyze.</p>';
        return;
    }
    scoreCircle.textContent = `${averageScore}`;
    scoreInterpretation.textContent = getScoreInterpretation(averageScore);
    if (averageScore <= 73) {
        ctaButton.classList.remove('hidden');
        ctaButton.textContent = 'SEND MY REPORT!'; // Reset button text
        ctaButton.disabled = false;
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
        checkItem.innerHTML = `<div class="check-item-icon">${icon}</div><div class="check-item-text"><div><strong>${name}</strong><span>Passed on ${stats.passed} of ${stats.total} pages (${passPercent}%)</span></div><button class="check-item-info-button" data-check-name="${name}">?</button></div>`;
        checklistContainer.appendChild(checkItem);
    }
    document.querySelectorAll('.check-item-info-button').forEach(button => {
        button.addEventListener('click', (event) => {
            const checkName = event.target.getAttribute('data-check-name');
            openModal(checkName);
        });
    });
}
// ... full, unchanged code for remaining functions below ...
const MODAL_CONTENT={};function getScoreInterpretation(e){return e>=90?"Your site is a prime candidate for AI features! Prepare for maximum thrills!":e>=80?"Your site has a strong foundation. A few more loops and you'll be soaring!":e<=73?"Your site has potential, but there are a few unexpected drops ahead.":""}urlInput.addEventListener("input",()=>{ticketWebsiteName&&(ticketWebsiteName.textContent=urlInput.value.replace(/^https?:\/\//,"")||"your-website.com")}),whyGeoButton.addEventListener("click",()=>openModal("why-geo")),modalCloseButton.addEventListener("click",closeModal),infoModal.addEventListener("click",e=>{e.target===infoModal&&closeModal()});