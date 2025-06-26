/**
 * Data Validation Module
 * Prevents rate mapping errors and ensures data consistency
 */

/**
 * Validate that convenience fields match authoritative detailed_time_blocks
 * @param {Object} planData - Energy plan data
 * @returns {Object} Validation result with errors if any
 */
function validateRateMapping(planData) {
    const errors = [];
    const warnings = [];
    
    // Extract authoritative rates from detailed_time_blocks
    const authoritativeRates = {};
    
    if (!planData.detailed_time_blocks || planData.detailed_time_blocks.length === 0) {
        warnings.push('No detailed_time_blocks found - cannot validate rate mapping');
        return { isValid: true, errors, warnings };
    }
    
    for (const block of planData.detailed_time_blocks) {
        const period = block.time_of_use_period;
        if (block.rates && block.rates.length > 0) {
            authoritativeRates[period] = block.rates[0].unit_price_gst;
        }
    }
    
    // Validate convenience fields against authoritative rates
    const validations = [
        { field: 'peak_cost', period: 'P', name: 'Peak' },
        { field: 'shoulder_cost', period: 'S', name: 'Shoulder' },
        { field: 'off_peak_cost', period: 'OP', name: 'Off-Peak' }
    ];
    
    for (const validation of validations) {
        const convenienceValue = planData[validation.field];
        const authoritativeValue = authoritativeRates[validation.period];
        
        if (authoritativeValue !== undefined && convenienceValue !== undefined) {
            const difference = Math.abs(convenienceValue - authoritativeValue);
            if (difference > 0.01) {
                errors.push({
                    field: validation.field,
                    period: validation.period,
                    name: validation.name,
                    convenienceValue: convenienceValue,
                    authoritativeValue: authoritativeValue,
                    difference: difference
                });
            }
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        authoritativeRates
    };
}

/**
 * Validate calculation consistency between live calc and pre-calculated values
 * @param {Object} planData - Energy plan data
 * @param {Object} usagePattern - Usage pattern for calculation
 * @returns {Object} Validation result
 */
function validateCalculationConsistency(planData, usagePattern) {
    const liveCalculation = calculatePlanCost(planData, usagePattern);
    const preCalculatedValue = planData.quarterly_cost;
    
    if (!liveCalculation || preCalculatedValue === undefined) {
        return { isValid: true, warnings: ['Cannot validate - missing calculation data'] };
    }
    
    const difference = Math.abs(liveCalculation.totalCost - preCalculatedValue);
    const percentageDiff = (difference / preCalculatedValue) * 100;
    
    // Allow up to 10% difference (pre-calc might use different assumptions)
    const isValid = percentageDiff <= 10;
    
    return {
        isValid,
        liveCalculation: liveCalculation.totalCost,
        preCalculated: preCalculatedValue,
        difference,
        percentageDiff,
        errors: isValid ? [] : [`Large discrepancy: ${difference.toFixed(2)} (${percentageDiff.toFixed(1)}%)`]
    };
}

/**
 * Comprehensive plan validation
 * @param {Object} planData - Energy plan data
 * @param {Object} testUsagePattern - Standard usage pattern for testing
 * @returns {Object} Complete validation report
 */
function validatePlan(planData, testUsagePattern = null) {
    const planName = `${planData.retailer_name} - ${planData.plan_name}`;
    
    // Default test pattern
    if (!testUsagePattern) {
        testUsagePattern = {
            quarterlyConsumption: 1900,
            peakPercent: 40,
            shoulderPercent: 10,
            offPeakPercent: 50,
            solarExport: 0
        };
    }
    
    const rateValidation = validateRateMapping(planData);
    const calcValidation = validateCalculationConsistency(planData, testUsagePattern);
    
    return {
        planName,
        planId: planData.plan_id,
        rateMapping: rateValidation,
        calculationConsistency: calcValidation,
        overallValid: rateValidation.isValid && calcValidation.isValid
    };
}

/**
 * Validate all plans and generate report
 * @param {Array} allPlans - Array of all energy plans
 * @returns {Object} Validation report for all plans
 */
function validateAllPlans(allPlans) {
    console.log('🔍 Starting comprehensive plan validation...');
    
    const results = allPlans.map(plan => validatePlan(plan));
    
    const summary = {
        totalPlans: results.length,
        validPlans: results.filter(r => r.overallValid).length,
        rateMappingErrors: results.filter(r => !r.rateMapping.isValid).length,
        calculationErrors: results.filter(r => !r.calculationConsistency.isValid).length
    };
    
    // Log critical errors
    results.forEach(result => {
        if (!result.rateMapping.isValid) {
            console.error(`❌ Rate mapping errors in ${result.planName}:`, result.rateMapping.errors);
        }
        if (!result.calculationConsistency.isValid) {
            console.warn(`⚠️ Calculation discrepancy in ${result.planName}:`, result.calculationConsistency.errors);
        }
    });
    
    console.log('📊 Validation Summary:', summary);
    
    return {
        results,
        summary,
        isValid: summary.rateMappingErrors === 0
    };
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validateRateMapping,
        validateCalculationConsistency,
        validatePlan,
        validateAllPlans
    };
}

// Browser global functions
if (typeof window !== 'undefined') {
    window.validateRateMapping = validateRateMapping;
    window.validateCalculationConsistency = validateCalculationConsistency;
    window.validatePlan = validatePlan;
    window.validateAllPlans = validateAllPlans;
}