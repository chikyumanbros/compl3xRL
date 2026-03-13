/**
 * Sub-window: equipment list, slot details, wear/wield and unequip menus.
 */

(function (SubWindow) {
    'use strict';

    var EQUIPMENT_SLOTS = [
        { key: 'weapon', name: 'Weapon', keyHint: '(w)', letter: 'w' },
        { key: 'armor', name: 'Armor', keyHint: '(a)', letter: 'a' },
        { key: 'shield', name: 'Shield', keyHint: '(s)', letter: 's' },
        { key: 'helmet', name: 'Helmet', keyHint: '(h)', letter: 'h' },
        { key: 'gloves', name: 'Gloves', keyHint: '(g)', letter: 'g' },
        { key: 'boots', name: 'Boots', keyHint: '(b)', letter: 'b' },
        { key: 'ring1', name: 'Ring (L)', keyHint: '(r)', letter: 'r' },
        { key: 'ring2', name: 'Ring (R)', keyHint: '(1)', letter: '1' },
        { key: 'amulet', name: 'Amulet', keyHint: '(m)', letter: 'm' },
        { key: 'light', name: 'Light', keyHint: '(l)', letter: 'l' }
    ];

    var SLOT_NAMES = {
        weapon: 'Weapon',
        armor: 'Armor',
        shield: 'Shield',
        helmet: 'Helmet',
        gloves: 'Gloves',
        boots: 'Boots',
        ring1: 'Ring (Left)',
        ring2: 'Ring (Right)',
        amulet: 'Amulet',
        light: 'Light'
    };

    SubWindow.prototype.showEquipment = function (player) {
        this.title.textContent = 'Equipment';
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = 'Enter slot key for details, w to wear/wield, T to take off, ESC to close';
        this.textInput.value = '';

        var equipment = player.equipment;

        EQUIPMENT_SLOTS.forEach(function (slot) {
            var slotDiv = document.createElement('div');
            slotDiv.className = 'equipment-line';
            slotDiv.style.marginBottom = '5px';
            if (equipment[slot.key]) {
                var item = equipment[slot.key];
                var display = Player.getEquipmentDisplayInfo(item);
                var effectiveWeight = item.getEffectiveWeight ? item.getEffectiveWeight() : item.weight;
                var totalWeight = item.getTotalWeight ? item.getTotalWeight() : (effectiveWeight * (item.quantity || 1));
                var weightText = totalWeight === 1 ? '1 lb' : totalWeight.toFixed(1) + ' lbs';
                slotDiv.innerHTML = '<span style="color: #00ff00;">' + slot.name + ' ' + slot.keyHint + ':</span> ' +
                    item.name + display.qualityText + display.conditionText + display.statsText + ' (' + weightText + ')';
            } else {
                slotDiv.innerHTML = '<span style="color: #808080;">' + slot.name + ' ' + slot.keyHint + ':</span> <span style="color: #404040;">None</span>';
            }
            this.content.appendChild(slotDiv);
        }.bind(this));

        var helpDiv = document.createElement('div');
        helpDiv.style.cssText = 'margin-top: 10px; color: #808080; font-size: 0.9em;';
        helpDiv.innerHTML = 'Enter slot key for details<br>Press w to wear/wield, T to take off, ESC to close';
        this.content.appendChild(helpDiv);

        this.callback = function (choice) {
            if (choice && choice.length === 1) {
                var input = choice.toLowerCase().trim();
                var slot = EQUIPMENT_SLOTS.find(function (s) { return s.letter === input; });
                if (slot && equipment[slot.key]) {
                    this.showEquipmentItemDetails(player, slot.key, equipment[slot.key]);
                    return false;
                }
                if (input === 'w') {
                    if (!equipment.weapon) {
                        this.hide();
                        setTimeout(function () { this.showEquipmentMenu(player); }.bind(this), 100);
                        return true;
                    }
                    this.showEquipmentItemDetails(player, 'weapon', equipment.weapon);
                    return false;
                }
                if (input === 't') {
                    this.hide();
                    return true;
                }
                if (window.game && window.game.renderer) {
                    window.game.renderer.addLogMessage('Invalid slot key. Use w,a,s,h,g,b,r,1,m for details.');
                }
                return false;
            }
            return true;
        };

        this.show();
        this.textInput.focus();
    };

    SubWindow.prototype.showEquipmentItemDetails = function (player, slotKey, item) {
        this.title.textContent = 'Equipment Details: ' + item.name;
        this.content.innerHTML = '';
        this.input.style.display = 'none';

        var nameDiv = document.createElement('div');
        nameDiv.style.cssText = 'font-size: 1.1em; font-weight: bold; color: #ffffff; margin-bottom: 10px;';
        nameDiv.textContent = item.getDisplayName ? item.getDisplayName() : item.name;
        this.content.appendChild(nameDiv);

        var slotDiv = document.createElement('div');
        slotDiv.style.cssText = 'color: #00ff00; margin-bottom: 10px; font-weight: bold;';
        slotDiv.textContent = 'Equipped: ' + (SLOT_NAMES[slotKey] || slotKey);
        this.content.appendChild(slotDiv);

        var descDiv = document.createElement('div');
        descDiv.style.cssText = 'color: #cccccc; margin-bottom: 15px; line-height: 1.4;';
        descDiv.textContent = item.description || 'No description available.';
        this.content.appendChild(descDiv);

        var propertyList = SubWindow.buildItemPropertyList(item, { includeStack: false, forEquipment: true });
        var propsDiv = document.createElement('div');
        propsDiv.style.cssText = 'color: #aaaaaa; font-size: 0.9em;';
        propsDiv.innerHTML = propertyList.join('<br>');
        this.content.appendChild(propsDiv);

        var backDiv = document.createElement('div');
        backDiv.style.cssText = 'margin-top: 15px; color: #808080; font-size: 0.9em;';
        backDiv.innerHTML = 'Press any key to return to equipment list';
        this.content.appendChild(backDiv);

        var self = this;
        var handleKeyPress = function () {
            document.removeEventListener('keydown', handleKeyPress);
            self.showEquipment(player);
        };
        document.addEventListener('keydown', handleKeyPress);
        this.show();
    };

    SubWindow.prototype.showEquipmentMenu = function (player) {
        this.title.textContent = 'Select item to wear/wield';
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = 'Enter letter (a-z) or Cancel';
        this.textInput.value = '';

        var inventory = player.getInventorySummary();
        var wearableTypes = ['weapon', 'armor', 'shield', 'helmet', 'gloves', 'boots', 'ring', 'amulet', 'light'];
        var validItems = inventory.filter(function (item) {
            var letter = item.charAt(0);
            var invItem = player.getInventoryItem(letter);
            if (!invItem || !wearableTypes.includes(invItem.type)) return false;
            for (var slot in player.equipment) {
                if (player.equipment[slot] === invItem) return false;
            }
            return true;
        });

        if (validItems.length === 0) {
            this.content.innerHTML = '<div style="color: #808080; font-style: italic;">No wearable items in inventory.</div>';
            this.input.style.display = 'none';
        } else {
            validItems.forEach(function (item) {
                var itemDiv = document.createElement('div');
                itemDiv.textContent = item;
                this.content.appendChild(itemDiv);
            }.bind(this));
        }

        this.callback = function (choice) {
            if (choice && choice.length === 1) {
                var letter = choice.toLowerCase();
                var success = player.equipFromInventory(letter);
                if (success && window.game) {
                    window.game.processMonsterTurns();
                    window.game.render();
                    if (window.game.autosaveEnabled) window.game.saveGame();
                }
                return true;
            }
            return false;
        };

        this.show();
        this.textInput.focus();
    };

    SubWindow.prototype.showUnequipMenu = function (player) {
        this.title.textContent = 'Remove equipment';
        this.content.innerHTML = '';
        this.input.style.display = 'flex';
        this.textInput.placeholder = 'Enter letter (a-z) or Cancel';
        this.textInput.value = '';

        var equipped = player.getEquipmentSummary();
        if (equipped.length === 0) {
            this.content.innerHTML = '<div style="color: #808080; font-style: italic;">You are not wearing anything.</div>';
            this.input.style.display = 'none';
        } else {
            var slots = Object.keys(player.equipment);
            var equippedSlots = slots.filter(function (slot) { return player.equipment[slot]; });
            var letterToSlot = {};
            equippedSlots.forEach(function (slot, idx) {
                var letter = String.fromCharCode(97 + idx);
                letterToSlot[letter] = slot;
                var itemDiv = document.createElement('div');
                itemDiv.textContent = letter + ' - ' + equipped[idx];
                this.content.appendChild(itemDiv);
            }.bind(this));
            this._unequipLetterToSlot = letterToSlot;
        }

        this.callback = function (choice) {
            if (choice && choice.length === 1) {
                var letter = choice.toLowerCase();
                var slot = this._unequipLetterToSlot ? this._unequipLetterToSlot[letter] : null;
                if (!slot) return false;
                var success = player.unequipToInventory(slot);
                if (success && window.game) {
                    window.game.processMonsterTurns();
                    window.game.render();
                    if (window.game.autosaveEnabled) window.game.saveGame();
                }
                return true;
            }
            return false;
        };

        this.show();
        this.textInput.focus();
    };

})(window.SubWindow);
