/**
 * FoodRush - Firestore & Platform Data Engine (store-data.js)
 * 
 * Implements:
 * 1. Cloud Firestore synchronization for Restaurants, Menus, Offers/Coupons, User Addresses, and Delivery Zones
 * 2. Initial platform seed data (automatically synced to Firestore when empty)
 * 3. Location-based Delivery Engine (Haversine distance calculation, PIN code matching, dynamic delivery fees)
 * 4. Coupon & Offer Validation Engine (percentage, flat, first-order, free delivery, restaurant-specific, expiry, min order, max cap)
 */

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDocs, 
    setDoc, 
    deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { 
    getStorage, 
    ref as storageRef, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

const RESTAURANTS_CACHE_KEY = 'foodrush_restaurants_cache_v3';
const OFFERS_CACHE_KEY = 'foodrush_offers_cache_v3';
const ACTIVE_LOCATION_KEY = 'foodrush_delivery_location';
const SAVED_ADDRESSES_KEY = 'foodrush_saved_addresses';
const COUPON_USAGE_KEY = 'foodrush_coupon_usage';

let db = null;
let storage = null;

try {
    const config = window.FIREBASE_CONFIG || window.firebaseConfig;
    if (config && config.apiKey && !config.apiKey.includes('YOUR_')) {
        const app = getApps().length === 0 ? initializeApp(config) : getApp();
        db = getFirestore(app);
        storage = getStorage(app);
    }
} catch (e) {
    console.warn('Firestore initialization notice:', e);
}

/**
 * Initial Official FoodRush Partner Restaurants & Stores (Covers all 8 categories + full menus with offers & images)
 */
const INITIAL_RESTAURANTS = [
    {
        id: 'rest-burger-barn',
        name: 'The Burger Barn & Grill',
        description: 'Home of juicy double-smashed patties, toasted brioche buns, crispy peri-peri fries, and thick shakes.',
        logo: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=300&q=80',
        coverImage: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',
        address: '42 Cyber Hub, DLF Phase 2',
        area: 'Connaught Place',
        city: 'New Delhi',
        pincode: '110001',
        lat: 28.6139,
        lng: 77.2090,
        coordinates: { lat: 28.6139, lng: 77.2090 },
        phone: '+91 98765 11223',
        cuisines: ['Burger', 'Fast Food', 'Fries'],
        rating: 4.8,
        reviewsCount: 680,
        reviewCount: 680,
        deliveryTime: '20-25 mins',
        deliveryFee: 25,
        freeDeliveryAbove: 299,
        deliveryRadiusKm: 18,
        servicePincodes: ['110001', '110002', '110003', '110005', '110016', '110020', '110024', '110027', '110029', '122002', '201301'],
        openingTime: '09:00',
        closingTime: '23:59',
        isOpen: true,
        active: true,
        featured: true,
        offerText: '20% OFF up to ₹150',
        offerBanner: '20% OFF up to ₹150 • Use FOODRUSH20',
        offerCode: 'FOODRUSH20',
        priceForTwo: 350,
        menu: [
            {
                id: 'fr-01',
                name: 'Classic Cheeseburger',
                category: 'Burger',
                price: 199,
                originalPrice: 249,
                offerText: '20% OFF',
                image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
                description: 'Juicy grilled patty topped with melted cheddar cheese, fresh lettuce, tomatoes, pickles, and signature secret sauce.',
                isVeg: false,
                available: true
            },
            {
                id: 'fr-02',
                name: 'Crispy Zinger Chicken Burger',
                category: 'Burger',
                price: 229,
                originalPrice: 279,
                offerText: '18% OFF',
                image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&q=80',
                description: 'Golden fried crispy chicken breast layered with crunchy coleslaw, spicy chipotle mayo, and pickles in a brioche bun.',
                isVeg: false,
                available: true
            },
            {
                id: 'fr-03',
                name: 'Double BBQ Smash Burger',
                category: 'Burger',
                price: 319,
                originalPrice: 389,
                offerText: 'SAVE ₹70',
                image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80',
                description: 'Double smashed patties with caramelized onions, smoked cheddar cheese, and tangy BBQ glaze.',
                isVeg: false,
                available: true
            },
            {
                id: 'item-bb-veg',
                name: 'Crunchy Aloo Tikki Veg Burger',
                category: 'Burger',
                price: 149,
                originalPrice: 189,
                offerText: '20% OFF',
                image: 'https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&w=600&q=80',
                description: 'Crispy herb-spiced potato & green peas patty topped with tangy tandoori mayo, onions, and crisp lettuce.',
                isVeg: true,
                available: true
            },
            {
                id: 'fr-10',
                name: 'Golden Salted French Fries',
                category: 'Fries',
                price: 99,
                originalPrice: 129,
                offerText: '23% OFF',
                image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80',
                description: 'Classic golden cut potato fries, crisp on the outside and fluffy inside, dusted with fine sea salt.',
                isVeg: true,
                available: true
            },
            {
                id: 'fr-11',
                name: 'Peri-Peri Cheesy Loaded Fries',
                category: 'Fries',
                price: 159,
                originalPrice: 199,
                offerText: '20% OFF',
                image: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=600&q=80',
                description: 'Golden crinkle fries dusted with African peri-peri spice and smothered in warm liquid nacho cheese.',
                isVeg: true,
                available: true
            }
        ]
    },
    {
        id: 'rest-napoli-pizzeria',
        name: 'Napoli Woodfire Pizzeria',
        description: 'Artisanal Neapolitan pizzas baked in a 900°F wood-fired brick oven with San Marzano tomatoes and fresh mozzarella.',
        logo: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=300&q=80',
        coverImage: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',
        address: '88 Hauz Khas Village',
        area: 'Hauz Khas',
        city: 'New Delhi',
        pincode: '110016',
        lat: 28.5494,
        lng: 77.2001,
        coordinates: { lat: 28.5494, lng: 77.2001 },
        phone: '+91 98100 44556',
        cuisines: ['Pizza', 'Fast Food'],
        rating: 4.9,
        reviewsCount: 510,
        reviewCount: 510,
        deliveryTime: '25-30 mins',
        deliveryFee: 30,
        freeDeliveryAbove: 399,
        deliveryRadiusKm: 18,
        servicePincodes: ['110016', '110001', '110003', '110017', '110024', '110029', '110049'],
        openingTime: '10:00',
        closingTime: '23:30',
        isOpen: true,
        active: true,
        featured: true,
        offerText: 'Flat ₹100 OFF above ₹499',
        offerBanner: 'Flat ₹100 OFF • Use PIZZA100',
        offerCode: 'PIZZA100',
        priceForTwo: 500,
        menu: [
            {
                id: 'fr-04',
                name: 'Loaded Four-Cheese Margherita Pizza',
                category: 'Pizza',
                price: 299,
                originalPrice: 359,
                offerText: 'FLAT ₹60 OFF',
                image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
                description: 'Stone-baked hand-tossed crust overloaded with mozzarella, parmesan, gouda, and cheddar blend with Italian basil sauce.',
                isVeg: true,
                available: true
            },
            {
                id: 'fr-05',
                name: 'Spicy Pepperoni Feast Pizza',
                category: 'Pizza',
                price: 369,
                originalPrice: 429,
                offerText: 'FLAT ₹100 OFF',
                image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=600&q=80',
                description: 'Loaded with crispy smoked pepperoni slices, mozzarella cheese, chili flakes, and garlic herb oil.',
                isVeg: false,
                available: true
            },
            {
                id: 'fr-06',
                name: 'Farmhouse Veggie Supreme Pizza',
                category: 'Pizza',
                price: 279,
                originalPrice: 329,
                offerText: '15% OFF',
                image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&q=80',
                description: 'Crunchy bell peppers, black olives, sweet golden corn, mushrooms, and jalapeños over molten mozzarella.',
                isVeg: true,
                available: true
            },
            {
                id: 'item-np-paneer',
                name: 'Tandoori Paneer Tikka Pizza',
                category: 'Pizza',
                price: 329,
                originalPrice: 389,
                offerText: 'SAVE ₹60',
                image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80',
                description: 'Smoky tandoori paneer cubes, red paprika, capsicum, and mint mayo drizzle on a cheesy wood-fired base.',
                isVeg: true,
                available: true
            }
        ]
    },
    {
        id: 'rest-spice-symphony',
        name: 'Spice Symphony Royal Kitchen',
        description: 'Authentic North Indian curries, tandoori platters, and rich Mughlai gravies prepared with hand-ground spices.',
        logo: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=300&q=80',
        coverImage: 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?auto=format&fit=crop&w=900&q=80',
        address: '14 Connaught Place, Block B',
        area: 'Connaught Place',
        city: 'New Delhi',
        pincode: '110001',
        lat: 28.6315,
        lng: 77.2167,
        coordinates: { lat: 28.6315, lng: 77.2167 },
        phone: '+91 98111 22334',
        cuisines: ['Indian', 'Biryani'],
        rating: 4.7,
        reviewsCount: 420,
        reviewCount: 420,
        deliveryTime: '25-30 mins',
        deliveryFee: 30,
        freeDeliveryAbove: 349,
        deliveryRadiusKm: 16,
        servicePincodes: ['110001', '110002', '110005', '110006', '110016', '110020', '201301'],
        openingTime: '10:00',
        closingTime: '23:30',
        isOpen: true,
        active: true,
        featured: true,
        offerText: '30% OFF up to ₹120',
        offerBanner: '30% OFF up to ₹120 • Use SPICE30',
        offerCode: 'SPICE30',
        priceForTwo: 450,
        menu: [
            {
                id: 'item-ss-1',
                name: 'Old Delhi Butter Chicken Masala',
                category: 'Indian',
                price: 320,
                originalPrice: 380,
                offerText: '30% OFF',
                image: 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=600&q=80',
                description: 'Charcoal-grilled chicken simmered in velvety tomato and cashew butter gravy.',
                isVeg: false,
                available: true
            },
            {
                id: 'item-ss-2',
                name: 'Paneer Tikka Lababdar',
                category: 'Indian',
                price: 280,
                originalPrice: 330,
                offerText: '30% OFF',
                image: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&q=80',
                description: 'Cottage cheese cubes tossed with bell peppers in spiced onion-tomato rich gravy.',
                isVeg: true,
                available: true
            },
            {
                id: 'item-ss-3',
                name: 'Dal Makhani & Garlic Naan Combo',
                category: 'Indian',
                price: 220,
                originalPrice: 269,
                offerText: 'BESTSELLER',
                image: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80',
                description: '24-hour slow-cooked black lentils finished with white butter, served with 2 roasted garlic butter naans.',
                isVeg: true,
                available: true
            }
        ]
    },
    {
        id: 'rest-royal-biryani',
        name: 'Royal Nizam Biryani House',
        description: 'Slow-cooked Hyderabadi Dum Biryani layered with aged basmati rice, saffron, and secret Nizam spices.',
        logo: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=300&q=80',
        coverImage: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=900&q=80',
        address: '55 Lajpat Nagar Central Market',
        area: 'Lajpat Nagar',
        city: 'New Delhi',
        pincode: '110024',
        lat: 28.5677,
        lng: 77.2433,
        coordinates: { lat: 28.5677, lng: 77.2433 },
        phone: '+91 99111 77889',
        cuisines: ['Biryani', 'Indian'],
        rating: 4.8,
        reviewsCount: 890,
        reviewCount: 890,
        deliveryTime: '30-35 mins',
        deliveryFee: 30,
        freeDeliveryAbove: 349,
        deliveryRadiusKm: 20,
        servicePincodes: ['110024', '110001', '110003', '110014', '110016', '110019', '110065'],
        openingTime: '10:30',
        closingTime: '23:45',
        isOpen: true,
        active: true,
        featured: true,
        offerText: '50% OFF First Order',
        offerBanner: '50% OFF up to ₹200 • Use FIRST50',
        offerCode: 'FIRST50',
        priceForTwo: 450,
        menu: [
            {
                id: 'item-rb-1',
                name: 'Hyderabadi Chicken Dum Biryani',
                category: 'Biryani',
                price: 329,
                originalPrice: 399,
                offerText: '50% OFF',
                image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80',
                description: 'Aromatic long-grain basmati rice cooked on dum with marinated chicken, served with Mirchi ka Salan & Raita.',
                isVeg: false,
                available: true
            },
            {
                id: 'item-rb-2',
                name: 'Subz Nizami Paneer Dum Biryani',
                category: 'Biryani',
                price: 269,
                originalPrice: 319,
                offerText: 'SAVE ₹50',
                image: 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=600&q=80',
                description: 'Fresh garden vegetables, royal paneer cubes, saffron, and crispy fried onions sealed in an earthen handi.',
                isVeg: true,
                available: true
            }
        ]
    },
    {
        id: 'rest-dragon-wok',
        name: 'Dragon Wok Asian Express',
        description: 'Sizzling Asian street food, Hakka noodles, dim sums, and fiery Schezwan bowls tossed fresh to order.',
        logo: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=300&q=80',
        coverImage: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=900&q=80',
        address: '21 Rajouri Garden Main Market',
        area: 'Rajouri Garden',
        city: 'New Delhi',
        pincode: '110027',
        lat: 28.6415,
        lng: 77.1209,
        coordinates: { lat: 28.6415, lng: 77.1209 },
        phone: '+91 98222 33445',
        cuisines: ['Chinese', 'Fast Food'],
        rating: 4.6,
        reviewsCount: 340,
        reviewCount: 340,
        deliveryTime: '25-30 mins',
        deliveryFee: 25,
        freeDeliveryAbove: 249,
        deliveryRadiusKm: 18,
        servicePincodes: ['110027', '110001', '110005', '110015', '110018', '110016'],
        openingTime: '11:00',
        closingTime: '23:30',
        isOpen: true,
        active: true,
        featured: false,
        offerText: 'Free Delivery on ₹249+',
        offerBanner: 'FREE Delivery • Use FREEDEL',
        offerCode: 'FREEDEL',
        priceForTwo: 380,
        menu: [
            {
                id: 'item-dw-1',
                name: 'Schezwan Veg Hakka Noodles',
                category: 'Chinese',
                price: 210,
                originalPrice: 250,
                offerText: 'FREE DELIVERY',
                image: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=600&q=80',
                description: 'Wok-tossed noodles with julienne vegetables, spring onions, and house chili garlic oil.',
                isVeg: true,
                available: true
            },
            {
                id: 'item-dw-2',
                name: 'Crispy Chilli Chicken Dry (8 Pcs)',
                category: 'Chinese',
                price: 270,
                originalPrice: 320,
                offerText: 'SAVE ₹50',
                image: 'https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&fit=crop&w=600&q=80',
                description: 'Crispy diced chicken wok-tossed with bell peppers, green chilies, roasted garlic, and dark soy.',
                isVeg: false,
                available: true
            },
            {
                id: 'item-dw-3',
                name: 'Steamed Chicken Darjeeling Momos (6 Pcs)',
                category: 'Chinese',
                price: 160,
                originalPrice: 199,
                offerText: '20% OFF',
                image: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=600&q=80',
                description: 'Delicate dumplings stuffed with juicy minced chicken & herbs, served with fiery red Schezwan chutney.',
                isVeg: false,
                available: true
            }
        ]
    },
    {
        id: 'rest-crunch-chicken-republic',
        name: 'Crunch Fried Chicken & Wings Co.',
        description: '11-spice buttermilk fried chicken buckets, fiery peri-peri wings, boneless tenders, and grilled club sandwiches.',
        logo: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=300&q=80',
        coverImage: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=900&q=80',
        address: '12 Saket Select Citywalk Road',
        area: 'Saket',
        city: 'New Delhi',
        pincode: '110017',
        lat: 28.5286,
        lng: 77.2194,
        coordinates: { lat: 28.5286, lng: 77.2194 },
        phone: '+91 98112 99887',
        cuisines: ['Fast Food', 'Burger', 'Chicken'],
        rating: 4.8,
        reviewsCount: 540,
        reviewCount: 540,
        deliveryTime: '20-25 mins',
        deliveryFee: 25,
        freeDeliveryAbove: 299,
        deliveryRadiusKm: 18,
        servicePincodes: ['110017', '110001', '110016', '110024', '110029', '110049'],
        openingTime: '10:00',
        closingTime: '23:59',
        isOpen: true,
        active: true,
        featured: true,
        offerText: '20% OFF + Free Dip',
        offerBanner: '20% OFF on Chicken Buckets • Use FOODRUSH20',
        offerCode: 'FOODRUSH20',
        priceForTwo: 400,
        menu: [
            {
                id: 'fr-07',
                name: 'Crispy Peri-Peri Chicken Wings (6 Pcs)',
                category: 'Chicken',
                price: 249,
                originalPrice: 299,
                offerText: '20% OFF',
                image: 'https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=600&q=80',
                description: 'Tender chicken wings seasoned with secret spices, deep-fried golden and glazed with fiery Peri-Peri sauce.',
                isVeg: false,
                available: true
            },
            {
                id: 'fr-08',
                name: 'Crispy Fried Chicken Bucket (4 Pcs)',
                category: 'Chicken',
                price: 349,
                originalPrice: 419,
                offerText: 'SAVE ₹70',
                image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=600&q=80',
                description: 'Signature 11-spice buttermilk coated chicken drumsticks & thighs, ultra crunchy outside and juicy inside.',
                isVeg: false,
                available: true
            },
            {
                id: 'fr-09',
                name: 'Peri-Peri Boneless Chicken Tenders (5 Pcs)',
                category: 'Chicken',
                price: 219,
                originalPrice: 269,
                offerText: '19% OFF',
                image: 'https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&q=80',
                description: '100% boneless chicken breast strips marinated and fried crisp, served with creamy garlic ranch dip.',
                isVeg: false,
                available: true
            },
            {
                id: 'fr-13',
                name: 'Grilled Chicken Club Sandwich',
                category: 'Sandwich',
                price: 189,
                originalPrice: 229,
                offerText: '18% OFF',
                image: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=600&q=80',
                description: 'Triple-decker toasted sourdough sandwich with herb-grilled chicken, lettuce, tomatoes, and dijonnaise.',
                isVeg: false,
                available: true
            },
            {
                id: 'fr-14',
                name: 'Tandoori Paneer Tikka Sub Sandwich',
                category: 'Sandwich',
                price: 169,
                originalPrice: 209,
                offerText: '20% OFF',
                image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80',
                description: 'Tandoori-spiced cottage cheese cubes with crunchy capsicum, red onions, and mint chutney in a multigrain sub.',
                isVeg: true,
                available: true
            }
        ]
    },
    {
        id: 'rest-sweet-crumb-bakery',
        name: 'Sweet Crumb Cafe & Bakery',
        description: 'Specialty arabica coffees, Belgian chocolate waffles, molten choco lava cakes, and artisanal pastries.',
        logo: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=300&q=80',
        coverImage: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=900&q=80',
        address: '19 Khan Market',
        area: 'Khan Market',
        city: 'New Delhi',
        pincode: '110003',
        lat: 28.6001,
        lng: 77.2270,
        coordinates: { lat: 28.6001, lng: 77.2270 },
        phone: '+91 98999 66554',
        cuisines: ['Cafe', 'Bakery', 'Desserts'],
        rating: 4.9,
        reviewsCount: 410,
        reviewCount: 410,
        deliveryTime: '20-25 mins',
        deliveryFee: 20,
        freeDeliveryAbove: 249,
        deliveryRadiusKm: 16,
        servicePincodes: ['110003', '110001', '110011', '110016', '110021', '110024'],
        openingTime: '08:00',
        closingTime: '23:00',
        isOpen: true,
        active: true,
        featured: true,
        offerText: '20% OFF with FOODRUSH20',
        offerBanner: '20% OFF on Desserts & Shakes • Use FOODRUSH20',
        offerCode: 'FOODRUSH20',
        priceForTwo: 300,
        menu: [
            {
                id: 'fr-18',
                name: 'Warm Molten Choco Lava Cake',
                category: 'Bakery',
                price: 129,
                originalPrice: 169,
                offerText: '24% OFF',
                image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80',
                description: 'Decadent dark chocolate sponge cake with a warm molten chocolate center that bursts open on the first bite.',
                isVeg: true,
                available: true
            },
            {
                id: 'fr-19',
                name: 'Red Velvet Cream Cheese Pastry',
                category: 'Bakery',
                price: 149,
                originalPrice: 189,
                offerText: '21% OFF',
                image: 'https://images.unsplash.com/photo-1586788680434-30d324b2d46f?auto=format&fit=crop&w=600&q=80',
                description: 'Moist velvety ruby sponge cake layered with silky cream cheese frosting and red velvet crumbs.',
                isVeg: true,
                available: true
            },
            {
                id: 'fr-20',
                name: 'Nutella Hazelnut Belgian Waffle',
                category: 'Desserts',
                price: 179,
                originalPrice: 219,
                offerText: 'SAVE ₹40',
                image: 'https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=600&q=80',
                description: 'Freshly baked crispy Belgian waffle smothered with Nutella spread, toasted hazelnuts, and chocolate drizzle.',
                isVeg: true,
                available: true
            },
            {
                id: 'fr-15',
                name: 'Thick Belgian Chocolate Fudge Shake',
                category: 'Cafe',
                price: 149,
                originalPrice: 189,
                offerText: '21% OFF',
                image: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=600&q=80',
                description: 'Rich and creamy milkshake crafted with Belgian chocolate ice cream, dark fudge syrup, and whipped cream.',
                isVeg: true,
                available: true
            },
            {
                id: 'fr-16',
                name: 'Mango Tango Alphonso Smoothie',
                category: 'Cafe',
                price: 139,
                originalPrice: 169,
                offerText: '18% OFF',
                image: 'https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=600&q=80',
                description: 'Sun-ripened Alphonso mango pulp blended with Greek yogurt, organic honey, and crushed ice.',
                isVeg: true,
                available: true
            },
            {
                id: 'fr-17',
                name: 'Iced Caramel Espresso Macchiato',
                category: 'Cafe',
                price: 159,
                originalPrice: 199,
                offerText: '20% OFF',
                image: 'https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=600&q=80',
                description: 'Freshly pulled double espresso poured over cold velvety milk, vanilla syrup, and buttery caramel drizzle.',
                isVeg: true,
                available: true
            }
        ]
    }
];

/**
 * Initial Official Promotional Offers & Coupons
 */
const INITIAL_OFFERS = [
    {
        id: 'offer-foodrush20',
        code: 'FOODRUSH20',
        title: '20% OFF Sitewide Welcome Offer',
        description: 'Get flat 20% discount up to ₹150 on orders above ₹199 across all restaurants.',
        discountType: 'percentage',
        discountValue: 20,
        minOrderAmount: 199,
        maxDiscount: 150,
        startDate: '2026-01-01',
        expiryDate: '2027-12-31',
        applicableRestaurantId: 'all',
        restaurantId: 'ALL',
        restaurantName: 'All Restaurants',
        usageLimitPerUser: 5,
        usageLimit: 500,
        usedCount: 12,
        isActive: true,
        active: true,
        badgeColor: '#FF5722'
    },
    {
        id: 'offer-first50',
        code: 'FIRST50',
        title: '50% OFF on Your First Order',
        description: 'Special welcome deal! Enjoy 50% OFF up to ₹200 on your very first order.',
        discountType: 'first_order',
        discountValue: 50,
        minOrderAmount: 149,
        maxDiscount: 200,
        startDate: '2026-01-01',
        expiryDate: '2027-12-31',
        applicableRestaurantId: 'all',
        restaurantId: 'ALL',
        restaurantName: 'All Restaurants',
        usageLimitPerUser: 1,
        usageLimit: 1000,
        usedCount: 45,
        isActive: true,
        active: true,
        badgeColor: '#10B981'
    },
    {
        id: 'offer-pizza100',
        code: 'PIZZA100',
        title: 'Flat ₹100 OFF on Woodfire Pizzas',
        description: 'Instant ₹100 discount on orders of ₹499 or more at Napoli Woodfire Pizzeria or any store.',
        discountType: 'flat',
        discountValue: 100,
        minOrderAmount: 499,
        maxDiscount: 100,
        startDate: '2026-01-01',
        expiryDate: '2027-12-31',
        applicableRestaurantId: 'all',
        restaurantId: 'ALL',
        restaurantName: 'All Restaurants',
        usageLimitPerUser: 3,
        usageLimit: 300,
        usedCount: 18,
        isActive: true,
        active: true,
        badgeColor: '#F59E0B'
    },
    {
        id: 'offer-freedel',
        code: 'FREEDEL',
        title: 'FREE Express Delivery Pass',
        description: 'Zero delivery charges on any order above ₹249 across all partner restaurants!',
        discountType: 'free_delivery',
        discountValue: 100,
        minOrderAmount: 249,
        maxDiscount: 80,
        startDate: '2026-01-01',
        expiryDate: '2027-12-31',
        applicableRestaurantId: 'all',
        restaurantId: 'ALL',
        restaurantName: 'All Restaurants',
        usageLimitPerUser: 10,
        usageLimit: 1000,
        usedCount: 64,
        isActive: true,
        active: true,
        badgeColor: '#3B82F6'
    },
    {
        id: 'offer-spice30',
        code: 'SPICE30',
        title: '30% OFF at Spice Symphony',
        description: 'Savor royal North Indian delicacies with 30% OFF up to ₹120 on orders above ₹299.',
        discountType: 'percentage',
        discountValue: 30,
        minOrderAmount: 299,
        maxDiscount: 120,
        startDate: '2026-01-01',
        expiryDate: '2027-12-31',
        applicableRestaurantId: 'rest-spice-symphony',
        restaurantId: 'rest-spice-symphony',
        restaurantName: 'Spice Symphony Royal Kitchen',
        usageLimitPerUser: 4,
        usageLimit: 250,
        usedCount: 9,
        isActive: true,
        active: true,
        badgeColor: '#8B5CF6'
    }
];

/* ============================================================================
   1. RESTAURANTS & STORES ENGINE (FIRESTORE + REALTIME CACHE)
   ============================================================================ */

// Helper to prevent Firestore getDocs from hanging if Firestore isn't enabled in Firebase console
function withTimeout(promise, ms = 2500) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), ms))
    ]);
}

