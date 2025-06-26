/**
 * Main Application Controller
 * Coordinates all components and handles user interactions
 */

// Global application state
let appState = {
    energyPlans: null,
    currentPersona: null,
    isCustomized: false,
    customUsagePattern: null
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
        const response = await fetch('predicted_energy_plans.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        appState.energyPlans = data.plans.TOU; // Focus on TOU plans
        
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
                appState.isCustomized = false;
                appState.customUsagePattern = null;
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
        appState.isCustomized = false;
        appState.customUsagePattern = null;
        
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
            showError('Invalid usage pattern. Please check your inputs.');
            return;
        }
        
        console.log('Applying custom usage pattern:', customPattern);
        
        // Update application state
        appState.isCustomized = true;
        appState.customUsagePattern = customPattern;
        
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
        
        // Determine usage pattern to use
        let usagePattern;
        if (appState.isCustomized && appState.customUsagePattern) {
            usagePattern = appState.customUsagePattern;
        } else {
            usagePattern = getPersonaConfig(appState.currentPersona);
        }
        
        console.log('Calculating costs with usage pattern:', usagePattern);
        
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