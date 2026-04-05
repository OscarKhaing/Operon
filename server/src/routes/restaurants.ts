import { Router, Request, Response } from 'express';
import Restaurant from '../models/Restaurant.js';

const router: Router = Router();

// POST: Add a new Restaurant to the directory
router.post('/', async (req: Request, res: Response) => {
  try {
    const restaurant = new Restaurant(req.body);
    await restaurant.save();
    res.status(201).json(restaurant);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET: Search restaurants
router.get('/', async (req: Request, res: Response) => {
  try {
    const { cuisine, location } = req.query;
    let query: any = {};

    if (cuisine) query.cuisine = { $regex: cuisine, $options: 'i' };
    if (location) query.location = { $regex: location, $options: 'i' };

    const results = await Restaurant.find(query).sort({ rating: -1 });
    res.json(results);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;