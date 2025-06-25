# Energy Plan Recommendation System - Product Requirements Document

## Project Overview

This project provides energy plan recommendations to users based on:

- Usage patterns per time of day (peak, off-peak, shoulder timings) for Time of Use (TOU) plans in South Australia
- Presence of solar panels in the household and average amount of exported solar vs. solar tariff buy rate provided by each energy company
- Data scraped from government website to capture all plan data, focusing on TOU type plans (excluding "TOUCL", "SRCL" or "SR")
- Data saved in CSV format for user consumption analysis
- Website hosted on GitHub Pages under energy.nazmy.io

## User Requirements

### Input Data
The user is expected to provide:
- Quarterly consumption (kWh)
- Percentage of consumption that falls in shoulder, peak, off-peak periods
- Average solar export amount

### Output
The system responds with best plans fitting user usage pattern, considering personas such as:
- People working from home with solar
- People working from home without solar  
- People out of home during solar hours
- Other usage patterns

**Key Point**: The usage pattern of the user is the primary factor in recommendations.

## Technical Constraints

This system runs on GitHub Pages, so all implementation must account for static hosting limitations.

## Unified Electricity Bill Calculation Formula

By treating a household without solar as a special case of a household with solar (where solar generation is zero), we use a single, robust formula.

### Step 1: Define Your Inputs

| Variable | Description | House WITH Solar | House WITHOUT Solar |
|----------|-------------|------------------|---------------------|
| **Total Consumption** | Total kWh of electricity used by the household in the quarter | e.g., 1500 kWh | e.g., 1500 kWh |
| **Solar Generation** | Total kWh of electricity your solar panels generated in the quarter | e.g., 1500 kWh | 0 kWh |
| **Self-Consumption %** | The percentage of your generated solar power that you used directly | e.g., 30% | 0% |
| **Supply Rate** | The fixed daily charge for being connected to the grid (in c/day) | From your tariff | From your tariff |
| **Usage Rate(s)** | The rate(s) for electricity you buy from the grid (in c/kWh). This could be a single rate, block rates, or Time of Use (TOU) rates | From your tariff | From your tariff |
| **Feed-in Tariff (FiT)** | The credit rate for electricity you export to the grid (in c/kWh) | From your tariff | 0 c/kWh |

### Step 2: The Calculation Process

Follow these calculations in order:

#### 1. Calculate Fixed Supply Charge
This cost is independent of your usage or solar (assuming a 91-day quarter):

```
Supply Charge ($) = Supply Rate (c/day) × 91 / 100
```

#### 2. Determine Net Grid Consumption
First, calculate how much solar you used yourself, then determine the net amount of electricity you had to buy from the grid:

```
Solar Self-Consumed (kWh) = Solar Generation (kWh) × Self-Consumption %
Net Grid Consumption (kWh) = Total Consumption (kWh) - Solar Self-Consumed (kWh)
```

*(For non-solar homes, Solar Self-Consumed is 0, so Net Grid Consumption equals Total Consumption)*

#### 3. Calculate Usage Charge
Apply your plan's usage rate(s) to the Net Grid Consumption (kWh) calculated above:

```
Usage Charge ($) = Formula for your tariff structure applied to Net Grid Consumption
```

*(This could be a simple multiplication for a flat rate, or a more complex block/TOU calculation)*

#### 4. Calculate Solar Export Credit
First, calculate how much solar you exported, then find the credit value:

```
Solar Exported (kWh) = Solar Generation (kWh) - Solar Self-Consumed (kWh)
Solar Credit ($) = Solar Exported (kWh) × Feed-in Tariff (c/kWh) / 100
```

*(For non-solar homes, these values will both be 0)*

#### 5. Calculate Final Bill Amount
Combine the charges and credits for the final amount due:

```
Final Bill ($) = Supply Charge + Usage Charge - Solar Credit
```

### Example Application

This shows how the single formula applies to both scenarios:

| Calculation Step | Household WITH Solar | Household WITHOUT Solar |
|------------------|---------------------|------------------------|
| **Inputs** | Total Consumption: 1500 kWh<br>Solar Generation: 1500 kWh<br>Self-Consumption: 30%<br>FiT: 5 c/kWh | Total Consumption: 1500 kWh<br>Solar Generation: 0 kWh<br>Self-Consumption: 0%<br>FiT: 0 c/kWh |
| **1. Self-Consumed Solar** | 1500 × 0.30 = 450 kWh | 0 × 0 = 0 kWh |
| **2. Net Grid Consumption** | 1500 - 450 = 1050 kWh | 1500 - 0 = 1500 kWh |
| **3. Usage Charge** | Calculated based on 1050 kWh | Calculated based on 1500 kWh |
| **4. Solar Exported** | 1500 - 450 = 1050 kWh | 0 - 0 = 0 kWh |
| **5. Solar Credit** | (1050 × 5.0) / 100 = $52.50 | (0 × 0) / 100 = $0.00 |
| **6. Final Bill** | Supply + Usage (on 1050 kWh) - $52.50 | Supply + Usage (on 1500 kWh) - $0.00 |

