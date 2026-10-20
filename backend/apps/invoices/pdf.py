import io
from decimal import Decimal
from django.conf import settings
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from apps.company.models import CompanySettings

def generate_invoice_pdf(invoice):
    """
    Generates a branded PDF invoice for Roo4Tech.
    Preserves historical client_snapshot.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    story = []
    styles = getSampleStyleSheet()

    company = CompanySettings.get_solo()
    company_name = company.company_name or "Roo4Tech"
    company_email = company.email or "contact@roo4tech.com"
    company_phone = company.phone or "+92 300 1234567"
    company_address = company.address or "Lahore, Pakistan"
    company_website = company.website or "https://roo4tech.com"

    snap = invoice.client_snapshot or {}
    client_id = snap.get('client_id') or invoice.client.client_id
    client_name = snap.get('name') or invoice.client.name
    client_company = snap.get('company_name') or invoice.client.company_name or ""
    client_email = snap.get('email') or invoice.client.email
    client_phone = snap.get('phone') or invoice.client.phone or ""
    client_address = snap.get('billing_address') or invoice.client.billing_address or "N/A"

    brand_primary = colors.HexColor("#0f172a") # dark slate
    brand_blue = colors.HexColor("#0284c7")    # sky 600
    brand_green = colors.HexColor("#16a34a")   # green 600
    text_muted = colors.HexColor("#64748b")

    title_style = ParagraphStyle('DocTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=22, leading=26, textColor=brand_blue)
    company_style = ParagraphStyle('CompanyInfo', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, textColor=text_muted)
    header_right = ParagraphStyle('HeaderRight', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, alignment=2, textColor=brand_primary)
    section_title = ParagraphStyle('SectionTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=11, leading=15, textColor=brand_primary)
    cell_style = ParagraphStyle('Cell', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=12)
    cell_bold = ParagraphStyle('CellBold', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, leading=12)

    # Top Header
    left_header = [
        Paragraph(f"<b>{company_name}</b>", ParagraphStyle('BName', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=16, leading=19, textColor=brand_primary)),
        Paragraph(f"{company_address}", company_style),
        Paragraph(f"Email: {company_email} | Phone: {company_phone}", company_style),
        Paragraph(f"Web: {company_website}", company_style),
    ]

    status_color = "#16a34a" if invoice.status == 'Paid' else ("#dc2626" if invoice.status == 'Overdue' else "#0284c7")
    right_header = [
        Paragraph("TAX INVOICE", title_style),
        Spacer(1, 4),
        Paragraph(f"<b>Invoice #:</b> {invoice.invoice_number}", header_right),
        Paragraph(f"<b>Date:</b> {invoice.issue_date.strftime('%b %d, %Y')}", header_right),
        Paragraph(f"<b>Due Date:</b> {invoice.due_date.strftime('%b %d, %Y') if invoice.due_date else 'Upon Receipt'}", header_right),
        Paragraph(f"<b>Status:</b> <font color='{status_color}'><b>{invoice.status.upper()}</b></font>", header_right),
        Paragraph(f"<b>Currency:</b> {invoice.currency}", header_right),
    ]

    header_table = Table([[left_header, right_header]], colWidths=[4.0 * inch, 3.2 * inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="100%", thickness=1.5, color=brand_blue, spaceBefore=4, spaceAfter=15))

    # Bill To
    client_box = [
        Paragraph("<b>BILLED TO:</b>", section_title),
        Spacer(1, 3),
        Paragraph(f"<b>{client_name}</b>" + (f" ({client_company})" if client_company else ""), cell_bold),
        Paragraph(f"<b>Client ID:</b> {client_id}", company_style),
        Paragraph(f"<b>Email:</b> {client_email} | <b>Phone:</b> {client_phone or 'N/A'}", company_style),
        Paragraph(f"<b>Billing Address:</b> {client_address}", company_style),
    ]

    meta_box = [
        Paragraph("<b>INVOICE SUMMARY:</b>", section_title),
        Spacer(1, 3),
        Paragraph(f"<b>Title:</b> {invoice.title}", company_style),
        Paragraph(f"<b>Quotation Ref:</b> {invoice.quotation.quotation_number if invoice.quotation else 'Direct / N/A'}", company_style),
        Paragraph(f"<b>Project Ref:</b> {invoice.project.project_code if invoice.project else 'N/A'}", company_style),
        Paragraph(f"<b>Base Rate:</b> 1 {invoice.currency} = {invoice.exchange_rate_to_base} PKR", company_style),
    ]

    info_table = Table([[client_box, meta_box]], colWidths=[4.2 * inch, 3.0 * inch])
    info_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#e2e8f0")),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 15))

    # Line Items Table
    table_data = [
        [
            Paragraph("<b>#</b>", cell_bold),
            Paragraph("<b>Description / Services Rendered</b>", cell_bold),
            Paragraph("<b>Qty</b>", cell_bold),
            Paragraph(f"<b>Unit Price ({invoice.currency})</b>", cell_bold),
            Paragraph(f"<b>Total ({invoice.currency})</b>", cell_bold),
        ]
    ]

    idx = 1
    for item in invoice.items.all():
        table_data.append([
            Paragraph(str(idx), cell_style),
            Paragraph(item.description, cell_style),
            Paragraph(f"{item.quantity:g}", cell_style),
            Paragraph(f"{item.unit_price:,.2f}", cell_style),
            Paragraph(f"{item.line_total:,.2f}", cell_style),
        ])
        idx += 1

    if idx == 1:
        table_data.append([
            Paragraph("1", cell_style),
            Paragraph(invoice.title, cell_style),
            Paragraph("1", cell_style),
            Paragraph(f"{invoice.total_amount:,.2f}", cell_style),
            Paragraph(f"{invoice.total_amount:,.2f}", cell_style),
        ])

    items_table = Table(table_data, colWidths=[0.5 * inch, 3.7 * inch, 0.7 * inch, 1.1 * inch, 1.2 * inch])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0f172a")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
        ('ALIGN', (0,0), (0,-1), 'CENTER'),
        ('ALIGN', (2,0), (-1,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 10))

    # Summary Totals Box
    summary_data = [
        [Paragraph("<b>Subtotal:</b>", cell_style), Paragraph(f"<b>{invoice.subtotal:,.2f} {invoice.currency}</b>", cell_bold)],
    ]
    if invoice.discount_amount > 0:
        summary_data.append([
            Paragraph(f"Discount ({invoice.discount_percentage:g}%):", cell_style),
            Paragraph(f"-{invoice.discount_amount:,.2f} {invoice.currency}", cell_style)
        ])
    if invoice.tax_amount > 0:
        summary_data.append([
            Paragraph(f"Tax / VAT ({invoice.tax_percentage:g}%):", cell_style),
            Paragraph(f"+{invoice.tax_amount:,.2f} {invoice.currency}", cell_style)
        ])
    summary_data.append([
        Paragraph("<b>TOTAL AMOUNT:</b>", ParagraphStyle('GTL', parent=cell_bold, fontSize=11, textColor=brand_primary)),
        Paragraph(f"<b>{invoice.total_amount:,.2f} {invoice.currency}</b>", ParagraphStyle('GTR', parent=cell_bold, fontSize=11, textColor=brand_primary))
    ])
    summary_data.append([
        Paragraph("<b>Total Paid:</b>", cell_style),
        Paragraph(f"<font color='#16a34a'><b>-{invoice.amount_paid:,.2f} {invoice.currency}</b></font>", cell_bold)
    ])
    balance_color = "#dc2626" if invoice.remaining_balance > 0 else "#16a34a"
    summary_data.append([
        Paragraph("<b>BALANCE DUE:</b>", ParagraphStyle('BDL', parent=cell_bold, fontSize=11, textColor=colors.HexColor(balance_color))),
        Paragraph(f"<b>{invoice.remaining_balance:,.2f} {invoice.currency}</b>", ParagraphStyle('BDR', parent=cell_bold, fontSize=11, textColor=colors.HexColor(balance_color)))
    ])

    summary_table = Table(summary_data, colWidths=[2.2 * inch, 1.8 * inch], hAlign='RIGHT')
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f1f5f9")),
        ('ALIGN', (0,0), (0,-1), 'RIGHT'),
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 15))

    # Terms & Conditions
    if invoice.terms_and_conditions:
        story.append(Paragraph("<b>PAYMENT INSTRUCTIONS & TERMS:</b>", section_title))
        story.append(Spacer(1, 3))
        for line in invoice.terms_and_conditions.split('\n'):
            if line.strip():
                story.append(Paragraph(line, company_style))
        story.append(Spacer(1, 15))

    # Payment Records table if payments exist
    if invoice.payments.exists():
        story.append(Paragraph("<b>PAYMENT HISTORY & TRANSACTIONS:</b>", section_title))
        story.append(Spacer(1, 4))
        p_data = [
            [
                Paragraph("<b>Receipt #</b>", cell_bold),
                Paragraph("<b>Date</b>", cell_bold),
                Paragraph("<b>Method</b>", cell_bold),
                Paragraph("<b>Reference</b>", cell_bold),
                Paragraph(f"<b>Amount ({invoice.currency})</b>", cell_bold),
            ]
        ]
        for p in invoice.payments.all():
            p_data.append([
                Paragraph(p.receipt_number, cell_style),
                Paragraph(p.payment_date.strftime('%b %d, %Y'), cell_style),
                Paragraph(p.payment_method, cell_style),
                Paragraph(p.transaction_reference or "N/A", cell_style),
                Paragraph(f"{p.amount:,.2f}", cell_style),
            ])
        p_table = Table(p_data, colWidths=[1.5 * inch, 1.2 * inch, 1.5 * inch, 1.5 * inch, 1.5 * inch])
        p_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#e2e8f0")),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
            ('ALIGN', (-1,0), (-1,-1), 'RIGHT'),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(p_table)
        story.append(Spacer(1, 20))

    # Signature
    sig_data = [
        [
            Paragraph("Prepared by:<br/><br/>_______________________<br/><b>Accounts Department</b>", company_style),
            Paragraph("Authorized Signature:<br/><br/>_______________________<br/><b>Roo4Tech Management</b>", company_style)
        ]
    ]
    sig_table = Table(sig_data, colWidths=[3.6 * inch, 3.6 * inch])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(sig_table)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


def generate_receipt_pdf(payment):
    """
    Generates an official payment receipt PDF.
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    story = []
    styles = getSampleStyleSheet()

    company = CompanySettings.get_solo()
    company_name = company.company_name or "Roo4Tech"
    company_email = company.email or "contact@roo4tech.com"
    company_phone = company.phone or "+92 300 1234567"
    company_address = company.address or "Lahore, Pakistan"

    brand_primary = colors.HexColor("#0f172a")
    brand_green = colors.HexColor("#16a34a")
    text_muted = colors.HexColor("#64748b")

    title_style = ParagraphStyle('DocTitle', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=22, leading=26, textColor=brand_green)
    company_style = ParagraphStyle('CompanyInfo', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, textColor=text_muted)
    header_right = ParagraphStyle('HeaderRight', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, alignment=2, textColor=brand_primary)
    cell_style = ParagraphStyle('Cell', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=12)
    cell_bold = ParagraphStyle('CellBold', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, leading=12)

    left_header = [
        Paragraph(f"<b>{company_name}</b>", ParagraphStyle('BName', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=16, leading=19, textColor=brand_primary)),
        Paragraph(f"{company_address}", company_style),
        Paragraph(f"Email: {company_email} | Phone: {company_phone}", company_style),
    ]

    right_header = [
        Paragraph("PAYMENT RECEIPT", title_style),
        Spacer(1, 4),
        Paragraph(f"<b>Receipt #:</b> {payment.receipt_number}", header_right),
        Paragraph(f"<b>Date:</b> {payment.payment_date.strftime('%b %d, %Y')}", header_right),
        Paragraph(f"<b>Invoice #:</b> {payment.invoice.invoice_number}", header_right),
    ]

    header_table = Table([[left_header, right_header]], colWidths=[4.0 * inch, 3.2 * inch])
    story.append(header_table)
    story.append(Spacer(1, 15))
    story.append(HRFlowable(width="100%", thickness=1.5, color=brand_green, spaceBefore=4, spaceAfter=15))

    details = [
        [Paragraph("<b>Received From:</b>", cell_style), Paragraph(f"<b>{payment.client.name}</b> ({payment.client.client_id})", cell_bold)],
        [Paragraph("<b>Company:</b>", cell_style), Paragraph(payment.client.company_name or "N/A", cell_style)],
        [Paragraph("<b>Amount Received:</b>", cell_style), Paragraph(f"<font color='#16a34a' size='13'><b>{payment.amount:,.2f} {payment.currency}</b></font>", cell_bold)],
        [Paragraph("<b>Payment Method:</b>", cell_style), Paragraph(payment.payment_method, cell_style)],
        [Paragraph("<b>Transaction Ref:</b>", cell_style), Paragraph(payment.transaction_reference or "N/A", cell_style)],
        [Paragraph("<b>For Invoice:</b>", cell_style), Paragraph(f"{payment.invoice.invoice_number} (Total: {payment.invoice.total_amount:,.2f} {payment.invoice.currency})", cell_style)],
        [Paragraph("<b>Remaining Balance:</b>", cell_style), Paragraph(f"<b>{payment.invoice.remaining_balance:,.2f} {payment.invoice.currency}</b>", cell_bold)],
        [Paragraph("<b>Notes:</b>", cell_style), Paragraph(payment.notes or "Payment received with thanks.", cell_style)],
    ]

    details_table = Table(details, colWidths=[2.2 * inch, 5.0 * inch])
    details_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('TOPPADDING', (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
        ('LEFTPADDING', (0,0), (-1,-1), 10),
        ('RIGHTPADDING', (0,0), (-1,-1), 10),
    ]))
    story.append(details_table)
    story.append(Spacer(1, 30))

    sig_data = [
        [
            Paragraph("Received by:<br/><br/>_______________________<br/><b>Cashier / Accounts Officer</b>", company_style),
            Paragraph("Official Stamp:<br/><br/>_______________________<br/><b>Roo4Tech Authorized</b>", company_style)
        ]
    ]
    sig_table = Table(sig_data, colWidths=[3.6 * inch, 3.6 * inch])
    sig_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(sig_table)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
