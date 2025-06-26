#!/usr/bin/env python3
"""
Apply Rate Predictions to Energy Plans
This script takes the predicted rate changes from a CSV file and applies them
to the existing energy plan data to generate a new JSON file with inferred
rates for a future date.
"""

import json
import csv
import copy
from typing import Dict, Any

# File paths
CURRENT_PLANS_FILE = '/home/krkr/energy/all_energy_plans.json'
PREDICTED_RATES_FILE = '/home/krkr/energy/predicted_rates.csv'
OUTPUT_PLANS_FILE = '/home/krkr/energy/predicted_energy_plans.json'

# Mapping from CSV tariff components to JSON plan keys
TARIFF_COMPONENT_MAP = {
    'Daily Supply': 'daily_supply_charge',
    'Peak Usage': 'peak_cost',
    'Shoulder Usage': 'shoulder_cost',
    'Off-Peak Usage': 'off_peak_cost',
    'Solar FiT': 'solar_feed_in_rate_r'
    # 'Controlled Load' is not currently in the plan data, so it's ignored.
}

def load_predicted_changes(filepath: str) -> Dict[tuple, Dict[str, float]]:
    """
    Loads rate predictions from the CSV file into a structured dictionary.
    Returns a dictionary mapping (retailer, plan_name) to tariff changes.
    """
    predictions = {}
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                retailer = row.get('Retailer')
                plan_name = row.get('Plan Name (as of July 2024)')
                component = row.get('Tariff Component')
                change_str = row.get('Inferred Change for July 2025 (cents)')

                if not all([retailer, plan_name, component, change_str]):
                    continue

                try:
                    change_value = float(change_str)
                except (ValueError, TypeError):
                    # Handle cases where change is 'N/A' or invalid
                    continue

                key = (retailer.strip(), plan_name.strip())
                if key not in predictions:
                    predictions[key] = {}
                
                predictions[key][component.strip()] = change_value

        print(f"Successfully loaded predictions for {len(predictions)} unique plans from {filepath}")
        return predictions

    except FileNotFoundError:
        print(f"Error: Prediction file not found at {filepath}")
        return {}
    except Exception as e:
        print(f"An error occurred while reading the CSV: {e}")
        return {}

def apply_predictions_to_plans(plans_data: Dict, predictions: Dict) -> Dict:
    """
    Applies the loaded predictions to the current plan data.
    Returns a new dictionary with ONLY the plans that have predictions.
    """
    # Create the output structure with metadata
    filtered_plans_data = {
        'metadata': copy.deepcopy(plans_data.get('metadata', {})),
        'plans': {}
    }
    
    plans_updated_count = 0
    total_predicted_plans = 0
    
    # The plans are nested under 'plans' -> 'TOU', 'SR', etc.
    for plan_type in plans_data.get('plans', {}):
        filtered_plans_data['plans'][plan_type] = []
        
        for plan in plans_data['plans'][plan_type]:
            retailer_name = plan.get('retailer_name', '').strip()
            plan_name = plan.get('plan_name', '').strip()
            
            # Find a matching prediction
            # We check for partial matches in plan names to handle variations
            matched_key = None
            for key_retailer, key_plan in predictions.keys():
                if retailer_name == key_retailer and key_plan in plan_name:
                    matched_key = (key_retailer, key_plan)
                    break
            
            # Only include plans that have predictions
            if not matched_key:
                continue

            # Make a deep copy of the plan before modifying
            updated_plan = copy.deepcopy(plan)
            plan_predictions = predictions[matched_key]
            plans_updated_count += 1
            
            # Apply each tariff component change
            for component, change in plan_predictions.items():
                json_key = TARIFF_COMPONENT_MAP.get(component)
                if not json_key:
                    continue
                
                # Ensure the key exists and its value is numeric before applying change
                if updated_plan.get(json_key) is not None and isinstance(updated_plan[json_key], (int, float)):
                    original_value = updated_plan[json_key]
                    updated_plan[json_key] += change
                    print(f"  - Updated {retailer_name} - {plan_name}: {json_key} from {original_value:.2f} to {updated_plan[json_key]:.2f}")
                else:
                    # This handles cases where a plan might not have a shoulder rate, etc.
                    print(f"  - Skipped {retailer_name} - {plan_name}: {json_key} not found or not numeric.")
            
            # Add the updated plan to the filtered results
            filtered_plans_data['plans'][plan_type].append(updated_plan)
            total_predicted_plans += 1
        
        # Remove empty plan types
        if not filtered_plans_data['plans'][plan_type]:
            del filtered_plans_data['plans'][plan_type]
    
    # Update metadata to reflect the filtered dataset
    filtered_plans_data['metadata']['total_plans'] = total_predicted_plans
    filtered_plans_data['metadata']['tou_count'] = len(filtered_plans_data['plans'].get('TOU', []))
    filtered_plans_data['metadata']['sr_count'] = len(filtered_plans_data['plans'].get('SR', []))
    filtered_plans_data['metadata']['other_count'] = sum(len(plans) for plan_type, plans in filtered_plans_data['plans'].items() if plan_type not in ['TOU', 'SR'])
    filtered_plans_data['metadata']['filters_applied'] = f"{plans_data['metadata'].get('filters_applied', '')} + Only plans with rate predictions"

    print(f"\nApplied updates to {plans_updated_count} plans.")
    print(f"Filtered output contains {total_predicted_plans} plans with predictions.")
    return filtered_plans_data

def main():
    """Main execution function."""
    print("Starting rate prediction application process...")
    
    # 1. Load the predicted changes
    predictions = load_predicted_changes(PREDICTED_RATES_FILE)
    if not predictions:
        print("No predictions loaded. Exiting.")
        return

    # 2. Load the current energy plans
    try:
        with open(CURRENT_PLANS_FILE, 'r', encoding='utf-8') as f:
            current_plans = json.load(f)
        print(f"Successfully loaded current plans from {CURRENT_PLANS_FILE}")
    except FileNotFoundError:
        print(f"Error: Current plans file not found at {CURRENT_PLANS_FILE}")
        return
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {CURRENT_PLANS_FILE}")
        return

    # 3. Apply predictions to the plans
    predicted_plans = apply_predictions_to_plans(current_plans, predictions)

    # 4. Save the new predicted plans to a file
    try:
        with open(OUTPUT_PLANS_FILE, 'w', encoding='utf-8') as f:
            json.dump(predicted_plans, f, indent=2, ensure_ascii=False)
        print(f"\nSuccessfully saved predicted energy plans to {OUTPUT_PLANS_FILE}")
    except IOError as e:
        print(f"Error saving to file {OUTPUT_PLANS_FILE}: {e}")

    print("\nProcess complete.")

if __name__ == "__main__":
    main()
