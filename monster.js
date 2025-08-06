/**
 * Monster system for Roguelike Game
 * Basic combat-capable monsters
 */

class Monster {
    constructor(x, y, type = 'goblin') {
        this.x = x;
        this.y = y;
        this.type = type;
        
        // Initialize stats based on monster type
        this.initializeByType(type);
        
        this.hp = this.maxHp;
        this.isAlive = true;
        
        // AI and perception state
        this.lastSeenPlayerX = null;
        this.lastSeenPlayerY = null;
        this.turnsWithoutSeeingPlayer = 0;
        this.sightRange = 8; // Default sight range
        this.giveUpTurns = 5; // Stop searching after this many turns without sight
        
        // Sleeping state (classic roguelike feature)
        this.isAsleep = true; // Most monsters start asleep
        this.wakeUpDistance = 1; // Wake up when player is adjacent (classic behavior)
        this.hasEverWokenUp = false; // Track if monster has been awakened
        this.sleepDepth = 'normal'; // 'light', 'normal', 'deep' - affects wake up probability
        this.justWokeUp = false; // Prevent action on wake-up turn (classic roguelike behavior)
        
        // Speed system (classic roguelike energy system)
        this.speed = 100; // Base speed (100 = normal speed)
        this.energy = 0; // Current energy points
        this.energyToAct = 100; // Energy needed to take an action
        
        // Intelligence and fleeing system (Angband-style)
        this.intelligence = 'normal'; // 'mindless', 'animal', 'normal', 'smart', 'genius'
        this.isFleeing = false; // Current fleeing state
        this.fleeThreshold = 0.25; // HP percentage when fleeing starts (25% default)
        
        // Fleeing personality system (individual monster characteristics)
        this.fleePersonality = 'normal'; // 'cowardly', 'brave', 'cunning', 'panicked', 'persistent', 'reckless'
        this.fleeDuration = 10; // Base turns to continue fleeing
        this.fleeStamina = 1.0; // Stamina multiplier (lower = tires faster)
        this.fleeStyle = 'direct'; // 'direct', 'evasive', 'random'
        this.returnCourage = 0.5; // Probability to stop fleeing each turn (0.0-1.0)
        this.fleeTimer = 0; // Current fleeing duration
    }
    
