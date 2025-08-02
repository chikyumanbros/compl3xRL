/**
 * Simplified Item system for Roguelike Game
 * Basic structure for future expansion
 */

class Item {
    constructor(type, name, data = {}) {
        this.type = type;
        this.name = name;
        this.description = data.description || 'A simple item.';
        this.x = data.x || 0;
        this.y = data.y || 0;
        this.symbol = data.symbol || '?';
        this.color = data.color || '#ffffff';
        
        // Stack properties
        this.stackable = data.stackable !== false; // Default to stackable for basic items
        this.quantity = data.quantity || 1;
        this.maxStackSize = data.maxStackSize || 99; // Maximum items per stack
        this.weight = data.weight || 1; // Weight per individual item
        
        // Visibility tracking (classic roguelike style)
        this.hasBeenSeen = false; // Whether player has ever seen this item
        this.lastSeenTurn = -1; // Last turn when player could see this item
    }
    
    /**
     * Check if this item can stack with another item
     */
    canStackWith(otherItem) {
        if (!this.stackable || !otherItem.stackable) return false;
        if (this.type !== otherItem.type) return false;
        if (this.name !== otherItem.name) return false;
        
        // For food items, also check freshness (only fresh items can stack together)
        if (this instanceof FoodItem && otherItem instanceof FoodItem) {
            const freshnessThreshold = 10; // Allow slight freshness differences
            return Math.abs(this.freshness - otherItem.freshness) <= freshnessThreshold;
        }
        
        return true;
    }
    
    /**
     * Get total weight of this stack
     */
    getTotalWeight() {
        return this.weight * this.quantity;
    }
    
    /**
     * Get display name with quantity
     */
    getDisplayName() {
        if (this.quantity > 1) {
            return `${this.name} (${this.quantity})`;
        }
        return this.name;
    }
    
    /**
     * Split stack into smaller stacks
     */
    split(amount) {
        if (amount >= this.quantity) return null;
        if (amount <= 0) return null;
        
        const newStack = this.clone();
        newStack.quantity = amount;
        this.quantity -= amount;
        
        return newStack;
    }
    
    /**
     * Clone this item (for stacking operations)
     */
    clone() {
        const data = {
            description: this.description,
            x: this.x,
            y: this.y,
            symbol: this.symbol,
            color: this.color,
            stackable: this.stackable,
            quantity: this.quantity,
            maxStackSize: this.maxStackSize,
            weight: this.weight,
            hasBeenSeen: this.hasBeenSeen,
            lastSeenTurn: this.lastSeenTurn
        };
        return new Item(this.type, this.name, data);
    }
}

/**
 * Equipment item class for weapons, armor, etc.
 */
class EquipmentItem extends Item {
    constructor(name, data = {}) {
        // Equipment items are never stackable, except for consumables like potions
        const isConsumable = data.type === 'potion' || data.type === 'scroll' || data.type === 'wand';
        const equipmentData = {
            ...data,
            stackable: isConsumable ? (data.stackable !== false) : false,
            quantity: isConsumable ? (data.quantity || 1) : 1,
            maxStackSize: isConsumable ? (data.maxStackSize || 99) : 1
        };
        super(data.type || 'equipment', name, equipmentData);
        this.weight = data.weight || 10;
        this.value = data.value || 0;
        
        // Combat stats
        this.damage = data.damage || 0;
        this.weaponDamage = data.weaponDamage || 0; // Die damage (e.g., d6)
        this.toHitBonus = data.toHitBonus || 0;
        this.armorClassBonus = data.armorClassBonus || 0;
        
        // Enhancement level
        this.enchantment = data.enchantment || 0; // +1, +2, etc.
        
        // Material and quality
        this.material = data.material || 'iron';
        this.quality = data.quality || 'normal'; // poor, normal, fine, masterwork
        
        // Special properties
        this.properties = data.properties || []; // magic properties, curses, etc.
        this.cursed = data.cursed || false;
        this.identified = data.identified !== false; // Default to identified for test items
        
        // Potion properties
        this.healDice = data.healDice || null; // Dice-based healing
        this.healAmount = data.healAmount || 0; // Fixed healing (fallback)
    }
    
