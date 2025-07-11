/**
 * Plan Comparison Tool - JavaScript Logic
 * Uses the same calculation functions as the main page
 */

let allPlansData = null;
let companiesData = {};

// Initialize the comparison tool
document.addEventListener('DOMContentLoaded', function() {
    initializeComparison();
    setupEventListeners();
});

/**
 * Initialize the comparison tool
 */
async function initializeComparison() {
    try {
        // Load energy plans data
        const response = await fetch('all_energy_plans.json');
        const data = await response.json();
        
        // Extract plans array from the data structure
        let touPlans = data.plans?.TOU || [];
        
        // Filter to ONLY show plans with effectiveDate >= 2025-06-17 (same as main page)
        const targetDate = '2025-06-17';
        const originalCount = touPlans.length;
        
        allPlansData = touPlans.filter(plan => {
            // Get effectiveDate from the correct path: plan.raw_plan_data_complete.detailed_api_response.data.planData.effectiveDate
            const effectiveDate = plan.raw_plan_data_complete?.detailed_api_response?.data?.planData?.effectiveDate;
            
            if (!effectiveDate) {
                console.log(`Plan ${plan.plan_id} missing effectiveDate, excluding`);
                return false;
            }
            
            // Only include plans with effectiveDate >= 2025-06-17
            if (effectiveDate >= targetDate) {
                return true;
            } else {
                console.log(`Plan ${plan.plan_id} has old effectiveDate ${effectiveDate}, excluding`);
                return false;
            }
        });
        
        // Filter out plans with SC (Seniors Card) and OC (Other Customer Requirements) restrictions
        const restrictedPlanIds = [
            // SC (Seniors Card) Restrictions
            "AGL360486MRE33", "AGL898888MRE3",
            
            // OC (Other Customer Requirements) Restrictions
            "AGL100677MRE45", "AGL360621MRE32", "AGL686236MRE19", "AGL726430MRE17",
            "AGL726436MRE22", "AGL733560MRE17", "AGL827771MRE6", "AGL840896MRE6",
            "AGL898820MRE3", "AGL898840MRE3", "AGL907767MRE2", "AGL907790MRE2",
            "ALI849388MRE3", "ALI875577MRE3", "ENE676768MRE8", "ENE676773MRE8",
            "ENG938049SRE1", "ENG938141MRE1", "ENG938152MRE1", "ENG938161MRE1",
            "ENG938177MRE1", "ENG938181MRE1", "ENG939788MRE1", "ENG939829MRE1",
            "LUM203108MRE20", "ORI539830MRE15", "ORI665045MRE13", "ORI727571MRE7",
            "ORI848686MRE5", "ORI848791MRE3", "OVO723748MRE13", "OVO723789MRE13",
            "RED552636MRE13", "RED927290MRE1"
        ];
        
        const beforeRestrictedFilter = allPlansData.length;
        allPlansData = allPlansData.filter(plan => !restrictedPlanIds.includes(plan.plan_id));
        const restrictedPlansFiltered = beforeRestrictedFilter - allPlansData.length;
        
        console.log(`Loaded plans: ${allPlansData.length} (filtered from ${originalCount} total, ${restrictedPlansFiltered} removed for eligibility restrictions)`);
        
        // Extract unique companies
        extractCompanies();
        
        // Populate company dropdowns
        populateCompanyDropdowns();
        
    } catch (error) {
        console.error('Error loading energy plans data:', error);
        showError('Failed to load energy plans data. Please refresh the page.');
    }
}

/**
 * Extract unique companies from plans data
 */
function extractCompanies() {
    const companies = new Set();
    
    console.log('Extracting companies from', allPlansData.length, 'plans');
    
    if (Array.isArray(allPlansData)) {
        allPlansData.forEach(plan => {
            if (plan.retailer_name) {
                companies.add(plan.retailer_name);
                
                // Group plans by company
                if (!companiesData[plan.retailer_name]) {
                    companiesData[plan.retailer_name] = [];
                }
                companiesData[plan.retailer_name].push(plan);
            }
        });
    }
    
    console.log('Found companies:', Array.from(companies));
    return Array.from(companies).sort();
}

/**
 * Populate company dropdown options
 */
