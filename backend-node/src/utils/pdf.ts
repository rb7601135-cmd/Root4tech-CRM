import PDFDocument from 'pdfkit';

export interface PDFInvoiceData {
  invoiceNumber: string;
  title: string;
  clientName: string;
  clientCompany?: string;
  clientEmail?: string;
  issueDate?: string | Date;
  dueDate?: string | Date;
  currency: string;
  items: Array<{
    description: string;
    quantity: number | string;
    unit_price: number | string;
    total?: number | string;
  }>;
  totalAmount: number | string;
  amountPaid?: number | string;
  remainingBalance?: number | string;
  status: string;
}

export function generateInvoicePDF(data: PDFInvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    // Header
    doc.fontSize(20).fillColor('#1e293b').text('ROOT4TECH SOLUTIONS', 50, 50);
    doc.fontSize(10).fillColor('#64748b').text('Enterprise Smart CRM & Digital Engineering', 50, 75);
    doc.moveDown();

    // Document Meta
    doc.fontSize(16).fillColor('#0f172a').text(`TAX INVOICE: ${data.invoiceNumber}`, 50, 110);
    doc.fontSize(10).fillColor('#475569');
    doc.text(`Title: ${data.title}`, 50, 135);
    doc.text(`Status: ${data.status.toUpperCase()}`, 50, 150);
    doc.text(`Issue Date: ${data.issueDate ? new Date(data.issueDate).toLocaleDateString() : 'N/A'}`, 50, 165);
    doc.text(`Due Date: ${data.dueDate ? new Date(data.dueDate).toLocaleDateString() : 'N/A'}`, 50, 180);

    // Bill To
    doc.fontSize(12).fillColor('#0f172a').text('BILL TO:', 350, 110);
    doc.fontSize(10).fillColor('#475569');
    doc.text(data.clientName, 350, 130);
    if (data.clientCompany) doc.text(data.clientCompany, 350, 145);
    if (data.clientEmail) doc.text(data.clientEmail, 350, 160);

    // Line Items Header
    let y = 220;
    doc.rect(50, y, 500, 20).fill('#f1f5f9');
    doc.fontSize(10).fillColor('#0f172a');
    doc.text('Description', 60, y + 5);
    doc.text('Qty', 320, y + 5);
    doc.text('Unit Price', 380, y + 5);
    doc.text('Total', 480, y + 5);

    y += 25;
    data.items.forEach(item => {
      const qty = Number(item.quantity) || 1;
      const unit = Number(item.unit_price) || 0;
      const lineTotal = Number(item.total) || qty * unit;

      doc.fillColor('#334155');
      doc.text(item.description, 60, y, { width: 250 });
      doc.text(qty.toString(), 320, y);
      doc.text(`${unit.toFixed(2)}`, 380, y);
      doc.text(`${lineTotal.toFixed(2)}`, 480, y);
      y += 20;
    });

    // Summary Box
    y += 20;
    doc.rect(320, y, 230, 80).stroke('#cbd5e1');
    doc.fontSize(10).fillColor('#0f172a');
    doc.text(`Total Amount:`, 330, y + 10);
    doc.text(`${data.totalAmount} ${data.currency}`, 450, y + 10);

    if (data.amountPaid !== undefined) {
      doc.text(`Amount Paid:`, 330, y + 30);
      doc.text(`${data.amountPaid} ${data.currency}`, 450, y + 30);
    }
    if (data.remainingBalance !== undefined) {
      doc.fontSize(11).fillColor('#dc2626').text(`Balance Due:`, 330, y + 50);
      doc.text(`${data.remainingBalance} ${data.currency}`, 450, y + 50);
    }

    // Footer
    doc.fontSize(9).fillColor('#94a3b8').text('Thank you for partnering with Roo4Tech Solutions.', 50, 700, { align: 'center' });

    doc.end();
  });
}

export function generateQuotationPDF(data: any): Promise<Buffer> {
  return generateInvoicePDF({
    invoiceNumber: data.quotation_number || data.quotationNumber,
    title: data.title || 'Proposal & Quotation',
    clientName: data.client?.name || data.clientName || 'Valued Client',
    clientCompany: data.client?.company_name || data.clientCompany,
    clientEmail: data.client?.email || data.clientEmail,
    issueDate: data.created_at || data.issue_date,
    dueDate: data.expiry_date,
    currency: data.currency || 'PKR',
    items: data.items || [],
    totalAmount: data.total_amount || data.totalAmount || 0,
    status: data.status || 'Sent',
  });
}

export function generateReceiptPDF(payment: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    doc.fontSize(20).fillColor('#1e293b').text('ROOT4TECH SOLUTIONS', 50, 50);
    doc.fontSize(10).fillColor('#64748b').text('Official Payment Receipt', 50, 75);

    doc.fontSize(14).fillColor('#0f172a').text(`Receipt Number: ${payment.receipt_number || 'REC-0001'}`, 50, 120);
    doc.fontSize(10).fillColor('#334155');
    doc.text(`Payment Date: ${payment.payment_date ? new Date(payment.payment_date).toLocaleDateString() : 'N/A'}`, 50, 145);
    doc.text(`Payment Method: ${payment.payment_method || 'Bank Transfer'}`, 50, 165);
    doc.text(`Transaction Reference: ${payment.transaction_reference || 'N/A'}`, 50, 185);

    doc.rect(50, 220, 500, 40).fill('#f1f5f9');
    doc.fontSize(14).fillColor('#16a34a').text(`Amount Received: ${payment.amount} ${payment.currency || 'PKR'}`, 60, 232);

    doc.fontSize(9).fillColor('#94a3b8').text('This is a computer-generated receipt.', 50, 600, { align: 'center' });
    doc.end();
  });
}