    /**
     * Initialize monster stats by type (Classic Roguelike - Depth-based)
     */
    initializeByType(type) {
        const monsterTypes = {
            // === EARLY DEPTHS (1-3) ===
            'newt': {
                name: 'Newt',
                symbol: 'n',
                color: 'monster',
                maxHp: 3,
                toHit: 1,
                armorClass: 14,
                damage: 0,
                weaponDamage: 2, // d2
                protection: 0, // No natural armor
                penetration: 0, // Bite/natural attack
                exp: 1,
                minDepth: 1,
                maxDepth: 3
            },
            'bat': {
                name: 'Bat',
                symbol: 'b',
                color: 'monster',
                maxHp: 4,
                toHit: 3,
                armorClass: 12,
                damage: 0,
                weaponDamage: 2, // d2
                protection: 0, // No natural armor
                penetration: 0, // Bite/natural attack
                exp: 1,
                minDepth: 1,
                maxDepth: 4
            },
            'rat': {
                name: 'Giant Rat',
                symbol: 'r',
                color: 'monster',
                maxHp: 5,
                toHit: 2,
                armorClass: 13,
                damage: 0,
                weaponDamage: 3, // d3
                protection: 0, // No natural armor
                penetration: 0, // Bite/natural attack
                exp: 1,
                minDepth: 1,
                maxDepth: 3
            },
            'spider': {
                name: 'Spider',
                symbol: 's',
                color: 'monster',
                maxHp: 6,
                toHit: 3,
                armorClass: 13,
                damage: 0,
                weaponDamage: 3, // d3
                protection: 1, // Chitinous shell
                penetration: 1, // Sharp fangs
                exp: 2,
                minDepth: 1,
                maxDepth: 4
            },
            'kobold': {
                name: 'Kobold',
                symbol: 'k',
                color: 'monster',
                maxHp: 8,
                toHit: 4,
                armorClass: 12,
                damage: 1,
                weaponDamage: 3, // d3
                protection: 1, // Leather armor
                penetration: 1, // Short sword
                exp: 3,
                minDepth: 1,
                maxDepth: 5
            },
            'ant': {
                name: 'Giant Ant',
                symbol: 'a',
                color: 'monster',
                maxHp: 5,
                toHit: 3,
                armorClass: 13,
                damage: 0,
                weaponDamage: 2, // d2
                penetration: 0, // Mandibles/natural attack
                exp: 2,
                minDepth: 1,
                maxDepth: 4
            },
            'centipede': {
                name: 'Centipede',
                symbol: 'c',
                color: 'monster',
                maxHp: 4,
                toHit: 4,
                armorClass: 11,
                damage: 0,
                weaponDamage: 2, // d2 + poison
                penetration: 1, // Venomous fangs
                exp: 2,
                minDepth: 1,
                maxDepth: 5
            },
            'jackal': {
                name: 'Jackal',
                symbol: 'd',
                color: 'monster',
                maxHp: 5,
                toHit: 4,
                armorClass: 12,
                damage: 0,
                weaponDamage: 3, // d3
                penetration: 0, // Bite/natural attack
                exp: 2,
                minDepth: 1,
                maxDepth: 4
            },
            'gecko': {
                name: 'Gecko',
                symbol: ':',
                color: 'monster',
                maxHp: 3,
                toHit: 2,
                armorClass: 13,
                damage: 0,
                weaponDamage: 2, // d2
                penetration: 0, // Bite/natural attack
                exp: 1,
                minDepth: 1,
                maxDepth: 3
            },
            
            // === MID-EARLY DEPTHS (2-5) ===
            'goblin': {
                name: 'Goblin',
                symbol: 'g',
                color: 'monster',
                maxHp: 10,
                toHit: 5,
                armorClass: 11,
                damage: 1,
                weaponDamage: 4, // d4
                protection: 1, // Leather armor
                penetration: 1, // Short sword
                exp: 4,
                minDepth: 2,
                maxDepth: 6
            },
            'orc': {
                name: 'Orc Warrior',
                symbol: 'o',
                color: 'monster',
                maxHp: 12,
                toHit: 6,
                armorClass: 10,
                damage: 2,
                weaponDamage: 4, // d4
                protection: 2, // Studded leather + tough skin
                penetration: 2, // Battle axe
                exp: 8,
                minDepth: 2,
                maxDepth: 7
            },
            'wolf': {
                name: 'Wolf',
                symbol: 'w',
                color: 'monster',
                maxHp: 10,
                toHit: 7,
                armorClass: 11,
                damage: 1,
                weaponDamage: 4, // d4 bite
                penetration: 0, // Bite/natural attack
                exp: 6,
                minDepth: 2,
                maxDepth: 6
            },
            'skeleton': {
                name: 'Skeleton',
                symbol: 'Z',
                color: 'monster',
                maxHp: 8,
                toHit: 6,
                armorClass: 12,
                damage: 1,
                weaponDamage: 6, // d6 weapon
                penetration: 1, // Basic weapon
                exp: 7,
                minDepth: 3,
                maxDepth: 8
            },
            'zombie': {
                name: 'Zombie',
                symbol: 'z',
                color: 'monster',
                maxHp: 15,
                toHit: 4,
                armorClass: 13,
                damage: 1,
                weaponDamage: 4, // d4
                penetration: 0, // Claws/natural attack
                exp: 5,
                minDepth: 2,
                maxDepth: 7
            },
            'dwarf': {
                name: 'Dwarf',
                symbol: 'h',
                color: 'monster',
                maxHp: 12,
                toHit: 7,
                armorClass: 9,
                damage: 2,
                weaponDamage: 6, // d6 axe
                penetration: 2, // Quality weapon (axe)
                exp: 10,
                minDepth: 3,
                maxDepth: 8
            },
            'elf': {
                name: 'Elf',
                symbol: 'e',
                color: 'monster',
                maxHp: 8,
                toHit: 8,
                armorClass: 10,
                damage: 2,
                weaponDamage: 6, // d6 bow
                penetration: 2, // Quality weapon (bow)
                exp: 9,
                minDepth: 3,
                maxDepth: 8
            },
            'floating_eye': {
                name: 'Floating Eye',
                symbol: 'E',
                color: 'monster',
                maxHp: 6,
                toHit: 2,
                armorClass: 14,
                damage: 0,
                weaponDamage: 1, // paralysis
                penetration: 0, // Paralysis gaze (special)
                exp: 4,
                minDepth: 2,
                maxDepth: 6
            },
            'leprechaun': {
                name: 'Leprechaun',
                symbol: 'l',
                color: 'monster',
                maxHp: 6,
                toHit: 6,
                armorClass: 11,
                damage: 1,
                weaponDamage: 3, // d3 + steal
                penetration: 0, // Stealing touch (special)
                exp: 6,
                minDepth: 3,
                maxDepth: 7
            },
            'snake': {
                name: 'Snake',
                symbol: 'S',
                color: 'monster',
                maxHp: 6,
                toHit: 5,
                armorClass: 12,
                damage: 0,
                weaponDamage: 3, // d3 + poison
                penetration: 1, // Venomous fangs
                exp: 4,
                minDepth: 2,
                maxDepth: 6
            },
            
            // === MID DEPTHS (4-8) ===
            'lizardman': {
                name: 'Lizardman',
                symbol: 'L',
                color: 'monster',
                maxHp: 16,
                toHit: 8,
                armorClass: 9,
                damage: 2,
                weaponDamage: 6, // d6
                penetration: 2, // Quality weapon (spear)
                exp: 12,
                minDepth: 4,
                maxDepth: 9
            },
            'hobgoblin': {
                name: 'Hobgoblin',
                symbol: 'H',
                color: 'monster',
                maxHp: 14,
                toHit: 9,
                armorClass: 8,
                damage: 3,
                weaponDamage: 6, // d6
                penetration: 1, // Basic weapon (sword)
                exp: 15,
                minDepth: 4,
                maxDepth: 10
            },
            'gnoll': {
                name: 'Gnoll',
                symbol: 'G',
                color: 'monster',
                maxHp: 18,
                toHit: 10,
                armorClass: 9,
                damage: 3,
                weaponDamage: 8, // d8
                penetration: 2, // Quality weapon (polearm)
                exp: 18,
                minDepth: 5,
                maxDepth: 11
            },
            'bear': {
                name: 'Brown Bear',
                symbol: 'B',
                color: 'monster',
                maxHp: 24,
                toHit: 11,
                armorClass: 8,
                damage: 4,
                weaponDamage: 6, // d6 claw
                penetration: 0, // Claws/natural attack
                exp: 22,
                minDepth: 5,
                maxDepth: 12
            },
            'centaur': {
                name: 'Centaur',
                symbol: 'C',
                color: 'monster',
                maxHp: 20,
                toHit: 12,
                armorClass: 7,
                damage: 4,
                weaponDamage: 8, // d8 bow
                penetration: 2, // Quality weapon (bow)
                exp: 20,
                minDepth: 5,
                maxDepth: 11
            },
            'wraith': {
                name: 'Wraith',
                symbol: 'W',
                color: 'monster',
                maxHp: 8,
                toHit: 11,
                armorClass: 6,
                damage: 3,
                weaponDamage: 4, // d4 + drain
                penetration: 1, // Life drain touch
                exp: 25,
                minDepth: 6,
                maxDepth: 12
            },
            'nymph': {
                name: 'Nymph',
                symbol: 'N',
                color: 'monster',
                maxHp: 6,
                toHit: 9,
                armorClass: 11,
                damage: 2,
                weaponDamage: 3, // d3 + charm
                penetration: 0, // Charm (special)
                exp: 16,
                minDepth: 4,
                maxDepth: 10
            },
            'unicorn': {
                name: 'Unicorn',
                symbol: 'u',
                color: 'monster',
                maxHp: 14,
                toHit: 13,
                armorClass: 6,
                damage: 5,
                weaponDamage: 8, // d8 horn
                penetration: 2, // Sharp magical horn
                exp: 28,
                minDepth: 6,
                maxDepth: 13
            },
            'stalker': {
                name: 'Stalker',
                symbol: 'I',
                color: 'monster',
                maxHp: 9,
                toHit: 12,
                armorClass: 8,
                damage: 4,
                weaponDamage: 6, // d6 invisible
                penetration: 1, // Invisible attack
                exp: 24,
                minDepth: 6,
                maxDepth: 12
            },
            'yeti': {
                name: 'Yeti',
                symbol: 'Y',
                color: 'monster',
                maxHp: 11,
                toHit: 10,
                armorClass: 9,
                damage: 4,
                weaponDamage: 6, // d6 freeze
                penetration: 0, // Claws/natural attack
                exp: 21,
                minDepth: 5,
                maxDepth: 11
            },
            
            // === LATE DEPTHS (7-12) ===
            'ogre': {
                name: 'Ogre',
                symbol: 'O',
                color: 'monster',
                maxHp: 30,
                toHit: 12,
                armorClass: 7,
                damage: 5,
                weaponDamage: 8, // d8 club
                protection: 3, // Thick hide + chain mail
                penetration: 3, // Massive club
                exp: 28,
                minDepth: 7,
                maxDepth: 15
            },
            'troll': {
                name: 'Troll',
                symbol: 'T',
                color: 'monster',
                maxHp: 35,
                toHit: 14,
                armorClass: 6,
                damage: 6,
                weaponDamage: 6, // d6 claw (multiple attacks)
                protection: 3, // Thick regenerating hide
                penetration: 2, // Sharp claws
                exp: 35,
                minDepth: 8,
                maxDepth: 18
            },
            'minotaur': {
                name: 'Minotaur',
                symbol: 'M',
                color: 'monster',
                maxHp: 40,
                toHit: 15,
                armorClass: 5,
                damage: 7,
                weaponDamage: 8, // d8 axe
                protection: 4, // Heavy plate mail
                penetration: 3, // Great axe
                exp: 42,
                minDepth: 9,
                maxDepth: 20
            },
            'vampire': {
                name: 'Vampire',
                symbol: 'V',
                color: 'monster',
                maxHp: 32,
                toHit: 16,
                armorClass: 4,
                damage: 6,
                weaponDamage: 6, // d6 + drain
                penetration: 2, // Life drain bite
                exp: 45,
                minDepth: 8,
                maxDepth: 18
            },
            'xorn': {
                name: 'Xorn',
                symbol: 'X',
                color: 'monster',
                maxHp: 35,
                toHit: 13,
                armorClass: 5,
                damage: 7,
                weaponDamage: 8, // d8 claw
                penetration: 2, // Sharp stone claws
                exp: 38,
                minDepth: 8,
                maxDepth: 16
            },
            'rust_monster': {
                name: 'Rust Monster',
                symbol: 'R',
                color: 'monster',
                maxHp: 25,
                toHit: 10,
                armorClass: 8,
                damage: 3,
                weaponDamage: 4, // d4 + rust
                penetration: 0, // Rusting touch (special)
                exp: 30,
                minDepth: 7,
                maxDepth: 14
            },
            'umber_hulk': {
                name: 'Umber Hulk',
                symbol: 'U',
                color: 'monster',
                maxHp: 45,
                toHit: 14,
                armorClass: 4,
                damage: 8,
                weaponDamage: 10, // d10 + confuse
                penetration: 3, // Powerful mandibles
                exp: 50,
                minDepth: 9,
                maxDepth: 18
            },
            'invisible_stalker': {
                name: 'Invisible Stalker',
                symbol: ' ',
                color: 'monster',
                maxHp: 14,
                toHit: 15,
                armorClass: 5,
                damage: 6,
                weaponDamage: 8, // d8 invisible
                penetration: 2, // Invisible surprise attack
                exp: 40,
                minDepth: 8,
                maxDepth: 16
            },
            'ettin': {
                name: 'Ettin',
                symbol: '2',
                color: 'monster',
                maxHp: 20,
                toHit: 16,
                armorClass: 6,
                damage: 8,
                weaponDamage: 10, // d10 two heads
                penetration: 3, // Heavy two-handed weapons
                exp: 48,
                minDepth: 9,
                maxDepth: 17
            },
            
            // === DEEP DEPTHS (10-15) ===
            'wyvern': {
                name: 'Wyvern',
                symbol: 'w',
                color: 'monster',
                maxHp: 50,
                toHit: 16,
                armorClass: 4,
                damage: 8,
                weaponDamage: 10, // d10 bite
                penetration: 3, // Venomous fangs
                exp: 55,
                minDepth: 10,
                maxDepth: 25
            },
            'giant': {
                name: 'Hill Giant',
                symbol: 'P',
                color: 'monster',
                maxHp: 60,
                toHit: 18,
                armorClass: 3,
                damage: 10,
                weaponDamage: 12, // d12 boulder
                penetration: 4, // Massive boulder
                exp: 70,
                minDepth: 12,
                maxDepth: 30
            },
            'dragon': {
                name: 'Young Dragon',
                symbol: 'D',
                color: 'monster',
                maxHp: 80,
                toHit: 20,
                armorClass: 2,
                damage: 12,
                weaponDamage: 12, // d12 bite
                penetration: 4, // Powerful dragon fangs
                exp: 100,
                minDepth: 15,
                maxDepth: 99
            },
            'lich': {
                name: 'Lich',
                symbol: 'L',
                color: 'monster',
                maxHp: 70,
                toHit: 19,
                armorClass: 2,
                damage: 10,
                weaponDamage: 8, // d8 + spells
                penetration: 4, // Magical weapons + spells
                exp: 90,
                minDepth: 13,
                maxDepth: 99
            },
            'balrog': {
                name: 'Balrog',
                symbol: '&',
                color: 'monster',
                maxHp: 90,
                toHit: 21,
                armorClass: 1,
                damage: 14,
                weaponDamage: 12, // d12 whip
                penetration: 4, // Flaming whip
                exp: 120,
                minDepth: 16,
                maxDepth: 99
            },
            'jabberwock': {
                name: 'Jabberwock',
                symbol: 'J',
                color: 'monster',
                maxHp: 75,
                toHit: 20,
                armorClass: 3,
                damage: 12,
                weaponDamage: 10, // d10 + special
                penetration: 3, // Legendary claws
                exp: 110,
                minDepth: 14,
                maxDepth: 99
            },
            'medusa': {
                name: 'Medusa',
                symbol: 'M',
                color: 'monster',
                maxHp: 55,
                toHit: 17,
                armorClass: 4,
                damage: 8,
                weaponDamage: 6, // d6 + petrify
                penetration: 2, // Petrifying gaze + claws
                exp: 75,
                minDepth: 11,
                maxDepth: 20
            },
            'sphinx': {
                name: 'Sphinx',
                symbol: 'H',
                color: 'monster',
                maxHp: 65,
                toHit: 18,
                armorClass: 3,
                damage: 9,
                weaponDamage: 8, // d8 + riddle
                penetration: 2, // Sharp claws + riddle magic
                exp: 85,
                minDepth: 12,
                maxDepth: 25
            },
            'purple_worm': {
                name: 'Purple Worm',
                symbol: 'p',
                color: 'monster',
                maxHp: 100,
                toHit: 19,
                armorClass: 2,
                damage: 15,
                weaponDamage: 12, // d12 swallow
                penetration: 5, // Massive crushing maw
                exp: 140,
                minDepth: 17,
                maxDepth: 99
            },
            'frost_giant': {
                name: 'Frost Giant',
                symbol: 'F',
                color: 'monster',
                maxHp: 85,
                toHit: 20,
                armorClass: 2,
                damage: 13,
                weaponDamage: 12, // d12 ice
                penetration: 4, // Massive ice weapons
                exp: 115,
                minDepth: 15,
                maxDepth: 99
            }
        };
        
        const stats = monsterTypes[type] || monsterTypes['kobold'];
        
        // Set monster properties
        this.name = stats.name;
        this.symbol = stats.symbol;
        this.color = stats.color;
        this.maxHp = stats.maxHp;
        this.toHit = stats.toHit;
        this.armorClass = stats.armorClass;
        this.damage = stats.damage;
        this.weaponDamage = stats.weaponDamage;
        this.protection = stats.protection || 0; // Armor/natural protection
        this.penetration = stats.penetration || 0; // Weapon armor penetration
        this.expValue = stats.exp;
        this.minDepth = stats.minDepth;
        this.maxDepth = stats.maxDepth;
        
        // Apply pack-based difficulty adjustments for better balance
        this.applyPackDifficultyAdjustments(type);
        
        // Set sight range based on monster type (higher level monsters see further)
        if (stats.minDepth <= 2) {
            this.sightRange = 6; // Weak monsters have shorter sight
            this.sleepDepth = 'deep'; // Weak monsters sleep deeply
        } else if (stats.minDepth <= 5) {
            this.sightRange = 8; // Medium monsters have normal sight
            this.sleepDepth = 'normal'; // Medium monsters sleep normally
        } else if (stats.minDepth <= 8) {
            this.sightRange = 10; // Strong monsters have better sight
            this.sleepDepth = 'light'; // Strong monsters are light sleepers
        } else {
            this.sightRange = 12; // Boss-level monsters have excellent sight
            this.sleepDepth = 'light'; // Boss monsters are very alert
        }
        
        // Set speed based on monster type (classic roguelike speed system)
        this.speed = this.getMonsterSpeed(type, stats);
        
        // Set intelligence and flee threshold based on monster type
        this.setIntelligenceByType(type, stats);
        
        // Set fleeing personality based on monster type
        this.setFleePersonalityByType(type, stats);
        
        // Initialize status effect manager
        this.statusEffects = new StatusEffectManager(this);
        
        // Add base stats for saving throws
        this.constitution = 10 + Math.floor(stats.minDepth / 3); // Tougher monsters have better constitution
        this.wisdom = 10 + Math.floor(stats.minDepth / 5); // Smarter monsters have better wisdom
        this.strength = 10 + Math.floor(stats.minDepth / 4); // Stronger monsters have better strength
    }
    
