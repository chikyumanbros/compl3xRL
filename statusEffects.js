/**
 * Status Effects System for Roguelike Game
 * Implements bleeding, stun, fracture and other conditions with saving throws
 */

class StatusEffect {
    constructor(type, duration, severity = 1, source = null) {
        this.type = type;
        this.duration = duration; // Turns remaining
        this.severity = severity; // 1-3 (light, moderate, severe)
        this.source = source; // What caused this effect
        this.turnsActive = 0; // How long has this been active
    }
    
    /**
     * Process the effect for one turn
     * Returns true if effect should continue, false if it expires
     */
    tick() {
        this.turnsActive++;
        this.duration--;
        return this.duration > 0;
    }
    
    /**
     * Get display information for this effect
     */
    getDisplayInfo() {
        const severityNames = ['light', 'moderate', 'severe'];
        return {
            name: this.type,
            severity: this.severity, // Keep as number for display
            severityName: severityNames[this.severity - 1], // Add separate name field
            duration: this.duration,
            description: this.getDescription()
        };
    }
    
    getDescription() {
        const descriptions = {
            bleeding: `Bleeding (${this.severity} dmg/turn)`,
            stunned: `Stunned (${this.severity * 25}% action penalty)`,
            fractured: `Fractured (${this.severity * 20}% speed penalty)`,
            poisoned: `Poisoned (${this.severity} dmg/turn)`,
            confused: `Confused (random movement)`,
            paralyzed: `Paralyzed (cannot act)`,
            sleep: `Asleep (cannot act)`
        };
        if (this.type === 'blood_eyes') {
            return `Eyes stung by blood (-${this.severity} to hit)`;
        }
        return descriptions[this.type] || this.type;
    }
}

class StatusEffectManager {
    constructor(entity) {
        this.entity = entity; // Player or Monster
        this.effects = new Map(); // Map of type -> StatusEffect
        this.immunities = new Set(); // Status types this entity is immune to
        
        // Base saving throw modifiers (can be overridden by entity)
        this.savingThrowBonus = 0;
    }
    
    /**
     * Add a new status effect
     */
    addEffect(type, duration, severity = 1, source = null) {
        // Check immunity
        if (this.immunities.has(type)) {
            return false;
        }
        
        // Check armor resistance (for players)
        if (this.entity && typeof this.entity.getStatusResistance === 'function') {
            const resistance = this.entity.getStatusResistance(type);
            if (resistance > 0) {
                // Roll to see if resistance prevents the effect
                const roll = Math.random() * 100;
                if (roll < resistance) {
                    // Resistance successful!
                    if (window.game && window.game.renderer) {
                        // Only log if player or visible
                        const isPlayer = (this.entity === window.game.player);
                        const isVisible = window.game.fov && this.entity && typeof this.entity.x === 'number' && typeof this.entity.y === 'number' && window.game.fov.isVisible(this.entity.x, this.entity.y);
                        if (isPlayer || isVisible) {
                        const entityName = this.entity.name || 'You';
                        const message = entityName === 'You' ? 
                            `Your armor resists the ${type} effect! (${Math.floor(resistance)}% resistance)` :
                            `${entityName} resists the ${type} effect!`;
                        window.game.renderer.addLogMessage(message, 'system');
                        }
                    }
                    return false;
                }
            }
        }
        
        // Check if already has this effect
        if (this.effects.has(type)) {
            const existing = this.effects.get(type);
            // Take the worse of the two
            if (severity > existing.severity) {
                existing.severity = severity;
            }
            if (duration > existing.duration) {
                existing.duration = duration;
            }
            return true;
        }
        
        // Create new effect
        const effect = new StatusEffect(type, duration, severity, source);
        this.effects.set(type, effect);
        
        // Immediate side-effect: spawn initial blood on effect start
        if (type === 'bleeding') {
            try {
                if (window.game && window.game.dungeon && this.entity && typeof this.entity.x === 'number' && typeof this.entity.y === 'number') {
                    // Small initial amount based on severity (1-3)
                    window.game.dungeon.addBlood(this.entity.x, this.entity.y, Math.max(1, severity));
                }
            } catch (e) {
                // fail-safe: ignore
            }
        }
        
        // Log the effect
        this.logEffectStart(type, severity);
        
        return true;
    }
    
    /**
     * Remove a status effect
     */
    removeEffect(type) {
        if (this.effects.has(type)) {
            this.effects.delete(type);
            this.logEffectEnd(type);
            return true;
        }
        return false;
    }
    