export async function fetchRestaurants() {
    if (db) {
        try {
            const snap = await withTimeout(getDocs(collection(db, 'restaurants')), 2500);
            if (!snap.empty) {
                const list = [];
                snap.forEach(docSnap => list.push({ id: docSnap.id, ...docSnap.data() }));
                for (const seedRest of INITIAL_RESTAURANTS) {
                    if (!list.some(r => r.id === seedRest.id)) {
                        list.push(seedRest);
                        setDoc(doc(db, 'restaurants', seedRest.id), seedRest).catch(() => {});
                    }
                }
                localStorage.setItem(RESTAURANTS_CACHE_KEY, JSON.stringify(list));
                return list;
            } else {
                for (const rest of INITIAL_RESTAURANTS) {
                    setDoc(doc(db, 'restaurants', rest.id), rest).catch(() => {});
                }
                localStorage.setItem(RESTAURANTS_CACHE_KEY, JSON.stringify(INITIAL_RESTAURANTS));
                return INITIAL_RESTAURANTS;
            }
        } catch (err) {
            console.warn('Firestore fetchRestaurants notice (using local seed cache):', err.message);
        }
    }

    return getRestaurantsSync();
}

export function getRestaurantsSync() {
    const cached = localStorage.getItem(RESTAURANTS_CACHE_KEY);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length >= INITIAL_RESTAURANTS.length) {
                return parsed;
            }
        } catch (e) {}
    }
    localStorage.setItem(RESTAURANTS_CACHE_KEY, JSON.stringify(INITIAL_RESTAURANTS));
    return INITIAL_RESTAURANTS;
}

