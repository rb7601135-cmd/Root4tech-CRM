from rest_framework import permissions
from .models import User

class IsAdminUserRole(permissions.BasePermission):
    """
    Allows access only to users with the Administrator role or superusers.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.is_active and
            request.user.is_administrator
        )


class IsSalesManagerOrAdmin(permissions.BasePermission):
    """
    Allows access to Sales Managers and Administrators.
    """
    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.is_active and
            (request.user.is_administrator or request.user.is_sales_manager)
        )

IsAdminOrSalesManager = IsSalesManagerOrAdmin


class CanManageLeads(permissions.BasePermission):
    """
    Admins and Sales Managers can view/edit all leads.
    Salespeople can create leads and view/edit leads assigned to them.
    Developers and Video Editors have read-only access if authenticated.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated and request.user.is_active):
            return False

        if request.user.is_administrator or request.user.is_sales_manager or request.user.is_salesperson:
            return True

        # Read-only for other team roles (Developer, Video Editor)
        if request.method in permissions.SAFE_METHODS:
            return True

        return False

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated and request.user.is_active):
            return False

        if request.user.is_administrator or request.user.is_sales_manager:
            return True

        if request.user.is_salesperson:
            # Salespeople can manage their assigned leads or unassigned ones
            if request.method in permissions.SAFE_METHODS:
                return True
            return obj.assigned_salesperson == request.user or obj.assigned_salesperson is None or obj.created_by == request.user

        if request.method in permissions.SAFE_METHODS:
            return True

        return False


class CanManageClients(permissions.BasePermission):
    """
    Admins and Sales Managers have full client access.
    Salespeople can view all clients and edit clients assigned to them or created by them.
    Other roles have read-only access.
    """
    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated and request.user.is_active):
            return False

        if request.user.is_administrator or request.user.is_sales_manager:
            return True

        if request.user.is_salesperson:
            return True

        if request.method in permissions.SAFE_METHODS:
            return True

        return False

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated and request.user.is_active):
            return False

        if request.user.is_administrator or request.user.is_sales_manager:
            return True

        if request.user.is_salesperson:
            if request.method in permissions.SAFE_METHODS:
                return True
            # For write operations: must be assigned or created by
            return obj.assigned_team_member == request.user or obj.created_by == request.user

        if request.method in permissions.SAFE_METHODS:
            return True

        return False
