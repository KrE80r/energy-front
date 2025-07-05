/**
 * Persona Definitions for Energy Plan Calculator
 * Each persona has default usage patterns based on typical household behaviors
 */

const PERSONAS = {
    'commuter-no-solar': {
        name: 'Commuter (No Solar)',
        description: 'Away during day, evening usage',
        quarterlyConsumption: 1365, // kWh per quarter (15 kWh/day average)
        peakPercent: 75,      // 75% peak - standard commuter pattern
        shoulderPercent: 8,   // 8% shoulder - minimal (weekend/holiday usage only)
        offPeakPercent: 17,   // 17% off-peak - hot water system timed for off-peak
        solarExport: 0,
        rationale: 'Some basic energy awareness, hot water on timer. Away during cheapest shoulder period but unavoidable peak usage for morning routines and evening activities.'
    },
    
    'wfh-no-solar': {
        name: 'Work From Home (No Solar)',
        description: 'High daytime usage',
        quarterlyConsumption: 1365,
        peakPercent: 70,      // 70% peak - standard WFH pattern
        shoulderPercent: 20,  // 20% shoulder - working during 10am-3pm
        offPeakPercent: 10,   // 10% off-peak - some overnight optimization
        solarExport: 0,
        rationale: 'Regular work setup, moderate AC use, standard appliances. Home during peak but not optimized usage pattern.'
    },
    
    'commuter-solar': {
        name: 'Commuter (With Solar)',
        description: 'Solar export during day',
        quarterlyConsumption: 1365,
        peakPercent: 70,      // 70% peak - balanced solar commuter
        shoulderPercent: 8,   // 8% shoulder - weekend usage during solar hours
        offPeakPercent: 22,   // 22% off-peak - good overnight load shifting
        solarExport: 1200, // Quarterly solar export amount (80% export rate)
        rationale: 'Moderate usage with some weekend solar utilization. Good balance between export revenue and load shifting.'
    },
    
    'wfh-solar': {
        name: 'Work From Home (With Solar)',
        description: 'High self-consumption',
        quarterlyConsumption: 1365,
        peakPercent: 65,      // 65% peak - standard WFH solar
        shoulderPercent: 25,  // 25% shoulder - good usage during solar generation
        offPeakPercent: 10,   // 10% off-peak - limited overnight optimization
        solarExport: 825, // Quarterly solar export amount (55% export rate)
        rationale: 'Regular work setup with good solar utilization during work hours. Reduced peak usage through solar self-consumption.'
    }
};

/**
 * Get persona configuration by key
 * @param {string} personaKey - The persona identifier
 * @returns {Object} Persona configuration object
 */
function getPersonaConfig(personaKey) {
    const persona = PERSONAS[personaKey];
    if (!persona) {
        console.error(`Unknown persona: ${personaKey}`);
        return PERSONAS['commuter-no-solar']; // Default fallback
    }
    return persona;
}

/**
 * Get all available personas
 * @returns {Object} All persona configurations
 */
function getAllPersonas() {
    return PERSONAS;
}

/**
 * Validate that usage percentages add up to 100%
 * @param {number} peak - Peak percentage
 * @param {number} shoulder - Shoulder percentage  
 * @param {number} offPeak - Off-peak percentage
 * @returns {boolean} True if percentages are valid
 */
function validateUsagePercentages(peak, shoulder, offPeak) {
    const total = peak + shoulder + offPeak;
    return Math.abs(total - 100) < 0.01; // Allow for small floating point errors
}

/**
 * Get persona display name and description
 * @param {string} personaKey - The persona identifier
 * @returns {Object} Display information
 */
function getPersonaDisplayInfo(personaKey) {
    const persona = getPersonaConfig(personaKey);
    return {
        name: persona.name,
        description: persona.description,
        rationale: persona.rationale
    };
}

/**
 * Check if persona includes solar panels
 * @param {string} personaKey - The persona identifier  
 * @returns {boolean} True if persona has solar
 */
function personaHasSolar(personaKey) {
    const persona = getPersonaConfig(personaKey);
    return persona.solarExport > 0;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PERSONAS,
        getPersonaConfig,
        getAllPersonas,
        validateUsagePercentages,
        getPersonaDisplayInfo,
        personaHasSolar
    };
}