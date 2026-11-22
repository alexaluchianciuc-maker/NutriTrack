
/* ==========================================
   NUTRITRACK
   Main Application Logic
========================================== */

console.log("NutriTrack is connected!");

// ------------------------------------------
// 1. STORAGE
// ------------------------------------------

function loadData(key, fallback) {
    try {
        const savedData = localStorage.getItem(key);
        return savedData ? JSON.parse(savedData) : fallback;
    } catch (error) {
        console.error("Could not load:", key, error);
        return fallback;
    }
}

function saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

let foodEntries = loadData("nutriTrackEntries", []);
let waterEntries = loadData("nutriTrackWater", []);
let weightEntries = loadData("nutriTrackWeight", []);

let selectedFood = null;
let selectedDate = getLocalDate();

let nutritionChart = null;
let macroChart = null;
let weightChart = null;
let weeklyChart = null;


// ------------------------------------------
// 2. DATE HELPERS
// ------------------------------------------

function getLocalDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function formatDate(dateString) {
    if (!dateString) return "";

    const parts = dateString.split("-");

    if (parts.length !== 3) return dateString;

    const date = new Date(
        Number(parts[0]),
        Number(parts[1]) - 1,
        Number(parts[2])
    );

    return date.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
    });
}

function getLastSevenDays() {
    const dates = [];

    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(getLocalDate(date));
    }

    return dates;
}


// ------------------------------------------
// 3. GENERAL PAGE ELEMENTS
// ------------------------------------------

const dateElement = document.getElementById("current-date");

if (dateElement) {
    dateElement.textContent = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });
}


// ------------------------------------------
// 4. NAVIGATION
// ------------------------------------------

const navigationButtons = document.querySelectorAll(".nav-link");
const pageSections = document.querySelectorAll(".page-section");

function showSection(sectionId) {
    pageSections.forEach(function(section) {
        section.classList.toggle("active", section.id === sectionId);
    });

    navigationButtons.forEach(function(button) {
        button.classList.toggle(
            "active",
            button.dataset.section === sectionId
        );
    });

    if (sectionId === "analytics") {
        updateNutritionCharts();
    }

    if (sectionId === "weight") {
        updateWeightChart();
    }

    if (sectionId === "insights") {
        updateWeeklyInsights();
    }
}

navigationButtons.forEach(function(button) {
    button.addEventListener("click", function() {
        showSection(button.dataset.section);
    });
});


// ------------------------------------------
// 5. NUTRITION CALCULATIONS
// ------------------------------------------

function getDailyNutrition(date) {
    const totals = {
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0
    };

    foodEntries
        .filter(function(entry) {
            return entry.date === date;
        })
        .forEach(function(entry) {
            totals.calories += Number(entry.calories) || 0;
            totals.protein += Number(entry.protein) || 0;
            totals.fat += Number(entry.fat) || 0;
            totals.carbs += Number(entry.carbs) || 0;
        });

    return totals;
}

function updateNutritionSummary() {
    const totals = getDailyNutrition(selectedDate);

    document.getElementById("total-calories").textContent =
        totals.calories.toFixed(1) + " kcal";

    document.getElementById("total-protein").textContent =
        totals.protein.toFixed(1) + " g";

    document.getElementById("total-fat").textContent =
        totals.fat.toFixed(1) + " g";

    document.getElementById("total-carbs").textContent =
        totals.carbs.toFixed(1) + " g";

    return totals;
}


// ------------------------------------------
// 6. FOOD DIARY
// ------------------------------------------

const datePicker = document.getElementById("diary-date");
const foodList = document.getElementById("food-list");

if (datePicker) {
    datePicker.value = selectedDate;

    datePicker.addEventListener("change", function() {
        if (!datePicker.value) return;

        selectedDate = datePicker.value;

        selectedFood = null;

        document.getElementById("search-results").textContent = "";

        renderFoodDiary();
        updateDashboard();
    });
}

