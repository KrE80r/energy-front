// Energy Plan Data Extraction Script for GitHub Pages
// Mimics the Python implementation from prd.md

const GST_TAX = 1.10;
const RETAILER_BLACKLIST = [];
const POSTCODE = "5097";

const API_URL = "https://api.energymadeeasy.gov.au/consumerplan/plans";
const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*"
};

const FEE_DESCRIPTIONS = {
    "ConnF": "Move In New Connection Fee",
    "PBF": "Paper Bill Fee",
    "PPF": "Payment Processing Fee",
    "LPF": "Late Payment Fee",
    "DiscoFMO": "Disconnection Fee (Move Out)",
    "DiscoFNP": "Disconnection Fee (Non-Payment)",
    "RecoF": "Reconnection Fee",
    "OF": "Other Fee",
    "CCF": "Credit Card Payment Fee"
};

const PAYMENT_OPTIONS_DESCRIPTIONS = {
    "DD": "Direct Debit",
    "CC": "Credit Card",
    "P": "PayPal",
    "BP": "BPay",
    "CP": "Centrepay"
};

async function getPlans(postcode) {
    const params = new URLSearchParams({
        "usageDataSource": "noUsageFrontier",
        "customerType": "R",
        "distE": "",
        "distG": "",
        "fuelType": "E",
        "journey": "E",
        "postcode": postcode
    });

    try {
        const response = await fetch(`${API_URL}?${params}`, { headers: HEADERS });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const plans = data.data?.plans || [];
        console.log(`Successfully retrieved ${plans.length} plans for postcode ${postcode}`);
        return plans;
    } catch (error) {
        console.error(`Request failed: ${error}`);
        return [];
    }
}

function hasEligibilityRestriction(plan) {
    const contracts = plan.planData?.contract || [];
    return contracts.some(contract => contract.eligibilityRestriction);
}

function hasDiscount(plan) {
    const contracts = plan.planData?.contract || [];
    return contracts.some(contract => contract.discount);
}

function getNoDiscountCost(plan, usageType) {
    const costs = plan.pcr?.costs?.electricity?.[usageType];
    if (!costs) return { monthly: 0, quarterly: 0, yearly: 0 };
    
    return {
        monthly: costs.monthly?.noDiscounts || 0,
        quarterly: costs.quarterly?.noDiscounts || 0,
        yearly: costs.yearly?.noDiscounts || 0
    };
}

function extractFeesAndSolar(plan) {
    const fees = {
        move_in_new_connection_fee: null,
        paper_bill_fee: null,
        payment_processing_fees: [],
        late_payment_fee: null,
        disconnection_fee_move_out: null,
        disconnection_fee_non_payment: null,
        reconnection_fee: null,
        other_fees: [],
        credit_card_payment_fees: []
    };
    let solarFeedInRateR = null;

    try {
        const contracts = plan.planData?.contract || [];
        for (const contract of contracts) {
            // Extract fees
            const contractFees = contract.fee || [];
            for (const fee of contractFees) {
                const feeType = fee.feeType;
                switch (feeType) {
                    case "ConnF":
                        fees.move_in_new_connection_fee = fee.amount || 0;
                        break;
                    case "PBF":
                        fees.paper_bill_fee = fee.amount || 0;
                        break;
                    case "PPF":
                        fees.payment_processing_fees.push(fee);
                        break;
                    case "LPF":
                        fees.late_payment_fee = fee.amount || 0;
                        break;
                    case "DiscoFMO":
                        fees.disconnection_fee_move_out = fee.amount || 0;
                        break;
                    case "DiscoFNP":
                        fees.disconnection_fee_non_payment = fee.amount || 0;
                        break;
                    case "RecoF":
                        fees.reconnection_fee = fee.amount || 0;
                        break;
                    case "OF":
                        fees.other_fees.push(fee);
                        break;
                    case "CCF":
                        fees.credit_card_payment_fees.push(fee);
                        break;
                }
            }

            // Extract solar feed-in rate
            const solarFits = contract.solarFit || [];
            for (const solarFit of solarFits) {
                if (solarFit.type === "R") {
                    solarFeedInRateR = solarFit.rate;
                }
            }
        }
    } catch (error) {
        console.error(`Error extracting fees and solar: ${error}`);
    }

    // Process payment fees to get minimum rates
    try {
        ["payment_processing_fees", "credit_card_payment_fees"].forEach(key => {
            if (fees[key].length > 0) {
                fees[key] = [fees[key].reduce((min, fee) => {
                    const minValue = min.percent || min.amount || 0;
                    const feeValue = fee.percent || fee.amount || 0;
                    return feeValue < minValue ? fee : min;
                })];
            }
        });
    } catch (error) {
        console.error(`Error processing payment fees: ${error}`);
    }

    // Clean up fees - remove zero values and empty arrays
    try {
        Object.keys(fees).forEach(key => {
            if (Array.isArray(fees[key])) {
                fees[key] = fees[key].filter(fee => 
                    (fee.amount || fee.percent || 0) > 0
                );
            } else if (fees[key] === 0) {
                fees[key] = null;
            }
        });
    } catch (error) {
        console.error(`Error cleaning up fees: ${error}`);
    }

    return { fees, solarFeedInRateR };
}

