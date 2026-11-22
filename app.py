from flask import Flask, send_from_directory, request, jsonify
import requests
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

@app.route("/")
def home():
    return send_from_directory(".", "index.html")
@app.route("/api/search-food")
def search_food():
    query = request.args.get("query", "").strip()

    if not query:
        return jsonify({"error": "Please enter a food name"}), 400

    api_key = os.getenv("USDA_API_KEY")

    if not api_key:
        return jsonify({"error": "USDA API key is missing"}), 500
        
    try:
        response = requests.get(
            "https://api.nal.usda.gov/fdc/v1/foods/search",
            params={
                "query": query,
                "api_key": api_key,
                "pageSize": 10
            },
            timeout=15
        )

        response.raise_for_status()
        return jsonify(response.json())

    except requests.RequestException:
        return jsonify({"error": "Could not connect to food database"}), 502
if __name__ == "__main__":
    app.run(debug=True)