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

// READ Flights (Expanded Filters)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { 
        origin, 
        destination, 
        startDate, 
        maxPrice, 
        cabinClass, 
        provider 
    } = req.query;

    // Start with a base query: only show flights with available seats
    let query: any = { inventory: { $gt: 0 } };

    // 1. Location Filters (Case-insensitive partial match)
    if (origin) query.origin = { $regex: origin, $options: 'i' };
    if (destination) query.destination = { $regex: destination, $options: 'i' };

    // 2. Date Filter (On or after the selected date)
    if (startDate) {
        query.startDate = { $gte: new Date(startDate as string) };
    }

    // 3. Price Filter (Look at the discounted price)
    if (maxPrice) {
        query.discountedPrice = { $lte: Number(maxPrice) };
    }

    // 4. Cabin Class Filter (e.g., "Economy", "Business")
    if (cabinClass) {
        query.cabinClass = { $regex: cabinClass, $options: 'i' };
    }

    // 5. Provider Filter (e.g., "Japan Airlines")
    if (provider) {
        query.providerName = { $regex: provider, $options: 'i' };
    }

    // Execute query: sort by cheapest price first
    const flights = await Flight.find(query).sort({ discountedPrice: 1 });
    
    res.json(flights);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;