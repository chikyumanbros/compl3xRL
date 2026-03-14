/**
 * Monster item handling - intelligent creatures can pick up, use, and equip items
 * Load after monster.js and monster-ai.js. Depends on ItemManager, game.
 */
(function() {
    if (typeof Monster === 'undefined') return;

    const M = Monster;

    /** True if this monster can use items (pick up, use potions, equip) */
    M.prototype.isIntelligent = function() {
        return ['normal', 'smart', 'genius'].includes(this.intelligence);
    };

    /** Add item to monster inventory (removes from floor; caller must remove from ItemManager) */
    M.prototype.addToInventory = function(item) {
        if (!this.inventory) this.inventory = [];
        if (this.inventory.length >= (this.maxInventorySize || 8)) return false;
        item.x = null;
        item.y = null;
        this.inventory.push(item);
        return true;
    };

    /** Remove item from monster inventory (does not place on floor) */
    M.prototype.removeFromInventory = function(item) {
        if (!this.inventory) return false;
        const i = this.inventory.indexOf(item);
        if (i === -1) return false;
        this.inventory.splice(i, 1);
        return true;
    };

    /** Get healing amount from a potion item */
    function getPotionHealAmount(item) {
        if (!item || item.type !== 'potion') return 0;
        if (item.healDice) {
            const match = String(item.healDice).match(/(\d*)d(\d+)([+-]\d+)?/i);
            if (match) {
                const n = parseInt(match[1], 10) || 1;
                const d = parseInt(match[2], 10);
                const mod = parseInt(match[3], 10) || 0;
                let sum = 0;
                for (let i = 0; i < n; i++) sum += Math.floor(Math.random() * d) + 1;
                return sum + mod;
            }
        }
        return item.healAmount || 0;
    }

    function getEffectiveStats(item) {
        return (item && item.getEffectiveStats && item.getEffectiveStats()) || item || {};
    }

    /** Equip weapon: put current weapon in inventory if any, then equip new one and update stats */
    M.prototype.equipWeapon = function(item) {
        if (!item || (item.type !== 'weapon' && !item.weaponDamage)) return false;
        if (!this.equipment) this.equipment = { weapon: null, armor: null };
        if (this.equipment.weapon) {
            if (!this.inventory) this.inventory = [];
            this.inventory.push(this.equipment.weapon);
        }
        this.equipment.weapon = item;
        this.removeFromInventory(item);
        const s = getEffectiveStats(item);
        this.damage = s.damage != null ? s.damage : this.damage;
        this.weaponDamage = s.weaponDamage != null ? s.weaponDamage : this.weaponDamage;
        this.penetration = s.penetration != null ? s.penetration : this.penetration;
        this.toHit = (this.toHit || 0) + (s.toHitBonus || 0);
        return true;
    };

    /** Equip armor */
    M.prototype.equipArmor = function(item) {
        if (!item || (item.type !== 'armor' && !item.armorClassBonus)) return false;
        if (!this.equipment) this.equipment = { weapon: null, armor: null };
        if (this.equipment.armor) {
            if (!this.inventory) this.inventory = [];
            this.inventory.push(this.equipment.armor);
        }
        this.equipment.armor = item;
        this.removeFromInventory(item);
        const s = getEffectiveStats(item);
        this.armorClass = Math.max(0, (this.armorClass || 10) - (s.armorClassBonus || 0));
        this.protection = (this.protection || 0) + (s.protection || 0);
        return true;
    };

    /** Compare weapon value for "better" (higher damage potential) */
    function weaponValue(item) {
        if (!item) return 0;
        const s = (item.getEffectiveStats && item.getEffectiveStats()) || item;
        const d = (s.damage || 0) + (s.weaponDamage || 0);
        return d + (s.toHitBonus || 0) * 2 + (s.penetration || 0) * 3;
    }

    /** Compare armor value for "better" (lower AC / more protection) */
    function armorValue(item) {
        if (!item) return 0;
        const s = (item.getEffectiveStats && item.getEffectiveStats()) || item;
        return (s.armorClassBonus || 0) + (s.protection || 0) * 2;
    }

    /**
     * Consider using a healing potion when hurt. Returns true if used one (turn consumed).
     */
    M.prototype.considerUsePotion = function(game) {
        if (!game || !this.isIntelligent() || !this.inventory || this.inventory.length === 0) return false;
        const hpRatio = this.hp / Math.max(1, this.maxHp);
        if (hpRatio > 0.4) return false; // Only use when below 40% HP
        const potion = this.inventory.find(it => it && it.type === 'potion' && (it.healAmount > 0 || it.healDice));
        if (!potion) return false;
        const amount = getPotionHealAmount(potion);
        this.heal(amount);
        this.removeFromInventory(potion);
        if (game.renderer && game.fov && game.fov.isVisible(this.x, this.y)) {
            game.renderer.addLogMessage(`${this.name} drinks a potion and recovers ${amount} HP!`);
        }
        return true;
    }

    /**
     * Consider picking up one item from the floor and optionally equipping it. Returns true if picked up (turn consumed).
     */
    M.prototype.considerPickUpItems = function(game) {
        if (!game || !game.itemManager || !this.isIntelligent()) return false;
        const items = game.itemManager.getItemsAt(this.x, this.y) || [];
        if (items.length === 0) return false;
        if (this.inventory.length >= (this.maxInventorySize || 8)) return false;
        // Prefer: weapon > armor > potion > other
        const want = items.filter(it => it && it.type !== 'corpse');
        if (want.length === 0) return false;
        const weapon = want.find(it => it.type === 'weapon' || it.weaponDamage);
        const armor = want.find(it => it.type === 'armor' || it.armorClassBonus);
        const potion = want.find(it => it.type === 'potion');
        const other = want.find(it => it !== weapon && it !== armor && it !== potion);
        const pick = weapon || armor || potion || other;
        if (!pick) return false;
        game.itemManager.removeItem(pick);
        this.addToInventory(pick);
        if (game.renderer && game.fov && game.fov.isVisible(this.x, this.y)) {
            game.renderer.addLogMessage(`${this.name} picks up ${pick.name || pick.getDisplayName?.() || 'something'}.`);
        }
        // Auto-equip if better than current
        const currentWeapon = this.equipment && this.equipment.weapon;
        const currentArmor = this.equipment && this.equipment.armor;
        if ((pick.type === 'weapon' || pick.weaponDamage) && weaponValue(pick) > weaponValue(currentWeapon)) {
            this.equipWeapon(pick);
            if (game.renderer && game.fov && game.fov.isVisible(this.x, this.y)) {
                game.renderer.addLogMessage(`${this.name} wields ${pick.name || pick.getDisplayName?.()}.`);
            }
        } else if ((pick.type === 'armor' || pick.armorClassBonus) && armorValue(pick) > armorValue(currentArmor)) {
            this.equipArmor(pick);
            if (game.renderer && game.fov && game.fov.isVisible(this.x, this.y)) {
                game.renderer.addLogMessage(`${this.name} wears ${pick.name || pick.getDisplayName?.()}.`);
            }
        }
        return true;
    };
})();
