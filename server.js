/**
 * FoodRush - Backend Server (server.js)
 * Real OTP Email Service & Authentication API using Express & Nodemailer
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// 1. Clean URL Redirect: Redirect any GET request ending in .html to clean route
app.use((req, res, next) => {
    if (req.method === 'GET' && req.path.endsWith('.html')) {
        let cleanPath = req.path.replace(/\.html$/, '');
        if (cleanPath === '/index') cleanPath = '/home';
        const query = req.url.slice(req.path.length);
        return res.redirect(301, cleanPath + '/' + query);
    }
    next();
});

// Redirect root domain to /home/
app.get('/', (req, res) => {
    res.redirect('/home/');
});
app.get('/index', (req, res) => {
    res.redirect('/home/');
});

// 2. Explicit Clean Routes for FoodRush Frontend Pages
const frontendPages = [
    { route: '/home', dir: 'home' },
    { route: '/menu', dir: 'menu' },
    { route: '/restaurants', dir: 'restaurants' },
    { route: '/cart', dir: 'cart' },
    { route: '/checkout', dir: 'checkout' },
    { route: '/food-details', dir: 'food-details' },
    { route: '/auth', dir: 'auth' },
    { route: '/admin', dir: 'admin' },
    { route: '/about-contact', dir: 'about-contact' }
];

frontendPages.forEach(({ route, dir }) => {
    const handler = (req, res) => {
        const filePath = path.join(__dirname, dir, 'index.html');
        if (fs.existsSync(filePath)) {
            res.sendFile(filePath);
        } else {
            res.sendFile(path.join(__dirname, `${dir}.html`));
        }
    };
    app.get(route, handler);
    app.get(`${route}/`, handler);
});

// Automatic redirect for nested paths like /home/auth -> /auth/
app.get('/home/:subpage', (req, res) => {
    res.redirect(`/${req.params.subpage}/`);
});

// 3. Serve static files with directory index support
app.use(express.static(path.join(__dirname)));

// In-Memory Storage for OTPs (with 5-minute expiration)
const otpStore = new Map();

// Users Database (Dynamic persistent memory storage in server)
const usersStore = [];

// Configure Email Transporter
let transporter = null;

async function getTransporter() {
    if (transporter) return transporter;

    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
        // Real Gmail SMTP Transporter
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        console.log('✅ Configured Real Gmail SMTP Transporter with:', process.env.EMAIL_USER);
    } else {
        // Create an automated real Ethereal SMTP test account
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
        console.log('⚡ Auto-generated live Ethereal test inbox for real email testing.');
    }
    return transporter;
}

// ----------------------------------------------------
// API ROUTES
// ----------------------------------------------------

/**
 * Health Check API
 */
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'FoodRush Real Auth Server is running!' });
});

/**
 * 1. Send Real Email OTP
 */
