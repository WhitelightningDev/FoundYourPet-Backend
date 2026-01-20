const Payment = require('../models/Payment');
const Pet = require('../models/Pet');
const User = require('../models/User');

const getTagTypeFromPackageType = (packageType) => {
  const normalized = (packageType || '').toString().trim().toLowerCase();
  if (normalized.includes('airtag') && normalized.includes('apple')) return 'Apple AirTag';
  if (normalized.includes('smart') && normalized.includes('samsung')) return 'Samsung SmartTag';
  if (normalized.includes('tag')) return 'Standard';
  return null;
};

const finalizeSuccessfulPayment = async ({ paymentId, yocoChargeId = null, metadata = null, now = new Date() }) => {
  if (!paymentId) return { ok: false, reason: 'missing_payment_id' };

  const payment = await Payment.findById(paymentId);
  if (!payment) return { ok: false, reason: 'payment_not_found' };

  const paymentKind = payment.kind || (payment.membership || metadata?.membershipId ? 'membership' : 'tag');
  const membershipId = payment.membership || metadata?.membershipId || null;

  const tagType =
    metadata?.tagType ||
    getTagTypeFromPackageType(payment.packageType || metadata?.packageType);

  const alreadyProcessed = !!payment.processedAt;

  if (!alreadyProcessed) {
    const update = {
      status: 'successful',
      updatedAt: now,
      processedAt: now,
    };
    if (yocoChargeId) update.yocoChargeId = yocoChargeId;
    if (membershipId && !payment.membership) update.membership = membershipId;

    await Payment.findOneAndUpdate(
      { _id: paymentId, processedAt: null },
      { $set: update }
    );
  } else if (payment.status !== 'successful') {
    const update = { status: 'successful', updatedAt: now };
    if (yocoChargeId && !payment.yocoChargeId) update.yocoChargeId = yocoChargeId;
    if (membershipId && !payment.membership) update.membership = membershipId;
    await Payment.findByIdAndUpdate(paymentId, { $set: update });
  }

  const refreshedPayment = await Payment.findById(paymentId);

  if (paymentKind === 'membership') {
    if (!membershipId) {
      return { ok: true, payment: refreshedPayment, warning: 'missing_membership' };
    }

    const petIdsFromPayment = Array.isArray(refreshedPayment.petIds) ? refreshedPayment.petIds : [];
    const petIdsFromMetadata = Array.isArray(metadata?.pets) ? metadata.pets : [];

    let effectivePetIds = petIdsFromPayment.length ? petIdsFromPayment : petIdsFromMetadata;

    if ((!effectivePetIds || effectivePetIds.length === 0) && refreshedPayment.petDraft?.name) {
      const Membership = require('../models/Membership');
      const membershipDoc = membershipId ? await Membership.findById(membershipId) : null;
      if (!membershipDoc) return { ok: false, reason: 'missing_membership' };

      const draft = refreshedPayment.petDraft;
      const createdPet = await Pet.create({
        name: draft.name,
        species: draft.species,
        breed: draft.breed,
        age: draft.age,
        gender: draft.gender,
        color: draft.color || null,
        size: draft.size || null,
        dateOfBirth: draft.dateOfBirth || null,
        spayedNeutered: !!draft.spayedNeutered,
        trainingLevel: draft.trainingLevel || null,
        weight: draft.weight || null,
        microchipNumber: draft.microchipNumber || null,
        photoUrl: draft.photoUrl || null,
        userId: refreshedPayment.userId,
        hasMembership: true,
        membership: membershipDoc._id,
        membershipStartDate: now,
      });

      effectivePetIds = [createdPet._id];
      await Payment.findByIdAndUpdate(paymentId, { $set: { petIds: effectivePetIds, updatedAt: now } });
    }

    if (Array.isArray(effectivePetIds) && effectivePetIds.length) {
      await Pet.updateMany(
        { _id: { $in: effectivePetIds }, userId: refreshedPayment.userId },
        {
          $set: {
            hasMembership: true,
            membership: membershipId,
            membershipStartDate: now,
          },
        }
      );
    }

    const user = await User.findById(refreshedPayment.userId).select('membershipStartDate');
    const hasActivePet = await Pet.exists({ userId: refreshedPayment.userId, hasMembership: true });
    await User.findByIdAndUpdate(
      refreshedPayment.userId,
      {
        $set: {
          membershipActive: !!hasActivePet,
          membershipStartDate: hasActivePet ? (user?.membershipStartDate || now) : null,
        },
      }
    );
  } else if (paymentKind === 'tag') {
    const petIds = Array.isArray(refreshedPayment.petIds) ? refreshedPayment.petIds : [];
    if (petIds.length) {
      const update = {
        hasTag: true,
        tagPurchaseDate: now,
      };
      if (tagType) update.tagType = tagType;

      await Pet.updateMany(
        { _id: { $in: petIds }, userId: refreshedPayment.userId },
        { $set: update }
      );
    }

    const paymentUpdate = { updatedAt: now };
    if (tagType && !refreshedPayment.tagType) paymentUpdate.tagType = tagType;
    if (!refreshedPayment.fulfillment?.status) {
      paymentUpdate['fulfillment.provider'] = 'pudo';
      paymentUpdate['fulfillment.status'] = 'unfulfilled';
      paymentUpdate['fulfillment.createdAt'] = now;
      paymentUpdate['fulfillment.updatedAt'] = now;
    } else if (!refreshedPayment.fulfillment?.updatedAt) {
      paymentUpdate['fulfillment.updatedAt'] = now;
    }

    if (Object.keys(paymentUpdate).length > 1) {
      await Payment.findByIdAndUpdate(paymentId, { $set: paymentUpdate });
    }
  }

  return { ok: true, payment: await Payment.findById(paymentId) };
};

module.exports = { finalizeSuccessfulPayment };
