const Language = [{
    code: 'en',
    lang: 'en',
    text: 'English',
    title: 'Hong Kong Geo Data Map: ',
    copyright: '© The Government of the HKSAR. All rights reserved.',
    credit: 'Source: The Government of the Hong Kong Special Administrative Region, HONG KONG GEODATA STORE',
    loading: 'Loading',
}, {
    code: 'zh-Hant',
    lang: 'tc',
    text: '繁體',
    title: '香港地理資料地圖：',
    copyright: '© 香港特區政府。保留所有權利。',
    credit: '資料來源：香港特別行政區政府、香港地理數據站',
    loading: '載入中'
}];

function getJSON(url) {
    $('#map #loading').show();
    return new Promise((resolve) => {
        $.getJSON(url, (res) => {
            $('#map #loading').hide();
            resolve(res || {})
        })
    })
}

function startMap() {
    mapboxgl.accessToken = 'pk.eyJ1IjoibWlyZHVwIiwiYSI6ImNrNXVjdTB0bTBmeG0zbW14enR5dnE0YzkifQ.heLqrM-EDm-wrrXulqOPeg';
    let map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mirdup/ck7nfcdch082o1ilthewnl671/draft',
        minZoom: 10.3,
        maxZoom: 20,
        center: [114.12, 22.36],
        maxBounds: [
            [113.7, 22.1],
            [114.5, 22.6]
        ],
        zoom: 10.3
    });
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    map.addControl(new mapboxgl.FullscreenControl());
    return map;
}

function getLocales(type) {
    return {
        ...window.DataLocale.common,
        ...(window.DataLocale[type] || {})
    }
}

function getCoalesce(arr, props = true) {
    return ['coalesce'].concat(arr.filter(v => typeof v !== 'undefined').map(name => props ? ['get', name] : name))
}

function getLocalesNames(locale, key, lang) {
    lang = typeof lang === "number" ? lang : window.DataLanguage;
    if (!(key in locale) || locale[key].length == 0) return false;
    return locale[key][lang] || locale[key][0] || []
}

function buildPopup(template, props, locale) {
    let keys = template.match(/\{\{[a-z0-9:]+\}\}/g).map(key => key.replace(/[{}]/g, '')),
        result = {},
        max = 0,
        html = '';

    for (let i = 0; i < keys.length; i++) {
        let key = keys[i].replace(/[^a-z0-9]/g, ''),
            needName = keys[i].indexOf(':') != -1;
        if (!(key in locale)) continue;

        let count = locale[key].length;
        if (count > max) max = count;
        for (let j = 0; j < count; j++) {
            let names = getLocalesNames(locale, key, j).filter(name => name in props);
            if (names.length == 0) continue;
            if (!result[keys[i]]) result[keys[i]] = [];
            result[keys[i]].push((needName ? names[0] + ': ' : '') + `<span type='value'>${props[names[0]]}</span>`)
        }
    }

    for (let j = 0; j < max; j++) {
        let temp = template;
        for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            temp = temp.replace(`{{${key}}}`, result[key] && result[key].length > 0 ? `<span tag='${key.replace(/[^0-9a-z]/g, '')}'>${result[key][j] || result[key][0]}</span>` : '')
        }
        html += `<div lang='${j}'>${temp}</div>`
    }
    return html;
}

function isExistedLayer(id) {
    return typeof window.DataMap.getLayer(id) !== 'undefined'
}

function isVisibleLayer(id) {
    if (!isExistedLayer(id)) return false;
    let visibility = window.DataMap.getLayoutProperty(id, 'visibility')
    return typeof visibility === 'undefined' || visibility == 'visible';
}

function toggleLayer(type, sub, id) {
    if (!isExistedLayer(id)) {
        loadMap(type, sub, id);
    } else {
        isVisibleLayer(id) ? hideLayer(id) : showLayer(id);
    }
}

function showLayer(id) {
    window.DataMap.setLayoutProperty(id, 'visibility', 'visible')
}

function hideLayer(id) {
    window.DataMap.setLayoutProperty(id, 'visibility', 'none')
}

