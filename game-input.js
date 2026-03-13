/**
 * Game input and keyboard handling helpers
 * Extracted from Game class for modularity.
 */
(function () {
    if (typeof Game === 'undefined') {
        console.error('Game class not found for input helpers.');
        return;
    }

    const GameRef = Game;

    /**
     * Set up event listeners
     */
    GameRef.prototype.setupEventListeners = function() {
        document.addEventListener('keydown', (event) => {
            this.handleKeyPress(event);
        });
        
                 // Prevent default behavior for game keys
        document.addEventListener('keydown', (event) => {
            const gameKeys = ['KeyH', 'KeyJ', 'KeyK', 'KeyL', 'KeyY', 'KeyU', 'KeyB', 'KeyN', 
                             'Period', 'KeyQ', 'Escape', 'KeyF'];
            if (gameKeys.includes(event.code)) {
                event.preventDefault();
            }
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            setTimeout(() => {
                this.renderer.initializeSize();
                this.renderer.initBuffer(); // Reinitialize buffer with new size
                this.render();
            }, 100);
        });
    };

    // Map key to 8-direction vector
    GameRef.prototype.getDirectionFromKey = function(event) {
        if (event.shiftKey) return null; // only lowercase movement keys
        switch (event.code) {
            case 'KeyK': return { dx: 0, dy: -1 };
            case 'KeyJ': return { dx: 0, dy: 1 };
            case 'KeyH': return { dx: -1, dy: 0 };
            case 'KeyL': return { dx: 1, dy: 0 };
            case 'KeyY': return { dx: -1, dy: -1 };
            case 'KeyU': return { dx: 1, dy: -1 };
            case 'KeyB': return { dx: -1, dy: 1 };
            case 'KeyN': return { dx: 1, dy: 1 };
        }
        return null;
    };

    GameRef.prototype.beginThrowDirectionSelection = function(selection) {
        // selection can be a letter (inventory) or { equipSlot: 'weapon'|'shield' }
        this.awaitingThrowDirection = typeof selection === 'string' ? { letter: selection } : selection;
        if (this.renderer) this.renderer.addLogMessage('Throw in which direction?');
    };

    GameRef.prototype.beginIgniteDirectionSelection = function() {
        this.awaitingIgniteDirection = true;
        if (this.renderer) this.renderer.addLogMessage('Ignite in which direction?');
    };

    GameRef.prototype.finishIgniteWithDirection = function(dx, dy) {
        this.awaitingIgniteDirection = false;
        if (!this.player || !this.dungeon) return;
        const tx = this.player.x + Math.sign(dx);
        const ty = this.player.y + Math.sign(dy);
        if (!this.dungeon.isInBounds(tx, ty)) {
            if (this.renderer) this.renderer.addLogMessage('Nothing happens.');
            return;
        }
        const t = this.dungeon.getTile(tx, ty);
        if (!t || t.type === 'wall' || (t.type === 'door' && t.doorState !== 'open')) {
            if (this.renderer) this.renderer.addLogMessage('You cannot ignite that.');
            return;
        }
        const wetBlood = t.blood || 0;
        let otherWet = 0;
        if (t.liquids) {
            for (const key of Object.keys(t.liquids)) {
                otherWet += Math.max(0, Math.floor(t.liquids[key] || 0));
            }
        }
        const totalWet = wetBlood + otherWet;

        if (totalWet >= 3) {
            // Very wet surface: heat is quenched into steam only.
            if (typeof this.dungeon.addGas === 'function') {
                const steamAmount = Math.max(1, Math.min(6, 1 + Math.floor(totalWet / 2)));
                this.dungeon.addGas(tx, ty, 'steam', steamAmount);
            }
            if (this.renderer && this.isTileVisible(tx, ty)) {
                this.renderer.addLogMessage('The wet surface hisses into steam, but does not catch fire.', 'normal');
            }
        } else {
            // Ignite: add heat (temperature-based). ~30 heat ≈ at fire threshold.
            if (typeof Temperature !== 'undefined' && Temperature.addHeat) {
                Temperature.addHeat(this.dungeon, tx, ty, 30);
            }
            if (totalWet > 0 && typeof this.dungeon.addGas === 'function') {
                this.dungeon.addGas(tx, ty, 'steam', 1);
            }
            if (this.renderer && this.isTileVisible(tx, ty)) {
                this.renderer.addLogMessage('You start a fire.', 'normal');
            }
        }
        this.postPlayerAction();
    };

    GameRef.prototype.finishThrowWithDirection = function(dx, dy) {
        const state = this.awaitingThrowDirection;
        this.awaitingThrowDirection = null;
        if (!state || !this.player) return;
        let projectile = null;
        if (state.equipSlot) {
            // Throw equipped weapon/shield directly
            const slot = state.equipSlot;
            const equipped = this.player.equipment && this.player.equipment[slot];
            if (!equipped) {
                if (this.renderer) this.renderer.addLogMessage('Nothing equipped there.', 'normal');
                return;
            }
            // Unequip to projectile, slot becomes empty
            this.player.equipment[slot] = null;
            projectile = equipped;
            // Update stats/weight after unequip
            this.player.updateCombatStats();
            this.player.updateCurrentWeight();
        } else {
            const item = this.player.getInventoryItem(state.letter);
            if (!item) {
                if (this.renderer) this.renderer.addLogMessage('No such item.', 'normal');
                return;
            }
            // Remove one unit (stack-aware)
            const removed = this.player.removeFromInventoryByLetter(state.letter, 1);
            if (!removed) {
                if (this.renderer) this.renderer.addLogMessage('You cannot throw that.', 'normal');
                return;
            }
            projectile = removed;
        }
        
        // Compute max range based on strength/dexterity and item weight
        const strMod = this.player.getClassicModifier(this.player.strength);
        const dexMod = this.player.getClassicModifier(this.player.dexterity);
        const baseRange = 4 + Math.max(0, strMod) + Math.max(0, dexMod);
        const singleWeight = (() => {
            if (typeof projectile.getEffectiveWeight === 'function') return projectile.getEffectiveWeight();
            if (typeof projectile.weight === 'number') return projectile.weight;
            return 1;
        })();
        const weight = singleWeight; // throwing one unit
        const weightPenalty = Math.max(0, Math.floor(weight));
        const maxRange = Math.max(2, baseRange - weightPenalty);
        
        this.resolveThrow(projectile, dx, dy, maxRange);
    };

    GameRef.prototype.resolveThrow = function(projectile, dx, dy, maxRange) {
        const startX = this.player.x;
        const startY = this.player.y;
        let x = startX;
        let y = startY;
        let lastFreeX = startX;
        let lastFreeY = startY;
        
        for (let step = 1; step <= maxRange; step++) {
            x += Math.sign(dx);
            y += Math.sign(dy);
            
            if (!this.dungeon.isInBounds(x, y)) break;
            const tile = this.dungeon.getTile(x, y);
            // Check collision with walls/closed doors
            if (tile.type === 'wall' || (tile.type === 'door' && tile.doorState !== 'open')) {
                // Hard collision for non-potion thrown items
                if (projectile.type !== 'potion') {
                    if ((projectile.type === 'weapon' || projectile.weaponDamage) && typeof projectile.takeDurabilityDamage === 'function') {
                        const broke = projectile.takeDurabilityDamage(1, 'thrown_wall');
                        if (broke && this.renderer) {
                            this.renderer.addBattleLogMessage(`Your ${projectile.name} breaks on the wall!`, 'warning');
                        }
                    }
                }
                break;
            }
            
            // Check hit monster
            const target = this.monsterSpawner.getMonsterAt(x, y);
            if (target) {
                // If potion: shatter and apply splash, do not drop item
                if (projectile.type === 'potion') {
                    this.handlePotionShatter(projectile, x, y, target);
                } else {
                    // Perform thrown to-hit check; on miss, continue flying past the target
                    const distance = Math.max(Math.abs(x - startX), Math.abs(y - startY));
                    const outcome = this.attemptThrownAttack(projectile, target, distance);
                    if (outcome.hit) {
                        // Non-potion items drop at the impact tile after a resolved hit
                        if (projectile.type === 'corpse') {
                            if (this.renderer) this.renderer.addBattleLogMessage('The corpse is destroyed on impact.', 'warning');
                        } else {
                            this.dropProjectileAt(projectile, x, y);
                        }
                        // Durability wear on thrown weapon on hit
                        if ((projectile.type === 'weapon' || projectile.weaponDamage) && typeof projectile.takeDurabilityDamage === 'function') {
                            const broke = projectile.takeDurabilityDamage(1, 'thrown_hit');
                            if (broke && this.renderer) {
                                this.renderer.addBattleLogMessage(`Your ${projectile.name} breaks on impact!`, 'warning');
                            }
                        }
                        this.postPlayerAction();
                        return;
                    } else {
                        // Miss: continue flight beyond this tile
                        lastFreeX = x; lastFreeY = y;
                        continue;
                    }
                }
                this.postPlayerAction();
                return;
            }
            
            // Tile is free, remember last
            lastFreeX = x; lastFreeY = y;
        }
        
        // No hit: if potion, shatter at landing; otherwise, drop on ground
        if (projectile.type === 'potion') {
            this.handlePotionShatter(projectile, lastFreeX, lastFreeY, null);
        } else if (projectile.type === 'corpse') {
            if (this.renderer) this.renderer.addLogMessage('The corpse splatters and is destroyed.', 'warning');
        } else {
            this.dropProjectileAt(projectile, lastFreeX, lastFreeY);
            // Durability wear on thrown item landing
            if ((projectile.type === 'weapon' || projectile.weaponDamage) && typeof projectile.takeDurabilityDamage === 'function') {
                const broke = projectile.takeDurabilityDamage(1, 'thrown_impact');
                if (broke && this.renderer) {
                    this.renderer.addBattleLogMessage(`Your ${projectile.name} breaks when it lands!`, 'warning');
                }
            }
            if (this.renderer) this.renderer.addLogMessage('You throw and it lands on the ground.');
        }
        this.postPlayerAction();
    };

    // Perform to-hit, detailed logging, damage + status resolution for thrown attacks
    GameRef.prototype.attemptThrownAttack = function(projectile, monster, distance) {
        // Build thrown to-hit (align baseline with melee toHit, swap STR with DEX)
        const base = this.player.toHit || 0;
        const dexMod = this.player.getClassicModifier(this.player.dexterity);
        const strMod = this.player.getClassicModifier(this.player.strength);
        const weight = (typeof projectile.getEffectiveWeight === 'function') ? projectile.getEffectiveWeight() : (projectile.weight || 1);
        const weightPenalty = -Math.floor(weight / 2);
        const rangePenalty = -Math.floor(Math.max(0, distance - 1) / 2); // -1 per 2 tiles beyond 1
        const weaponBonus = (projectile.toHitBonus && (projectile.type === 'weapon' || projectile.weaponType)) ? projectile.toHitBonus : 0;
        const thrownMods = (dexMod - strMod) + weightPenalty + rangePenalty + weaponBonus;
        const toHitThrown = base + thrownMods;
        
        // THAC0-style roll
        const naturalRoll = Math.floor(Math.random() * 20) + 1;
        const requiredRoll = monster.armorClass - toHitThrown;
        
        // Log attempt with breakdown (also when target is not visible)
        if (this.renderer) {
            const toHitText = toHitThrown >= 0 ? `+${toHitThrown}` : `${toHitThrown}`;
            const baseText = base >= 0 ? `+${base}` : `${base}`;
            const modsText = thrownMods >= 0 ? `+${thrownMods}` : `${thrownMods}`;
            const details = `range${distance}, w${Math.floor(weight)}`;
            const targetName = (this.fov && this.fov.isVisible(monster.x, monster.y)) ? monster.name : 'something';
            this.renderer.addBattleLogMessage(`You throw ${projectile.name} at ${targetName}... (${naturalRoll} vs ${requiredRoll}+ needed, AC ${monster.armorClass}, hit${toHitText} (base${baseText}, mods${modsText}), ${details})`);
        }
        
        if (naturalRoll < requiredRoll && naturalRoll !== 20) {
            if (this.renderer) this.renderer.addBattleLogMessage('Miss!');
            return { hit: false };
        }
        
        // Compute damage
        const isWeapon = projectile.type === 'weapon' || projectile.weaponDamage;
        let damage = 0;
        if (isWeapon) {
            const die = projectile.weaponDamage || 4;
            const roll = Math.floor(Math.random() * die) + 1;
            damage = Math.max(1, this.player.getClassicModifier(this.player.strength) + roll);
        } else if (projectile.type === 'food') {
            damage = 0;
        } else if (projectile.type === 'potion') {
            damage = 0; // handled elsewhere
        } else {
            const w = (typeof projectile.getTotalWeight === 'function') ? projectile.getTotalWeight() : weight;
            damage = Math.max(0, Math.floor(w));
        }
        
        // Critical on natural 20
        if (naturalRoll === 20 && damage > 0) {
            damage *= 2;
            if (this.renderer && this.fov && this.fov.isVisible(monster.x, monster.y)) this.renderer.addBattleLogMessage(`Critical hit! ${damage} damage!`, 'victory');
        } else if (damage > 0 && this.renderer && this.fov && this.fov.isVisible(monster.x, monster.y)) {
            this.renderer.addBattleLogMessage(`Hit! ${damage} damage!`);
        }
        
        // Penetration: half of weapon AP when thrown; otherwise 0
        const ap = (isWeapon && typeof projectile.penetration === 'number') ? Math.max(0, Math.floor(projectile.penetration / 2)) : 0;
        const dealt = monster.takeDamage(damage, ap);
        
        if (!monster.isAlive) {
            this.handleMonsterDefeated(monster, 'thrown');
            return { hit: true, killed: true, damage: dealt };
        }
        
        // Status effects from thrown weapons
        if (isWeapon && typeof calculateStatusEffectChance === 'function' && monster.statusEffects && damage > 0) {
            try {
                const weaponType = projectile.weaponType || 'thrown';
                const maxDamage = monster.maxHp;
                const possibleEffects = ['bleeding', 'stunned', 'fractured', 'poisoned', 'confused', 'paralyzed'];
                for (const effectType of possibleEffects) {
                    const effect = calculateStatusEffectChance(weaponType, effectType, damage, maxDamage);
                    if (effect && effect.chance > 0) {
                        const roll = Math.random();
                        if (roll < effect.chance) {
                            const duration = effect.baseDuration || 3;
                            const severity = effect.baseSeverity || 1;
                            monster.statusEffects.addEffect(effectType, duration, severity, 'thrown');
                            if (this.renderer && this.fov && this.fov.isVisible(monster.x, monster.y)) {
                                this.renderer.addBattleLogMessage(`The ${monster.name} is ${effectType}!`, 'warning');
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error applying thrown status effects:', error);
            }
        }
        
        return { hit: true, killed: false, damage: dealt };
    };

    // Shatter potion at impact and apply splash effects (radius 1)
    GameRef.prototype.handlePotionShatter = function(projectile, impactX, impactY, primaryTarget = null) {
        if (this.renderer && this.isTileVisible(impactX, impactY)) this.renderer.addLogMessage('The bottle shatters!');
        
        // Spill liquid on ground based on potion potency
        if (this.dungeon && typeof this.dungeon.addLiquid === 'function') {
            const baseSpill = projectile.healDice ? Math.max(1, Math.floor((rollDice(projectile.healDice) || 4) / 2)) : (projectile.healAmount ? Math.floor(projectile.healAmount / 2) : 2);
            // Center tile
            this.dungeon.addLiquid(impactX, impactY, 'potion', Math.min(5, baseSpill));
            // Neighbor tiles get small splash
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;
                    const x = impactX + dx;
                    const y = impactY + dy;
                    if (!this.dungeon.isInBounds(x, y)) continue;
                    this.dungeon.addLiquid(x, y, 'potion', 1);
                }
            }
        }

        // Determine primary effect amount
        let primaryAmount = 0;
        if (projectile.healDice) {
            primaryAmount = rollDice(projectile.healDice);
        } else if (projectile.healAmount) {
            primaryAmount = projectile.healAmount;
        }
        const splashAmount = Math.floor(primaryAmount / 2);
        
        const affectEntity = (entity, amount) => {
            if (!entity || amount <= 0) return;
            // Heal effect for healing potions
            if (entity === this.player) {
                const healed = this.player.heal(amount);
                if (healed > 0 && this.renderer) {
                    this.renderer.addBattleLogMessage(`You are splashed by ${projectile.name}. (+${healed} HP)`, 'heal');
                }
            } else {
                // Monster heal
                if (typeof entity.heal === 'function') {
                    const healed = entity.heal(amount);
                    if (healed > 0 && this.renderer && this.isTileVisible(entity.x, entity.y)) {
                        this.renderer.addBattleLogMessage(`${entity.name} is splashed by ${projectile.name}. (+${healed} HP)`, 'heal');
                    }
                }
            }
        };
        
        // Apply to primary target (full), otherwise to any entity on impact tile
        if (primaryTarget) {
            affectEntity(primaryTarget, primaryAmount);
            // If a monster was healed to death prevention not needed; if in future damaging potions are added,
            // unify defeat handling here as well.
        } else {
            // Check player on tile
            if (this.player.x === impactX && this.player.y === impactY) {
                affectEntity(this.player, primaryAmount);
            }
            const m = this.monsterSpawner.getMonsterAt(impactX, impactY);
            if (m) affectEntity(m, primaryAmount);
        }
        
        // Splash radius 1 around impact
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const x = impactX + dx;
                const y = impactY + dy;
                if (!this.dungeon.isInBounds(x, y)) continue;
                // If player in splash
                if (this.player.x === x && this.player.y === y) {
                    affectEntity(this.player, splashAmount);
                }
                const mon = this.monsterSpawner.getMonsterAt(x, y);
                if (mon) affectEntity(mon, splashAmount);
            }
        }
        // Potions are consumed; do not drop item
    };

        // Unified defeat handler for player-caused monster deaths (e.g., thrown items)
        GameRef.prototype.handleMonsterDefeated = function(monster, cause = 'player') {
        if (!monster || monster.isAlive) return;
        // EXP は廃止しているが、多重処理防止フラグはそのまま利用
        if (monster._xpGranted) return;
        monster._xpGranted = true;
        
        // Victory log unified with melee style
        if (this.renderer && this.fov && this.fov.isVisible(monster.x, monster.y)) {
            const monsterName = monster.name || 'the monster';
            this.renderer.addBattleLogMessage(`You defeat the ${monsterName}!`, 'victory');
        }
        
        // 経験値システムは廃止したので EXP は付与しない

        // Chance to leave a corpse based on death cause and monster type
        if (this.itemManager && typeof this.itemManager.addCorpse === 'function') {
            const corpseChance = this.calculateCorpseChance(monster, cause);
            if (Math.random() < corpseChance) {
                this.itemManager.addCorpse(monster);
                if (this.renderer && this.fov && this.fov.isVisible(monster.x, monster.y)) {
                    this.renderer.addBattleLogMessage('A corpse remains.', 'normal');
                }
            } else {
                if (this.renderer && this.fov && this.fov.isVisible(monster.x, monster.y)) {
                    const destroyMessages = [
                        'The body is utterly destroyed.',
                        'Nothing remains but a bloody mess.',
                        'The corpse is completely mangled.',
                        'Only scattered remains are left.'
                    ];
                    this.renderer.addBattleLogMessage(destroyMessages[Math.floor(Math.random() * destroyMessages.length)], 'normal');
                }
            }
        }

        // Spill blood at death location (off-screen as well)
        if (this.dungeon && typeof this.dungeon.addBlood === 'function') {
            // Amount based on monster max HP (capped)
            const amount = Math.max(1, Math.min(10, Math.floor((monster.maxHp || 6) / 4)));
            this.dungeon.addBlood(monster.x, monster.y, amount);
            // Occasionally spatter to nearby tiles randomly
            if (Math.random() < 0.4) {
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;
                        const nx = monster.x + dx;
                        const ny = monster.y + dy;
                        if (!this.dungeon.isInBounds(nx, ny)) continue;
                        const t = this.dungeon.getTile(nx, ny);
                        if (t.type !== 'floor') continue;
                        if (Math.random() < 0.5) {
                            this.dungeon.addBlood(nx, ny, Math.max(1, Math.floor(amount / 3)));
                            // Chance to splash into eyes of anyone standing there
                            const hitPlayer = (this.player.x === nx && this.player.y === ny);
                            const targetMonster = this.monsterSpawner.getMonsterAt(nx, ny);
                            if (Math.random() < 0.25) {
                                if (hitPlayer) {
                                    if (this.player.statusEffects) this.player.statusEffects.addEffect('blood_eyes', 2 + Math.floor(Math.random()*2), 1 + Math.floor(Math.random()*2), 'blood spatter');
                                    if (this.renderer && this.isTileVisible(nx, ny)) this.renderer.addLogMessage('Blood splashes into your eyes, obscuring your vision!', 'warning');
                                } else if (targetMonster && targetMonster.statusEffects) {
                                    targetMonster.statusEffects.addEffect('blood_eyes', 2 + Math.floor(Math.random()*2), 1 + Math.floor(Math.random()*2), 'blood spatter');
                                    if (this.renderer && this.isTileVisible(nx, ny)) this.renderer.addLogMessage(`Blood splashes into the ${targetMonster.name}'s eyes!`);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Pack morale: notify spawner so that pack may break and flee
        if (this.monsterSpawner && typeof this.monsterSpawner.processPackMoraleOnDeath === 'function') {
            this.monsterSpawner.processPackMoraleOnDeath(monster);
        }
    };

    /**
     * Calculate chance for corpse to remain based on death cause and monster type
     */
    GameRef.prototype.calculateCorpseChance = function(monster, cause) {
        let baseChance = 0.7; // Default 70% chance

        // Death cause modifiers
        switch (cause) {
            case 'player':
            case 'melee':
                baseChance = 0.8; // Normal melee combat leaves corpses more often
                break;
            case 'thrown':
                baseChance = 0.6; // Thrown objects can cause more damage
                break;
            case 'door':
                baseChance = 0.4; // Door slams can crush bodies
                break;
            case 'DoT':
                baseChance = 0.5; // Status effects can deteriorate the body
                break;
            default:
                baseChance = 0.7;
        }

        // Monster type modifiers
        const monsterType = monster.type || 'unknown';
        
        // Undead tend to crumble more easily
        if (['skeleton', 'zombie', 'lich', 'wraith', 'specter'].includes(monsterType)) {
            baseChance *= 0.6;
        }
        // Slimes and oozes rarely leave corpses
        else if (['slime', 'ooze', 'jelly'].includes(monsterType)) {
            baseChance *= 0.2;
        }
        // Constructs don't leave organic corpses
        else if (['golem', 'automaton', 'construct'].includes(monsterType)) {
            baseChance *= 0.1;
        }
        // Large creatures are harder to completely destroy
        else if (['dragon', 'giant', 'troll', 'ogre'].includes(monsterType)) {
            baseChance *= 1.3;
        }
        // Small creatures might be completely obliterated
        else if (['rat', 'bat', 'newt', 'gecko'].includes(monsterType)) {
            baseChance *= 0.7;
        }

        // Monster HP affects destruction chance (higher HP = more durable body)
        const hpRatio = (monster.maxHp || 6) / 20; // Normalize around 20 HP
        baseChance *= (0.7 + 0.3 * Math.min(2, hpRatio)); // 0.7x to 1.3x based on HP

        return Math.max(0.05, Math.min(0.95, baseChance)); // Cap between 5% and 95%
    };
    
    GameRef.prototype.dropProjectileAt = function(item, x, y) {
        // Place item on ground (merge if possible is out of scope now)
        item.x = x; item.y = y;
        this.itemManager.addItem(item);
    };
    
    GameRef.prototype.postPlayerAction = function() {
        // Noise from throwing similar to attack
        if (this.noiseSystem) this.noiseSystem.makeSound(this.player.x, this.player.y, this.noiseSystem.getPlayerActionSound('ATTACK', this.player));
        // Consume a turn and render
        this.processTurn();
        if (this.monsterSpawner && typeof this.monsterSpawner.removeDeadMonsters === 'function') {
            this.monsterSpawner.removeDeadMonsters();
        }
        this.render();
    };

    /**
     * Handle keyboard input
     */
    GameRef.prototype.handleKeyPress = function(event) {
        // If in a door selection state, handle it first and do not let it leak into next turn
        if (this.gameState === 'door_opening') {
            this.handleDoorOpeningInput(event);
            return;
        }
        if (this.gameState === 'door_closing') {
            this.handleDoorClosingInput(event);
            return;
        }

        // If awaiting throw direction, intercept direction keys
        if (this.awaitingThrowDirection) {
            const dir = this.getDirectionFromKey(event);
            if (dir) {
                event.preventDefault();
                this.finishThrowWithDirection(dir.dx, dir.dy);
                return;
            }
            if (event.code === 'Escape') {
                this.awaitingThrowDirection = null;
                if (this.renderer) this.renderer.addLogMessage('Throw cancelled.');
                return;
            }
        }
        // If awaiting ignite direction, intercept direction keys
        if (this.awaitingIgniteDirection) {
            const dir = this.getDirectionFromKey(event);
            if (dir) {
                event.preventDefault();
                this.finishIgniteWithDirection(dir.dx, dir.dy);
                return;
            }
            if (event.code === 'Escape') {
                this.awaitingIgniteDirection = false;
                if (this.renderer) this.renderer.addLogMessage('Ignite cancelled.');
                return;
            }
        }
        // If awaiting disarm direction, read one step direction and disarm there
        if (this.awaitingDisarmDirection) {
            const dir = this.getDirectionFromKey(event);
            if (dir) {
                event.preventDefault();
                const tx = this.player.x + dir.dx;
                const ty = this.player.y + dir.dy;
                const key = `${tx},${ty}`;
                if (this.awaitingDisarmDirection.has(key)) {
                    this.awaitingDisarmDirection = null;
                    this.disarmTrapAt(tx, ty);
                    return;
                } else {
                    // Direction chosen but no trap there; cancel
                    this.awaitingDisarmDirection = null;
                    if (this.renderer) this.renderer.addLogMessage('No revealed trap in that direction.');
                    return;
                }
            }
            if (event.code === 'Escape') {
                this.awaitingDisarmDirection = null;
                if (this.renderer) this.renderer.addLogMessage('Disarm cancelled.');
                return;
            }
        }
        // Block input if sub-window is open
        if (window.subWindow && window.subWindow.isOpen) {
            return;
        }
        
        // Block input if map is open (except for map toggle and ESC)
        if (window.mapView && window.mapView.isOpen) {
            if (event.code === 'KeyM' || event.code === 'Escape') {
                // Allow map toggle and ESC to close
                if (event.code === 'KeyM' && !event.shiftKey) {
                    event.preventDefault();
                    window.mapView.hide();
                }
                return;
            }
            // Block all other input when map is open
            return;
        }
        
        // Safety check - ensure game is properly initialized
        if (!this.player || !this.dungeon) {
            return;
        }
        
        // Only allow restart when dead
        if (this.gameState === 'dead') {
            if (event.code === 'Enter') {
                this.restartGame();
            }
            return;
        }
        
        // Throttle input
        const now = Date.now();
        if (now - this.lastKeyTime < this.keyDelay) {
            return;
        }
        this.lastKeyTime = now;
        
        // Check for monster detection if auto-stop is enabled (only during key repeat)
        if (this.autoStopEnabled && event.repeat && this.shouldStopForMonsterDetection()) {
            return; // Stop processing input if new monster detected during continuous movement
        }
        
        if (this.gameState === 'door_closing') {
            this.handleDoorClosingInput(event);
            return;
        }

        if (this.gameState === 'door_opening') {
            this.handleDoorOpeningInput(event);
            return;
        }

        if (this.gameState !== 'playing') {
            return;
        }
        
        let playerMoved = false;
        
                 switch (event.code) {
            // Movement (vi keys) - lowercase
            case 'KeyK':
                if (!event.shiftKey) {
                    playerMoved = this.movePlayer(0, -1);
                }
                break;
            case 'KeyJ':
                if (!event.shiftKey) {
                    playerMoved = this.movePlayer(0, 1);
                }
                break;
            case 'KeyH':
                if (!event.shiftKey) {
                    playerMoved = this.movePlayer(-1, 0);
                }
                break;
            case 'KeyL':
                if (!event.shiftKey) {
                    playerMoved = this.movePlayer(1, 0);
                } else {
                    // Shift+L: toggle hand-held light source on/off
                    event.preventDefault();
                    if (this.player && this.player.equipment && this.player.equipment.light) {
                        this.player.lightActive = !this.player.lightActive;
                        if (this.renderer) {
                            if (this.player.lightActive) {
                                this.renderer.addLogMessage('You ignite your light source.', 'normal');
                            } else {
                                this.renderer.addLogMessage('You douse your light source.', 'normal');
                            }
                        }
                        // 視界が変わるのでFOVと描画を即更新
                        this.updateFOV();
                        this.render();
                    } else if (this.renderer) {
                        this.renderer.addLogMessage('You have no light source equipped.', 'normal');
                    }
                }
                break;
            // Diagonal movement (vi keys) - lowercase
            case 'KeyY':
                if (!event.shiftKey) {
                    playerMoved = this.movePlayer(-1, -1);
                }
                break;
            case 'KeyU':
                if (!event.shiftKey) {
                    playerMoved = this.movePlayer(1, -1);
                }
                break;
            case 'KeyB':
                if (!event.shiftKey) {
                    playerMoved = this.movePlayer(-1, 1);
                } else {
                    // Shift+B: Bury – open menu to choose target (corpses, items, liquids, inventory)
                    event.preventDefault();
                    if (window.subWindow) {
                        window.subWindow.showBuryMenu();
                    }
                }
                break;
            case 'KeyN':
                if (!event.shiftKey) {
                    playerMoved = this.movePlayer(1, 1);
                }
                break;
                
            // Actions - lowercase (Period handled in LEVEL MOVEMENT section)
            case 'KeyO':
                // Open door - lowercase o
                if (!event.shiftKey) {
                    event.preventDefault();
                    this.openDoorAction();
                }
                break;
            case 'KeyC':
                // Close door - lowercase c
                if (!event.shiftKey) {
                    event.preventDefault();
                    this.closeDoorAction();
                }
                break;
                
            // Inventory and equipment commands - lowercase
            case 'KeyG':
                // Get/pick up item - lowercase g
                if (!event.shiftKey) {
                    event.preventDefault();
                    playerMoved = this.pickupItem();
                }
                break;
            case 'KeyD':
                // Shift+D: Disarm trap at current tile
                if (event.shiftKey) {
                    event.preventDefault();
                    this.attemptDisarmTrap();
                } else {
                    // Drop item - lowercase d
                    event.preventDefault();
                    this.dropItem();
                }
                break;
            case 'KeyF':
                // Shift+F: Ignite fire in a direction
                if (event.shiftKey) {
                    event.preventDefault();
                    // Require an equipped fire-handling light source (torch, etc.)
                    const lightItem = this.player && this.player.equipment ? this.player.equipment.light : null;
                    const hasFireTool = lightItem && lightItem.type === 'light';
                    if (!hasFireTool) {
                        if (this.renderer) {
                            this.renderer.addLogMessage('You need a torch or similar fire source equipped to ignite anything.');
                        }
                        return;
                    }
                    this.beginIgniteDirectionSelection();
                }
                break;
            case 'KeyI':
                // Show inventory - lowercase i
                if (!event.shiftKey) {
                    event.preventDefault();
                    this.showInventory();
                }
                break;
            case 'KeyE':
                if (event.shiftKey) {
                    // Eat food - uppercase E (Shift+E) - open food selection menu
                    event.preventDefault();
                    this.showFoodMenu();
                } else {
                    // Show equipment - lowercase e
                    event.preventDefault();
                    this.showEquipment();
                }
                break;
            case 'KeyM':
                // Show map - lowercase m
                if (!event.shiftKey) {
                    event.preventDefault();
                    if (window.mapView) {
                        window.mapView.toggle(this);
                    }
                }
                break;
            case 'KeyS':
                // Search - lowercase s (active trap detection)
                if (!event.shiftKey) {
                    event.preventDefault();
                    this.searchAction(2, 15);
                } else {
                    // Save (Shift+S) remains below in system commands
                }
                break;
            case 'KeyW':
                // Wear/wield any equipment - lowercase w
                if (!event.shiftKey) {
                    event.preventDefault();
                    this.showEquipmentMenu();
                }
                break;
            case 'KeyT':
                if (event.shiftKey) {
                    // Take off equipment - uppercase T (Shift+T)
                    event.preventDefault();
                    this.showUnequipMenu();
                } else {
                    // Throw item - lowercase t
                    event.preventDefault();
                    if (window.subWindow) {
                        window.subWindow.showThrowSelectionMenu(this.player);
                    }
                }
                break;
                
            // === LEVEL MOVEMENT ===
            case 'Period':
            case 'Comma':
                // Stairs movement: > (Shift+Period) down, < (Shift+Comma) up
                if (event.shiftKey) {
                    event.preventDefault();
            
                    if (event.code === 'Period') {
                        // > key - go down stairs
            
                        this.goDownStairs();
                    } else if (event.code === 'Comma') {
                        // < key - go up stairs  
            
                        this.goUpStairs();
                    }
                } else if (event.code === 'Period') {
                    // . key - wait/rest (lowercase)
                    event.preventDefault();
            
                    const playerMoved = this.player.rest();
                    if (playerMoved) {
                        this.processTurn();
                    }
                }
                break;
                
            // System commands - uppercase (Shift + key)
            case 'KeyQ':
                if (event.shiftKey) {
                    // Quit game - uppercase Q (Shift+Q)
                    event.preventDefault();
                    if (confirm('Are you sure you want to quit?')) {
                        this.quitGame();
                    }
                } else {
                    // Quaff potion - lowercase q
                    event.preventDefault();
                    this.showPotionMenu();
                }
                break;
            case 'KeyS':
                // Save game - uppercase S (Shift+S)
                if (event.shiftKey) {
                    event.preventDefault();
                    this.isManualSave = true; // Set flag for manual save
                    if (this.saveGame()) {
                        this.renderer.addLogMessage('Game saved successfully!');
                    } else {
                        this.renderer.addLogMessage('Failed to save game!');
                    }
                }
                break;
                
            // Special keys
            case 'Escape':
                // Pause/unpause
                this.togglePause();
                break;
        }
        
        // Process turn if player acted
        if (playerMoved) {
            this.processTurn();
        }
        
        // Check for immediate death after any action
        if (this.player.hp <= 0 && this.gameState === 'playing') {
            this.gameOver();
            return;
        }
        
        this.render();
    };

    /**
     * Move the player
     */
    GameRef.prototype.movePlayer = function(dx, dy) {
        // Safety check: ensure player exists
        if (!this.player) {
            return false;
        }
        
        // Safety check: ensure dungeon exists
        if (!this.dungeon) {
            return false;
        }
        
        const moved = this.player.tryMove(dx, dy, this.dungeon, this.monsterSpawner);
        
        // Remove dead monsters immediately after player action
        this.monsterSpawner.removeDeadMonsters();
        
        if (moved) {
            // Check for stairs
            const tile = this.dungeon.getTile(this.player.x, this.player.y);
            // Trap interaction: if hidden trap present, chance to notice; if revealed and armed, it triggers handled in player.tryMove
            if (tile.trap && !tile.trap.disarmed) {
                // Attempt auto-detect upon stepping on hidden trap
                if (!tile.trap.revealed) {
                    this.playerDetectsTrapAt(this.player.x, this.player.y);
                }
            }
            if (tile.type === 'stairs_down' || tile.type === 'stairs_up') {
                this.describeStairs();
            }
            
            // Check for items at player position
            this.checkItemsAtPlayerPosition();
        }
        
        return moved;
    };
})();