## Reference Implementation Code

```python
import json
import logging
import requests

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(name)s - %(message)s")

# Log to file
file_handler = logging.FileHandler("chatbot.log")
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)

# Retailer blacklist
retailer_blacklist = []
gst_tax = 1.10

url = "https://api.energymadeeasy.gov.au/consumerplan/plans"
headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*"
}

def get_plans(postcode):
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
        response = requests.get(url, headers=headers, params=params)
        response.raise_for_status()
        plans = response.json().get("data", {}).get("plans", [])
        logger.info(f"Successfully retrieved plans for postcode {postcode}")
        return plans
    except requests.RequestException as e:
        logger.error(f"Request failed: {e}")
        return []

def has_eligibility_restriction(plan):
    for contract in plan['planData'].get('contract', []):
        if 'eligibilityRestriction' in contract:
            return True
    return False

def has_discount(plan):
    for contract in plan['planData'].get('contract', []):
        if 'discount' in contract:
            return True
    return False

def get_no_discount_cost(plan, usage_type):
    return {
        "monthly": plan['pcr']['costs']['electricity'][usage_type]['monthly']['noDiscounts'],
        "quarterly": plan['pcr']['costs']['electricity'][usage_type]['quarterly']['noDiscounts'],
        "yearly": plan['pcr']['costs']['electricity'][usage_type]['yearly']['noDiscounts']
    }

fee_descriptions = {
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

payment_options_descriptions = {
    "DD": "Direct Debit",
    "CC": "Credit Card",
    "P": "PayPal",
    "BP": "BPay",
    "CP": "Centrepay"
}

def extract_fees_and_solar(plan):
    fees = {
        "move_in_new_connection_fee": None,
        "paper_bill_fee": None,
        "payment_processing_fees": [],
        "late_payment_fee": None,
        "disconnection_fee_move_out": None,
        "disconnection_fee_non_payment": None,
        "reconnection_fee": None,
        "other_fees": [],
        "credit_card_payment_fees": [],
    }
    solar_feed_in_rate_r = None

    try:
        for contract in plan["planData"].get("contract", []):
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

            for solar_fit in contract.get("solarFit", []):
                if solar_fit["type"] == "R":
                    solar_feed_in_rate_r = solar_fit.get("rate")
    except (KeyError, TypeError) as e:
        logging.error(f"Error extracting fees and solar: {e}")

    try:
        for key in ["payment_processing_fees", "credit_card_payment_fees"]:
            if fees[key]:
                fees[key] = [
                    min(fees[key], key=lambda x: x.get("percent", x.get("amount", 0)))
                ]
    except (KeyError, TypeError, ValueError) as e:
        logging.error(f"Error processing payment fees: {e}")

    try:
        for key in list(fees.keys()):
            if isinstance(fees[key], list):
                fees[key] = [
                    fee
                    for fee in fees[key]
                    if fee.get("amount", fee.get("percent", 0)) > 0
                ]
            elif fees[key] == 0:
                fees[key] = None
    except (KeyError, TypeError) as e:
        logging.error(f"Error cleaning up fees: {e}")

    return fees, solar_feed_in_rate_r

def extract_tariff_periods(plan):
    tariff_periods = []
    daily_supply_charge = None
    try:
        for contract in plan["planData"].get("contract", []):
            for period in contract.get("tariffPeriod", []):
                for block in period.get("touBlock", []):
                    for rate in block.get("blockRate", []):
                        try:
                            adjusted_rate = rate["unitPrice"] * gst_tax
                        except (KeyError, TypeError) as e:
                            logger.error(f"Error calculating adjusted rate: {e}")
                            continue
                        tariff_periods.append(adjusted_rate)
                try:
                    daily_supply_charge = period.get("dailySupplyCharge", 0) * gst_tax
                except (KeyError, TypeError) as e:
                    logger.error(f"Error calculating daily supply charge: {e}")
    except (KeyError, TypeError) as e:
        logger.error(f"Error extracting tariff periods: {e}")
        return None, None, None, None

    if tariff_periods:
        tariff_periods.sort(reverse=True)
        peak = tariff_periods[0]
        shoulder = tariff_periods[1] if len(tariff_periods) > 1 else None
        off_peak = tariff_periods[2] if len(tariff_periods) > 2 else None
    else:
        peak = shoulder = off_peak = None
    return peak, shoulder, off_peak, daily_supply_charge

def extract_payment_options(plan):
    payment_options = []
    try:
        for contract in plan["planData"].get("contract", []):
            for option in contract.get("paymentOption", []):
                payment_option = payment_options_descriptions.get(option, option)
                payment_options.append(payment_option)
    except KeyError as e:
        logging.error(f"Error extracting payment options: {e}")
    except Exception as e:
        logging.error(f"Unexpected error extracting payment options: {e}")
    return payment_options

def filter_plans(plans):
    return [
        plan for plan in plans
        if plan['planData']['retailerName'] not in retailer_blacklist
        and not has_eligibility_restriction(plan)
        and not has_discount(plan)
        and plan['planData'].get('tariffType') not in ["TOUCL", "SRCL"]
    ]

def group_plans(filtered_plans):
    grouped_plans = {"TOU": [], "SR": []}
    for plan in filtered_plans:
        for contract in plan['planData'].get('contract', []):
            pricing_model = contract.get('pricingModel')
            if pricing_model == "TOU":
                grouped_plans["TOU"].append(plan)
            elif pricing_model == "SR":
                grouped_plans["SR"].append(plan)
    return grouped_plans

def get_cheapest_plans(grouped_plans, plan_type, usage_type='large', top_n=5):
    if grouped_plans[plan_type]:
        sorted_plans = sorted(grouped_plans[plan_type], key=lambda x: get_no_discount_cost(x, usage_type)['monthly'])
        return sorted_plans[:top_n]
    return []

def prep_sr_plans_message(plans_data, postcode):
    sr_plans = plans_data.get("SR", [])
    logger.info("Sending SR plans")

    message = f"\n⚡ Cheapest single-rate Plans for postcode {postcode} :⚡ \n"
    for plan in sr_plans:
        plan_message = f"Plan Name: {plan['plan_name']}\n"
        plan_message += f"  - Retailer Name: {plan['retailer_name']}\n"
        plan_message += f"  - Estimated Monthly Cost: ${plan['monthly_cost']}\n"
        plan_message += f"  - Estimated Quarterly Cost: ${plan['quarterly_cost']}\n"
        plan_message += f"  - Estimated Annual Cost: ${plan['annual_cost']}\n"
        if plan['peak_cost'] is not None:
            plan_message += f"  - Peak Usage Cost: {plan['peak_cost']:.2f} c/kWh\n"
        if plan['shoulder_cost'] is not None:
            plan_message += f"  - Shoulder Usage Cost: {plan['shoulder_cost']:.2f} c/kWh\n"
        if plan['off_peak_cost'] is not None:
            plan_message += f"  - Off-Peak Usage Cost: {plan['off_peak_cost']:.2f} c/kWh\n"
        if plan['daily_supply_charge'] is not None:
            plan_message += f"  - Daily Supply Charge: {plan['daily_supply_charge']:.2f} c/day\n"
        plan_message += "  - Fees:\n"
        for fee_type, fee_value in plan['fees'].items():
            if fee_value:
                if isinstance(fee_value, list):
                    for fee in fee_value:
                        fee_desc = fee_descriptions.get(fee['feeType'], fee['feeType'])
                        if fee['feeTerm'] == 'P':
                            plan_message += f"    - {fee_desc}: {fee['percent']}%\n"
                        else:
                            plan_message += f"    - {fee_desc}: ${fee.get('amount', 0)}\n"
                else:
                    fee_desc = fee_descriptions.get(fee_type, fee_type.replace('_', ' ').title())
                    plan_message += f"    - {fee_desc}: ${fee_value}\n"
        if plan['solar_feed_in_rate_r'] is not None:
            plan_message += f"    - Solar Feed-in Tariff Rate: {plan['solar_feed_in_rate_r']} c/kWh\n"
        if plan['payment_options']:
            plan_message += f"  - Payment Options: {', '.join(plan['payment_options'])}\n"

        message += plan_message + "\n"

    return message

def prep_tou_plans_message(plans_data, postcode):
    tou_plans = plans_data.get("TOU", [])
    logger.info("Sending multi-rate plans")

    message = f"\n⚡ Cheapest multi-rate Plans for postcode {postcode}: ⚡\n"
    for plan in tou_plans:
        plan_message = f"Plan Name: {plan['plan_name']}\n"
        plan_message += f"  - Retailer Name: {plan['retailer_name']}\n"
        plan_message += f"  - Estimated Monthly Cost: ${plan['monthly_cost']}\n"
        plan_message += f"  - Estimated Quarterly Cost: ${plan['quarterly_cost']}\n"
        plan_message += f"  - Estimated Annual Cost: ${plan['annual_cost']}\n"
        if plan['peak_cost'] is not None:
            plan_message += f"  - Peak Usage Cost: {plan['peak_cost']:.2f} c/kWh\n"
        if plan['shoulder_cost'] is not None:
            plan_message += f"  - Shoulder Usage Cost: {plan['shoulder_cost']:.2f} c/kWh\n"
        if plan['off_peak_cost'] is not None:
            plan_message += f"  - Off-Peak Usage Cost: {plan['off_peak_cost']:.2f} c/kWh\n"
        if plan['daily_supply_charge'] is not None:
            plan_message += f"  - Daily Supply Charge: {plan['daily_supply_charge']:.2f} c/day\n"
        plan_message += "  - Fees:\n"
        for fee_type, fee_value in plan['fees'].items():
            if fee_value:
                if isinstance(fee_value, list):
                    for fee in fee_value:
                        fee_desc = fee_descriptions.get(fee['feeType'], fee['feeType'])
                        if fee['feeTerm'] == 'P':
                            plan_message += f"    - {fee_desc}: {fee['percent']}%\n"
                        else:
                            plan_message += f"    - {fee_desc}: ${fee.get('amount', 0)}\n"
                else:
                    fee_desc = fee_descriptions.get(fee_type, fee_type.replace('_', ' ').title())
                    plan_message += f"    - {fee_desc}: ${fee_value}\n"
        if plan['solar_feed_in_rate_r'] is not None:
            plan_message += f"    - Solar Feed-in Tariff Rate: {plan['solar_feed_in_rate_r']} c/kWh\n"
        if plan['payment_options']:
            plan_message += f"  - Payment Options: {', '.join(plan['payment_options'])}\n"

        message += plan_message + "\n"

    return message

def collect_plans(postcode):
    plans = get_plans(postcode)
    filtered_plans = filter_plans(plans)
    grouped_plans = group_plans(filtered_plans)

    cheapest_sr_plans = get_cheapest_plans(grouped_plans, "SR")
    cheapest_tou_plans = get_cheapest_plans(grouped_plans, "TOU")

    plans_data = {"SR": [], "TOU": []}

    for plan in cheapest_sr_plans:
        costs = get_no_discount_cost(plan, 'large')
        fees, solar_feed_in_rate_r = extract_fees_and_solar(plan)
        peak, shoulder, off_peak, daily_supply_charge = extract_tariff_periods(plan)
        payment_options = extract_payment_options(plan)

        plans_data["SR"].append({
            "plan_id": plan['planId'],
            "plan_name": plan['planData']['planName'],
            "retailer_name": plan['planData']['retailerName'],
            "monthly_cost": costs['monthly'],
            "quarterly_cost": costs['quarterly'],
            "annual_cost": costs['yearly'],
            "peak_cost": peak,
            "shoulder_cost": shoulder,
            "off_peak_cost": off_peak,
            "daily_supply_charge": daily_supply_charge,
            "fees": fees,
            "solar_feed_in_rate_r": solar_feed_in_rate_r,
            "payment_options": payment_options
        })

    for plan in cheapest_tou_plans:
        costs = get_no_discount_cost(plan, 'large')
        fees, solar_feed_in_rate_r = extract_fees_and_solar(plan)
        peak, shoulder, off_peak, daily_supply_charge = extract_tariff_periods(plan)
        payment_options = extract_payment_options(plan)

        plans_data["TOU"].append({
            "plan_id": plan['planId'],
            "plan_name": plan['planData']['planName'],
            "retailer_name": plan['planData']['retailerName'],
            "monthly_cost": costs['monthly'],
            "quarterly_cost": costs['quarterly'],
            "annual_cost": costs['yearly'],
            "peak_cost": peak,
            "shoulder_cost": shoulder,
            "off_peak_cost": off_peak,
            "daily_supply_charge": daily_supply_charge,
            "fees": fees,
            "solar_feed_in_rate_r": solar_feed_in_rate_r,
            "payment_options": payment_options
        })

    return plans_data

if __name__ == "__main__":
    postcode = "5097"
    plans_data = collect_plans(postcode)
    tou = prep_tou_plans_message(plans_data, postcode)
    sr = prep_sr_plans_message(plans_data, postcode)
    print(tou, sr)
```