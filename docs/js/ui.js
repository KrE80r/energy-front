/**
 * User Interface Controller
 * Handles all UI interactions and visual updates
 */

/**
 * Create and display plan comparison cards
 * @param {Array} rankedCalculations - Sorted calculations with cost data
 * @param {string} personaKey - Current persona selection
 */
function displayPlanCards(rankedCalculations, personaKey) {
    const planCardsContainer = document.getElementById('plan-cards');
    const maxPlans = 10; // Show top 10 plans
    
    // Clear existing content
    planCardsContainer.innerHTML = '';
    
    // Take top plans (limit to maxPlans)
    const topPlans = rankedCalculations.slice(0, maxPlans);
    
    // Create plan list
    topPlans.forEach((calculation, index) => {
        const planCard = createPlanCardNew(calculation, personaKey, index);
        planCardsContainer.appendChild(planCard);
    });
    
    // Add fade-in animation
    setTimeout(() => {
        planCardsContainer.classList.add('fade-in');
    }, 100);
}

/**
 * Create individual plan card element
 * @param {Object} calculation - Calculated cost data
 * @param {string} personaKey - Current persona selection
 * @param {number} index - Card index for ranking display
 * @returns {HTMLElement} Plan card element
 */
function createPlanCardNew(calculation, personaKey, index) {
    const { planData, totalCost, monthlyCost, breakdown } = calculation;
    const strategicRecommendation = generateStrategicRecommendation(calculation, personaKey);
    
    const card = document.createElement('div');
    card.className = 'plan-card-row';
    if (index === 0) card.classList.add('verified-winner');
    
    card.innerHTML = `
        <div class="plan-row-content">
            <div class="plan-info-section">
                <div class="retailer-info">
                    <div class="retailer-name">${planData.retailer_name}</div>
                    <div class="plan-name" title="${planData.plan_name}">${planData.plan_name}</div>
                </div>
            </div>
            
            <div class="timeline-section">
                <div class="timeline-label">TIME PERIODS</div>
                <div class="time-periods-text" data-plan-index="${index}">
                    Loading time periods...
                </div>
            </div>
            
            <div class="rates-section">
                <div class="rates-label">KEY RATES (C/KWH)</div>
                <div class="rates-list">
                    <div class="rate-group">
                        <span class="rate-type peak-rate">P: ${planData.peak_cost ? planData.peak_cost.toFixed(2) : 'N/A'}</span>
                        <span class="rate-type shoulder-rate">S: ${planData.shoulder_cost ? planData.shoulder_cost.toFixed(2) : 'N/A'}</span>
                        <span class="rate-type offpeak-rate">O: ${planData.off_peak_cost ? planData.off_peak_cost.toFixed(2) : 'N/A'}</span>
                    </div>
                    <div class="rate-group">
                        <span class="rate-type supply-rate">Supply: ${planData.daily_supply_charge ? planData.daily_supply_charge.toFixed(2) + '¢/day' : 'N/A'}</span>
                        ${planData.solar_feed_in_rate_r ? `<span class="rate-type fit-rate">FiT: ${planData.solar_feed_in_rate_r.toFixed(1)}</span>` : ''}
                    </div>
                </div>
            </div>
            
            <div class="cost-section">
                <div class="cost-amount">$${totalCost.toFixed(2)}</div>
                <div class="cost-details">
                    <div>~$${monthlyCost.toFixed(2)}/month</div>
                    <div>~$${totalCost.toFixed(2)}/quarter</div>
                    <div>~$${(totalCost * 4).toFixed(2)}/annual</div>
                </div>
            </div>
            
            <div class="verdict-section">
                <div class="verdict-label">STRATEGIC VERDICT</div>
                <div class="verdict-content">${index === 0 ? 'VERIFIED WINNER: ' : ''}${strategicRecommendation}</div>
            </div>
        </div>
    `;
    
    // Add time periods text and plan name truncation detection
    setTimeout(() => {
        displayTimePeriods(card, planData);
        setupPlanNameTooltip(card);
    }, 0);
    
    return card;
}

/**
 * Setup plan name tooltip when text is truncated
 * @param {HTMLElement} card - The plan card element
 */
function setupPlanNameTooltip(card) {
    const planNameElement = card.querySelector('.plan-name');
    if (!planNameElement) return;
    
    // Check if text is truncated
    if (planNameElement.scrollWidth > planNameElement.clientWidth) {
        planNameElement.style.cursor = 'help';
        planNameElement.title = planNameElement.textContent;
    } else {
        planNameElement.style.cursor = 'default';
        planNameElement.removeAttribute('title');
    }
}

