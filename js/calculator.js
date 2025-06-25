/**
 * Energy Plan Cost Calculator
 * Implements the unified electricity bill calculation formula from PRD
 */

/**
 * Calculate electricity costs using the unified formula
 * Works for both solar and non-solar households
 * 
 * @param {Object} planData - Energy plan data from JSON
 * @param {Object} usagePattern - User's usage pattern
 * @returns {Object} Detailed cost breakdown
 */
function calculatePlanCost(planData, usagePattern) {
    try {
        // Extract usage pattern values
        const {
            quarterlyConsumption,
            peakPercent,
            shoulderPercent,
            offPeakPercent,
            solarGeneration = 0,
            selfConsumptionPercent = 0
        } = usagePattern;

        // Validate inputs
        if (!validateInputs(usagePattern)) {
            throw new Error('Invalid usage pattern inputs');
        }

        // Step 1: Calculate Fixed Supply Charge
        const supplyCharge = calculateSupplyCharge(planData.daily_supply_charge);

        // Step 2: Determine Net Grid Consumption
        const solarSelfConsumed = solarGeneration * (selfConsumptionPercent / 100);
        const netGridConsumption = quarterlyConsumption - solarSelfConsumed;

        // Step 3: Calculate Usage Charge (TOU rates applied to net consumption)
        const usageCharge = calculateUsageCharge(
            planData,
            netGridConsumption,
            peakPercent,
            shoulderPercent,
            offPeakPercent
        );

        // Step 4: Calculate Solar Export Credit
        const solarExported = Math.max(0, solarGeneration - solarSelfConsumed);
        const solarCredit = calculateSolarCredit(planData.solar_feed_in_rate_r || 0, solarExported);

        // Step 5: Calculate Final Bill Amount
        const finalBill = supplyCharge + usageCharge - solarCredit;

        return {
            totalCost: Math.max(0, finalBill), // Ensure non-negative
            breakdown: {
                supplyCharge: supplyCharge,
                usageCharge: usageCharge,
                solarCredit: solarCredit,
                netGridConsumption: netGridConsumption,
                solarSelfConsumed: solarSelfConsumed,
                solarExported: solarExported
            },
            monthlyCost: Math.max(0, finalBill) / 3,
            annualCost: Math.max(0, finalBill) * 4,
            planData: planData
        };
    } catch (error) {
        console.error('Error calculating plan cost:', error);
        return null;
    }
}

/**
 * Calculate fixed supply charge for 91-day quarter
 * @param {number} dailySupplyRate - Daily supply charge in cents/day
 * @returns {number} Quarterly supply charge in dollars
 */
function calculateSupplyCharge(dailySupplyRate) {
    return (dailySupplyRate * 91) / 100; // Convert cents to dollars
}

/**
 * Calculate usage charge based on TOU rates and net grid consumption
 * @param {Object} planData - Plan data with rate information
 * @param {number} netGridConsumption - Net consumption from grid (kWh)
 * @param {number} peakPercent - Percentage used during peak hours
 * @param {number} shoulderPercent - Percentage used during shoulder hours
 * @param {number} offPeakPercent - Percentage used during off-peak hours
 * @returns {number} Usage charge in dollars
 */
function calculateUsageCharge(planData, netGridConsumption, peakPercent, shoulderPercent, offPeakPercent) {
    const peakConsumption = netGridConsumption * (peakPercent / 100);
    const shoulderConsumption = netGridConsumption * (shoulderPercent / 100);
    const offPeakConsumption = netGridConsumption * (offPeakPercent / 100);

    let totalUsageCharge = 0;

    // Peak rate
    if (planData.peak_cost && peakConsumption > 0) {
        totalUsageCharge += (peakConsumption * planData.peak_cost) / 100;
    }

    // Shoulder rate (may be null for some plans)
    if (planData.shoulder_cost && shoulderConsumption > 0) {
        totalUsageCharge += (shoulderConsumption * planData.shoulder_cost) / 100;
    }

    // Off-peak rate
    if (planData.off_peak_cost && offPeakConsumption > 0) {
        totalUsageCharge += (offPeakConsumption * planData.off_peak_cost) / 100;
    }

    return totalUsageCharge;
}

/**
 * Calculate solar export credit
 * @param {number} feedInRate - Feed-in tariff rate in cents/kWh
 * @param {number} solarExported - Amount of solar exported (kWh)
 * @returns {number} Solar credit in dollars
 */
function calculateSolarCredit(feedInRate, solarExported) {
    if (!feedInRate || solarExported <= 0) {
        return 0;
    }
    return (solarExported * feedInRate) / 100; // Convert cents to dollars
}

