/* ==========================================================================
   Jobs board — client-side search and filters over WAYPOINT_JOBS.
   ========================================================================== */
(function () {
  "use strict";

  var jobs = window.WAYPOINT_JOBS || [];
  var disciplines = window.WAYPOINT_DISCIPLINES || {};
  var W = window.Waypoint;
  var params = W.params;

  var list = document.getElementById("job-list");
  var count = document.getElementById("results-count");
  var keyword = document.getElementById("q");
  var locInput = document.getElementById("loc");
  var sort = document.getElementById("sort");
  var searchForm = document.getElementById("jobs-search");
  var disciplineBox = document.getElementById("filter-discipline");
  var typeBox = document.getElementById("filter-type");
  var workplaceBox = document.getElementById("filter-workplace");
  var clear = document.getElementById("clear-filters");
  var position = document.getElementById("position");
  if (!list) return;

  function tally(key) {
    return jobs.reduce(function (acc, job) {
      acc[job[key]] = (acc[job[key]] || 0) + 1;
      return acc;
    }, {});
  }

  function checkbox(name, value, label, n) {
    return (
      '<label class="check"><input type="checkbox" name="' + name + '" value="' + W.esc(value) + '"> ' +
      W.esc(label) + '<span class="count">' + n + "</span></label>"
    );
  }

  var dCount = tally("discipline");
  disciplineBox.innerHTML = Object.keys(disciplines).map(function (key) {
    return checkbox("discipline", key, disciplines[key].label, dCount[key] || 0);
  }).join("");

  var tCount = tally("type");
  typeBox.innerHTML = ["Direct Hire", "Contract", "Contract-to-Hire", "Executive Search"].map(function (t) {
    return checkbox("type", t, t, tCount[t] || 0);
  }).join("");

  var wCount = tally("workplace");
  workplaceBox.innerHTML = ["On-site", "Hybrid", "Remote"].map(function (t) {
    return checkbox("workplace", t, t, wCount[t] || 0);
  }).join("");

  /* Position dropdown on the application form */
  if (position) {
    position.innerHTML = '<option value="General application">General application — any suitable role</option>' +
      jobs.map(function (job) {
        return '<option value="' + W.esc(job.id) + '">' + W.esc(job.title + " — " + job.location + " (" + job.id + ")") + "</option>";
      }).join("");
  }

  /* Initial state from the URL */
  keyword.value = params.get("q") || "";
  locInput.value = params.get("location") || "";
  ["discipline", "type", "workplace"].forEach(function (name) {
    var values = (params.get(name) || "").split(",").filter(Boolean);
    document.querySelectorAll('input[name="' + name + '"]').forEach(function (input) {
      input.checked = values.indexOf(input.value) !== -1;
    });
  });
  if (position && params.get("apply")) position.value = params.get("apply");

  function checked(name) {
    return Array.prototype.map.call(document.querySelectorAll('input[name="' + name + '"]:checked'), function (i) { return i.value; });
  }

  function matches(job, state) {
    var label = (disciplines[job.discipline] || {}).label || "";
    var haystack = [job.title, job.summary, job.market, job.client, label, (job.tags || []).join(" ")].join(" ").toLowerCase();
    if (state.q && state.q.split(/\s+/).some(function (word) { return haystack.indexOf(word) === -1; })) return false;
    if (state.location && job.location.toLowerCase().indexOf(state.location) === -1 &&
        !(state.location === "remote" && job.workplace === "Remote")) return false;
    if (state.discipline.length && state.discipline.indexOf(job.discipline) === -1) return false;
    if (state.type.length && state.type.indexOf(job.type) === -1) return false;
    if (state.workplace.length && state.workplace.indexOf(job.workplace) === -1) return false;
    return true;
  }

  function daysAgo(job) {
    return typeof job.posted === "number" ? job.posted : (Date.now() - new Date(job.posted).getTime()) / 864e5;
  }

  function render() {
    var state = {
      q: keyword.value.trim().toLowerCase(),
      location: locInput.value.trim().toLowerCase(),
      discipline: checked("discipline"),
      type: checked("type"),
      workplace: checked("workplace")
    };
    var results = jobs.filter(function (job) { return matches(job, state); });
    results.sort(sort.value === "salary"
      ? function (a, b) { return (b.salaryMin || 0) - (a.salaryMin || 0); }
      : function (a, b) { return daysAgo(a) - daysAgo(b); });

    count.textContent = results.length === 1 ? "1 role" : results.length + " roles";
    list.innerHTML = results.length
      ? results.map(function (job) { return W.renderJobCard(job, { showSummary: true, showTags: true }); }).join("")
      : '<div class="no-results"><h3>No roles match those filters — yet.</h3><p>Many of our searches are confidential and never posted. Send us your resume and we\'ll match you to roles as they open.</p><p style="margin-top:20px"><a class="btn btn-primary" href="#apply">Submit your resume</a></p></div>';

    var next = new URLSearchParams();
    if (state.q) next.set("q", keyword.value.trim());
    if (state.location) next.set("location", locInput.value.trim());
    ["discipline", "type", "workplace"].forEach(function (name) {
      if (state[name].length) next.set(name, state[name].join(","));
    });
    var qs = next.toString();
    history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : "") + window.location.hash);
  }

  searchForm.addEventListener("submit", function (e) {
    e.preventDefault();
    render();
    list.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.querySelectorAll(".filters input").forEach(function (input) {
    input.addEventListener("change", render);
  });
  sort.addEventListener("change", render);
  clear.addEventListener("click", function () {
    document.querySelectorAll(".filters input").forEach(function (input) { input.checked = false; });
    keyword.value = "";
    locInput.value = "";
    render();
  });

  /* Apply buttons stay on this page: preselect the role and jump to the form. */
  list.addEventListener("click", function (e) {
    var link = e.target.closest("[data-apply]");
    if (!link || !position) return;
    e.preventDefault();
    position.value = link.getAttribute("data-apply");
    document.getElementById("apply").scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(function () { document.getElementById("first-name").focus({ preventScroll: true }); }, 500);
  });

  /* Filters start collapsed on small screens and always open on desktop. */
  var filters = document.querySelector(".filters");
  var narrow = window.matchMedia("(max-width: 1024px)");
  function syncFilters() { if (filters) filters.open = !narrow.matches; }
  syncFilters();
  if (narrow.addEventListener) narrow.addEventListener("change", syncFilters);

  render();
})();
