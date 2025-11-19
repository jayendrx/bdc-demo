const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const path = require("path");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { createServer } = require("http");
const { Server } = require("socket.io");

//schemas
const User = require("./models/users.js");
const Donation = require("./models/donation.js");
const Donor = require("./models/donor.js");
const Hospital = require("./models/hospitals.js");
require("dotenv").config();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "a_fallback_secret";

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

//Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "../frontend")));

function authenticateToken(req, res, next) {
    const token = req.cookies.token; 

    if (!token) {
        return next(); 
    }

    // 2. Verify the token
    jwt.verify(token, JWT_SECRET, (err, userPayload) => {
        if (err) {
            return res.status(401).json({ message: "Invalid or expired token" });
        }
        req.user = userPayload;
        next();
    });
}
app.use(authenticateToken);


// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/bdc", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
  });

//Login page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

//Login route
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid email or password" });
    }

    // 1. Create the Payload (the data you want to store in req.user)
    const payload = {
      _id: user._id,
      accountType: user.accountType,
      // Add any other necessary fields
    };

    // 2. Generate the Token
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" }); // Token expires in 1 hour

    // 3. Send the Token as an HTTP-Only Cookie
    // This is more secure than sending it in the JSON response
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Use secure in production
      maxAge: 3600000, // 1 hour
    });

    let redirectUrl = "";
    switch (user.accountType) {
      case "admin":
        redirectUrl = "/admin.html";
        break;
      case "registration":
        redirectUrl = "/registration.html";
        break;
      case "hospital":
        redirectUrl = "/hospital.html";
        break;
      case "stats":
        redirectUrl = "/stats.html";
        break;
      default:
        redirectUrl = "/index.html";
    }

    res.json({ success: true, redirectUrl });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

//registration page

// Serve registration dashboard page
app.get("/registration", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/registration.html"));
});

