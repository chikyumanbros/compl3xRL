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
        
        // Elemental damage resistances (Equipment-specific)
        this.elementalResistances = data.elementalResistances || {}; // e.g., { fire: 25, cold: 10 }
        
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
            'fire': 2.25,        // Heat/smoldering rapidly degrades materials
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

