let score = Number(localStorage.getItem("score")) || 0;

const scoreDisplay = document.getElementById("score");
const trainButton = document.getElementById("trainButton");
const restartButton = document.getElementById("restartButton");

// Display saved score when the game starts
scoreDisplay.textContent = score;

// Train button
trainButton.addEventListener("click", () => {
    score++;
    scoreDisplay.textContent = score;

    localStorage.setItem("score", score);
});

// Restart button
restartButton.addEventListener("click", () => {
    const confirmed = confirm("Are you sure you want to restart the game?");

    if (!confirmed) {
        return;
    }

    score = 0;
    scoreDisplay.textContent = score;

    localStorage.setItem("score", score);
});