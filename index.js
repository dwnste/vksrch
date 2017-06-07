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


const getPhotos = ({lat, long}, radius = 1000, count = 50, offset = 0) => {
    const url = `//api.vk.com/method/photos.search?lat=${lat}&long=${long}&radius=${radius}&count=${count}&offset=${offset}`;
    
    return fetchJsonp(url)
                .then( response => response.json())
                .then( ({ response }) => {
                            let [photosAvailable, ...photos] = response;
                            return {photosAvailable, photos};
                        })
                .catch( ex => console.log('parsing failed', ex) );
}


const updatePhotoWrapper = (content) => {
    photoWrapper.innerHTML = content ? photoWrapper.innerHTML + content : '';
}


const morePhotosButtonClick = () => {
    if (previousQueryCoords && photosAvailable > photoWrapper.childElementCount) {
        getPhotos(previousQueryCoords, undefined, undefined, photoWrapper.childElementCount).then(photoResponse=>{
            photosAvailable = photoResponse.photosAvailable;
            updatePhotoWrapper(renderContent(photoResponse.photos));
        });
    }
}

const myMapClick = (e) => {
        const coords = e.get('coords');
        
        updatePhotoWrapper('');

        const [lat, long] = coords;

        getPhotos({lat, long}).then(photoResponse=>{
            photosAvailable = photoResponse.photosAvailable;
            updatePhotoWrapper(renderContent(photoResponse.photos));
        });

        previousQueryCoords = {lat, long};
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
                updateMyPlacemark(getGeoObject(coords));
                updatePhotoWrapper('');

                const [lat, long] = coords;

                getPhotos({lat, long}).then(photoResponse=>{
                    photosAvailable = photoResponse.photosAvailable;
                    updatePhotoWrapper(renderContent(photoResponse.photos));
                });

                previousQueryCoords = {lat, long};
            });
        }

        updateMyPlacemark(coords);
    };

// Создание метки.
const createPlacemark = (coords) => {
    return new ymaps.Placemark(coords, {
        iconCaption: 'поиск...'
    }, {
        preset: 'islands#blackDotIconWithCaption',
        draggable: true
    });
}


const renderContent = (photos) =>
    photos.map(element=>`<div class="image"><img src="${element.src}"><a href="${element.src_big}" target="_blank"><h2><span>${moment(element.created*1000).format('L')}</span></h2></a></div>`).join('');


// Определяем адрес по координатам (обратное геокодирование).
const getGeoObject = (coords) => {
    return ymaps.geocode(coords).then(res=>res.geoObjects.get(0));
}

const updateMyPlacemark = (coords) => {
    myPlacemark.properties.set('iconCaption', 'поиск...');

    getGeoObject(coords).then(firstGeoObject => {

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

    myMap.events.add('click', e => myMapClick(e));
}


ymaps.ready(init);