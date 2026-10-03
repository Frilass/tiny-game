let score = 0;

const scoreDisplay = document.getElementById("score");
const trainButton = document.getElementById("trainButton");

trainButton.addEventListener("click", () => {
    score++;

    scoreDisplay.textContent = score;
});

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js");
}