function populateCompanyDropdowns() {
    const companies = Object.keys(companiesData).sort();
    const dropdowns = ['company-1', 'company-2', 'company-3'];
    
    dropdowns.forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company;
            option.textContent = company;
            dropdown.appendChild(option);
        });
    });
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Form submission
    document.getElementById('comparison-form').addEventListener('submit', handleFormSubmit);
    
    // Range sliders for usage percentages
    setupRangeSliders();
    
    // Solar panel checkbox
    document.getElementById('has-solar-comp').addEventListener('change', function() {
        const solarOptions = document.getElementById('solar-options-comp');
        solarOptions.style.display = this.checked ? 'block' : 'none';
    });
    
    // Percentage validation
    const percentageInputs = ['peak-percent-comp', 'shoulder-percent-comp', 'offpeak-percent-comp'];
    percentageInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', validatePercentages);
    });
}

/**
 * Setup range sliders with live value updates
 */
function setupRangeSliders() {
    const sliders = [
        { sliderId: 'peak-percent-comp', valueId: 'peak-value-comp' },
        { sliderId: 'shoulder-percent-comp', valueId: 'shoulder-value-comp' },
        { sliderId: 'offpeak-percent-comp', valueId: 'offpeak-value-comp' }
    ];
    
    sliders.forEach(({ sliderId, valueId }) => {
        const slider = document.getElementById(sliderId);
        const valueDisplay = document.getElementById(valueId);
        
        slider.addEventListener('input', function() {
            valueDisplay.textContent = this.value + '%';
        });
    });
}

/**
 * Validate that percentages add up to 100%
 */
function validatePercentages() {
    const peak = parseFloat(document.getElementById('peak-percent-comp').value) || 0;
    const shoulder = parseFloat(document.getElementById('shoulder-percent-comp').value) || 0;
    const offpeak = parseFloat(document.getElementById('offpeak-percent-comp').value) || 0;
    
    const total = peak + shoulder + offpeak;
    const warning = document.getElementById('percentage-warning-comp');
    
    if (Math.abs(total - 100) > 0.1) {
        warning.style.display = 'block';
        return false;
    } else {
        warning.style.display = 'none';
        return true;
    }
}

/**
 * Handle form submission
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    
    // Validate form
    if (!validateForm()) {
        return;
    }
    
    // Show loading
    showLoading();
    
    try {
        // Get form data
        const formData = getFormData();
        
        // Get selected companies
        const selectedCompanies = getSelectedCompanies();
        
        // Calculate best plans for each company
        const comparisonResults = await calculateCompanyComparisons(selectedCompanies, formData);
        
        // Display results
        displayComparisonResults(comparisonResults, formData);
        
    } catch (error) {
        console.error('Error calculating comparison:', error);
        showError('Error calculating plan comparison. Please try again.');
    } finally {
        hideLoading();
    }
}

/**
 * Validate the form
 */
function validateForm() {
    // Check required fields
    const consumption = document.getElementById('quarterly-consumption-comp').value;
    const company1 = document.getElementById('company-1').value;
    
    if (!consumption || !company1) {
        showError('Please fill in all required fields.');
        return false;
    }
    
    // Validate percentages
    if (!validatePercentages()) {
        showError('Peak + Shoulder + Off-Peak usage must equal 100%.');
        return false;
    }
    
    return true;
}

/**
 * Get form data
 */
function getFormData() {
    const hasSolar = document.getElementById('has-solar-comp').checked;
    
    return {
        quarterlyConsumption: parseFloat(document.getElementById('quarterly-consumption-comp').value),
        peakPercent: parseFloat(document.getElementById('peak-percent-comp').value),
        shoulderPercent: parseFloat(document.getElementById('shoulder-percent-comp').value),
        offPeakPercent: parseFloat(document.getElementById('offpeak-percent-comp').value),
        solarExport: hasSolar ? parseFloat(document.getElementById('solar-export-comp').value) || 0 : 0
    };
}

/**
 * Get selected companies
 */
function getSelectedCompanies() {
    const companies = [];
    
    ['company-1', 'company-2', 'company-3'].forEach(id => {
        const value = document.getElementById(id).value;
        if (value) {
            companies.push(value);
        }
    });
    
    return companies;
}

/**
 * Calculate best plans for each selected company
 */
async function calculateCompanyComparisons(selectedCompanies, usagePattern) {
    const results = [];
    
    for (const company of selectedCompanies) {
        const companyPlans = companiesData[company] || [];
        
        if (companyPlans.length === 0) {
            continue;
        }
        
        // Calculate costs for all plans from this company
        const rankedPlans = calculateAndRankPlans(companyPlans, usagePattern);
        
        if (rankedPlans.length > 0) {
            results.push({
                company: company,
                bestPlan: rankedPlans[0],
                allPlans: rankedPlans.slice(0, 5), // Top 5 plans
                totalPlans: rankedPlans.length
            });
        }
    }
    
    // Sort companies by their best plan cost
    return results.sort((a, b) => a.bestPlan.totalCost - b.bestPlan.totalCost);
}

