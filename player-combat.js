/**
 * Player combat and damage handling helpers
 * Extracted from Player class for modularity.
 */
(function () {
    if (typeof Player === 'undefined') {
        console.error('Player class not found for combat helpers.');
        return;
    }

    const PlayerRef = Player;

    // Door slam attack & damage
    PlayerRef.prototype.closeDoor = function(x, y, dungeon) {
        const doorState = dungeon.getDoorState(x, y);
        
        if (doorState === 'open') {
            // Check if there's a monster on the door
            const monster = window.game && window.game.monsterSpawner.getMonsterAt(x, y);
            if (monster) {
                // Door slam attack - THAC0 style hit check
                const naturalRoll = Math.floor(Math.random() * 20) + 1; // Pure d20 roll (1-20)
                const requiredRoll = monster.armorClass - this.toHit; // THAC0 calculation
                
                if (window.game && window.game.renderer) {
                    window.game.renderer.addBattleLogMessage(`You slam the door on ${monster.name}... (${naturalRoll} vs ${requiredRoll}+ needed, AC ${monster.armorClass}) [Door AP 5]`);
                }
                
                if (naturalRoll >= requiredRoll) {
                    // Hit! Calculate door damage
                    const doorDamage = this.calculateDoorDamage();
                    let finalDamage = doorDamage;
                    
                    // Critical hit check (natural 20 only)
                    if (naturalRoll === 20) {
                        finalDamage = doorDamage * 2;
                        if (window.game && window.game.renderer) {
                            window.game.renderer.addBattleLogMessage(`Critical door slam! ${finalDamage} damage! [AP 5]`, 'victory');
                        }
                    } else {
                        if (window.game && window.game.renderer) {
                            window.game.renderer.addBattleLogMessage(`The door crushes for ${finalDamage} damage! [AP 5]`);
                        }
                    }
                    
                    // Door slam has high penetration (heavy doors crush armor)
                    const doorPenetration = 5; // High AP - doors can crush through heavy armor
                    monster.takeDamage(finalDamage, doorPenetration);
                    
                    if (!monster.isAlive) {
                        if (window.game) {
                            // Unified defeat handling (also drops corpse)
                            window.game.handleMonsterDefeated(monster, 'door');
                        }
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
    };

    /**
     * Calculate door slam damage (similar to weapon attack)
     */
    PlayerRef.prototype.calculateDoorDamage = function() {
        // Door damage: 2d6 + STR modifier (heavier than normal weapons)
        const baseDamage = this.getClassicModifier(this.strength); // STR modifier
        const doorDie = 6; // d6 weapon damage
        const doorDamage = baseDamage + Math.floor(Math.random() * doorDie) + 1 + Math.floor(Math.random() * doorDie) + 1; // 2d6
        return Math.max(1, doorDamage); // Minimum 1 damage
    };

    /**
     * Take damage from an attack (Classic Roguelike)
     */
    PlayerRef.prototype.takeDamage = function(damage, penetration = 0) {
        // Calculate damage reduction with minimum damage guarantee (75% max reduction)
        const effectiveProtection = Math.max(0, this.totalProtection - penetration);
        const reducedDamage = Math.max(0, damage - effectiveProtection);
        const minimumDamage = Math.ceil(damage * 0.25); // Guarantee 25% of original damage
        let finalDamage = Math.max(reducedDamage, minimumDamage);
        
        if (window.game && window.game.renderer && (this.totalProtection > 0 || penetration > 0)) {
            const reductionPercent = Math.round((1 - finalDamage / damage) * 100);
            window.game.renderer.addBattleLogMessage(
                `DR ${this.totalProtection} vs AP ${penetration} = ${effectiveProtection} DR (${damage} → ${finalDamage}, ${reductionPercent}% reduced)`, 
                'defense'
            );
        }
        
        // Shield Block Chance check (after damage reduction calculation)
        const blockChance = this.getBlockChance();
        let blockedAttack = false;
        if (blockChance > 0 && finalDamage > 0) {
            const blockRoll = Math.floor(Math.random() * 100) + 1; // 1-100
            if (blockRoll <= blockChance) {
                // Successful block!
                blockedAttack = true;
                if (window.game && window.game.renderer) {
                    window.game.renderer.addBattleLogMessage(
                        `You block the attack with your shield! (${blockRoll} ≤ ${blockChance}% BC)`, 
                        'victory'
                    );
                }
                
                // Check shield durability after successful block
                if (this.equipment.shield) {
                    const broke = this.equipment.shield.takeDurabilityDamage(1, 'block');
                    if (broke) {
                        if (window.game && window.game.renderer) {
                            window.game.renderer.addBattleLogMessage(
                                `Your ${this.equipment.shield.name} breaks from blocking!`, 
                                'warning'
                            );
                        }
                        this.updateCombatStats(); // Recalculate stats after shield breaks
                    }
                }
                
                finalDamage = 0; // Completely blocked
            } else {
                // Failed block
                if (window.game && window.game.renderer && blockChance > 0) {
                    window.game.renderer.addBattleLogMessage(
                        `Block failed! (${blockRoll} > ${blockChance}% BC)`, 
                        'normal'
                    );
                }
            }
        }
        
        const oldHpPercent = this.hp / this.maxHp;
        this.hp -= finalDamage;
        // Wake from magical sleep on damage
        if (this.statusEffects && this.statusEffects.hasEffect && this.statusEffects.hasEffect('sleep')) {
            this.statusEffects.removeEffect('sleep');
        }
        const newHpPercent = this.hp / this.maxHp;
        
        // Check armor durability if damage was taken (not blocked)
        if (finalDamage > 0 && !blockedAttack) {
            this.checkArmorDurability(finalDamage);
        }
        
        // Add HP status to battle log (only if damage was actually taken)
        if (window.game && window.game.renderer) {
            const hpDisplay = this.hp <= 0 ? '0' : this.hp;
            if (finalDamage > 0) {
                window.game.renderer.addBattleLogMessage(`You: ${hpDisplay}/${this.maxHp} HP`, 'damage');
            } else {
                window.game.renderer.addBattleLogMessage('No damage taken!', 'defense');
            }
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
    };

    /**
     * Take direct damage bypassing armor/DR/block (for status effects)
     */
    PlayerRef.prototype.takeDirectDamage = function(damage) {
        const oldHp = this.hp;
        this.hp = Math.max(0, this.hp - damage);
        
        // Add HP status to battle log
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
        
        // Update combat stats if HP threshold changed
        const oldHpPercent = oldHp / this.maxHp;
        const newHpPercent = this.hp / this.maxHp;
        const oldWounded = oldHpPercent < 0.5;
        const newWounded = newHpPercent < 0.5;
        const oldSeverelyWounded = oldHpPercent < 0.25;
        const newSeverelyWounded = newHpPercent < 0.25;
        
        if (oldWounded !== newWounded || oldSeverelyWounded !== newSeverelyWounded) {
            this.updateCombatStats();
        }
        
        return false; // Player survived
    };

    /**
     * Attack a monster (Classic Roguelike - THAC0 style)
     */
    PlayerRef.prototype.attackMonster = function(monster) {
        // THAC0-style hit check: need to roll >= (target AC - to hit bonus)
        const naturalRoll = Math.floor(Math.random() * 20) + 1; // Pure d20 roll (1-20)
        const requiredRoll = monster.armorClass - this.toHit; // THAC0 calculation
        
        if (window.game && window.game.renderer) {
            const breakdown = this.getStats().toHitBreakdown;
            const toHitText = this.toHit >= 0 ? `+${this.toHit}` : `${this.toHit}`;
            const baseText = this.baseToHit >= 0 ? `+${this.baseToHit}` : `${this.baseToHit}`;
            const modValue = this.toHit - this.baseToHit;
            const modText = modValue >= 0 ? `+${modValue}` : `${modValue}`;
            const modifierText = this.toHit !== this.baseToHit ? 
                ` (base${baseText}, mods${modText})` : '';
            window.game.renderer.addBattleLogMessage(`You attack ${monster.name}... (${naturalRoll} vs ${requiredRoll}+ needed, AC ${monster.armorClass}, hit${toHitText}${modifierText})`);
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
            
            const damageDealt = monster.takeDamage(finalDamage, this.penetration);
            
            // Check weapon durability after successful attack
            if (this.equipment.weapon) {
                const usageType = naturalRoll === 20 ? 'critical' : 'normal';
                const broke = this.equipment.weapon.takeDurabilityDamage(1, usageType);
                if (broke) {
                    if (window.game && window.game.renderer) {
                        window.game.renderer.addBattleLogMessage(
                            `Your ${this.equipment.weapon.name} breaks from the attack!`, 
                            'warning'
                        );
                    }
                    this.updateCombatStats(); // Recalculate stats after weapon breaks
                }
            }
            
            // Check for status effects from weapon (only if monster is still alive)
            if (this.equipment.weapon && damageDealt > 0 && monster.hp > 0) {
                // Check if status effect function is available
                if (typeof calculateStatusEffectChance === 'function' && monster.statusEffects) {
                    const weaponType = this.equipment.weapon.weaponType || 'default';
                    const maxDamage = monster.maxHp;
                    
                    // Check each possible status effect
                    const possibleEffects = ['bleeding', 'stunned', 'fractured'];
                    for (const effectType of possibleEffects) {
                        try {
                            const effect = calculateStatusEffectChance(weaponType, effectType, damageDealt, maxDamage);
                            if (effect && monster.statusEffects) {
                                monster.statusEffects.addEffect(effect.type, effect.duration, effect.severity, 'player weapon');
                            }
                        } catch (error) {
                            console.error(`Error applying status effect ${effectType}:`, error);
                        }
                    }
                }
            }
            
            if (!monster.isAlive) {
                try {
                    if (window.game) {
                        window.game.handleMonsterDefeated(monster, 'melee');
                    }
                } catch (error) {
                    console.error('Error in monster defeat handling:', error);
                    console.error('Monster object:', monster);
                }
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
            
            // Force UI update after combat to show status effects immediately
            if (window.game && window.game.renderer) {
                const livingMonsters = window.game.monsterSpawner ? window.game.monsterSpawner.getLivingMonsters() : [];
                window.game.renderer.updateVisibleMonsters(livingMonsters, window.game.fov, this.x, this.y);
            }
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
    };

    /**
     * Check armor durability when damage is taken
     */
    PlayerRef.prototype.checkArmorDurability = function(damageAmount) {
        let needsStatsUpdate = false;
        
        // Check all equipped armor pieces
        const armorSlots = ['armor', 'helmet', 'gloves', 'boots'];
        
        for (const slot of armorSlots) {
            if (this.equipment[slot]) {
                const armor = this.equipment[slot];
                
                // Higher damage increases chance of durability loss
                const damageChance = Math.min(0.3, damageAmount * 0.02); // Max 30% chance
                if (Math.random() < damageChance) {
                    const broke = armor.takeDurabilityDamage(1, 'normal');
                    if (broke) {
                        if (window.game && window.game.renderer) {
                            window.game.renderer.addBattleLogMessage(
                                `Your ${armor.name} breaks from the damage!`, 
                                'warning'
                            );
                        }
                        needsStatsUpdate = true;
                    }
                }
            }
        }
        
        // Update stats if any armor broke
        if (needsStatsUpdate) {
            this.updateCombatStats();
        }
    };
})();

