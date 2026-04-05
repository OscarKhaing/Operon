import { Router, Request, Response } from 'express';
import Hotel from '../models/Hotel.js';

const router: Router = Router();

// CREATE Hotel Deal
router.post('/', async (req: Request, res: Response) => {
  try {
    const hotel = new Hotel(req.body);
    await hotel.save();
    res.status(201).json(hotel);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { location, minPrice, maxPrice, amenities, minRating, checkIn, checkOut } = req.query;
    
    // Base query: only show items with available inventory
    let query: any = { inventory: { $gt: 0 } };

    // 1. Location Filter (Case-insensitive search)
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    // 2. Price Filter
    if (minPrice || maxPrice) {
      query.discountedPrice = {};
      if (minPrice) query.discountedPrice.$gte = Number(minPrice);
      if (maxPrice) query.discountedPrice.$lte = Number(maxPrice);
    }

    // 3. Amenities Filter (Matches all selected amenities)
    if (amenities) {
      const amenityList = (amenities as string).split(',');
      query.amenities = { $all: amenityList };
    }

    // 4. Star Rating Filter (Shows requested rating and above)
    if (minRating) {
      query.rating = { $gte: Number(minRating) };
    }

    // 5. Date Range Filter (Using your startDate and endDate fields)
    if (checkIn && checkOut) {
      const userCheckIn = new Date(checkIn as string);
      const userCheckOut = new Date(checkOut as string);

      // Ensures the requested stay fits within the hotel's contract window
      query.startDate = { $lte: userCheckIn };
      query.endDate = { $gte: userCheckOut };
    }

    // Execute search and sort by price (ascending)
    const hotels = await Hotel.find(query).sort({ discountedPrice: 1 });
    res.json(hotels);

  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;