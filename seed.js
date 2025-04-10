const mongoose = require('mongoose');
const dotenv = require('dotenv');
const AddOn = require('./models/AddOn');
const Package = require('./models/Package');

dotenv.config(); // Make sure you have .env with your DB connection

const seedAddOns = [
  { name: "QR Code Engraving", price: 99, applicableTo: ["standard"] },
  { name: "Standard Pet Tag", price: 30, applicableTo: ["standard"] },
  { name: "Apple AirTag", price: 800, applicableTo: ["apple"] },
  { name: "AirTag Collar Holder", price: 499, applicableTo: ["apple"] },
  { name: "Samsung Smart Tag", price: 499, applicableTo: ["samsung"] },
  { name: "Samsung Tag Holder", price: 100, applicableTo: ["samsung"] }
];

const seedPackages = [
  {
    name: "Standard Tag Package",
    type: "standard",
    basePrice: 30,
    description: "Classic engraved QR tag to attach to any collar.",
    includes: ["Durable tag", "QR code", "Pet profile access"]
  },
  {
    name: "Samsung Smart Tag Package",
    type: "samsung",
    basePrice: 499,
    description: "Smart tracking with Samsung SmartThings app.",
    includes: ["Samsung SmartTag", "GPS tracking", "Device integration"]
  },
  {
    name: "Apple AirTag Package",
    type: "apple",
    basePrice: 800,
    description: "Seamless tracking via Apple Find My network.",
    includes: ["Apple AirTag", "Find My support", "Precision tracking"]
  }
];

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔗 Connected to MongoDB');

    await AddOn.deleteMany({});
    await Package.deleteMany({});

    await AddOn.insertMany(seedAddOns);
    await Package.insertMany(seedPackages);

    console.log('✅ AddOns and Packages seeded successfully!');
    process.exit();
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seedDatabase();
