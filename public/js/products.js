/**
 * FoodRush - Complete Menu Products Database & Search/Filter Engine
 * Includes Restaurant attribution, Offer Badges, Coupon Codes, and dynamic Firestore Restaurant Menu sync
 */

const PRODUCTS = [
    {
        id: "fr-01",
        name: "Classic Cheeseburger",
        category: "burgers",
        restaurantId: "rest-burger-barn",
        restaurantName: "The Burger Barn & Grill",
        price: 199,
        originalPrice: 249,
        offerText: "20% OFF • Use FOODRUSH20",
        offerCode: "FOODRUSH20",
        rating: 4.8,
        reviewsCount: 342,
        image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80",
        description: "Juicy grilled patty topped with melted cheddar cheese, fresh lettuce, sliced tomatoes, pickles, and our signature secret sauce on a toasted sesame bun.",
        ingredients: ["Grilled Patty", "Cheddar Cheese", "Sesame Bun", "Lettuce", "Tomatoes", "Pickles", "Secret Sauce"],
        prepTime: "15-20 min",
        calories: "550 kcal",
        isVeg: false,
        isPopular: true,
        badge: "Best Seller"
    },
    {
        id: "fr-02",
        name: "Crispy Zinger Chicken Burger",
        category: "burgers",
        restaurantId: "rest-burger-barn",
        restaurantName: "The Burger Barn & Grill",
        price: 229,
        originalPrice: 279,
        offerText: "20% OFF • Use FOODRUSH20",
        offerCode: "FOODRUSH20",
        rating: 4.9,
        reviewsCount: 418,
        image: "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=800&q=80",
        description: "Golden fried crispy chicken breast layered with crunchy coleslaw, spicy chipotle mayo, and pickles inside a toasted brioche bun.",
        ingredients: ["Crispy Fried Chicken", "Brioche Bun", "Spicy Chipotle Mayo", "Coleslaw", "Pickles", "Lettuce"],
        prepTime: "15-20 min",
        calories: "620 kcal",
        isVeg: false,
        isPopular: true,
        badge: "Chef Special"
    },
    {
        id: "fr-03",
        name: "Double BBQ Bacon Smash Burger",
        category: "burgers",
        restaurantId: "rest-burger-barn",
        restaurantName: "The Burger Barn & Grill",
        price: 319,
        originalPrice: 389,
        offerText: "SAVE ₹70 • Use FOODRUSH20",
        offerCode: "FOODRUSH20",
        rating: 4.7,
        reviewsCount: 215,
        image: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=800&q=80",
        description: "Double smashed patties with crispy strips, caramelized onions, smoked cheddar cheese, and tangy smoky BBQ glaze.",
        ingredients: ["Double Patty", "Smoked Cheddar", "Caramelized Onions", "BBQ Sauce", "Brioche Bun"],
        prepTime: "20-25 min",
        calories: "780 kcal",
        isVeg: false,
        isPopular: false,
        badge: "Heavy Hit"
    },
    {
        id: "item-bb-veg",
        name: "Crunchy Aloo Tikki Veg Burger",
        category: "burgers",
        restaurantId: "rest-burger-barn",
        restaurantName: "The Burger Barn & Grill",
        price: 149,
        originalPrice: 189,
        offerText: "50% OFF First Order • FIRST50",
        offerCode: "FIRST50",
        rating: 4.7,
        reviewsCount: 290,
        image: "https://images.unsplash.com/photo-1520072959219-c595dc870360?auto=format&fit=crop&w=800&q=80",
        description: "Crispy herb-spiced potato & green peas patty topped with tangy tandoori mayo, red onions, tomatoes, and crisp iceberg lettuce.",
        ingredients: ["Spiced Potato Tikki", "Tandoori Mayo", "Sesame Bun", "Red Onions", "Lettuce"],
        prepTime: "12-15 min",
        calories: "430 kcal",
        isVeg: true,
        isPopular: true,
        badge: "100% Veg"
    },
    {
        id: "fr-04",
        name: "Loaded Four-Cheese Pizza",
        category: "pizza",
        restaurantId: "rest-napoli-pizzeria",
        restaurantName: "Napoli Woodfire Pizzeria",
        price: 299,
        originalPrice: 359,
        offerText: "Flat ₹100 OFF • Use PIZZA100",
        offerCode: "PIZZA100",
        rating: 4.9,
        reviewsCount: 520,
        image: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80",
        description: "Stone-baked hand-tossed crust overloaded with mozzarella, parmesan, gouda, and cheddar blend with rich Italian herb tomato sauce.",
        ingredients: ["Mozzarella", "Parmesan", "Gouda", "Cheddar", "Herbed Tomato Sauce", "Hand-Tossed Dough", "Fresh Basil"],
        prepTime: "20-25 min",
        calories: "850 kcal",
        isVeg: true,
        isPopular: true,
        badge: "Crowd Favorite"
    },
    {
        id: "fr-05",
        name: "Spicy Pepperoni Feast Pizza",
        category: "pizza",
        restaurantId: "rest-napoli-pizzeria",
        restaurantName: "Napoli Woodfire Pizzeria",
        price: 369,
        originalPrice: 429,
        offerText: "Flat ₹100 OFF • Use PIZZA100",
        offerCode: "PIZZA100",
        rating: 4.8,
        reviewsCount: 389,
        image: "https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=800&q=80",
        description: "Generously topped with smoky Italian pepperoni slices, crushed red pepper flakes, and stringy mozzarella on a crispy woodfire crust.",
        ingredients: ["Smoked Pepperoni", "Mozzarella Cheese", "Chili Flakes", "Tomato Puree", "Oregano", "Garlic Butter Crust"],
        prepTime: "20-25 min",
        calories: "920 kcal",
        isVeg: false,
        isPopular: false,
        badge: "Spicy"
    },
    {
        id: "fr-06",
        name: "Farmhouse Veggie Supreme Pizza",
        category: "pizza",
        restaurantId: "rest-napoli-pizzeria",
        restaurantName: "Napoli Woodfire Pizzeria",
        price: 279,
        originalPrice: 329,
        offerText: "Flat ₹100 OFF • Use PIZZA100",
        offerCode: "PIZZA100",
        rating: 4.6,
        reviewsCount: 198,
        image: "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=800&q=80",
        description: "Loaded with bell peppers, sweet corn, black olives, red onions, mushrooms, and jalapeños over golden mozzarella.",
        ingredients: ["Bell Peppers", "Sweet Corn", "Black Olives", "Mushrooms", "Jalapeños", "Mozzarella", "Herbed Sauce"],
        prepTime: "18-22 min",
        calories: "710 kcal",
        isVeg: true,
        isPopular: false,
        badge: "Veggie"
    },
    {
        id: "item-np-paneer",
        name: "Tandoori Paneer Tikka Pizza",
        category: "pizza",
        restaurantId: "rest-napoli-pizzeria",
        restaurantName: "Napoli Woodfire Pizzeria",
        price: 329,
        originalPrice: 389,
        offerText: "Flat ₹100 OFF • Use PIZZA100",
        offerCode: "PIZZA100",
        rating: 4.8,
        reviewsCount: 312,
        image: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80",
        description: "Smoky tandoori marinated paneer cubes, red paprika, crunchy capsicum, and mint mayo swirl on a wood-fired mozzarella crust.",
        ingredients: ["Tandoori Paneer", "Capsicum", "Red Paprika", "Mozzarella", "Mint Mayo"],
        prepTime: "20-25 min",
        calories: "760 kcal",
        isVeg: true,
        isPopular: true,
        badge: "Chef Special"
    },
    {
        id: "fr-07",
        name: "Crispy Peri-Peri Chicken Wings (6 Pcs)",
        category: "chicken",
        restaurantId: "rest-crunch-chicken-republic",
        restaurantName: "Crunch Fried Chicken & Wings Co.",
        price: 249,
        originalPrice: 299,
        offerText: "20% OFF • Use FOODRUSH20",
        offerCode: "FOODRUSH20",
        rating: 4.8,
        reviewsCount: 310,
        image: "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=800&q=80",
        description: "Tender, juicy chicken wings seasoned with secret spices, deep-fried to golden perfection and glazed with spicy Peri-Peri sauce.",
        ingredients: ["Chicken Wings", "Peri-Peri Glaze", "Garlic Herb Dip", "Crushed Paprika", "Celery Sticks"],
        prepTime: "15-20 min",
        calories: "490 kcal",
        isVeg: false,
        isPopular: true,
        badge: "Hot & Spicy"
    },
    {
        id: "fr-08",
        name: "Crispy Fried Chicken Bucket (4 Pcs)",
        category: "chicken",
        restaurantId: "rest-crunch-chicken-republic",
        restaurantName: "Crunch Fried Chicken & Wings Co.",
        price: 349,
        originalPrice: 419,
        offerText: "SAVE ₹70 • Use FOODRUSH20",
        offerCode: "FOODRUSH20",
        rating: 4.9,
        reviewsCount: 467,
        image: "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=800&q=80",
        description: "Signature 11-spice batter coated chicken drumsticks and thighs, ultra crunchy on the outside, succulent and juicy inside.",
        ingredients: ["Chicken Drumsticks", "Spiced Flour Batter", "Buttermilk", "Garlic Mayo Dip", "Herb Seasoning"],
        prepTime: "20-25 min",
        calories: "740 kcal",
        isVeg: false,
        isPopular: false,
        badge: "Family Pick"
    },
    {
        id: "fr-09",
        name: "Peri-Peri Chicken Tenders (5 Pcs)",
        category: "chicken",
        restaurantId: "rest-crunch-chicken-republic",
        restaurantName: "Crunch Fried Chicken & Wings Co.",
        price: 219,
        originalPrice: 269,
        offerText: "20% OFF • Use FOODRUSH20",
        offerCode: "FOODRUSH20",
        rating: 4.7,
        reviewsCount: 184,
        image: "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=800&q=80",
        description: "100% boneless chicken breast strips marinated, battered, and fried crisp, tossed in fiery peri-peri seasoning with ranch sauce.",
        ingredients: ["Boneless Chicken Breast", "Peri-Peri Dust", "Ranch Dip", "Crispy Panko"],
        prepTime: "12-15 min",
        calories: "420 kcal",
        isVeg: false,
        isPopular: false,
        badge: "Boneless"
    },
    {
        id: "fr-10",
        name: "Golden French Fries",
        category: "fries",
        restaurantId: "rest-burger-barn",
        restaurantName: "The Burger Barn & Grill",
        price: 99,
        originalPrice: 129,
        offerText: "23% OFF • Use FOODRUSH20",
        offerCode: "FOODRUSH20",
        rating: 4.7,
        reviewsCount: 680,
        image: "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=800&q=80",
        description: "Classic golden cut potato fries, crisp on the outside and fluffy inside, dusted with fine sea salt. Served with ketchup.",
        ingredients: ["Potatoes", "Sea Salt", "Vegetable Oil", "Tomato Ketchup"],
        prepTime: "8-10 min",
        calories: "320 kcal",
        isVeg: true,
        isPopular: true,
        badge: "Must Have"
    },
    {
        id: "fr-11",
        name: "Cheesy Peri-Peri Loaded Fries",
        category: "fries",
        restaurantId: "rest-burger-barn",
        restaurantName: "The Burger Barn & Grill",
        price: 159,
        originalPrice: 199,
        offerText: "20% OFF • Use FOODRUSH20",
        offerCode: "FOODRUSH20",
        rating: 4.9,
        reviewsCount: 395,
        image: "https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=800&q=80",
        description: "Crispy fries smothered in warm liquid cheddar cheese sauce, topped with jalapeño bits, peri-peri spice, and spring onions.",
        ingredients: ["Crispy Fries", "Warm Cheddar Sauce", "Pickled Jalapeños", "Peri-Peri Spice", "Spring Onions"],
        prepTime: "10-12 min",
        calories: "510 kcal",
        isVeg: true,
        isPopular: false,
        badge: "Cheesy"
    },
    {
        id: "fr-12",
        name: "Truffle Parmesan Gourmet Fries",
        category: "fries",
        restaurantId: "rest-burger-barn",
        restaurantName: "The Burger Barn & Grill",
        price: 189,
        originalPrice: 229,
        offerText: "20% OFF • Use FOODRUSH20",
        offerCode: "FOODRUSH20",
        rating: 4.8,
        reviewsCount: 160,
        image: "https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=800&q=80",
        description: "Gourmet hand-cut fries drizzled with fragrant white truffle oil, freshly shaved parmesan cheese, and chopped parsley.",
        ingredients: ["Hand-cut Potatoes", "White Truffle Oil", "Aged Parmesan", "Fresh Parsley", "Garlic Aioli"],
        prepTime: "10-12 min",
        calories: "440 kcal",
        isVeg: true,
        isPopular: false,
        badge: "Gourmet"
    },
    {
        id: "fr-13",
        name: "Grilled Chicken Club Sandwich",
        category: "sandwich",
        restaurantId: "rest-crunch-chicken-republic",
        restaurantName: "Crunch Fried Chicken & Wings Co.",
        price: 189,
        originalPrice: 229,
        offerText: "20% OFF • Use FOODRUSH20",
        offerCode: "FOODRUSH20",
        rating: 4.6,
        reviewsCount: 230,
        image: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=800&q=80",
        description: "Triple decker toasted sourdough sandwich layered with herb-marinated grilled chicken, fried egg, lettuce, tomato, and dijonnaise.",
        ingredients: ["Sourdough Bread", "Grilled Chicken", "Egg", "Lettuce", "Tomatoes", "Dijon Mustard", "Mayonnaise"],
        prepTime: "12-15 min",
        calories: "480 kcal",
        isVeg: false,
        isPopular: false,
        badge: "High Protein"
    },
    {
        id: "fr-14",
        name: "Tandoori Paneer Tikka Sub",
        category: "sandwich",
        restaurantId: "rest-crunch-chicken-republic",
        restaurantName: "Crunch Fried Chicken & Wings Co.",
        price: 169,
        originalPrice: 209,
        offerText: "20% OFF • Use FOODRUSH20",
        offerCode: "FOODRUSH20",
        rating: 4.7,
        reviewsCount: 175,
        image: "https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=800&q=80",
        description: "Tandoori-spiced cottage cheese cubes with crunchy capsicum, sliced red onions, and mint chutney in a fresh multigrain sub.",
        ingredients: ["Marinated Paneer", "Multigrain Sub Roll", "Mint Mayo", "Capsicum", "Onions", "Chaat Masala"],
        prepTime: "12-15 min",
        calories: "410 kcal",
        isVeg: true,
        isPopular: false,
        badge: "Vegetarian"
    },
    {
        id: "item-ss-1",
        name: "Old Delhi Butter Chicken Masala",
        category: "indian",
        restaurantId: "rest-spice-symphony",
        restaurantName: "Spice Symphony Royal Kitchen",
        price: 320,
        originalPrice: 380,
        offerText: "30% OFF • Use SPICE30",
        offerCode: "SPICE30",
        rating: 4.8,
        reviewsCount: 410,
        image: "https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=800&q=80",
        description: "Charcoal-grilled tandoori chicken simmered in velvety tomato and cashew butter gravy with fenugreek leaves.",
        ingredients: ["Tandoori Chicken", "Tomato Makhani Gravy", "Cashew Paste", "White Butter", "Kasuri Methi"],
        prepTime: "20-25 min",
        calories: "640 kcal",
        isVeg: false,
        isPopular: true,
        badge: "Royal Dish"
    },
    {
        id: "item-ss-2",
        name: "Paneer Tikka Lababdar",
        category: "indian",
        restaurantId: "rest-spice-symphony",
        restaurantName: "Spice Symphony Royal Kitchen",
        price: 280,
        originalPrice: 330,
        offerText: "30% OFF • Use SPICE30",
        offerCode: "SPICE30",
        rating: 4.7,
        reviewsCount: 325,
        image: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80",
        description: "Soft cottage cheese cubes tossed with roasted bell peppers in spiced onion-tomato rich Mughlai gravy.",
        ingredients: ["Malai Paneer", "Bell Peppers", "Onion Tomato Gravy", "Cream", "Indian Spices"],
        prepTime: "20-25 min",
        calories: "560 kcal",
        isVeg: true,
        isPopular: false,
        badge: "North Indian"
    },
    {
        id: "item-rb-1",
        name: "Hyderabadi Chicken Dum Biryani",
        category: "biryani",
        restaurantId: "rest-royal-biryani",
        restaurantName: "Royal Nizam Biryani House",
        price: 329,
        originalPrice: 399,
        offerText: "50% OFF First Order • FIRST50",
        offerCode: "FIRST50",
        rating: 4.9,
        reviewsCount: 890,
        image: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=800&q=80",
        description: "Aromatic long-grain aged basmati rice cooked on dum with saffron and marinated chicken, served with Mirchi ka Salan & Raita.",
        ingredients: ["Aged Basmati Rice", "Marinated Chicken", "Saffron", "Caramelized Onions", "Mint", "Nizam Spices"],
        prepTime: "25-30 min",
        calories: "720 kcal",
        isVeg: false,
        isPopular: true,
        badge: "Bestseller"
    },
    {
        id: "item-rb-2",
        name: "Subz Nizami Paneer Dum Biryani",
        category: "biryani",
        restaurantId: "rest-royal-biryani",
        restaurantName: "Royal Nizam Biryani House",
        price: 269,
        originalPrice: 319,
        offerText: "50% OFF First Order • FIRST50",
        offerCode: "FIRST50",
        rating: 4.7,
        reviewsCount: 410,
        image: "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=800&q=80",
        description: "Fresh garden vegetables, royal paneer cubes, saffron strands, and crispy fried onions sealed in an earthen handi.",
        ingredients: ["Basmati Rice", "Paneer Cubes", "Garden Veggies", "Saffron", "Burani Raita"],
        prepTime: "25-30 min",
        calories: "610 kcal",
        isVeg: true,
        isPopular: false,
        badge: "Handi Dum"
    },
    {
        id: "item-dw-1",
        name: "Schezwan Veg Hakka Noodles",
        category: "chinese",
        restaurantId: "rest-dragon-wok",
        restaurantName: "Dragon Wok Asian Express",
        price: 210,
        originalPrice: 250,
        offerText: "FREE Delivery • Use FREEDEL",
        offerCode: "FREEDEL",
        rating: 4.6,
        reviewsCount: 275,
        image: "https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=800&q=80",
        description: "Wok-tossed Hakka noodles with julienne vegetables, spring onions, and fiery house chili garlic oil.",
        ingredients: ["Hakka Noodles", "Bell Peppers", "Cabbage", "Spring Onions", "Schezwan Chili Oil"],
        prepTime: "15-20 min",
        calories: "480 kcal",
        isVeg: true,
        isPopular: false,
        badge: "Wok Tossed"
    },
    {
        id: "item-dw-3",
        name: "Steamed Chicken Momos (6 Pcs)",
        category: "chinese",
        restaurantId: "rest-dragon-wok",
        restaurantName: "Dragon Wok Asian Express",
        price: 160,
        originalPrice: 199,
        offerText: "FREE Delivery • Use FREEDEL",
        offerCode: "FREEDEL",
        rating: 4.8,
        reviewsCount: 360,
        image: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=800&q=80",
        description: "Delicate Tibetan-style dumplings stuffed with juicy minced chicken, ginger, and spring onions, served with fiery red chutney.",
        ingredients: ["Minced Chicken", "Spring Onions", "Ginger Garlic", "Roasted Chili Chutney"],
        prepTime: "12-15 min",
        calories: "360 kcal",
        isVeg: false,
        isPopular: true,
        badge: "Street Favorite"
    },
    {
        id: "fr-15",
        name: "Thick Chocolate Fudge Shake",
        category: "drinks",
        restaurantId: "rest-sweet-crumb-bakery",
        restaurantName: "Sweet Crumb Cafe & Bakery",
        price: 149,
        originalPrice: 189,
        offerText: "20% OFF • Use FOODRUSH20",
        offerCode: "FOODRUSH20",
        rating: 4.9,
        reviewsCount: 512,
        image: "https://images.unsplash.com/photo-1572490122747-3968b75cc699?auto=format&fit=crop&w=800&q=80",
        description: "Rich and creamy milkshake crafted with premium Belgian chocolate ice cream, dark fudge syrup, and topped with whipped cream.",
        ingredients: ["Belgian Chocolate Ice Cream", "Fresh Whole Milk", "Dark Chocolate Fudge", "Whipped Cream", "Chocolate Chips"],
        prepTime: "5-7 min",
        calories: "420 kcal",
        isVeg: true,
        isPopular: true,
        badge: "Top Rated"
    },
    {
        id: "fr-16",
        name: "Mango Tango Smoothie",
        category: "drinks",
        restaurantId: "rest-sweet-crumb-bakery",
        restaurantName: "Sweet Crumb Cafe & Bakery",
        price: 139,
        originalPrice: 169,
        offerText: "20% OFF • Use FOODRUSH20",
        offerCode: "FOODRUSH20",
        rating: 4.7,
        reviewsCount: 220,
        image: "https://images.unsplash.com/photo-1546173159-315724a31696?auto=format&fit=crop&w=800&q=80",
        description: "Sun-ripened Alphonso mango pulp blended with Greek yogurt, a dash of honey, and crushed ice for a tropical refresh.",
        ingredients: ["Alphonso Mango Pulp", "Greek Yogurt", "Organic Honey", "Chia Seeds", "Crushed Ice"],
        prepTime: "5-7 min",
        calories: "280 kcal",
        isVeg: true,
        isPopular: false,
        badge: "Refreshing"
    },
    {
        id: "fr-17",
        name: "Iced Caramel Macchiato",
        category: "drinks",
        restaurantId: "rest-sweet-crumb-bakery",
        restaurantName: "Sweet Crumb Cafe & Bakery",
        price: 159,
        originalPrice: 199,
        offerText: "20% OFF • Use FOODRUSH20",
        offerCode: "FOODRUSH20",
        rating: 4.8,
        reviewsCount: 280,
        image: "https://images.unsplash.com/photo-1517701550927-30cf4ba1dba5?auto=format&fit=crop&w=800&q=80",
        description: "Freshly pulled espresso poured over cold velvety milk and vanilla syrup, crowned with a buttery caramel drizzle.",
        ingredients: ["Espresso Shot", "Cold Milk", "Caramel Drizzle", "Vanilla Syrup", "Ice"],
        prepTime: "5-7 min",
        calories: "220 kcal",
        isVeg: true,
        isPopular: false,
        badge: "Energizing"
    },
    {
        id: "fr-18",
        name: "Warm Choco Lava Cake",
        category: "desserts",
        restaurantId: "rest-sweet-crumb-bakery",
        restaurantName: "Sweet Crumb Cafe & Bakery",
        price: 129,
        originalPrice: 169,
        offerText: "24% OFF • Use FOODRUSH20",
        offerCode: "FOODRUSH20",
        rating: 4.9,
        reviewsCount: 640,
        image: "https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=800&q=80",
        description: "Decadent dark chocolate sponge cake with a molten chocolate center that bursts open upon the first bite. Pure bliss.",
        ingredients: ["Dark Cocoa", "Molten Chocolate Center", "Butter", "Flour", "Vanilla Extract", "Powdered Sugar"],
        prepTime: "8-10 min",
        calories: "380 kcal",
        isVeg: true,
        isPopular: true,
        badge: "Bestseller"
    },
    {
        id: "fr-19",
        name: "Red Velvet Cream Pastry",
        category: "desserts",
        restaurantId: "rest-sweet-crumb-bakery",
        restaurantName: "Sweet Crumb Cafe & Bakery",
        price: 149,
        originalPrice: 189,
        offerText: "21% OFF • Use FOODRUSH20",
        offerCode: "FOODRUSH20",
        rating: 4.7,
        reviewsCount: 190,
        image: "https://images.unsplash.com/photo-1586788680434-30d324b2d46f?auto=format&fit=crop&w=800&q=80",
        description: "Moist velvety ruby sponge cake layered with silky cream cheese frosting and sprinkled with fine red velvet crumbs.",
        ingredients: ["Red Velvet Sponge", "Cream Cheese Frosting", "Buttercream", "Cocoa", "Vanilla Essence"],
        prepTime: "5 min",
        calories: "340 kcal",
        isVeg: true,
        isPopular: false,
        badge: "Sweet Delight"
    },
    {
        id: "fr-20",
        name: "Nutella Hazelnut Waffle",
        category: "desserts",
        restaurantId: "rest-sweet-crumb-bakery",
        restaurantName: "Sweet Crumb Cafe & Bakery",
        price: 179,
        originalPrice: 219,
        offerText: "SAVE ₹40 • Use FOODRUSH20",
        offerCode: "FOODRUSH20",
        rating: 4.8,
        reviewsCount: 305,
        image: "https://images.unsplash.com/photo-1562376552-0d160a2f238d?auto=format&fit=crop&w=800&q=80",
        description: "Freshly baked Belgian waffle smothered with rich Nutella spread, toasted hazelnut crumbles, and chocolate drizzle.",
        ingredients: ["Belgian Waffle", "Nutella Spread", "Toasted Hazelnuts", "Chocolate Drizzle", "Icing Sugar"],
        prepTime: "10-12 min",
        calories: "460 kcal",
        isVeg: true,
        isPopular: false,
        badge: "Chef Pick"
    }
];

