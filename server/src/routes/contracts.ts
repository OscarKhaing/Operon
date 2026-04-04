import { Router, Request, Response } from 'express';
import Contract from '../models/Contract.js'; // Use .js extension for NodeNext compatibility

const router: Router = Router();

// CREATE: Add a new Hotel or Flight deal
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const newContract = new Contract(req.body);
    const savedContract = await newContract.save();
    res.status(201).json(savedContract);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// READ: Get all deals (The Travel Agent's Catalog)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, location } = req.query;
    
    // Build a type-safe query object
    let query: any = {};
    if (category) query.category = category;
    if (location) query.location = { $regex: location, $options: 'i' };

    const contracts = await Contract.find(query).sort({ discountedPrice: 1 });
    res.json(contracts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// READ: Get a single deal by ID
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const contract = await Contract.findById(req.params.id);
    if (!contract) {
      res.status(404).json({ message: 'Contract not found' });
      return;
    }
    res.json(contract);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;