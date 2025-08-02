/**
 * Utility function for dice rolling
 * @param {string} diceString - Dice notation like "2d8+3" or "1d4"
 * @returns {number} The rolled result
 */
function rollDice(diceString) {
    if (typeof diceString === 'number') {
        return diceString; // Backward compatibility for fixed values
    }
    
    if (!diceString || typeof diceString !== 'string') {
        return 0;
    }
    
    // Parse dice notation: "2d8+3", "1d4", "d6", etc.
    const diceRegex = /^(\d*)?d(\d+)([+-]\d+)?$/i;
    const match = diceString.toLowerCase().match(diceRegex);
    
    if (!match) {
        // Try parsing as simple number
        const num = parseInt(diceString);
        return isNaN(num) ? 0 : num;
    }
    
    const numDice = parseInt(match[1]) || 1; // Default to 1 if not specified
    const dieSize = parseInt(match[2]);
    const modifier = parseInt(match[3]) || 0;
    
    let total = 0;
    for (let i = 0; i < numDice; i++) {
        total += Math.floor(Math.random() * dieSize) + 1;
    }
    
    return total + modifier;
}

/**
 * Player class for Roguelike Game
 * Handles player stats, movement, combat, and inventory
 */
class Player {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
        
        // Base stats
        this.level = 1; // Start at level 1
        this.hp = 10; // Will be updated after ability scores
        this.maxHp = 10;
        this.mp = 0;
        this.maxMp = 0;
        this.exp = 0;
        this.expToNext = 15; // Set higher for testing stability
        
        // Combat stats (Basic starting character)
        this.strength = 14;      // Good starting strength
        this.dexterity = 12;     // Average dexterity
        this.constitution = 14;  // Good constitution for HP
        this.intelligence = 10;  // Average intelligence
        this.wisdom = 11;        // Average wisdom
        this.charisma = 10;      // Average charisma
        
        // Derived stats (Classic Roguelike - AD&D style)
        this.toHit = this.getClassicModifier(this.strength) + this.level; // STR modifier + level
        this.armorClass = 10 - this.getClassicModifier(this.dexterity); // Lower AC is better
        this.damage = this.getClassicModifier(this.strength); // STR modifier for damage
        this.weaponDamage = 4; // Basic starting weapon (d4 dagger)
        
        // Game state
        this.turnCount = 0;
        
        // Regeneration system
        this.lastRegenTurn = 0;
        this.regenInterval = 10; // Heal every 10 turns
        this.regenAmount = 1; // Heal 1 HP per interval
        
        // Speed system (classic roguelike energy system)
        this.baseSpeed = 100; // Base speed (100 = normal speed)
        this.speed = 100; // Current effective speed (modified by hunger, equipment, etc.)
        this.energy = 100; // Start with full energy to act immediately
        this.energyToAct = 100; // Energy needed to take an action
        
        // Weight/Encumbrance system (NetHack-style)
        this.currentWeight = 0; // Current total weight carried
        this.maxWeight = 0; // Maximum weight capacity (calculated from STR)
        
        // Hunger system (Basic starting level)
        this.nutrition = 800; // Start with normal hunger level
        this.maxNutrition = 2000; // Maximum nutrition (Satiated threshold)
        this.hungerTimer = 0; // For periodic hunger checks
        
        // Equipment system
        this.equipment = {
            weapon: null,
            armor: null,
            shield: null,
            helmet: null,
            gloves: null,
            boots: null,
            ring: null,
            amulet: null
        };
        
        // Inventory system
        this.inventory = [];
        this.maxInventorySize = 26; // A-Z for inventory slots
        
        // Calculate initial HP/MP based on ability scores
        this.calculateInitialStats();
        
        // Calculate weight capacity based on strength
        this.calculateWeightCapacity();
        
        // Initialize with basic equipment
        this.initializeEquipment();
        
