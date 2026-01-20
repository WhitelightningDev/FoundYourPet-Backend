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

// Update a package (admin)
exports.updatePackage = async (req, res) => {
  try {
    const updates = {};
    for (const key of ['name', 'description', 'basePrice', 'price', 'features', 'type']) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.type !== undefined) updates.type = String(updates.type).trim().toLowerCase();
    if (updates.features !== undefined && !Array.isArray(updates.features)) {
      return res.status(400).json({ message: 'features must be an array' });
    }

    const pkg = await Package.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!pkg) return res.status(404).json({ message: 'Package not found' });
    return res.status(200).json(pkg);
  } catch (err) {
    return res.status(400).json({ message: 'Invalid data for updating package' });
  }
};

// Delete a package (admin)
exports.deletePackage = async (req, res) => {
  try {
    const pkg = await Package.findByIdAndDelete(req.params.id);
    if (!pkg) return res.status(404).json({ message: 'Package not found' });
    return res.status(200).json({ message: 'Package deleted' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error deleting package' });
  }
};
