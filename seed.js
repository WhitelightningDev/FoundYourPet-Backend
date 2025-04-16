const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

const AddOn = require('./models/AddOn');
const Package = require('./models/Package');
const User = require('./models/user'); // 👈 Import User model

dotenv.config();

const seedAddOns = [
  { name: "Heart-Shaped Tag", price: 30, applicableTo: ["standard"] },
  { name: "Bone-Shaped Tag", price: 35, applicableTo: ["standard"] },
  { name: "Apple AirTag", price: 800, applicableTo: ["apple"] },
  { name: "AirTag Collar Holder", price: 499, applicableTo: ["apple"] },
  { name: "Samsung Smart Tag", price: 499, applicableTo: ["samsung"] },
  { name: "Samsung Tag Holder", price: 100, applicableTo: ["samsung"] }
];

const seedPackages = [
  {
    name: "Standard Tag Package",
    type: "standard",
    basePrice: 120,
    price: 190,
    description: "Classic engraved QR tag with monthly support membership.",
    features: [
      "25mm Aluminium Round Tag",
      "Engraved QR Code",
      "Delivery To Closest PUDO Locker",
      "Pet Profile Access",
      "Initial Amount Includes R50 For Monthley Membership"
    ]
  },
  {
    name: "Samsung Smart Tag Package",
    type: "samsung",
    basePrice: 499,
    price: 499,
    description: "Smart tracking with Samsung SmartThings app.",
    features: ["Samsung SmartTag", "GPS tracking", "Device integration"]
  },
  {
    name: "Apple AirTag Package",
    type: "apple",
    basePrice: 800,
    price: 800,
    description: "Seamless tracking via Apple Find My network.",
    features: ["Apple AirTag", "Find My support", "Precision tracking"]
  }
];

const adminUser = {
  name: 'admin',
  surname: 'user',
  contact: '0746588885',
  email: 'danielmommsen2@gmail.com',
  password: 'Admin',
  address: {
    street: 'N/A',
    city: 'N/A',
    province: 'N/A',
    postalCode: '0000',
    country: 'N/A'
  },
  privacyPolicy: true,
  termsConditions: true,
  agreement: true,
  isAdmin: true // Set the isAdmin flag to true
};

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔗 Connected to MongoDB');

    // Clear and reseed AddOns and Packages
    await AddOn.deleteMany({});
    await Package.deleteMany({});
    await AddOn.insertMany(seedAddOns);
    await Package.insertMany(seedPackages);
    console.log('✅ AddOns and Packages seeded successfully!');

    // Seed Admin user if not exists
    let existingAdmin = await User.findOne({ email: adminUser.email });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminUser.password, 10);
      adminUser.password = hashedPassword;
      existingAdmin = await User.create(adminUser);
      console.log('✅ Admin user created!');
    } else {
      // Update isAdmin flag if the user is found but not an admin
      if (!existingAdmin.isAdmin) {
        existingAdmin.isAdmin = true;
        await existingAdmin.save();
        console.log('✅ Admin user updated to isAdmin=true');
      } else {
        console.log('⚠️ Admin user already exists and isAdmin is set to true.');
      }
    }

    process.exit();
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

seedDatabase();
