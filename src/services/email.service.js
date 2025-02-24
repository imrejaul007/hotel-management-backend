const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
    // For development, use Ethereal (fake SMTP service)
    if (process.env.NODE_ENV === 'development') {
        return nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    // For production, use real SMTP service
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
};

const sendEmail = async ({ to, subject, html }) => {
    try {
        const transporter = createTransporter();

        const mailOptions = {
            from: process.env.SMTP_FROM || '"Hotel Management" <noreply@hotelmanagement.com>',
            to,
            subject,
            html
        };

        const info = await transporter.sendMail(mailOptions);

        if (process.env.NODE_ENV === 'development') {
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }

        return info;
    } catch (error) {
        console.error('Email service error:', error);
        throw new Error('Failed to send email');
    }
};

// Email templates
const templates = {
    welcomeGuest: (name, email, password) => ({
        subject: 'Welcome to Hotel Management System',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Welcome to Hotel Management System</h1>
                </div>
                <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
                    <p style="font-size: 16px;">Dear ${name},</p>
                    <p>Your account has been created successfully. Here are your login credentials:</p>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                        <p style="margin: 5px 0;"><strong>Password:</strong> ${password}</p>
                    </div>
                    <p style="color: #dc3545;"><strong>Important:</strong> Please change your password after your first login.</p>
                    <div style="margin-top: 30px;">
                        <a href="${process.env.APP_URL}/auth/login" 
                           style="background: #764ba2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                            Login to Your Account
                        </a>
                    </div>
                    <p style="margin-top: 30px; font-size: 14px; color: #666;">
                        If you have any questions or need assistance, please don't hesitate to contact our support team.
                    </p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                    <p style="font-size: 12px; color: #666; text-align: center;">
                        This is an automated message, please do not reply to this email.
                    </p>
                </div>
            </div>
        `
    }),

    resetPassword: (name, resetUrl) => ({
        subject: 'Reset Your Password',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
                    <h1 style="color: white; margin: 0;">Reset Your Password</h1>
                </div>
                <div style="padding: 20px; border: 1px solid #ddd; border-top: none;">
                    <p style="font-size: 16px;">Dear ${name},</p>
                    <p>We received a request to reset your password. Click the button below to create a new password:</p>
                    <div style="margin: 30px 0; text-align: center;">
                        <a href="${resetUrl}" 
                           style="background: #764ba2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                            Reset Password
                        </a>
                    </div>
                    <p style="color: #dc3545;"><strong>Note:</strong> This link will expire in 10 minutes.</p>
                    <p>If you didn't request this, please ignore this email. Your password will stay safe and won't be changed.</p>
                    <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                    <p style="font-size: 12px; color: #666; text-align: center;">
                        This is an automated message, please do not reply to this email.
                    </p>
                </div>
            </div>
        `
    }),

    passwordReset: (email, resetToken) => {
        const resetUrl = `${process.env.APP_URL}/auth/reset-password/${resetToken}`;
        
        return {
            subject: 'Password Reset Request',
            html: `
                <h1>Password Reset Request</h1>
                <p>You are receiving this email because you (or someone else) has requested to reset your password.</p>
                <p>Please click on the following link to reset your password:</p>
                <a href="${resetUrl}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
                <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
                <p>This link will expire in 1 hour.</p>
            `
        }
    }
};

module.exports = {
    sendEmail,
    templates
};