function renderFoodDiary() {
    foodList.innerHTML = "";

    const entriesForDate = foodEntries.filter(function(entry) {
        return entry.date === selectedDate;
    });

    if (entriesForDate.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "empty-state";
        emptyMessage.textContent = "No food entries for this date yet.";
        foodList.appendChild(emptyMessage);
    }

    entriesForDate.forEach(function(entry) {
        const item = document.createElement("div");
        item.className = "food-entry";

        const description = document.createElement("p");

        description.textContent =
            entry.name + " — " +
            entry.grams + " g | " +
            Number(entry.calories).toFixed(1) + " kcal | " +
            "Protein: " + Number(entry.protein).toFixed(1) + " g | " +
            "Fat: " + Number(entry.fat).toFixed(1) + " g | " +
            "Carbs: " + Number(entry.carbs).toFixed(1) + " g";

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove-entry";
        removeButton.textContent = "Remove";

        removeButton.addEventListener("click", function() {
            foodEntries = foodEntries.filter(function(savedEntry) {
                return savedEntry.id !== entry.id;
            });

            saveData("nutriTrackEntries", foodEntries);

            renderFoodDiary();
            updateDashboard();
            updateNutritionCharts();
            updateWeeklyInsights();
        });

        item.appendChild(description);
        item.appendChild(removeButton);
        foodList.appendChild(item);
    });

    updateNutritionSummary();
}


// ------------------------------------------
// 7. SEARCH USDA FOOD DATABASE
// ------------------------------------------

async function searchFood(foodName) {
    const resultsContainer = document.getElementById("search-results");

    resultsContainer.textContent = "Searching for food...";

    selectedFood = null;

    try {
        const response = await fetch(
            `/api/search-food?query=${encodeURIComponent(foodName)}`
        );

        const data = await response.json();

        if (!response.ok) {
            resultsContainer.textContent =
                data.error || "Something went wrong.";
            return;
        }

        resultsContainer.innerHTML = "";

        if (!data.foods || data.foods.length === 0) {
            resultsContainer.textContent = "No foods found.";
            return;
        }

        data.foods.forEach(function(food) {
            const foodButton = document.createElement("button");
            foodButton.type = "button";
            foodButton.textContent = food.description;

            foodButton.addEventListener("click", function() {
                selectedFood = food;

                resultsContainer.innerHTML = "";

                const selectedMessage = document.createElement("p");
                selectedMessage.textContent =
                    "Selected: " + food.description;

                resultsContainer.appendChild(selectedMessage);
            });

            resultsContainer.appendChild(foodButton);
        });

    } catch (error) {
        console.error("Food search error:", error);

        resultsContainer.textContent =
            "Could not connect to the food database.";
    }
}

document.getElementById("search-food").addEventListener("click", function() {
    const foodName = document.getElementById("food-search").value.trim();

    if (!foodName) {
        alert("Please enter a food name.");
        return;
    }

    searchFood(foodName);
});


// ------------------------------------------
// 8. ADD FOOD TO DIARY
// ------------------------------------------

function getNutrientValue(nutrients, nutrientName) {
    const nutrient = nutrients.find(function(item) {
        return item.nutrientName === nutrientName;
    });

    return nutrient ? Number(nutrient.value) || 0 : 0;
}

document.getElementById("add-food").addEventListener("click", function() {
    if (!selectedFood) {
        alert("Please search for and select a food first.");
        return;
    }

    const grams = Number(document.getElementById("food-grams").value);

    if (!Number.isFinite(grams) || grams <= 0) {
        alert("Please enter a valid amount in grams.");
        return;
    }

    const nutrients = selectedFood.foodNutrients || [];

    const energy = nutrients.find(function(item) {
        return item.nutrientName === "Energy" &&
            String(item.unitName).toLowerCase() === "kcal";
    });

    if (!energy) {
        alert("Calorie information is unavailable for this food.");
        return;
    }

    const calories = Number(energy.value) * grams / 100;

    const protein =
        getNutrientValue(nutrients, "Protein") * grams / 100;

    const fat =
        getNutrientValue(nutrients, "Total lipid (fat)") * grams / 100;

    const carbs =
        getNutrientValue(nutrients, "Carbohydrate, by difference") *
        grams / 100;

    const foodEntry = {
        id: Date.now().toString() + Math.random().toString(16).slice(2),
        name: selectedFood.description,
        grams: grams,
        calories: calories,
        protein: protein,
        fat: fat,
        carbs: carbs,
        date: selectedDate
    };

    foodEntries.push(foodEntry);

    saveData("nutriTrackEntries", foodEntries);

    document.getElementById("food-grams").value = "";
    document.getElementById("food-search").value = "";
    document.getElementById("search-results").textContent =
        "Food added successfully!";

    selectedFood = null;

    renderFoodDiary();
    updateDashboard();
    updateNutritionCharts();
    updateWeeklyInsights();
});


