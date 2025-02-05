const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection using Mongoose
const uri = "mongodb+srv://ksrinivasulureddy2:ERFUDOuMYxoOiqxA@ambulance.i9tlx.mongodb.net/ambulance?retryWrites=true&w=majority";

mongoose
  .connect(uri)
  .then(() => {
    console.log("Connected to MongoDB Atlas");
    app.listen(3001, () => {
      console.log("Server running at http://localhost:3001/");
    });
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB Atlas:", error);
    process.exit(1);
  });

// Mongoose Schemas and Models
const userSchema = new mongoose.Schema({
  userId: String,
  phone_number: String,
  password: String,
  role: String,
});

const bookingSchema = new mongoose.Schema({
  userId: String,
  ambulanceId: Number,
  ambulanceName: String,
  totalPrice: Number,
  timestamp: Date,
  location: String,
  time: Date,
});

const locationSchema = new mongoose.Schema({
  captainId: String,
  latitude: Number,
  longitude: Number,
});

const customerSchema = new mongoose.Schema({
  userId: { type: String },
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  gender: { type: String },
  topup: { type: Number, default: 0 },
});

const User = mongoose.model("users", userSchema);
const Booking = mongoose.model("Booking", bookingSchema);
const Location = mongoose.model("Location", locationSchema);
const Customer = mongoose.model("Customer", customerSchema);

// Middleware for JWT Authentication
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(401).json({ error: "Invalid JWT Token" });
  }

  const jwtToken = authHeader.split(" ")[1];
  jwt.verify(jwtToken, "MY_SECRET_TOKEN", (error) => {
    if (error) {
      return res.status(401).json({ error: "Invalid JWT Token" });
    }
    next();
  });
};


app.post("/register", async (req, res) => {
  try {
    const { name, phoneNumber, password, gender, topup } = req.body;

    // Check if the user already exists
    const existingUser = await Customer.findOne({ phoneNumber });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new customer
    const newCustomer = new Customer({
      name,
      phoneNumber,
      password: hashedPassword,
      gender,
      topup,
    });

    // Save customer to database
    await newCustomer.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error creating user: " + error.message });
  }
});

// **Customer Login**
app.post("/customerLogin", async (req, res) => {
  const { phoneNumber, password } = req.body;

  try {
    const user = await Customer.findOne({ phoneNumber });

    if (!user) {
      return res.status(400).json({ error: "Invalid User" });
    }

    // Compare hashed passwords
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(400).json({ error: "Invalid Password" });
    }

    // Generate JWT Token
    const payload = { phoneNumber };
    const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN", { expiresIn: "1h" });

    return res.status(200).json({ message: "Login Success", jwtToken, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// **Captain Login**
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  console.log(req.body)
  console.log(password)
  try {
    const captain = await User.findOne({
      username: username,
      role: "Captain",
    });

    if (!captain) {
      return res.status(400).json({ error: "Invalid User" });
    }

    if (password === captain.password) {
      const payload = { username };
      const jwtToken = jwt.sign(payload, "CAPTAIN_SECRET_TOKEN");
      return res.status(200).json({ message: "Login Success", jwtToken });
    } else {
      return res.status(400).json({ error: "Invalid Password" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// **Admin Login**
app.post("/adminLogin", async (req, res) => {
  const { username, password } = req.body;

  try {
    const admin = await User.findOne({
      username: username,
      role: "Admin",
    });

    if (!admin) {
      return res.status(400).json({ error: "Invalid User" });
    }

    if (password === admin.password) {
      const payload = { username };
      const jwtToken = jwt.sign(payload, "ADMIN_SECRET_TOKEN");
      return res.status(200).json({ message: "Login Success", jwtToken });
    } else {
      return res.status(400).json({ error: "Invalid Password" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
});

// **Add Booking**
app.post("/api/bookings", async (req, res) => {
  try {
    const booking = new Booking(req.body);
    console.log(req.body)
    const result = await booking.save();
    res.status(201).json({ message: "Booking saved!", bookingId: result._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save booking." });
  }
});

// **Get Bookings**
app.get("/api/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch bookings." });
  }
});

// **Get Users**
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users." });
  }
});

// **Update Captain Location**
app.post("/update-location", async (req, res) => {
  const { captainId, latitude, longitude } = req.body;

  if (!captainId || !latitude || !longitude) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const location = new Location({ captainId, latitude, longitude });
    const result = await location.save();
    res
      .status(200)
      .json({ message: "Location updated successfully.", locationId: result._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to store location." });
  }
});
