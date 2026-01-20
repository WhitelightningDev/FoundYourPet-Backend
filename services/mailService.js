const nodemailer = require("nodemailer");

const getFrontendUrl = () => {
  const raw = (process.env.FRONTEND_URL || "http://localhost:3000").toString().trim();
  return raw.replace(/\/+$/, "");
};

const canSend = () => Boolean(process.env.GMAIL_USER && process.env.GMAIL_PASS);

let transporter = null;
const getTransporter = () => {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });
  return transporter;
};

/**
 * Low-level send function used by higher-level templates.
 */
const sendEmail = async (to, subject, text, html) => {
  if (!canSend()) {
    console.warn("[mailService] Skipping email (missing GMAIL_USER/GMAIL_PASS)", { to, subject });
    return { skipped: true };
  }
  const mailOptions = {
    from: `"Found Your Pet" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text,
    html,
  };

  return getTransporter().sendMail(mailOptions);
};

const sendSignupSuccessEmail = async ({ to, name = "there" }) => {
  const frontendUrl = getFrontendUrl();
  const subject = "Welcome to Found Your Pet!";

  const text = `Hi ${name},

Your Found Your Pet account is ready.

Login here: ${frontendUrl}/login

Thanks,
Found Your Pet`;

  const html = `
  <div style="background-color:#f5f5f5;padding:40px 0;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:auto;background-color:#ffffff;border:1px solid #ddd;border-radius:10px;overflow:hidden;">
      <div style="padding:28px 28px 12px;">
        <h2 style="margin:0;color:#111;">Signup successful</h2>
        <p style="margin:14px 0 0;color:#333;">Hi ${name},</p>
        <p style="margin:10px 0 0;color:#333;">Welcome to <strong>Found Your Pet</strong>.</p>
        <p style="margin:18px 0;">
          <a href="${frontendUrl}/login" style="display:inline-block;color:#fff;background:#0ea5a4;padding:10px 14px;border-radius:8px;text-decoration:none;">Login</a>
        </p>
        <p style="margin:18px 0 0;color:#666;font-size:13px;">If you didn’t sign up, you can ignore this email.</p>
      </div>
      <div style="background-color:#f0f0f0;padding:16px 28px;color:#888;font-size:12px;">
        © ${new Date().getFullYear()} Found Your Pet
      </div>
    </div>
  </div>`;

  return sendEmail(to, subject, text, html);
};

const sendMembershipPurchaseEmail = async ({
  to,
  userName = "there",
  membershipName = "Membership",
  pets = [],
  amountInCents,
  currency = "ZAR",
  paymentId,
}) => {
  const frontendUrl = getFrontendUrl();
  const petNames = pets.map((p) => p?.name).filter(Boolean);
  const subject = "Membership activated";
  const amount = Number.isFinite(amountInCents) ? (amountInCents / 100).toFixed(2) : null;

  const text = `Hi ${userName},

Your membership purchase was successful.

Plan: ${membershipName}
Pets: ${petNames.length ? petNames.join(", ") : "—"}
Amount: ${amount ? `${currency} ${amount}` : "—"}

Dashboard: ${frontendUrl}/dashboard
`;

  const html = `
  <div style="background-color:#f5f5f5;padding:40px 0;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:auto;background-color:#ffffff;border:1px solid #ddd;border-radius:10px;overflow:hidden;">
      <div style="padding:28px;">
        <h2 style="margin:0;color:#111;">Membership activated</h2>
        <p style="margin:14px 0 0;color:#333;">Hi ${userName},</p>
        <p style="margin:10px 0 0;color:#333;">Your membership purchase was successful.</p>

        <div style="margin:16px 0;padding:14px;border:1px solid #eee;border-radius:10px;background:#fafafa;">
          <div style="color:#111;font-weight:600;">${membershipName}</div>
          <div style="margin-top:6px;color:#444;font-size:14px;">Pets: ${petNames.length ? petNames.join(", ") : "—"}</div>
          <div style="margin-top:6px;color:#444;font-size:14px;">Amount: ${amount ? `${currency} ${amount}` : "—"}</div>
          ${paymentId ? `<div style="margin-top:6px;color:#888;font-size:12px;">Payment ID: ${paymentId}</div>` : ""}
        </div>

        <p style="margin:18px 0;">
          <a href="${frontendUrl}/dashboard" style="display:inline-block;color:#fff;background:#0ea5a4;padding:10px 14px;border-radius:8px;text-decoration:none;">Open dashboard</a>
        </p>
      </div>
      <div style="background-color:#f0f0f0;padding:16px 28px;color:#888;font-size:12px;">
        © ${new Date().getFullYear()} Found Your Pet
      </div>
    </div>
  </div>`;

  return sendEmail(to, subject, text, html);
};

const sendTagPurchaseEmail = async ({
  to,
  userName = "there",
  pets = [],
  tagType = "Tag",
  amountInCents,
  currency = "ZAR",
  paymentId,
  shippingAddress = null,
}) => {
  const frontendUrl = getFrontendUrl();
  const petNames = pets.map((p) => p?.name).filter(Boolean);
  const subject = "Tag order confirmed";
  const amount = Number.isFinite(amountInCents) ? (amountInCents / 100).toFixed(2) : null;

  const addressLine = shippingAddress
    ? [shippingAddress.street, shippingAddress.city, shippingAddress.province, shippingAddress.postalCode, shippingAddress.country]
        .filter(Boolean)
        .join(", ")
    : null;

  const trackingUrl = paymentId ? `${frontendUrl}/tag-orders/${paymentId}` : `${frontendUrl}/dashboard`;

  const text = `Hi ${userName},

Your tag order was successful.

Tag type: ${tagType}
Pets: ${petNames.length ? petNames.join(", ") : "—"}
Amount: ${amount ? `${currency} ${amount}` : "—"}
Delivery address: ${addressLine || "—"}

Track delivery: ${trackingUrl}
`;

  const html = `
  <div style="background-color:#f5f5f5;padding:40px 0;font-family:Arial,sans-serif;">
    <div style="max-width:600px;margin:auto;background-color:#ffffff;border:1px solid #ddd;border-radius:10px;overflow:hidden;">
      <div style="padding:28px;">
        <h2 style="margin:0;color:#111;">Tag order confirmed</h2>
        <p style="margin:14px 0 0;color:#333;">Hi ${userName},</p>
        <p style="margin:10px 0 0;color:#333;">Your tag order was successful.</p>

        <div style="margin:16px 0;padding:14px;border:1px solid #eee;border-radius:10px;background:#fafafa;">
          <div style="color:#111;font-weight:600;">${tagType}</div>
          <div style="margin-top:6px;color:#444;font-size:14px;">Pets: ${petNames.length ? petNames.join(", ") : "—"}</div>
          <div style="margin-top:6px;color:#444;font-size:14px;">Amount: ${amount ? `${currency} ${amount}` : "—"}</div>
          ${addressLine ? `<div style="margin-top:6px;color:#444;font-size:14px;">Delivery: ${addressLine}</div>` : ""}
          ${paymentId ? `<div style="margin-top:6px;color:#888;font-size:12px;">Order ID: ${paymentId}</div>` : ""}
        </div>

        <p style="margin:18px 0;">
          <a href="${trackingUrl}" style="display:inline-block;color:#fff;background:#0ea5a4;padding:10px 14px;border-radius:8px;text-decoration:none;">Track delivery</a>
        </p>
      </div>
      <div style="background-color:#f0f0f0;padding:16px 28px;color:#888;font-size:12px;">
        © ${new Date().getFullYear()} Found Your Pet
      </div>
    </div>
  </div>`;

  return sendEmail(to, subject, text, html);
};

module.exports = {
  sendEmail,
  sendSignupSuccessEmail,
  sendMembershipPurchaseEmail,
  sendTagPurchaseEmail,
};
