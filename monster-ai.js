/**
 * Monster AI - prototype extensions for Monster (flee, wake, energy, combat)
 * Load after monster.js. Non-destructive: originals remain in monster.js until verified.
 */
(function() {
    if (typeof Monster === 'undefined') {
        console.error('Monster class not found for monster-ai.');
        return;
    }
    const M = Monster;

    M.prototype.getMonsterSpeed = function(type, stats) {
        let speed = 100;
        const fastFlyers = ['bat', 'hawk', 'eagle'];
        if (fastFlyers.includes(type)) speed = 120;
        const quickCreatures = ['rat', 'gecko', 'newt', 'stirge', 'shrew'];
        if (quickCreatures.includes(type)) speed = 110;
        if (type === 'stirge') speed = 125;
        const slowCreatures = ['bear', 'troll', 'giant', 'cave_snail'];
        if (slowCreatures.includes(type)) speed = type === 'cave_snail' ? 55 : 80;
        if (stats.minDepth >= 8) speed = Math.max(speed - 20, 60);
        switch (type) {
            case 'centipede': speed = 130; break;
            case 'snake': speed = 115; break;
            case 'spider': speed = 105; break;
            case 'zombie': speed = 70; break;
            case 'skeleton': speed = 90; break;
            case 'cave_snail': speed = 55; break;
            case 'stirge': speed = 125; break;
            case 'scorpion': speed = 95; break;
            case 'giant_frog': speed = 100; break;
            case 'carrion_crow': speed = 110; break;
        }
        return speed;
    };

    M.prototype.setIntelligenceByType = function(type, stats) {
        const mindless = ['ant', 'centipede', 'spider', 'floating_eye', 'rust_monster', 'slime', 'mushroom_spore', 'cave_snail'];
        const animals = ['bat', 'rat', 'gecko', 'jackal', 'wolf', 'bear', 'snake', 'wyvern', 'purple_worm', 'cave_fish', 'cave_beetle', 'cave_moth', 'glow_worm', 'cave_cricket', 'blind_salamander', 'shrew', 'frog', 'scorpion', 'stirge', 'giant_frog', 'carrion_crow'];
        const normal = ['kobold', 'goblin', 'orc', 'dwarf', 'elf', 'hobgoblin', 'gnoll', 'lizardman', 'centaur'];
        const smart = ['ogre', 'troll', 'minotaur', 'vampire', 'umber_hulk', 'giant', 'ettin', 'medusa'];
        const genius = ['dragon', 'lich', 'balrog', 'jabberwock', 'sphinx', 'frost_giant'];
        if (mindless.includes(type)) {
            this.intelligence = 'mindless';
            this.fleeThreshold = 0;
        } else if (animals.includes(type)) {
            this.intelligence = 'animal';
            this.fleeThreshold = 0.2;
        } else if (normal.includes(type)) {
            this.intelligence = 'normal';
            this.fleeThreshold = 0.25;
        } else if (smart.includes(type)) {
            this.intelligence = 'smart';
            this.fleeThreshold = 0.35;
        } else if (genius.includes(type)) {
            this.intelligence = 'genius';
            this.fleeThreshold = 0.4;
        } else {
            this.intelligence = 'normal';
            this.fleeThreshold = 0.25;
        }
        if (type === 'skeleton' || type === 'zombie') {
            this.intelligence = 'mindless';
            this.fleeThreshold = 0;
        } else if (type === 'leprechaun') {
            this.intelligence = 'smart';
            this.fleeThreshold = 0.5;
        }
    };

    M.prototype.checkFleeCondition = function() {
        if (this.intelligence === 'mindless' || this.fleeThreshold === 0) return false;
        const hpRatio = this.hp / this.maxHp;
        if (hpRatio <= this.fleeThreshold && !this.isFleeing) {
            this.isFleeing = true;
            this.fleeTimer = 0;
            if (window.game && window.game.fov && window.game.player) {
                const canSee = window.game.fov.canSee(
                    window.game.player.x, window.game.player.y,
                    this.x, this.y,
                    window.game.player.sightRange || 8
                );
                if (canSee && window.game.renderer) {
                    const personalityMessages = this.getFleeMessage();
                    const message = personalityMessages[Math.floor(Math.random() * personalityMessages.length)];
                    window.game.renderer.addLogMessage(message);
                }
            }
            return true;
        }
        if (this.isFleeing) {
            this.fleeTimer++;
            const adjustedDuration = this.fleeDuration * this.fleeStamina;
            const isExhausted = this.fleeTimer >= adjustedDuration;
            const courageCheck = Math.random() < this.returnCourage;
            if (isExhausted || courageCheck || hpRatio > this.fleeThreshold + 0.15) {
                this.isFleeing = false;
                this.fleeTimer = 0;
                if (window.game && window.game.fov && window.game.player) {
                    const canSee = window.game.fov.canSee(
                        window.game.player.x, window.game.player.y,
                        this.x, this.y,
                        window.game.player.sightRange || 8
                    );
                    if (canSee && window.game.renderer) {
                        const returnMessage = this.getReturnMessage(isExhausted, courageCheck);
                        window.game.renderer.addLogMessage(returnMessage);
                    }
                }
                return false;
            }
        }
        return this.isFleeing;
    };

    M.prototype.getFleeMessage = function() {
        switch (this.fleePersonality) {
            case 'cowardly':
                return [`${this.name} squeaks in terror and flees!`, `${this.name} whimpers and runs away in panic!`, `${this.name} cowers and tries to escape!`];
            case 'brave':
                return [`${this.name} reluctantly retreats!`, `${this.name} makes a tactical withdrawal!`, `${this.name} pulls back, but looks ready to return!`];
            case 'cunning':
                return [`${this.name} strategically withdraws!`, `${this.name} slips away cleverly!`, `${this.name} makes a calculated retreat!`];
            case 'panicked':
                return [`${this.name} panics and flees wildly!`, `${this.name} scurries away in confusion!`, `${this.name} runs around frantically!`];
            case 'persistent':
                return [`${this.name} begins a long retreat!`, `${this.name} starts fleeing steadily!`, `${this.name} moves away with determination!`];
            case 'reckless':
                return [`${this.name} backs off momentarily!`, `${this.name} makes a brief retreat!`, `${this.name} steps back, snarling!`];
            default:
                return [`${this.name} looks terrified and tries to flee!`, `${this.name} turns and runs away!`, `${this.name} attempts to escape!`];
        }
    };

    M.prototype.getReturnMessage = function(exhausted, courageous) {
        if (exhausted) {
            switch (this.fleePersonality) {
                case 'cowardly': return `${this.name} can't run any further and turns to fight!`;
                case 'persistent': return `${this.name} finally stops running and faces you!`;
                default: return `${this.name} is too tired to flee and turns around!`;
            }
        } else if (courageous) {
            switch (this.fleePersonality) {
                case 'brave': return `${this.name} regains courage and charges back!`;
                case 'reckless': return `${this.name} can't resist fighting and returns!`;
                case 'cunning': return `${this.name} finds an opportunity and re-engages!`;
                default: return `${this.name} decides to stand and fight!`;
            }
        } else {
            return `${this.name} stops fleeing and turns around!`;
        }
    };

    M.prototype.setFleePersonalityByType = function(type, stats) {
        const cowardly = ['rat', 'gecko', 'goblin', 'newt'];
        const brave = ['dwarf', 'elf', 'minotaur', 'centaur', 'giant'];
        const cunning = ['kobold', 'leprechaun', 'dragon', 'lich', 'sphinx', 'vampire'];
        const panicked = ['ant', 'spider', 'centipede', 'floating_eye'];
        const persistent = ['wolf', 'bear', 'jackal', 'wyvern', 'purple_worm'];
        const reckless = ['orc', 'troll', 'ogre', 'hobgoblin', 'gnoll', 'ettin'];
        if (cowardly.includes(type)) {
            this.fleePersonality = 'cowardly';
            this.fleeThreshold = Math.max(this.fleeThreshold - 0.05, 0.15);
            this.fleeDuration = 15;
            this.fleeStamina = 0.8;
            this.fleeStyle = 'direct';
            this.returnCourage = 0.1;
        } else if (brave.includes(type)) {
            this.fleePersonality = 'brave';
            this.fleeThreshold = Math.min(this.fleeThreshold + 0.1, 0.5);
            this.fleeDuration = 5;
            this.fleeStamina = 1.5;
            this.fleeStyle = 'direct';
            this.returnCourage = 0.8;
        } else if (cunning.includes(type)) {
            this.fleePersonality = 'cunning';
            this.fleeDuration = 12;
            this.fleeStamina = 1.2;
            this.fleeStyle = 'evasive';
            this.returnCourage = 0.3;
        } else if (panicked.includes(type)) {
            this.fleePersonality = 'panicked';
            this.fleeDuration = 8;
            this.fleeStamina = 0.6;
            this.fleeStyle = 'random';
            this.returnCourage = 0.4;
        } else if (persistent.includes(type)) {
            this.fleePersonality = 'persistent';
            this.fleeDuration = 20;
            this.fleeStamina = 1.8;
            this.fleeStyle = 'direct';
            this.returnCourage = 0.15;
        } else if (reckless.includes(type)) {
            this.fleePersonality = 'reckless';
            this.fleeDuration = 3;
            this.fleeStamina = 1.0;
            this.fleeStyle = 'direct';
            this.returnCourage = 0.9;
        } else {
            this.fleePersonality = 'normal';
            this.fleeDuration = 10;
            this.fleeStamina = 1.0;
            this.fleeStyle = 'direct';
            this.returnCourage = 0.5;
        }
        if (type === 'balrog' || type === 'jabberwock') {
            this.fleePersonality = 'reckless';
            this.returnCourage = 0.95;
        } else if (type === 'medusa') {
            this.fleePersonality = 'cunning';
            this.fleeStyle = 'evasive';
        } else if (type === 'rust_monster') {
            this.fleePersonality = 'persistent';
            this.fleeDuration = 25;
        }
        const currentDepth = stats.minDepth || 1;
        const depthLevel = Math.floor(currentDepth / 5);
        this.fleeDuration += depthLevel;
        this.fleeStamina += depthLevel * 0.1;
    };

    M.prototype.gainEnergy = function() {
        this.energy += this.speed;
    };

    M.prototype.canAct = function() {
        return this.energy >= this.energyToAct;
    };

    M.prototype.spendEnergy = function(amount = null) {
        const cost = amount || this.energyToAct;
        this.energy = Math.max(0, this.energy - cost);
    };

    M.prototype.wakeUp = function(reason = 'unknown') {
        if (this.isAsleep) {
            this.isAsleep = false;
            this.hasEverWokenUp = true;
            this.justWokeUp = true;
            if (reason !== 'silent' && window.game && window.game.noiseSystem) {
                window.game.noiseSystem.makeSound(this.x, this.y, window.game.noiseSystem.getMonsterActionSound('MONSTER_WAKE'));
            }
            if (window.game && window.game.renderer && reason !== 'silent') {
                const canPlayerSeeMonster = window.game.fov &&
                    window.game.fov.canSee(window.game.player.x, window.game.player.y, this.x, this.y, window.game.fov.viewRange);
                if (canPlayerSeeMonster) {
                    const messages = {
                        'proximity': `${this.name} wakes up!`,
                        'damage': `${this.name} wakes up from the pain!`,
                        'noise': `${this.name} is startled awake!`,
                        'natural': `${this.name} stirs and wakes up.`
                    };
                    const message = messages[reason] || `${this.name} wakes up!`;
                    window.game.renderer.addLogMessage(message);
                }
            }
        }
    };

    M.prototype.checkWakeUpConditions = function(playerX, playerY) {
        if (!this.isAsleep) return;
        const dx = Math.abs(this.x - playerX);
        const dy = Math.abs(this.y - playerY);
        const distance = Math.max(dx, dy);
        if (distance <= this.wakeUpDistance) {
            this.wakeUp('proximity');
            return;
        }
        let naturalWakeChance = 0;
        switch (this.sleepDepth) {
            case 'light': naturalWakeChance = 0.002; break;
            case 'normal': naturalWakeChance = 0.0005; break;
            case 'deep': naturalWakeChance = 0.0001; break;
        }
        if (Math.random() < naturalWakeChance) this.wakeUp('natural');
    };

    M.prototype.takeDamage = function(damage, penetration = 0) {
        if (this.isAsleep) this.wakeUp('damage');
        const naturalProtection = this.protection || 0;
        const effectiveProtection = Math.max(0, naturalProtection - penetration);
        const reducedDamage = Math.max(0, damage - effectiveProtection);
        const minimumDamage = Math.ceil(damage * 0.25);
        const finalDamage = Math.max(reducedDamage, minimumDamage);
        if (window.game && window.game.renderer && (naturalProtection > 0 || penetration > 0) && window.game.fov && window.game.fov.isVisible(this.x, this.y)) {
            const reductionPercent = Math.round((1 - finalDamage / damage) * 100);
            window.game.renderer.addBattleLogMessage(
                `${this.name} DR ${naturalProtection} vs AP ${penetration} = ${effectiveProtection} DR (${damage} → ${finalDamage}, ${reductionPercent}% reduced)`,
                'defense'
            );
        }
        this.hp -= finalDamage;
        if (this.statusEffects && this.statusEffects.hasEffect && this.statusEffects.hasEffect('sleep')) {
            this.statusEffects.removeEffect('sleep');
        }
        if (window.game && window.game.renderer && window.game.fov && window.game.fov.isVisible(this.x, this.y)) {
            const hpDisplay = this.hp <= 0 ? '0' : this.hp;
            if (finalDamage > 0) {
                window.game.renderer.addBattleLogMessage(`${this.name}: ${hpDisplay}/${this.maxHp} HP`, 'damage');
            } else {
                window.game.renderer.addBattleLogMessage(`${this.name} takes no damage!`, 'defense');
            }
        }
        if (this.hp <= 0) {
            this.hp = 0;
            this.isAlive = false;
        }
        return damage;
    };

    M.prototype.takeDirectDamage = function(damage) {
        this.hp = Math.max(0, this.hp - damage);
        if (window.game && window.game.renderer && window.game.fov && window.game.fov.isVisible(this.x, this.y)) {
            const hpDisplay = this.hp <= 0 ? '0' : this.hp;
            window.game.renderer.addBattleLogMessage(`${this.name}: ${hpDisplay}/${this.maxHp} HP`, 'damage');
        }
        if (this.hp <= 0) {
            this.hp = 0;
            this.isAlive = false;
        }
        return damage;
    };

    M.prototype.attackPlayer = function(player) {
        const naturalRoll = Math.floor(Math.random() * 20) + 1;
        const requiredRoll = player.armorClass - this.toHit;
        if (window.game && window.game.renderer && window.game.fov && window.game.fov.isVisible(this.x, this.y)) {
            window.game.renderer.addBattleLogMessage(`${this.name} attacks... (${naturalRoll} vs ${requiredRoll}+ needed, AC ${player.armorClass})`);
        }
        if (naturalRoll >= requiredRoll) {
            const baseDamage = this.damage + Math.floor(Math.random() * this.weaponDamage) + 1;
            let finalDamage = baseDamage;
            if (naturalRoll === 20) {
                finalDamage = baseDamage * 2;
                if (window.game && window.game.renderer && window.game.fov && window.game.fov.isVisible(this.x, this.y)) {
                    window.game.renderer.addBattleLogMessage(`Critical hit! ${finalDamage} damage!`, 'damage');
                }
            } else {
                if (window.game && window.game.renderer && window.game.fov && window.game.fov.isVisible(this.x, this.y)) {
                    window.game.renderer.addBattleLogMessage(`Hit! ${finalDamage} damage!`);
                }
            }
            const playerDied = player.takeDamage(finalDamage, this.penetration || 0);
            if (finalDamage > 0 && player.statusEffects && player.hp > 0) {
                if (typeof calculateStatusEffectChance === 'function') {
                    const monsterWeaponType = this.getMonsterWeaponType();
                    const maxDamage = player.maxHp;
                    const possibleEffects = ['bleeding', 'stunned', 'fractured', 'poisoned'];
                    for (const effectType of possibleEffects) {
                        try {
                            if (effectType === 'poisoned' && this.type && ['snake', 'spider', 'centipede'].includes(this.type)) {
                                if (Math.random() < 0.3) {
                                    player.statusEffects.addEffect('poisoned', 5 + Math.floor(Math.random() * 5),
                                        Math.min(3, 1 + Math.floor(finalDamage / 5)), this.name);
                                }
                            } else {
                                const effect = calculateStatusEffectChance(monsterWeaponType, effectType, finalDamage, maxDamage);
                                if (effect) {
                                    player.statusEffects.addEffect(effect.type, effect.duration, effect.severity, this.name);
                                }
                            }
                        } catch (error) {
                            console.error(`Error applying status effect ${effectType} from ${this.name}:`, error);
                        }
                    }
                }
            }
            if (window.game && window.game.noiseSystem) {
                window.game.noiseSystem.makeSound(this.x, this.y, window.game.noiseSystem.getMonsterActionSound('MONSTER_ATTACK'));
            }
            return playerDied;
        } else {
            if (window.game && window.game.renderer) window.game.renderer.addBattleLogMessage(`Miss!`);
            if (window.game && window.game.noiseSystem) {
                window.game.noiseSystem.makeSound(this.x, this.y, window.game.noiseSystem.getMonsterActionSound('MONSTER_ATTACK'));
            }
            return false;
        }
    };

    /**
     * Monster attacks another monster (ecosystem: predator-prey, rival)
     * Returns true if target died.
     */
    M.prototype.attackMonster = function(targetMonster) {
        if (!targetMonster || !targetMonster.isAlive) return false;
        const naturalRoll = Math.floor(Math.random() * 20) + 1;
        const requiredRoll = targetMonster.armorClass - this.toHit;
        if (window.game && window.game.renderer && window.game.fov && window.game.fov.isVisible(this.x, this.y)) {
            window.game.renderer.addBattleLogMessage(`${this.name} attacks ${targetMonster.name}! (${naturalRoll} vs ${requiredRoll}+ needed)`);
        }
        if (naturalRoll >= requiredRoll) {
            const baseDamage = this.damage + Math.floor(Math.random() * this.weaponDamage) + 1;
            let finalDamage = baseDamage;
            if (naturalRoll === 20) {
                finalDamage = baseDamage * 2;
                if (window.game && window.game.renderer && window.game.fov && window.game.fov.isVisible(this.x, this.y)) {
                    window.game.renderer.addBattleLogMessage(`Critical hit! ${finalDamage} damage!`, 'damage');
                }
            } else if (window.game && window.game.renderer && window.game.fov && window.game.fov.isVisible(this.x, this.y)) {
                window.game.renderer.addBattleLogMessage(`Hit! ${finalDamage} damage to ${targetMonster.name}.`);
            }
            targetMonster.takeDirectDamage(finalDamage);
            if (window.game && window.game.noiseSystem) {
                window.game.noiseSystem.makeSound(this.x, this.y, window.game.noiseSystem.getMonsterActionSound('MONSTER_ATTACK'));
            }
            if (window.game && window.game.dungeon && finalDamage > 0) {
                window.game.dungeon.addBlood(targetMonster.x, targetMonster.y, Math.min(5, Math.ceil(finalDamage / 3)));
            }
            return !targetMonster.isAlive;
        } else {
            if (window.game && window.game.renderer && window.game.fov && window.game.fov.isVisible(this.x, this.y)) {
                window.game.renderer.addBattleLogMessage(`${this.name} misses ${targetMonster.name}!`);
            }
            if (window.game && window.game.noiseSystem) {
                window.game.noiseSystem.makeSound(this.x, this.y, window.game.noiseSystem.getMonsterActionSound('MONSTER_ATTACK'));
            }
            return false;
        }
    };

    M.prototype.getMonsterWeaponType = function() {
        const clawTypes = ['rat', 'bat', 'wolf', 'bear', 'gecko', 'wyvern', 'dragon', 'griffin'];
        const biteTypes = ['snake', 'spider', 'centipede', 'purple_worm', 'jackal'];
        const bashTypes = ['ogre', 'troll', 'giant', 'ettin', 'frost_giant', 'umber_hulk'];
        const slashTypes = ['orc', 'hobgoblin', 'gnoll', 'minotaur', 'balrog'];
        if (clawTypes.includes(this.type)) return 'dagger';
        if (biteTypes.includes(this.type)) return 'dagger';
        if (bashTypes.includes(this.type)) return 'hammer';
        if (slashTypes.includes(this.type)) return 'sword';
        return 'default';
    };
})();
