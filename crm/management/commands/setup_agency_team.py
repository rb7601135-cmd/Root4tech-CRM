"""
Root4Tech CRM - Setup Real Agency Team & Clean Database Command
Wipes demo data (leads, clients, projects, tasks, invoices, quotations, followups)
and registers the real Root4Tech team members with their authentic profiles and logins.
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User, Group
from crm.models import (
    StaffProfile, Service, Client, Lead, Project, Task,
    FollowUp, Quotation, Invoice, BillingItem, Payment,
    Notification, ActivityLog, AgencySetting
)


class Command(BaseCommand):
    help = 'Cleans demo data and sets up real Root4Tech team members (Sir Ali, Sir Murad, Sir Sharjeel, and Admin).'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Cleaning demo data from Root4Tech CRM...'))

        # 1. Delete all demo transactions & operational entities
        Payment.objects.all().delete()
        BillingItem.objects.all().delete()
        Invoice.objects.all().delete()
        Quotation.objects.all().delete()
        Task.objects.all().delete()
        Project.objects.all().delete()
        FollowUp.objects.all().delete()
        Lead.objects.all().delete()
        Client.objects.all().delete()
        Notification.objects.all().delete()
        ActivityLog.objects.all().delete()

        self.stdout.write(self.style.SUCCESS('Successfully cleared all demo leads, projects, clients, and invoices.'))

        # 2. Ensure Groups exist
        groups = {
            'sales_mgr': 'Sales Manager',
            'sales': 'Salesperson',
            'dev': 'Full-Stack Developer',
            'editor': 'Video Editor',
            'admin': 'System Administrator',
        }
        group_objs = {}
        for role_key, group_name in groups.items():
            g, _ = Group.objects.get_or_create(name=group_name)
            group_objs[role_key] = g

        # 3. Clean old demo users
        demo_usernames = ['david', 'sarah', 'alex', 'maya']
        deleted_count, _ = User.objects.filter(username__in=demo_usernames).delete()
        if deleted_count > 0:
            self.stdout.write(self.style.WARNING(f"Removed {deleted_count} legacy demo staff accounts."))

        # 4. Define Real Root4Tech Team Members
        team = [
            {
                'username': 'sharjeel',
                'first_name': 'Sir',
                'last_name': 'Sharjeel',
                'email': 'sharjeel@root4tech.com',
                'password': 'Sharjeel@Root4Tech2026!',
                'role_key': 'sales_mgr',
                'role_title': 'Sales Manager',
                'phone': '+1 (555) 492-1144',
                'avatar': 'SS',
                'color': '#059669',
                'skills': ['Sales Management', 'Pipeline Strategy', 'Deal Closing', 'Client Acquisition', 'Agency Growth'],
                'is_staff': True,
                'is_superuser': False,
            },
            {
                'username': 'ali',
                'first_name': 'Sir',
                'last_name': 'Ali',
                'email': 'ali@root4tech.com',
                'password': 'Ali@Root4Tech2026!',
                'role_key': 'dev',
                'role_title': 'Full-Stack Developer',
                'phone': '+1 (555) 349-2180',
                'avatar': 'SA',
                'color': '#2563eb',
                'skills': ['Full-Stack Development', 'React', 'Django', 'REST APIs', 'PostgreSQL', 'Cloud Infrastructure'],
                'is_staff': True,
                'is_superuser': False,
            },
            {
                'username': 'murad',
                'first_name': 'Sir',
                'last_name': 'Murad',
                'email': 'murad@root4tech.com',
                'password': 'Murad@Root4Tech2026!',
                'role_key': 'editor',
                'role_title': 'Video Editor',
                'phone': '+1 (555) 781-9921',
                'avatar': 'SM',
                'color': '#7e22ce',
                'skills': ['Video Editing', 'DaVinci Resolve', 'Color Grading', 'After Effects', 'Premiere Pro', 'Visual Effects'],
                'is_staff': True,
                'is_superuser': False,
            },
            {
                'username': 'admin',
                'first_name': 'Root4Tech',
                'last_name': 'Admin',
                'email': 'admin@root4tech.com',
                'password': 'Admin@Root4Tech2026!',
                'role_key': 'admin',
                'role_title': 'Agency Administrator',
                'phone': '+1 (555) 010-0001',
                'avatar': 'RA',
                'color': '#0f172a',
                'skills': ['Agency Operations', 'System Administration', 'Access Control', 'Finance'],
                'is_staff': True,
                'is_superuser': True,
            },
        ]

        # 5. Create or update each team member
        for m in team:
            user, created = User.objects.get_or_create(username=m['username'])
            user.first_name = m['first_name']
            user.last_name = m['last_name']
            user.email = m['email']
            user.is_staff = m['is_staff']
            user.is_superuser = m['is_superuser']
            user.set_password(m['password'])
            user.save()

            # Assign group
            user.groups.clear()
            if m['role_key'] in group_objs:
                user.groups.add(group_objs[m['role_key']])

            # Profile
            profile, _ = StaffProfile.objects.get_or_create(user=user)
            profile.role_key = m['role_key']
            profile.role_title = m['role_title']
            profile.phone = m['phone']
            profile.avatar = m['avatar']
            profile.color = m['color']
            profile.skills = m['skills']
            profile.status = 'Active'
            profile.save()

            action_type = "Created" if created else "Updated"
            self.stdout.write(self.style.SUCCESS(
                f"[{action_type}] {m['first_name']} {m['last_name']} ({m['role_title']}) -> Username: {m['username']} | Email: {m['email']}"
            ))

        # 6. Ensure Core Agency Services exist
        services = [
            ('Website Development', 'Development', '5500.00', 'per project'),
            ('Mobile App Development', 'Development', '8500.00', 'per project'),
            ('Video Production & Commercial Cut', 'Video Production', '3500.00', 'per video'),
            ('Short-Form Reels & TikToks', 'Video Production', '1200.00', 'per batch'),
            ('Brand Identity & Logo Design', 'Design & Marketing', '2800.00', 'per brand'),
            ('Search Engine Optimization (SEO)', 'Design & Marketing', '1500.00', 'per month'),
        ]
        for name, cat, price, unit in services:
            Service.objects.get_or_create(
                name=name,
                defaults={'category': cat, 'price': price, 'unit': unit}
            )

        # 7. Ensure Agency Settings
        AgencySetting.get_settings()

        # Log system setup activity
        ActivityLog.objects.create(
            user=None,
            action='Setup Real Agency Team',
            entity_type='Staff',
            entity_id='team_setup',
            details='Wiped demo leads/projects and configured Sir Ali, Sir Murad, Sir Sharjeel, and Admin.'
        )

        self.stdout.write(self.style.SUCCESS('\nReal Root4Tech team setup complete and ready to use!'))
