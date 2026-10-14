"""
Role-based Permissions and Access Control for Root4Tech CRM.
"""

from rest_framework import permissions


def get_user_role(user):
    if not user or not user.is_authenticated:
        return None
    if user.is_superuser:
        return 'admin'
    if hasattr(user, 'staff_profile'):
        return user.staff_profile.role_key
    return None


class IsAdminOrSuperuser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and (request.user.is_superuser or get_user_role(request.user) == 'admin'))


class IsSalesManagerOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        return bool(role in ['sales_mgr', 'admin'] or (request.user and request.user.is_superuser))


class CanAccessLeads(permissions.BasePermission):
    """
    Sales Manager & Admin: Full CRUD on all leads.
    Salesperson: Can create leads and view/update leads assigned to them.
    Developer & Video Editor: No access to sales pipeline leads.
    """
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        return bool(role in ['sales_mgr', 'sales', 'admin'] or (request.user and request.user.is_superuser))

    def has_object_permission(self, request, view, obj):
        role = get_user_role(request.user)
        if role in ['sales_mgr', 'admin'] or request.user.is_superuser:
            return True
        if role == 'sales':
            # Salesperson can only access unassigned or their assigned leads
            return obj.assigned_salesperson == request.user or obj.assigned_salesperson is None
        return False


class CanAccessClients(permissions.BasePermission):
    """
    Sales Manager, Salesperson & Admin can access clients.
    Developers & Video Editors can view clients linked to their assigned projects.
    """
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        return bool(role in ['sales_mgr', 'sales', 'dev', 'editor', 'admin'] or (request.user and request.user.is_superuser))

    def has_object_permission(self, request, view, obj):
        role = get_user_role(request.user)
        if role in ['sales_mgr', 'sales', 'admin'] or request.user.is_superuser:
            return True
        if role in ['dev', 'editor']:
            # Read-only if assigned to any client project
            if request.method in permissions.SAFE_METHODS:
                return obj.projects.filter(assigned_staff=request.user).exists()
            return False
        return False


class CanAccessProjects(permissions.BasePermission):
    """
    Sales Manager & Admin: Full CRUD.
    Developers & Editors: View assigned projects, update status/progress/notes/links.
    Salesperson: Read-only access to projects.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        role = get_user_role(request.user)
        if role in ['sales_mgr', 'admin'] or request.user.is_superuser:
            return True
        if role in ['dev', 'editor']:
            # Staff can read and update (including ready-for-review) assigned projects
            if request.user in obj.assigned_staff.all():
                if request.method in permissions.SAFE_METHODS or request.method in ['PATCH', 'PUT', 'POST']:
                    return True
            return False
        if role == 'sales':
            return request.method in permissions.SAFE_METHODS
        return False


class CanAccessBilling(permissions.BasePermission):
    """
    Strict financial protection:
    Invoices, Quotations, and Financial Reports are only accessible to Sales Manager & Admin.
    Developers, Video Editors, and ordinary Salespeople are blocked on server-side.
    """
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        return bool(role in ['sales_mgr', 'admin'] or (request.user and request.user.is_superuser))