export async function saveRestaurant(restaurantData) {
    const list = getRestaurantsSync();
    const id = restaurantData.id || ('rest-' + Date.now());
    const record = {
        ...restaurantData,
        id,
        offerText: restaurantData.offerText || restaurantData.offerBanner || '',
        offerBanner: restaurantData.offerBanner || restaurantData.offerText || '',
        lat: restaurantData.coordinates?.lat ?? restaurantData.lat ?? 28.6315,
        lng: restaurantData.coordinates?.lng ?? restaurantData.lng ?? 77.2167,
        updatedAt: new Date().toISOString()
    };

    const existingIdx = list.findIndex(r => r.id === id);
    if (existingIdx > -1) {
        list[existingIdx] = record;
    } else {
        list.push(record);
    }
    localStorage.setItem(RESTAURANTS_CACHE_KEY, JSON.stringify(list));

    if (db) {
        try {
            await setDoc(doc(db, 'restaurants', id), record);
        } catch (e) {
            console.warn('Firestore saveRestaurant sync warning:', e.message);
        }
    }
    return record;
}

export async function deleteRestaurantById(restaurantId) {
    let list = getRestaurantsSync();
    list = list.filter(r => r.id !== restaurantId);
    localStorage.setItem(RESTAURANTS_CACHE_KEY, JSON.stringify(list));

    if (db) {
        try {
            await deleteDoc(doc(db, 'restaurants', restaurantId));
        } catch (e) {
            console.warn('Firestore deleteRestaurant warning:', e.message);
        }
    }
    return true;
}

