import os
import requests
import math
from flask import Flask, render_template, jsonify, request
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

# Helper to calculate Haversine distance
def calculate_distance(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) * math.sin(dlat / 2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(dlon / 2) * math.sin(dlon / 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

MOCK_DATA = [
    {
        "place_id": "mock1",
        "name": "金龍港式點心",
        "rating": 4.8,
        "user_ratings_total": 342,
        "vicinity": "信義區松高路123號",
        "geometry": {"location": {"lat": 25.033, "lng": 121.565}},
        "photos": [{"photo_reference": "mock1"}],
        "types": ["restaurant", "food"]
    },
    {
        "place_id": "mock2",
        "name": "豪大大雞排",
        "rating": 4.6,
        "user_ratings_total": 128,
        "vicinity": "夜市路456號",
        "geometry": {"location": {"lat": 25.034, "lng": 121.564}},
        "photos": [{"photo_reference": "mock2"}],
        "types": ["meal_takeaway", "food"]
    },
    {
        "place_id": "mock3",
        "name": "50嵐 (信義店)",
        "rating": 4.9,
        "user_ratings_total": 890,
        "vicinity": "松壽路789號",
        "geometry": {"location": {"lat": 25.032, "lng": 121.566}},
        "photos": [{"photo_reference": "mock3"}],
        "types": ["cafe", "food"]
    },
    {
        "place_id": "mock4",
        "name": "老張牛肉麵",
        "rating": 4.5,
        "user_ratings_total": 210,
        "vicinity": "永康街321號",
        "geometry": {"location": {"lat": 25.035, "lng": 121.563}},
        "photos": [{"photo_reference": "mock4"}],
        "types": ["restaurant", "food"]
    },
    {
        "place_id": "mock5",
        "name": "深夜食堂串燒",
        "rating": 4.7,
        "user_ratings_total": 56,
        "vicinity": "市民大道555號",
        "geometry": {"location": {"lat": 25.031, "lng": 121.567}},
        "photos": [{"photo_reference": "mock5"}],
        "types": ["point_of_interest", "food"]
    }
]

# Generate more mock data
import random
for i in range(50):
    base = MOCK_DATA[i % 5]
    new_item = base.copy()
    new_item['name'] = f"{base['name']} - 分店{i+1}"
    new_item['geometry'] = {"location": {
        "lat": base['geometry']['location']['lat'] + (random.random() - 0.5) * 0.02,
        "lng": base['geometry']['location']['lng'] + (random.random() - 0.5) * 0.02
    }}
    MOCK_DATA.append(new_item)

@app.route('/')
def index():
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY", "")
    return render_template('index.html', api_key=api_key)

@app.route('/api/places')
def get_places():
    lat = request.args.get('lat', type=float)
    lng = request.args.get('lng', type=float)
    radius = request.args.get('radius', default=1500, type=int)
    
    if not lat or not lng:
        return jsonify({"error": "Missing latitude or longitude"}), 400

    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")

    if not api_key:
        # Return Augmented Mock Data
        results = []
        for item in MOCK_DATA:
            # Shift mock data slightly around the user
            mock_item = item.copy()
            # Simple shift relative to user for demo purposes if "close enough"
            # In a real mock, we might just return them as is, but let's recalculate distance
            place_lat = mock_item['geometry']['location']['lat']
            place_lng = mock_item['geometry']['location']['lng']
            # If user is far, move the mock data to them so they see something
            if calculate_distance(lat, lng, place_lat, place_lng) > 5.0:
                 mock_item['geometry']['location']['lat'] = lat + (place_lat - 25.033)
                 mock_item['geometry']['location']['lng'] = lng + (place_lng - 121.565)
            
            dist = calculate_distance(lat, lng, mock_item['geometry']['location']['lat'], mock_item['geometry']['location']['lng'])
            mock_item['distance_km'] = round(dist, 2)
            results.append(mock_item)
        
        return jsonify({"results": results, "source": "mock"})

    # Call Google Places API
    url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    
    all_results = []
    page_token = None
    
    # Fetch up to 3 pages (max 60 results usually)
    import time
    
    for _ in range(3):
        params = {
            "location": f"{lat},{lng}",
            "radius": radius,
            "type": "restaurant",
            "keyword": "food",
            "language": "zh-TW",
            "key": api_key
        }
        if page_token:
            params["pagetoken"] = page_token
            # Google requires a short delay before the next_page_token is valid
            time.sleep(2)
            
        try:
            response = requests.get(url, params=params)
            data = response.json()
            
            if data.get('status') not in ['OK', 'ZERO_RESULTS']:
                print(f"API Error: {data}")
                break
                
            current_results = data.get('results', [])
            all_results.extend(current_results)
            
            page_token = data.get('next_page_token')
            if not page_token:
                break
                
        except Exception as e:
            print(f"Exception fetching places: {e}")
            break
    
    # Process all collected results
    # Deduplicate based on place_id just in case
    seen = set()
    unique_results = []
    for p in all_results:
        if p['place_id'] not in seen:
            seen.add(p['place_id'])
            unique_results.append(p)
            
    # Filter for high rating
    high_rated = [p for p in unique_results if p.get('rating', 0) >= 4.0]
    
    # Calculate distance for each
    for p in high_rated:
        p_lat = p['geometry']['location']['lat']
        p_lng = p['geometry']['location']['lng']
        dist = calculate_distance(lat, lng, p_lat, p_lng)
        p['distance_km'] = round(dist, 2)
        
    # Sort by distance (Near to Far)
    high_rated.sort(key=lambda x: x['distance_km'])

    return jsonify({"results": high_rated, "source": "google", "count": len(high_rated)})

@app.route('/api/details')
def get_details():
    place_id = request.args.get('place_id')
    api_key = os.environ.get("GOOGLE_MAPS_API_KEY")
    
    if not place_id:
        return jsonify({"error": "Missing place_id"}), 400

    # Mock Data Logic
    if not api_key or place_id.startswith('mock'):
        import random
        users = ["小明", "美食家", "Jessica", "David", "阿豪"]
        comments = [
            "這家真的很好吃！推薦！",
            "環境舒適，服務也很棒。",
            "CP值很高，下次還會再來。",
            "味道稍微有點鹹，但整體不錯。",
            "排隊排很久，但值得等待。"
        ]
        
        mock_reviews = []
        count = random.randint(3, 5)
        for _ in range(count):
            review_item = {
                "author_name": random.choice(users),
                "rating": random.randint(4, 5),
                "relative_time_description": f"{random.randint(1, 30)} 天前",
                "text": random.choice(comments),
                "profile_photo_url": "https://lh3.googleusercontent.com/a/default-user"
            }
            
            # Randomly add photos to some reviews
            if random.random() > 0.6:
                review_item["photos"] = [
                   {"url": f"https://source.unsplash.com/200x200/?food,snack&sig={random.randint(1,100)}"}
                ]
                # Maybe 2 photos
                if random.random() > 0.5:
                     review_item["photos"].append({"url": f"https://source.unsplash.com/200x200/?food,drink&sig={random.randint(101,200)}"})
            
            mock_reviews.append(review_item)
            
        return jsonify({"result": {"reviews": mock_reviews}, "source": "mock"})

    # Real API Logic
    url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "place_id": place_id,
        "fields": "name,reviews,rating,user_ratings_total",
        "language": "zh-TW",
        "key": api_key
    }
    
    try:
        response = requests.get(url, params=params)
        data = response.json()
        
        if data.get('status') != 'OK':
             return jsonify({"error": "External API error", "details": data.get('status')}), 502
             
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=True)