/**
 * Display time periods as simple text from plan data
 * @param {HTMLElement} card - The plan card element
 * @param {Object} planData - Plan data with time period information
 */
function displayTimePeriods(card, planData = {}) {
    const timePeriodsContainer = card.querySelector('.time-periods-text');
    
    if (!timePeriodsContainer) {
        console.warn('Time periods container not found');
        return;
    }
    
    // Extract time periods from plan data
    if (planData && planData.detailed_time_blocks) {
        const timePeriodsText = [];
        
        planData.detailed_time_blocks.forEach(block => {
            if (block.description && block.name) {
                // Clean up the description and format it nicely
                const cleanDescription = block.description
                    .replace(/;/g, ' & ')  // Replace semicolons with &
                    .replace(/\s+/g, ' ')  // Clean up extra spaces
                    .trim();
                
                timePeriodsText.push(`${block.name}: ${cleanDescription}`);
            }
        });
        
        if (timePeriodsText.length > 0) {
            timePeriodsContainer.innerHTML = timePeriodsText.join('<br>');
        } else {
            timePeriodsContainer.textContent = 'Standard TOU periods apply';
        }
    } else {
        timePeriodsContainer.textContent = 'Standard TOU periods apply';
    }
}

// Removed complex time period parsing - now using simple text display
    
// Removed complex pattern examples - using simple text display instead

/**
 * Parse time periods from description field
 * @param {string} description - Time description like "06:00 - 10:00; 15:00 - 01:00"
 * @param {Object} block - The time block data containing rates and type info
 * @returns {Array} Array of parsed time periods
 */
function parseTimeDescription(description, block) {
    const periods = [];
    
    try {
        // Convert period type
        let type = 'off-peak';
        if (block.time_of_use_period === 'P') type = 'peak';
        else if (block.time_of_use_period === 'S') type = 'shoulder';
        
        // Get rate information
        const rate = block.rates && block.rates[0] ? block.rates[0].unit_price_gst : null;
        
        // Split by semicolon to handle multiple time ranges
        // "06:00 - 10:00; 15:00 - 01:00" becomes ["06:00 - 10:00", "15:00 - 01:00"]
        const timeRanges = description.split(';').map(range => range.trim());
        
        timeRanges.forEach(range => {
            // Parse individual time range "06:00 - 10:00"
            const timeMatch = range.match(/(\d{2}):(\d{2})\s*-\s*(\d{2}):(\d{2})/);
            
            if (timeMatch) {
                const [, startHour, startMin, endHour, endMin] = timeMatch.map(Number);
                
                // Validate time values
                if (startHour >= 0 && startHour <= 23 && startMin >= 0 && startMin <= 59 &&
                    endHour >= 0 && endHour <= 23 && endMin >= 0 && endMin <= 59) {
                    
                    const startDecimal = startHour + (startMin / 60);
                    const endDecimal = endHour + (endMin / 60);
                    
                    // Format display times
                    const startDisplay = formatTimeForDisplay(startHour, startMin);
                    const endDisplay = formatTimeForDisplay(endHour, endMin);
                    
                    // Create period object
                    periods.push({
                        start: startDecimal,
                        end: endDecimal,
                        type: type,
                        label: `${startDisplay}-${endDisplay}`,
                        displayLabel: `${block.name}: ${startDisplay}-${endDisplay}`,
                        rate: rate,
                        description: range.trim(),
                        originalDescription: description
                    });
                } else {
                    console.warn('Invalid time values in description:', { range, startHour, startMin, endHour, endMin });
                }
            } else {
                console.warn('Could not parse time range:', range);
            }
        });
    } catch (error) {
        console.error('Error parsing time description:', description, error);
    }
    
    return periods;
}

/**
 * Generate dynamic timeline visual based on actual plan time periods
 * @param {HTMLElement} timelineBar - The timeline bar element
 * @param {Array} timePeriods - Parsed time periods from plan data
 */