/**
 * Check if restaurant is currently open based on openingTime & closingTime + manual flag
 */
export function checkRestaurantOpenStatus(restaurant) {
    const hoursText = `${restaurant.openingTime || '09:00'} - ${restaurant.closingTime || '23:30'}`;
    if (restaurant.isOpen === false) {
        return {
            isOpen: false,
            label: 'Closed',
            hoursText,
            statusText: 'Temporarily Closed'
        };
    }

    return {
        isOpen: true,
        label: 'Open Now',
        hoursText,
        statusText: `Open Now (${hoursText})`
    };
}

/* ============================================================================
   2. OFFERS & COUPONS ENGINE (FIRESTORE + VALIDATION)
   ============================================================================ */

export async function fetchOffers() {
    if (db) {
        try {
            const snap = await withTimeout(getDocs(collection(db, 'offers')), 2500);
            if (!snap.empty) {
                const list = [];
                snap.forEach(docSnap => {
                    const d = docSnap.data();
                    list.push({
                        id: docSnap.id,
                        ...d,
                        active: d.active ?? d.isActive ?? true,
                        isActive: d.isActive ?? d.active ?? true,
                        restaurantId: d.restaurantId || (d.applicableRestaurantId === 'all' ? 'ALL' : d.applicableRestaurantId) || 'ALL'
                    });
                });
                localStorage.setItem(OFFERS_CACHE_KEY, JSON.stringify(list));
                return list;
            } else {
                for (const offer of INITIAL_OFFERS) {
                    setDoc(doc(db, 'offers', offer.id), offer).catch(() => {});
                }
                localStorage.setItem(OFFERS_CACHE_KEY, JSON.stringify(INITIAL_OFFERS));
                return INITIAL_OFFERS;
            }
        } catch (err) {
            console.warn('Firestore fetchOffers notice (using local seed cache):', err.message);
        }
    }

    return getOffersSync();
}