/**
 * Display comparison results
 */
function displayComparisonResults(comparisonResults, usagePattern) {
    const container = document.getElementById('comparison-cards');
    const summaryContainer = document.getElementById('comparison-summary');
    
    if (comparisonResults.length === 0) {
        container.innerHTML = '<div class="alert alert-warning">No plans found for the selected companies.</div>';
        return;
    }
    
    // Generate comparison cards
    container.innerHTML = generateComparisonCards(comparisonResults);
    
    // Generate summary
    summaryContainer.innerHTML = generateComparisonSummary(comparisonResults, usagePattern);
    
    // Show results section
    document.getElementById('results-section-comp').style.display = 'block';
    
    // Scroll to results
    document.getElementById('results-section-comp').scrollIntoView({ behavior: 'smooth' });
}

/**
 * Generate comparison cards HTML
 */
function generateComparisonCards(comparisonResults) {
    let html = '<div class="row g-4">';
    
    comparisonResults.forEach((result, index) => {
        const { company, bestPlan, totalPlans } = result;
        const { planData, totalCost, breakdown, monthlyCost } = bestPlan;
        
        const rankBadge = index === 0 ? '<span class="badge bg-success position-absolute top-0 start-50 translate-middle">Best Value</span>' : '';
        const cardClass = index === 0 ? 'border-success' : '';
        
        html += `
        <div class="col-lg-4 col-md-6">
            <div class="card h-100 ${cardClass}" style="position: relative;">
                ${rankBadge}
                <div class="card-header bg-light">
                    <h5 class="card-title mb-1">${company}</h5>
                    <small class="text-muted">${totalPlans} plan${totalPlans !== 1 ? 's' : ''} available</small>
                </div>
                <div class="card-body">
                    <div class="text-center mb-3">
                        <h3 class="text-primary">$${totalCost.toFixed(0)}</h3>
                        <small class="text-muted">per quarter</small>
                        <br>
                        <small class="text-muted">($${monthlyCost.toFixed(0)}/month)</small>
                    </div>
                    
                    <h6 class="fw-semibold">${planData.plan_name}</h6>
                    
                    <div class="row text-center mb-3">
                        <div class="col-4">
                            <small class="text-muted">Peak</small>
                            <div class="fw-semibold">${planData.peak_cost?.toFixed(1) || 'N/A'}¢</div>
                        </div>
                        <div class="col-4">
                            <small class="text-muted">Shoulder</small>
                            <div class="fw-semibold">${planData.shoulder_cost?.toFixed(1) || 'N/A'}¢</div>
                        </div>
                        <div class="col-4">
                            <small class="text-muted">Off-Peak</small>
                            <div class="fw-semibold">${planData.off_peak_cost?.toFixed(1) || 'N/A'}¢</div>
                        </div>
                    </div>
                    
                    <div class="mb-3">
                        <small class="text-muted">Daily Supply: </small>
                        <span class="fw-semibold">${planData.daily_supply_charge?.toFixed(1) || 'N/A'}¢/day</span>
                    </div>
                    
                    ${generateSolarFitDisplay(planData)}
                    
                    <div class="small">
                        <div class="d-flex justify-content-between">
                            <span>Supply charge:</span>
                            <span>$${breakdown.supplyCharge.toFixed(0)}</span>
                        </div>
                        <div class="d-flex justify-content-between">
                            <span>Usage charge:</span>
                            <span>$${breakdown.usageCharge.toFixed(0)}</span>
                        </div>
                        ${breakdown.solarCredit > 0 ? `
                        <div class="d-flex justify-content-between text-success">
                            <span>Solar credit:</span>
                            <span>-$${breakdown.solarCredit.toFixed(0)}</span>
                        </div>
                        ` : ''}
                        ${breakdown.membershipFee > 0 ? `
                        <div class="d-flex justify-content-between">
                            <span>Membership fee:</span>
                            <span>$${breakdown.membershipFee.toFixed(0)}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
        `;
    });
    
    html += '</div>';
    return html;
}

/**
 * Generate comparison summary
 */
function generateComparisonSummary(comparisonResults, usagePattern) {
    if (comparisonResults.length < 2) {
        return '';
    }
    
    const cheapest = comparisonResults[0];
    const mostExpensive = comparisonResults[comparisonResults.length - 1];
    const savings = mostExpensive.bestPlan.totalCost - cheapest.bestPlan.totalCost;
    
    return `
    <div class="card">
        <div class="card-header bg-info text-white">
            <h5 class="mb-0">Comparison Summary</h5>
        </div>
        <div class="card-body">
            <div class="row">
                <div class="col-md-6">
                    <h6>Your Custom Usage Pattern:</h6>
                    <ul class="list-unstyled mb-0">
                        <li><strong>Consumption:</strong> ${usagePattern.quarterlyConsumption} kWh/quarter</li>
                        <li><strong>Peak:</strong> ${usagePattern.peakPercent}% | <strong>Shoulder:</strong> ${usagePattern.shoulderPercent}% | <strong>Off-Peak:</strong> ${usagePattern.offPeakPercent}%</li>
                        ${usagePattern.solarExport > 0 ? `<li><strong>Solar Export:</strong> ${usagePattern.solarExport} kWh/quarter</li>` : ''}
                    </ul>
                </div>
                <div class="col-md-6">
                    <h6>Potential Savings:</h6>
                    <div class="text-success">
                        <strong>Save up to $${savings.toFixed(0)} per quarter</strong><br>
                        <small>($${(savings * 4).toFixed(0)} per year)</small>
                    </div>
                    <p class="mt-2 mb-0">
                        <strong>${cheapest.company}</strong> offers the best value with their 
                        <strong>${cheapest.bestPlan.planData.plan_name}</strong> plan.
                    </p>
                </div>
            </div>
        </div>
    </div>
    `;
}

/**
 * Show loading indicator
 */
function showLoading() {
    document.getElementById('loading-comp').style.display = 'block';
    document.getElementById('results-section-comp').style.display = 'none';
}

/**
 * Hide loading indicator
 */
function hideLoading() {
    document.getElementById('loading-comp').style.display = 'none';
}

/**
 * Generate solar feed-in tariff display (shows tiered rates if available)
 */
function generateSolarFitDisplay(planData) {
    // Get the tiered solar FiT data
    const solarFitData = extractSolarFitRates(planData);
    
    if (!solarFitData || solarFitData.length === 0) {
        return '';
    }
    
    // If only one tier, show simple display
    if (solarFitData.length === 1) {
        const rate = solarFitData[0].rate;
        return `
        <div class="mb-3">
            <small class="text-muted">Solar FiT: </small>
            <span class="fw-semibold">${rate?.toFixed(1)}¢/kWh</span>
        </div>
        `;
    }
    
    // Check if this is time-varying (Energy Locals) or volume-based tiers
    const hasTimeVaryingRates = solarFitData.some(tier => tier.timeType);
    
    if (hasTimeVaryingRates) {
        // Time-varying rates (Energy Locals) - show time periods
        let timeRatesHtml = solarFitData.map(tier => {
            const rate = tier.rate?.toFixed(1);
            const timeType = tier.timeType;
            let period = '';
            
            switch(timeType) {
                case 'PEAK':
                    period = 'Peak (4pm-9pm)';
                    break;
                case 'SHOULDER':
                    period = 'Solar Sponge (10am-4pm)';
                    break;
                case 'OFF_PEAK':
                    period = 'Off-Peak (9pm-10am)';
                    break;
                default:
                    period = timeType || 'Standard';
            }
            
            return `${rate}¢ (${period})`;
        }).join('<br>');
        
        return `
        <div class="mb-3">
            <small class="text-muted">Solar FiT (Time-varying): </small>
            <div class="small fw-semibold">${timeRatesHtml}</div>
        </div>
        `;
    } else {
        // Volume-based tiers - show tiered structure
        let tiersHtml = solarFitData.map(tier => {
            const rate = tier.rate?.toFixed(1);
            if (tier.volume) {
                return `${rate}¢ (first ${tier.volume}kWh/day)`;
            } else {
                return `${rate}¢ (excess)`;
            }
        }).join('<br><small class="text-muted">then </small>');
        
        return `
        <div class="mb-3">
            <small class="text-muted">Solar FiT: </small>
            <div class="small fw-semibold">${tiersHtml}</div>
        </div>
        `;
    }
}

/**
 * Show error message
 */
function showError(message) {
    // You could implement a more sophisticated error display here
    alert(message);
}