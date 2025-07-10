/**
 * Energy Plan Cost Calculator - BILL-ACCURATE VERSION
 * Implements electricity bill calculation based on real user bill data
 * 
 * KEY INSIGHTS FROM BILL ANALYSIS:
 * 1. quarterlyConsumption = NET GRID CONSUMPTION (what user bought from grid, shown on bill)
 * 2. solarExport = solar export amount (shown as credit on bill)
 * 3. TOU rates apply directly to quarterlyConsumption (already net after solar self-consumption)
 * 4. Smart meters handle solar self-consumption behind the scenes
 * 5. Users cannot measure total household consumption - only net consumption from bills
 * 
 * This matches exactly how electricity bills work in practice
 */

/**
 * Calculate electricity costs using the bill-accurate formula
 * Works for both solar and non-solar households
 * 
 * @param {Object} planData - Energy plan data from JSON
 * @param {Object} usagePattern - User's usage pattern from their electricity bill
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
            solarExport = 0
        } = usagePattern;

        // Validate inputs
        if (!validateInputs(usagePattern)) {
            throw new Error('Invalid usage pattern inputs');
        }

        // Step 1: Calculate Fixed Supply Charge
        const supplyCharge = calculateSupplyCharge(planData.daily_supply_charge);

        // Step 1.5: Calculate Membership Fee for quarter
        const membershipFee = calculateMembershipFee(planData);

        // Step 2: Net Grid Consumption
        // quarterlyConsumption from bills is already NET GRID CONSUMPTION
        // (Smart meters deduct solar self-consumption automatically)
        const netGridConsumption = quarterlyConsumption;

        // Step 3: Calculate Usage Charge (TOU rates applied to net grid consumption)
        const usageCharge = calculateUsageCharge(
            planData,
            netGridConsumption,
            peakPercent,
            shoulderPercent,
            offPeakPercent
        );

        // Step 4: Calculate Solar Export Credit (with tiered support)
        const solarExported = solarExport;
        const solarCredit = calculateTieredSolarCredit(planData, solarExported);

        // Step 5: Calculate Final Bill Amount
        const finalBill = supplyCharge + usageCharge + membershipFee - solarCredit;

        return {
            totalCost: Math.max(0, finalBill), // Ensure non-negative
            breakdown: {
                supplyCharge: supplyCharge,
                usageCharge: usageCharge,
                membershipFee: membershipFee,
                solarCredit: solarCredit,
                netGridConsumption: netGridConsumption,
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
 * Calculate membership fee for quarter
 * @param {Object} planData - Plan data with membership fee information
 * @returns {number} Quarterly membership fee in dollars
 */
