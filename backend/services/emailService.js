const nodemailer = require('nodemailer');
const { getSystemConfig } = require('./firebaseService');

let transporter = null;

async function getTransporter() {
  const config = await getSystemConfig();
  if (!config?.smtp?.host) return null;

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port || 587,
    secure: config.smtp.secure || false,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass
    }
  });

  return transporter;
}

async function isSmtpEnabled() {
  const config = await getSystemConfig();
  return !!(config?.smtp?.host && config?.smtp?.user);
}

async function sendVerificationEmail(to, token, appUrl) {
  const t = await getTransporter();
  if (!t) throw new Error('SMTP not configured');

  const link = `${appUrl}/verify-email?token=${token}`;
  await t.sendMail({
    from: (await getSystemConfig()).smtp.from || 'noreply@support.com',
    to,
    subject: '✅ Verify your Support Dashboard account',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;">
        <h2 style="color:#0f172a">Verify your email</h2>
        <p style="color:#475569">Click the button below to verify your account and gain access to the support dashboard.</p>
        <a href="${link}" style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0">
          Verify Email
        </a>
        <p style="color:#94a3b8;font-size:13px">Link expires in 24 hours. If you didn't create this account, ignore this email.</p>
      </div>
    `
  });
}

async function sendPasswordResetEmail(to, otp) {
  const t = await getTransporter();
  if (!t) throw new Error('SMTP not configured');

  await t.sendMail({
    from: (await getSystemConfig()).smtp.from || 'noreply@support.com',
    to,
    subject: '🔑 Password Reset OTP',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;">
        <h2 style="color:#0f172a">Password Reset</h2>
        <p style="color:#475569">Your OTP to reset your password:</p>
        <div style="background:#f1f5f9;padding:20px;border-radius:8px;text-align:center;margin:16px 0;">
          <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#0f172a">${otp}</span>
        </div>
        <p style="color:#94a3b8;font-size:13px">This OTP expires in 10 minutes. If you didn't request this, ignore this email.</p>
      </div>
    `
  });
}

module.exports = { isSmtpEnabled, sendVerificationEmail, sendPasswordResetEmail };