function generateDynamicTimeline(timelineBar, timePeriods) {
    // If no valid time periods, keep default CSS
    if (!timePeriods || timePeriods.length === 0) {
        return;
    }
    
    // Save the tooltip element before clearing
    const tooltip = timelineBar.querySelector('.timeline-tooltip');
    let tooltipText = 'Hover over timeline to see time periods';
    if (tooltip) {
        tooltipText = tooltip.textContent;
    }
    
    // Clear existing content and create solid segments
    timelineBar.innerHTML = '';
    timelineBar.style.background = 'none';
    timelineBar.style.display = 'flex';
    timelineBar.style.position = 'relative';
    
    // Create 24-hour timeline with periods
    const timelineSegments = createTimelineSegments(timePeriods);
    
    // Create solid HTML segments instead of gradient
    const newTooltip = createSolidTimelineSegments(timelineBar, timelineSegments, tooltipText);
    
    return newTooltip;
}

/**
 * Create timeline segments covering full 24-hour period
 * @param {Array} timePeriods - Parsed time periods
 * @returns {Array} Timeline segments with start/end percentages and colors
 */
function createTimelineSegments(timePeriods) {
    const segments = [];
    
    // Create a 24-hour array to track which period applies to each hour
    const hourlyPeriods = new Array(24).fill(null);
    
    // Fill in the periods
    timePeriods.forEach(period => {
        const startHour = Math.floor(period.start);
        const endHour = Math.floor(period.end);
        
        if (period.start <= period.end) {
            // Normal period within same day
            for (let hour = startHour; hour < endHour; hour++) {
                hourlyPeriods[hour] = period;
            }
            // Handle partial hours
            if (period.end % 1 !== 0) {
                hourlyPeriods[endHour] = period;
            }
        } else {
            // Midnight-crossing period
            // Fill from start to end of day
            for (let hour = startHour; hour < 24; hour++) {
                hourlyPeriods[hour] = period;
            }
            // Fill from start of day to end
            for (let hour = 0; hour < endHour; hour++) {
                hourlyPeriods[hour] = period;
            }
            // Handle partial end hour
            if (period.end % 1 !== 0) {
                hourlyPeriods[endHour] = period;
            }
        }
    });
    
    // Convert hourly periods to segments
    let currentPeriod = null;
    let segmentStart = 0;
    
    for (let hour = 0; hour <= 24; hour++) {
        const periodAtHour = hour === 24 ? null : hourlyPeriods[hour];
        
        if (periodAtHour !== currentPeriod) {
            // Period changed, close current segment
            if (currentPeriod !== null) {
                segments.push({
                    startPercent: (segmentStart / 24) * 100,
                    endPercent: (hour / 24) * 100,
                    type: currentPeriod.type,
                    period: currentPeriod
                });
            }
            
            // Start new segment
            currentPeriod = periodAtHour;
            segmentStart = hour;
        }
    }
    
    return segments;
}

/**
 * Create solid HTML segments for timeline
 * @param {HTMLElement} timelineBar - The timeline bar element
 * @param {Array} segments - Timeline segments
 * @param {string} tooltipText - Text for the tooltip
 */
function createSolidTimelineSegments(timelineBar, segments, tooltipText = 'Hover over timeline to see time periods') {
    // Color mapping for period types
    const getColor = (type) => {
        switch (type) {
            case 'peak': return '#EF4444'; // var(--danger-red)
            case 'shoulder': return '#F59E0B'; // var(--warning-orange)
            case 'off-peak': return '#10B981'; // var(--success-green)
            default: return '#D1D5DB'; // var(--gray-300)
        }
    };
    
    segments.forEach(segment => {
        const segmentDiv = document.createElement('div');
        const width = segment.endPercent - segment.startPercent;
        
        segmentDiv.style.cssText = `
            width: ${width}%;
            height: 100%;
            background-color: ${getColor(segment.type)};
            display: inline-block;
            vertical-align: top;
        `;
        
        // Store segment data for hover interactions
        segmentDiv.dataset.segmentType = segment.type;
        segmentDiv.dataset.startPercent = segment.startPercent;
        segmentDiv.dataset.endPercent = segment.endPercent;
        
        // Store the period information for tooltips
        if (segment.period) {
            segmentDiv.dataset.periodLabel = segment.period.label;
            segmentDiv.dataset.periodDisplayLabel = segment.period.displayLabel;
        }
        
        timelineBar.appendChild(segmentDiv);
    });
    
    // Re-create tooltip element after adding segments
    const newTooltip = document.createElement('div');
    newTooltip.className = 'timeline-tooltip';
    newTooltip.textContent = tooltipText;
    newTooltip.style.cssText = `
        position: absolute;
        top: 25px;
        left: 10px;
        background: red;
        color: white;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        white-space: nowrap;
        pointer-events: none;
        z-index: 9999;
        display: none;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        border: 2px solid yellow;
    `;
    
    timelineBar.appendChild(newTooltip);
    
    console.log('Created new tooltip:', newTooltip, 'parent:', newTooltip.parentNode);
    
    return newTooltip;
}