function calculateMembershipFee(planData) {
    // Check for membership fee in plan data
    if (planData.membership_fee_quarterly) {
        return planData.membership_fee_quarterly;
    }
    
    // Fallback: check raw fee data for MBSF fees
    if (planData.fees && planData.fees.membership_fee) {
        const membershipFee = planData.fees.membership_fee;
        if (membershipFee.feeTerm === 'A' && membershipFee.amount) {
            return membershipFee.amount / 4; // Convert annual to quarterly
        }
    }
    
    return 0; // No membership fee
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
 * Calculate tiered solar export credit
 * @param {Object} planData - Plan data with solar FiT information
 * @param {number} solarExported - Amount of solar exported per quarter (kWh)
 * @returns {number} Solar credit in dollars
 */
function calculateTieredSolarCredit(planData, solarExported) {
    if (solarExported <= 0) {
        return 0;
    }

    // Get solar fit data from plan
    const solarFitData = extractSolarFitRates(planData);
    
    if (!solarFitData || solarFitData.length === 0) {
        return 0;
    }

    // Calculate daily average export for tiered rates
    const dailyAverageExport = solarExported / 91; // 91 days per quarter
    
    // Calculate daily solar credit using tiers
    const dailySolarCredit = calculateDailySolarCredit(dailyAverageExport, solarFitData);
    
    // Return quarterly credit
    return dailySolarCredit * 91;
}

/**
 * Extract and clean solar feed-in tariff rates from plan data
 * @param {Object} planData - Plan data
 * @returns {Array} Array of solar FiT rate objects
 */
function extractSolarFitRates(planData) {
    // Try multiple data sources for solar FiT
    let solarFitRates = [];
    
    // First try: Check if solar fit data exists in contract (correct API location)
    if (planData.raw_plan_data_complete?.main_api_response?.planData?.contract?.[0]?.solarFit) {
        const fitData = planData.raw_plan_data_complete.main_api_response.planData.contract[0].solarFit;
        solarFitRates = processSolarFitData(fitData);
    }
    
    // Second try: Check alternative location (solarFeedInTariff)
    if (solarFitRates.length === 0 && planData.raw_plan_data_complete?.main_api_response?.planData?.solarFeedInTariff) {
        const fitData = planData.raw_plan_data_complete.main_api_response.planData.solarFeedInTariff;
        solarFitRates = processSolarFitData(fitData);
    }
    
    // Fallback: Use simple rate if available
    if (solarFitRates.length === 0 && planData.solar_feed_in_rate_r) {
        solarFitRates = [{
            rate: planData.solar_feed_in_rate_r,
            volume: null, // Unlimited
            type: 'R',
            scheme: 'OTHER'
        }];
    }
    
    return solarFitRates;
}

/**
 * Process solar FiT data from API response
 * @param {Array} fitData - Raw solar FiT data from API
 * @returns {Array} Processed solar FiT rates
 */
function processSolarFitData(fitData) {
    if (!Array.isArray(fitData)) {
        return [];
    }
    
    const processedRates = [];
    
    for (const fit of fitData) {
        // Skip government schemes (Solar Bonus Scheme)
        if (fit.type === 'G') {
            continue;
        }
        
        // Extract rate information
        if (fit.singleTariffRates && Array.isArray(fit.singleTariffRates)) {
            for (const rateData of fit.singleTariffRates) {
                if (rateData.unitPrice) {
                    processedRates.push({
                        rate: rateData.unitPrice,
                        volume: rateData.volume || null,
                        type: fit.type || 'R',
                        scheme: fit.scheme || 'OTHER',
                        displayName: fit.displayName || '',
                        description: rateData.description || ''
                    });
                }
            }
        }
        
        // Fallback: use direct rate if available
        if (fit.rate && processedRates.length === 0) {
            processedRates.push({
                rate: fit.rate,
                volume: null,
                type: fit.type || 'R',
                scheme: fit.scheme || 'OTHER',
                displayName: fit.displayName || ''
            });
        }
    }
    
    // Sort by volume (tiers in order)
    return processedRates.sort((a, b) => {
        const aVol = a.volume || Infinity;
        const bVol = b.volume || Infinity;
        return aVol - bVol;
    });
}

/**
 * Calculate daily solar credit using tiered rates
 * @param {number} dailyExportKwh - Daily average export in kWh
 * @param {Array} solarFitTiers - Array of solar FiT tier objects
 * @returns {number} Daily solar credit in dollars
 */
function calculateDailySolarCredit(dailyExportKwh, solarFitTiers) {
    if (dailyExportKwh <= 0 || !solarFitTiers || solarFitTiers.length === 0) {
        return 0;
    }
    
    let totalCredit = 0;
    let remainingExport = dailyExportKwh;
    
    for (const tier of solarFitTiers) {
        if (remainingExport <= 0) {
            break;
        }
        
        // Determine tier volume limit
        const tierLimit = tier.volume || remainingExport; // volume=null means unlimited
        const tierExport = Math.min(remainingExport, tierLimit);
        
        // Calculate credit for this tier
        const tierCredit = (tierExport * tier.rate) / 100; // Convert cents to dollars
        totalCredit += tierCredit;
        
        // Reduce remaining export
        remainingExport -= tierExport;
    }
    
    return totalCredit;
}

/**
 * Calculate solar export credit (legacy function for backward compatibility)
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
 * Validate input parameters based on real electricity bill data
 * @param {Object} usagePattern - Usage pattern to validate
 * @returns {boolean} True if inputs are valid
 */
function validateInputs(usagePattern) {
    const {
        quarterlyConsumption,
        peakPercent,
        shoulderPercent,
        offPeakPercent,
        solarExport = 0
    } = usagePattern;

    // Check required fields
    if (quarterlyConsumption <= 0) return false;
    if (peakPercent < 0 || shoulderPercent < 0 || offPeakPercent < 0) return false;
    if (solarExport < 0) return false;

    // Check percentages add up to 100% (allow small floating point errors)
    const totalPercent = peakPercent + shoulderPercent + offPeakPercent;
    if (Math.abs(totalPercent - 100) > 0.1) return false;
    
    // Prevent invalid combinations where all percentages are 0
    if (peakPercent === 0 && shoulderPercent === 0 && offPeakPercent === 0) return false;
    
    // Prevent scenarios where solar export exceeds consumption (impossible)
    if (solarExport > quarterlyConsumption * 2) {
        console.warn('Solar export seems unusually high compared to consumption - please verify inputs');
        // Allow but warn - user might have very efficient household
    }

    return true;
}

/**
 * Disqualify plans with suspicious zero or null shoulder/off-peak rates and demand charges
 * Updated to allow legitimate 2-rate TOU plans but exclude demand charge plans
 * @param {Object} planData - Plan data to validate
 * @returns {boolean} True if plan should be disqualified
 */
function shouldDisqualifyPlan(planData) {
    // Check for demand charges - exclude plans with demand charges
    if (hasDemandCharge(planData)) {
        return true;
    }
    
    // Must have valid peak and off-peak rates
    const peakRate = planData.peak_cost;
    const offPeakRate = planData.off_peak_cost;
    
    if (!peakRate || !offPeakRate || peakRate <= 0 || offPeakRate <= 0) {
        return true;
    }
    
    // Shoulder rate can be null/zero for legitimate 2-rate TOU plans
    // Only disqualify if shoulder rate exists but is suspiciously zero
    const shoulderRate = planData.shoulder_cost;
    if (shoulderRate !== null && shoulderRate !== undefined && shoulderRate <= 0) {
        // Check if this plan has detailed time blocks showing shoulder period exists
        const detailedBlocks = planData.detailed_time_blocks || [];
        const hasShoulderBlock = detailedBlocks.some(block => 
            block.time_of_use_period === 'S' || block.name?.toLowerCase().includes('shoulder')
        );
        if (hasShoulderBlock) {
            return true; // Has shoulder period but zero rate - suspicious
        }
    }
    
    return false;
}

/**
 * Check if a plan has demand charges
 * @param {Object} planData - Plan data to check
 * @returns {boolean} True if plan has demand charges
 */
function hasDemandCharge(planData) {
    try {
        // Check in raw plan data for demand charge information
        const rawPlanData = planData.raw_plan_data_complete?.main_api_response?.planData;
        if (!rawPlanData || !rawPlanData.contract) {
            return false;
        }
        
        // Check each contract for demand charges
        for (const contract of rawPlanData.contract) {
            if (contract.tariffPeriod) {
                for (const tariffPeriod of contract.tariffPeriod) {
                    if (tariffPeriod.demandCharge && tariffPeriod.demandCharge.length > 0) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    } catch (error) {
        console.warn('Error checking for demand charges:', error);
        return false; // If we can't check, don't exclude the plan
    }
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
        // Disqualify plans with suspicious zero/null rates or demand charges
        if (shouldDisqualifyPlan(plan)) {
            const hasDemand = hasDemandCharge(plan);
            const reason = hasDemand ? 'has demand charges' : 'zero/null shoulder or off-peak rates';
            console.log(`Disqualified plan: ${plan.plan_name} (${plan.retailer_name}) - ${reason}`);
            continue;
        }
        
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
        shouldDisqualifyPlan,
        hasDemandCharge,
        generateStrategicRecommendation,
        getPlanComparison,
        validateInputs,
        calculateMembershipFee
    };
}