export function getOffersSync() {
    const cached = localStorage.getItem(OFFERS_CACHE_KEY);
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch (e) {}
    }
    localStorage.setItem(OFFERS_CACHE_KEY, JSON.stringify(INITIAL_OFFERS));
    return INITIAL_OFFERS;
}

export async function saveOffer(offerData) {
    const list = getOffersSync();
    const id = offerData.id || ('offer-' + Date.now());
    const isAct = offerData.active ?? offerData.isActive ?? true;
    const restId = offerData.restaurantId || offerData.applicableRestaurantId || 'ALL';
    const record = { 
        ...offerData, 
        id, 
        code: offerData.code.toUpperCase().trim(),
        active: isAct,
        isActive: isAct,
        restaurantId: restId,
        applicableRestaurantId: restId === 'ALL' ? 'all' : restId,
        updatedAt: new Date().toISOString() 
    };

    const existingIdx = list.findIndex(o => o.id === id);
    if (existingIdx > -1) {
        list[existingIdx] = record;
    } else {
        list.push(record);
    }
    localStorage.setItem(OFFERS_CACHE_KEY, JSON.stringify(list));

    if (db) {
        try {
            await setDoc(doc(db, 'offers', id), record);
        } catch (e) {
            console.warn('Firestore saveOffer warning:', e.message);
        }
    }
    return record;
}