    /**
     * Get display name with enchantment and stack quantity
     */
    getDisplayName() {
        let name = this.name;
        if (this.enchantment > 0) {
            name = `+${this.enchantment} ${name}`;
        } else if (this.enchantment < 0) {
            name = `${this.enchantment} ${name}`;
        }
        
        // Add stack quantity if more than 1
        if (this.quantity > 1) {
            name = `${name} (${this.quantity})`;
        }
        
        return name;
    }
    
    /**
     * Check if item can be equipped in specific slot
     */
    canEquipInSlot(slot) {
        const validSlots = {
            'weapon': ['weapon'],
            'armor': ['armor'],
            'shield': ['shield'],
            'helmet': ['helmet'],
            'gloves': ['gloves'],
            'boots': ['boots'],
            'ring': ['ring'],
            'amulet': ['amulet']
        };
        
        return validSlots[this.type]?.includes(slot) || false;
    }
    
    /**
     * Clone this equipment item (for stacking operations)
     */
    clone() {
        const data = {
            description: this.description,
            x: this.x,
            y: this.y,
            symbol: this.symbol,
            color: this.color,
            stackable: this.stackable,
            quantity: this.quantity,
            maxStackSize: this.maxStackSize,
            weight: this.weight,
            hasBeenSeen: this.hasBeenSeen,
            lastSeenTurn: this.lastSeenTurn,
            // Equipment-specific properties
            type: this.type,
            value: this.value,
            damage: this.damage,
            weaponDamage: this.weaponDamage,
            toHitBonus: this.toHitBonus,
            armorClassBonus: this.armorClassBonus,
            enchantment: this.enchantment,
            material: this.material,
            quality: this.quality,
            properties: this.properties ? [...this.properties] : [],
            cursed: this.cursed,
            identified: this.identified,
            healDice: this.healDice,
            healAmount: this.healAmount
        };
        return new EquipmentItem(this.name, data);
    }
}

/**
 * Food item class for hunger system
 */
class FoodItem extends Item {
    constructor(name, data = {}) {
        super('food', name, data);
        this.nutrition = data.nutrition || 100; // Nutrition value
        this.healAmount = data.healAmount || 0; // Immediate HP healing
        this.weight = data.weight || 1; // Item weight
        this.perishable = data.perishable || false; // Can spoil over time
        this.freshness = data.freshness || 100; // 100 = fresh, 0 = rotten
        
        // Food items are stackable by default
        this.stackable = data.stackable !== false;
        this.maxStackSize = data.maxStackSize || 20; // Smaller stacks for food
    }
    
    /**
     * Check if food is still edible
     */
    isEdible() {
        return this.freshness > 0;
    }
    
    /**
     * Get effective nutrition based on freshness
     */
    getEffectiveNutrition() {
        if (!this.isEdible()) return 0;
        return Math.floor(this.nutrition * (this.freshness / 100));
    }
    
    /**
     * Age the food (called each turn if perishable)
     */
    age() {
        if (this.perishable && this.freshness > 0) {
            this.freshness = Math.max(0, this.freshness - 0.1); // Very slow decay
        }
    }
    
    /**
     * Clone this food item (for stacking operations)
     */
    clone() {
        const data = {
            description: this.description,
            x: this.x,
            y: this.y,
            symbol: this.symbol,
            color: this.color,
            stackable: this.stackable,
            quantity: this.quantity,
            maxStackSize: this.maxStackSize,
            weight: this.weight,
            nutrition: this.nutrition,
            healAmount: this.healAmount,
            perishable: this.perishable,
            freshness: this.freshness,
            hasBeenSeen: this.hasBeenSeen,
            lastSeenTurn: this.lastSeenTurn
        };
        return new FoodItem(this.name, data);
    }
}

