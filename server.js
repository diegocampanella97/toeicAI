const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const session = require('express-session');
require('dotenv').config();
const { connectDB } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Connect to SQLite database
connectDB();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'toeic-study-app-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Routes
app.use('/', require('./routes/index'));
app.use('/statistics', require('./routes/statistics'));
app.use('/listening', require('./routes/listening'));

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});