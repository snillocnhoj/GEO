// --- Constants & Data ---
const MAX_PAGES_TO_CRAWL = 10;
// ... (progress messages are the same) ...

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
    // ... all 19 check descriptions are included in the full script below ...
};


// --- DOM Elements ---
const urlInput = document.getElementById('urlInput');
// ... (all other element selectors are the same) ...
const whyGeoButton = document.getElementById('why-geo-button');
const infoModal = document.getElementById('info-modal');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');
const modalCloseButton = document.getElementById('modal-close-button');


// --- Event Listeners ---
// ... (analyzeButton event listener is the same) ...

whyGeoButton.addEventListener('click', () => {
    openModal('why-geo');
});
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


// --- Main displayFinalReport function update ---
function displayFinalReport(results) {
    // ... (logic for score and progress is the same) ...

    for (const name in checkStats) {
        // ... (logic for pass/fail is the same) ...
        
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
    
    // Add event listeners to the new info buttons
    document.querySelectorAll('.check-item-info-button').forEach(button => {
        button.addEventListener('click', (event) => {
            const checkName = event.target.getAttribute('data-check-name');
            openModal(checkName);
        });
    });
}

// ... all other functions are the same ...

// The full, final script is below for easy copy-pasting.
const INITIAL_PROGRESS_MESSAGES=["Warming up the engines...","Scanning for E-E-A-T signals to build trust with AI...","Did you know? AI prioritizes sites that answer customer questions.","Checking if your content is 'quotable' for search results...","Analyzing your site's structure for readability..."],FINAL_MARKETING_MESSAGES=["Brought to you by John Collins Consulting","Are you mentioned when AI answers questions about your industry?","We have deep industry experience","Good GEO turns your website into a primary source for AI.","We're trusted by attractions industry leaders","Did you know? AI favors content that demonstrates first-hand experience.","We'll help you raise your score!","Optimizing for AI today means more customers tomorrow.","Don't let AI choose your competitors over you.","Get ready, here it comes..."];let progressInterval;const ticketWebsiteName=document.getElementById("ticket-website-name"),scoreSnapshotContainer=document.getElementById("score-snapshot-container"),scoreSnapshotDiv=document.getElementById("score-snapshot"),downloadSnapshotButton=document.getElementById("download-snapshot");function getScoreInterpretation(e){return e>=90?"Your site is a prime candidate for AI features! Prepare for maximum thrills!":e>=80?"Your site has a strong foundation. A few more loops and you'll be soaring!":e<=73?"Your site has potential, but there are a few unexpected drops ahead.":""}urlInput.addEventListener("input",()=>{ticketWebsiteName&&(ticketWebsiteName.textContent=urlInput.value||"your-website.com")}),MODAL_CONTENT.MetaDescription={title:"Meta Description",text:"This provides the short summary that appears under your title in search results. A compelling description encourages clicks and gives generative AI a quick, clear summary of the page's purpose."},MODAL_CONTENT.H1Heading={title:"H1 Heading",text:"The <h1> is the main headline of your on-page content. Having exactly one reinforces the page's main topic for AI crawlers and helps them understand the content's hierarchy."},MODAL_CONTENT.MobileFriendlyViewport={title:"Mobile-Friendly Viewport",text:"This tag signals that your site is designed to work well on mobile devices. User experience is a critical factor, and AI engines prioritize content from sites that are accessible and easy to use for everyone."},MODAL_CONTENT.InternalLinking={title:"Internal Linking",text:"Good internal linking helps AI discover more of your content and understand how different topics on your site are related, establishing your overall authority on a subject."},MODAL_CONTENT.ImageAltText={title:"Image Alt Text",text:'AI cannot "see" images. Alt text provides a literal description, giving crucial context about the image that helps the AI better understand the page\'s topic.'},MODAL_CONTENT.ConversationalTone={title:"Conversational Tone",text:"Generative search is designed to answer questions. Structuring your content with question-based headings makes it incredibly easy for an AI to select your content as a direct answer."},MODAL_CONTENT.ClearStructureLists={title:"Clear Structure (Lists)",text:"Lists break down information into simple, digestible steps or points. AI engines love this format because it's easy to parse, summarize, and feature."},MODAL_CONTENT.Readability={title:"Readability",text:"Clear, concise language is easier for both humans and AI to understand and is less likely to be misinterpreted."},MODAL_CONTENT.UniqueDataInsights={title:"Unique Data/Insights",text:"Citing original data or analysis is a powerful signal that your content is a primary source, making it much more valuable and likely to be featured by an AI."},MODAL_CONTENT.AuthorBylineBio={title:"Author Byline/Bio",text:'This signals Expertise and Authoritativeness. It shows that the content was written by a real person with a verifiable background, which AI gives significant weight to.'},MODAL_CONTENT.FirstHandExperience={title:"First-Hand Experience",text:'This directly signals the "E" for Experience. It shows the author has direct, hands-on experience with the topic, making the content more authentic and trustworthy.'},MODAL_CONTENT.ContentFreshness={title:"Content Freshness",text:"Shows that the content is current and actively maintained, which is a key signal of a trustworthy and high-quality website."},MODAL_CONTENT.ContactInformation={title:"Contact Information",text:"A fundamental Trust signal. Legitimate businesses are transparent and provide ways for users to get in touch."},MODAL_CONTENT.OutboundLinks={title:"Outbound Links",text:"Linking to other authoritative sources shows your content is well-researched and credible, signaling Authoritativeness."},MODAL_CONTENT.CitedSources={title:"Cited Sources",text:"This is a strong signal of Trustworthiness. It shows you are backing up your claims with evidence, making your content more reliable."},MODAL_CONTENT.SchemaFound={title:"Schema Found",text:'Schema explicitly tells an AI what your content is (e.g., "this is an article"). It is a critical component of technical GEO.'},MODAL_CONTENT.ArticleorOrgSchema={title:'Article or Org Schema',text:'"Article" schema provides context like author and dates (E-E-A-T signals), while "Organization" schema helps establish the entity behind the website (a Trust signal).'},MODAL_CONTENT.FAQorHowToSchema={title:"FAQ or How-To Schema",text:"This is one of the most powerful schema types, as it structures your content in a Q&A or step-by-step format that generative AI can lift directly into its answers."};