import express from 'express';
import { findInvoicesWithPagination } from '../repositories/invoiceRepository';
import {
  createInvoiceWithTransaction,
  updateInvoiceWithTransaction,
  deleteInvoiceWithTransaction,
  bulkMoveInvoicesWithTransaction
} from '../services/invoiceService';
import { requireRole } from '../middleware/auth';

const router = express.Router();

// GET /api/invoices - Paginated, filtered invoice list
router.get('/', async (req, res) => {
  try {
    const page = parseInt(String(req.query.page || '1'), 10) || 1;
    const limit = parseInt(String(req.query.limit || '50'), 10) || 50;
    const type = req.query.type === 'entry' || req.query.type === 'exit' ? req.query.type : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
    const farmerId = typeof req.query.farmerId === 'string' ? req.query.farmerId : undefined;
    const productId = typeof req.query.productId === 'string' ? req.query.productId : undefined;

    const result = await findInvoicesWithPagination({
      page,
      limit,
      type,
      search,
      startDate,
      endDate,
      farmerId,
      productId,
    });

    res.json(result);
  } catch (error: any) {
    console.error('Fetch invoices error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch invoices.' });
  }
});

// POST /api/invoices/bulk-move - Move multiple invoices inside a single database transaction
router.post('/bulk-move', requireRole('ADMIN', 'MANAGER', 'ACCOUNTING', 'OPERATOR'), async (req, res) => {
  try {
    const { ids, targetDate } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || !targetDate) {
      return res.status(400).json({ error: 'ids array and targetDate are required.' });
    }
    const movedCount = await bulkMoveInvoicesWithTransaction(ids, String(targetDate));
    res.json({ success: true, movedCount });
  } catch (error: any) {
    console.error('Bulk move invoices error:', error);
    res.status(400).json({ error: error.message || 'Failed to bulk move invoices.' });
  }
});

// POST /api/invoices - Create invoice inside database transaction
router.post('/', requireRole('ADMIN', 'MANAGER', 'ACCOUNTING', 'OPERATOR'), async (req, res) => {
  try {
    const id = await createInvoiceWithTransaction(req.body);
    res.status(201).json({ success: true, id });
  } catch (error: any) {
    console.error('Create invoice error:', error);
    res.status(400).json({ error: error.message || 'Failed to create invoice.' });
  }
});

// PUT /api/invoices/:id - Update invoice inside database transaction
router.put('/:id', requireRole('ADMIN', 'MANAGER', 'ACCOUNTING'), async (req, res) => {
  try {
    const id = String(req.params.id);
    await updateInvoiceWithTransaction(id, req.body);
    res.json({ success: true, id });
  } catch (error: any) {
    console.error('Update invoice error:', error);
    res.status(400).json({ error: error.message || 'Failed to update invoice.' });
  }
});

// DELETE /api/invoices/:id - Delete invoice inside database transaction
router.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  try {
    const id = String(req.params.id);
    await deleteInvoiceWithTransaction(id);
    res.json({ success: true, id });
  } catch (error: any) {
    console.error('Delete invoice error:', error);
    res.status(400).json({ error: error.message || 'Failed to delete invoice.' });
  }
});

export default router;