    /**
     * Get monster speed based on type and stats
     */
    getMonsterSpeed(type, stats) {
        // Base speed for different categories
        let speed = 100; // Normal speed
        
        // Flying creatures are faster
        const fastFlyers = ['bat', 'hawk', 'eagle'];
        if (fastFlyers.includes(type)) {
            speed = 120; // 20% faster
        }
        
        // Small, quick creatures
        const quickCreatures = ['rat', 'gecko', 'newt'];
        if (quickCreatures.includes(type)) {
            speed = 110; // 10% faster
        }
        
        // Large, slow creatures
        const slowCreatures = ['bear', 'troll', 'giant'];
        if (slowCreatures.includes(type)) {
            speed = 80; // 20% slower
        }
        
        // Very large/powerful creatures are often slower
        if (stats.minDepth >= 8) {
            speed = Math.max(speed - 20, 60); // Powerful monsters are often slower
        }
        
        // Some specific adjustments
        switch (type) {
            case 'centipede':
                speed = 130; // Very fast
                break;
            case 'snake':
                speed = 115; // Quick strike
                break;
            case 'spider':
                speed = 105; // Slightly fast
                break;
            case 'zombie':
                speed = 70; // Slow shambling
                break;
            case 'skeleton':
                speed = 90; // Slightly slow
                break;
        }
        
        return speed;
    }
    
    /**
     * Set intelligence and flee behavior based on monster type
     */
    setIntelligenceByType(type, stats) {
        // Mindless creatures - never flee, fight to the death
        const mindless = ['ant', 'centipede', 'spider', 'floating_eye', 'rust_monster'];
        
        // Animal intelligence - flee when badly hurt
        const animals = ['bat', 'rat', 'gecko', 'jackal', 'wolf', 'bear', 'snake', 'wyvern', 'purple_worm'];
        
        // Normal intelligence - tactical fleeing
        const normal = ['kobold', 'goblin', 'orc', 'dwarf', 'elf', 'hobgoblin', 'gnoll', 'lizardman', 'centaur'];
        
        // Smart creatures - flee early when threatened
        const smart = ['ogre', 'troll', 'minotaur', 'vampire', 'umber_hulk', 'giant', 'ettin', 'medusa'];
        
        // Genius level - very strategic about fleeing
        const genius = ['dragon', 'lich', 'balrog', 'jabberwock', 'sphinx', 'frost_giant'];
        
        if (mindless.includes(type)) {
            this.intelligence = 'mindless';
            this.fleeThreshold = 0; // Never flee
        } else if (animals.includes(type)) {
            this.intelligence = 'animal';
            this.fleeThreshold = 0.2; // Flee at 20% HP
        } else if (normal.includes(type)) {
            this.intelligence = 'normal';
            this.fleeThreshold = 0.25; // Flee at 25% HP
        } else if (smart.includes(type)) {
            this.intelligence = 'smart';
            this.fleeThreshold = 0.35; // Flee at 35% HP
        } else if (genius.includes(type)) {
            this.intelligence = 'genius';
            this.fleeThreshold = 0.4; // Flee at 40% HP
        } else {
            // Default values
            this.intelligence = 'normal';
            this.fleeThreshold = 0.25;
        }
        
        // Some special cases
        if (type === 'skeleton' || type === 'zombie') {
            this.intelligence = 'mindless'; // Undead fight to destruction
            this.fleeThreshold = 0;
        } else if (type === 'leprechaun') {
            this.intelligence = 'smart'; // Clever and tricky
            this.fleeThreshold = 0.5; // Flee early at 50% HP
        }
    }
    