/**
 * Equipment Manager - handles equipment creation and management
 */
class EquipmentManager {
    /**
     * Create equipment item from template
     */
    static createEquipment(category, itemKey, enchantment = 0, modifications = {}) {
        const template = EQUIPMENT_TYPES[category]?.[itemKey];
        if (!template) {
            console.error(`Equipment template not found: ${category}.${itemKey}`);
            return null;
        }
        
        // Clone template and apply modifications
        const data = { ...template, ...modifications };
        data.enchantment = enchantment;
        
        // Apply enchantment bonuses
        if (enchantment !== 0) {
            if (data.damage !== undefined) {
                data.damage += enchantment;
            }
            if (data.armorClassBonus !== undefined) {
                data.armorClassBonus += enchantment;
            }
            if (data.toHitBonus !== undefined) {
                data.toHitBonus += enchantment;
            }
        }
        
        return new EquipmentItem(template.name, data);
    }
    
    /**
     * Create equipment with specified quantity (for stackable items like potions)
     */
    static createEquipmentWithQuantity(category, itemKey, quantity = 1, enchantment = 0, modifications = {}) {
        const template = EQUIPMENT_TYPES[category]?.[itemKey];
        if (!template) {
            console.error(`Equipment template not found: ${category}.${itemKey}`);
            return null;
        }
        
        // Clone template and apply modifications
        const data = { ...template, ...modifications };
        data.enchantment = enchantment;
        data.quantity = quantity;
        
        // Apply enchantment bonuses
        if (enchantment !== 0) {
            if (data.damage !== undefined) {
                data.damage += enchantment;
            }
            if (data.armorClassBonus !== undefined) {
                data.armorClassBonus += enchantment;
            }
            if (data.toHitBonus !== undefined) {
                data.toHitBonus += enchantment;
            }
        }
        
        return new EquipmentItem(template.name, data);
    }
    
    /**
     * Create a set of starting equipment for different classes
     */
    static createStartingEquipment(className = 'warrior') {
        const equipment = [];
        
        switch (className) {
            case 'warrior':
                equipment.push(
                    this.createEquipment('weapons', 'shortsword', 2), // +2 Shortsword
                    this.createEquipment('weapons', 'handaxe', 1),    // +1 Hand Axe
                    this.createEquipment('armor', 'leather', 1),      // +1 Leather Armor
                    this.createEquipment('shields', 'buckler', 1),    // +1 Buckler
                    this.createEquipmentWithQuantity('potions', 'healingPotion', 2),  // Healing Potion x2
                    this.createEquipment('tools', 'torch')            // Torch
                );
                break;
                
            case 'rogue':
                equipment.push(
                    this.createEquipment('weapons', 'dagger', 1),     // +1 Dagger
                    this.createEquipment('weapons', 'shortsword'),    // Shortsword
                    this.createEquipment('armor', 'leather'),         // Leather Armor
                    this.createEquipment('potions', 'healingPotion'), // Healing Potion
                    this.createEquipment('tools', 'torch')            // Torch
                );
                break;
                
            case 'fighter':
                equipment.push(
                    this.createEquipment('weapons', 'longsword', 1),  // +1 Longsword
                    this.createEquipment('armor', 'chainmail'),       // Chain Mail
                    this.createEquipment('shields', 'largeShield'),   // Large Shield
                    this.createEquipment('potions', 'greaterHealingPotion'), // Greater Healing
                    this.createEquipment('tools', 'torch')            // Torch
                );
                break;
                
            default: // Basic adventurer
                equipment.push(
                    this.createEquipment('weapons', 'dagger'),        // Dagger
                    this.createEquipment('armor', 'leather'),         // Leather Armor
                    this.createEquipment('potions', 'healingPotion'), // Healing Potion
                    this.createEquipment('tools', 'torch')            // Torch
                );
        }
        
        return equipment.filter(item => item !== null);
    }
    
