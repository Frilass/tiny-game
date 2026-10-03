let score = 0;

const scoreDisplay = document.getElementById("score");
const trainButton = document.getElementById("trainButton");

trainButton.addEventListener("click", () => {
    score++;

    scoreDisplay.textContent = score;
});
