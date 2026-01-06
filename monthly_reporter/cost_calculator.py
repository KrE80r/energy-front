"""
Energy Plan Cost Calculator - Python Port
Bill-accurate calculation matching calculator.js and guaranteed_discount_detector.js

Implements:
- Supply charge (91 days)
- TOU usage charges (peak/shoulder/off-peak)
- Membership fees (annual → quarterly)
- Solar feed-in credits (simple, tiered, time-based)
- Guaranteed discounts only (excludes conditional)
"""

import logging
from typing import Dict, Any, Optional, List
from decimal import Decimal, ROUND_HALF_UP

logger = logging.getLogger(__name__)

# Constants
QUARTER_DAYS = 91
CENTS_TO_DOLLARS = Decimal('100')


class CostCalculator:
    """Calculate electricity plan costs with bill-accurate methodology"""

    def __init__(self):
        self.logger = logging.getLogger(self.__class__.__name__)

    def calculate_plan_cost(self, plan_data: Dict[str, Any], usage_pattern: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Calculate quarterly cost for a plan given usage pattern

        Args:
            plan_data: Energy plan data from all_energy_plans.json
            usage_pattern: Usage pattern with quarterly_consumption_kwh, tou_split, solar_export_kwh

        Returns:
            Cost breakdown dictionary or None if calculation fails
        """
        try:
            # Extract usage pattern
            quarterly_consumption = usage_pattern['quarterly_consumption_kwh']
            peak_percent = usage_pattern['tou_split']['peak_percent']
            shoulder_percent = usage_pattern['tou_split']['shoulder_percent']
            off_peak_percent = usage_pattern['tou_split']['off_peak_percent']
            solar_export = usage_pattern.get('solar_export_kwh', 0)

            # Validate inputs
            if not self._validate_inputs(usage_pattern):
                self.logger.error(f"Invalid usage pattern for plan {plan_data.get('plan_id')}")
                return None

            # Step 1: Fixed Supply Charge (91 days)
            supply_charge = self._calculate_supply_charge(plan_data.get('daily_supply_charge', 0))

            # Step 2: Membership Fee (quarterly)
            membership_fee = self._calculate_membership_fee(plan_data)

            # Step 3: Net Grid Consumption (already net from bill)
            net_grid_consumption = quarterly_consumption

            # Step 4: Usage Charge (TOU rates)
            usage_charge = self._calculate_usage_charge(
                plan_data,
                net_grid_consumption,
                peak_percent,
                shoulder_percent,
                off_peak_percent
            )

            # Step 5: Solar Export Credit
            solar_credit = self._calculate_solar_credit(plan_data, solar_export)

            # Step 6: Base Bill (before discount)
            base_bill = supply_charge + usage_charge + membership_fee - solar_credit

            # Step 7: Apply Guaranteed Discount
            discount_result = self._apply_guaranteed_discount(plan_data, base_bill)
            final_bill = discount_result['final_cost']

            return {
                'total_cost': max(0, float(final_bill)),
                'base_cost': max(0, float(base_bill)),
                'discount_info': {
                    'applied': discount_result['discount_applied'],
                    'percent': discount_result['discount_percent'],
                    'savings': discount_result['savings_amount']
                },
                'breakdown': {
                    'supply_charge': float(supply_charge),
                    'usage_charge': float(usage_charge),
                    'membership_fee': float(membership_fee),
                    'solar_credit': float(solar_credit),
                    'net_grid_consumption': net_grid_consumption,
                    'solar_exported': solar_export
                },
                'monthly_cost': max(0, float(final_bill)) / 3,
                'annual_cost': max(0, float(final_bill)) * 4,
                'plan_id': plan_data.get('plan_id'),
                'plan_name': plan_data.get('plan_name'),
                'retailer_name': plan_data.get('retailer_name')
            }

        except Exception as e:
            self.logger.error(f"Error calculating cost for plan {plan_data.get('plan_id')}: {e}")
            return None

    def _validate_inputs(self, usage_pattern: Dict[str, Any]) -> bool:
        """Validate usage pattern inputs"""
        try:
            tou = usage_pattern['tou_split']
            total_percent = tou['peak_percent'] + tou['shoulder_percent'] + tou['off_peak_percent']

            # Allow 0.1% tolerance for floating point
            if abs(total_percent - 100) > 0.1:
                self.logger.error(f"TOU percentages sum to {total_percent}, not 100")
                return False

            if usage_pattern['quarterly_consumption_kwh'] <= 0:
                self.logger.error("Quarterly consumption must be positive")
                return False

            return True
        except (KeyError, TypeError) as e:
            self.logger.error(f"Invalid usage pattern structure: {e}")
            return False

    def _calculate_supply_charge(self, daily_supply_rate_cents: float) -> Decimal:
        """Calculate fixed supply charge for 91-day quarter"""
        rate = Decimal(str(daily_supply_rate_cents))
        return (rate * QUARTER_DAYS / CENTS_TO_DOLLARS).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def _calculate_membership_fee(self, plan_data: Dict[str, Any]) -> Decimal:
        """Calculate quarterly membership fee"""
        # Check pre-calculated quarterly fee
        if 'membership_fee_quarterly' in plan_data and plan_data['membership_fee_quarterly']:
            return Decimal(str(plan_data['membership_fee_quarterly']))

        # Fallback: check raw fee data
        fees = plan_data.get('fees', {})
        if 'membership_fee' in fees and fees['membership_fee']:
            fee_info = fees['membership_fee']
            if fee_info.get('feeTerm') == 'A' and fee_info.get('amount'):
                # Annual → quarterly
                annual = Decimal(str(fee_info['amount']))
                return (annual / 4).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        return Decimal('0')

    def _calculate_usage_charge(
        self,
        plan_data: Dict[str, Any],
        net_grid_consumption: float,
        peak_percent: float,
        shoulder_percent: float,
        off_peak_percent: float
    ) -> Decimal:
        """Calculate usage charge based on TOU rates"""
        net_consumption = Decimal(str(net_grid_consumption))

        peak_consumption = net_consumption * Decimal(str(peak_percent)) / Decimal('100')
        shoulder_consumption = net_consumption * Decimal(str(shoulder_percent)) / Decimal('100')
        off_peak_consumption = net_consumption * Decimal(str(off_peak_percent)) / Decimal('100')

        total_usage_charge = Decimal('0')

        # Peak rate
        peak_cost = plan_data.get('peak_cost')
        if peak_cost and peak_cost > 0:
            total_usage_charge += (peak_consumption * Decimal(str(peak_cost))) / CENTS_TO_DOLLARS

        # Shoulder rate (may be null for 2-rate plans)
        shoulder_cost = plan_data.get('shoulder_cost')
        if shoulder_cost and shoulder_cost > 0:
            total_usage_charge += (shoulder_consumption * Decimal(str(shoulder_cost))) / CENTS_TO_DOLLARS

        # Off-peak rate
        off_peak_cost = plan_data.get('off_peak_cost')
        if off_peak_cost and off_peak_cost > 0:
            total_usage_charge += (off_peak_consumption * Decimal(str(off_peak_cost))) / CENTS_TO_DOLLARS

        return total_usage_charge.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

    def _calculate_solar_credit(self, plan_data: Dict[str, Any], solar_export_kwh: float) -> Decimal:
        """Calculate solar export credit (simple rate for now, can extend to tiered)"""
        if solar_export_kwh <= 0:
            return Decimal('0')

        # Simple solar FiT rate (most common)
        fit_rate = plan_data.get('solar_feed_in_rate_r', 0)
        if not fit_rate or fit_rate <= 0:
            return Decimal('0')

        export = Decimal(str(solar_export_kwh))
        rate = Decimal(str(fit_rate))

        # Calculate credit: export_kwh * rate_cents / 100
        credit = (export * rate / CENTS_TO_DOLLARS).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        return credit

    def _detect_guaranteed_discount(self, plan_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Detect guaranteed discounts using PCR costs data
        Matches guaranteed_discount_detector.js logic
        """
        result = {
            'has_guaranteed_discount': False,
            'guaranteed_discount_percent': 0.0,
            'guaranteed_quarterly_cost': None,
            'base_quarterly_cost': None
        }

        # Check if plan has discounts
        raw_data = plan_data.get('raw_plan_data', {})
        if not raw_data.get('has_discounts'):
            return result

        # Get PCR costs data
        try:
            pcr_path = plan_data.get('raw_plan_data_complete', {}) \
                .get('main_api_response', {}) \
                .get('pcr', {}) \
                .get('costs', {}) \
                .get('electricity', {}) \
                .get('large', {}) \
                .get('quarterly', {})

            no_discounts = pcr_path.get('noDiscounts', 0)
            all_discounts = pcr_path.get('allDiscounts', 0)
            guaranteed_discount = pcr_path.get('guaranteedDiscount', 0)

            # KEY RULE: guaranteed == allDiscounts && allDiscounts < noDiscounts
            is_guaranteed = (all_discounts == guaranteed_discount) and (all_discounts < no_discounts)

            if is_guaranteed and no_discounts > 0:
                result['has_guaranteed_discount'] = True
                result['guaranteed_discount_percent'] = ((no_discounts - guaranteed_discount) / no_discounts) * 100
                result['guaranteed_quarterly_cost'] = guaranteed_discount
                result['base_quarterly_cost'] = no_discounts

            # SECONDARY CHECK: Verify no conditional discounts in contract
            contract_data = plan_data.get('raw_plan_data_complete', {}) \
                .get('detailed_api_response', {}) \
                .get('data', {}) \
                .get('planData', {}) \
                .get('contract', [])

            for contract in contract_data:
                if 'discount' in contract:
                    for discount in contract['discount']:
                        # If any discount is conditional (type 'C'), it's not guaranteed
                        if discount.get('type') == 'C':
                            result['has_guaranteed_discount'] = False
                            result['guaranteed_discount_percent'] = 0.0
                            result['guaranteed_quarterly_cost'] = None
                            break

        except (KeyError, TypeError, ZeroDivisionError) as e:
            self.logger.debug(f"Could not extract discount data: {e}")

        return result

    def _apply_guaranteed_discount(self, plan_data: Dict[str, Any], calculated_cost: Decimal) -> Dict[str, Any]:
        """Apply guaranteed discount to calculated cost"""
        discount_info = self._detect_guaranteed_discount(plan_data)

        if not discount_info['has_guaranteed_discount']:
            return {
                'final_cost': calculated_cost,
                'discount_applied': False,
                'discount_percent': 0.0,
                'savings_amount': 0.0
            }

        discount_percent = Decimal(str(discount_info['guaranteed_discount_percent']))
        discount_multiplier = Decimal('1') - (discount_percent / Decimal('100'))
        final_cost = (calculated_cost * discount_multiplier).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        savings_amount = calculated_cost - final_cost

        return {
            'final_cost': final_cost,
            'discount_applied': True,
            'discount_percent': float(discount_percent),
            'savings_amount': float(savings_amount)
        }

    def should_disqualify_plan(self, plan_data: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """
        Check if plan should be disqualified from comparison
        Returns: (should_disqualify, reason)
        """
        # Check for demand charges
        try:
            contract_data = plan_data.get('raw_plan_data_complete', {}) \
                .get('main_api_response', {}) \
                .get('planData', {}) \
                .get('contract', [])

            for contract in contract_data:
                tariff_periods = contract.get('tariffPeriod', [])
                for period in tariff_periods:
                    if 'demandCharge' in period and period['demandCharge']:
                        return (True, "Has demand charges")
        except (KeyError, TypeError):
            pass

        # Check for invalid rates
        if not plan_data.get('daily_supply_charge') or plan_data.get('daily_supply_charge', 0) <= 0:
            return (True, "Missing or invalid supply charge")

        peak_cost = plan_data.get('peak_cost', 0)
        off_peak_cost = plan_data.get('off_peak_cost', 0)

        if not peak_cost or peak_cost <= 0:
            return (True, "Missing or invalid peak rate")

        if not off_peak_cost or off_peak_cost <= 0:
            return (True, "Missing or invalid off-peak rate")

        # Shoulder can be null for 2-rate TOU plans, but if it exists it must be valid
        shoulder_cost = plan_data.get('shoulder_cost')
        if shoulder_cost is not None and shoulder_cost == 0:
            return (True, "Invalid shoulder rate (0)")

        return (False, None)


# Singleton instance
_calculator = None

def get_calculator() -> CostCalculator:
    """Get singleton calculator instance"""
    global _calculator
    if _calculator is None:
        _calculator = CostCalculator()
    return _calculator