    /**
     * Get all available equipment in a category
     */
    static getEquipmentCategory(category) {
        return EQUIPMENT_TYPES[category] || {};
    }
    
    /**
     * Get random equipment from category
     */
    static getRandomEquipment(category, minEnchantment = -1, maxEnchantment = 2) {
        const items = this.getEquipmentCategory(category);
        const keys = Object.keys(items);
        if (keys.length === 0) return null;
        
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        const enchantment = Math.floor(Math.random() * (maxEnchantment - minEnchantment + 1)) + minEnchantment;
        
        return this.createEquipment(category, randomKey, enchantment);
    }
}

/**
 * Equipment definitions for classic roguelike items
 */
const EQUIPMENT_TYPES = {
    // WEAPONS
    weapons: {
        // Light Weapons
        dagger: {
            name: 'Dagger',
            type: 'weapon',
            damage: 1,
            weaponDamage: 4, // d4
            weight: 10,
            value: 20,
            material: 'iron',
            symbol: '|',
            color: '#A0A0A0',
            description: 'A simple iron dagger. Light and quick. (1d4+1 damage)'
        },
        shortsword: {
            name: 'Shortsword',
            type: 'weapon', 
            damage: 2,
            weaponDamage: 6, // d6
            weight: 25,
            value: 100,
            material: 'steel',
            symbol: '|',
            color: '#E0E0E0',
            description: 'A well-balanced shortsword. Swift and deadly. (1d6+2 damage)'
        },
        handaxe: {
            name: 'Hand Axe',
            type: 'weapon',
            damage: 2,
            weaponDamage: 6, // d6
            weight: 30,
            value: 80,
            material: 'iron',
            symbol: '(',
            color: '#A0A0A0',
            description: 'A one-handed axe. Good for both combat and utility. (1d6+2 damage)'
        },
        
        // Medium Weapons
        longsword: {
            name: 'Longsword',
            type: 'weapon',
            damage: 3,
            weaponDamage: 8, // d8
            weight: 40,
            value: 150,
            material: 'steel',
            symbol: '|',
            color: '#E0E0E0',
            description: 'A classic longsword. The weapon of choice for warriors. (1d8+3 damage)'
        },
        battleaxe: {
            name: 'Battle Axe',
            type: 'weapon',
            damage: 4,
            weaponDamage: 8, // d8
            weight: 70,
            value: 200,
            material: 'steel',
            symbol: 'D',
            color: '#E0E0E0',
            description: 'A heavy two-handed axe. Cleaves through enemies. (1d8+4 damage)'
        },
        
        // Heavy Weapons
        greatsword: {
            name: 'Greatsword',
            type: 'weapon',
            damage: 5,
            weaponDamage: 10, // d10
            weight: 60,
            value: 300,
            material: 'steel',
            symbol: '\\',
            color: '#E0E0E0',
            description: 'A massive two-handed sword. Devastating in skilled hands. (1d10+5 damage)'
        }
    },
    
    // ARMOR
    armor: {
        leather: {
            name: 'Leather Armor',
            type: 'armor',
            armorClassBonus: 2,
            weight: 50,
            value: 100,
            material: 'leather',
            symbol: '(',
            color: '#8B4513',
            description: 'Basic leather armor. Light and flexible. (AC -2)'
        },
        studded: {
            name: 'Studded Leather',
            type: 'armor', 
            armorClassBonus: 3,
            weight: 80,
            value: 150,
            material: 'leather',
            symbol: '(',
            color: '#654321',
            description: 'Leather armor reinforced with metal studs. (AC -3)'
        },
        chainmail: {
            name: 'Chain Mail',
            type: 'armor',
            armorClassBonus: 5,
            weight: 300,
            value: 500,
            material: 'steel',
            symbol: '[',
            color: '#C0C0C0',
            description: 'Interlocking metal rings. Excellent protection. (AC -5)'
        },
        platemail: {
            name: 'Plate Mail',
            type: 'armor',
            armorClassBonus: 7,
            weight: 450,
            value: 1000,
            material: 'steel',
            symbol: ']',
            color: '#DCDCDC',
            description: 'Full plate armor. Maximum protection for warriors. (AC -7)'
        }
    },
    
    // SHIELDS
    shields: {
        buckler: {
            name: 'Buckler',
            type: 'shield',
            armorClassBonus: 1,
            weight: 35,
            value: 50,
            material: 'wood',
            symbol: ')',
            color: '#8B4513',
            description: 'A small round shield. Easy to maneuver. (AC -1)'
        },
        smallShield: {
            name: 'Small Shield',
            type: 'shield',
            armorClassBonus: 1,
            weight: 60,
            value: 80,
            material: 'wood',
            symbol: ')',
            color: '#8B4513',
            description: 'A standard wooden shield with metal rim. (AC -1)'
        },
        largeShield: {
            name: 'Large Shield',
            type: 'shield',
            armorClassBonus: 2,
            weight: 150,
            value: 200,
            material: 'steel',
            symbol: ')',
            color: '#C0C0C0',
            description: 'A heavy shield offering excellent protection. (AC -2)'
        }
    },
    
    // CONSUMABLES
    potions: {
        healingPotion: {
            name: 'Healing Potion',
            type: 'potion',
            healDice: '2d4+2',
            healAmount: 10, // Fallback for compatibility
            weight: 8,
            value: 50,
            symbol: '!',
            color: '#FF0000',
            description: 'A red potion that restores health (2d4+2 HP).',
            stackable: true,
            maxStackSize: 99
        },
        greaterHealingPotion: {
            name: 'Greater Healing Potion',
            type: 'potion',
            healDice: '3d4+3',
            healAmount: 15, // Fallback for compatibility
            weight: 10,
            value: 100,
            symbol: '!',
            color: '#DC143C',
            description: 'A large red potion with potent healing properties (3d4+3 HP).',
            stackable: true,
            maxStackSize: 99
        },
        minorHealingPotion: {
            name: 'Minor Healing Potion',
            type: 'potion',
            healDice: '1d4+1',
            healAmount: 5, // Fallback for compatibility
            weight: 6,
            value: 25,
            symbol: '!',
            color: '#FF69B4',
            description: 'A small pink potion with minor healing properties (1d4+1 HP).',
            stackable: true,
            maxStackSize: 99
        },
        superiorHealingPotion: {
            name: 'Superior Healing Potion',
            type: 'potion',
            healDice: '4d4+4',
            healAmount: 20, // Fallback for compatibility
            weight: 12,
            value: 200,
            symbol: '!',
            color: '#8B0000',
            description: 'A powerful dark red potion with superior healing properties (4d4+4 HP).',
            stackable: true,
            maxStackSize: 99
        }
    },
    
    // UTILITY
    tools: {
        torch: {
            name: 'Torch',
            type: 'light',
            weight: 8,
            value: 5,
            material: 'wood',
            symbol: '~',
            color: '#FFA500',
            description: 'A wooden torch for illumination.'
        }
    }
};

