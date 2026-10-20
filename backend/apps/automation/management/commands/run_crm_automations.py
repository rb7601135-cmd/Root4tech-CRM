from django.core.management.base import BaseCommand
from apps.automation.services import AutomationEngine

class Command(BaseCommand):
    help = 'Executes scheduled CRM automations (due dates, expiry reminders, alerts) with deduplication.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Starting CRM automated workflows cycle..."))
        results = AutomationEngine.run_all()
        self.stdout.write(self.style.SUCCESS(f"Automation cycle completed: {results}"))
