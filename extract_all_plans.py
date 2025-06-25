#!/usr/bin/env python3
"""
Energy Plan Data Extraction Script
Extracts ALL energy plans from SA government API with NO filtering
Saves complete dataset to JSON for frontend consumption
"""

import json
import logging
import requests
import time
import random
from typing import Dict, List, Any, Optional

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Constants
GST_TAX = 1.10
POSTCODE = "5097"
API_URL = "https://api.energymadeeasy.gov.au/consumerplan/plans"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*"
}

# Proxy configuration
PROXIES = [
    {"http": "http://192.168.1.50:8080", "https": "http://192.168.1.50:8080"},
    {"http": "http://192.168.1.50:8082", "https": "http://192.168.1.50:8082"}
]

# Global proxy counter for rotation
proxy_counter = 0

FEE_DESCRIPTIONS = {
    "ConnF": "Move In New Connection Fee",
    "PBF": "Paper Bill Fee", 
    "PPF": "Payment Processing Fee",
    "LPF": "Late Payment Fee",
    "DiscoFMO": "Disconnection Fee (Move Out)",
    "DiscoFNP": "Disconnection Fee (Non-Payment)",
    "RecoF": "Reconnection Fee",
    "OF": "Other Fee",
    "CCF": "Credit Card Payment Fee"
}

PAYMENT_OPTIONS_DESCRIPTIONS = {
    "DD": "Direct Debit",
    "CC": "Credit Card",
    "P": "PayPal",
    "BP": "BPay",
    "CP": "Centrepay"
}


def get_all_plans(postcode: str) -> List[Dict[str, Any]]:
    """Fetch all plans from the API with no filtering."""
    params = {
        "usageDataSource": "noUsageFrontier",
        "customerType": "R",
        "distE": "",
        "distG": "",
        "fuelType": "E",
        "journey": "E",
        "postcode": postcode
    }

    try:
        response = requests.get(API_URL, headers=HEADERS, params=params, timeout=30)
        response.raise_for_status()
        data = response.json()
        plans = data.get("data", {}).get("plans", [])
        logger.info(f"Successfully retrieved {len(plans)} plans for postcode {postcode}")
        return plans
    except requests.RequestException as e:
        logger.error(f"Request failed: {e}")
        return []
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error: {e}")
        return []


def get_next_proxy() -> Dict[str, str]:
    """Get the next proxy in rotation."""
    global proxy_counter
    proxy = PROXIES[proxy_counter % len(PROXIES)]
    proxy_counter += 1
    return proxy

