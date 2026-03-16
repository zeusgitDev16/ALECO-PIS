import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
// Removed mysql, nodemailer, bcrypt, and cloudinary - they are all handled by the bricks now!

// 1. Initialize environment variables & Lego Bricks
import authRoutes from './backend/routes/auth.js';
import ticketRoutes from './backend/routes/tickets.js';
import userRoutes from './backend/routes/user.js'; // <-- NEW: Imported your Admin brick
import ticketFilterRoutes from './backend/routes/ticket-routes.js';
import ticketGroupingRoutes from './backend/routes/ticket-grouping.js'; // <-- NEW: Ticket Grouping System


dotenv.config();

process.env.TZ = 'Asia/Manila';

const app = express();
const PORT = 5000;

// 2. Middleware (The Guards)
app.use(cors());
app.use(express.json());

// 3. Mount the Lego Bricks
// Every route you had before still perfectly exists at the exact same /api URL
app.use('/api', authRoutes);
app.use('/api', ticketRoutes);
app.use('/api', userRoutes);
app.use('/api', ticketFilterRoutes); // <-- Admin filter brick
app.use('/api', ticketGroupingRoutes); // <-- NEW: Ticket Grouping System

app.get('/api/debug/routes', (req, res) => {
    res.json({
        message: "All routes are mounted correctly!",
        availableRoutes: [
            "POST /api/tickets/submit",
            "GET /api/tickets/track/:ticketId",
            "GET /api/filtered-tickets",
            "GET /api/crews/list",
            "GET /api/pool/list"
        ]
    });
});

// 4. Start the Office
app.listen(PORT, () => {
  console.log(`Server running automatically on http://localhost:${PORT}`);
});