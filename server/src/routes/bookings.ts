import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import User from '../models/User.js';

const router: Router = Router();

/**
 * @route   POST /api/bookings
 * @desc    Create a new booking and decrement inventory
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, itemId, itemModel, budget, guests, notes } = req.body;

    // 1. Fetch the user and the specific item (Flight/Hotel)
    const [user, item] = await Promise.all([
      User.findById(userId),
      mongoose.model(itemModel).findById(itemId)
    ]);

    if (!user || !item) {
      res.status(404).json({ error: "User or Item not found." });
      return;
    }

    // 2. Inventory Check
    if (item.inventory <= 0) {
      res.status(400).json({ error: "Item is out of stock." });
      return;
    }

    // 3. Status Logic
    let status = 'confirmed';
    if (itemModel === 'Hotel') status = 'extracting';

    // 4. Create the Booking
    const newBooking = new Booking({
      userId,
      itemId,
      itemModel,
      customerName: user.fullName,
      destination: item.location || item.destination || "Global",
      budget: budget || item.discountedPrice,
      guests: guests || 1,
      notes: notes || "",
      status,
      providerName: item.providerName
    });

    const savedBooking = await newBooking.save();

    // 5. Decrement Inventory
    await mongoose.model(itemModel).findByIdAndUpdate(itemId, { $inc: { inventory: -1 } });

    res.status(201).json(savedBooking);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   GET /api/bookings
 * @desc    Get all bookings (Dashboard View)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Allows filtering by status via query: /api/bookings?status=extracting
    const { status } = req.query;
    const filter = status ? { status } : {};

    const bookings = await Booking.find(filter).sort({ createdAt: -1 });
    res.json(bookings);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   GET /api/bookings/:id
 * @desc    Get details for a specific booking
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id).populate('userId');
    if (!booking) {
      res.status(404).json({ error: "Booking not found." });
      return;
    }
    res.json(booking);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   PATCH /api/bookings/:id
 * @desc    Update status or notes (Operator Dashboard actions)
 */
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, notes } = req.body;
    const updatedBooking = await Booking.findByIdAndUpdate(
      req.params.id,
      { status, notes },
      { new: true, runValidators: true }
    );

    if (!updatedBooking) {
      res.status(404).json({ error: "Booking not found." });
      return;
    }
    res.json(updatedBooking);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   DELETE /api/bookings/:id
 * @desc    Remove a booking
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const deletedBooking = await Booking.findByIdAndDelete(req.params.id);
    if (!deletedBooking) {
      res.status(404).json({ error: "Booking not found." });
      return;
    }
    res.json({ message: "Booking deleted successfully" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;