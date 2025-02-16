const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const twilio = require("twilio");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// MongoDB Connection using Mongoose
const uri = "mongodb+srv://ksrinivasulureddy2:ERFUDOuMYxoOiqxA@ambulance.i9tlx.mongodb.net/ambulance?retryWrites=true&w=majority";
const client = new twilio("AC38cfc23faf5bed336f62506533bfe53f", "2833219081914e9e921adbba6dd7a300");
const otpStorage = {};

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

const userSchema = new mongoose.Schema({
  name: {type: String, required: true},
  phone_number: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  address: { type: String }, 
  role: { type: String, enum: ["Admin", "Captain"], required: true },
});

const bookingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  username: { type: String, required: true },
  ambulanceDetails: { type: String, required: true },
  totalPrice: { type: Number, required: true },
  address: { type: String, required: true },
  selectedOptions: { type: [String] },
  selectedHospital: { type: String, required: true },
  contactNumber: { type: String, required: true },
  payMethod: { type: String, enum: ["Online Payment", "Cash"], required: true },
  fromLocation: { latitude: Number, longitude: Number },
  toLocation: { latitude: Number, longitude: Number },
  timestamp: { type: Date, default: Date.now },
});

const hospitalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  contact: { type: String, required: true },
  services: { type: [String] },
});

const locationSchema = new mongoose.Schema({
  captainId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now },
});

const customerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phoneNumber: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  gender: { type: String },
  topup: { type: Number, default: 0 },
  address: { type: Array, default: [] },
  location: {
    from: { latitude: Number, longitude: Number },
    to: { latitude: Number, longitude: Number },
  },
  timestamp: { type: Date },
});

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  transactions: [
    {
      type: { type: String, enum: ["debit", "credit"], required: true },
      amount: { type: Number, required: true },
      description: { type: String, required: true },
      timestamp: { type: Date, default: Date.now },
    },
  ],
});


const User = mongoose.model("users", userSchema);
const Booking = mongoose.model("Booking", bookingSchema);
const Location = mongoose.model("Location", locationSchema);
const Customer = mongoose.model("Customer", customerSchema);
const Hospital = mongoose.model("Hospitals", hospitalSchema);
const Transaction = mongoose.model("Transaction", transactionSchema);

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

// Send OTP
app.post("/send-otp", async (req, res) => {
  const {name, phoneNumber } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000); // Generate 6-digit OTP
  otpStorage[phoneNumber] = otp; // Store OTP temporarily

  try {
      await client.messages.create({
        // username: name,
          body: `Your OTP is ${otp}`,
          from: "+1 831 999 8935",
          to: phoneNumber
      });
      res.status(200).json({ message: "OTP sent successfully" });
  } catch (error) {
    console.error(error)
      res.status(500).json({ error: "Failed to send OTP" });
  }
});

// Verify OTP
app.post("/verify-otp", (req, res) => {
  const { phoneNumber, otp } = req.body;
  if (otpStorage[phoneNumber] == otp) {
      delete otpStorage[phoneNumber]; // Remove OTP after verification
      res.status(200).json({ message: "OTP verified successfully" });
  } else {
      res.status(400).json({ error: "Invalid OTP" });
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
      name: username,
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
    console.log(booking)
    const userId = booking.userId
    const amount = booking.totalPrice
    const payMethod = booking.payMethod
    const customer = await Customer.findById(userId);
    if (!customer) {
        return res.status(404).json({ message: "User not found" });
    }

    if(payMethod === "Online Payment"){
      customer.topup -= amount;
      let transaction = await Transaction.findOne({ userId });

        if (!transaction) {
            transaction = new Transaction({ userId, transactions: [] });
        }

        transaction.transactions.push({
            type: "debit",
            amount: amount,
            description: `Ambulance Booking - ${booking.ambulanceDetails.name}`
        });

        await transaction.save();
    }
    await customer.save();
    const result = await booking.save();
    res.status(201).json({ message: "Booking saved!", bookingId: result._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save booking." });
  }
});

// **Get Bookings** //
app.get("/api/bookings", async (req, res) => {
  try {
    const bookings = await Booking.find();
    res.json(bookings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch bookings." });
  }
});

// **Get User Bookings**
app.get("/user/bookings", async (req, res) => {
  try {
    const { userId } = req.query; // Get user ID from request query
    console.log(userId);
    if (!userId) {
      console.log("user error");
      return res.status(400).json({ error: "User ID is required." });
    }

    const bookings = await Booking.find({ userId }); // Fetch bookings for the logged-in user
    console.log(bookings);
    
    res.json(bookings);
  } catch (err) {
    console.log(err);
    console.error(err);
    res.status(500).json({ error: "Failed to fetch bookings." });
  }
});

// **Get Users**
app.get("/api/get-customer", async (req, res) => {
  const { userId } = req.query; // ✅ Get userId from query params

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const customer = await Customer.findById(userId);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch customer." });
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

app.post("/update-address", async (req, res) => {
  const { userId, address } = req.body;

  if (!userId || !address) {
    return res.status(400).json({ message: "User ID and address are required." });
  }

  try {
    const user = await Customer.findById(userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Ensure address is stored as an array
    const updatedAddresses = Array.isArray(user.address) ? [...user.address, address] : [address];

    user.address = updatedAddresses;
    await user.save();

    res.json({ message: "Address updated successfully!", user });
  } catch (error) {
    res.status(500).json({ message: "Failed to update address.", error });
  }
});


// **Update Amount **

app.post("/api/recharge", async (req, res) => {
  try {
      const { userId, amount, transactionId } = req.body;

      const customer = await Customer.findById(userId);
      console.log(userId)
      if (!customer) {
          return res.status(404).json({ message: "User not found" });
      }

      customer.topup += amount;
      console.log(customer, amount)
      let transaction = await Transaction.findOne({ userId });

        if (!transaction) {
            transaction = new Transaction({ userId, transactions: [] });
        }

        transaction.transactions.push({
            type: "credit",
            amount: amount,
            description: `Recharge - ${transactionId}`
        });

        await transaction.save();
      await customer.save();

                               
      res.json({ message: "Recharge successful", newBalance: customer.topup });
  } catch (error) {
      console.error("Recharge Error:", error);
      res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/get-ambulaces", async (req, res) => {

  try {
    const hospitals = await Hospital.find();
    if (!hospitals) {
      return res.status(404).json({ error: "Customer not found" });
    }

    res.json(hospitals);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch hospitals." });
  }
});

app.get("/transactions/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
      const transaction = await Transaction.findOne({ userId });
      console.log(transaction)

      if (!transaction) return res.status(200).json([]);

      res.status(200).json(transaction.transactions);
  } catch (error) {
      console.error("Transaction fetch error:", error);
      res.status(500).json({ message: "Internal Server Error" });
  }
});