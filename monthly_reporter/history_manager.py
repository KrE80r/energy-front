"""
Plan History Manager
Stores and retrieves monthly snapshots of cheapest plans per profile
"""

import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


class HistoryManager:
    """Manage monthly plan history in JSON format"""

    def __init__(self, history_file_path: str = "/home/krkr/energy/data/plan_history.json"):
        self.history_file = Path(history_file_path)
        self.logger = logging.getLogger(self.__class__.__name__)
        self._ensure_history_file_exists()

    def _ensure_history_file_exists(self):
        """Create history file if it doesn't exist"""
        if not self.history_file.exists():
            self.history_file.parent.mkdir(parents=True, exist_ok=True)
            self._save_history({})
            self.logger.info(f"Created new history file: {self.history_file}")

    def _load_history(self) -> Dict[str, Any]:
        """Load history from JSON file"""
        try:
            with open(self.history_file, 'r') as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            self.logger.error(f"Invalid JSON in history file: {e}")
            return {}
        except Exception as e:
            self.logger.error(f"Error loading history: {e}")
            return {}

    def _save_history(self, history: Dict[str, Any]):
        """Save history to JSON file"""
        try:
            with open(self.history_file, 'w') as f:
                json.dump(history, f, indent=2, default=str)
            self.logger.debug(f"Saved history to {self.history_file}")
        except Exception as e:
            self.logger.error(f"Error saving history: {e}")
            raise

    def get_month_key(self, date: Optional[datetime] = None) -> str:
        """
        Get month key in YYYY-MM format

        Args:
            date: Date to convert (defaults to current month)

        Returns:
            Month key string like "2025-11"
        """
        if date is None:
            date = datetime.now()
        return date.strftime("%Y-%m")

    def save_monthly_snapshot(
        self,
        profile_name: str,
        retailer: str,
        plan_data: Dict[str, Any],
        month_key: Optional[str] = None
    ):
        """
        Save monthly snapshot for a profile and retailer

        Args:
            profile_name: Profile identifier (e.g., "commuter_solar")
            retailer: Retailer name (e.g., "AGL", "Origin Energy")
            plan_data: Plan data with cost breakdown
            month_key: Month key (defaults to current month)
        """
        if month_key is None:
            month_key = self.get_month_key()

        history = self._load_history()

        # Initialize month if not exists
        if month_key not in history:
            history[month_key] = {}

        # Initialize profile if not exists
        if profile_name not in history[month_key]:
            history[month_key][profile_name] = {}

        # Normalize retailer name
        retailer_key = retailer.lower().replace(' ', '_')

        # Save snapshot
        history[month_key][profile_name][f"{retailer_key}_cheapest"] = {
            'plan_id': plan_data.get('plan_id'),
            'plan_name': plan_data.get('plan_name'),
            'retailer_name': plan_data.get('retailer_name'),
            'total_cost': plan_data.get('total_cost'),
            'base_cost': plan_data.get('base_cost'),
            'discount_info': plan_data.get('discount_info'),
            'breakdown': plan_data.get('breakdown'),
            'saved_at': datetime.now().isoformat()
        }

        self._save_history(history)
        self.logger.info(f"Saved snapshot: {month_key}/{profile_name}/{retailer_key}")

    def get_previous_month_data(
        self,
        profile_name: str,
        retailer: str,
        months_ago: int = 1
    ) -> Optional[Dict[str, Any]]:
        """
        Get plan data from previous month(s)

        Args:
            profile_name: Profile identifier
            retailer: Retailer name
            months_ago: How many months back to look (default: 1 = last month)

        Returns:
            Plan data dict or None if not found
        """
        # Calculate target month
        from dateutil.relativedelta import relativedelta
        target_date = datetime.now() - relativedelta(months=months_ago)
        month_key = self.get_month_key(target_date)

        history = self._load_history()

        # Navigate to data
        if month_key not in history:
            self.logger.debug(f"No history for month: {month_key}")
            return None

        if profile_name not in history[month_key]:
            self.logger.debug(f"No history for profile {profile_name} in {month_key}")
            return None

        retailer_key = retailer.lower().replace(' ', '_')
        data_key = f"{retailer_key}_cheapest"

        if data_key not in history[month_key][profile_name]:
            self.logger.debug(f"No {retailer} data for {profile_name} in {month_key}")
            return None

        return history[month_key][profile_name][data_key]

    def get_all_previous_month_data(
        self,
        profile_name: str,
        months_ago: int = 1
    ) -> Dict[str, Any]:
        """
        Get all retailer data for a profile from previous month

        Args:
            profile_name: Profile identifier
            months_ago: How many months back

        Returns:
            Dict with retailer keys and their plan data
        """
        from dateutil.relativedelta import relativedelta
        target_date = datetime.now() - relativedelta(months=months_ago)
        month_key = self.get_month_key(target_date)

        history = self._load_history()

        if month_key not in history or profile_name not in history[month_key]:
            return {}

        return history[month_key][profile_name]

    def get_history_for_profile(self, profile_name: str, months: int = 12) -> Dict[str, Any]:
        """
        Get historical data for a profile across multiple months

        Args:
            profile_name: Profile identifier
            months: Number of months to retrieve

        Returns:
            Dict keyed by month with profile data
        """
        from dateutil.relativedelta import relativedelta

        result = {}
        history = self._load_history()

        for i in range(months):
            target_date = datetime.now() - relativedelta(months=i)
            month_key = self.get_month_key(target_date)

            if month_key in history and profile_name in history[month_key]:
                result[month_key] = history[month_key][profile_name]

        return result

    def cleanup_old_history(self, keep_months: int = 24):
        """
        Remove history older than specified months

        Args:
            keep_months: Number of months to keep (default: 24)
        """
        from dateutil.relativedelta import relativedelta

        history = self._load_history()
        cutoff_date = datetime.now() - relativedelta(months=keep_months)
        cutoff_key = self.get_month_key(cutoff_date)

        # Find old months
        old_months = [month for month in history.keys() if month < cutoff_key]

        if old_months:
            for month in old_months:
                del history[month]
            self._save_history(history)
            self.logger.info(f"Cleaned up {len(old_months)} old months from history")

    def get_statistics(self) -> Dict[str, Any]:
        """Get statistics about stored history"""
        history = self._load_history()

        total_months = len(history)
        total_snapshots = 0
        profiles = set()

        for month_data in history.values():
            for profile in month_data.keys():
                profiles.add(profile)
                total_snapshots += len(month_data[profile])

        return {
            'total_months': total_months,
            'total_snapshots': total_snapshots,
            'profiles_tracked': list(profiles),
            'history_file': str(self.history_file),
            'file_size_bytes': self.history_file.stat().st_size if self.history_file.exists() else 0
        }


# Singleton instance
_history_manager = None

def get_history_manager() -> HistoryManager:
    """Get singleton history manager instance"""
    global _history_manager
    if _history_manager is None:
        _history_manager = HistoryManager()
    return _history_manager
