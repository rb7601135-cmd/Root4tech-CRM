import json
import os

with open(os.path.join(os.path.dirname(__file__), '..', 'schema_dump.json')) as f:
    data = json.load(f)

# Table to Model name mapping
table_to_model = {
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
    'assistant_assistantsetting': 'AssistantSetting'
}

type_map = {
    'BigAutoField': 'BigInt',
    'AutoField': 'Int',
    'IntegerField': 'Int',
    'PositiveIntegerField': 'Int',
    'SmallIntegerField': 'Int',
    'PositiveSmallIntegerField': 'Int',
    'CharField': 'String',
    'TextField': 'String',
    'EmailField': 'String',
    'FileField': 'String',
    'ImageField': 'String',
    'BooleanField': 'Boolean',
    'DateTimeField': 'DateTime',
    'DateField': 'DateTime',
    'TimeField': 'DateTime',
    'DecimalField': 'Decimal',
    'FloatField': 'Float',
    'UUIDField': 'String',
    'JSONField': 'Json'
}

out = []
out.append('// Root4Tech Smart CRM - Prisma Schema for Supabase PostgreSQL')
out.append('// Introspected & mapped directly from Django database tables')
out.append('')
out.append('datasource db {')
out.append('  provider = "postgresql"')
out.append('  url      = env("DATABASE_URL")')
out.append('}')
out.append('')
out.append('generator client {')
out.append('  provider = "prisma-client-js"')
out.append('}')
out.append('')

for tbl, fields in data.items():
    model_name = table_to_model.get(tbl, tbl.title().replace('_', ''))
    out.append(f'model {model_name} {{')
    
    for fname, finfo in fields.items():
        col_name = finfo['column']
        django_type = finfo['type']
        prisma_type = type_map.get(django_type, 'String')
        
        is_pk = finfo['primary_key']
        is_null = finfo['null']
        is_unique = finfo['unique']
        
        type_str = prisma_type
        if is_null and not is_pk:
            type_str += '?'
            
        attributes = []
        if is_pk:
            attributes.append('@id')
            if django_type in ['BigAutoField', 'AutoField']:
                attributes.append('@default(autoincrement())')
        elif is_unique:
            attributes.append('@unique')
            
        if col_name != fname or col_name.endswith('_id'):
            attributes.append(f'@map("{col_name}")')
            
        attr_str = (' ' + ' '.join(attributes)) if attributes else ''
        out.append(f'  {fname:<26} {type_str:<12}{attr_str}')
        
    out.append(f'  @@map("{tbl}")')
    out.append('}')
    out.append('')

prisma_file = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'backend-node', 'prisma', 'schema.prisma'))
os.makedirs(os.path.dirname(prisma_file), exist_ok=True)
with open(prisma_file, 'w') as f:
    f.write('\n'.join(out))

print(f"Generated schema at: {prisma_file}")

