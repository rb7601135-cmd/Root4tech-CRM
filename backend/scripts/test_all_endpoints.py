import os
import sys

# Ensure backend root is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import django
import json

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.clients.models import Client
from apps.leads.models import Lead
from apps.quotations.models import Quotation
from apps.invoices.models import Invoice

client = APIClient()

# Get administrator user
admin_user = User.objects.filter(is_superuser=True).first() or User.objects.filter(role='Administrator', is_active=True).first()
if not admin_user:
    admin_user = User.objects.create_superuser('admin@roo4tech.com', 'Admin1234!')

# Authenticate client
client.force_authenticate(user=admin_user)

endpoints_to_test = [
    ("Health Check", "GET", "/api/health/", {}, 200),
    ("Auth Current User", "GET", "/api/auth/me/", {}, 200),
    ("Team Members List", "GET", "/api/team/", {}, 200),
    ("Dashboard Stats", "GET", "/api/dashboard/stats/", {}, 200),
    ("Company Settings", "GET", "/api/company/settings/", {}, 200),
    ("Exchange Rates", "GET", "/api/company/exchange-rates/", {}, 200),
    ("Company Services Catalog", "GET", "/api/company/services/", {}, 200),
    ("Audit Logs", "GET", "/api/company/audit-logs/", {}, 200),
    ("Leads List", "GET", "/api/leads/", {}, 200),
    ("Leads Duplicate Check", "GET", "/api/leads/check_duplicate/?email=test@example.com", {}, 200),
    ("Clients List", "GET", "/api/clients/", {}, 200),
    ("Clients Duplicate Check", "GET", "/api/clients/check_duplicate/?email=test@example.com", {}, 200),
    ("Quotations List", "GET", "/api/quotations/", {}, 200),
    ("Invoices List", "GET", "/api/invoices/", {}, 200),
    ("Payments List", "GET", "/api/payments/", {}, 200),
    ("Projects List", "GET", "/api/projects/", {}, 200),
    ("Tasks List", "GET", "/api/tasks/", {}, 200),
    ("Calendar Events", "GET", "/api/calendar-events/", {}, 200),
    ("Realtime Notifications", "GET", "/api/realtime/notifications/", {}, 200),
    ("Unread Notifications Count", "GET", "/api/realtime/notifications/unread_count/", {}, 200),
    ("Automation Rules List", "GET", "/api/automation/rules/", {}, 200),
    ("Automation Logs List", "GET", "/api/automation/logs/", {}, 200),
    ("Automation Engine Run", "POST", "/api/automation/run/", {}, 200),
    ("AI Assistant Conversations", "GET", "/api/assistant/conversations/", {}, 200),
    ("AI Assistant Config", "GET", "/api/assistant/config/", {}, 200),
]

# Check existing items for detail and PDF tests
first_quote = Quotation.objects.first()
if first_quote:
    endpoints_to_test.append(("Quotation Detail", "GET", f"/api/quotations/{first_quote.id}/", {}, 200))
    endpoints_to_test.append(("Quotation PDF Generation", "GET", f"/api/quotations/{first_quote.id}/pdf/", {}, 200))

first_invoice = Invoice.objects.first()
if first_invoice:
    endpoints_to_test.append(("Invoice Detail", "GET", f"/api/invoices/{first_invoice.id}/", {}, 200))
    endpoints_to_test.append(("Invoice PDF Generation", "GET", f"/api/invoices/{first_invoice.id}/pdf/", {}, 200))

first_client = Client.objects.first()
if first_client:
    endpoints_to_test.append(("Client Detail", "GET", f"/api/clients/{first_client.id}/", {}, 200))

first_lead = Lead.objects.first()
if first_lead:
    endpoints_to_test.append(("Lead Detail", "GET", f"/api/leads/{first_lead.id}/", {}, 200))

print("=" * 85)
print(f"{'ENDPOINT NAME':<30} | {'METHOD':<6} | {'STATUS':<6} | {'RESULT':<6} | {'PATH'}")
print("=" * 85)

all_passed = True
results = []

for name, method, path, data, expected_status in endpoints_to_test:
    try:
        if method == "GET":
            response = client.get(path)
        elif method == "POST":
            response = client.post(path, data=json.dumps(data), content_type='application/json')
        elif method == "PATCH":
            response = client.patch(path, data=json.dumps(data), content_type='application/json')
        elif method == "DELETE":
            response = client.delete(path)
        else:
            response = None

        status_code = response.status_code if response else 0
        passed = status_code == expected_status
        if not passed:
            all_passed = False
            
        res_str = "PASS" if passed else f"FAIL ({status_code})"
        print(f"{name:<30} | {method:<6} | {status_code:<6} | {res_str:<6} | {path}")
        results.append({
            "name": name,
            "method": method,
            "status": status_code,
            "passed": passed,
            "path": path
        })
    except Exception as e:
        all_passed = False
        print(f"{name:<30} | {method:<6} | {'ERR':<6} | {'EXC':<6} | {path} -> {e}")
        results.append({
            "name": name,
            "method": method,
            "status": 500,
            "passed": False,
            "path": path,
            "error": str(e)
        })

print("=" * 85)
passed_count = sum(1 for r in results if r["passed"])
total_count = len(results)
print(f"SUMMARY: {passed_count}/{total_count} endpoints successfully tested and functional!")
if all_passed:
    print("ALL TESTED APIS ARE 100% OPERATIONAL!")
else:
    print("SOME APIS HAD ISSUES. CHECK DETAILS ABOVE.")
print("=" * 85)
