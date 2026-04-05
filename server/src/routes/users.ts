import { Router, Request, Response } from 'express';
import User from '../models/User.js';

const router: Router = Router();

/**
 * @route   GET /api/users
 * @desc    Get all users for the dashboard
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    // Fetches all users, sorted by most recently created
    const users = await User.find({}).sort({ createdAt: -1 });
    
    res.status(200).json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   POST /api/users/register
 * @desc    Create or Update user profile (Syncing from Chat/Bot)
 */
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      insta_tag, 
      fullName, 
      birthday, 
      passportNumber, 
      nationality, 
      email, 
      phone, 
      previousTrip 
    } = req.body;

    if (!insta_tag || !fullName || !birthday) {
      res.status(400).json({ error: "Missing required fields: insta_tag, fullName, or birthday" });
      return;
    }

    const cleanTag = String(insta_tag).toLowerCase().trim();

    // Use findOneAndUpdate with upsert to handle both new and returning users
    const user = await User.findOneAndUpdate(
      { insta_tag: cleanTag },
      { 
        fullName, 
        birthday: new Date(birthday),
        passportNumber,
        nationality,
        email,
        phone,
        previousTrip: previousTrip ? {
          destination: previousTrip.destination,
          date: new Date(previousTrip.date)
        } : undefined
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(200).json({
      message: "User profile synced successfully",
      user
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   PATCH /api/users/:id
 * @desc    Update specific fields (Passport, Email, etc.) during workflow
 */
router.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: req.body }, // Only updates the fields provided in the body
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json(updatedUser);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   GET /api/users/:insta_tag
 * @desc    Check if a user exists by their Instagram handle
 */
router.get('/:insta_tag', async (req: Request, res: Response): Promise<void> => {
  try {
    const { insta_tag } = req.params;

    if (typeof insta_tag !== 'string') {
      res.status(400).json({ error: "Invalid Instagram tag format" });
      return;
    }

    const cleanTag = insta_tag.toLowerCase().trim();
    const user = await User.findOne({ insta_tag: cleanTag });

    if (!user) {
      res.status(404).json({ exists: false, message: "User not found" });
      return;
    }

    res.json({ exists: true, user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route   GET /api/users/id/:id
 * @desc    Get user by MongoDB ID (Useful for the Chat Info Panel)
 */
router.get('/id/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;