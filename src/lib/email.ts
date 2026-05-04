import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
) {
  await transporter.sendMail({
    from: `"Study Partner" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Reset your password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #333;">Reset your password</h2>
        <p style="color: #555; line-height: 1.6;">
          Click the button below to reset your password. This link expires in 1 hour.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background: #3b82f6; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #999; font-size: 13px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
