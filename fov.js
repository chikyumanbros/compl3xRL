/**
 * Field of Vision (FOV) System for Roguelike Game
 * Handles visibility calculations and fog of war
 */
class FOV {
    constructor(dungeon) {
        this.dungeon = dungeon;
        this.visibleTiles = new Set();
        this.exploredTiles = new Set();
        this.viewRange = 5; // Player's sight range in rooms
    }
    
    /**
     * Calculate visible area from player position - corridor-aware
     */
    calculateVisibility(playerX, playerY) {
        this.visibleTiles.clear();
        
        // Add player position as visible
        this.addVisibleTile(playerX, playerY);
        
        // Check if player is in a corridor
        const inCorridor = this.isInCorridor(playerX, playerY);
        
        if (inCorridor) {
            // Limited corridor visibility - only along the corridor direction
            this.calculateCorridorVisibility(playerX, playerY);
        } else {
            // Normal room visibility
            this.calculateRoomVisibility(playerX, playerY);
        }
        
        // Add all visible tiles to explored tiles
        for (const tileKey of this.visibleTiles) {
            this.exploredTiles.add(tileKey);
        }
    }
    
    /**
     * Check if player is in a corridor (narrow passage)
     */
    isInCorridor(x, y) {
        // Check if surrounded by walls on at least 2 opposite sides
        const north = this.dungeon.getTile(x, y - 1).type === 'wall';
        const south = this.dungeon.getTile(x, y + 1).type === 'wall';
        const east = this.dungeon.getTile(x + 1, y).type === 'wall';
        const west = this.dungeon.getTile(x - 1, y).type === 'wall';
        
        // Horizontal corridor (walls north and south)
        if (north && south && (!east || !west)) {
            return 'horizontal';
        }
        
        // Vertical corridor (walls east and west)  
        if (east && west && (!north || !south)) {
            return 'vertical';
        }
        
        return false;
    }
    
