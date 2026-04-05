import { Router, Request, Response } from 'express';
import Restaurant from '../models/Restaurant.js';

const router: Router = Router();

/**
 * @route   POST /api/restaurants
 * @desc    Add a new restaurant deal to the catalog
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurant = new Restaurant(req.body);
    await restaurant.save();
    res.status(201).json(restaurant);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route   GET /api/restaurants
 * @desc    Get all restaurants with optional filters (Location, Cuisine, Price)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { location, cuisine, priceRange } = req.query;
    let query: any = {};

    // Filter by location (e.g., "San Diego")
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }

    // Filter by cuisine (e.g., "Italian")
    if (cuisine) {
      query.cuisine = { $regex: cuisine, $options: 'i' };
    }

    // Exact match for the price range tiers (e.g., "30-50")
    if (priceRange) {
      query.priceRange = priceRange;
    }

    const restaurants = await Restaurant.find(query).sort({ rating: -1 });
    res.json(restaurants);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   GET /api/restaurants/:id
 * @desc    Get details for a specific restaurant
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    if (!restaurant) {
      res.status(404).json({ error: "Restaurant not found" });
      return;
    }
    res.json(restaurant);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   PATCH /api/restaurants/:id
 * @desc    Update restaurant details (inventory, rating, etc.)
 */
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!updatedRestaurant) {
      res.status(404).json({ error: "Restaurant not found" });
      return;
    }
    res.json(updatedRestaurant);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @route   DELETE /api/restaurants/:id
 * @desc    Remove a restaurant from the catalog
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const deletedRestaurant = await Restaurant.findByIdAndDelete(req.params.id);
    if (!deletedRestaurant) {
      res.status(404).json({ error: "Restaurant not found" });
      return;
    }
    res.json({ message: "Restaurant removed from catalog" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;