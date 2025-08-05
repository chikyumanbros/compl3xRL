/**
 * ASCII Renderer for Roguelike Game
 * Handles all visual output to the screen
 */
class Renderer {
    constructor() {
        this.screen = document.getElementById('game-screen');
        this.initializeSize();
    }
    
    /**
     * Initialize size based on container
     */
    initializeSize() {
        // Calculate size based on container dimensions
        const container = this.screen.parentElement;
        const containerWidth = container.clientWidth - 16; // account for padding
        const containerHeight = container.clientHeight - 16;
        
        // Target grid size
        const targetWidth = 80;
        const targetHeight = 25;
        
        // Calculate font size to fit the target grid
        const charWidthRatio = 0.6;
        const lineHeightRatio = 1.2;
        
        const fontSizeForWidth = (containerWidth / targetWidth) / charWidthRatio;
        const fontSizeForHeight = (containerHeight / targetHeight) / lineHeightRatio;
        
        // Use the smaller font size to ensure everything fits
        const fontSize = Math.max(8, Math.min(fontSizeForWidth, fontSizeForHeight));
        
        // Set the calculated values
        this.width = targetWidth;
        this.height = targetHeight;
        this.fontSize = Math.floor(fontSize);
        
        // Apply font size to screen element
        this.screen.style.fontSize = `${this.fontSize}px`;
        this.screen.style.lineHeight = `${this.fontSize * lineHeightRatio}px`;
        

        
        // ASCII symbols for different elements
        this.symbols = {
            // Terrain
            wall: '#',
            floor: '.',
            door: '+',
            corridor: '.',
            void: ' ',
            
            // Entities
            player: '@',
            
            // Doors
            door_closed: '+',
            door_open: '-',
            door_locked: '+',
            
            // Monsters (all white)
            kobold: 'k',
            rat: 'r',
            bat: 'b',
            newt: 'n',
            gecko: 'g',
            goblin: 'g',
            orc: 'o',
            hobgoblin: 'h',
            gnoll: 'G',
            
            // Items
            gold: '$',
            potion: '!',
            scroll: '?',
            weapon: ')',
            armor: '[',
            
            // Special
            stairs_down: '>',
            stairs_up: '<',
            trap: '^'
        };
        
        // Color classes for different elements
        this.colors = {
            wall: 'wall',
            floor: 'floor',
            door: 'door',
            player: 'player',
            monster: 'monster',
            item: 'item',
            stairs: 'stairs'
        };
        
        this.buffer = [];
        this.initBuffer();
    }
    
    /**
     * Initialize the screen buffer
     */
    initBuffer() {
        this.buffer = [];
        for (let y = 0; y < this.height; y++) {
            this.buffer[y] = [];
            for (let x = 0; x < this.width; x++) {
                this.buffer[y][x] = {
                    char: ' ',
                    color: 'floor'
                };
            }
        }
    }
    
