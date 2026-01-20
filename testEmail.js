// testEmail.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') }); // load regardless of CWD
const { sendSignupSuccessEmail, sendMembershipPurchaseEmail, sendTagPurchaseEmail } = require('./services/mailService'); // adjust this path

const runTest = async () => {
  try {
    const to = 'danielmommsen2@gmail.com';
    await sendSignupSuccessEmail({ to, name: 'Daniel' });
    await sendMembershipPurchaseEmail({
      to,
      userName: 'Daniel',
      membershipName: 'Small Pet Subscription',
      pets: [{ name: 'Snowy' }],
      amountInCents: 5000,
      currency: 'ZAR',
      paymentId: 'example-membership-payment-id',
    });
    await sendTagPurchaseEmail({
      to,
      userName: 'Daniel',
      pets: [{ name: 'Snowy' }],
      tagType: 'Standard',
      amountInCents: 25000,
      currency: 'ZAR',
      paymentId: 'example-tag-payment-id',
      shippingAddress: {
        street: 'N/A',
        city: 'N/A',
        province: 'N/A',
        postalCode: '0000',
        country: 'N/A',
      },
    });
    console.log('✅ Test emails sent successfully!');
  } catch (error) {
    console.error('❌ Failed to send test email:', error);
  }
};

runTest();
