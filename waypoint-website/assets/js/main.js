/* ==========================================================================
   Waypoint Search — shared site behaviour
   ========================================================================== */

/* Forms: set this to your form endpoint (Formspree, HubSpot, your ATS…).
   While it is empty, forms validate and show the success message without
   sending anything — handy for previewing, not for launch. */
window.WAYPOINT_FORM_ENDPOINT = window.WAYPOINT_FORM_ENDPOINT || "";

(function () {
  "use strict";

  var doc = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var params = new URLSearchParams(window.location.search);

  var ICONS = {
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    brief: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
  };

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function postedLabel(posted) {
    var days = typeof posted === "number" ? posted : Math.round((Date.now() - new Date(posted).getTime()) / 864e5);
    if (!isFinite(days) || days <= 0) return "Posted today";
    if (days === 1) return "Posted yesterday";
    if (days < 7) return "Posted " + days + " days ago";
    var weeks = Math.round(days / 7);
    if (weeks < 5) return "Posted " + weeks + (weeks === 1 ? " week ago" : " weeks ago");
    return "Posted " + Math.round(days / 30) + "+ months ago";
  }

  /* Job card markup shared by the home page and the jobs board. */
  function renderJobCard(job, opts) {
    opts = opts || {};
    var disciplines = window.WAYPOINT_DISCIPLINES || {};
    var d = disciplines[job.discipline] || { label: job.discipline, color: "#f26a21" };
    var applyHref = "jobs.html?apply=" + encodeURIComponent(job.id) + "#apply";
    var tags = opts.showTags && job.tags
      ? '<div class="job-tags">' + job.tags.map(function (t) { return '<span class="chip">' + esc(t) + "</span>"; }).join("") + "</div>"
      : "";
    return (
      '<article class="job-card" style="--sys:' + esc(d.color) + '">' +
        '<div class="job-head"><span class="job-tag">' + esc(d.label) + '</span><span class="job-posted">' + postedLabel(job.posted) + "</span></div>" +
        '<h3><a href="' + applyHref + '" data-apply="' + esc(job.id) + '">' + esc(job.title) + "</a></h3>" +
        '<div class="job-meta">' +
          "<span>" + ICONS.pin + esc(job.location) + "</span>" +
          "<span>" + ICONS.brief + esc(job.type) + "</span>" +
          "<span>" + ICONS.home + esc(job.workplace) + "</span>" +
          '<span class="job-salary">' + esc(job.salary) + "</span>" +
        "</div>" +
        (opts.showSummary ? '<p class="job-summary">' + esc(job.summary) + "</p>" : "") +
        tags +
        '<div class="job-foot"><span class="job-client">' + esc(job.client) + " · " + esc(job.market) + "</span>" +
          '<a class="btn btn-sm btn-outline" href="' + applyHref + '" data-apply="' + esc(job.id) + '">Apply now ' + ICONS.arrow + "</a></div>" +
      "</article>"
    );
  }

  window.Waypoint = { renderJobCard: renderJobCard, esc: esc, params: params };

  /* ---------- Header shadow on scroll ---------- */
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- Mobile navigation ---------- */
  var toggle = document.querySelector(".nav-toggle");
  if (toggle && header) {
    toggle.addEventListener("click", function () {
      var open = !doc.classList.contains("nav-open");
      doc.style.setProperty("--nav-top", header.getBoundingClientRect().bottom + "px");
      doc.classList.toggle("nav-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && doc.classList.contains("nav-open")) {
        doc.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* ---------- Mega menu ---------- */
  var desktop = window.matchMedia("(min-width: 1025px) and (hover: hover)");
  document.querySelectorAll(".has-mega").forEach(function (item) {
    var trigger = item.querySelector(".nav-link");
    var closeTimer;
    function setOpen(open) {
      item.classList.toggle("is-open", open);
      trigger.setAttribute("aria-expanded", String(open));
    }
    trigger.addEventListener("click", function () {
      setOpen(!item.classList.contains("is-open"));
    });
    item.addEventListener("mouseenter", function () {
      if (!desktop.matches) return;
      clearTimeout(closeTimer);
      setOpen(true);
    });
    item.addEventListener("mouseleave", function () {
      if (!desktop.matches) return;
      closeTimer = setTimeout(function () { setOpen(false); }, 120);
    });
    item.addEventListener("focusout", function (e) {
      if (desktop.matches && !item.contains(e.relatedTarget)) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && item.classList.contains("is-open")) {
        setOpen(false);
        trigger.focus();
      }
    });
    document.addEventListener("click", function (e) {
      if (desktop.matches && !item.contains(e.target)) setOpen(false);
    });
  });

  /* ---------- Hero search tabs ---------- */
  document.querySelectorAll("[data-tabs]").forEach(function (group) {
    var tabs = group.querySelectorAll('[role="tab"]');
    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () { select(tab); });
      tab.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        var next = tabs[(index + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
        select(next);
        next.focus();
      });
    });
    function select(active) {
      tabs.forEach(function (tab) {
        var on = tab === active;
        tab.setAttribute("aria-selected", String(on));
        tab.tabIndex = on ? 0 : -1;
        document.getElementById(tab.getAttribute("aria-controls")).hidden = !on;
      });
    }
  });

  /* ---------- Count-up stats ---------- */
  function countUp(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var decimals = (el.getAttribute("data-count").split(".")[1] || "").length;
    var start = null;
    var duration = 1400;
    function frame(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ---------- Reveal on scroll ---------- */
  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        if (entry.target.hasAttribute("data-count")) countUp(entry.target);
        io.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    document.querySelectorAll(".reveal, [data-count]").forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------- Featured jobs (home page) ---------- */
  var featured = document.getElementById("featured-jobs");
  if (featured && window.WAYPOINT_JOBS) {
    featured.innerHTML = window.WAYPOINT_JOBS.slice(0, 6).map(function (job) {
      return renderJobCard(job, { showSummary: false });
    }).join("");
  }

  /* ---------- Prefill fields from the URL ---------- */
  document.querySelectorAll("[data-param]").forEach(function (field) {
    var value = params.get(field.getAttribute("data-param"));
    if (!value) return;
    if (field.tagName === "SELECT") {
      var match = Array.prototype.find.call(field.options, function (o) { return o.value === value; });
      if (match) field.value = value;
    } else if (field.type === "radio") {
      field.checked = field.value === value;
    } else {
      field.value = value;
    }
  });

  /* ---------- Forms ---------- */
  document.querySelectorAll("form[data-form]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      var button = form.querySelector('[type="submit"]');
      var endpoint = window.WAYPOINT_FORM_ENDPOINT;
      function done() {
        form.classList.add("is-sent");
        var success = form.querySelector(".form-success");
        if (success) {
          success.setAttribute("tabindex", "-1");
          success.focus();
        }
      }
      if (!endpoint) {
        done();
        return;
      }
      if (button) button.disabled = true;
      var data = new FormData(form);
      data.append("form", form.getAttribute("data-form"));
      fetch(endpoint, { method: "POST", body: data, headers: { Accept: "application/json" } })
        .then(function (res) {
          if (!res.ok) throw new Error("Request failed");
          done();
        })
        .catch(function () {
          if (button) button.disabled = false;
          alert("Sorry — something went wrong sending your message. Please email us directly.");
        });
    });
  });

  /* ---------- Sectors page: highlight the active anchor ---------- */
  var anchorLinks = document.querySelectorAll(".anchor-bar a");
  if (anchorLinks.length && "IntersectionObserver" in window) {
    var byId = {};
    anchorLinks.forEach(function (a) { byId[a.getAttribute("href").slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        anchorLinks.forEach(function (a) { a.classList.remove("is-active"); });
        var link = byId[entry.target.id];
        if (link) {
          link.classList.add("is-active");
          var bar = link.parentElement.parentElement;
          bar.scrollTo({ left: link.offsetLeft - bar.clientWidth / 2 + link.offsetWidth / 2, behavior: reduceMotion ? "auto" : "smooth" });
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    Object.keys(byId).forEach(function (id) {
      var section = document.getElementById(id);
      if (section) spy.observe(section);
    });
  }

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
