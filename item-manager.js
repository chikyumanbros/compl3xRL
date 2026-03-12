/**
 * Item Manager with food support
 */
class ItemManager {
    constructor(dungeon) {
        this.dungeon = dungeon;
        this.items = [];
    }

    /**
     * Create a non-interactive corpse item from a monster and add to ground
     */
    addCorpse(monster) {
        if (!monster || typeof monster.x !== 'number' || typeof monster.y !== 'number') return null;
        const name = monster.name ? `${monster.name} corpse` : 'monster corpse';
        const weight = Math.max(3, Math.floor((monster.maxHp || 6) / 2));
        const corpse = new Item('corpse', name, {
            description: `The remains of ${monster.name || 'a creature'}.`,
            x: monster.x,
            y: monster.y,
            symbol: ';',
            color: 'corpse',
            stackable: false,
            quantity: 1,
            maxStackSize: 1,
            weight
        });
        // Rot / gas emission state (processed by Game each world step)
        corpse.rotTurns = 0;
        corpse.miasmaEmitting = false;
        this.addItem(corpse);
        return corpse;
    }
    
    /**
     * Create a food item by type
     */
    createFood(type, x = 0, y = 0) {
        const foodData = FOOD_TYPES[type];
        if (!foodData) {

            return null;
        }
        
        const food = new FoodItem(foodData.name, {
            ...foodData,
            x: x,
            y: y
        });
        
        return food;
    }
    
    /**
     * Add item to the dungeon floor
     */
    addItem(item) {
        this.items.push(item);
    }
    
    /**
     * Remove item from the dungeon floor
     */
    removeItem(item) {
        const index = this.items.indexOf(item);
        if (index !== -1) {
            this.items.splice(index, 1);
            return true;
        }
        return false;
    }
    
    /**
     * Get all items in the dungeon
     */
    getAllItems() {
        return this.items;
    }
    
    /**
     * Get items at specific position
     */
    getItemsAt(x, y) {
        return this.items.filter(item => item.x === x && item.y === y);
    }
    
    /**
     * Get visible items at specific position
     */
    getVisibleItemsAt(x, y, fov) {
        const itemsAtPosition = this.getItemsAt(x, y);
        return itemsAtPosition.filter(item => {
            if (!fov || typeof fov.getVisibility !== 'function') {
                return true;
            }
            
            try {
                const visibility = fov.getVisibility(x, y);
                return visibility.visible || (item.hasBeenSeen && visibility.explored);
            } catch (error) {
                console.warn('FOV error for item visibility check:', error);
                return true;
            }
        });
    }
    
    /**
     * Process aging for perishable items
     */
    processAging() {
        this.items.forEach(item => {
            if (item instanceof FoodItem && item.perishable) {
                item.age();
            }
        });
    }
    
    /**
     * Update item visibility based on FOV
     */
    updateItemVisibility(fov, playerTurn) {
        this.items.forEach(item => {
            if (fov && typeof fov.getVisibility === 'function') {
                try {
                    const visibility = fov.getVisibility(item.x, item.y);
                    if (visibility.visible) {
                        // Player can see this item now
                        item.hasBeenSeen = true;
                        item.lastSeenTurn = playerTurn;
                    }
                } catch (error) {
        
                }
            }
        });
    }
    
    /**
     * Get items that should be visible to player
     */
    getVisibleItems(fov) {
        return this.items.filter(item => {
            if (!fov || typeof fov.getVisibility !== 'function') {
                return true; // Show all items if no FOV
            }
            
            try {
                const visibility = fov.getVisibility(item.x, item.y);
                // Only show items that are currently visible OR have been seen before
                return visibility.visible || (item.hasBeenSeen && visibility.explored);
            } catch (error) {
                console.warn('FOV error for item visibility check:', error);
                return true; // Show item on error
            }
        });
    }
    
