/**
 * Noise System for Roguelike Game
 * Classic roguelike noise mechanics with sound propagation and monster awakening
 */

class NoiseSystem {
    constructor(game) {
        this.game = game;
        
        // Sound level definitions (classic roguelike scale)
        this.soundLevels = {
            // Player actions
            MOVE: 1,           // Quiet footsteps
            ATTACK: 3,         // Combat noise  
            DOOR_OPEN: 2,      // Door creaking
            DOOR_CLOSE: 2,     // Door slamming
            DOOR_SLAM: 4,      // Door slam attack (very loud)
            ITEM_USE: 1,       // Quiet item usage
            
            // Monster actions
            MONSTER_MOVE: 1,   // Monster footsteps
            MONSTER_ATTACK: 3, // Monster combat
            MONSTER_WAKE: 2,   // Monster stirring awake
            MONSTER_FLEE: 2,   // Panicked movement
            
            // Environmental
            SILENCE: 0         // No sound
        };
        
        // Base range for each sound level (in tiles)
        this.soundRanges = {
            0: 0,  // Silent
            1: 2,  // Quiet - 2 tile radius
            2: 4,  // Moderate - 4 tile radius  
            3: 6,  // Loud - 6 tile radius
            4: 8,  // Very loud - 8 tile radius
            5: 10  // Extremely loud - 10 tile radius
        };
        
        // Wake up probability based on sound level and distance
        this.wakeupChances = {
            1: 0.15, // 15% chance for quiet sounds
            2: 0.35, // 35% chance for moderate sounds
            3: 0.60, // 60% chance for loud sounds
            4: 0.85, // 85% chance for very loud sounds
            5: 1.0   // 100% chance for extremely loud sounds
        };
    }
    
    /**
     * Generate a sound at the specified location
     */
    makeSound(x, y, soundLevel, source = null) {
        if (soundLevel <= 0) return;
        
        const range = this.soundRanges[soundLevel] || 0;
        if (range <= 0) return;
        
        // Find all monsters within potential hearing range
        const affectedMonsters = this.game.monsterSpawner.getLivingMonsters().filter(monster => {
            if (!monster.isAlive || !monster.isAsleep) return false;
            
            const distance = Math.max(Math.abs(monster.x - x), Math.abs(monster.y - y));
            return distance <= range;
        });
        
        // Check each monster for noise awakening
        affectedMonsters.forEach(monster => {
            this.checkNoiseAwakening(monster, x, y, soundLevel);
        });
    }
    
    /**
     * Check if a monster should wake up from noise
     */
    checkNoiseAwakening(monster, soundX, soundY, soundLevel) {
        // Calculate actual distance
        const distance = Math.max(Math.abs(monster.x - soundX), Math.abs(monster.y - soundY));
        const maxRange = this.soundRanges[soundLevel];
        
        if (distance > maxRange) return;
        
        // Check line of "hearing" - sound can pass through some obstacles
        const hearingStrength = this.calculateHearingStrength(monster.x, monster.y, soundX, soundY, soundLevel);
        
        if (hearingStrength <= 0) return;
        
        // Calculate wake up probability based on:
        // 1. Base sound level
        // 2. Distance (closer = louder)
        // 3. Monster's sleep depth
        // 4. Hearing obstruction
        
        let baseChance = this.wakeupChances[soundLevel] || 0;
        
        // Distance factor (linear reduction)
        const distanceFactor = Math.max(0, 1 - (distance / maxRange));
        
        // Sleep depth factor
        const sleepFactor = this.getSleepDepthFactor(monster.sleepDepth);
        
        // Final probability
        const wakeupChance = baseChance * distanceFactor * sleepFactor * hearingStrength;
        
        if (Math.random() < wakeupChance) {
            monster.wakeUp('noise');
            
            
        }
    }
    
    /**
     * Calculate how well sound travels from source to target
     */
    calculateHearingStrength(monsterX, monsterY, soundX, soundY, soundLevel) {
        // Use simplified line algorithm to check for sound-blocking obstacles
        const dx = soundX - monsterX;
        const dy = soundY - monsterY;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        
        if (distance === 0) return 1.0;
        
        let soundStrength = 1.0;
        const steps = distance;
        const stepX = dx / steps;
        const stepY = dy / steps;
        
        // Check each step for sound-blocking obstacles
        for (let i = 1; i < steps; i++) {
            const checkX = Math.round(monsterX + stepX * i);
            const checkY = Math.round(monsterY + stepY * i);
            
            if (!this.game.dungeon.isInBounds(checkX, checkY)) {
                soundStrength *= 0.1; // Out of bounds severely dampens sound
                continue;
            }
            
            const tile = this.game.dungeon.getTile(checkX, checkY);
            
            // Different tiles affect sound differently
            switch (tile.type) {
                case 'wall':
                    soundStrength *= 0.1; // Walls heavily dampen sound
                    break;
                case 'door':
                    if (tile.doorState === 'closed') {
                        soundStrength *= 0.5; // Closed doors dampen sound moderately
                    }
                    // Open doors don't affect sound
                    break;
                // Floor and corridor don't affect sound
            }
            
            // If sound is too weak, stop calculating
            if (soundStrength < 0.05) {
                return 0;
            }
        }
        
        return soundStrength;
    }
    
    /**
     * Get sleep depth factor for wake up calculations
     */
    getSleepDepthFactor(sleepDepth) {
        switch (sleepDepth) {
            case 'light':
                return 1.5;  // Light sleepers wake easier
            case 'normal':
                return 1.0;  // Normal sleep
            case 'deep':
                return 0.5;  // Deep sleepers harder to wake
            default:
                return 1.0;
        }
    }
    
    /**
     * Get sound level for player action
     */
    getPlayerActionSound(action) {
        return this.soundLevels[action] || this.soundLevels.SILENCE;
    }
    
    /**
     * Get sound level for monster action
     */
    getMonsterActionSound(action) {
        return this.soundLevels[action] || this.soundLevels.SILENCE;
    }
}