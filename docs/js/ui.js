/**
 * User Interface Controller
 * Handles all UI interactions and visual updates
 */

/**
 * Create and display plan comparison cards
 * @param {Array} rankedCalculations - Sorted calculations with cost data
 * @param {string} personaKey - Current persona selection
 */
function displayPlanCards(rankedCalculations, personaKey) {
    const planCardsContainer = document.getElementById('plan-cards');
    const maxCards = 5; // Show top 5 plans
    
    // Clear existing cards
    planCardsContainer.innerHTML = '';
    
    // Take top plans (limit to maxCards)
    const topPlans = rankedCalculations.slice(0, maxCards);
    
    topPlans.forEach((calculation, index) => {
        const card = createPlanCard(calculation, personaKey, index);
        planCardsContainer.appendChild(card);
    });
    
    // Add fade-in animation
    setTimeout(() => {
        planCardsContainer.classList.add('fade-in');
    }, 100);
}

/**
 * Create individual plan card element
 * @param {Object} calculation - Calculated cost data
 * @param {string} personaKey - Current persona selection
 * @param {number} index - Card index for ranking display
 * @returns {HTMLElement} Plan card element
 */
function createPlanCard(calculation, personaKey, index) {
    const { planData, totalCost, monthlyCost, breakdown } = calculation;
    
    const card = document.createElement('div');
    card.className = 'col-12 col-lg-6 col-xl-4';
    
    const strategicRecommendation = generateStrategicRecommendation(calculation, personaKey);
    
    card.innerHTML = `
        <div class="plan-card">
            <div class="plan-card-header">
                <div class="retailer-name">${planData.retailer_name}</div>
                <div class="plan-name">${planData.plan_name}</div>
                
                <!-- Timeline Visualization -->
                <div class="timeline-container">
                    <div class="timeline-label">24H TOU Timeline</div>
                    <div class="timeline-bar" id="timeline-${index}"></div>
                    <div class="timeline-markers">
                        <span>12am</span>
                        <span>6am</span>
                        <span>12pm</span>
                        <span>6pm</span>
                        <span>12am</span>
                    </div>
                    <div class="timeline-legend">
                        <div class="timeline-legend-item">
                            <div class="timeline-legend-color legend-offpeak"></div>
                            <span>Off-Peak: 12am-6am</span>
                        </div>
                        <div class="timeline-legend-item">
                            <div class="timeline-legend-color legend-peak"></div>
                            <span>Peak: 4-9pm</span>
                        </div>
                        <div class="timeline-legend-item">
                            <div class="timeline-legend-color legend-shoulder"></div>
                            <span>Shoulder: Other</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="plan-card-body">
                <!-- Cost Display -->
                <div class="cost-primary">$${totalCost.toFixed(2)}</div>
                <div class="cost-secondary">~$${monthlyCost.toFixed(2)}/month</div>
                <div class="cost-secondary">~$${breakdown.supplyCharge.toFixed(2)}/quarter</div>
                
                <!-- Rate Information -->
                <div class="rate-info">
                    <div class="rate-item rate-peak">
                        <div class="rate-label">P</div>
                        <div class="rate-value">${planData.peak_cost ? planData.peak_cost.toFixed(2) : 'N/A'}</div>
                    </div>
                    <div class="rate-item rate-shoulder">
                        <div class="rate-label">S</div>
                        <div class="rate-value">${planData.shoulder_cost ? planData.shoulder_cost.toFixed(2) : 'N/A'}</div>
                    </div>
                    <div class="rate-item rate-offpeak">
                        <div class="rate-label">O</div>
                        <div class="rate-value">${planData.off_peak_cost ? planData.off_peak_cost.toFixed(2) : 'N/A'}</div>
                    </div>
                    <div class="rate-item rate-supply">
                        <div class="rate-label">Supply</div>
                        <div class="rate-value">${planData.daily_supply_charge ? planData.daily_supply_charge.toFixed(2) + '¢/day' : 'N/A'}</div>
                    </div>
                    ${planData.solar_feed_in_rate_r ? `
                    <div class="rate-item rate-fit">
                        <div class="rate-label">FiT</div>
                        <div class="rate-value">${planData.solar_feed_in_rate_r.toFixed(1)}</div>
                    </div>
                    ` : ''}
                </div>
                
                <!-- Strategic Verdict -->
                <div class="strategic-verdict">
                    <div class="verdict-label">Strategic Verdict</div>
                    <div class="verdict-text">${strategicRecommendation}</div>
                </div>
            </div>
        </div>
    `;
    
    return card;
}

