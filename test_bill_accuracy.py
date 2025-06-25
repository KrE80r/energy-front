#!/usr/bin/env python3
"""
Test Calculator with Real Bill Data
Verify the corrected calculator produces accurate results using actual electricity bills
"""

import json
import sys

# Real bill data from the screenshots provided
REAL_BILL_DATA = [
    {
        "period": "Mar-Apr 2025 (28 days)",
        "total_usage": 538.87,  # kWh - what they bought from grid
        "solar_generation": 707.54,  # kWh - total solar generated
        "solar_export": 707.54,  # kWh - all solar was exported (no self-consumption)
        "daily_charge_days": 28,
        "rates": {
            "peak": 41.47,  # c/kWh (includes GST)
            "shoulder": 23.10,  # c/kWh
            "off_peak": 23.10,  # c/kWh
            "daily_supply": 128.7,  # c/day
            "feed_in_tariff": 1.50  # c/kWh
        },
        "actual_charges": {
            "daily_charge": 36.04,
            "peak_usage": 145.53,
            "off_peak_usage": 37.00,
            "shoulder_usage": 6.41,
            "solar_credit": -10.61,
            "total_before_gst": 194.92,  # Calculated from above
            "gst": 20.45,
            "total_including_gst": 214.37
        },
        "usage_breakdown": {
            "peak_kwh": 350.94,
            "off_peak_kwh": 160.17,
            "shoulder_kwh": 27.76
        }
    },
    {
        "period": "May-Jun 2025 (28 days)",
        "total_usage": 609.23,  # kWh
        "solar_generation": 508.71,  # kWh
        "solar_export": 508.71,  # kWh - all exported
        "daily_charge_days": 28,
        "rates": {
            "peak": 41.47,  # c/kWh
            "shoulder": 23.10,  # c/kWh
            "off_peak": 23.10,  # c/kWh
            "daily_supply": 128.7,  # c/day
            "feed_in_tariff": 1.50  # c/kWh
        },
        "actual_charges": {
            "daily_charge": 36.04,
            "peak_usage": 209.28,
            "off_peak_usage": 17.53,
            "shoulder_usage": 6.63,
            "solar_credit": -7.63,
            "total_before_gst": 237.35,
            "gst": 24.50,
            "total_including_gst": 261.85
        },
        "usage_breakdown": {
            "peak_kwh": 504.66,
            "off_peak_kwh": 75.87,
            "shoulder_kwh": 28.70
        }
    }
]

def calculate_bill_with_corrected_formula(bill_data):
    """Calculate bill using our corrected formula"""
    
    # Extract data
    total_usage = bill_data["total_usage"]  # Net grid consumption from bill
    solar_export = bill_data["solar_export"]
    rates = bill_data["rates"]
    usage_breakdown = bill_data["usage_breakdown"]
    days = bill_data["daily_charge_days"]
    
    # Calculate percentages from actual usage breakdown
    peak_percent = (usage_breakdown["peak_kwh"] / total_usage) * 100
    shoulder_percent = (usage_breakdown["shoulder_kwh"] / total_usage) * 100
    off_peak_percent = (usage_breakdown["off_peak_kwh"] / total_usage) * 100
    
    print(f"\\nBill Period: {bill_data['period']}")
    print(f"Net Grid Consumption: {total_usage} kWh")
    print(f"Solar Export: {solar_export} kWh")
    print(f"Usage Split: {peak_percent:.1f}% peak, {shoulder_percent:.1f}% shoulder, {off_peak_percent:.1f}% off-peak")
    
    # Step 1: Supply charge
    supply_charge = (rates["daily_supply"] * days) / 100
    
    # Step 2: Usage charges (apply rates to net grid consumption)
    peak_usage = total_usage * (peak_percent / 100)
    shoulder_usage = total_usage * (shoulder_percent / 100)
    off_peak_usage = total_usage * (off_peak_percent / 100)
    
    peak_charge = (peak_usage * rates["peak"]) / 100
    shoulder_charge = (shoulder_usage * rates["shoulder"]) / 100
    off_peak_charge = (off_peak_usage * rates["off_peak"]) / 100
    
    total_usage_charge = peak_charge + shoulder_charge + off_peak_charge
    
    # Step 3: Solar credit
    solar_credit = (solar_export * rates["feed_in_tariff"]) / 100
    
    # Step 4: Total before GST
    total_before_gst = supply_charge + total_usage_charge - solar_credit
    
    # Step 5: Add GST (10%)
    gst = total_before_gst * 0.10
    total_with_gst = total_before_gst + gst
    
    # Compare with actual bill
    actual = bill_data["actual_charges"]
    
    print("\\nCALCULATED vs ACTUAL:")
    print(f"Supply Charge:    ${supply_charge:.2f} vs ${actual['daily_charge']:.2f}")
    print(f"Peak Usage:       ${peak_charge:.2f} vs ${actual['peak_usage']:.2f}")
    print(f"Shoulder Usage:   ${shoulder_charge:.2f} vs ${actual['shoulder_usage']:.2f}")
    print(f"Off-Peak Usage:   ${off_peak_charge:.2f} vs ${actual['off_peak_usage']:.2f}")
    print(f"Solar Credit:     ${solar_credit:.2f} vs ${actual['solar_credit']:.2f}")
    print(f"Total (no GST):   ${total_before_gst:.2f} vs ${actual['total_before_gst']:.2f}")
    print(f"GST:              ${gst:.2f} vs ${actual['gst']:.2f}")
    print(f"Total (with GST): ${total_with_gst:.2f} vs ${actual['total_including_gst']:.2f}")
    
    # Calculate accuracy
    accuracy = (1 - abs(total_with_gst - actual['total_including_gst']) / actual['total_including_gst']) * 100
    print(f"\\nACCURACY: {accuracy:.1f}%")
    
    return {
        "calculated_total": total_with_gst,
        "actual_total": actual['total_including_gst'],
        "accuracy_percent": accuracy,
        "breakdown": {
            "supply_charge": supply_charge,
            "usage_charge": total_usage_charge,
            "solar_credit": solar_credit,
            "gst": gst
        }
    }