// Handle donor registration
app.post("/registration", async (req, res) => {
  const { donorType, name, registrationNumber, hospitalName } = req.body;

  try {
    const hospital = await Hospital.findOne({ name: hospitalName });
    if (!hospital)
      return res
        .status(400)
        .json({ success: false, message: "Hospital not found" });

    let donor = await Donor.findOne({ registrationNumber });
    if (!donor) {
      donor = new Donor({ name, registrationNumber, donorType });
      await donor.save();
    }

    const donation = new Donation({
      donatedBy: donor._id,
      donatedTo: hospital._id,
      status: "Pending",
    });
    await donation.save();

    hospital.waiting += 1;
    await hospital.save();

    // Broadcast stats update
    broadcastStatsUpdate();

    res.json({ success: true, message: "Registration recorded successfully!" });
  } catch (err) {
    console.error("Error registering donor:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Fetch hospital stats
app.get("/hospitals", async (req, res) => {
  try {
    const hospitals = await Hospital.aggregate([
      {
        $addFields: {
          priorityScore: { $subtract: ["$beds", "$waiting"] },
        },
      },
      {
        $sort: { priorityScore: -1 },
      },
      {
        $project: {
          name: 1,
          beds: 1,
          waiting: 1,
          current: 1,
          target: 1,
          priorityScore: 1,
        },
      },
    ]);

    const formatted = hospitals.map((h) => ({
      name: h.name,
      beds: h.beds,
      waiting: h.waiting,
      current: h.current,
      target: h.target,
      percentage: ((h.current / h.target) * 100).toFixed(1),
      priorityScore: h.priorityScore,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Error fetching hospitals:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Stats API endpoints
async function getStatsData() {
  try {
    // Get total accepted donations (only accepted blood counts as donations)
    const totalDonations = await Donation.countDocuments({ isBloodAccepted: true });
    
    // Get donations by status
    const acceptedDonations = await Donation.countDocuments({ isBloodAccepted: true });
    const rejectedDonations = await Donation.countDocuments({ isBloodRejected: true });
    const pendingDonations = await Donation.countDocuments({ 
      isBloodAccepted: false, 
      isBloodRejected: false 
    });
    
    // Get hospitals with their current and target counts
    const hospitals = await Hospital.find({}, 'name current target waiting beds');
    
    // Get donor type distribution (only for accepted donations)
    const donorTypeStats = await Donation.aggregate([
      {
        $match: { isBloodAccepted: true }
      },
      {
        $lookup: {
          from: 'donors',
          localField: 'donatedBy',
          foreignField: '_id',
          as: 'donor'
        }
      },
      {
        $unwind: '$donor'
      },
      {
        $group: {
          _id: '$donor.donorType',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const donorTypes = {};
    donorTypeStats.forEach(stat => {
      donorTypes[stat._id] = stat.count;
    });
    
    return {
      totalDonations,
      hospitals: hospitals.map(h => ({
        name: h.name,
        current: h.current,
        target: h.target,
        waiting: h.waiting,
        beds: h.beds
      })),
      donorTypes,
      donationStatus: {
        Accepted: acceptedDonations,
        Rejected: rejectedDonations,
        Pending: pendingDonations
      }
    };
  } catch (error) {
    console.error('Error fetching stats:', error);
    throw error;
  }
}

// Get stats endpoint
app.get("/api/stats", async (req, res) => {
  try {
    const stats = await getStatsData();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Function to broadcast stats updates
async function broadcastStatsUpdate() {
  try {
    const stats = await getStatsData();
    io.emit('statsUpdate', stats);
  } catch (error) {
    console.error('Error broadcasting stats:', error);
  }
}

//Hospital POC Dashboard

function hospitalOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized / req.user missing" });
  }

  // TEMPORARY DEBUGGING LOG: Check the console output
    console.log("User attempting access. Account Type found in JWT:", req.user.accountType); 
    console.log("Expected Type:", "hospital");

  if (req.user.accountType !== "hospital") {
    return res.status(403).json({ message: "Forbidden" });
  }

  next();
}

// Get donors assigned to the logged-in hospital POC
app.get("/hospital/donors", hospitalOnly, async (req, res) => {
  try {
    const userId = req.user._id; // <-- assuming auth middleware sets this
    const hospital = await Hospital.findOne({ user: userId });
    // // find hospital owned by this user

    if (!hospital) return res.status(404).json({ msg: "Hospital not found" });

    const donations = await Donation.find({ donatedTo: hospital._id }).populate(
      "donatedBy",
      "name registrationNumber donorType"
    );

    const pendingReview = donations.filter(
      (d) => !d.isBloodAccepted && !d.isBloodRejected
    );

    const pendingCert = donations.filter(
      (d) => d.isBloodAccepted && !d.isCertificateIssued
    );

    res.json({
      pendingReview,
      pendingCert,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ msg: "Server error" });
  }
});

app.post("/hospital/accept/:id", hospitalOnly, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id).populate(
      "donatedTo"
    );
    if (!donation) return res.status(404).json({ msg: "Donation not found" });

    const hospital = await Hospital.findOne({ user: req.user._id }); // Fetch current hospital
    if (!hospital)
      return res.status(403).json({ msg: "Hospital not linked to user" });

    if (!donation.donatedTo._id.equals(hospital._id)) {
      return res
        .status(403)
        .json({ msg: "Forbidden: Donation not assigned to your hospital" });
    }

    if (!donation.isBloodAccepted && !donation.isBloodRejected) {
      donation.isBloodAccepted = true;

      donation.donatedTo.waiting -= 1;
      await donation.donatedTo.save();
      await donation.save();
      
      // Broadcast stats update
      broadcastStatsUpdate();
    }

    res.json({ msg: "Donation accepted" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

app.post("/hospital/reject/:id", hospitalOnly, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id).populate(
      "donatedTo"
    );
    if (!donation) return res.status(404).json({ msg: "Donation not found" });

    const hospital = await Hospital.findOne({ user: req.user._id }); // Fetch current hospital
    if (!hospital)
      return res.status(403).json({ msg: "Hospital not linked to user" });

    if (!donation.donatedTo._id.equals(hospital._id)) {
      return res
        .status(403)
        .json({ msg: "Forbidden: Donation not assigned to your hospital" });
    }

    if (!donation.isBloodAccepted && !donation.isBloodRejected) {
      donation.isBloodRejected = true;

      donation.donatedTo.waiting -= 1;
      await donation.donatedTo.save();
      await donation.save();
      
      // Broadcast stats update
      broadcastStatsUpdate();
    }

    res.json({ msg: "Donation rejected" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

app.post("/hospital/certificate/:id", hospitalOnly, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id).populate(
      "donatedTo"
    );
    if (!donation) return res.status(404).json({ msg: "Donation not found" });

    const hospital = await Hospital.findOne({ user: req.user._id }); // Fetch current hospital
    if (!hospital)
      return res.status(403).json({ msg: "Hospital not linked to user" });

    if (!donation.donatedTo._id.equals(hospital._id)) {
      return res
        .status(403)
        .json({ msg: "Forbidden: Donation not assigned to your hospital" });
    }

    if (donation.isBloodAccepted && !donation.isCertificateIssued) {
      donation.isCertificateIssued = true;

      donation.donatedTo.current += 1;
      await donation.donatedTo.save();
      await donation.save();
      
      // Broadcast stats update
      broadcastStatsUpdate();
    }

    res.json({ msg: "Certificate issued" });
  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// Admin Only Middleware
function adminOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized / req.user missing" });
  }

  if (req.user.accountType !== "admin") {
    return res.status(403).json({ message: "Forbidden: Admin access required" });
  }

  next();
}

// ========== ADMIN ROUTES - USERS ==========
// Get all users
app.get("/admin/users", adminOnly, async (req, res) => {
  try {
    const users = await User.find({}).select("-password");
    res.json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get single user
app.get("/admin/users/:id", adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Create user
app.post("/admin/users", adminOnly, async (req, res) => {
  try {
    const { name, email, password, accountType } = req.body;
    
    if (!name || !email || !password || !accountType) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, accountType });
    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;
    res.status(201).json(userResponse);
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update user
app.put("/admin/users/:id", adminOnly, async (req, res) => {
  try {
    const { name, email, password, accountType } = req.body;
    const user = await User.findById(req.params.id);
    
    if (!user) return res.status(404).json({ message: "User not found" });

    if (name) user.name = name;
    if (email) user.email = email;
    if (accountType) user.accountType = accountType;
    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;
    res.json(userResponse);
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete user
app.delete("/admin/users/:id", adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ========== ADMIN ROUTES - DONORS ==========
// Get all donors
app.get("/admin/donors", adminOnly, async (req, res) => {
  try {
    const donors = await Donor.find({});
    res.json(donors);
  } catch (err) {
    console.error("Error fetching donors:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get single donor
app.get("/admin/donors/:id", adminOnly, async (req, res) => {
  try {
    const donor = await Donor.findById(req.params.id);
    if (!donor) return res.status(404).json({ message: "Donor not found" });
    res.json(donor);
  } catch (err) {
    console.error("Error fetching donor:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Create donor
app.post("/admin/donors", adminOnly, async (req, res) => {
  try {
    const { name, registrationNumber, donorType } = req.body;
    
    if (!name || !registrationNumber || !donorType) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existingDonor = await Donor.findOne({ registrationNumber });
    if (existingDonor) {
      return res.status(400).json({ message: "Donor with this registration number already exists" });
    }

    const donor = new Donor({ name, registrationNumber, donorType });
    await donor.save();
    res.status(201).json(donor);
  } catch (err) {
    console.error("Error creating donor:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update donor
app.put("/admin/donors/:id", adminOnly, async (req, res) => {
  try {
    const { name, registrationNumber, donorType } = req.body;
    const donor = await Donor.findById(req.params.id);
    
    if (!donor) return res.status(404).json({ message: "Donor not found" });

    if (name) donor.name = name;
    if (registrationNumber) donor.registrationNumber = registrationNumber;
    if (donorType) donor.donorType = donorType;

    await donor.save();
    res.json(donor);
  } catch (err) {
    console.error("Error updating donor:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete donor
app.delete("/admin/donors/:id", adminOnly, async (req, res) => {
  try {
    const donor = await Donor.findById(req.params.id);
    if (!donor) return res.status(404).json({ message: "Donor not found" });

    await Donor.findByIdAndDelete(req.params.id);
    res.json({ message: "Donor deleted successfully" });
  } catch (err) {
    console.error("Error deleting donor:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ========== ADMIN ROUTES - DONATIONS ==========
// Get all donations
app.get("/admin/donations", adminOnly, async (req, res) => {
  try {
    const donations = await Donation.find({})
      .populate("donatedBy", "name registrationNumber donorType")
      .populate("donatedTo", "name");
    res.json(donations);
  } catch (err) {
    console.error("Error fetching donations:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get single donation
app.get("/admin/donations/:id", adminOnly, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id)
      .populate("donatedBy", "name registrationNumber donorType")
      .populate("donatedTo", "name");
    if (!donation) return res.status(404).json({ message: "Donation not found" });
    res.json(donation);
  } catch (err) {
    console.error("Error fetching donation:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Create donation
app.post("/admin/donations", adminOnly, async (req, res) => {
  try {
    const { donatedBy, donatedTo, isBloodAccepted, isBloodRejected, isCertificateIssued } = req.body;
    
    if (!donatedBy || !donatedTo) {
      return res.status(400).json({ message: "Donor and Hospital are required" });
    }

    const donation = new Donation({
      donatedBy,
      donatedTo,
      isBloodAccepted: isBloodAccepted || false,
      isBloodRejected: isBloodRejected || false,
      isCertificateIssued: isCertificateIssued || false
    });
    await donation.save();

    // Update hospital waiting count if needed
    if (!isBloodAccepted && !isBloodRejected) {
      const hospital = await Hospital.findById(donatedTo);
      if (hospital) {
        hospital.waiting += 1;
        await hospital.save();
      }
    }

    await donation.populate("donatedBy", "name registrationNumber donorType");
    await donation.populate("donatedTo", "name");
    
    broadcastStatsUpdate();
    res.status(201).json(donation);
  } catch (err) {
    console.error("Error creating donation:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update donation
app.put("/admin/donations/:id", adminOnly, async (req, res) => {
  try {
    const { donatedBy, donatedTo, isBloodAccepted, isBloodRejected, isCertificateIssued } = req.body;
    const donation = await Donation.findById(req.params.id).populate("donatedTo");
    
    if (!donation) return res.status(404).json({ message: "Donation not found" });

    const oldAccepted = donation.isBloodAccepted;
    const oldRejected = donation.isBloodRejected;
    const oldCertificate = donation.isCertificateIssued;

    if (donatedBy) donation.donatedBy = donatedBy;
    if (donatedTo) donation.donatedTo = donatedTo;
    if (isBloodAccepted !== undefined) donation.isBloodAccepted = isBloodAccepted;
    if (isBloodRejected !== undefined) donation.isBloodRejected = isBloodRejected;
    if (isCertificateIssued !== undefined) donation.isCertificateIssued = isCertificateIssued;

    await donation.save();

    // Update hospital stats if status changed
    const hospital = await Hospital.findById(donation.donatedTo._id || donation.donatedTo);
    if (hospital) {
      // Handle waiting count changes
      if (!oldAccepted && !oldRejected && (donation.isBloodAccepted || donation.isBloodRejected)) {
        hospital.waiting = Math.max(0, hospital.waiting - 1);
      }
      
      // Handle current count changes
      if (!oldCertificate && donation.isCertificateIssued && donation.isBloodAccepted) {
        hospital.current += 1;
      } else if (oldCertificate && !donation.isCertificateIssued && donation.isBloodAccepted) {
        hospital.current = Math.max(0, hospital.current - 1);
      }
      
      await hospital.save();
    }

    await donation.populate("donatedBy", "name registrationNumber donorType");
    await donation.populate("donatedTo", "name");
    
    broadcastStatsUpdate();
    res.json(donation);
  } catch (err) {
    console.error("Error updating donation:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete donation
app.delete("/admin/donations/:id", adminOnly, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id).populate("donatedTo");
    if (!donation) return res.status(404).json({ message: "Donation not found" });

    // Update hospital stats if needed
    const hospital = await Hospital.findById(donation.donatedTo._id || donation.donatedTo);
    if (hospital) {
      if (!donation.isBloodAccepted && !donation.isBloodRejected) {
        hospital.waiting = Math.max(0, hospital.waiting - 1);
      }
      if (donation.isCertificateIssued && donation.isBloodAccepted) {
        hospital.current = Math.max(0, hospital.current - 1);
      }
      await hospital.save();
    }

    await Donation.findByIdAndDelete(req.params.id);
    broadcastStatsUpdate();
    res.json({ message: "Donation deleted successfully" });
  } catch (err) {
    console.error("Error deleting donation:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ========== ADMIN ROUTES - HOSPITALS ==========
// Get all hospitals
app.get("/admin/hospitals", adminOnly, async (req, res) => {
  try {
    const hospitals = await Hospital.find({}).populate("user", "email accountType");
    res.json(hospitals);
  } catch (err) {
    console.error("Error fetching hospitals:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get single hospital
app.get("/admin/hospitals/:id", adminOnly, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id).populate("user", "email accountType");
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });
    res.json(hospital);
  } catch (err) {
    console.error("Error fetching hospital:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Create hospital
app.post("/admin/hospitals", adminOnly, async (req, res) => {
  try {
    const { name, phone, current, target, waiting, beds, user, isLocked } = req.body;
    
    if (!name || !phone || current === undefined || target === undefined || 
        waiting === undefined || beds === undefined) {
      return res.status(400).json({ message: "All required fields must be provided" });
    }

    const hospital = new Hospital({
      name,
      phone,
      current: current || 0,
      target: target || 0,
      waiting: waiting || 0,
      beds: beds || 0,
      user: user || null,
      isLocked: isLocked || false
    });
    await hospital.save();

    await hospital.populate("user", "email accountType");
    broadcastStatsUpdate();
    res.status(201).json(hospital);
  } catch (err) {
    console.error("Error creating hospital:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Update hospital
app.put("/admin/hospitals/:id", adminOnly, async (req, res) => {
  try {
    const { name, phone, current, target, waiting, beds, user, isLocked } = req.body;
    const hospital = await Hospital.findById(req.params.id);
    
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });

    if (name) hospital.name = name;
    if (phone) hospital.phone = phone;
    if (current !== undefined) hospital.current = current;
    if (target !== undefined) hospital.target = target;
    if (waiting !== undefined) hospital.waiting = waiting;
    if (beds !== undefined) hospital.beds = beds;
    if (user !== undefined) hospital.user = user || null;
    if (isLocked !== undefined) hospital.isLocked = isLocked;

    await hospital.save();
    await hospital.populate("user", "email accountType");
    
    broadcastStatsUpdate();
    res.json(hospital);
  } catch (err) {
    console.error("Error updating hospital:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete hospital
app.delete("/admin/hospitals/:id", adminOnly, async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) return res.status(404).json({ message: "Hospital not found" });

    await Hospital.findByIdAndDelete(req.params.id);
    broadcastStatsUpdate();
    res.json({ message: "Hospital deleted successfully" });
  } catch (err) {
    console.error("Error deleting hospital:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected to stats dashboard:', socket.id);
  
  // Send initial stats when client connects
  socket.on('requestStats', async () => {
    try {
      const stats = await getStatsData();
      socket.emit('statsUpdate', stats);
    } catch (error) {
      console.error('Error sending initial stats:', error);
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected from stats dashboard:', socket.id);
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Socket.IO server ready for real-time stats updates`);
});
