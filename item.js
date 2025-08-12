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
        
        // Penetration & Protection system (Warhammer-style)
        this.penetration = data.penetration || 0; // Armor Penetration for weapons
        this.protection = data.protection || 0;   // Damage Reduction for armor
        
        // Block Chance system (Shield-specific)
        this.blockChance = data.blockChance || 0; // % chance to block damage after hit
        
        // Status effect resistances (Armor-specific)
        this.resistances = data.resistances || {}; // e.g., { bleeding: 20, stunned: 15 }
        
        // Enhancement level
        this.enchantment = data.enchantment || 0; // +1, +2, etc.
        
        // Material and quality
        this.material = data.material || 'iron';
        this.quality = data.quality || 'normal'; // poor, normal, fine, masterwork
        
        // Category classification
        this.category = data.category || 'common'; // weapon/armor category classification
        this.weaponType = data.weaponType || null; // weapon type for skill systems
        
        // Durability system
        this.durability = data.durability || 'normal'; // normal, cracked1, cracked2, cracked3, broken
        this.maxDurability = data.maxDurability || this.calculateMaxDurability();
        this.currentDurability = data.currentDurability || this.maxDurability;
        
        // Special properties
        this.properties = data.properties || []; // magic properties, curses, etc.
        this.cursed = data.cursed || false;
        this.identified = data.identified !== false; // Default to identified for test items
        
        // Potion properties
        this.healDice = data.healDice || null; // Dice-based healing
        this.healAmount = data.healAmount || 0; // Fixed healing (fallback)
    }
    
    /**
     * Check if this equipment item can stack with another equipment item
     * Overrides base Item's canStackWith for more complex equipment rules
     */
    canStackWith(otherItem) {
        // Use base class method for basic checks
        if (!super.canStackWith(otherItem)) return false;
        
        // Additional checks for equipment items
        if (!(otherItem instanceof EquipmentItem)) return false;
        
        // For potions and other consumables, check relevant properties
        if (this.type === 'potion' && otherItem.type === 'potion') {
            // Potions must have same healing properties to stack
            return this.healDice === otherItem.healDice && 
                   this.healAmount === otherItem.healAmount &&
                   this.enchantment === otherItem.enchantment;
        }
        
        // For other consumables (scrolls, wands), check enchantment
        if ((this.type === 'scroll' || this.type === 'wand') && 
            (otherItem.type === 'scroll' || otherItem.type === 'wand')) {
            return this.enchantment === otherItem.enchantment;
        }
        
        // Non-consumable equipment items cannot stack (even if they have same name)
        return false;
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
     * Get category display name
     */
    getCategoryDisplayName() {
        const categoryNames = {
            'light_weapon': 'Light Weapon',
            'one_handed': 'One-Handed Weapon',
            'two_handed': 'Two-Handed Weapon',
            'light_armor': 'Light Armor',
            'medium_armor': 'Medium Armor',
            'heavy_armor': 'Heavy Armor',
            'small_shield': 'Small Shield',
            'large_shield': 'Large Shield',
            'healing_potion': 'Healing Potion',
            'utility_potion': 'Utility Potion',
            'utility_tool': 'Utility Tool',
            'light_source': 'Light Source',
            'common': 'Common'
        };
        
        return categoryNames[this.category] || 'Unknown';
    }
    
    /**
     * Get weapon type display name
     */
    getWeaponTypeDisplayName() {
        const weaponTypeNames = {
            'sword': 'Sword',
            'dagger': 'Dagger',
            'axe': 'Axe',
            'mace': 'Mace',
            'hammer': 'Hammer',
            'spear': 'Spear',
            'poleaxe': 'Poleaxe',
            'staff': 'Staff',
            'bow': 'Bow',
            'crossbow': 'Crossbow',
            'thrown': 'Thrown Weapon',
            'whip': 'Whip',
            'exotic': 'Exotic Weapon'
        };
        
        return weaponTypeNames[this.weaponType] || null;
    }
    
    /**
     * Get detailed item information including category and material
     */
    getDetailedInfo() {
        const info = {
            name: this.getDisplayName(),
            type: this.type,
            category: this.getCategoryDisplayName(),
            material: this.material,
            quality: this.quality,
            weight: this.getTotalWeight ? this.getTotalWeight() : this.weight
        };
        
        // Add weapon type for weapons
        if (this.weaponType) {
            info.weaponType = this.getWeaponTypeDisplayName();
        }
        
        // Add combat stats if available
        if (this.damage || this.weaponDamage) {
            info.damage = `${this.damage}+1d${this.weaponDamage}`;
        }
        if (this.armorClassBonus) {
            info.armorClass = `-${this.armorClassBonus}`;
        }
        if (this.toHitBonus) {
            info.toHit = `+${this.toHitBonus}`;
        }
        if (this.penetration) {
            info.penetration = `AP ${this.penetration}`;
        }
        if (this.protection) {
            info.protection = `Protection ${this.protection}`;
        }
        
        return info;
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
            penetration: this.penetration,
            protection: this.protection,
            enchantment: this.enchantment,
            material: this.material,
            quality: this.quality,
            category: this.category,
            weaponType: this.weaponType,
            properties: this.properties ? [...this.properties] : [],
            cursed: this.cursed,
            identified: this.identified,
            healDice: this.healDice,
            healAmount: this.healAmount,
            // Durability properties
            durability: this.durability,
            maxDurability: this.maxDurability,
            currentDurability: this.currentDurability
        };
        return new EquipmentItem(this.name, data);
    }
    
    /**
     * Calculate maximum durability based on material and quality
     */
    calculateMaxDurability() {
        let baseDurability = 100;
        
        // Material durability modifiers
        const materialModifiers = {
            'wood': 0.7,      // 70% durability
            'leather': 0.8,   // 80% durability
            'iron': 1.0,      // 100% durability (base)
            'steel': 1.3,     // 130% durability
            'silver': 1.1,    // 110% durability (soft but magical)
            'gold': 1.2,      // 120% durability (magical enhancement)
            'platinum': 1.5,  // 150% durability (rare and strong)
            'mithril': 1.8,   // 180% durability
            'adamantine': 2.5 // 250% durability
        };
        
        // Quality durability modifiers
        const qualityModifiers = {
            'poor': 0.6,      // 60% durability
            'normal': 1.0,    // 100% durability (base)
            'fine': 1.4,      // 140% durability
            'masterwork': 1.8, // 180% durability
            'legendary': 2.5   // 250% durability
        };
        
        // Equipment type base durability
        const typeModifiers = {
            'weapon': 1.0,    // Base durability
            'armor': 1.2,     // 20% more durable
            'shield': 0.9,    // 10% less durable (takes direct hits)
            'helmet': 1.1,    // 10% more durable
            'gloves': 0.8,    // 20% less durable
            'boots': 0.9,     // 10% less durable
            'ring': 0.0,      // Rings don't have durability (magical)
            'amulet': 0.0,    // Amulets don't have durability (magical)
            'light': 0.5      // Light sources have low durability
        };
        
        const materialMod = materialModifiers[this.material] || 1.0;
        const qualityMod = qualityModifiers[this.quality] || 1.0;
        const typeMod = typeModifiers[this.type] || 1.0;
        
        return Math.floor(baseDurability * materialMod * qualityMod * typeMod);
    }
    
    /**
     * Get current durability state based on current/max ratio
     */
    getDurabilityState() {
        if (this.currentDurability <= 0) {
            return 'broken';
        }
        
        const ratio = this.currentDurability / this.maxDurability;
        if (ratio >= 0.9) return 'normal';
        if (ratio >= 0.7) return 'cracked1';
        if (ratio >= 0.4) return 'cracked2';
        if (ratio > 0) return 'cracked3';
        return 'broken';
    }
    
    /**
     * Get effective stats considering durability degradation
     */
    getEffectiveStats() {
        const state = this.getDurabilityState();
        
        // Durability multipliers for different stats
        const multipliers = {
            'normal': 1.0,
            'cracked1': 0.95,  // 5% reduction
            'cracked2': 0.85,  // 15% reduction
            'cracked3': 0.7,   // 30% reduction
            'broken': 0.0      // Complete failure
        };
        
        const multiplier = multipliers[state] || 1.0;
        
        return {
            damage: this.applyDurabilityReduction(this.damage, multiplier, state),
            weaponDamage: this.applyDurabilityReduction(this.weaponDamage, multiplier, state),
            toHitBonus: this.applyDurabilityReduction(this.toHitBonus, multiplier, state),
            armorClassBonus: this.applyDurabilityReduction(this.armorClassBonus, multiplier, state),
            penetration: this.applyDurabilityReduction(this.penetration, multiplier, state),
            protection: this.applyDurabilityReduction(this.protection, multiplier, state),
            blockChance: this.applyDurabilityReduction(this.blockChance, multiplier, state),
            durabilityState: state,
            durabilityRatio: this.currentDurability / this.maxDurability
        };
    }
    
    /**
     * Get effective weight considering wear and tear
     * Damaged equipment weighs slightly less due to material loss
     */
    getEffectiveWeight() {
        const state = this.getDurabilityState();
        
        // Weight reduction based on damage (very small amounts)
        const weightLossMultipliers = {
            'normal': 1.0,     // No weight loss
            'cracked1': 0.98,  // 2% weight loss
            'cracked2': 0.95,  // 5% weight loss  
            'cracked3': 0.90,  // 10% weight loss
            'broken': 0.85     // 15% weight loss (pieces falling off)
        };
        
        const multiplier = weightLossMultipliers[state] || 1.0;
        return Math.max(0.1, this.weight * multiplier); // Minimum 0.1 lbs
    }
    
    /**
     * Apply durability reduction with minimum value guarantee
     * Prevents low-stat equipment from becoming completely useless when damaged
     */
    applyDurabilityReduction(originalValue, multiplier, state) {
        // If original value is 0, keep it 0
        if (originalValue === 0) return 0;
        
        // If item is broken, no function remains
        if (state === 'broken') return 0;
        
        // Apply reduction
        const reducedValue = Math.floor(originalValue * multiplier);
        
        // Guarantee minimum value of 1 for non-zero original values
        // This prevents low-stat equipment from becoming completely useless
        return Math.max(1, reducedValue);
    }
    
    /**
     * Calculate break chance based on material, type, and usage
     */
    getDurabilityBreakChance(usageType = 'normal') {
        // Base break chance per use (very low)
        let baseChance = 0.001; // 0.1% base chance
        
        // Material resistance (lower = more durable)
        const materialResistance = {
            'wood': 1.5,      // 50% more likely to break
            'leather': 1.2,   // 20% more likely
            'iron': 1.0,      // Base chance
            'steel': 0.7,     // 30% less likely
            'silver': 1.1,    // 10% more likely (soft metal)
            'gold': 1.3,      // 30% more likely (very soft)
            'platinum': 0.8,  // 20% less likely
            'mithril': 0.4,   // 60% less likely
            'adamantine': 0.2 // 80% less likely
        };
        
        // Weapon type modifiers (bladed weapons are more fragile)
        let weaponTypeMod = 1.0;
        if (this.type === 'weapon') {
            const bladedWeapons = ['dagger', 'shortsword', 'longsword', 'greatsword', 'scimitar', 
                                   'rapier', 'battleaxe', 'handaxe', 'halberd', 'glaive'];
            const bluntWeapons = ['club', 'mace', 'warhammer', 'maul', 'flail'];
            
            if (bladedWeapons.some(blade => this.name.toLowerCase().includes(blade))) {
                weaponTypeMod = 1.3; // 30% more likely to break (edges chip, blades nick)
            } else if (bluntWeapons.some(blunt => this.name.toLowerCase().includes(blunt))) {
                weaponTypeMod = 0.8; // 20% less likely to break (solid construction)
            }
        }
        
        // Usage type modifiers
        const usageModifiers = {
            'normal': 1.0,       // Normal use
            'critical': 2.0,     // Critical hits cause more wear
            'block': 1.5,        // Blocking puts stress on equipment
            'fumble': 3.0,       // Fumbling damages equipment more
            // Thrown usage variants
            'thrown_hit': 1.25,   // Impact on a target
            'thrown_impact': 1.10, // Landing impact on the ground
            'thrown_wall': 1.75   // Hard collision with wall/door
        };
        
        // Quality modifiers
        const qualityModifiers = {
            'poor': 2.0,      // Poor quality breaks more easily
            'normal': 1.0,    // Base chance
            'fine': 0.7,      // Fine quality more durable
            'masterwork': 0.4, // Masterwork very durable
            'legendary': 0.1   // Legendary almost unbreakable
        };
        
        // Current durability modifier (more likely to break when damaged)
        const durabilityRatio = this.currentDurability / this.maxDurability;
        const durabilityModifier = Math.max(0.5, 2.0 - durabilityRatio); // 0.5x to 2.0x
        
        const materialMod = materialResistance[this.material] || 1.0;
        const usageMod = usageModifiers[usageType] || 1.0;
        const qualityMod = qualityModifiers[this.quality] || 1.0;
        
        return baseChance * materialMod * weaponTypeMod * usageMod * qualityMod * durabilityModifier;
    }
    
    /**
     * Apply durability damage to the equipment
     */
    takeDurabilityDamage(amount = 1, usageType = 'normal') {
        if (this.currentDurability <= 0) {
            return false; // Already broken
        }
        
        // Check for immediate break
        const breakChance = this.getDurabilityBreakChance(usageType);
        if (Math.random() < breakChance) {
            // Random break occurred
            const damage = Math.floor(Math.random() * 10) + 5; // 5-14 damage
            this.currentDurability = Math.max(0, this.currentDurability - damage);
            return true; // Broke this turn
        }
        
        // Normal wear and tear
        this.currentDurability = Math.max(0, this.currentDurability - amount);
        return this.currentDurability <= 0; // Return true if just broke
    }
    
    /**
     * Repair equipment (restore durability)
     */
    repair(amount) {
        this.currentDurability = Math.min(this.maxDurability, this.currentDurability + amount);
        return this.currentDurability >= this.maxDurability;
    }
    
    /**
     * Get durability display string
     */
    getDurabilityDisplay() {
        const state = this.getDurabilityState();
        const stateNames = {
            'normal': '',
            'cracked1': ' (lightly damaged)',
            'cracked2': ' (damaged)', 
            'cracked3': ' (heavily damaged)',
            'broken': ' (BROKEN)'
        };
        
        return stateNames[state] || '';
    }
    
    /**
     * Check if equipment is usable (not broken)
     */
    isUsable() {
        return this.getDurabilityState() !== 'broken';
    }
    
    /**
     * Get display name including durability status
     */
    getDisplayName() {
        let displayName = this.name;
        
        // Add enchantment prefix if any
        if (this.enchantment > 0) {
            displayName = `+${this.enchantment} ${displayName}`;
        } else if (this.enchantment < 0) {
            displayName = `${this.enchantment} ${displayName}`;
        }
        
        // Note: Durability display is now handled by Player.getEquipmentDisplayInfo()
        // to ensure consistency across all UI elements
        
        // Add cursed indicator
        if (this.cursed && this.identified) {
            displayName += ' (cursed)';
        }
        
        return displayName;
    }
    
    /**
     * Get detailed description including durability and stats
     */
    getDetailedDescription() {
        let description = this.description || '';
        
        // Add durability information
        const state = this.getDurabilityState();
        const durabilityRatio = this.currentDurability / this.maxDurability;
        const durabilityPercent = Math.floor(durabilityRatio * 100);
        
        description += `\n\nDurability: ${durabilityPercent}% (${this.currentDurability}/${this.maxDurability})`;
        
        // Add effective stats if damaged
        if (state !== 'normal') {
            const effectiveStats = this.getEffectiveStats();
            description += `\nReduced effectiveness due to damage.`;
            
            if (this.damage > 0) {
                description += `\nDamage: ${effectiveStats.damage} (base: ${this.damage})`;
            }
            if (this.armorClassBonus > 0) {
                description += `\nAC Bonus: ${effectiveStats.armorClassBonus} (base: ${this.armorClassBonus})`;
            }
            if (this.protection > 0) {
                description += `\nProtection: ${effectiveStats.protection} (base: ${this.protection})`;
            }
            if (this.blockChance > 0) {
                description += `\nBlock Chance: ${effectiveStats.blockChance}% (base: ${this.blockChance}%)`;
            }
        }
        
        return description;
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
        
        // Generate random quality if not specified
        if (!data.quality && category !== 'potions' && category !== 'food') {
            // Magic items (rings, amulets) have better quality distribution
            if (category === 'rings' || category === 'amulets') {
                data.quality = this.generateMagicalQuality();
            } else {
                data.quality = this.generateRandomQuality();
            }
        }
        
        // Generate random initial durability for equipment items
        if (category !== 'potions' && category !== 'food' && !data.currentDurability) {
            // Only equipment items that can have durability get random initial condition
            const itemType = data.type || template.type;
            if (itemType !== 'ring' && itemType !== 'amulet') {
                const condition = this.generateRandomDurability();
                const item = new EquipmentItem(template.name, data);
                const maxDur = item.calculateMaxDurability();
                const percentage = this.generateInitialDurabilityPercentage(condition);
                data.currentDurability = Math.floor(maxDur * percentage);
            }
        }
        
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
     * Generate random quality with weighted distribution
     */
    static generateRandomQuality() {
        const qualityTable = {
            'poor': 15,      // 15%
            'normal': 60,    // 60%
            'fine': 18,      // 18%
            'masterwork': 6, // 6%
            'legendary': 1   // 1%
        };
        
        const totalWeight = Object.values(qualityTable).reduce((sum, weight) => sum + weight, 0);
        let random = Math.floor(Math.random() * totalWeight);
        
        for (const [quality, weight] of Object.entries(qualityTable)) {
            random -= weight;
            if (random < 0) {
                return quality;
            }
        }
        
        return 'normal'; // Fallback
    }
    
    /**
     * Generate magical quality with higher chances for better qualities
     */
    static generateMagicalQuality() {
        const magicalQualityTable = {
            'poor': 5,       // 5% (rare for magical items)
            'normal': 30,    // 30%
            'fine': 35,      // 35%
            'masterwork': 25, // 25%
            'legendary': 5   // 5%
        };
        
        const totalWeight = Object.values(magicalQualityTable).reduce((sum, weight) => sum + weight, 0);
        let random = Math.floor(Math.random() * totalWeight);
        
        for (const [quality, weight] of Object.entries(magicalQualityTable)) {
            random -= weight;
            if (random < 0) {
                return quality;
            }
        }
        
        return 'fine'; // Fallback to fine for magical items
    }
    
    /**
     * Generate random initial durability condition
     */
    static generateRandomDurability() {
        const durabilityTable = {
            'normal': 25,     // 25% - Excellent condition
            'cracked1': 35,   // 35% - Good condition  
            'cracked2': 25,   // 25% - Fair condition
            'cracked3': 15    // 15% - Poor condition
            // Note: 'broken' items are not generated naturally
        };
        
        const totalWeight = Object.values(durabilityTable).reduce((sum, weight) => sum + weight, 0);
        let random = Math.floor(Math.random() * totalWeight);
        
        for (const [condition, weight] of Object.entries(durabilityTable)) {
            random -= weight;
            if (random < 0) {
                return condition;
            }
        }
        
        return 'normal'; // fallback
    }
    
    /**
     * Generate initial durability percentage based on condition
     */
    static generateInitialDurabilityPercentage(condition) {
        switch (condition) {
            case 'normal':   return 0.85 + Math.random() * 0.15;  // 85-100%
            case 'cracked1': return 0.60 + Math.random() * 0.25;  // 60-85%
            case 'cracked2': return 0.35 + Math.random() * 0.25;  // 35-60%
            case 'cracked3': return 0.10 + Math.random() * 0.25;  // 10-35%
            default:         return 1.0;  // 100% for unknown conditions
        }
    }
    
    /**
     * Get items by category
     */
    static getItemsByCategory(category) {
        const items = [];
        for (const [categoryKey, categoryItems] of Object.entries(EQUIPMENT_TYPES)) {
            for (const [itemKey, itemData] of Object.entries(categoryItems)) {
                if (itemData.category === category) {
                    items.push({ categoryKey, itemKey, data: itemData });
                }
            }
        }
        return items;
    }
    
    /**
     * Get items by weapon type
     */
    static getItemsByWeaponType(weaponType) {
        const items = [];
        for (const [categoryKey, categoryItems] of Object.entries(EQUIPMENT_TYPES)) {
            for (const [itemKey, itemData] of Object.entries(categoryItems)) {
                if (itemData.weaponType === weaponType) {
                    items.push({ categoryKey, itemKey, data: itemData });
                }
            }
        }
        return items;
    }
    
    /**
     * Get random item from specific category
     */
    static getRandomItemFromCategory(category) {
        const items = this.getItemsByCategory(category);
        if (items.length === 0) return null;
        
        const randomItem = items[Math.floor(Math.random() * items.length)];
        return this.createEquipment(randomItem.categoryKey, randomItem.itemKey);
    }
    
    /**
     * Get random weapon from specific weapon type
     */
    static getRandomWeaponFromType(weaponType) {
        const items = this.getItemsByWeaponType(weaponType);
        if (items.length === 0) return null;
        
        const randomItem = items[Math.floor(Math.random() * items.length)];
        return this.createEquipment(randomItem.categoryKey, randomItem.itemKey);
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
        
        // Generate random quality if not specified (only for equipment, not consumables)
        if (!data.quality && category !== 'potions' && category !== 'food') {
            // Magic items (rings, amulets) have better quality distribution
            if (category === 'rings' || category === 'amulets') {
                data.quality = this.generateMagicalQuality();
            } else {
                data.quality = this.generateRandomQuality();
            }
        }
        
        // Generate random initial durability for equipment items
        if (category !== 'potions' && category !== 'food' && !data.currentDurability) {
            // Only equipment items that can have durability get random initial condition
            const itemType = data.type || template.type;
            if (itemType !== 'ring' && itemType !== 'amulet') {
                const condition = this.generateRandomDurability();
                const item = new EquipmentItem(template.name, data);
                const maxDur = item.calculateMaxDurability();
                const percentage = this.generateInitialDurabilityPercentage(condition);
                data.currentDurability = Math.floor(maxDur * percentage);
            }
        }
        
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
 * Equipment category definitions for classification
 */
/**
 * Weapon type classifications for skill systems and special effects
 */
const WEAPON_TYPES = {
    // Blade Weapons
    SWORD: 'sword',                     // Cutting/thrusting weapons
    DAGGER: 'dagger',                   // Small blades, stealth weapons
    
    // Hafted Weapons  
    AXE: 'axe',                         // Chopping weapons
    MACE: 'mace',                       // Blunt weapons
    HAMMER: 'hammer',                   // Heavy blunt weapons
    
    // Polearms
    SPEAR: 'spear',                     // Thrusting polearms
    POLEAXE: 'poleaxe',                 // Cutting/thrusting polearms
    STAFF: 'staff',                     // Quarterstaff and magical staves
    
    // Ranged Weapons
    BOW: 'bow',                         // Archery weapons
    CROSSBOW: 'crossbow',               // Mechanical ranged weapons
    THROWN: 'thrown',                   // Throwing weapons
    
    // Specialized
    WHIP: 'whip',                       // Flexible weapons
    EXOTIC: 'exotic'                    // Unusual weapons
};

const EQUIPMENT_CATEGORIES = {
    // Weapon Categories (Size/Weight based)
    LIGHT_WEAPON: 'light_weapon',        // Quick, agile weapons
    ONE_HANDED_WEAPON: 'one_handed',     // Balanced weapons
    TWO_HANDED_WEAPON: 'two_handed',     // Heavy, powerful weapons
    
    // Armor Categories  
    LIGHT_ARMOR: 'light_armor',          // Flexible, low protection
    MEDIUM_ARMOR: 'medium_armor',        // Balanced protection/mobility
    HEAVY_ARMOR: 'heavy_armor',          // Maximum protection, heavy
    
    // Shield Categories
    SMALL_SHIELD: 'small_shield',        // Light shields
    LARGE_SHIELD: 'large_shield',        // Heavy shields
    
    // Potion Categories
    HEALING_POTION: 'healing_potion',    // HP restoration
    UTILITY_POTION: 'utility_potion',    // Other effects
    
    // Tool Categories
    UTILITY_TOOL: 'utility_tool',        // General purpose tools
    LIGHT_SOURCE: 'light_source',        // Illumination tools
    
    // Magic Categories
    PROTECTION: 'protection',            // Protective magical items
    COMBAT: 'combat',                    // Combat enhancement items
    ENHANCEMENT: 'enhancement'           // Multi-purpose enhancement items
};

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
            category: EQUIPMENT_CATEGORIES.LIGHT_WEAPON,
            weaponType: WEAPON_TYPES.DAGGER,
            damage: 1,
            weaponDamage: 4, // d4
            penetration: 1, // Light armor piercing
            weight: 1,
            value: 20,
            material: 'iron',
            symbol: '|',
            color: '#A0A0A0',
            description: 'A simple iron dagger. Light and quick. (1d4+1 damage, AP 1)'
        },
        shortsword: {
            name: 'Shortsword',
            type: 'weapon',
            category: EQUIPMENT_CATEGORIES.LIGHT_WEAPON,
            weaponType: WEAPON_TYPES.SWORD,
            damage: 2,
            weaponDamage: 6, // d6
            penetration: 1, // Moderate piercing
            weight: 2.5,
            value: 100,
            material: 'steel',
            symbol: '|',
            color: '#E0E0E0',
            description: 'A well-balanced shortsword. Swift and deadly. (1d6+2 damage, AP 1)'
        },
        handaxe: {
            name: 'Hand Axe',
            type: 'weapon',
            category: EQUIPMENT_CATEGORIES.ONE_HANDED_WEAPON,
            weaponType: WEAPON_TYPES.AXE,
            damage: 2,
            weaponDamage: 6, // d6
            penetration: 2, // Good armor penetration
            weight: 2.5,
            value: 80,
            material: 'iron',
            symbol: '(',
            color: '#A0A0A0',
            description: 'A one-handed axe. Good for both combat and utility. (1d6+2 damage, AP 2)'
        },
        
        // Medium Weapons
        longsword: {
            name: 'Longsword',
            type: 'weapon',
            category: EQUIPMENT_CATEGORIES.ONE_HANDED_WEAPON,
            weaponType: WEAPON_TYPES.SWORD,
            damage: 3,
            weaponDamage: 8, // d8
            penetration: 2, // Good penetration
            weight: 3.5,
            value: 150,
            material: 'steel',
            symbol: '|',
            color: '#E0E0E0',
            description: 'A classic longsword. The weapon of choice for warriors. (1d8+3 damage, AP 2)'
        },
        battleaxe: {
            name: 'Battle Axe',
            type: 'weapon',
            category: EQUIPMENT_CATEGORIES.TWO_HANDED_WEAPON,
            weaponType: WEAPON_TYPES.AXE,
            damage: 4,
            weaponDamage: 8, // d8
            penetration: 3, // High armor penetration
            weight: 5,
            value: 200,
            material: 'steel',
            symbol: 'D',
            color: '#E0E0E0',
            description: 'A heavy two-handed axe. Cleaves through enemies. (1d8+4 damage, AP 3)'
        },
        
        // Heavy Weapons
        greatsword: {
            name: 'Greatsword',
            type: 'weapon',
            category: EQUIPMENT_CATEGORIES.TWO_HANDED_WEAPON,
            weaponType: WEAPON_TYPES.SWORD,
            damage: 5,
            weaponDamage: 10, // d10
            penetration: 3, // Excellent penetration
            weight: 6.5,
            value: 300,
            material: 'steel',
            symbol: '\\',
            color: '#E0E0E0',
            description: 'A massive two-handed sword. Devastating in skilled hands. (1d10+5 damage, AP 3)'
        },
        
        // Blunt Weapons (鈍器系)
        club: {
            name: 'Club',
            type: 'weapon',
            category: EQUIPMENT_CATEGORIES.LIGHT_WEAPON,
            weaponType: WEAPON_TYPES.MACE,
            damage: 1,
            weaponDamage: 4, // d4
            penetration: 0, // No armor penetration
            weight: 1.5,
            value: 5,
            material: 'wood',
            symbol: ')',
            color: '#8B4513',
            description: 'A simple wooden club. Basic but effective. (1d4+1 damage)'
        },
        mace: {
            name: 'Mace',
            type: 'weapon',
            category: EQUIPMENT_CATEGORIES.ONE_HANDED_WEAPON,
            weaponType: WEAPON_TYPES.MACE,
            damage: 3,
            weaponDamage: 6, // d6
            penetration: 2, // Effective against armor
            weight: 3.5,
            value: 120,
            material: 'iron',
            symbol: ')',
            color: '#A0A0A0',
            description: 'A heavy iron mace. Crushes armor and bone. (1d6+3 damage, AP 2)'
        },
        warhammer: {
            name: 'War Hammer',
            type: 'weapon',
            category: EQUIPMENT_CATEGORIES.ONE_HANDED_WEAPON,
            weaponType: WEAPON_TYPES.HAMMER,
            damage: 4,
            weaponDamage: 8, // d8
            penetration: 3, // High armor penetration
            weight: 5,
            value: 180,
            material: 'steel',
            symbol: 'T',
            color: '#E0E0E0',
            description: 'A steel war hammer. Designed to crush heavy armor. (1d8+4 damage, AP 3)'
        },
        maul: {
            name: 'Maul',
            type: 'weapon',
            category: EQUIPMENT_CATEGORIES.TWO_HANDED_WEAPON,
            weaponType: WEAPON_TYPES.HAMMER,
            damage: 6,
            weaponDamage: 12, // d12
            penetration: 4, // Maximum armor penetration
            weight: 6.5,
            value: 350,
            material: 'steel',
            symbol: 'T',
            color: '#E0E0E0',
            description: 'A massive two-handed maul. Devastating crushing power. (1d12+6 damage, AP 4)'
        }
    },
    
    // ARMOR
    armor: {
        leather: {
            name: 'Leather Armor',
            type: 'armor',
            category: EQUIPMENT_CATEGORIES.LIGHT_ARMOR,
            armorClassBonus: 2,
            protection: 1, // Basic damage reduction
            weight: 12,
            value: 100,
            material: 'leather',
            resistances: {
                stunned: 10,     // Flexible material absorbs some impact
                fractured: 5     // Minor bone protection
            },
            symbol: '(',
            color: '#8B4513',
            description: 'Basic leather armor. Light and flexible. (AC -2, DR 1, Stun Resist 10%)'
        },
        studded: {
            name: 'Studded Leather',
            type: 'armor',
            category: EQUIPMENT_CATEGORIES.LIGHT_ARMOR,
            armorClassBonus: 3,
            protection: 2, // Improved damage reduction
            weight: 20,
            value: 150,
            material: 'leather',
            resistances: {
                bleeding: 10,    // Metal studs provide some puncture protection
                stunned: 15,     // Better impact absorption
                fractured: 10    // Improved bone protection
            },
            symbol: '(',
            color: '#654321',
            description: 'Studded leather. (AC -3, DR 2, Bleed/Stun Resist)'
        },
        chainmail: {
            name: 'Chain Mail',
            type: 'armor',
            category: EQUIPMENT_CATEGORIES.MEDIUM_ARMOR,
            armorClassBonus: 5,
            protection: 3, // Good damage reduction
            weight: 30,
            value: 500,
            material: 'steel',
            resistances: {
                bleeding: 20,    // Good protection against cuts
                stunned: 10,     // Some impact absorption
                fractured: 15    // Moderate bone protection
            },
            symbol: '[',
            color: '#C0C0C0',
            description: 'Chain mail. (AC -5, DR 3, Good Bleed Resist)'
        },
        platemail: {
            name: 'Plate Mail',
            type: 'armor',
            category: EQUIPMENT_CATEGORIES.HEAVY_ARMOR,
            armorClassBonus: 7,
            protection: 4, // Excellent damage reduction
            weight: 45,
            value: 1000,
            material: 'steel',
            resistances: {
                bleeding: 30,    // Excellent cut protection
                stunned: 5,      // Rigid armor doesn't absorb impact well
                fractured: 25    // Excellent bone protection
            },
            symbol: ']',
            color: '#DCDCDC',
            description: 'Plate mail. (AC -7, DR 4, Excellent Physical Resist)'
        }
    },
    
    // SHIELDS
    shields: {
        buckler: {
            name: 'Buckler',
            type: 'shield',
            category: EQUIPMENT_CATEGORIES.SMALL_SHIELD,
            armorClassBonus: 0, // Shields don't provide AC
            protection: 0, // Shields don't provide DR
            blockChance: 15, // 15% chance to block damage
            weight: 6,
            value: 50,
            material: 'wood',
            resistances: {
                stunned: 5,      // Small shield offers minimal stun protection
                bleeding: 5      // Basic cut deflection
            },
            symbol: ')',
            color: '#8B4513',
            description: 'Small buckler. (BC 15%, Minor Resists)'
        },
        smallShield: {
            name: 'Small Shield',
            type: 'shield',
            category: EQUIPMENT_CATEGORIES.SMALL_SHIELD,
            armorClassBonus: 0, // Shields don't provide AC
            protection: 0, // Shields don't provide DR
            blockChance: 20, // 20% chance to block damage
            weight: 8,
            value: 80,
            material: 'wood',
            resistances: {
                stunned: 10,     // Better impact absorption
                bleeding: 10,    // Moderate cut deflection
                fractured: 5     // Some bone protection
            },
            symbol: ')',
            color: '#8B4513',
            description: 'Small shield. (BC 20%, Moderate Resists)'
        },
        largeShield: {
            name: 'Large Shield',
            type: 'shield',
            category: EQUIPMENT_CATEGORIES.LARGE_SHIELD,
            armorClassBonus: 0, // Shields don't provide AC
            protection: 0, // Shields don't provide DR
            blockChance: 25, // 25% chance to block damage
            weight: 12,
            value: 200,
            material: 'steel',
            resistances: {
                stunned: 15,     // Excellent impact absorption
                bleeding: 15,    // Good cut deflection
                fractured: 10    // Moderate bone protection
            },
            symbol: ')',
            color: '#C0C0C0',
            description: 'Large shield. (BC 25%, Good Resists)'
        }
    },
    
    // CONSUMABLES
    potions: {
        healingPotion: {
            name: 'Healing Potion',
            type: 'potion',
            category: EQUIPMENT_CATEGORIES.HEALING_POTION,
            healDice: '2d4+2',
            healAmount: 10, // Fallback for compatibility
            weight: 0.8,
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
            category: EQUIPMENT_CATEGORIES.HEALING_POTION,
            healDice: '3d4+3',
            healAmount: 15, // Fallback for compatibility
            weight: 1.0,
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
             category: EQUIPMENT_CATEGORIES.HEALING_POTION,
             healDice: '1d4+1',
             healAmount: 5, // Fallback for compatibility
            weight: 0.6,
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
             category: EQUIPMENT_CATEGORIES.HEALING_POTION,
             healDice: '4d4+4',
             healAmount: 20, // Fallback for compatibility
            weight: 1.2,
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
            category: EQUIPMENT_CATEGORIES.LIGHT_SOURCE,
            weight: 0.8,
            value: 5,
            material: 'wood',
            symbol: '~',
            color: '#FFA500',
            description: 'A wooden torch for illumination.'
        }
    },
    
    // HELMETS
    helmets: {
        leatherCap: {
            name: 'Leather Cap',
            type: 'helmet',
            category: EQUIPMENT_CATEGORIES.LIGHT_ARMOR,
            armorClassBonus: 1,
            protection: 0,
            weight: 2,
            value: 25,
            material: 'leather',
            resistances: {
                stunned: 15      // Basic concussion protection
            },
            symbol: ']',
            color: '#8B4513',
            description: 'Leather cap. (AC -1, Stun Resist 15%)'
        },
        ironHelm: {
            name: 'Iron Helm',
            type: 'helmet',
            category: EQUIPMENT_CATEGORIES.MEDIUM_ARMOR,
            armorClassBonus: 2,
            protection: 1,
            weight: 3,
            value: 100,
            material: 'iron',
            resistances: {
                stunned: 25,     // Good concussion protection
                fractured: 10    // Some skull protection
            },
            symbol: ']',
            color: '#A0A0A0',
            description: 'Iron helm. (AC -2, DR 1, Stun Resist 25%)'
        },
        steelHelm: {
            name: 'Steel Helm',
            type: 'helmet',
            category: EQUIPMENT_CATEGORIES.HEAVY_ARMOR,
            armorClassBonus: 3,
            protection: 2,
            weight: 4.5,
            value: 250,
            material: 'steel',
            resistances: {
                stunned: 35,     // Excellent concussion protection
                fractured: 15,   // Good skull protection
                bleeding: 10     // Head wound protection
            },
            symbol: ']',
            color: '#E0E0E0',
            description: 'Steel helm. (AC -3, DR 2, Excellent Stun Resist)'
        }
    },
    
    // GLOVES
    gloves: {
        leatherGloves: {
            name: 'Leather Gloves',
            type: 'gloves',
            category: EQUIPMENT_CATEGORIES.LIGHT_ARMOR,
            armorClassBonus: 0,
            protection: 0,
            toHitBonus: 1,
            weight: 0.8,
            value: 20,
            material: 'leather',
            resistances: {
                bleeding: 10     // Hand wound protection
            },
            symbol: '[',
            color: '#8B4513',
            description: 'Leather gloves. (To Hit +1, Bleed Resist 10%)'
        },
        chainGloves: {
            name: 'Chain Gloves',
            type: 'gloves',
            category: EQUIPMENT_CATEGORIES.MEDIUM_ARMOR,
            armorClassBonus: 1,
            protection: 1,
            toHitBonus: 0,
            weight: 1.5,
            value: 75,
            material: 'steel',
            resistances: {
                bleeding: 15,    // Good hand wound protection
                fractured: 5     // Some finger bone protection
            },
            symbol: '[',
            color: '#C0C0C0',
            description: 'Chain gloves. (AC -1, DR 1, Bleed Resist 15%)'
        },
        plateGloves: {
            name: 'Plate Gloves',
            type: 'gloves',
            category: EQUIPMENT_CATEGORIES.HEAVY_ARMOR,
            armorClassBonus: 1,
            protection: 2,
            toHitBonus: -1,
            weight: 2.5,
            value: 150,
            material: 'steel',
            resistances: {
                bleeding: 20,    // Excellent hand wound protection
                fractured: 10    // Good finger bone protection
            },
            symbol: '[',
            color: '#DCDCDC',
            description: 'Plate gauntlets. (AC -1, DR 2, To Hit -1, Good Resists)'
        }
    },
    
    // BOOTS
    boots: {
        leatherBoots: {
            name: 'Leather Boots',
            type: 'boots',
            category: EQUIPMENT_CATEGORIES.LIGHT_ARMOR,
            armorClassBonus: 1,
            protection: 0,
            weight: 2.5,
            value: 30,
            material: 'leather',
            resistances: {
                fractured: 10,   // Ankle support
                confused: 5      // Better footing
            },
            symbol: ']',
            color: '#8B4513',
            description: 'Leather boots. (AC -1, Fracture Resist 10%)'
        },
        ironBoots: {
            name: 'Iron Boots',
            type: 'boots',
            category: EQUIPMENT_CATEGORIES.MEDIUM_ARMOR,
            armorClassBonus: 1,
            protection: 1,
            weight: 3.5,
            value: 100,
            material: 'iron',
            resistances: {
                fractured: 15,   // Good ankle/foot protection
                confused: 10,    // Stable footing
                bleeding: 5      // Some puncture protection
            },
            symbol: ']',
            color: '#A0A0A0',
            description: 'Iron boots. (AC -1, DR 1, Good Fracture Resist)'
        },
        steelBoots: {
            name: 'Steel Boots',
            type: 'boots',
            category: EQUIPMENT_CATEGORIES.HEAVY_ARMOR,
            armorClassBonus: 2,
            protection: 2,
            weight: 4.5,
            value: 200,
            material: 'steel',
            resistances: {
                fractured: 20,   // Excellent ankle/foot protection
                confused: 15,    // Very stable footing
                bleeding: 10     // Good puncture protection
            },
            symbol: ']',
            color: '#E0E0E0',
            description: 'Steel boots. (AC -2, DR 2, Excellent Resists)'
        }
    },
    
    // RINGS
    rings: {
        ringOfProtection: {
            name: 'Ring of Protection',
            type: 'ring',
            category: EQUIPMENT_CATEGORIES.PROTECTION,
            armorClassBonus: 1,
            protection: 1,
            weight: 0.1,
            value: 300,
            material: 'gold',
            resistances: {
                bleeding: 5,
                stunned: 5,
                fractured: 5
            },
            symbol: '=',
            color: '#FFD700',
            description: 'Ring of protection. (AC -1, DR 1, Minor Resists)'
        },
        ringOfAccuracy: {
            name: 'Ring of Accuracy',
            type: 'ring',
            category: EQUIPMENT_CATEGORIES.COMBAT,
            toHitBonus: 2,
            weight: 0.1,
            value: 200,
            material: 'silver',
            symbol: '=',
            color: '#C0C0C0',
            description: 'A magical ring that improves aim. (To Hit +2)'
        },
        ringOfPower: {
            name: 'Ring of Power',
            type: 'ring',
            category: EQUIPMENT_CATEGORIES.ENHANCEMENT,
            toHitBonus: 1,
            armorClassBonus: 1,
            penetration: 1,
            weight: 0.1,
            value: 500,
            material: 'platinum',
            resistances: {
                stunned: 10,
                confused: 10
            },
            symbol: '=',
            color: '#E5E4E2',
            description: 'Ring of power. (To Hit +1, AC -1, AP 1, Mental Resists)'
        },
        ringOfResilience: {
            name: 'Ring of Resilience',
            type: 'ring',
            category: EQUIPMENT_CATEGORIES.PROTECTION,
            weight: 0.1,
            value: 400,
            material: 'mithril',
            resistances: {
                bleeding: 20,
                poisoned: 20,
                fractured: 15
            },
            symbol: '=',
            color: '#B0E0E6',
            description: 'Ring of resilience. (Excellent Physical Resists)'
        },
        ringOfClarity: {
            name: 'Ring of Clarity',
            type: 'ring',
            category: EQUIPMENT_CATEGORIES.PROTECTION,
            weight: 0.1,
            value: 350,
            material: 'crystal',
            resistances: {
                confused: 25,
                stunned: 20,
                paralyzed: 15
            },
            symbol: '=',
            color: '#F0F8FF',
            description: 'Ring of clarity. (Excellent Mental Resists)'
        }
    },
    
    // AMULETS
    amulets: {
        amuletOfWarding: {
            name: 'Amulet of Warding',
            type: 'amulet',
            category: EQUIPMENT_CATEGORIES.PROTECTION,
            armorClassBonus: 2,
            protection: 1,
            weight: 0.5,
            value: 400,
            material: 'silver',
            resistances: {
                bleeding: 10,
                stunned: 10,
                fractured: 10
            },
            symbol: '"',
            color: '#C0C0C0',
            description: 'Amulet of warding. (AC -2, DR 1, Balanced Resists)'
        },
        amuletOfMight: {
            name: 'Amulet of Might',
            type: 'amulet',
            category: EQUIPMENT_CATEGORIES.COMBAT,
            toHitBonus: 1,
            penetration: 2,
            weight: 0.5,
            value: 350,
            material: 'iron',
            symbol: '"',
            color: '#A0A0A0',
            description: 'An amulet that enhances combat prowess. (To Hit +1, AP 2)'
        },
        amuletOfBalance: {
            name: 'Amulet of Balance',
            type: 'amulet',
            category: EQUIPMENT_CATEGORIES.ENHANCEMENT,
            toHitBonus: 1,
            armorClassBonus: 1,
            protection: 1,
            weight: 0.5,
            value: 600,
            material: 'gold',
            resistances: {
                confused: 15,
                paralyzed: 10
            },
            symbol: '"',
            color: '#FFD700',
            description: 'Amulet of balance. (To Hit +1, AC -1, DR 1, Mental Resists)'
        },
        amuletOfVitality: {
            name: 'Amulet of Vitality',
            type: 'amulet',
            category: EQUIPMENT_CATEGORIES.PROTECTION,
            weight: 0.5,
            value: 500,
            material: 'ruby',
            resistances: {
                bleeding: 25,
                poisoned: 30,
                fractured: 20
            },
            symbol: '"',
            color: '#DC143C',
            description: 'Amulet of vitality. (Excellent Health Resists)'
        },
        amuletOfFortitude: {
            name: 'Amulet of Fortitude',
            type: 'amulet',
            category: EQUIPMENT_CATEGORIES.PROTECTION,
            protection: 2,
            weight: 0.5,
            value: 550,
            material: 'obsidian',
            resistances: {
                stunned: 30,
                fractured: 25,
                paralyzed: 20
            },
            symbol: '"',
            color: '#1C1C1C',
            description: 'Amulet of fortitude. (DR 2, Excellent Physical Resists)'
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
        weight: 1.5,
        perishable: false
    },
    bread: {
        name: 'bread',
        description: 'A loaf of wholesome bread. Restores 5 HP when eaten.',
        symbol: '%',
        color: '#DEB887',
        nutrition: 200,
        healAmount: 5,
        weight: 0.8,
        perishable: true
    },
    apple: {
        name: 'apple',
        description: 'A crisp, red apple. Restores 2 HP when eaten.',
        symbol: '%',
        color: '#FF0000',
        nutrition: 50,
        healAmount: 2,
        weight: 0.3,
        perishable: true
    },
    cheese: {
        name: 'wedge of cheese',
        description: 'A triangular piece of aged cheese. Restores 3 HP when eaten.',
        symbol: '%',
        color: '#FFFF00',
        nutrition: 120,
        healAmount: 3,
        weight: 0.5,
        perishable: true
    },
    lembas: {
        name: 'lembas wafer',
        description: 'A thin, light wafer that fills the stomach and restores strength. Restores 15 HP when eaten.',
        symbol: '%',
        color: '#F0E68C',
        nutrition: 800,
        healAmount: 15,
        weight: 0.2,
        perishable: false
    },
    honeycake: {
        name: 'honey cake',
        description: 'A sweet cake dripping with golden honey. Restores 10 HP when eaten.',
        symbol: '%',
        color: '#FFD700',
        nutrition: 400,
        healAmount: 10,
        weight: 1.2,
        perishable: true
    },
    jerky: {
        name: 'strip of jerky',
        description: 'Dried and salted meat, tough but nutritious.',
        symbol: '%',
        color: '#8B0000',
        nutrition: 300,
        healAmount: 0,
        weight: 0.4,
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
     * Create a non-interactive corpse item from a monster and add to ground
     */
    addCorpse(monster) {
        if (!monster || typeof monster.x !== 'number' || typeof monster.y !== 'number') return null;
        const name = monster.name ? `${monster.name} corpse` : 'monster corpse';
        const weight = Math.max(3, Math.floor((monster.maxHp || 6) / 2));
        const corpse = new Item('corpse', name, {
            description: `The remains of ${monster.name || 'a creature'}.`,
            x: monster.x,
            y: monster.y,
            symbol: ';',
            color: 'corpse',
            stackable: false,
            quantity: 1,
            maxStackSize: 1,
            weight
        });
        this.addItem(corpse);
        return corpse;
    }
    
    /**
     * Create a food item by type
     */
    createFood(type, x = 0, y = 0) {
        const foodData = FOOD_TYPES[type];
        if (!foodData) {

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
        // Balanced item count: 3-6 items per level
        const numItems = 3 + Math.floor(Math.random() * 4); // 3-6 items per level
        let spawnedCount = 0;
        let locationStats = {
            'DEAD-END': 0,
            'VERY-ENCLOSED': 0,
            'ENCLOSED': 0,
            'CORNER': 0,
            'ROOM-CENTER': 0,
            'ROOM': 0,
            'NEAR-WALLS': 0,
            'CORRIDOR': 0
        };
        
        console.log(`\n=== Spawning ${numItems} items for level ${level} ===`);
        
        for (let i = 0; i < numItems; i++) {
            const positionData = this.getRandomFloorPosition();
            if (positionData) {
                const item = this.createRandomItem(level);
                if (item && typeof item === 'object') {
                    // Ensure coordinates are set correctly
                    item.x = positionData.x;
                    item.y = positionData.y;
                    
                    // Validate item has required properties
                    if (typeof item.x === 'number' && typeof item.y === 'number' && item.symbol) {
                        this.addItem(item);
                        spawnedCount++;
        
                        // Track location statistics
                        if (locationStats[positionData.locationType] !== undefined) {
                            locationStats[positionData.locationType]++;
                    }
                } else {
                        console.error(`Invalid item properties:`, item);
                    }
                } else {
                    console.error(`Failed to create item for level ${level}`);
                }
            }
        }
        
        // Report spawn statistics
        console.log(`\nSpawn Statistics (${spawnedCount}/${numItems} items):`);
        for (const [type, count] of Object.entries(locationStats)) {
            if (count > 0) {
                const percentage = ((count / spawnedCount) * 100).toFixed(1);
                console.log(`  ${type}: ${count} (${percentage}%)`);
            }
        }
        console.log('');
    }
    
    /**
     * Spawn starting equipment around player position (new game only)
     */
    spawnStartingEquipment(playerX, playerY) {
        console.log(`Spawning starting equipment around player at (${playerX}, ${playerY})`);
        
        // Equipment to spawn (2-4 items)
        const startingEquipment = [
            () => this.createRandomWeapon(1),     // Simple weapon
            () => this.createRandomArmor(1),      // Basic armor
            () => this.createRandomShield(1),     // Shield
            () => this.createRandomPotion()       // Healing potion
        ];
        
        // Shuffle and select 2-3 items
        const selectedItems = startingEquipment
            .sort(() => Math.random() - 0.5)
            .slice(0, 2 + Math.floor(Math.random() * 2)); // 2-3 items
        
        let spawnedCount = 0;
        
        // Find positions around player (radius 2-3)
        const validPositions = this.findNearbyFloorPositions(playerX, playerY, 3);
        
        for (let i = 0; i < selectedItems.length && i < validPositions.length; i++) {
            const item = selectedItems[i]();
            if (item && typeof item === 'object') {
                const position = validPositions[i];
                item.x = position.x;
                item.y = position.y;
                
                if (typeof item.x === 'number' && typeof item.y === 'number' && item.symbol) {
                    this.addItem(item);
                    spawnedCount++;
                    console.log(`Spawned starting ${item.name} at (${item.x}, ${item.y})`);
                }
            }
        }
        
        console.log(`Spawned ${spawnedCount} starting equipment items`);
    }
    
    /**
     * Find floor positions around a center point within given radius
     */
    findNearbyFloorPositions(centerX, centerY, radius) {
        const positions = [];
        
        // Search in expanding rings from center
        for (let r = 1; r <= radius; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    // Skip positions already checked in smaller radius
                    if (Math.abs(dx) < r && Math.abs(dy) < r) continue;
                    
                    const x = centerX + dx;
                    const y = centerY + dy;
                    
                    // Check if position is valid and empty
                    if (this.dungeon.isInBounds(x, y)) {
            const tile = this.dungeon.getTile(x, y);
            if (tile.type === 'floor' && !this.hasItemAt(x, y)) {
                            positions.push({ x, y, distance: Math.abs(dx) + Math.abs(dy) });
                        }
                    }
                }
            }
        }
        
        // Sort by distance (closer positions first)
        positions.sort((a, b) => a.distance - b.distance);
        
        return positions;
    }
    
    /**
     * Find a random floor position in the dungeon with location-based weighting
     */
    getRandomFloorPosition() {
        // Get all valid floor positions
        const validPositions = [];
        let totalWeight = 0;
        let specialPositions = 0;
        
        for (let y = 0; y < this.dungeon.height; y++) {
            for (let x = 0; x < this.dungeon.width; x++) {
                const tile = this.dungeon.getTile(x, y);
                if (tile.type === 'floor' && !this.hasItemAt(x, y)) {
                    const specialness = this.calculateLocationSpecialness(x, y);
                    validPositions.push({ x, y, weight: specialness });
                    totalWeight += specialness;
                    if (specialness > 1.0) specialPositions++;
                }
            }
        }
        
        if (validPositions.length === 0) {
        return null;
        }
        
        // Debug info about terrain bias (only log occasionally)
        if (Math.random() < 0.1) { // 10% chance to log
            const avgWeight = totalWeight / validPositions.length;
            console.log(`Terrain bias: ${specialPositions}/${validPositions.length} special positions, avg weight: ${avgWeight.toFixed(2)}`);
        }
        
        // Weighted random selection
        const selectedPosition = this.weightedRandomSelect(validPositions);
        
        // Log special spawns (always log for debugging)
        const selectedWeight = validPositions.find(p => p.x === selectedPosition.x && p.y === selectedPosition.y)?.weight || 1;
        const wallCount = this.countNearbyWalls(selectedPosition.x, selectedPosition.y);
        let locationType = 'CORRIDOR'; // Default
        
        // Determine location type based on wall count and other factors
        if (wallCount >= 7) {
            locationType = 'DEAD-END';
        } else if (wallCount >= 6) {
            locationType = 'VERY-ENCLOSED';
        } else if (wallCount >= 5) {
            locationType = 'ENCLOSED';
        } else if (this.isInAnyRoom(selectedPosition.x, selectedPosition.y)) {
            // Check for room corner
            const north = !this.dungeon.isInBounds(selectedPosition.x, selectedPosition.y-1) || 
                         this.dungeon.getTile(selectedPosition.x, selectedPosition.y-1).type === 'wall';
            const south = !this.dungeon.isInBounds(selectedPosition.x, selectedPosition.y+1) || 
                         this.dungeon.getTile(selectedPosition.x, selectedPosition.y+1).type === 'wall';
            const east = !this.dungeon.isInBounds(selectedPosition.x+1, selectedPosition.y) || 
                        this.dungeon.getTile(selectedPosition.x+1, selectedPosition.y).type === 'wall';
            const west = !this.dungeon.isInBounds(selectedPosition.x-1, selectedPosition.y) || 
                        this.dungeon.getTile(selectedPosition.x-1, selectedPosition.y).type === 'wall';
            
            if ((north && east) || (north && west) || (south && east) || (south && west)) {
                locationType = 'CORNER';
            } else if (this.isRoomCenter(selectedPosition.x, selectedPosition.y)) {
                locationType = 'ROOM-CENTER';
            } else {
                locationType = 'ROOM';
            }
        } else if (wallCount >= 3) {
            locationType = 'NEAR-WALLS';
        }
        
        console.log(`Item spawn at (${selectedPosition.x}, ${selectedPosition.y}): ${locationType}, weight=${selectedWeight.toFixed(1)}, walls=${wallCount}/8`);
        
        return { x: selectedPosition.x, y: selectedPosition.y, locationType, weight: selectedWeight };
    }
    
    /**
     * Calculate how "special" a location is for item spawning
     * Higher values = more likely to spawn items
     */
    calculateLocationSpecialness(x, y) {
        let specialness = 1.0; // Base weight
        let locationTypes = [];
        let primaryType = null;
        
        const wallCount = this.countNearbyWalls(x, y);
        
        // Simplified dead-end detection: lots of walls around
        if (wallCount >= 7) {
            specialness = 50.0; // VERY high chance for true dead-ends
            primaryType = 'DEAD-END';
        }
        // Very enclosed spaces
        else if (wallCount >= 6) {
            specialness = 20.0; // High chance for very enclosed areas
            primaryType = 'VERY-ENCLOSED';
        }
        // Enclosed spaces
        else if (wallCount >= 5) {
            specialness = 10.0; // Good chance for enclosed areas
            primaryType = 'ENCLOSED';
        }
        // Check for room corners
        else if (this.isInAnyRoom(x, y) && wallCount >= 3) {
            // Simple corner check: in a room with 3+ walls nearby
            const north = !this.dungeon.isInBounds(x, y-1) || this.dungeon.getTile(x, y-1).type === 'wall';
            const south = !this.dungeon.isInBounds(x, y+1) || this.dungeon.getTile(x, y+1).type === 'wall';
            const east = !this.dungeon.isInBounds(x+1, y) || this.dungeon.getTile(x+1, y).type === 'wall';
            const west = !this.dungeon.isInBounds(x-1, y) || this.dungeon.getTile(x-1, y).type === 'wall';
            
            // Adjacent walls form a corner
            if ((north && east) || (north && west) || (south && east) || (south && west)) {
                specialness = 8.0;
                primaryType = 'CORNER';
            }
        }
        // Room centers
        else if (this.isRoomCenter(x, y)) {
            specialness = 5.0; // Moderate chance in room centers
            primaryType = 'ROOM-CENTER';
        }
        // Near walls
        else if (wallCount >= 3) {
            specialness = 3.0; // Some chance near walls
            primaryType = 'NEAR-WALLS';
        }
        // Check if in room vs corridor
        else if (this.isInAnyRoom(x, y)) {
            specialness = 2.0; // Slight preference for rooms
            primaryType = 'ROOM';
        }
        else {
            specialness = 1.0; // Base weight for corridors
            primaryType = 'CORRIDOR';
        }
        
        // Debug: Log all calculations for debugging
        if (Math.random() < 0.1) { // 10% chance to log
            console.log(`Location (${x}, ${y}): type=${primaryType}, weight=${specialness.toFixed(1)}, walls=${wallCount}/8`);
        }
        
        return specialness;
    }
    
    /**
     * Check if position is a dead-end (袋小路)
     * True dead-end: exactly 1 walkable adjacent tile (4-directional check)
     */
    isDeadEnd(x, y) {
        // First check 4-directional (cardinal) for true dead-end
        const cardinalDirections = [
            [0, -1], [1, 0], [0, 1], [-1, 0] // N, E, S, W
        ];
        
        let cardinalWalkable = 0;
        
        for (const [dx, dy] of cardinalDirections) {
            const checkX = x + dx;
            const checkY = y + dy;
            
            if (this.dungeon.isInBounds(checkX, checkY)) {
                const tile = this.dungeon.getTile(checkX, checkY);
                if (tile.type === 'floor' || (tile.type === 'door' && tile.doorState === 'open')) {
                    cardinalWalkable++;
                }
            }
        }
        
        // True dead-end has exactly 1 cardinal exit
        if (cardinalWalkable !== 1) {
            return false;
        }
        
        // Additional check: ensure diagonals are mostly blocked
        const diagonalDirections = [
            [-1, -1], [1, -1], [-1, 1], [1, 1] // NW, NE, SW, SE
        ];
        
        let diagonalBlocked = 0;
        
        for (const [dx, dy] of diagonalDirections) {
            const checkX = x + dx;
            const checkY = y + dy;
            
            if (!this.dungeon.isInBounds(checkX, checkY) || 
                this.dungeon.getTile(checkX, checkY).type === 'wall') {
                diagonalBlocked++;
            }
        }
        
        // At least 3 diagonals should be blocked for a true dead-end
        return diagonalBlocked >= 3;
    }
    
    /**
     * Check if position is in a corner (diagonally enclosed)
     */
    isCornerPosition(x, y) {
        // First check if we're in a room
        if (!this.isInAnyRoom(x, y)) {
            return false;
        }
        
        // Check cardinal directions
        const cardinalDirs = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N, E, S, W
        let cardinalWalls = 0;
        
        for (const [dx, dy] of cardinalDirs) {
            const checkX = x + dx;
            const checkY = y + dy;
            
            if (!this.dungeon.isInBounds(checkX, checkY) || 
                this.dungeon.getTile(checkX, checkY).type === 'wall') {
                cardinalWalls++;
            }
        }
        
        // Corner position has exactly 2 adjacent walls in cardinal directions
        // forming an L-shape (e.g., N and E walls, or S and W walls)
        if (cardinalWalls !== 2) {
            return false;
        }
        
        // Check if the two walls are adjacent (not opposite)
        const north = !this.dungeon.isInBounds(x, y-1) || this.dungeon.getTile(x, y-1).type === 'wall';
        const south = !this.dungeon.isInBounds(x, y+1) || this.dungeon.getTile(x, y+1).type === 'wall';
        const east = !this.dungeon.isInBounds(x+1, y) || this.dungeon.getTile(x+1, y).type === 'wall';
        const west = !this.dungeon.isInBounds(x-1, y) || this.dungeon.getTile(x-1, y).type === 'wall';
        
        // True corners have adjacent walls, not opposite walls
        return (north && east) || (north && west) || (south && east) || (south && west);
    }
    
    /**
     * Check if position is a hidden alcove (small recessed area)
     */
    isHiddenAlcove(x, y) {
        // Alcoves are typically small side areas off corridors or rooms
        // Not in the main path, with limited access
        
        const cardinalDirections = [
            [0, -1], [1, 0], [0, 1], [-1, 0] // N, E, S, W
        ];
        
        let wallCount = 0;
        let openDirections = [];
        
        for (let i = 0; i < cardinalDirections.length; i++) {
            const [dx, dy] = cardinalDirections[i];
            const checkX = x + dx;
            const checkY = y + dy;
            
            if (!this.dungeon.isInBounds(checkX, checkY) || 
                this.dungeon.getTile(checkX, checkY).type === 'wall') {
                wallCount++;
            } else if (this.dungeon.getTile(checkX, checkY).type === 'floor') {
                openDirections.push([dx, dy]);
            }
        }
        
        // Alcove has exactly 3 walls (one opening)
        if (wallCount !== 3 || openDirections.length !== 1) {
            return false;
        }
        
        // Check if the open direction leads to a larger space (not another narrow passage)
        const [openDx, openDy] = openDirections[0];
        const beyondX = x + openDx * 2;
        const beyondY = y + openDy * 2;
        
        if (this.dungeon.isInBounds(beyondX, beyondY)) {
            // Count open spaces around the entrance
            let entranceOpenCount = 0;
            for (const [dx, dy] of cardinalDirections) {
                const checkX = x + openDx + dx;
                const checkY = y + openDy + dy;
                if (this.dungeon.isInBounds(checkX, checkY) && 
                    this.dungeon.getTile(checkX, checkY).type === 'floor') {
                    entranceOpenCount++;
                }
            }
            
            // True alcove if entrance leads to wider area (3+ open tiles)
            return entranceOpenCount >= 3;
        }
        
        return true;
    }
    
    /**
     * Check if position is near the center of a room
     */
    isRoomCenter(x, y) {
        for (const room of this.dungeon.rooms) {
            const centerX = room.x + Math.floor(room.width / 2);
            const centerY = room.y + Math.floor(room.height / 2);
            
            // Within 2 tiles of room center
            const distance = Math.abs(x - centerX) + Math.abs(y - centerY);
            if (distance <= 2 && this.isInRoom(x, y, room)) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Check if position is at a corridor junction (3+ adjacent floors with different directions)
     */
    isCorridorJunction(x, y) {
        // Must not be in a room
        if (this.isInAnyRoom(x, y)) return false;
        
        const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N, E, S, W
        let floorDirections = [];
        
        for (let i = 0; i < directions.length; i++) {
            const [dx, dy] = directions[i];
            const checkX = x + dx;
            const checkY = y + dy;
            
            if (this.dungeon.isInBounds(checkX, checkY)) {
                const tile = this.dungeon.getTile(checkX, checkY);
                if (tile.type === 'floor' || tile.type === 'door') {
                    floorDirections.push(i);
                }
            }
        }
        
        // True junction: 3+ exits, or T-junction (3 exits)
        if (floorDirections.length >= 3) {
            // Additional check: not just a wide corridor
            // If we have opposite directions (N-S or E-W), check if it's a real junction
            const hasNS = floorDirections.includes(0) && floorDirections.includes(2);
            const hasEW = floorDirections.includes(1) && floorDirections.includes(3);
            
            // Real junction if we have perpendicular paths
            return (hasNS && (floorDirections.includes(1) || floorDirections.includes(3))) ||
                   (hasEW && (floorDirections.includes(0) || floorDirections.includes(2)));
        }
        
        return false;
    }
    
    /**
     * Count adjacent floor tiles (4-directional)
     */
    countAdjacentFloors(x, y) {
        const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        let count = 0;
        
        for (const [dx, dy] of directions) {
            const checkX = x + dx;
            const checkY = y + dy;
            
            if (this.dungeon.isInBounds(checkX, checkY)) {
                const tile = this.dungeon.getTile(checkX, checkY);
                if (tile.type === 'floor') {
                    count++;
                }
            }
        }
        
        return count;
    }
    
    /**
     * Count nearby wall tiles (8-directional)
     */
    countNearbyWalls(x, y) {
        const directions = [
            [-1, -1], [0, -1], [1, -1],  // NW, N, NE
            [-1,  0],          [1,  0],  // W,     E
            [-1,  1], [0,  1], [1,  1]   // SW, S, SE
        ];
        
        let count = 0;
        for (const [dx, dy] of directions) {
            const checkX = x + dx;
            const checkY = y + dy;
            
            if (!this.dungeon.isInBounds(checkX, checkY)) {
                count++; // Out of bounds counts as wall
                continue;
            }
            
            const tile = this.dungeon.getTile(checkX, checkY);
            if (tile.type === 'wall') {
                count++;
            }
        }
        
        return count;
    }
    
    /**
     * Check if position is inside a specific room
     */
    isInRoom(x, y, room) {
        return x >= room.x && x < room.x + room.width &&
               y >= room.y && y < room.y + room.height;
    }
    
    /**
     * Check if position is inside any room
     */
    isInAnyRoom(x, y) {
        return this.dungeon.rooms.some(room => this.isInRoom(x, y, room));
    }
    
    /**
     * Weighted random selection from positions array
     */
    weightedRandomSelect(positions) {
        const totalWeight = positions.reduce((sum, pos) => sum + pos.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const position of positions) {
            random -= position.weight;
            if (random <= 0) {
                return { x: position.x, y: position.y };
            }
        }
        
        // Fallback to last position
        return positions[positions.length - 1];
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
            'food': 30,     // Most common (30%)
            'potion': 20,   // Common (20%)
            'weapon': 12,   // Uncommon (12%)
            'armor': 12,    // Uncommon (12%)
            'shield': 8,    // Rare (8%)
            'helmet': 6,    // Rare (6%)
            'gloves': 5,    // Very rare (5%)
            'boots': 4,     // Very rare (4%)
            'ring': 2,      // Ultra rare (2%)
            'amulet': 1     // Ultra rare (1%)
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
                    case 'helmet':
                        return this.createRandomHelmet(level);
                    case 'gloves':
                        return this.createRandomGloves(level);
                    case 'boots':
                        return this.createRandomBoots(level);
                    case 'ring':
                        return this.createRandomRing(level);
                    case 'amulet':
                        return this.createRandomAmulet(level);
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
    
                return null;
            }
            
            const weaponKey = weapons[Math.floor(Math.random() * weapons.length)];
            
            // Higher level = better enchantment chance
            const enchantmentChance = Math.min(0.3 + (level * 0.1), 0.7);
            const enchantment = Math.random() < enchantmentChance ? 
                Math.floor(Math.random() * Math.min(3, Math.floor(level / 2) + 1)) : 0;
            
            const weapon = EquipmentManager.createEquipment('weapons', weaponKey, enchantment);
            if (!weapon) {
    
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
    
                return null;
            }
            
            const armorKey = armors[Math.floor(Math.random() * armors.length)];
            
            const enchantmentChance = Math.min(0.2 + (level * 0.08), 0.6);
            const enchantment = Math.random() < enchantmentChance ? 
                Math.floor(Math.random() * Math.min(2, Math.floor(level / 3) + 1)) : 0;
            
            const armor = EquipmentManager.createEquipment('armor', armorKey, enchantment);
            if (!armor) {
    
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
    
                return null;
            }
            
            const shieldKey = shields[Math.floor(Math.random() * shields.length)];
            
            const enchantmentChance = Math.min(0.2 + (level * 0.08), 0.6);
            const enchantment = Math.random() < enchantmentChance ? 
                Math.floor(Math.random() * Math.min(2, Math.floor(level / 3) + 1)) : 0;
            
            const shield = EquipmentManager.createEquipment('shields', shieldKey, enchantment);
            if (!shield) {
    
            }
            return shield;
        } catch (error) {
            console.error('Error creating random shield:', error);
            return null;
        }
    }
    
    /**
     * Create random helmet based on level
     */
    createRandomHelmet(level) {
        try {
            const helmets = Object.keys(EQUIPMENT_TYPES.helmets);
            if (helmets.length === 0) {
                console.warn('No helmets found in EQUIPMENT_TYPES');
                return null;
            }
            
            const helmetKey = helmets[Math.floor(Math.random() * helmets.length)];
            
            const enchantmentChance = Math.min(0.15 + (level * 0.06), 0.5);
            const enchantment = Math.random() < enchantmentChance ? 
                Math.floor(Math.random() * Math.min(2, Math.floor(level / 4) + 1)) : 0;
            
            const helmet = EquipmentManager.createEquipment('helmets', helmetKey, enchantment);
            if (!helmet) {
                console.warn(`Failed to create helmet: ${helmetKey}`);
            }
            return helmet;
        } catch (error) {
            console.error('Error creating random helmet:', error);
            return null;
        }
    }
    
    /**
     * Create random gloves based on level
     */
    createRandomGloves(level) {
        try {
            const gloves = Object.keys(EQUIPMENT_TYPES.gloves);
            if (gloves.length === 0) {
                console.warn('No gloves found in EQUIPMENT_TYPES');
                return null;
            }
            
            const glovesKey = gloves[Math.floor(Math.random() * gloves.length)];
            
            const enchantmentChance = Math.min(0.15 + (level * 0.06), 0.5);
            const enchantment = Math.random() < enchantmentChance ? 
                Math.floor(Math.random() * Math.min(2, Math.floor(level / 4) + 1)) : 0;
            
            const glovesItem = EquipmentManager.createEquipment('gloves', glovesKey, enchantment);
            if (!glovesItem) {
                console.warn(`Failed to create gloves: ${glovesKey}`);
            }
            return glovesItem;
        } catch (error) {
            console.error('Error creating random gloves:', error);
            return null;
        }
    }
    
    /**
     * Create random boots based on level
     */
    createRandomBoots(level) {
        try {
            const boots = Object.keys(EQUIPMENT_TYPES.boots);
            if (boots.length === 0) {
                console.warn('No boots found in EQUIPMENT_TYPES');
                return null;
            }
            
            const bootsKey = boots[Math.floor(Math.random() * boots.length)];
            
            const enchantmentChance = Math.min(0.15 + (level * 0.06), 0.5);
            const enchantment = Math.random() < enchantmentChance ? 
                Math.floor(Math.random() * Math.min(2, Math.floor(level / 4) + 1)) : 0;
            
            const bootsItem = EquipmentManager.createEquipment('boots', bootsKey, enchantment);
            if (!bootsItem) {
                console.warn(`Failed to create boots: ${bootsKey}`);
            }
            return bootsItem;
        } catch (error) {
            console.error('Error creating random boots:', error);
            return null;
        }
    }
    
    /**
     * Create random ring based on level
     */
    createRandomRing(level) {
        try {
            const rings = Object.keys(EQUIPMENT_TYPES.rings);
            if (rings.length === 0) {
                console.warn('No rings found in EQUIPMENT_TYPES');
                return null;
            }
            
            const ringKey = rings[Math.floor(Math.random() * rings.length)];
            
            // Rings are more likely to be enchanted (magical items)
            const enchantmentChance = Math.min(0.3 + (level * 0.1), 0.8);
            const enchantment = Math.random() < enchantmentChance ? 
                Math.floor(Math.random() * Math.min(3, Math.floor(level / 3) + 1)) : 0;
            
            const ring = EquipmentManager.createEquipment('rings', ringKey, enchantment);
            if (!ring) {
                console.warn(`Failed to create ring: ${ringKey}`);
            }
            return ring;
        } catch (error) {
            console.error('Error creating random ring:', error);
            return null;
        }
    }
    
    /**
     * Create random amulet based on level
     */
    createRandomAmulet(level) {
        try {
            const amulets = Object.keys(EQUIPMENT_TYPES.amulets);
            if (amulets.length === 0) {
                console.warn('No amulets found in EQUIPMENT_TYPES');
                return null;
            }
            
            const amuletKey = amulets[Math.floor(Math.random() * amulets.length)];
            
            // Amulets are more likely to be enchanted (magical items)
            const enchantmentChance = Math.min(0.4 + (level * 0.12), 0.9);
            const enchantment = Math.random() < enchantmentChance ? 
                Math.floor(Math.random() * Math.min(3, Math.floor(level / 2) + 1)) : 0;
            
            const amulet = EquipmentManager.createEquipment('amulets', amuletKey, enchantment);
            if (!amulet) {
                console.warn(`Failed to create amulet: ${amuletKey}`);
            }
            return amulet;
        } catch (error) {
            console.error('Error creating random amulet:', error);
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
                console.warn(`Failed to create potion: ${selectedPotion}`);
            } else {
                // Debug: Verify potion has healDice
                if (!potion.healDice) {
                    console.warn(`Potion ${selectedPotion} missing healDice:`, potion);
                } else {
                    console.log(`Potion ${selectedPotion} created with healDice: ${potion.healDice}`);
                }
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
    
                return null;
            }
            
            const foodKey = foods[Math.floor(Math.random() * foods.length)];
            const food = this.createFood(foodKey);
            if (!food) {
    
            }
            return food;
        } catch (error) {
            console.error('Error creating random food:', error);
            return null;
        }
    }
} 