window.foodProducts = PRODUCTS;

// Normalize category names (e.g., 'Burger' -> 'burgers')
function normalizeCategoryKey(cat) {
    const c = String(cat || '').toLowerCase().trim();
    if (c === 'burger' || c === 'burgers') return 'burgers';
    if (c === 'pizzas' || c === 'pizza') return 'pizza';
    if (c === 'drink' || c === 'drinks' || c === 'cafe' || c === 'beverages') return 'drinks';
    if (c === 'dessert' || c === 'desserts' || c === 'bakery') return 'desserts';
    if (c === 'sandwiches' || c === 'sandwich') return 'sandwich';
    return c;
}

// Dynamically merge any dishes added via Admin Dashboard / Firestore Restaurants
function getAllProducts() {
    const merged = [...PRODUCTS];
    if (window.FoodRushStore && typeof window.FoodRushStore.getRestaurantsSync === 'function') {
        const rests = window.FoodRushStore.getRestaurantsSync() || [];
        rests.forEach(rest => {
            if (Array.isArray(rest.menu)) {
                rest.menu.forEach(dish => {
                    if (!merged.some(p => String(p.id) === String(dish.id))) {
                        merged.push({
                            id: dish.id,
                            name: dish.name,
                            category: normalizeCategoryKey(dish.category || rest.cuisines?.[0] || 'special'),
                            restaurantId: rest.id,
                            restaurantName: rest.name,
                            price: Number(dish.price || 199),
                            originalPrice: Number(dish.originalPrice || Math.round(Number(dish.price || 199) * 1.2)),
                            offerText: dish.offerText || rest.offerText || '20% OFF • FOODRUSH20',
                            offerCode: rest.offerCode || 'FOODRUSH20',
                            rating: Number(rest.rating || 4.7),
                            reviewsCount: Number(rest.reviewsCount || 180),
                            image: dish.image || rest.coverImage || 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
                            description: dish.description || `Freshly prepared signature dish from ${rest.name}.`,
                            ingredients: [rest.name, dish.category || 'Fresh Ingredients'],
                            prepTime: rest.deliveryTime || '20-25 min',
                            calories: '480 kcal',
                            isVeg: dish.isVeg !== false,
                            isPopular: false,
                            badge: dish.offerText || rest.name
                        });
                    }
                });
            }
        });
    }
    return merged;
}

