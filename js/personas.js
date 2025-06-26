/**
 * Persona Definitions for Energy Plan Calculator
 * Each persona has default usage patterns based on typical household behaviors
 */

const PERSONAS = {
    'commuter-no-solar': {
        name: 'Commuter (No Solar)',
        description: 'Away during day, evening usage',
        quarterlyConsumption: 1900, // kWh per quarter (21.1 kWh/day average)
        peakPercent: 15,      // 15% peak (4-9pm weekdays)
        shoulderPercent: 25,  // 25% shoulder (7-10am, 9pm-10pm weekdays + weekends)
        offPeakPercent: 60,   // 60% off-peak (10pm-7am + weekends)
        solarExport: 0,
        rationale: 'Low peak usage as away at work during expensive evening hours. Higher off-peak usage for overnight appliances and morning routines.'
    },
    
    'wfh-no-solar': {
        name: 'Work From Home (No Solar)',
        description: 'High daytime usage',
        quarterlyConsumption: 1900,
        peakPercent: 45,      // 45% peak - high usage during expensive peak hours
        shoulderPercent: 35,  // 35% shoulder
        offPeakPercent: 20,   // 20% off-peak
        solarExport: 0,
        rationale: 'High peak usage due to working from home during expensive 4-9pm period. Air conditioning, computers, and appliances running during peak times.'
    },
    
    'commuter-solar': {
        name: 'Commuter (With Solar)',
        description: 'Solar export during day',
        quarterlyConsumption: 1900,
        peakPercent: 10,      // 10% peak - even lower due to some solar offset
        shoulderPercent: 20,  // 20% shoulder
        offPeakPercent: 70,   // 70% off-peak
        solarExport: 1125, // Quarterly solar export amount
        rationale: 'Low daytime consumption means most solar (75%) is exported. Peak usage further reduced by battery storage or solar carryover effects.'
    },
    
    'wfh-solar': {
        name: 'Work From Home (With Solar)',
        description: 'High self-consumption',
        quarterlyConsumption: 1900,
        peakPercent: 30,      // 30% peak - reduced from 45% due to solar offset
        shoulderPercent: 40,  // 40% shoulder
        offPeakPercent: 30,   // 30% off-peak
        solarExport: 600, // Quarterly solar export amount
        rationale: 'High self-consumption (60%) as home during solar generation hours. Peak usage reduced significantly by solar offset during 4-9pm period.'
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