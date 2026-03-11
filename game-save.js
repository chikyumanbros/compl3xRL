/**
 * Game save/load and autosave helpers
 * Extracted from Game class for modularity.
 */
(function () {
    if (typeof Game === 'undefined') {
        console.error('Game class not found for save helpers.');
        return;
    }

    const GameRef = Game;

    // ===== AUTOSAVE SYSTEM =====

    /**
     * Check if autosave exists
     */
    GameRef.prototype.hasAutosave = function() {
        try {
            const saveData = localStorage.getItem(this.saveKey);
            return saveData !== null;
        } catch (error) {
            return false;
        }
    };

    /**
     * Prompt player to load autosave using sub-window
     */
    GameRef.prototype.promptLoadAutosave = function() {
        if (!window.subWindow) {
            const loadSave = confirm('Autosave found! Do you want to continue your previous game?');
            this.handleLoadAutosaveChoice(loadSave);
            return;
        }

        // Use sub-window for load prompt with y/n key input
        window.subWindow.showDialog(
            'Continue Previous Game?',
            `<div style="text-align: center; padding: 20px;">
                <p style="font-size: 16px; margin-bottom: 20px;">Autosave found!</p>
                <p style="margin-bottom: 20px;">Do you want to continue your previous game?</p>
                <p style="font-size: 14px; color: #888;">Press Y for Yes, N for No, or ESC to cancel</p>
            </div>`,
            null, // No callback needed
            (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                if (e.key.toLowerCase() === 'y') {
                    window.subWindow.close();
                    this.handleLoadAutosaveChoice(true);
                } else if (e.key.toLowerCase() === 'n') {
                    window.subWindow.close();
                    this.handleLoadAutosaveChoice(false);
                }
            }
        );
    };

    /**
     * Handle the choice for loading autosave
     */
    GameRef.prototype.handleLoadAutosaveChoice = function(loadSave) {
        if (loadSave) {
            if (this.loadGame()) {
                this.renderer.addLogMessage('Game loaded from autosave!');
                // Verify load was successful
                if (!this.player || !this.dungeon) {
                    this.generateNewLevel();
                } else {
                    // Update display after loading
                    this.updateFOV();
                    this.startRendering();
                }
            } else {
                this.renderer.addLogMessage('Failed to load autosave, starting new game.');
                this.generateNewLevel();
            }
        } else {
            this.generateNewLevel();
        }
        
        // Ensure game is properly initialized after choice
        if (!this.player || !this.dungeon) {
            this.generateNewLevel();
        }
    };

    /**
     * Save complete game state
     */
    GameRef.prototype.saveGame = function() {
        try {
            // Save current level state first
            this.saveLevelState();
            
            // Prepare complete game state
            const gameState = {
                version: '1.0',
                timestamp: Date.now(),
                currentLevel: this.currentLevel,
                previousLevel: this.previousLevel,
                gameState: this.gameState,
                visitedLevels: Array.from(this.visitedLevels),
                
                // Player state
                player: this.player ? {
                    x: this.player.x,
                    y: this.player.y,
                    level: this.player.level,
                    hp: this.player.hp,
                    maxHp: this.player.maxHp,
                    mp: this.player.mp,
                    maxMp: this.player.maxMp,
                    exp: this.player.exp,
                    expToNext: this.player.expToNext,
                    // Speed system
                    baseSpeed: this.player.baseSpeed,
                    speed: this.player.speed,
                    energy: this.player.energy,
                    energyToAct: this.player.energyToAct,
                    
                    // Ability scores
                    strength: this.player.strength,
                    dexterity: this.player.dexterity,
                    constitution: this.player.constitution,
                    intelligence: this.player.intelligence,
                    wisdom: this.player.wisdom,
                    charisma: this.player.charisma,
                    
                    // Combat stats
                    toHit: this.player.toHit,
                    baseToHit: this.player.baseToHit,
                    armorClass: this.player.armorClass,
                    damage: this.player.damage,
                    weaponDamage: this.player.weaponDamage,
                    penetration: this.player.penetration,
                    totalProtection: this.player.totalProtection,
                    blockChance: this.player.blockChance,
                    
                    // Game mechanics
                    turnCount: this.player.turnCount,
                    lastRegenTurn: this.player.lastRegenTurn,
                    regenInterval: this.player.regenInterval,
                    regenAmount: this.player.regenAmount,
                    
                    // Equipment and inventory
                    equipment: this.player.equipment,
                    inventory: this.player.inventory,
                    maxInventorySize: this.player.maxInventorySize,
                    
                    // Hunger system (classic roguelike - NetHack style)
                    nutrition: this.player.nutrition,
                    maxNutrition: this.player.maxNutrition,
                    hungerTimer: this.player.hungerTimer,
                    
                    // Weight system
                    currentWeight: this.player.currentWeight,
                    maxWeight: this.player.maxWeight,
                    
                    // Status effects
                    statusEffects: this.player.statusEffects ? {
                        effects: Array.from(this.player.statusEffects.effects.entries()).map(([type, effect]) => ({
                            type: type,
                            duration: effect.duration,
                            severity: effect.severity,
                            source: effect.source
                        })),
                        immunities: Array.from(this.player.statusEffects.immunities),
                        savingThrowBonus: this.player.statusEffects.savingThrowBonus
                    } : null
                } : null,
                
                // Level data (serialize Map to array)
                levels: Array.from(this.levels.entries()).map(([levelNum, levelData]) => ([
                    levelNum,
                    {
                        // Serialize level data
                        dungeonData: this.serializeDungeon(levelData.dungeon),
                        monsterData: this.serializeMonsters(levelData.monsterSpawner),
                        itemData: this.serializeItems(levelData.itemManager),
                        fovState: levelData.fovState,
                        timestamp: levelData.timestamp
                    }
                ]))
            };
            
            // Save to localStorage
            localStorage.setItem(this.saveKey, JSON.stringify(gameState));
            this.lastAutosave = Date.now();
            
            // Only log manual saves or important autosaves
            if (this.isManualSave) {
                this.isManualSave = false; // Reset flag
            } else {
                // Silent autosave, only log errors
            }
            return true;
            
        } catch (error) {
            console.error('Error saving game:', error);
            this.renderer.addLogMessage('Failed to save game!');
            return false;
        }
    };

    /**
     * Load complete game state
     */
    GameRef.prototype.loadGame = function() {
        try {
            const saveData = localStorage.getItem(this.saveKey);
            if (!saveData) {
                return false;
            }
            
            const gameState = JSON.parse(saveData);
            
            // Restore basic game state
            this.currentLevel = gameState.currentLevel;
            this.previousLevel = gameState.previousLevel;
            this.gameState = gameState.gameState;
            this.visitedLevels = new Set(gameState.visitedLevels);
            
            // Restore player
            if (gameState.player) {
                this.player = this.deserializePlayer(gameState.player);
            }
            
            // Restore levels
            this.levels.clear();
            if (gameState.levels) {
                gameState.levels.forEach(([levelNum, levelData]) => {
                    // Restore dungeon first
                    const dungeon = this.deserializeDungeon(levelData.dungeonData);
                    
                    // Then restore other systems with proper dungeon reference
                    const monsterSpawner = this.deserializeMonsters(levelData.monsterData, dungeon);
                    const itemManager = this.deserializeItems(levelData.itemData, dungeon);
                    
                    this.levels.set(levelNum, {
                        dungeon: dungeon,
                        monsterSpawner: monsterSpawner,
                        itemManager: itemManager,
                        fovState: levelData.fovState,
                        timestamp: levelData.timestamp
                    });
                });
            }
            
            // Load current level
            if (this.levels.has(this.currentLevel)) {
                this.loadLevel(this.currentLevel, true); // Preserve saved player position
            } else {
                this.generateNewLevel();
            }
            
            // Ensure FOV is updated with restored player position
            this.updateFOV();
            
            return true;
            
        } catch (error) {
            console.error('Error loading game:', error);
            return false;
        }
    };

    /**
     * Start autosave timer (now used for periodic cleanup and backup)
     */
    GameRef.prototype.startAutosaveTimer = function() {
        if (!this.autosaveEnabled) return;
        
        // Since we save immediately after every action, this timer is now used for:
        // - Periodic cleanup
        // - Backup verification

        setInterval(() => {
            if (this.gameState === 'playing' && this.player) {
                // Verify save integrity occasionally
                const hasValidSave = this.hasAutosave();
                if (!hasValidSave) {
                    this.saveGame();
                }
            }
        }, 30000); // Check every 30 seconds for integrity
    };

    /**
     * Delete autosave (for new game)
     */
    GameRef.prototype.deleteAutosave = function() {
        try {
            localStorage.removeItem(this.saveKey);
        } catch (error) {
        }
    };

    // ===== SERIALIZATION METHODS =====

    /**
     * Serialize dungeon data for saving
     */
    GameRef.prototype.serializeDungeon = function(dungeon) {
        if (!dungeon) return null;
        
        return {
            width: dungeon.width,
            height: dungeon.height,
            tiles: dungeon.tiles, // includes trap metadata if present
            rooms: dungeon.rooms
        };
    };

    /**
     * Deserialize dungeon data
     */
    GameRef.prototype.deserializeDungeon = function(dungeonData) {
        if (!dungeonData) return null;
        
        // Create new dungeon instance
        const dungeon = new Dungeon();
        dungeon.width = dungeonData.width;
        dungeon.height = dungeonData.height;
        dungeon.tiles = dungeonData.tiles;
        dungeon.rooms = dungeonData.rooms;
        
        return dungeon;
    };

    /**
     * Serialize monster spawner data
     */
    GameRef.prototype.serializeMonsters = function(monsterSpawner) {
        if (!monsterSpawner) return null;
        
        return {
            monsters: monsterSpawner.monsters.map(monster => ({
                x: monster.x,
                y: monster.y,
                type: monster.type,
                name: monster.name,
                symbol: monster.symbol,
                color: monster.color,
                hp: monster.hp,
                maxHp: monster.maxHp,
                toHit: monster.toHit,
                armorClass: monster.armorClass,
                damage: monster.damage,
                weaponDamage: monster.weaponDamage,
                expValue: monster.expValue,
                isAlive: monster.isAlive,
                minDepth: monster.minDepth,
                maxDepth: monster.maxDepth,
                // Pack/group metadata
                packId: monster.packId,
                packType: monster.packType,
                isLeader: !!monster.isLeader,
                // AI state
                lastSeenPlayerX: monster.lastSeenPlayerX,
                lastSeenPlayerY: monster.lastSeenPlayerY,
                turnsWithoutSeeingPlayer: monster.turnsWithoutSeeingPlayer,
                sightRange: monster.sightRange,
                giveUpTurns: monster.giveUpTurns,
                // Sleep state
                isAsleep: monster.isAsleep,
                wakeUpDistance: monster.wakeUpDistance,
                hasEverWokenUp: monster.hasEverWokenUp,
                sleepDepth: monster.sleepDepth,
                justWokeUp: monster.justWokeUp,
                // Speed system
                speed: monster.speed,
                energy: monster.energy,
                energyToAct: monster.energyToAct,
                // Intelligence and fleeing system
                intelligence: monster.intelligence,
                isFleeing: monster.isFleeing,
                fleeThreshold: monster.fleeThreshold,
                // Fleeing personality system
                fleePersonality: monster.fleePersonality,
                fleeDuration: monster.fleeDuration,
                fleeStamina: monster.fleeStamina,
                fleeStyle: monster.fleeStyle,
                returnCourage: monster.returnCourage,
                fleeTimer: monster.fleeTimer,
                // Saving throw stats
                constitution: monster.constitution,
                wisdom: monster.wisdom,
                strength: monster.strength,
                // Status effects
                statusEffects: monster.statusEffects ? {
                    effects: Array.from(monster.statusEffects.effects.entries()).map(([type, effect]) => ({
                        type: type,
                        duration: effect.duration,
                        severity: effect.severity,
                        source: effect.source
                    })),
                    immunities: Array.from(monster.statusEffects.immunities),
                    savingThrowBonus: monster.statusEffects.savingThrowBonus
                } : null
            }))
        };
    };

    /**
     * Deserialize monster spawner data
     */
    GameRef.prototype.deserializeMonsters = function(monsterData, dungeon = null) {
        if (!monsterData) return null;
        
        // Create new monster spawner with proper dungeon reference
        const targetDungeon = dungeon || this.dungeon;
        if (!targetDungeon) {
            return null;
        }
        const monsterSpawner = new MonsterSpawner(targetDungeon);
        monsterSpawner.monsters = monsterData.monsters.map(monsterInfo => {
            const monster = new Monster(monsterInfo.x, monsterInfo.y, monsterInfo.type);
            
            // Restore all properties
            monster.name = monsterInfo.name;
            monster.symbol = monsterInfo.symbol;
            monster.color = monsterInfo.color;
            monster.hp = monsterInfo.hp;
            monster.maxHp = monsterInfo.maxHp;
            monster.toHit = monsterInfo.toHit;
            monster.armorClass = monsterInfo.armorClass;
            monster.damage = monsterInfo.damage;
            monster.weaponDamage = monsterInfo.weaponDamage;
            monster.expValue = monsterInfo.expValue;
            monster.isAlive = monsterInfo.isAlive;
            monster.minDepth = monsterInfo.minDepth;
            monster.maxDepth = monsterInfo.maxDepth;
            // Pack/group metadata
            monster.packId = monsterInfo.packId || null;
            monster.packType = monsterInfo.packType || 'solitary';
            
            // Restore AI state
            monster.lastSeenPlayerX = monsterInfo.lastSeenPlayerX || null;
            monster.lastSeenPlayerY = monsterInfo.lastSeenPlayerY || null;
            monster.turnsWithoutSeeingPlayer = monsterInfo.turnsWithoutSeeingPlayer || 0;
            monster.sightRange = monsterInfo.sightRange || 8;
            monster.giveUpTurns = monsterInfo.giveUpTurns || 5;
            
            // Restore sleep state
            monster.isAsleep = monsterInfo.isAsleep !== undefined ? monsterInfo.isAsleep : true;
            monster.wakeUpDistance = monsterInfo.wakeUpDistance || 1;
            monster.hasEverWokenUp = monsterInfo.hasEverWokenUp || false;
            monster.sleepDepth = monsterInfo.sleepDepth || 'normal';
            monster.justWokeUp = monsterInfo.justWokeUp || false;
            
            // Restore speed system
            monster.speed = monsterInfo.speed || 100;
            monster.energy = monsterInfo.energy || 0;
            monster.energyToAct = monsterInfo.energyToAct || 100;
            
            // Restore intelligence and fleeing system
            monster.intelligence = monsterInfo.intelligence || 'normal';
            monster.isFleeing = monsterInfo.isFleeing || false;
            monster.fleeThreshold = monsterInfo.fleeThreshold || 0.25;
            
            // Restore fleeing personality system
            monster.fleePersonality = monsterInfo.fleePersonality || 'normal';
            monster.fleeDuration = monsterInfo.fleeDuration || 10;
            monster.fleeStamina = monsterInfo.fleeStamina || 1.0;
            monster.fleeStyle = monsterInfo.fleeStyle || 'direct';
            monster.returnCourage = monsterInfo.returnCourage || 0.5;
            monster.fleeTimer = monsterInfo.fleeTimer || 0;
            
            // Restore pack metadata
            monster.packId = monsterInfo.packId || null;
            monster.packType = monsterInfo.packType || 'solitary';
            monster.isLeader = !!monsterInfo.isLeader;

            // Restore saving throw stats
            monster.constitution = monsterInfo.constitution || 10;
            monster.wisdom = monsterInfo.wisdom || 10;
            monster.strength = monsterInfo.strength || 10;
            
            // Restore status effects
            if (monsterInfo.statusEffects && monsterInfo.statusEffects.effects) {
                // Create new StatusEffectManager if it doesn't exist
                if (!monster.statusEffects) {
                    monster.statusEffects = new StatusEffectManager(monster);
                }
                
                // Restore immunities
                if (monsterInfo.statusEffects.immunities) {
                    monster.statusEffects.immunities = new Set(monsterInfo.statusEffects.immunities);
                }
                
                // Restore saving throw bonus
                if (monsterInfo.statusEffects.savingThrowBonus !== undefined) {
                    monster.statusEffects.savingThrowBonus = monsterInfo.statusEffects.savingThrowBonus;
                }
                
                // Restore active effects
                monsterInfo.statusEffects.effects.forEach(effectData => {
                    monster.statusEffects.addEffect(
                        effectData.type, 
                        effectData.duration, 
                        effectData.severity, 
                        effectData.source
                    );
                });
            }
            
            return monster;
        });
        // Rebuild pack registry for morale after load
        if (typeof monsterSpawner.rebuildPacksFromMonsters === 'function') {
            monsterSpawner.rebuildPacksFromMonsters();
        }
        
        return monsterSpawner;
    };

    /**
     * Serialize item manager data
     */
    GameRef.prototype.serializeItems = function(itemManager) {
        if (!itemManager) return null;
        
        try {
            const serializedItems = itemManager.getAllItems().map(item => {
                return {
                    type: item.type,
                    name: item.name,
                    description: item.description,
                    x: item.x,
                    y: item.y,
                    symbol: item.symbol,
                    color: item.color,
                    stackable: item.stackable,
                    quantity: item.quantity,
                    maxStackSize: item.maxStackSize,
                    weight: item.weight,
                    
                    // Equipment specific properties
                    damage: item.damage,
                    weaponDamage: item.weaponDamage,
                    toHitBonus: item.toHitBonus,
                    armorClassBonus: item.armorClassBonus,
                    enchantment: item.enchantment,
                    material: item.material,
                    quality: item.quality,
                    properties: item.properties,
                    cursed: item.cursed,
                    identified: item.identified,
                    value: item.value,
                    
                    // Durability system
                    durability: item.durability,
                    maxDurability: item.maxDurability,
                    currentDurability: item.currentDurability,
                    
                    // Weapon type and combat properties
                    weaponType: item.weaponType,
                    penetration: item.penetration,
                    protection: item.protection,
                    blockChance: item.blockChance,
                    resistances: item.resistances,
                    
                    // Food specific properties
                    nutrition: item.nutrition,
                    healAmount: item.healAmount,
                    perishable: item.perishable,
                    freshness: item.freshness,
                    
                    // Item class type for reconstruction
                    itemClass: item.constructor.name,
                    
                    // Visibility tracking
                    hasBeenSeen: item.hasBeenSeen,
                    lastSeenTurn: item.lastSeenTurn
                };
            });
            
            return {
                items: serializedItems
            };
        } catch (error) {
            console.error('Error serializing items:', error);
            return { items: [] };
        }
    };

    /**
     * Deserialize item manager data
     */
    GameRef.prototype.deserializeItems = function(itemData, dungeon = null) {
        if (!itemData) return null;
        
        try {
            // Create new item manager with proper dungeon reference
            const targetDungeon = dungeon || this.dungeon;
            if (!targetDungeon) {
                return null;
            }
            const itemManager = new ItemManager(targetDungeon);
            
            // Restore items
            if (itemData.items && Array.isArray(itemData.items)) {
                itemData.items.forEach(itemInfo => {
                    let item = null;
                    
                    try {
                        // Recreate item based on its class type
                        switch (itemInfo.itemClass) {
                            case 'EquipmentItem':
                                // Check if this is an old format item (missing quality/durability)
                                if (!itemInfo.quality && itemInfo.type !== 'potion' && itemInfo.type !== 'food') {
                                    // Try to recreate using EquipmentManager to get new properties
                                    const categoryMap = {
                                        'weapon': 'weapons',
                                        'armor': 'armor', 
                                        'shield': 'shields',
                                        'helmet': 'helmets',
                                        'gloves': 'gloves',
                                        'boots': 'boots',
                                        'ring': 'rings',
                                        'amulet': 'amulets'
                                    };
                                    
                                    const category = categoryMap[itemInfo.type];
                                    if (category && typeof EquipmentManager !== 'undefined') {
                                        // Find the item key that matches this item's name
                                        const equipmentTypes = EQUIPMENT_TYPES[category];
                                        if (equipmentTypes) {
                                            const itemKey = Object.keys(equipmentTypes).find(key => 
                                                equipmentTypes[key].name === itemInfo.name
                                            );
                                            
                                            if (itemKey) {
                                                const enchantment = itemInfo.enchantment || 0;
                                                item = EquipmentManager.createEquipment(category, itemKey, enchantment);
                                                if (item) {
                                                    // Preserve position and visibility state
                                                    item.x = itemInfo.x;
                                                    item.y = itemInfo.y;
                                                    item.hasBeenSeen = itemInfo.hasBeenSeen;
                                                    item.lastSeenTurn = itemInfo.lastSeenTurn;
                                                    console.log(`Converted old format item: ${itemInfo.name} to new format with quality: ${item.quality}`);
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                }
                                // Fallback to original creation if conversion fails
                                item = new EquipmentItem(itemInfo.name, itemInfo);
                                break;
                            case 'FoodItem':
                                item = new FoodItem(itemInfo.name, itemInfo);
                                break;
                            default:
                                item = new Item(itemInfo.type, itemInfo.name, itemInfo);
                                break;
                        }
                        
                        if (item) {
                            // Ensure coordinates are valid
                            if (typeof itemInfo.x === 'number' && typeof itemInfo.y === 'number') {
                                item.x = itemInfo.x;
                                item.y = itemInfo.y;
                                
                                // Restore visibility state
                                if (typeof itemInfo.hasBeenSeen === 'boolean') {
                                    item.hasBeenSeen = itemInfo.hasBeenSeen;
                                }
                                if (typeof itemInfo.lastSeenTurn === 'number') {
                                    item.lastSeenTurn = itemInfo.lastSeenTurn;
                                }
                                
                                itemManager.addItem(item);
                            } else {
                                // Invalid coordinates, skip
                            }
                        }
                    } catch (error) {
                        // Skip problematic item but continue loading others
                    }
                });
            }
            
            return itemManager;
        } catch (error) {
            console.error('Error deserializing items:', error);
            // Return empty item manager on error
            return new ItemManager(this.dungeon);
        }
    };

    /**
     * Deserialize player data
     */
    GameRef.prototype.deserializePlayer = function(playerData) {
        if (!playerData) return null;
        
        // Create new player instance
        const player = new Player(playerData.x, playerData.y);
        
        // Restore all player properties
        player.level = playerData.level;
        player.hp = playerData.hp;
        player.maxHp = playerData.maxHp;
        player.mp = playerData.mp;
        player.maxMp = playerData.maxMp;
        player.exp = playerData.exp;
        player.expToNext = playerData.expToNext;
        
        // Restore speed system
        player.baseSpeed = playerData.baseSpeed || 100;
        player.speed = playerData.speed || 100;
        player.energy = playerData.energy || 100;
        player.energyToAct = playerData.energyToAct || 100;
        
        // Ability scores
        player.strength = playerData.strength;
        player.dexterity = playerData.dexterity;
        player.constitution = playerData.constitution;
        player.intelligence = playerData.intelligence;
        player.wisdom = playerData.wisdom;
        player.charisma = playerData.charisma;
        
        // Combat stats
        player.toHit = playerData.toHit;
        player.baseToHit = playerData.baseToHit || playerData.toHit; // Fallback for old saves
        player.armorClass = playerData.armorClass;
        player.damage = playerData.damage;
        player.weaponDamage = playerData.weaponDamage;
        player.penetration = playerData.penetration || 0;
        player.totalProtection = playerData.totalProtection || 0;
        player.blockChance = playerData.blockChance || 0;
        
        // Game mechanics
        player.turnCount = playerData.turnCount;
        player.lastRegenTurn = playerData.lastRegenTurn;
        player.regenInterval = playerData.regenInterval;
        player.regenAmount = playerData.regenAmount;
        
        // Equipment and inventory
        player.equipment = playerData.equipment || {};
        player.inventory = playerData.inventory || [];
        player.maxInventorySize = playerData.maxInventorySize || 26;
        
        // Restore hunger system
        player.nutrition = playerData.nutrition || 500;
        player.maxNutrition = playerData.maxNutrition || 2000;
        player.hungerTimer = playerData.hungerTimer || 0;
        
        // Restore weight system
        player.currentWeight = playerData.currentWeight || 0;
        player.maxWeight = playerData.maxWeight || 0;
        if (player.maxWeight === 0) {
            player.calculateWeightCapacity(); // Recalculate if missing
        }
        
        // Restore status effects
        if (playerData.statusEffects && playerData.statusEffects.effects) {
            // Create new StatusEffectManager if it doesn't exist
            if (!player.statusEffects) {
                player.statusEffects = new StatusEffectManager(player);
            }
            
            // Restore immunities
            if (playerData.statusEffects.immunities) {
                player.statusEffects.immunities = new Set(playerData.statusEffects.immunities);
            }
            
            // Restore saving throw bonus
            if (playerData.statusEffects.savingThrowBonus !== undefined) {
                player.statusEffects.savingThrowBonus = playerData.statusEffects.savingThrowBonus;
            }
            
            // Restore active effects
            playerData.statusEffects.effects.forEach(effectData => {
                player.statusEffects.addEffect(
                    effectData.type, 
                    effectData.duration, 
                    effectData.severity, 
                    effectData.source
                );
            });
        }
        
        return player;
    };
})();

