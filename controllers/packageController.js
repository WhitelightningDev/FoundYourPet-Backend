const Package = require('../models/Package');

// Get all packages
exports.getAllPackages = async (req, res) => {
  try {
    const packages = await Package.find();
    res.json(packages);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching packages' });
  }
};

// Get single package by ID
exports.getPackageById = async (req, res) => {
  try {
    const pkg = await Package.findById(req.params.id);
    if (!pkg) return res.status(404).json({ message: 'Package not found' });
    res.json(pkg);
  } catch (err) {
    res.status(500).json({ message: 'Server error fetching package' });
  }
};

// ✅ Get single package by type (e.g. standard, apple, samsung)
exports.getPackageByType = async (req, res) => {
  try {
    const { type } = req.params;
    const pkg = await Package.findOne({ type: type.toLowerCase() });

    if (!pkg) {
      return res.status(404).json({ message: 'Package not found for this type' });
    }

    res.json(pkg);
  } catch (err) {
    console.error('Error fetching package by type:', err.message);
    res.status(500).json({ message: 'Server error fetching package by type' });
  }
};

// Create a new package
exports.createPackage = async (req, res) => {
  try {
    const { name, description, price, features, type, basePrice } = req.body;

    const newPackage = new Package({
      name,
      description,
      price,
      features,
      type: type?.toLowerCase() || '', // Optional safety
      basePrice
    });

    await newPackage.save();
    res.status(201).json(newPackage);
  } catch (err) {
    res.status(400).json({ message: 'Invalid data for creating package' });
  }
};
