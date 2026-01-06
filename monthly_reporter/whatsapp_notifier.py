"""
WhatsApp Notifier
Sends energy plan savings alerts via wa_bot
"""

import sys
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional

# Add wa_bot to path for imports
WA_BOT_PATH = Path("/home/krkr/wa_bot")
sys.path.insert(0, str(WA_BOT_PATH))

from api import create_waha_client
from config import DEV_CHAT_IDS

logger = logging.getLogger(__name__)


class WhatsAppNotifier:
    """Send WhatsApp notifications for energy plan savings"""

    def __init__(self, chat_id: Optional[str] = None):
        """
        Initialize WhatsApp notifier

        Args:
            chat_id: Target chat ID (defaults to Canary dev group)
        """
        self.logger = logging.getLogger(self.__class__.__name__)
        self.chat_id = chat_id or DEV_CHAT_IDS[0]  # Default to Canary group
        self.client = None

    def _get_client(self):
        """Get or create WAHA client"""
        if self.client is None:
            try:
                self.client = create_waha_client()
                self.logger.info("Connected to WAHA API")
            except Exception as e:
                self.logger.error(f"Failed to create WAHA client: {e}")
                raise
        return self.client

    def format_savings_alert(self, opportunity: Dict[str, Any]) -> str:
        """
        Format savings opportunity as WhatsApp message

        Args:
            opportunity: Savings opportunity dict from comparison_engine

        Returns:
            Formatted message string
        """
        profile = opportunity['profile_name'].replace('_', ' ').title()
        retailer = opportunity['retailer']
        current = opportunity['current_plan']
        previous = opportunity['previous_plan']
        savings = opportunity['savings']
        baseline = opportunity.get('baseline_comparison', {})

        # Determine if it's a new plan or price change
        change_type = "NEW PLAN" if opportunity['is_new_plan'] else "PRICE DROP"

        # Build message with clean bullet format
        message = f"✅ SAVINGS DETECTED! {change_type} found\n"
        message += f"Profile: {profile}\n"
        message += f"  - Previous best: {previous['name']} at ${previous['cost']:.2f}/qtr\n"
        message += f"  - Current best: {retailer} - {current['name']} at ${current['cost']:.2f}/qtr\n"
        message += f"  - Savings: ${savings['quarterly']:.2f}/qtr (${savings['annual']:.2f}/year) vs previous month\n"

        # Add baseline comparison
        if baseline:
            message += f"  - Baseline comparison:\n"
            for ret, comp in baseline.items():
                if comp['quarterly_savings'] > 0:
                    message += (
                        f"    - Save ${comp['quarterly_savings']:.2f}/qtr "
                        f"(${comp['annual_savings']:.2f}/year) vs {ret}\n"
                    )

        return message

    def format_comparison_summary(
        self,
        profile_name: str,
        cheapest_plans: Dict[str, Optional[Dict[str, Any]]],
        baseline_comparison: Optional[Dict[str, Dict[str, float]]] = None
    ) -> str:
        """
        Format summary of cheapest plans vs baseline

        Args:
            profile_name: Profile identifier
            cheapest_plans: Dict of cheapest plans by retailer
            baseline_comparison: Optional baseline comparison data

        Returns:
            Formatted summary message
        """
        profile = profile_name.replace('_', ' ').title()

        message = f"""📊 Energy Plan Monthly Summary

**Profile:** {profile}

**Cheapest Plans:**"""

        for retailer, plan in cheapest_plans.items():
            if plan:
                message += f"\n• **{retailer}:** {plan['plan_name']} - ${plan['total_cost']:.2f}/qtr"

        if baseline_comparison:
            message += "\n\n**Savings vs Baseline:**"
            for retailer, comp in baseline_comparison.items():
                if comp['quarterly_savings'] != 0:
                    symbol = "💰" if comp['quarterly_savings'] > 0 else "⚠️"
                    message += (
                        f"\n{symbol} vs {retailer} ({comp['baseline_plan_name']}): "
                        f"${abs(comp['quarterly_savings']):.2f}/qtr "
                        f"(${abs(comp['annual_savings']):.2f}/yr)"
                    )

        return message

    def send_savings_alert(self, opportunity: Dict[str, Any]) -> bool:
        """
        Send savings opportunity alert

        Args:
            opportunity: Savings opportunity data

        Returns:
            True if sent successfully, False otherwise
        """
        try:
            client = self._get_client()
            message = self.format_savings_alert(opportunity)

            self.logger.info(f"Sending savings alert to {self.chat_id}")
            response = client.send_message(self.chat_id, message)

            self.logger.info(f"Alert sent successfully: {response}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to send WhatsApp alert: {e}")
            return False

    def send_monthly_summary(
        self,
        profile_name: str,
        cheapest_plans: Dict[str, Optional[Dict[str, Any]]],
        baseline_comparison: Optional[Dict[str, Dict[str, float]]] = None
    ) -> bool:
        """
        Send monthly summary message

        Args:
            profile_name: Profile identifier
            cheapest_plans: Cheapest plans by retailer
            baseline_comparison: Optional baseline comparison

        Returns:
            True if sent successfully
        """
        try:
            client = self._get_client()
            message = self.format_comparison_summary(
                profile_name,
                cheapest_plans,
                baseline_comparison
            )

            self.logger.info(f"Sending monthly summary to {self.chat_id}")
            response = client.send_message(self.chat_id, message)

            self.logger.info(f"Summary sent successfully: {response}")
            return True

        except Exception as e:
            self.logger.error(f"Failed to send WhatsApp summary: {e}")
            return False

    def send_all_opportunities(self, opportunities: List[Dict[str, Any]]) -> int:
        """
        Send alerts for all savings opportunities

        Args:
            opportunities: List of savings opportunities

        Returns:
            Number of successfully sent alerts
        """
        if not opportunities:
            self.logger.info("No savings opportunities to report")
            return 0

        sent_count = 0

        for opportunity in opportunities:
            if self.send_savings_alert(opportunity):
                sent_count += 1

        self.logger.info(f"Sent {sent_count}/{len(opportunities)} alerts successfully")
        return sent_count


# Singleton instance
_notifier = None

def get_notifier(chat_id: Optional[str] = None) -> WhatsAppNotifier:
    """Get singleton notifier instance"""
    global _notifier
    if _notifier is None:
        _notifier = WhatsAppNotifier(chat_id=chat_id)
    return _notifier
