/**
 * Dungeon Ecosystem - genus-based relationships and roles
 * Relationships expressed by genus (属): who hunts whom, who fights back when cornered
 */

const Ecosystem = (function() {
    // Species ecological role (for behavior hints; relationships come from genus + explicit tables)
    const ROLES = {
        CARNIVORE: 'carnivore',   // Hunts other creatures
        HERBIVORE: 'herbivore',   // Eats plants/fungus (non-aggressive to creatures)
        OMNIVORE: 'omnivore',     // Eats both
        SCAVENGER: 'scavenger',   // Eats corpses, may attack wounded
        DETRITIVORE: 'detritivore', // Eats decay (slimes, fungi) - non-combat
        PREY: 'prey',            // Small, flees from predators, rarely attacks
        PARASITE: 'parasite',     // Attaches to host (special)
        NEUTRAL: 'neutral'        // Doesn't hunt; may defend if attacked
    };

    // Relationship from A's perspective toward B: 'predator' (A eats B), 'prey' (A flees B), 'neutral', 'ally', 'rival'
    function getRelationship(attackerType, targetType) {
        if (attackerType === targetType) return 'neutral';
        const pred = PREDATOR_PREY[attackerType];
        if (pred && pred.includes(targetType)) return 'predator';
        const prey = PREY_OF[attackerType];
        if (prey && prey.includes(targetType)) return 'prey';
        const rival = RIVALS[attackerType];
        if (rival && rival.includes(targetType)) return 'rival';
        const ally = ALLIES[attackerType];
        if (ally && ally.includes(targetType)) return 'ally';
        return 'neutral';
    }

    function getRole(type) {
        return SPECIES_ROLE[type] || ROLES.NEUTRAL;
    }

    function isHostileToPlayer(type) {
        return HOSTILE_TO_PLAYER[type] !== false;
    }

    // --- Genus (属): each species belongs to one genus; relationships are genus-level ---
    const SPECIES_GENUS = {
        rodent: ['rat', 'shrew'],
        chiropteran: ['bat'],
        amphibian: ['newt', 'frog', 'blind_salamander'],
        amphibian_large: ['giant_frog'],
        fish: ['cave_fish'],
        insect: ['cave_beetle', 'cave_moth', 'glow_worm', 'cave_cricket', 'ant'],
        arachnid: ['spider', 'scorpion'],
        myriapod: ['centipede'],
        mollusc: ['cave_snail'],
        reptilian: ['gecko', 'snake', 'lizardman'],
        canid: ['jackal', 'wolf'],
        ursid: ['bear'],
        humanoid_goblin: ['kobold', 'goblin', 'orc', 'hobgoblin', 'gnoll'],
        humanoid_civilized: ['dwarf', 'elf'],
        humanoid_large: ['ogre', 'troll', 'ettin', 'giant', 'frost_giant', 'minotaur'],
        undead: ['skeleton', 'zombie', 'wraith', 'lich', 'vampire'],
        ooze: ['slime'],
        fungus: ['mushroom_spore'],
        parasite: ['stirge'],
        avian_scavenger: ['carrion_crow'],
        draconic: ['wyvern', 'dragon', 'purple_worm'],
        fey: ['leprechaun', 'nymph', 'unicorn', 'centaur'],
        aberration: ['floating_eye', 'stalker', 'invisible_stalker', 'umber_hulk', 'rust_monster', 'xorn'],
        fiend: ['balrog'],
        other: ['yeti', 'medusa', 'sphinx', 'jabberwock']
    };
    // Flatten: type -> genus
    const TYPE_TO_GENUS = {};
    for (const [genus, types] of Object.entries(SPECIES_GENUS)) {
        for (const t of types) TYPE_TO_GENUS[t] = genus;
    }
    // Which genera hunt which (attacker genus -> [prey genera])
    const HUNTS_GENUS = {
        arachnid: ['insect', 'rodent', 'amphibian', 'mollusc'],
        myriapod: ['insect', 'amphibian', 'fungus', 'rodent'],
        reptilian: ['rodent', 'amphibian', 'fish', 'insect', 'chiropteran'],
        canid: ['rodent', 'amphibian', 'chiropteran', 'reptilian'],
        ursid: ['rodent', 'canid', 'reptilian', 'fish', 'amphibian'],
        chiropteran: ['insect', 'rodent', 'amphibian'],
        rodent: ['insect', 'mollusc', 'fungus'],
        insect: ['insect', 'amphibian', 'fungus'], // ant
        amphibian_large: ['rodent', 'amphibian', 'fish', 'insect'],
        parasite: ['rodent', 'chiropteran', 'fish', 'amphibian', 'reptilian'],
        humanoid_goblin: ['rodent', 'insect'],
        draconic: ['rodent', 'chiropteran', 'canid', 'reptilian', 'ursid'],
        undead: ['rodent', 'chiropteran', 'humanoid_goblin'],
        fiend: ['humanoid_goblin', 'humanoid_civilized', 'rodent', 'canid'],
        avian_scavenger: []  // scavenger, not hunter by genus
    };
    // Preyed by: for each genus G, list of genera that hunt G
    const PREYED_BY_GENUS = {};
    for (const [hunter, preys] of Object.entries(HUNTS_GENUS)) {
        for (const g of preys) {
            if (!PREYED_BY_GENUS[g]) PREYED_BY_GENUS[g] = [];
            if (!PREYED_BY_GENUS[g].includes(hunter)) PREYED_BY_GENUS[g].push(hunter);
        }
    }

    function getGenus(type) {
        return TYPE_TO_GENUS[type] || 'other';
    }

    function getPreyTypes(predatorType) {
        const explicit = PREDATOR_PREY[predatorType] || [];
        const myGen = getGenus(predatorType);
        const huntedGenera = HUNTS_GENUS[myGen];
        if (!huntedGenera || huntedGenera.length === 0) return explicit;
        const fromGenus = [];
        for (const [genus, types] of Object.entries(SPECIES_GENUS)) {
            if (huntedGenera.includes(genus)) fromGenus.push(...types);
        }
        const combined = [...new Set([...explicit, ...fromGenus])];
        return combined;
    }

    function getPredatorsOf(preyType) {
        const explicit = PREY_OF[preyType] || [];
        const myGen = getGenus(preyType);
        const hunterGenera = PREYED_BY_GENUS[myGen];
        if (!hunterGenera || hunterGenera.length === 0) return explicit;
        const fromGenus = [];
        for (const [genus, types] of Object.entries(SPECIES_GENUS)) {
            if (hunterGenera.includes(genus)) fromGenus.push(...types);
        }
        return [...new Set([...explicit, ...fromGenus])];
    }

    function prefersPreyOverPlayer(type) {
        return PREFER_PREY[type] === true;
    }

    function eatsVegetation(type) {
        return EATS_VEGETATION.indexOf(type) !== -1;
    }

    // --- Species that graze on vegetation (moss, lichen, fungus) ---
    const EATS_VEGETATION = [
        'rat', 'cave_beetle', 'cave_moth', 'glow_worm', 'cave_cricket', 'blind_salamander',
        'slime', 'mushroom_spore', 'ant', 'newt', 'gecko', 'cave_fish',
        'shrew', 'frog', 'cave_snail'
    ];

    // --- Species ecological role (affects spawn and behavior) ---
    const SPECIES_ROLE = {
        // Prey / small creatures (flee from predators, don't chase player aggressively)
        'newt': ROLES.PREY,
        'gecko': ROLES.PREY,
        'rat': ROLES.PREY,
        'bat': ROLES.PREY,
        'cave_fish': ROLES.PREY,
        'cave_beetle': ROLES.PREY,
        'cave_moth': ROLES.PREY,
        'glow_worm': ROLES.PREY,
        'cave_cricket': ROLES.PREY,
        'blind_salamander': ROLES.PREY,
        'mushroom_spore': ROLES.DETRITIVORE,
        'slime': ROLES.DETRITIVORE,
        'shrew': ROLES.PREY,
        'frog': ROLES.PREY,
        'cave_snail': ROLES.DETRITIVORE,

        // Carnivores (hunt prey)
        'spider': ROLES.CARNIVORE,
        'centipede': ROLES.CARNIVORE,
        'snake': ROLES.CARNIVORE,
        'jackal': ROLES.CARNIVORE,
        'wolf': ROLES.CARNIVORE,
        'bear': ROLES.CARNIVORE,
        'wyvern': ROLES.CARNIVORE,
        'purple_worm': ROLES.CARNIVORE,
        'dragon': ROLES.CARNIVORE,
        'scorpion': ROLES.CARNIVORE,
        'giant_frog': ROLES.CARNIVORE,

        // Scavengers (attracted to corpses, may attack wounded)
        'ant': ROLES.SCAVENGER,
        'zombie': ROLES.SCAVENGER,
        'carrion_crow': ROLES.SCAVENGER,

        // Parasite / blood-seeker (attacks wounded, drawn to blood)
        'stirge': ROLES.PARASITE,

        // Humanoids / intelligent (neutral to most beasts, hostile to player)
        'kobold': ROLES.OMNIVORE,
        'goblin': ROLES.OMNIVORE,
        'orc': ROLES.OMNIVORE,
        'dwarf': ROLES.OMNIVORE,
        'elf': ROLES.OMNIVORE,
        'hobgoblin': ROLES.OMNIVORE,
        'gnoll': ROLES.OMNIVORE,
        'lizardman': ROLES.OMNIVORE,
        'ogre': ROLES.OMNIVORE,
        'troll': ROLES.OMNIVORE,
        'minotaur': ROLES.OMNIVORE,
        'giant': ROLES.OMNIVORE,
        'frost_giant': ROLES.OMNIVORE,

        // Undead / special
        'skeleton': ROLES.NEUTRAL,
        'wraith': ROLES.NEUTRAL,
        'vampire': ROLES.CARNIVORE,
        'lich': ROLES.NEUTRAL,
        'floating_eye': ROLES.NEUTRAL,
        'leprechaun': ROLES.NEUTRAL,
        'nymph': ROLES.NEUTRAL,
        'unicorn': ROLES.HERBIVORE,
        'centaur': ROLES.OMNIVORE,
        'yeti': ROLES.CARNIVORE,
        'stalker': ROLES.CARNIVORE,
        'invisible_stalker': ROLES.CARNIVORE,
        'rust_monster': ROLES.DETRITIVORE,
        'xorn': ROLES.DETRITIVORE,
        'umber_hulk': ROLES.CARNIVORE,
        'ettin': ROLES.OMNIVORE,
        'medusa': ROLES.CARNIVORE,
        'sphinx': ROLES.NEUTRAL,
        'jabberwock': ROLES.CARNIVORE,
        'balrog': ROLES.CARNIVORE
    };

    // Who does this type hunt? (predator -> [prey types])
    const PREDATOR_PREY = {
        'spider': ['rat', 'bat', 'cave_beetle', 'cave_moth', 'cave_cricket', 'glow_worm', 'newt', 'gecko', 'shrew', 'frog'],
        'centipede': ['cave_beetle', 'cave_cricket', 'glow_worm', 'newt', 'gecko', 'mushroom_spore', 'shrew'],
        'snake': ['rat', 'bat', 'cave_beetle', 'cave_cricket', 'newt', 'gecko', 'blind_salamander', 'cave_fish', 'shrew', 'frog'],
        'jackal': ['rat', 'newt', 'gecko', 'cave_cricket', 'blind_salamander', 'shrew', 'frog'],
        'wolf': ['rat', 'bat', 'jackal', 'newt', 'gecko', 'cave_cricket', 'blind_salamander', 'shrew', 'frog'],
        'bear': ['rat', 'wolf', 'jackal', 'snake', 'cave_fish', 'blind_salamander'],
        'bat': ['cave_moth', 'glow_worm', 'cave_beetle', 'shrew', 'frog'],
        'rat': ['cave_beetle', 'cave_cricket', 'glow_worm', 'mushroom_spore', 'shrew'],
        'ant': ['cave_beetle', 'cave_cricket', 'newt', 'gecko', 'glow_worm', 'mushroom_spore', 'shrew'],
        'scorpion': ['shrew', 'frog', 'cave_beetle', 'cave_cricket', 'glow_worm', 'newt', 'gecko', 'cave_snail'],
        'stirge': ['rat', 'bat', 'shrew', 'frog', 'cave_fish', 'newt', 'gecko'],
        'giant_frog': ['shrew', 'rat', 'frog', 'cave_fish', 'cave_beetle', 'cave_cricket', 'newt', 'gecko', 'cave_moth'],
        'wyvern': ['rat', 'bat', 'jackal', 'snake', 'wolf', 'cave_fish'],
        'purple_worm': ['rat', 'bat', 'wolf', 'jackal', 'snake', 'bear', 'cave_fish', 'blind_salamander'],
        'dragon': ['rat', 'bat', 'wolf', 'jackal', 'bear', 'snake', 'wyvern'],
        'yeti': ['rat', 'wolf', 'jackal', 'bear', 'blind_salamander'],
        'vampire': ['rat', 'bat', 'kobold', 'goblin', 'orc'],
        'goblin': ['rat', 'cave_beetle', 'cave_cricket'],
        'kobold': ['rat', 'cave_beetle', 'cave_cricket', 'glow_worm'],
        'orc': ['rat', 'wolf', 'jackal', 'kobold', 'goblin'],
        'hobgoblin': ['rat', 'goblin', 'kobold'],
        'gnoll': ['jackal', 'rat', 'goblin', 'kobold'],
        'ogre': ['rat', 'wolf', 'goblin', 'kobold', 'orc'],
        'troll': ['rat', 'wolf', 'goblin', 'orc'],
        'umber_hulk': ['rat', 'ant', 'cave_beetle', 'kobold', 'goblin'],
        'medusa': ['rat', 'bat', 'snake', 'kobold', 'goblin'],
        'jabberwock': ['wolf', 'bear', 'rat', 'snake'],
        'balrog': ['kobold', 'goblin', 'orc', 'dwarf', 'elf', 'rat', 'wolf']
    };

    // Who preys on this type? (prey -> [predator types])
    const PREY_OF = {};
    (function() {
        for (const [pred, preys] of Object.entries(PREDATOR_PREY)) {
            for (const p of preys) {
                if (!PREY_OF[p]) PREY_OF[p] = [];
                if (!PREY_OF[p].includes(pred)) PREY_OF[p].push(pred);
            }
        }
    })();

    // Factions: same faction don't attack each other (optional, for flavor)
    const ALLIES = {
        'goblin': ['kobold', 'hobgoblin', 'orc'],
        'kobold': ['goblin', 'orc'],
        'orc': ['goblin', 'kobold', 'hobgoblin', 'gnoll'],
        'hobgoblin': ['goblin', 'orc'],
        'gnoll': ['orc'],
        'dwarf': ['elf'],
        'elf': ['dwarf'],
        'skeleton': ['zombie', 'wraith'],
        'zombie': ['skeleton', 'wraith'],
        'wraith': ['skeleton', 'zombie']
    };

    // Rivals: may attack on sight (territory / food)
    const RIVALS = {
        'wolf': ['bear', 'jackal'],
        'bear': ['wolf'],
        'jackal': ['wolf'],
        'goblin': ['dwarf', 'elf'],
        'orc': ['dwarf', 'elf'],
        'dwarf': ['goblin', 'orc', 'troll'],
        'elf': ['goblin', 'orc'],
        'troll': ['dwarf', 'elf'],
        'kobold': ['rat']  // compete for same tunnels
    };

    // Creatures that don't attack player unless attacked (neutral / prey / detritivore)
    const HOSTILE_TO_PLAYER = {};
    (function() {
        const nonHostile = ['cave_fish', 'cave_beetle', 'cave_moth', 'glow_worm', 'cave_cricket', 'blind_salamander', 'mushroom_spore', 'slime', 'shrew', 'frog', 'cave_snail'];
        for (const t of Object.keys(SPECIES_ROLE)) {
            HOSTILE_TO_PLAYER[t] = !nonHostile.includes(t);
        }
        for (const t of nonHostile) {
            HOSTILE_TO_PLAYER[t] = false;
        }
    })();

    // Predators that prefer chasing nearby prey over chasing player (makes dungeon feel alive)
    const PREFER_PREY = {
        'spider': true,
        'centipede': true,
        'snake': true,
        'jackal': true,
        'wolf': true,
        'bat': true,
        'rat': true,
        'ant': true,
        'scorpion': true,
        'stirge': true,
        'giant_frog': true
    };

    // --- Breeding: species that can reproduce and conditions ---
    const CAN_BREED = [
        'rat', 'bat', 'newt', 'gecko', 'cave_fish', 'cave_beetle', 'cave_moth', 'glow_worm', 'cave_cricket',
        'blind_salamander', 'slime', 'mushroom_spore', 'ant', 'spider', 'centipede', 'snake',
        'jackal', 'wolf', 'kobold', 'goblin', 'orc',
        'shrew', 'frog', 'cave_snail', 'stirge'
    ];
    const BREED_NEEDS_MATE = [
        'wolf', 'jackal', 'kobold', 'goblin', 'orc', 'snake', 'bat', 'spider', 'ant', 'stirge'
    ];
    const BREED_NEEDS_VEGETATION = [
        'rat', 'newt', 'gecko', 'cave_beetle', 'cave_moth', 'glow_worm', 'cave_cricket', 'blind_salamander',
        'slime', 'mushroom_spore', 'cave_fish', 'shrew', 'frog', 'cave_snail'
    ];
    const BREED_COOLDOWN = {
        'ant': 50, 'rat': 55, 'cave_beetle': 60, 'cave_cricket': 60, 'glow_worm': 60,
        'slime': 70, 'mushroom_spore': 65, 'cave_fish': 60, 'newt': 70, 'gecko': 70,
        'cave_moth': 65, 'blind_salamander': 75, 'bat': 70, 'spider': 75, 'centipede': 75,
        'snake': 85, 'jackal': 80, 'wolf': 90, 'kobold': 100, 'goblin': 95, 'orc': 100,
        'shrew': 50, 'frog': 55, 'cave_snail': 80, 'stirge': 55
    };

    function canBreed(monster, turnCount, sameSpeciesAdjacent, hasVegetationNearby, hasCorpseNearby) {
        if (!monster || !monster.isAlive || !CAN_BREED.includes(monster.type)) return false;
        const lastBred = monster._lastBredTurn != null ? monster._lastBredTurn : -999;
        const cooldown = BREED_COOLDOWN[monster.type] || 80;
        if (turnCount - lastBred < cooldown) return false;
        if (BREED_NEEDS_MATE.includes(monster.type) && sameSpeciesAdjacent < 1) return false;
        if (BREED_NEEDS_VEGETATION.includes(monster.type) && !hasVegetationNearby) return false;
        return true;
    }

    function getBreedChance(type) {
        const fast = ['ant', 'rat', 'cave_beetle', 'cave_cricket', 'glow_worm', 'slime', 'mushroom_spore', 'shrew', 'frog', 'stirge'];
        return fast.includes(type) ? 0.35 : 0.22;
    }

    /**
     * Chance that prey fights back when adjacent to a predator (instead of only fleeing).
     * Higher when cornered; genera of comparable size (e.g. rodent vs bat) fight back more often.
     */
    function getFightBackChance(preyType, predatorType, isCornered) {
        const preyGen = getGenus(preyType);
        const predGen = getGenus(predatorType);
        if (isCornered) return 0.65; // high when no escape
        const comparable = (
            (preyGen === 'rodent' && (predGen === 'chiropteran' || predGen === 'arachnid' || predGen === 'parasite')) ||
            (preyGen === 'amphibian' && (predGen === 'insect' || predGen === 'arachnid' || predGen === 'myriapod')) ||
            (preyGen === 'insect' && (predGen === 'parasite' || predGen === 'myriapod'))
        );
        if (comparable) return 0.35;
        return 0.14; // default: sometimes fight back even vs larger predator
    }

    return {
        ROLES,
        getRelationship,
        getRole,
        isHostileToPlayer,
        getPreyTypes,
        getPredatorsOf,
        getGenus,
        getFightBackChance,
        prefersPreyOverPlayer,
        eatsVegetation,
        EATS_VEGETATION,
        canBreed,
        getBreedChance,
        CAN_BREED,
        BREED_NEEDS_MATE,
        BREED_NEEDS_VEGETATION,
        SPECIES_ROLE,
        SPECIES_GENUS,
        TYPE_TO_GENUS,
        PREDATOR_PREY,
        PREY_OF,
        ALLIES,
        RIVALS
    };
})();
