"""
Root4Tech CRM - Professional Quotation & Invoice PDF Generator (Phase 3)
Uses ReportLab to produce pixel-perfect, branded agency billing documents.
"""

import io
from decimal import Decimal
from django.utils import timezone
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from .models import AgencySetting


PRIMARY_COLOR = colors.HexColor('#0f172a')   # Dark navy
ACCENT_COLOR = colors.HexColor('#2563eb')    # Royal blue
TEXT_MUTED = colors.HexColor('#64748b')      # Slate 500
BORDER_COLOR = colors.HexColor('#e2e8f0')    # Slate 200
BG_LIGHT = colors.HexColor('#f8fafc')        # Slate 50
SUCCESS_COLOR = colors.HexColor('#16a34a')   # Green 600
DANGER_COLOR = colors.HexColor('#dc2626')    # Red 600
WARNING_COLOR = colors.HexColor('#d97706')   # Amber 600


def _build_styles():
    styles = getSampleStyleSheet()
    
    styles.add(ParagraphStyle(
        'AgencyName',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=PRIMARY_COLOR
    ))

    styles.add(ParagraphStyle(
        'AgencyTagline',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=TEXT_MUTED
    ))

    styles.add(ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        alignment=2,  # Right
        textColor=ACCENT_COLOR
    ))

    styles.add(ParagraphStyle(
        'DocMeta',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        alignment=2,
        textColor=PRIMARY_COLOR
    ))

    styles.add(ParagraphStyle(
        'SectionHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=TEXT_MUTED
    ))

    styles.add(ParagraphStyle(
        'ClientName',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=PRIMARY_COLOR
    ))

    styles.add(ParagraphStyle(
        'BodyRegular',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=PRIMARY_COLOR
    ))

    styles.add(ParagraphStyle(
        'BodyMuted',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=TEXT_MUTED
    ))

    styles.add(ParagraphStyle(
        'TableHead',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.white
    ))

    styles.add(ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        textColor=PRIMARY_COLOR
    ))

    styles.add(ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=12,
        textColor=PRIMARY_COLOR
    ))

    styles.add(ParagraphStyle(
        'TableCellRight',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12,
        alignment=2,
        textColor=PRIMARY_COLOR
    ))

    styles.add(ParagraphStyle(
        'TableCellRightBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=12,
        alignment=2,
        textColor=PRIMARY_COLOR
    ))

    styles.add(ParagraphStyle(
        'TermsBlock',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=11,
        textColor=TEXT_MUTED
    ))

    return styles


