import io
from decimal import Decimal
from django.conf import settings
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from apps.company.models import CompanySettings

def generate_quotation_pdf(quotation):
    """
    Generates a professional, branded PDF for a quotation using ReportLab.
    Uses preserved client_snapshot if present, ensuring historical fidelity.
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

    # Company settings
    company = CompanySettings.get_solo()
    company_name = company.company_name or "Roo4Tech"
    company_email = company.email or "contact@roo4tech.com"
    company_phone = company.phone or "+92 300 1234567"
    company_address = company.address or "Lahore, Pakistan"
    company_website = company.website or "https://roo4tech.com"

    # Client details from snapshot or fallback to client record
    snap = quotation.client_snapshot or {}
    client_id = snap.get('client_id') or quotation.client.client_id
    client_name = snap.get('name') or quotation.client.name
    client_company = snap.get('company_name') or quotation.client.company_name or ""
    client_email = snap.get('email') or quotation.client.email
    client_phone = snap.get('phone') or quotation.client.phone or ""
    client_address = snap.get('billing_address') or quotation.client.billing_address or "N/A"

    # Custom styles
    brand_primary = colors.HexColor("#0f172a") # dark slate
    brand_blue = colors.HexColor("#2563eb")    # primary blue
    text_muted = colors.HexColor("#64748b")    # slate 500

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=brand_blue
    )
    company_style = ParagraphStyle(
        'CompanyInfo',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=text_muted
    )
    header_right = ParagraphStyle(
        'HeaderRight',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        alignment=2,
        textColor=brand_primary
    )
    section_title = ParagraphStyle(
        'SectionTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=15,
        textColor=brand_primary
    )
    cell_style = ParagraphStyle(
        'Cell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12
    )
    cell_bold = ParagraphStyle(
        'CellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12
    )

    # Table Header Styles (High-contrast pure white text on brand blue)
    th_center = ParagraphStyle('THCenter', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, leading=12, alignment=1, textColor=colors.white)
    th_left = ParagraphStyle('THLeft', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, leading=12, alignment=0, textColor=colors.white)
    th_right = ParagraphStyle('THRight', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, leading=12, alignment=2, textColor=colors.white)

    # Table Cell Data Styles
    td_idx = ParagraphStyle('TDIdx', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, alignment=1, textColor=colors.HexColor("#64748b"))
    td_desc = ParagraphStyle('TDDesc', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, alignment=0, textColor=colors.HexColor("#0f172a"))
    td_qty = ParagraphStyle('TDQty', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, alignment=2, textColor=colors.HexColor("#334155"))
    td_price = ParagraphStyle('TDPrice', parent=styles['Normal'], fontName='Helvetica', fontSize=9, leading=13, alignment=2, textColor=colors.HexColor("#334155"))
    td_total = ParagraphStyle('TDTotal', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=9, leading=13, alignment=2, textColor=colors.HexColor("#0f172a"))

    # Top Header Grid: Company Info (Left) | Quotation Details (Right)
    left_header = [
        Paragraph(f"<b>{company_name}</b>", ParagraphStyle('BName', parent=styles['Normal'], fontName='Helvetica-Bold', fontSize=15, leading=18, textColor=brand_primary)),
        Paragraph(f"{company_address}", company_style),
        Paragraph(f"Email: {company_email} | Phone: {company_phone}", company_style),
        Paragraph(f"Web: {company_website}", company_style),
    ]

    right_header = [
        Paragraph("QUOTATION / PROPOSAL", title_style),
        Spacer(1, 4),
        Paragraph(f"<b>Quote #:</b> {quotation.quotation_number}", header_right),
        Paragraph(f"<b>Date:</b> {quotation.issue_date.strftime('%b %d, %Y')}", header_right),
        Paragraph(f"<b>Valid Until:</b> {quotation.expiry_date.strftime('%b %d, %Y') if quotation.expiry_date else '30 Days'}", header_right),
        Paragraph(f"<b>Status:</b> {quotation.status.upper()}", header_right),
        Paragraph(f"<b>Currency:</b> {quotation.currency}", header_right),
    ]

    header_table = Table(
        [[left_header, right_header]],
        colWidths=[4.0 * inch, 3.2 * inch]
    )
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

    # Bill To / Client Section
    client_box = [
        Paragraph(f"<b>PREPARED FOR:</b>", section_title),
        Spacer(1, 3),
        Paragraph(f"<b>{client_name}</b>" + (f" ({client_company})" if client_company else ""), cell_bold),
        Paragraph(f"<b>Client ID:</b> {client_id}", company_style),
        Paragraph(f"<b>Email:</b> {client_email} | <b>Phone:</b> {client_phone or 'N/A'}", company_style),
        Paragraph(f"<b>Billing Address:</b> {client_address}", company_style),
    ]

    meta_box = [
        Paragraph("<b>QUOTATION DETAILS:</b>", section_title),
        Spacer(1, 3),
        Paragraph(f"<b>Title:</b> {quotation.title}", company_style),
        Paragraph(f"<b>Salesperson:</b> {quotation.salesperson.full_name if quotation.salesperson else 'Roo4Tech Sales Team'}", company_style),
        Paragraph(f"<b>Base Currency Rate:</b> 1 {quotation.currency} = {quotation.exchange_rate_to_base} PKR", company_style),
    ]

    info_table = Table(
        [[client_box, meta_box]],
        colWidths=[4.2 * inch, 3.0 * inch]
    )
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
            Paragraph("<b>#</b>", th_center),
            Paragraph("<b>Description / Scope of Work</b>", th_left),
            Paragraph("<b>Qty</b>", th_right),
            Paragraph(f"<b>Unit Price ({quotation.currency})</b>", th_right),
            Paragraph(f"<b>Total ({quotation.currency})</b>", th_right),
        ]
    ]

    idx = 1
    for item in quotation.items.all():
        table_data.append([
            Paragraph(str(idx), td_idx),
            Paragraph(item.description, td_desc),
            Paragraph(f"{item.quantity:g}", td_qty),
            Paragraph(f"{item.unit_price:,.2f}", td_price),
            Paragraph(f"{item.line_total:,.2f}", td_total),
        ])
        idx += 1

    if idx == 1:
        table_data.append([
            Paragraph("1", td_idx),
            Paragraph("Software development and professional consultation services", td_desc),
            Paragraph("1", td_qty),
            Paragraph(f"{quotation.total_amount:,.2f}", td_price),
            Paragraph(f"{quotation.total_amount:,.2f}", td_total),
        ])

    items_table = Table(
        table_data,
        colWidths=[0.45 * inch, 3.85 * inch, 0.7 * inch, 1.2 * inch, 1.3 * inch]
    )
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0284c7")),
        ('ALIGN', (0,0), (0,-1), 'CENTER'),
        ('ALIGN', (1,0), (1,-1), 'LEFT'),
        ('ALIGN', (2,0), (-1,-1), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor("#f8fafc")]),
        ('TOPPADDING', (0,0), (-1,-1), 7),
        ('BOTTOMPADDING', (0,0), (-1,-1), 7),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 10))

    # Summary Totals Box
    summary_data = [
        [Paragraph("<b>Subtotal:</b>", cell_style), Paragraph(f"<b>{quotation.subtotal:,.2f} {quotation.currency}</b>", cell_bold)],
    ]
    if quotation.discount_amount > 0:
        summary_data.append([
            Paragraph(f"Discount ({quotation.discount_percentage:g}%):", cell_style),
            Paragraph(f"-{quotation.discount_amount:,.2f} {quotation.currency}", cell_style)
        ])
    if quotation.tax_amount > 0:
        summary_data.append([
            Paragraph(f"Tax / VAT ({quotation.tax_percentage:g}%):", cell_style),
            Paragraph(f"+{quotation.tax_amount:,.2f} {quotation.currency}", cell_style)
        ])
    summary_data.append([
        Paragraph("<b>GRAND TOTAL:</b>", ParagraphStyle('GTL', parent=cell_bold, fontSize=11, textColor=brand_blue)),
        Paragraph(f"<b>{quotation.total_amount:,.2f} {quotation.currency}</b>", ParagraphStyle('GTR', parent=cell_bold, fontSize=11, textColor=brand_blue))
    ])

    summary_table = Table(summary_data, colWidths=[2.0 * inch, 1.8 * inch], hAlign='RIGHT')
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
    if quotation.terms_and_conditions:
        story.append(Paragraph("<b>TERMS & CONDITIONS:</b>", section_title))
        story.append(Spacer(1, 3))
        for line in quotation.terms_and_conditions.split('\n'):
            if line.strip():
                story.append(Paragraph(line, company_style))
        story.append(Spacer(1, 20))

    # Signature section
    sig_data = [
        [
            Paragraph("Prepared by:<br/><br/>_______________________<br/><b>Roo4Tech Authorized</b>", company_style),
            Paragraph("Client Acceptance Signature:<br/><br/>_______________________<br/><b>Date & Stamp</b>", company_style)
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
