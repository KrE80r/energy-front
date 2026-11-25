// Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');

// calculator.js expects the discount detector as a browser global
global.applyGuaranteedDiscount = require('../docs/guaranteed_discount_detector.js').applyGuaranteedDiscount;
const { calculatePlanCost, calculateAndRankPlans, hasExcludedEligibility } = require('../docs/js/calculator.js');

const EVERY_DAY = 'MON|TUE|WED|THU|FRI|SAT|SUN';
const block = (rates, windows, days = EVERY_DAY) => ({
    blockRate: Array.isArray(rates) ? rates : [{ unitPrice: rates }],
    timeOfUse: windows.map(([startTime, endTime]) => ({ days, startTime, endTime }))
});
const period = (touBlock, dates = {}) => ({ touBlock, ...dates });
const fitWindow = (rate, windows, volume) => ({
    type: 'R',
    tariffUType: 'timeVaryingTariffs',
    rate,
    timeVaryingTariffs: [{
        type: 'PEAK',
        rates: [{ unitPrice: rate, ...(volume ? { volume } : {}) }],
        timeVariations: windows.map(([startTime, endTime]) => ({ days: EVERY_DAY, startTime, endTime }))
    }]
});

// A plan shaped like the Energy Made Easy data; API unit prices exclude GST
function plan({ tariffPeriod, solarFit = [], eligibilityRestriction = [], flat = {} }) {
    const contract = { tariffPeriod, solarFit, eligibilityRestriction };
    return {
        plan_name: 'Test plan',
        retailer_name: 'Test retailer',
        daily_supply_charge: 0,
        peak_cost: 44,
        shoulder_cost: 22,
        off_peak_cost: 22,
        ...flat,
        raw_plan_data_complete: {
            main_api_response: { planData: { contract: [contract] } },
            detailed_api_response: { data: { planData: { contract: [contract] } } }
        }
    };
}

// 2,184 kWh a quarter = 24 kWh a day. Peak covers 12 hours, daytime 6, overnight 6,
// so 50/25/25 is exactly 1 kWh in every hour.
const ONE_KWH_EVERY_HOUR = { quarterlyConsumption: 2184, peakPercent: 50, shoulderPercent: 25, offPeakPercent: 25, solarExport: 0 };
const TEN_KWH_EXPORT_A_DAY = { ...ONE_KWH_EVERY_HOUR, solarExport: 910 };
const usageCharge = (p, usage = ONE_KWH_EVERY_HOUR) => calculatePlanCost(p, usage).breakdown.usageCharge;
const solarCredit = (p, usage = TEN_KWH_EXPORT_A_DAY) => calculatePlanCost(p, usage).breakdown.solarCredit;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.01, `expected ${expected}, got ${actual}`);

test('usage is charged by the hours a rate applies, not by what the retailer calls it', () => {
    // Momentum calls 10am-4pm "off-peak" and midnight-6am "shoulder", the reverse of most retailers
    const usage = { quarterlyConsumption: 2184, peakPercent: 50, shoulderPercent: 10, offPeakPercent: 40, solarExport: 0 };
    const reversedLabels = plan({
        flat: { shoulder_cost: 22, off_peak_cost: 11 },
        tariffPeriod: [period([
            block(40, [['0600', '0959'], ['1600', '2359']]),
            block(10, [['1000', '1559']]),
            block(20, [['0000', '0559']])
        ])]
    });
    // per day: 12 kWh peak at 44c, 2.4 kWh daytime at 11c, 9.6 kWh overnight at 22c
    near(usageCharge(reversedLabels, usage), 91 * (12 * 44 + 2.4 * 11 + 9.6 * 22) / 100);
});

test('a peak window that starts earlier and runs later is charged for every hour it covers', () => {
    const lateEveningPeak = plan({
        tariffPeriod: [period([
            block(40, [['0600', '0959'], ['1500', '0059']]),
            block(20, [['0100', '0559']]),
            block(20, [['1000', '1459']])
        ])]
    });
    // peak now covers 14 hours (6-10am, 3pm-1am), the other two rates 10 hours
    near(usageCharge(lateEveningPeak), 91 * (14 * 44 + 10 * 22) / 100);
});

test('a free daily allowance only covers its cap', () => {
    const freeLunch = plan({
        tariffPeriod: [period([
            block([{ unitPrice: 0, volume: 2 }, { unitPrice: 20 }], [['1200', '1459']]),
            block(40, [['0000', '1159'], ['1500', '2359']])
        ])]
    });
    // noon-3pm: 3 kWh, 2 free then 1 at 22c; the other 21 hours at 44c
    near(usageCharge(freeLunch), 91 * (1 * 22 + 21 * 44) / 100);
});