/**
 * Setup hover interactions for solid timeline segments
 * @param {HTMLElement} timelineBar - The timeline bar element
 * @param {HTMLElement} tooltip - The tooltip element
 * @param {Array} timePeriods - Parsed time periods
 */
function setupSolidTimelineHover(timelineBar, tooltip, timePeriods) {
    console.log('Setting up solid timeline hover on:', timelineBar, 'with tooltip:', tooltip);
    console.log('Timeline bar children:', timelineBar.children.length);
    
    // Debug: Check if segments exist
    Array.from(timelineBar.children).forEach((child, i) => {
        console.log(`Segment ${i}:`, child, 'dataset:', child.dataset);
    });
    
    // Add event listeners to each segment
    timelineBar.addEventListener('mouseover', function(e) {
        console.log('Mouse over event on:', e.target, 'dataset:', e.target.dataset);
        const segment = e.target;
        if (segment.dataset && segment.dataset.segmentType) {
            const startPercent = parseFloat(segment.dataset.startPercent);
            const endPercent = parseFloat(segment.dataset.endPercent);
            
            // Convert percentages to time
            const startHour = (startPercent / 100) * 24;
            const endHour = (endPercent / 100) * 24;
            
            const startTime = formatTimeForDisplay(Math.floor(startHour), Math.floor((startHour % 1) * 60));
            const endTime = formatTimeForDisplay(Math.floor(endHour), Math.floor((endHour % 1) * 60));
            
            // Get period name
            const periodType = segment.dataset.segmentType;
            const periodName = periodType.charAt(0).toUpperCase() + periodType.slice(1).replace('-', '-');
            
            // Show tooltip with period duration
            tooltip.textContent = `${periodName}: ${startTime}-${endTime}`;
            tooltip.style.display = 'block';
            tooltip.style.visibility = 'visible';
            console.log('Showing tooltip:', tooltip.textContent, 'element:', tooltip);
            console.log('Tooltip styles:', tooltip.style.cssText);
        }
    });
    
    timelineBar.addEventListener('mouseleave', function() {
        tooltip.textContent = 'Hover over timeline to see time periods';
        tooltip.style.display = 'none';
        console.log('Hiding tooltip');
    });
    
    // Also handle mouse movement within segments for more precise time display
    timelineBar.addEventListener('mousemove', function(e) {
        const segment = e.target;
        if (segment.dataset.segmentType) {
            const rect = segment.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const segmentPercentage = (x / rect.width) * 100;
            
            const startPercent = parseFloat(segment.dataset.startPercent);
            const endPercent = parseFloat(segment.dataset.endPercent);
            
            // Calculate current time within this segment
            const currentPercentInTimeline = startPercent + ((endPercent - startPercent) * (segmentPercentage / 100));
            const currentHour = (currentPercentInTimeline / 100) * 24;
            const currentTime = formatTimeForDisplay(Math.floor(currentHour), Math.floor((currentHour % 1) * 60));
            
            // Convert segment boundaries to time
            const startHour = (startPercent / 100) * 24;
            const endHour = (endPercent / 100) * 24;
            const startTime = formatTimeForDisplay(Math.floor(startHour), Math.floor((startHour % 1) * 60));
            const endTime = formatTimeForDisplay(Math.floor(endHour), Math.floor((endHour % 1) * 60));
            
            // Get period name
            const periodType = segment.dataset.segmentType;
            const periodName = periodType.charAt(0).toUpperCase() + periodType.slice(1).replace('-', '-');
            
            // Show current time and period duration
            tooltip.textContent = `${currentTime} | ${periodName}: ${startTime}-${endTime}`;
            tooltip.style.display = 'block';
            
            // Position tooltip near mouse
            const timelineRect = timelineBar.getBoundingClientRect();
            const mouseX = e.clientX - timelineRect.left;
            tooltip.style.left = Math.min(mouseX, timelineRect.width - tooltip.offsetWidth) + 'px';
        }
    });
}

/**
 * Convert timeline percentage to time information using actual plan data
 * @param {number} percentage - Position percentage on timeline
 * @param {Array} timePeriods - Time periods from plan data
 * @returns {string} Time information with actual periods and rates
 */
