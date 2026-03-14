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

        // Pack/group metadata
        this.packId = null; // Numeric or string identifier for pack membership
        this.packType = 'solitary'; // 'swarm' | 'pack' | 'group' | 'pair' | 'solitary'

        // Intelligent creatures: inventory and equipment (pick up / use / equip)
        this.inventory = [];
        this.maxInventorySize = 8;
        this.equipment = { weapon: null, armor: null };
    }
    
    /**
     * Heal the monster up to max HP
     */
    heal(amount) {
        const integerAmount = Math.floor(amount);
        const healed = Math.max(0, Math.min(integerAmount, this.maxHp - this.hp));
        this.hp += healed;
        if (window.game && window.game.renderer && healed > 0 && window.game.fov && window.game.fov.isVisible(this.x, this.y)) {
            window.game.renderer.addBattleLogMessage(`${this.name}: ${this.hp}/${this.maxHp} HP`, 'heal');
        }
        return healed;
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
            // Ecosystem: prey / detritivore (dungeon diversity)
            'cave_fish': {
                name: 'Cave Fish',
                symbol: 'f',
                color: 'monster',
                maxHp: 2,
                toHit: 1,
                armorClass: 15,
                damage: 0,
                weaponDamage: 1,
                penetration: 0,
                exp: 0,
                minDepth: 1,
                maxDepth: 6
            },
            'slime': {
                name: 'Slime',
                symbol: '~',
                color: 'monster',
                maxHp: 4,
                toHit: 2,
                armorClass: 14,
                damage: 0,
                weaponDamage: 2,
                penetration: 0,
                exp: 1,
                minDepth: 1,
                maxDepth: 5
            },
            'cave_beetle': {
                name: 'Cave Beetle',
                symbol: 'q',
                color: 'monster',
                maxHp: 3,
                toHit: 2,
                armorClass: 14,
                damage: 0,
                weaponDamage: 2,
                penetration: 0,
                exp: 0,
                minDepth: 1,
                maxDepth: 5
            },
            'cave_moth': {
                name: 'Cave Moth',
                symbol: 'm',
                color: 'monster',
                maxHp: 2,
                toHit: 1,
                armorClass: 15,
                damage: 0,
                weaponDamage: 1,
                penetration: 0,
                exp: 0,
                minDepth: 1,
                maxDepth: 4
            },
            'glow_worm': {
                name: 'Glow Worm',
                symbol: 'i',
                color: 'monster',
                maxHp: 2,
                toHit: 1,
                armorClass: 15,
                damage: 0,
                weaponDamage: 1,
                penetration: 0,
                exp: 0,
                minDepth: 1,
                maxDepth: 5
            },
            'cave_cricket': {
                name: 'Cave Cricket',
                symbol: ';',
                color: 'monster',
                maxHp: 3,
                toHit: 2,
                armorClass: 14,
                damage: 0,
                weaponDamage: 2,
                penetration: 0,
                exp: 0,
                minDepth: 1,
                maxDepth: 5
            },
            'blind_salamander': {
                name: 'Blind Cave Salamander',
                symbol: 'A',
                color: 'monster',
                maxHp: 4,
                toHit: 2,
                armorClass: 13,
                damage: 0,
                weaponDamage: 2,
                penetration: 0,
                exp: 1,
                minDepth: 2,
                maxDepth: 6
            },
            'mushroom_spore': {
                name: 'Mushroom Spore Cluster',
                symbol: '"',
                color: 'monster',
                maxHp: 2,
                toHit: 1,
                armorClass: 16,
                damage: 0,
                weaponDamage: 1,
                penetration: 0,
                exp: 0,
                minDepth: 1,
                maxDepth: 4
            },
            'shrew': {
                name: 'Cave Shrew',
                symbol: 's',
                color: 'monster',
                maxHp: 2,
                toHit: 1,
                armorClass: 16,
                damage: 0,
                weaponDamage: 1,
                penetration: 0,
                exp: 0,
                minDepth: 1,
                maxDepth: 3
            },
            'frog': {
                name: 'Cave Frog',
                symbol: 'F',
                color: 'monster',
                maxHp: 3,
                toHit: 1,
                armorClass: 14,
                damage: 0,
                weaponDamage: 2,
                penetration: 0,
                exp: 0,
                minDepth: 1,
                maxDepth: 4
            },
            'cave_snail': {
                name: 'Cave Snail',
                symbol: '@',
                color: 'monster',
                maxHp: 3,
                toHit: 0,
                armorClass: 17,
                damage: 0,
                weaponDamage: 1,
                penetration: 0,
                exp: 0,
                minDepth: 1,
                maxDepth: 5
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
            'scorpion': {
                name: 'Giant Scorpion',
                symbol: 'c',
                color: 'monster',
                maxHp: 10,
                toHit: 5,
                armorClass: 13,
                damage: 0,
                weaponDamage: 5,
                penetration: 1,
                exp: 2,
                minDepth: 2,
                maxDepth: 6
            },
            'stirge': {
                name: 'Stirge',
                symbol: 't',
                color: 'monster',
                maxHp: 4,
                toHit: 4,
                armorClass: 14,
                damage: 0,
                weaponDamage: 2,
                penetration: 0,
                exp: 1,
                minDepth: 2,
                maxDepth: 5
            },
            'giant_frog': {
                name: 'Giant Frog',
                symbol: 'P',
                color: 'monster',
                maxHp: 12,
                toHit: 4,
                armorClass: 11,
                damage: 0,
                weaponDamage: 5,
                penetration: 0,
                exp: 2,
                minDepth: 3,
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
            'carrion_crow': {
                name: 'Carrion Crow',
                symbol: 'W',
                color: 'monster',
                maxHp: 8,
                toHit: 5,
                armorClass: 13,
                damage: 0,
                weaponDamage: 3,
                penetration: 0,
                exp: 1,
                minDepth: 4,
                maxDepth: 8
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

        // Per-species colors (hex) so same symbol can distinguish by color
        const MONSTER_COLORS = {
            newt: '#70c070', bat: '#b0b0d0', rat: '#a08060', spider: '#806050', kobold: '#c08040',
            ant: '#a06030', centipede: '#8b7355', jackal: '#c4a060', gecko: '#60a060', cave_fish: '#60a0c0',
            slime: '#80c080', cave_beetle: '#6b8e23', cave_moth: '#b8860b', glow_worm: '#daa520', cave_cricket: '#8b7355',
            blind_salamander: '#8fbc8f', mushroom_spore: '#9acd32', shrew: '#808060', frog: '#3cb371', cave_snail: '#bc8f8f',
            goblin: '#90c090', orc: '#80a060', wolf: '#c0c0c0', skeleton: '#88ccdd', zombie: '#6b8e6b',
            dwarf: '#daa520', elf: '#98fb98', floating_eye: '#ffb6c1', leprechaun: '#ffd700', snake: '#228b22',
            scorpion: '#cd5c5c', stirge: '#8b0000', giant_frog: '#2e8b57', lizardman: '#2e8b57', hobgoblin: '#9acd32',
            gnoll: '#cd853f', carrion_crow: '#4a4a4a', bear: '#8b4513', centaur: '#daa520', wraith: '#add8e6',
            nymph: '#ffc0cb', unicorn: '#ffffff', stalker: '#2f4f4f', yeti: '#e0e0e0', ogre: '#808060',
            troll: '#808080', minotaur: '#8b4513', vampire: '#8b0000', xorn: '#696969', rust_monster: '#a0522d',
            umber_hulk: '#4a3728', invisible_stalker: '#708090', ettin: '#a08060', wyvern: '#4682b4',
            giant: '#d2b48c', dragon: '#b22222', lich: '#e0ffff', balrog: '#8b0000', jabberwock: '#2e8b57',
            medusa: '#9370db', sphinx: '#daa520', purple_worm: '#4b0082', frost_giant: '#b0e0e6'
        };

        const stats = monsterTypes[type] || monsterTypes['kobold'];
        this.color = MONSTER_COLORS[type] || (stats.color && stats.color.startsWith('#') ? stats.color : '#ffffff');

        // Set monster properties
        this.name = stats.name;
        this.symbol = stats.symbol;
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
     * Apply pack-based difficulty adjustments for balance
     */
    applyPackDifficultyAdjustments(type) {
        const packBehavior = window.game && window.game.monsterSpawner ?
            window.game.monsterSpawner.getPackBehavior(type) : { type: 'solitary' };

        switch (packBehavior.type) {
            case 'swarm':
                this.maxHp = Math.max(1, Math.floor(this.maxHp * 0.6));
                this.toHit = Math.max(1, this.toHit - 2);
                this.damage = Math.max(0, this.damage - 1);
                this.weaponDamage = Math.max(1, this.weaponDamage - 1);
                this.expValue = Math.max(1, Math.floor(this.expValue * 0.4));
                break;
            case 'pack':
                this.maxHp = Math.max(1, Math.floor(this.maxHp * 0.75));
                this.toHit = Math.max(1, this.toHit - 1);
                this.damage = Math.max(0, this.damage - 1);
                this.expValue = Math.max(1, Math.floor(this.expValue * 0.6));
                break;
            case 'group':
                this.maxHp = Math.max(1, Math.floor(this.maxHp * 0.85));
                this.toHit = Math.max(1, this.toHit - 1);
                this.expValue = Math.max(1, Math.floor(this.expValue * 0.75));
                break;
            case 'pair':
                this.maxHp = Math.max(1, Math.floor(this.maxHp * 0.9));
                this.expValue = Math.max(1, Math.floor(this.expValue * 0.85));
                break;
            case 'solitary':
                this.maxHp = Math.floor(this.maxHp * 1.5);
                this.toHit += 2;
                this.damage += 2;
                this.weaponDamage += 2;
                this.armorClass = Math.max(0, this.armorClass - 2);
                this.expValue = Math.floor(this.expValue * 1.8);
                break;
            default:
                break;
        }

        this.maxHp = Math.max(1, this.maxHp);
        this.hp = this.maxHp;
        this.toHit = Math.max(1, this.toHit);
        this.weaponDamage = Math.max(1, this.weaponDamage);
        this.expValue = Math.max(1, this.expValue);
        this.armorClass = Math.max(0, this.armorClass);
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

        // Pack registry for morale checks
        this.nextPackId = 1;
        this.packs = new Map(); // packId -> { id, type, originalSize, aliveCount, broken, members: Set<Monster> }
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
            const biome = (room && room.biome && room.biome !== 'start') ? room.biome : null;
            const monsterType = this.getRandomMonsterType(currentDepth, biome);
            const packBehavior = this.getPackBehavior(monsterType);
            
            // Check if this monster should spawn as a pack
            if (Math.random() < packBehavior.packChance) {
                // Spawn pack
                const packSize = Math.floor(Math.random() * (packBehavior.maxSize - packBehavior.minSize + 1)) + packBehavior.minSize;
                const actualPackSize = Math.min(packSize, maxMonstersInRoom - spawnedCount);
                
                const packPositions = this.generatePackPositions(room, actualPackSize, packBehavior.spacing);
                
                if (packPositions.length > 0) {
                    const packId = this.createPack(packBehavior.type, packPositions.length);
                    // Choose a leader index within this pack
                    const leaderIndex = Math.floor(Math.random() * packPositions.length);
                    packPositions.forEach((position, idx) => {
                        if (!this.getMonsterAt(position.x, position.y)) {
                            const isLeader = (idx === leaderIndex);
                            this.spawnSingleMonster(position.x, position.y, monsterType, currentDepth, packId, packBehavior.type, isLeader);
                            spawnedCount++;
                        }
                    });
                    // Finalize pack leadership and morale stats
                    this.finalizePack(packId);
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
    spawnSingleMonster(x, y, monsterType, currentDepth, packId = null, packType = 'solitary', isLeader = false) {
        const monster = new Monster(x, y, monsterType);
        if (packId) {
            monster.packId = packId;
            monster.packType = packType || 'pack';
            this.registerMonsterInPack(monster, packId, packType);
        }
        if (isLeader) {
            monster.isLeader = true;
        }
        
        // Classic roguelike: some monsters start awake (especially dangerous ones)
        const awakeProbability = this.getAwakeProbability(monster, currentDepth);
        if (Math.random() < awakeProbability) {
            monster.wakeUp('silent'); // Wake up without message
        }
        
        this.monsters.push(monster);

    }

    /**
     * Create a new pack record and return its id
     */
    createPack(packType = 'pack', size = 1) {
        const id = this.nextPackId++;
        this.packs.set(id, {
            id,
            type: packType,
            originalSize: size,
            aliveCount: size,
            broken: false,
            members: new Set()
        });
        return id;
    }

    /**
     * Register monster into a pack
     */
    registerMonsterInPack(monster, packId, packType = 'pack') {
        const pack = this.packs.get(packId);
        if (!pack) return;
        pack.members.add(monster);
        // Keep type consistent
        pack.type = packType || pack.type;
    }

    /**
     * Finalize pack info after members are spawned
     */
    finalizePack(packId) {
        const pack = this.packs.get(packId);
        if (!pack) return;
        // Determine leader
        let leader = null;
        // Prefer explicitly marked leader
        pack.members.forEach(m => { if (!leader && m.isLeader) leader = m; });
        // If none flagged, pick the toughest by maxHp then toHit
        if (!leader) {
            pack.members.forEach(m => {
                if (!leader) leader = m;
                else if (m.maxHp > leader.maxHp || (m.maxHp === leader.maxHp && m.toHit > leader.toHit)) leader = m;
            });
            if (leader) leader.isLeader = true;
        }
        pack.leader = leader || null;
        // Compute leadership value (2d6 test target)
        pack.leadership = this.computePackLeadership(pack);
        // Update counts
        pack.originalSize = pack.members.size;
        let alive = 0;
        pack.members.forEach(m => { if (m.isAlive) alive++; });
        pack.aliveCount = alive;
    }

    /**
     * Compute pack leadership score based on type and composition
     * Higher is better. Typical range 5-9 for 2d6 tests.
     */
    computePackLeadership(pack) {
        const baseByType = { swarm: 5, pack: 7, group: 8, pair: 8, solitary: 10 };
        let leadership = baseByType[pack.type] ?? 7;
        // Small bonus if leader is alive
        if (pack.leader && pack.leader.isAlive) leadership += 2;
        // Composition tweak: if most members are smart/genius, add +1; if many mindless, -1
        let smart = 0, total = 0, mindless = 0;
        pack.members.forEach(m => {
            total++;
            if (m.intelligence === 'smart' || m.intelligence === 'genius') smart++;
            if (m.intelligence === 'mindless') mindless++;
        });
        if (total > 0) {
            if (smart / total >= 0.6) leadership += 1;
            if (mindless / total >= 0.6) leadership -= 1;
        }
        return Math.max(3, Math.min(10, leadership));
    }

    /**
     * Determine break threshold by pack type (casualties to cause flee)
     */
    getPackBreakThreshold(originalSize, packType) {
        // casualties fraction required to break (Warhammer-ish)
        const fractionByType = {
            swarm: 0.6, // break when <= 40% remain
            pack: 0.5,  // break when <= 50% remain
            group: 0.5, // break when <= 50% remain
            pair: 0.5,  // break when one dies (<= 1/2 remain)
            solitary: 0.0
        };
        const frac = fractionByType[packType] ?? 0.5;
        return Math.max(1, Math.floor(originalSize * (1 - frac)) < originalSize ? Math.ceil(originalSize * (1 - frac)) : Math.floor(originalSize / 2));
    }

    /**
     * Called when a pack member dies to potentially break the pack
     */
    processPackMoraleOnDeath(monster) {
        if (!monster || !monster.packId) return;
        const pack = this.packs.get(monster.packId);
        if (!pack || pack.broken) return;

        // Recompute alive count from members to be robust
        let alive = 0;
        pack.members.forEach(m => { if (m && m.isAlive) alive++; });
        pack.aliveCount = alive;

        const breakAtRemain = Math.ceil(pack.originalSize * 0.5); // default remain threshold (50%)
        const remainThresholdByType = {
            swarm: Math.ceil(pack.originalSize * 0.4),
            pack: Math.ceil(pack.originalSize * 0.5),
            group: Math.ceil(pack.originalSize * 0.5),
            pair: 1
        };
        const thresholdRemain = remainThresholdByType[pack.type] ?? breakAtRemain;

        if (pack.aliveCount <= thresholdRemain && pack.originalSize > 1) {
            // Panic test (2d6 vs leadership)
            const d6 = () => Math.floor(Math.random() * 6) + 1;
            const roll = d6() + d6();
            let leadership = pack.leadership || this.computePackLeadership(pack);
            // Casualties penalty: if 50%超の損耗なら -1
            const casualties = pack.originalSize - pack.aliveCount;
            if (casualties / pack.originalSize >= 0.5) leadership -= 1;
            const passed = roll <= leadership;
            if (passed) {
                // Optional: short wavering debuff; here just log if visible
                if (window.game && window.game.renderer) {
                    // Log if any member visible
                    let anyVisible = false;
                    pack.members.forEach(m => { if (!anyVisible && m.isAlive && window.game.isTileVisible && window.game.isTileVisible(m.x, m.y)) anyVisible = true; });
                    if (anyVisible) window.game.renderer.addBattleLogMessage('The pack wavers but holds!', 'normal');
                }
                return;
            }

            pack.broken = true;
            // Set all living members to flee (panic style)
            let anyVisible = false;
            pack.members.forEach(m => {
                if (m && m.isAlive) {
                    m.isFleeing = true;
                    m.fleePersonality = 'panicked';
                    m.fleeStyle = 'random';
                    m.fleeTimer = 0;
                    m.fleeDuration = Math.max(m.fleeDuration, 10);
                    if (!anyVisible && window.game && window.game.isTileVisible && window.game.isTileVisible(m.x, m.y)) {
                        anyVisible = true;
                    }
                }
            });
            // Log once if any member visible
            if (anyVisible && window.game && window.game.renderer) {
                const label = pack.type === 'pair' ? 'pair' : (pack.type || 'pack');
                window.game.renderer.addBattleLogMessage(`The ${label} fails its nerve and flees!`, 'warning');
            }
        }
    }

    /**
     * Rebuild pack registry from monsters (after load)
     */
    rebuildPacksFromMonsters() {
        this.packs = new Map();
        this.nextPackId = 1;
        // Detect existing packIds and group
        const grouped = new Map(); // id -> {type, members}
        this.monsters.forEach(m => {
            if (m.packId) {
                const entry = grouped.get(m.packId) || { type: m.packType || 'pack', members: [] };
                entry.type = m.packType || entry.type;
                entry.members.push(m);
                grouped.set(m.packId, entry);
            }
        });
        // Create pack records
        grouped.forEach((entry, id) => {
            const packId = Number(id);
            const pack = {
                id: packId,
                type: entry.type,
                originalSize: entry.members.length,
                aliveCount: entry.members.filter(m => m.isAlive).length,
                broken: false,
                members: new Set(entry.members)
            };
            this.packs.set(packId, pack);
            this.nextPackId = Math.max(this.nextPackId, packId + 1);
        });
    }
    
    /**
     * Biome-based spawn multiplier for environmental diversity (1 = neutral).
     */
    getBiomeSpawnMultiplier(type, biome) {
        if (!biome) return 1;
        const table = {
            flooded: { cave_fish: 4, slime: 3, blind_salamander: 2, frog: 3, giant_frog: 2 },
            damp: { slime: 2.5, cave_fish: 2, cave_beetle: 1.5, frog: 2, cave_snail: 2, giant_frog: 1.5 },
            grove: { cave_beetle: 2, cave_cricket: 2, gecko: 2, rat: 1.5, cave_moth: 1.5, shrew: 2, cave_snail: 1.5 },
            crypt: { skeleton: 3, zombie: 3, spider: 2, mushroom_spore: 2, wraith: 1.5, scorpion: 2, carrion_crow: 2 },
            barracks: { kobold: 2, goblin: 2, orc: 2, dwarf: 2, hobgoblin: 1.5, elf: 1.3, carrion_crow: 1.5 },
            cave: { bat: 2.5, cave_moth: 2, glow_worm: 2, centipede: 1.5, scorpion: 2, shrew: 1.5, stirge: 1.5 }
        };
        const row = table[biome];
        if (!row || row[type] === undefined) return 1;
        return row[type];
    }

    /**
     * Get random monster type based on current depth and optional room biome.
     */
    getRandomMonsterType(currentDepth = 1, biome = null) {
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
            'cave_fish': { minDepth: 1, maxDepth: 6 },
            'slime': { minDepth: 1, maxDepth: 5 },
            'cave_beetle': { minDepth: 1, maxDepth: 5 },
            'cave_moth': { minDepth: 1, maxDepth: 4 },
            'glow_worm': { minDepth: 1, maxDepth: 5 },
            'cave_cricket': { minDepth: 1, maxDepth: 5 },
            'blind_salamander': { minDepth: 2, maxDepth: 6 },
            'mushroom_spore': { minDepth: 1, maxDepth: 4 },
            'shrew': { minDepth: 1, maxDepth: 3 },
            'frog': { minDepth: 1, maxDepth: 4 },
            'cave_snail': { minDepth: 1, maxDepth: 5 },

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
            'scorpion': { minDepth: 2, maxDepth: 6 },
            'stirge': { minDepth: 2, maxDepth: 5 },
            'giant_frog': { minDepth: 3, maxDepth: 6 },
            
            // Mid depths (4-8)
            'lizardman': { minDepth: 4, maxDepth: 9 },
            'hobgoblin': { minDepth: 4, maxDepth: 10 },
            'gnoll': { minDepth: 5, maxDepth: 11 },
            'carrion_crow': { minDepth: 4, maxDepth: 8 },
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
        
        // Build weighted list: depth-valid types with spawn weight and biome multiplier
        const weighted = [];
        for (const [type, data] of Object.entries(monsterTypes)) {
            if (currentDepth < data.minDepth || currentDepth > data.maxDepth) continue;
            let weight = this.calculateSpawnWeight(type, currentDepth, data);
            if (biome) weight *= this.getBiomeSpawnMultiplier(type, biome);
            if (weight <= 0) continue;
            weighted.push({ type, weight });
        }

        if (weighted.length === 0) return 'kobold';
        const total = weighted.reduce((s, e) => s + e.weight, 0);
        let r = Math.random() * total;
        for (const { type, weight } of weighted) {
            r -= weight;
            if (r <= 0) return type;
        }
        return weighted[weighted.length - 1].type;
    }
    
    /**
     * Calculate spawn weight for a monster at given depth
     */
    calculateSpawnWeight(monsterType, currentDepth, depthData) {
        const { minDepth, maxDepth } = depthData;
        const depthRange = maxDepth - minDepth + 1;
        const depthPosition = currentDepth - minDepth + 1;
        
        // Weight distribution patterns by monster category
        const earlyMonsters = ['newt', 'bat', 'rat', 'spider', 'ant', 'gecko', 'jackal', 'cave_fish', 'slime', 'cave_beetle', 'cave_moth', 'glow_worm', 'cave_cricket', 'blind_salamander', 'mushroom_spore'];
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
            'newt': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'tight', packChance: 0.5 },
            // Ecosystem prey / detritivore
            'cave_fish': { type: 'swarm', minSize: 2, maxSize: 5, spacing: 'loose', packChance: 0.6 },
            'slime': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'loose', packChance: 0.4 },
            'cave_beetle': { type: 'swarm', minSize: 2, maxSize: 6, spacing: 'tight', packChance: 0.7 },
            'cave_moth': { type: 'swarm', minSize: 2, maxSize: 5, spacing: 'loose', packChance: 0.5 },
            'glow_worm': { type: 'swarm', minSize: 2, maxSize: 5, spacing: 'tight', packChance: 0.6 },
            'cave_cricket': { type: 'swarm', minSize: 2, maxSize: 5, spacing: 'loose', packChance: 0.6 },
            'blind_salamander': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'loose', packChance: 0.4 },
            'mushroom_spore': { type: 'swarm', minSize: 2, maxSize: 4, spacing: 'tight', packChance: 0.5 },
            'shrew': { type: 'swarm', minSize: 3, maxSize: 6, spacing: 'tight', packChance: 0.7 },
            'frog': { type: 'swarm', minSize: 2, maxSize: 5, spacing: 'loose', packChance: 0.5 },
            'cave_snail': { type: 'solitary', minSize: 1, maxSize: 1, spacing: 'alone', packChance: 0.0 },
            'scorpion': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'loose', packChance: 0.4 },
            'stirge': { type: 'swarm', minSize: 2, maxSize: 5, spacing: 'loose', packChance: 0.6 },
            'giant_frog': { type: 'pair', minSize: 1, maxSize: 2, spacing: 'loose', packChance: 0.3 },
            'carrion_crow': { type: 'pair', minSize: 1, maxSize: 3, spacing: 'loose', packChance: 0.5 }
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
     * Find an empty walkable tile adjacent to (x, y). Excludes player and other monsters.
     */
    findAdjacentEmptyTile(x, y, playerX, playerY) {
        const dirs = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
        const shuffled = dirs.slice().sort(() => Math.random() - 0.5);
        for (const [dx, dy] of shuffled) {
            const nx = x + dx;
            const ny = y + dy;
            if (!this.dungeon.isInBounds(nx, ny) || !this.dungeon.isWalkable(nx, ny)) continue;
            if (playerX !== undefined && playerY !== undefined && nx === playerX && ny === playerY) continue;
            if (this.getMonsterAt(nx, ny)) continue;
            return { x: nx, y: ny };
        }
        return null;
    }

    /**
     * Process breeding: creatures that meet conditions can spawn offspring. Called periodically by game.
     */
    processReproduction(game) {
        if (!game || typeof Ecosystem === 'undefined' || !Ecosystem.canBreed || !Ecosystem.getBreedChance) return;
        const turnCount = (game.player && game.player.turnCount != null) ? game.player.turnCount : 0;
        const currentDepth = game.currentLevel != null ? game.currentLevel : 1;
        const playerX = game.player ? game.player.x : undefined;
        const playerY = game.player ? game.player.y : undefined;
        const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];

        const living = this.getLivingMonsters().slice().sort(() => Math.random() - 0.5);
        for (const monster of living) {
            const mx = monster.x;
            const my = monster.y;
            let sameSpeciesAdjacent = 0;
            let hasVegetationNearby = false;
            let hasCorpseNearby = false;

            const tile = this.dungeon.getTile(mx, my);
            if (tile && tile.vegetation) hasVegetationNearby = true;
            if (game.itemManager && typeof game.itemManager.getItemsAt === 'function') {
                const itemsHere = game.itemManager.getItemsAt(mx, my) || [];
                if (itemsHere.some(it => it.type === 'corpse')) hasCorpseNearby = true;
            }
            for (const [dx, dy] of dirs) {
                const tx = mx + dx;
                const ty = my + dy;
                const t = this.dungeon.getTile(tx, ty);
                if (t && t.type === 'floor' && t.vegetation) hasVegetationNearby = true;
                const other = this.getMonsterAt(tx, ty);
                if (other && other !== monster && other.type === monster.type) sameSpeciesAdjacent++;
                if (game.itemManager && typeof game.itemManager.getItemsAt === 'function') {
                    const itemsThere = game.itemManager.getItemsAt(tx, ty) || [];
                    if (itemsThere.some(it => it.type === 'corpse')) hasCorpseNearby = true;
                }
            }

            if (!Ecosystem.canBreed(monster, turnCount, sameSpeciesAdjacent, hasVegetationNearby, hasCorpseNearby)) continue;
            if (Math.random() >= Ecosystem.getBreedChance(monster.type)) continue;

            const childPos = this.findAdjacentEmptyTile(mx, my, playerX, playerY);
            if (!childPos) continue;

            monster._lastBredTurn = turnCount;
            this.spawnSingleMonster(childPos.x, childPos.y, monster.type, currentDepth);
            if (game.renderer) {
                if (game.fov && game.fov.isVisible(childPos.x, childPos.y)) {
                    game.renderer.addLogMessage(`${monster.name} offspring appears!`);
                } else if (playerX != null && playerY != null && game.player) {
                    const dist = Math.max(Math.abs(childPos.x - playerX), Math.abs(childPos.y - playerY));
                    if (dist <= 6 && Math.random() < 0.4) {
                        game.renderer.addLogMessage('Something stirs in the shadows...');
                    }
                }
            }
            break;
        }
    }

    /**
     * Remove dead monsters
     */
    removeDeadMonsters() {
        this.monsters = this.monsters.filter(monster => monster.isAlive);
    }
} 