function extractTariffPeriods(plan) {
    const tariffPeriods = [];
    let dailySupplyCharge = null;

    try {
        const contracts = plan.planData?.contract || [];
        for (const contract of contracts) {
            const periods = contract.tariffPeriod || [];
            for (const period of periods) {
                const touBlocks = period.touBlock || [];
                for (const block of touBlocks) {
                    const blockRates = block.blockRate || [];
                    for (const rate of blockRates) {
                        try {
                            const adjustedRate = rate.unitPrice * GST_TAX;
                            tariffPeriods.push(adjustedRate);
                        } catch (error) {
                            console.error(`Error calculating adjusted rate: ${error}`);
                            continue;
                        }
                    }
                }
                try {
                    dailySupplyCharge = (period.dailySupplyCharge || 0) * GST_TAX;
                } catch (error) {
                    console.error(`Error calculating daily supply charge: ${error}`);
                }
            }
        }
    } catch (error) {
        console.error(`Error extracting tariff periods: ${error}`);
        return { peak: null, shoulder: null, offPeak: null, dailySupplyCharge: null };
    }

    let peak = null, shoulder = null, offPeak = null;
    if (tariffPeriods.length > 0) {
        tariffPeriods.sort((a, b) => b - a); // Sort descending
        peak = tariffPeriods[0];
        shoulder = tariffPeriods.length > 1 ? tariffPeriods[1] : null;
        offPeak = tariffPeriods.length > 2 ? tariffPeriods[2] : null;
    }

    return { peak, shoulder, offPeak, dailySupplyCharge };
}

function extractPaymentOptions(plan) {
    const paymentOptions = [];
    try {
        const contracts = plan.planData?.contract || [];
        for (const contract of contracts) {
            const options = contract.paymentOption || [];
            for (const option of options) {
                const paymentOption = PAYMENT_OPTIONS_DESCRIPTIONS[option] || option;
                paymentOptions.push(paymentOption);
            }
        }
    } catch (error) {
        console.error(`Error extracting payment options: ${error}`);
    }
    return paymentOptions;
}

function filterPlans(plans) {
    // Minimal filtering - only exclude TOUCL, SRCL types as per requirements
    // Keep all other plans for frontend filtering
    return plans.filter(plan => {
        const tariffType = plan.planData?.tariffType;
        
        // Only exclude specific tariff types mentioned in requirements
        return !["TOUCL", "SRCL"].includes(tariffType);
    });
}

function groupPlans(filteredPlans) {
    const groupedPlans = { TOU: [], SR: [] };
    
    for (const plan of filteredPlans) {
        const contracts = plan.planData?.contract || [];
        for (const contract of contracts) {
            const pricingModel = contract.pricingModel;
            if (pricingModel === "TOU") {
                groupedPlans.TOU.push(plan);
            } else if (pricingModel === "SR") {
                groupedPlans.SR.push(plan);
            }
        }
    }
    
    return groupedPlans;
}

function getCheapestPlans(groupedPlans, planType, usageType = 'large', topN = null) {
    const plans = groupedPlans[planType];
    if (!plans || plans.length === 0) return [];
    
    const sortedPlans = plans.sort((a, b) => {
        const aCost = getNoDiscountCost(a, usageType).monthly;
        const bCost = getNoDiscountCost(b, usageType).monthly;
        return aCost - bCost;
    });
    
    // Return all plans if topN is null, otherwise return top N
    return topN ? sortedPlans.slice(0, topN) : sortedPlans;
}

