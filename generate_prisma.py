import json

with open('backend/schema_dump.json', 'r') as f:
    data = json.load(f)

# Table to Model Name mapping
MODEL_MAP = {
    'accounts_user': 'User',
    'clients_client': 'Client',
    'clients_clientnote': 'ClientNote',
    'clients_clientactivity': 'ClientActivity',
    'clients_clientdocument': 'ClientDocument',
    'leads_lead': 'Lead',
    'leads_leadnote': 'LeadNote',
    'leads_leadactivity': 'LeadActivity',
    'company_companysettings': 'CompanySettings',
    'company_exchangerate': 'ExchangeRate',
    'company_auditlog': 'AuditLog',
    'company_companyservice': 'CompanyService',
    'quotations_quotation': 'Quotation',
    'quotations_quotationitem': 'QuotationItem',
    'invoices_invoice': 'Invoice',
    'invoices_invoiceitem': 'InvoiceItem',
    'invoices_payment': 'Payment',
    'projects_project': 'Project',
    'projects_projectmilestone': 'ProjectMilestone',
    'projects_task': 'Task',
    'projects_taskchecklistitem': 'TaskChecklistItem',
    'projects_taskcomment': 'TaskComment',
    'projects_projectactivity': 'ProjectActivity',
    'calendar_events_calendarevent': 'CalendarEvent',
    'automation_automationrule': 'AutomationRule',
    'automation_automationlog': 'AutomationLog',
    'realtime_notification': 'Notification',
    'assistant_conversation': 'Conversation',
    'assistant_chatmessage': 'ChatMessage',
    'assistant_actionproposal': 'ActionProposal',
    'assistant_assistantsetting': 'AssistantSetting',
}

# Determine PK type per table
pk_types = {}
for table, fields in data.items():
    for f_name, f_data in fields.items():
        if f_data.get('primary_key'):
            pk_types[table] = f_data.get('type')

def get_prisma_type(table, f_name, f_data):
    django_type = f_data.get('type')
    is_null = f_data.get('null', False)
    suffix = "?" if is_null else ""

    if django_type in ['BigAutoField', 'SmallAutoField']:
        return "BigInt" + suffix
    elif django_type == 'AutoField':
        return "Int" + suffix
    elif django_type == 'IntegerField':
        return "Int" + suffix
    elif django_type == 'PositiveIntegerField':
        return "Int" + suffix
    elif django_type == 'DecimalField':
        return "Decimal" + suffix
    elif django_type == 'FloatField':
        return "Float" + suffix
    elif django_type in ['CharField', 'TextField']:
        return "String" + suffix
    elif django_type == 'BooleanField':
        return "Boolean" + suffix
    elif django_type in ['DateTimeField', 'DateField']:
        return "DateTime" + suffix
    elif django_type == 'JSONField':
        return "Json" + suffix
    elif django_type == 'UUIDField':
        return "String" + suffix
    elif django_type == 'ForeignKey':
        target_table = f_data.get('related_table')
        target_pk = pk_types.get(target_table, 'BigAutoField')
        if target_pk in ['BigAutoField', 'AutoField', 'SmallAutoField']:
            return "BigInt" + suffix
        else:
            return "String" + suffix
    return "String" + suffix

lines = [
    '// Root4Tech Smart CRM - Prisma Schema for Supabase PostgreSQL',
    '// Introspected & mapped directly from Django database tables',
    '',
    'datasource db {',
    '  provider = "postgresql"',
    '  url      = env("DATABASE_URL")',
    '}',
    '',
    'generator client {',
    '  provider = "prisma-client-js"',
    '}',
    ''
]

for table, fields in data.items():
    model_name = MODEL_MAP.get(table, table)
    lines.append(f"model {model_name} {{")
    for f_name, f_data in fields.items():
        col_name = f_data.get('column')
        p_type = get_prisma_type(table, f_name, f_data)
        
        attributes = []
        if f_data.get('primary_key'):
            attributes.append("@id")
            if f_data.get('type') in ['BigAutoField', 'AutoField', 'SmallAutoField']:
                attributes.append("@default(autoincrement())")
        elif f_data.get('unique'):
            attributes.append("@unique")

        if col_name != f_name:
            attributes.append(f'@map("{col_name}")')

        attr_str = (" " + " ".join(attributes)) if attributes else ""
        lines.append(f"  {f_name:<26} {p_type:<12}{attr_str}")
    lines.append(f'  @@map("{table}")')
    lines.append("}")
    lines.append("")

with open('backend-node/prisma/schema.prisma', 'w', encoding='utf-8') as f:
    f.write("\n".join(lines))

print("schema.prisma regenerated successfully!")