function getTimeFromPercentageEnhanced(percentage, timePeriods) {
    // Validate inputs
    if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        console.warn('Invalid percentage:', percentage);
        return 'Invalid time';
    }
    
    const hour = (percentage / 100) * 24;
    const hourFormatted = Math.floor(hour);
    const minute = Math.floor((hour - hourFormatted) * 60);
    
    // Validate calculated values
    if (isNaN(hour) || isNaN(hourFormatted) || isNaN(minute)) {
        console.warn('Invalid time calculation:', { percentage, hour, hourFormatted, minute });
        return 'Invalid time';
    }
    
    // Format current time
    const currentTime = formatTimeForDisplay(hourFormatted, minute);
    
    // Check if we have valid time periods data
    if (!timePeriods || !Array.isArray(timePeriods) || timePeriods.length === 0) {
        // Fallback to default periods if no plan-specific data
        return getTimeFromPercentageDefault(percentage, currentTime);
    }
    
    // Find which period this time falls into
    const currentPeriod = findPeriodForTime(hour, timePeriods);
    
    if (currentPeriod && currentPeriod.displayLabel) {
        return `${currentTime} | ${currentPeriod.displayLabel}`;
    }
    
    // Fallback to default periods if no matching period found
    return getTimeFromPercentageDefault(percentage, currentTime);
}

/**
 * Find which time period a given hour falls into
 * @param {number} hour - Hour (0-24)
 * @param {Array} timePeriods - Array of time periods
 * @returns {Object|null} Matching time period
 */
function findPeriodForTime(hour, timePeriods) {
    return timePeriods.find(period => {
        if (period.start <= period.end) {
            // Normal period within same day
            return hour >= period.start && hour < period.end;
        } else {
            // Midnight-crossing period (e.g., 22:00 to 06:00)
            return hour >= period.start || hour < period.end;
        }
    });
}

/**
 * Default timeline percentage to time conversion (fallback)
 * @param {number} percentage - Position percentage on timeline
 * @param {string} currentTime - Formatted current time
 * @returns {string} Time information
 */
function getTimeFromPercentageDefault(percentage, currentTime) {
    let rateInfo = '';
    let fullPeriod = '';
    
    // Default SA TOU periods based on CSS gradient percentages
    if (percentage < 29.2) {
        rateInfo = 'Off-Peak';
        fullPeriod = 'Off-Peak: 12am-7am';
    } else if (percentage < 37.5) {
        rateInfo = 'Shoulder';
        fullPeriod = 'Shoulder: 7am-9am';
    } else if (percentage < 66.7) {
        rateInfo = 'Off-Peak';
        fullPeriod = 'Off-Peak: 9am-4pm';
    } else if (percentage < 87.5) {
        rateInfo = 'Peak';
        fullPeriod = 'Peak: 4pm-9pm';
    } else if (percentage < 91.7) {
        rateInfo = 'Shoulder';
        fullPeriod = 'Shoulder: 9pm-10pm';
    } else {
        rateInfo = 'Off-Peak';
        fullPeriod = 'Off-Peak: 10pm-12am';
    }
    
    return `${currentTime} | ${fullPeriod}`;
}

/**
 * Format time for display (e.g., 6, 0 -> "6am", 15, 30 -> "3:30pm")
 * @param {number} hour - Hour (0-23)
 * @param {number} minute - Minute (0-59)
 * @returns {string} Formatted time string
 */
function formatTimeForDisplay(hour, minute) {
    // Validate inputs
    if (isNaN(hour) || isNaN(minute)) {
        console.warn('Invalid time values:', { hour, minute });
        return 'Invalid time';
    }
    
    // Ensure values are within valid ranges
    hour = Math.max(0, Math.min(23, Math.floor(hour)));
    minute = Math.max(0, Math.min(59, Math.floor(minute)));
    
    const period = hour >= 12 ? 'pm' : 'am';
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    
    if (minute === 0) {
        return `${hour12}${period}`;
    } else {
        return `${hour12}:${minute.toString().padStart(2, '0')}${period}`;
    }
}

/**
 * Legacy function for backward compatibility
 * @param {number} percentage - Position percentage on timeline
 * @returns {string} Time information
 */
