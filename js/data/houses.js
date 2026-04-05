// House definitions from OpenDUNE src/table/houseinfo.c
export const HOUSE = {
    HARKONNEN: 0,
    ATREIDES: 1,
    ORDOS: 2,
    FREMEN: 3,
    SARDAUKAR: 4,
    MERCENARY: 5
};

export const HOUSE_DATA = {
    [HOUSE.HARKONNEN]: {
        name: 'Harkonnen',
        color: '#cc2222',
        lightColor: '#ff4444',
        darkColor: '#881111',
        minimapColor: '#cc2222',
        specialUnit: 'Devastator',
        palaceWeapon: 'Death Hand'
    },
    [HOUSE.ATREIDES]: {
        name: 'Atreides',
        color: '#2266cc',
        lightColor: '#4488ff',
        darkColor: '#113388',
        minimapColor: '#2266cc',
        specialUnit: 'Sonic Tank',
        palaceWeapon: 'Fremen'
    },
    [HOUSE.ORDOS]: {
        name: 'Ordos',
        color: '#22aa44',
        lightColor: '#44dd66',
        darkColor: '#116622',
        minimapColor: '#22aa44',
        specialUnit: 'Deviator',
        palaceWeapon: 'Saboteur'
    },
    [HOUSE.FREMEN]: {
        name: 'Fremen',
        color: '#ccaa22',
        lightColor: '#ffdd44',
        darkColor: '#886611',
        minimapColor: '#ccaa22'
    },
    [HOUSE.SARDAUKAR]: {
        name: 'Sardaukar',
        color: '#aa44aa',
        lightColor: '#dd66dd',
        darkColor: '#662266',
        minimapColor: '#aa44aa'
    },
    [HOUSE.MERCENARY]: {
        name: 'Mercenary',
        color: '#aaaa44',
        lightColor: '#dddd66',
        darkColor: '#666622',
        minimapColor: '#aaaa44'
    }
};
