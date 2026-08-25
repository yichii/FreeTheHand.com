(function () {
  "use strict";

  var STORAGE_KEY_START = "fth_lastIncidentDate";
  var STORAGE_KEY_TOTAL = "fth_totalIncidents";

  var MS_PER_DAY = 24 * 60 * 60 * 1000;

  var EXCUSES = [
    "Distracted by a podcast.",
    "Thought about it too hard.",
    "Saw a doorknob.",
    "Tuesday.",
    "The WiFi went out.",
    "Read a spicy group chat.",
    "Bored during a Zoom call.",
    "Blamed the full moon.",
    "Ergonomic curiosity got the better of me.",
    "Momentary lapse in supervision.",
    "The cat left the room.",
    "Forgot the pledge existed.",
    "A gentle breeze.",
    "It was right there.",
    "Peer pressure from absolutely no one."
  ];

  function todayAtMidnight() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function daysBetween(a, b) {
    return Math.floor((b - a) / MS_PER_DAY);
  }

  function getLastIncidentDate() {
    var stored = localStorage.getItem(STORAGE_KEY_START);
    if (!stored) {
      var now = todayAtMidnight();
      localStorage.setItem(STORAGE_KEY_START, now.getTime().toString());
      return now;
    }
    return new Date(parseInt(stored, 10));
  }

  function getTotalIncidents() {
    var stored = localStorage.getItem(STORAGE_KEY_TOTAL);
    return stored ? parseInt(stored, 10) : 0;
  }

  function setTotalIncidents(n) {
    localStorage.setItem(STORAGE_KEY_TOTAL, n.toString());
  }

  /* ---------------- flip counter display ---------------- */

  var digitEls = [
    document.getElementById("digit0"),
    document.getElementById("digit1"),
    document.getElementById("digit2")
  ];

  function renderDays(n, animate) {
    var str = String(Math.max(0, n));
    if (str.length > 3) {
      // widen board rather than truncate for very large streaks
      while (digitEls.length < str.length) {
        var extra = document.createElement("span");
        extra.className = "flip-digit";
        document.getElementById("flipDigits").insertBefore(extra, digitEls[0]);
        digitEls.unshift(extra);
      }
    }
    var padded = str.padStart(digitEls.length, "0");
    for (var i = 0; i < digitEls.length; i++) {
      var char = padded[i];
      if (digitEls[i].textContent !== char) {
        digitEls[i].textContent = char;
        if (animate) {
          digitEls[i].classList.remove("flipping");
          void digitEls[i].offsetWidth; // reflow to restart animation
          digitEls[i].classList.add("flipping");
        }
      }
    }
  }

  function currentDaysSinceIncident() {
    var last = getLastIncidentDate();
    return daysBetween(last, todayAtMidnight());
  }

  function refreshTallyMarks() {
    var total = getTotalIncidents();
    var marks = document.getElementById("tallyMarks");
    var groupsOfFive = Math.floor(total / 5);
    var remainder = total % 5;
    var out = "";
    for (var g = 0; g < groupsOfFive; g++) out += "████/ ";
    for (var r = 0; r < remainder; r++) out += "█ ";
    marks.textContent = total > 0 ? out.trim() : "";
  }

  document.getElementById("totalIncidents").textContent = getTotalIncidents();
  refreshTallyMarks();
  renderDays(currentDaysSinceIncident(), false);

  /* ---------------- report an incident ---------------- */

  var reportBtn = document.getElementById("reportBtn");
  var stub = document.getElementById("incidentStub");
  var stubDate = document.getElementById("stubDate");
  var stubExcuse = document.getElementById("stubExcuse");

  function formatDate(d) {
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  reportBtn.addEventListener("click", function () {
    var now = todayAtMidnight();
    localStorage.setItem(STORAGE_KEY_START, now.getTime().toString());

    var total = getTotalIncidents() + 1;
    setTotalIncidents(total);
    document.getElementById("totalIncidents").textContent = total;
    refreshTallyMarks();

    renderDays(0, true);

    var excuse = EXCUSES[Math.floor(Math.random() * EXCUSES.length)];
    stubDate.textContent = formatDate(new Date());
    stubExcuse.textContent = excuse;
    stub.classList.remove("hidden");
    stub.style.animation = "none";
    void stub.offsetWidth;
    stub.style.animation = "";
  });

  /* ---------------- keep counter fresh if left open overnight ---------------- */

  setInterval(function () {
    renderDays(currentDaysSinceIncident(), false);
  }, 60 * 1000);

  /* ---------------- pledge date ---------------- */

  document.getElementById("pledgeDate").textContent = formatDate(new Date());

  /* ---------------- signature canvas ---------------- */

  var canvas = document.getElementById("sigCanvas");
  var ctx = canvas.getContext("2d");
  var drawing = false;
  var lastX = 0, lastY = 0;

  function resizeCanvas() {
    var ratio = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    var imgData = null;
    if (canvas.width > 0 && canvas.height > 0) {
      try { imgData = ctx.getImageData(0, 0, canvas.width, canvas.height); } catch (e) {}
    }
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1F1B16";
  }

  window.addEventListener("resize", function () {
    resizeCanvas();
  });
  resizeCanvas();

  function getPos(e) {
    var rect = canvas.getBoundingClientRect();
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function startDraw(e) {
    drawing = true;
    var pos = getPos(e);
    lastX = pos.x;
    lastY = pos.y;
    e.preventDefault();
  }

  function draw(e) {
    if (!drawing) return;
    var pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastX = pos.x;
    lastY = pos.y;
    e.preventDefault();
  }

  function endDraw() {
    drawing = false;
  }

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", draw);
  window.addEventListener("mouseup", endDraw);

  canvas.addEventListener("touchstart", startDraw, { passive: false });
  canvas.addEventListener("touchmove", draw, { passive: false });
  canvas.addEventListener("touchend", endDraw);

  document.getElementById("clearSig").addEventListener("click", function () {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

})();