// ------------------------------------------
// 9. WATER TRACKER
// ------------------------------------------

function getWaterForDate(date) {
    return waterEntries
        .filter(function(entry) {
            return entry.date === date;
        })
        .reduce(function(total, entry) {
            return total + entry.amount;
        }, 0);
}

function updateWaterTracker() {
    const total = getWaterForDate(getLocalDate());

    document.getElementById("water-total").textContent =
        total.toLocaleString("en-US") + " ml";

    const progress = Math.min((total / 2000) * 100, 100);

    document.getElementById("water-progress").style.width =
        progress + "%";

    document.getElementById("water-status").textContent =
        total === 0
            ? "No water entries recorded today yet."
            : total.toLocaleString("en-US") +
              " ml recorded today. This is a record, not a target.";

    document.getElementById("dashboard-water").textContent =
        total.toLocaleString("en-US") + " ml";
}

function addWater(amount) {
    if (!Number.isFinite(amount) || amount <= 0) {
        alert("Please enter a valid water amount.");
        return;
    }

    waterEntries.push({
        id: Date.now().toString() + Math.random().toString(16).slice(2),
        amount: amount,
        date: getLocalDate()
    });

    saveData("nutriTrackWater", waterEntries);

    updateWaterTracker();
    updateWeeklyInsights();
}

document.querySelectorAll("[data-water-amount]").forEach(function(button) {
    button.addEventListener("click", function() {
        addWater(Number(button.dataset.waterAmount));
    });
});

document.getElementById("add-water").addEventListener("click", function() {
    const amount = Number(document.getElementById("custom-water").value);

    if (!Number.isFinite(amount) || amount <= 0) {
        alert("Please enter a valid amount in millilitres.");
        return;
    }

    addWater(amount);

    document.getElementById("custom-water").value = "";
});

document.getElementById("reset-water").addEventListener("click", function() {
    const confirmed = confirm(
        "Clear all water entries recorded today?"
    );

    if (!confirmed) return;

    const today = getLocalDate();

    waterEntries = waterEntries.filter(function(entry) {
        return entry.date !== today;
    });

    saveData("nutriTrackWater", waterEntries);

    updateWaterTracker();
    updateWeeklyInsights();
});


// ------------------------------------------
// 10. WEIGHT TRACKER
// ------------------------------------------

const weightDate = document.getElementById("weight-date");

if (weightDate) {
    weightDate.value = getLocalDate();
}

function renderWeightList() {
    const list = document.getElementById("weight-list");

    list.innerHTML = "";

    const sortedEntries = [...weightEntries].sort(function(a, b) {
        return b.date.localeCompare(a.date);
    });

    if (sortedEntries.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "empty-state";
        emptyMessage.textContent = "No weight entries recorded yet.";
        list.appendChild(emptyMessage);
        return;
    }

    sortedEntries.forEach(function(entry) {
        const row = document.createElement("p");

        row.textContent =
            formatDate(entry.date) + " — " +
            Number(entry.weight).toFixed(1) + " kg";

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove-entry";
        removeButton.textContent = "Remove";

        removeButton.addEventListener("click", function() {
            weightEntries = weightEntries.filter(function(savedEntry) {
                return savedEntry.id !== entry.id;
            });

            saveData("nutriTrackWeight", weightEntries);

            renderWeightList();
            updateWeightChart();
            updateDashboard();
        });

        row.appendChild(removeButton);
        list.appendChild(row);
    });
}

