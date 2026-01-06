"""
Monthly Energy Plan Reporter
Automated system for detecting cheaper energy plans and sending WhatsApp alerts
"""

__version__ = "1.0.0"

from .cost_calculator import get_calculator, CostCalculator
from .history_manager import get_history_manager, HistoryManager
from .comparison_engine import get_comparison_engine, ComparisonEngine
from .whatsapp_notifier import get_notifier, WhatsAppNotifier

__all__ = [
    'get_calculator',
    'get_history_manager',
    'get_comparison_engine',
    'get_notifier',
    'CostCalculator',
    'HistoryManager',
    'ComparisonEngine',
    'WhatsAppNotifier',
]
