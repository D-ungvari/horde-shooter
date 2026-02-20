// Biome definitions — visual themes, tile palettes, ambient particle configs

export const BIOMES = {
    graveyard: {
        id: 'graveyard',
        name: 'The Graveyard',
        description: 'Ancient burial grounds shrouded in mist.',
        tileColors: ['#1a2a1a', '#1e2e1e', '#1c2c1c', '#182818'],
        gridColor: 'rgba(255,255,255,0.03)',
        bgColor: '#0a0a15',
        detailThreshold: 0.85,
        detailColor: 'rgba(60, 80, 60, 0.4)',
        stoneColor: '#2a2a2a',
        ambient: {
            type: 'mist',
            color: '#88AA88',
            count: 20,
            speed: 15,
            size: [4, 12],
            alpha: 0.15,
        },
    },
    volcano: {
        id: 'volcano',
        name: 'The Volcano',
        description: 'Molten earth cracks beneath your feet.',
        tileColors: ['#2a1a0a', '#2e1e0e', '#2c1c0c', '#281808'],
        gridColor: 'rgba(255,100,0,0.04)',
        bgColor: '#150a05',
        detailThreshold: 0.82,
        detailColor: 'rgba(180, 60, 20, 0.3)',
        stoneColor: '#3a2a1a',
        ambient: {
            type: 'ember',
            color: '#FF6622',
            count: 18,
            speed: 40,
            size: [2, 5],
            alpha: 0.4,
        },
    },
    void: {
        id: 'void',
        name: 'The Void',
        description: 'Reality fractures at the edge of existence.',
        tileColors: ['#0a0a2a', '#0e0e2e', '#0c0c2c', '#080828'],
        gridColor: 'rgba(100,100,255,0.06)',
        bgColor: '#050510',
        detailThreshold: 0.80,
        detailColor: 'rgba(80, 80, 200, 0.3)',
        stoneColor: '#1a1a3a',
        ambient: {
            type: 'spark',
            color: '#6666FF',
            count: 25,
            speed: 60,
            size: [1.5, 4],
            alpha: 0.5,
        },
    },
};

export const BIOME_LIST = ['graveyard', 'volcano', 'void'];
