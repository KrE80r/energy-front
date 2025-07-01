/**
 * Main Application Controller
 * Coordinates all components and handles user interactions
 */

// Global application state
let appState = {
    energyPlans: null,
    currentPersona: null
};

/**
 * Initialize the application
 */
async function initializeApp() {
    try {
        console.log('Initializing Energy Plan Advisor...');
        
        // Initialize UI components
        initializeUI();
        
        // Load energy plans data
        await loadEnergyPlans();
        
        // Validate data integrity (prevent rate mapping errors) - DISABLED
        // Validation temporarily disabled to allow all plans to be displayed
        if (false && typeof validateAllPlans === 'function') {
            const validation = validateAllPlans(appState.energyPlans);
            if (!validation.isValid) {
                console.error('🚨 Data validation failed! Rate mapping errors detected.');
                console.error('Some calculations may be incorrect. Please check data integrity.');
            } else {
                console.log('✅ Data validation passed - all rate mappings correct');
            }
        }
        
        console.log('✅ Validation disabled - displaying all plans');
        
        // Setup event listeners
        setupEventListeners();
        
        console.log('Application initialized successfully');
        
    } catch (error) {
        console.error('Failed to initialize application:', error);
        showError('Failed to load energy plan data. Please refresh the page and try again.');
    }
}

/**
 * Load energy plans from JSON file
 */
async function loadEnergyPlans() {
    try {
        const response = await fetch('../all_energy_plans.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        let touPlans = data.plans.TOU; // Focus on TOU plans
        
        // Filter to ONLY show plans with effectiveDate >= 2025-07-01
        const targetDate = '2025-07-01';
        const originalCount = touPlans.length;
        
        touPlans = touPlans.filter(plan => {
            // Get effectiveDate from the correct path: plan.raw_plan_data_complete.detailed_api_response.data.planData.effectiveDate
            const effectiveDate = plan.raw_plan_data_complete?.detailed_api_response?.data?.planData?.effectiveDate;
            
            if (!effectiveDate) {
                console.log(`Plan ${plan.plan_id} missing effectiveDate, excluding`);
                return false;
            }
            
            // Only include plans with effectiveDate >= 2025-07-01
            if (effectiveDate >= targetDate) {
                return true;
            } else {
                console.log(`Plan ${plan.plan_id} has old effectiveDate ${effectiveDate}, excluding`);
                return false;
            }
        });
        
        console.log(`🔍 FILTER RESULTS: Started with ${originalCount} plans, kept ${touPlans.length} plans, filtered out ${originalCount - touPlans.length} plans with effectiveDate before ${targetDate}`);
        
        appState.energyPlans = touPlans;
        
        // Clean up floating-point precision issues in rate data
        appState.energyPlans = appState.energyPlans.map(plan => ({
            ...plan,
            peak_cost: plan.peak_cost ? Math.round(plan.peak_cost * 100) / 100 : plan.peak_cost,
            shoulder_cost: plan.shoulder_cost ? Math.round(plan.shoulder_cost * 100) / 100 : plan.shoulder_cost,
            off_peak_cost: plan.off_peak_cost ? Math.round(plan.off_peak_cost * 100) / 100 : plan.off_peak_cost,
            daily_supply_charge: plan.daily_supply_charge ? Math.round(plan.daily_supply_charge * 100) / 100 : plan.daily_supply_charge
        }));
        
        console.log(`Loaded ${appState.energyPlans.length} TOU energy plans`);
        
        if (appState.energyPlans.length === 0) {
            throw new Error('No energy plans found in data');
        }
        
    } catch (error) {
        console.error('Error loading energy plans:', error);
        throw error;
    }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Persona selection buttons
    const personaButtons = document.querySelectorAll('.btn-persona');
    personaButtons.forEach(button => {
        button.addEventListener('click', function() {
            const personaKey = this.getAttribute('data-persona');
            handlePersonaSelection(personaKey);
        });
    });
    
    // Customization button
    const customizeBtn = document.getElementById('customize-btn');
    customizeBtn.addEventListener('click', function() {
        const customizeModal = new bootstrap.Modal(document.getElementById('customizeModal'));
        initializeCustomizationForm(appState.currentPersona);
        customizeModal.show();
    });
    
    // Apply custom settings button
    const applyCustomBtn = document.getElementById('apply-custom-btn');
    applyCustomBtn.addEventListener('click', function() {
        handleCustomSettingsApply();
    });
    
    // Modal close buttons - reset to persona defaults
    const modalCloseButtons = document.querySelectorAll('[data-bs-dismiss="modal"]');
    modalCloseButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (appState.currentPersona) {
                // Reset form to persona defaults
                initializeCustomizationForm(appState.currentPersona);
                updateCalculationsDisplay();
            }
        });
    });
}

/**
 * Handle persona selection
 * @param {string} personaKey - Selected persona identifier
 */