    /**
     * Check if entity has a specific effect
     */
    hasEffect(type) {
        return this.effects.has(type);
    }
    
    /**
     * Get severity of a specific effect
     */
    getEffectSeverity(type) {
        const effect = this.effects.get(type);
        return effect ? effect.severity : 0;
    }
    
    /**
     * Process all effects for one turn
     */
    processTurn() {
        const results = {
            damage: 0,
            messages: [],
            expired: []
        };
        
        // Process each effect
        for (const [type, effect] of this.effects) {
            // Apply effect
            const effectResult = this.applyEffect(type, effect);
            results.damage += effectResult.damage || 0;
            if (effectResult.message) {
                results.messages.push(effectResult.message);
            }
            
            // Tick duration
            if (!effect.tick()) {
                results.expired.push(type);
                // Add natural expiry message
                const target = this.entity === window.game?.player ? 'You' : `The ${this.entity?.name || 'monster'}`;
                const endMessages = {
                    bleeding: `${target} stopped bleeding.`,
                    stunned: `${target} recovered from stun.`,
                    fractured: `${target}'s fracture has healed.`,
                    poisoned: `${target} recovered from poison.`,
                    confused: `${target} regained clarity.`,
                    paralyzed: `${target} can move again.`
                };
                results.messages.push(endMessages[type] || `${target} recovered from ${type}.`);
            } else {
                // Attempt saving throw for recovery
                if (this.attemptSavingThrow(type, effect)) {
                    results.expired.push(type);
                    results.messages.push(`Recovered from ${type}!`);
                }
            }
        }
        
        // Remove expired effects (without logging - we'll handle messages later)
        for (const type of results.expired) {
            if (this.effects.has(type)) {
                this.effects.delete(type);
                // Don't call logEffectEnd here - let the caller handle the message order
            }
        }
        
        return results;
    }
    
    /**
     * Apply the actual effect for one turn
     */
    applyEffect(type, effect) {
        const result = { damage: 0, message: null };
        
        switch (type) {
            case 'bleeding':
                result.damage = effect.severity;
                if (Math.random() < 0.1) { // 10% chance to worsen
                    effect.severity = Math.min(3, effect.severity + 1);
                    result.message = "The bleeding worsens!";
                }
                break;
            case 'blood_eyes':
                // No HP damage; applied as to-hit penalty via condition modifier
                // Short-lived, decays naturally
                break;
                
            case 'poisoned':
                result.damage = effect.severity;
                break;
                
            case 'stunned':
                // Handled in action calculation
                break;
                
            case 'fractured':
                // Handled in movement calculation
                if (Math.random() < 0.05 * effect.severity) { // Chance to worsen
                    result.damage = 1;
                    result.message = "The fracture causes sharp pain!";
                }
                break;
                
            case 'confused':
                // Handled in movement
                break;
                
            case 'paralyzed':
                // Prevents all actions
                break;
            case 'sleep':
                // Prevents all actions until woken
                break;
        }
        
        return result;
    }
    
    /**
     * Attempt a saving throw to recover from effect
     * Based on D&D/Pathfinder saving throw mechanics
     */
    attemptSavingThrow(type, effect) {
        // Base difficulty based on severity and time
        const baseDC = 10 + (effect.severity * 3) - Math.floor(effect.turnsActive / 3);
        
        // Different stats affect different saves
        let saveBonus = this.savingThrowBonus;
        
        if (this.entity) {
            // Constitution-based saves (bleeding, poison, fracture)
            if (['bleeding', 'poisoned', 'fractured'].includes(type)) {
                saveBonus += Math.floor((this.entity.constitution - 10) / 2);
            }
            // Wisdom-based saves (stun, confusion, sleep)
            else if (['stunned', 'confused', 'sleep'].includes(type)) {
                saveBonus += Math.floor((this.entity.wisdom - 10) / 2);
            }
            // Strength-based saves (paralysis)
            else if (type === 'paralyzed') {
                saveBonus += Math.floor((this.entity.strength - 10) / 2);
            }
        }
        
        // Roll d20 + bonus
        const roll = Math.floor(Math.random() * 20) + 1 + saveBonus;
        
        // Natural 20 always succeeds, natural 1 always fails
        if (roll === 20 + saveBonus) return true;
        if (roll === 1 + saveBonus) return false;
        
        return roll >= baseDC;
    }
    
