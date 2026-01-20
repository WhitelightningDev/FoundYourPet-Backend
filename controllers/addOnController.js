const AddOn = require('../models/AddOn');

// GET all addons
exports.getAllAddOns = async (req, res) => {
  try {
    const addons = await AddOn.find();
    res.status(200).json(addons);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch addons', error });
  }
};

// GET addon by id
exports.getAddOnById = async (req, res) => {
  try {
    const addon = await AddOn.findById(req.params.id);
    if (!addon) return res.status(404).json({ message: 'AddOn not found' });
    return res.status(200).json(addon);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch addon', error });
  }
};

// GET addons filtered by package type
exports.getAddOnsByType = async (req, res) => {
  const { type } = req.query; // Using query parameter for type
  try {
    if (!type) return res.status(400).json({ message: 'Missing type query parameter' });
    const addons = await AddOn.find({ applicableTo: { $in: [type] } }); // Ensure filtering is done correctly
    res.status(200).json(addons);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch addons by type', error });
  }
};

// CREATE addon (admin)
exports.createAddOn = async (req, res) => {
  try {
    const { name, price, applicableTo, imageUrl } = req.body;
    if (!name || price === undefined || !Array.isArray(applicableTo) || applicableTo.length === 0) {
      return res.status(400).json({ message: 'Invalid addon data' });
    }

    const addon = await AddOn.create({
      name: String(name).trim(),
      price: Number(price),
      applicableTo: applicableTo.map((t) => String(t).trim().toLowerCase()),
      imageUrl: imageUrl ? String(imageUrl).trim() : undefined,
    });

    return res.status(201).json(addon);
  } catch (error) {
    return res.status(400).json({ message: 'Failed to create addon', error });
  }
};

// UPDATE addon (admin)
exports.updateAddOn = async (req, res) => {
  try {
    const updates = {};
    for (const key of ['name', 'price', 'applicableTo', 'imageUrl']) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.name !== undefined) updates.name = String(updates.name).trim();
    if (updates.price !== undefined) updates.price = Number(updates.price);
    if (updates.applicableTo !== undefined) {
      if (!Array.isArray(updates.applicableTo) || updates.applicableTo.length === 0) {
        return res.status(400).json({ message: 'applicableTo must be a non-empty array' });
      }
      updates.applicableTo = updates.applicableTo.map((t) => String(t).trim().toLowerCase());
    }
    if (updates.imageUrl !== undefined) {
      updates.imageUrl = updates.imageUrl ? String(updates.imageUrl).trim() : undefined;
    }

    const addon = await AddOn.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!addon) return res.status(404).json({ message: 'AddOn not found' });
    return res.status(200).json(addon);
  } catch (error) {
    return res.status(400).json({ message: 'Failed to update addon', error });
  }
};

// DELETE addon (admin)
exports.deleteAddOn = async (req, res) => {
  try {
    const addon = await AddOn.findByIdAndDelete(req.params.id);
    if (!addon) return res.status(404).json({ message: 'AddOn not found' });
    return res.status(200).json({ message: 'AddOn deleted' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete addon', error });
  }
};