def generate_invoice_pdf(invoice):
    """
    Generate professional branded PDF for Invoice.
    Returns bytes of PDF.
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

    settings = AgencySetting.get_settings()
    styles = _build_styles()
    story = []

    # 1. Header: Agency Info (Left) + Document Meta (Right)
    agency_info = [
        Paragraph(settings.agency_name.upper(), styles['AgencyName']),
        Paragraph(settings.tagline, styles['AgencyTagline']),
        Paragraph(f"{settings.official_email} | {settings.phone}", styles['AgencyTagline']),
        Paragraph(f"{settings.website} | {settings.address}", styles['AgencyTagline']),
    ]

    status_color = SUCCESS_COLOR if invoice.status == 'Paid' else (DANGER_COLOR if invoice.status == 'Overdue' else ACCENT_COLOR)
    doc_meta = [
        Paragraph("TAX INVOICE", styles['DocTitle']),
        Paragraph(f"<b>Invoice #:</b> {invoice.invoice_number}", styles['DocMeta']),
        Paragraph(f"<b>Issue Date:</b> {invoice.issue_date.strftime('%B %d, %Y')}", styles['DocMeta']),
        Paragraph(f"<b>Due Date:</b> {invoice.due_date.strftime('%B %d, %Y')}", styles['DocMeta']),
        Paragraph(f"<b>Status:</b> <font color='{status_color.hexval()}'><b>{invoice.status.upper()}</b></font>", styles['DocMeta']),
    ]

    header_table = Table(
        [[agency_info, doc_meta]],
        colWidths=[3.6 * inch, 3.8 * inch]
    )
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=ACCENT_COLOR, spaceAfter=14, spaceBefore=4))

    # 2. Billed To & Project Details
    client = invoice.client
    client_name = client.company if client else (invoice.client_name_override or 'Client Account')
    contact_person = client.contact_person if client else 'Accounts Payable'
    client_email = client.email if client else ''
    client_phone = client.phone if client else ''
    client_address = client.address if (client and client.address) else 'Corporate Headquarters'

    billed_to_cells = [
        Paragraph("BILLED TO", styles['SectionHeader']),
        Paragraph(client_name, styles['ClientName']),
        Paragraph(f"Attn: {contact_person}", styles['BodyRegular']),
        Paragraph(f"{client_email} | {client_phone}", styles['BodyMuted']),
        Paragraph(client_address, styles['BodyMuted']),
    ]

    project_ref_cells = [
        Paragraph("PROJECT & ACCOUNT DETAILS", styles['SectionHeader']),
        Paragraph(invoice.project_scope_title or (invoice.project.title if invoice.project else 'Agency Services Contract'), styles['TableCellBold']),
        Paragraph(f"<b>Account Manager:</b> {invoice.created_by.get_full_name() if invoice.created_by else 'David Vance (Sales Manager)'}", styles['BodyMuted']),
        Paragraph(f"<b>Payment Terms:</b> Net 30 / Direct Wire Transfer", styles['BodyMuted']),
    ]

    details_table = Table(
        [[billed_to_cells, project_ref_cells]],
        colWidths=[3.7 * inch, 3.7 * inch]
    )
    details_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(details_table)
    story.append(Spacer(1, 14))

    # 3. Line Items Table
    items_data = [
        [
            Paragraph("#", styles['TableHead']),
            Paragraph("Service / Deliverable Description", styles['TableHead']),
            Paragraph("Qty", styles['TableHead']),
            Paragraph("Unit Price", styles['TableHead']),
            Paragraph("Amount", styles['TableHead']),
        ]
    ]

    billing_items = list(invoice.items.all())
    subtotal = Decimal('0.00')

    if billing_items:
        for idx, item in enumerate(billing_items, 1):
            subtotal += item.total
            items_data.append([
                Paragraph(str(idx), styles['TableCell']),
                Paragraph(f"<b>{item.service.name if item.service else 'Service'}</b><br/>{item.description}", styles['TableCell']),
                Paragraph(str(item.quantity), styles['TableCellRight']),
                Paragraph(f"${item.unit_rate:,.2f}", styles['TableCellRight']),
                Paragraph(f"${item.total:,.2f}", styles['TableCellRightBold']),
            ])
    else:
        # Default single item from invoice
        subtotal = invoice.amount or Decimal('0.00')
        items_data.append([
            Paragraph("1", styles['TableCell']),
            Paragraph(f"<b>{invoice.project_scope_title or 'Professional Digital Agency Services'}</b><br/>Dedicated deliverable scope according to signed service agreement.", styles['TableCell']),
            Paragraph("1.00", styles['TableCellRight']),
            Paragraph(f"${subtotal:,.2f}", styles['TableCellRight']),
            Paragraph(f"${subtotal:,.2f}", styles['TableCellRightBold']),
        ])

    tax_rate = invoice.tax_rate or Decimal('0.00')
    tax_amount = (subtotal * tax_rate) / Decimal('100.00')
    discount_amount = invoice.discount_amount or Decimal('0.00')
    total_amount = max(Decimal('0.00'), subtotal + tax_amount - discount_amount)
    paid_amount = invoice.paid_amount or Decimal('0.00')
    balance_due = max(Decimal('0.00'), total_amount - paid_amount)

    items_table = Table(
        items_data,
        colWidths=[0.4 * inch, 3.9 * inch, 0.7 * inch, 1.2 * inch, 1.2 * inch]
    )
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_COLOR),
        ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 10))

    # 4. Totals Block (Right Aligned Table)
    totals_data = [
        [Paragraph("Subtotal:", styles['TableCellBold']), Paragraph(f"${subtotal:,.2f}", styles['TableCellRightBold'])],
    ]
    if discount_amount > 0:
        totals_data.append([
            Paragraph("Discount / Credits:", styles['TableCellBold']),
            Paragraph(f"-${discount_amount:,.2f}", styles['TableCellRightBold'])
        ])
    if tax_rate > 0:
        totals_data.append([
            Paragraph(f"Tax ({tax_rate}%):", styles['TableCellBold']),
            Paragraph(f"${tax_amount:,.2f}", styles['TableCellRightBold'])
        ])
    totals_data.extend([
        [Paragraph("Total Amount Due:", styles['TableCellBold']), Paragraph(f"${total_amount:,.2f}", styles['TableCellRightBold'])],
        [Paragraph("Amount Settled:", styles['TableCellBold']), Paragraph(f"${paid_amount:,.2f}", styles['TableCellRightBold'])],
        [Paragraph("Remaining Balance:", styles['TableCellBold']), Paragraph(f"${balance_due:,.2f}", styles['TableCellRightBold'])],
    ])

    totals_table = Table(
        totals_data,
        colWidths=[2.0 * inch, 1.4 * inch]
    )
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#eff6ff')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))

    # Place Totals in right column with bank/payment notes on left
    payment_terms_cells = [
        Paragraph("<b>PAYMENT INSTRUCTIONS & TERMS</b>", styles['SectionHeader']),
        Paragraph("<b>Bank Wire / ACH:</b> Root4Tech Digital Agency Trust Account", styles['TermsBlock']),
        Paragraph("<b>Bank:</b> Silicon Valley Financial Bank | <b>Swift:</b> ROOT4US33", styles['TermsBlock']),
        Paragraph(f"<b>Reference:</b> {invoice.invoice_number} / {client_name}", styles['TermsBlock']),
        Spacer(1, 4),
        Paragraph("<i>Disclaimer: This document records financial billing statements. Online credit card transactions require client authorization on our verified merchant portal.</i>", styles['TermsBlock']),
    ]

    bottom_table = Table(
        [[payment_terms_cells, totals_table]],
        colWidths=[4.0 * inch, 3.4 * inch]
    )
    bottom_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(bottom_table)

    # 5. Sign-off / Signature
    story.append(Spacer(1, 25))
    sign_table = Table([
        [
            Paragraph("Prepared by:<br/><b>Root4Tech Billing Dept</b>", styles['TableCell']),
            Paragraph("Client Acceptance / Authorization:<br/><b>_____________________________________</b>", styles['TableCellRight'])
        ]
    ], colWidths=[3.7 * inch, 3.7 * inch])
    story.append(sign_table)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


def generate_quotation_pdf(quotation):
    """
    Generate professional branded PDF for Quotation / Proposal.
    Returns bytes of PDF.
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

    settings = AgencySetting.get_settings()
    styles = _build_styles()
    story = []

    # Header
    agency_info = [
        Paragraph(settings.agency_name.upper(), styles['AgencyName']),
        Paragraph(settings.tagline, styles['AgencyTagline']),
        Paragraph(f"{settings.official_email} | {settings.phone}", styles['AgencyTagline']),
        Paragraph(f"{settings.website} | {settings.address}", styles['AgencyTagline']),
    ]

    valid_until_str = quotation.valid_until.strftime('%B %d, %Y') if quotation.valid_until else '30 Days from Issue'
    doc_meta = [
        Paragraph("FORMAL PROPOSAL / ESTIMATE", styles['DocTitle']),
        Paragraph(f"<b>Quotation #:</b> {quotation.quotation_number}", styles['DocMeta']),
        Paragraph(f"<b>Proposal Date:</b> {quotation.issue_date.strftime('%B %d, %Y')}", styles['DocMeta']),
        Paragraph(f"<b>Valid Until:</b> {valid_until_str}", styles['DocMeta']),
        Paragraph(f"<b>Status:</b> <b>{quotation.status.upper()}</b>", styles['DocMeta']),
    ]

    header_table = Table([[agency_info, doc_meta]], colWidths=[3.6 * inch, 3.8 * inch])
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=ACCENT_COLOR, spaceAfter=14, spaceBefore=4))

    # Proposal Prepared For
    client = quotation.client
    client_name = quotation.client_display
    contact_person = client.contact_person if client else 'Prospective Client'

    billed_to_cells = [
        Paragraph("PREPARED FOR", styles['SectionHeader']),
        Paragraph(client_name, styles['ClientName']),
        Paragraph(f"Attn: {contact_person}", styles['BodyRegular']),
        Paragraph(client.email if client else '', styles['BodyMuted']),
    ]

    project_ref_cells = [
        Paragraph("SCOPE SUMMARY", styles['SectionHeader']),
        Paragraph(quotation.project_scope_title or 'Digital Agency Deliverables Scope', styles['TableCellBold']),
        Paragraph(f"<b>Author:</b> {quotation.created_by.get_full_name() if quotation.created_by else 'David Vance (Sales Manager)'}", styles['BodyMuted']),
        Paragraph("<b>Standard Delivery:</b> 4-6 Weeks upon signing", styles['BodyMuted']),
    ]

    details_table = Table([[billed_to_cells, project_ref_cells]], colWidths=[3.7 * inch, 3.7 * inch])
    details_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BACKGROUND', (0, 0), (-1, -1), BG_LIGHT),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
    ]))
    story.append(details_table)
    story.append(Spacer(1, 14))

    # Items Table
    items_data = [
        [
            Paragraph("#", styles['TableHead']),
            Paragraph("Deliverable / Scope Specification", styles['TableHead']),
            Paragraph("Qty", styles['TableHead']),
            Paragraph("Rate", styles['TableHead']),
            Paragraph("Total", styles['TableHead']),
        ]
    ]

    billing_items = list(quotation.items.all())
    subtotal = Decimal('0.00')

    if billing_items:
        for idx, item in enumerate(billing_items, 1):
            subtotal += item.total
            items_data.append([
                Paragraph(str(idx), styles['TableCell']),
                Paragraph(f"<b>{item.service.name if item.service else 'Service'}</b><br/>{item.description}", styles['TableCell']),
                Paragraph(str(item.quantity), styles['TableCellRight']),
                Paragraph(f"${item.unit_rate:,.2f}", styles['TableCellRight']),
                Paragraph(f"${item.total:,.2f}", styles['TableCellRightBold']),
            ])
    else:
        subtotal = quotation.amount or Decimal('0.00')
        items_data.append([
            Paragraph("1", styles['TableCell']),
            Paragraph(f"<b>{quotation.project_scope_title or 'Proposed Deliverable Package'}</b><br/>Complete turnkey implementation including discovery, engineering, and final revisions.", styles['TableCell']),
            Paragraph("1.00", styles['TableCellRight']),
            Paragraph(f"${subtotal:,.2f}", styles['TableCellRight']),
            Paragraph(f"${subtotal:,.2f}", styles['TableCellRightBold']),
        ])

    tax_rate = quotation.tax_rate or Decimal('0.00')
    tax_amount = (subtotal * tax_rate) / Decimal('100.00')
    discount_amount = quotation.discount_amount or Decimal('0.00')
    total_amount = max(Decimal('0.00'), subtotal + tax_amount - discount_amount)

    items_table = Table(
        items_data,
        colWidths=[0.4 * inch, 3.9 * inch, 0.7 * inch, 1.2 * inch, 1.2 * inch]
    )
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), PRIMARY_COLOR),
        ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, BG_LIGHT]),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
    ]))
    story.append(items_table)
    story.append(Spacer(1, 10))

    # Totals
    totals_data = [
        [Paragraph("Subtotal Estimate:", styles['TableCellBold']), Paragraph(f"${subtotal:,.2f}", styles['TableCellRightBold'])],
    ]
    if discount_amount > 0:
        totals_data.append([
            Paragraph("Promotional Discount:", styles['TableCellBold']),
            Paragraph(f"-${discount_amount:,.2f}", styles['TableCellRightBold'])
        ])
    if tax_rate > 0:
        totals_data.append([
            Paragraph(f"Estimated Tax ({tax_rate}%):", styles['TableCellBold']),
            Paragraph(f"${tax_amount:,.2f}", styles['TableCellRightBold'])
        ])
    totals_data.append([
        Paragraph("Total Estimated Investment:", styles['TableCellBold']),
        Paragraph(f"${total_amount:,.2f}", styles['TableCellRightBold'])
    ])

    totals_table = Table(totals_data, colWidths=[2.0 * inch, 1.4 * inch])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'RIGHT'),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#eff6ff')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))

    notes_cells = [
        Paragraph("<b>PROPOSAL TERMS & CONDITIONS</b>", styles['SectionHeader']),
        Paragraph("1. This quotation is valid for 30 calendar days from the issue date.", styles['TermsBlock']),
        Paragraph("2. 50% deposit required upon signing; 50% upon final acceptance & milestone delivery.", styles['TermsBlock']),
        Paragraph("3. Includes up to 2 rounds of creative/functional revisions as defined in the scope.", styles['TermsBlock']),
    ]

    bottom_table = Table([[notes_cells, totals_table]], colWidths=[4.0 * inch, 3.4 * inch])
    bottom_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0),
        ('RIGHTPADDING', (0, 0), (-1, -1), 0),
    ]))
    story.append(bottom_table)

    story.append(Spacer(1, 25))
    sign_table = Table([
        [
            Paragraph("Approved by:<br/><b>Root4Tech Agency Lead</b>", styles['TableCell']),
            Paragraph("Client Acceptance Signature:<br/><b>_____________________________________</b>", styles['TableCellRight'])
        ]
    ], colWidths=[3.7 * inch, 3.7 * inch])
    story.append(sign_table)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