    /**
     * Get movement modifier from effects
     */
    getMovementModifier() {
        let modifier = 1.0;
        
        if (this.hasEffect('fractured')) {
            modifier *= (1 - 0.2 * this.getEffectSeverity('fractured')); // -20% per severity
        }
        
        if (this.hasEffect('paralyzed')) {
            modifier = 0; // Cannot move
        }
        if (this.hasEffect('sleep')) {
            modifier = 0; // Cannot move
        }
        
        if (this.hasEffect('stunned')) {
            modifier *= 0.5; // Half speed when stunned
        }
        
        return modifier;
    }
    
    /**
     * Get action success modifier from effects
     */
    getActionModifier() {
        let modifier = 1.0;
        
        if (this.hasEffect('stunned')) {
            modifier *= (1 - 0.25 * this.getEffectSeverity('stunned')); // -25% per severity
        }
        
        if (this.hasEffect('confused')) {
            modifier *= 0.5; // 50% chance to fail actions
        }
        
        if (this.hasEffect('paralyzed')) {
            modifier = 0; // Cannot act
        }
        if (this.hasEffect('sleep')) {
            modifier = 0; // Cannot act
        }
        
        return modifier;
    }
    
    /**
     * Check if movement should be randomized (confusion)
     */
    shouldRandomizeMovement() {
        return this.hasEffect('confused');
    }
    
    /**
     * Check if entity can act this turn
     */
    canAct() {
        return !this.hasEffect('paralyzed') && !this.hasEffect('sleep') && 
               (Math.random() < this.getActionModifier());
    }
    
    /**
     * Get all active effects for display
     */
    getActiveEffects() {
        const active = [];
        for (const [type, effect] of this.effects) {
            active.push(effect.getDisplayInfo());
        }
        return active;
    }
    
    /**
     * Clear all effects
     */
    clearAll() {
        this.effects.clear();
    }
    
    /**
     * Log effect start
     */
    logEffectStart(type, severity) {
        if (!window.game || !window.game.renderer) return;
        // Only log if player or visible
        const isPlayerEntity = (this.entity === window.game.player);
        const isVisibleEntity = window.game.fov && this.entity && typeof this.entity.x === 'number' && typeof this.entity.y === 'number' && window.game.fov.isVisible(this.entity.x, this.entity.y);
        if (!isPlayerEntity && !isVisibleEntity) return;
        
        const severityText = ['lightly', 'moderately', 'severely'][severity - 1];
        const target = this.entity === window.game.player ? 'You are' : `The ${this.entity.name || 'monster'} is`;
        
        const messages = {
            bleeding: `${target} ${severityText} bleeding!`,
            stunned: `${target} ${severityText} stunned!`,
            fractured: `${target} suffering from a ${severityText} fracture!`,
            poisoned: `${target} ${severityText} poisoned!`,
            confused: `${target} confused!`,
            paralyzed: `${target} paralyzed!`,
            sleep: `${target} falls asleep!`,
            blood_eyes: `${target} splashed in the eyes with blood!`
        };
        
        window.game.renderer.addLogMessage(messages[type] || `${target} affected by ${type}!`);
    }
    
    /**
     * Log effect end
     */
    logEffectEnd(type) {
        if (!window.game || !window.game.renderer) return;
        // Only log if player or visible
        const isPlayerEntity = (this.entity === window.game.player);
        const isVisibleEntity = window.game.fov && this.entity && typeof this.entity.x === 'number' && typeof this.entity.y === 'number' && window.game.fov.isVisible(this.entity.x, this.entity.y);
        if (!isPlayerEntity && !isVisibleEntity) return;
        
        const target = this.entity === window.game.player ? 'You' : `The ${this.entity.name || 'monster'}`;
        
        const messages = {
            bleeding: `${target} stopped bleeding.`,
            stunned: `${target} recovered from stun.`,
            fractured: `${target}'s fracture has healed.`,
            poisoned: `${target} recovered from poison.`,
            confused: `${target} regained clarity.`,
            paralyzed: `${target} can move again.`,
            sleep: `${target} wakes up.`,
            blood_eyes: `${target} wipes the blood from their eyes.`
        };
        
        window.game.renderer.addLogMessage(messages[type] || `${target} recovered from ${type}.`);
    }
}

/**
 * Weapon status effect configurations
 */