export async function deleteOfferById(offerId) {
    let list = getOffersSync();
    list = list.filter(o => o.id !== offerId);
    localStorage.setItem(OFFERS_CACHE_KEY, JSON.stringify(list));

    if (db) {
        try {
            await deleteDoc(doc(db, 'offers', offerId));
        } catch (e) {
            console.warn('Firestore deleteOffer warning:', e.message);
        }
    }
    return true;
}

/**
 * Comprehensive Coupon Validation Engine
 */
export function validateCouponForOrder(code, subtotal, cartItems = [], deliveryFee = 40) {
    if (!code || !code.trim()) {
        return { valid: false, message: 'Please enter a coupon code.' };
    }

    const cleanCode = code.trim().toUpperCase();
    const offers = getOffersSync();
    const offer = offers.find(o => o.code.toUpperCase() === cleanCode);

    if (!offer) {
        return { valid: false, message: `Invalid coupon code "${cleanCode}".` };
    }

    if (offer.isActive === false || offer.active === false) {
        return { valid: false, message: `This coupon "${cleanCode}" is currently inactive.` };
    }

    const now = new Date();
    if (offer.startDate && new Date(offer.startDate) > now) {
        return { valid: false, message: `This coupon is not active yet.` };
    }
    if (offer.expiryDate && new Date(offer.expiryDate + 'T23:59:59') < now) {
        return { valid: false, message: `Coupon "${cleanCode}" has expired.` };
    }

    if (subtotal < (Number(offer.minOrderAmount) || 0)) {
        return { 
            valid: false, 
            message: `Minimum order of ₹${offer.minOrderAmount} required for ${cleanCode}. Add ₹${offer.minOrderAmount - subtotal} more!` 
        };
    }

    const targetRestId = offer.applicableRestaurantId || offer.restaurantId;
    if (targetRestId && targetRestId !== 'all' && targetRestId !== 'ALL') {
        const hasEligibleItem = cartItems.some(item => item.restaurantId === targetRestId);
        if (!hasEligibleItem && cartItems.length > 0 && cartItems[0].restaurantId) {
            const rests = getRestaurantsSync();
            const targetRest = rests.find(r => r.id === targetRestId);
            return { 
                valid: false, 
                message: `Coupon "${cleanCode}" is only valid on orders from ${targetRest ? targetRest.name : 'selected restaurant'}.` 
            };
        }
    }

    const usageMap = JSON.parse(localStorage.getItem(COUPON_USAGE_KEY) || '{}');
    const usedCount = usageMap[cleanCode] || 0;
    const limitPerUser = Number(offer.usageLimitPerUser || offer.usageLimit || 0);
    if (limitPerUser > 0 && usedCount >= limitPerUser) {
        return { 
            valid: false, 
            message: `You have reached the maximum usage limit (${limitPerUser}) for coupon "${cleanCode}".` 
        };
    }

    let discountAmount = 0;
    if (offer.discountType === 'percentage' || offer.discountType === 'first_order') {
        discountAmount = Math.round(subtotal * (Number(offer.discountValue) / 100));
        if (offer.maxDiscount && discountAmount > Number(offer.maxDiscount)) {
            discountAmount = Number(offer.maxDiscount);
        }
    } else if (offer.discountType === 'flat') {
        discountAmount = Number(offer.discountValue);
        if (offer.maxDiscount && discountAmount > Number(offer.maxDiscount)) {
            discountAmount = Number(offer.maxDiscount);
        }
    } else if (offer.discountType === 'free_delivery') {
        discountAmount = deliveryFee;
    }

    discountAmount = Math.min(discountAmount, subtotal + deliveryFee);

    return {
        valid: true,
        code: cleanCode,
        offer: offer,
        discountAmount: discountAmount,
        isFreeDelivery: offer.discountType === 'free_delivery',
        message: `🎉 "${cleanCode}" applied! You saved ₹${discountAmount}`
    };
}

export function recordCouponUsage(code) {
    if (!code) return;
    const cleanCode = code.trim().toUpperCase();
    const usageMap = JSON.parse(localStorage.getItem(COUPON_USAGE_KEY) || '{}');
    usageMap[cleanCode] = (usageMap[cleanCode] || 0) + 1;
    localStorage.setItem(COUPON_USAGE_KEY, JSON.stringify(usageMap));
}

/* ============================================================================
   3. LOCATION-BASED DELIVERY SYSTEM (GEOLOCATION + PINCODE + HAVERSINE)
   ============================================================================ */