test('a weekday-only rate applies five days in seven', () => {
    const weekdayShift = plan({
        tariffPeriod: [period([
            block(10, [['0900', '1659']], 'MON|TUE|WED|THU|FRI'),
            block(40, [['0000', '0859'], ['1700', '2359']], 'MON|TUE|WED|THU|FRI'),
            block(40, [['0000', '2359']], 'SAT|SUN')
        ])]
    });
    const weekday = 8 * 11 + 16 * 44;
    const weekend = 24 * 44;
    near(usageCharge(weekdayShift), 91 * (5 * weekday + 2 * weekend) / 7 / 100);
});

test('seasonal rates are averaged by the days each season lasts', () => {
    const seasonal = plan({
        tariffPeriod: [
            period([block(20, [['0000', '2359']])], { startDate: '2026-10-01', endDate: '2026-04-30' }),
            period([block(40, [['0000', '2359']])], { startDate: '2026-05-01', endDate: '2026-09-30' })
        ]
    });
    // Oct-Apr is 212 days, May-Sep is 153
    near(usageCharge(seasonal), 91 * 24 * (212 * 22 + 153 * 44) / 365 / 100);
});

test('a plan with a free period is ranked instead of dropped for its 0c rate', () => {
    const freeFour = plan({
        flat: { off_peak_cost: 0, shoulder_cost: null },
        tariffPeriod: [period([
            block(40, [['0000', '1059'], ['1500', '2359']]),
            block(0, [['1100', '1459']])
        ])]
    });
    const ranked = calculateAndRankPlans([freeFour], ONE_KWH_EVERY_HOUR);
    assert.equal(ranked.length, 1);
    near(ranked[0].breakdown.usageCharge, 91 * 20 * 44 / 100);
});

test('a plan with only flat rates (the compare page custom plan) uses them per band', () => {
    const custom = { plan_name: 'Mine', retailer_name: 'Me', daily_supply_charge: 0, peak_cost: 44, shoulder_cost: 11, off_peak_cost: 22 };
    near(usageCharge(custom), 91 * (12 * 44 + 6 * 11 + 6 * 22) / 100);
});

test('an evening-only feed-in rate pays nothing for daytime solar export', () => {
    // Ezi Peak: 25c in the morning and evening peaks, 2c at all other times
    const eveningBonus = plan({
        tariffPeriod: [period([block(40, [['0000', '2359']])])],
        solarFit: [
            fitWindow(25, [['0600', '0959'], ['1600', '2359']]),
            fitWindow(2, [['0000', '0559'], ['1000', '1559']])
        ]
    });
    near(solarCredit(eveningBonus), 910 * 2 / 100);
});

test('a feed-in window that wraps past midnight still covers daytime export', () => {
    // CovaU SolarMax: 15c for the first 30 kWh between 6pm and 9pm, 5c from 9pm to 6pm
    const wrapsMidnight = plan({
        tariffPeriod: [period([block(40, [['0000', '2359']])])],
        solarFit: [fitWindow(15, [['1800', '2059']], 30), fitWindow(5, [['2100', '1759']])]
    });
    near(solarCredit(wrapsMidnight), 910 * 5 / 100);
});

test('a stepped feed-in tariff pays the higher rate only up to its daily cap', () => {
    const stepped = plan({
        tariffPeriod: [period([block(40, [['0000', '2359']])])],
        solarFit: [{
            type: 'R',
            tariffUType: 'singleTariff',
            singleTariffRates: [{ unitPrice: 5, volume: 8 }, { unitPrice: 0.5, volume: 0 }]
        }]
    });
    // 10 kWh a day: 8 at 5c, 2 at 0.5c
    near(solarCredit(stepped), 91 * (8 * 5 + 2 * 0.5) / 100);
});

test('plans that need a battery are excluded, plans that need a smart meter are not', () => {
    const tariffPeriod = [period([block(40, [['0000', '2359']])])];
    assert.equal(hasExcludedEligibility(plan({ tariffPeriod, eligibilityRestriction: [{ type: 'SM' }, { type: 'CB' }] })), true);
    assert.equal(hasExcludedEligibility(plan({ tariffPeriod, eligibilityRestriction: [{ type: 'SM' }] })), false);
    assert.equal(hasExcludedEligibility({ plan_name: 'custom plan without API data' }), false);
});