def get_detailed_plan_data(plan_id: str, postcode: str) -> Optional[Dict[str, Any]]:
    """Fetch detailed plan data including time blocks from individual plan API with proxy rotation."""
    detailed_url = f"https://api.energymadeeasy.gov.au/consumerplan/plan/{plan_id}?postcode={postcode}"
    
    # Get next proxy in rotation
    proxy = get_next_proxy()
    proxy_host = proxy["http"].replace("http://", "")
    
    try:
        logger.info(f"Fetching {plan_id} via proxy {proxy_host}")
        response = requests.get(detailed_url, headers=HEADERS, proxies=proxy, timeout=30)
        response.raise_for_status()
        logger.debug(f"✅ Successfully fetched {plan_id} via proxy {proxy_host}")
        return response.json()
    except requests.RequestException as e:
        logger.error(f"❌ Failed to fetch detailed data for plan {plan_id} via proxy {proxy_host}: {e}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"❌ JSON decode error for plan {plan_id}: {e}")
        return None


def extract_fees_and_solar(plan: Dict[str, Any]) -> tuple[Dict[str, Any], Optional[float]]:
    """Extract all fees and solar feed-in rate from a plan."""
    fees = {
        "move_in_new_connection_fee": None,
        "paper_bill_fee": None,
        "payment_processing_fees": [],
        "late_payment_fee": None,
        "disconnection_fee_move_out": None,
        "disconnection_fee_non_payment": None,
        "reconnection_fee": None,
        "other_fees": [],
        "credit_card_payment_fees": []
    }
    solar_feed_in_rate_r = None

    try:
        contracts = plan.get("planData", {}).get("contract", [])
        for contract in contracts:
            # Extract fees
            for fee in contract.get("fee", []):
                fee_type = fee.get("feeType")
                if fee_type == "ConnF":
                    fees["move_in_new_connection_fee"] = fee.get("amount", 0)
                elif fee_type == "PBF":
                    fees["paper_bill_fee"] = fee.get("amount", 0)
                elif fee_type == "PPF":
                    fees["payment_processing_fees"].append(fee)
                elif fee_type == "LPF":
                    fees["late_payment_fee"] = fee.get("amount", 0)
                elif fee_type == "DiscoFMO":
                    fees["disconnection_fee_move_out"] = fee.get("amount", 0)
                elif fee_type == "DiscoFNP":
                    fees["disconnection_fee_non_payment"] = fee.get("amount", 0)
                elif fee_type == "RecoF":
                    fees["reconnection_fee"] = fee.get("amount", 0)
                elif fee_type == "OF":
                    fees["other_fees"].append(fee)
                elif fee_type == "CCF":
                    fees["credit_card_payment_fees"].append(fee)

            # Extract solar feed-in rate
            for solar_fit in contract.get("solarFit", []):
                if solar_fit.get("type") == "R":
                    solar_feed_in_rate_r = solar_fit.get("rate")
    except (KeyError, TypeError) as e:
        logger.error(f"Error extracting fees and solar for plan {plan.get('planId', 'unknown')}: {e}")

    # Clean up fees - remove zero values and empty arrays
    try:
        for key in list(fees.keys()):
            if isinstance(fees[key], list):
                fees[key] = [fee for fee in fees[key] if (fee.get("amount", fee.get("percent", 0)) > 0)]
            elif fees[key] == 0:
                fees[key] = None
    except (KeyError, TypeError) as e:
        logger.error(f"Error cleaning up fees: {e}")

    return fees, solar_feed_in_rate_r


def extract_detailed_tariff_periods(detailed_plan_data: Dict[str, Any]) -> Dict[str, Any]:
    """Extract detailed tariff periods with time blocks and daily supply charge from detailed API."""
    tariff_blocks = []
    daily_supply_charge = None

    try:
        # Extract from detailed plan data structure
        plan_data = detailed_plan_data.get("data", {}).get("planData", {})
        contracts = plan_data.get("contract", [])
        
        for contract in contracts:
            for period in contract.get("tariffPeriod", []):
                try:
                    daily_supply_charge = period.get("dailySupplyCharge", 0) * GST_TAX
                except (KeyError, TypeError) as e:
                    logger.debug(f"Error calculating daily supply charge: {e}")
                
                for block in period.get("touBlock", []):
                    block_data = {
                        "name": block.get("name", "Unknown"),
                        "description": block.get("description", ""),
                        "time_of_use_period": block.get("timeOfUsePeriod", ""),
                        "time_periods": [],
                        "rates": []
                    }
                    
                    # Extract time periods
                    for time_period in block.get("timeOfUse", []):
                        time_data = {
                            "days": time_period.get("days", ""),
                            "start_time": time_period.get("startTime", ""),
                            "end_time": time_period.get("endTime", "")
                        }
                        block_data["time_periods"].append(time_data)
                    
                    # Extract rates
                    for rate in block.get("blockRate", []):
                        try:
                            rate_data = {
                                "unit_price": rate["unitPrice"],
                                "unit_price_gst": rate["unitPrice"] * GST_TAX,
                                "measure_unit": rate.get("measureUnit", "KWH"),
                                "rate_type": rate.get("rateType"),
                                "start_usage": rate.get("startUsage", 0),
                                "end_usage": rate.get("endUsage")
                            }
                            block_data["rates"].append(rate_data)
                        except (KeyError, TypeError) as e:
                            logger.debug(f"Error processing rate: {e}")
                    
                    if block_data["rates"]:  # Only add blocks with valid rates
                        tariff_blocks.append(block_data)
                        
    except (KeyError, TypeError) as e:
        logger.error(f"Error extracting detailed tariff periods: {e}")

    # Create simplified peak/shoulder/off-peak mapping for backward compatibility
    simple_rates = {}
    if tariff_blocks:
        # Sort blocks by highest rate to determine peak/shoulder/off-peak
        rate_mapping = []
        for block in tariff_blocks:
            if block["rates"]:
                avg_rate = sum(r["unit_price_gst"] for r in block["rates"]) / len(block["rates"])
                rate_mapping.append((avg_rate, block["name"], block))
        
        rate_mapping.sort(reverse=True)  # Highest rates first
        
        if len(rate_mapping) >= 1:
            simple_rates["peak_cost"] = rate_mapping[0][0]
        if len(rate_mapping) >= 2:
            simple_rates["shoulder_cost"] = rate_mapping[1][0]
        if len(rate_mapping) >= 3:
            simple_rates["off_peak_cost"] = rate_mapping[2][0]

    return {
        **simple_rates,
        "daily_supply_charge": daily_supply_charge,
        "detailed_time_blocks": tariff_blocks
    }


def extract_payment_options(plan: Dict[str, Any]) -> List[str]:
    """Extract payment options from a plan."""
    payment_options = []
    try:
        contracts = plan.get("planData", {}).get("contract", [])
        for contract in contracts:
            for option in contract.get("paymentOption", []):
                payment_option = PAYMENT_OPTIONS_DESCRIPTIONS.get(option, option)
                if payment_option not in payment_options:
                    payment_options.append(payment_option)
    except (KeyError, TypeError) as e:
        logger.error(f"Error extracting payment options for plan {plan.get('planId', 'unknown')}: {e}")
    return payment_options


def get_no_discount_cost(plan: Dict[str, Any], usage_type: str = 'large') -> Dict[str, float]:
    """Extract cost estimates from plan."""
    try:
        costs = plan.get('pcr', {}).get('costs', {}).get('electricity', {}).get(usage_type, {})
        return {
            "monthly": costs.get('monthly', {}).get('noDiscounts', 0),
            "quarterly": costs.get('quarterly', {}).get('noDiscounts', 0),
            "yearly": costs.get('yearly', {}).get('noDiscounts', 0)
        }
    except (KeyError, TypeError) as e:
        logger.error(f"Error extracting costs for plan {plan.get('planId', 'unknown')}: {e}")
        return {"monthly": 0, "quarterly": 0, "yearly": 0}


def determine_plan_type(plan: Dict[str, Any]) -> str:
    """Determine if plan is TOU, SR, or other based on pricing model."""
    try:
        contracts = plan.get("planData", {}).get("contract", [])
        for contract in contracts:
            pricing_model = contract.get("pricingModel")
            if pricing_model in ["TOU", "SR"]:
                return pricing_model
        
        # Fallback: check tariff type
        tariff_type = plan.get("planData", {}).get("tariffType")
        if tariff_type:
            if "TOU" in tariff_type.upper():
                return "TOU"
            elif "SR" in tariff_type.upper() or "SINGLE" in tariff_type.upper():
                return "SR"
        
        return "UNKNOWN"
    except (KeyError, TypeError) as e:
        logger.error(f"Error determining plan type for plan {plan.get('planId', 'unknown')}: {e}")
        return "UNKNOWN"


def extract_single_plan(plan: Dict[str, Any], postcode: str) -> Dict[str, Any]:
    """Extract all relevant data from a single plan, including detailed time blocks."""
    try:
        plan_data = plan.get("planData", {})
        plan_id = plan.get("planId")
        
        # Get basic data from main API response
        costs = get_no_discount_cost(plan, 'large')
        fees, solar_feed_in_rate_r = extract_fees_and_solar(plan)
        payment_options = extract_payment_options(plan)
        plan_type = determine_plan_type(plan)
        
        # Add small delay to avoid overwhelming the API
        time.sleep(random.uniform(0.5, 1.5))
        
        # Fetch detailed data for time blocks
        detailed_data = get_detailed_plan_data(plan_id, postcode)
        
        if detailed_data:
            # Use detailed data for tariff information
            tariff_data = extract_detailed_tariff_periods(detailed_data)
        else:
            # Fallback to basic tariff data if detailed fetch fails
            logger.warning(f"Failed to fetch detailed data for {plan_id}, using basic tariff data")
            # Create a fallback function for basic tariff extraction
            tariff_data = extract_basic_tariff_periods(plan)

        return {
            "plan_id": plan_id,
            "plan_name": plan_data.get("planName"),
            "retailer_name": plan_data.get("retailerName"),
            "plan_type": plan_type,
            "tariff_type": plan_data.get("tariffType"),
            "monthly_cost": costs["monthly"],
            "quarterly_cost": costs["quarterly"],
            "annual_cost": costs["yearly"],
            "peak_cost": tariff_data.get("peak_cost"),
            "shoulder_cost": tariff_data.get("shoulder_cost"),
            "off_peak_cost": tariff_data.get("off_peak_cost"),
            "daily_supply_charge": tariff_data.get("daily_supply_charge"),
            "detailed_time_blocks": tariff_data.get("detailed_time_blocks", []),
            "fees": fees,
            "solar_feed_in_rate_r": solar_feed_in_rate_r,
            "payment_options": payment_options,
            # Include raw plan data for advanced filtering
            "raw_plan_data": {
                "eligibility_restrictions": any(
                    'eligibilityRestriction' in contract 
                    for contract in plan_data.get('contract', [])
                ),
                "has_discounts": any(
                    'discount' in contract 
                    for contract in plan_data.get('contract', [])
                ),
                "distributor": plan_data.get("distributor"),
                "state": plan_data.get("state"),
                "postcode": plan_data.get("postcode")
            }
        }
    except Exception as e:
        logger.error(f"Error extracting plan {plan.get('planId', 'unknown')}: {e}")
        return None


def extract_basic_tariff_periods(plan: Dict[str, Any]) -> Dict[str, Any]:
    """Fallback function to extract basic tariff data from main API response."""
    tariff_periods = []
    daily_supply_charge = None

    try:
        contracts = plan.get("planData", {}).get("contract", [])
        for contract in contracts:
            for period in contract.get("tariffPeriod", []):
                for block in period.get("touBlock", []):
                    for rate in block.get("blockRate", []):
                        try:
                            adjusted_rate = rate["unitPrice"] * GST_TAX
                            tariff_periods.append(adjusted_rate)
                        except (KeyError, TypeError) as e:
                            logger.debug(f"Error calculating adjusted rate: {e}")
                            continue
                try:
                    daily_supply_charge = period.get("dailySupplyCharge", 0) * GST_TAX
                except (KeyError, TypeError) as e:
                    logger.debug(f"Error calculating daily supply charge: {e}")
    except (KeyError, TypeError) as e:
        logger.error(f"Error extracting basic tariff periods: {e}")

    # Sort tariff periods from highest to lowest
    peak = shoulder = off_peak = None
    if tariff_periods:
        tariff_periods.sort(reverse=True)
        peak = tariff_periods[0] if len(tariff_periods) > 0 else None
        shoulder = tariff_periods[1] if len(tariff_periods) > 1 else None
        off_peak = tariff_periods[2] if len(tariff_periods) > 2 else None

    return {
        "peak_cost": peak,
        "shoulder_cost": shoulder,
        "off_peak_cost": off_peak,
        "daily_supply_charge": daily_supply_charge,
        "detailed_time_blocks": []
    }


def extract_all_plans_data(postcode: str) -> Dict[str, List[Dict[str, Any]]]:
    """Extract ALL TOU plans with minimal filtering - exclude only SR, SRCL, TOUCL."""
    all_plans = get_all_plans(postcode)
    logger.info(f"Processing {len(all_plans)} plans...")
    
    extracted_plans = []
    filtered_out = 0
    errors = 0
    
    for plan in all_plans:
        # Filter out SR, SRCL, TOUCL tariff types as requested
        tariff_type = plan.get("planData", {}).get("tariffType", "")
        if tariff_type in ["SR", "SRCL", "TOUCL"]:
            filtered_out += 1
            continue
            
        extracted_plan = extract_single_plan(plan, postcode)
        if extracted_plan:
            extracted_plans.append(extracted_plan)
        else:
            errors += 1
    
    logger.info(f"Successfully extracted {len(extracted_plans)} plans, filtered out {filtered_out} (SR/SRCL/TOUCL), {errors} errors")
    
    # Group by plan type for easier frontend consumption
    grouped_plans = {
        "TOU": [p for p in extracted_plans if p["plan_type"] == "TOU"],
        "SR": [p for p in extracted_plans if p["plan_type"] == "SR"],
        "OTHER": [p for p in extracted_plans if p["plan_type"] not in ["TOU", "SR"]]
    }
    
    logger.info(f"Plan breakdown: {len(grouped_plans['TOU'])} TOU, {len(grouped_plans['SR'])} SR, {len(grouped_plans['OTHER'])} Other")
    
    return {
        "metadata": {
            "postcode": postcode,
            "total_plans": len(extracted_plans),
            "filtered_out": filtered_out,
            "extraction_date": "2025-06-25",
            "tou_count": len(grouped_plans['TOU']),
            "sr_count": len(grouped_plans['SR']),
            "other_count": len(grouped_plans['OTHER']),
            "filters_applied": "Excluded tariff types: SR, SRCL, TOUCL"
        },
        "plans": grouped_plans
    }


def main():
    """Main execution function."""
    logger.info(f"Starting energy plans extraction for postcode {POSTCODE}")
    
    plans_data = extract_all_plans_data(POSTCODE)
    
    # Save to JSON file
    output_file = "all_energy_plans.json"
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(plans_data, f, indent=2, ensure_ascii=False)
        logger.info(f"Successfully saved {plans_data['metadata']['total_plans']} plans to {output_file}")
        
        # Print summary
        print(f"\n=== Energy Plans Extraction Complete ===")
        print(f"Total plans extracted: {plans_data['metadata']['total_plans']}")
        print(f"TOU plans: {plans_data['metadata']['tou_count']}")
        print(f"SR plans: {plans_data['metadata']['sr_count']}")
        print(f"Other plans: {plans_data['metadata']['other_count']}")
        print(f"Data saved to: {output_file}")
        
    except IOError as e:
        logger.error(f"Error saving to file: {e}")


if __name__ == "__main__":
    main()