function getTimeFromPercentage(percentage, segments) {
    const hour = (percentage / 100) * 24;
    const hourFormatted = Math.floor(hour);
    const minute = Math.floor((hour - hourFormatted) * 60);
    const currentTime = formatTimeForDisplay(hourFormatted, minute);
    
    return getTimeFromPercentageDefault(percentage, currentTime);
}

/**
 * Test function to demonstrate dynamic timeline generation based on plan data
 * This function can be called from browser console to see different timeline patterns
 */
function testTimelinePatterns() {
    console.log('=== DYNAMIC TIMELINE GENERATION TEST ===');
    console.log('Testing timeline patterns...');
    
    // Test patterns
    const patterns = {
        default: {},
        business: { plan_name: 'Business Energy Plan' },
        industrial: { plan_name: 'Industrial Controlled Load' },
        demand: { plan_name: 'Critical Peak Demand Plan' },
        realExample: {
            detailed_time_blocks: [
                {
                    name: "Peak",
                    description: "06:00 - 10:00; 15:00 - 01:00",
                    time_of_use_period: "P",
                    rates: [{ unit_price_gst: 45.80 }]
                },
                {
                    name: "Off Peak", 
                    description: "01:00 - 06:00",
                    time_of_use_period: "OP",
                    rates: [{ unit_price_gst: 21.50 }]
                },
                {
                    name: "Shoulder",
                    description: "10:00 - 15:00", 
                    time_of_use_period: "S",
                    rates: [{ unit_price_gst: 32.40 }]
                }
            ]
        }
    };
    
    Object.entries(patterns).forEach(([name, planData]) => {
        console.log(`\n=== ${name.toUpperCase()} PATTERN ===`);
        const periods = parseTimePeriods(planData);
        const segments = generateTimelineSegments(periods);
        
        console.log('Periods:', periods);
        console.log('Generated segments:', segments);
        
        // Test midnight crossing detection
        const midnightCrossing = segments.filter(s => s.crossesMidnight);
        if (midnightCrossing.length > 0) {
            console.log('✓ Midnight-crossing periods handled:', midnightCrossing.length / 2, 'periods');
        } else {
            console.log('○ No midnight-crossing periods');
        }
        
        // Test tooltip examples for this pattern
        // Test dynamic timeline generation
        const timelineSegments = createTimelineSegments(periods);
        console.log('Timeline segments:', timelineSegments.length);
        timelineSegments.forEach((seg, i) => {
            console.log(`  ${i+1}. ${seg.type}: ${seg.startPercent.toFixed(1)}%-${seg.endPercent.toFixed(1)}%`);
        });
        
        console.log('Tooltip examples:');
        [25, 50, 75].forEach(percent => {
            const tooltipText = getTimeFromPercentageEnhanced(percent, periods);
            console.log(`  ${percent}% -> "${tooltipText}"`);
        });
    });
    
    console.log('\nTest complete. Check plan cards in UI to see visual results.');
    console.log('\n=== DESCRIPTION PARSING EXAMPLES ===');
    // Test description parsing
    const testDescriptions = [
        { desc: "06:00 - 10:00; 15:00 - 01:00", name: "Peak", type: "P" },
        { desc: "01:00 - 06:00", name: "Off Peak", type: "OP" },
        { desc: "10:00 - 15:00", name: "Shoulder", type: "S" },
        { desc: "22:30 - 05:30", name: "Controlled Load", type: "OP" }
    ];
    
    testDescriptions.forEach(test => {
        const block = {
            name: test.name,
            description: test.desc,
            time_of_use_period: test.type,
            rates: [{ unit_price_gst: 35.50 }]
        };
        const parsed = parseTimeDescription(test.desc, block);
        console.log(`"${test.desc}" -> ${parsed.length} periods:`);
        parsed.forEach(p => console.log(`  ${p.displayLabel}`));
    });
    
    console.log('\nTo test tooltips:');
    console.log('1. Hover over any timeline bar in the plan cards');
    console.log('2. Move mouse across the timeline to see different periods');
    console.log('3. Tooltips now use actual plan description data');
    console.log('4. Example: "4:57pm | Peak: 3pm-1am"');
}

// Make test function available globally for console testing
if (typeof window !== 'undefined') {
    window.testTimelinePatterns = testTimelinePatterns;
}

/**
 * Update the results title based on selected persona
 * @param {string} personaKey - Current persona selection
 */
function updateResultsTitle(personaKey) {
    const resultsTitle = document.getElementById('results-title');
    const personaInfo = getPersonaDisplayInfo(personaKey);
    resultsTitle.textContent = `For a ${personaInfo.name}`;
}