/**
 * Validate input parameters
 * @param {Object} usagePattern - Usage pattern to validate
 * @returns {boolean} True if inputs are valid
 */
function validateInputs(usagePattern) {
    const {
        quarterlyConsumption,
        peakPercent,
        shoulderPercent,
        offPeakPercent,
        solarGeneration = 0,
        selfConsumptionPercent = 0
    } = usagePattern;

    // Check required fields
    if (quarterlyConsumption <= 0) return false;
    if (peakPercent < 0 || shoulderPercent < 0 || offPeakPercent < 0) return false;
    if (solarGeneration < 0 || selfConsumptionPercent < 0 || selfConsumptionPercent > 100) return false;

    // Check percentages add up to 100% (allow small floating point errors)
    const totalPercent = peakPercent + shoulderPercent + offPeakPercent;
    if (Math.abs(totalPercent - 100) > 0.1) return false;

    return true;
}

/**
 * Calculate costs for multiple plans and rank them by total cost
 * @param {Array} plansData - Array of plan data objects
 * @param {Object} usagePattern - User's usage pattern
 * @returns {Array} Array of calculated costs sorted by total cost (cheapest first)
 */
function calculateAndRankPlans(plansData, usagePattern) {
    const calculations = [];

    for (const plan of plansData) {
        const calculation = calculatePlanCost(plan, usagePattern);
        if (calculation) {
            calculations.push(calculation);
        }
    }

    // Sort by total cost (cheapest first)
    return calculations.sort((a, b) => a.totalCost - b.totalCost);
}

/**
 * Generate strategic recommendation text for a plan
 * @param {Object} calculation - Calculated cost breakdown
 * @param {string} personaKey - Selected persona
 * @returns {string} Recommendation text
 */
function generateStrategicRecommendation(calculation, personaKey) {
    const { planData, breakdown, totalCost } = calculation;
    const { supplyCharge, usageCharge, solarCredit } = breakdown;
    
    let recommendation = '';

    // Supply charge analysis
    const dailySupplyRate = planData.daily_supply_charge;
    if (dailySupplyRate < 110) {
        recommendation += 'Low supply charge keeps fixed costs down. ';
    } else if (dailySupplyRate > 130) {
        recommendation += 'Higher supply charge offset by competitive usage rates. ';
    }

    // Rate analysis based on persona
    if (personaKey.includes('commuter')) {
        if (planData.off_peak_cost < 30) {
            recommendation += 'Excellent off-peak rates suit your usage pattern. ';
        }
        if (planData.peak_cost > 50) {
            recommendation += 'High peak rates less impactful due to low peak usage. ';
        }
    } else if (personaKey.includes('wfh')) {
        if (planData.peak_cost < 45) {
            recommendation += 'Competitive peak rates ideal for work-from-home usage. ';
        }
        if (planData.shoulder_cost && planData.shoulder_cost < 35) {
            recommendation += 'Good shoulder rates help manage daytime consumption costs. ';
        }
    }

    // Solar analysis
    if (personaKey.includes('solar')) {
        const fitRate = planData.solar_feed_in_rate_r || 0;
        if (fitRate > 8) {
            recommendation += 'Above-average feed-in tariff maximizes solar returns. ';
        } else if (fitRate < 5 && fitRate > 0) {
            recommendation += 'Lower feed-in tariff balanced by competitive usage rates. ';
        }
        
        if (solarCredit > 100) {
            recommendation += 'Significant solar savings reduce overall costs. ';
        }
    }

    // Overall value proposition
    if (recommendation === '') {
        recommendation = 'Balanced rates across all time periods provide consistent value. ';
    }

    return recommendation.trim();
}

/**
 * Get plan comparison summary
 * @param {Array} rankedCalculations - Sorted array of calculations
 * @returns {Object} Comparison summary
 */
function getPlanComparison(rankedCalculations) {
    if (rankedCalculations.length === 0) return null;

    const cheapest = rankedCalculations[0];
    const mostExpensive = rankedCalculations[rankedCalculations.length - 1];
    const savings = mostExpensive.totalCost - cheapest.totalCost;
    
    return {
        cheapestPlan: cheapest.planData.plan_name,
        cheapestCost: cheapest.totalCost,
        mostExpensivePlan: mostExpensive.planData.plan_name,
        mostExpensiveCost: mostExpensive.totalCost,
        potentialSavings: savings,
        planCount: rankedCalculations.length
    };
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculatePlanCost,
        calculateAndRankPlans,
        generateStrategicRecommendation,
        getPlanComparison,
        validateInputs
    };
}