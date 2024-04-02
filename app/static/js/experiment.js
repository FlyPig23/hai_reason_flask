// Get the necessary DOM elements
const app = document.getElementById('app');

// Create the necessary variables and functions
let dialogueHistory = [];
let currentProfile = null;
let currentAnalysis = null;
let iterationCount = 0;
let selectedPrediction = null;
let selectedFeatureAndAnalysis = null;
let userAgreement = null;
let analyzedFeatures = [];
let started = false;
let isModalOpen = false;
let isIncome = assignedTask === 'income';
let profiles = [];
let analysisData = [];
let profileDescriptions = {};

// Fetch the necessary data from the server
async function fetchData() {
    try {
        const profilesResponse = await fetch(isIncome ? '/data/income_profiles' : '/data/recidivism_profiles');
        const analysisResponse = await fetch(isIncome ? '/data/income_analysis' : '/data/recidivism_analysis');

        profiles = await profilesResponse.json();
        analysisData = await analysisResponse.json();

        profileDescriptions = isIncome ? {
            'age': 'Age',
            'education.num': 'Years of Education',
            'marital.status': 'Marital Status',
            'occupation': 'Occupation',
            'sex': 'Sex',
            'hours.per.week': 'Hours Worked per Week',
            'workclass': 'Workclass',
        } : {
            'race': 'Race',
            'sex': 'Sex',
            'age': 'Age',
            'juv_fel_count': 'Juvenile Felony Count',
            'juv_misd_count': 'Juvenile Misdemeanor Count',
            'priors_count': 'Prior Charges Count',
            'charge_degree': 'Charge Degree',
            'compas_decile_score': 'COMPAS Decile Score',
            'c_charge_desc': 'Short Charge Description',
            'mturk_charge_name': 'Simplified Crime Name',
            'full_charge_description': 'Detailed Charge Description'
        };

        loadProfile();
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

// Load a random profile
function loadProfile() {
    const randomIndex = Math.floor(Math.random() * profiles.length);
    const selectedProfile = profiles[randomIndex];

    if (isIncome) {
        const profileIndex = selectedProfile.index;
        const selectedAnalysis = analysisData.find(data => data.Index === profileIndex);
        currentProfile = selectedProfile;
        currentAnalysis = selectedAnalysis;
    } else {
        const profileIndex = selectedProfile.id;
        const selectedAnalysis = analysisData.find(data => data.id === profileIndex);
        currentProfile = selectedProfile;
        currentAnalysis = selectedAnalysis;
    }
}

// Select a random feature and analysis
function selectRandomFeatureAndAnalysis() {
    const unanalyzedFeatures = Object.keys(profileDescriptions).filter(feature => !analyzedFeatures.includes(feature));
    if (unanalyzedFeatures.length === 0) {
        isModalOpen = true;
        render();
        return;
    }

    const randomFeature = unanalyzedFeatures[Math.floor(Math.random() * unanalyzedFeatures.length)];
    const analysis = currentAnalysis[randomFeature];
    selectedFeatureAndAnalysis = { feature: randomFeature, analysis };
    userAgreement = null;

    // Add the analysis to the dialogue history
    const systemMessage = `The ${profileDescriptions[randomFeature]} for this profile is ${currentProfile[randomFeature]}. ${analysis}`;
    addToDialogueHistory(systemMessage, false, randomFeature, analysis);

    render();
}

// Close the modal
function closeModal() {
    isModalOpen = false;
    render();
}

// Add a message to the dialogue history
function addToDialogueHistory(message, isUser = true, selectedFeature = null, selectedAnalysis = null) {
    dialogueHistory.push({ message, isUser, selectedFeature, selectedAnalysis });
    if (isUser) {
        iterationCount++;
    }
}

// Handle the start button click
function handleStart() {
    started = true;
    const userMessage = 'Let\'s start the analysis.';
    addToDialogueHistory(userMessage, true);
    setTimeout(() => {
        selectRandomFeatureAndAnalysis();
        render();
    }, 500);
}

// Handle the continue button click
function handleContinue() {
    setTimeout(() => {
        selectRandomFeatureAndAnalysis();
        render();
    }, 500);
}

// Handle the user agreement selection
function handleUserAgreement(agreement) {
    userAgreement = agreement;
    const userMessage = agreement ? 'I agree with the analysis.' : 'I disagree with the analysis.';
    addToDialogueHistory(userMessage, true);
    analyzedFeatures.push(selectedFeatureAndAnalysis.feature);
    render();
}

function scrollToBottom() {
    const dialogueHistoryContainer = document.querySelector('.dialogue-history');
    dialogueHistoryContainer.scrollTop = dialogueHistoryContainer.scrollHeight;
}

// Submit the user's prediction
async function submitPrediction(prediction) {
    console.log(`User predicted: ${prediction}`);
    selectedPrediction = prediction;

    const payload = {
        sessionId: sessionId,
        experimentNumber: experimentNumber,
        selectedProfileIndex: currentProfile ? (isIncome ? currentProfile.index : currentProfile.id) : null,
        chatHistory: dialogueHistory,
        userPrediction: selectedPrediction,
        chatIterations: iterationCount,
    };

    try {
        const response = await fetch('/experiment_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        console.log('Experiment data successfully uploaded:', await response.json());

        // Reset component state as necessary before navigation
        dialogueHistory = [];
        selectedPrediction = null;
        currentProfile = null;
        currentAnalysis = null;
        iterationCount = 0;
        selectedFeatureAndAnalysis = null;
        userAgreement = null;
        analyzedFeatures = [];
        started = false;

        // Navigate based on whether the current experiment number is less than the total experiments
        if (experimentNumber < 20) {
            window.location.href = `/experiment/${experimentNumber + 1}?session_id=${sessionId}&assigned_task=${assignedTask}`;
        } else {
            window.location.href = `/thanks?session_id=${sessionId}`;
        }
    } catch (error) {
        console.error('Error during experiment data upload:', error);
    }
}

// Render the app
function render() {
    app.innerHTML = `
        <div class="container">
            <h2 class="task-header">Prediction Task ${isIncome ? 'Income' : 'Recidivism'} (${experimentNumber}/20)</h2>
            <div class="profile-dialogue-container">
                <div class="profile-container">
                    ${currentProfile ? `
                        <div class="profile-features">
                            <h3>Profile:</h3>
                            ${Object.entries(profileDescriptions).map(([key, value]) => {
                                if (currentProfile.hasOwnProperty(key)) {
                                    return `
                                        <div class="profile-feature">
                                            <span class="feature-label">${value}:</span>
                                            <span class="feature-value">${currentProfile[key]}</span>
                                        </div>
                                    `;
                                }
                            }).join('')}
                        </div>
                        <div class="model-prediction">
                            ${isIncome ? `
                                <h3>Model Prediction:</h3>
                                <div>
                                    ${currentProfile.model_prediction === 0 ? `
                                        <span>
                                            The model predicts that this individual <span style="color: green; font-weight: bold;">does not earn</span> over $50,000 per year.
                                        </span>
                                    ` : `
                                        <span>
                                            The model predicts that this individual <span style="color: red; font-weight: bold;">earns</span> over $50,000 per year.
                                        </span>
                                    `}
                                </div>
                            ` : `
                                <h3>Model Prediction:</h3>
                                <div>
                                    ${currentProfile.model_prediction === 0 ? `
                                        <span>
                                            The model predicts that this individual <span style="color: green; font-weight: bold;">will not</span> recidivate two years after previous charge.
                                        </span>
                                    ` : `
                                        <span>
                                            The model predicts that this individual <span style="color: red; font-weight: bold;">will</span> recidivate two years after previous charge.
                                        </span>
                                    `}
                                </div>
                            `}
                        </div>
                        ${iterationCount >= 4 ? `
                            <div class="user-prediction-section">
                                <h3>Make your prediction:</h3>
                                ${isIncome ? `
                                    <button class="prediction-button above-button ${selectedPrediction === 'above $50,000' ? 'selected-button' : ''}" onclick="selectedPrediction = 'above $50,000'; render();">
                                        Above $50,000
                                    </button>
                                    <button class="prediction-button below-button ${selectedPrediction === 'below $50,000' ? 'selected-button' : ''}" onclick="selectedPrediction = 'below $50,000'; render();">
                                        Below $50,000
                                    </button>
                                ` : `
                                    <button class="prediction-button will-reoffend-button ${selectedPrediction === 'will reoffend' ? 'selected-button' : ''}" onclick="selectedPrediction = 'will reoffend'; render();">
                                        Will Reoffend
                                    </button>
                                    <button class="prediction-button will-not-reoffend-button ${selectedPrediction === 'will not reoffend' ? 'selected-button' : ''}" onclick="selectedPrediction = 'will not reoffend'; render();">
                                        Will Not Reoffend
                                    </button>
                                `}
                                <button class="submit-button ${selectedPrediction ? 'active-button' : ''}" onclick="submitPrediction('${selectedPrediction}')" ${!selectedPrediction ? 'disabled' : ''}>
                                    Submit
                                </button>
                            </div>
                        ` : ''}
                    ` : ''}
                </div>
                <div class="dialogue-container">
                    <div class="dialogue-history">
                        ${dialogueHistory.map(msg => `
                            <div class="${msg.isUser ? 'user-message' : 'system-message'}">
                                <img src="${msg.isUser ? '/static/images/client.png' : '/static/images/robot.png'}" alt="${msg.isUser ? 'User' : 'System'}" class="avatar">
                                <span>${msg.message}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="agreement-buttons">
                        ${!started ? `
                            <button class="agreement-button" onclick="handleStart()">
                                Start
                            </button>
                        ` : `
                            <button class="agreement-button" onclick="handleUserAgreement(true)" ${userAgreement !== null ? 'disabled' : ''}>
                                Agree
                            </button>
                            <button class="agreement-button" onclick="handleUserAgreement(false)" ${userAgreement !== null ? 'disabled' : ''}>
                                Disagree
                            </button>
                            <button class="agreement-button" onclick="handleContinue()" ${userAgreement === null ? 'disabled' : ''}>
                                Continue
                            </button>
                        `}
                    </div>
                </div>
            </div>
            ${isModalOpen ? `
                <div class="modal">
                    <div class="modal-content">
                        <h2>All Features Analyzed</h2>
                        <p>All features have been analyzed. Please make your prediction.</p>
                        <button onclick="closeModal()" class="modal-close-button">
                            Close
                        </button>
                    </div>
                </div>
            ` : ''}
        </div>
    `;
    scrollToBottom();
}

// Initialize the app
async function init() {
    await fetchData();
    loadProfile();
    render();
}

init();