document.getElementById("add-weight").addEventListener("click", function() {
    const date = document.getElementById("weight-date").value;
    const weight = Number(document.getElementById("weight-value").value);

    if (!date || !Number.isFinite(weight) || weight <= 0 || weight > 500) {
        alert("Please enter a valid date and weight.");
        return;
    }

    weightEntries = weightEntries.filter(function(entry) {
        return entry.date !== date;
    });

    weightEntries.push({
        id: Date.now().toString(),
        date: date,
        weight: weight
    });

    saveData("nutriTrackWeight", weightEntries);

    document.getElementById("weight-value").value = "";

    renderWeightList();
    updateWeightChart();
    updateDashboard();
});


// ------------------------------------------
// 11. CHART HELPERS
// ------------------------------------------

function createChart(canvasId, type, labels, datasets, options = {}) {
    const canvas = document.getElementById(canvasId);

    if (!canvas || typeof Chart === "undefined") {
        return null;
    }

    return new Chart(canvas, {
        type: type,
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: "#794858",
                        usePointStyle: true,
                        padding: 18
                    }
                }
            },
            scales: type === "pie" || type === "doughnut"
                ? {}
                : {
                    x: {
                        ticks: { color: "#A58B94" },
                        grid: { display: false }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: { color: "#A58B94" },
                        grid: { color: "#F5E8EC" }
                    }
                },
            ...options
        }
    });
}


// ------------------------------------------
// 12. NUTRITION ANALYTICS
// ------------------------------------------

function updateNutritionCharts() {
    const dates = getLastSevenDays();

    const calories = dates.map(function(date) {
        return getDailyNutrition(date).calories;
    });

    const labels = dates.map(function(date) {
        const parts = date.split("-");
        return parts[2] + "/" + parts[1];
    });

    const calorieCanvas = document.getElementById("nutrition-chart");
    const macroCanvas = document.getElementById("macro-chart");

    const hasFood = foodEntries.length > 0;

    document.getElementById("nutrition-chart-empty").style.display =
        hasFood ? "none" : "block";

    document.getElementById("macro-chart-empty").style.display =
        hasFood ? "none" : "block";

    if (calorieCanvas) {
        calorieCanvas.style.display = hasFood ? "block" : "none";
    }

    if (macroCanvas) {
        macroCanvas.style.display = hasFood ? "block" : "none";
    }

    if (!hasFood || typeof Chart === "undefined") return;

    if (nutritionChart) nutritionChart.destroy();

    nutritionChart = createChart(
        "nutrition-chart",
        "line",
        labels,
        [{
            label: "Calories recorded (kcal)",
            data: calories,
            borderColor: "#B86F83",
            backgroundColor: "rgba(233, 174, 190, 0.25)",
            fill: true,
            tension: 0.35
        }]
    );

    const totals = getDailyNutrition(selectedDate);

    if (macroChart) macroChart.destroy();

    macroChart = createChart(
        "macro-chart",
        "doughnut",
        ["Protein", "Fat", "Carbohydrates"],
        [{
            data: [
                totals.protein,
                totals.fat,
                totals.carbs
            ],
            backgroundColor: [
                "#B86F83",
                "#E9AEBE",
                "#F2C6D0"
            ],
            borderWidth: 2,
            borderColor: "#FFFFFF"
        }]
    );
}


// ------------------------------------------
// 13. WEIGHT CHART
// ------------------------------------------

function updateWeightChart() {
    const canvas = document.getElementById("weight-chart");
    const emptyMessage = document.getElementById("weight-chart-empty");

    const sortedEntries = [...weightEntries].sort(function(a, b) {
        return a.date.localeCompare(b.date);
    });

    const hasEntries = sortedEntries.length > 0;

    emptyMessage.style.display = hasEntries ? "none" : "block";
    canvas.style.display = hasEntries ? "block" : "none";

    if (!hasEntries || typeof Chart === "undefined") return;

    if (weightChart) weightChart.destroy();

    weightChart = createChart(
        "weight-chart",
        "line",
        sortedEntries.map(function(entry) {
            return entry.date;
        }),
        [{
            label: "Recorded weight (kg)",
            data: sortedEntries.map(function(entry) {
                return entry.weight;
            }),
            borderColor: "#B86F83",
            backgroundColor: "rgba(233, 174, 190, 0.25)",
            fill: true,
            tension: 0.3
        }],
        {
            scales: {
                x: {
                    ticks: { color: "#A58B94" },
                    grid: { display: false }
                },
                y: {
                    ticks: { color: "#A58B94" },
                    grid: { color: "#F5E8EC" }
                }
            }
        }
    );
}