    /**
     * Calculate visibility in corridors - limited to corridor direction
     */
    calculateCorridorVisibility(playerX, playerY) {
        const corridorType = this.isInCorridor(playerX, playerY);
        const range = 3; // Short range in corridors
        
        if (corridorType === 'horizontal') {
            // See along east-west direction only
            this.castRayInDirection(playerX, playerY, 1, 0, range);   // East
            this.castRayInDirection(playerX, playerY, -1, 0, range);  // West
        } else if (corridorType === 'vertical') {
            // See along north-south direction only
            this.castRayInDirection(playerX, playerY, 0, 1, range);   // South
            this.castRayInDirection(playerX, playerY, 0, -1, range);  // North
        }
        
        // Also see immediately adjacent cells
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const x = playerX + dx;
                const y = playerY + dy;
                if (this.dungeon.isInBounds(x, y)) {
                    this.addVisibleTile(x, y);
                }
            }
        }
    }
    
    /**
     * Calculate normal room visibility
     */
    calculateRoomVisibility(playerX, playerY) {
        const rayCount = 64;
        
        for (let i = 0; i < rayCount; i++) {
            const angle = (i / rayCount) * 2 * Math.PI;
            this.castRay(playerX, playerY, angle);
        }
    }
    
    /**
     * Cast ray in specific direction
     */
    castRayInDirection(startX, startY, dx, dy, maxRange) {
        for (let distance = 1; distance <= maxRange; distance++) {
            const x = startX + dx * distance;
            const y = startY + dy * distance;
            
            if (!this.dungeon.isInBounds(x, y)) {
                break;
            }
            
            this.addVisibleTile(x, y);
            
            const tile = this.dungeon.getTile(x, y);
            if (tile.type === 'wall' || 
                (tile.type === 'door' && tile.doorState !== 'open')) {
                break;
            }
        }
    }
    
    /**
     * Cast a ray from player position at given angle
     */
    castRay(startX, startY, angle) {
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);
        
        for (let distance = 1; distance <= this.viewRange; distance++) {
            const x = Math.round(startX + dx * distance);
            const y = Math.round(startY + dy * distance);
            
            // Check bounds
            if (!this.dungeon.isInBounds(x, y)) {
                break;
            }
            
            // Add tile to visible set
            this.addVisibleTile(x, y);
            
            // Stop ray if we hit a wall or closed door
            const tile = this.dungeon.getTile(x, y);
            if (tile.type === 'wall' || 
                (tile.type === 'door' && tile.doorState !== 'open')) {
                break;
            }
        }
    }
    
    /**
     * Add tile to visible set
     */
    addVisibleTile(x, y) {
        const key = `${x},${y}`;
        this.visibleTiles.add(key);
    }
    
    /**
     * Check if a tile is currently visible
     */
    isVisible(x, y) {
        const key = `${x},${y}`;
        return this.visibleTiles.has(key);
    }
    
    /**
     * Check if a tile has been explored (seen before)
     */
    isExplored(x, y) {
        const key = `${x},${y}`;
        return this.exploredTiles.has(key);
    }
    
    /**
     * Get visibility status for a tile
     */
    getTileVisibility(x, y) {
        return {
            visible: this.isVisible(x, y),
            explored: this.isExplored(x, y)
        };
    }
    
    /**
     * Get visibility status for a tile (alias for getTileVisibility)
     */
    getVisibility(x, y) {
        return this.getTileVisibility(x, y);
    }
    
    /**
     * Set view range (sight distance)
     */
    setViewRange(range) {
        this.viewRange = Math.max(1, Math.min(range, 15));
    }
    
    /**
     * Clear all visibility data (for new level)
     */
    reset() {
        this.visibleTiles.clear();
        this.exploredTiles.clear();
    }
    
    /**
     * Check if there's a clear line of sight between two points
     */
    canSee(fromX, fromY, toX, toY, maxRange = 10) {
        const dx = toX - fromX;
        const dy = toY - fromY;
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        
        // Check if target is within range
        if (distance > maxRange) {
            return false;
        }
        
        // Same position
        if (distance === 0) {
            return true;
        }
        
        // Use Bresenham-like algorithm to check line of sight
        const steps = distance;
        const stepX = dx / steps;
        const stepY = dy / steps;
        
        for (let i = 1; i <= steps; i++) {
            const checkX = Math.round(fromX + stepX * i);
            const checkY = Math.round(fromY + stepY * i);
            
            // Check bounds
            if (!this.dungeon.isInBounds(checkX, checkY)) {
                return false;
            }
            
            const tile = this.dungeon.getTile(checkX, checkY);
            
            // If we've reached the target, sight is clear
            if (checkX === toX && checkY === toY) {
                return true;
            }
            
            // Check if this tile blocks sight
            if (tile.type === 'wall' || 
                (tile.type === 'door' && tile.doorState !== 'open')) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Calculate simplified visibility for monsters (no memory, just current sight)
     */
    calculateMonsterVisibility(monsterX, monsterY, range = 8) {
        const visibleTiles = new Set();
        
        // Check all tiles within range
        for (let dx = -range; dx <= range; dx++) {
            for (let dy = -range; dy <= range; dy++) {
                const targetX = monsterX + dx;
                const targetY = monsterY + dy;
                
                // Skip if out of range (use Chebyshev distance)
                if (Math.max(Math.abs(dx), Math.abs(dy)) > range) {
                    continue;
                }
                
                // Check line of sight
                if (this.canSee(monsterX, monsterY, targetX, targetY, range)) {
                    const key = `${targetX},${targetY}`;
                    visibleTiles.add(key);
                }
            }
        }
        
        return visibleTiles;
    }
    
    /**
     * Get debug info
     */
    getDebugInfo() {
        return {
            visibleCount: this.visibleTiles.size,
            exploredCount: this.exploredTiles.size,
            viewRange: this.viewRange
        };
    }
    
    /**
     * Save FOV state for level persistence
     */
    saveState() {
        return {
            exploredTiles: Array.from(this.exploredTiles),
            viewRange: this.viewRange
        };
    }
    
    /**
     * Restore FOV state from saved data
     */
    restoreState(savedState) {
        if (savedState) {
            this.exploredTiles.clear();
            if (savedState.exploredTiles) {
                savedState.exploredTiles.forEach(tileKey => {
                    this.exploredTiles.add(tileKey);
                });
                
            }
            if (savedState.viewRange !== undefined) {
                this.viewRange = savedState.viewRange;
    
            }
        } else {

        }
        
        // Clear visible tiles (will be recalculated)
        this.visibleTiles.clear();
    }
} 