/**
 * Food definitions for classic roguelike items
 */
const FOOD_TYPES = {
    // Basic food items (NetHack-inspired)
    ration: {
        name: 'food ration',
        description: 'A carefully preserved meal, standard adventurer fare.',
        symbol: '%',
        color: '#8B4513',
        nutrition: 800,
        healAmount: 0,
        weight: 2,
        perishable: false
    },
    bread: {
        name: 'bread',
        description: 'A loaf of wholesome bread. Restores 5 HP when eaten.',
        symbol: '%',
        color: '#DEB887',
        nutrition: 200,
        healAmount: 5,
        weight: 1,
        perishable: true
    },
    apple: {
        name: 'apple',
        description: 'A crisp, red apple. Restores 2 HP when eaten.',
        symbol: '%',
        color: '#FF0000',
        nutrition: 50,
        healAmount: 2,
        weight: 1,
        perishable: true
    },
    cheese: {
        name: 'wedge of cheese',
        description: 'A triangular piece of aged cheese. Restores 3 HP when eaten.',
        symbol: '%',
        color: '#FFFF00',
        nutrition: 120,
        healAmount: 3,
        weight: 1,
        perishable: true
    },
    lembas: {
        name: 'lembas wafer',
        description: 'A thin, light wafer that fills the stomach and restores strength. Restores 15 HP when eaten.',
        symbol: '%',
        color: '#F0E68C',
        nutrition: 800,
        healAmount: 15,
        weight: 1,
        perishable: false
    },
    honeycake: {
        name: 'honey cake',
        description: 'A sweet cake dripping with golden honey. Restores 10 HP when eaten.',
        symbol: '%',
        color: '#FFD700',
        nutrition: 400,
        healAmount: 10,
        weight: 2,
        perishable: true
    },
    jerky: {
        name: 'strip of jerky',
        description: 'Dried and salted meat, tough but nutritious.',
        symbol: '%',
        color: '#8B0000',
        nutrition: 300,
        healAmount: 0,
        weight: 1,
        perishable: false
    }
};

