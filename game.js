/**
 * Main Game class for Roguelike Game
 * Handles game loop, input, and coordinates all game systems
 */
class Game {
    constructor() {
        this.canvas = document.getElementById('game-screen');
        this.renderer = new Renderer(this.canvas);
        this.currentLevel = 1;
        this.previousLevel = null; // Track the level we came from
        this.gameState = 'playing'; // 'playing', 'dead', 'door_closing', 'door_opening'
        
        // Multi-level system (NetHack-style with unlimited storage)
        this.levels = new Map(); // Store multiple dungeon levels
        this.maxStoredLevels = Infinity; // Unlimited storage
        this.visitedLevels = new Set(); // Track which levels have been visited
        
        // Autosave system
        this.autosaveEnabled = true;
        this.autosaveInterval = 0; // Save immediately after every action
        this.lastAutosave = 0;
        this.saveKey = 'compl3xRL_autosave'; // LocalStorage key
        this.isManualSave = false; // Flag to distinguish manual saves
        
        this.dungeon = null;
        this.player = null;
        this.fov = null;
        this.monsterSpawner = null;
        this.itemManager = null;
        
        // Monster detection for auto-stop feature
        this.previouslyVisibleMonsters = new Set(); // Track monster IDs that were visible last turn
        this.autoStopEnabled = true; // Allow disabling the feature if needed
        
        // Throwing state
        this.awaitingThrowDirection = null; // { letter: 'a' }
        
        this.setupGame();
    }
    
