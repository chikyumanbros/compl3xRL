/**
 * Sub-window management system for Roguelike Game
 * Handles inventory, equipment, and other modal windows
 */

class SubWindow {
    constructor() {
        this.overlay = document.getElementById('sub-window-overlay');
        this.window = document.getElementById('sub-window');
        this.title = document.getElementById('sub-window-title');
        this.content = document.getElementById('sub-window-content');
        this.input = document.getElementById('sub-window-input');
        this.textInput = document.getElementById('sub-window-text-input');
        this.confirmBtn = document.getElementById('sub-window-confirm');
        this.cancelBtn = document.getElementById('sub-window-cancel');
        this.closeBtn = document.getElementById('sub-window-close');
        
        // === CLASSICAL ROGUELIKE: HIDE MOUSE-CLICKABLE BUTTONS ===
        // Pure keyboard interface - no mouse interaction allowed
        this.confirmBtn.style.display = 'none';  // Use Enter key instead
        this.cancelBtn.style.display = 'none';   // Use Escape key instead  
        this.closeBtn.style.display = 'none';    // Use Escape key instead
        
        this.isOpen = false;
        this.callback = null;
        this.selectedIndex = -1;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // === PURE KEYBOARD-ONLY INTERFACE ===
        // No mouse clicks allowed - classical roguelike principle
        
        // Enter key in text input
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleConfirm();
            }
        });
        
        // Prevent other key events from interfering (except Escape)
        this.textInput.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') {
                e.stopPropagation();
            }
        });
        
        // Escape key to close (classical roguelike standard)
        document.addEventListener('keydown', (e) => {
            if (this.isOpen && e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                
                // If this is the autosave prompt dialog, handle escape as "No, New Game"
                if (this.keyHandler && window.game && window.game.handleLoadAutosaveChoice) {
                    window.game.handleLoadAutosaveChoice(false);
                }
                
                this.close();
            } else if (this.isOpen && this.keyHandler) {
                // Handle custom key inputs for dialogs
                this.keyHandler(e);
            }
        });
        
        // Note: Mouse interactions removed to maintain classical roguelike purity
        // All interactions must be keyboard-only (ESC to close, Enter to confirm)
    }
    
    showInventory(player) {
        this.title.textContent = 'Inventory';
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = 'Enter letter (a-z) for details, Escape to close';
        this.textInput.value = '';
        
        const inventory = player.getInventorySummary();
        
        if (inventory.length === 0) {
            this.content.innerHTML = '<div style="color: #808080; font-style: italic;">Your pack is empty.</div>';
            this.input.style.display = 'none';
        } else {
            inventory.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'item-line';
                itemDiv.textContent = item;
                this.content.appendChild(itemDiv);
            });
            
            // Add help text
            const helpDiv = document.createElement('div');
            helpDiv.style.marginTop = '10px';
            helpDiv.style.color = '#808080';
            helpDiv.style.fontSize = '0.9em';
            helpDiv.textContent = 'Enter item letter (a-z) to see description';
            this.content.appendChild(helpDiv);
        }
        
        this.callback = (choice) => {
            if (choice && choice.length === 1) {
                const letter = choice.toLowerCase();
                const item = player.getInventoryItem(letter);
                
                if (item) {
                    const index = letter.charCodeAt(0) - 97; // a=0, b=1, etc.
                    this.showItemDetails(player, index);
                    return false; // Keep window open, but don't close it
                } else {
                    if (window.game && window.game.renderer) {
                        window.game.renderer.addLogMessage('No item at that position.');
                    }
                    return false; // Keep window open for retry
                }
            }
            return false; // Keep window open for invalid input
        };
        
        this.show();
        this.textInput.focus();
    }
    
    /**
     * Show detailed information about a specific item
     */
    showItemDetails(player, itemIndex) {
        const letter = String.fromCharCode(97 + itemIndex); // Convert index to letter (a, b, c...)
        const item = player.getInventoryItem(letter);
        
        if (!item) {
            return;
        }
        
        this.title.textContent = `Item Details: ${item.name}`;
        this.content.innerHTML = '';
        this.input.style.display = 'none';
        
        // Item name
        const nameDiv = document.createElement('div');
        nameDiv.style.fontSize = '1.1em';
        nameDiv.style.fontWeight = 'bold';
        nameDiv.style.color = '#ffffff';
        nameDiv.style.marginBottom = '10px';
        nameDiv.textContent = item.getDisplayName ? item.getDisplayName() : item.name;
        this.content.appendChild(nameDiv);
        
        // Description
        const descDiv = document.createElement('div');
        descDiv.style.color = '#cccccc';
        descDiv.style.marginBottom = '15px';
        descDiv.style.lineHeight = '1.4';
        descDiv.textContent = item.description || 'No description available.';
        this.content.appendChild(descDiv);
        
        // Properties
        const propsDiv = document.createElement('div');
        propsDiv.style.color = '#aaaaaa';
        propsDiv.style.fontSize = '0.9em';
        
        const properties = [];
        
        // Basic properties (use effective weight for equipment)
        if (item.weight) {
            const effectiveWeight = item.getEffectiveWeight ? item.getEffectiveWeight() : item.weight;
            const totalWeight = item.getTotalWeight ? item.getTotalWeight() : (effectiveWeight * (item.quantity || 1));
            if (item.stackable && item.quantity > 1) {
                properties.push(`Weight: ${effectiveWeight.toFixed(1)} each (${totalWeight.toFixed(1)} total)`);
            } else {
                properties.push(`Weight: ${effectiveWeight.toFixed(1)}`);
            }
        }
        if (item.value) properties.push(`Value: ${item.value} gold`);
        if (item.material) properties.push(`Material: ${item.material}`);
        
        // Category and weapon type information
        if (item.category && item.getCategoryDisplayName) {
            try {
                properties.push(`Category: ${item.getCategoryDisplayName()}`);
            } catch (e) {
                console.warn('Error getting category display name:', e);
            }
        }
        if (item.weaponType && item.getWeaponTypeDisplayName) {
            try {
                const weaponTypeName = item.getWeaponTypeDisplayName();
                if (weaponTypeName) {
                    properties.push(`Weapon Type: ${weaponTypeName}`);
                }
            } catch (e) {
                console.warn('Error getting weapon type display name:', e);
            }
        }
        
        // Type-specific properties
        if (item.type === 'weapon') {
            if (item.damage && item.weaponDamage) {
                properties.push(`Damage: 1d${item.weaponDamage}+${item.damage}`);
            }
            if (item.toHitBonus) properties.push(`To Hit: ${item.toHitBonus >= 0 ? '+' : ''}${item.toHitBonus}`);
            if (item.penetration) properties.push(`Penetration: AP ${item.penetration}`);
        } else if (item.type === 'armor') {
            if (item.armorClassBonus) properties.push(`AC -${item.armorClassBonus}`);
            if (item.protection) properties.push(`DR: ${item.protection}`);
        } else if (item.type === 'shield') {
            // Shields only provide Block Chance
            if (item.blockChance) properties.push(`Block Chance: ${item.blockChance}%`);
        } else if (item.type === 'potion') {
            if (item.healDice) properties.push(`Healing: ${item.healDice} HP`);
            else if (item.healAmount) properties.push(`Healing: ${item.healAmount} HP`);
        } else if (item.type === 'food') {
            if (item.nutrition) properties.push(`Nutrition: ${item.nutrition}`);
            if (item.healAmount) properties.push(`Healing: ${item.healAmount} HP`);
            if (item.perishable !== undefined) {
                properties.push(`Perishable: ${item.perishable ? 'Yes' : 'No'}`);
            }
        }
        
        // Stackable properties
        if (item.stackable && item.quantity > 1) {
            properties.push(`Quantity: ${item.quantity}/${item.maxStackSize || 99}`);
        }
        
        // Quality
        if (item.quality) {
            const qualityNames = {
                'poor': 'Poor',
                'normal': 'Normal', 
                'fine': 'Fine',
                'masterwork': 'Masterwork',
                'legendary': 'Legendary'
            };
            properties.push(`Quality: ${qualityNames[item.quality] || item.quality}`);
        }
        
        // Durability (if equipment has durability system)
        if (item.getDurabilityState && item.maxDurability) {
            const durabilityRatio = item.currentDurability / item.maxDurability;
            const durabilityPercent = Math.floor(durabilityRatio * 100);
            const state = item.getDurabilityState();
            const stateNames = {
                'normal': 'Excellent',
                'cracked1': 'Good',
                'cracked2': 'Fair',
                'cracked3': 'Poor',
                'broken': 'Broken'
            };
            properties.push(`Condition: ${stateNames[state]} (${durabilityPercent}%)`);
        }
        
        // Enchantment
        if (item.enchantment && item.enchantment !== 0) {
            properties.push(`Enchantment: ${item.enchantment > 0 ? '+' : ''}${item.enchantment}`);
        }
        
        // Display properties
        properties.forEach(prop => {
            const propDiv = document.createElement('div');
            propDiv.textContent = prop;
            propsDiv.appendChild(propDiv);
        });
        
        this.content.appendChild(propsDiv);
        
        // Back instruction
        const backDiv = document.createElement('div');
        backDiv.style.marginTop = '20px';
        backDiv.style.color = '#808080';
        backDiv.style.fontSize = '0.9em';
        backDiv.style.textAlign = 'center';
        backDiv.style.padding = '5px';
        backDiv.style.border = '1px solid #555';
        backDiv.textContent = 'Press Escape to return to inventory';
        this.content.appendChild(backDiv);
        
        // Set up escape callback
        this.callback = () => {
            this.showInventory(player);
            return false; // Don't close the window, just go back to inventory
        };
        
        this.show();
    }
    
    showEquipment(player) {
        this.title.textContent = 'Equipment';
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = 'Enter slot key for details, w to wear/wield, T to take off, ESC to close';
        this.textInput.value = '';
        
        const equipment = player.equipment;
        const equipmentSlots = [
            { key: 'weapon', name: 'Weapon', keyHint: '(w)', letter: 'w' },
            { key: 'armor', name: 'Armor', keyHint: '(a)', letter: 'a' },
            { key: 'shield', name: 'Shield', keyHint: '(s)', letter: 's' },
            { key: 'helmet', name: 'Helmet', keyHint: '(h)', letter: 'h' },
            { key: 'gloves', name: 'Gloves', keyHint: '(g)', letter: 'g' },
            { key: 'boots', name: 'Boots', keyHint: '(b)', letter: 'b' },
            { key: 'ring1', name: 'Ring (L)', keyHint: '(r)', letter: 'r' },
            { key: 'ring2', name: 'Ring (R)', keyHint: '(1)', letter: '1' },
            { key: 'amulet', name: 'Amulet', keyHint: '(m)', letter: 'm' }
        ];
        
        equipmentSlots.forEach(slot => {
            const slotDiv = document.createElement('div');
            slotDiv.className = 'equipment-line';
            slotDiv.style.marginBottom = '5px';
            
            if (equipment[slot.key]) {
                const item = equipment[slot.key];
                
                // Use unified display logic from Player class
                const { qualityText, conditionText, statsText } = Player.getEquipmentDisplayInfo(item);
                
                // Add weight information like inventory (use effective weight for equipment)
                const effectiveWeight = item.getEffectiveWeight ? item.getEffectiveWeight() : item.weight;
                const totalWeight = item.getTotalWeight ? item.getTotalWeight() : (effectiveWeight * (item.quantity || 1));
                const weightText = totalWeight === 1 ? '1 lb' : `${totalWeight.toFixed(1)} lbs`;
                
                slotDiv.innerHTML = `<span style="color: #00ff00;">${slot.name} ${slot.keyHint}:</span> ${item.name}${qualityText}${conditionText}${statsText} (${weightText})`;
            } else {
                slotDiv.innerHTML = `<span style="color: #808080;">${slot.name} ${slot.keyHint}:</span> <span style="color: #404040;">None</span>`;
            }
            
            this.content.appendChild(slotDiv);
        });
        
        // Add help text
        const helpDiv = document.createElement('div');
        helpDiv.style.marginTop = '10px';
        helpDiv.style.color = '#808080';
        helpDiv.style.fontSize = '0.9em';
        helpDiv.innerHTML = 'Enter slot key for details<br>Press w to wear/wield, T to take off, ESC to close';
        this.content.appendChild(helpDiv);
        
        // Set up callback for equipment slot selection
        this.callback = (choice) => {
            if (choice && choice.length === 1) {
                const input = choice.toLowerCase().trim();
                
                // Find equipment slot by letter
                const slot = equipmentSlots.find(s => s.letter === input);
                if (slot && equipment[slot.key]) {
                    this.showEquipmentItemDetails(player, slot.key, equipment[slot.key]);
                    return false; // Keep window open for details
                }
                
                // Handle other commands
                if (input === 'w') {
                    // If weapon slot is empty, show equipment menu
                    if (!equipment['weapon']) {
                        this.hide();
                        setTimeout(() => this.showEquipmentMenu(player), 100);
                        return true; // Close window
                    } else {
                        // Show weapon details if equipped
                        this.showEquipmentItemDetails(player, 'weapon', equipment['weapon']);
                        return false; // Keep window open for details
                    }
                } else if (input === 't') {
                    this.hide();
                    // Trigger take off menu (could be implemented later)
                    return true; // Close window
                }
                
                // Invalid input, keep window open
                if (window.game && window.game.renderer) {
                    window.game.renderer.addLogMessage('Invalid slot key. Use w,a,s,h,g,b,r,1,m for details.');
                }
                return false;
            }
            return true; // Close on empty input
        };
        
        this.show();
        this.textInput.focus();
    }
    
    /**
     * Show detailed information for an equipped item
     */
    showEquipmentItemDetails(player, slotKey, item) {
        this.title.textContent = `Equipment Details: ${item.name}`;
        this.content.innerHTML = '';
        this.input.style.display = 'none';
        
        // Item name
        const nameDiv = document.createElement('div');
        nameDiv.style.fontSize = '1.1em';
        nameDiv.style.fontWeight = 'bold';
        nameDiv.style.color = '#ffffff';
        nameDiv.style.marginBottom = '10px';
        nameDiv.textContent = item.getDisplayName ? item.getDisplayName() : item.name;
        this.content.appendChild(nameDiv);
        
        // Equipment slot info
        const slotDiv = document.createElement('div');
        slotDiv.style.color = '#00ff00';
        slotDiv.style.marginBottom = '10px';
        slotDiv.style.fontWeight = 'bold';
        const slotNames = {
            'weapon': 'Weapon',
            'armor': 'Armor', 
            'shield': 'Shield',
            'helmet': 'Helmet',
            'gloves': 'Gloves',
            'boots': 'Boots',
            'ring1': 'Ring (Left)',
            'ring2': 'Ring (Right)',
            'amulet': 'Amulet'
        };
        slotDiv.textContent = `Equipped: ${slotNames[slotKey] || slotKey}`;
        this.content.appendChild(slotDiv);
        
        // Description
        const descDiv = document.createElement('div');
        descDiv.style.color = '#cccccc';
        descDiv.style.marginBottom = '15px';
        descDiv.style.lineHeight = '1.4';
        descDiv.textContent = item.description || 'No description available.';
        this.content.appendChild(descDiv);
        
        // Properties
        const propsDiv = document.createElement('div');
        propsDiv.style.color = '#aaaaaa';
        propsDiv.style.fontSize = '0.9em';
        
        const properties = [];
        
        // Basic properties (use effective weight for equipment)
        if (item.weight) {
            const effectiveWeight = item.getEffectiveWeight ? item.getEffectiveWeight() : item.weight;
            properties.push(`Weight: ${effectiveWeight.toFixed(1)}`);
        }
        if (item.value) properties.push(`Value: ${item.value} gold`);
        if (item.material) properties.push(`Material: ${item.material}`);
        
        // Category and weapon type information
        if (item.category && item.getCategoryDisplayName) {
            try {
                properties.push(`Category: ${item.getCategoryDisplayName()}`);
            } catch (e) {
                console.warn('Error getting category display name:', e);
            }
        }
        if (item.weaponType && item.getWeaponTypeDisplayName) {
            try {
                const weaponTypeName = item.getWeaponTypeDisplayName();
                if (weaponTypeName) {
                    properties.push(`Weapon Type: ${weaponTypeName}`);
                }
            } catch (e) {
                console.warn('Error getting weapon type display name:', e);
            }
        }
        
        // Type-specific properties
        if (item.type === 'weapon') {
            if (item.damage && item.weaponDamage) {
                properties.push(`Damage: 1d${item.weaponDamage}+${item.damage}`);
            }
            if (item.toHitBonus) properties.push(`To Hit: ${item.toHitBonus >= 0 ? '+' : ''}${item.toHitBonus}`);
            if (item.penetration) properties.push(`Penetration: AP ${item.penetration}`);
        } else if (item.type === 'armor') {
            if (item.armorClassBonus) properties.push(`AC -${item.armorClassBonus}`);
            if (item.protection) properties.push(`DR: ${item.protection}`);
        } else if (item.type === 'shield') {
            // Shields only provide Block Chance
            if (item.blockChance) properties.push(`Block Chance: ${item.blockChance}%`);
        }
        
        // Quality (always show for equipment)
        if (item.quality) {
            const qualityNames = {
                'poor': 'Poor',
                'normal': 'Normal', 
                'fine': 'Fine',
                'masterwork': 'Masterwork',
                'legendary': 'Legendary'
            };
            properties.push(`Quality: ${qualityNames[item.quality] || item.quality}`);
        }
        
        // Durability condition (if equipment has durability system)
        if (item.getDurabilityState && item.maxDurability) {
            const durabilityRatio = item.currentDurability / item.maxDurability;
            const durabilityPercent = Math.floor(durabilityRatio * 100);
            const state = item.getDurabilityState();
            const stateNames = {
                'normal': 'Excellent',
                'cracked1': 'Good',
                'cracked2': 'Fair',
                'cracked3': 'Poor',
                'broken': 'Broken'
            };
            properties.push(`Condition: ${stateNames[state]} (${durabilityPercent}%)`);
            
            // Show effective stats if damaged
            if (state !== 'normal') {
                const effectiveStats = item.getEffectiveStats();
                if (item.damage > 0 && effectiveStats.damage !== item.damage) {
                    properties.push(`Effective Damage: 1d${effectiveStats.weaponDamage}+${effectiveStats.damage} (reduced from base)`);
                }
                if (item.armorClassBonus > 0 && effectiveStats.armorClassBonus !== item.armorClassBonus) {
                    properties.push(`Effective AC: -${effectiveStats.armorClassBonus} (reduced from -${item.armorClassBonus})`);
                }
                if (item.protection > 0 && effectiveStats.protection !== item.protection) {
                    properties.push(`Effective DR: ${effectiveStats.protection} (reduced from ${item.protection})`);
                }
                if (item.blockChance > 0 && effectiveStats.blockChance !== item.blockChance) {
                    properties.push(`Effective BC: ${effectiveStats.blockChance}% (reduced from ${item.blockChance}%)`);
                }
            }
        }
        
        // Enchantment
        if (item.enchantment && item.enchantment !== 0) {
            properties.push(`Enchantment: ${item.enchantment > 0 ? '+' : ''}${item.enchantment}`);
        }
        
        // Status effect resistances
        if (item.resistances && Object.keys(item.resistances).length > 0) {
            const resistanceList = [];
            for (const [effect, value] of Object.entries(item.resistances)) {
                const effectNames = {
                    'bleeding': 'Bleeding',
                    'stunned': 'Stun',
                    'fractured': 'Fracture',
                    'poisoned': 'Poison',
                    'confused': 'Confusion',
                    'paralyzed': 'Paralysis'
                };
                const effectName = effectNames[effect] || effect;
                resistanceList.push(`${effectName} ${value}%`);
            }
            properties.push(`Resistances: ${resistanceList.join(', ')}`);
        }
        
        propsDiv.innerHTML = properties.join('<br>');
        this.content.appendChild(propsDiv);
        
        // Back button
        const backDiv = document.createElement('div');
        backDiv.style.marginTop = '15px';
        backDiv.style.color = '#808080';
        backDiv.style.fontSize = '0.9em';
        backDiv.innerHTML = 'Press any key to return to equipment list';
        this.content.appendChild(backDiv);
        
        // Handle any key press to go back
        const handleKeyPress = (e) => {
            document.removeEventListener('keydown', handleKeyPress);
            this.showEquipment(player);
        };
        
        document.addEventListener('keydown', handleKeyPress);
        
        this.show();
    }
    
        showEquipmentMenu(player) {
        this.title.textContent = 'Select item to wear/wield';
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = 'Enter letter (a-z) or Cancel';
        this.textInput.value = '';

        const inventory = player.getInventorySummary();
        const wearableTypes = ['weapon', 'armor', 'shield', 'helmet', 'gloves', 'boots', 'ring', 'amulet'];
        const validItems = inventory.filter(item => {
            const letter = item.charAt(0);
            const inventoryItem = player.getInventoryItem(letter);
            
            // Filter out equipped items and non-wearable items
            if (!inventoryItem || !wearableTypes.includes(inventoryItem.type)) {
                return false;
            }
            
            // Check if item is currently equipped
            for (const slot in player.equipment) {
                if (player.equipment[slot] === inventoryItem) {
                    return false; // Exclude equipped items
                }
            }
            
            return true;
        });

        if (validItems.length === 0) {
            this.content.innerHTML = '<div style="color: #808080; font-style: italic;">No wearable items in inventory.</div>';
            this.input.style.display = 'none';
        } else {
            validItems.forEach(item => {
                const itemDiv = document.createElement('div');
                itemDiv.textContent = item;
                this.content.appendChild(itemDiv);
            });
        }

        this.callback = (choice) => {
            if (choice && choice.length === 1) {
                const letter = choice.toLowerCase();
                const success = player.equipFromInventory(letter);
                if (success && window.game) {
                    // Process monster turns after equipment change
                    window.game.processMonsterTurns();
                    window.game.render();
                    
                    // Trigger autosave after equipment change
                    if (window.game.autosaveEnabled) {
                        window.game.saveGame();
                    }
                }
                return true; // Close menu after attempting to equip
            }
            return false; // Keep menu open if invalid input
        };

        this.show();
        this.textInput.focus();
    }
    
    showUnequipMenu(player) {
        this.title.textContent = 'Remove equipment';
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = 'Enter number or Cancel';
        this.textInput.value = '';
        
        const equipped = player.getEquipmentSummary();
        
        if (equipped.length === 0) {
            this.content.innerHTML = '<div style="color: #808080; font-style: italic;">You are not wearing anything.</div>';
            this.input.style.display = 'none';
        } else {
            equipped.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.textContent = `${index + 1} - ${item}`;
                this.content.appendChild(itemDiv);
            });
        }
        
        this.callback = (choice) => {
            if (choice && !isNaN(choice)) {
                const index = parseInt(choice) - 1;
                const slots = Object.keys(player.equipment);
                const equippedSlots = slots.filter(slot => player.equipment[slot]);
                
                if (index >= 0 && index < equippedSlots.length) {
                    const slot = equippedSlots[index];
                    const success = player.unequipToInventory(slot);
                    if (success && window.game) {
                        // Process monster turns after equipment change
                        window.game.processMonsterTurns();
                        window.game.render();
                        
                        // Trigger autosave after equipment change
                        if (window.game.autosaveEnabled) {
                            window.game.saveGame();
                        }
                    }
                    return true; // Close menu after attempting to unequip
                } else {
                    return false; // Keep menu open if invalid selection
                }
            }
            return false; // Keep menu open if invalid input
        };
        
        this.show();
        this.textInput.focus();
    }
    
    /**
     * Show food selection menu for eating
     */
    showFoodMenu(player) {
        this.title.textContent = 'Select food to eat';
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = 'Enter letter (a-z) or Cancel';
        this.textInput.value = '';

        const inventory = player.getInventorySummary();
        const foodItems = inventory.filter(item => {
            const letter = item.charAt(0);
            const inventoryItem = player.getInventoryItem(letter);
            
            // Filter for food items only
            if (!inventoryItem || (inventoryItem.type !== 'food' && !inventoryItem.nutrition)) {
                return false;
            }
            
            // Check if food is still edible (not rotten)
            if (typeof FoodItem !== 'undefined' && inventoryItem instanceof FoodItem && !inventoryItem.isEdible()) {
                return false;
            }
            
            return true;
        });

        if (foodItems.length === 0) {
            this.content.innerHTML = '<div style="color: #808080; font-style: italic;">No edible food in inventory.</div>';
            this.input.style.display = 'none';
        } else {
            // Display food items with nutrition info
            foodItems.forEach(item => {
                const letter = item.charAt(0);
                const inventoryItem = player.getInventoryItem(letter);
                const itemDiv = document.createElement('div');
                
                // Add nutrition and healing info
                let nutritionInfo = '';
                if (inventoryItem.nutrition) {
                    nutritionInfo += ` (${inventoryItem.nutrition} nutrition`;
                                    if (inventoryItem.healDice) {
                    nutritionInfo += `, ${inventoryItem.healDice} HP`;
                } else if (inventoryItem.healAmount && inventoryItem.healAmount > 0) {
                    nutritionInfo += `, +${inventoryItem.healAmount} HP`;
                }
                    nutritionInfo += ')';
                }
                
                // Show freshness for perishable items
                let freshnessInfo = '';
                let freshnessClass = '';
                if (typeof FoodItem !== 'undefined' && inventoryItem instanceof FoodItem && inventoryItem.perishable) {
                    if (inventoryItem.freshness >= 80) {
                        freshnessInfo = ' [fresh]';
                        freshnessClass = 'fresh';
                    } else if (inventoryItem.freshness >= 50) {
                        freshnessInfo = ' [aging]';
                        freshnessClass = 'aging';
                    } else if (inventoryItem.freshness >= 20) {
                        freshnessInfo = ' [stale]';
                        freshnessClass = 'stale';
                    } else {
                        freshnessInfo = ' [spoiling]';
                        freshnessClass = 'spoiling';
                    }
                }
                
                itemDiv.textContent = item + nutritionInfo + freshnessInfo;
                if (freshnessClass) {
                    itemDiv.setAttribute('data-fresh', freshnessClass);
                }
                this.content.appendChild(itemDiv);
            });
        }

        this.callback = (choice) => {
            if (choice && choice.length === 1) {
                const letter = choice.toLowerCase();
                const inventoryItem = player.getInventoryItem(letter);
                
                if (inventoryItem && (inventoryItem.type === 'food' || inventoryItem.nutrition)) {
                    // Pass the letter for reliable inventory removal
                    const success = player.eat(inventoryItem, letter);
                    if (success && window.game) {
                        // Process turn after eating
                        window.game.processTurn();
                        window.game.render();
                    }
                    return true; // Close menu after eating
                } else {
                    if (window.game && window.game.renderer) {
                        window.game.renderer.addLogMessage('That is not edible food!');
                    }
                    return false; // Keep menu open for invalid selection
                }
            }
            return false; // Keep menu open if invalid input
        };

        this.show();
        this.textInput.focus();
    }
    
    /**
     * Show potion selection menu for drinking
     */
    showPotionMenu(player) {
        this.title.textContent = 'Select potion to drink';
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = 'Enter letter (a-z) or Cancel';
        this.textInput.value = '';

        const inventory = player.getInventorySummary();
        const potionItems = inventory.filter(item => {
            const letter = item.charAt(0);
            const inventoryItem = player.getInventoryItem(letter);
            
            // Filter for potion items only (exclude food items)
            if (!inventoryItem || inventoryItem.type !== 'potion') {
                return false;
            }
            
            return true;
        });

        if (potionItems.length === 0) {
            this.content.innerHTML = '<div style="color: #808080; font-style: italic;">No potions in inventory.</div>';
            this.input.style.display = 'none';
        } else {
            // Display potion items with healing info
            potionItems.forEach(item => {
                const letter = item.charAt(0);
                const inventoryItem = player.getInventoryItem(letter);
                const itemDiv = document.createElement('div');
                
                // Add healing info
                let healingInfo = '';
                if (inventoryItem.healDice) {
                    healingInfo += ` (${inventoryItem.healDice} HP)`;
                } else if (inventoryItem.healAmount && inventoryItem.healAmount > 0) {
                    healingInfo += ` (+${inventoryItem.healAmount} HP)`;
                }
                
                itemDiv.textContent = item + healingInfo;
                this.content.appendChild(itemDiv);
            });
        }

        this.callback = (choice) => {
            if (choice && choice.length === 1) {
                const letter = choice.toLowerCase();
                const inventoryItem = player.getInventoryItem(letter);
                
                if (inventoryItem && inventoryItem.type === 'potion') {
                    // Pass the letter for reliable inventory removal
                    const success = player.drinkPotion(inventoryItem, letter);
                    if (success && window.game) {
                        // Process turn after drinking
                        window.game.processTurn();
                        window.game.render();
                    }
                    return true; // Close menu after drinking
                } else {
                    if (window.game && window.game.renderer) {
                        window.game.renderer.addLogMessage('That is not a potion!');
                    }
                    return false; // Keep menu open for invalid selection
                }
            }
            return false; // Keep menu open if invalid input
        };

        this.show();
        this.textInput.focus();
    }
    
    /**
     * Show item selection menu for picking up items
     */
    showItemSelectionMenu(items, playerX, playerY) {
        this.title.textContent = 'Pick up item (a-z to select, * for all, Escape to cancel)';
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = 'Enter letter (a-z) or * for all';
        this.textInput.value = '';
        
        if (items.length === 0) {
            this.content.innerHTML = '<div style="color: #808080; font-style: italic;">There is nothing here to pick up.</div>';
            this.input.style.display = 'none';
        } else {
            items.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'item-line';
                
                // Display item with quantity if stackable
                let displayText = item.getDisplayName ? item.getDisplayName() : item.name;
                if (item.stackable && item.quantity > 1) {
                    displayText = `${item.name} (${item.quantity})`;
                }
                
                const letter = String.fromCharCode(97 + index); // a, b, c, ...
                itemDiv.textContent = `${letter} - ${displayText}`;
                this.content.appendChild(itemDiv);
            });
            
            // Add instruction for picking up all items
            const instructionDiv = document.createElement('div');
            instructionDiv.style.color = '#808080';
            instructionDiv.style.fontSize = '0.9em';
            instructionDiv.style.marginTop = '10px';
            instructionDiv.textContent = 'Enter a letter (a-' + String.fromCharCode(97 + items.length - 1) + ') or "*" to pick up all items';
            this.content.appendChild(instructionDiv);
        }
        
        this.callback = (choice) => {
            if (choice === '*') {
                // Pick up all items
                this.pickupAllItems(items, playerX, playerY);
                return true; // Close menu after picking up all items
            } else if (choice && /^[a-z]$/.test(choice)) {
                const index = choice.charCodeAt(0) - 97; // a=0, b=1, c=2, ...
                
                if (index >= 0 && index < items.length) {
                    const selectedItem = items[index];
                    if (window.game && window.game.pickupSpecificItem) {
                        const success = window.game.pickupSpecificItem(selectedItem, playerX, playerY);
                        if (success) {
                            // Refresh the item list and continue
                            this.refreshItemSelectionMenu(playerX, playerY);
                            return false; // Keep menu open for more selections
                        }
                    }
                    return false; // Keep menu open if pickup failed
                } else {
                    if (window.game && window.game.renderer) {
                        window.game.renderer.addLogMessage('No such item.');
                    }
                    return false; // Keep menu open for invalid selection
                }
            }
            return false; // Keep menu open if invalid input
        };
        
        this.show();
        this.textInput.focus();
    }
    
    /**
     * Refresh item selection menu with current items at position
     */
    refreshItemSelectionMenu(playerX, playerY) {
        if (!window.game || !window.game.itemManager) return;
        
        const currentItems = window.game.itemManager.getItemsAt(playerX, playerY);
        
        if (currentItems.length === 0) {
            // No more items, close menu
            if (window.game.renderer) {
                window.game.renderer.addLogMessage('You have picked up everything here.');
            }
            this.close();
            return;
        }
        
        // Update the menu with remaining items
        this.showItemSelectionMenu(currentItems, playerX, playerY);
        
        // Clear input for fresh selection
        this.textInput.value = '';
    }
    
    /**
     * Pick up all items at the position
     */
    pickupAllItems(items, playerX, playerY) {
        if (!window.game) return;
        
        let pickupCount = 0;
        let failedCount = 0;
        
        // Create a copy of items array since we'll be modifying the original
        const itemsCopy = [...items];
        
        for (const item of itemsCopy) {
            const success = window.game.pickupSpecificItem(item, playerX, playerY);
            if (success) {
                pickupCount++;
            } else {
                failedCount++;
            }
        }
        
        // Report results
        if (window.game.renderer) {
            if (pickupCount > 0 && failedCount === 0) {
                window.game.renderer.addLogMessage(`You pick up all ${pickupCount} items.`);
            } else if (pickupCount > 0 && failedCount > 0) {
                window.game.renderer.addLogMessage(`You pick up ${pickupCount} items. ${failedCount} items couldn't be picked up.`);
            } else if (failedCount > 0) {
                window.game.renderer.addLogMessage(`You couldn't pick up any items. Your pack might be full.`);
            }
        }
    }
    
    selectItem(index) {
        // Remove previous selection
        const prevSelected = this.content.querySelector('.selected');
        if (prevSelected) {
            prevSelected.classList.remove('selected');
        }
        
        // Select new item
        const items = this.content.querySelectorAll('.item-line');
        if (items[index]) {
            items[index].classList.add('selected');
            this.selectedIndex = index;
        }
    }
    
    handleConfirm() {
        const value = this.textInput.value.trim();
        if (this.callback) {
            const shouldClose = this.callback(value);
            // Close unless callback explicitly returns false
            if (shouldClose !== false) {
                this.close();
            }
        } else {
            this.close();
        }
    }
    
    show() {
        this.isOpen = true;
        this.overlay.style.display = 'flex';
    }
    
    /**
     * Show custom dialog with title and content
     */
    showDialog(title, content, callback = null, keyHandler = null) {
        this.title.textContent = title;
        this.content.innerHTML = content;
        this.input.style.display = 'none'; // Hide input for dialog
        this.callback = callback;
        this.keyHandler = keyHandler; // Store custom key handler
        this.show();
    }
    
    close() {
        this.isOpen = false;
        this.overlay.style.display = 'none';
        this.callback = null;
        this.keyHandler = null; // Clear key handler
        this.selectedIndex = -1;
        this.textInput.value = '';
    }
    
    /**
     * Show drop menu for dropping items from inventory
     */
    showDropMenu(player) {
        this.title.textContent = 'Drop item (a-z to select, Enter to confirm, Escape to cancel)';
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = 'Enter letter (a-z) or Cancel';
        this.textInput.value = '';
        
        const inventory = player.getInventorySummary();
        
        if (inventory.length === 0) {
            this.content.innerHTML = '<div style="color: #808080; font-style: italic;">Your pack is empty.</div>';
            this.input.style.display = 'none';
        } else {
            inventory.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'item-line';
                
                // Display item with quantity if stackable
                const inventoryItem = player.inventory[index];
                let displayText = inventoryItem.getDisplayName ? inventoryItem.getDisplayName() : inventoryItem.name;
                if (inventoryItem.stackable && inventoryItem.quantity > 1) {
                    displayText = `${inventoryItem.name} (${inventoryItem.quantity})`;
                }
                
                itemDiv.textContent = item; // Use the formatted inventory text
                this.content.appendChild(itemDiv);
            });
        }
        
        this.callback = (choice) => {
            if (choice && choice.length === 1) {
                const letter = choice.toLowerCase();
                const index = letter.charCodeAt(0) - 97; // a=0, b=1, etc.
                
                if (index >= 0 && index < player.inventory.length) {
                    const selectedItem = player.inventory[index];
                    
                    // Check if item is stackable and has more than 1 quantity
                    if (selectedItem.stackable && selectedItem.quantity > 1) {
                        // Show quantity selection menu - don't close drop menu yet
                        this.showQuantitySelectionMenu(selectedItem, index, 'drop');
                        return false; // Keep current menu structure, quantity menu will handle closing
                    } else {
                        // Drop single item directly
                        if (window.game && window.game.dropSpecificItem) {
                            const success = window.game.dropSpecificItem(selectedItem, index);
                            if (success) {
                                // Return to drop menu with updated inventory
                                this.refreshDropMenu(player);
                                return false; // Don't close, we're showing the updated drop menu
                            }
                        }
                        return true; // Close menu if drop failed
                    }
                } else {
                    if (window.game && window.game.renderer) {
                        window.game.renderer.addLogMessage('No such item.');
                    }
                    return false; // Don't close on invalid selection
                }
            }
            return false; // Don't close on empty or invalid input
        };
        
        this.show();
        this.textInput.focus();
    }
    
    /**
     * Refresh drop menu with current player inventory
     */
    refreshDropMenu(player) {
        
        // Clear and rebuild content
        this.content.innerHTML = '';
        const inventory = player.getInventorySummary();
        
        if (inventory.length === 0) {
            this.content.innerHTML = '<div style="color: #808080; font-style: italic;">Your pack is empty.</div>';
            this.input.style.display = 'none';
        } else {
            this.input.style.display = 'flex';
            inventory.forEach((item, index) => {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'item-line';
                
                // Display item with quantity if stackable
                const inventoryItem = player.inventory[index];
                let displayText = inventoryItem.getDisplayName ? inventoryItem.getDisplayName() : inventoryItem.name;
                if (inventoryItem.stackable && inventoryItem.quantity > 1) {
                    displayText = `${inventoryItem.name} (${inventoryItem.quantity})`;
                }
                
                itemDiv.textContent = item; // Use the formatted inventory text
                this.content.appendChild(itemDiv);
            });
        }
        
        // Clear input for fresh selection
        this.textInput.value = '';
    }
    
    /**
     * Show quantity selection menu for stackable items
     */
    showQuantitySelectionMenu(item, itemIndex, action = 'drop') {
        
        // Clear any existing input value before setting up the new menu
        this.textInput.value = '';
        
        this.title.textContent = `${action.charAt(0).toUpperCase() + action.slice(1)} how many ${item.name}? (1-${item.quantity}, * for all)`;
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = `Enter quantity (1-${item.quantity}) or * for all`;
        
        // Show item info
        const itemInfo = document.createElement('div');
        itemInfo.className = 'item-line';
        itemInfo.textContent = `${item.getDisplayName ? item.getDisplayName() : item.name} - Available: ${item.quantity}`;
        this.content.appendChild(itemInfo);
        
        // Show instructions
        const instructions = document.createElement('div');
        instructions.style.color = '#808080';
        instructions.style.fontSize = '0.9em';
        instructions.style.marginTop = '10px';
        instructions.textContent = 'Enter a number (1-' + item.quantity + ') or "*" for all items';
        this.content.appendChild(instructions);
        
        this.callback = (choice) => {
            if (!choice) {
                return false; // Keep menu open
            }
            
            let quantity;
            
            if (choice === '*') {
                // Drop all items
                quantity = item.quantity;
            } else {
                // Parse numeric input
                const numChoice = parseInt(choice, 10);
                if (isNaN(numChoice) || numChoice < 1 || numChoice > item.quantity) {
                    if (window.game && window.game.renderer) {
                        window.game.renderer.addLogMessage(`Invalid quantity. Please enter 1-${item.quantity} or *.`);
                    }
                    return false; // Keep menu open for retry
                }
                quantity = numChoice;
            }
            
            // Execute the action with specified quantity
            if (action === 'drop' && window.game && window.game.dropSpecificItem) {
                const success = window.game.dropSpecificItem(item, itemIndex, quantity);
                if (success) {
                    // Return to drop menu with updated inventory
                    this.showDropMenu(window.game.player);
                    return false; // Don't close, we're showing the updated drop menu
                }
            }
            // Future: Add other actions like 'use', 'sell', etc.
            
            return true; // Close menu after successful action
        };
        
        this.show();
        
        // Use setTimeout to ensure all events are settled before focusing
        setTimeout(() => {
            this.textInput.value = ''; // Clear again just to be sure
            this.textInput.focus();
        }, 100);
    }
}

// Global sub-window instance
window.subWindow = new SubWindow(); 