    /**
     * Check if monster should start fleeing based on HP and intelligence
     */
    checkFleeCondition() {
        if (this.intelligence === 'mindless' || this.fleeThreshold === 0) {
            return false; // Never flee
        }
        
        const hpRatio = this.hp / this.maxHp;
        
        // Start fleeing if HP drops below threshold
        if (hpRatio <= this.fleeThreshold && !this.isFleeing) {
            this.isFleeing = true;
            this.fleeTimer = 0; // Reset flee timer
            
            // Log flee message if player can see the monster
            if (window.game && window.game.fov && window.game.player) {
                const canSee = window.game.fov.canSee(
                    window.game.player.x, window.game.player.y,
                    this.x, this.y, 
                    window.game.player.sightRange || 8
                );
                
                if (canSee && window.game.renderer) {
                    const personalityMessages = this.getFleeMessage();
                    const message = personalityMessages[Math.floor(Math.random() * personalityMessages.length)];
                    window.game.renderer.addLogMessage(message);
                }
            }
            
            return true;
        }
        
        // If currently fleeing, check if should continue
        if (this.isFleeing) {
            this.fleeTimer++;
            
            // Check if exhausted (stamina affects duration)
            const adjustedDuration = this.fleeDuration * this.fleeStamina;
            const isExhausted = this.fleeTimer >= adjustedDuration;
            
            // Check courage to return to combat
            const courageCheck = Math.random() < this.returnCourage;
            
            // Stop fleeing if exhausted, courageous, or HP recovered significantly
            if (isExhausted || courageCheck || hpRatio > this.fleeThreshold + 0.15) {
                this.isFleeing = false;
                this.fleeTimer = 0;
                
                // Log return message if player can see
                if (window.game && window.game.fov && window.game.player) {
                    const canSee = window.game.fov.canSee(
                        window.game.player.x, window.game.player.y,
                        this.x, this.y, 
                        window.game.player.sightRange || 8
                    );
                    
                    if (canSee && window.game.renderer) {
                        const returnMessage = this.getReturnMessage(isExhausted, courageCheck);
                        window.game.renderer.addLogMessage(returnMessage);
                    }
                }
                
                return false;
            }
        }
        
        return this.isFleeing;
    }
    
    /**
     * Get personality-based flee messages
     */
    getFleeMessage() {
        switch (this.fleePersonality) {
            case 'cowardly':
                return [
                    `${this.name} squeaks in terror and flees!`,
                    `${this.name} whimpers and runs away in panic!`,
                    `${this.name} cowers and tries to escape!`
                ];
            case 'brave':
                return [
                    `${this.name} reluctantly retreats!`,
                    `${this.name} makes a tactical withdrawal!`,
                    `${this.name} pulls back, but looks ready to return!`
                ];
            case 'cunning':
                return [
                    `${this.name} strategically withdraws!`,
                    `${this.name} slips away cleverly!`,
                    `${this.name} makes a calculated retreat!`
                ];
            case 'panicked':
                return [
                    `${this.name} panics and flees wildly!`,
                    `${this.name} scurries away in confusion!`,
                    `${this.name} runs around frantically!`
                ];
            case 'persistent':
                return [
                    `${this.name} begins a long retreat!`,
                    `${this.name} starts fleeing steadily!`,
                    `${this.name} moves away with determination!`
                ];
            case 'reckless':
                return [
                    `${this.name} backs off momentarily!`,
                    `${this.name} makes a brief retreat!`,
                    `${this.name} steps back, snarling!`
                ];
            default:
                return [
                    `${this.name} looks terrified and tries to flee!`,
                    `${this.name} turns and runs away!`,
                    `${this.name} attempts to escape!`
                ];
        }
    }
    
    /**
     * Get personality-based return messages
     */
    getReturnMessage(exhausted, courageous) {
        if (exhausted) {
            switch (this.fleePersonality) {
                case 'cowardly':
                    return `${this.name} can't run any further and turns to fight!`;
                case 'persistent':
                    return `${this.name} finally stops running and faces you!`;
                default:
                    return `${this.name} is too tired to flee and turns around!`;
            }
        } else if (courageous) {
            switch (this.fleePersonality) {
                case 'brave':
                    return `${this.name} regains courage and charges back!`;
                case 'reckless':
                    return `${this.name} can't resist fighting and returns!`;
                case 'cunning':
                    return `${this.name} finds an opportunity and re-engages!`;
                default:
                    return `${this.name} decides to stand and fight!`;
            }
        } else {
            return `${this.name} stops fleeing and turns around!`;
        }
    }
    
    /**
     * Set fleeing personality based on monster type
     */
    setFleePersonalityByType(type, stats) {
        // Cowardly creatures - flee early, flee long, flee directly
        const cowardly = ['rat', 'gecko', 'goblin', 'newt'];
        
        // Brave creatures - flee reluctantly, return quickly
        const brave = ['dwarf', 'elf', 'minotaur', 'centaur', 'giant'];
        
        // Cunning creatures - strategic fleeing, evasive routes
        const cunning = ['kobold', 'leprechaun', 'dragon', 'lich', 'sphinx', 'vampire'];
        
        // Panicked creatures - random chaotic fleeing
        const panicked = ['ant', 'spider', 'centipede', 'floating_eye'];
        
        // Persistent creatures - long-distance fleeing, high stamina
        const persistent = ['wolf', 'bear', 'jackal', 'wyvern', 'purple_worm'];
        
        // Reckless creatures - flee briefly then return to fight
        const reckless = ['orc', 'troll', 'ogre', 'hobgoblin', 'gnoll', 'ettin'];
        
        if (cowardly.includes(type)) {
            this.fleePersonality = 'cowardly';
            this.fleeThreshold = Math.max(this.fleeThreshold - 0.05, 0.15); // Flee 5% earlier
            this.fleeDuration = 15; // Long fleeing
            this.fleeStamina = 0.8; // Tire quickly
            this.fleeStyle = 'direct'; // Run straight away
            this.returnCourage = 0.1; // Very low return chance
        } else if (brave.includes(type)) {
            this.fleePersonality = 'brave';
            this.fleeThreshold = Math.min(this.fleeThreshold + 0.1, 0.5); // Flee 10% later
            this.fleeDuration = 5; // Short fleeing
            this.fleeStamina = 1.5; // High stamina
            this.fleeStyle = 'direct'; // Direct but brief
            this.returnCourage = 0.8; // High return chance
        } else if (cunning.includes(type)) {
            this.fleePersonality = 'cunning';
            this.fleeDuration = 12; // Medium-long fleeing
            this.fleeStamina = 1.2; // Good stamina
            this.fleeStyle = 'evasive'; // Smart routing
            this.returnCourage = 0.3; // Medium return chance
        } else if (panicked.includes(type)) {
            this.fleePersonality = 'panicked';
            this.fleeDuration = 8; // Medium fleeing
            this.fleeStamina = 0.6; // Low stamina (panic exhaustion)
            this.fleeStyle = 'random'; // Chaotic movement
            this.returnCourage = 0.4; // Medium-high return (confusion)
        } else if (persistent.includes(type)) {
            this.fleePersonality = 'persistent';
            this.fleeDuration = 20; // Very long fleeing
            this.fleeStamina = 1.8; // Excellent stamina
            this.fleeStyle = 'direct'; // Efficient escape
            this.returnCourage = 0.15; // Low return chance
        } else if (reckless.includes(type)) {
            this.fleePersonality = 'reckless';
            this.fleeDuration = 3; // Very short fleeing
            this.fleeStamina = 1.0; // Normal stamina
            this.fleeStyle = 'direct'; // Quick retreat
            this.returnCourage = 0.9; // Very high return chance
        } else {
            // Default normal personality
            this.fleePersonality = 'normal';
            this.fleeDuration = 10;
            this.fleeStamina = 1.0;
            this.fleeStyle = 'direct';
            this.returnCourage = 0.5;
        }
        
        // Special cases for unique monsters
        if (type === 'balrog' || type === 'jabberwock') {
            this.fleePersonality = 'reckless'; // Ancient evils don't flee long
            this.returnCourage = 0.95;
        } else if (type === 'medusa') {
            this.fleePersonality = 'cunning'; // Strategic and dangerous
            this.fleeStyle = 'evasive';
        } else if (type === 'rust_monster') {
            this.fleePersonality = 'persistent'; // Keep pursuing equipment
            this.fleeDuration = 25;
        }
        
        // Apply depth modifiers (deeper monsters are more experienced)
        const currentDepth = stats.minDepth || 1;
        const depthLevel = Math.floor(currentDepth / 5);
        this.fleeDuration += depthLevel; // Deeper monsters flee longer
        this.fleeStamina += depthLevel * 0.1; // Better stamina at depth
    }
    
