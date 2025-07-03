# Comprehensive Analysis of Eligibility Restrictions in Energy Plans

## Executive Summary

**Total Statistics:**
- **57 plans** have eligibility restrictions (out of 146 total TOU plans)
- **148 individual restrictions** found across all plans
- **9 different restriction types** identified

## Restriction Type Categories

### 1. **OC (Other Customer Requirements)** - 86 restrictions (58.1%)
**Description:** General customer qualification requirements  
**Impact:** Highest number of restrictions, affecting customer access

**Key Restriction Patterns:**
- **Membership Requirements:** Velocity, BP Rewards, Westpac customers, Everyday Rewards, NRMA
- **New Customer Only:** Plans restricting access to new customers or move-in customers
- **Channel Restrictions:** Plans only available through specific channels (3rd party, comparators, representatives)
- **Business Customers:** Home Business/SOHO customer restrictions
- **Communication Requirements:** Mandatory eBilling/eCommunications
- **Special Demographics:** Electric vehicle owners, Netflix customers
- **Age Requirements:** 18+ years old minimum

### 2. **PS (Promotional/Special)** - 20 restrictions (13.5%)
**Description:** Empty/null descriptions, likely promotional restrictions  
**Impact:** Unclear restrictions that may hide terms

### 3. **SP (Solar/Technical Requirements)** - 14 restrictions (9.5%)
**Description:** Solar panel system requirements  
**Impact:** Limits access for non-solar or specific solar customers

**Key Requirements:**
- Maximum inverter capacity (typically 10kW)
- No government feed-in tariff recipients
- Net metered systems required
- Eligible solar PV systems only

### 4. **SN (New Customer Only)** - 12 restrictions (8.1%)
**Description:** Strictly new customer offerings  
**Impact:** Excludes existing customers from switching

### 5. **SC (Seniors Card Requirements)** - 4 restrictions (2.7%)
**Description:** Seniors Card holders only  
**Impact:** Age-based discrimination, excludes younger customers

### 6. **SM (Smart Meter Requirements)** - 4 restrictions (2.7%)
**Description:** Smart meter infrastructure requirements  
**Impact:** Excludes properties without smart meters

### 7. **FF (Frequent Flyer Requirements)** - 4 restrictions (2.7%)
**Description:** Qantas Frequent Flyer membership requirements  
**Impact:** Limits access to airline program members

### 8. **CB (Battery Requirements)** - 2 restrictions (1.4%)
**Description:** Battery storage system requirements  
**Impact:** Limits access to customers with battery systems

### 9. **SO (Sign-up Method)** - 2 restrictions (1.4%)
**Description:** Online-only sign-up requirements  
**Impact:** Excludes customers preferring other channels

## Detailed Restriction Analysis

### Most Restrictive Categories to Filter Out:

#### **High Priority for Filtering:**
1. **Membership Programs (OC):** Velocity, BP Rewards, Westpac, Everyday Rewards, NRMA
2. **New Customer Only (SN + OC):** Excludes existing customers
3. **Channel Restrictions (OC):** 3rd party, comparator, representative only
4. **Special Demographics (OC):** Electric vehicle owners, Netflix customers
5. **Seniors Card (SC):** Age-based restrictions

#### **Medium Priority for Filtering:**
1. **Solar System Requirements (SP):** May exclude non-solar customers
2. **Smart Meter Requirements (SM):** Infrastructure dependencies
3. **Communication Requirements (OC):** Mandatory eBilling

#### **Consider Keeping:**
1. **Business Plans (OC):** Clear business vs residential distinction
2. **Moving House (OC):** Specific circumstance plans
3. **Frequent Flyer (FF):** Clear benefit programs

## Recommendations for Plan Filtering

### **Exclude Plans With These Restrictions:**
1. **OC Type:** Membership programs, new customer only, channel restrictions
2. **SN Type:** New customer only restrictions
3. **SC Type:** Seniors card requirements
4. **PS Type:** Unclear/empty restrictions (potential hidden terms)

### **Conditional Filtering (User Choice):**
1. **SP Type:** Filter based on user's solar status
2. **SM Type:** Filter based on user's meter type
3. **CB Type:** Filter based on user's battery status
4. **FF Type:** Filter based on user's membership

### **Keep (Generally Available):**
1. Plans with no restrictions
2. Plans with clear, non-exclusionary technical requirements
3. Plans with optional benefit programs user can join

## Business Impact

**Plans to Exclude from General Recommendations:** ~40-50 plans
- All membership-based plans (Velocity, BP, Westpac, etc.)
- All new customer only plans
- All channel-restricted plans
- All age-restricted plans

**Plans Requiring User Input:** ~15-20 plans
- Solar system requirements
- Smart meter requirements
- Battery system requirements

**Generally Available Plans:** ~85-95 plans
- No restrictions or only standard technical requirements

This analysis provides a comprehensive foundation for implementing intelligent plan filtering based on user eligibility and preferences.