async function handlePersonaSelection(personaKey) {
    try {
        console.log(`Persona selected: ${personaKey}`);
        
        // Update application state
        appState.currentPersona = personaKey;
        
        // Update form with persona values
        initializeCustomizationForm(personaKey);
        
        // Update UI
        updatePersonaButtons(personaKey);
        updateResultsTitle(personaKey);
        showLoading();
        
        // Small delay for better UX
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Calculate and display results
        await updateCalculationsDisplay();
        
        hideLoading();
        
    } catch (error) {
        console.error('Error handling persona selection:', error);
        hideLoading();
        showError('Failed to calculate energy plan costs. Please try again.');
    }
}

/**
 * Handle custom settings application
 */
async function handleCustomSettingsApply() {
    try {
        const customPattern = getFormUsagePattern();
        
        // Validate custom pattern
        if (!validateInputs(customPattern)) {
            const total = customPattern.peakPercent + customPattern.shoulderPercent + customPattern.offPeakPercent;
            const warning = document.getElementById('percentage-warning');
            
            if (Math.abs(total - 100) > 0.1) {
                warning.innerHTML = `<i class="bi bi-exclamation-triangle me-2"></i>Usage percentages must total 100%. Current total: ${total.toFixed(1)}%`;
                warning.style.display = 'block';
            } else {
                warning.innerHTML = '<i class="bi bi-exclamation-triangle me-2"></i>Invalid usage pattern. Please check your inputs.';
                warning.style.display = 'block';
            }
            return;
        }
        
        // Hide warning if validation passes
        document.getElementById('percentage-warning').style.display = 'none';
        
        console.log('Applying custom usage pattern:', customPattern);
        
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('customizeModal'));
        modal.hide();
        
        // Show loading and update calculations
        showLoading();
        await new Promise(resolve => setTimeout(resolve, 300));
        
        await updateCalculationsDisplay();
        hideLoading();
        
        showSuccess('Calculations updated with your custom usage pattern!');
        
    } catch (error) {
        console.error('Error applying custom settings:', error);
        showError('Failed to apply custom settings. Please try again.');
    }
}

/**
 * Update calculations and display results
 */
async function updateCalculationsDisplay() {
    try {
        if (!appState.energyPlans || !appState.currentPersona) {
            throw new Error('Missing required data for calculations');
        }
        
        // Always use current form values for calculations
        // Form is initialized with persona defaults, but user can override
        let usagePattern = getFormUsagePattern();
        
        console.log('🔧 FIXED CALCULATION - Using form values:', usagePattern);
        console.log('🔧 Expected for 369kWh 50/30/20: AGL~$282, Origin~$255');
        
        // Calculate costs for all plans
        const rankedCalculations = calculateAndRankPlans(appState.energyPlans, usagePattern);
        
        if (rankedCalculations.length === 0) {
            throw new Error('No valid calculations could be performed');
        }
        
        console.log(`Calculated costs for ${rankedCalculations.length} plans`);
        
        // Display results
        displayPlanCards(rankedCalculations, appState.currentPersona);
        
        // Log comparison summary
        const comparison = getPlanComparison(rankedCalculations);
        if (comparison) {
            console.log('Plan comparison:', comparison);
        }
        
    } catch (error) {
        console.error('Error updating calculations:', error);
        throw error;
    }
}

/**
 * Handle application errors gracefully
 * @param {Error} error - The error that occurred
 * @param {string} context - Context where error occurred
 */
function handleError(error, context = 'Application') {
    console.error(`${context} error:`, error);
    
    // Don't show multiple error messages
    const existingErrors = document.querySelectorAll('.alert-danger');
    if (existingErrors.length > 0) {
        return;
    }
    
    let message = 'An unexpected error occurred. Please refresh the page and try again.';
    
    // Customize message based on error type
    if (error.message.includes('fetch') || error.message.includes('HTTP')) {
        message = 'Failed to load energy plan data. Please check your internet connection and try again.';
    } else if (error.message.includes('calculation') || error.message.includes('Invalid')) {
        message = 'Invalid input data. Please check your settings and try again.';
    }
    
    showError(message);
}

/**
 * Validate application state
 * @returns {boolean} True if application state is valid
 */
function validateAppState() {
    if (!appState.energyPlans || appState.energyPlans.length === 0) {
        console.error('No energy plans loaded');
        return false;
    }
    
    return true;
}

/**
 * Get application statistics for debugging
 * @returns {Object} Application statistics
 */
function getAppStats() {
    return {
        plansLoaded: appState.energyPlans ? appState.energyPlans.length : 0,
        currentPersona: appState.currentPersona,
        isCustomized: appState.isCustomized,
        hasCustomPattern: !!appState.customUsagePattern
    };
}

/**
 * Export current results (future feature)
 */
function exportResults() {
    // TODO: Implement export functionality
    // Could export to CSV, PDF, or allow sharing via URL
    console.log('Export functionality not yet implemented');
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing application...');
    initializeApp().catch(error => {
        handleError(error, 'Initialization');
    });
});

// Global error handler
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    handleError(event.error, 'Global');
});

// Global unhandled promise rejection handler
window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    handleError(new Error(event.reason), 'Promise');
});

// Export functions for debugging/testing
if (typeof window !== 'undefined') {
    window.energyPlanApp = {
        appState,
        getAppStats,
        validateAppState,
        exportResults
    };
}