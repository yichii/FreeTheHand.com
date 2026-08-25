(function () {
  "use strict";

  // The site is hosted on Vercel; vercel.json rewrites /api/* to the
  // Cloudflare Worker, so this stays same-origin. If that rewrite is ever
  // removed, point this at the Worker's workers.dev URL directly instead
  // (CORS is left open there for exactly that case).
  var API_BASE = "/api";

  var MS_PER_DAY = 24 * 60 * 60 * 1000;
  var POLL_INTERVAL_MS = 60 * 1000;

  function daysBetween(a, b) {
    return Math.floor((b - a) / MS_PER_DAY);
  }

  function daysSince(isoDateString) {
    var start = new Date(isoDateString);
    start.setHours(0, 0, 0, 0);
    var now = new Date();
    now.setHours(0, 0, 0, 0);
    return daysBetween(start, now);
  }

  function formatDate(d) {
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  }

  function timeAgo(isoDateString) {
    var diffMs = Date.now() - new Date(isoDateString).getTime();
    var mins = Math.round(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + (mins === 1 ? " min ago" : " mins ago");
    var hours = Math.round(mins / 60);
    if (hours < 24) return hours + (hours === 1 ? " hr ago" : " hrs ago");
    var days = Math.round(hours / 24);
    return days + (days === 1 ? " day ago" : " days ago");
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

  function refreshTallyMarks(total) {
    var marks = document.getElementById("tallyMarks");
    var groupsOfFive = Math.floor(total / 5);
    var remainder = total % 5;
    var out = "";
    for (var g = 0; g < groupsOfFive; g++) out += "████/ ";
    for (var r = 0; r < remainder; r++) out += "█ ";
    marks.textContent = total > 0 ? out.trim() : "";
  }

  function renderLog(entries) {
    var section = document.getElementById("incidentLog");
    var list = document.getElementById("incidentLogList");
    list.innerHTML = "";
    if (!entries || entries.length === 0) {
      section.classList.add("hidden");
      return;
    }
    section.classList.remove("hidden");
    entries.forEach(function (entry) {
      var li = document.createElement("li");

      var topRow = document.createElement("div");
      topRow.className = "log-top-row";

      var excuseSpan = document.createElement("span");
      excuseSpan.className = "log-excuse";
      excuseSpan.textContent = entry.excuse;

      var timeSpan = document.createElement("span");
      timeSpan.className = "log-time";
      timeSpan.textContent = timeAgo(entry.timestamp);

      topRow.appendChild(excuseSpan);
      topRow.appendChild(timeSpan);
      li.appendChild(topRow);

      if (entry.signature) {
        var sigRow = document.createElement("div");
        sigRow.className = "log-sig-row";

        var sigLabel = document.createElement("span");
        sigLabel.className = "log-sig-label";
        sigLabel.textContent = "Signed:";

        var sigImg = document.createElement("img");
        sigImg.className = "log-signature-img";
        sigImg.src = entry.signature;
        sigImg.alt = "Signature";

        sigRow.appendChild(sigLabel);
        sigRow.appendChild(sigImg);
        li.appendChild(sigRow);
      }

      list.appendChild(li);
    });
  }

  function renderPledgeLedger(pledges) {
    var section = document.getElementById("pledgeLedger");
    var list = document.getElementById("pledgeLedgerList");
    list.innerHTML = "";
    if (!pledges || pledges.length === 0) {
      section.classList.add("hidden");
      return;
    }
    section.classList.remove("hidden");
    pledges.forEach(function (entry) {
      var li = document.createElement("li");

      var img = document.createElement("img");
      img.className = "pledge-ledger-img";
      img.src = entry.signature;
      img.alt = "Signature";

      var timeSpan = document.createElement("span");
      timeSpan.className = "pledge-ledger-time";
      timeSpan.textContent = timeAgo(entry.timestamp);

      li.appendChild(img);
      li.appendChild(timeSpan);
      list.appendChild(li);
    });
  }

  function applyState(state, animateDays) {
    document.getElementById("totalIncidents").textContent = state.totalGoonsReported;
    refreshTallyMarks(state.totalGoonsReported);
    renderDays(daysSince(state.streakStartDate), !!animateDays);
    renderLog(state.log);
    renderPledgeLedger(state.pledges);
  }

  function fetchState() {
    return fetch(API_BASE + "/state")
      .then(function (res) {
        if (!res.ok) throw new Error("bad response: " + res.status);
        return res.json();
      })
      .then(function (state) {
        applyState(state, false);
      })
      .catch(function (err) {
        console.error("Failed to load shared tally:", err);
      });
  }

  fetchState();
  setInterval(fetchState, POLL_INTERVAL_MS);

  /* ---------------- signature pad (shared by report + pledge) ---------------- */

  function createSignaturePad(canvas, clearBtn) {
    var ctx = canvas.getContext("2d");
    var drawing = false;
    var dirty = false;
    var lastX = 0, lastY = 0;

    function resize() {
      // Cap the backing-store ratio so a retina screen doesn't blow up the
      // exported PNG's size — quality is plenty at 2x for a signature.
      var ratio = Math.min(window.devicePixelRatio || 1, 2);
      var rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#1F1B16";
    }

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
      dirty = true;
      e.preventDefault();
    }

    function endDraw() {
      drawing = false;
    }

    function clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dirty = false;
    }

    window.addEventListener("resize", resize);
    resize();

    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", draw);
    window.addEventListener("mouseup", endDraw);

    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", endDraw);

    if (clearBtn) {
      clearBtn.addEventListener("click", clear);
    }

    return {
      isEmpty: function () { return !dirty; },
      toDataURL: function () { return canvas.toDataURL("image/png"); },
      clear: clear
    };
  }

  /* ---------------- report an incident ---------------- */

  var reportBtn = document.getElementById("reportBtn");
  var reportError = document.getElementById("reportError");
  var stub = document.getElementById("incidentStub");
  var stubDate = document.getElementById("stubDate");
  var stubExcuse = document.getElementById("stubExcuse");
  var stubSignedBy = document.getElementById("stubSignedBy");

  var reportSigPad = createSignaturePad(
    document.getElementById("reportSigCanvas"),
    document.getElementById("clearReportSig")
  );

  function showStub(dateText, excuseText, signatureDataUrl) {
    stubDate.textContent = dateText;
    stubExcuse.textContent = excuseText;
    stubSignedBy.src = signatureDataUrl || "";
    stub.classList.remove("hidden");
    stub.style.animation = "none";
    void stub.offsetWidth;
    stub.style.animation = "";
  }

  reportBtn.addEventListener("click", function () {
    if (reportSigPad.isEmpty()) {
      reportError.classList.remove("hidden");
      return;
    }
    reportError.classList.add("hidden");
    var signature = reportSigPad.toDataURL();

    reportBtn.disabled = true;
    fetch(API_BASE + "/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signature: signature })
    })
      .then(function (res) {
        if (!res.ok) throw new Error("bad response: " + res.status);
        return res.json();
      })
      .then(function (state) {
        applyState(state, true);
        var latest = state.log[0];
        showStub(
          formatDate(latest ? new Date(latest.timestamp) : new Date()),
          latest ? latest.excuse : "Unrecorded.",
          latest ? latest.signature : signature
        );
        reportSigPad.clear();
      })
      .catch(function (err) {
        console.error("Failed to file goon report:", err);
        showStub(formatDate(new Date()), "FILING FAILED — SYSTEM OFFLINE", signature);
      })
      .then(function () {
        reportBtn.disabled = false;
      });
  });

  /* ---------------- pledge date ---------------- */

  document.getElementById("pledgeDate").textContent = formatDate(new Date());

  /* ---------------- pledge signing ---------------- */

  var pledgeSubmitBtn = document.getElementById("pledgeSubmitBtn");
  var pledgeError = document.getElementById("pledgeError");

  var pledgeSigPad = createSignaturePad(
    document.getElementById("sigCanvas"),
    document.getElementById("clearSig")
  );

  var PLEDGE_SIGNATURE_REQUIRED_TEXT = pledgeError.textContent;
  var PLEDGE_FILING_FAILED_TEXT = "FILING FAILED — SYSTEM OFFLINE. Try again in a moment.";

  pledgeSubmitBtn.addEventListener("click", function () {
    if (pledgeSigPad.isEmpty()) {
      pledgeError.textContent = PLEDGE_SIGNATURE_REQUIRED_TEXT;
      pledgeError.classList.remove("hidden");
      return;
    }
    pledgeError.classList.add("hidden");
    var signature = pledgeSigPad.toDataURL();

    pledgeSubmitBtn.disabled = true;
    fetch(API_BASE + "/pledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signature: signature })
    })
      .then(function (res) {
        if (!res.ok) throw new Error("bad response: " + res.status);
        return res.json();
      })
      .then(function (state) {
        renderPledgeLedger(state.pledges);
        pledgeSigPad.clear();
      })
      .catch(function (err) {
        console.error("Failed to file pledge:", err);
        pledgeError.textContent = PLEDGE_FILING_FAILED_TEXT;
        pledgeError.classList.remove("hidden");
      })
      .then(function () {
        pledgeSubmitBtn.disabled = false;
      });
  });

})();