function drawLayers() {
    $("#layers-container").remove()
    let $layer = $('<div id="layers-container"></div>'),
        addLocale = ($elem, data) => {
            Language.map((lang, i) => $elem.append(`<span lang='${i}'>${data[lang.lang]}</span>`))
        }
    for (let catalogue in window.DataCatalogue) {
        let $cat = $(`<div class='catalogue'></div>`),
            $parent = $(`<div class='parent'></div>`);
        $parent.appendTo($cat)
        addLocale($parent, window.DataCatalogue[catalogue])

        $cat.appendTo($layer)
        if (!window.DataCatalogue[catalogue].groups) {
            let $img = $(`<img src='img/external.svg' />`);
            $parent.append($img)
            $parent.on('click', () => location.href = `?type=${catalogue}`)
            continue;
        }

        for (let group in window.DataCatalogue[catalogue].groups) {
            let $child = $(`<div class='child'></div>`)
            $child.appendTo($cat)
            addLocale($child, window.DataCatalogue[catalogue].groups[group])

            if (!window.DataCatalogue[catalogue].groups[group].list) {
                let $img = $(`<img src='img/external.svg' />`);
                $child.append($img)
                $child.on('click', () => location.href = `?type=${catalogue}&sub=${group}`)
                continue;
            }

            for (let list in window.DataCatalogue[catalogue].groups[group].list) {
                let $list = $(`<div class='list'></div>`),
                    $img = $(`<img />`),
                    updateStatus = () => {
                        $list.removeClass('visible download hidden')
                        let src = 'hidden';
                        if (!isExistedLayer(list)) {
                            src = 'download'
                        } else if (isVisibleLayer(list)) {
                            src = 'visible'
                        }
                        $list.addClass(src)
                        $img.attr('src', `img/${src}.svg`)
                    };
                $list.appendTo($cat)
                $list.on('click', () => {
                    toggleLayer(catalogue, group, list)
                    updateStatus()
                })

                updateStatus()
                $list.append($img)
                addLocale($list, window.DataCatalogue[catalogue].groups[group].list[list])
            }
        }
    }
    $layer.appendTo('#map')
}

let loadingTimeout = 0,
    retryCount = {
        id: '',
        time: 0,
    };

