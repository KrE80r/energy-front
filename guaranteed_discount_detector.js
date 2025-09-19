/**
 * Guaranteed Discount Detection for Energy Plans
 *
 * This module provides programmatic detection of guaranteed vs conditional discounts
 * for use in the web UI to only apply discounts that users can rely on.
 */

/**
 * Detects if a plan has guaranteed discounts and calculates the guaranteed discount amount
 * @param {Object} plan - Energy plan object from all_energy_plans.json
 * @returns {Object} - Discount detection result
 */
function detectGuaranteedDiscount(plan) {
    const result = {
        hasGuaranteedDiscount: false,
        guaranteedDiscountPercent: 0,
        guaranteedQuarterlyCost: null,
        baseQuarterlyCost: null,
        discountDetails: []
    };

    // Check if plan has any discounts
    if (!plan?.raw_plan_data?.has_discounts) {
        return result;
    }

    // PRIMARY METHOD: Use PCR costs data
    const pcrCosts = plan?.raw_plan_data_complete?.main_api_response?.pcr?.costs?.electricity?.large?.quarterly;

    if (pcrCosts) {
        const noDiscounts = pcrCosts.noDiscounts || 0;
        const allDiscounts = pcrCosts.allDiscounts || 0;
        const guaranteedDiscount = pcrCosts.guaranteedDiscount || 0;

        // KEY RULE: guaranteed == allDiscounts && allDiscounts < noDiscounts means guaranteed discount
        const isGuaranteed = (allDiscounts === guaranteedDiscount) && (allDiscounts < noDiscounts);

        if (isGuaranteed && noDiscounts > 0) {
            result.hasGuaranteedDiscount = true;
            result.guaranteedDiscountPercent = ((noDiscounts - guaranteedDiscount) / noDiscounts) * 100;
            result.guaranteedQuarterlyCost = guaranteedDiscount;
            result.baseQuarterlyCost = noDiscounts;
        }
    }

    // SECONDARY METHOD: Verify with contract discount details
    const contractData = plan?.raw_plan_data_complete?.detailed_api_response?.data?.planData?.contract || [];

    for (const contract of contractData) {
        if (contract.discount) {
            for (const discount of contract.discount) {
                const discountInfo = {
                    name: discount.name || 'Unknown',
                    description: discount.description || '',
                    percent: discount.discountPercent || 0,
                    type: discount.type || '',
                    category: discount.category || '',
                    isGuaranteed: discount.type !== 'C' // 'C' = Conditional
                };

                result.discountDetails.push(discountInfo);

                // If we found conditional discounts, override the guaranteed status
                if (discount.type === 'C') {
                    result.hasGuaranteedDiscount = false;
                    result.guaranteedDiscountPercent = 0;
                    result.guaranteedQuarterlyCost = null;
                }
            }
        }
    }

    return result;
}

/**
 * Applies guaranteed discount to plan cost calculation for web UI
 * @param {Object} plan - Energy plan object
 * @param {number} calculatedCost - Base calculated cost for the plan
 * @returns {Object} - Cost with guaranteed discount applied
 */
function applyGuaranteedDiscount(plan, calculatedCost) {
    const discountInfo = detectGuaranteedDiscount(plan);

    if (!discountInfo.hasGuaranteedDiscount) {
        return {
            finalCost: calculatedCost,
            discountApplied: false,
            discountPercent: 0,
            savingsAmount: 0,
            discountDetails: discountInfo.discountDetails
        };
    }

    const discountMultiplier = 1 - (discountInfo.guaranteedDiscountPercent / 100);
    const finalCost = calculatedCost * discountMultiplier;
    const savingsAmount = calculatedCost - finalCost;

    return {
        finalCost: finalCost,
        discountApplied: true,
        discountPercent: discountInfo.guaranteedDiscountPercent,
        savingsAmount: savingsAmount,
        discountDetails: discountInfo.discountDetails
    };
}

/**
 * Get all plans with guaranteed discounts for UI filtering
 * @param {Array} plans - Array of energy plans
 * @returns {Array} - Plans with guaranteed discounts only
 */
function getPlansWithGuaranteedDiscounts(plans) {
    return plans.filter(plan => {
        const discountInfo = detectGuaranteedDiscount(plan);
        return discountInfo.hasGuaranteedDiscount;
    }).map(plan => {
        const discountInfo = detectGuaranteedDiscount(plan);
        return {
            ...plan,
            guaranteedDiscountInfo: discountInfo
        };
    });
}

/**
 * Validate discount data consistency for debugging
 * @param {Object} plan - Energy plan object
 * @returns {Object} - Validation results
 */
function validateDiscountData(plan) {
    const discountInfo = detectGuaranteedDiscount(plan);
    const validation = {
        isValid: true,
        warnings: [],
        errors: []
    };

    // Check PCR vs contract data consistency
    const pcrCosts = plan?.raw_plan_data_complete?.main_api_response?.pcr?.costs?.electricity?.large?.quarterly;

    if (pcrCosts && discountInfo.discountDetails.length > 0) {
        const pcrDiscountPercent = discountInfo.guaranteedDiscountPercent;
        const contractDiscountPercent = discountInfo.discountDetails[0]?.percent || 0;

        if (Math.abs(pcrDiscountPercent - contractDiscountPercent) > 1) {
            validation.warnings.push(
                `PCR discount (${pcrDiscountPercent.toFixed(1)}%) doesn't match contract discount (${contractDiscountPercent}%)`
            );
        }
    }

    return validation;
}

// Export for use in web UI
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        detectGuaranteedDiscount,
        applyGuaranteedDiscount,
        getPlansWithGuaranteedDiscounts,
        validateDiscountData
    };
}

// Example usage for web UI:
/*
// In your plan comparison/calculator code:
const planWithDiscount = applyGuaranteedDiscount(energyPlan, baseCalculatedCost);

if (planWithDiscount.discountApplied) {
    console.log(`✅ Guaranteed ${planWithDiscount.discountPercent.toFixed(1)}% discount applied`);
    console.log(`💰 Savings: $${planWithDiscount.savingsAmount.toFixed(2)} per quarter`);
    displayCost = planWithDiscount.finalCost;
} else {
    console.log(`ℹ️ No guaranteed discount available`);
    displayCost = baseCalculatedCost;
}
*/