    /**
     * Apply pack-based difficulty adjustments for balance
     */
    applyPackDifficultyAdjustments(type) {
        const packBehavior = window.game && window.game.monsterSpawner ? 
            window.game.monsterSpawner.getPackBehavior(type) : { type: 'solitary' };
        
        switch (packBehavior.type) {
            case 'swarm':
                // Swarm monsters: weakest individuals, strength in numbers
                this.maxHp = Math.max(1, Math.floor(this.maxHp * 0.6)); // -40% HP
                this.toHit = Math.max(1, this.toHit - 2); // -2 to hit
                this.damage = Math.max(0, this.damage - 1); // -1 damage
                this.weaponDamage = Math.max(1, this.weaponDamage - 1); // -1 weapon damage
                this.expValue = Math.max(1, Math.floor(this.expValue * 0.4)); // -60% exp (per individual)
                break;
                
            case 'pack':
                // Pack monsters: moderately weakened individuals
                this.maxHp = Math.max(1, Math.floor(this.maxHp * 0.75)); // -25% HP
                this.toHit = Math.max(1, this.toHit - 1); // -1 to hit
                this.damage = Math.max(0, this.damage - 1); // -1 damage
                this.expValue = Math.max(1, Math.floor(this.expValue * 0.6)); // -40% exp
                break;
                
            case 'group':
                // Group monsters: slightly weakened but still organized
                this.maxHp = Math.max(1, Math.floor(this.maxHp * 0.85)); // -15% HP
                this.toHit = Math.max(1, this.toHit - 1); // -1 to hit
                this.expValue = Math.max(1, Math.floor(this.expValue * 0.75)); // -25% exp
                break;
                
            case 'pair':
                // Pair monsters: slight adjustments
                this.maxHp = Math.max(1, Math.floor(this.maxHp * 0.9)); // -10% HP
                this.expValue = Math.max(1, Math.floor(this.expValue * 0.85)); // -15% exp
                break;
                
            case 'solitary':
                // Solitary monsters: enhanced to be truly formidable
                this.maxHp = Math.floor(this.maxHp * 1.5); // +50% HP
                this.toHit += 2; // +2 to hit
                this.damage += 2; // +2 damage
                this.weaponDamage += 2; // +2 weapon damage
                this.armorClass = Math.max(0, this.armorClass - 2); // -2 AC (better armor)
                this.expValue = Math.floor(this.expValue * 1.8); // +80% exp
                break;
                
            default:
                // No adjustment for unknown types
                break;
        }
        
        // Ensure minimum values
        this.maxHp = Math.max(1, this.maxHp);
        this.hp = this.maxHp; // Update current HP to match new max
        this.toHit = Math.max(1, this.toHit);
        this.weaponDamage = Math.max(1, this.weaponDamage);
        this.expValue = Math.max(1, this.expValue);
        this.armorClass = Math.max(0, this.armorClass);
    }
    
    /**
     * Add energy to monster based on speed
     */
    gainEnergy() {
        this.energy += this.speed;
    }
    
    /**
     * Check if monster has enough energy to act
     */
    canAct() {
        return this.energy >= this.energyToAct;
    }
    
    /**
     * Spend energy for taking an action
     */
    spendEnergy(amount = null) {
        const cost = amount || this.energyToAct;
        this.energy = Math.max(0, this.energy - cost);
    }
    
    /**
     * Wake up the monster
     */
    wakeUp(reason = 'unknown') {
        if (this.isAsleep) {
            this.isAsleep = false;
            this.hasEverWokenUp = true;
            this.justWokeUp = true; // Set flag to prevent immediate action (classic roguelike)
            
            // Generate wake up sound (unless it's a silent wake up)
            if (reason !== 'silent' && window.game && window.game.noiseSystem) {
                window.game.noiseSystem.makeSound(this.x, this.y, window.game.noiseSystem.getMonsterActionSound('MONSTER_WAKE'));
            }
            
            // Only show wake up message if player can see the monster
            if (window.game && window.game.renderer && reason !== 'silent') {
                const canPlayerSeeMonster = window.game.fov && 
                    window.game.fov.canSee(window.game.player.x, window.game.player.y, this.x, this.y, window.game.fov.viewRange);
                
                if (canPlayerSeeMonster) {
                    const messages = {
                        'proximity': `${this.name} wakes up!`,
                        'damage': `${this.name} wakes up from the pain!`,
                        'noise': `${this.name} is startled awake!`,
                        'natural': `${this.name} stirs and wakes up.`
                    };
                    const message = messages[reason] || `${this.name} wakes up!`;
                    window.game.renderer.addLogMessage(message);
                }
            }
        }
    }
    
    /**
     * Check if monster should wake up due to player proximity
     * Note: Sound-based awakening is handled automatically by the NoiseSystem
     */
    checkWakeUpConditions(playerX, playerY) {
        if (!this.isAsleep) return;
        
        // Calculate distance to player
        const dx = Math.abs(this.x - playerX);
        const dy = Math.abs(this.y - playerY);
        const distance = Math.max(dx, dy); // Chebyshev distance
        
        // Wake up if player is adjacent (classic roguelike behavior)
        if (distance <= this.wakeUpDistance) {
            this.wakeUp('proximity');
            return;
        }
        
        // Very small chance to wake up naturally (classic roguelike behavior)
        // Probability depends on sleep depth
        let naturalWakeChance = 0;
        switch (this.sleepDepth) {
            case 'light':
                naturalWakeChance = 0.002; // 0.2% - 1 in 500 turns
                break;
            case 'normal':
                naturalWakeChance = 0.0005; // 0.05% - 1 in 2000 turns
                break;
            case 'deep':
                naturalWakeChance = 0.0001; // 0.01% - 1 in 10000 turns
                break;
        }
        
        if (Math.random() < naturalWakeChance) {
            this.wakeUp('natural');
        }
        
        // Note: Sound-based awakening is handled by NoiseSystem.makeSound() calls
        // which automatically check all sleeping monsters in range
    }
    
    /**
     * Take damage from an attack (Classic Roguelike)
     */
    takeDamage(damage, penetration = 0) {
        // Wake up if sleeping and taking damage
        if (this.isAsleep) {
            this.wakeUp('damage');
        }
        
        // Calculate damage reduction with minimum damage guarantee (75% max reduction)
        const naturalProtection = this.protection || 0; // Monster's natural protection
        const effectiveProtection = Math.max(0, naturalProtection - penetration);
        const reducedDamage = Math.max(0, damage - effectiveProtection);
        const minimumDamage = Math.ceil(damage * 0.25); // Guarantee 25% of original damage
        const finalDamage = Math.max(reducedDamage, minimumDamage);
        
        if (window.game && window.game.renderer && (naturalProtection > 0 || penetration > 0)) {
            const reductionPercent = Math.round((1 - finalDamage / damage) * 100);
            window.game.renderer.addBattleLogMessage(
                `${this.name} DR ${naturalProtection} vs AP ${penetration} = ${effectiveProtection} DR (${damage} → ${finalDamage}, ${reductionPercent}% reduced)`, 
                'defense'
            );
        }
        
        this.hp -= finalDamage;
        
        // Add HP status to battle log (only if damage was actually taken)
        if (window.game && window.game.renderer) {
            const hpDisplay = this.hp <= 0 ? '0' : this.hp;
            if (finalDamage > 0) {
                window.game.renderer.addBattleLogMessage(`${this.name}: ${hpDisplay}/${this.maxHp} HP`, 'damage');
            } else {
                window.game.renderer.addBattleLogMessage(`${this.name} takes no damage!`, 'defense');
            }
        }
        
        if (this.hp <= 0) {
            this.hp = 0;
            this.isAlive = false;
            // Death message will be handled by the attacker
        }
        
        return damage;
    }
    
    /**
     * Attack the player (Classic Roguelike - THAC0 style)
     */
    attackPlayer(player) {
        // THAC0-style hit check: need to roll >= (target AC - to hit bonus)
        const naturalRoll = Math.floor(Math.random() * 20) + 1; // Pure d20 roll (1-20)
        const requiredRoll = player.armorClass - this.toHit; // THAC0 calculation
        
        if (window.game && window.game.renderer) {
            window.game.renderer.addBattleLogMessage(`${this.name} attacks... (${naturalRoll} vs ${requiredRoll}+ needed, AC ${player.armorClass})`);
        }
        
        if (naturalRoll >= requiredRoll) {
            // Hit! Calculate damage
            const baseDamage = this.damage + Math.floor(Math.random() * this.weaponDamage) + 1;
            let finalDamage = baseDamage;
            
            // Critical hit check (natural 20 only - not modified roll)
            if (naturalRoll === 20) {
                finalDamage = baseDamage * 2;
                if (window.game && window.game.renderer) {
                    window.game.renderer.addBattleLogMessage(`Critical hit! ${finalDamage} damage!`, 'damage');
                }
            } else {
                if (window.game && window.game.renderer) {
                    window.game.renderer.addBattleLogMessage(`Hit! ${finalDamage} damage!`);
                }
            }
            
            // Apply damage first
            const playerDied = player.takeDamage(finalDamage, this.penetration || 0);
            
            // Check for status effects from monster attacks (only if player survived)
            if (finalDamage > 0 && player.statusEffects && player.hp > 0) {
                // Check if status effect function is available
                if (typeof calculateStatusEffectChance === 'function') {
                    // Monster natural weapons have different effect chances based on type
                    const monsterWeaponType = this.getMonsterWeaponType();
                    const maxDamage = player.maxHp;
                    
                    // Check each possible status effect
                    const possibleEffects = ['bleeding', 'stunned', 'fractured', 'poisoned'];
                    for (const effectType of possibleEffects) {
                        try {
                            // Some monsters have special status effect chances
                            if (effectType === 'poisoned' && this.type && ['snake', 'spider', 'centipede'].includes(this.type)) {
                                // Venomous creatures have high poison chance
                                if (Math.random() < 0.3) {
                                    player.statusEffects.addEffect('poisoned', 5 + Math.floor(Math.random() * 5), 
                                        Math.min(3, 1 + Math.floor(finalDamage / 5)), this.name);
                                }
                            } else {
                                const effect = calculateStatusEffectChance(monsterWeaponType, effectType, finalDamage, maxDamage);
                                if (effect) {
                                    player.statusEffects.addEffect(effect.type, effect.duration, effect.severity, this.name);
                                }
                            }
                        } catch (error) {
                            console.error(`Error applying status effect ${effectType} from ${this.name}:`, error);
                        }
                    }
                }
            }
            
            // Generate monster combat sound
            if (window.game && window.game.noiseSystem) {
                window.game.noiseSystem.makeSound(this.x, this.y, window.game.noiseSystem.getMonsterActionSound('MONSTER_ATTACK'));
            }
            
            return playerDied;
        } else {
            // Miss
            if (window.game && window.game.renderer) {
                window.game.renderer.addBattleLogMessage(`Miss!`);
            }
            
            // Generate monster combat sound even on miss
            if (window.game && window.game.noiseSystem) {
                window.game.noiseSystem.makeSound(this.x, this.y, window.game.noiseSystem.getMonsterActionSound('MONSTER_ATTACK'));
            }
            
            return false; // Player not hit
        }
    }
    
