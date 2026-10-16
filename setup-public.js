const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');

function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(childItemName => {
            copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else if (exists) {
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(src, dest);
    }
}

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

// Folders and files to mirror into public for Vercel CDN
const itemsToCopy = [
    'css',
    'js',
    'assets',
    'home',
    'restaurants',
    'menu',
    'cart',
    'checkout',
    'auth',
    'admin',
    'about-contact',
    'index.html',
    'restaurants.html',
    'menu.html',
    'cart.html',
    'checkout.html',
    'auth.html',
    'admin.html',
    'about-contact.html',
    'food-details.html'
];

itemsToCopy.forEach(item => {
    const srcPath = path.join(__dirname, item);
    const destPath = path.join(publicDir, item);
    if (fs.existsSync(srcPath)) {
        copyRecursiveSync(srcPath, destPath);
        console.log(`Synced -> public/${item}`);
    }
});

console.log('✅ Public directory successfully generated for Vercel CDN deployment.');
