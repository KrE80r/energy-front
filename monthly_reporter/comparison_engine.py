"""
Comparison Engine
Analyzes plans, identifies cheapest by retailer, detects new savings opportunities
"""

import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime

from cost_calculator import get_calculator
from history_manager import get_history_manager

logger = logging.getLogger(__name__)


class ComparisonEngine:
    """Compare plans and detect savings opportunities"""

    def __init__(self, plans_file: str = "/home/krkr/energy/all_energy_plans.json"):
        self.plans_file = Path(plans_file)
        self.calculator = get_calculator()
        self.history = get_history_manager()
        self.logger = logging.getLogger(self.__class__.__name__)

    def load_plans(self) -> List[Dict[str, Any]]:
        """Load all plans from JSON file"""
        try:
            with open(self.plans_file, 'r') as f:
                data = json.load(f)

            # Handle nested structure with metadata and plans
            if isinstance(data, dict) and 'plans' in data:
                # Extract all plans from nested structure
                all_plans = []
                plans_by_type = data['plans']

                for plan_type, plans_list in plans_by_type.items():
                    if isinstance(plans_list, list):
                        all_plans.extend(plans_list)

                self.logger.info(f"Loaded {len(all_plans)} plans from {self.plans_file}")
                return all_plans
            elif isinstance(data, list):
                # Flat list of plans
                self.logger.info(f"Loaded {len(data)} plans from {self.plans_file}")
                return data
            else:
                self.logger.error("Unexpected JSON structure")
                return []

        except Exception as e:
            self.logger.error(f"Error loading plans: {e}")
            return []

    def filter_plans(self, plans: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Apply filtering criteria matching app.js

        Filters:
        - effectiveDate >= 2025-06-17 (or current date)
        - Exclude plans with SC/OC restrictions
        - Exclude plans with demand charges
        - Exclude plans with invalid rates
        """
        filtered = []

        # Use fixed date for effective date filter (aligned with data fetch date)
        # NOTE: In production, update this when get_all_plans.py is run monthly
        target_date = "2025-06-17"  # Matches frontend filter

        # SC/OC restricted plan IDs (from app.js)
        restricted_plan_ids = {
            # SC (Seniors Card)
            "AGL360486MRE33", "AGL898888MRE3",
            # OC (Other Customer Requirements - membership programs, etc.)
            "AGL798888MRE3", "AGL360488MRE33", "AGL360491MRE33", "AGL360495MRE33",
            "AGL798888MRE4", "AGL898888MRE4", "EDI414191MRE1", "EDI414191MRE2",
            "1SE471691MRE1", "ALI320887MRE1", "AMB377385MRE1", "AMB377385MRE2",
            "AMB377390MRE1", "AMB377386MRE1", "AMB377386MRE2", "AMB372985MRE1",
            "AMB372985MRE2", "AMB458886MRE1", "AMB458886MRE2", "AMB372395MRE1",
            "AMB372395MRE2", "AMB458895MRE1", "AMB458895MRE2", "ELO383685MRE1",
            "ORI401991MRE1", "ORI404392MRE1", "ORI404392MRE2", "POW308494MRE1",
            "SES368584MRE1", "TAE320995MRE1"
        }

        for plan in plans:
            # Check effective date (try multiple paths to accommodate data structure)
            raw_complete = plan.get('raw_plan_data_complete', {})
            detailed_response = raw_complete.get('detailed_api_response', {})

            # Try multiple paths for effectiveDate
            effective_date = (
                detailed_response.get('data', {}).get('planData', {}).get('effectiveDate') or
                detailed_response.get('planData', {}).get('effectiveDate') or
                detailed_response.get('effectiveDate') or
                ''
            )

            if not effective_date:
                self.logger.debug(f"Plan {plan.get('plan_id')} missing effectiveDate, excluding")
                continue

            if effective_date < target_date:
                self.logger.debug(f"Plan {plan.get('plan_id')} has old effectiveDate {effective_date}, excluding")
                continue

            # Check restriction
            plan_id = plan.get('plan_id', '')
            if plan_id in restricted_plan_ids:
                continue

            # Check for disqualification (demand charges, invalid rates)
            should_disqualify, reason = self.calculator.should_disqualify_plan(plan)
            if should_disqualify:
                self.logger.debug(f"Disqualified {plan_id}: {reason}")
                continue

            filtered.append(plan)

        self.logger.info(f"Filtered to {len(filtered)} valid plans (from {len(plans)})")
        return filtered

    def calculate_all_costs(
        self,
        plans: List[Dict[str, Any]],
        profile_config: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Calculate costs for all plans using profile configuration

        Returns list of dicts with plan data + calculated costs
        """
        results = []

        for plan in plans:
            cost_result = self.calculator.calculate_plan_cost(plan, profile_config)
            if cost_result:
                results.append(cost_result)

        self.logger.info(f"Successfully calculated {len(results)} plan costs")
        return results

    def find_cheapest_by_retailer(
        self,
        calculated_plans: List[Dict[str, Any]],
        retailer_names: List[str]
    ) -> Dict[str, Optional[Dict[str, Any]]]:
        """
        Find cheapest plan for each specified retailer

        Args:
            calculated_plans: Plans with calculated costs
            retailer_names: List of retailer names to find (e.g., ["AGL", "Origin Energy"])

        Returns:
            Dict mapping retailer name to cheapest plan data (or None if not found)
        """
        cheapest = {retailer: None for retailer in retailer_names}

        for retailer in retailer_names:
            # Filter plans for this retailer (case-insensitive partial match)
            retailer_plans = [
                p for p in calculated_plans
                if retailer.lower() in p.get('retailer_name', '').lower()
            ]

            if not retailer_plans:
                self.logger.warning(f"No plans found for retailer: {retailer}")
                continue

            # Find cheapest by total_cost
            cheapest_plan = min(retailer_plans, key=lambda x: x['total_cost'])
            cheapest[retailer] = cheapest_plan
            self.logger.info(
                f"Cheapest {retailer}: {cheapest_plan['plan_name']} "
                f"at ${cheapest_plan['total_cost']:.2f}/quarter"
            )

        return cheapest

    def detect_savings_opportunities(
        self,
        profile_name: str,
        current_cheapest: Dict[str, Optional[Dict[str, Any]]],
        retailer_names: List[str]
    ) -> List[Dict[str, Any]]:
        """
        Detect if current month's cheapest plans are better than previous month

        Args:
            profile_name: Profile identifier
            current_cheapest: Dict of current month's cheapest plans by retailer
            retailer_names: List of retailers to check

        Returns:
            List of savings opportunities (empty if none)
        """
        opportunities = []

        for retailer in retailer_names:
            current = current_cheapest.get(retailer)
            if not current:
                continue

            # Get previous month's data
            previous = self.history.get_previous_month_data(profile_name, retailer, months_ago=1)

            if not previous:
                # First month of tracking - save but don't alert
                self.logger.info(f"First month tracking {retailer} for {profile_name}")
                continue

            # Calculate savings
            current_cost = current['total_cost']
            previous_cost = previous.get('total_cost', 0)

            if current_cost < previous_cost:
                quarterly_savings = previous_cost - current_cost
                annual_savings = quarterly_savings * 4

                # Check if it's a new plan or same plan with lower price
                is_new_plan = current['plan_id'] != previous.get('plan_id')

                opportunity = {
                    'profile_name': profile_name,
                    'retailer': retailer,
                    'current_plan': {
                        'id': current['plan_id'],
                        'name': current['plan_name'],
                        'cost': current_cost
                    },
                    'previous_plan': {
                        'id': previous.get('plan_id'),
                        'name': previous.get('plan_name'),
                        'cost': previous_cost
                    },
                    'savings': {
                        'quarterly': quarterly_savings,
                        'annual': annual_savings
                    },
                    'is_new_plan': is_new_plan,
                    'current_plan_details': current
                }

                opportunities.append(opportunity)
                self.logger.info(
                    f"💰 Savings opportunity for {profile_name}/{retailer}: "
                    f"${quarterly_savings:.2f}/qtr (${annual_savings:.2f}/yr)"
                )

        return opportunities

    def detect_absolute_cheapest_savings(
        self,
        profile_name: str,
        current_cheapest: Dict[str, Any],
        baseline_plans: Dict[str, Optional[Dict[str, Any]]]
    ) -> List[Dict[str, Any]]:
        """
        Detect if absolute cheapest plan changed from last month.

        Args:
            profile_name: Profile identifier
            current_cheapest: Current month's absolute cheapest plan
            baseline_plans: Dict of baseline retailer plans (AGL, Origin) for comparison

        Returns:
            List with opportunity if cheaper plan found, empty list otherwise
        """
        # Get previous month's absolute cheapest
        previous = self.history.get_previous_month_data(profile_name, "absolute_cheapest", months_ago=1)

        if not previous:
            # First month - no comparison possible
            self.logger.info(f"First month tracking absolute cheapest for {profile_name}")
            return []

        current_cost = current_cheapest['total_cost']
        previous_cost = previous.get('total_cost', 0)

        if current_cost >= previous_cost:
            # No savings or price increased
            return []

        # Calculate savings
        quarterly_savings = previous_cost - current_cost
        annual_savings = quarterly_savings * 4
        is_new_plan = current_cheapest['plan_id'] != previous.get('plan_id')

        # Calculate savings vs baseline retailers
        baseline_comparison = {}
        for retailer, plan in baseline_plans.items():
            if plan:
                baseline_savings = plan['total_cost'] - current_cost
                baseline_comparison[retailer] = {
                    'quarterly_savings': baseline_savings,
                    'annual_savings': baseline_savings * 4,
                    'plan_name': plan['plan_name'],
                    'plan_cost': plan['total_cost']
                }

        opportunity = {
            'profile_name': profile_name,
            'retailer': current_cheapest['retailer_name'],
            'current_plan': {
                'id': current_cheapest['plan_id'],
                'name': current_cheapest['plan_name'],
                'cost': current_cost
            },
            'previous_plan': {
                'id': previous.get('plan_id'),
                'name': previous.get('plan_name'),
                'cost': previous_cost
            },
            'savings': {
                'quarterly': quarterly_savings,
                'annual': annual_savings
            },
            'is_new_plan': is_new_plan,
            'current_plan_details': current_cheapest,
            'baseline_comparison': baseline_comparison
        }

        self.logger.info(
            f"💰 Absolute cheapest savings for {profile_name}: "
            f"${quarterly_savings:.2f}/qtr (${annual_savings:.2f}/yr)"
        )

        return [opportunity]

    def compare_against_baseline(
        self,
        plan: Dict[str, Any],
        baseline_plans: Dict[str, Optional[Dict[str, Any]]]
    ) -> Dict[str, Dict[str, float]]:
        """
        Compare a plan against baseline plans (AGL and Origin cheapest)

        Args:
            plan: Plan to compare
            baseline_plans: Dict with 'AGL' and 'Origin Energy' cheapest plans

        Returns:
            Dict with savings vs each baseline
        """
        comparisons = {}

        for retailer, baseline in baseline_plans.items():
            if not baseline:
                continue

            plan_cost = plan['total_cost']
            baseline_cost = baseline['total_cost']

            quarterly_savings = baseline_cost - plan_cost
            annual_savings = quarterly_savings * 4

            comparisons[retailer] = {
                'quarterly_savings': quarterly_savings,
                'annual_savings': annual_savings,
                'baseline_plan_name': baseline['plan_name'],
                'baseline_cost': baseline_cost
            }

        return comparisons

    def run_monthly_comparison(
        self,
        profile_configs: Dict[str, Dict[str, Any]],
        baseline_retailers: List[str] = ["AGL", "Origin Energy"],
        find_absolute_cheapest: bool = False
    ) -> Dict[str, Any]:
        """
        Run complete monthly comparison for all profiles

        Args:
            profile_configs: Dict of profile configurations
            baseline_retailers: Retailers to use as baseline

        Returns:
            Comprehensive comparison results
        """
        self.logger.info("Starting monthly comparison...")

        # Load and filter plans
        all_plans = self.load_plans()
        valid_plans = self.filter_plans(all_plans)

        if not valid_plans:
            self.logger.error("No valid plans found after filtering")
            return {'error': 'No valid plans'}

        results = {
            'timestamp': datetime.now().isoformat(),
            'total_plans_analyzed': len(valid_plans),
            'profiles': {}
        }

        for profile_name, profile_config in profile_configs.items():
            self.logger.info(f"Analyzing profile: {profile_name}")

            # Calculate costs for all plans
            calculated_plans = self.calculate_all_costs(valid_plans, profile_config)

            if find_absolute_cheapest:
                # Find the absolute cheapest plan (any retailer)
                absolute_cheapest = min(calculated_plans, key=lambda x: x['total_cost'])

                # Also get baseline retailers for comparison
                baseline_plans = self.find_cheapest_by_retailer(calculated_plans, baseline_retailers)

                self.logger.info(
                    f"Absolute cheapest for {profile_name}: {absolute_cheapest['retailer_name']} - "
                    f"{absolute_cheapest['plan_name']} at ${absolute_cheapest['total_cost']:.2f}/quarter"
                )

                # Detect if absolute cheapest changed from last month
                opportunities = self.detect_absolute_cheapest_savings(
                    profile_name,
                    absolute_cheapest,
                    baseline_plans
                )

                # Save absolute cheapest to history
                self.history.save_monthly_snapshot(profile_name, "absolute_cheapest", absolute_cheapest)

                # Store results
                results['profiles'][profile_name] = {
                    'absolute_cheapest': absolute_cheapest,
                    'baseline_plans': baseline_plans,
                    'savings_opportunities': opportunities,
                    'plans_calculated': len(calculated_plans)
                }
            else:
                # Original behavior: track specific retailers
                cheapest_by_retailer = self.find_cheapest_by_retailer(calculated_plans, baseline_retailers)

                opportunities = self.detect_savings_opportunities(
                    profile_name,
                    cheapest_by_retailer,
                    baseline_retailers
                )

                # Save current month's data to history
                for retailer, plan in cheapest_by_retailer.items():
                    if plan:
                        self.history.save_monthly_snapshot(profile_name, retailer, plan)

                # Store results
                results['profiles'][profile_name] = {
                    'cheapest_plans': cheapest_by_retailer,
                    'savings_opportunities': opportunities,
                    'plans_calculated': len(calculated_plans)
                }

        self.logger.info("Monthly comparison complete")
        return results


# Singleton instance
_comparison_engine = None

def get_comparison_engine() -> ComparisonEngine:
    """Get singleton comparison engine instance"""
    global _comparison_engine
    if _comparison_engine is None:
        _comparison_engine = ComparisonEngine()
    return _comparison_engine