        // Add some test items to inventory
        this.addTestItems();
    }
    
    /**
     * Roll 3d6 for ability scores (Classic Roguelike)
     */
    rollStat() {
        return Math.floor(Math.random() * 6) + 1 +
               Math.floor(Math.random() * 6) + 1 +
               Math.floor(Math.random() * 6) + 1;
    }
    
    /**
     * Get classic AD&D style ability modifier
     */
    getClassicModifier(stat) {
        if (stat <= 3) return -3;
        if (stat <= 5) return -2;
        if (stat <= 8) return -1;
        if (stat <= 12) return 0;
        if (stat <= 15) return 1;
        if (stat <= 17) return 2;
        if (stat >= 18) return 3;
        return 0;
    }
    
    /**
     * Calculate initial HP/MP based on classic rules
     */
    calculateInitialStats() {
        // WARRIOR TEST BUILD: d10 hit die + CON modifier per level
        const conModifier = this.getClassicModifier(this.constitution);
        
        // Level 3 Warrior with maximum hit dice
        // Level 1: 10 + CON mod (max hit die)
        // Level 2: +10 + CON mod (max hit die) 
        // Level 3: +10 + CON mod (max hit die)
        this.maxHp = (10 + conModifier) * this.level; // Warrior gets max hit die per level for testing
        this.hp = this.maxHp; // Start at full health
        
        // MP based on INT (warriors have minimal magic)
        const intModifier = this.getClassicModifier(this.intelligence);
        this.maxMp = Math.max(0, intModifier);
        this.mp = this.maxMp;
        
        // WARRIOR TEST BUILD logging
        console.log(`🛡️ Warrior Stats Calculated:`);
        console.log(`HP: ${this.hp}/${this.maxHp} (CON mod: +${conModifier})`);
        console.log(`DEX: ${this.dexterity}, DEX mod: ${this.getClassicModifier(this.dexterity)}`);
        console.log(`AC: ${this.armorClass} (10 - DEX mod ${this.getClassicModifier(this.dexterity)})`);
        console.log(`To Hit: +${this.toHit} (STR mod: +${this.getClassicModifier(this.strength)} + Level ${this.level})`);
        console.log(`Damage: +${this.damage} (STR mod), Weapon: ${this.weaponDamage}`);
        console.log(`Weight Capacity: ${this.currentWeight}/${this.maxWeight} lbs`);
    }
    
    /**
     * Move the player to a new position
     */
    moveTo(x, y) {
        this.x = x;
        this.y = y;
        this.turnCount++;
        
        // Update speed after movement (hunger affects speed)
        this.updateEffectiveSpeed();
        
        // Note: In NetHack, movement itself doesn't consume nutrition
        // Nutrition is consumed per-turn in processHunger()
        
        this.checkRegeneration();
    }
    
    /**
     * Try to move in a direction - with combat, door interaction
     */
    tryMove(dx, dy, dungeon, monsterSpawner) {
        // Cannot move if dead
        if (this.hp <= 0) {
            return false;
        }
        
        // Check for movement restrictions due to weight
        if (!this.canMove()) {
            return false;
        }
        
        const newX = this.x + dx;
        const newY = this.y + dy;
        
        // Check for monster at target position
        const monster = monsterSpawner.getMonsterAt(newX, newY);
        if (monster) {
            this.attackMonster(monster);
            return true; // Turn consumed by attacking
        }
        
        // Check for door interaction
        if (dungeon.hasDoor(newX, newY)) {
            return this.interactWithDoor(newX, newY, dungeon);
        }
        
        // Check if the position is walkable
        if (dungeon.isWalkable(newX, newY)) {
            this.moveTo(newX, newY);
            // Generate movement sound
            if (window.game && window.game.noiseSystem) {
                window.game.noiseSystem.makeSound(this.x, this.y, window.game.noiseSystem.getPlayerActionSound('MOVE'));
            }
            return true;
        }
        
        return false;
    }
    
    /**
     * Interact with door - open/close/walk through
     */
    interactWithDoor(x, y, dungeon) {
        const doorState = dungeon.getDoorState(x, y);
        
        if (doorState === 'open') {
                    // Walk through open door
        this.moveTo(x, y);
        if (window.game && window.game.renderer) {
            window.game.renderer.addLogMessage('You walk through the open door.');
        }
        // Generate movement sound
        if (window.game && window.game.noiseSystem) {
            window.game.noiseSystem.makeSound(this.x, this.y, window.game.noiseSystem.getPlayerActionSound('MOVE'));
        }
        return true;
        } else if (doorState === 'closed') {
            // Try to open closed door
            return this.openDoor(x, y, dungeon);
        } else if (doorState === 'locked') {
            // Try to open locked door (future: need keys)
            if (window.game && window.game.renderer) {
                window.game.renderer.addLogMessage('The door is locked.');
            }
            return true; // Turn consumed by trying
        }
        
        return false;
    }
    
    /**
     * Open a door
     */
    openDoor(x, y, dungeon) {
        // Simple door opening - always succeeds for now
        // Future: add skill checks, stuck doors, etc.
        
        if (dungeon.setDoorState(x, y, 'open')) {
            if (window.game && window.game.renderer) {
                window.game.renderer.addLogMessage('You open the door.');
            }
            // Generate door opening sound
            if (window.game && window.game.noiseSystem) {
                window.game.noiseSystem.makeSound(x, y, window.game.noiseSystem.getPlayerActionSound('DOOR_OPEN'));
            }
            return true; // Turn consumed
        }
        
        return false;
    }
    
    /**
     * Close a door (manual action)
     */
    closeDoor(x, y, dungeon) {
        const doorState = dungeon.getDoorState(x, y);
        
        if (doorState === 'open') {
            // Check if there's a monster on the door
            const monster = window.game && window.game.monsterSpawner.getMonsterAt(x, y);
            if (monster) {
                // Door slam attack - THAC0 style hit check
                const naturalRoll = Math.floor(Math.random() * 20) + 1; // Pure d20 roll (1-20)
                const requiredRoll = monster.armorClass - this.toHit; // THAC0 calculation
                
                if (window.game && window.game.renderer) {
                    window.game.renderer.addBattleLogMessage(`You slam the door on ${monster.name}... (${naturalRoll} vs ${requiredRoll}+ needed, AC ${monster.armorClass})`);
                }
                
                if (naturalRoll >= requiredRoll) {
                    // Hit! Calculate door damage
                    const doorDamage = this.calculateDoorDamage();
                    let finalDamage = doorDamage;
                    
                    // Critical hit check (natural 20 only)
                    if (naturalRoll === 20) {
                        finalDamage = doorDamage * 2;
                        if (window.game && window.game.renderer) {
                            window.game.renderer.addBattleLogMessage(`Critical door slam! ${finalDamage} damage!`, 'victory');
                        }
                    } else {
                        if (window.game && window.game.renderer) {
                            window.game.renderer.addBattleLogMessage(`The door crushes for ${finalDamage} damage!`);
                        }
                    }
                    
                    monster.takeDamage(finalDamage);
                    
                    if (!monster.isAlive) {
                        if (window.game && window.game.renderer) {
                            window.game.renderer.addBattleLogMessage(`You defeat the ${monster.name}!`, 'victory');
                        }
                        this.gainExp(monster.expValue);
                    }
                    
                    // Generate door slam sound (very loud)
                    if (window.game && window.game.noiseSystem) {
                        window.game.noiseSystem.makeSound(x, y, window.game.noiseSystem.getPlayerActionSound('DOOR_SLAM'));
                    }
                        } else {
            // Miss
            if (window.game && window.game.renderer) {
                window.game.renderer.addBattleLogMessage(`The door slams shut, but ${monster.name} dodges!`);
            }
            
            // Generate door slam sound even on miss (still loud)
            if (window.game && window.game.noiseSystem) {
                window.game.noiseSystem.makeSound(x, y, window.game.noiseSystem.getPlayerActionSound('DOOR_SLAM'));
            }
        }
                
                // Remove the door after using it as a weapon (regardless of hit/miss)
                if (dungeon.removeDoor(x, y)) {
                    if (window.game && window.game.renderer) {
                        window.game.renderer.addLogMessage('The door is destroyed from the impact!');
                    }
                }
                
                // Door slam is exhausting (affected by encumbrance)
                const encumbrance = this.getEncumbranceLevel();
                const doorSlamCost = this.getDoorSlamHungerCost(encumbrance);
                this.consumeNutrition(doorSlamCost);
                
                return true; // Turn consumed
            }
            
            // No monster, close normally
                    if (dungeon.setDoorState(x, y, 'closed')) {
            if (window.game && window.game.renderer) {
                window.game.renderer.addLogMessage('You close the door.');
            }
            // Generate door closing sound
            if (window.game && window.game.noiseSystem) {
                window.game.noiseSystem.makeSound(x, y, window.game.noiseSystem.getPlayerActionSound('DOOR_CLOSE'));
            }
            return true; // Turn consumed
        }
        } else if (doorState === 'closed') {
            if (window.game && window.game.renderer) {
                window.game.renderer.addLogMessage('The door is already closed.');
            }
        }
        
        return false;
    }
    
    /**
     * Calculate door slam damage (similar to weapon attack)
     */
    calculateDoorDamage() {
        // Door damage: 2d6 + STR modifier (heavier than normal weapons)
        const baseDamage = this.getClassicModifier(this.strength); // STR modifier
        const doorDie = 6; // d6 weapon damage
        const doorDamage = baseDamage + Math.floor(Math.random() * doorDie) + 1 + Math.floor(Math.random() * doorDie) + 1; // 2d6
        return Math.max(1, doorDamage); // Minimum 1 damage
    }
    
    /**
     * Add basic starting items (minimal setup)
     */
    addTestItems() {
        // Add basic starting items using EquipmentManager
        if (typeof EquipmentManager !== 'undefined') {
            // Add 1 food ration
            if (typeof FoodItem !== 'undefined' && typeof FOOD_TYPES !== 'undefined') {
                const ration = new FoodItem(FOOD_TYPES.ration.name, FOOD_TYPES.ration);
                this.addToInventory(ration);
            }
            
            // Add 1 healing potion
            const healingPotion = EquipmentManager.createEquipment('potions', 'healingPotion');
            if (healingPotion) {
                this.addToInventory(healingPotion);
            }
            
            console.log('🎯 BASIC STARTING SETUP 🎯');
            console.log('Level: 1');
            console.log('Equipment: Dagger only');
            console.log('Items: 1 food ration, 1 healing potion');
        } else {
            console.error('EquipmentManager not available - falling back to basic items');
            // Fallback to basic items if EquipmentManager is not loaded
            this.addToInventory({
                name: 'Basic Healing Potion',
                type: 'potion',
                healAmount: 10,
                weight: 8,
                description: 'A basic healing potion.'
            });
        }
    }
    
    /**
     * Add energy to player based on speed
     */
    gainEnergy() {
        this.energy += this.speed;
    }
    
    /**
     * Check if player has enough energy to act
     */
    canAct() {
        return this.energy >= this.energyToAct;
    }
    
    /**
     * Spend energy for taking an action
     */
    spendEnergy(amount = null) {
        const cost = amount || this.energyToAct;
        this.energy = Math.max(0, this.energy - cost);
    }
    
    /**
     * Take damage from an attack (Classic Roguelike)
     */
    takeDamage(damage) {
        const oldHpPercent = this.hp / this.maxHp;
        this.hp -= damage;
        const newHpPercent = this.hp / this.maxHp;
        
        // Add HP status to battle log (damage amount shown by attacker)
        if (window.game && window.game.renderer) {
            const hpDisplay = this.hp <= 0 ? '0' : this.hp;
            window.game.renderer.addBattleLogMessage(`You: ${hpDisplay}/${this.maxHp} HP`, 'damage');
        }
        
        if (this.hp <= 0) {
            this.hp = 0;
            if (window.game && window.game.renderer) {
                window.game.renderer.addBattleLogMessage('You have died!', 'death');
            }
            return true; // Player died
        }
        
        // Update combat stats if HP threshold changed (affects to-hit)
        const oldWounded = oldHpPercent < 0.5;
        const newWounded = newHpPercent < 0.5;
        const oldSeverelyWounded = oldHpPercent < 0.25;
        const newSeverelyWounded = newHpPercent < 0.25;
        
        if (oldWounded !== newWounded || oldSeverelyWounded !== newSeverelyWounded) {
            this.updateCombatStats();
        }
        
        return false; // Player survived
    }
    
    /**
     * Attack a monster (Classic Roguelike - THAC0 style)
     */
    attackMonster(monster) {
        // THAC0-style hit check: need to roll >= (target AC - to hit bonus)
        const naturalRoll = Math.floor(Math.random() * 20) + 1; // Pure d20 roll (1-20)
        const requiredRoll = monster.armorClass - this.toHit; // THAC0 calculation
        
        if (window.game && window.game.renderer) {
            const breakdown = this.getStats().toHitBreakdown;
            const modifierText = this.toHit !== this.baseToHit ? 
                ` (base+${this.baseToHit}, mods${this.toHit - this.baseToHit})` : '';
            window.game.renderer.addBattleLogMessage(`You attack ${monster.name}... (${naturalRoll} vs ${requiredRoll}+ needed, AC ${monster.armorClass}, hit+${this.toHit}${modifierText})`);
        }
        
        if (naturalRoll >= requiredRoll) {
            // Hit! Calculate damage
            const diceRoll = Math.floor(Math.random() * this.weaponDamage) + 1;
            const baseDamage = this.baseDamage + diceRoll;
            let finalDamage = baseDamage;
            
            // Critical hit check (natural 20 only - not modified roll)
            if (naturalRoll === 20) {
                finalDamage = baseDamage * 2;
                if (window.game && window.game.renderer) {
                    window.game.renderer.addBattleLogMessage(`Critical hit! ${finalDamage} damage!`, 'victory');
                }
            } else {
                if (window.game && window.game.renderer) {
                    window.game.renderer.addBattleLogMessage(`Hit! ${finalDamage} damage!`);
                }
            }
            
            monster.takeDamage(finalDamage);
            
            if (!monster.isAlive) {
                if (window.game && window.game.renderer) {
                    window.game.renderer.addBattleLogMessage(`You defeat the ${monster.name}!`, 'victory');
                }
                this.gainExp(monster.expValue);
            }
            
            // Generate combat sound
            if (window.game && window.game.noiseSystem) {
                window.game.noiseSystem.makeSound(this.x, this.y, window.game.noiseSystem.getPlayerActionSound('ATTACK'));
            }
            
            // Combat consumes extra nutrition (affected by encumbrance)
            // Attacking consumes nutrition (strenuous activity)
            // NetHack: combat is more taxing than normal actions
            const encumbrance = this.getEncumbranceLevel();
            const combatCost = this.getCombatHungerCost(encumbrance);
            this.consumeNutrition(combatCost);
        } else {
            // Miss
            if (window.game && window.game.renderer) {
                window.game.renderer.addBattleLogMessage(`Miss!`);
            }
            
            // Generate combat sound even on miss
            if (window.game && window.game.noiseSystem) {
                window.game.noiseSystem.makeSound(this.x, this.y, window.game.noiseSystem.getPlayerActionSound('ATTACK'));
            }
            
            // Even missed attacks consume nutrition (affected by encumbrance)
            const encumbrance = this.getEncumbranceLevel();
            const combatCost = this.getCombatHungerCost(encumbrance);
            this.consumeNutrition(combatCost);
        }
    }
    
    /**
     * Heal the player
     */
    heal(amount) {
        // Ensure healing amount is always an integer
        const integerAmount = Math.floor(amount);
        const oldHpPercent = this.hp / this.maxHp;
        const healedAmount = Math.min(integerAmount, this.maxHp - this.hp);
        this.hp += healedAmount;
        const newHpPercent = this.hp / this.maxHp;
        
        // Update combat stats if HP threshold changed (affects to-hit)
        const oldWounded = oldHpPercent < 0.5;
        const newWounded = newHpPercent < 0.5;
        const oldSeverelyWounded = oldHpPercent < 0.25;
        const newSeverelyWounded = newHpPercent < 0.25;
        
        if (oldWounded !== newWounded || oldSeverelyWounded !== newSeverelyWounded) {
            this.updateCombatStats();
        }
        
        console.log(`You heal ${healedAmount} HP! HP: ${this.hp}/${this.maxHp}`);
        return healedAmount;
    }
    
    /**
     * Gain experience points
     */
    gainExp(amount) {
        this.exp += amount;
        
        while (this.exp >= this.expToNext) {
            this.levelUp();
        }
    }
    
    /**
     * Level up the player
     */
    levelUp() {
        this.level++;
        this.exp -= this.expToNext;
        this.expToNext = Math.floor(this.expToNext * 1.5); // Standard progression
        
        // Classic Roguelike level up
        const conModifier = this.getClassicModifier(this.constitution);
        const hpIncrease = Math.floor(Math.random() * 8) + 1 + conModifier; // d8 + CON mod
        const intModifier = this.getClassicModifier(this.intelligence);
        const mpIncrease = Math.max(0, intModifier); // MP increase based on INT
        
        this.maxHp += Math.max(1, hpIncrease); // Minimum 1 HP per level
        this.maxMp += mpIncrease; // MP based on INT
        this.hp = this.maxHp; // Full heal on level up
        this.mp = this.maxMp;
        
        // Improve regeneration with level
        this.regenInterval = Math.max(5, 15 - this.level); // Faster regen at higher levels
        
        // Classic roguelike: no automatic stat increases
        // Stats improve through magical means (potions, equipment, etc.)
        
        // Update derived stats with equipment
        this.updateCombatStats();
        
        console.log(`Level up! You are now level ${this.level}!`);
        console.log(`HP increased by ${hpIncrease}, MP increased by ${mpIncrease}`);
    }
    

    
    /**
     * Wait/rest - classic roguelike style
     */
    rest() {
        // Cannot rest if dead
        if (this.hp <= 0) {
            return false;
        }
        
        console.log('You wait.');
        this.turnCount++;
        
        // Resting consumes minimal nutrition (NetHack: waiting uses no extra nutrition)
        // this.consumeNutrition(0); // Nutrition handled by processHunger()
        
        this.checkRegeneration();
        return true;
    }
    
    /**
     * Check and process natural regeneration (hunger-dependent)
     */
    checkRegeneration() {
        if (this.hp >= this.maxHp) return; // Already at full health
        
        // Hunger affects regeneration (classic roguelike mechanic)
        const hungerStatus = this.getHungerStatus();
        let canRegenerate = true;
        let regenMultiplier = 1;
        
        switch (hungerStatus.level) {
            case 'OVERSTUFFED':
                regenMultiplier = 0.5; // Slow healing when overstuffed (digestive stress)
                break;
            case 'BLOATED':
                regenMultiplier = 0.75; // Reduced healing when bloated
                break;
            case 'SATIATED':
                regenMultiplier = 2; // Faster healing when well-fed
                break;
            case 'WELL_FED':
                regenMultiplier = 1.5; // Good healing when well-fed
                break;
            case 'NORMAL':
                regenMultiplier = 1; // Normal healing
                break;
            case 'PECKISH':
                regenMultiplier = 0.75; // Slightly slower healing when peckish
                break;
            case 'HUNGRY':
                canRegenerate = false; // No healing when hungry
                break;
            case 'WEAK':
            case 'FAINTING':
                canRegenerate = false; // No healing when starving
                break;
        }
        
        if (!canRegenerate) return;
        
        // Check if enough turns have passed since last regeneration
        if (this.turnCount - this.lastRegenTurn >= this.regenInterval) {
            let healAmount = 0;
            
            // Probability-based healing to avoid fractional HP
            if (regenMultiplier >= 1.0) {
                // Fast healing: guaranteed 1 HP + chance for bonus
                healAmount = 1;
                const bonusChance = (regenMultiplier - 1.0);
                if (Math.random() < bonusChance) {
                    healAmount += 1; // Bonus HP for well-fed states
                }
            } else {
                // Slow healing: probability-based on multiplier
                if (Math.random() < regenMultiplier) {
                    healAmount = 1; // Standard 1 HP healing
                }
                // else healAmount stays 0 (no healing this turn)
            }
            
            if (healAmount > 0) {
                const healedAmount = this.heal(healAmount);
                if (healedAmount > 0) {
                    this.lastRegenTurn = this.turnCount;
                    
                    // Add to battle log
                    if (window.game && window.game.renderer) {
                        window.game.renderer.addBattleLogMessage(`You feel better. (+${healedAmount} HP)`, 'heal');
                    }
                }
            } else {
                // Still update timer even if no healing occurred
                this.lastRegenTurn = this.turnCount;
            }
        }
    }
    
    /**
     * Set regeneration rate (for items, spells, etc.)
     */
    setRegeneration(interval, amount) {
        this.regenInterval = interval;
        this.regenAmount = amount;
    }
    
    /**
     * Initialize minimal starting equipment (True Classic Roguelike)
     */
    initializeEquipment() {
        // Start with basic dagger using EquipmentManager
        if (typeof EquipmentManager !== 'undefined') {
            this.equipment.weapon = EquipmentManager.createEquipment('weapons', 'dagger');
        } else {
            // Fallback if EquipmentManager not available
            this.equipment.weapon = {
                name: 'Dagger',
                type: 'weapon',
                damage: 1,
                weaponDamage: 4, // d4
                toHitBonus: 0,
                weight: 10, // Light starting weapon
                description: 'A simple iron dagger. Better than bare hands.'
            };
        }
        
        // Option 2: True hardcore - start unarmed (uncomment below for maximum difficulty)
        // this.equipment.weapon = null;
        
        // No starting armor (classic harsh start)
        this.equipment.armor = null;
        
        // No shield initially
        this.equipment.shield = null;
        
        // No helmet initially
        this.equipment.helmet = null;
        
        // Update combat stats with equipment
        this.updateCombatStats();
    }
    
    /**
     * Update combat stats based on equipped items
     */
    updateCombatStats() {
        // Base stats (Classic Roguelike - AD&D style)
        this.baseToHit = this.getClassicModifier(this.strength) + this.level; // STR modifier + level
        this.armorClass = 10 - this.getClassicModifier(this.dexterity); // Lower AC is better
        
        // Base damage calculation
        this.baseDamage = this.getClassicModifier(this.strength); // STR modifier for damage
        this.weaponDamage = 4; // Basic starting weapon (d4 dagger)
        
        // Apply weapon bonuses
        if (this.equipment.weapon) {
            // Weapon damage replaces base damage, then add STR modifier
            this.baseDamage = (this.equipment.weapon.damage || 0) + this.getClassicModifier(this.strength);
            this.weaponDamage = this.equipment.weapon.weaponDamage || 3;
            this.baseToHit += this.equipment.weapon.toHitBonus || 0;
        }
        
        // Final damage for display (minimum damage + dice damage range)
        this.damage = this.baseDamage; // Fixed part
        this.minDamage = this.baseDamage + 1; // Min possible (dice roll 1)
        this.maxDamage = this.baseDamage + this.weaponDamage; // Max possible (max dice roll)
        
        // Apply armor bonuses (SUBTRACT from AC - lower is better)
        if (this.equipment.armor && this.equipment.armor.armorClassBonus) {
            this.armorClass -= this.equipment.armor.armorClassBonus; // Lower AC is better
        }
        
        if (this.equipment.shield && this.equipment.shield.armorClassBonus) {
            this.armorClass -= this.equipment.shield.armorClassBonus;
        }
        
        if (this.equipment.helmet && this.equipment.helmet.armorClassBonus) {
            this.armorClass -= this.equipment.helmet.armorClassBonus;
        }
        
        if (this.equipment.gloves) {
            this.baseToHit += this.equipment.gloves.toHitBonus || 0;
        }
        
        if (this.equipment.boots) {
            this.armorClass -= this.equipment.boots.armorClassBonus || 0;
        }
        
        if (this.equipment.ring) {
            this.baseToHit += this.equipment.ring.toHitBonus || 0;
            this.armorClass -= this.equipment.ring.armorClassBonus || 0;
        }
        
        if (this.equipment.amulet) {
            this.baseToHit += this.equipment.amulet.toHitBonus || 0;
            this.armorClass -= this.equipment.amulet.armorClassBonus || 0;
        }
        
        // Recalculate final to-hit after all equipment bonuses
        this.toHit = this.calculateFinalToHit();
        
        // Cache the breakdown for consistent display
        this.toHitBreakdown = {
            base: this.baseToHit,
            weaponSkill: this.getWeaponSkillModifier(),
            encumbrance: -this.getEncumbranceToHitPenalty(),
            dexterity: this.getDexterityToHitModifier(),
            condition: this.getConditionToHitModifier(),
            total: this.toHit
        };
    }
    
    /**
     * Equip an item
     */
    equipItem(item, slot) {
        if (this.equipment[slot]) {
            // Unequip current item first
            this.unequipItem(slot);
        }
        
        this.equipment[slot] = item;
        this.updateCombatStats();
        this.updateCurrentWeight(); // Update weight when equipping
        
        if (window.game && window.game.renderer) {
            window.game.renderer.addBattleLogMessage(`You equip ${item.name}.`, 'normal');
        }
    }
    
    /**
     * Unequip an item
     */
    unequipItem(slot) {
        if (this.equipment[slot]) {
            const item = this.equipment[slot];
            this.equipment[slot] = null;
            this.updateCombatStats();
            this.updateCurrentWeight(); // Update weight when unequipping
            
            if (window.game && window.game.renderer) {
                window.game.renderer.addBattleLogMessage(`You remove ${item.name}.`, 'normal');
            }
            
            return item;
        }
        return null;
    }
    
    /**
     * Get equipment summary
     */
    getEquipmentSummary() {
        const equipped = [];
        for (const [slot, item] of Object.entries(this.equipment)) {
            if (item) {
                equipped.push(`${slot}: ${item.name}`);
            }
        }
        return equipped;
    }
    
    /**
     * Add item to inventory (with stacking support)
     */
    addToInventory(item) {

        // Check if this item can stack with an existing item
        if (item.stackable) {
            for (let i = 0; i < this.inventory.length; i++) {
                const existingItem = this.inventory[i];
                if (existingItem.canStackWith && existingItem.canStackWith(item)) {
                    // Calculate how many we can add to this stack
                    const spaceInStack = existingItem.maxStackSize - existingItem.quantity;
                    const amountToAdd = Math.min(item.quantity, spaceInStack);
                    
                    if (amountToAdd > 0) {

                        existingItem.quantity += amountToAdd;
                        item.quantity -= amountToAdd;
                        
                        // Update weight and log message
                        this.updateCurrentWeight();
                        
                        if (window.game && window.game.renderer) {
                            const stackMessage = amountToAdd === 1 ? 
                                `You pick up ${item.name}.` : 
                                `You pick up ${amountToAdd} ${item.name}.`;
                            window.game.renderer.addBattleLogMessage(stackMessage, 'normal');
                        }
                        
                        // If all items were stacked, we're done
                        if (item.quantity <= 0) {
                            return true;
                        }
                    }
                }
            }
        }
        
        // If we get here, either the item isn't stackable, or there's leftover quantity
        if (item.quantity > 0) {
            // Check if we have space for a new inventory slot
            if (this.inventory.length >= this.maxInventorySize) {
                if (window.game && window.game.renderer) {
                    window.game.renderer.addBattleLogMessage('Your pack is full!', 'normal');
                }
                return false;
            }
            
            // Add the remaining items as a new stack

            this.inventory.push(item);
            this.updateCurrentWeight();
            
            if (window.game && window.game.renderer) {
                const message = item.quantity === 1 ? 
                    `You pick up ${item.name}.` : 
                    `You pick up ${item.quantity} ${item.name}.`;
                window.game.renderer.addBattleLogMessage(message, 'normal');
            }
        }
        
        return true;
    }
    
    /**
     * Remove item from inventory by index
     */
    removeFromInventory(index) {
        if (index >= 0 && index < this.inventory.length) {
            const item = this.inventory.splice(index, 1)[0];
            this.updateCurrentWeight(); // Update weight when removing items
            return item;
        }
        return null;
    }
    
    /**
     * Remove specific quantity from inventory stack
     */
    removeFromInventoryStack(itemIndex, quantity) {
        if (itemIndex < 0 || itemIndex >= this.inventory.length) {
            return null;
        }
        
        const item = this.inventory[itemIndex];

        
        if (!item.stackable) {
            // Non-stackable items - remove entirely
            return this.removeFromInventory(itemIndex);
        }
        
        if (quantity >= item.quantity) {
            // Remove entire stack
            return this.removeFromInventory(itemIndex);
        }
        
        // Create a new item with the specified quantity
        const removedItem = item.clone();
        removedItem.quantity = quantity;
        
        // Reduce the quantity in the original stack
        item.quantity -= quantity;
        

        
        this.updateCurrentWeight();
        return removedItem;
    }
    
    /**
     * Get inventory item by letter (A-Z)
     */
    getInventoryItem(letter) {
        const index = letter.charCodeAt(0) - 97; // a=0, b=1, etc.
        if (index >= 0 && index < this.inventory.length) {
            return this.inventory[index];
        }
        return null;
    }
    
    /**
     * Get inventory summary for display (with stack support)
     */
    getInventorySummary() {
        const summary = [];
        this.inventory.forEach((item, index) => {
            const letter = String.fromCharCode(97 + index); // a, b, c, etc.
            
            // Check if this item is currently equipped
            let isEquipped = false;
            for (const slot in this.equipment) {
                if (this.equipment[slot] === item) {
                    isEquipped = true;
                    break;
                }
            }
            
            // Use getDisplayName() for stacking information
            const displayName = item.getDisplayName ? item.getDisplayName() : item.name;
            
            // Get weight information
            const totalWeight = item.getTotalWeight ? item.getTotalWeight() : (item.weight * (item.quantity || 1));
            const weightText = totalWeight === 1 ? '1 lb' : `${totalWeight} lbs`;
            
            const itemText = isEquipped ? 
                `${letter} - ${displayName} (${weightText}) (being worn)` : 
                `${letter} - ${displayName} (${weightText})`;
            summary.push(itemText);
        });
        return summary;
    }
    
    /**
     * Equip item from inventory by letter
     */
    equipFromInventory(letter) {
        const item = this.getInventoryItem(letter);
        if (!item) {
            if (window.game && window.game.renderer) {
                window.game.renderer.addBattleLogMessage('No such item.', 'normal');
            }
            return false;
        }
        
        // Determine slot based on item type
        let slot = null;
        switch (item.type) {
            case 'weapon':
                slot = 'weapon';
                break;
            case 'armor':
                slot = 'armor';
                break;
            case 'shield':
                slot = 'shield';
                break;
            case 'helmet':
                slot = 'helmet';
                break;
            case 'gloves':
                slot = 'gloves';
                break;
            case 'boots':
                slot = 'boots';
                break;
            case 'ring':
                slot = 'ring';
                break;
            case 'amulet':
                slot = 'amulet';
                break;
            default:
                if (window.game && window.game.renderer) {
                    window.game.renderer.addBattleLogMessage('You cannot equip that.', 'normal');
                }
                return false;
        }
        
        // Lock UI updates during equipment change
        this._equipmentChanging = true;
        
        try {
            // Store current item for later inventory management
            const currentItem = this.equipment[slot];
            
            // Remove from inventory first
            const index = letter.charCodeAt(0) - 97; // Use 97 for lowercase 'a'
            this.removeFromInventory(index);
            
            // Directly swap equipment without intermediate updateCombatStats calls
            this.equipment[slot] = item;
            
            // Add old item back to inventory if there was one
            if (currentItem) {
                this.addToInventory(currentItem);
            }
            
            // Update combat stats once after all changes are complete
            this.updateCombatStats();
            this.updateCurrentWeight();
            
            // Add appropriate message
            if (currentItem) {
                if (window.game && window.game.renderer) {
                    window.game.renderer.addBattleLogMessage(`You remove ${currentItem.name} and equip ${item.name}.`, 'normal');
                }
            } else {
                if (window.game && window.game.renderer) {
                    window.game.renderer.addBattleLogMessage(`You equip ${item.name}.`, 'normal');
                }
            }
            
            // Consume a turn for equipment change
            this.turnCount++;
            this.checkRegeneration();
            
            return true;
        } finally {
            // Unlock UI updates
            this._equipmentChanging = false;
        }
    }
    
    /**
     * Unequip item to inventory by slot
     */
    unequipToInventory(slot) {
        const item = this.equipment[slot];
        if (item) {
            // Lock UI updates during equipment change
            this._equipmentChanging = true;
            
            try {
                // Directly remove from equipment slot
                this.equipment[slot] = null;
                
                // Add to inventory
                this.addToInventory(item);
                
                // Update combat stats once after all changes are complete
                this.updateCombatStats();
                this.updateCurrentWeight();
                
                // Add message
                if (window.game && window.game.renderer) {
                    window.game.renderer.addBattleLogMessage(`You remove ${item.name}.`, 'normal');
                }
                
                // Consume a turn for equipment change
                this.turnCount++;
                this.checkRegeneration();
                
                return true;
            } finally {
                // Unlock UI updates
                this._equipmentChanging = false;
            }
        }
        return false;
    }
    
    /**
     * Check if player is alive
     */
    isAlive() {
        return this.hp > 0;
    }
    
    /**
     * Get hunger status (Enhanced detailed levels - always visible)
     */
    getHungerStatus() {
        if (this.nutrition >= 1800) {
            return { level: 'OVERSTUFFED', name: 'Overstuffed', color: '#8b0000', speedPenalty: 0.6 };
        } else if (this.nutrition >= 1500) {
            return { level: 'BLOATED', name: 'Bloated', color: '#ff4500', speedPenalty: 0.8 };
        } else if (this.nutrition >= 1000) {
            return { level: 'SATIATED', name: 'Satiated', color: '#00ff00', speedPenalty: 0.9 };
        } else if (this.nutrition >= 800) {
            return { level: 'WELL_FED', name: 'Well Fed', color: '#90ee90', speedPenalty: 1.0 };
        } else if (this.nutrition >= 400) {
            return { level: 'NORMAL', name: 'Normal', color: '#ffffff', speedPenalty: 1.0 };
        } else if (this.nutrition >= 200) {
            return { level: 'PECKISH', name: 'Peckish', color: '#ffebcd', speedPenalty: 1.0 };
        } else if (this.nutrition >= 50) {
            return { level: 'HUNGRY', name: 'Hungry', color: '#ffff00', speedPenalty: 1.0 };
        } else if (this.nutrition >= 1) {
            return { level: 'WEAK', name: 'Weak', color: '#ff8800', speedPenalty: 0.9 };
        } else {
            return { level: 'FAINTING', name: 'Fainting', color: '#ff0000', speedPenalty: 0.7 };
        }
    }
    
    /**
     * Consume nutrition from actions (classic roguelike)
     */
    consumeNutrition(amount) {
        const oldHungerStatus = this.getHungerStatus();
        this.nutrition = Math.max(-200, this.nutrition - amount); // Can go negative (starving)
        
        // Check for starvation death
        if (this.nutrition <= -200) {
            this.hp = 0; // Starve to death
            if (window.game && window.game.renderer) {
                window.game.renderer.addBattleLogMessage('You starve to death!', 'death');
            }
        }
        
        // Check for weakness effects
        const hungerStatus = this.getHungerStatus();
        if (hungerStatus.level === 'WEAK' || hungerStatus.level === 'FAINTING') {
            // Reduce max HP when weak/fainting (temporary)
            const penalty = hungerStatus.level === 'FAINTING' ? 0.5 : 0.8;
            // This is applied in combat calculations, not permanently
        }
        
        // Update combat stats if hunger status changed (affects to-hit)
        if (oldHungerStatus.name !== hungerStatus.name) {
            this.updateCombatStats();
        }
    }
    
    /**
     * Calculate weight capacity based on strength (NetHack-style)
     */
    calculateWeightCapacity() {
        // NetHack formula: STR * 25 + 25 (with STR 18 being special)
        let baseCapacity = this.strength * 25 + 25;
        
        // Special handling for STR 18 (legendary strength)
        if (this.strength >= 18) {
            baseCapacity = 18 * 25 + 25 + (this.strength - 18) * 50; // Extra capacity for exceptional STR
        }
        
        this.maxWeight = baseCapacity;
        
        // Update current weight
        this.updateCurrentWeight();
    }
    
    /**
     * Calculate current total weight from inventory and equipment
     */
    updateCurrentWeight() {
        let totalWeight = 0;
        
        // Inventory weight
        for (const item of this.inventory) {
            totalWeight += this.getItemWeight(item);
        }
        
        // Equipment weight
        for (const slot in this.equipment) {
            if (this.equipment[slot]) {
                totalWeight += this.getItemWeight(this.equipment[slot]);
            }
        }
        
        this.currentWeight = totalWeight;
    }
    
    /**
     * Get weight of an item (with fallbacks for items without weight, stack-aware)
     */
    getItemWeight(item) {
        if (!item) return 0;
        
        let baseWeight = 0;
        
        // If item has explicit weight, use it
        if (item.weight !== undefined) {
            baseWeight = item.weight;
        } else {
            // Fallback weights based on item type
            switch (item.type) {
                case 'weapon':
                    baseWeight = this.getWeaponWeight(item);
                    break;
                case 'armor':
                    baseWeight = this.getArmorWeight(item);
                    break;
                case 'shield':
                    baseWeight = 100; // Heavy shields
                    break;
                case 'helmet':
                    baseWeight = 30;
                    break;
                case 'gloves':
                    baseWeight = 10;
                    break;
                case 'boots':
                    baseWeight = 50;
                    break;
                case 'ring':
                    baseWeight = 3;
                    break;
                case 'amulet':
                    baseWeight = 20;
                    break;
                case 'potion':
                    baseWeight = 20;
                    break;
                case 'food':
                    baseWeight = 20; // Default food weight
                    break;
                default:
                    baseWeight = 10; // Default item weight
                    break;
            }
        }
        
        // Apply quantity for stackable items
        const quantity = item.quantity || 1;
        return baseWeight * quantity;
    }
    
    /**
     * Get weapon weight based on damage (heavier = more damage)
     */
    getWeaponWeight(weapon) {
        const baseDamage = weapon.damage || weapon.weaponDamage || 1;
        return Math.max(10, baseDamage * 20); // 10-200 lbs range
    }
    
    /**
     * Get armor weight based on AC bonus
     */
    getArmorWeight(armor) {
        const acBonus = armor.armorClassBonus || 1;
        return Math.max(50, acBonus * 100); // 50-500+ lbs range
    }
    
    /**
     * Get encumbrance level and speed modifier
     */
    getEncumbranceLevel() {
        const ratio = this.currentWeight / this.maxWeight;
        
        if (ratio <= 0.25) {
            return { level: 'UNENCUMBERED', name: 'Unencumbered', speedPenalty: 1.0, color: '#00ff00' };
        } else if (ratio <= 0.50) {
            return { level: 'BURDENED', name: 'Burdened', speedPenalty: 0.9, color: '#ffff00' };
        } else if (ratio <= 0.75) {
            return { level: 'STRESSED', name: 'Stressed', speedPenalty: 0.75, color: '#ff8800' };
        } else if (ratio <= 1.0) {
            return { level: 'STRAINED', name: 'Strained', speedPenalty: 0.6, color: '#ff4400' };
        } else if (ratio <= 1.25) {
            return { level: 'OVERTAXED', name: 'Overtaxed', speedPenalty: 0.4, color: '#ff0000' };
        } else {
            return { level: 'OVERLOADED', name: 'Overloaded', speedPenalty: 0.2, color: '#800000' };
        }
    }
    
    /**
     * Check if player can move (weight restrictions)
     */
    canMove() {
        const encumbrance = this.getEncumbranceLevel();
        
        // Overloaded players have difficulty moving
        if (encumbrance.level === 'OVERLOADED') {
            if (Math.random() < 0.5) { // 50% chance to fail movement
                if (window.game && window.game.renderer) {
                    window.game.renderer.addBattleLogMessage('You are too heavily burdened to move!', 'damage');
                }
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Update effective speed based on hunger status and encumbrance
     */
    updateEffectiveSpeed() {
        const hungerStatus = this.getHungerStatus();
        const encumbrance = this.getEncumbranceLevel();
        
        // Check for new encumbrance level and give feedback
        const previousEncumbrance = this.previousEncumbrance || { level: 'UNENCUMBERED' };
        if (encumbrance.level !== previousEncumbrance.level) {
            this.notifyEncumbranceChange(encumbrance, previousEncumbrance);
            this.previousEncumbrance = encumbrance;
        }
        
        // Apply both hunger and encumbrance penalties
        this.speed = Math.floor(this.baseSpeed * hungerStatus.speedPenalty * encumbrance.speedPenalty);
        
        // Ensure minimum speed (can't go below 10% of base speed)
        this.speed = Math.max(10, this.speed);
    }
    
    /**
     * Notify player of encumbrance level changes
     */
    notifyEncumbranceChange(current, previous) {
        if (!window.game || !window.game.renderer) return;
        
        const messages = {
            'UNENCUMBERED': 'You feel unencumbered.',
            'BURDENED': 'You are burdened.',
            'STRESSED': 'You feel stressed.',
            'STRAINED': 'You are straining under the weight.',
            'OVERTAXED': 'You are overtaxed!',
            'OVERLOADED': 'You are severely overloaded!'
        };
        
        const message = messages[current.level];
        if (message) {
            const color = current.level === 'UNENCUMBERED' ? 'heal' : 
                         current.level === 'BURDENED' ? 'normal' : 'damage';
            window.game.renderer.addBattleLogMessage(message, color);
        }
    }
    
    /**
     * Get current speed (for external access)
     */
    getCurrentSpeed() {
        this.updateEffectiveSpeed();
        return this.speed;
    }
    
    /**
     * Apply overeating penalties (ADOM-style)
     */
    applyOvereatingPenalty(severity) {
        if (!window.game || !window.game.renderer) return;
        
        const penalties = {
            'satiated': [
                () => {
                    window.game.renderer.addLogMessage('You feel uncomfortably full.');
                },
                () => {
                    window.game.renderer.addLogMessage('Your stomach gurgles unpleasantly.');
                },
                () => {
                    window.game.renderer.addLogMessage('You feel sluggish from overeating.');
                    // Temporary speed reduction already handled by hunger status
                }
            ],
            'bloated': [
                () => {
                    window.game.renderer.addBattleLogMessage('You feel nauseous from overeating!', 'damage');
                    // Lose some HP from digestive stress
                    this.takeDamage(Math.floor(this.maxHp * 0.05) + 1, 'digestive stress');
                },
                () => {
                    window.game.renderer.addLogMessage('Your stomach cramps painfully!');
                    // Lose more nutrition (poor digestion)
                    this.nutrition = Math.max(this.nutrition - 100, 0);
                },
                () => {
                    window.game.renderer.addLogMessage('You retch violently!');
                    // Lose significant HP and nutrition
                    this.takeDamage(Math.floor(this.maxHp * 0.1) + 2, 'violent retching');
                    this.nutrition = Math.max(this.nutrition - 200, 0);
                },
                () => {
                    window.game.renderer.addLogMessage('You feel dizzy and disoriented!');
                    // Temporary confusion effect (could be expanded)
                    window.game.renderer.addLogMessage('Everything spins around you...');
                }
            ]
        };
        
        const applicablePenalties = penalties[severity] || penalties['satiated'];
        const randomPenalty = applicablePenalties[Math.floor(Math.random() * applicablePenalties.length)];
        randomPenalty();
    }
    
    /**
     * Remove item from inventory by object reference or letter (stack-aware)
     */
    removeFromInventoryByItem(item, quantity = 1) {
        const itemIndex = this.inventory.indexOf(item);
        if (itemIndex !== -1) {
            return this.removeFromInventoryStack(itemIndex, quantity);
        }
        return null;
    }
    
    /**
     * Remove item from inventory by letter (stack-aware)
     */
    removeFromInventoryByLetter(letter, quantity = 1) {
        const index = letter.charCodeAt(0) - 97; // a=0, b=1, etc.
        if (index >= 0 && index < this.inventory.length) {
            return this.removeFromInventoryStack(index, quantity);
        }
        return null;
    }
    
    /**
     * Remove specific quantity from inventory stack
     */
    removeFromInventoryStack(index, quantity = 1) {
        if (index < 0 || index >= this.inventory.length) {
            return null;
        }
        
        const item = this.inventory[index];
        
        // If removing all or more than available, remove the entire stack
        if (quantity >= item.quantity) {
            const removedItem = this.inventory.splice(index, 1)[0];
            this.updateCurrentWeight();
            return removedItem;
        }
        
        // Otherwise, create a new item with the removed quantity
        const removedItem = item.clone ? item.clone() : { ...item };
        removedItem.quantity = quantity;
        item.quantity -= quantity;
        
        this.updateCurrentWeight();
        return removedItem;
    }
    
    /**
     * Eat food to restore nutrition
     */
    eat(foodItem, letter = null) {
        if (!foodItem) {
            if (window.game && window.game.renderer) {
                window.game.renderer.addLogMessage('There is nothing to eat!');
            }
            return false;
        }
        
        // Check if item is food
        if (foodItem.type !== 'food' && !foodItem.nutrition) {
            if (window.game && window.game.renderer) {
                window.game.renderer.addLogMessage('That is not edible!');
            }
            return false;
        }
        
        // Check if it's rotten (for FoodItem class)
        if (foodItem instanceof FoodItem && !foodItem.isEdible()) {
            if (window.game && window.game.renderer) {
                window.game.renderer.addLogMessage('That food is rotten!');
            }
            return false;
        }
        
        // Check overeating conditions (ADOM-style)
        const currentHungerStatus = this.getHungerStatus();
        
        // Completely prevent eating when overstuffed
        if (this.nutrition >= this.maxNutrition) {
            if (window.game && window.game.renderer) {
                window.game.renderer.addLogMessage('You are too full to eat! You might burst!');
            }
            return false;
        }
        
        // Warn and apply penalties for eating when already full
        if (currentHungerStatus.level === 'BLOATED') {
            if (window.game && window.game.renderer) {
                window.game.renderer.addLogMessage('You force yourself to eat despite feeling bloated...');
            }
            // 50% chance of negative effects when eating while bloated
            if (Math.random() < 0.5) {
                this.applyOvereatingPenalty('bloated');
            }
        } else if (currentHungerStatus.level === 'SATIATED') {
            if (window.game && window.game.renderer) {
                window.game.renderer.addLogMessage('You eat despite being satisfied...');
            }
            // 25% chance of negative effects when eating while satiated
            if (Math.random() < 0.25) {
                this.applyOvereatingPenalty('satiated');
            }
        }
        
        // Eating while heavily burdened is more difficult
        const encumbrance = this.getEncumbranceLevel();
        if (['OVERTAXED', 'OVERLOADED'].includes(encumbrance.level)) {
            if (window.game && window.game.renderer) {
                window.game.renderer.addLogMessage('Eating is difficult while so heavily burdened.');
            }
            // Extra nutrition consumption due to the effort of eating while overburdened
            this.consumeNutrition(1);
        }
        
        // Get effective nutrition
        let nutritionValue = foodItem.nutrition;
        if (foodItem instanceof FoodItem) {
            nutritionValue = foodItem.getEffectiveNutrition();
        }
        
        // Consume the food
        const nutritionGain = Math.min(nutritionValue, this.maxNutrition - this.nutrition);
        this.nutrition += nutritionGain;
        
        // Update speed after eating (hunger affects movement speed)
        this.updateEffectiveSpeed();
        
        // Immediate healing from food (if specified)
        if (foodItem.healAmount && foodItem.healAmount > 0) {
            const healedAmount = this.heal(foodItem.healAmount);
            if (window.game && window.game.renderer) {
                window.game.renderer.addBattleLogMessage(`The ${foodItem.name} heals you for ${healedAmount} HP!`, 'heal');
            }
        }
        
        // Messages based on nutrition gain
        if (window.game && window.game.renderer) {
            if (nutritionGain >= 500) {
                window.game.renderer.addLogMessage(`That ${foodItem.name} was very satisfying!`);
            } else if (nutritionGain >= 200) {
                window.game.renderer.addLogMessage(`You eat the ${foodItem.name}.`);
            } else if (nutritionGain > 0) {
                window.game.renderer.addLogMessage(`You nibble on the ${foodItem.name}.`);
            } else {
                window.game.renderer.addLogMessage(`The ${foodItem.name} doesn't seem very nutritious.`);
            }
        }
        
        // Remove the food from inventory
        if (letter) {
            // If letter is provided, use it for more reliable deletion
            this.removeFromInventoryByLetter(letter);
        } else {
            // Fallback to object reference
            this.removeFromInventoryByItem(foodItem);
        }
        
        return true;
    }
    
    /**
     * Drink potion to restore health or gain effects
     */
    drinkPotion(potionItem, letter = null) {
        if (!potionItem) {
            if (window.game && window.game.renderer) {
                window.game.renderer.addLogMessage('There is no potion to drink!');
            }
            return false;
        }
        

        
        // Check if item is a potion
        if (potionItem.type !== 'potion') {
            if (window.game && window.game.renderer) {
                window.game.renderer.addLogMessage('That is not a potion!');
            }
            return false;
        }
        
        // Apply healing effect using dice roll
        let healAmount = 0;
        let diceRoll = null;
        
        if (potionItem.healDice) {
            // Use dice-based healing
            healAmount = rollDice(potionItem.healDice);
            diceRoll = potionItem.healDice;
        } else if (potionItem.healAmount) {
            // Fallback to fixed amount
            healAmount = potionItem.healAmount;
        }
        
        let oldHp = this.hp;
        
        if (healAmount > 0) {
            this.hp = Math.min(this.maxHp, this.hp + healAmount);
            let actualHealing = this.hp - oldHp;
            
            if (actualHealing > 0) {
                if (window.game && window.game.renderer) {
                    let message = `You drink the ${potionItem.name}. You feel better! (+${actualHealing} HP)`;
                    if (diceRoll && actualHealing === healAmount) {
                        message += ` [${diceRoll}→${healAmount}]`;
                    }
                    window.game.renderer.addBattleLogMessage(message, 'heal');
                }
            } else {
                if (window.game && window.game.renderer) {
                    let message = `You drink the ${potionItem.name}. You are already at full health.`;
                    if (diceRoll) {
                        message += ` [${diceRoll}→${healAmount}]`;
                    }
                    window.game.renderer.addBattleLogMessage(message, 'heal');
                }
            }
        } else {
            if (window.game && window.game.renderer) {
                window.game.renderer.addLogMessage(`You drink the ${potionItem.name}.`);
            }
        }
        
        // Remove potion from inventory
        if (letter) {
            // Remove by letter (more reliable for UI)
            const index = letter.charCodeAt(0) - 97; // a=0, b=1, etc.
            if (potionItem.stackable && potionItem.quantity > 1) {
                // Apply quantity for stackable items
                this.removeFromInventoryStack(index, 1);
            } else {
                this.removeFromInventory(index);
            }
        } else {
            // Find and remove the item directly
            const index = this.inventory.indexOf(potionItem);
            if (index !== -1) {
                if (potionItem.stackable && potionItem.quantity > 1) {
                    this.removeFromInventoryStack(index, 1);
                } else {
                    this.removeFromInventory(index);
                }
            }
        }
        
        // Update weight after consumption
        this.updateCurrentWeight();
        
        // Consume a turn
        this.turnCount++;
        this.checkRegeneration();
        
        return true;
    }
    
    /**
     * Eat food from inventory by selection (fallback method)
     * This is kept as a fallback for cases where UI is not available
     */
    eatFromInventory() {
        const foodItems = this.inventory.filter(item => 
            item.type === 'food' || item.nutrition > 0
        );
        
        if (foodItems.length === 0) {
            if (window.game && window.game.renderer) {
                window.game.renderer.addLogMessage('You have no food to eat!');
            }
            return false;
        }
        
        // Eat the first food item found (fallback behavior)
        const foodToEat = foodItems[0];
        return this.eat(foodToEat);
    }
    
    /**
     * Process hunger over time (called each turn)
     */
    processHunger() {
        this.hungerTimer++;
        
        // Calculate base hunger interval based on encumbrance
        const encumbrance = this.getEncumbranceLevel();
        const baseInterval = this.getHungerInterval(encumbrance);
        
        // NetHack-style hunger rate: consume nutrition based on weight carried
        if (this.hungerTimer >= baseInterval) {
            const nutritionCost = this.getHungerCost(encumbrance);
            this.consumeNutrition(nutritionCost);
            this.hungerTimer = 0;
            
            // Additional hunger from regeneration (NetHack: odd turns when regenerating)
            const hungerLevel = this.getHungerStatus().level;
            if (this.hp < this.maxHp && !['HUNGRY', 'WEAK', 'FAINTING'].includes(hungerLevel)) {
                // 50% chance for additional nutrition cost during regeneration
                if (Math.random() < 0.5) {
                    const regenCost = this.getRegenerationHungerCost(encumbrance);
                    this.consumeNutrition(regenCost);
                }
            }
        }
        
        // Update speed based on current hunger status
        this.updateEffectiveSpeed();
    }
    
    /**
     * Get hunger interval based on encumbrance (lower = faster hunger)
     */
    getHungerInterval(encumbrance) {
        const intervals = {
            'UNENCUMBERED': 8,   // Slowest hunger (light load) - much faster
            'BURDENED': 6,       // Normal hunger (base rate) - much faster
            'STRESSED': 5,       // Faster hunger - much faster
            'STRAINED': 4,       // Much faster hunger - much faster
            'OVERTAXED': 3,      // Very fast hunger - much faster
            'OVERLOADED': 2      // Extremely fast hunger - very rapid
        };
        
        return intervals[encumbrance.level] || 6;
    }
    
    /**
     * Get base nutrition cost based on encumbrance
     */
    getHungerCost(encumbrance) {
        const costs = {
            'UNENCUMBERED': 1,   // Base cost
            'BURDENED': 2,       // Increased from 1 - more demanding
            'STRESSED': 2,       // Double cost
            'STRAINED': 3,       // Triple cost
            'OVERTAXED': 4,      // Quadruple cost
            'OVERLOADED': 5      // Quintuple cost - very demanding
        };
        
        return costs[encumbrance.level] || 2;
    }
    
    /**
     * Get regeneration hunger cost based on encumbrance
     */
    getRegenerationHungerCost(encumbrance) {
        const costs = {
            'UNENCUMBERED': 1,   // Normal regen cost
            'BURDENED': 1,       // Normal regen cost
            'STRESSED': 1,       // Normal regen cost
            'STRAINED': 2,       // Higher regen cost
            'OVERTAXED': 2,      // Higher regen cost
            'OVERLOADED': 3      // Much higher regen cost
        };
        
        return costs[encumbrance.level] || 1;
    }
    
    /**
     * Get combat hunger cost based on encumbrance
     */
    getCombatHungerCost(encumbrance) {
        const costs = {
            'UNENCUMBERED': 1,   // Light and agile combat
            'BURDENED': 2,       // Normal combat cost
            'STRESSED': 2,       // Normal combat cost
            'STRAINED': 3,       // Fighting while strained is tiring
            'OVERTAXED': 4,      // Very tiring combat
            'OVERLOADED': 5      // Extremely exhausting combat
        };
        
        return costs[encumbrance.level] || 2;
    }
    
    /**
     * Get door slam hunger cost based on encumbrance
     */
    getDoorSlamHungerCost(encumbrance) {
        const costs = {
            'UNENCUMBERED': 1,   // Easy door slam
            'BURDENED': 1,       // Normal door slam
            'STRESSED': 2,       // Harder to slam doors
            'STRAINED': 2,       // Much harder
            'OVERTAXED': 3,      // Very difficult
            'OVERLOADED': 4      // Extremely difficult
        };
        
        return costs[encumbrance.level] || 1;
    }
    
    /**
     * Get player stats summary
     */
    getStats() {
        return {
            level: this.level,
            hp: this.hp,
            maxHp: this.maxHp,
            mp: this.mp,
            maxMp: this.maxMp,
            exp: this.exp,
            expToNext: this.expToNext,
            turnCount: this.turnCount,
            nutrition: this.nutrition,
            hungerStatus: this.getHungerStatus(),
            armorClass: this.armorClass, // Add AC to stats
            toHit: this.toHit,           // Final to hit with all modifiers
            baseToHit: this.baseToHit,   // Base to hit before modifiers
            damage: this.damage,         // Base damage (for compatibility)
            baseDamage: this.baseDamage, // Fixed damage part
            weaponDamage: this.weaponDamage, // Dice damage part
            minDamage: this.minDamage,   // Minimum possible damage
            maxDamage: this.maxDamage,   // Maximum possible damage
            weaponName: this.equipment.weapon ? this.equipment.weapon.name : 'Unarmed', // Add weapon name
            weaponInfo: this.equipment.weapon || null, // Complete weapon object for display
            // Detailed to-hit breakdown (cached for consistency)
            toHitBreakdown: this.toHitBreakdown || {
                base: this.baseToHit,
                weaponSkill: 0,
                encumbrance: 0,
                dexterity: 0,
                condition: 0,
                total: this.toHit
            },
            currentWeight: this.currentWeight, // Current weight carried
            maxWeight: this.maxWeight,         // Maximum weight capacity
            encumbrance: this.getEncumbranceLevel(), // Encumbrance status
            strength: this.strength,
            dexterity: this.dexterity,
            constitution: this.constitution,
            intelligence: this.intelligence,
            wisdom: this.wisdom,
            charisma: this.charisma
        };
    }
    
    /**
     * Calculate final to-hit bonus including all modifiers
     */
    calculateFinalToHit() {
        let finalToHit = this.baseToHit;
        
        // Weapon skill modifier based on weapon type
        const weaponSkillModifier = this.getWeaponSkillModifier();
        finalToHit += weaponSkillModifier;
        
        // Encumbrance penalty
        const encumbrancePenalty = this.getEncumbranceToHitPenalty();
        finalToHit -= encumbrancePenalty;
        
        // Dexterity modifier for finesse weapons
        const dexterityModifier = this.getDexterityToHitModifier();
        finalToHit += dexterityModifier;
        
        // Fatigue/condition modifiers
        const conditionModifier = this.getConditionToHitModifier();
        finalToHit += conditionModifier;
        
        return finalToHit;
    }
    
    /**
     * Get weapon skill modifier based on weapon type
     */
    getWeaponSkillModifier() {
        if (!this.equipment.weapon) {
            // Unarmed combat - minimal skill
            return -2;
        }
        
        // Get weapon name to determine skill
        const weaponName = this.equipment.weapon.name.toLowerCase();
        const material = this.equipment.weapon.material;
        let skillMod = 0;
        
        // Weapon type skill modifiers
        if (weaponName.includes('dagger')) skillMod = 1;        // Light, easy to use
        else if (weaponName.includes('shortsword')) skillMod = 0; // Balanced
        else if (weaponName.includes('longsword')) skillMod = -1; // Requires skill
        else if (weaponName.includes('axe') && !weaponName.includes('battle')) skillMod = 0; // Hand axe
        else if (weaponName.includes('battle') || weaponName.includes('great')) skillMod = -2; // Heavy weapons
        
        // Material quality bonus
        const materialBonus = {
            'iron': 0,
            'steel': 1,
            'mithril': 2,
            'adamantine': 3
        };
        
        skillMod += materialBonus[material] || 0;
        
        return skillMod;
    }
    
    /**
     * Get encumbrance penalty to hit
     */
    getEncumbranceToHitPenalty() {
        const encumbrance = this.getEncumbranceLevel();
        
        const penalties = {
            'UNENCUMBERED': 0,
            'BURDENED': 1,
            'STRESSED': 2,
            'STRAINED': 3,
            'OVERTAXED': 5,
            'OVERLOADED': 8
        };
        
        return penalties[encumbrance.level] || 0;
    }
    
    /**
     * Get dexterity modifier for finesse weapons
     */
    getDexterityToHitModifier() {
        if (!this.equipment.weapon) {
            // Unarmed - uses dexterity
            return this.getClassicModifier(this.dexterity);
        }
        
        const weaponName = this.equipment.weapon.name.toLowerCase();
        const isFinesse = weaponName.includes('dagger') || weaponName.includes('shortsword');
        
        if (isFinesse) {
            // Use better of STR or DEX for finesse weapons
            const strMod = this.getClassicModifier(this.strength);
            const dexMod = this.getClassicModifier(this.dexterity);
            return Math.max(0, dexMod - strMod); // Only add if DEX is better than STR
        }
        
        return 0; // Heavy weapons rely on strength only
    }
    
    /**
     * Get condition modifiers (hunger, fatigue, etc.)
     */
    getConditionToHitModifier() {
        let modifier = 0;
        
        // Hunger effects
        const hungerStatus = this.getHungerStatus();
        const hungerModifiers = {
            'Satiated': 1,
            'Normal': 0,
            'Hungry': -1,
            'Weak': -2,
            'Fainting': -4,
            'Starving': -6
        };
        
        modifier += hungerModifiers[hungerStatus.name] || 0;
        
        // Low HP penalty (wounded)
        const hpPercent = this.hp / this.maxHp;
        if (hpPercent < 0.25) {
            modifier -= 3; // Severely wounded
        } else if (hpPercent < 0.5) {
            modifier -= 1; // Wounded
        }
        
        return modifier;
    }
} 