    /**
     * Get monster weapon type for status effect calculations
     */
    getMonsterWeaponType() {
        // Map monster types to weapon categories
        const clawTypes = ['rat', 'bat', 'wolf', 'bear', 'gecko', 'wyvern', 'dragon', 'griffin'];
        const biteTypes = ['snake', 'spider', 'centipede', 'purple_worm', 'jackal'];
        const bashTypes = ['ogre', 'troll', 'giant', 'ettin', 'frost_giant', 'umber_hulk'];
        const slashTypes = ['orc', 'hobgoblin', 'gnoll', 'minotaur', 'balrog'];
        
        if (clawTypes.includes(this.type)) {
            return 'dagger'; // Claws act like piercing/slashing
        } else if (biteTypes.includes(this.type)) {
            return 'dagger'; // Bites are piercing
        } else if (bashTypes.includes(this.type)) {
            return 'hammer'; // Bashing attacks
        } else if (slashTypes.includes(this.type)) {
            return 'sword'; // Slashing attacks
        }
        
        // Default to basic attack type
        return 'default';
    }
    
    /**
     * Get display information
     */
    getDisplayInfo() {
        return {
            x: this.x,
            y: this.y,
            symbol: this.symbol,
            color: this.color
        };
    }
}

/**
 * Monster Spawner - manages monsters in the dungeon
 */
class MonsterSpawner {
    constructor(dungeon) {
        this.dungeon = dungeon;
        this.monsters = [];
        
        // Pack behavior system (Angband-style monster groups)
        this.packBehaviors = this.initializePackBehaviors();
    }
    
    /**
     * Spawn monsters throughout the dungeon (Classic Roguelike - Depth-based with pack behavior)
     */
    spawnMonsters(currentDepth = 1) {
        if (this.dungeon.rooms.length === 0) return;
        
        // Don't spawn in the first room (player starting room)
        const spawnRooms = this.dungeon.rooms.slice(1);
        
        spawnRooms.forEach(room => {
            this.spawnMonstersInRoom(room, currentDepth);
        });
    }
    
    /**
     * Spawn monsters in a specific room with pack behavior
     */
    spawnMonstersInRoom(room, currentDepth) {
        // Determine base monster spawn attempts (1-3 per room)
        const baseAttempts = Math.floor(Math.random() * 3) + 1;
        const depthBonus = currentDepth > 5 ? Math.floor(Math.random() * 2) : 0;
        const spawnAttempts = Math.min(baseAttempts + depthBonus, 4);
        
        let spawnedCount = 0;
        const maxMonstersInRoom = 8; // Prevent room overcrowding
        
        for (let attempt = 0; attempt < spawnAttempts && spawnedCount < maxMonstersInRoom; attempt++) {
            const monsterType = this.getRandomMonsterType(currentDepth);
            const packBehavior = this.getPackBehavior(monsterType);
            
            // Check if this monster should spawn as a pack
            if (Math.random() < packBehavior.packChance) {
                // Spawn pack
                const packSize = Math.floor(Math.random() * (packBehavior.maxSize - packBehavior.minSize + 1)) + packBehavior.minSize;
                const actualPackSize = Math.min(packSize, maxMonstersInRoom - spawnedCount);
                
                const packPositions = this.generatePackPositions(room, actualPackSize, packBehavior.spacing);
                
                if (packPositions.length > 0) {
            
                    
                    packPositions.forEach(position => {
                        if (!this.getMonsterAt(position.x, position.y)) {
                            this.spawnSingleMonster(position.x, position.y, monsterType, currentDepth);
                            spawnedCount++;
                        }
                    });
                } else {
                    // Fallback to single spawn if pack placement failed
                    const position = this.getRandomPositionInRoom(room);
                    if (position && !this.getMonsterAt(position.x, position.y)) {
                        this.spawnSingleMonster(position.x, position.y, monsterType, currentDepth);
                        spawnedCount++;
                    }
                }
            } else {
                // Spawn single monster
                const position = this.getRandomPositionInRoom(room);
                if (position && !this.getMonsterAt(position.x, position.y)) {
                    this.spawnSingleMonster(position.x, position.y, monsterType, currentDepth);
                    spawnedCount++;
                }
            }
        }
    }
    
    /**
     * Spawn a single monster at specified position
     */
    spawnSingleMonster(x, y, monsterType, currentDepth) {
        const monster = new Monster(x, y, monsterType);
        
        // Classic roguelike: some monsters start awake (especially dangerous ones)
        const awakeProbability = this.getAwakeProbability(monster, currentDepth);
        if (Math.random() < awakeProbability) {
            monster.wakeUp('silent'); // Wake up without message
        }
        
        this.monsters.push(monster);

    }
    
    /**
     * Get random monster type based on current depth
     */
    getRandomMonsterType(currentDepth = 1) {
        // Get all monster types that can appear at this depth
        const availableTypes = [];
        const monsterTypes = {
            // Early depths (1-3)
            'newt': { minDepth: 1, maxDepth: 3 },
            'bat': { minDepth: 1, maxDepth: 4 },
            'rat': { minDepth: 1, maxDepth: 3 },
            'spider': { minDepth: 1, maxDepth: 4 },
            'kobold': { minDepth: 1, maxDepth: 5 },
            'ant': { minDepth: 1, maxDepth: 4 },
            'centipede': { minDepth: 1, maxDepth: 5 },
            'jackal': { minDepth: 1, maxDepth: 4 },
            'gecko': { minDepth: 1, maxDepth: 3 },
            
            // Mid-early depths (2-5)
            'goblin': { minDepth: 2, maxDepth: 6 },
            'orc': { minDepth: 2, maxDepth: 7 },
            'wolf': { minDepth: 2, maxDepth: 6 },
            'skeleton': { minDepth: 3, maxDepth: 8 },
            'zombie': { minDepth: 2, maxDepth: 7 },
            'dwarf': { minDepth: 3, maxDepth: 8 },
            'elf': { minDepth: 3, maxDepth: 8 },
            'floating_eye': { minDepth: 2, maxDepth: 6 },
            'leprechaun': { minDepth: 3, maxDepth: 7 },
            'snake': { minDepth: 2, maxDepth: 6 },
            
            // Mid depths (4-8)
            'lizardman': { minDepth: 4, maxDepth: 9 },
            'hobgoblin': { minDepth: 4, maxDepth: 10 },
            'gnoll': { minDepth: 5, maxDepth: 11 },
            'bear': { minDepth: 5, maxDepth: 12 },
            'centaur': { minDepth: 5, maxDepth: 11 },
            'wraith': { minDepth: 6, maxDepth: 12 },
            'nymph': { minDepth: 4, maxDepth: 10 },
            'unicorn': { minDepth: 6, maxDepth: 13 },
            'stalker': { minDepth: 6, maxDepth: 12 },
            'yeti': { minDepth: 5, maxDepth: 11 },
            
            // Late depths (7-12)
            'ogre': { minDepth: 7, maxDepth: 15 },
            'troll': { minDepth: 8, maxDepth: 18 },
            'minotaur': { minDepth: 9, maxDepth: 20 },
            'vampire': { minDepth: 8, maxDepth: 18 },
            'xorn': { minDepth: 8, maxDepth: 16 },
            'rust_monster': { minDepth: 7, maxDepth: 14 },
            'umber_hulk': { minDepth: 9, maxDepth: 18 },
            'invisible_stalker': { minDepth: 8, maxDepth: 16 },
            'ettin': { minDepth: 9, maxDepth: 17 },
            
            // Deep depths (10+)
            'wyvern': { minDepth: 10, maxDepth: 25 },
            'giant': { minDepth: 12, maxDepth: 30 },
            'dragon': { minDepth: 15, maxDepth: 99 },
            'lich': { minDepth: 13, maxDepth: 99 },
            'balrog': { minDepth: 16, maxDepth: 99 },
            'jabberwock': { minDepth: 14, maxDepth: 99 },
            'medusa': { minDepth: 11, maxDepth: 20 },
            'sphinx': { minDepth: 12, maxDepth: 25 },
            'purple_worm': { minDepth: 17, maxDepth: 99 },
            'frost_giant': { minDepth: 15, maxDepth: 99 }
        };
        
        // Filter monsters that can appear at current depth
        for (const [type, data] of Object.entries(monsterTypes)) {
            if (currentDepth >= data.minDepth && currentDepth <= data.maxDepth) {
                // Calculate spawn weight based on depth curve
                let weight = this.calculateSpawnWeight(type, currentDepth, data);
                
                // Add multiple instances based on weight
                for (let i = 0; i < weight; i++) {
                    availableTypes.push(type);
                }
            }
        }
        
        // Fallback to kobold if no monsters available (shouldn't happen)
        if (availableTypes.length === 0) {

            return 'kobold';
        }
        
        return availableTypes[Math.floor(Math.random() * availableTypes.length)];
    }
    
