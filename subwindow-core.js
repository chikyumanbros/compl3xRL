/**
 * Sub-window core: overlay, keyboard handling, dialog, and shared item display helpers.
 * Menu implementations are in subwindow-inventory.js, subwindow-equipment.js, subwindow-menus.js
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

        // Classical roguelike: keyboard-only, hide mouse buttons
        this.confirmBtn.style.display = 'none';
        this.cancelBtn.style.display = 'none';
        this.closeBtn.style.display = 'none';

        this.isOpen = false;
        this.callback = null;
        this.keyHandler = null;
        this.selectedIndex = -1;

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.textInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleConfirm();
            }
        });

        this.textInput.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') {
                e.stopPropagation();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (this.isOpen && e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                if (this.keyHandler && window.game && window.game.handleLoadAutosaveChoice) {
                    window.game.handleLoadAutosaveChoice(false);
                }
                this.close();
            } else if (this.isOpen && this.keyHandler) {
                this.keyHandler(e);
            }
        });
    }

    handleConfirm() {
        const value = this.textInput.value.trim();
        if (this.callback) {
            const shouldClose = this.callback(value);
            if (shouldClose !== false) {
                this.close();
            }
        } else {
            this.close();
        }
    }

    selectItem(index) {
        const prevSelected = this.content.querySelector('.selected');
        if (prevSelected) prevSelected.classList.remove('selected');
        const items = this.content.querySelectorAll('.item-line');
        if (items[index]) {
            items[index].classList.add('selected');
            this.selectedIndex = index;
        }
    }

    show() {
        this.isOpen = true;
        this.overlay.style.display = 'flex';
    }

    close() {
        this.isOpen = false;
        this.overlay.style.display = 'none';
        this.callback = null;
        this.keyHandler = null;
        this.selectedIndex = -1;
        this.textInput.value = '';
    }

    /** Alias for close() used by some menus when switching to another dialog */
    hide() {
        this.close();
    }

    showDialog(title, content, callback = null, keyHandler = null) {
        this.title.textContent = title;
        this.content.innerHTML = content;
        this.input.style.display = 'none';
        this.callback = callback;
        this.keyHandler = keyHandler;
        this.show();
    }

    // --- Shared item property display (used by inventory & equipment details) ---

    static QUALITY_NAMES = {
        poor: 'Poor',
        normal: 'Normal',
        fine: 'Fine',
        masterwork: 'Masterwork',
        legendary: 'Legendary'
    };

    static DURABILITY_STATE_NAMES = {
        normal: 'Excellent',
        cracked1: 'Good',
        cracked2: 'Fair',
        cracked3: 'Poor',
        broken: 'Broken'
    };

    /**
     * Build array of property strings for an item. Used by showItemDetails and showEquipmentItemDetails.
     * @param {Object} item - Item object
     * @param {{ includeStack?: boolean, forEquipment?: boolean }} opts - includeStack: show quantity for stackables; forEquipment: add effective stats when damaged, resistances
     * @returns {string[]}
     */
    static buildItemPropertyList(item, opts = {}) {
        const { includeStack = true, forEquipment = false } = opts;
        const properties = [];

        if (item.weight) {
            const effectiveWeight = item.getEffectiveWeight ? item.getEffectiveWeight() : item.weight;
            if (includeStack && item.stackable && item.quantity > 1) {
                const totalWeight = item.getTotalWeight ? item.getTotalWeight() : effectiveWeight * (item.quantity || 1);
                properties.push(`Weight: ${effectiveWeight.toFixed(1)} each (${totalWeight.toFixed(1)} total)`);
            } else {
                properties.push(`Weight: ${effectiveWeight.toFixed(1)}`);
            }
        }
        if (item.value) properties.push(`Value: ${item.value} gold`);
        if (item.material) properties.push(`Material: ${item.material}`);

        if (item.category && item.getCategoryDisplayName) {
            try {
                properties.push(`Category: ${item.getCategoryDisplayName()}`);
            } catch (e) {
                console.warn('Error getting category display name:', e);
            }
        }
        if (item.weaponType && item.getWeaponTypeDisplayName) {
            try {
                const name = item.getWeaponTypeDisplayName();
                if (name) properties.push(`Weapon Type: ${name}`);
            } catch (e) {
                console.warn('Error getting weapon type display name:', e);
            }
        }

        if (item.type === 'weapon') {
            if (item.damage && item.weaponDamage) {
                properties.push(`Damage: 1d${item.weaponDamage}+${item.damage}`);
            }
            if (item.toHitBonus != null) properties.push(`To Hit: ${item.toHitBonus >= 0 ? '+' : ''}${item.toHitBonus}`);
            if (item.penetration) properties.push(`Penetration: AP ${item.penetration}`);
        } else if (item.type === 'armor') {
            if (item.armorClassBonus) properties.push(`AC -${item.armorClassBonus}`);
            if (item.protection) properties.push(`DR: ${item.protection}`);
        } else if (item.type === 'shield') {
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

        if (includeStack && item.stackable && item.quantity > 1) {
            properties.push(`Quantity: ${item.quantity}/${item.maxStackSize || 99}`);
        }

        if (item.quality) {
            properties.push(`Quality: ${SubWindow.QUALITY_NAMES[item.quality] || item.quality}`);
        }

        if (item.getDurabilityState && item.maxDurability) {
            const ratio = item.currentDurability / item.maxDurability;
            const pct = Math.floor(ratio * 100);
            const state = item.getDurabilityState();
            properties.push(`Condition: ${SubWindow.DURABILITY_STATE_NAMES[state]} (${pct}%)`);

            if (forEquipment && state !== 'normal' && item.getEffectiveStats) {
                const effective = item.getEffectiveStats();
                if (item.damage > 0 && effective.damage !== item.damage) {
                    properties.push(`Effective Damage: 1d${effective.weaponDamage}+${effective.damage} (reduced from base)`);
                }
                if (item.armorClassBonus > 0 && effective.armorClassBonus !== item.armorClassBonus) {
                    properties.push(`Effective AC: -${effective.armorClassBonus} (reduced from -${item.armorClassBonus})`);
                }
                if (item.protection > 0 && effective.protection !== item.protection) {
                    properties.push(`Effective DR: ${effective.protection} (reduced from ${item.protection})`);
                }
                if (item.blockChance > 0 && effective.blockChance !== item.blockChance) {
                    properties.push(`Effective BC: ${effective.blockChance}% (reduced from ${item.blockChance}%)`);
                }
            }
        }

        if (item.enchantment && item.enchantment !== 0) {
            properties.push(`Enchantment: ${item.enchantment > 0 ? '+' : ''}${item.enchantment}`);
        }

        if (forEquipment && item.resistances && Object.keys(item.resistances).length > 0) {
            const names = { bleeding: 'Bleeding', stunned: 'Stun', fractured: 'Fracture', poisoned: 'Poison', confused: 'Confusion', paralyzed: 'Paralysis' };
            const list = Object.entries(item.resistances).map(([eff, val]) => `${names[eff] || eff} ${val}%`);
            properties.push(`Status Resist: ${list.join(', ')}`);
        }

        if (forEquipment && item.elementalResistances && Object.keys(item.elementalResistances).length > 0) {
            const names = { fire: 'Fire', cold: 'Cold', lightning: 'Lightning', acid: 'Acid', poison_damage: 'Poison' };
            const list = Object.entries(item.elementalResistances).map(([el, val]) => `${names[el] || el} ${val}%`);
            properties.push(`Element Resist: ${list.join(', ')}`);
        }

        return properties;
    }

    /** Append a block of item name + description + property list to this.content */
    appendItemDetailBlock(item, propertyList) {
        const nameDiv = document.createElement('div');
        nameDiv.style.cssText = 'font-size: 1.1em; font-weight: bold; color: #ffffff; margin-bottom: 10px;';
        nameDiv.textContent = item.getDisplayName ? item.getDisplayName() : item.name;
        this.content.appendChild(nameDiv);

        const descDiv = document.createElement('div');
        descDiv.style.cssText = 'color: #cccccc; margin-bottom: 15px; line-height: 1.4;';
        descDiv.textContent = item.description || 'No description available.';
        this.content.appendChild(descDiv);

        const propsDiv = document.createElement('div');
        propsDiv.style.cssText = 'color: #aaaaaa; font-size: 0.9em;';
        propertyList.forEach(prop => {
            const p = document.createElement('div');
            p.textContent = prop;
            propsDiv.appendChild(p);
        });
        this.content.appendChild(propsDiv);
    }
}

window.SubWindow = SubWindow;
window.subWindow = new SubWindow();