    /**
     * Initialize game systems
     */
    setupGame() {
        // Initialize input handling
        this.setupEventListeners();
        
        // Setup debug commands for terrain bias testing
        this.setupTerrainDebugCommands();
        
        // Wait for DOM to be fully ready before checking autosave
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initializeGameContent();
            });
        } else {
            this.initializeGameContent();
        }
        
        // Start autosave timer
        this.startAutosaveTimer();
    }
    
    /**
     * Start rendering after game content is ready
     */
    startRendering() {
        // Start rendering
        this.updateFOV();
        this.render();
        
        // Initialize renderer size after DOM is ready
        setTimeout(() => {
            this.renderer.initializeSize();
            this.renderer.initBuffer(); // Reinitialize buffer with new size
            this.render();
        }, 100);
    }
    
    /**
     * Initialize game content after DOM is ready
     */
    initializeGameContent() {
        // Check for existing autosave
        if (this.hasAutosave()) {
    
            // Don't initialize game yet, wait for user choice
            this.promptLoadAutosave();
        } else {
    
            // Generate initial level if no save exists
            this.generateNewLevel();
            // Ensure game is properly initialized
            if (!this.player || !this.dungeon) {

                this.generateNewLevel();
            }
        }
    }
    
    /**
     * Generate a new dungeon level or load existing one
     */
    generateNewLevel() {

        
        // Check if level already exists
        if (this.levels.has(this.currentLevel)) {

            const loaded = this.loadLevel(this.currentLevel);
            if (loaded) {
                // Successfully loaded existing level
                this.renderer.addLogMessage(`Welcome back to level ${this.currentLevel}!`);
                return;
            }
        }
        
        // Level doesn't exist, create new one
        
        this.createNewLevel();
        this.renderer.addLogMessage(`Welcome to level ${this.currentLevel}!`);
        
        // Clean up old levels if we have too many (disabled for unlimited storage)
        // this.cleanupOldLevels();
        
        // Start rendering now that level is ready
        this.startRendering();
    }
    
    /**
     * Create a completely new level
     */
    createNewLevel() {
        // Create dungeon
        this.dungeon = new Dungeon();
        
        // Create or position player
        const startPos = this.dungeon.getStartPosition();
        if (this.player && this.gameState === 'playing') {
            // Keep existing player stats when going to new level
            this.player.x = startPos.x;
            this.player.y = startPos.y;
        } else {
            // Create new player (for restart or first time)
            this.player = new Player(startPos.x, startPos.y);
        }
        
        // Make game instance globally accessible for battle log
        window.game = this;
        
        // Initialize systems
        this.fov = new FOV(this.dungeon);
        this.noiseSystem = new NoiseSystem(this);
        this.updateFOV(); // Calculate initial visibility
        this.monsterSpawner = new MonsterSpawner(this.dungeon);
        this.monsterSpawner.spawnMonsters(this.currentLevel); // Spawn monsters based on current depth
        this.itemManager = new ItemManager(this.dungeon);
        this.itemManager.spawnItems(this.currentLevel); // Spawn items based on current depth
        
        // Spawn starting equipment around player on level 1 (new game only)
        if (this.currentLevel === 1 && !this.visitedLevels.has(1)) {
            this.itemManager.spawnStartingEquipment(this.player.x, this.player.y);
        }
        
        // Store this level
        this.saveLevelState();
        this.visitedLevels.add(this.currentLevel);
    }
    
    /**
     * Load an existing level from storage
     */
    loadLevel(levelNumber, preservePlayerPosition = false) {
        const levelData = this.levels.get(levelNumber);
        if (!levelData) {

            // Don't create new level here - this means level was never created
            return false;
        }
        

        
        // Restore dungeon
        this.dungeon = levelData.dungeon;
        
        // Restore or position player
        if (this.player && !preservePlayerPosition) {
            // Determine spawn position based on movement direction
            let targetStairs = null;
            
            if (this.previousLevel !== null) {
                if (levelNumber > this.previousLevel) {
                    // Coming from above (descended) - use stairs_up position
                    targetStairs = this.findTileOfType('stairs_up');
        
                } else if (levelNumber < this.previousLevel) {
                    // Coming from below (ascended) - use stairs_down position  
                    targetStairs = this.findTileOfType('stairs_down');
        
                } else {
                    // Same level - this shouldn't happen but use stairs_up as fallback
                    targetStairs = this.findTileOfType('stairs_up');
        
                }
            } else {
                // No previous level info, use stairs_up as default
                targetStairs = this.findTileOfType('stairs_up');
    
            }
            
            if (targetStairs) {
                this.player.x = targetStairs.x;
                this.player.y = targetStairs.y;
        
            } else {

                // Fallback to start position
                const startPos = this.dungeon.getStartPosition();
                this.player.x = startPos.x;
                this.player.y = startPos.y;
            }
        } else if (preservePlayerPosition) {

        }
        
        // Restore systems
        this.fov = new FOV(this.dungeon);
        
        // Restore FOV state if available
        if (levelData.fovState) {
            this.fov.restoreState(levelData.fovState);
        }
        
        // Update FOV after player position is set
        this.updateFOV();
        
        this.monsterSpawner = levelData.monsterSpawner;
        this.itemManager = levelData.itemManager;
        
        // Make game instance globally accessible
        window.game = this;
        
        return true;
    }
    
    /**
     * Save current level state
     */
    saveLevelState() {
        if (!this.dungeon) {

            return;
        }
        

        
        // Save FOV state
        const fovState = this.fov ? this.fov.saveState() : null;
        
        this.levels.set(this.currentLevel, {
            dungeon: this.dungeon,
            monsterSpawner: this.monsterSpawner,
            itemManager: this.itemManager,
            fovState: fovState,
            timestamp: Date.now()
        });
        
        console.log(`Level ${this.currentLevel} saved. Total stored levels: ${this.levels.size}`);
        console.log(`Stored levels: [${Array.from(this.levels.keys()).join(', ')}]`);
        if (fovState) {
            console.log(`FOV state saved: ${fovState.exploredTiles.length} explored tiles`);
        }
    }
    
    /**
     * Clean up old levels to manage memory
     */
    cleanupOldLevels() {
        if (this.levels.size <= this.maxStoredLevels) return;
        
        // Get all level numbers sorted by timestamp (oldest first)
        const levelEntries = Array.from(this.levels.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        // Remove oldest levels until we're under the limit
        while (this.levels.size > this.maxStoredLevels) {
            const [oldestLevel] = levelEntries.shift();

            this.levels.delete(oldestLevel);
        }
    }
    
    // ===== AUTOSAVE SYSTEM =====
    
    /**
     * Check if autosave exists
     */
    hasAutosave() {
        try {
            const saveData = localStorage.getItem(this.saveKey);
            return saveData !== null;
        } catch (error) {

            return false;
        }
    }
    
    /**
     * Prompt player to load autosave using sub-window
     */
    promptLoadAutosave() {
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
    }

    /**
     * Handle the choice for loading autosave
     */
    handleLoadAutosaveChoice(loadSave) {

        
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
    }
    
    /**
     * Save complete game state
     */
    saveGame() {
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
    }
    
    /**
     * Load complete game state
     */
    loadGame() {
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
    }
    
    /**
     * Start autosave timer (now used for periodic cleanup and backup)
     */
    startAutosaveTimer() {
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
        

    }
    
    /**
     * Delete autosave (for new game)
     */
    deleteAutosave() {
        try {
            localStorage.removeItem(this.saveKey);
    
        } catch (error) {

        }
    }
    
    // ===== SERIALIZATION METHODS =====
    
    /**
     * Serialize dungeon data for saving
     */
    serializeDungeon(dungeon) {
        if (!dungeon) return null;
        
        return {
            width: dungeon.width,
            height: dungeon.height,
            tiles: dungeon.tiles, // This should be serializable
            rooms: dungeon.rooms
        };
    }
    
    /**
     * Deserialize dungeon data
     */
    deserializeDungeon(dungeonData) {
        if (!dungeonData) return null;
        
        // Create new dungeon instance
        const dungeon = new Dungeon();
        dungeon.width = dungeonData.width;
        dungeon.height = dungeonData.height;
        dungeon.tiles = dungeonData.tiles;
        dungeon.rooms = dungeonData.rooms;
        
        return dungeon;
    }
    
    /**
     * Serialize monster spawner data
     */
    serializeMonsters(monsterSpawner) {
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
    }
    
    /**
     * Deserialize monster spawner data
     */
    deserializeMonsters(monsterData, dungeon = null) {
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
        
        return monsterSpawner;
    }
    
    /**
     * Serialize item manager data
     */
    serializeItems(itemManager) {
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
    }
    
    /**
     * Deserialize item manager data
     */
    deserializeItems(itemData, dungeon = null) {
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
            
                            }
                        }
                    } catch (error) {
    
                    }
                });
            }
            
    
            return itemManager;
        } catch (error) {
            console.error('Error deserializing items:', error);
            // Return empty item manager on error
            return new ItemManager(this.dungeon);
        }
    }
    
    /**
     * Deserialize player data
     */
    deserializePlayer(playerData) {
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
    }
    
    /**
     * Get the last level the player was on
     */
    getLastLevel() {
        return Math.max(...this.visitedLevels);
    }
    
    /**
     * Find a tile of specific type in current dungeon
     */
    findTileOfType(tileType) {
        if (!this.dungeon) return null;
        
        for (let y = 0; y < this.dungeon.height; y++) {
            for (let x = 0; x < this.dungeon.width; x++) {
                const tile = this.dungeon.getTile(x, y);
                if (tile && tile.type === tileType) {
                    return { x, y };
                }
            }
        }
        return null;
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        document.addEventListener('keydown', (event) => {
            this.handleKeyPress(event);
        });
        
                 // Prevent default behavior for game keys
        document.addEventListener('keydown', (event) => {
            const gameKeys = ['KeyH', 'KeyJ', 'KeyK', 'KeyL', 'KeyY', 'KeyU', 'KeyB', 'KeyN', 
                             'Period', 'KeyQ', 'Escape'];
            if (gameKeys.includes(event.code)) {
                event.preventDefault();
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            setTimeout(() => {
                this.renderer.initializeSize();
                this.renderer.initBuffer(); // Reinitialize buffer with new size
                this.render();
            }, 100);
        });
    }
    
    // Map key to 8-direction vector
    getDirectionFromKey(event) {
        if (event.shiftKey) return null; // only lowercase movement keys
        switch (event.code) {
            case 'KeyK': return { dx: 0, dy: -1 };
            case 'KeyJ': return { dx: 0, dy: 1 };
            case 'KeyH': return { dx: -1, dy: 0 };
            case 'KeyL': return { dx: 1, dy: 0 };
            case 'KeyY': return { dx: -1, dy: -1 };
            case 'KeyU': return { dx: 1, dy: -1 };
            case 'KeyB': return { dx: -1, dy: 1 };
            case 'KeyN': return { dx: 1, dy: 1 };
        }
        return null;
    }
    
    beginThrowDirectionSelection(letter) {
        this.awaitingThrowDirection = { letter };
        if (this.renderer) this.renderer.addLogMessage('Throw in which direction?');
    }
    
    finishThrowWithDirection(dx, dy) {
        const state = this.awaitingThrowDirection;
        this.awaitingThrowDirection = null;
        if (!state || !this.player) return;
        const item = this.player.getInventoryItem(state.letter);
        if (!item) {
            if (this.renderer) this.renderer.addLogMessage('No such item.', 'normal');
            return;
        }
        
        // Remove one unit (stack-aware)
        const removed = this.player.removeFromInventoryByLetter(state.letter, 1);
        if (!removed) {
            if (this.renderer) this.renderer.addLogMessage('You cannot throw that.', 'normal');
            return;
        }
        const projectile = removed;
        
        // Compute max range based on strength/dexterity and item weight
        const strMod = this.player.getClassicModifier(this.player.strength);
        const dexMod = this.player.getClassicModifier(this.player.dexterity);
        const baseRange = 4 + Math.max(0, strMod) + Math.max(0, dexMod);
        const singleWeight = (() => {
            if (typeof projectile.getEffectiveWeight === 'function') return projectile.getEffectiveWeight();
            if (typeof projectile.weight === 'number') return projectile.weight;
            return 1;
        })();
        const weight = singleWeight; // throwing one unit
        const weightPenalty = Math.max(0, Math.floor(weight));
        const maxRange = Math.max(2, baseRange - weightPenalty);
        
        this.resolveThrow(projectile, dx, dy, maxRange);
    }
    
    resolveThrow(projectile, dx, dy, maxRange) {
        const startX = this.player.x;
        const startY = this.player.y;
        let x = startX;
        let y = startY;
        let lastFreeX = startX;
        let lastFreeY = startY;
        
        for (let step = 1; step <= maxRange; step++) {
            x += Math.sign(dx);
            y += Math.sign(dy);
            
            if (!this.dungeon.isInBounds(x, y)) break;
            const tile = this.dungeon.getTile(x, y);
            // Check collision with walls/closed doors
            if (tile.type === 'wall' || (tile.type === 'door' && tile.doorState !== 'open')) {
                break;
            }
            
            // Check hit monster
            const target = this.monsterSpawner.getMonsterAt(x, y);
            if (target) {
                // If potion: shatter and apply splash, do not drop item
                if (projectile.type === 'potion') {
                    this.handlePotionShatter(projectile, x, y, target);
                } else {
                    this.applyThrownHit(projectile, target);
                    // Non-potion items drop at the impact tile
                    this.dropProjectileAt(projectile, x, y);
                }
                this.postPlayerAction();
                return;
            }
            
            // Tile is free, remember last
            lastFreeX = x; lastFreeY = y;
        }
        
        // No hit: if potion, shatter at landing; otherwise, drop on ground
        if (projectile.type === 'potion') {
            this.handlePotionShatter(projectile, lastFreeX, lastFreeY, null);
        } else {
            this.dropProjectileAt(projectile, lastFreeX, lastFreeY);
            if (this.renderer) this.renderer.addLogMessage('You throw and it lands on the ground.');
        }
        this.postPlayerAction();
    }
    
    applyThrownHit(projectile, monster) {
        // Base damage by item kind
        let damage = 0;
        const isWeapon = projectile.type === 'weapon' || projectile.weaponDamage;
        if (projectile.type === 'potion') {
            // Potions do not deal blunt damage on hit; they shatter via handlePotionShatter
            return;
        } else if (isWeapon) {
            // Thrown weapons: use a lighter version of weapon damage
            const die = projectile.weaponDamage || 4;
            damage = Math.max(1, this.player.getClassicModifier(this.player.strength) + (Math.floor(Math.random()*die)+1));
        } else if (projectile.type === 'potion') {
            // Non-splash by default: minimal impact
            damage = 1;
        } else if (projectile.type === 'food') {
            damage = 0; // Soft
        } else {
            // Generic item: weight-scaled blunt
            const w = projectile.getTotalWeight ? projectile.getTotalWeight() : (projectile.weight || 1);
            damage = Math.max(0, Math.floor(w));
        }
        
        if (damage > 0) {
            if (this.renderer) this.renderer.addBattleLogMessage(`Thrown ${projectile.name} hits ${monster.name}!`, 'normal');
            // Apply as normal damage (AP 0)
            monster.takeDamage(damage, 0);
            if (!monster.isAlive) {
                this.handleMonsterDefeated(monster, 'thrown');
            }
        } else {
            if (this.renderer) this.renderer.addBattleLogMessage(`Thrown ${projectile.name} bounces off ${monster.name}.`, 'defense');
        }
    }

    // Shatter potion at impact and apply splash effects (radius 1)
    handlePotionShatter(projectile, impactX, impactY, primaryTarget = null) {
        if (this.renderer) this.renderer.addLogMessage('The bottle shatters!');
        
        // Determine primary effect amount
        let primaryAmount = 0;
        if (projectile.healDice) {
            primaryAmount = rollDice(projectile.healDice);
        } else if (projectile.healAmount) {
            primaryAmount = projectile.healAmount;
        }
        const splashAmount = Math.floor(primaryAmount / 2);
        
        const affectEntity = (entity, amount) => {
            if (!entity || amount <= 0) return;
            // Heal effect for healing potions
            if (entity === this.player) {
                const healed = this.player.heal(amount);
                if (healed > 0 && this.renderer) {
                    this.renderer.addBattleLogMessage(`You are splashed by ${projectile.name}. (+${healed} HP)`, 'heal');
                }
            } else {
                // Monster heal
                if (typeof entity.heal === 'function') {
                    const healed = entity.heal(amount);
                    if (healed > 0 && this.renderer) {
                        this.renderer.addBattleLogMessage(`${entity.name} is splashed by ${projectile.name}. (+${healed} HP)`, 'heal');
                    }
                }
            }
        };
        
        // Apply to primary target (full), otherwise to any entity on impact tile
        if (primaryTarget) {
            affectEntity(primaryTarget, primaryAmount);
            // If a monster was healed to death prevention not needed; if in future damaging potions are added,
            // unify defeat handling here as well.
        } else {
            // Check player on tile
            if (this.player.x === impactX && this.player.y === impactY) {
                affectEntity(this.player, primaryAmount);
            }
            const m = this.monsterSpawner.getMonsterAt(impactX, impactY);
            if (m) affectEntity(m, primaryAmount);
        }
        
        // Splash radius 1 around impact
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const x = impactX + dx;
                const y = impactY + dy;
                if (!this.dungeon.isInBounds(x, y)) continue;
                // If player in splash
                if (this.player.x === x && this.player.y === y) {
                    affectEntity(this.player, splashAmount);
                }
                const mon = this.monsterSpawner.getMonsterAt(x, y);
                if (mon) affectEntity(mon, splashAmount);
            }
        }
        // Potions are consumed; do not drop item
    }
    
    // Unified defeat handler for player-caused monster deaths (e.g., thrown items)
    handleMonsterDefeated(monster, cause = 'player') {
        if (!monster || monster.isAlive) return;
        // Prevent double EXP in any edge case
        if (monster._xpGranted) return;
        monster._xpGranted = true;
        
        // Victory log unified with melee style
        if (this.renderer) {
            const monsterName = monster.name || 'the monster';
            this.renderer.addBattleLogMessage(`You defeat the ${monsterName}!`, 'victory');
        }
        
        // Grant EXP if defined
        if (this.player && typeof this.player.gainExp === 'function' && monster.expValue) {
            this.player.gainExp(monster.expValue);
        }
    }
    
    dropProjectileAt(item, x, y) {
        // Place item on ground (merge if possible is out of scope now)
        item.x = x; item.y = y;
        this.itemManager.addItem(item);
    }
    
    postPlayerAction() {
        // Noise from throwing similar to attack
        if (this.noiseSystem) this.noiseSystem.makeSound(this.player.x, this.player.y, this.noiseSystem.getPlayerActionSound('ATTACK', this.player));
        // Consume a turn and render
        this.processTurn();
        if (this.monsterSpawner && typeof this.monsterSpawner.removeDeadMonsters === 'function') {
            this.monsterSpawner.removeDeadMonsters();
        }
        this.render();
    }
    
    /**
     * Handle keyboard input
     */
    handleKeyPress(event) {
        // If awaiting throw direction, intercept direction keys
        if (this.awaitingThrowDirection) {
            const dir = this.getDirectionFromKey(event);
            if (dir) {
                event.preventDefault();
                this.finishThrowWithDirection(dir.dx, dir.dy);
                return;
            }
            if (event.code === 'Escape') {
                this.awaitingThrowDirection = null;
                if (this.renderer) this.renderer.addLogMessage('Throw cancelled.');
                return;
            }
        }
        // Block input if sub-window is open
        if (window.subWindow && window.subWindow.isOpen) {
            return;
        }
        
        // Block input if map is open (except for map toggle and ESC)
        if (window.mapView && window.mapView.isOpen) {
            if (event.code === 'KeyM' || event.code === 'Escape') {
                // Allow map toggle and ESC to close
                if (event.code === 'KeyM' && !event.shiftKey) {
                    event.preventDefault();
                    window.mapView.hide();
                }
                return;
            }
            // Block all other input when map is open
            return;
        }
        
        // Safety check - ensure game is properly initialized
        if (!this.player || !this.dungeon) {

            return;
        }
        
        // Only allow restart when dead
        if (this.gameState === 'dead') {
            if (event.code === 'Enter') {
                this.restartGame();
            }
            return;
        }
        
        // Throttle input
        const now = Date.now();
        if (now - this.lastKeyTime < this.keyDelay) {
            return;
        }
        this.lastKeyTime = now;
        
        // Check for monster detection if auto-stop is enabled (only during key repeat)
        if (this.autoStopEnabled && event.repeat && this.shouldStopForMonsterDetection()) {
            return; // Stop processing input if new monster detected during continuous movement
        }
        
        if (this.gameState === 'door_closing') {
            this.handleDoorClosingInput(event);
            return;
        }

        if (this.gameState === 'door_opening') {
            this.handleDoorOpeningInput(event);
            return;
        }

        if (this.gameState !== 'playing') {
            return;
        }
        
        let playerMoved = false;
        
                 switch (event.code) {
            // Movement (vi keys) - lowercase
            case 'KeyK':
                if (!event.shiftKey) {
                    playerMoved = this.movePlayer(0, -1);
                }
                break;
            case 'KeyJ':
                if (!event.shiftKey) {
                    playerMoved = this.movePlayer(0, 1);
                }
                break;
            case 'KeyH':
                if (!event.shiftKey) {
                    playerMoved = this.movePlayer(-1, 0);
                }
                break;
            case 'KeyL':
                if (!event.shiftKey) {
                    playerMoved = this.movePlayer(1, 0);
                }
                break;
            // Diagonal movement (vi keys) - lowercase
            case 'KeyY':
                if (!event.shiftKey) {
                    playerMoved = this.movePlayer(-1, -1);
                }
                break;
            case 'KeyU':
                if (!event.shiftKey) {
                    playerMoved = this.movePlayer(1, -1);
                }
                break;
            case 'KeyB':
                if (!event.shiftKey) {
                    playerMoved = this.movePlayer(-1, 1);
                }
                break;
            case 'KeyN':
                if (!event.shiftKey) {
                    playerMoved = this.movePlayer(1, 1);
                }
                break;
                
            // Actions - lowercase (Period handled in LEVEL MOVEMENT section)
            case 'KeyO':
                // Open door - lowercase o
                if (!event.shiftKey) {
                    event.preventDefault();
                    this.openDoorAction();
                }
                break;
            case 'KeyC':
                // Close door - lowercase c
                if (!event.shiftKey) {
                    event.preventDefault();
                    this.closeDoorAction();
                }
                break;
                
            // Inventory and equipment commands - lowercase
            case 'KeyG':
                // Get/pick up item - lowercase g
                if (!event.shiftKey) {
                    event.preventDefault();
                    playerMoved = this.pickupItem();
                }
                break;
            case 'KeyD':
                // Drop item - lowercase d
                if (!event.shiftKey) {
                    event.preventDefault();
                    this.dropItem();
                }
                break;
            case 'KeyI':
                // Show inventory - lowercase i
                if (!event.shiftKey) {
                    event.preventDefault();
                    this.showInventory();
                }
                break;
            case 'KeyE':
                if (event.shiftKey) {
                    // Eat food - uppercase E (Shift+E) - open food selection menu
                    event.preventDefault();
                    this.showFoodMenu();
                } else {
                    // Show equipment - lowercase e
                    event.preventDefault();
                    this.showEquipment();
                }
                break;
            case 'KeyM':
                // Show map - lowercase m
                if (!event.shiftKey) {
                    event.preventDefault();
                    if (window.mapView) {
                        window.mapView.toggle(this);
                    }
                }
                break;
            case 'KeyW':
                // Wear/wield any equipment - lowercase w
                if (!event.shiftKey) {
                    event.preventDefault();
                    this.showEquipmentMenu();
                }
                break;
            case 'KeyT':
                if (event.shiftKey) {
                    // Take off equipment - uppercase T (Shift+T)
                    event.preventDefault();
                    this.showUnequipMenu();
                } else {
                    // Throw item - lowercase t
                    event.preventDefault();
                    if (window.subWindow) {
                        window.subWindow.showThrowSelectionMenu(this.player);
                    }
                }
                break;
                
            // === LEVEL MOVEMENT ===
            case 'Period':
            case 'Comma':
                // Stairs movement: > (Shift+Period) down, < (Shift+Comma) up
                if (event.shiftKey) {
                    event.preventDefault();
            
                    if (event.code === 'Period') {
                        // > key - go down stairs
            
                        this.goDownStairs();
                    } else if (event.code === 'Comma') {
                        // < key - go up stairs  
            
                        this.goUpStairs();
                    }
                } else if (event.code === 'Period') {
                    // . key - wait/rest (lowercase)
                    event.preventDefault();
            
                    const playerMoved = this.player.rest();
                    if (playerMoved) {
                        this.processTurn();
                    }
                }
                break;
                
            // System commands - uppercase (Shift + key)
            case 'KeyQ':
                if (event.shiftKey) {
                    // Quit game - uppercase Q (Shift+Q)
                    event.preventDefault();
                    if (confirm('Are you sure you want to quit?')) {
                        this.quitGame();
                    }
                } else {
                    // Quaff potion - lowercase q
                    event.preventDefault();
                    this.showPotionMenu();
                }
                break;
            case 'KeyS':
                // Save game - uppercase S (Shift+S)
                if (event.shiftKey) {
                    event.preventDefault();
                    this.isManualSave = true; // Set flag for manual save
                    if (this.saveGame()) {
                        this.renderer.addLogMessage('Game saved successfully!');
                    } else {
                        this.renderer.addLogMessage('Failed to save game!');
                    }
                }
                break;
                
            // Special keys
            case 'Escape':
                // Pause/unpause
                this.togglePause();
                break;
        }
        
        // Process turn if player acted
        if (playerMoved) {
            this.processTurn();
        }
        
        // Check for immediate death after any action
        if (this.player.hp <= 0 && this.gameState === 'playing') {
            this.gameOver();
            return;
        }
        
        this.render();
    }
    

    
    /**
     * Move the player
     */
    movePlayer(dx, dy) {
        // Safety check: ensure player exists
        if (!this.player) {

            return false;
        }
        
        // Safety check: ensure dungeon exists
        if (!this.dungeon) {

            return false;
        }
        
        const moved = this.player.tryMove(dx, dy, this.dungeon, this.monsterSpawner);
        
        // Remove dead monsters immediately after player action
        this.monsterSpawner.removeDeadMonsters();
        
        if (moved) {
            // Check for stairs
            const tile = this.dungeon.getTile(this.player.x, this.player.y);
            if (tile.type === 'stairs_down' || tile.type === 'stairs_up') {
                this.describeStairs();
            }
            
            // Check for items at player position
            this.checkItemsAtPlayerPosition();
        }
        
        return moved;
    }
    
    /**
     * Check for items at player position and display message
     */
    checkItemsAtPlayerPosition() {
        const itemsAtPosition = this.itemManager.getItemsAt(this.player.x, this.player.y);
        
        if (itemsAtPosition.length > 0) {
            if (itemsAtPosition.length === 1) {
                const item = itemsAtPosition[0];
                const displayName = item.getDisplayName ? item.getDisplayName() : item.name;
                this.renderer.addLogMessage(`You see ${displayName} here.`);
            } else {
                this.renderer.addLogMessage(`You see several items here.`);
            }
        }
    }

    
    /**
     * Describe stairs and handle movement
     */
    describeStairs() {
        const tile = this.dungeon.getTile(this.player.x, this.player.y);
        
        if (tile.type === 'stairs_down') {
            this.renderer.addLogMessage('You stand on stairs leading down to the next level.');
            this.renderer.addLogMessage('Press > to descend or < to ascend.');
        } else if (tile.type === 'stairs_up') {
            this.renderer.addLogMessage('You stand on stairs leading up to the previous level.');
            this.renderer.addLogMessage('Press < to ascend or > to descend.');
        }
    }
    
    /**
     * Go down stairs to next level
     */
    goDownStairs() {
        const tile = this.dungeon.getTile(this.player.x, this.player.y);

        
        if (tile.type === 'stairs_down' || tile.type === 'stairs_up') {
            // Save current level state before leaving
            this.saveLevelState();
            console.log(`Saved level ${this.currentLevel} state`);
            
            // Update visited levels before moving
            this.visitedLevels.add(this.currentLevel);
            
            // Track where we came from
            this.previousLevel = this.currentLevel;
            
            // Go to next level
            this.currentLevel++;
            this.renderer.addLogMessage(`Descending to level ${this.currentLevel}...`);

            
            // Generate or load the next level
            this.generateNewLevel();
            this.updateFOV();
            this.render();
            
            // Trigger autosave after level change
            this.saveGame();
            
            return true;
        } else {
            this.renderer.addLogMessage('You are not standing on stairs.');

            return false;
        }
    }
    
    /**
     * Go up stairs to previous level
     */
    goUpStairs() {
        const tile = this.dungeon.getTile(this.player.x, this.player.y);

        
        if (tile.type === 'stairs_up' || tile.type === 'stairs_down') {
            if (this.currentLevel <= 1) {
                this.renderer.addLogMessage('You cannot go up from the first level.');
    
                return false;
            }
            
            // Save current level state before leaving
            this.saveLevelState();
            console.log(`Saved level ${this.currentLevel} state`);
            
            // Update visited levels before moving
            this.visitedLevels.add(this.currentLevel);
            
            // Track where we came from
            this.previousLevel = this.currentLevel;
            
            // Go to previous level
            this.currentLevel--;
            this.renderer.addLogMessage(`Ascending to level ${this.currentLevel}...`);

            
            // Generate or load the previous level
            this.generateNewLevel();
            this.updateFOV();
            this.render();
            
            // Trigger autosave after level change
            this.saveGame();
            
            return true;
        } else {
            this.renderer.addLogMessage('You are not standing on stairs.');

            return false;
        }
    }
    
    /**
     * Update field of vision
     */
    updateFOV() {
        if (this.fov && this.player) {
            this.fov.calculateVisibility(this.player.x, this.player.y);
            
            // Update item visibility based on new FOV
            if (this.itemManager) {
                this.itemManager.updateItemVisibility(this.fov, this.player.turnCount);
            }
        }
    }
    
    /**
     * Process a turn in the game (energy-based system)
     */
    processTurn() {
        // Safety check: ensure game is properly initialized
        if (!this.player || !this.dungeon) {

            return;
        }
        
        // Check if player is dead
        if (this.player.hp <= 0) {
            this.gameOver();
            return;
        }
        
        // Player spends energy for their action
        this.player.spendEnergy();
        
        // Process player hunger system
        this.player.processHunger();
        
        // Check player regeneration (now hunger-dependent)
        this.player.checkRegeneration();
        
        // Process player status effects
        if (this.player.statusEffects) {
            const result = this.player.statusEffects.processTurn();
            // Log damage first if any
            if (result.damage > 0) {
                if (this.renderer) {
                    this.renderer.addLogMessage(`You take ${result.damage} damage from status effects!`, 'damage');
                }
                this.player.takeDirectDamage(result.damage);
            }
            // Then log other messages (recovery, etc.)
            for (const message of result.messages) {
                if (this.renderer) {
                    this.renderer.addLogMessage(message);
                }
            }
        }
        
        // Update field of vision after player moves
        this.updateFOV();
        
        // Update visible monster tracking for auto-stop feature
        this.updateVisibleMonsterTracking();
        
        // Process energy-based turns for all entities
        this.processEnergyTurns();
        
        // Immediate autosave after every action
        if (this.autosaveEnabled && this.gameState === 'playing') {
            this.saveGame();
        }
    }
    
    /**
     * Process energy-based turns for all entities
     */
    processEnergyTurns() {
        // Give energy to all entities (including player for next turn)
        this.player.gainEnergy();
        const livingMonsters = this.monsterSpawner.getLivingMonsters();
        livingMonsters.forEach(monster => {
            monster.gainEnergy();
        });
        
        // Process monster turns until none can act
        while (true) {
            let anyEntityActed = false;
            
            // Process monster turns
            for (const monster of livingMonsters) {
                if (monster.canAct() && monster.isAlive) {
                    this.processMonsterTurn(monster);
                    monster.spendEnergy();
                    anyEntityActed = true;
                }
            }
            
            // If no entity could act, break to prevent infinite loop
            if (!anyEntityActed) {
                break;
            }
        }
        
        // Remove dead monsters
        this.monsterSpawner.removeDeadMonsters();
    }
    
    /**
     * Process monster turns only (for equipment changes)
     */
    processMonsterTurns() {
        const livingMonsters = this.monsterSpawner.getLivingMonsters();
        livingMonsters.forEach(monster => {
            this.processMonsterTurn(monster);
        });
        
        // Remove dead monsters
        this.monsterSpawner.removeDeadMonsters();
    }
    
    /**
     * Process a single monster's turn
     */
    processMonsterTurn(monster) {
        if (!monster.isAlive) return;
        
        // Process monster status effects
        if (monster.statusEffects) {
            // Check if monster can act (stunned/paralyzed might prevent action)
            if (!monster.statusEffects.canAct()) {
                return; // Monster is stunned/paralyzed and cannot act this turn
            }
            
            const result = monster.statusEffects.processTurn();
            if (result.damage > 0) {
                if (this.renderer) {
                    this.renderer.addLogMessage(`The ${monster.name} takes ${result.damage} damage from status effects!`);
                }
                monster.takeDirectDamage(result.damage);
                if (!monster.isAlive) {
                    if (this.renderer) {
                        this.renderer.addLogMessage(`The ${monster.name} dies from its wounds!`, 'victory');
                    }
                    this.player.gainExp(monster.expValue);
                    return;
                }
            }
        }
        
        // Check if monster should wake up (always check, even if asleep)
        monster.checkWakeUpConditions(this.player.x, this.player.y);
        
        // If monster is still asleep, skip turn
        if (monster.isAsleep) {
            return;
        }
        
        // If monster just woke up this turn, spend turn being disoriented (classic roguelike)
        if (monster.justWokeUp) {
            monster.justWokeUp = false; // Clear flag for next turn
            return; // Skip action this turn
        }
        
        // Check if monster should flee (Angband-style)
        monster.checkFleeCondition();
        
        // Calculate distance to player
        const dx = this.player.x - monster.x;
        const dy = this.player.y - monster.y;
        const distance = Math.max(Math.abs(dx), Math.abs(dy)); // Chebyshev distance (8-directional)
        
        // Check if monster can see the player (line of sight)
        const canSeePlayer = this.fov.canSee(monster.x, monster.y, this.player.x, this.player.y, monster.sightRange);
        
        if (canSeePlayer) {
            // Player is visible - update last seen position and reset search timer
            monster.lastSeenPlayerX = this.player.x;
            monster.lastSeenPlayerY = this.player.y;
            monster.turnsWithoutSeeingPlayer = 0;
            
            // If monster is fleeing, use personality-based fleeing behavior
            if (monster.isFleeing) {
                this.moveFleeingMonster(monster, this.player.x, this.player.y);
                return;
            }
            
            // If adjacent to player, attack (unless fleeing)
            if (distance === 1) {
                const playerDied = monster.attackPlayer(this.player);
                if (playerDied === true) {
                    // Player died immediately - trigger game over
                    this.gameOver();
                    return;
                }
                return;
            }
            
            // Move towards player (normal behavior)
            this.moveMonsterTowards(monster, this.player.x, this.player.y);
        } else {
            // Player is not visible
            monster.turnsWithoutSeeingPlayer++;
            
            // If monster is fleeing, continue fleeing based on personality
            if (monster.isFleeing) {
                this.moveFleeingMonster(monster, this.player.x, this.player.y);
                return;
            }
            
            // If we've seen the player before and haven't given up searching
            if (monster.lastSeenPlayerX !== null && 
                monster.lastSeenPlayerY !== null && 
                monster.turnsWithoutSeeingPlayer <= monster.giveUpTurns) {
                
                // Move towards last seen position
                const lastSeenDx = monster.lastSeenPlayerX - monster.x;
                const lastSeenDy = monster.lastSeenPlayerY - monster.y;
                const distanceToLastSeen = Math.max(Math.abs(lastSeenDx), Math.abs(lastSeenDy));
                
                // If we've reached the last seen position, give up searching
                if (distanceToLastSeen <= 1) {
                    monster.lastSeenPlayerX = null;
                    monster.lastSeenPlayerY = null;
                } else {
                    // Move towards last seen position
                    this.moveMonsterTowards(monster, monster.lastSeenPlayerX, monster.lastSeenPlayerY);
                }
            } else {
                // Give up searching - reset state
                monster.lastSeenPlayerX = null;
                monster.lastSeenPlayerY = null;
                monster.turnsWithoutSeeingPlayer = 0;
                
                // Awake monsters patrol their area (classic roguelike behavior)
                this.performMonsterPatrol(monster);
            }
        }
    }
    
    /**
     * Move monster towards a target position with pack coordination (surrounding tactics)
     */
    moveMonsterTowards(monster, targetX, targetY) {
        // Check for status effect movement restrictions
        if (monster.statusEffects) {
            // Apply movement speed penalty
            const movementMod = monster.statusEffects.getMovementModifier();
            if (movementMod <= 0 || Math.random() > movementMod) {
                // Monster is too injured/stunned to move this turn
                return;
            }
            
            // Check if confused - randomize movement
            if (monster.statusEffects.shouldRandomizeMovement()) {
                // Random movement instead of toward target
                const directions = [
                    [-1, -1], [0, -1], [1, -1],
                    [-1, 0],           [1, 0],
                    [-1, 1],  [0, 1],  [1, 1]
                ];
                const randomDir = directions[Math.floor(Math.random() * directions.length)];
                const newX = monster.x + randomDir[0];
                const newY = monster.y + randomDir[1];
                
                if (this.dungeon.isWalkable(newX, newY) && 
                    !this.monsterSpawner.getMonsterAt(newX, newY) &&
                    !(newX === this.player.x && newY === this.player.y)) {
                    this.executeMonsterMove(monster, newX, newY);
                }
                return;
            }
        }
        
        // Get all nearby monsters for pack coordination
        const nearbyMonsters = this.monsterSpawner.getLivingMonsters().filter(m => 
            m !== monster && !m.isAsleep && !m.isFleeing &&
            Math.max(Math.abs(m.x - targetX), Math.abs(m.y - targetY)) <= 4 // Within 4 tiles of target
        );
        
        // If there are nearby allies, try pack coordination
        if (nearbyMonsters.length > 0) {
            const coordinatedMove = this.calculatePackCoordinatedMove(monster, targetX, targetY, nearbyMonsters);
            if (coordinatedMove) {
                this.executeMonsterMove(monster, coordinatedMove.x, coordinatedMove.y);
                return;
            }
        }
        
        // Fallback to basic movement logic
        this.moveMonsterBasic(monster, targetX, targetY);
    }
    
    /**
     * Calculate coordinated movement for pack tactics (surrounding behavior)
     */
    calculatePackCoordinatedMove(monster, targetX, targetY, allies) {
        const distance = Math.max(Math.abs(monster.x - targetX), Math.abs(monster.y - targetY));
        
        // If adjacent to target, stay and attack (no need to move)
        if (distance === 1) {
            return null;
        }
        
        // Evaluate surrounding positions around the target
        const surroundingPositions = this.getSurroundingPositions(targetX, targetY);
        const occupiedPositions = this.getOccupiedSurroundingPositions(targetX, targetY, allies);
        
        // Find best available surrounding position
        const availablePositions = surroundingPositions.filter(pos => 
            !occupiedPositions.some(occ => occ.x === pos.x && occ.y === pos.y) &&
            this.dungeon.isWalkable(pos.x, pos.y) &&
            !this.monsterSpawner.getMonsterAt(pos.x, pos.y)
        );
        
        if (availablePositions.length === 0) {
            return null; // No good surrounding positions available
        }
        
        // Choose the closest available surrounding position
        let bestPosition = null;
        let minDistance = Infinity;
        
        for (const pos of availablePositions) {
            const distanceToPos = Math.max(Math.abs(monster.x - pos.x), Math.abs(monster.y - pos.y));
            if (distanceToPos < minDistance) {
                minDistance = distanceToPos;
                bestPosition = pos;
            }
        }
        
        if (!bestPosition) {
            return null;
        }
        
        // Move towards the chosen surrounding position
        return this.calculateMoveTowards(monster.x, monster.y, bestPosition.x, bestPosition.y);
    }
    
    /**
     * Get 8 surrounding positions around target
     */
    getSurroundingPositions(centerX, centerY) {
        const positions = [];
        const directions = [
            [-1, -1], [0, -1], [1, -1],
            [-1,  0],          [1,  0],
            [-1,  1], [0,  1], [1,  1]
        ];
        
        for (const [dx, dy] of directions) {
            positions.push({
                x: centerX + dx,
                y: centerY + dy,
                direction: [dx, dy]
            });
        }
        
        return positions;
    }
    
    /**
     * Get positions around target that are already occupied by allies
     */
    getOccupiedSurroundingPositions(targetX, targetY, allies) {
        const occupied = [];
        const surroundingPositions = this.getSurroundingPositions(targetX, targetY);
        
        for (const pos of surroundingPositions) {
            // Check if any ally is at this position or planning to move here
            const allyAtPosition = allies.find(ally => ally.x === pos.x && ally.y === pos.y);
            if (allyAtPosition) {
                occupied.push(pos);
            }
        }
        
        return occupied;
    }
    
    /**
     * Calculate next move towards a target position
     */
    calculateMoveTowards(fromX, fromY, toX, toY) {
        const dx = toX - fromX;
        const dy = toY - fromY;
        
        let moveX = 0, moveY = 0;
        
        if (dx > 0) moveX = 1;
        else if (dx < 0) moveX = -1;
        
        if (dy > 0) moveY = 1;
        else if (dy < 0) moveY = -1;
        
        // Try diagonal first, then cardinal directions
        const moves = [];
        
        if (moveX !== 0 && moveY !== 0) {
            moves.push({ x: fromX + moveX, y: fromY + moveY });
        }
        if (moveX !== 0) {
            moves.push({ x: fromX + moveX, y: fromY });
        }
        if (moveY !== 0) {
            moves.push({ x: fromX, y: fromY + moveY });
        }
        
        // Return first valid move
        for (const move of moves) {
            if (this.dungeon.isWalkable(move.x, move.y) && 
                !(move.x === this.player.x && move.y === this.player.y) &&
                !this.monsterSpawner.getMonsterAt(move.x, move.y)) {
                return move;
            }
        }
        
        return null;
    }
    
    /**
     * Basic movement logic (fallback when pack coordination fails)
     */
    moveMonsterBasic(monster, targetX, targetY) {
        const dx = targetX - monster.x;
        const dy = targetY - monster.y;
        
        let moveX = 0, moveY = 0;
        
        // Determine movement direction
        if (dx > 0) moveX = 1;
        else if (dx < 0) moveX = -1;
        
        if (dy > 0) moveY = 1;
        else if (dy < 0) moveY = -1;
        
        // Try diagonal movement first
        if (moveX !== 0 && moveY !== 0) {
            const newX = monster.x + moveX;
            const newY = monster.y + moveY;
            
            if (this.dungeon.isWalkable(newX, newY) && 
                !(newX === this.player.x && newY === this.player.y) &&
                !this.monsterSpawner.getMonsterAt(newX, newY)) {
                this.executeMonsterMove(monster, newX, newY);
                return;
            }
        }
        
        // If diagonal movement failed, try horizontal movement
        if (moveX !== 0) {
            const newX = monster.x + moveX;
            const newY = monster.y;
            
            if (this.dungeon.isWalkable(newX, newY) && 
                !(newX === this.player.x && newY === this.player.y) &&
                !this.monsterSpawner.getMonsterAt(newX, newY)) {
                this.executeMonsterMove(monster, newX, newY);
                return;
            }
        }
        
        // If horizontal movement failed, try vertical movement
        if (moveY !== 0) {
            const newX = monster.x;
            const newY = monster.y + moveY;
            
            if (this.dungeon.isWalkable(newX, newY) && 
                !(newX === this.player.x && newY === this.player.y) &&
                !this.monsterSpawner.getMonsterAt(newX, newY)) {
                this.executeMonsterMove(monster, newX, newY);
                return;
            }
        }
    }
    
    /**
     * Execute monster movement and generate sound
     */
    executeMonsterMove(monster, newX, newY) {
        monster.x = newX;
        monster.y = newY;
        
        // Generate monster movement sound
        if (this.noiseSystem) {
            const soundType = monster.isFleeing ? 'MONSTER_FLEE' : 'MONSTER_MOVE';
            this.noiseSystem.makeSound(monster.x, monster.y, this.noiseSystem.getMonsterActionSound(soundType));
        }
    }
    
    /**
     * Move monster away from a target position (fleeing behavior)
     */
    moveMonsterAwayFrom(monster, targetX, targetY) {
        const dx = monster.x - targetX; // Reversed direction
        const dy = monster.y - targetY; // Reversed direction
        
        let moveX = 0, moveY = 0;
        
        // Determine movement direction (away from target)
        if (dx > 0) moveX = 1;
        else if (dx < 0) moveX = -1;
        
        if (dy > 0) moveY = 1;
        else if (dy < 0) moveY = -1;
        
        // Try diagonal movement first (preferred for fastest escape)
        if (moveX !== 0 && moveY !== 0) {
            const newX = monster.x + moveX;
            const newY = monster.y + moveY;
            
            if (this.dungeon.isInBounds(newX, newY) &&
                this.dungeon.isWalkable(newX, newY) && 
                !(newX === this.player.x && newY === this.player.y) &&
                !this.monsterSpawner.getMonsterAt(newX, newY)) {
                this.executeMonsterMove(monster, newX, newY);
                return;
            }
        }
        
        // If diagonal failed, try horizontal movement
        if (moveX !== 0) {
            const newX = monster.x + moveX;
            const newY = monster.y;
            
            if (this.dungeon.isInBounds(newX, newY) &&
                this.dungeon.isWalkable(newX, newY) && 
                !(newX === this.player.x && newY === this.player.y) &&
                !this.monsterSpawner.getMonsterAt(newX, newY)) {
                this.executeMonsterMove(monster, newX, newY);
                return;
            }
        }
        
        // If horizontal failed, try vertical movement
        if (moveY !== 0) {
            const newX = monster.x;
            const newY = monster.y + moveY;
            
            if (this.dungeon.isInBounds(newX, newY) &&
                this.dungeon.isWalkable(newX, newY) && 
                !(newX === this.player.x && newY === this.player.y) &&
                !this.monsterSpawner.getMonsterAt(newX, newY)) {
                this.executeMonsterMove(monster, newX, newY);
                return;
            }
        }
        
        // If all direct escape routes failed, try random movement
        this.moveMonsterRandomly(monster);
    }
    
    /**
     * Move monster in a random direction (for panicked fleeing)
     */
    moveMonsterRandomly(monster) {
        const directions = [
            [-1, -1], [0, -1], [1, -1],
            [-1,  0],          [1,  0],
            [-1,  1], [0,  1], [1,  1]
        ];
        
        // Shuffle directions for random movement
        const shuffled = directions.sort(() => Math.random() - 0.5);
        
        for (const [dx, dy] of shuffled) {
            const newX = monster.x + dx;
            const newY = monster.y + dy;
            
            if (this.dungeon.isInBounds(newX, newY) &&
                this.dungeon.isWalkable(newX, newY) && 
                !(newX === this.player.x && newY === this.player.y) &&
                !this.monsterSpawner.getMonsterAt(newX, newY)) {
                this.executeMonsterMove(monster, newX, newY);
                return;
            }
        }
        
        // If no movement possible, stay in place
    }
    
    /**
     * Make monster patrol their area when not actively pursuing player
     */
    performMonsterPatrol(monster) {
        // Only awake monsters patrol (sleeping monsters stay put)
        if (monster.isAsleep || monster.justWokeUp) {
            return;
        }
        
        // Determine patrol behavior based on monster intelligence and type
        const patrolType = this.getMonsterPatrolType(monster);
        
        switch (patrolType) {
            case 'none':
                // Mindless creatures and some animals don't patrol
                break;
                
            case 'occasional':
                // Low chance of random movement (1 in 8 turns)
                if (Math.random() < 0.125) {
                    this.moveMonsterRandomly(monster);
                }
                break;
                
            case 'room_patrol':
                // Patrol within the current room
                this.patrolCurrentRoom(monster);
                break;
                
            case 'active_patrol':
                // More active patrolling, may venture into corridors
                if (Math.random() < 0.6) {
                    this.patrolCurrentRoom(monster);
                } else {
                    this.moveMonsterRandomly(monster);
                }
                break;
                
            default:
                // Default to occasional movement
                if (Math.random() < 0.125) {
                    this.moveMonsterRandomly(monster);
                }
                break;
        }
    }
    
    /**
     * Determine what type of patrol behavior a monster should have
     */
    getMonsterPatrolType(monster) {
        // Base behavior on intelligence and monster type
        switch (monster.intelligence) {
            case 'mindless':
                // Mindless creatures generally don't patrol
                if (['ant', 'centipede'].includes(monster.type)) {
                    return 'occasional'; // But insects might wander occasionally
                }
                return 'none';
                
            case 'animal':
                // Animals patrol their territory
                if (['wolf', 'bear', 'jackal'].includes(monster.type)) {
                    return 'room_patrol'; // Pack animals patrol more
                }
                return 'occasional';
                
            case 'normal':
                // Humanoid creatures patrol their posts
                if (['kobold', 'goblin', 'orc', 'dwarf', 'elf'].includes(monster.type)) {
                    return 'room_patrol';
                }
                return 'occasional';
                
            case 'smart':
                // Smart creatures actively patrol and investigate
                return 'active_patrol';
                
            case 'genius':
                // Genius creatures patrol strategically
                return 'active_patrol';
                
            default:
                return 'occasional';
        }
    }
    
    /**
     * Make monster patrol within their current room
     */
    patrolCurrentRoom(monster) {
        // Find the room the monster is currently in
        const currentRoom = this.findMonsterRoom(monster);
        
        if (currentRoom) {
            // Try to move to a random position within the room
            const attempts = 5;
            for (let i = 0; i < attempts; i++) {
                const targetX = currentRoom.x + 1 + Math.floor(Math.random() * (currentRoom.width - 2));
                const targetY = currentRoom.y + 1 + Math.floor(Math.random() * (currentRoom.height - 2));
                
                // Only move if the target is walkable and not occupied
                if (this.dungeon.isWalkable(targetX, targetY) && 
                    !this.monsterSpawner.getMonsterAt(targetX, targetY) &&
                    !(targetX === this.player.x && targetY === this.player.y)) {
                    
                    // Move towards the target position
                    this.moveMonsterTowards(monster, targetX, targetY);
                    return;
                }
            }
        }
        
        // Fallback to random movement if room patrol fails
        if (Math.random() < 0.3) {
            this.moveMonsterRandomly(monster);
        }
    }
    
    /**
     * Find which room a monster is currently in
     */
    findMonsterRoom(monster) {
        for (const room of this.dungeon.rooms) {
            if (monster.x >= room.x + 1 && monster.x < room.x + room.width - 1 &&
                monster.y >= room.y + 1 && monster.y < room.y + room.height - 1) {
                return room;
            }
        }
        return null; // Monster is in a corridor or outside rooms
    }
    
    /**
     * Move fleeing monster based on personality
     */
    moveFleeingMonster(monster, playerX, playerY) {
        switch (monster.fleeStyle) {
            case 'direct':
                this.moveMonsterAwayFrom(monster, playerX, playerY);
                break;
            case 'evasive':
                this.moveMonsterEvasively(monster, playerX, playerY);
                break;
            case 'random':
                this.moveMonsterRandomly(monster);
                break;
            default:
                this.moveMonsterAwayFrom(monster, playerX, playerY);
                break;
        }
    }
    
    /**
     * Move monster evasively (cunning fleeing - try to put obstacles between monster and player)
     */
    moveMonsterEvasively(monster, playerX, playerY) {
        const directions = [
            [-1, -1], [0, -1], [1, -1],
            [-1,  0],          [1,  0],
            [-1,  1], [0,  1], [1,  1]
        ];
        
        let bestMoves = [];
        let maxDistance = 0;
        
        // Evaluate all possible moves
        for (const [dx, dy] of directions) {
            const newX = monster.x + dx;
            const newY = monster.y + dy;
            
            if (!this.dungeon.isInBounds(newX, newY) ||
                !this.dungeon.isWalkable(newX, newY) ||
                (newX === playerX && newY === playerY) ||
                this.monsterSpawner.getMonsterAt(newX, newY)) {
                continue;
            }
            
            // Calculate distance from player after move
            const distanceFromPlayer = Math.max(Math.abs(newX - playerX), Math.abs(newY - playerY));
            
            // Bonus for line-of-sight breaking (hiding behind walls/doors)
            const lineOfSightBlocked = !this.fov.canSee(newX, newY, playerX, playerY, 10);
            const effectiveDistance = distanceFromPlayer + (lineOfSightBlocked ? 2 : 0);
            
            if (effectiveDistance > maxDistance) {
                maxDistance = effectiveDistance;
                bestMoves = [{x: newX, y: newY}];
            } else if (effectiveDistance === maxDistance) {
                bestMoves.push({x: newX, y: newY});
            }
        }
        
        // Choose randomly among best moves
        if (bestMoves.length > 0) {
            const chosenMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
            this.executeMonsterMove(monster, chosenMove.x, chosenMove.y);
        } else {
            // If no good evasive move, fall back to direct fleeing
            this.moveMonsterAwayFrom(monster, playerX, playerY);
        }
    }
    
    /**
     * Game over
     */
    gameOver() {
        this.gameState = 'dead';
        this.renderer.addLogMessage('=== GAME OVER ===');
        this.renderer.addLogMessage(`You explored for ${this.player.turnCount} turns.`);
        this.renderer.addLogMessage('Press Enter to restart.');
    }
    
    /**
     * Restart the game
     */
    restartGame() {

        
        // Clear autosave for fresh start
        this.deleteAutosave();
        
        // Clear level storage
        this.levels.clear();
        this.visitedLevels.clear();
        this.currentLevel = 1;
        this.previousLevel = null;
        
        // Reset game state
        this.gameState = 'playing';
        
        // Clear logs and add initial messages
        const logContainer = document.getElementById('log-container');
        if (logContainer) {
            logContainer.innerHTML = '';
            this.renderer.addLogMessage('Welcome to compl3xRL!');
            this.renderer.addLogMessage('Movement: hjkl + yubn (lowercase)');
            this.renderer.addLogMessage('Actions: . wait, o open door, c close door');
            this.renderer.addLogMessage('Equipment: i inventory, e equipment, w wear/wield, T take off');
            this.renderer.addLogMessage('Levels: > go down, < go up');
            this.renderer.addLogMessage('System: Q quit, S save (uppercase)');
        }
        
        // Reset player completely (this will trigger new player creation in generateNewLevel)
        this.player = null;
        
        // Generate new first level
        this.generateNewLevel();
        this.updateFOV();
        this.render();
        

    }
    
    /**
     * Toggle pause
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.renderer.addLogMessage('Game paused. Press ESC to continue.');
        } else {
            this.renderer.addLogMessage('Game resumed.');
        }
    }
    
    /**
     * Quit game
     */
    quitGame() {
        this.isRunning = false;
        this.renderer.addLogMessage('Thanks for playing!');
    }
    
    /**
     * Show inventory
     */
    showInventory() {
        if (window.subWindow) {
            window.subWindow.showInventory(this.player);
        }
    }
    
    /**
     * Show equipment overview
     */
    showEquipment() {
        if (window.subWindow) {
            window.subWindow.showEquipment(this.player);
        }
    }
    
    /**
     * Show equipment menu for all wearable items
     */
    showEquipmentMenu() {
        if (window.subWindow) {
            window.subWindow.showEquipmentMenu(this.player);
        }
    }
    
    /**
     * Show unequip menu
     */
    showUnequipMenu() {
        if (window.subWindow) {
            window.subWindow.showUnequipMenu(this.player);
        }
    }
    
    /**
     * Show food selection menu
     */
    showFoodMenu() {
        if (window.subWindow) {
            window.subWindow.showFoodMenu(this.player);
        }
    }
    
    /**
     * Show potion selection menu for drinking
     */
    showPotionMenu() {
        if (window.subWindow) {
            window.subWindow.showPotionMenu(this.player);
        }
    }
    
    /**
     * Handle close door action
     */
    closeDoorAction() {
        // Check for doors adjacent to player (8 directions)
        const directions = [
            { dx: 0, dy: -1, name: 'north', key: 'KeyK' },      // North (k)
            { dx: 1, dy: -1, name: 'northeast', key: 'KeyU' },  // Northeast (u)
            { dx: 1, dy: 0, name: 'east', key: 'KeyL' },        // East (l)
            { dx: 1, dy: 1, name: 'southeast', key: 'KeyN' },   // Southeast (n)
            { dx: 0, dy: 1, name: 'south', key: 'KeyJ' },       // South (j)
            { dx: -1, dy: 1, name: 'southwest', key: 'KeyB' },  // Southwest (b)
            { dx: -1, dy: 0, name: 'west', key: 'KeyH' },       // West (h)
            { dx: -1, dy: -1, name: 'northwest', key: 'KeyY' }  // Northwest (y)
        ];
        
        const doors = [];
        for (const dir of directions) {
            const x = this.player.x + dir.dx;
            const y = this.player.y + dir.dy;
            
            if (this.dungeon.hasDoor(x, y) && this.dungeon.getDoorState(x, y) === 'open') {
                doors.push({ x, y, direction: dir.name });
            }
        }
        
        if (doors.length === 0) {
            this.renderer.addLogMessage('There are no open doors nearby to close.');
            return;
        }
        
        if (doors.length === 1) {
            // Only one door, close it automatically
            const door = doors[0];
            if (this.player.closeDoor(door.x, door.y, this.dungeon)) {
                this.processTurn();
            }
                } else {
            // Multiple doors, ask which one to close
            const directionList = doors.map(door => door.direction).join(', ');
            this.renderer.addLogMessage(`Multiple doors found (${directionList}). Which door do you want to close?`);
            this.renderer.addLogMessage('Use direction keys: h(west), j(south), k(north), l(east), y(northwest), u(northeast), b(southwest), n(southeast), or Escape to cancel.');
            this.gameState = 'door_closing';
            this.doorChoices = doors;
        }
     }
     
     /**
     * Handle open door action
     */
    openDoorAction() {
        // Check for doors adjacent to player (8 directions)
        const directions = [
            { dx: 0, dy: -1, name: 'north', key: 'KeyK' },      // North (k)
            { dx: 1, dy: -1, name: 'northeast', key: 'KeyU' },  // Northeast (u)
            { dx: 1, dy: 0, name: 'east', key: 'KeyL' },        // East (l)
            { dx: 1, dy: 1, name: 'southeast', key: 'KeyN' },   // Southeast (n)
            { dx: 0, dy: 1, name: 'south', key: 'KeyJ' },       // South (j)
            { dx: -1, dy: 1, name: 'southwest', key: 'KeyB' },  // Southwest (b)
            { dx: -1, dy: 0, name: 'west', key: 'KeyH' },       // West (h)
            { dx: -1, dy: -1, name: 'northwest', key: 'KeyY' }  // Northwest (y)
        ];
        
        const doors = [];
        for (const dir of directions) {
            const x = this.player.x + dir.dx;
            const y = this.player.y + dir.dy;
            
            if (this.dungeon.hasDoor(x, y)) {
                const doorState = this.dungeon.getDoorState(x, y);
                if (doorState === 'closed' || doorState === 'locked') {
                    doors.push({ x, y, direction: dir.name, state: doorState });
                }
            }
        }
        
        if (doors.length === 0) {
            this.renderer.addLogMessage('There are no closed doors nearby to open.');
            return;
        }
        
        if (doors.length === 1) {
            // Only one door, try to open it automatically
            const door = doors[0];
            if (door.state === 'locked') {
                this.renderer.addLogMessage('The door is locked.');
                this.processTurn(); // Turn consumed by trying
            } else {
                if (this.player.openDoor(door.x, door.y, this.dungeon)) {
                    this.processTurn();
                }
            }
        } else {
            // Multiple doors, ask which one to open
            const directionList = doors.map(door => `${door.direction}${door.state === 'locked' ? ' (locked)' : ''}`).join(', ');
            this.renderer.addLogMessage(`Multiple doors found (${directionList}). Which door do you want to open?`);
            this.renderer.addLogMessage('Use direction keys: h(west), j(south), k(north), l(east), y(northwest), u(northeast), b(southwest), n(southeast), or Escape to cancel.');
            this.gameState = 'door_opening';
            this.doorChoices = doors;
        }
    }
     
     /**
     * Handle input during door closing selection
     */
    handleDoorClosingInput(event) {
        let selectedDoor = null;
        
        switch (event.code) {
            case 'KeyK': // North
                selectedDoor = this.doorChoices.find(d => d.direction === 'north');
                break;
            case 'KeyU': // Northeast
                selectedDoor = this.doorChoices.find(d => d.direction === 'northeast');
                break;
            case 'KeyL': // East
                selectedDoor = this.doorChoices.find(d => d.direction === 'east');
                break;
            case 'KeyN': // Southeast
                selectedDoor = this.doorChoices.find(d => d.direction === 'southeast');
                break;
            case 'KeyJ': // South
                selectedDoor = this.doorChoices.find(d => d.direction === 'south');
                break;
            case 'KeyB': // Southwest
                selectedDoor = this.doorChoices.find(d => d.direction === 'southwest');
                break;
            case 'KeyH': // West
                selectedDoor = this.doorChoices.find(d => d.direction === 'west');
                break;
            case 'KeyY': // Northwest
                selectedDoor = this.doorChoices.find(d => d.direction === 'northwest');
                break;
            case 'Escape':
                // Cancel door closing
                this.renderer.addLogMessage('Cancelled.');
                this.gameState = 'playing';
                this.doorChoices = null;
                return;
        }
        
        if (selectedDoor) {
            if (this.player.closeDoor(selectedDoor.x, selectedDoor.y, this.dungeon)) {
                this.processTurn();
            }
            this.gameState = 'playing';
            this.doorChoices = null;
        } else if (event.code.startsWith('Key')) {
            this.renderer.addLogMessage('Invalid direction. Use hjklyubn or Escape to cancel.');
        }
    }
    
    /**
     * Handle input during door opening selection
     */
    handleDoorOpeningInput(event) {
        let selectedDoor = null;
        
        switch (event.code) {
            case 'KeyK': // North
                selectedDoor = this.doorChoices.find(d => d.direction === 'north');
                break;
            case 'KeyU': // Northeast
                selectedDoor = this.doorChoices.find(d => d.direction === 'northeast');
                break;
            case 'KeyL': // East
                selectedDoor = this.doorChoices.find(d => d.direction === 'east');
                break;
            case 'KeyN': // Southeast
                selectedDoor = this.doorChoices.find(d => d.direction === 'southeast');
                break;
            case 'KeyJ': // South
                selectedDoor = this.doorChoices.find(d => d.direction === 'south');
                break;
            case 'KeyB': // Southwest
                selectedDoor = this.doorChoices.find(d => d.direction === 'southwest');
                break;
            case 'KeyH': // West
                selectedDoor = this.doorChoices.find(d => d.direction === 'west');
                break;
            case 'KeyY': // Northwest
                selectedDoor = this.doorChoices.find(d => d.direction === 'northwest');
                break;
            case 'Escape':
                // Cancel door opening
                this.renderer.addLogMessage('Cancelled.');
                this.gameState = 'playing';
                this.doorChoices = null;
                return;
        }
        
        if (selectedDoor) {
            if (selectedDoor.state === 'locked') {
                this.renderer.addLogMessage('The door is locked.');
                this.processTurn(); // Turn consumed by trying
            } else {
                if (this.player.openDoor(selectedDoor.x, selectedDoor.y, this.dungeon)) {
                    this.processTurn();
                }
            }
            this.gameState = 'playing';
            this.doorChoices = null;
        } else if (event.code.startsWith('Key')) {
            this.renderer.addLogMessage('Invalid direction. Use hjklyubn or Escape to cancel.');
        }
    }
    
    /**
     * Main game loop
     */
    gameLoop() {
        if (!this.isRunning) return;
        
        // Game logic is handled by input events
        // This is mainly for any continuous updates
        
        // Continue loop
        requestAnimationFrame(() => this.gameLoop());
    }
    
    /**
     * Start the game
     */
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.gameState = 'playing';
        this.renderer.addLogMessage('Game started! Classic roguelike controls: hjkl+yubn move, g pickup, d drop, i inventory, e equipment, . wait.');
        this.gameLoop();
    }
    
    /**
     * Stop the game
     */
    stop() {
        this.isRunning = false;
    }
    
    /**
     * Setup debug commands for terrain bias testing
     */
    setupTerrainDebugCommands() {
        // Make debug functions available in console
        window.debugTerrain = {
            // Show terrain analysis for current level
            analyze: () => {
                if (!this.itemManager) {
                    console.log('No ItemManager available');
                    return;
                }
                
                console.log('=== Terrain Analysis ===');
                
                let totalFloors = 0;
                let totalWeight = 0;
                
                // Count detailed information about locations by wall count
                let wallCounts = [0, 0, 0, 0, 0, 0, 0, 0, 0]; // 0-8 walls
                let weightByWallCount = [0, 0, 0, 0, 0, 0, 0, 0, 0];
                let locationTypes = {
                    'DEAD-END': 0,
                    'VERY-ENCLOSED': 0,
                    'ENCLOSED': 0,
                    'CORNER': 0,
                    'ROOM-CENTER': 0,
                    'ROOM': 0,
                    'NEAR-WALLS': 0,
                    'CORRIDOR': 0
                };
                
                for (let y = 0; y < this.dungeon.height; y++) {
                    for (let x = 0; x < this.dungeon.width; x++) {
                        const tile = this.dungeon.getTile(x, y);
                        if (tile.type === 'floor') {
                            totalFloors++;
                            const weight = this.itemManager.calculateLocationSpecialness(x, y);
                            totalWeight += weight;
                            
                            // Count walls
                            const wallsAround = this.itemManager.countNearbyWalls(x, y);
                            wallCounts[wallsAround]++;
                            weightByWallCount[wallsAround] = weight;
                            
                            // Determine location type
                            if (wallsAround >= 7) {
                                locationTypes['DEAD-END']++;
                            } else if (wallsAround >= 6) {
                                locationTypes['VERY-ENCLOSED']++;
                            } else if (wallsAround >= 5) {
                                locationTypes['ENCLOSED']++;
                            } else if (this.itemManager.isInAnyRoom(x, y)) {
                                if (this.itemManager.isRoomCenter(x, y)) {
                                    locationTypes['ROOM-CENTER']++;
                                } else {
                                    // Check for corner
                                    const north = !this.dungeon.isInBounds(x, y-1) || this.dungeon.getTile(x, y-1).type === 'wall';
                                    const south = !this.dungeon.isInBounds(x, y+1) || this.dungeon.getTile(x, y+1).type === 'wall';
                                    const east = !this.dungeon.isInBounds(x+1, y) || this.dungeon.getTile(x+1, y).type === 'wall';
                                    const west = !this.dungeon.isInBounds(x-1, y) || this.dungeon.getTile(x-1, y).type === 'wall';
                                    
                                    if ((north && east) || (north && west) || (south && east) || (south && west)) {
                                        locationTypes['CORNER']++;
                                    } else {
                                        locationTypes['ROOM']++;
                                    }
                                }
                            } else if (wallsAround >= 3) {
                                locationTypes['NEAR-WALLS']++;
                            } else {
                                locationTypes['CORRIDOR']++;
                            }
                        }
                    }
                }
                
                console.log(`Total floor tiles: ${totalFloors}`);
                console.log(`\nWall count distribution:`);
                for (let i = 0; i <= 8; i++) {
                    if (wallCounts[i] > 0) {
                        const pct = (wallCounts[i]/totalFloors*100).toFixed(1);
                        const weightInfo = weightByWallCount[i] > 0 ? ` (weight: ${weightByWallCount[i].toFixed(1)})` : '';
                        console.log(`  ${i} walls: ${wallCounts[i]} tiles (${pct}%)${weightInfo}`);
                    }
                }
                
                console.log(`\nLocation type distribution:`);
                for (const [type, count] of Object.entries(locationTypes)) {
                    if (count > 0) {
                        const pct = (count/totalFloors*100).toFixed(1);
                        console.log(`  ${type}: ${count} (${pct}%)`);
                    }
                }
                
                console.log(`\nAverage weight: ${(totalWeight/totalFloors).toFixed(2)}`);
            },
            
            // Force spawn items with terrain bias
            testSpawn: (count = 10) => {
                if (!this.itemManager) {
                    console.log('No ItemManager available');
                    return;
                }
                
                console.log(`=== Testing ${count} item spawns ===`);
                const results = [];
                
                for (let i = 0; i < count; i++) {
                    const pos = this.itemManager.getRandomFloorPosition();
                    if (pos) {
                        const weight = this.itemManager.calculateLocationSpecialness(pos.x, pos.y);
                        const wallsAround = this.itemManager.countNearbyWalls(pos.x, pos.y);
                        const types = [];
                        
                        if (this.itemManager.isDeadEnd(pos.x, pos.y)) types.push('dead-end');
                        if (this.itemManager.isCornerPosition(pos.x, pos.y)) types.push('corner');
                        if (this.itemManager.isHiddenAlcove(pos.x, pos.y)) types.push('alcove');
                        if (this.itemManager.isRoomCenter(pos.x, pos.y)) types.push('room-center');
                        if (this.itemManager.isCorridorJunction(pos.x, pos.y)) types.push('junction');
                        
                        results.push({ 
                            pos, 
                            weight, 
                            wallsAround,
                            types: types.length > 0 ? types.join(', ') : 'normal' 
                        });
                    }
                }
                
                results.sort((a, b) => b.weight - a.weight);
                results.forEach((r, i) => {
                    console.log(`${i+1}. (${r.pos.x}, ${r.pos.y}) weight: ${r.weight.toFixed(1)}, walls: ${r.wallsAround}/8 [${r.types}]`);
                });
                
                const avgWeight = results.reduce((sum, r) => sum + r.weight, 0) / results.length;
                const specialCount = results.filter(r => r.weight > 1.0).length;
                const deadEndCount = results.filter(r => r.types.includes('dead-end')).length;
                const trueDeadEnds = results.filter(r => r.wallsAround === 7).length;
                console.log(`Average weight: ${avgWeight.toFixed(2)}, Special locations: ${specialCount}/${results.length}, Dead-ends: ${deadEndCount}/${results.length}, True dead-ends (7/8 walls): ${trueDeadEnds}/${results.length}`);
            },
            
            // Show current items and their spawn locations
            showItems: () => {
                if (!this.itemManager || !this.itemManager.items) {
                    console.log('No items available');
                    return;
                }
                
                console.log('=== Current Items ===');
                const locationStats = {
                    'DEAD-END': 0,
                    'VERY-ENCLOSED': 0,
                    'ENCLOSED': 0,
                    'CORNER': 0,
                    'ROOM-CENTER': 0,
                    'ROOM': 0,
                    'NEAR-WALLS': 0,
                    'CORRIDOR': 0
                };
                
                this.itemManager.items.forEach((item, i) => {
                    const weight = this.itemManager.calculateLocationSpecialness(item.x, item.y);
                    const wallsAround = this.itemManager.countNearbyWalls(item.x, item.y);
                    let locationType = 'CORRIDOR';
                    
                    // Determine location type using same logic as item spawning
                    if (wallsAround >= 7) {
                        locationType = 'DEAD-END';
                    } else if (wallsAround >= 6) {
                        locationType = 'VERY-ENCLOSED';
                    } else if (wallsAround >= 5) {
                        locationType = 'ENCLOSED';
                    } else if (this.itemManager.isInAnyRoom(item.x, item.y)) {
                        if (this.itemManager.isRoomCenter(item.x, item.y)) {
                            locationType = 'ROOM-CENTER';
                        } else {
                            // Check for corner
                            const north = !this.dungeon.isInBounds(item.x, item.y-1) || this.dungeon.getTile(item.x, item.y-1).type === 'wall';
                            const south = !this.dungeon.isInBounds(item.x, item.y+1) || this.dungeon.getTile(item.x, item.y+1).type === 'wall';
                            const east = !this.dungeon.isInBounds(item.x+1, item.y) || this.dungeon.getTile(item.x+1, item.y).type === 'wall';
                            const west = !this.dungeon.isInBounds(item.x-1, item.y) || this.dungeon.getTile(item.x-1, item.y).type === 'wall';
                            
                            if ((north && east) || (north && west) || (south && east) || (south && west)) {
                                locationType = 'CORNER';
                            } else {
                                locationType = 'ROOM';
                            }
                        }
                    } else if (wallsAround >= 3) {
                        locationType = 'NEAR-WALLS';
                    }
                    
                    locationStats[locationType]++;
                    
                    console.log(`${i+1}. ${item.name} at (${item.x}, ${item.y}) - ${locationType}, weight: ${weight.toFixed(1)}, walls: ${wallsAround}/8`);
                });
                
                console.log(`\nTotal items: ${this.itemManager.items.length}`);
                console.log('Distribution by location type:');
                for (const [type, count] of Object.entries(locationStats)) {
                    if (count > 0) {
                        const pct = ((count / this.itemManager.items.length) * 100).toFixed(1);
                        console.log(`  ${type}: ${count} (${pct}%)`);
                    }
                }
            }
        };
        
        console.log('Terrain debug commands available:');
        console.log('- debugTerrain.analyze() - Analyze current level terrain');
        console.log('- debugTerrain.testSpawn(count) - Test item spawning with bias');
        console.log('- debugTerrain.showItems() - Show current items and their locations');
    }
    
    /**
     * Pick up item at player's position
     */
    pickupItem() {
        const itemsAtPosition = this.itemManager.getItemsAt(this.player.x, this.player.y);
        
        if (itemsAtPosition.length === 0) {
            this.renderer.addLogMessage('There is nothing here to pick up.');
            return false;
        }
        
        if (itemsAtPosition.length === 1) {
            // Single item - pick up directly
            const item = itemsAtPosition[0];
            return this.pickupSpecificItem(item, this.player.x, this.player.y);
        } else {
            // Multiple items - show selection menu
            if (window.subWindow) {
                window.subWindow.showItemSelectionMenu(itemsAtPosition, this.player.x, this.player.y);
            }
            return false; // Don't consume turn until item is selected
        }
    }
    
    /**
     * Pick up a specific item
     */
    pickupSpecificItem(item, x, y) {
        // Try to add to player inventory
        if (this.player.addToInventory(item)) {
            // Remove from dungeon floor
            this.itemManager.removeItem(item);
            // Consume a turn
            this.player.turnCount++;
            this.player.checkRegeneration();
            return true;
        } else {
            // Failed to pick up (inventory full, etc.)
            return false;
        }
    }
    
    /**
     * Drop item from inventory
     */
    dropItem() {
        if (this.player.inventory.length === 0) {
            this.renderer.addLogMessage('Your pack is empty.');
            return;
        }
        
        // Show drop selection menu
        if (window.subWindow) {
            window.subWindow.showDropMenu(this.player);
        }
    }
    
    /**
     * Drop a specific item from inventory
     */
    dropSpecificItem(item, inventoryIndex, quantity = null) {
        let droppedItem;
        
        if (quantity !== null && item.stackable && item.quantity > 1) {
            // Drop specific quantity from stack
            droppedItem = this.player.removeFromInventoryStack(inventoryIndex, quantity);
        } else {
            // Drop entire item/stack
            droppedItem = this.player.removeFromInventory(inventoryIndex);
        }
        
        if (droppedItem) {
            // Place item on ground at player position
            droppedItem.x = this.player.x;
            droppedItem.y = this.player.y;
            this.itemManager.addItem(droppedItem);
            
            // Consume a turn
            this.player.turnCount++;
            this.player.checkRegeneration();
            
            // Log message with quantity if stackable
            const message = droppedItem.stackable && droppedItem.quantity > 1 ? 
                `You drop ${droppedItem.quantity} ${droppedItem.name}.` :
                `You drop the ${droppedItem.name}.`;
            this.renderer.addLogMessage(message);
            
            // Update inventory display in sidebar
            this.renderer.updateInventoryDisplay(this.player);
            
            return true;
        }
        return false;
    }
    
    /**
     * Render the game
     */
    render() {
        if (!this.dungeon || !this.player) return;
        
        // Clear renderer
        this.renderer.clear();
        
        // Calculate view position (center on player)
        const view = this.renderer.centerOnPlayer(this.player);
        
        // Draw dungeon
        this.renderer.drawDungeon(this.dungeon, view.x, view.y, this.fov);
        
        // Draw items
        const items = this.itemManager.getVisibleItems(this.fov);
        this.renderer.drawItems(items, view.x, view.y, this.fov);
        
        // Draw monsters
        const livingMonsters = this.monsterSpawner.getLivingMonsters();
        this.renderer.drawMonsters(livingMonsters, view.x, view.y, this.fov);
        
        // Draw player
        this.renderer.drawPlayer(this.player, view.x, view.y);
        
        // Render to screen
        this.renderer.render();
        
        // Update UI
        this.renderer.updateUI(this.player, livingMonsters, this.fov);
    }
    
    /**
     * Check if movement should be stopped due to newly visible monsters
     */
    shouldStopForMonsterDetection() {
        if (!this.autoStopEnabled || !this.fov || !this.monsterSpawner) {
            return false;
        }
        
        const currentlyVisibleMonsters = this.getCurrentlyVisibleMonsters();
        
        // Check for newly visible monsters
        for (const monsterId of currentlyVisibleMonsters) {
            if (!this.previouslyVisibleMonsters.has(monsterId)) {
                // New monster detected! Stop movement
                if (this.renderer) {
                    this.renderer.addLogMessage("You spot a monster and stop moving!", 'warning');
                }
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Get currently visible monster IDs
     */
    getCurrentlyVisibleMonsters() {
        const visibleMonsters = new Set();
        
        if (!this.fov || !this.monsterSpawner) {
            return visibleMonsters;
        }
        
        const livingMonsters = this.monsterSpawner.getLivingMonsters();
        for (const monster of livingMonsters) {
            if (this.fov.getTileVisibility(monster.x, monster.y).visible) {
                // Use monster's unique identifier (position-based ID for consistency)
                const monsterId = `${monster.name}_${monster.x}_${monster.y}_${monster.hp}`;
                visibleMonsters.add(monsterId);
            }
        }
        
        return visibleMonsters;
    }
    
    /**
     * Update the tracking of visible monsters for auto-stop feature
     */
    updateVisibleMonsterTracking() {
        if (!this.autoStopEnabled) {
            return;
        }
        
        // Update the set of previously visible monsters
        this.previouslyVisibleMonsters = this.getCurrentlyVisibleMonsters();
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    
    window.game = new Game();
}); 