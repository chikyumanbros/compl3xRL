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