/**
 * Show loading state
 */
function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('results-section').style.display = 'none';
}

/**
 * Hide loading state and show results
 */
function hideLoading() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('results-section').style.display = 'block';
}

/**
 * Update persona button states
 * @param {string} activePersonaKey - Currently active persona
 */
function updatePersonaButtons(activePersonaKey) {
    const personaButtons = document.querySelectorAll('.btn-persona');
    personaButtons.forEach(button => {
        const personaKey = button.getAttribute('data-persona');
        if (personaKey === activePersonaKey) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

/**
 * Initialize customization form with persona defaults
 * @param {string} personaKey - Current persona selection
 */
function initializeCustomizationForm(personaKey) {
    const persona = getPersonaConfig(personaKey);
    
    // Set form values
    document.getElementById('quarterly-consumption').value = persona.quarterlyConsumption;
    document.getElementById('peak-percent').value = persona.peakPercent;
    document.getElementById('shoulder-percent').value = persona.shoulderPercent;
    document.getElementById('offpeak-percent').value = persona.offPeakPercent;
    
    // Update display values
    document.getElementById('peak-value').textContent = persona.peakPercent + '%';
    document.getElementById('shoulder-value').textContent = persona.shoulderPercent + '%';
    document.getElementById('offpeak-value').textContent = persona.offPeakPercent + '%';
    
    // Solar options
    const solarOptions = document.getElementById('solar-options');
    if (personaHasSolar(personaKey)) {
        solarOptions.style.display = 'block';
        document.getElementById('solar-export').value = persona.solarExport;
    } else {
        solarOptions.style.display = 'none';
    }
}

/**
 * Setup form event listeners for real-time updates
 */
function setupFormEventListeners() {
    // Range input updates with auto-adjustment for percentage sliders
    const percentageInputs = ['peak-percent', 'shoulder-percent', 'offpeak-percent'];
    percentageInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        const valueDisplay = document.getElementById(inputId.replace('-percent', '-value'));
        
        input.addEventListener('input', function() {
            valueDisplay.textContent = this.value + '%';
            adjustOtherPercentages(inputId);
            validatePercentages();
        });
    });
    
    // Solar export input validation
    const solarExportInput = document.getElementById('solar-export');
    if (solarExportInput) {
        solarExportInput.addEventListener('input', function() {
            const value = parseInt(this.value);
            if (value < 0) this.value = 0;
            if (value > 5000) this.value = 5000; // Reasonable maximum
        });
    }
    
    // Consumption input validation
    document.getElementById('quarterly-consumption').addEventListener('input', function() {
        const value = parseInt(this.value);
        if (value < 0) this.value = 0;
        if (value > 10000) this.value = 10000;
    });
    
}

/**
 * Automatically adjust other percentage sliders to maintain 100% total
 * @param {string} changedInputId - The ID of the slider that was changed
 */
function adjustOtherPercentages(changedInputId) {
    const peakInput = document.getElementById('peak-percent');
    const shoulderInput = document.getElementById('shoulder-percent');
    const offpeakInput = document.getElementById('offpeak-percent');
    
    const peakValue = parseInt(peakInput.value);
    const shoulderValue = parseInt(shoulderInput.value);
    const offpeakValue = parseInt(offpeakInput.value);
    
    const changedValue = parseInt(document.getElementById(changedInputId).value);
    
    // Calculate remaining percentage to distribute
    const remaining = 100 - changedValue;
    
    // Identify which two sliders to adjust
    let otherInputs = [];
    let otherValues = [];
    
    if (changedInputId === 'peak-percent') {
        otherInputs = [shoulderInput, offpeakInput];
        otherValues = [shoulderValue, offpeakValue];
    } else if (changedInputId === 'shoulder-percent') {
        otherInputs = [peakInput, offpeakInput];
        otherValues = [peakValue, offpeakValue];
    } else { // offpeak-percent
        otherInputs = [peakInput, shoulderInput];
        otherValues = [peakValue, shoulderValue];
    }
    
    // Get current sum of the two other sliders
    const otherSum = otherValues[0] + otherValues[1];
    
    if (otherSum > 0) {
        // Proportionally distribute the remaining percentage
        const ratio1 = otherValues[0] / otherSum;
        const ratio2 = otherValues[1] / otherSum;
        
        const newValue1 = Math.round(remaining * ratio1);
        const newValue2 = remaining - newValue1; // Ensure exact 100% total
        
        // Update the sliders and their display values
        otherInputs[0].value = Math.max(0, Math.min(100, newValue1));
        otherInputs[1].value = Math.max(0, Math.min(100, newValue2));
        
        // Update display values
        document.getElementById(otherInputs[0].id.replace('-percent', '-value')).textContent = otherInputs[0].value + '%';
        document.getElementById(otherInputs[1].id.replace('-percent', '-value')).textContent = otherInputs[1].value + '%';
    } else {
        // If both other sliders are at 0, distribute remaining equally
        const equalShare = Math.floor(remaining / 2);
        const remainder = remaining - (equalShare * 2);
        
        otherInputs[0].value = equalShare + remainder;
        otherInputs[1].value = equalShare;
        
        // Update display values
        document.getElementById(otherInputs[0].id.replace('-percent', '-value')).textContent = otherInputs[0].value + '%';
        document.getElementById(otherInputs[1].id.replace('-percent', '-value')).textContent = otherInputs[1].value + '%';
    }
}

/**
 * Validate that percentages add up to 100%
 */
function validatePercentages() {
    const peak = parseInt(document.getElementById('peak-percent').value);
    const shoulder = parseInt(document.getElementById('shoulder-percent').value);
    const offpeak = parseInt(document.getElementById('offpeak-percent').value);
    
    const total = peak + shoulder + offpeak;
    const warning = document.getElementById('percentage-warning');
    const applyBtn = document.getElementById('apply-custom-btn');
    
    if (Math.abs(total - 100) > 0.1) {
        warning.style.display = 'block';
        applyBtn.disabled = true;
    } else {
        warning.style.display = 'none';
        applyBtn.disabled = false;
    }
}

/**
 * Get current form values as usage pattern object
 * @returns {Object} Usage pattern configuration
 */
function getFormUsagePattern() {
    return {
        quarterlyConsumption: parseInt(document.getElementById('quarterly-consumption').value),
        peakPercent: parseInt(document.getElementById('peak-percent').value),
        shoulderPercent: parseInt(document.getElementById('shoulder-percent').value),
        offPeakPercent: parseInt(document.getElementById('offpeak-percent').value),
        solarExport: parseInt(document.getElementById('solar-export').value) || 0
    };
}

/**
 * Show error message to user
 * @param {string} message - Error message to display
 */
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger alert-dismissible fade show';
    errorDiv.innerHTML = `
        <strong>Error:</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.querySelector('.container').prepend(errorDiv);
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Make showError immediately available globally
if (typeof window !== 'undefined') {
    window.showError = showError;
}

/**
 * Show success message to user
 * @param {string} message - Success message to display
 */
function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'alert alert-success alert-dismissible fade show';
    successDiv.innerHTML = `
        <strong>Success:</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.querySelector('.container').prepend(successDiv);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        successDiv.remove();
    }, 3000);
}