/**
 * Item Manager with food support
 */
class ItemManager {
    constructor(dungeon) {
        this.dungeon = dungeon;
        this.items = [];
    }
    
    /**
     * Create a food item by type
     */
    createFood(type, x = 0, y = 0) {
        const foodData = FOOD_TYPES[type];
        if (!foodData) {
            console.warn(`Unknown food type: ${type}`);
            return null;
        }
        
        const food = new FoodItem(foodData.name, {
            ...foodData,
            x: x,
            y: y
        });
        
        return food;
    }
    
    /**
     * Add item to the dungeon floor
     */
    addItem(item) {
        this.items.push(item);
    }
    
    /**
     * Remove item from the dungeon floor
     */
    removeItem(item) {
        const index = this.items.indexOf(item);
        if (index !== -1) {
            this.items.splice(index, 1);
            return true;
        }
        return false;
    }
    
    /**
     * Get all items in the dungeon
     */
    getAllItems() {
        return this.items;
    }
    
    /**
     * Get items at specific position
     */
    getItemsAt(x, y) {
        return this.items.filter(item => item.x === x && item.y === y);
    }
    
    /**
     * Get visible items at specific position
     */
    getVisibleItemsAt(x, y, fov) {
        const itemsAtPosition = this.getItemsAt(x, y);
        return itemsAtPosition.filter(item => {
            if (!fov || typeof fov.getVisibility !== 'function') {
                return true;
            }
            
            try {
                const visibility = fov.getVisibility(x, y);
                return visibility.visible || (item.hasBeenSeen && visibility.explored);
            } catch (error) {
                console.warn('FOV error for item visibility check:', error);
                return true;
            }
        });
    }
    
    /**
     * Process aging for perishable items
     */
    processAging() {
        this.items.forEach(item => {
            if (item instanceof FoodItem && item.perishable) {
                item.age();
            }
        });
    }
    
    /**
     * Update item visibility based on FOV
     */
    updateItemVisibility(fov, playerTurn) {
        this.items.forEach(item => {
            if (fov && typeof fov.getVisibility === 'function') {
                try {
                    const visibility = fov.getVisibility(item.x, item.y);
                    if (visibility.visible) {
                        // Player can see this item now
                        item.hasBeenSeen = true;
                        item.lastSeenTurn = playerTurn;
                    }
                } catch (error) {
                    console.warn('FOV error for item visibility update:', error);
                }
            }
        });
    }
    