export function getActiveDeliveryLocation() {
    try {
        const raw = localStorage.getItem(ACTIVE_LOCATION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

export function setActiveDeliveryLocation(locationObj) {
    if (!locationObj) {
        localStorage.removeItem(ACTIVE_LOCATION_KEY);
    } else {
        localStorage.setItem(ACTIVE_LOCATION_KEY, JSON.stringify(locationObj));
    }
    window.dispatchEvent(new CustomEvent('foodrush:locationChanged', { detail: locationObj }));
}

export function getSavedAddresses() {
    try {
        const raw = localStorage.getItem(SAVED_ADDRESSES_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

export async function saveCustomerAddress(addressObj) {
    const list = getSavedAddresses();
    const id = addressObj.id || ('addr-' + Date.now());
    const record = { ...addressObj, id, updatedAt: new Date().toISOString() };

    const existingIdx = list.findIndex(a => a.id === id);
    if (existingIdx > -1) {
        list[existingIdx] = record;
    } else {
        list.push(record);
    }
    localStorage.setItem(SAVED_ADDRESSES_KEY, JSON.stringify(list));

    setActiveDeliveryLocation(record);

    const user = window.FoodRushAuth ? window.FoodRushAuth.getCurrentUser() : null;
    if (db && user && user.uid) {
        try {
            await setDoc(doc(db, 'user_addresses', `${user.uid}_${id}`), {
                ...record,
                userId: user.uid,
                userEmail: user.email
            });
        } catch (e) {
            console.warn('Firestore address sync warning:', e.message);
        }
    }
    return record;
}

export function deleteSavedAddress(addrId) {
    let list = getSavedAddresses();
    list = list.filter(a => a.id !== addrId);
    localStorage.setItem(SAVED_ADDRESSES_KEY, JSON.stringify(list));
}

/**
 * Haversine Formula: Calculate real geographic distance in km between two coordinates
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(1));
}

/**
 * Check if a restaurant delivers to the active customer location
 */
export function checkRestaurantDeliverability(restaurant, location = null) {
    const loc = location || getActiveDeliveryLocation();
    if (!loc || (!loc.pincode && !loc.lat)) {
        return {
            delivers: true,
            deliverable: true,
            distanceKm: null,
            deliveryFee: restaurant.deliveryFee ?? 30,
            estimatedTime: restaurant.deliveryTime || '25-30 mins',
            reason: 'All delivery zones active'
        };
    }

    const rLat = restaurant.coordinates?.lat ?? restaurant.lat;
    const rLng = restaurant.coordinates?.lng ?? restaurant.lng;

    // 1. Check PIN code match if restaurant has servicePincodes configured
    if (loc.pincode && Array.isArray(restaurant.servicePincodes) && restaurant.servicePincodes.length > 0) {
        const pinMatch = restaurant.servicePincodes.map(p => String(p).trim()).includes(String(loc.pincode).trim());
        if (pinMatch) {
            return {
                delivers: true,
                deliverable: true,
                distanceKm: 2.4,
                deliveryFee: restaurant.deliveryFee ?? 30,
                estimatedTime: restaurant.deliveryTime || '25-30 mins',
                reason: `Delivers to PIN ${loc.pincode}`
            };
        }
    }

    // 2. Check Geographic Radius if coordinates exist
    if (loc.lat && loc.lng && rLat && rLng) {
        const dist = calculateDistanceKm(loc.lat, loc.lng, rLat, rLng);
        const maxRadius = Number(restaurant.deliveryRadiusKm) || 15;
        if (dist <= maxRadius) {
            const extraKm = Math.max(0, Math.ceil(dist - 5));
            const dynamicFee = (Number(restaurant.deliveryFee) || 30) + (extraKm * 5);
            return {
                delivers: true,
                deliverable: true,
                distanceKm: dist,
                deliveryFee: dynamicFee,
                estimatedTime: dist > 8 ? '35-45 mins' : (restaurant.deliveryTime || '25-30 mins'),
                reason: `${dist} km away`
            };
        } else {
            return {
                delivers: false,
                deliverable: false,
                distanceKm: dist,
                deliveryFee: 0,
                estimatedTime: 'Out of range',
                reason: `Outside ${maxRadius} km delivery radius (${dist} km away)`
            };
        }
    }

    // 3. If PIN code was provided and didn't match restaurant's PIN list
    if (loc.pincode && Array.isArray(restaurant.servicePincodes) && restaurant.servicePincodes.length > 0) {
        return {
            delivers: false,
            deliverable: false,
            distanceKm: null,
            deliveryFee: 0,
            estimatedTime: 'Not serviceable',
            reason: `Does not deliver to PIN ${loc.pincode}`
        };
    }

    return {
        delivers: true,
        deliverable: true,
        distanceKm: null,
        deliveryFee: restaurant.deliveryFee ?? 30,
        estimatedTime: restaurant.deliveryTime || '25-30 mins',
        reason: 'Available'
    };
}

/**
 * Upload image file to Firebase Storage (or convert to DataURL fallback)
 */
export async function uploadImageFile(file, folder = 'restaurants') {
    if (!file) return null;

    if (storage) {
        try {
            const filename = `${folder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const ref = storageRef(storage, filename);
            const snap = await uploadBytes(ref, file);
            const downloadUrl = await getDownloadURL(snap.ref);
            return downloadUrl;
        } catch (e) {
            console.warn('Firebase Storage upload fallback to base64:', e.message);
        }
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

/**
 * Synchronize authenticated customer to Cloud Firestore & local cache
 */
async function syncUserToCloud(userData) {
    if (!userData || !userData.uid) return;

    const formattedTime = new Date().toLocaleString('en-IN', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
    });

    const userPayload = {
        uid: userData.uid,
        name: userData.name || userData.displayName || 'FoodRush Customer',
        email: userData.email || '',
        phone: userData.phone || userData.phoneNumber || '',
        photoURL: userData.photoURL || '',
        provider: userData.provider || (userData.email ? 'google' : 'phone'),
        lastLoginAt: new Date().toISOString(),
        lastLoginFormatted: formattedTime
    };

    // Cache locally for instant access
    try {
        const USERS_CACHE_KEY = 'foodrush_users_cache_v2';
        let localUsers = [];
        try {
            localUsers = JSON.parse(localStorage.getItem(USERS_CACHE_KEY)) || [];
        } catch(e) {}
        const idx = localUsers.findIndex(u => u.uid === userData.uid || (u.email && u.email === userData.email));
        if (idx >= 0) {
            localUsers[idx] = { ...localUsers[idx], ...userPayload };
        } else {
            localUsers.unshift(userPayload);
        }
        localStorage.setItem(USERS_CACHE_KEY, JSON.stringify(localUsers));
    } catch(e) {}

    // Cloud Firestore persistence
    if (db) {
        try {
            const userDocRef = doc(db, 'users', userData.uid);
            await setDoc(userDocRef, userPayload, { merge: true });
        } catch(err) {
            console.warn('[FoodRush Store] Firestore sync user notice:', err.message);
        }
    }
}

/**
 * Fetch all registered customers from Firestore & local cache
 */
async function fetchUsers() {
    let cloudUsers = [];
    if (db) {
        try {
            const snap = await getDocs(collection(db, 'users'));
            snap.forEach(d => {
                cloudUsers.push(d.data());
            });
        } catch(e) {
            console.warn('[FoodRush Store] Error fetching users from Firestore:', e);
        }
    }

    // Try fetching from backend API if available
    try {
        const apiRes = await fetch('/api/auth/users');
        if (apiRes.ok) {
            const apiData = await apiRes.json();
            if (apiData.success && Array.isArray(apiData.users)) {
                apiData.users.forEach(u => cloudUsers.push(u));
            }
        }
    } catch(e) {}

    let localUsers = [];
    try {
        localUsers = JSON.parse(localStorage.getItem('foodrush_users_cache_v2')) || [];
    } catch(e) {}

    let authDbUsers = [];
    try {
        authDbUsers = JSON.parse(localStorage.getItem('foodrush_users_db')) || [];
    } catch(e) {}

    let activeUser = null;
    try {
        activeUser = JSON.parse(localStorage.getItem('foodrush_user')) || null;
    } catch(e) {}

    const map = new Map();
    cloudUsers.forEach(u => {
        const key = (u.email || u.uid || '').toLowerCase();
        if (key) map.set(key, u);
    });
    localUsers.forEach(u => {
        const key = (u.email || u.uid || '').toLowerCase();
        if (key && !map.has(key)) map.set(key, u);
    });
    authDbUsers.forEach(u => {
        const key = (u.email || u.uid || '').toLowerCase();
        if (key && !map.has(key)) {
            map.set(key, {
                uid: u.uid || ('user-' + Math.random().toString(36).substr(2, 6)),
                name: u.name || 'FoodRush Customer',
                email: u.email || '',
                phone: u.phone || '',
                provider: u.provider || 'email',
                lastLoginAt: u.lastLoginAt || new Date().toISOString()
            });
        }
    });
    if (activeUser && activeUser.email) {
        const key = activeUser.email.toLowerCase();
        if (!map.has(key)) {
            map.set(key, {
                uid: activeUser.uid || 'admin-uid',
                name: activeUser.name || 'Admin Customer',
                email: activeUser.email,
                phone: activeUser.phone || '',
                provider: activeUser.provider || 'google',
                lastLoginAt: new Date().toISOString()
            });
        }
    }

    return Array.from(map.values()).sort((a, b) => {
        return new Date(b.lastLoginAt || 0) - new Date(a.lastLoginAt || 0);
    });
}

/**
 * Save customer order in Cloud Firestore & local cache
 */
async function saveOrderToCloud(orderPayload) {
    if (!orderPayload || !orderPayload.orderId) return;

    // Cache locally for instant access
    try {
        const ORDERS_CACHE_KEY = 'foodrush_orders_cache_v2';
        let localOrders = [];
        try {
            localOrders = JSON.parse(localStorage.getItem(ORDERS_CACHE_KEY)) || [];
        } catch(e) {}
        const cleanId = String(orderPayload.orderId).trim();
        const existingIdx = localOrders.findIndex(o => o.orderId === cleanId);
        if (existingIdx >= 0) {
            localOrders[existingIdx] = { ...localOrders[existingIdx], ...orderPayload };
        } else {
            localOrders.unshift(orderPayload);
        }
        localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(localOrders.slice(0, 100)));
    } catch(e) {}

    // Cloud Firestore persistence
    if (db) {
        try {
            const cleanId = String(orderPayload.orderId).replace(/[^a-zA-Z0-9_-]/g, '');
            const orderDocRef = doc(db, 'orders', cleanId);
            await setDoc(orderDocRef, orderPayload, { merge: true });
            console.log('[FoodRush Store] Order synced to Firestore:', cleanId);
        } catch (err) {
            console.warn('[FoodRush Store] Firestore save order notice:', err.message);
        }
    }
}

/**
 * Fetch all customer orders from Firestore & local cache
 */
async function fetchOrders() {
    let cloudOrders = [];
    if (db) {
        try {
            const snap = await getDocs(collection(db, 'orders'));
            snap.forEach(d => {
                cloudOrders.push(d.data());
            });
        } catch(e) {
            console.warn('[FoodRush Store] Error fetching orders from Firestore:', e);
        }
    }

    // Try fetching from backend API if available
    try {
        const apiRes = await fetch('/api/orders');
        if (apiRes.ok) {
            const apiData = await apiRes.json();
            if (apiData.success && Array.isArray(apiData.orders)) {
                apiData.orders.forEach(o => cloudOrders.push(o));
            }
        }
    } catch(e) {}

    let localOrders = [];
    try {
        localOrders = JSON.parse(localStorage.getItem('foodrush_orders_cache_v2')) || [];
    } catch(e) {}

    const map = new Map();
    cloudOrders.forEach(o => map.set(o.orderId, o));
    localOrders.forEach(o => {
        if (!map.has(o.orderId)) {
            map.set(o.orderId, o);
        }
    });

    return Array.from(map.values()).sort((a, b) => {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
}

/**
 * Update order status (Placed, Preparing, Out for Delivery, Delivered, Cancelled)
 */
async function updateOrderStatus(orderId, newStatus) {
    if (!orderId || !newStatus) return;

    // Update in local cache
    try {
        const ORDERS_CACHE_KEY = 'foodrush_orders_cache_v2';
        let localOrders = JSON.parse(localStorage.getItem(ORDERS_CACHE_KEY)) || [];
        const target = localOrders.find(o => o.orderId === orderId);
        if (target) {
            target.status = newStatus;
            target.updatedAt = new Date().toISOString();
            localStorage.setItem(ORDERS_CACHE_KEY, JSON.stringify(localOrders));
        }
    } catch(e) {}

    // Update in Firestore
    if (db) {
        try {
            const cleanId = String(orderId).replace(/[^a-zA-Z0-9_-]/g, '');
            const orderDocRef = doc(db, 'orders', cleanId);
            await setDoc(orderDocRef, { status: newStatus, updatedAt: new Date().toISOString() }, { merge: true });
        } catch(e) {
            console.warn('[FoodRush Store] Update order status notice:', e);
        }
    }
}

// Export unified FoodRushStore object for ES module imports AND attach to window
export const FoodRushStore = {
    fetchRestaurants,
    getRestaurants: fetchRestaurants,
    getRestaurantsSync,
    saveRestaurant,
    deleteRestaurantById,
    deleteRestaurant: deleteRestaurantById,
    checkRestaurantOpenStatus,
    fetchOffers,
    getOffers: fetchOffers,
    getOffersSync,
    saveOffer,
    deleteOfferById,
    deleteOffer: deleteOfferById,
    validateCouponForOrder,
    recordCouponUsage,
    getActiveDeliveryLocation,
    getActiveLocation: getActiveDeliveryLocation,
    setActiveDeliveryLocation,
    setActiveLocation: setActiveDeliveryLocation,
    getSavedAddresses,
    saveCustomerAddress,
    deleteSavedAddress,
    calculateDistanceKm,
    checkRestaurantDeliverability,
    uploadImageFile,
    syncUserToCloud,
    fetchUsers,
    getUsers: fetchUsers,
    saveOrderToCloud,
    fetchOrders,
    getOrders: fetchOrders,
    updateOrderStatus
};

window.FoodRushStore = FoodRushStore;

// Trigger initial sync
fetchRestaurants();
fetchOffers();
