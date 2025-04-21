const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

const AddOn = require('./models/AddOn');
const Package = require('./models/Package');
const Membership = require('./models/Membership'); // Make sure this exists
const User = require('./models/user');

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
    price: 210, // ✅ Correct base price
    description: "Classic engraved QR tag with delivery and pet profile access.",
    features: [
      "25mm Nickel-Plated Tag (Rust-Proof)",
      "Engraved QR Code",
      "Delivery To Closest PUDO Locker",
      "Pet Profile Access"
    ]
  }
];

const seedMemberships = [
  {
    name: "Standard Support Membership",
    price: 50, // ✅ Correct monthly fee
    billingCycle: "monthly",
    features: [
      "Ongoing Pet Profile Hosting",
      "Free Tag Replacement",
      "Priority Support",
      "Early Access to New Features"
    ]
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
  isAdmin: true
};

async function seedDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🔗 Connected to MongoDB');

    await AddOn.deleteMany({});
    await Package.deleteMany({});
    await Membership.deleteMany({}); // ✅ Reset memberships

    await AddOn.insertMany(seedAddOns);
    await Package.insertMany(seedPackages);
    await Membership.insertMany(seedMemberships); // ✅ Insert membership

    console.log('✅ AddOns, Packages, and Memberships seeded successfully!');

    let existingAdmin = await User.findOne({ email: adminUser.email });
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminUser.password, 10);
      adminUser.password = hashedPassword;
      existingAdmin = await User.create(adminUser);
      console.log('✅ Admin user created!');
    } else {
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