    /**
     * Calculate spawn weight for a monster at given depth
     */
    calculateSpawnWeight(monsterType, currentDepth, depthData) {
        const { minDepth, maxDepth } = depthData;
        const depthRange = maxDepth - minDepth + 1;
        const depthPosition = currentDepth - minDepth + 1;
        
        // Weight distribution patterns by monster category
        const earlyMonsters = ['newt', 'bat', 'rat', 'spider', 'ant', 'gecko', 'jackal'];
        const commonMonsters = ['kobold', 'goblin', 'orc', 'wolf', 'skeleton', 'zombie', 'centipede', 'dwarf', 'elf', 'floating_eye', 'leprechaun', 'snake'];
        const midMonsters = ['lizardman', 'hobgoblin', 'gnoll', 'bear', 'centaur', 'nymph', 'stalker', 'yeti'];
        const lateMonsters = ['ogre', 'troll', 'minotaur', 'vampire', 'xorn', 'rust_monster', 'umber_hulk', 'invisible_stalker', 'ettin'];
        const rareMonsters = ['wyvern', 'giant', 'dragon', 'lich', 'balrog', 'jabberwock', 'medusa', 'sphinx', 'purple_worm', 'frost_giant'];
        const specialMonsters = ['wraith', 'unicorn']; // Special category for mid-tier magical creatures
        
        let baseWeight = 1;
        
        if (earlyMonsters.includes(monsterType)) {
            // Early monsters: common at shallow depths, rare at deep
            baseWeight = Math.max(1, Math.ceil(8 - (depthPosition / depthRange) * 6));
        } else if (commonMonsters.includes(monsterType)) {
            // Common monsters: consistent throughout their range
            baseWeight = Math.max(2, Math.ceil(6 - Math.abs((depthPosition / depthRange) - 0.5) * 3));
        } else if (midMonsters.includes(monsterType)) {
            // Mid monsters: peak in middle of range
            baseWeight = Math.max(1, Math.ceil(4 - Math.abs((depthPosition / depthRange) - 0.5) * 2));
        } else if (specialMonsters.includes(monsterType)) {
            // Special monsters: rare but consistent in their range
            baseWeight = Math.max(1, Math.ceil(3 - Math.abs((depthPosition / depthRange) - 0.5) * 1));
        } else if (lateMonsters.includes(monsterType)) {
            // Late monsters: rare early, common at peak depth
            baseWeight = Math.max(1, Math.ceil((depthPosition / depthRange) * 4));
        } else if (rareMonsters.includes(monsterType)) {
            // Rare monsters: very low spawn rate
            baseWeight = currentDepth >= (minDepth + Math.floor(depthRange * 0.7)) ? 1 : 0;
        }
        
        return baseWeight;
    }
    
