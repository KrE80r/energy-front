/**
 * Persona Definitions for Energy Plan Calculator
 * Each persona has default usage patterns based on typical household behaviors
 */

const PERSONAS = {
    'commuter-no-solar': {
        name: 'Commuter (No Solar)',
        description: 'Away during day, evening usage',
        quarterlyConsumption: 1365, // kWh per quarter (15 kWh/day average)
        peakPercent: 40,      // 40% peak (6-10am + 3pm-1am)
        shoulderPercent: 10,  // 10% shoulder (10am-3pm when away)
        offPeakPercent: 50,   // 50% off-peak (1-6am)
        solarExport: 0,
        rationale: 'Away during cheapest shoulder period, but unavoidable usage during expensive 18-hour peak periods for morning routines and evening activities.'
    },
    
    'wfh-no-solar': {
        name: 'Work From Home (No Solar)',
        description: 'High daytime usage',
        quarterlyConsumption: 1365,
        peakPercent: 70,      // 70% peak - home during 18-hour peak period
        shoulderPercent: 20,  // 20% shoulder - some working hours usage
        offPeakPercent: 10,   // 10% off-peak - limited overnight usage
        solarExport: 0,
        rationale: 'Worst-case scenario - home during 75% of peak pricing hours daily. This TOU structure is punitive for WFH households without solar.'
    },
    
    'commuter-solar': {
        name: 'Commuter (With Solar)',
        description: 'Solar export during day',
        quarterlyConsumption: 1365,
        peakPercent: 25,      // 25% peak - reduced by solar offset
        shoulderPercent: 5,   // 5% shoulder - away during peak solar generation
        offPeakPercent: 70,   // 70% off-peak - maximize cheapest period
        solarExport: 1125, // Quarterly solar export amount
        rationale: 'Ideal scenario - away during shoulder period when solar generates most, maximizing export revenue. Smart load shifting to off-peak.'
    },
    
    'wfh-solar': {
        name: 'Work From Home (With Solar)',
        description: 'High self-consumption',
        quarterlyConsumption: 1365,
        peakPercent: 30,      // 30% peak - significantly reduced by solar
        shoulderPercent: 25,  // 25% shoulder - high self-consumption during solar peak
        offPeakPercent: 45,   // 45% off-peak - smart load shifting
        solarExport: 600, // Quarterly solar export amount
        rationale: 'Best positioned for this TOU structure - home during shoulder period for maximum self-consumption. Smart load shifting to off-peak hours.'
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