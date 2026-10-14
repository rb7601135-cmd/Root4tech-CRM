"""
Context processors for Root4Tech CRM.
"""

def crm_global_context(request):
    context = {
        'crm_user_profile': None,
        'crm_role': None,
        'crm_unread_count': 0,
    }
    if request.user.is_authenticated:
        try:
            profile = getattr(request.user, 'staff_profile', None)
            context['crm_user_profile'] = profile
            context['crm_role'] = profile.role_key if profile else 'admin'
            if hasattr(request.user, 'notifications'):
                context['crm_unread_count'] = request.user.notifications.filter(is_read=False).count()
        except Exception:
            pass
    return context