    /**
     * Generate random items throughout the dungeon
     */
    spawnItems(level) {
        // Balanced item count: 3-6 items per level
        const numItems = 3 + Math.floor(Math.random() * 4); // 3-6 items per level
        let spawnedCount = 0;
        let locationStats = {
            'DEAD-END': 0,
            'VERY-ENCLOSED': 0,
            'ENCLOSED': 0,
            'CORNER': 0,
            'ROOM-CENTER': 0,
            'ROOM': 0,
            'NEAR-WALLS': 0,
            'CORRIDOR': 0
        };
        
        console.log(`\n=== Spawning ${numItems} items for level ${level} ===`);
        
        for (let i = 0; i < numItems; i++) {
            const positionData = this.getRandomFloorPosition();
            if (positionData) {
                const item = this.createRandomItem(level);
                if (item && typeof item === 'object') {
                    // Ensure coordinates are set correctly
                    item.x = positionData.x;
                    item.y = positionData.y;
                    
                    // Validate item has required properties
                    if (typeof item.x === 'number' && typeof item.y === 'number' && item.symbol) {
                        this.addItem(item);
                        spawnedCount++;
        
                        // Track location statistics
                        if (locationStats[positionData.locationType] !== undefined) {
                            locationStats[positionData.locationType]++;
                    }
                } else {
                        console.error(`Invalid item properties:`, item);
                    }
                } else {
                    console.error(`Failed to create item for level ${level}`);
                }
            }
        }
        
        // Report spawn statistics
        console.log(`\nSpawn Statistics (${spawnedCount}/${numItems} items):`);
        for (const [type, count] of Object.entries(locationStats)) {
            if (count > 0) {
                const percentage = ((count / spawnedCount) * 100).toFixed(1);
                console.log(`  ${type}: ${count} (${percentage}%)`);
            }
        }
        console.log('');
    }
    
    /**
     * Spawn starting equipment around player position (new game only)
     */
    spawnStartingEquipment(playerX, playerY) {
        console.log(`Spawning starting equipment around player at (${playerX}, ${playerY})`);
        
        // Equipment to spawn (2-4 items)
        const startingEquipment = [
            () => this.createRandomWeapon(1),     // Simple weapon
            () => this.createRandomArmor(1),      // Basic armor
            () => this.createRandomShield(1),     // Shield
            () => this.createRandomPotion()       // Healing potion
        ];
        
        // Shuffle and select 2-3 items
        const selectedItems = startingEquipment
            .sort(() => Math.random() - 0.5)
            .slice(0, 2 + Math.floor(Math.random() * 2)); // 2-3 items
        
        let spawnedCount = 0;
        
        // Find positions around player (radius 2-3)
        const validPositions = this.findNearbyFloorPositions(playerX, playerY, 3);
        
        for (let i = 0; i < selectedItems.length && i < validPositions.length; i++) {
            const item = selectedItems[i]();
            if (item && typeof item === 'object') {
                const position = validPositions[i];
                item.x = position.x;
                item.y = position.y;
                
                if (typeof item.x === 'number' && typeof item.y === 'number' && item.symbol) {
                    this.addItem(item);
                    spawnedCount++;
                    console.log(`Spawned starting ${item.name} at (${item.x}, ${item.y})`);
                }
            }
        }
        
        console.log(`Spawned ${spawnedCount} starting equipment items`);
    }
    
