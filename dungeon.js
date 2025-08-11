/**
 * Dungeon Generator for Roguelike Game
 * Uses BSP (Binary Space Partitioning) algorithm
 */
class Dungeon {
    constructor(width = 80, height = 50) {
        this.width = width;
        this.height = height;
        this.tiles = [];
        this.rooms = [];
        this.corridors = [];
        
        // Initialize with walls
        this.initTiles();
        this.generate();
    }
    
    /**
     * Initialize all tiles as walls
     */
    initTiles() {
        this.tiles = [];
        for (let y = 0; y < this.height; y++) {
            this.tiles[y] = [];
            for (let x = 0; x < this.width; x++) {
                this.tiles[y][x] = {
                    type: 'wall',
                    visible: false,
                    explored: false
                };
            }
        }
    }
    
    /**
     * Get tile at coordinates
     */
    getTile(x, y) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            return this.tiles[y][x];
        }
        return { type: 'wall', visible: false, explored: false };
    }
    
    /**
     * Set tile at coordinates
     */
    setTile(x, y, type) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.tiles[y][x].type = type;
            // Initialize door state for door tiles
            if (type === 'door') {
                this.tiles[y][x].doorState = 'closed'; // 'closed', 'open', 'locked'
                this.tiles[y][x].doorType = 'normal'; // 'normal', 'secret'
            }
        }
    }
    
    /**
     * Check if position is walkable
     */
    isWalkable(x, y) {
        const tile = this.getTile(x, y);
        if (tile.type === 'door') {
            // Only open doors are walkable
            return tile.doorState === 'open';
        }
        return tile.type === 'floor' || 
               tile.type === 'stairs_up' || tile.type === 'stairs_down';
    }
    
    /**
     * Check if position has a door
     */
    hasDoor(x, y) {
        const tile = this.getTile(x, y);
        return tile.type === 'door';
    }
    
    /**
     * Get door state
     */
    getDoorState(x, y) {
        const tile = this.getTile(x, y);
        if (tile.type === 'door') {
            return tile.doorState || 'closed';
        }
        return null;
    }
    
    /**
     * Set door state
     */
    setDoorState(x, y, state) {
        const tile = this.getTile(x, y);
        if (tile.type === 'door') {
            tile.doorState = state;
            return true;
        }
        return false;
    }
    
    /**
     * Remove door (convert to floor)
     */
    removeDoor(x, y) {
        const tile = this.getTile(x, y);
        if (tile.type === 'door') {
            tile.type = 'floor';
            delete tile.doorState;
            return true;
        }
        return false;
    }
    
    /**
     * Generate the dungeon - Classic maze-like style
     */
    generate() {

        
        // Generate main rooms
        this.generateRooms();
        
        // Connect rooms with complex corridor system
        this.connectRooms();
        
        // Add maze-like passages
        this.addMazePassages();
        
        // Add secret rooms
        this.addSecretRooms();
        
        // Add doors
        this.addDoors();
        
        // Add dead ends for exploration feel
        this.addDeadEnds();
        
        // Add stairs
        this.addStairs();
        

        // Add traps after terrain features
        this.addTraps();
    }
    
    /**
     * Generate rooms - Varied sizes and irregular placement
     */
    generateRooms() {
        const numRooms = 8 + Math.floor(Math.random() * 5); // 8-12 rooms
        const maxAttempts = 150;
        
        for (let i = 0; i < numRooms; i++) {
            let attempts = 0;
            let roomPlaced = false;
            
            while (attempts < maxAttempts && !roomPlaced) {
                // More varied room sizes - including small chambers
                let roomWidth, roomHeight;
                
                if (Math.random() < 0.3) {
                    // Small chambers (30% chance)
                    roomWidth = 3 + Math.floor(Math.random() * 3); // 3-5
                    roomHeight = 3 + Math.floor(Math.random() * 3); // 3-5
                } else if (Math.random() < 0.6) {
                    // Medium rooms (30% chance)
                    roomWidth = 5 + Math.floor(Math.random() * 4); // 5-8
                    roomHeight = 4 + Math.floor(Math.random() * 4); // 4-7
                } else {
                    // Large rooms (40% chance)
                    roomWidth = 7 + Math.floor(Math.random() * 6); // 7-12
                    roomHeight = 5 + Math.floor(Math.random() * 5); // 5-9
                }
                
                // Reduce margin for more cramped, maze-like feel
                const marginX = Math.floor(this.width * 0.08);  // 8% margin  
                const marginY = Math.floor(this.height * 0.08); // 8% margin
                const roomX = marginX + Math.floor(Math.random() * (this.width - roomWidth - marginX * 2));
                const roomY = marginY + Math.floor(Math.random() * (this.height - roomHeight - marginY * 2));
                
                // Check if room overlaps with existing rooms
                if (this.canPlaceRoom(roomX, roomY, roomWidth, roomHeight)) {
                    const room = {
                        x: roomX,
                        y: roomY,
                        width: roomWidth,
                        height: roomHeight,
                        type: i === 0 ? 'start' : 'normal' // Mark starting room
                    };
                    
                    this.rooms.push(room);
                    this.carveRoom(room);
                    roomPlaced = true;
                }
                attempts++;
            }
        }
    }
    
    /**
     * Check if a room can be placed without overlapping - Simple and reliable
     */
    canPlaceRoom(x, y, width, height) {
        // Boundary check - ensure room fits within map boundaries
        if (x < 1 || y < 1 || x + width >= this.width - 1 || y + height >= this.height - 1) {
            return false;
        }
        
        // Simple overlap check with existing rooms - require 2 tile gap minimum
        for (const room of this.rooms) {
            if (!(x + width + 2 <= room.x || 
                  x >= room.x + room.width + 2 ||
                  y + height + 2 <= room.y || 
                  y >= room.y + room.height + 2)) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Carve out a room
     */
    carveRoom(room) {
        for (let y = room.y; y < room.y + room.height; y++) {
            for (let x = room.x; x < room.x + room.width; x++) {
                this.setTile(x, y, 'floor');
            }
        }
    }
    
    /**
     * Connect rooms - simple sequential method
     */
    connectRooms() {
        if (this.rooms.length < 2) return;
        
        // Connect each room to the next one - guaranteed connectivity
        for (let i = 0; i < this.rooms.length - 1; i++) {
            this.createCorridor(this.rooms[i], this.rooms[i + 1]);
        }
        
        // Optionally add one or two extra connections for variety
        const extraConnections = Math.floor(Math.random() * 3); // 0-2 extra
        for (let i = 0; i < extraConnections && this.rooms.length > 2; i++) {
            const room1 = this.rooms[Math.floor(Math.random() * this.rooms.length)];
            const room2 = this.rooms[Math.floor(Math.random() * this.rooms.length)];
            if (room1 !== room2) {
                this.createCorridor(room1, room2);
            }
        }
    }
    
    /**
     * Create simple L-shaped corridor between room centers - classic method
     */
    createCorridor(room1, room2) {
        // Get room centers - simple and reliable
        const x1 = room1.x + Math.floor(room1.width / 2);
        const y1 = room1.y + Math.floor(room1.height / 2);
        const x2 = room2.x + Math.floor(room2.width / 2);
        const y2 = room2.y + Math.floor(room2.height / 2);
        
        // Create simple L-shaped corridor - classic Rogue style
        if (Math.random() > 0.5) {
            // Horizontal first, then vertical
            this.createHorizontalCorridor(x1, x2, y1);
            this.createVerticalCorridor(y1, y2, x2);
        } else {
            // Vertical first, then horizontal  
            this.createVerticalCorridor(y1, y2, x1);
            this.createHorizontalCorridor(x1, x2, y2);
        }
    }
    
    /**
     * Create horizontal corridor - classic simple method
     */
    createHorizontalCorridor(x1, x2, y) {
        // Boundary check
        if (y < 1 || y >= this.height - 1) return;
        
        const startX = Math.max(1, Math.min(x1, x2));
        const endX = Math.min(this.width - 2, Math.max(x1, x2));
        
        for (let x = startX; x <= endX; x++) {
            // Only carve walls - preserve existing floors (rooms, stairs, etc.)
            if (this.getTile(x, y).type === 'wall') {
                this.setTile(x, y, 'floor');
            }
        }
    }
    
    /**
     * Create vertical corridor - classic simple method
     */
    createVerticalCorridor(y1, y2, x) {
        // Boundary check
        if (x < 1 || x >= this.width - 1) return;
        
        const startY = Math.max(1, Math.min(y1, y2));
        const endY = Math.min(this.height - 2, Math.max(y1, y2));
        
        for (let y = startY; y <= endY; y++) {
            // Only carve walls - preserve existing floors (rooms, stairs, etc.)
            if (this.getTile(x, y).type === 'wall') {
                this.setTile(x, y, 'floor');
            }
        }
    }
    
    /**
     * Add maze-like passages between rooms
     */
    addMazePassages() {
        const numPassages = 3 + Math.floor(Math.random() * 4); // 3-6 extra passages
        
        for (let i = 0; i < numPassages; i++) {
            this.createWindingPassage();
        }
    }
    
    /**
     * Create a winding passage for maze-like feel
     */
    createWindingPassage() {
        // Start from a random room edge
        if (this.rooms.length === 0) return;
        
        const room = this.rooms[Math.floor(Math.random() * this.rooms.length)];
        const startX = room.x + Math.floor(Math.random() * room.width);
        const startY = room.y + Math.floor(Math.random() * room.height);
        
        let x = startX;
        let y = startY;
        const maxLength = 15 + Math.floor(Math.random() * 10); // 15-24 tiles
        
        for (let step = 0; step < maxLength; step++) {
            // Random walk with bias towards uncarved areas
            const directions = [
                { dx: 0, dy: -1 }, // North
                { dx: 1, dy: 0 },  // East
                { dx: 0, dy: 1 },  // South
                { dx: -1, dy: 0 }  // West
            ];
            
            // Shuffle directions for randomness
            for (let i = directions.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [directions[i], directions[j]] = [directions[j], directions[i]];
            }
            
            let moved = false;
            for (const dir of directions) {
                const newX = x + dir.dx;
                const newY = y + dir.dy;
                
                if (this.isInBounds(newX, newY) && 
                    newX > 0 && newX < this.width - 1 && 
                    newY > 0 && newY < this.height - 1) {
                    
                    // 70% chance to carve into walls, 30% chance to stop at floors
                    if (this.getTile(newX, newY).type === 'wall' || 
                        (this.getTile(newX, newY).type === 'floor' && Math.random() < 0.3)) {
                        
                        if (this.getTile(newX, newY).type === 'wall') {
                            this.setTile(newX, newY, 'floor');
                        }
                        x = newX;
                        y = newY;
                        moved = true;
                        break;
                    }
                }
            }
            
            if (!moved) break; // Dead end reached
        }
    }
    
    /**
     * Add secret rooms for exploration
     */
    addSecretRooms() {
        const numSecretRooms = 1 + Math.floor(Math.random() * 3); // 1-3 secret rooms
        
        for (let i = 0; i < numSecretRooms; i++) {
            this.createSecretRoom();
        }
    }
    
    /**
     * Create a secret room connected by a single passage
     */
    createSecretRoom() {
        const maxAttempts = 50;
        
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // Small secret room
            const roomWidth = 3 + Math.floor(Math.random() * 3); // 3-5
            const roomHeight = 3 + Math.floor(Math.random() * 3); // 3-5
            
            const roomX = 2 + Math.floor(Math.random() * (this.width - roomWidth - 4));
            const roomY = 2 + Math.floor(Math.random() * (this.height - roomHeight - 4));
            
            // Check if area is all walls (truly secret)
            let allWalls = true;
            for (let y = roomY - 1; y <= roomY + roomHeight; y++) {
                for (let x = roomX - 1; x <= roomX + roomWidth; x++) {
                    if (this.getTile(x, y).type !== 'wall') {
                        allWalls = false;
                        break;
                    }
                }
                if (!allWalls) break;
            }
            
            if (allWalls) {
                // Carve the secret room
                const secretRoom = {
                    x: roomX,
                    y: roomY,
                    width: roomWidth,
                    height: roomHeight,
                    type: 'secret'
                };
                
                this.carveRoom(secretRoom);
                this.rooms.push(secretRoom);
                
                // Connect to nearest existing passage
                this.connectSecretRoom(secretRoom);
                break;
            }
        }
    }
    
    /**
     * Connect secret room to main dungeon
     */
    connectSecretRoom(secretRoom) {
        const centerX = secretRoom.x + Math.floor(secretRoom.width / 2);
        const centerY = secretRoom.y + Math.floor(secretRoom.height / 2);
        
        // Find nearest floor tile
        let nearestFloor = null;
        let nearestDistance = Infinity;
        
        for (let y = 1; y < this.height - 1; y++) {
            for (let x = 1; x < this.width - 1; x++) {
                if (this.getTile(x, y).type === 'floor') {
                    const distance = Math.abs(x - centerX) + Math.abs(y - centerY);
                    if (distance < nearestDistance) {
                        nearestDistance = distance;
                        nearestFloor = { x, y };
                    }
                }
            }
        }
        
        if (nearestFloor) {
            // Create a single passage to the secret room
            this.createDirectPassage(nearestFloor.x, nearestFloor.y, centerX, centerY);
        }
    }
    
    /**
     * Create direct passage between two points
     */
    createDirectPassage(x1, y1, x2, y2) {
        let x = x1;
        let y = y1;
        
        while (x !== x2 || y !== y2) {
            if (x < x2) x++;
            else if (x > x2) x--;
            else if (y < y2) y++;
            else if (y > y2) y--;
            
            if (this.isInBounds(x, y) && this.getTile(x, y).type === 'wall') {
                this.setTile(x, y, 'floor');
            }
        }
    }
    
    /**
     * Add doors to room entrances
     */
    addDoors() {
        for (const room of this.rooms) {
            if (room.type === 'secret') continue; // Secret rooms don't have doors
            
            // Find corridor connections to this room
            this.addDoorsToRoom(room);
        }
    }
    
    /**
     * Add doors to a specific room - Classic roguelike method
     * Based on NetHack/Rogue door placement algorithm research
     */
    addDoorsToRoom(room) {
        const doorCandidates = [];
        
        // Classic roguelike rule: Doors are placed where corridors meet room walls
        // 1. Find positions that are corridors/floors adjacent to room perimeter
        // 2. Ensure these positions are actually connecting points, not random adjacencies
        // 3. Avoid placing doors too close together
        
        // Check each wall segment of the room for corridor connections
        this.findDoorCandidatesOnWall(room, doorCandidates);
        
        // Remove candidates that are too close to each other (classic spacing rule)
        const filteredCandidates = this.filterAdjacentDoors(doorCandidates);
        
        // Place doors at valid connection points
        for (const pos of filteredCandidates) {
            // Classic roguelike: 60-80% chance to place door at valid connection
            if (Math.random() < 0.7) {
                this.setTile(pos.x, pos.y, 'door');
            }
        }
    }
    
    /**
     * Find door candidates on room walls - proper connection detection
     */
    findDoorCandidatesOnWall(room, candidates) {
        // Check all perimeter positions of the room
        for (let x = room.x - 1; x <= room.x + room.width; x++) {
            for (let y = room.y - 1; y <= room.y + room.height; y++) {
                // Skip if position is inside the room
                if (x >= room.x && x < room.x + room.width && 
                    y >= room.y && y < room.y + room.height) {
                    continue;
                }
                
                if (!this.isInBounds(x, y)) continue;
                
                // Only consider floor tiles (corridors)
                if (this.getTile(x, y).type !== 'floor') continue;
                
                // Check if this corridor position properly connects to the room
                if (this.isValidDoorPosition(x, y, room)) {
                    candidates.push({ x, y });
                }
            }
        }
    }
    
    /**
     * Validate if a position is a proper door location
     * Strict classic rule: Must be a narrow corridor-to-room connection
     */
    isValidDoorPosition(x, y, room) {
        // 0. Must be a floor tile (corridor)
        if (this.getTile(x, y).type !== 'floor') {
            return false;
        }
        
        // 1. Must be exactly adjacent to room (but not inside)
        if (!this.isAdjacentToRoom(x, y, room)) {
            return false;
        }
        
        // 2. Must connect exactly one room floor and one corridor
        if (!this.isProperDoorConnection(x, y, room)) {
            return false;
        }
        
        // 3. Must have walls on both sides (left-right OR up-down)
        if (!this.hasProperWallEnclosure(x, y)) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Check if position is exactly adjacent to room (not inside)
     */
    isAdjacentToRoom(x, y, room) {
        // Check if position is immediately outside room boundary
        const isAdjacentHorizontally = (x === room.x - 1 || x === room.x + room.width) &&
                                     (y >= room.y && y < room.y + room.height);
        const isAdjacentVertically = (y === room.y - 1 || y === room.y + room.height) &&
                                   (x >= room.x && x < room.x + room.width);
        
        return isAdjacentHorizontally || isAdjacentVertically;
    }
    
    /**
     * Check if this forms a proper door connection considering 8-directional adjacency
     * Must connect exactly 1 room and 1 corridor in cardinal directions
     * Diagonal connections are considered for validation but not counted as primary connections
     */
    isProperDoorConnection(x, y, room) {
        let roomConnections = 0;
        let corridorConnections = 0;
        
        // Primary check: 4 cardinal directions for main connections
        const cardinalDirections = [
            { dx: 0, dy: -1 }, // North
            { dx: 1, dy: 0 },  // East  
            { dx: 0, dy: 1 },  // South
            { dx: -1, dy: 0 }  // West
        ];
        
        for (const dir of cardinalDirections) {
            const checkX = x + dir.dx;
            const checkY = y + dir.dy;
            
            if (!this.isInBounds(checkX, checkY)) {
                continue;
            }
            
            const tile = this.getTile(checkX, checkY);
            
            if (tile.type === 'floor') {
                // Check if this floor is inside the room
                if (checkX >= room.x && checkX < room.x + room.width &&
                    checkY >= room.y && checkY < room.y + room.height) {
                    roomConnections++;
                } else {
                    // This is a corridor floor
                    corridorConnections++;
                }
            }
        }
        
        // Must connect exactly 1 room floor and exactly 1 corridor floor in cardinal directions
        if (roomConnections !== 1 || corridorConnections !== 1) {
            return false;
        }
        
        // Additional validation: Check diagonal connections don't create inappropriate openings
        const diagonalDirections = [
            { dx: -1, dy: -1 }, // NW
            { dx: 1, dy: -1 },  // NE
            { dx: -1, dy: 1 },  // SW
            { dx: 1, dy: 1 }    // SE
        ];
        
        let diagonalRoomFloors = 0;
        let diagonalCorridorFloors = 0;
        
        for (const dir of diagonalDirections) {
            const checkX = x + dir.dx;
            const checkY = y + dir.dy;
            
            if (!this.isInBounds(checkX, checkY)) {
                continue;
            }
            
            const tile = this.getTile(checkX, checkY);
            
            if (tile.type === 'floor') {
                if (checkX >= room.x && checkX < room.x + room.width &&
                    checkY >= room.y && checkY < room.y + room.height) {
                    diagonalRoomFloors++;
                } else {
                    diagonalCorridorFloors++;
                }
            }
        }
        
        // Reject if too many diagonal connections (suggests complex junction)
        if (diagonalRoomFloors > 1 || diagonalCorridorFloors > 1) {
            return false;
        }
        
        return true;
    }
    
    /**
     * Check if door has proper wall enclosure considering 8-directional adjacency
     * Proper doors should not allow diagonal passage bypassing
     */
    hasProperWallEnclosure(x, y) {
        // Check horizontal enclosure (left AND right must be walls)
        const leftTile = this.isInBounds(x - 1, y) ? this.getTile(x - 1, y) : { type: 'wall' };
        const rightTile = this.isInBounds(x + 1, y) ? this.getTile(x + 1, y) : { type: 'wall' };
        const horizontalWalls = (leftTile.type === 'wall') && (rightTile.type === 'wall');
        
        // Check vertical enclosure (up AND down must be walls)  
        const upTile = this.isInBounds(x, y - 1) ? this.getTile(x, y - 1) : { type: 'wall' };
        const downTile = this.isInBounds(x, y + 1) ? this.getTile(x, y + 1) : { type: 'wall' };
        const verticalWalls = (upTile.type === 'wall') && (downTile.type === 'wall');
        
        // If basic enclosure is met, check for diagonal bypasses
        if (horizontalWalls || verticalWalls) {
            // For horizontal corridors, check diagonal corners don't create bypasses
            if (horizontalWalls) {
                // Check diagonal corners: NW, NE, SW, SE
                const corners = [
                    this.isInBounds(x - 1, y - 1) ? this.getTile(x - 1, y - 1) : { type: 'wall' },
                    this.isInBounds(x + 1, y - 1) ? this.getTile(x + 1, y - 1) : { type: 'wall' },
                    this.isInBounds(x - 1, y + 1) ? this.getTile(x - 1, y + 1) : { type: 'wall' },
                    this.isInBounds(x + 1, y + 1) ? this.getTile(x + 1, y + 1) : { type: 'wall' }
                ];
                
                // If both up and down have floor diagonally adjacent, it's not a proper door
                const upFloors = (upTile.type === 'floor' && 
                                 (corners[0].type === 'floor' || corners[1].type === 'floor'));
                const downFloors = (downTile.type === 'floor' && 
                                   (corners[2].type === 'floor' || corners[3].type === 'floor'));
                
                if (upFloors && downFloors) {
                    return false; // Diagonal bypass possible
                }
            }
            
            // For vertical corridors, check diagonal corners don't create bypasses
            if (verticalWalls) {
                const corners = [
                    this.isInBounds(x - 1, y - 1) ? this.getTile(x - 1, y - 1) : { type: 'wall' },
                    this.isInBounds(x + 1, y - 1) ? this.getTile(x + 1, y - 1) : { type: 'wall' },
                    this.isInBounds(x - 1, y + 1) ? this.getTile(x - 1, y + 1) : { type: 'wall' },
                    this.isInBounds(x + 1, y + 1) ? this.getTile(x + 1, y + 1) : { type: 'wall' }
                ];
                
                // If both left and right have floor diagonally adjacent, it's not a proper door
                const leftFloors = (leftTile.type === 'floor' && 
                                   (corners[0].type === 'floor' || corners[2].type === 'floor'));
                const rightFloors = (rightTile.type === 'floor' && 
                                    (corners[1].type === 'floor' || corners[3].type === 'floor'));
                
                if (leftFloors && rightFloors) {
                    return false; // Diagonal bypass possible
                }
            }
            
            return true;
        }
        
        return false;
    }
    

    
    /**
     * Filter out doors that are too close together
     * Classic rule: No doors on adjacent tiles
     */
    filterAdjacentDoors(candidates) {
        const filtered = [];
        
        for (const candidate of candidates) {
            let tooClose = false;
            
            // Check if any existing door candidate is adjacent
            for (const existing of filtered) {
                const distance = Math.abs(candidate.x - existing.x) + Math.abs(candidate.y - existing.y);
                if (distance <= 1) {
                    tooClose = true;
                    break;
                }
            }
            
            if (!tooClose) {
                filtered.push(candidate);
            }
        }
        
        return filtered;
    }
    
    /**
     * Add dead ends for exploration mystery
     */
    addDeadEnds() {
        const numDeadEnds = 2 + Math.floor(Math.random() * 4); // 2-5 dead ends
        
        for (let i = 0; i < numDeadEnds; i++) {
            this.createDeadEnd();
        }
    }
    
    /**
     * Create a dead end passage
     */
    createDeadEnd() {
        // Find a random floor tile that's not in a room
        let startX, startY;
        let attempts = 0;
        
        do {
            startX = 1 + Math.floor(Math.random() * (this.width - 2));
            startY = 1 + Math.floor(Math.random() * (this.height - 2));
            attempts++;
        } while (attempts < 50 && 
                 (this.getTile(startX, startY).type !== 'floor' || this.isInRoom(startX, startY)));
        
        if (attempts >= 50) return;
        
        // Create a short dead end
        const length = 3 + Math.floor(Math.random() * 5); // 3-7 tiles
        const direction = Math.floor(Math.random() * 4);
        const directions = [
            { dx: 0, dy: -1 }, // North
            { dx: 1, dy: 0 },  // East
            { dx: 0, dy: 1 },  // South
            { dx: -1, dy: 0 }  // West
        ];
        
        const dir = directions[direction];
        let x = startX;
        let y = startY;
        
        for (let i = 0; i < length; i++) {
            x += dir.dx;
            y += dir.dy;
            
            if (this.isInBounds(x, y) && x > 0 && x < this.width - 1 && 
                y > 0 && y < this.height - 1 && this.getTile(x, y).type === 'wall') {
                this.setTile(x, y, 'floor');
            } else {
                break;
            }
        }
    }
    
    /**
     * Check if position is inside a room
     */
    isInRoom(x, y) {
        for (const room of this.rooms) {
            if (x >= room.x && x < room.x + room.width &&
                y >= room.y && y < room.y + room.height) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * Add stairs to the dungeon - Balanced placement
     */
    addStairs() {
        if (this.rooms.length === 0) return;
        
        // Place stairs up in the starting room
        const upRoom = this.rooms.find(room => room.type === 'start') || this.rooms[0];
        const upStairsX = upRoom.x + 1 + Math.floor(Math.random() * (upRoom.width - 2));
        const upStairsY = upRoom.y + 1 + Math.floor(Math.random() * (upRoom.height - 2));
        this.setTile(upStairsX, upStairsY, 'stairs_up');
        
        // Place stairs down in the furthest room
        if (this.rooms.length > 1) {
            const normalRooms = this.rooms.filter(room => room.type !== 'secret');
            const downRoom = normalRooms[normalRooms.length - 1];
            const downStairsX = downRoom.x + 1 + Math.floor(Math.random() * (downRoom.width - 2));
            const downStairsY = downRoom.y + 1 + Math.floor(Math.random() * (downRoom.height - 2));
            this.setTile(downStairsX, downStairsY, 'stairs_down');
        }
    }

    /**
     * Place traps across the dungeon (NetHack/Angband-inspired)
     * Traps are stored on floor tiles as tile.trap = { type, hidden, revealed, disarmed, difficulty }
     */
    addTraps() {
        // Determine approximate number of traps based on map size
        const area = this.width * this.height;
        const targetCount = Math.max(5, Math.floor(area * 0.005)); // ~0.5% of tiles, minimum 5

        let placed = 0;
        let attempts = 0;
        const maxAttempts = targetCount * 50;

        while (placed < targetCount && attempts < maxAttempts) {
            attempts++;
            const x = 1 + Math.floor(Math.random() * (this.width - 2));
            const y = 1 + Math.floor(Math.random() * (this.height - 2));
            const tile = this.getTile(x, y);

            // Only place on floor, avoid stairs and doors
            if (tile.type !== 'floor') continue;
            if (this.isNearStairsOrDoor(x, y)) continue;
            if (tile.trap) continue;

            // Bias: Corridors, junctions, room entrances slightly more likely
            const corridorBias = this.isCorridor(x, y) ? 1.5 : 1.0;
            const junctionBias = this.isJunction(x, y) ? 1.5 : 1.0;
            if (Math.random() > 0.35 * corridorBias * junctionBias) continue;

            const trap = this.createRandomTrap();
            tile.trap = trap;
            placed++;
        }
    }

    /** Check adjacency to stairs/doors to avoid unfair placements */
    isNearStairsOrDoor(x, y) {
        const dirs = [
            {dx:0,dy:0},{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},
            {dx:1,dy:1},{dx:1,dy:-1},{dx:-1,dy:1},{dx:-1,dy:-1}
        ];
        for (const d of dirs) {
            const nx = x + d.dx, ny = y + d.dy;
            if (!this.isInBounds(nx, ny)) continue;
            const t = this.getTile(nx, ny);
            if (t.type === 'stairs_up' || t.type === 'stairs_down' || t.type === 'door') return true;
        }
        return false;
    }

    /** Is tile corridor-like (not inside a room) */
    isCorridor(x, y) {
        if (this.isInRoom(x, y)) return false;
        return this.getTile(x, y).type === 'floor';
    }

    /** Detect simple junction (3+ cardinal walkables) */
    isJunction(x, y) {
        const dirs = [ {dx:0,dy:-1}, {dx:1,dy:0}, {dx:0,dy:1}, {dx:-1,dy:0} ];
        let count = 0;
        for (const d of dirs) {
            const nx = x + d.dx, ny = y + d.dy;
            if (!this.isInBounds(nx, ny)) continue;
            const t = this.getTile(nx, ny);
            if (t.type === 'floor' || (t.type === 'door' && t.doorState === 'open')) count++;
        }
        return count >= 3;
    }

    /**
     * Create a random trap definition
     */
    createRandomTrap() {
        const trapRoll = Math.random();
        // Basic set inspired by classic roguelikes
        // Each has a base difficulty (higher = harder to detect/disarm)
        if (trapRoll < 0.30) {
            return { type: 'dart', hidden: true, revealed: false, disarmed: false, difficulty: 30 };
        } else if (trapRoll < 0.55) {
            return { type: 'snare', hidden: true, revealed: false, disarmed: false, difficulty: 40 };
        } else if (trapRoll < 0.75) {
            // Gas trap variants
            const gasType = Math.random() < 0.6 ? 'gas_poison' : 'gas_confuse';
            return { type: gasType, hidden: true, revealed: false, disarmed: false, difficulty: 45 };
        } else if (trapRoll < 0.90) {
            return { type: 'pit', hidden: true, revealed: false, disarmed: false, difficulty: 35 };
        } else {
            return { type: 'alarm', hidden: true, revealed: false, disarmed: false, difficulty: 25 };
        }
    }
    
    /**
     * Find a random walkable position
     */
    getRandomWalkablePosition() {
        if (this.rooms.length === 0) return { x: 1, y: 1 };
        
        const room = this.rooms[Math.floor(Math.random() * this.rooms.length)];
        return {
            x: room.x + Math.floor(Math.random() * room.width),
            y: room.y + Math.floor(Math.random() * room.height)
        };
    }
    
    /**
     * Get the starting position (on stairs_up for level 1)
     */
    getStartPosition() {
        // For level 1, spawn on stairs_up 
        const stairsUp = this.findTileOfType('stairs_up');
        if (stairsUp) {
            return { x: stairsUp.x, y: stairsUp.y };
        }
        
        // Fallback to first room if no stairs found
        if (this.rooms.length > 0) {
            const room = this.rooms[0];
            // Find a floor tile that's not stairs
            for (let attempts = 0; attempts < 20; attempts++) {
                const x = room.x + 1 + Math.floor(Math.random() * (room.width - 2));
                const y = room.y + 1 + Math.floor(Math.random() * (room.height - 2));
                
                if (this.getTile(x, y).type === 'floor') {
                    return { x, y };
                }
            }
            
            // Fallback to corner
            return {
                x: room.x + 1,
                y: room.y + 1
            };
        }
        return { x: 1, y: 1 };
    }
    
    /**
     * Find a tile of specific type in dungeon
     */
    findTileOfType(tileType) {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const tile = this.getTile(x, y);
                if (tile && tile.type === tileType) {
                    return { x, y };
                }
            }
        }
        return null;
    }
    
    /**
     * Check if coordinates are within map bounds
     */
    isInBounds(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }
} 