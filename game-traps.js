/**
 * Game trap and visibility helpers
 * Extracted from Game class for modularity.
 */
(function() {
    if (typeof Game === 'undefined') {
        console.error('Game class not found for trap helpers.');
        return;
    }

    const GameRef = Game;

    // Helper: is tile currently visible to the player?
    GameRef.prototype.isTileVisible = function(x, y) {
        return this.fov ? this.fov.isVisible(x, y) : false;
    };

    // Trap detection helper (DEX/WIS, level, vs trap.difficulty) with optional bonus/penalty
    GameRef.prototype.playerDetectsTrapAt = function(x, y, bonus = 0) {
        const tile = this.dungeon.getTile(x, y);
        if (!tile || tile.type !== 'floor' || !tile.trap) return false;
        if (tile.trap.disarmed) return false;
        if (tile.trap.revealed) return true;
        const dexMod = this.player.getClassicModifier(this.player.dexterity);
        const wisMod = this.player.getClassicModifier(this.player.wisdom);
        const base = 10 + (dexMod + wisMod) * 2 + this.player.level + bonus; // modest scaling
        const roll = Math.floor(Math.random() * 100) + 1;
        if (roll <= Math.max(5, base - tile.trap.difficulty)) {
            tile.trap.revealed = true;
            if (this.renderer) {
                const label = tile.trap && tile.trap.type ? `${tile.trap.type} trap` : 'trap';
                this.renderer.addLogMessage(`You detect a ${label}.`);
            }
            return true;
        }
        return false;
    };

    // Auto-detect nearby traps within radius with detection penalty (harder than active search)
    GameRef.prototype.autoDetectNearbyTraps = function(radius = 1, bonus = -10) {
        const px = this.player.x;
        const py = this.player.y;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const tx = px + dx, ty = py + dy;
                if (!this.dungeon.isInBounds(tx, ty)) continue;
                const tile = this.dungeon.getTile(tx, ty);
                if (!tile || tile.type !== 'floor' || !tile.trap || tile.trap.disarmed || tile.trap.revealed) continue;
                this.playerDetectsTrapAt(tx, ty, bonus);
            }
        }
    };

    // Active search command: reveal traps within radius with a detection bonus; consumes a turn
    GameRef.prototype.searchAction = function(radius = 2, bonus = 15) {
        let found = 0;
        const px = this.player.x, py = this.player.y;
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                const tx = px + dx, ty = py + dy;
                if (!this.dungeon.isInBounds(tx, ty)) continue;
                if (this.playerDetectsTrapAt(tx, ty, bonus)) {
                    found++;
                }
            }
        }
        if (this.renderer) {
            this.renderer.addLogMessage('You search carefully.');
            if (found > 0) {
                this.renderer.addBattleLogMessage(found === 1 ? 'You find a trap.' : `You find ${found} traps.`, 'victory');
            }
        }
        // Consume turn
        this.processTurn();
        this.render();
        return true;
    };

    // Trigger trap effects
    GameRef.prototype.triggerTrapAt = function(x, y, entity) {
        const tile = this.dungeon.getTile(x, y);
        if (!tile || tile.type !== 'floor' || !tile.trap || tile.trap.disarmed) return false;
        const trap = tile.trap;
        // Reveal on trigger
        trap.revealed = true;
        const isPlayer = (entity === this.player);
        const targetName = isPlayer ? 'you' : `the ${entity.name}`;
        if (this.renderer && (isPlayer || this.isTileVisible(x, y))) {
            const label = trap && trap.type ? `${trap.type} trap` : 'trap';
            this.renderer.addBattleLogMessage(`A ${label} is triggered!`, 'warning');
        }
        // Apply effects
        switch (trap.type) {
            case 'dart': {
                const dmg = 1 + Math.floor(Math.random() * 4); // 1d4
                entity.takeDirectDamage(dmg);
                if (this.renderer && (isPlayer || this.isTileVisible(x, y))) this.renderer.addBattleLogMessage(`A dart hits ${targetName} for ${dmg} damage!`, 'damage');
                // Check if monster died from trap damage
                if (!isPlayer && !entity.isAlive) {
                    this.handleMonsterDefeated(entity, 'trap');
                }
                break;
            }
            case 'snare': {
                if (entity.statusEffects) {
                    entity.statusEffects.addEffect('stunned', 2 + Math.floor(Math.random() * 3), 1, 'trap');
                }
                if (this.renderer && (isPlayer || this.isTileVisible(x, y))) this.renderer.addBattleLogMessage(`${isPlayer ? 'You are' : `The ${entity.name} is`} snared and stunned!`, 'damage');
                break;
            }
            case 'gas_poison': {
                // Gas cloud around the trap (radius 1) affects both player and monsters
                const affectEntity = (target) => {
                    if (!target) return;
                    if (target.statusEffects) {
                        target.statusEffects.addEffect('poisoned', 5 + Math.floor(Math.random() * 5), 1, 'trap');
                    }
                };
                for (let gy = y - 1; gy <= y + 1; gy++) {
                    for (let gx = x - 1; gx <= x + 1; gx++) {
                        if (!this.dungeon.isInBounds(gx, gy)) continue;
                        if (this.player.x === gx && this.player.y === gy) affectEntity(this.player);
                        const mon = this.monsterSpawner.getMonsterAt(gx, gy);
                        if (mon) affectEntity(mon);
                    }
                }
                if (this.renderer && (isPlayer || this.isTileVisible(x, y))) this.renderer.addBattleLogMessage('A poisonous gas cloud bursts from the trap!', 'warning');
                break;
            }
            case 'gas_confuse': {
                // Confusion gas cloud around the trap (radius 1) affects both player and monsters
                const affectEntity = (target) => {
                    if (!target) return;
                    if (target.statusEffects) {
                        target.statusEffects.addEffect('confused', 3 + Math.floor(Math.random() * 4), 1, 'trap');
                    }
                };
                for (let gy = y - 1; gy <= y + 1; gy++) {
                    for (let gx = x - 1; gx <= x + 1; gx++) {
                        if (!this.dungeon.isInBounds(gx, gy)) continue;
                        if (this.player.x === gx && this.player.y === gy) affectEntity(this.player);
                        const mon = this.monsterSpawner.getMonsterAt(gx, gy);
                        if (mon) affectEntity(mon);
                    }
                }
                if (this.renderer && (isPlayer || this.isTileVisible(x, y))) this.renderer.addBattleLogMessage('A dizzying gas cloud bursts from the trap!', 'warning');
                break;
            }
            case 'pit': {
                const dmg = 2 + Math.floor(Math.random() * 6); // 2-7
                entity.takeDirectDamage(dmg);
                if (entity.statusEffects) {
                    entity.statusEffects.addEffect('fractured', 4 + Math.floor(Math.random() * 4), 1, 'trap');
                }
                if (this.renderer && (isPlayer || this.isTileVisible(x, y))) this.renderer.addBattleLogMessage(`${isPlayer ? 'You fall' : `The ${entity.name} falls`} into a pit! ${dmg} damage and a fracture!`, 'damage');
                // Check if monster died from trap damage
                if (!isPlayer && !entity.isAlive) {
                    this.handleMonsterDefeated(entity, 'trap');
                }
                break;
            }
            case 'alarm': {
                if (this.noiseSystem) this.noiseSystem.makeSound(x, y, 'LOUD');
                if (this.renderer && (isPlayer || this.isTileVisible(x, y))) this.renderer.addLogMessage('An alarm rings loudly!', 'warning');
                break;
            }
            case 'sleep': {
                if (entity.statusEffects) {
                    entity.statusEffects.addEffect('sleep', 3 + Math.floor(Math.random() * 4), 1, 'trap');
                }
                if (this.renderer && (isPlayer || this.isTileVisible(x, y))) this.renderer.addBattleLogMessage(`A soporific mist makes ${targetName} drowsy!`, 'warning');
                break;
            }
        }
        return true;
    };

    // Compute probability [0,1] that a trap triggers when a MONSTER steps on it
    GameRef.prototype.computeTrapTriggerChanceForMonster = function(trap, monster) {
        // Base chance scaled by trap difficulty and type
        let base = 0.35 + (Math.min(100, Math.max(10, trap.difficulty)) - 30) / 200; // ~0.25..0.55
        switch (trap.type) {
            case 'pit': base += 0.10; break;
            case 'snare': base += 0.05; break;
            case 'alarm': base -= 0.05; break;
            default: break;
        }

        // Speed adjustment: faster monsters are less likely to trigger pressure/snap traps
        if (typeof monster.speed === 'number') {
            let speedAdj = (100 - monster.speed) / 400; // -0.25..+0.25 typical
            speedAdj = Math.max(-0.15, Math.min(0.15, speedAdj));
            base += speedAdj;
        }

        // Strength/mass proxy: stronger/heavier monsters are more likely to trigger
        if (typeof monster.strength === 'number') {
            let strAdj = (monster.strength - 10) * 0.01; // +/- 0.1 around STR 10
            // Pit traps are more sensitive to weight
            if (trap.type === 'pit') strAdj *= 1.5;
            strAdj = Math.max(-0.15, Math.min(0.15, strAdj));
            base += strAdj;
        }

        // Intelligence awareness: smarter monsters avoid traps slightly more
        const intelAdjMap = {
            mindless: 0.10,
            animal: 0.05,
            normal: 0.0,
            smart: -0.05,
            genius: -0.10
        };
        if (monster.intelligence && Object.prototype.hasOwnProperty.call(intelAdjMap, monster.intelligence)) {
            base += intelAdjMap[monster.intelligence];
        }

        // Species/type-based adjustments
        const type = (monster.type || '').toLowerCase();
        const flyers = new Set(['bat', 'hawk', 'eagle', 'wyvern']);
        const smallLight = new Set(['rat', 'gecko', 'newt']);
        const heavyBeasts = new Set(['bear', 'troll', 'giant', 'ogre']);
        const hovering = new Set(['floating_eye']);
        const arthropods = new Set(['spider', 'centipede']);

        if (flyers.has(type)) {
            base -= 0.10; // general agility over traps
            if (trap.type === 'pit') base -= 0.15; // flying mostly avoids pits
        }
        if (hovering.has(type)) {
            base -= 0.10;
            if (trap.type === 'pit') base -= 0.15; // floats over
        }
        if (smallLight.has(type)) {
            base -= 0.05; // light weight
        }
        if (heavyBeasts.has(type)) {
            base += 0.10;
            if (trap.type === 'pit') base += 0.10; // heavy falls more easily
        }
        if (arthropods.has(type)) {
            if (trap.type === 'snare') base += 0.05; // more legs to snag
            if (trap.type === 'pit') base -= 0.03; // lighter distribution
        }

        // Current condition modifiers
        if (monster.statusEffects) {
            const sev = (t) => (monster.statusEffects.getEffectSeverity ? monster.statusEffects.getEffectSeverity(t) : 0) || 0;
            const stunned = sev('stunned');
            const fractured = sev('fractured');
            const confused = monster.statusEffects.hasEffect && monster.statusEffects.hasEffect('confused');
            if (stunned > 0) base += 0.05 * stunned; // up to +0.15
            if (fractured > 0) base += 0.03 * fractured; // up to +0.09
            if (confused) base += 0.08; // inattentive movement
            // Just woke up from sleep → groggy
            if (monster.justWokeUp) base += 0.10;
        }

        // Fleeing monsters are careless
        if (monster.isFleeing) base += 0.05;

        // Clamp
        base = Math.max(0.05, Math.min(0.95, base));
        return base;
    };

    // Compute probability [0,1] that a trap triggers when stepped on
    GameRef.prototype.computeTrapTriggerChance = function(trap, player) {
        // Base chance scaled by trap difficulty and type
        let base = 0.35 + (Math.min(100, Math.max(10, trap.difficulty)) - 30) / 200; // ~0.25..0.55
        switch (trap.type) {
            case 'pit': base += 0.10; break;      // heavy footfalls more likely
            case 'snare': base += 0.05; break;    // slightly sensitive
            case 'alarm': base -= 0.05; break;    // less sensitive
            // dart/gas: leave base
        }
        // Encumbrance increases chance
        const enc = player.getEncumbranceLevel();
        const encAdd = {
            UNENCUMBERED: 0.00,
            BURDENED: 0.05,
            STRESSED: 0.10,
            STRAINED: 0.15,
            OVERTAXED: 0.25,
            OVERLOADED: 0.35
        }[enc.level] || 0.0;
        base += encAdd;

        // Dexterity reduces chance; negative DEX mod increases chance
        const dexMod = player.getClassicModifier(player.dexterity); // -3..+3
        base -= dexMod * 0.03;

        // Clamp
        base = Math.max(0.05, Math.min(0.95, base));
        return base;
    };

    // Disarm trap attempt (Shift+D)
    GameRef.prototype.attemptDisarmTrap = function() {
        // Build list of disarmable traps in 8-neighborhood (including current tile)
        const px = this.player.x;
        const py = this.player.y;
        const candidates = [];
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const tx = px + dx, ty = py + dy;
                if (!this.dungeon.isInBounds(tx, ty)) continue;
                const t = this.dungeon.getTile(tx, ty);
                if (t && t.type === 'floor' && t.trap && !t.trap.disarmed) {
                    // 解除は露見済みであること（NetHack/Angband系の安全性を意識）
                    if (t.trap.revealed) {
                        candidates.push({ x: tx, y: ty });
                    }
                }
            }
        }
        if (candidates.length === 0) {
            if (this.renderer) this.renderer.addLogMessage('There is no revealed trap adjacent.');
            return false;
        }
        if (candidates.length === 1) {
            return this.disarmTrapAt(candidates[0].x, candidates[0].y);
        }
        // Multiple candidates: prompt direction (use same vi-keys mapping)
        this.awaitingDisarmDirection = new Set(candidates.map(c => `${c.x},${c.y}`));
        if (this.renderer) this.renderer.addLogMessage('Disarm in which direction?');
        return true;
    };

    // Execute disarm sequence at target tile
    GameRef.prototype.disarmTrapAt = function(x, y) {
        const tile = this.dungeon.getTile(x, y);
        if (!tile || tile.type !== 'floor' || !tile.trap || tile.trap.disarmed) return false;
        tile.trap.revealed = true;
        const dexMod = this.player.getClassicModifier(this.player.dexterity);
        const wisMod = this.player.getClassicModifier(this.player.wisdom);
        const strMod = this.player.getClassicModifier(this.player.strength);
        const enc = this.player.getEncumbranceLevel();
        const encPenalty = enc.level === 'UNENCUMBERED' ? 0 : enc.level === 'BURDENED' ? -5 : enc.level === 'STRESSED' ? -10 : enc.level === 'STRAINED' ? -15 : enc.level === 'OVERTAXED' ? -25 : -35;
        const base = 30 + dexMod * 5 + wisMod * 2 - Math.max(0, -strMod) * 2 + encPenalty;
        const target = tile.trap.difficulty + 20;
        const roll = Math.floor(Math.random() * 100) + 1;
        if (this.renderer) {
            const label = tile.trap && tile.trap.type ? `${tile.trap.type} trap` : 'trap';
            this.renderer.addLogMessage(`You attempt to disarm the ${label}...`);
        }
        if (roll + base >= target) {
            tile.trap.disarmed = true;
            if (this.renderer) {
                const label = tile.trap && tile.trap.type ? `${tile.trap.type} trap` : 'trap';
                this.renderer.addBattleLogMessage(`You successfully disarm the ${label}.`, 'victory');
            }
        } else {
            if (Math.random() < 0.6) {
                const isAdjacent = !(this.player.x === x && this.player.y === y);
                this.triggerTrapOnDisarmFailure(x, y, this.player, isAdjacent);
            } else if (this.renderer) {
                const label = tile.trap && tile.trap.type ? `${tile.trap.type} trap` : 'trap';
                this.renderer.addBattleLogMessage(`You fail to disarm the ${label}.`, 'warning');
            }
        }
        this.processTurn();
        this.render();
        return true;
    };

    // Special handling when disarm from adjacent tiles fails
    GameRef.prototype.triggerTrapOnDisarmFailure = function(x, y, entity, isAdjacent) {
        const tile = this.dungeon.getTile(x, y);
        if (!tile || !tile.trap || tile.trap.disarmed) return false;
        const trap = tile.trap;
        trap.revealed = true;
        // If disarming on the same tile, behave as normal
        if (!isAdjacent) {
            return this.triggerTrapAt(x, y, entity);
        }
        // Adjacent failure: apply type-specific logic
        switch (trap.type) {
            case 'dart': {
                // Shoot a dart toward the disarmer (simple auto-hit)
                const dmg = 1 + Math.floor(Math.random() * 4); // 1d4
                entity.takeDirectDamage(dmg);
                if (this.renderer && this.isTileVisible(x, y)) this.renderer.addBattleLogMessage(`A dart shoots from the dart trap and hits you for ${dmg} damage!`, 'damage');
                break;
            }
            case 'snare': {
                // Foot-only: snapping harmlessly if not on the tile
                if (this.renderer && this.isTileVisible(x, y)) this.renderer.addLogMessage('The snare trap snaps harmlessly.');
                break;
            }
            case 'gas_poison': {
                // Gas cloud around the trap (radius 1)
                const affectEntity = (target) => {
                    if (!target) return;
                    if (target.statusEffects) {
                        target.statusEffects.addEffect('poisoned', 4 + Math.floor(Math.random() * 4), 1, 'trap');
                    }
                };
                for (let gy = y - 1; gy <= y + 1; gy++) {
                    for (let gx = x - 1; gx <= x + 1; gx++) {
                        if (!this.dungeon.isInBounds(gx, gy)) continue;
                        if (this.player.x === gx && this.player.y === gy) affectEntity(this.player);
                        const mon = this.monsterSpawner.getMonsterAt(gx, gy);
                        if (mon) affectEntity(mon);
                    }
                }
                if (this.renderer && this.isTileVisible(x, y)) this.renderer.addBattleLogMessage('A poisonous gas cloud bursts from the trap!', 'warning');
                break;
            }
            case 'gas_confuse': {
                // Confusion gas cloud around the trap (radius 1)
                const affectEntity = (target) => {
                    if (!target) return;
                    if (target.statusEffects) {
                        target.statusEffects.addEffect('confused', 2 + Math.floor(Math.random() * 3), 1, 'trap');
                    }
                };
                for (let gy = y - 1; gy <= y + 1; gy++) {
                    for (let gx = x - 1; gx <= x + 1; gx++) {
                        if (!this.dungeon.isInBounds(gx, gy)) continue;
                        if (this.player.x === gx && this.player.y === gy) affectEntity(this.player);
                        const mon = this.monsterSpawner.getMonsterAt(gx, gy);
                        if (mon) affectEntity(mon);
                    }
                }
                if (this.renderer && this.isTileVisible(x, y)) this.renderer.addBattleLogMessage('A dizzying gas cloud bursts from the trap!', 'warning');
                break;
            }
            case 'pit': {
                // Adjacent: stumble damage only (no fall)
                const dmg = 1 + Math.floor(Math.random() * 3); // 1d3
                entity.takeDirectDamage(dmg);
                if (this.renderer && this.isTileVisible(x, y)) this.renderer.addBattleLogMessage(`Loose ground near the pit trap crumbles! You take ${dmg} damage.`, 'damage');
                break;
            }
            case 'alarm': {
                if (this.noiseSystem) this.noiseSystem.makeSound(x, y, 'LOUD');
                if (this.renderer && this.isTileVisible(x, y)) this.renderer.addLogMessage('An alarm trap rings loudly!', 'warning');
                break;
            }
            default: {
                // Fallback to normal trigger
                return this.triggerTrapAt(x, y, entity);
            }
        }
        return true;
    };
})();