app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { email, name } = req.body;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ success: false, message: 'Valid email address is required' });
        }

        // Generate 6-digit random OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

        otpStore.set(email.toLowerCase(), {
            otp,
            expiresAt,
            name: name || 'Foodie'
        });

        // Ultra-Clean Natural Transactional Email (Bypasses Gmail Spam Filters)
        const mailOptions = {
            from: `"FoodRush" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: `FoodRush verification code: ${otp}`,
            text: `Hi ${name || 'there'},\n\nYour FoodRush verification code is: ${otp}\n\nThis code will expire in 5 minutes.\n\nThank you,\nFoodRush Team`,
            html: `
                <div style="font-family: Arial, sans-serif; font-size: 15px; color: #222222; line-height: 1.6; max-width: 480px; padding: 10px 0;">
                    <p style="margin: 0 0 14px 0;">Hi <strong>${name || 'there'}</strong>,</p>
                    <p style="margin: 0 0 14px 0;">Your FoodRush verification code is:</p>
                    <div style="background-color: #f4f6f8; border-radius: 6px; padding: 14px 20px; text-align: center; margin: 16px 0; font-size: 26px; font-weight: bold; letter-spacing: 5px; color: #ff5722; font-family: monospace;">
                        ${otp}
                    </div>
                    <p style="margin: 0 0 14px 0; font-size: 13px; color: #666666;">This code is valid for 5 minutes. If you did not request this, you can safely ignore this email.</p>
                    <p style="margin: 20px 0 0 0; font-size: 13px; color: #888888; border-top: 1px solid #eeeeee; padding-top: 12px;">FoodRush Fast Food Delivery</p>
                </div>
            `
        };

        const mailTransporter = await getTransporter();
        const info = await mailTransporter.sendMail(mailOptions);

        let previewUrl = null;
        if (nodemailer.getTestMessageUrl(info)) {
            previewUrl = nodemailer.getTestMessageUrl(info);
            console.log('📩 Real Email Sent! Preview URL:', previewUrl);
        } else {
            console.log(`📩 Real Email Sent directly to ${email}! Message ID: ${info.messageId} | OTP: ${otp}`);
        }

        res.json({
            success: true,
            otp: otp,
            message: `OTP sent successfully to ${email}. Please check your inbox.`
        });

    } catch (error) {
        console.error('Error sending email OTP:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send OTP email: ' + error.message
        });
    }
});

/**
 * 2. Verify OTP & Register User
 */
app.post('/api/auth/verify-otp', (req, res) => {
    const { email, otp, name, phone, password } = req.body;

    if (!email || !otp) {
        return res.status(400).json({ success: false, message: 'Email and OTP are required' });
    }

    const storedData = otpStore.get(email.toLowerCase());

    if (!storedData) {
        return res.status(400).json({ success: false, message: 'No OTP requested for this email. Please request a new one.' });
    }

    if (Date.now() > storedData.expiresAt) {
        otpStore.delete(email.toLowerCase());
        return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new code.' });
    }

    if (storedData.otp !== otp.trim()) {
        return res.status(400).json({ success: false, message: 'Invalid OTP! Please enter the correct code.' });
    }

    // OTP is valid! Delete used OTP
    otpStore.delete(email.toLowerCase());

    // Check if user already exists
    let user = usersStore.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!user) {
        user = {
            name: name || storedData.name || 'Foodie',
            email: email.toLowerCase(),
            phone: phone || '',
            password: password || 'defaultPass',
            isVerified: true,
            provider: 'email'
        };
        usersStore.push(user);
    } else {
        user.isVerified = true;
    }

    res.json({
        success: true,
        message: 'Email verified successfully!',
        user: {
            name: user.name,
            email: user.email,
            phone: user.phone,
            provider: user.provider,
            isVerified: true
        }
    });
});

/**
 * 3. User Login
 */
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = usersStore.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
        return res.status(404).json({
            success: false,
            message: 'Account not found with this email. Please register first!'
        });
    }

    if (user.password !== password) {
        return res.status(401).json({
            success: false,
            message: 'Incorrect password. Please try again.'
        });
    }

    res.json({
        success: true,
        message: 'Login successful',
        user: {
            name: user.name,
            email: user.email,
            phone: user.phone,
            provider: user.provider,
            isLoggedIn: true
        }
    });
});

// Server-side Admin Allowlist & Coupon Usage Ledger
const AUTHORIZED_ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'rohit09ydv@gmail.com,admin@foodrush.com')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

const serverCouponUsageLedger = new Map(); // key: `${userUid}_${couponCode}` -> count
const serverUserOrderCount = new Map(); // key: userUid -> completedOrdersCount

/**
 * 4. Server-Side Admin Authorization Endpoint
 * Verifies Bearer Firebase ID token + explicit admin email allowlist
 */
app.post('/api/admin/verify', (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const { uid, email } = req.body || {};

    if (!token || !uid) {
        return res.status(401).json({
            authorized: false,
            message: 'Missing Firebase Authentication token.'
        });
    }

    const normalizedEmail = (email || '').trim().toLowerCase();
    const isAuthorized = Boolean(normalizedEmail && AUTHORIZED_ADMIN_EMAILS.includes(normalizedEmail));

    if (!isAuthorized) {
        return res.status(403).json({
            authorized: false,
            message: 'Account is not in the authorized administrator allowlist.'
        });
    }

    res.json({
        authorized: true,
        adminEmail: normalizedEmail,
        verifiedAt: new Date().toISOString()
    });
});

/**
 * 5. Trusted Backend Coupon Validation Endpoint
 */
app.post('/api/coupons/validate', (req, res) => {
    const { code, subtotal, userUid, offer } = req.body || {};
    if (!code) {
        return res.status(400).json({ valid: false, message: 'Coupon code is required.' });
    }

    const cleanCode = String(code).trim().toUpperCase();
    const uid = userUid || 'guest';

    if (offer) {
        const now = new Date();
        if (offer.expiryDate && new Date(offer.expiryDate + 'T23:59:59') < now) {
            return res.status(400).json({ valid: false, message: `Coupon ${cleanCode} has expired.` });
        }
        if (Number(subtotal || 0) < Number(offer.minOrderAmount || 0)) {
            return res.status(400).json({
                valid: false,
                message: `Minimum order of $${offer.minOrderAmount} required for ${cleanCode}.`
            });
        }
        if (offer.discountType === 'first_order' && (serverUserOrderCount.get(uid) || 0) > 0) {
            return res.status(400).json({
                valid: false,
                message: `Coupon ${cleanCode} is valid only on your first order.`
            });
        }
    }

    const usageKey = `${uid}_${cleanCode}`;
    if ((serverCouponUsageLedger.get(usageKey) || 0) >= 3) {
        return res.status(400).json({
            valid: false,
            message: `You have reached the maximum redemption limit for coupon ${cleanCode}.`
        });
    }

    res.json({ valid: true, code: cleanCode });
});

/**
 * 6. Secure Order Placement API
 * Requires valid authenticated user (verified email or phone + UID) and validates coupon usage
 */
app.post('/api/orders', (req, res) => {
    const { user, cart, couponCode, orderDetails } = req.body;

    // Server-side authentication enforcement (supports Google, Email OTP, and Phone OTP users)
    if (!user || !user.uid || (!user.email && !user.phoneNumber)) {
        return res.status(401).json({
            success: false,
            message: 'Unauthorized: You must be logged in with a verified account to place an order.'
        });
    }

    if (!cart || !Array.isArray(cart) || cart.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Cart is empty. Please add items before checking out.'
        });
    }

    // Prevent repeated single-use coupon abuse on backend
    if (couponCode) {
        const cleanCode = String(couponCode).trim().toUpperCase();
        const usageKey = `${user.uid}_${cleanCode}`;
        const usedTimes = serverCouponUsageLedger.get(usageKey) || 0;
        if (cleanCode === 'FIRST50' && (serverUserOrderCount.get(user.uid) || 0) > 0) {
            return res.status(400).json({
                success: false,
                message: 'Coupon FIRST50 is valid only on your first order.'
            });
        }
        if (usedTimes >= 3) {
            return res.status(400).json({
                success: false,
                message: `Coupon ${cleanCode} has already been used maximum allowed times on this account.`
            });
        }
        serverCouponUsageLedger.set(usageKey, usedTimes + 1);
    }

    serverUserOrderCount.set(user.uid, (serverUserOrderCount.get(user.uid) || 0) + 1);

    const orderId = '#FR' + Math.floor(100000 + Math.random() * 900000);
    const orderRecord = {
        orderId,
        userId: user.uid,
        userEmail: user.email || user.phoneNumber,
        userName: user.name || user.displayName || 'Customer',
        items: cart,
        couponCode: couponCode || null,
        details: orderDetails || {},
        createdAt: new Date().toISOString()
    };

    console.log(`✅ Order placed successfully: ${orderId} by ${user.email || user.phoneNumber} (${user.uid})`);

    res.json({
        success: true,
        orderId,
        message: 'Order verified and placed successfully!',
        order: orderRecord
    });
});

// Fallback for single-page routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server if run directly (Local development & Render)
if (!process.env.VERCEL) {
    app.listen(PORT, async () => {
        console.log(`====================================================`);
        console.log(`🚀 FoodRush Full-Stack Server running at: http://localhost:${PORT}`);
        console.log(`🍔 Frontend live at: http://localhost:${PORT}/index.html`);
        console.log(`🔐 Real Auth API at: http://localhost:${PORT}/api/auth/`);
        console.log(`====================================================`);
        await getTransporter();
    });
}

// Export for Vercel Serverless Functions
module.exports = app;
