window.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("past-wall-gallery");
  const saved = JSON.parse(localStorage.getItem("scribsyPastWalls") || "[]");

  if (saved.length === 0) {
    container.innerHTML = "<p style='opacity: 0.6;'>No past walls yet. Come back after a reset!</p>";
    return;
  }

saved.forEach((entry) => {
  const wrapper = document.createElement("div");
  wrapper.classList.add("gallery-item");

  const date = document.createElement("p");
  date.textContent = `🗓️ ${entry.date}`;

  const img = document.createElement("img");
  img.src = entry.image;
  img.alt = "Past wall";
  
  wrapper.appendChild(date);
  wrapper.appendChild(img);
  container.appendChild(wrapper);
});

});

const img = document.createElement("img");
img.src = entry.image;
img.alt = `Scribsy snapshot from ${entry.date}`;  