    /**
     * Find floor positions around a center point within given radius
     */
    findNearbyFloorPositions(centerX, centerY, radius) {
        const positions = [];
        
        // Search in expanding rings from center
        for (let r = 1; r <= radius; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    // Skip positions already checked in smaller radius
                    if (Math.abs(dx) < r && Math.abs(dy) < r) continue;
                    
                    const x = centerX + dx;
                    const y = centerY + dy;
                    
                    // Check if position is valid and empty
                    if (this.dungeon.isInBounds(x, y)) {
            const tile = this.dungeon.getTile(x, y);
            if (tile.type === 'floor' && !this.hasItemAt(x, y)) {
                            positions.push({ x, y, distance: Math.abs(dx) + Math.abs(dy) });
                        }
                    }
                }
            }
        }
        
        // Sort by distance (closer positions first)
        positions.sort((a, b) => a.distance - b.distance);
        
        return positions;
    }
    
    /**
     * Find a random floor position in the dungeon with location-based weighting
     */
    getRandomFloorPosition() {
        // Get all valid floor positions
        const validPositions = [];
        let totalWeight = 0;
        let specialPositions = 0;
        
        for (let y = 0; y < this.dungeon.height; y++) {
            for (let x = 0; x < this.dungeon.width; x++) {
                const tile = this.dungeon.getTile(x, y);
                if (tile.type === 'floor' && !this.hasItemAt(x, y)) {
                    const specialness = this.calculateLocationSpecialness(x, y);
                    validPositions.push({ x, y, weight: specialness });
                    totalWeight += specialness;
                    if (specialness > 1.0) specialPositions++;
                }
            }
        }
        
        if (validPositions.length === 0) {
        return null;
        }
        
        // Debug info about terrain bias (only log occasionally)
        if (Math.random() < 0.1) { // 10% chance to log
            const avgWeight = totalWeight / validPositions.length;
            console.log(`Terrain bias: ${specialPositions}/${validPositions.length} special positions, avg weight: ${avgWeight.toFixed(2)}`);
        }
        
        // Weighted random selection
        const selectedPosition = this.weightedRandomSelect(validPositions);
        
        // Log special spawns (always log for debugging)
        const selectedWeight = validPositions.find(p => p.x === selectedPosition.x && p.y === selectedPosition.y)?.weight || 1;
        const wallCount = this.countNearbyWalls(selectedPosition.x, selectedPosition.y);
        let locationType = 'CORRIDOR'; // Default
        
        // Determine location type based on wall count and other factors
        if (wallCount >= 7) {
            locationType = 'DEAD-END';
        } else if (wallCount >= 6) {
            locationType = 'VERY-ENCLOSED';
        } else if (wallCount >= 5) {
            locationType = 'ENCLOSED';
        } else if (this.isInAnyRoom(selectedPosition.x, selectedPosition.y)) {
            // Check for room corner
            const north = !this.dungeon.isInBounds(selectedPosition.x, selectedPosition.y-1) || 
                         this.dungeon.getTile(selectedPosition.x, selectedPosition.y-1).type === 'wall';
            const south = !this.dungeon.isInBounds(selectedPosition.x, selectedPosition.y+1) || 
                         this.dungeon.getTile(selectedPosition.x, selectedPosition.y+1).type === 'wall';
            const east = !this.dungeon.isInBounds(selectedPosition.x+1, selectedPosition.y) || 
                        this.dungeon.getTile(selectedPosition.x+1, selectedPosition.y).type === 'wall';
            const west = !this.dungeon.isInBounds(selectedPosition.x-1, selectedPosition.y) || 
                        this.dungeon.getTile(selectedPosition.x-1, selectedPosition.y).type === 'wall';
            
            if ((north && east) || (north && west) || (south && east) || (south && west)) {
                locationType = 'CORNER';
            } else if (this.isRoomCenter(selectedPosition.x, selectedPosition.y)) {
                locationType = 'ROOM-CENTER';
            } else {
                locationType = 'ROOM';
            }
        } else if (wallCount >= 3) {
            locationType = 'NEAR-WALLS';
        }
        
        console.log(`Item spawn at (${selectedPosition.x}, ${selectedPosition.y}): ${locationType}, weight=${selectedWeight.toFixed(1)}, walls=${wallCount}/8`);
        
        return { x: selectedPosition.x, y: selectedPosition.y, locationType, weight: selectedWeight };
    }
    
    /**
     * Calculate how "special" a location is for item spawning
     * Higher values = more likely to spawn items
     */
    calculateLocationSpecialness(x, y) {
        let specialness = 1.0; // Base weight
        let locationTypes = [];
        let primaryType = null;
        
        const wallCount = this.countNearbyWalls(x, y);
        
        // Simplified dead-end detection: lots of walls around
        if (wallCount >= 7) {
            specialness = 50.0; // VERY high chance for true dead-ends
            primaryType = 'DEAD-END';
        }
        // Very enclosed spaces
        else if (wallCount >= 6) {
            specialness = 20.0; // High chance for very enclosed areas
            primaryType = 'VERY-ENCLOSED';
        }
        // Enclosed spaces
        else if (wallCount >= 5) {
            specialness = 10.0; // Good chance for enclosed areas
            primaryType = 'ENCLOSED';
        }
        // Check for room corners
        else if (this.isInAnyRoom(x, y) && wallCount >= 3) {
            // Simple corner check: in a room with 3+ walls nearby
            const north = !this.dungeon.isInBounds(x, y-1) || this.dungeon.getTile(x, y-1).type === 'wall';
            const south = !this.dungeon.isInBounds(x, y+1) || this.dungeon.getTile(x, y+1).type === 'wall';
            const east = !this.dungeon.isInBounds(x+1, y) || this.dungeon.getTile(x+1, y).type === 'wall';
            const west = !this.dungeon.isInBounds(x-1, y) || this.dungeon.getTile(x-1, y).type === 'wall';
            
            // Adjacent walls form a corner
            if ((north && east) || (north && west) || (south && east) || (south && west)) {
                specialness = 8.0;
                primaryType = 'CORNER';
            }
        }
        // Room centers
        else if (this.isRoomCenter(x, y)) {
            specialness = 5.0; // Moderate chance in room centers
            primaryType = 'ROOM-CENTER';
        }
        // Near walls
        else if (wallCount >= 3) {
            specialness = 3.0; // Some chance near walls
            primaryType = 'NEAR-WALLS';
        }
        // Check if in room vs corridor
        else if (this.isInAnyRoom(x, y)) {
            specialness = 2.0; // Slight preference for rooms
            primaryType = 'ROOM';
        }
        else {
            specialness = 1.0; // Base weight for corridors
            primaryType = 'CORRIDOR';
        }
        
        // Debug: Log all calculations for debugging
        if (Math.random() < 0.1) { // 10% chance to log
            console.log(`Location (${x}, ${y}): type=${primaryType}, weight=${specialness.toFixed(1)}, walls=${wallCount}/8`);
        }
        
        return specialness;
    }
    
    /**
     * Check if position is a dead-end (袋小路)
     * True dead-end: exactly 1 walkable adjacent tile (4-directional check)
     */
    isDeadEnd(x, y) {
        // First check 4-directional (cardinal) for true dead-end
        const cardinalDirections = [
            [0, -1], [1, 0], [0, 1], [-1, 0] // N, E, S, W
        ];
        
        let cardinalWalkable = 0;
        
        for (const [dx, dy] of cardinalDirections) {
            const checkX = x + dx;
            const checkY = y + dy;
            
            if (this.dungeon.isInBounds(checkX, checkY)) {
                const tile = this.dungeon.getTile(checkX, checkY);
                if (tile.type === 'floor' || (tile.type === 'door' && tile.doorState === 'open')) {
                    cardinalWalkable++;
                }
            }
        }
        
        // True dead-end has exactly 1 cardinal exit
        if (cardinalWalkable !== 1) {
            return false;
        }
        
        // Additional check: ensure diagonals are mostly blocked
        const diagonalDirections = [
            [-1, -1], [1, -1], [-1, 1], [1, 1] // NW, NE, SW, SE
        ];
        
        let diagonalBlocked = 0;
        
        for (const [dx, dy] of diagonalDirections) {
            const checkX = x + dx;
            const checkY = y + dy;
            
            if (!this.dungeon.isInBounds(checkX, checkY) || 
                this.dungeon.getTile(checkX, checkY).type === 'wall') {
                diagonalBlocked++;
            }
        }
        
        // At least 3 diagonals should be blocked for a true dead-end
        return diagonalBlocked >= 3;
    }
    
    /**
     * Check if position is in a corner (diagonally enclosed)
     */
    isCornerPosition(x, y) {
        // First check if we're in a room
        if (!this.isInAnyRoom(x, y)) {
            return false;
        }
        
        // Check cardinal directions
        const cardinalDirs = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N, E, S, W
        let cardinalWalls = 0;
        
        for (const [dx, dy] of cardinalDirs) {
            const checkX = x + dx;
            const checkY = y + dy;
            
            if (!this.dungeon.isInBounds(checkX, checkY) || 
                this.dungeon.getTile(checkX, checkY).type === 'wall') {
                cardinalWalls++;
            }
        }
        
        // Corner position has exactly 2 adjacent walls in cardinal directions
        // forming an L-shape (e.g., N and E walls, or S and W walls)
        if (cardinalWalls !== 2) {
            return false;
        }
        
        // Check if the two walls are adjacent (not opposite)
        const north = !this.dungeon.isInBounds(x, y-1) || this.dungeon.getTile(x, y-1).type === 'wall';
        const south = !this.dungeon.isInBounds(x, y+1) || this.dungeon.getTile(x, y+1).type === 'wall';
        const east = !this.dungeon.isInBounds(x+1, y) || this.dungeon.getTile(x+1, y).type === 'wall';
        const west = !this.dungeon.isInBounds(x-1, y) || this.dungeon.getTile(x-1, y).type === 'wall';
        
        // True corners have adjacent walls, not opposite walls
        return (north && east) || (north && west) || (south && east) || (south && west);
    }
    
    /**
     * Check if position is a hidden alcove (small recessed area)
     */
    isHiddenAlcove(x, y) {
        // Alcoves are typically small side areas off corridors or rooms
        // Not in the main path, with limited access
        
        const cardinalDirections = [
            [0, -1], [1, 0], [0, 1], [-1, 0] // N, E, S, W
        ];
        
        let wallCount = 0;
        let openDirections = [];
        
        for (let i = 0; i < cardinalDirections.length; i++) {
            const [dx, dy] = cardinalDirections[i];
            const checkX = x + dx;
            const checkY = y + dy;
            
            if (!this.dungeon.isInBounds(checkX, checkY) || 
                this.dungeon.getTile(checkX, checkY).type === 'wall') {
                wallCount++;
            } else if (this.dungeon.getTile(checkX, checkY).type === 'floor') {
                openDirections.push([dx, dy]);
            }
        }
        
        // Alcove has exactly 3 walls (one opening)
        if (wallCount !== 3 || openDirections.length !== 1) {
            return false;
        }
        
        // Check if the open direction leads to a larger space (not another narrow passage)
        const [openDx, openDy] = openDirections[0];
        const beyondX = x + openDx * 2;
        const beyondY = y + openDy * 2;
        
        if (this.dungeon.isInBounds(beyondX, beyondY)) {
            // Count open spaces around the entrance
            let entranceOpenCount = 0;
            for (const [dx, dy] of cardinalDirections) {
                const checkX = x + openDx + dx;
                const checkY = y + openDy + dy;
                if (this.dungeon.isInBounds(checkX, checkY) && 
                    this.dungeon.getTile(checkX, checkY).type === 'floor') {
                    entranceOpenCount++;
                }
            }
            
            // True alcove if entrance leads to wider area (3+ open tiles)
            return entranceOpenCount >= 3;
        }
        
        return true;
    }
    
    /**
     * Check if position is near the center of a room
     */
    isRoomCenter(x, y) {
        for (const room of this.dungeon.rooms) {
            const centerX = room.x + Math.floor(room.width / 2);
            const centerY = room.y + Math.floor(room.height / 2);
            
            // Within 2 tiles of room center
            const distance = Math.abs(x - centerX) + Math.abs(y - centerY);
            if (distance <= 2 && this.isInRoom(x, y, room)) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Check if position is at a corridor junction (3+ adjacent floors with different directions)
     */
    isCorridorJunction(x, y) {
        // Must not be in a room
        if (this.isInAnyRoom(x, y)) return false;
        
        const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N, E, S, W
        let floorDirections = [];
        
        for (let i = 0; i < directions.length; i++) {
            const [dx, dy] = directions[i];
            const checkX = x + dx;
            const checkY = y + dy;
            
            if (this.dungeon.isInBounds(checkX, checkY)) {
                const tile = this.dungeon.getTile(checkX, checkY);
                if (tile.type === 'floor' || tile.type === 'door') {
                    floorDirections.push(i);
                }
            }
        }
        
        // True junction: 3+ exits, or T-junction (3 exits)
        if (floorDirections.length >= 3) {
            // Additional check: not just a wide corridor
            // If we have opposite directions (N-S or E-W), check if it's a real junction
            const hasNS = floorDirections.includes(0) && floorDirections.includes(2);
            const hasEW = floorDirections.includes(1) && floorDirections.includes(3);
            
            // Real junction if we have perpendicular paths
            return (hasNS && (floorDirections.includes(1) || floorDirections.includes(3))) ||
                   (hasEW && (floorDirections.includes(0) || floorDirections.includes(2)));
        }
        
        return false;
    }
    
    /**
     * Count adjacent floor tiles (4-directional)
     */
    countAdjacentFloors(x, y) {
        const directions = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        let count = 0;
        
        for (const [dx, dy] of directions) {
            const checkX = x + dx;
            const checkY = y + dy;
            
            if (this.dungeon.isInBounds(checkX, checkY)) {
                const tile = this.dungeon.getTile(checkX, checkY);
                if (tile.type === 'floor') {
                    count++;
                }
            }
        }
        
        return count;
    }
    
    /**
     * Count nearby wall tiles (8-directional)
     */
    countNearbyWalls(x, y) {
        const directions = [
            [-1, -1], [0, -1], [1, -1],  // NW, N, NE
            [-1,  0],          [1,  0],  // W,     E
            [-1,  1], [0,  1], [1,  1]   // SW, S, SE
        ];
        
        let count = 0;
        for (const [dx, dy] of directions) {
            const checkX = x + dx;
            const checkY = y + dy;
            
            if (!this.dungeon.isInBounds(checkX, checkY)) {
                count++; // Out of bounds counts as wall
                continue;
            }
            
            const tile = this.dungeon.getTile(checkX, checkY);
            if (tile.type === 'wall') {
                count++;
            }
        }
        
        return count;
    }
    
    /**
     * Check if position is inside a specific room
     */
    isInRoom(x, y, room) {
        return x >= room.x && x < room.x + room.width &&
               y >= room.y && y < room.y + room.height;
    }
    
    /**
     * Check if position is inside any room
     */
    isInAnyRoom(x, y) {
        return this.dungeon.rooms.some(room => this.isInRoom(x, y, room));
    }
    
    /**
     * Weighted random selection from positions array
     */
    weightedRandomSelect(positions) {
        const totalWeight = positions.reduce((sum, pos) => sum + pos.weight, 0);
        let random = Math.random() * totalWeight;
        
        for (const position of positions) {
            random -= position.weight;
            if (random <= 0) {
                return { x: position.x, y: position.y };
            }
        }
        
        // Fallback to last position
        return positions[positions.length - 1];
    }
    
    /**
     * Check if there's already an item at position
     */
    hasItemAt(x, y) {
        return this.items.some(item => item.x === x && item.y === y);
    }
    
    /**
     * Create a random item based on level difficulty with weighted drop table
     */
    createRandomItem(level) {
        // Weighted drop table (more common items have higher values)
        const dropTable = {
            'food': 30,     // Most common (30%)
            'potion': 20,   // Common (20%)
            'weapon': 12,   // Uncommon (12%)
            'armor': 12,    // Uncommon (12%)
            'shield': 8,    // Rare (8%)
            'helmet': 6,    // Rare (6%)
            'gloves': 5,    // Very rare (5%)
            'boots': 4,     // Very rare (4%)
            'ring': 2,      // Ultra rare (2%)
            'amulet': 1     // Ultra rare (1%)
        };
        
        // Calculate total weight
        const totalWeight = Object.values(dropTable).reduce((sum, weight) => sum + weight, 0);
        
        // Random selection based on weights
        let random = Math.floor(Math.random() * totalWeight);
        
        for (const [itemType, weight] of Object.entries(dropTable)) {
            random -= weight;
            if (random < 0) {
                switch (itemType) {
                    case 'weapon':
                        return this.createRandomWeapon(level);
                    case 'armor':
                        return this.createRandomArmor(level);
                    case 'shield':
                        return this.createRandomShield(level);
                    case 'helmet':
                        return this.createRandomHelmet(level);
                    case 'gloves':
                        return this.createRandomGloves(level);
                    case 'boots':
                        return this.createRandomBoots(level);
                    case 'ring':
                        return this.createRandomRing(level);
                    case 'amulet':
                        return this.createRandomAmulet(level);
                    case 'potion':
                        return this.createRandomPotion();
                    case 'food':
                        return this.createRandomFood();
                    default:
                        return null;
                }
            }
        }
        
        // Fallback (should never reach here)
        return this.createRandomFood();
    }
    
    /**
     * Create random weapon based on level
     */
    createRandomWeapon(level) {
        try {
            const weapons = Object.keys(EQUIPMENT_TYPES.weapons);
            if (weapons.length === 0) {
    
                return null;
            }
            
            const weaponKey = weapons[Math.floor(Math.random() * weapons.length)];
            
            // Higher level = better enchantment chance
            const enchantmentChance = Math.min(0.3 + (level * 0.1), 0.7);
            const enchantment = Math.random() < enchantmentChance ? 
                Math.floor(Math.random() * Math.min(3, Math.floor(level / 2) + 1)) : 0;
            
            const weapon = EquipmentManager.createEquipment('weapons', weaponKey, enchantment);
            if (!weapon) {
    
            }
            return weapon;
        } catch (error) {
            console.error('Error creating random weapon:', error);
            return null;
        }
    }
    
    /**
     * Create random armor based on level
     */
    createRandomArmor(level) {
        try {
            const armors = Object.keys(EQUIPMENT_TYPES.armor);
            if (armors.length === 0) {
    
                return null;
            }
            
            const armorKey = armors[Math.floor(Math.random() * armors.length)];
            
            const enchantmentChance = Math.min(0.2 + (level * 0.08), 0.6);
            const enchantment = Math.random() < enchantmentChance ? 
                Math.floor(Math.random() * Math.min(2, Math.floor(level / 3) + 1)) : 0;
            
            const armor = EquipmentManager.createEquipment('armor', armorKey, enchantment);
            if (!armor) {
    
            }
            return armor;
        } catch (error) {
            console.error('Error creating random armor:', error);
            return null;
        }
    }
    
    /**
     * Create random shield based on level
     */
    createRandomShield(level) {
        try {
            const shields = Object.keys(EQUIPMENT_TYPES.shields);
            if (shields.length === 0) {
    
                return null;
            }
            
            const shieldKey = shields[Math.floor(Math.random() * shields.length)];
            
            const enchantmentChance = Math.min(0.2 + (level * 0.08), 0.6);
            const enchantment = Math.random() < enchantmentChance ? 
                Math.floor(Math.random() * Math.min(2, Math.floor(level / 3) + 1)) : 0;
            
            const shield = EquipmentManager.createEquipment('shields', shieldKey, enchantment);
            if (!shield) {
    
            }
            return shield;
        } catch (error) {
            console.error('Error creating random shield:', error);
            return null;
        }
    }
    
    /**
     * Create random helmet based on level
     */
    createRandomHelmet(level) {
        try {
            const helmets = Object.keys(EQUIPMENT_TYPES.helmets);
            if (helmets.length === 0) {
                console.warn('No helmets found in EQUIPMENT_TYPES');
                return null;
            }
            
            const helmetKey = helmets[Math.floor(Math.random() * helmets.length)];
            
            const enchantmentChance = Math.min(0.15 + (level * 0.06), 0.5);
            const enchantment = Math.random() < enchantmentChance ? 
                Math.floor(Math.random() * Math.min(2, Math.floor(level / 4) + 1)) : 0;
            
            const helmet = EquipmentManager.createEquipment('helmets', helmetKey, enchantment);
            if (!helmet) {
                console.warn(`Failed to create helmet: ${helmetKey}`);
            }
            return helmet;
        } catch (error) {
            console.error('Error creating random helmet:', error);
            return null;
        }
    }
    
    /**
     * Create random gloves based on level
     */
    createRandomGloves(level) {
        try {
            const gloves = Object.keys(EQUIPMENT_TYPES.gloves);
            if (gloves.length === 0) {
                console.warn('No gloves found in EQUIPMENT_TYPES');
                return null;
            }
            
            const glovesKey = gloves[Math.floor(Math.random() * gloves.length)];
            
            const enchantmentChance = Math.min(0.15 + (level * 0.06), 0.5);
            const enchantment = Math.random() < enchantmentChance ? 
                Math.floor(Math.random() * Math.min(2, Math.floor(level / 4) + 1)) : 0;
            
            const glovesItem = EquipmentManager.createEquipment('gloves', glovesKey, enchantment);
            if (!glovesItem) {
                console.warn(`Failed to create gloves: ${glovesKey}`);
            }
            return glovesItem;
        } catch (error) {
            console.error('Error creating random gloves:', error);
            return null;
        }
    }
    
    /**
     * Create random boots based on level
     */
    createRandomBoots(level) {
        try {
            const boots = Object.keys(EQUIPMENT_TYPES.boots);
            if (boots.length === 0) {
                console.warn('No boots found in EQUIPMENT_TYPES');
                return null;
            }
            
            const bootsKey = boots[Math.floor(Math.random() * boots.length)];
            
            const enchantmentChance = Math.min(0.15 + (level * 0.06), 0.5);
            const enchantment = Math.random() < enchantmentChance ? 
                Math.floor(Math.random() * Math.min(2, Math.floor(level / 4) + 1)) : 0;
            
            const bootsItem = EquipmentManager.createEquipment('boots', bootsKey, enchantment);
            if (!bootsItem) {
                console.warn(`Failed to create boots: ${bootsKey}`);
            }
            return bootsItem;
        } catch (error) {
            console.error('Error creating random boots:', error);
            return null;
        }
    }
    
    /**
     * Create random ring based on level
     */
    createRandomRing(level) {
        try {
            const rings = Object.keys(EQUIPMENT_TYPES.rings);
            if (rings.length === 0) {
                console.warn('No rings found in EQUIPMENT_TYPES');
                return null;
            }
            
            const ringKey = rings[Math.floor(Math.random() * rings.length)];
            
            // Rings are more likely to be enchanted (magical items)
            const enchantmentChance = Math.min(0.3 + (level * 0.1), 0.8);
            const enchantment = Math.random() < enchantmentChance ? 
                Math.floor(Math.random() * Math.min(3, Math.floor(level / 3) + 1)) : 0;
            
            const ring = EquipmentManager.createEquipment('rings', ringKey, enchantment);
            if (!ring) {
                console.warn(`Failed to create ring: ${ringKey}`);
            }
            return ring;
        } catch (error) {
            console.error('Error creating random ring:', error);
            return null;
        }
    }
    
    /**
     * Create random amulet based on level
     */
    createRandomAmulet(level) {
        try {
            const amulets = Object.keys(EQUIPMENT_TYPES.amulets);
            if (amulets.length === 0) {
                console.warn('No amulets found in EQUIPMENT_TYPES');
                return null;
            }
            
            const amuletKey = amulets[Math.floor(Math.random() * amulets.length)];
            
            // Amulets are more likely to be enchanted (magical items)
            const enchantmentChance = Math.min(0.4 + (level * 0.12), 0.9);
            const enchantment = Math.random() < enchantmentChance ? 
                Math.floor(Math.random() * Math.min(3, Math.floor(level / 2) + 1)) : 0;
            
            const amulet = EquipmentManager.createEquipment('amulets', amuletKey, enchantment);
            if (!amulet) {
                console.warn(`Failed to create amulet: ${amuletKey}`);
            }
            return amulet;
        } catch (error) {
            console.error('Error creating random amulet:', error);
            return null;
        }
    }
    
    /**
     * Create random potion with weighted rarity
     */
    createRandomPotion() {
        try {
            // Weighted potion drop table
            const potionDropTable = {
                'minorHealingPotion': 40,     // Common (40%)
                'healingPotion': 35,          // Common (35%)
                'greaterHealingPotion': 20,   // Uncommon (20%)
                'superiorHealingPotion': 5    // Rare (5%)
            };
            
            // Calculate total weight
            const totalWeight = Object.values(potionDropTable).reduce((sum, weight) => sum + weight, 0);
            
            // Random selection based on weights
            let random = Math.floor(Math.random() * totalWeight);
            let selectedPotion = 'healingPotion'; // fallback
            
            for (const [potionType, weight] of Object.entries(potionDropTable)) {
                random -= weight;
                if (random < 0) {
                    selectedPotion = potionType;
                    break;
                }
            }
            
            // Generate 1-2 potions (small stacks)
            const quantity = Math.random() < 0.7 ? 1 : 2; // 70% chance for 1, 30% for 2
            
            const potion = EquipmentManager.createEquipmentWithQuantity('potions', selectedPotion, quantity);
            if (!potion) {
                console.warn(`Failed to create potion: ${selectedPotion}`);
            } else {
                // Debug: Verify potion has healDice
                if (!potion.healDice) {
                    console.warn(`Potion ${selectedPotion} missing healDice:`, potion);
                } else {
                    console.log(`Potion ${selectedPotion} created with healDice: ${potion.healDice}`);
                }
            }
            return potion;
        } catch (error) {
            console.error('Error creating random potion:', error);
            return null;
        }
    }
    
    /**
     * Create random food item
     */
    createRandomFood() {
        try {
            const foods = Object.keys(FOOD_TYPES);
            if (foods.length === 0) {
    
                return null;
            }
            
            const foodKey = foods[Math.floor(Math.random() * foods.length)];
            const food = this.createFood(foodKey);
            if (!food) {
    
            }
            return food;
        } catch (error) {
            console.error('Error creating random food:', error);
            return null;
        }
    }
} 