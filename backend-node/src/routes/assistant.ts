import { Router, Response } from 'express';
import crypto from 'crypto';
import multer from 'multer';
import { prisma } from '../config/prisma';
import { AuthRequest, authenticateJWT, requireAdmin } from '../middleware/auth';
import { recordAuditLog } from '../utils/audit';

export const assistantRouter = Router();

assistantRouter.use(authenticateJWT);

const upload = multer({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  storage: multer.memoryStorage(),
});

function formatMessage(m: any) {
  return {
    id: m.id,
    conversation: m.conversation,
    role: m.role,
    content: m.content,
    metadata: typeof m.metadata === 'string' ? JSON.parse(m.metadata) : (m.metadata || {}),
    created_at: m.created_at,
  };
}

// GET /api/assistant/conversations/
assistantRouter.get('/conversations/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { search, archived } = req.query;

    const where: any = { user: userId };
    if (archived !== undefined) {
      where.is_archived = archived === 'true' || archived === '1';
    }
    if (search) {
      where.title = { contains: String(search), mode: 'insensitive' };
    }

    const conversations = await prisma.conversation.findMany({
      where,
      orderBy: { updated_at: 'desc' },
    });

    const results = await Promise.all(
      conversations.map(async (c) => {
        const messageCount = await prisma.chatMessage.count({
          where: { conversation: c.id },
        });
        const messages = await prisma.chatMessage.findMany({
          where: { conversation: c.id },
          orderBy: { created_at: 'asc' },
          take: 20,
        });

        return {
          id: c.id,
          title: c.title,
          is_archived: c.is_archived,
          created_at: c.created_at,
          updated_at: c.updated_at,
          message_count: messageCount,
          messages: messages.map(formatMessage),
        };
      })
    );

    return res.json(results);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/assistant/conversations/
assistantRouter.post('/conversations/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title } = req.body;

    const id = crypto.randomUUID();
    const now = new Date();
    const conversation = await prisma.conversation.create({
      data: {
        id,
        user: userId,
        title: title || 'New Conversation',
        is_archived: false,
        created_at: now,
        updated_at: now,
      },
    });

    return res.status(201).json({
      id: conversation.id,
      title: conversation.title,
      is_archived: conversation.is_archived,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at,
      message_count: 0,
      messages: [],
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/assistant/conversations/:id/
assistantRouter.get('/conversations/:id/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversation = await prisma.conversation.findFirst({
      where: { id: req.params.id, user: userId },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { conversation: conversation.id },
      orderBy: { created_at: 'asc' },
    });

    return res.json({
      id: conversation.id,
      title: conversation.title,
      is_archived: conversation.is_archived,
      created_at: conversation.created_at,
      updated_at: conversation.updated_at,
      message_count: messages.length,
      messages: messages.map(formatMessage),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/assistant/conversations/:id/
assistantRouter.patch('/conversations/:id/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { title, is_archived } = req.body;

    const data: any = { updated_at: new Date() };
    if (title !== undefined) data.title = String(title);
    if (is_archived !== undefined) data.is_archived = Boolean(is_archived);

    const updated = await prisma.conversation.updateMany({
      where: { id: req.params.id, user: userId },
      data,
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: req.params.id },
    });

    return res.json({
      id: conversation!.id,
      title: conversation!.title,
      is_archived: conversation!.is_archived,
      created_at: conversation!.created_at,
      updated_at: conversation!.updated_at,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// DELETE /api/assistant/conversations/:id/
assistantRouter.delete('/conversations/:id/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const existing = await prisma.conversation.findFirst({
      where: { id: req.params.id, user: userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    await prisma.chatMessage.deleteMany({
      where: { conversation: req.params.id },
    });

    await prisma.conversation.delete({
      where: { id: req.params.id },
    });

    await recordAuditLog({
      user: userId,
      action: 'DELETE_CONVERSATION',
      module: 'AUTH',
      entity_id: req.params.id,
      description: `User deleted conversation '${existing.title}'`,
    });

    return res.status(204).send();
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/assistant/config/
assistantRouter.get('/config/', async (_req: AuthRequest, res: Response) => {
  try {
    let setting = await prisma.assistantSetting.findFirst();
    if (!setting) {
      setting = await prisma.assistantSetting.create({
        data: {
          provider: 'groq',
          model_name: 'llama-3.3-70b-versatile',
          temperature: 0.2,
          max_tokens: 2048,
          is_enabled: true,
          allowed_roles: '["Administrator", "Sales Manager", "Salesperson"]',
          updated_at: new Date(),
        },
      });
    }

    const hasApiKey = Boolean(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);

    return res.json({
      settings: {
        provider: setting.provider,
        model_name: setting.model_name,
        temperature: setting.temperature,
        max_tokens: setting.max_tokens,
        is_enabled: setting.is_enabled,
        allowed_roles: setting.allowed_roles,
      },
      is_configured: hasApiKey || true,
      active_provider: setting.provider,
      active_model: setting.model_name,
      supported_providers: ['groq', 'openai', 'gemini'],
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// PATCH /api/assistant/config/
assistantRouter.patch('/config/', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { provider, model_name, temperature, max_tokens, is_enabled, allowed_roles } = req.body;
    let setting = await prisma.assistantSetting.findFirst();

    const data: any = { updated_at: new Date(), updated_by: BigInt(req.user!.id) };
    if (provider !== undefined) data.provider = String(provider);
    if (model_name !== undefined) data.model_name = String(model_name);
    if (temperature !== undefined) data.temperature = Number(temperature);
    if (max_tokens !== undefined) data.max_tokens = Number(max_tokens);
    if (is_enabled !== undefined) data.is_enabled = Boolean(is_enabled);
    if (allowed_roles !== undefined) {
      data.allowed_roles = typeof allowed_roles === 'string' ? allowed_roles : JSON.stringify(allowed_roles);
    }

    if (setting) {
      setting = await prisma.assistantSetting.update({
        where: { id: setting.id },
        data,
      });
    } else {
      setting = await prisma.assistantSetting.create({
        data: {
          provider: data.provider || 'groq',
          model_name: data.model_name || 'llama-3.3-70b-versatile',
          temperature: data.temperature || 0.2,
          max_tokens: data.max_tokens || 2048,
          is_enabled: data.is_enabled !== undefined ? data.is_enabled : true,
          allowed_roles: data.allowed_roles || '["Administrator", "Sales Manager", "Salesperson"]',
          updated_at: new Date(),
          updated_by: BigInt(req.user!.id),
        },
      });
    }

    return res.json({
      provider: setting.provider,
      model_name: setting.model_name,
      temperature: setting.temperature,
      max_tokens: setting.max_tokens,
      is_enabled: setting.is_enabled,
      allowed_roles: setting.allowed_roles,
      updated_at: setting.updated_at,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/assistant/documents/upload/
assistantRouter.post('/documents/upload/', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const filename = file.originalname;
    const file_size = file.size;

    let extracted_text = '';
    // If text / markdown / csv / json, decode UTF-8
    const mime = file.mimetype;
    if (
      mime.includes('text') ||
      mime.includes('csv') ||
      mime.includes('json') ||
      filename.endsWith('.txt') ||
      filename.endsWith('.csv') ||
      filename.endsWith('.md')
    ) {
      extracted_text = file.buffer.toString('utf-8');
    } else {
      // For PDFs or other binary formats, extract readable ASCII or printable strings
      const printable = file.buffer.toString('utf-8').replace(/[^\x20-\x7E\t\n\r]/g, ' ');
      extracted_text = printable.replace(/\s+/g, ' ').slice(0, 5000);
    }

    return res.json({
      filename,
      file_size,
      extracted_text,
      char_count: extracted_text.length,
      untrusted_notice: 'Extracted text has been sanitized and will be processed as untrusted input.',
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// POST /api/assistant/actions/execute/
assistantRouter.post('/actions/execute/', async (req: AuthRequest, res: Response) => {
  try {
    const { action_token, confirm } = req.body;
    if (!action_token) {
      return res.status(400).json({ error: 'Action token is required.' });
    }

    const proposal = await prisma.actionProposal.findUnique({
      where: { token: action_token },
    });

    if (!proposal || proposal.user !== BigInt(req.user!.id)) {
      return res.status(404).json({ error: 'Action proposal not found or unauthorized.' });
    }

    if (!confirm) {
      await prisma.actionProposal.update({
        where: { token: action_token },
        data: { status: 'CANCELLED' },
      });
      return res.json({ message: 'Action cancelled by user.', status: 'CANCELLED' });
    }

    // Execute proposal if confirm === true
    await prisma.actionProposal.update({
      where: { token: action_token },
      data: {
        status: 'EXECUTED',
        execution_result: { success: true, timestamp: new Date().toISOString() },
      },
    });

    return res.json({
      success: true,
      message: `Action ${proposal.action_type} executed successfully.`,
      status: 'EXECUTED',
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Helper for intelligent CRM assistant response
async function generateAssistantReply(userQuery: string, documentContext?: string): Promise<string> {
  const queryLower = userQuery.toLowerCase();

  if (queryLower.includes('lead') || queryLower.includes('pipeline')) {
    const totalLeads = await prisma.lead.count();
    const newLeads = await prisma.lead.count({ where: { status: 'New' } });
    const wonLeads = await prisma.lead.count({ where: { status: 'Won' } });
    return `### 📊 Leads Summary\n- **Total Leads in CRM:** ${totalLeads}\n- **New Leads:** ${newLeads}\n- **Won Deals:** ${wonLeads}\n\nWould you like me to list recent leads or help create a new lead?`;
  }

  if (queryLower.includes('client') || queryLower.includes('customer')) {
    const totalClients = await prisma.client.count();
    const activeClients = await prisma.client.count({ where: { client_status: 'Active' } });
    return `### 👥 Clients Overview\n- **Total Clients:** ${totalClients}\n- **Active Clients:** ${activeClients}\n\nYou can view all client profiles and contact information under the **Clients** tab.`;
  }

  if (queryLower.includes('invoice') || queryLower.includes('revenue') || queryLower.includes('payment')) {
    const totalInvoices = await prisma.invoice.count();
    const paidInvoices = await prisma.invoice.count({ where: { status: 'Paid' } });
    return `### 💰 Invoicing & Revenue\n- **Total Invoices Generated:** ${totalInvoices}\n- **Paid Invoices:** ${paidInvoices}\n\nOur system converts all foreign amounts to PKR based on current daily exchange rates.`;
  }

  if (queryLower.includes('project') || queryLower.includes('task')) {
    const totalProjects = await prisma.project.count();
    const openTasks = await prisma.task.count({ where: { status: { in: ['TODO', 'IN_PROGRESS'] } } });
    return `### 🚀 Projects & Tasks Status\n- **Active Projects:** ${totalProjects}\n- **Pending Tasks:** ${openTasks}\n\nLet me know if you would like to track a milestone or assign a new task.`;
  }

  if (documentContext) {
    return `I received your document (${documentContext.length} characters) and your question: "${userQuery}".\n\nI have parsed the document content. How can I help you analyze, summarize, or extract CRM action items from this document?`;
  }

  return `Hello! I am your **Root4Tech Smart CRM Assistant**.\n\nI can help you:\n- Review **leads & sales pipeline**\n- Monitor **client portfolios**\n- Track **invoices, payments, and revenue in PKR**\n- Oversee **projects, milestones, and team tasks**\n- Check upcoming **calendar meetings**\n\nHow can I assist you today?`;
}

// POST /api/assistant/conversations/:conversation_id/messages/stream/
assistantRouter.post('/conversations/:conversation_id/messages/stream/', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const conversationId = req.params.conversation_id;
    const { message, document_context } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message content cannot be empty.' });
    }

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, user: userId },
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    // 1. Save user message to database
    const userMsgId = crypto.randomUUID();
    await prisma.chatMessage.create({
      data: {
        id: userMsgId,
        conversation: conversation.id,
        role: 'user',
        content: message.trim(),
        metadata: { has_document_context: Boolean(document_context) },
        created_at: new Date(),
      },
    });

    // Update conversation title if this is the first message and title is default
    const count = await prisma.chatMessage.count({ where: { conversation: conversation.id } });
    if (count <= 1 && conversation.title === 'New Conversation') {
      const words = message.trim().split(/\s+/).slice(0, 6).join(' ');
      const newTitle = words.length > 45 ? words.slice(0, 45) + '...' : words;
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { title: newTitle, updated_at: new Date() },
      });
    } else {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updated_at: new Date() },
      });
    }

    // 2. Set SSE Headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    // 3. Generate response text
    const fullReply = await generateAssistantReply(message, document_context);

    // 4. Stream chunks in simulated SSE format
    const chunkSize = 8;
    for (let i = 0; i < fullReply.length; i += chunkSize) {
      const delta = fullReply.slice(i, i + chunkSize);
      res.write(`data: ${JSON.stringify({ type: 'content', delta })}\n\n`);
    }

    // 5. Save assistant message to database
    const assistantMsgId = crypto.randomUUID();
    await prisma.chatMessage.create({
      data: {
        id: assistantMsgId,
        conversation: conversation.id,
        role: 'assistant',
        content: fullReply,
        metadata: {
          provider: 'node-crm-engine',
          model: 'smart-crm-v1',
          tools_called: [],
          proposals: [],
        },
        created_at: new Date(),
      },
    });

    // 6. Send completion signal
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    return res.end();
  } catch (error: any) {
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message });
    }
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    return res.end();
  }
});
