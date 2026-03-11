/**
 * Food definitions for classic roguelike items
 */
const FOOD_TYPES = {
    // Basic food items (NetHack-inspired)
    ration: {
        name: 'food ration',
        description: 'A carefully preserved meal, standard adventurer fare.',
        symbol: '%',
        color: '#8B4513',
        nutrition: 800,
        healAmount: 0,
        weight: 1.5,
        perishable: false
    },
    bread: {
        name: 'bread',
        description: 'A loaf of wholesome bread. Restores 5 HP when eaten.',
        symbol: '%',
        color: '#DEB887',
        nutrition: 200,
        healAmount: 5,
        weight: 0.8,
        perishable: true
    },
    apple: {
        name: 'apple',
        description: 'A crisp, red apple. Restores 2 HP when eaten.',
        symbol: '%',
        color: '#FF0000',
        nutrition: 50,
        healAmount: 2,
        weight: 0.3,
        perishable: true
    },
    cheese: {
        name: 'wedge of cheese',
        description: 'A triangular piece of aged cheese. Restores 3 HP when eaten.',
        symbol: '%',
        color: '#FFFF00',
        nutrition: 120,
        healAmount: 3,
        weight: 0.5,
        perishable: true
    },
    lembas: {
        name: 'lembas wafer',
        description: 'A thin, light wafer that fills the stomach and restores strength. Restores 15 HP when eaten.',
        symbol: '%',
        color: '#F0E68C',
        nutrition: 800,
        healAmount: 15,
        weight: 0.2,
        perishable: false
    },
    honeycake: {
        name: 'honey cake',
        description: 'A sweet cake dripping with golden honey. Restores 10 HP when eaten.',
        symbol: '%',
        color: '#FFD700',
        nutrition: 400,
        healAmount: 10,
        weight: 1.2,
        perishable: true
    },
    jerky: {
        name: 'strip of jerky',
        description: 'Dried and salted meat, tough but nutritious.',
        symbol: '%',
        color: '#8B0000',
        nutrition: 300,
        healAmount: 0,
        weight: 0.4,
        perishable: false
    }
};
