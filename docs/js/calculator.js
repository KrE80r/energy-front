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
        const baseBill = supplyCharge + usageCharge + membershipFee - solarCredit;

        // Step 6: Apply Guaranteed Discounts
        const discountResult = applyGuaranteedDiscount(planData, baseBill);
        const finalBill = discountResult.finalCost;

        return {
            totalCost: Math.max(0, finalBill), // Ensure non-negative
            baseCost: Math.max(0, baseBill), // Cost before discount
            discountInfo: {
                applied: discountResult.discountApplied,
                percent: discountResult.discountPercent,
                savings: discountResult.savingsAmount,
                details: discountResult.discountDetails
            },
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

// Hours behind each usage percentage: SA Power Networks' residential time-of-use windows.
// Retailers reuse the names "shoulder" and "off-peak" for different hours, so plans are
// charged by these hours, not by the name a retailer gives a rate.
const USAGE_BAND_HOURS = {
    peak: [6, 7, 8, 9, 16, 17, 18, 19, 20, 21, 22, 23],
    shoulder: [10, 11, 12, 13, 14, 15], // daytime
    offPeak: [0, 1, 2, 3, 4, 5]         // overnight
};
const WEEK_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const GST_MULTIPLIER = 1.1; // API unit prices exclude GST

/**
 * Get a plan's tariff periods (its rates and the hours they apply) from the detailed API response
 * @param {Object} planData - Plan data
 * @returns {Array} Tariff periods; empty for plans without API data (custom plans)
 */
function getTariffPeriods(planData) {
    return planData.raw_plan_data_complete?.detailed_api_response?.data?.planData?.contract?.[0]?.tariffPeriod || [];
}

/**
 * Convert an HHMM time string to minutes after midnight
 * @param {string} hhmm - Time in HHMM format
 * @returns {number} Minutes after midnight
 */
function minuteOfDay(hhmm) {
    return parseInt(hhmm.substring(0, 2), 10) * 60 + parseInt(hhmm.substring(2), 10);
}

/**
 * Check if a time window covers a minute of the day.
 * The end time is inclusive and a window may wrap past midnight (e.g. 1500-0059).
 * @param {Object} timeWindow - { startTime, endTime } in HHMM format
 * @param {number} minute - Minutes after midnight
 * @returns {boolean} True if the window covers that minute
 */
function timeWindowCovers(timeWindow, minute) {
    const start = minuteOfDay(timeWindow.startTime);
    const end = minuteOfDay(timeWindow.endTime);
    return start <= end ? (minute >= start && minute <= end) : (minute >= start || minute <= end);
}

/**
 * Share of the year each tariff period applies (seasonal plans have more than one)
 * @param {Array} tariffPeriods - Tariff periods with startDate and endDate
 * @returns {Array} Weights adding up to 1
 */
function getTariffPeriodWeights(tariffPeriods) {
    if (tariffPeriods.length === 1) {
        return [1];
    }

    const days = tariffPeriods.map(period => {
        // Only the month and day matter; 2001 is not a leap year
        const start = Date.parse(`2001-${period.startDate.substring(5)}`);
        const end = Date.parse(`2001-${period.endDate.substring(5)}`);
        return ((end - start) / 86400000 + 365) % 365 + 1;
    });
    const totalDays = days.reduce((sum, periodDays) => sum + periodDays, 0);
    return days.map(periodDays => periodDays / totalDays);
}

/**
 * Cost of one day's kWh through a block's rate tiers (e.g. first 24 kWh free, then 17.9c)
 * @param {number} kwh - kWh used in the block that day
 * @param {Array} blockRate - Rate tiers with unitPrice and optional volume
 * @returns {number} Cost in cents, excluding GST
 */
function calculateTieredCents(kwh, blockRate) {
    let cents = 0;
    let remaining = kwh;

    for (const tier of blockRate) {
        // Tier volumes are daily allowances, whatever the plan's blockPeriod says
        const tierKwh = tier.volume ? Math.min(remaining, tier.volume) : remaining;
        cents += tierKwh * tier.unitPrice;
        remaining -= tierKwh;
    }

    return cents;
}

/**
 * Calculate usage charge from the hours each of the plan's rates applies
 * @param {Object} planData - Plan data with tariff periods
 * @param {number} netGridConsumption - Net consumption from grid per quarter (kWh)
 * @param {number} peakPercent - Percentage used 6am-10am and 4pm-midnight
 * @param {number} shoulderPercent - Percentage used 10am-4pm
 * @param {number} offPeakPercent - Percentage used midnight-6am
 * @returns {number|null} Usage charge in dollars, or null if the plan has no usable time windows
 */
function calculateTimeWindowUsageCharge(planData, netGridConsumption, peakPercent, shoulderPercent, offPeakPercent) {
    const tariffPeriods = getTariffPeriods(planData);
    if (tariffPeriods.length === 0) {
        return null;
    }

    // Spread each band's daily kWh evenly over its hours
    const dailyKwh = netGridConsumption / 91;
    const bandPercents = { peak: peakPercent, shoulder: shoulderPercent, offPeak: offPeakPercent };
    const hourlyKwh = [];
    for (const [band, hours] of Object.entries(USAGE_BAND_HOURS)) {
        for (const hour of hours) {
            hourlyKwh[hour] = dailyKwh * (bandPercents[band] / 100) / hours.length;
        }
    }

    const periodWeights = getTariffPeriodWeights(tariffPeriods);
    let centsPerDay = 0;

    for (let p = 0; p < tariffPeriods.length; p++) {
        const blocks = tariffPeriods[p].touBlock || [];

        for (const day of WEEK_DAYS) {
            const blockKwh = blocks.map(() => 0);

            for (let hour = 0; hour < 24; hour++) {
                // shortcut: samples the start of each hour because every plan uses whole-hour windows; sample half hours if that changes
                const blockIndex = blocks.findIndex(block => (block.timeOfUse || []).some(timeWindow =>
                    (timeWindow.days || '').includes(day) && timeWindowCovers(timeWindow, hour * 60)
                ));
                if (blockIndex === -1) {
                    return null; // An hour without a rate - the plan can't be charged by time
                }
                blockKwh[blockIndex] += hourlyKwh[hour];
            }

            blocks.forEach((block, blockIndex) => {
                centsPerDay += (periodWeights[p] / 7) * calculateTieredCents(blockKwh[blockIndex], block.blockRate);
            });
        }
    }

    return (centsPerDay * 91 * GST_MULTIPLIER) / 100; // Convert cents to dollars
}

/**
 * Calculate usage charge based on TOU rates and net grid consumption
 * @param {Object} planData - Plan data with rate information
 * @param {number} netGridConsumption - Net consumption from grid (kWh)
 * @param {number} peakPercent - Percentage used 6am-10am and 4pm-midnight
 * @param {number} shoulderPercent - Percentage used 10am-4pm
 * @param {number} offPeakPercent - Percentage used midnight-6am
 * @returns {number} Usage charge in dollars
 */
function calculateUsageCharge(planData, netGridConsumption, peakPercent, shoulderPercent, offPeakPercent) {
    const timeWindowCharge = calculateTimeWindowUsageCharge(planData, netGridConsumption, peakPercent, shoulderPercent, offPeakPercent);
    if (timeWindowCharge !== null) {
        return timeWindowCharge;
    }

    // No time windows (e.g. a custom plan from the compare page): one flat rate per band
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
    if (solarFitRates.length === 0 && planData.solar_feed_in_rate_r && planData.solar_feed_in_rate_r > 0) {
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
        
        // Extract rate information from singleTariffRates
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
        
        // Extract time-of-day rates - each one only pays inside its timeVariations windows
        if (fit.timeVaryingTariffs && Array.isArray(fit.timeVaryingTariffs)) {
            for (const timeRate of fit.timeVaryingTariffs) {
                for (const rateData of timeRate.rates || []) {
                    if (rateData.unitPrice === undefined) {
                        continue;
                    }
                    processedRates.push({
                        rate: rateData.unitPrice,
                        volume: rateData.volume || null,
                        type: fit.type || 'R',
                        scheme: fit.scheme || 'OTHER',
                        displayName: timeRate.displayName || fit.displayName || '',
                        timeType: timeRate.type, // PEAK, OFF_PEAK, SHOULDER
                        timeVariations: timeRate.timeVariations
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

// Solar without a battery exports while the sun is up. All export is assumed to fall
// in the 10am-4pm solar window, sampled every half hour.
const SOLAR_EXPORT_MINUTES = [600, 630, 660, 690, 720, 750, 780, 810, 840, 870, 900, 930];

/**
 * Calculate daily solar credit across volume tiers and time-of-day rates
 * @param {number} dailyExportKwh - Daily average export in kWh
 * @param {Array} solarFitTiers - Solar FiT tiers, capped tiers first (see processSolarFitData)
 * @returns {number} Daily solar credit in dollars
 */
function calculateDailySolarCredit(dailyExportKwh, solarFitTiers) {
    if (dailyExportKwh <= 0 || !solarFitTiers || solarFitTiers.length === 0) {
        return 0;
    }

    const tierVolumeLeft = solarFitTiers.map(tier => tier.volume || Infinity); // volume=null means unlimited
    let totalCents = 0;

    for (const minute of SOLAR_EXPORT_MINUTES) {
        let remainingExport = dailyExportKwh / SOLAR_EXPORT_MINUTES.length;

        solarFitTiers.forEach((tier, tierIndex) => {
            // A tier without time windows pays at any time of day
            const paysNow = !tier.timeVariations || tier.timeVariations.some(timeWindow => timeWindowCovers(timeWindow, minute));
            if (!paysNow) {
                return;
            }

            const tierExport = Math.min(remainingExport, tierVolumeLeft[tierIndex]);
            totalCents += tierExport * tier.rate;
            tierVolumeLeft[tierIndex] -= tierExport;
            remainingExport -= tierExport;
        });
    }

    return totalCents / 100; // Convert cents to dollars
}

/**
 * Describe when a time-of-day FiT tier pays, e.g. "6AM-10AM, 4PM-12AM"
 * @param {Object} tier - Solar FiT tier from extractSolarFitRates
 * @returns {string} Time windows, or an empty string if the tier pays at any time
 */
function formatFitWindows(tier) {
    return (tier.timeVariations || []).map(timeWindow => {
        const endMinute = (minuteOfDay(timeWindow.endTime) + 1) % 1440; // Ends are inclusive: 0959 means until 10:00
        const endTime = String(Math.floor(endMinute / 60)).padStart(2, '0') + String(endMinute % 60).padStart(2, '0');
        return `${formatTime(timeWindow.startTime)}-${formatTime(endTime)}`;
    }).join(', ');
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
 * Disqualify plans with demand charges, and flat-rate plans with zero or null rates
 * @param {Object} planData - Plan data to validate
 * @returns {boolean} True if plan should be disqualified
 */
function shouldDisqualifyPlan(planData) {
    // Check for demand charges - exclude plans with demand charges
    if (hasDemandCharge(planData)) {
        return true;
    }

    // Plans with time windows are charged by the hour, so a 0c rate is a real free period
    if (getTariffPeriods(planData).length > 0) {
        return false;
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

// Eligibility restriction types (API codes) a general household can't be assumed to meet:
//   CB = Connected Battery required (VPP plans)
//   SC = Seniors Card required
//   OC = Other Condition (memberships, partnerships, SOHO, EV, movers, etc.)
//   FF = Frequent Flyer/Loyalty program required
//   SN = Sign-up/New connection only
// Types we KEEP (user may qualify):
//   SM = Smart Meter required (free upgrade available)
//   SP = Solar Panel specific (user may have solar)
//   PS = Pricing Structure specific
//   SO = Sign-up channel (online only - anyone can do)
const EXCLUDED_RESTRICTION_TYPES = ['CB', 'SC', 'OC', 'FF', 'SN'];

// Some retailers state a membership requirement only in the plan name or terms, with no restriction type
// (e.g. "for current FIRST members", "be a NAB personal banking customer").
// shortcut: matches wording, so a plan that words it differently is still shown; switch to a restriction type if retailers start sending one
const MEMBERSHIP_WORDING = /\bmembers?\b|\bmembership\b|banking customer/i;

/**
 * Check if a plan has an eligibility restriction that rules out general residential users.
 * Uses restriction TYPE codes from the API data (resilient to plan ID version changes).
 * @param {Object} planData - Plan data to check
 * @returns {boolean} True if the plan should not be offered
 */
function hasExcludedEligibility(planData) {
    const contract = planData.raw_plan_data_complete
        ?.detailed_api_response
        ?.data
        ?.planData
        ?.contract?.[0];
    const restrictions = contract?.eligibilityRestriction || [];

    return restrictions.some(restriction => EXCLUDED_RESTRICTION_TYPES.includes(restriction.type))
        || MEMBERSHIP_WORDING.test(`${planData.plan_name} ${contract?.terms || ''}`);
}

/**
 * Check if a plan has "battery-only" solar FiT
 * These plans only pay for exports during evening hours (after solar generation)
 * meaning they're only useful for users with batteries who can time-shift their export
 * @param {Object} planData - Plan data to check
 * @returns {Object} { isBatteryOnly: boolean, reason: string, fitDetails: object }
 */
function hasBatteryOnlySolarFit(planData) {
    try {
        const contract = planData.raw_plan_data_complete?.main_api_response?.planData?.contract?.[0];
        if (!contract || !contract.solarFit) {
            return { isBatteryOnly: false, reason: 'No solar FiT data', fitDetails: null };
        }

        // Typical solar generation hours (9am-5pm / 0900-1700)
        const SOLAR_GENERATION_START = 900;  // 9:00 AM
        const SOLAR_GENERATION_END = 1700;   // 5:00 PM

        let hasTimeVaryingFit = false;
        let hasDaytimeFitRate = false;
        let peakFitWindow = null;
        let peakFitRate = 0;

        for (const fit of contract.solarFit) {
            // Skip government schemes
            if (fit.type === 'G') continue;

            if (fit.tariffUType === 'timeVaryingTariffs' && fit.timeVaryingTariffs) {
                hasTimeVaryingFit = true;

                for (const timeRate of fit.timeVaryingTariffs) {
                    const rate = timeRate.rates?.[0]?.unitPrice || timeRate.rate || 0;

                    if (rate > 0 && timeRate.timeVariations) {
                        for (const variation of timeRate.timeVariations) {
                            const startTime = parseInt(variation.startTime, 10);
                            const endTime = parseInt(variation.endTime, 10);

                            // Skip if time data is malformed - don't exclude on bad data
                            if (isNaN(startTime) || isNaN(endTime)) {
                                console.warn(`Skipping malformed time data in FiT: ${variation.startTime}-${variation.endTime}`);
                                hasDaytimeFitRate = true; // Assume daytime rate exists (conservative)
                                continue;
                            }

                            // Check if this payment window overlaps with solar generation hours
                            // A window overlaps if it starts before solar end AND ends after solar start
                            const overlapsWithSolar = timeRangesOverlap(
                                startTime, endTime,
                                SOLAR_GENERATION_START, SOLAR_GENERATION_END
                            );

                            if (overlapsWithSolar) {
                                hasDaytimeFitRate = true;
                            }

                            // Track peak FiT details for reporting
                            if (rate > peakFitRate) {
                                peakFitRate = rate;
                                peakFitWindow = {
                                    start: variation.startTime,
                                    end: variation.endTime,
                                    rate: rate,
                                    type: timeRate.type || timeRate.displayName
                                };
                            }
                        }
                    }
                }
            }
        }

        // If plan has time-varying FiT but no payment during solar hours, it's battery-only
        if (hasTimeVaryingFit && !hasDaytimeFitRate) {
            return {
                isBatteryOnly: true,
                reason: `FiT only pays ${peakFitRate}c/kWh between ${formatTime(peakFitWindow?.start)}-${formatTime(peakFitWindow?.end)} (after solar generation hours). Users without batteries get $0 for their solar export.`,
                fitDetails: peakFitWindow
            };
        }

        return { isBatteryOnly: false, reason: null, fitDetails: null };

    } catch (error) {
        console.warn('Error checking for battery-only solar FiT:', error);
        return { isBatteryOnly: false, reason: 'Check failed', fitDetails: null };
    }
}

/**
 * Check if two time ranges overlap
 * Handles overnight ranges (e.g., 1730-0700)
 * @param {number} start1 - Start time 1 (HHMM format as number)
 * @param {number} end1 - End time 1 (HHMM format as number)
 * @param {number} start2 - Start time 2 (HHMM format as number)
 * @param {number} end2 - End time 2 (HHMM format as number)
 * @returns {boolean} True if ranges overlap
 */
function timeRangesOverlap(start1, end1, start2, end2) {
    // Normalize times to handle overnight ranges
    // If end < start, it's an overnight range

    // For solar generation (start2, end2), it's always a daytime range (0900-1700)
    // For FiT windows, check if they overlap with daytime

    // Simple case: FiT window is a standard daytime window
    if (end1 > start1) {
        // Standard window (e.g., 0900-1700)
        return start1 < end2 && end1 > start2;
    } else {
        // Overnight window (e.g., 1730-0729)
        // This overlaps with daytime if:
        // - start1 is before end of solar day (1700), OR
        // - end1 is after start of solar day (0900)
        return start1 < end2 || end1 > start2;
    }
}

/**
 * Format time from HHMM to readable format
 * @param {string} timeStr - Time string in HHMM format
 * @returns {string} Formatted time (e.g., "5:30PM")
 */
function formatTime(timeStr) {
    if (!timeStr) return 'unknown';
    const hours = parseInt(timeStr.substring(0, 2), 10);
    const mins = timeStr.substring(2);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
    return mins === '00' ? `${displayHour}${period}` : `${displayHour}:${mins}${period}`;
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
    const hasSolar = (usagePattern.solarExport || 0) > 0;

    for (const plan of plansData) {
        // Disqualify plans with suspicious zero/null rates or demand charges
        if (shouldDisqualifyPlan(plan)) {
            const hasDemand = hasDemandCharge(plan);
            const reason = hasDemand ? 'has demand charges' : 'zero/null shoulder or off-peak rates';
            console.log(`Disqualified plan: ${plan.plan_name} (${plan.retailer_name}) - ${reason}`);
            continue;
        }

        // For solar users, check for battery-only FiT plans and exclude them
        if (hasSolar) {
            const batteryCheck = hasBatteryOnlySolarFit(plan);
            if (batteryCheck.isBatteryOnly) {
                console.log(`Excluded battery-only FiT plan for solar user: ${plan.plan_name} (${plan.retailer_name}) - ${batteryCheck.reason}`);
                continue;
            }
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
        hasExcludedEligibility,
        hasDemandCharge,
        hasBatteryOnlySolarFit,
        generateStrategicRecommendation,
        getPlanComparison,
        validateInputs,
        calculateMembershipFee
    };
}