    /**
     * Get items that should be visible to player
     */
    getVisibleItems(fov) {
        return this.items.filter(item => {
            if (!fov || typeof fov.getVisibility !== 'function') {
                return true; // Show all items if no FOV
            }
            
            try {
                const visibility = fov.getVisibility(item.x, item.y);
                // Only show items that are currently visible OR have been seen before
                return visibility.visible || (item.hasBeenSeen && visibility.explored);
            } catch (error) {
                console.warn('FOV error for item visibility check:', error);
                return true; // Show item on error
            }
        });
    }
    
    /**
     * Generate random items throughout the dungeon
     */
    spawnItems(level) {
        // Reduced item count: 3-6 items per level (was 8-19)
        const numItems = 3 + Math.floor(Math.random() * 4); // 3-6 items per level
        let spawnedCount = 0;
        
        for (let i = 0; i < numItems; i++) {
            const position = this.getRandomFloorPosition();
            if (position) {
                const item = this.createRandomItem(level);
                if (item && typeof item === 'object') {
                    // Ensure coordinates are set correctly
                    item.x = position.x;
                    item.y = position.y;
                    
                    // Validate item has required properties
                    if (typeof item.x === 'number' && typeof item.y === 'number' && item.symbol) {
                        this.addItem(item);
                        spawnedCount++;
                    } else {
                        console.warn('Invalid item generated:', item);
                    }
                } else {
                    console.warn('Failed to create item for level', level);
                }
            }
        }
        
        console.log(`Spawned ${spawnedCount} valid items on level ${level}`);
    }
    
    /**
     * Find a random floor position in the dungeon
     */
    getRandomFloorPosition() {
        const maxAttempts = 100;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const x = Math.floor(Math.random() * this.dungeon.width);
            const y = Math.floor(Math.random() * this.dungeon.height);
            
            const tile = this.dungeon.getTile(x, y);
            if (tile.type === 'floor' && !this.hasItemAt(x, y)) {
                return { x, y };
            }
        }
        