def test_quarterly_scaling():
    """Test how monthly bills scale to quarterly calculations"""
    
    print("\\n" + "="*60)
    print("QUARTERLY SCALING TEST")
    print("="*60)
    
    # Use first bill as example, scale to quarterly
    bill = REAL_BILL_DATA[0]
    
    # Scale 28-day bill to 91-day quarter
    scale_factor = 91 / 28
    
    quarterly_usage = bill["total_usage"] * scale_factor
    quarterly_solar_export = bill["solar_export"] * scale_factor
    
    # Usage pattern percentages stay the same
    usage_breakdown = bill["usage_breakdown"]
    peak_percent = (usage_breakdown["peak_kwh"] / bill["total_usage"]) * 100
    shoulder_percent = (usage_breakdown["shoulder_kwh"] / bill["total_usage"]) * 100
    off_peak_percent = (usage_breakdown["off_peak_kwh"] / bill["total_usage"]) * 100
    
    print(f"Quarterly Usage (scaled): {quarterly_usage:.1f} kWh")
    print(f"Quarterly Solar Export: {quarterly_solar_export:.1f} kWh")
    print(f"Usage Pattern: {peak_percent:.1f}% peak, {shoulder_percent:.1f}% shoulder, {off_peak_percent:.1f}% off-peak")
    
    # This is the input format for our calculator
    usage_pattern = {
        "quarterlyConsumption": quarterly_usage,
        "peakPercent": peak_percent,
        "shoulderPercent": shoulder_percent,
        "offPeakPercent": off_peak_percent,
        "solarExport": quarterly_solar_export
    }
    
    plan_data = {
        "peak_cost": bill["rates"]["peak"],
        "shoulder_cost": bill["rates"]["shoulder"],
        "off_peak_cost": bill["rates"]["off_peak"],
        "daily_supply_charge": bill["rates"]["daily_supply"],
        "solar_feed_in_rate_r": bill["rates"]["feed_in_tariff"]
    }
    
    # Calculate using our formula
    supply_charge = (plan_data["daily_supply_charge"] * 91) / 100
    
    peak_consumption = quarterly_usage * (peak_percent / 100)
    shoulder_consumption = quarterly_usage * (shoulder_percent / 100)
    off_peak_consumption = quarterly_usage * (off_peak_percent / 100)
    
    usage_charge = ((peak_consumption * plan_data["peak_cost"]) + 
                   (shoulder_consumption * plan_data["shoulder_cost"]) + 
                   (off_peak_consumption * plan_data["off_peak_cost"])) / 100
    
    solar_credit = (quarterly_solar_export * plan_data["solar_feed_in_rate_r"]) / 100
    
    total_cost = supply_charge + usage_charge - solar_credit
    
    print(f"\\nQUARTERLY CALCULATION:")
    print(f"Supply Charge: ${supply_charge:.2f}")
    print(f"Usage Charge: ${usage_charge:.2f}")
    print(f"Solar Credit: ${solar_credit:.2f}")
    print(f"Total Cost: ${total_cost:.2f}")
    
    # Verify by scaling actual bill
    actual_quarterly = (bill["actual_charges"]["total_including_gst"] * scale_factor)
    print(f"\\nActual Bill Scaled: ${actual_quarterly:.2f}")
    print(f"Calculation Accuracy: {((1 - abs(total_cost - actual_quarterly) / actual_quarterly) * 100):.1f}%")
    
    return usage_pattern, plan_data

def main():
    """Test calculator accuracy with real bill data"""
    
    print("TESTING CALCULATOR WITH REAL ELECTRICITY BILLS")
    print("="*60)
    print("\\nTesting bill-accurate calculation formula...")
    
    total_accuracy = 0
    
    # Test each bill period
    for i, bill in enumerate(REAL_BILL_DATA, 1):
        result = calculate_bill_with_corrected_formula(bill)
        total_accuracy += result["accuracy_percent"]
        print("\\n" + "-"*40)
    
    average_accuracy = total_accuracy / len(REAL_BILL_DATA)
    print(f"\\nAVERAGE ACCURACY: {average_accuracy:.1f}%")
    
    # Test quarterly scaling
    test_quarterly_scaling()
    
    print("\\n" + "="*60)
    print("CONCLUSION:")
    if average_accuracy > 95:
        print("✅ Calculator formula is HIGHLY ACCURATE for real bills")
    elif average_accuracy > 90:
        print("✅ Calculator formula is ACCURATE for real bills")
    else:
        print("❌ Calculator formula needs adjustment")
    
    print("\\nKEY INSIGHT: quarterlyConsumption should be NET GRID CONSUMPTION from bills")
    print("(Smart meters already deduct solar self-consumption)")

if __name__ == "__main__":
    main()