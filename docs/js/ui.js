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
    const maxPlans = 10; // Show top 10 plans
    
    // Clear existing content
    planCardsContainer.innerHTML = '';
    
    // Take top plans (limit to maxPlans)
    const topPlans = rankedCalculations.slice(0, maxPlans);
    
    // Create plan list
    topPlans.forEach((calculation, index) => {
        const planCard = createPlanCardNew(calculation, personaKey, index);
        planCardsContainer.appendChild(planCard);
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
function createPlanCardNew(calculation, personaKey, index) {
    const { planData, totalCost, monthlyCost, breakdown } = calculation;
    const strategicRecommendation = generateStrategicRecommendation(calculation, personaKey);
    
    const card = document.createElement('div');
    card.className = 'plan-card-row';
    if (index === 0) card.classList.add('verified-winner');
    
    card.innerHTML = `
        <div class="plan-row-content">
            <div class="plan-info-section">
                <div class="retailer-info">
                    <div class="retailer-name">${planData.retailer_name}</div>
                    <div class="plan-name" title="${planData.plan_name}">${planData.plan_name}</div>
                </div>
            </div>
            
            <div class="timeline-section">
                <div class="timeline-label">TIME PERIODS</div>
                <div class="time-periods-text" data-plan-index="${index}">
                    Loading time periods...
                </div>
            </div>
            
            <div class="rates-section">
                <div class="rates-label">KEY RATES (C/KWH)</div>
                <div class="rates-list">
                    <div class="rate-group">
                        <span class="rate-type peak-rate">P: ${planData.peak_cost ? planData.peak_cost.toFixed(2) : 'N/A'}</span>
                        <span class="rate-type shoulder-rate">S: ${planData.shoulder_cost ? planData.shoulder_cost.toFixed(2) : 'N/A'}</span>
                        <span class="rate-type offpeak-rate">O: ${planData.off_peak_cost ? planData.off_peak_cost.toFixed(2) : 'N/A'}</span>
                    </div>
                    <div class="rate-group">
                        <span class="rate-type supply-rate">Supply: ${planData.daily_supply_charge ? planData.daily_supply_charge.toFixed(2) + '¢/day' : 'N/A'}</span>
                        ${planData.solar_feed_in_rate_r ? `<span class="rate-type fit-rate">FiT: ${planData.solar_feed_in_rate_r.toFixed(1)}</span>` : ''}
                    </div>
                </div>
            </div>
            
            <div class="cost-section">
                <div class="cost-amount">$${totalCost.toFixed(2)}</div>
                <div class="cost-details">
                    <div>~$${monthlyCost.toFixed(2)}/month</div>
                    <div>~$${totalCost.toFixed(2)}/quarter</div>
                    <div>~$${(totalCost * 4).toFixed(2)}/annual</div>
                </div>
            </div>
            
            <div class="verdict-section">
                <div class="verdict-label">STRATEGIC VERDICT</div>
                <div class="verdict-content">${index === 0 ? 'VERIFIED WINNER: ' : ''}${strategicRecommendation}</div>
            </div>
        </div>
    `;
    
    // Add time periods text and plan name truncation detection
    setTimeout(() => {
        displayTimePeriods(card, planData);
        setupPlanNameTooltip(card);
    }, 0);
    
    return card;
}

/**
 * Setup plan name tooltip when text is truncated
 * @param {HTMLElement} card - The plan card element
 */
function setupPlanNameTooltip(card) {
    const planNameElement = card.querySelector('.plan-name');
    if (!planNameElement) return;
    
    // Check if text is truncated
    if (planNameElement.scrollWidth > planNameElement.clientWidth) {
        planNameElement.style.cursor = 'help';
        planNameElement.title = planNameElement.textContent;
    } else {
        planNameElement.style.cursor = 'default';
        planNameElement.removeAttribute('title');
    }
}

/**
 * Display time periods as simple text from plan data
 * @param {HTMLElement} card - The plan card element
 * @param {Object} planData - Plan data with time period information
 */
function displayTimePeriods(card, planData = {}) {
    const timePeriodsContainer = card.querySelector('.time-periods-text');
    
    if (!timePeriodsContainer) {
        console.warn('Time periods container not found');
        return;
    }
    
    // Extract time periods from plan data
    if (planData && planData.detailed_time_blocks) {
        const timePeriodsText = [];
        
        planData.detailed_time_blocks.forEach(block => {
            if (block.description && block.name) {
                // Clean up the description and format it nicely
                const cleanDescription = block.description
                    .replace(/;/g, ' & ')  // Replace semicolons with &
                    .replace(/\s+/g, ' ')  // Clean up extra spaces
                    .trim();
                
                timePeriodsText.push(`${block.name}: ${cleanDescription}`);
            }
        });
        
        if (timePeriodsText.length > 0) {
            timePeriodsContainer.innerHTML = timePeriodsText.join('<br>');
        } else {
            timePeriodsContainer.textContent = 'Standard TOU periods apply';
        }
    } else {
        timePeriodsContainer.textContent = 'Standard TOU periods apply';
    }
}

// Removed complex time period parsing - now using simple text display
    
// Removed complex pattern examples - using simple text display instead

// Removed parseTimeDescription - no longer needed with text display

// Removed generateDynamicTimeline - no longer needed with text display

// Removed createTimelineSegments - no longer needed with text display

// Removed createSolidTimelineSegments - no longer needed with text display

// Removed setupSolidTimelineHover - no longer needed with text display

// Removed getTimeFromPercentageEnhanced - no longer needed with text display

// Removed findPeriodForTime - no longer needed with text display

// Removed getTimeFromPercentageDefault - no longer needed with text display

// Removed formatTimeForDisplay - no longer needed with text display

// Removed getTimeFromPercentage - no longer needed with text display

// Removed testTimelinePatterns function - no longer needed with text display

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

// Make showError immediately available globally
if (typeof window !== 'undefined') {
    window.showError = showError;
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

// Make showSuccess immediately available globally
if (typeof window !== 'undefined') {
    window.showSuccess = showSuccess;
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

// Make initializeUI immediately available globally
if (typeof window !== 'undefined') {
    window.initializeUI = initializeUI;
}

// Export functions for use in other modules (Node.js)
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

// Make functions globally available for browser use
if (typeof window !== 'undefined') {
    window.displayPlanCards = displayPlanCards;
    window.updateResultsTitle = updateResultsTitle;
    window.showLoading = showLoading;
    window.hideLoading = hideLoading;
    window.updatePersonaButtons = updatePersonaButtons;
    window.initializeCustomizationForm = initializeCustomizationForm;
    window.getFormUsagePattern = getFormUsagePattern;
    window.showError = showError;
    window.showSuccess = showSuccess;
    window.initializeUI = initializeUI;
}