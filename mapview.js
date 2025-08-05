/**
 * MapView class for displaying Angband-style dungeon map
 * Shows the entire dungeon level with explored areas, player position, etc.
 */
class MapView {
    constructor() {
        this.overlay = document.getElementById('map-overlay');
        this.mapWindow = document.getElementById('map-window');
        this.mapTitle = document.getElementById('map-title');
        this.mapCanvas = document.getElementById('map-canvas');
        this.isOpen = false;
        
        this.setupEventListeners();
        
        // Map rendering settings
        this.tileSize = 6; // Optimized for 400-600px window width
        this.colors = {
            wall: '#666666',
            floor: '#333333',
            unexplored: '#000000',
            door: '#8B4513',
            upstairs: '#00FF00',
            downstairs: '#FF0000',
            player: '#FFFF00',
            monster: '#FF6666',
            item: '#00FFFF'
        };
    }
    
    setupEventListeners() {
        // Close map on ESC key only - no mouse operations
        document.addEventListener('keydown', (event) => {
            if (this.isOpen && event.code === 'Escape') {
                this.hide();
            }
        });
    }
    
    show(game) {
        if (this.isOpen) {
            this.hide();
            return;
        }
        
        this.isOpen = true;
        this.game = game;
        
        // Update title with current level
        this.mapTitle.textContent = `Dungeon Map - Level ${game.currentLevel}`;
        
        // Show overlay
        this.overlay.style.display = 'flex';
        
        // Render the map
        this.renderMap();
    }
    
    hide() {
        this.isOpen = false;
        this.overlay.style.display = 'none';
    }
    
    renderMap() {
        if (!this.game || !this.game.dungeon) return;
        
        const dungeon = this.game.dungeon;
        const player = this.game.player;
        const fov = this.game.fov;
        
        // Set canvas size based on dungeon dimensions
        const mapWidth = dungeon.width * this.tileSize;
        const mapHeight = dungeon.height * this.tileSize;
        
        this.mapCanvas.width = mapWidth;
        this.mapCanvas.height = mapHeight;
        
        const ctx = this.mapCanvas.getContext('2d');
        
        // Clear canvas
        ctx.fillStyle = this.colors.unexplored;
        ctx.fillRect(0, 0, mapWidth, mapHeight);
        
        // Render explored areas
        for (let y = 0; y < dungeon.height; y++) {
            for (let x = 0; x < dungeon.width; x++) {
                // Only show explored areas
                if (!fov.isExplored(x, y)) continue;
                
                const tile = dungeon.getTile(x, y);
                let color = this.colors.unexplored;
                
                switch (tile.type) {
                    case 'wall':
                        color = this.colors.wall;
                        break;
                    case 'floor':
                        color = this.colors.floor;
                        break;
                    case 'door':
                        color = this.colors.door;
                        break;
                    case 'upstairs':
                        color = this.colors.upstairs;
                        break;
                    case 'downstairs':
                        color = this.colors.downstairs;
                        break;
                }
                
                // Draw tile
                ctx.fillStyle = color;
                ctx.fillRect(
                    x * this.tileSize,
                    y * this.tileSize,
                    this.tileSize,
                    this.tileSize
                );
            }
        }
        
        // Render items (only explored areas)
        if (this.game.itemManager && this.game.itemManager.items) {
            ctx.fillStyle = this.colors.item;
            for (const item of this.game.itemManager.items) {
                if (fov.isExplored(item.x, item.y)) {
                    ctx.fillRect(
                        item.x * this.tileSize,
                        item.y * this.tileSize,
                        this.tileSize,
                        this.tileSize
                    );
                }
            }
        }
        
        // Render monsters (only visible ones)
        if (this.game.monsterSpawner) {
            const monsters = this.game.monsterSpawner.getLivingMonsters();
            ctx.fillStyle = this.colors.monster;
            for (const monster of monsters) {
                if (fov.isVisible(monster.x, monster.y)) {
                    ctx.fillRect(
                        monster.x * this.tileSize,
                        monster.y * this.tileSize,
                        this.tileSize,
                        this.tileSize
                    );
                }
            }
        }
        
        // Render player position (always visible)
        ctx.fillStyle = this.colors.player;
        ctx.fillRect(
            player.x * this.tileSize,
            player.y * this.tileSize,
            this.tileSize,
            this.tileSize
        );
        
        // Add a bright border around player for better visibility
        ctx.strokeStyle = this.colors.player;
        ctx.lineWidth = 1;
        ctx.strokeRect(
            player.x * this.tileSize - 1,
            player.y * this.tileSize - 1,
            this.tileSize + 2,
            this.tileSize + 2
        );
    }
    
    // Toggle map display
    toggle(game) {
        if (this.isOpen) {
            this.hide();
        } else {
            this.show(game);
        }
    }
}

// Create global map view instance
window.mapView = new MapView();