        return null;
    }
    
    /**
     * Check if there's already an item at position
     */
    hasItemAt(x, y) {
        return this.items.some(item => item.x === x && item.y === y);
    }
    
    /**
     * Create a random item based on level difficulty with weighted drop table
     */
    createRandomItem(level) {
        // Weighted drop table (more common items have higher values)
        const dropTable = {
            'food': 35,     // Most common (35%)
            'potion': 25,   // Common (25%)
            'weapon': 15,   // Uncommon (15%)
            'armor': 15,    // Uncommon (15%)
            'shield': 10    // Rare (10%)
        };
        
        // Calculate total weight
        const totalWeight = Object.values(dropTable).reduce((sum, weight) => sum + weight, 0);
        
        // Random selection based on weights
        let random = Math.floor(Math.random() * totalWeight);
        
        for (const [itemType, weight] of Object.entries(dropTable)) {
            random -= weight;
            if (random < 0) {
                switch (itemType) {
                    case 'weapon':
                        return this.createRandomWeapon(level);
                    case 'armor':
                        return this.createRandomArmor(level);
                    case 'shield':
                        return this.createRandomShield(level);
                    case 'potion':
                        return this.createRandomPotion();
                    case 'food':
                        return this.createRandomFood();
                    default:
                        return null;
                }
            }
        }
        
        // Fallback (should never reach here)
        return this.createRandomFood();
    }
    
    /**
     * Create random weapon based on level
     */
    createRandomWeapon(level) {
        try {
            const weapons = Object.keys(EQUIPMENT_TYPES.weapons);
            if (weapons.length === 0) {
                console.warn('No weapons available in EQUIPMENT_TYPES');
                return null;
            }
            
            const weaponKey = weapons[Math.floor(Math.random() * weapons.length)];
            
            // Higher level = better enchantment chance
            const enchantmentChance = Math.min(0.3 + (level * 0.1), 0.7);
            const enchantment = Math.random() < enchantmentChance ? 
                Math.floor(Math.random() * Math.min(3, Math.floor(level / 2) + 1)) : 0;
            
            const weapon = EquipmentManager.createEquipment('weapons', weaponKey, enchantment);
            if (!weapon) {
                console.warn('EquipmentManager failed to create weapon:', weaponKey);
            }
            return weapon;
        } catch (error) {
            console.error('Error creating random weapon:', error);
            return null;
        }
    }
    
    /**
     * Create random armor based on level
     */
    createRandomArmor(level) {
        try {
            const armors = Object.keys(EQUIPMENT_TYPES.armor);
            if (armors.length === 0) {
                console.warn('No armor available in EQUIPMENT_TYPES');
                return null;
            }
            
            const armorKey = armors[Math.floor(Math.random() * armors.length)];
            
            const enchantmentChance = Math.min(0.2 + (level * 0.08), 0.6);
            const enchantment = Math.random() < enchantmentChance ? 
                Math.floor(Math.random() * Math.min(2, Math.floor(level / 3) + 1)) : 0;
            
            const armor = EquipmentManager.createEquipment('armor', armorKey, enchantment);
            if (!armor) {
                console.warn('EquipmentManager failed to create armor:', armorKey);
            }
            return armor;
        } catch (error) {
            console.error('Error creating random armor:', error);
            return null;
        }
    }
    
    /**
     * Create random shield based on level
     */
    createRandomShield(level) {
        try {
            const shields = Object.keys(EQUIPMENT_TYPES.shields);
            if (shields.length === 0) {
                console.warn('No shields available in EQUIPMENT_TYPES');
                return null;
            }
            
            const shieldKey = shields[Math.floor(Math.random() * shields.length)];
            
            const enchantmentChance = Math.min(0.2 + (level * 0.08), 0.6);
            const enchantment = Math.random() < enchantmentChance ? 
                Math.floor(Math.random() * Math.min(2, Math.floor(level / 3) + 1)) : 0;
            
            const shield = EquipmentManager.createEquipment('shields', shieldKey, enchantment);
            if (!shield) {
                console.warn('EquipmentManager failed to create shield:', shieldKey);
            }
            return shield;
        } catch (error) {
            console.error('Error creating random shield:', error);
            return null;
        }
    }
    
    /**
     * Create random potion with weighted rarity
     */
    createRandomPotion() {
        try {
            // Weighted potion drop table
            const potionDropTable = {
                'minorHealingPotion': 40,     // Common (40%)
                'healingPotion': 35,          // Common (35%)
                'greaterHealingPotion': 20,   // Uncommon (20%)
                'superiorHealingPotion': 5    // Rare (5%)
            };
            
            // Calculate total weight
            const totalWeight = Object.values(potionDropTable).reduce((sum, weight) => sum + weight, 0);
            
            // Random selection based on weights
            let random = Math.floor(Math.random() * totalWeight);
            let selectedPotion = 'healingPotion'; // fallback
            
            for (const [potionType, weight] of Object.entries(potionDropTable)) {
                random -= weight;
                if (random < 0) {
                    selectedPotion = potionType;
                    break;
                }
            }
            
            // Generate 1-2 potions (small stacks)
            const quantity = Math.random() < 0.7 ? 1 : 2; // 70% chance for 1, 30% for 2
            
            const potion = EquipmentManager.createEquipmentWithQuantity('potions', selectedPotion, quantity);
            if (!potion) {
                console.warn('EquipmentManager failed to create potion:', selectedPotion);
            }
            return potion;
        } catch (error) {
            console.error('Error creating random potion:', error);
            return null;
        }
    }
    
    /**
     * Create random food item
     */
    createRandomFood() {
        try {
            const foods = Object.keys(FOOD_TYPES);
            if (foods.length === 0) {
                console.warn('No foods available in FOOD_TYPES');
                return null;
            }
            
            const foodKey = foods[Math.floor(Math.random() * foods.length)];
            const food = this.createFood(foodKey);
            if (!food) {
                console.warn('Failed to create food:', foodKey);
            }
            return food;
        } catch (error) {
            console.error('Error creating random food:', error);
            return null;
        }
    }
} 