function loadMap(type, sub, idx) {
    type = type && type in window.DataCatalogue ? type : Object.keys(window.DataCatalogue)[0];
    sub = sub && sub in window.DataCatalogue[type].groups ? sub : Object.keys(window.DataCatalogue[type].groups)[0];
    idx = idx || 0;
    if (!$('#title').length) {
        let $title = $('<div id="title"></div>'),
            $container = $('<div id="title-container"></div>'),
            $btnToggle = $('<button class="data-map-button" id="toggle-title"></button>'),
            $btnHide = $('<span id="collapse-title"></span>');
        $title.append(`<div>${Language.reduce((p, c, i) => p += `<span lang='${i}'>${c.title}${window.DataCatalogue[type][c.lang]} - ${window.DataCatalogue[type].groups[sub][c.lang]}</span>`, '')}</div>`)
        $title.append(`<span id='attribution'>${Language.reduce((p, c, i) => p += `<span lang='${i}'>${c.credit}</span>`,'')}</span><br><span id='copyright'>${Language.reduce((p, c, i) => p+=`<span lang='${i}'>${c.copyright}</span>`,'')}</span>`);

        $btnToggle.on('click', () => {
            $container.toggleClass('active')
        })

        $btnHide.on('click', () => {
            $container.addClass('force-collapse')
        })

        $title.append($btnHide);
        $container.append($title);
        $container.append($btnToggle);
        $('#map').append($container);
    }
    if (window.DataMapLoaded) {
        clearTimeout(loadingTimeout)
        let config = window.DataCatalogue[type],
            locale = getLocales(type),
            addLayer = () => {
                config = window.DataCatalogue[type];
                let keys = Object.keys(config.groups[sub].list);
                const DatasetID = idx in config.groups[sub].list ? idx : keys[idx] || keys[0];

                if (typeof window.DataMap.getLayer(DatasetID) !== 'undefined') {
                    showLayer(DatasetID);
                    return;
                }
                const Name0 = getCoalesce(getLocalesNames(locale, 'name', 0)),
                    Name1 = getCoalesce(getLocalesNames(locale, 'name', 1)),
                    Condition = ['!=', Name0, Name1];

                window.DataMap.addSource(DatasetID, {
                    'type': 'geojson',
                    'data': `https://geodata.gov.hk/gs/api/v1.0.0/geoDataQuery?q=%7Bv%3A%221%2E0%2E0%22%2Cid%3A%22${DatasetID}%22%7D`,
                });

                window.DataMap.addLayer({
                    'id': DatasetID,
                    'type': 'symbol',
                    'source': DatasetID,
                    'layout': {
                        'icon-image': ['concat', getCoalesce([config.groups[sub].list[DatasetID].icon, config.groups[sub].icon, config.icon], false)],
                        'icon-size': ['interpolate', ['linear'],
                            ['zoom'], 10, 0.7, 17, 1
                        ],
                        'icon-allow-overlap': false,
                        'text-field': [
                            'format',
                            Name1, {
                                'font-scale': 1,
                            },
                            ['case', Condition, '\n', ''], {},
                            ['case', Condition, Name0, ''], {
                                'font-scale': 0.75
                            },
                        ],
                        'text-font': ['Arial Unicode MS Regular', 'Noto Sans CJK JP Bold'],
                        'text-size': 14,
                        'text-offset': [0, 1.1],
                        'text-anchor': 'top',
                    },
                    'paint': {
                        'text-color': "#545d6a",
                    }
                })
                window.DataMap.on('mouseover', DatasetID, () => {
                    window.DataMap.getCanvas().style.cursor = 'pointer';
                })
                window.DataMap.on('mouseout', DatasetID, () => {
                    window.DataMap.getCanvas().style.cursor = '';
                })
                window.DataMap.on('click', DatasetID, (e) => {
                    let feature = e.features[0],
                        coor = feature.geometry.coordinates.slice(),
                        popup = buildPopup(config.template, feature.properties, locale);

                    while (Math.abs(e.lngLat.lng - coor[0]) > 180) {
                        coor[0] += e.lngLat.lng > coor[0] ? 360 : -360;
                    }

                    new mapboxgl.Popup()
                        .setLngLat(coor)
                        .setHTML(popup)
                        .addTo(window.DataMap);

                    let postProcess = {
                        tel: ['telephone', 'fax'],
                        mailto: ['email'],
                        '': ['website'],
                    }

                    for (let method in postProcess) {
                        $('.mapboxgl-popup-content')
                            .find(postProcess[method].map(tag => `span[tag=${tag}] span[type=value]`).join(','))
                            .each((i, elem) => {
                                let text = $(elem).text();
                                if (!/^n\.?a\.?$/i.test(text.trim())) {
                                    $(elem).html(`<a href='${method ? `${method}:` : ''}${text}'>${text}</a>`)
                                }
                            })
                    }
                    $('.mapboxgl-popup-content')
                        .find('span[tag=address] span[type=value]')
                        .on('click', () => {
                            window.DataMap.flyTo({
                                center: coor,
                                zoom: 15,
                                speed: 0.5,
                                essential: true
                            })
                        })
                })
            };
        if (!config.groups || !(sub in config.groups)) return;
        if ('list' in config.groups[sub]) {
            addLayer()
        } else {
            getJSON(`data/${type}/${sub}.json`)
                .then(res => {
                    window.DataCatalogue[type].groups[sub].list = res;
                    addLayer()
                    if ($('#layers-container').length) drawLayers()
                })
        }
        return;
    } else {
        if (retryCount.id == idx) retryCount.time++
        else {
            retryCount.id = idx;
            retryCount.time = 1;
        }
        loadingTimeout = setTimeout(() => {
            loadMap(type, sub, idx)
        }, 500 * (retryCount.time > 10 ? retryCount.time : 1))
    }
}