/**
 * Update the results title based on selected persona
 * @param {string} personaKey - Current persona selection
 */
function updateResultsTitle(personaKey) {
    const resultsTitle = document.getElementById('results-title');
    const personaInfo = getPersonaDisplayInfo(personaKey);
    resultsTitle.textContent = `For a ${personaInfo.name}`;
}

/**
 * Show loading state
 */
function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('results-section').style.display = 'none';
}

/**
 * Hide loading state and show results
 */
function hideLoading() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('results-section').style.display = 'block';
}

/**
 * Update persona button states
 * @param {string} activePersonaKey - Currently active persona
 */
function updatePersonaButtons(activePersonaKey) {
    const personaButtons = document.querySelectorAll('.btn-persona');
    personaButtons.forEach(button => {
        const personaKey = button.getAttribute('data-persona');
        if (personaKey === activePersonaKey) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

/**
 * Initialize customization form with persona defaults
 * @param {string} personaKey - Current persona selection
 */
function initializeCustomizationForm(personaKey) {
    const persona = getPersonaConfig(personaKey);
    
    // Set form values
    document.getElementById('quarterly-consumption').value = persona.quarterlyConsumption;
    document.getElementById('peak-percent').value = persona.peakPercent;
    document.getElementById('shoulder-percent').value = persona.shoulderPercent;
    document.getElementById('offpeak-percent').value = persona.offPeakPercent;
    
    // Update display values
    document.getElementById('peak-value').textContent = persona.peakPercent + '%';
    document.getElementById('shoulder-value').textContent = persona.shoulderPercent + '%';
    document.getElementById('offpeak-value').textContent = persona.offPeakPercent + '%';
    
    // Solar options
    const solarOptions = document.getElementById('solar-options');
    if (personaHasSolar(personaKey)) {
        solarOptions.style.display = 'block';
        document.getElementById('solar-export').value = persona.solarExport;
    } else {
        solarOptions.style.display = 'none';
    }
}

/**
 * Setup form event listeners for real-time updates
 */
function setupFormEventListeners() {
    // Range input updates with auto-adjustment for percentage sliders
    const percentageInputs = ['peak-percent', 'shoulder-percent', 'offpeak-percent'];
    percentageInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        const valueDisplay = document.getElementById(inputId.replace('-percent', '-value'));
        
        input.addEventListener('input', function() {
            valueDisplay.textContent = this.value + '%';
            adjustOtherPercentages(inputId);
            validatePercentages();
        });
    });
    
    // Solar export input validation
    const solarExportInput = document.getElementById('solar-export');
    if (solarExportInput) {
        solarExportInput.addEventListener('input', function() {
            const value = parseInt(this.value);
            if (value < 0) this.value = 0;
            if (value > 5000) this.value = 5000; // Reasonable maximum
        });
    }
    
    // Consumption input validation
    document.getElementById('quarterly-consumption').addEventListener('input', function() {
        const value = parseInt(this.value);
        if (value < 0) this.value = 0;
        if (value > 10000) this.value = 10000;
    });
    
}

/**
 * Automatically adjust other percentage sliders to maintain 100% total
 * @param {string} changedInputId - The ID of the slider that was changed
 */
function adjustOtherPercentages(changedInputId) {
    const peakInput = document.getElementById('peak-percent');
    const shoulderInput = document.getElementById('shoulder-percent');
    const offpeakInput = document.getElementById('offpeak-percent');
    
    const peakValue = parseInt(peakInput.value);
    const shoulderValue = parseInt(shoulderInput.value);
    const offpeakValue = parseInt(offpeakInput.value);
    
    const changedValue = parseInt(document.getElementById(changedInputId).value);
    
    // Calculate remaining percentage to distribute
    const remaining = 100 - changedValue;
    
    // Identify which two sliders to adjust
    let otherInputs = [];
    let otherValues = [];
    
    if (changedInputId === 'peak-percent') {
        otherInputs = [shoulderInput, offpeakInput];
        otherValues = [shoulderValue, offpeakValue];
    } else if (changedInputId === 'shoulder-percent') {
        otherInputs = [peakInput, offpeakInput];
        otherValues = [peakValue, offpeakValue];
    } else { // offpeak-percent
        otherInputs = [peakInput, shoulderInput];
        otherValues = [peakValue, shoulderValue];
    }
    
    // Get current sum of the two other sliders
    const otherSum = otherValues[0] + otherValues[1];
    
    if (otherSum > 0) {
        // Proportionally distribute the remaining percentage
        const ratio1 = otherValues[0] / otherSum;
        const ratio2 = otherValues[1] / otherSum;
        
        const newValue1 = Math.round(remaining * ratio1);
        const newValue2 = remaining - newValue1; // Ensure exact 100% total
        
        // Update the sliders and their display values
        otherInputs[0].value = Math.max(0, Math.min(100, newValue1));
        otherInputs[1].value = Math.max(0, Math.min(100, newValue2));
        
        // Update display values
        document.getElementById(otherInputs[0].id.replace('-percent', '-value')).textContent = otherInputs[0].value + '%';
        document.getElementById(otherInputs[1].id.replace('-percent', '-value')).textContent = otherInputs[1].value + '%';
    } else {
        // If both other sliders are at 0, distribute remaining equally
        const equalShare = Math.floor(remaining / 2);
        const remainder = remaining - (equalShare * 2);
        
        otherInputs[0].value = equalShare + remainder;
        otherInputs[1].value = equalShare;
        
        // Update display values
        document.getElementById(otherInputs[0].id.replace('-percent', '-value')).textContent = otherInputs[0].value + '%';
        document.getElementById(otherInputs[1].id.replace('-percent', '-value')).textContent = otherInputs[1].value + '%';
    }
}

/**
 * Validate that percentages add up to 100%
 */
function validatePercentages() {
    const peak = parseInt(document.getElementById('peak-percent').value);
    const shoulder = parseInt(document.getElementById('shoulder-percent').value);
    const offpeak = parseInt(document.getElementById('offpeak-percent').value);
    
    const total = peak + shoulder + offpeak;
    const warning = document.getElementById('percentage-warning');
    const applyBtn = document.getElementById('apply-custom-btn');
    
    if (Math.abs(total - 100) > 0.1) {
        warning.style.display = 'block';
        applyBtn.disabled = true;
    } else {
        warning.style.display = 'none';
        applyBtn.disabled = false;
    }
}

/**
 * Get current form values as usage pattern object
 * @returns {Object} Usage pattern configuration
 */
function getFormUsagePattern() {
    return {
        quarterlyConsumption: parseInt(document.getElementById('quarterly-consumption').value),
        peakPercent: parseInt(document.getElementById('peak-percent').value),
        shoulderPercent: parseInt(document.getElementById('shoulder-percent').value),
        offPeakPercent: parseInt(document.getElementById('offpeak-percent').value),
        solarExport: parseInt(document.getElementById('solar-export').value) || 0
    };
}

/**
 * Show error message to user
 * @param {string} message - Error message to display
 */
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger alert-dismissible fade show';
    errorDiv.innerHTML = `
        <strong>Error:</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.querySelector('.container').prepend(errorDiv);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

/**
 * Show success message to user
 * @param {string} message - Success message to display
 */
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success alert-dismissible fade show';
    successDiv.innerHTML = `
        <strong>Success:</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.querySelector('.container').prepend(successDiv);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

/**
 * Create visual timeline representation
 * This is a simplified version - can be enhanced with actual time periods
 */
function createTimelineVisualization() {
    // Timeline is created via CSS gradient in the stylesheet
    // This function can be enhanced to show actual time periods
    // For now, the CSS handles the basic visualization
}

/**
 * Initialize all UI components
 */
function initializeUI() {
    setupFormEventListeners();
    
    // Initialize Bootstrap components
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        displayPlanCards,
        updateResultsTitle,
        showLoading,
        hideLoading,
        updatePersonaButtons,
        initializeCustomizationForm,
        getFormUsagePattern,
        showError,
        showSuccess,
        initializeUI
    };
}