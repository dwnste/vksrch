import style from './style.scss'
import fetchJsonp from 'fetch-jsonp'
import moment from 'moment'


moment.locale('ru');


let myPlacemark,
        myMap,
        photoWrapper,
        previousQueryCoords,
        morePhotosButton, 
        photosAvailable;


const getPhotos = (coords, offset = 0, radius = 1000, count = 50) => {
    const [lat, long] = coords;
    const url = `//api.vk.com/method/photos.search?lat=${lat}&long=${long}&radius=${radius}&count=${count}&offset=${offset}`;
    return fetchJsonp(url)
    .then(function(response) {
        return response.json()
    }).then(function(json) {
        let photos;
        [photosAvailable, ...photos] = json.response;
        return photos;
    }).catch(function(ex) {
        console.log('parsing failed', ex)
    })
}


const updatePhotoWrapper = (content) => {
    photoWrapper.innerHTML = content ? photoWrapper.innerHTML + content : '';
}


const morePhotosButtonClick = () => {
    if (previousQueryCoords && photosAvailable > photoWrapper.childElementCount) {
        getPhotos(previousQueryCoords, undefined, undefined, photoWrapper.childElementCount).then(json=>updatePhotoWrapper(renderContent(json)));
    }
}


// Создание метки.
const createPlacemark = (coords) => {
    return new ymaps.Placemark(coords, {
        iconCaption: 'поиск...'
    }, {
        preset: 'islands#violetDotIconWithCaption',
        draggable: true
    });
}


const renderContent = (photos) => {
    let content;
    for (let element of photos) {
        const date = moment(element.created*1000).format('L');
        content+=`<div class="image"><img src="${element.src}"><a href="${element.src_big}" target="_blank"><h2><span>${date}</span></h2></a></div>`
    }
    return content;
}


// Определяем адрес по координатам (обратное геокодирование).
const getAddress = (coords) => {
    myPlacemark.properties.set('iconCaption', 'поиск...');
    ymaps.geocode(coords).then(function (res) {
        var firstGeoObject = res.geoObjects.get(0);
        myPlacemark.properties
            .set({
                // Формируем строку с данными об объекте.
                iconCaption: [
                    // Название населенного пункта или вышестоящее административно-территориальное образование.
                    firstGeoObject.getLocalities().length ? firstGeoObject.getLocalities() : firstGeoObject.getAdministrativeAreas(),
                    // Получаем путь до топонима, если метод вернул null, запрашиваем наименование здания.
                    firstGeoObject.getThoroughfare() || firstGeoObject.getPremise()
                ].filter(Boolean).join(', '),
                // В качестве контента балуна задаем строку с адресом объекта.
                balloonContent: firstGeoObject.getAddressLine()
            });
    });
}


const init = () => {
    photoWrapper = document.getElementById('photoWrap');
    morePhotosButton = document.getElementById('morePhotosButton');
    myMap = new ymaps.Map('map', {
        center: [55.753994, 37.622093],
        zoom: 9
    }, {
        searchControlProvider: 'yandex#search'
    });
    morePhotosButton.addEventListener('click', morePhotosButtonClick);
    myMap.events.add('click', (e) => {
        const coords = e.get('coords');
        
        updatePhotoWrapper('');

        getPhotos(coords).then(json=>updatePhotoWrapper(renderContent(json)));

        previousQueryCoords = coords;
        // Если метка уже создана – просто передвигаем ее.
        if (myPlacemark) {
            myPlacemark.geometry.setCoordinates(coords);
        }
        // Если нет – создаем.
        else {
            myPlacemark = createPlacemark(coords);
            myMap.geoObjects.add(myPlacemark);
            // Слушаем событие окончания перетаскивания на метке.
            myPlacemark.events.add('dragend', function () {
                const coords = myPlacemark.geometry.getCoordinates();
                getAddress(coords);
                updatePhotoWrapper('');
                getPhotos(coords).then(json=>updatePhotoWrapper(renderContent(json)));
                previousQueryCoords = coords;
            });
        }
        getAddress(coords);
    });
}


ymaps.ready(init);