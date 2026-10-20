from django.core.management.base import BaseCommand
from apps.accounts.models import User
from apps.company.models import CompanySettings, record_audit_log
from apps.clients.models import Client, ClientNote, ClientActivity
from apps.leads.models import Lead, LeadNote, LeadActivity
from django.utils import timezone
from datetime import timedelta, date

class Command(BaseCommand):
    help = 'Seeds initial users, company settings, and sample leads/clients for Roo4Tech CRM'

    def handle(self, *args, **options):
        self.stdout.write("Seeding Roo4Tech CRM initial data...")

        # 1. Company Settings
        settings_obj = CompanySettings.get_solo()
        settings_obj.company_name = 'Roo4Tech'
        settings_obj.email = 'contact@roo4tech.com'
        settings_obj.phone = '+92 300 8472910'
        settings_obj.website = 'https://roo4tech.com'
        settings_obj.address = 'Arfa Software Technology Park, Ferozepur Road, Lahore, Pakistan'
        settings_obj.default_currency = 'PKR'
        settings_obj.theme_preference = 'dark'
        settings_obj.save()
        self.stdout.write(self.style.SUCCESS(f"Company settings initialized for {settings_obj.company_name} (Currency: {settings_obj.default_currency})"))

        # 2. Team Accounts
        admin, _ = User.objects.get_or_create(
            email='admin@roo4tech.com',
            defaults={
                'username': 'admin',
                'first_name': 'Roo4Tech',
                'last_name': 'Admin',
                'role': User.Role.ADMINISTRATOR,
                'phone': '+92 300 8472910',
                'is_staff': True,
                'is_superuser': True,
                'is_active': True,
            }
        )
        admin.set_password('AdminPassword2026!')
        admin.is_active = True
        admin.is_staff = True
        admin.is_superuser = True
        admin.save()
        self.stdout.write(self.style.SUCCESS("Admin account ready: admin@roo4tech.com"))

        manager, _ = User.objects.get_or_create(
            email='salesmanager@roo4tech.com',
            defaults={
                'username': 'salesmanager',
                'first_name': 'Hamza',
                'last_name': 'Tariq',
                'role': User.Role.SALES_MANAGER,
                'phone': '+92 321 4455667',
                'is_active': True,
            }
        )
        manager.set_password('SalesPassword2026!')
        manager.is_active = True
        manager.save()
        self.stdout.write(self.style.SUCCESS("Sales Manager account ready: salesmanager@roo4tech.com"))

        salesperson, _ = User.objects.get_or_create(
            email='sales@roo4tech.com',
            defaults={
                'username': 'salesperson',
                'first_name': 'Zain',
                'last_name': 'Ali',
                'role': User.Role.SALESPERSON,
                'phone': '+92 333 9988776',
                'is_active': True,
            }
        )
        salesperson.set_password('SalesPassword2026!')
        salesperson.is_active = True
        salesperson.save()
        self.stdout.write(self.style.SUCCESS("Salesperson account ready: sales@roo4tech.com"))

        developer, _ = User.objects.get_or_create(
            email='dev@roo4tech.com',
            defaults={
                'username': 'developer',
                'first_name': 'Usman',
                'last_name': 'Khan',
                'role': User.Role.DEVELOPER,
                'phone': '+92 345 1122334',
                'is_active': True,
            }
        )
        developer.set_password('DevPassword2026!')
        developer.is_active = True
        developer.save()

        # 3. Sample Clients
        c1, _ = Client.objects.get_or_create(
            email='ceo@techpulse.io',
            defaults={
                'name': 'Bilal Ahmed',
                'company_name': 'TechPulse Global',
                'phone': '+92 301 5551234',
                'website': 'https://techpulse.io',
                'billing_address': 'Floor 4, IT Tower, Hali Road, Gulberg, Lahore',
                'service_interests': 'Custom Web Application, Next.js Development',
                'client_status': Client.Status.ACTIVE,
                'assigned_team_member': salesperson,
                'notes': 'High-priority enterprise software development client.',
                'created_by': admin,
                'updated_by': admin,
            }
        )

        c2, _ = Client.objects.get_or_create(
            email='contact@horizonlogistics.pk',
            defaults={
                'name': 'Farhan Sheikh',
                'company_name': 'Horizon Logistics Pakistan',
                'phone': '+92 312 8887766',
                'website': 'https://horizonlogistics.pk',
                'billing_address': 'Plot 12, Sector I-9/2, Islamabad',
                'service_interests': 'ERP Solution, Fleet Tracking API',
                'client_status': Client.Status.ACTIVE,
                'assigned_team_member': manager,
                'notes': 'Long-term maintenance contract signed.',
                'created_by': manager,
                'updated_by': manager,
            }
        )

        # 4. Sample Leads
        l1, _ = Lead.objects.get_or_create(
            email='info@apexfintech.com',
            defaults={
                'lead_name': 'Saad Qureshi',
                'company': 'Apex FinTech Solutions',
                'phone': '+92 300 4433221',
                'website': 'https://apexfintech.com',
                'interested_service': 'Django REST Backend & Mobile App API',
                'estimated_budget': 850000.00,
                'lead_source': Lead.Source.WEBSITE,
                'assigned_salesperson': salesperson,
                'status': Lead.Status.QUALIFIED,
                'priority': Lead.Priority.HIGH,
                'next_follow_up_date': date.today() + timedelta(days=2),
                'notes': 'Requested a formal proposal for banking integration.',
                'created_by': salesperson,
            }
        )

        l2, _ = Lead.objects.get_or_create(
            email='media@creativestudio.ae',
            defaults={
                'lead_name': 'Omar Al-Hashimi',
                'company': 'Creative Edge Media Dubai',
                'phone': '+971 50 1234567',
                'website': 'https://creativeedge.ae',
                'interested_service': 'Corporate Video Production & Motion Graphics',
                'estimated_budget': 1200000.00,
                'lead_source': Lead.Source.LINKEDIN,
                'assigned_salesperson': manager,
                'status': Lead.Status.PROPOSAL,
                'priority': Lead.Priority.URGENT,
                'next_follow_up_date': date.today() + timedelta(days=1),
                'notes': 'Commercial ad campaign for GCC market.',
                'created_by': manager,
            }
        )

        l3, _ = Lead.objects.get_or_create(
            email='founder@swiftcart.pk',
            defaults={
                'lead_name': 'Ayesha Malik',
                'company': 'SwiftCart E-Commerce',
                'phone': '+92 322 7776655',
                'website': 'https://swiftcart.pk',
                'interested_service': 'Custom Next.js & Shopify Storefront',
                'estimated_budget': 450000.00,
                'lead_source': Lead.Source.REFERRAL,
                'assigned_salesperson': salesperson,
                'status': Lead.Status.NEW,
                'priority': Lead.Priority.MEDIUM,
                'next_follow_up_date': date.today() + timedelta(days=4),
                'notes': 'Initial inquiry through partner referral.',
                'created_by': admin,
            }
        )

        # Audit logs for seed
        record_audit_log(
            user=admin,
            action='SYSTEM_SEEDED',
            module='SETTINGS',
            entity_id='SYS-01',
            description="System successfully seeded with initial accounts and baseline CRM records."
        )

        self.stdout.write(self.style.SUCCESS("CRM seeded successfully!"))