// Make showSuccess immediately available globally
if (typeof window !== 'undefined') {
    window.showSuccess = showSuccess;
}

/**
 * Create visual timeline representation
 * This is a simplified version - can be enhanced with actual time periods
 */
function createTimelineVisualization() {
    // Timeline is created via CSS gradient in the stylesheet
    // This function can be enhanced to show actual time periods
    // For now, the CSS handles the basic visualization
}

/**
 * Initialize all UI components
 */
function initializeUI() {
    setupFormEventListeners();
    
    // Initialize Bootstrap components
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Make initializeUI immediately available globally
if (typeof window !== 'undefined') {
    window.initializeUI = initializeUI;
}

// Export functions for use in other modules (Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        displayPlanCards,
        updateResultsTitle,
        showLoading,
        hideLoading,
        updatePersonaButtons,
        initializeCustomizationForm,
        getFormUsagePattern,
        showError,
        showSuccess,
        initializeUI
    };
}

// Make functions globally available for browser use
if (typeof window !== 'undefined') {
    window.displayPlanCards = displayPlanCards;
    window.updateResultsTitle = updateResultsTitle;
    window.showLoading = showLoading;
    window.hideLoading = hideLoading;
    window.updatePersonaButtons = updatePersonaButtons;
    window.initializeCustomizationForm = initializeCustomizationForm;
    window.getFormUsagePattern = getFormUsagePattern;
    window.showError = showError;
    window.showSuccess = showSuccess;
    window.initializeUI = initializeUI;
}