async function collectPlans(postcode) {
    const plans = await getPlans(postcode);
    console.log(`Total plans retrieved: ${plans.length}`);
    
    const filteredPlans = filterPlans(plans);
    console.log(`Plans after filtering: ${filteredPlans.length}`);
    
    const groupedPlans = groupPlans(filteredPlans);
    console.log(`SR plans: ${groupedPlans.SR.length}, TOU plans: ${groupedPlans.TOU.length}`);

    // Get all plans, not just top 5 - focus on TOU plans as requested
    const cheapestSrPlans = getCheapestPlans(groupedPlans, "SR");
    const cheapestTouPlans = getCheapestPlans(groupedPlans, "TOU");
    
    console.log(`Final: ${cheapestSrPlans.length} SR plans and ${cheapestTouPlans.length} TOU plans after filtering`);

    const plansData = { SR: [], TOU: [] };

    // Process SR plans
    for (const plan of cheapestSrPlans) {
        const costs = getNoDiscountCost(plan, 'large');
        const { fees, solarFeedInRateR } = extractFeesAndSolar(plan);
        const { peak, shoulder, offPeak, dailySupplyCharge } = extractTariffPeriods(plan);
        const paymentOptions = extractPaymentOptions(plan);

        plansData.SR.push({
            plan_id: plan.planId,
            plan_name: plan.planData?.planName,
            retailer_name: plan.planData?.retailerName,
            monthly_cost: costs.monthly,
            quarterly_cost: costs.quarterly,
            annual_cost: costs.yearly,
            peak_cost: peak,
            shoulder_cost: shoulder,
            off_peak_cost: offPeak,
            daily_supply_charge: dailySupplyCharge,
            fees: fees,
            solar_feed_in_rate_r: solarFeedInRateR,
            payment_options: paymentOptions
        });
    }

    // Process TOU plans
    for (const plan of cheapestTouPlans) {
        const costs = getNoDiscountCost(plan, 'large');
        const { fees, solarFeedInRateR } = extractFeesAndSolar(plan);
        const { peak, shoulder, offPeak, dailySupplyCharge } = extractTariffPeriods(plan);
        const paymentOptions = extractPaymentOptions(plan);

        plansData.TOU.push({
            plan_id: plan.planId,
            plan_name: plan.planData?.planName,
            retailer_name: plan.planData?.retailerName,
            monthly_cost: costs.monthly,
            quarterly_cost: costs.quarterly,
            annual_cost: costs.yearly,
            peak_cost: peak,
            shoulder_cost: shoulder,
            off_peak_cost: offPeak,
            daily_supply_charge: dailySupplyCharge,
            fees: fees,
            solar_feed_in_rate_r: solarFeedInRateR,
            payment_options: paymentOptions
        });
    }

    return plansData;
}

// Export functions for use in web environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        collectPlans,
        getPlans,
        filterPlans,
        groupPlans,
        getCheapestPlans,
        extractFeesAndSolar,
        extractTariffPeriods,
        extractPaymentOptions,
        POSTCODE
    };
}

// For browser environment
if (typeof window !== 'undefined') {
    window.EnergyPlansExtractor = {
        collectPlans,
        getPlans,
        filterPlans,
        groupPlans,
        getCheapestPlans,
        extractFeesAndSolar,
        extractTariffPeriods,
        extractPaymentOptions,
        POSTCODE
    };
}

// Main execution for Node.js
if (typeof require !== 'undefined' && require.main === module) {
    collectPlans(POSTCODE).then(plansData => {
        console.log('\n=== Energy Plans Data ===');
        console.log(JSON.stringify(plansData, null, 2));
        
        // Save to JSON file only
        const fs = require('fs');
        fs.writeFileSync('energy-plans-data.json', JSON.stringify(plansData, null, 2));
        console.log('\nData saved to energy-plans-data.json');
    }).catch(error => {
        console.error('Error collecting plans:', error);
    });
}

// Removed CSV conversion function - using JSON only