function grepParams(init = false) {
    let type = location.search.match(/type=([a-z]+)/),
        sub = location.search.match(/sub=([a-z]+)/);

    type = type ? type[1] : false;
    sub = sub ? sub[1] : false;

    if (typeof gtag !== 'undefined' && init && (type || sub)) {
        if (type) gtag('event', 'change_search_type', {
            event_category: 'changing',
            event_label: type
        })
        if (sub) gtag('event', 'change_search_subtype', {
            event_category: 'changing',
            event_label: sub
        })
    }

    return {
        type: type,
        sub: sub,
    }
}

(function () {
    let $btnLang = $('<button class="data-map-button" id="toggle-language"></button>'),
        $loading = $(`<div id="loading"><div>${Language.reduce((p, c, i) => p += `<span lang="${i}">${c.loading}</span>`, '')}...</div></div>`),
        $layers = $('<button class="data-map-button" id="toggle-layers"><img src="img/layer.svg" /></button>');

    window.DataLanguage = parseInt(sessionStorage.getItem('data-map-language') || 0) - 1;
    $('#map').attr('lang', window.DataLanguage + 1);
    $('#map').on('contextmenu', (e) => {
        e.stopImmediatePropagation();
        e.preventDefault();
        return false;
    })

    $layers.data('open', false)
    $layers.on('click', () => {
        if ($layers.data('open')) {
            $('#layers-container').remove()
        } else {
            drawLayers()
        }
        $layers.data('open', !$layers.data('open'))
    })
    $('#map').append($layers)
    $('#map').append($loading)
    getJSON('data/index.json')
        .then(res => {
            window.DataCatalogue = res;
            let {
                type,
            } = grepParams(true);

            type = type in res ? type : Object.keys(res)[0];
            return getJSON(`data/${type}/index.json`)
        })
        .then(res => {
            let id = res.id;
            if (!(id in window.DataCatalogue)) window.DataCatalogue[id] = {};
            window.DataCatalogue[id] = {
                ...window.DataCatalogue[id],
                ...res
            }
            return getJSON('data/locale.json')
        })
        .then(res => {
            window.DataLocale = res;
            window.DataMap = startMap();
            window.DataMap.on('load', () => {
                window.DataMapLoaded = true;
                $btnLang.appendTo('#map')
                $btnLang.click()

                let mapSvg = ['badminton', 'basketball', 'bicycle', 'child', 'disability', 'elderly', 'fitness', 'football', 'golf', 'graduation', 'help', 'horse-riding', 'hostel', 'jogging', 'swimming', 'table-tennis', 'tennis'];
                mapSvg.map(img => {
                    let path = `img/icon/${img}.png`;
                    window.DataMap.loadImage(path, (err, res) => {
                        if (err) console.error(`Loading image '${path}' failed`, err)
                        else window.DataMap.addImage(img, res)
                    })
                })
            })
            let {
                type,
                sub
            } = grepParams();
            loadMap(type, sub)

            let closeLayer = () => {
                if ($layers.data('open')) $layers.click();
                $('#title-container').removeClass('active')
            }
            window.DataMap.on('click', closeLayer)
            window.DataMap.on('dragstart', closeLayer)

            $btnLang.on('click', () => {
                window.DataLanguage = (window.DataLanguage + 1) % Language.length;
                sessionStorage.setItem('data-map-language', window.DataLanguage);
                $btnLang.text(Language[(window.DataLanguage + 1) % Language.length].text);
                $('#map').attr('lang', window.DataLanguage);
                ['country-label', 'state-label', 'settlement-major-label', 'settlement-minor-label', 'settlement-subdivision-label', 'airport-label', 'poi-label', 'water-point-label', 'water-line-label', 'natural-point-label', 'natural-line-label', 'waterway-label', 'road-label-simple', ]
                .map(label => window.DataMap.setLayoutProperty(label, 'text-field', ['get', `name_${Language[window.DataLanguage].code}`]))
            })
        })
})()