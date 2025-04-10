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

// GET addons filtered by package type
exports.getAddOnsByType = async (req, res) => {
  const { type } = req.query; // Using query parameter for type
  try {
    const addons = await AddOn.find({ applicableTo: { $in: [type] } }); // Ensure filtering is done correctly
    res.status(200).json(addons);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch addons by type', error });
  }
};