function getProductById(id) {
    return getAllProducts().find(p => String(p.id) === String(id));
}

function getPopularProducts() {
    return getAllProducts().filter(p => p.isPopular);
}

function getProductsByCategory(category) {
    const all = getAllProducts();
    if (!category || category.toLowerCase() === 'all') {
        return all;
    }
    const target = normalizeCategoryKey(category);
    return all.filter(p => normalizeCategoryKey(p.category) === target);
}

/**
 * Accurate Search & Filter Function:
 * When user types a dish name (e.g. "Classic Cheeseburger", "Burger", "Momos", "Biryani") or restaurant name,
 * filters strictly by dish name, category, or restaurant name so only relevant items appear.
 */
function searchProducts(query, category = 'all', restaurantId = 'all', offersOnly = false, vegOnly = false) {
    let list = getProductsByCategory(category);

    if (restaurantId && restaurantId !== 'all') {
        list = list.filter(p => p.restaurantId === restaurantId);
    }

    if (offersOnly) {
        list = list.filter(p => Boolean(p.offerText || p.originalPrice > p.price));
    }

    if (vegOnly) {
        list = list.filter(p => p.isVeg === true);
    }

    if (!query || query.trim() === '') {
        return list;
    }

    const cleanQuery = query.toLowerCase().trim();
    const words = cleanQuery.split(/\s+/).filter(Boolean);

    // Match against Dish Name, Category, or Restaurant Name (every word in query must match so specific dish searches return exact matches)
    const filterByNameAndMeta = (items) => {
        return items.filter(p => {
            const searchableText = `${p.name || ''} ${p.category || ''} ${p.restaurantName || ''} ${p.offerCode || ''}`.toLowerCase();
            return words.every(w => searchableText.includes(w));
        });
    };

    let matched = filterByNameAndMeta(list);

    // If user had a specific category pill active (e.g. Pizza) and searched for "Burger" by name, automatically search across all categories so their searched dish still shows up!
    if (matched.length === 0 && category !== 'all') {
        let allList = getAllProducts();
        if (restaurantId && restaurantId !== 'all') {
            allList = allList.filter(p => p.restaurantId === restaurantId);
        }
        if (vegOnly) {
            allList = allList.filter(p => p.isVeg === true);
        }
        matched = filterByNameAndMeta(allList);
    }

    return matched;
}

function getRelatedProducts(currentId, category, limit = 4) {
    const all = getAllProducts();
    const sameCat = all.filter(p => p.id !== currentId && normalizeCategoryKey(p.category) === normalizeCategoryKey(category));
    const otherCat = all.filter(p => p.id !== currentId && normalizeCategoryKey(p.category) !== normalizeCategoryKey(category));
    return [...sameCat, ...otherCat].slice(0, limit);
}
