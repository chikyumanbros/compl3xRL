/**
 * Game level generation, loading, and multi-level management
 * Extracted from Game class for modularity.
 */
(function () {
    if (typeof Game === 'undefined') {
        console.error('Game class not found for level helpers.');
        return;
    }

    const GameRef = Game;

    /**
     * Generate a new dungeon level or load existing one
     */
    GameRef.prototype.generateNewLevel = function() {
        
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
    };

    /**
     * Create a completely new level
     */
    GameRef.prototype.createNewLevel = function() {
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
        
        // Store this level
        this.saveLevelState();
        this.visitedLevels.add(this.currentLevel);
    };

    /**
     * Load an existing level from storage
     */
    GameRef.prototype.loadLevel = function(levelNumber, preservePlayerPosition = false) {
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
    };

    /**
     * Save current level state
     */
    GameRef.prototype.saveLevelState = function() {
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
    };

    /**
     * Clean up old levels to manage memory
     */
    GameRef.prototype.cleanupOldLevels = function() {
        if (this.levels.size <= this.maxStoredLevels) return;
        
        // Get all level numbers sorted by timestamp (oldest first)
        const levelEntries = Array.from(this.levels.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);
        
        // Remove oldest levels until we're under the limit
        while (this.levels.size > this.maxStoredLevels) {
            const [oldestLevel] = levelEntries.shift();
            
            this.levels.delete(oldestLevel);
        }
    };
})();

