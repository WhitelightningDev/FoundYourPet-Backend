const Membership = require('../models/Membership');

exports.getAllMemberships = async (req, res) => {
  try {
    const memberships = await Membership.find();
    return res.status(200).json(memberships);
  } catch (error) {
    return res.status(500).json({ msg: 'Failed to fetch memberships', error: error.message });
  }
};

exports.getMembershipById = async (req, res) => {
  try {
    const membership = await Membership.findById(req.params.id);
    if (!membership) return res.status(404).json({ msg: 'Membership not found' });
    return res.status(200).json(membership);
  } catch (error) {
    return res.status(500).json({ msg: 'Failed to fetch membership', error: error.message });
  }
};

exports.createMembership = async (req, res) => {
  try {
    const { name, price, features, billingCycle } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ msg: 'Missing required fields: name, price' });
    }

    const membership = await Membership.create({
      name: String(name).trim(),
      price: Number(price),
      features: Array.isArray(features) ? features : [],
      billingCycle: billingCycle ? String(billingCycle).trim() : 'monthly',
    });

    return res.status(201).json(membership);
  } catch (error) {
    return res.status(400).json({ msg: 'Failed to create membership', error: error.message });
  }
};

exports.updateMembership = async (req, res) => {
  try {
    const updates = {};
    for (const key of ['name', 'price', 'features', 'billingCycle']) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.name !== undefined) updates.name = String(updates.name).trim();
    if (updates.price !== undefined) updates.price = Number(updates.price);
    if (updates.billingCycle !== undefined) updates.billingCycle = String(updates.billingCycle).trim();
    if (updates.features !== undefined && !Array.isArray(updates.features)) {
      return res.status(400).json({ msg: 'features must be an array' });
    }

    const membership = await Membership.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!membership) return res.status(404).json({ msg: 'Membership not found' });
    return res.status(200).json(membership);
  } catch (error) {
    return res.status(400).json({ msg: 'Failed to update membership', error: error.message });
  }
};

exports.deleteMembership = async (req, res) => {
  try {
    const membership = await Membership.findByIdAndDelete(req.params.id);
    if (!membership) return res.status(404).json({ msg: 'Membership not found' });
    return res.status(200).json({ msg: 'Membership deleted' });
  } catch (error) {
    return res.status(500).json({ msg: 'Failed to delete membership', error: error.message });
  }
};