const WEAPON_STATUS_EFFECTS = {
    // Slashing weapons - high bleeding chance
    'sword': {
        bleeding: { chance: 0.25, severityRange: [1, 3] },
        fractured: { chance: 0.08, severityRange: [1, 2] }
    },
    
    // Piercing weapons - moderate bleeding, low stun
    'dagger': {
        bleeding: { chance: 0.15, severityRange: [1, 1] },
        poisoned: { chance: 0.10, severityRange: [1, 2] } // Daggers can be poisoned
    },
    'spear': {
        bleeding: { chance: 0.15, severityRange: [1, 2] },
        fractured: { chance: 0.10, severityRange: [1, 1] }
    },
    
    // Blunt weapons - high stun, high fracture, low bleeding
    'mace': {
        stunned: { chance: 0.25, severityRange: [1, 2] },
        fractured: { chance: 0.20, severityRange: [1, 2] },
        bleeding: { chance: 0.05, severityRange: [1, 1] }
    },
    'hammer': {
        stunned: { chance: 0.30, severityRange: [1, 3] },
        fractured: { chance: 0.25, severityRange: [1, 3] },
        bleeding: { chance: 0.02, severityRange: [1, 1] }
    },
    'staff': {
        stunned: { chance: 0.15, severityRange: [1, 2] },
        fractured: { chance: 0.10, severityRange: [1, 1] }
    },
    
    // Axes - balanced bleeding and fracture
    'axe': {
        bleeding: { chance: 0.25, severityRange: [2, 3] },
        fractured: { chance: 0.20, severityRange: [1, 2] },
        stunned: { chance: 0.10, severityRange: [1, 2] }
    },
    
    // Special weapons
    'whip': {
        stunned: { chance: 0.20, severityRange: [1, 2] },
        bleeding: { chance: 0.10, severityRange: [1, 1] }
    },
    'exotic': {
        stunned: { chance: 0.15, severityRange: [1, 2] },
        fractured: { chance: 0.15, severityRange: [1, 2] },
        bleeding: { chance: 0.10, severityRange: [1, 1] }
    },
    
    // Ranged weapons (minimal status effects)
    'bow': {
        bleeding: { chance: 0.05, severityRange: [1, 1] }
    },
    'crossbow': {
        bleeding: { chance: 0.08, severityRange: [1, 1] }
    },
    'thrown': {
        bleeding: { chance: 0.10, severityRange: [1, 1] }
    },
    
    // Default for unknown weapons
    'default': {
        bleeding: { chance: 0.10, severityRange: [1, 1] },
        stunned: { chance: 0.10, severityRange: [1, 1] }
    }
};

/**
 * Calculate status effect chance based on weapon and damage
 */
function calculateStatusEffectChance(weaponType, effectType, damageDealt, maxDamage) {
    const config = WEAPON_STATUS_EFFECTS[weaponType] || WEAPON_STATUS_EFFECTS.default;
    const effectConfig = config[effectType];
    
    if (!effectConfig) return null;
    
    // Base chance from weapon type
    let chance = effectConfig.chance;
    
    // Modify by damage dealt (critical hits more likely to cause effects)
    const damageRatio = damageDealt / Math.max(1, maxDamage);
    if (damageRatio > 0.8) {
        chance *= 1.5; // 50% bonus for high damage
    } else if (damageRatio < 0.3) {
        chance *= 0.5; // 50% penalty for low damage
    }
    
    // Roll for effect
    if (Math.random() < chance) {
        // Determine severity
        const [minSev, maxSev] = effectConfig.severityRange;
        let severity = minSev;
        
        if (maxSev > minSev) {
            // Higher damage increases severity chance
            if (damageRatio > 0.6 && Math.random() < 0.5) {
                severity = Math.min(maxSev, severity + 1);
            }
            if (damageRatio > 0.8 && Math.random() < 0.3) {
                severity = Math.min(maxSev, severity + 1);
            }
        }
        
        // Duration based on severity
        const baseDuration = 3 + severity * 2 + Math.floor(Math.random() * 3);
        
        return {
            type: effectType,
            severity: severity,
            duration: baseDuration
        };
    }
    
    return null;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StatusEffect, StatusEffectManager, calculateStatusEffectChance };
} else {
    // Make functions available globally in browser environment
    window.StatusEffect = StatusEffect;
    window.StatusEffectManager = StatusEffectManager;
    window.calculateStatusEffectChance = calculateStatusEffectChance;
    window.WEAPON_STATUS_EFFECTS = WEAPON_STATUS_EFFECTS;
}