    /**
     * Clear the screen buffer
     */
    clear() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.buffer[y][x] = {
                    char: ' ',
                    color: 'floor'
                };
            }
        }
    }
    
    /**
     * Set a character at specific coordinates
     */
    setChar(x, y, char, color = 'floor') {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            this.buffer[y][x] = {
                char: char,
                color: color
            };
        }
    }
    
    /**
     * Draw the dungeon map with FOV support
     */
    drawDungeon(dungeon, viewX = 0, viewY = 0, fov = null) {
        const mapWidth = dungeon.width;
        const mapHeight = dungeon.height;
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const mapX = x + viewX;
                const mapY = y + viewY;
                
                if (mapX >= 0 && mapX < mapWidth && mapY >= 0 && mapY < mapHeight) {
                    const tile = dungeon.getTile(mapX, mapY);
                    let char = this.symbols.void;
                    let color = 'floor';
                    
                    // Check visibility
                    const visibility = fov ? fov.getTileVisibility(mapX, mapY) : { visible: true, explored: true };
                    
                    if (!visibility.explored) {
                        // Never seen - show void
                        this.setChar(x, y, this.symbols.void, 'floor');
                        continue;
                    }
                    
                    // Get tile appearance
                    switch (tile.type) {
                        case 'wall':
                            char = this.symbols.wall;
                            color = visibility.visible ? 'wall' : 'wall_memory';
                            break;
                        case 'floor':
                            char = this.symbols.floor;
                            color = visibility.visible ? 'floor' : 'floor_memory';
                            break;
                                            case 'door':
                        // Display door based on its state
                        const doorState = tile.doorState || 'closed';
                        if (doorState === 'open') {
                            char = this.symbols.door_open;
                            color = visibility.visible ? 'door_open' : 'door_open_memory';
                        } else if (doorState === 'locked') {
                            char = this.symbols.door_locked;
                            color = visibility.visible ? 'door_locked' : 'door_locked_memory';
                        } else {
                            char = this.symbols.door_closed;
                            color = visibility.visible ? 'door_closed' : 'door_closed_memory';
                        }
                        break;
                        case 'stairs_down':
                            char = this.symbols.stairs_down;
                            color = visibility.visible ? 'stairs' : 'stairs_memory';
                            break;
                        case 'stairs_up':
                            char = this.symbols.stairs_up;
                            color = visibility.visible ? 'stairs' : 'stairs_memory';
                            break;
                    }
                    
                    this.setChar(x, y, char, color);
                } else {
                    this.setChar(x, y, this.symbols.void, 'floor');
                }
            }
        }
    }
    
    /**
     * Draw the player
     */
    drawPlayer(player, viewX = 0, viewY = 0) {
        const screenX = player.x - viewX;
        const screenY = player.y - viewY;
        
        if (screenX >= 0 && screenX < this.width && screenY >= 0 && screenY < this.height) {
            this.setChar(screenX, screenY, this.symbols.player, 'player');
        }
    }
    
    /**
     * Draw monsters
     */
    drawMonsters(monsters, viewX = 0, viewY = 0, fov = null) {
        monsters.forEach(monster => {
            if (!monster.isAlive) return;
            
            const screenX = monster.x - viewX;
            const screenY = monster.y - viewY;
            
            // Check if monster is on screen
            if (screenX >= 0 && screenX < this.width && screenY >= 0 && screenY < this.height) {
                // Check if monster is visible (use FOV if available)
                const visibility = fov ? fov.getTileVisibility(monster.x, monster.y) : { visible: true };
                
                if (visibility.visible) {
                    // Choose color based on sleep state
                    let displayColor = monster.color;
                    if (monster.isAsleep) {
                        // Sleeping monsters appear in darker/muted color
                        displayColor = 'monster_sleeping';
                    }
                    
                    this.setChar(screenX, screenY, monster.symbol, displayColor);
                }
            }
        });
    }
    
    /**
     * Render the buffer to the screen
     */
    render() {
        let output = '';
        
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const cell = this.buffer[y][x];
                
                // Check if color is a hex color code or CSS class
                if (cell.color && cell.color.startsWith('#')) {
                    // Use inline style for hex colors
                    output += `<span style="color: ${cell.color};">${cell.char}</span>`;
                } else {
                    // Use CSS class for predefined colors
                    output += `<span class="${cell.color}">${cell.char}</span>`;
                }
            }
            if (y < this.height - 1) {
                output += '\n';
            }
        }
        
        this.screen.innerHTML = output;
    }
    
    /**
     * Center the view on the player
     */
    centerOnPlayer(player) {
        return {
            x: player.x - Math.floor(this.width / 2),
            y: player.y - Math.floor(this.height / 2)
        };
    }
    
    /**
     * Update UI elements
     */
    updateUI(player, monsters = null, fov = null) {
        // Skip UI updates during equipment changes to avoid inconsistent display
        if (player._equipmentChanging) {
            return;
        }
        
        // Update player stats
        document.getElementById('player-hp').textContent = `HP: ${player.hp}/${player.maxHp}`;
        document.getElementById('player-level').textContent = `Level: ${player.level}`;
        document.getElementById('player-exp').textContent = `Exp: ${player.exp}/${player.expToNext}`;
        document.getElementById('player-pos').textContent = `Position: (${player.x},${player.y})`;
        
        // Update combat stats (use stats object for consistency)
        const stats = player.getStats();
        if (document.getElementById('player-ac')) {
            document.getElementById('player-ac').textContent = `AC: ${stats.armorClass}`;
            
            // Enhanced to-hit display with modifiers (always show breakdown)
            const breakdown = stats.toHitBreakdown;
            let toHitText = `To Hit: ${stats.toHit >= 0 ? '+' : ''}${stats.toHit}`;
            
            // Always show breakdown, starting with base
            const breakdownParts = [`${breakdown.base} base`];
            
            // Add non-zero modifiers
            if (breakdown.weaponSkill !== 0) breakdownParts.push(`weapon${breakdown.weaponSkill >= 0 ? '+' : ''}${breakdown.weaponSkill}`);
            if (breakdown.encumbrance !== 0) breakdownParts.push(`load${breakdown.encumbrance >= 0 ? '+' : ''}${breakdown.encumbrance}`);
            if (breakdown.dexterity !== 0) breakdownParts.push(`dex${breakdown.dexterity >= 0 ? '+' : ''}${breakdown.dexterity}`);
            if (breakdown.condition !== 0) breakdownParts.push(`cond${breakdown.condition >= 0 ? '+' : ''}${breakdown.condition}`);
            
            // Always add breakdown in parentheses
            toHitText += ` (${breakdownParts.join(', ')})`;
            document.getElementById('player-tohit').textContent = toHitText;
            
            document.getElementById('player-damage').textContent = `Damage: ${stats.minDamage}-${stats.maxDamage}`;
            
            // Display penetration and total protection
            if (document.getElementById('player-penetration')) {
                document.getElementById('player-penetration').textContent = `AP: ${stats.penetration || 0}`;
            }
            if (document.getElementById('player-protection')) {
                document.getElementById('player-protection').textContent = `DR: ${stats.totalProtection || 0}`;
            }
            if (document.getElementById('player-blockchance')) {
                document.getElementById('player-blockchance').textContent = `BC: ${stats.blockChance || 0}%`;
            }
        }
        
        // Update detailed stats
        if (document.getElementById('player-str')) {
            document.getElementById('player-str').textContent = `STR: ${stats.strength}`;
            document.getElementById('player-dex').textContent = `DEX: ${stats.dexterity}`;
            document.getElementById('player-con').textContent = `CON: ${stats.constitution}`;
            document.getElementById('player-int').textContent = `INT: ${stats.intelligence}`;
            document.getElementById('player-wis').textContent = `WIS: ${stats.wisdom}`;
            document.getElementById('player-cha').textContent = `CHA: ${stats.charisma}`;
        }
        
        // Update hunger status (Always visible detailed status)
        if (stats.hungerStatus) {
            const hungerElement = document.getElementById('hunger-status');
            if (hungerElement) {
                hungerElement.textContent = stats.hungerStatus.name;
                hungerElement.style.color = stats.hungerStatus.color;
                hungerElement.style.display = 'block';
            }
        }
        
        // Update weight/encumbrance status
        if (stats.encumbrance) {
            if (document.getElementById('weight-status')) {
                document.getElementById('weight-status').textContent = `Weight: ${stats.currentWeight.toFixed(1)}/${stats.maxWeight}`;
            }
            
            const encumbranceElement = document.getElementById('encumbrance-status');
            if (encumbranceElement) {
                if (stats.encumbrance.level !== 'UNENCUMBERED') {
                    encumbranceElement.textContent = stats.encumbrance.name;
                    encumbranceElement.style.color = stats.encumbrance.color;
                    encumbranceElement.style.display = 'block';
                } else {
                    encumbranceElement.style.display = 'none'; // Hide when unencumbered
                }
            }
        }
        
        // Update turn count and dungeon level
        if (document.getElementById('turn-count')) {
            document.getElementById('turn-count').textContent = stats.turnCount;
        }
        if (document.getElementById('dungeon-level')) {
            document.getElementById('dungeon-level').textContent = window.game ? window.game.currentLevel : 1;
        }
        
        // Update equipment display
        this.updateEquipmentDisplay(player);
        
        // Update inventory display
        this.updateInventoryDisplay(player);
        
        // Update visible monsters display
        if (monsters && fov) {
            this.updateVisibleMonsters(monsters, fov, player.x, player.y);
        }
        
        // Update nearby items display
        if (fov && window.game && window.game.itemManager) {
            this.updateNearbyItems(window.game.itemManager, fov, player.x, player.y);
        }
    }
    
    /**
     * Add message to game log
     */
    addLogMessage(message) {
        const logContainer = document.getElementById('log-container');
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        logContainer.appendChild(messageDiv);
        
        // Keep only last 100 messages
        while (logContainer.children.length > 100) {
            logContainer.removeChild(logContainer.firstChild);
        }
        
        // Scroll to bottom
        logContainer.scrollTop = logContainer.scrollHeight;
    }
    
    /**
     * Add message to battle log (now integrated with game log)
     */
    addBattleLogMessage(message, type = 'normal') {
        const logContainer = document.getElementById('log-container');
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message;
        if (type !== 'normal') {
            messageDiv.className = type;
        }
        logContainer.appendChild(messageDiv);
        
        // Keep only last 100 messages (increased from 50)
        while (logContainer.children.length > 100) {
            logContainer.removeChild(logContainer.firstChild);
        }
        
        // Scroll to bottom
        logContainer.scrollTop = logContainer.scrollHeight;
    }
    
    /**
     * Calculate direction from player to target (Angband style)
     */
    calculateDirection(dx, dy) {
        // If at same position
        if (dx === 0 && dy === 0) {
            return 'here';
        }
        
        // Calculate angle in radians
        const angle = Math.atan2(dy, dx);
        // Convert to degrees (0-360)
        const degrees = ((angle * 180 / Math.PI) + 360) % 360;
        
        // Map to 8 directions (Angband style)
        // In roguelikes, typically y increases downward
        if (degrees >= 337.5 || degrees < 22.5) {
            return 'E';  // East
        } else if (degrees >= 22.5 && degrees < 67.5) {
            return 'SE'; // Southeast
        } else if (degrees >= 67.5 && degrees < 112.5) {
            return 'S';  // South
        } else if (degrees >= 112.5 && degrees < 157.5) {
            return 'SW'; // Southwest
        } else if (degrees >= 157.5 && degrees < 202.5) {
            return 'W';  // West
        } else if (degrees >= 202.5 && degrees < 247.5) {
            return 'NW'; // Northwest
        } else if (degrees >= 247.5 && degrees < 292.5) {
            return 'N';  // North
        } else {
            return 'NE'; // Northeast
        }
    }
    
    /**
     * Format direction for display (Angband style)
     */
    formatDirection(direction, distance) {
        if (direction === 'here') {
            return 'here';
        }
        
        // Angband style: distance + direction
        return `${distance} ${direction}`;
    }
    
    /**
     * Get visible monsters within FOV
     */
    getVisibleMonsters(monsters, fov, playerX, playerY) {
        if (!fov || !monsters) return [];
        
        return monsters.filter(monster => {
            if (!monster.isAlive) return false;
            
            // Check if monster is visible using FOV
            const visibility = fov.getTileVisibility(monster.x, monster.y);
            return visibility.visible;
        }).map(monster => {
            // Calculate distance from player
            const dx = monster.x - playerX;
            const dy = monster.y - playerY;
            const distance = Math.floor(Math.sqrt(dx * dx + dy * dy));
            
            // Calculate direction
            const direction = this.calculateDirection(dx, dy);
            const directionText = this.formatDirection(direction, distance);
            
            return {
                name: monster.name,
                symbol: monster.symbol,
                color: monster.color,
                x: monster.x,
                y: monster.y,
                distance: distance,
                direction: direction,
                directionText: directionText,
                hp: monster.hp,
                maxHp: monster.maxHp,
                isAsleep: monster.isAsleep
            };
        }).sort((a, b) => a.distance - b.distance); // Sort by distance
    }
    
    /**
     * Update visible monsters display
     */
    updateVisibleMonsters(monsters, fov, playerX, playerY) {
        const container = document.getElementById('visible-monsters-container');
        if (!container) return;
        
        const visibleMonsters = this.getVisibleMonsters(monsters, fov, playerX, playerY);
        
        // Clear existing content
        container.innerHTML = '';
        
        if (visibleMonsters.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.textContent = 'No monsters visible';
            emptyDiv.style.color = '#888';
            emptyDiv.style.fontStyle = 'italic';
            container.appendChild(emptyDiv);
        } else {
            visibleMonsters.forEach(monster => {
                const monsterDiv = document.createElement('div');
                monsterDiv.className = 'monster-entry';
                
                // Create monster info display
                const nameSpan = document.createElement('span');
                nameSpan.className = 'monster-name';
                let displayName = monster.name;
                if (monster.isAsleep) {
                    displayName += ' (sleeping)';
                    nameSpan.style.color = '#888888'; // Dim color for sleeping monsters
                }
                nameSpan.textContent = displayName;
                
                const symbolSpan = document.createElement('span');
                symbolSpan.className = 'monster-symbol';
                symbolSpan.textContent = monster.symbol;
                symbolSpan.style.color = monster.color || '#ff6666';
                
                const directionSpan = document.createElement('span');
                directionSpan.className = 'monster-direction';
                directionSpan.textContent = monster.directionText;
                
                const leftDiv = document.createElement('div');
                leftDiv.appendChild(symbolSpan);
                leftDiv.appendChild(nameSpan);
                
                const rightDiv = document.createElement('div');
                rightDiv.appendChild(directionSpan);
                
                monsterDiv.appendChild(leftDiv);
                monsterDiv.appendChild(rightDiv);
                
                // Add HP info if monster is injured
                if (monster.hp < monster.maxHp) {
                    const hpDiv = document.createElement('div');
                    hpDiv.style.fontSize = '10px';
                    hpDiv.style.color = '#ff9999';
                    hpDiv.style.paddingLeft = '20px';
                    hpDiv.textContent = `HP: ${monster.hp}/${monster.maxHp}`;
                    monsterDiv.appendChild(hpDiv);
                }
                
                container.appendChild(monsterDiv);
            });
        }
    }
    
    /**
     * Get nearby items within FOV
     */
    getNearbyItems(itemManager, fov, playerX, playerY) {
        if (!fov || !itemManager || !itemManager.items) return [];
        
        return itemManager.items.filter(item => {
            // Check if item is visible using FOV
            const visibility = fov.getTileVisibility(item.x, item.y);
            return visibility.visible;
        }).map(item => {
            // Calculate distance from player
            const dx = item.x - playerX;
            const dy = item.y - playerY;
            const distance = Math.floor(Math.sqrt(dx * dx + dy * dy));
            
            // Calculate direction
            const direction = this.calculateDirection(dx, dy);
            const directionText = this.formatDirection(direction, distance);
            
            return {
                name: item.name,
                displayName: item.getDisplayName ? item.getDisplayName() : item.name,
                symbol: item.symbol,
                color: item.color,
                x: item.x,
                y: item.y,
                distance: distance,
                direction: direction,
                directionText: directionText,
                type: item.type,
                stackable: item.stackable,
                quantity: item.quantity || 1
            };
        }).sort((a, b) => a.distance - b.distance); // Sort by distance
    }
    
    /**
     * Update nearby items display
     */
    updateNearbyItems(itemManager, fov, playerX, playerY) {
        const container = document.getElementById('nearby-items-container');
        if (!container) return;
        
        const nearbyItems = this.getNearbyItems(itemManager, fov, playerX, playerY);
        
        // Clear existing content
        container.innerHTML = '';
        
        if (nearbyItems.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.textContent = 'No items nearby';
            emptyDiv.style.color = '#888';
            emptyDiv.style.fontStyle = 'italic';
            container.appendChild(emptyDiv);
        } else {
            nearbyItems.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'item-entry';
                itemDiv.style.display = 'flex';
                itemDiv.style.justifyContent = 'space-between';
                itemDiv.style.alignItems = 'center';
                itemDiv.style.marginBottom = '2px';
                itemDiv.style.paddingBottom = '2px';
                
                // Create item info display
                const symbolSpan = document.createElement('span');
                symbolSpan.className = 'item-symbol';
                symbolSpan.textContent = item.symbol;
                symbolSpan.style.color = item.color || '#ffff00';
                symbolSpan.style.marginRight = '8px';
                
                const nameSpan = document.createElement('span');
                nameSpan.className = 'item-name';
                nameSpan.textContent = item.displayName;
                nameSpan.style.color = '#cccccc';
                
                const directionSpan = document.createElement('span');
                directionSpan.className = 'item-direction';
                directionSpan.textContent = item.directionText;
                directionSpan.style.color = '#aaaaaa';
                directionSpan.style.fontSize = '10px';
                
                const leftDiv = document.createElement('div');
                leftDiv.style.display = 'flex';
                leftDiv.style.alignItems = 'center';
                leftDiv.appendChild(symbolSpan);
                leftDiv.appendChild(nameSpan);
                
                const rightDiv = document.createElement('div');
                rightDiv.appendChild(directionSpan);
                
                itemDiv.appendChild(leftDiv);
                itemDiv.appendChild(rightDiv);
                
                container.appendChild(itemDiv);
            });
        }
    }
    
    /**
     * Get quality and condition text for equipment
     */
    /**
     * Update equipment display
     */
    updateEquipmentDisplay(player) {
        const equipment = player.equipment;
        
        // Update weapon slot with stats
        const weaponSlot = document.getElementById('weapon-slot');
        if (weaponSlot) {
            if (equipment.weapon) {
                const weapon = equipment.weapon;
                const { qualityText, conditionText, statsText } = Player.getEquipmentDisplayInfo(weapon);
                const enchantDisplay = weapon.enchantment > 0 ? `+${weapon.enchantment} ` : 
                                      weapon.enchantment < 0 ? `${weapon.enchantment} ` : '';
                
                weaponSlot.textContent = `Weapon: ${enchantDisplay}${weapon.name}${qualityText}${conditionText}${statsText}`;
            } else {
                weaponSlot.textContent = `Weapon: None (unarmed)`;
            }
        }
        
        // Update armor slot with stats
        const armorSlot = document.getElementById('armor-slot');
        if (armorSlot) {
            if (equipment.armor) {
                const armor = equipment.armor;
                const { qualityText, conditionText, statsText } = Player.getEquipmentDisplayInfo(armor);
                const enchantDisplay = armor.enchantment > 0 ? `+${armor.enchantment} ` : 
                                      armor.enchantment < 0 ? `${armor.enchantment} ` : '';
                
                armorSlot.textContent = `Armor: ${enchantDisplay}${armor.name}${qualityText}${conditionText}${statsText}`;
            } else {
                armorSlot.textContent = `Armor: None`;
            }
        }
        
        // Update shield slot with stats
        const shieldSlot = document.getElementById('shield-slot');
        if (shieldSlot) {
            if (equipment.shield) {
                const shield = equipment.shield;
                const { qualityText, conditionText, statsText } = Player.getEquipmentDisplayInfo(shield);
                const enchantDisplay = shield.enchantment > 0 ? `+${shield.enchantment} ` : 
                                      shield.enchantment < 0 ? `${shield.enchantment} ` : '';
                
                shieldSlot.textContent = `Shield: ${enchantDisplay}${shield.name}${qualityText}${conditionText}${statsText}`;
            } else {
                shieldSlot.textContent = `Shield: None`;
            }
        }
        
        // Update helmet slot with stats
        const helmetSlot = document.getElementById('helmet-slot');
        if (helmetSlot) {
            if (equipment.helmet) {
                const helmet = equipment.helmet;
                const { qualityText, conditionText, statsText } = Player.getEquipmentDisplayInfo(helmet);
                
                helmetSlot.textContent = `Helmet: ${helmet.name}${qualityText}${conditionText}${statsText}`;
            } else {
                helmetSlot.textContent = `Helmet: None`;
            }
        }
        
        // Update gloves slot with stats
        const glovesSlot = document.getElementById('gloves-slot');
        if (glovesSlot) {
            if (equipment.gloves) {
                const gloves = equipment.gloves;
                const { qualityText, conditionText, statsText } = Player.getEquipmentDisplayInfo(gloves);
                
                glovesSlot.textContent = `Gloves: ${gloves.name}${qualityText}${conditionText}${statsText}`;
            } else {
                glovesSlot.textContent = `Gloves: None`;
            }
        }
        
        // Update boots slot with stats
        const bootsSlot = document.getElementById('boots-slot');
        if (bootsSlot) {
            if (equipment.boots) {
                const boots = equipment.boots;
                const { qualityText, conditionText, statsText } = Player.getEquipmentDisplayInfo(boots);
                
                bootsSlot.textContent = `Boots: ${boots.name}${qualityText}${conditionText}${statsText}`;
            } else {
                bootsSlot.textContent = `Boots: None`;
            }
        }
        
        // Update ring1 slot with stats
        const ring1Slot = document.getElementById('ring1-slot');
        if (ring1Slot) {
            if (equipment.ring1) {
                const ring = equipment.ring1;
                const { qualityText, conditionText, statsText } = Player.getEquipmentDisplayInfo(ring);
                const enchantDisplay = ring.enchantment > 0 ? `+${ring.enchantment} ` : 
                                      ring.enchantment < 0 ? `${ring.enchantment} ` : '';
                
                ring1Slot.textContent = `Ring (L): ${enchantDisplay}${ring.name}${qualityText}${conditionText}${statsText}`;
            } else {
                ring1Slot.textContent = `Ring (L): None`;
            }
        }
        
        // Update ring2 slot with stats
        const ring2Slot = document.getElementById('ring2-slot');
        if (ring2Slot) {
            if (equipment.ring2) {
                const ring = equipment.ring2;
                const { qualityText, conditionText, statsText } = Player.getEquipmentDisplayInfo(ring);
                const enchantDisplay = ring.enchantment > 0 ? `+${ring.enchantment} ` : 
                                      ring.enchantment < 0 ? `${ring.enchantment} ` : '';
                
                ring2Slot.textContent = `Ring (R): ${enchantDisplay}${ring.name}${qualityText}${conditionText}${statsText}`;
            } else {
                ring2Slot.textContent = `Ring (R): None`;
            }
        }
        
        // Update amulet slot with stats
        const amuletSlot = document.getElementById('amulet-slot');
        if (amuletSlot) {
            if (equipment.amulet) {
                const amulet = equipment.amulet;
                const { qualityText, conditionText, statsText } = Player.getEquipmentDisplayInfo(amulet);
                const enchantDisplay = amulet.enchantment > 0 ? `+${amulet.enchantment} ` : 
                                      amulet.enchantment < 0 ? `${amulet.enchantment} ` : '';
                
                amuletSlot.textContent = `Amulet: ${enchantDisplay}${amulet.name}${qualityText}${conditionText}${statsText}`;
            } else {
                amuletSlot.textContent = `Amulet: None`;
            }
        }
    }
    
    /**
     * Update inventory display
     */
    updateInventoryDisplay(player) {
        const inventoryContainer = document.getElementById('inventory-container');
        if (!inventoryContainer) return;
        
        // Clear current inventory display
        inventoryContainer.innerHTML = '';
        
        // Add inventory items
        const inventory = player.getInventorySummary();
        if (inventory.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.textContent = 'Empty';
            emptyDiv.style.fontStyle = 'italic';
            emptyDiv.style.color = '#808080';
            inventoryContainer.appendChild(emptyDiv);
        } else {
            inventory.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.textContent = item;
                itemDiv.style.fontSize = '10px';
                inventoryContainer.appendChild(itemDiv);
            });
        }
    }
    
    /**
     * Draw items on the ground
     */
    drawItems(items, viewX = 0, viewY = 0, fov = null) {
        if (!items || !Array.isArray(items)) {

            return;
        }
        
        // Group items by position
        const itemGroups = new Map();
        items.forEach(item => {
            // Safety check for item properties
            if (!item || typeof item.x !== 'number' || typeof item.y !== 'number') {

                return;
            }
            
            const key = `${item.x},${item.y}`;
            if (!itemGroups.has(key)) {
                itemGroups.set(key, []);
            }
            itemGroups.get(key).push(item);
        });
        
        // Draw each group
        itemGroups.forEach((itemGroup, key) => {
            const [x, y] = key.split(',').map(Number);
            const screenX = x - viewX;
            const screenY = y - viewY;
            
            // Check if item is on screen and visible
            if (screenX >= 0 && screenX < this.width &&
                screenY >= 0 && screenY < this.height) {
                
                // Use first item for visibility check (all items in group have same visibility)
                const firstItem = itemGroup[0];
                let visibility = { visible: true, explored: true };
                
                // Safe FOV check
                if (fov && typeof fov.getVisibility === 'function') {
                    try {
                        visibility = fov.getVisibility(x, y);
                    } catch (error) {
        
                        visibility = { visible: true, explored: true };
                    }
                }
                
                // Only show items that are currently visible OR have been seen before
                if (visibility.visible || (firstItem.hasBeenSeen && visibility.explored)) {
                    let symbol, color;
                    
                    if (itemGroup.length > 1) {
                        // Multiple items - use & symbol
                        symbol = '&';
                        color = 'item_multiple';
                    } else {
                        // Single item
                        symbol = firstItem.symbol || '?';
                        color = 'item';
                    }
                    
                    // Use item's color if specified (for single items)
                    if (firstItem.color && visibility.visible && itemGroup.length === 1) {
                        color = firstItem.color;
                    } else if (!visibility.visible) {
                        color = 'item_memory';
                    }
                    
                    this.setChar(screenX, screenY, symbol, color);
                }
            }
        });
    }
    

} 