// server.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

// CORS configuration
app.use(cors({
    origin: 'https://yonlad.github.io',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: false 
}));

// Log environment variables (without sensitive info)
console.log('Environment variables loaded:', {
    MONGODB_URI_EXISTS: !!process.env.MONGODB_URI,
    NODE_ENV: process.env.NODE_ENV
});

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in environment variables!');
    process.exit(1); // Exit if no connection string is provided
}

// Connection options
const mongooseOptions = {
    retryWrites: true,
    w: 'majority'
};

// Connect to MongoDB with retry logic
const connectWithRetry = async () => {
    try {
        console.log('Attempting to connect to MongoDB...');
        await mongoose.connect(MONGODB_URI, mongooseOptions);
        console.log('Successfully connected to MongoDB.');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        console.log('Connection string format:', MONGODB_URI.replace(/:[^:]*@/, ':****@')); // Log format without password
        console.log('Retrying connection in 5 seconds...');
        setTimeout(connectWithRetry, 5000);
    }
};

// Initial connection
connectWithRetry();



// Monitor the connection
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected. Attempting to reconnect...');
    connectWithRetry();
});

// Text Schema
const TextSchema = new mongoose.Schema({
    number: { type: String, required: true, unique: true },
    text: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
});

const Text = mongoose.model('Text', TextSchema);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.get('/api/texts/:number', async (req, res) => {
    try {
        const text = await Text.findOne({ number: req.params.number });
        // Return empty text if document doesn't exist
        res.json({ 
            text: text?.text || '',
            exists: !!text 
        });
    } catch (error) {
        console.error('Error getting text:', error);
        res.status(500).json({ error: 'Failed to get text' });
    }
});


app.post('/api/texts/:number', async (req, res) => {
    try {
        const result = await Text.findOneAndUpdate(
            { number: req.params.number },
            { 
                text: req.body.text,
                updatedAt: new Date()
            },
            { upsert: true, new: true }
        );
        res.json({ success: true, text: result });
    } catch (error) {
        console.error('Error saving text:', error);
        res.status(500).json({ error: 'Failed to save text' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    mongoose.connection.close();
    process.exit(0);
});