// ------------------------------------------
// 14. WEEKLY INSIGHTS
// ------------------------------------------

function updateWeeklyInsights() {
    const dates = getLastSevenDays();

    const weeklyFood = foodEntries.filter(function(entry) {
        return dates.includes(entry.date);
    });

    const weeklyWater = waterEntries.filter(function(entry) {
        return dates.includes(entry.date);
    });

    const foodDays = new Set(
        weeklyFood.map(function(entry) {
            return entry.date;
        })
    );

    const waterDays = new Set(
        weeklyWater.map(function(entry) {
            return entry.date;
        })
    );

    document.getElementById("insight-food-days").textContent =
        foodDays.size;

    document.getElementById("insight-water-days").textContent =
        waterDays.size;

    document.getElementById("insight-food-count").textContent =
        weeklyFood.length;

    const insightText = document.getElementById("weekly-insight-text");

    insightText.textContent = weeklyFood.length === 0
        ? "No food entries have been recorded this week yet. Your summary will grow as you use your diary."
        : "You recorded " + weeklyFood.length +
          " food entries across " + foodDays.size +
          " different days this week.";

    const canvas = document.getElementById("weekly-chart");
    const emptyMessage = document.getElementById("weekly-chart-empty");

    const hasActivity = weeklyFood.length > 0 || weeklyWater.length > 0;

    canvas.style.display = hasActivity ? "block" : "none";
    emptyMessage.style.display = hasActivity ? "none" : "block";

    if (!hasActivity || typeof Chart === "undefined") return;

    if (weeklyChart) weeklyChart.destroy();

    const foodCounts = dates.map(function(date) {
        return weeklyFood.filter(function(entry) {
            return entry.date === date;
        }).length;
    });

    const waterAmounts = dates.map(function(date) {
        return weeklyWater
            .filter(function(entry) {
                return entry.date === date;
            })
            .reduce(function(total, entry) {
                return total + entry.amount;
            }, 0);
    });

    weeklyChart = createChart(
        "weekly-chart",
        "bar",
        dates.map(function(date) {
            return date.split("-")[2] + "/" + date.split("-")[1];
        }),
        [
            {
                label: "Food entries",
                data: foodCounts,
                backgroundColor: "#E9AEBE",
                borderRadius: 7
            },
            {
                label: "Water (ml)",
                data: waterAmounts,
                backgroundColor: "#B86F83",
                borderRadius: 7
            }
        ]
    );
}


// ------------------------------------------
// 15. DASHBOARD
// ------------------------------------------

function updateDashboard() {
    const today = getLocalDate();
    const totals = getDailyNutrition(today);

    const todayFood = foodEntries.filter(function(entry) {
        return entry.date === today;
    });

    document.getElementById("dashboard-food-count").textContent =
        todayFood.length;

    document.getElementById("dashboard-calories").textContent =
        totals.calories.toFixed(1) + " kcal";

    document.getElementById("dashboard-protein").textContent =
        totals.protein.toFixed(1) + " g";

    document.getElementById("dashboard-fat").textContent =
        totals.fat.toFixed(1) + " g";

    document.getElementById("dashboard-carbs").textContent =
        totals.carbs.toFixed(1) + " g";

    const latestWeight = [...weightEntries].sort(function(a, b) {
        return b.date.localeCompare(a.date);
    })[0];

    document.getElementById("dashboard-weight").textContent =
        latestWeight
            ? Number(latestWeight.weight).toFixed(1) + " kg"
            : "—";
}


// ------------------------------------------
// 16. INITIALIZE APPLICATION
// ------------------------------------------

renderFoodDiary();
updateWaterTracker();
renderWeightList();
updateDashboard();
updateNutritionCharts();
updateWeightChart();
updateWeeklyInsights();

console.log("NutriTrack is ready!");
