const Language = [{
    code: 'en',
    lang: 'en',
    text: 'English',
    title: 'Hong Kong Geo Data Map',
    desc: 'Get the information of different facilities for you.',
    copyright: '© The Government of the HKSAR. All rights reserved.',
    credit: 'Source: The Government of the Hong Kong Special Administrative Region, HONG KONG GEODATA STORE',
    loading: 'Loading',
}, {
    code: 'zh-Hant',
    lang: 'tc',
    text: '繁體',
    title: '香港地理資料地圖',
    desc: '為你提供不同設施的資訊。',
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

function getType(type) {
    return getJSON(`data/${type}/index.json`)
        .then(res => {
            let id = res.id;
            window.DataCatalogue = window.DataCatalogue || {};
            if (!(id in window.DataCatalogue)) window.DataCatalogue[id] = {};
            window.DataCatalogue[id] = {
                ...window.DataCatalogue[id],
                ...res
            }
            if ($('#layers-container').length) drawLayers();
        })
}

function getSubType(type, sub) {
    return getJSON(`data/${type}/${sub}.json`)
        .then(res => {
            window.DataCatalogue = window.DataCatalogue || {};
            if (!(type in window.DataCatalogue)) window.DataCatalogue[type] = {
                groups: {
                    [sub]: {}
                }
            };
            window.DataCatalogue[type].groups[sub].list = res;
            if ($('#layers-container').length) drawLayers();
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
    let keys = template.match(/\{\{[a-z0-9,>:]+\}\}/g).map(key => key.replace(/[{}]/g, '')),
        result = {},
        max = 0,
        html = '';

    for (let i = 0; i < keys.length; i++) {
        let params = keys[i].split('>'),
            key = params[0].replace(/[^a-z0-9]/g, ''),
            needName = params[0].indexOf(':') != -1,
            isArray = params.length > 1;
        if (!(key in locale)) continue;

        let count = locale[key].length;
        if (count > max) max = count;
        for (let j = 0; j < count; j++) {
            let names = getLocalesNames(locale, key, j).filter(name => name in props);
            if (names.length == 0) continue;
            if (!result[keys[i]]) result[keys[i]] = [];

            if (isArray) {
                let _template = `<div>${params[1].split(',').reduce((p, c) => p += `<div>{{${c}}}</div>`, '')}</div>`;
                result[keys[i]].push(JSON.parse(props[names[0]]).reduce((p, c) => p += buildPopup(_template, c, locale), ''))
            } else {
                result[keys[i]].push((needName ? names[0] + ': ' : '') + `<span type='value'>${props[names[0]]}</span>`)
            }
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
    return html.replace(/<div><\/div>/g, '');
}

function isExistedLayer(id) {
    return typeof window.DataMap.getLayer(id) !== 'undefined'
}

function isVisibleLayer(id) {
    if (!isExistedLayer(id)) return false;
    let visibility = window.DataMap.getLayoutProperty(id, 'visibility')
    return typeof visibility === 'undefined' || visibility == 'visible';
}

function getVisibleLayers() {
    let ids = window.DataMap.getStyle().layers
        .map(v => v.id)
        .filter((v, i, l) => l.indexOf(v) == i)
        .filter(v => /[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}/.test(v))
        .filter(v => DataMap.getLayoutProperty(v, 'visibility') !== 'none'),
        res = {};
    for (let type in window.DataCatalogue) {
        if ('groups' in window.DataCatalogue[type]) {
            for (let sub in window.DataCatalogue[type].groups) {
                if ('list' in window.DataCatalogue[type].groups[sub]) {
                    let _ids = ids.filter(v => v in window.DataCatalogue[type].groups[sub].list);
                    if (_ids.length) {
                        if (!(type in res)) res[type] = {};
                        res[type][sub] = _ids;
                    }
                }
            }
        }
    }
    return res;
}

function getCurrentStatus() {
    let {
        lat,
        lng
    } = window.DataMap.getCenter(),
        layers = getVisibleLayers();

    return {
        layers: Object.keys(layers).map(c => `${c}>${Object.keys(layers[c]).map(v => `${v}:${layers[c][v].join(',')}`).join(';')}`).join('|'),
        center: [lng, lat].map(v => parseFloat(v.toFixed(5))),
        zoom: window.DataMap.getZoom()
    }
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

let redrawTimeout = 0;

function drawLayers(immediate = false) {
    clearTimeout(redrawTimeout);
    if (!immediate) {
        redrawTimeout = setTimeout(() => drawLayers(true), 500);
        return;
    }
    let $layer = $('#layers-container');
    if ($layer.length == 0) {
        $layer = $('<div id="layers-container"></div>');
        $('#map').append($layer);
    }
    let addLocale = ($elem, data) => {
            Language.map((lang, i) => $elem.append(`<span lang='${i}'>${data[lang.lang]}</span>`))
        },
        hasGroups = (catalogue) => !!window.DataCatalogue[catalogue].groups,
        hasList = (catalogue, group) => !!window.DataCatalogue[catalogue].groups[group].list,
        handleRow = ($div, catalogue, group = false) => {
            let check = group ? hasList : hasGroups,
                act = group ? getSubType : getType,
                fn = () => {
                    $div.toggleClass('expand')
                    if (!check(catalogue, group)) {
                        act(catalogue, group).then(() => {
                            $div.removeClass('download')
                            drawLayers();
                        })
                    }
                };
            $div.on('click', fn)
            $div.attr('data-uuid', catalogue + (group ? `-${group}` : ''))
            if (!check(catalogue, group)) {
                $div.addClass('download')
                return false;
            }
            return true;
        };
    for (let catalogue in window.DataCatalogue) {
        let $parent = $layer.find(`.parent[data-uuid="${catalogue}"]`),
            $children = $layer.find(`.parent[data-uuid="${catalogue}"] + div`);

        if ($parent.length == 0) {
            let $cat = $(`<div class='catalogue'></div>`)
            $parent = $(`<div class='parent'></div>`);
            $children = $('<div></div>');
            $cat.append($parent);
            $cat.append($children);
            addLocale($parent, window.DataCatalogue[catalogue])
            $layer.append($cat);
            if (!handleRow($parent, catalogue)) continue;
        }

        if (hasGroups(catalogue)) $parent.removeClass('download');

        for (let group in window.DataCatalogue[catalogue].groups) {
            let $child = $children.find(`.child[data-uuid="${catalogue}-${group}"]`),
                $lists = $children.find(`.child[data-uuid="${catalogue}-${group}"] + div`);

            if ($child.length == 0) {
                $child = $(`<div class='child'></div>`);
                $lists = $('<div></div>');
                $children.append($child);
                $children.append($lists);
                addLocale($child, window.DataCatalogue[catalogue].groups[group])
                if (!handleRow($child, catalogue, group)) continue;
            }

            if (hasList(catalogue, group)) $child.removeClass('download');

            for (let list in window.DataCatalogue[catalogue].groups[group].list) {
                let uuidList = `${catalogue}-${group}-${list}`,
                    $list = $lists.find(`.list[data-uuid="${uuidList}"]`),
                    updateStatus = () => {
                        $list.removeClass('visible download hidden')
                        let src = '';
                        if (!isExistedLayer(list)) {
                            src = 'download'
                        } else if (!isVisibleLayer(list)) {
                            src = 'hidden'
                        }
                        $list.addClass(src)
                    };

                if ($list.length == 0) {
                    $list = $(`<div class='list'></div>`);
                    $list.attr('data-uuid', uuidList)
                    $lists.append($list);
                    $list.on('click', () => {
                        toggleLayer(catalogue, group, list)
                        updateStatus()
                    })
                    addLocale($list, window.DataCatalogue[catalogue].groups[group].list[list])
                }

                updateStatus();
            }
        }
    }
}

let loadingTimeout = 0,
    retryCount = {
        id: '',
        time: 0,
    };

function loadMap(_type, _sub, _idx) {
    let type = _type && _type in window.DataCatalogue ? _type : Object.keys(window.DataCatalogue)[0];
    let sub = _sub && window.DataCatalogue[type].groups && _sub in window.DataCatalogue[type].groups ? _sub : window.DataCatalogue[type].groups ? Object.keys(window.DataCatalogue[type].groups)[0] : false;
    let idx = _idx || 0;
    if (sub === false) {
        getType(type)
            .then(() => {
                let _id = `${_type}-${_sub}-${_idx}`;
                if (retryCount.id == _id) retryCount.time++
                else {
                    retryCount.id = _id;
                    retryCount.time = 1;
                }
                if (retryCount.time < 3) loadMap(_type, _sub, _idx)
            })
        return;
    }
    clearTimeout(loadingTimeout)
    if (window.DataMapLoaded) {
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
                        coor = feature.geometry.coordinates,
                        popup = buildPopup(config.template, feature.properties, locale);

                    if (feature.geometry.type == "MultiPoint") {
                        let maxLong = 0,
                            minLong = 999,
                            maxLat = 0,
                            minLat = 999;
                        coor.map(v => {
                            if (v[0] > maxLong) maxLong = v[0];
                            if (v[0] < minLong) minLong = v[0];
                            if (v[1] > maxLat) maxLat = v[1];
                            if (v[1] < minLat) minLat = v[1];
                        })
                        coor = [(maxLong + minLong) / 2, (maxLat + minLat) / 2]
                    }

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
                window.DataMap.once('data', () => {
                    if ($('#layers-container').length) drawLayers();
                })
            };
        if (!config.groups || !(sub in config.groups)) return;
        if ('list' in config.groups[sub]) {
            addLayer()
        } else {
            getSubType(type, sub).then(addLayer)
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
        sub = location.search.match(/sub=([a-z]+)/),
        id = location.search.match(/id=([a-z0-9-]+)/);

    type = type ? type[1] : false;
    sub = sub ? sub[1] : false;
    id = id ? id[1] : false;

    if (typeof gtag !== 'undefined' && init && (type || sub || id)) {
        if (type) gtag('event', 'change_search_type', {
            event_category: 'changing',
            event_label: type
        })
        if (sub) gtag('event', 'change_search_subtype', {
            event_category: 'changing',
            event_label: sub
        })
        if (id) gtag('event', 'change_search_id', {
            event_category: 'changing',
            event_label: id
        })
    }

    return {
        type: type,
        sub: sub,
        id: id,
    }
}

(function () {
    let $btnLang = $('<button class="data-map-button" id="toggle-language"></button>'),
        $loading = $(`<div id="loading"><div>${Language.reduce((p, c, i) => p += `<span lang="${i}">${c.loading}</span>`, '')}...</div></div>`),
        $layers = $('<button class="data-map-button" id="toggle-layers"><img src="img/layer.svg" /></button>'),
        $title = $('<div id="title"></div>'),
        $container = $('<div id="title-container"></div>'),
        $btnToggle = $('<button class="data-map-button" id="toggle-title"></button>'),
        $btnHide = $('<span id="collapse-title"></span>');

    window.DataLanguage = parseInt(sessionStorage.getItem('data-map-language') || /zh($|-)/.test(navigator.language) ? 1 : 0) - 1;
    $('#map').attr('lang', window.DataLanguage + 1);
    $('#map').on('contextmenu', (e) => {
        e.stopImmediatePropagation();
        e.preventDefault();
        return false;
    })

    $layers.data('open', false)
    $layers.on('click', () => {
        let $container = $('#layers-container');
        if ($container.length == 0) drawLayers(true);
        else $('#layers-container').toggleClass('hidden');
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
            return getType(type)
        })
        .then(() => getJSON('data/locale.json'))
        .then(res => {
            window.DataLocale = res;
            window.DataMap = startMap();
            window.DataMap.on('load', () => {
                window.DataMapLoaded = true;
                $btnLang.appendTo('#map')
                $btnLang.click()

                let mapSvg = ['badminton', 'basketball', 'bicycle', 'book', 'child', 'disability', 'driving', 'elderly', 'fitness', 'football', 'golf', 'government', 'graduation', 'health', 'help', 'horse-riding', 'hostel', 'jogging', 'museum', 'outdoor', 'post', 'swimming', 'table-tennis', 'tennis', 'wifi'];
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
                sub,
                id
            } = grepParams();
            loadMap(type, sub, id)

            let closeLayer = () => {
                if ($('#layers-container').length && !$('#layers-container').hasClass('hidden')) $layers.click();
                $('#title-container').removeClass('active')
            }
            window.DataMap.on('click', closeLayer)
            window.DataMap.on('dragstart', closeLayer)

            $title.append(Language.reduce((p, c, i) => p += `<div lang=${i}><div class='heading'>${c.title}</div><div class='heading'>${c.desc}</div><span class='attribution'>${c.credit}</span><br><span class='copyright'>${c.copyright}</span></div>`, ''))

            $title.append($btnHide);
            $container.append($title);
            $container.append($btnToggle);
            $('#map').append($container);

            $btnToggle.on('click', () => {
                $container.toggleClass('active')
            })

            $btnHide.on('click', () => {
                $container.addClass('force-collapse')
            })

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