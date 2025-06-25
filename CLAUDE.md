# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an energy plan recommendation system for South Australia that helps users find the best Time of Use (TOU) electricity plans based on their usage patterns, solar panel presence, and consumption profiles.

### Key Features
- Scrapes energy plan data from South Australia government API
- Focuses on TOU plans (excludes "TOUCL", "SRCL", "SR" types)
- Provides personalized recommendations based on user's quarterly consumption patterns
- Considers solar panel presence and export rates
- Supports different user personas (work from home with/without solar, away during solar hours)
- Hosted on GitHub Pages at energy.nazmy.io

### Target Deployment
- **Platform**: GitHub Pages (static hosting)
- **Domain**: energy.nazmy.io
- **Constraints**: Must work as a static site (client-side only)

## Data Sources

### Energy Plans API
- **URL**: `https://api.energymadeeasy.gov.au/consumerplan/plans`
- **Method**: GET requests with postcode parameter
- **Focus**: TOU (Time of Use) plans for residential customers
- **Data Format**: JSON response containing plan details, tariffs, fees, and solar feed-in rates

### Required User Inputs
- Quarterly consumption (kWh)
- Percentage breakdown: peak/shoulder/off-peak usage
- Solar panel presence and self-consumption percentage
- Solar generation amount (if applicable)
- Postcode (South Australia)

## Architecture Considerations

Since this must run on GitHub Pages:
- All data processing must be client-side (JavaScript)
- API calls must handle CORS (may need proxy or server-side component)
- Data should be cached/stored in CSV files for offline processing
- No server-side databases - use local storage or static data files

## Development Setup

**Note**: No build system is currently configured. When implementing:
- Choose a static site generator compatible with GitHub Pages (Jekyll, Hugo, or vanilla HTML/JS)
- Set up API data scraping to generate static CSV files
- Implement client-side recommendation engine
- Configure GitHub Pages deployment workflow

## Key Business Logic

### Plan Filtering
- Exclude plans with eligibility restrictions
- Remove plans with discount dependencies
- Filter out retailer blacklist
- Focus on TOU pricing models

### Cost Calculation
- Apply GST (10%) to all rates
- Extract peak/shoulder/off-peak rates
- Include daily supply charges and fees
- Factor in solar feed-in tariffs

### Cost Calculation Formula
Uses unified electricity bill calculation that works for both solar and non-solar households:

1. **Fixed Supply Charge**: `Supply Rate (c/day) × 91 days / 100`
2. **Solar Self-Consumed**: `Solar Generation × Self-Consumption %`
3. **Net Grid Consumption**: `Total Consumption - Solar Self-Consumed`
4. **Usage Charge**: Apply tariff rates to Net Grid Consumption
5. **Solar Export**: `Solar Generation - Solar Self-Consumed`
6. **Solar Credit**: `Solar Export × Feed-in Tariff / 100`
7. **Final Bill**: `Supply Charge + Usage Charge - Solar Credit`

### User Matching
- Calculate estimated costs using the unified formula above
- Consider different user personas (work from home, away during solar hours)
- Rank plans by total estimated quarterly cost
- Present top recommendations with detailed breakdowns