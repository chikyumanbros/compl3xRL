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
        // Disarm state
        this.awaitingDisarmDirection = null; // { candidates: Set<'x,y'> }
        
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
     * Check for items at player position and display message
     */
    checkItemsAtPlayerPosition() {
        const itemsAtPosition = this.itemManager.getItemsAt(this.player.x, this.player.y);
        
        if (itemsAtPosition.length > 0) {
            if (itemsAtPosition.length === 1) {
                const item = itemsAtPosition[0];
                const displayName = item.getDisplayName ? item.getDisplayName() : item.name;
                if (this.isTileVisible(this.player.x, this.player.y)) {
                    this.renderer.addLogMessage(`You see ${displayName} here.`);
                }
            } else {
                if (this.isTileVisible(this.player.x, this.player.y)) {
                    this.renderer.addLogMessage(`You see several items here.`);
                }
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
            // Update sight range based on status effects
            const effectiveSightRange = this.player.getEffectiveSightRange();
            this.fov.setViewRange(effectiveSightRange);
            
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

        // Leave scent trail (used by sniffing AI)
        if (this.dungeon && typeof this.dungeon.addScent === 'function') {
            this.dungeon.addScent(this.player.x, this.player.y, 5);
        }
        
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
                // Blood spill on the ground if bleeding
                if (this.dungeon && this.player.statusEffects && this.player.statusEffects.hasEffect && this.player.statusEffects.hasEffect('bleeding')) {
                    this.dungeon.addBlood(this.player.x, this.player.y, result.damage);
                }
            }
            // Then log other messages (recovery, etc.)
            for (const message of result.messages) {
                if (this.renderer) {
                    this.renderer.addLogMessage(message);
                }
            }
            // Player may have died from DoT (bleeding, poison, etc.)
            if (this.player.hp <= 0) {
                this.gameOver();
                return;
            }
        }
        
        // Update field of vision after player moves
        this.updateFOV();
        
        // Update visible monster tracking for auto-stop feature
        this.updateVisibleMonsterTracking();
        
        // Process energy-based turns for all entities
        this.processEnergyTurns();
        // World step: liquids diffusion/drying, scent decay
        if (this.dungeon && typeof this.dungeon.stepLiquids === 'function') {
            this.dungeon.stepLiquids();
        }
        
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
                if (this.renderer && this.isTileVisible(monster.x, monster.y)) {
                    this.renderer.addLogMessage(`The ${monster.name} takes ${result.damage} damage from status effects!`);
                }
                monster.takeDirectDamage(result.damage);
                // Blood spill for bleeding monsters
                if (this.dungeon && monster.statusEffects && monster.statusEffects.hasEffect && monster.statusEffects.hasEffect('bleeding')) {
                    this.dungeon.addBlood(monster.x, monster.y, result.damage);
                }
                if (!monster.isAlive) {
                    if (this.renderer && this.isTileVisible(monster.x, monster.y)) {
                        this.renderer.addLogMessage(`The ${monster.name} dies from its wounds!`, 'victory');
                    }
                    this.player.gainExp(monster.expValue);
                    // Drop corpse for DoT deaths
                    if (this.itemManager && typeof this.itemManager.addCorpse === 'function') {
                        const corpseChance = this.calculateCorpseChance(monster, 'DoT');
                        if (Math.random() < corpseChance) {
                            this.itemManager.addCorpse(monster);
                            if (this.renderer && this.isTileVisible(monster.x, monster.y)) {
                                this.renderer.addBattleLogMessage('A corpse remains.', 'normal');
                            }
                        } else {
                            if (this.renderer && this.isTileVisible(monster.x, monster.y)) {
                                const destroyMessages = [
                                    'The body withers away completely.',
                                    'The wounds prove too severe.',
                                    'Nothing remains but stains.',
                                    'The carcass crumbles to nothing.'
                                ];
                                this.renderer.addBattleLogMessage(destroyMessages[Math.floor(Math.random() * destroyMessages.length)], 'normal');
                            }
                        }
                    }
                    // Blood spill on death (off-screen too)
                    if (this.dungeon && typeof this.dungeon.addBlood === 'function') {
                        const amount = Math.max(1, Math.min(10, Math.floor((monster.maxHp || 6) / 4)));
                        this.dungeon.addBlood(monster.x, monster.y, amount);
                        // Occasionally spatter to nearby tiles randomly
                        if (Math.random() < 0.4) {
                            for (let dx = -1; dx <= 1; dx++) {
                                for (let dy = -1; dy <= 1; dy++) {
                                    if (dx === 0 && dy === 0) continue;
                                    const nx = monster.x + dx;
                                    const ny = monster.y + dy;
                                    if (!this.dungeon.isInBounds(nx, ny)) continue;
                                    const t = this.dungeon.getTile(nx, ny);
                                    if (t.type !== 'floor') continue;
                                    if (Math.random() < 0.5) {
                                        this.dungeon.addBlood(nx, ny, Math.max(1, Math.floor(amount / 3)));
                                    }
                                }
                            }
                        }
                    }
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
                
                // Corpses and blood attract monsters (scent range similar to noise, but wider)
                const attractionRange = 15; // Wider than max noise (10) so scent carries far
                const attraction = this.findNearestCorpseOrBlood(monster, attractionRange);
                if (attraction && Math.random() < this.getMonsterAttractionChance(monster)) {
                    this.moveMonsterTowards(monster, attraction.x, attraction.y);
                } else {
                    // Awake monsters patrol their area (classic roguelike behavior)
                    this.performMonsterPatrol(monster);
                }
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
        // Footprints: pickup from current tile
        if (this.dungeon) {
            const t = this.dungeon.getTile(monster.x, monster.y);
            if (t && t.type === 'floor' && t.blood && t.blood > 0 && Math.random() < 0.3) {
                t.blood = Math.max(0, t.blood - 1);
                if (!monster._carriedBlood) monster._carriedBlood = 0;
                monster._carriedBlood = Math.min(2, monster._carriedBlood + 1);
            }
        }
        monster.x = newX;
        monster.y = newY;
        if (monster._carriedBlood && monster._carriedBlood > 0 && this.dungeon) {
            const dt = this.dungeon.getTile(monster.x, monster.y);
            if (dt && dt.type === 'floor') {
                this.dungeon.addBlood(monster.x, monster.y, monster._carriedBlood);
                monster._carriedBlood = 0;
            }
        }
        
        // Generate monster movement sound
        if (this.noiseSystem) {
            const soundType = monster.isFleeing ? 'MONSTER_FLEE' : 'MONSTER_MOVE';
            this.noiseSystem.makeSound(monster.x, monster.y, this.noiseSystem.getMonsterActionSound(soundType));
        }

        // Slip chance on blood
        if (this.dungeon) {
            const t = this.dungeon.getTile(monster.x, monster.y);
            if (t && t.type === 'floor' && t.blood && t.blood > 0 && Math.random() < Math.min(0.2, t.blood * 0.02)) {
                // Skip action next turn (simple stun)
                if (monster.statusEffects) monster.statusEffects.addEffect('stunned', 1, 1, 'blood slip');
                if (this.renderer && this.isTileVisible(monster.x, monster.y)) {
                    this.renderer.addLogMessage(`The ${monster.name} slips on the blood!`);
                }
            }
        }

        // Check trap triggering for monsters after moving onto tile
        const tile = this.dungeon.getTile(monster.x, monster.y);
        if (tile && tile.trap && !tile.trap.disarmed) {
            const trap = tile.trap;
            // Monsters don't have encumbrance; use monster-specific trigger chance
            const willTrigger = Math.random() < this.computeTrapTriggerChanceForMonster(trap, monster);
            if (willTrigger) {
                this.triggerTrapAt(monster.x, monster.y, monster);
            }
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
     * Find nearest tile with corpse or significant blood (for attraction / scavenging)
     * @param {Monster} monster
     * @param {number} maxRange - max Chebyshev distance to search (default 15, wider than noise)
     * @returns {{ x: number, y: number } | null}
     */
    findNearestCorpseOrBlood(monster, maxRange = 15) {
        if (!this.dungeon || !this.itemManager) return null;
        let best = null;
        let bestDist = maxRange + 1;
        const mx = monster.x;
        const my = monster.y;
        for (let dy = -maxRange; dy <= maxRange; dy++) {
            for (let dx = -maxRange; dx <= maxRange; dx++) {
                const dist = Math.max(Math.abs(dx), Math.abs(dy));
                if (dist > maxRange || dist === 0) continue;
                const tx = mx + dx;
                const ty = my + dy;
                if (!this.dungeon.isInBounds(tx, ty) || !this.dungeon.isWalkable(tx, ty)) continue;
                if (this.monsterSpawner.getMonsterAt(tx, ty) || (tx === this.player.x && ty === this.player.y)) continue;
                let attractive = false;
                const items = this.itemManager.getItemsAt(tx, ty);
                if (items.some(item => item.type === 'corpse')) attractive = true;
                const tile = this.dungeon.getTile(tx, ty);
                const blood = typeof tile.blood === 'number' ? tile.blood : 0;
                if (blood >= 2) attractive = true;
                if (attractive && dist < bestDist) {
                    bestDist = dist;
                    best = { x: tx, y: ty };
                }
            }
        }
        // Player carrying a corpse attracts monsters (scent of death)
        if (this.player && this.playerHasCorpse()) {
            const px = this.player.x;
            const py = this.player.y;
            const pdist = Math.max(Math.abs(px - mx), Math.abs(py - my));
            if (pdist <= maxRange && pdist < bestDist) {
                best = { x: px, y: py };
                bestDist = pdist;
            }
        }
        return best;
    }

    /**
     * True if the player has at least one corpse in inventory
     */
    playerHasCorpse() {
        if (!this.player || !Array.isArray(this.player.inventory)) return false;
        return this.player.inventory.some(item => item && item.type === 'corpse');
    }

    /**
     * Probability that a monster is attracted to corpse/blood when not chasing player
     */
    getMonsterAttractionChance(monster) {
        switch (monster.intelligence) {
            case 'mindless':
                return 0.15; // Slimes, etc. slightly drawn to blood
            case 'animal':
                return 0.6;  // Wolves, jackals, etc. strongly attracted
            case 'normal':
                return 0.4;  // Humanoids may scavenge
            case 'smart':
                return 0.3;
            case 'genius':
                return 0.2;
            default:
                return 0.35;
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
        // Redraw so HP and stats show final state (fixes display when dying from bleeding/DoT)
        if (this.player && this.renderer) {
            this.render();
        }
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
                this.render();
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
                this.render();
            } else {
                if (this.player.openDoor(door.x, door.y, this.dungeon)) {
                    this.processTurn();
                    this.render();
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
                this.render();
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
                this.render();
            } else {
                if (this.player.openDoor(selectedDoor.x, selectedDoor.y, this.dungeon)) {
                    this.processTurn();
                    this.render();
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