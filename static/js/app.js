document.addEventListener('DOMContentLoaded', () => {
    // State
    const state = {
        places: [],
        userLocation: null,
        isMapView: false,
        map: null,
        markers: []
    };

    // Elements
    const views = {
        list: document.getElementById('listView'),
        map: document.getElementById('mapView')
    };
    const buttons = {
        list: document.getElementById('listViewBtn'),
        map: document.getElementById('mapViewBtn'),
        retry: document.getElementById('retryBtn')
    };
    const containers = {
        cards: document.getElementById('cardsContainer'),
        loading: document.getElementById('loadingState'),
        error: document.getElementById('errorState'),
        toast: document.getElementById('location-warning')
    };

    // Modal Elements
    const modal = {
        el: document.getElementById('reviewsModal'),
        close: document.querySelector('.close-modal'),
        title: document.getElementById('modalTitle'),
        list: document.getElementById('modalReviews')
    };

    // Initialize
    init();

    function init() {
        setupEventListeners();
        setupModalListeners();
        getUserLocation();
    }

    function setupModalListeners() {
        modal.close.addEventListener('click', closeModal);
        window.addEventListener('click', (e) => {
            if (e.target === modal.el) closeModal();
        });
    }

    function closeModal() {
        modal.el.classList.add('hidden');
    }

    function openReviewModal(placeId, name) {
        modal.el.classList.remove('hidden');
        modal.title.textContent = name;
        modal.list.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fa-solid fa-circle-notch fa-spin" style="color:var(--primary-color)"></i> 載入中...</div>';

        loadReviews(placeId);
    }

    async function loadReviews(placeId) {
        try {
            // Check if mock or real placeId. If mock, we might pass a special flag or just handle by ID pattern
            // Actually our backend handles 'mock' prefix.
            // If real place, we need real ID.

            // Note: The place object in fetchPlaces has a place_id.

            const response = await fetch(`/api/details?place_id=${placeId}`);
            const data = await response.json();

            if (data.error) throw new Error(data.error);

            const reviews = data.result.reviews || [];

            renderReviews(reviews);

        } catch (error) {
            console.error(error);
            modal.list.innerHTML = '<p style="text-align:center; color:red;">無法載入評論</p>';
        }
    }

    function renderReviews(reviews) {
        modal.list.innerHTML = '';

        if (reviews.length === 0) {
            modal.list.innerHTML = '<p style="text-align:center; color:#666;">尚無評論</p>';
            return;
        }

        reviews.forEach(review => {
            const div = document.createElement('div');
            div.className = 'review-item';

            // Stars
            let starsHtml = '';
            for (let i = 0; i < 5; i++) {
                starsHtml += i < review.rating ? '<i class="fa-solid fa-star"></i>' : '<i class="fa-regular fa-star"></i>';
            }

            let photosHtml = '';
            // Support checking 'photos' (mock) or if API changes
            if (review.photos && review.photos.length > 0) {
                photosHtml = '<div class="review-photos">';
                review.photos.forEach(photo => {
                    let src = "";
                    if (photo.url) {
                        src = photo.url;
                    } else if (photo.photo_reference && window.GOOGLE_MAPS_API_KEY) {
                        src = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=200&photoreference=${photo.photo_reference}&key=${window.GOOGLE_MAPS_API_KEY}`;
                    }

                    if (src) {
                        photosHtml += `<img src="${src}" alt="Review Photo" class="review-img">`;
                    }
                });
                photosHtml += '</div>';
            }

            div.innerHTML = `
                <div class="review-header">
                    <span>${review.author_name}</span>
                    <span class="review-rating">${starsHtml}</span>
                </div>
                <div style="font-size:0.8rem; color:#999; margin-bottom:4px;">${review.relative_time_description}</div>
                <p class="review-text">${review.text}</p>
                ${photosHtml}
            `;
            modal.list.appendChild(div);
        });
    }

    function setupEventListeners() {
        buttons.list.addEventListener('click', () => switchView('list'));
        buttons.map.addEventListener('click', () => switchView('map'));
        buttons.retry.addEventListener('click', () => {
            hideError();
            getUserLocation();
        });
    }

    function switchView(viewName) {
        state.isMapView = viewName === 'map';

        // Update Buttons
        buttons.list.classList.toggle('active', !state.isMapView);
        buttons.map.classList.toggle('active', state.isMapView);

        // Update View Visibility
        views.list.classList.toggle('active', !state.isMapView);
        views.map.classList.toggle('active', state.isMapView);

        if (state.isMapView && !state.map) {
            initMap();
        }
    }

    function getUserLocation() {
        showLoading();

        if (!navigator.geolocation) {
            handleLocationError(new Error("瀏覽器不支援地理位置功能"));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                state.userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                fetchPlaces();
            },
            () => {
                // If location denied, use a default fallback (Taipei 101 approx) or Mock logic will handle it if we send 0,0?
                // Better to just notify user and use a hardcoded default for the purpose of the demo
                showToast("無法取得位置，將使用預設位置");
                state.userLocation = { lat: 25.033, lng: 121.565 }; // Taipei 101 area
                fetchPlaces();
            }
        );
    }

    async function fetchPlaces() {
        try {
            const { lat, lng } = state.userLocation;
            const response = await fetch(`/api/places?lat=${lat}&lng=${lng}`);

            if (!response.ok) throw new Error("API請求失敗");

            const data = await response.json();

            if (data.error) throw new Error(data.error);

            state.places = data.results || [];

            if (data.source === 'mock') {
                showToast("使用模擬資料 (未提供 API Key)");
            }

            renderPlaces();
            hideLoading();

            // If map is already visible (rare on load) or init later
            if (state.map) updateMapMarkers();

        } catch (error) {
            console.error(error);
            hideLoading();
            showError("無法載入地點，請稍後再試");
        }
    }

    // Updated State
    Object.assign(state, {
        renderedCount: 0,
        batchSize: 10,
        isLoadingMore: false,
        observer: null,
        currentInfoWindow: null // Track active InfoWindow
    });

    function renderPlaces(reset = true) {
        if (reset) {
            containers.cards.innerHTML = '';
            state.renderedCount = 0;
            // Scroll to top
            views.list.scrollTop = 0;
        }

        if (state.places.length === 0) {
            containers.cards.innerHTML = '<p style="text-align:center; col-span:full;">附近沒有找到高分美食。</p>';
            return;
        }

        const template = document.getElementById('cardTemplate');

        // Slice the next batch
        const nextBatch = state.places.slice(state.renderedCount, state.renderedCount + state.batchSize);

        if (nextBatch.length === 0) {
            // No more to show
            return;
        }

        nextBatch.forEach(place => {
            const clone = template.content.cloneNode(true);

            // Image
            const img = clone.querySelector('.card-img');
            if (place.photos && place.photos.length > 0) {
                const photoRef = place.photos[0].photo_reference;
                if (photoRef.startsWith('mock')) {
                    img.src = `https://source.unsplash.com/400x300/?food,restaurant&sig=${Math.random()}`;
                } else if (window.GOOGLE_MAPS_API_KEY) {
                    img.src = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoRef}&key=${window.GOOGLE_MAPS_API_KEY}`;
                } else {
                    img.src = `https://source.unsplash.com/400x300/?food,restaurant`;
                }
            } else {
                img.src = "https://source.unsplash.com/400x300/?food";
            }

            // Content
            clone.querySelector('.place-name').textContent = place.name;
            clone.querySelector('.place-distance').textContent = `${place.distance_km} km`;
            clone.querySelector('.place-address span').textContent = place.vicinity;
            clone.querySelector('.review-count').textContent = `(${place.user_ratings_total})`;

            // Ratings
            const starsContainer = clone.querySelector('.stars');
            const rating = Math.round(place.rating);
            for (let i = 0; i < 5; i++) {
                const star = document.createElement('i');
                star.classList.add(i < rating ? 'fa-solid' : 'fa-regular');
                star.classList.add('fa-star');
                starsContainer.appendChild(star);
            }

            // Directions
            const encodedName = encodeURIComponent(place.name + " " + place.vicinity);
            clone.querySelector('.direction-btn').href = `https://www.google.com/maps/search/?api=1&query=${encodedName}`;

            // Reviews Button
            clone.querySelector('.review-btn').onclick = () => openReviewModal(place.place_id || 'mock', place.name);

            containers.cards.appendChild(clone);
        });

        state.renderedCount += nextBatch.length;

        // Setup Sentinel for Infinite Scroll
        setupSentinel();
    }

    function setupSentinel() {
        const sentinel = document.getElementById('sentinel');
        const spinner = document.getElementById('loadMoreSpinner');

        if (state.renderedCount >= state.places.length) {
            if (state.observer) state.observer.disconnect();
            spinner.classList.add('hidden');
            return;
        }

        if (state.observer) state.observer.disconnect();

        state.observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                spinner.classList.remove('hidden');
                // Simulate small delay or just action
                setTimeout(() => {
                    renderPlaces(false);
                    spinner.classList.add('hidden');
                }, 500);
            }
        }, { root: null, margin: '100px' });

        state.observer.observe(sentinel);
    }

    function initMap() {
        if (!state.userLocation) return;

        // If Google Maps script is not loaded (no API Key), we can't show a real map.
        // We could show a static image or a message.
        if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
            document.getElementById('googleMap').innerHTML = `
                <div style="display:flex; justify-content:center; align-items:center; height:100%; background:#eee; color:#666; flex-direction:column; text-align:center; padding:20px;">
                    <i class="fa-regular fa-map" style="font-size:3rem; margin-bottom:15px;"></i>
                    <h3>地圖無法使用</h3>
                    <p>請新增 Google Maps API Key 以檢視地圖。</p>
                </div>
            `;
            return;
        }

        state.map = new google.maps.Map(document.getElementById("googleMap"), {
            zoom: 15,
            center: state.userLocation,
            disableDefaultUI: false,
            styles: [
                {
                    "featureType": "poi",
                    "elementType": "labels.icon",
                    "stylers": [{ "visibility": "off" }]
                }
            ]
        });

        // Click on map to close InfoWindow
        state.map.addListener('click', () => {
            if (state.currentInfoWindow) {
                state.currentInfoWindow.close();
                state.currentInfoWindow = null;
            }
        });

        // Add user marker
        new google.maps.Marker({
            position: state.userLocation,
            map: state.map,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: "#4285F4",
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: "white",
            },
            title: "您的位置"
        });

        updateMapMarkers();
    }

    function updateMapMarkers() {
        if (!state.map) return;

        // Clear existing (if any logic for refresh added later)

        state.places.forEach(place => {
            const loc = place.geometry.location;
            const marker = new google.maps.Marker({
                position: loc,
                map: state.map,
                title: place.name,
                animation: google.maps.Animation.DROP
            });

            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="padding:5px;">
                        <h3 style="margin:0 0 5px 0; font-size:1rem;">${place.name}</h3>
                        <div>${place.rating} ⭐</div>
                        <div>${place.distance_km} km</div>
                    </div>
                `
            });

            marker.addListener('click', () => {
                // Close existing
                if (state.currentInfoWindow) {
                    state.currentInfoWindow.close();
                }

                infoWindow.open(state.map, marker);
                state.currentInfoWindow = infoWindow;
            });
        });
    }

    // UI Helpers
    function showLoading() {
        containers.loading.classList.remove('hidden');
        views.list.classList.add('hidden'); // Temporarily hide list while loading? Or keep it?
        // Actually better to hide list if it's initial load.
        if (state.places.length === 0) views.list.classList.add('hidden');
        containers.error.classList.add('hidden');
    }

    function hideLoading() {
        containers.loading.classList.add('hidden');
        if (!state.isMapView) views.list.classList.remove('hidden');
    }

    function showError(msg) {
        containers.loading.classList.add('hidden');
        views.list.classList.add('hidden');
        containers.error.classList.remove('hidden');
        document.getElementById('errorMessage').textContent = msg;
    }

    function hideError() {
        containers.error.classList.add('hidden');
    }

    function showToast(msg) {
        containers.toast.innerHTML = `<i class="fa-solid fa-info-circle"></i> ${msg}`;
        containers.toast.classList.remove('hidden');
        setTimeout(() => {
            containers.toast.classList.add('hidden');
        }, 5000);
    }
});
