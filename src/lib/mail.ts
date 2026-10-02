import nodemailer from 'nodemailer';

const senderEmail = process.env.SENDER_EMAIL || process.env.EMAIL_USER;

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS ? process.env.EMAIL_PASS.replace(/\s+/g, "") : "",
  },
});

export async function sendOtpEmail(to: string, otp: string, name: string) {
  const mailOptions = {
    from: `"E-LGU Kiosk" <${senderEmail}>`,
    to,
    subject: 'Your Authentication Code',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #4caf7d;">Verification Code</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your authentication code for the E-LGU Kiosk is:</p>
        <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #333; border-radius: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <hr style="border: 0; border-top: 1px solid #eee;" />
        <p style="font-size: 12px; color: #999;">If you did not request this code, please ignore this email.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
}