    /**
     * Initialize pack behavior definitions for all monster types
     */
    initializePackBehaviors() {
        return {
            // Swarm monsters - large groups, tightly packed
            'ant': { type: 'swarm', minSize: 4, maxSize: 8, spacing: 'tight', packChance: 0.8 },
            'rat': { type: 'swarm', minSize: 3, maxSize: 6, spacing: 'tight', packChance: 0.7 },
            'spider': { type: 'swarm', minSize: 2, maxSize: 5, spacing: 'loose', packChance: 0.6 },
            'centipede': { type: 'swarm', minSize: 2, maxSize: 4, spacing: 'tight', packChance: 0.6 },
            
            // Pack monsters - medium groups, moderate spacing
            'kobold': { type: 'pack', minSize: 2, maxSize: 5, spacing: 'loose', packChance: 0.8 },
            'goblin': { type: 'pack', minSize: 2, maxSize: 4, spacing: 'loose', packChance: 0.7 },
            'orc': { type: 'pack', minSize: 2, maxSize: 4, spacing: 'formation', packChance: 0.7 },
            'hobgoblin': { type: 'pack', minSize: 2, maxSize: 3, spacing: 'formation', packChance: 0.6 },
            'gnoll': { type: 'pack', minSize: 2, maxSize: 3, spacing: 'formation', packChance: 0.6 },
            'wolf': { type: 'pack', minSize: 2, maxSize: 4, spacing: 'loose', packChance: 0.8 },
            'jackal': { type: 'pack', minSize: 3, maxSize: 6, spacing: 'loose', packChance: 0.7 },
            
            // Group monsters - small organized units
            'dwarf': { type: 'group', minSize: 2, maxSize: 3, spacing: 'formation', packChance: 0.9 },
            'elf': { type: 'group', minSize: 2, maxSize: 3, spacing: 'formation', packChance: 0.8 },
            'lizardman': { type: 'group', minSize: 2, maxSize: 3, spacing: 'formation', packChance: 0.6 },
            'centaur': { type: 'group', minSize: 2, maxSize: 3, spacing: 'formation', packChance: 0.5 },
            'skeleton': { type: 'group', minSize: 2, maxSize: 4, spacing: 'formation', packChance: 0.5 },
            'zombie': { type: 'group', minSize: 2, maxSize: 3, spacing: 'tight', packChance: 0.4 },
            
            // Pair monsters - occasional pairs
            'bat': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'loose', packChance: 0.4 },
            'gecko': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'loose', packChance: 0.3 },
            'snake': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'loose', packChance: 0.3 },
            'bear': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'loose', packChance: 0.2 },
            'ogre': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'formation', packChance: 0.3 },
            'troll': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'formation', packChance: 0.3 },
            'ettin': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'formation', packChance: 0.4 },
            'giant': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'formation', packChance: 0.2 },
            
            // Solitary monsters - always alone
            'dragon': { type: 'solitary', minSize: 1, maxSize: 1, spacing: 'alone', packChance: 0.0 },
            'lich': { type: 'solitary', minSize: 1, maxSize: 1, spacing: 'alone', packChance: 0.0 },
            'balrog': { type: 'solitary', minSize: 1, maxSize: 1, spacing: 'alone', packChance: 0.0 },
            'jabberwock': { type: 'solitary', minSize: 1, maxSize: 1, spacing: 'alone', packChance: 0.0 },
            'unicorn': { type: 'solitary', minSize: 1, maxSize: 1, spacing: 'alone', packChance: 0.0 },
            'medusa': { type: 'solitary', minSize: 1, maxSize: 1, spacing: 'alone', packChance: 0.0 },
            'sphinx': { type: 'solitary', minSize: 1, maxSize: 1, spacing: 'alone', packChance: 0.0 },
            'purple_worm': { type: 'solitary', minSize: 1, maxSize: 1, spacing: 'alone', packChance: 0.0 },
            'frost_giant': { type: 'solitary', minSize: 1, maxSize: 1, spacing: 'alone', packChance: 0.0 },
            
            // Special cases
            'floating_eye': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'loose', packChance: 0.3 },
            'leprechaun': { type: 'solitary', minSize: 1, maxSize: 1, spacing: 'alone', packChance: 0.0 },
            'nymph': { type: 'solitary', minSize: 1, maxSize: 1, spacing: 'alone', packChance: 0.0 },
            'stalker': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'loose', packChance: 0.4 },
            'invisible_stalker': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'loose', packChance: 0.3 },
            'wraith': { type: 'group', minSize: 1, maxSize: 3, spacing: 'formation', packChance: 0.4 },
            'vampire': { type: 'solitary', minSize: 1, maxSize: 1, spacing: 'alone', packChance: 0.0 },
            'minotaur': { type: 'solitary', minSize: 1, maxSize: 1, spacing: 'alone', packChance: 0.0 },
            'wyvern': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'formation', packChance: 0.2 },
            'xorn': { type: 'solitary', minSize: 1, maxSize: 1, spacing: 'alone', packChance: 0.0 },
            'rust_monster': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'loose', packChance: 0.3 },
            'umber_hulk': { type: 'solitary', minSize: 1, maxSize: 1, spacing: 'alone', packChance: 0.0 },
            'yeti': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'loose', packChance: 0.3 },
            'newt': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'tight', packChance: 0.5 }
        };
    }
    
    /**
     * Get pack behavior for a monster type
     */
    getPackBehavior(monsterType) {
        return this.packBehaviors[monsterType] || {
            type: 'solitary',
            minSize: 1,
            maxSize: 1,
            spacing: 'alone',
            packChance: 0.0
        };
    }
    
    /**
     * Generate positions for a pack of monsters based on spacing type
     */
    generatePackPositions(room, packSize, spacing) {
        const positions = [];
        
        // Start with a random valid position in the room
        const startPosition = this.getRandomPositionInRoom(room);
        if (!startPosition) return positions;
        
        positions.push(startPosition);
        
        // Generate additional positions based on spacing type
        for (let i = 1; i < packSize; i++) {
            let newPosition = null;
            let attempts = 0;
            const maxAttempts = 20;
            
            while (!newPosition && attempts < maxAttempts) {
                attempts++;
                
                switch (spacing) {
                    case 'tight':
                        // Adjacent to existing monsters (distance 1)
                        newPosition = this.findAdjacentPosition(positions, room, 1);
                        break;
                    case 'loose':
                        // 1-3 spaces away from existing monsters
                        newPosition = this.findNearbyPosition(positions, room, 1, 3);
                        break;
                    case 'formation':
                        // Organized pattern (2x2, line, etc.)
                        newPosition = this.findFormationPosition(positions, room, i);
                        break;
                    case 'alone':
                    default:
                        // Should not reach here for pack spawning
                        break;
                }
            }
            
            if (newPosition && !this.getMonsterAt(newPosition.x, newPosition.y)) {
                positions.push(newPosition);
            }
        }
        
        return positions;
    }
    
    /**
     * Find adjacent position to existing pack members
     */
    findAdjacentPosition(existingPositions, room, maxDistance) {
        const directions = [
            [-1, -1], [0, -1], [1, -1],
            [-1,  0],          [1,  0],
            [-1,  1], [0,  1], [1,  1]
        ];
        
        // Try around each existing position
        for (const existingPos of existingPositions) {
            const shuffledDirections = directions.sort(() => Math.random() - 0.5);
            
            for (const [dx, dy] of shuffledDirections) {
                for (let dist = 1; dist <= maxDistance; dist++) {
                    const newX = existingPos.x + dx * dist;
                    const newY = existingPos.y + dy * dist;
                    
                    if (this.isValidPackPosition(newX, newY, room, existingPositions)) {
                        return { x: newX, y: newY };
                    }
                }
            }
        }
        
        return null;
    }
    
    /**
     * Find nearby position within specified distance range
     */
    findNearbyPosition(existingPositions, room, minDistance, maxDistance) {
        const centerPos = existingPositions[0]; // Use first position as center
        
        for (let attempt = 0; attempt < 10; attempt++) {
            const angle = Math.random() * 2 * Math.PI;
            const distance = Math.random() * (maxDistance - minDistance) + minDistance;
            
            const newX = Math.round(centerPos.x + Math.cos(angle) * distance);
            const newY = Math.round(centerPos.y + Math.sin(angle) * distance);
            
            if (this.isValidPackPosition(newX, newY, room, existingPositions)) {
                return { x: newX, y: newY };
            }
        }
        
        // Fallback to adjacent position
        return this.findAdjacentPosition(existingPositions, room, 2);
    }
    
    /**
     * Find formation position (organized patterns)
     */
    findFormationPosition(existingPositions, room, memberIndex) {
        const firstPos = existingPositions[0];
        
        // Different formation patterns based on member count
        const formations = {
            2: [[1, 0], [-1, 0], [0, 1], [0, -1]], // Line formations
            3: [[1, 1], [-1, -1], [1, -1], [-1, 1]], // L-shapes
            4: [[2, 0], [0, 2], [-2, 0], [0, -2]], // Cross formation
        };
        
        const formationOffsets = formations[memberIndex] || formations[2];
        
        for (const [dx, dy] of formationOffsets) {
            const newX = firstPos.x + dx;
            const newY = firstPos.y + dy;
            
            if (this.isValidPackPosition(newX, newY, room, existingPositions)) {
                return { x: newX, y: newY };
            }
        }
        
        // Fallback to nearby position
        return this.findNearbyPosition(existingPositions, room, 1, 2);
    }
    
    /**
     * Check if position is valid for pack member placement
     */
    isValidPackPosition(x, y, room, existingPositions) {
        // Check room bounds
        if (x < room.x + 1 || x >= room.x + room.width - 1 ||
            y < room.y + 1 || y >= room.y + room.height - 1) {
            return false;
        }
        
        // Check if position is walkable
        if (!this.dungeon.isWalkable(x, y)) {
            return false;
        }
        
        // Check if position is already occupied
        if (this.getMonsterAt(x, y)) {
            return false;
        }
        
        // Check if position conflicts with existing pack members
        for (const pos of existingPositions) {
            if (pos.x === x && pos.y === y) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Calculate probability of monster spawning awake (based on biological nature)
     */
    getAwakeProbability(monster, currentDepth) {
        // Base probability determined by creature type, not strength
        let baseProbability = 0.5; // Default baseline
        
        // Wild animals and insects are naturally alert (survival instinct)
        const wildAnimals = [
            'bat', 'rat', 'spider', 'ant', 'centipede', 'jackal', 'gecko',
            'wolf', 'bear', 'snake', 'wyvern', 'purple_worm'
        ];
        
        // Humanoid races - can be sleeping/resting but also on guard duty  
        const humanoids = [
            'kobold', 'goblin', 'orc', 'dwarf', 'elf', 'hobgoblin', 'gnoll',
            'lizardman', 'centaur', 'ogre', 'troll', 'minotaur', 'giant', 'ettin'
        ];
        
        // Undead - magically dormant but can be awakened
        const undead = [
            'skeleton', 'zombie', 'wraith', 'lich', 'vampire'
        ];
        
        // Magical creatures - deep magical slumber
        const magical = [
            'floating_eye', 'leprechaun', 'unicorn', 'stalker', 'sphinx',
            'dragon', 'balrog', 'jabberwock', 'medusa', 'xorn', 
            'rust_monster', 'umber_hulk', 'invisible_stalker', 'nymph', 'yeti'
        ];
        
        // Set base probability by creature category
        if (wildAnimals.includes(monster.type)) {
            baseProbability = 0.85; // Wild creatures are almost always alert
        } else if (humanoids.includes(monster.type)) {
            baseProbability = 0.65; // Humanoids have guard shifts and rest periods
        } else if (undead.includes(monster.type)) {
            baseProbability = 0.45; // Undead in magical dormancy
        } else if (magical.includes(monster.type)) {
            baseProbability = 0.35; // Magical creatures in deep slumber
        }
        
        // Minor depth adjustment (deeper creatures slightly more alert due to danger)
        const depthBonus = Math.min(currentDepth * 0.02, 0.1); // Max +10%
        baseProbability += depthBonus;
        
        // Some specific adjustments for individual creatures
        if (monster.type === 'floating_eye') {
            baseProbability = 0.25; // Eyes are often dormant until disturbed
        } else if (monster.type === 'dragon') {
            baseProbability = 0.3; // Dragons sleep on their hoards
        } else if (monster.type === 'bear') {
            baseProbability = 0.75; // Bears are alert in dungeons (not hibernating)
        }
        
        // Ensure reasonable bounds (20-95% awake)
        return Math.min(Math.max(baseProbability, 0.2), 0.95);
    }
    
    /**
     * Get random position within a room
     */
    getRandomPositionInRoom(room) {
        const maxAttempts = 10;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const x = room.x + Math.floor(Math.random() * room.width);
            const y = room.y + Math.floor(Math.random() * room.height);
            
            // Check if position is walkable and not occupied
            if (this.dungeon.isWalkable(x, y) && !this.getMonsterAt(x, y)) {
                return { x, y };
            }
        }
        
        return null; // Could not find valid position
    }
    
    /**
     * Get monster at specific position
     */
    getMonsterAt(x, y) {
        return this.monsters.find(monster => 
            monster.isAlive && monster.x === x && monster.y === y
        );
    }
    
    /**
     * Get all living monsters
     */
    getLivingMonsters() {
        return this.monsters.filter(monster => monster.isAlive);
    }
    
    /**
     * Remove dead monsters
     */
    removeDeadMonsters() {
        this.monsters = this.monsters.filter(monster => monster.isAlive);
    }
} 