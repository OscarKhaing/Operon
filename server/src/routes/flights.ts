import { Router, Request, Response } from 'express';
import Flight from '../models/Flight.js';

const router: Router = Router();

// CREATE Flight Deal
router.post('/', async (req: Request, res: Response) => {
  try {
    const flight = new Flight(req.body);
    await flight.save();
    res.status(201).json(flight);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// READ Flights (Filtered by Origin, Destination & Dates)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { origin, destination, startDate } = req.query;
    let query: any = { inventory: { $gt: 0 } };

    if (origin) query.origin = { $regex: origin, $options: 'i' };
    if (destination) query.destination = { $regex: destination, $options: 'i' };
    if (startDate) {
        // Find flights available on or after the departure date
        query.startDate = { $gte: new Date(startDate as string) };
    }

    const flights = await Flight.find(query).sort({ discountedPrice: 1 });
    res.json(flights);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;