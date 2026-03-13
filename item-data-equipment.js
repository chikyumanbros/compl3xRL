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
            category: EQUIPMENT_CATEGORIES.TWO_HANDED_WEAPON,
            weaponType: WEAPON_TYPES.HAMMER,
            damage: 4,
            weaponDamage: 8, // d8
            penetration: 3, // High armor penetration
            weight: 5,
            value: 180,
            material: 'steel',
            symbol: 'T',
            color: '#E0E0E0',
            description: 'A two-handed steel war hammer. Designed to crush heavy armor. (1d8+4 damage, AP 3)'
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
            elementalResistances: {
                fire: 15,        // Steel provides some heat resistance
                cold: 10         // Metal retains some body heat
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
            description: 'A wooden torch for illumination.',
            // Total burn time in player turns when equipped
            burnTime: 1500,
            // Default remaining burn time; actual runtime counter is stored on the instance
            remainingBurnTime: 1500,
            // Extra sight radius provided while burning
            lightRadius: 5
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
            elementalResistances: {
                fire: 30,        // Mithril legendary fire resistance
                lightning: 25,   // Conducts but resists
                acid: 40         // Highly resistant to corrosion
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
            elementalResistances: {
                fire: 50,        // Ruby's fire affinity
                lightning: 15    // Minor electrical resistance
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
