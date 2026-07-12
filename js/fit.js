/* fit.js · paste a job description, get an honest fit report,
   and watch the portfolio reorder itself for the role. */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var panel = document.querySelector("[data-jd-panel]");
    var form = document.querySelector("[data-jd-form]");
    var input = document.querySelector("[data-jd-input]");
    var card = document.querySelector("[data-fit-card]");
    var heroTail = document.querySelector("[data-fit-heroline]");
    if (!panel || !form || !input || !card) return;

    var busy = false;
    var originalOrder = null;

    function esc(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function bar(score) {
      return "<span class='fit-bar'>" + "█".repeat(score) + "<span class='fit-bar-off'>" + "█".repeat(5 - score) + "</span></span>";
    }

    function render(report) {
      var html = '<div class="fit-head"><span class="fit-overall">' + report.overall + '</span><span class="fit-overall-label">/ 100 · fit against published claims</span></div>';
      report.dimensions.forEach(function (d) {
        html += '<div class="fit-dim">' +
          '<div class="fit-dim-top"><span class="fit-dim-name">' + esc(d.name) + "</span>" + bar(d.score) + '<span class="fit-score">' + d.score + "/5</span></div>" +
          '<p class="fit-evidence">' + esc(d.evidence) + "</p>" +
          (d.honest_gaps ? '<p class="fit-gap">gap: ' + esc(d.honest_gaps) + "</p>" : "") +
          "</div>";
      });
      html += '<p class="fit-disclaimer">' + esc(report.disclaimer) + ' · <a href="/data/claims.json">claims file</a> · <button type="button" class="fit-reset" data-fit-reset>reset order</button></p>';
      card.innerHTML = html;
      card.hidden = false;
      var reset = card.querySelector("[data-fit-reset]");
      if (reset) reset.addEventListener("click", function () { reorder(null); });
    }

    function reorder(slugOrder) {
      var list = document.querySelector(".work-list");
      if (!list) return;
      var rows = {
        "mathtutor": document.getElementById("row-mathtutor"),
        "hgd-eval": document.getElementById("row-hgd"),
        "rhizome": document.getElementById("row-rhizome")
      };
      if (!originalOrder) originalOrder = Array.prototype.slice.call(list.children);
      var target = slugOrder
        ? slugOrder.map(function (s) { return rows[s]; }).filter(Boolean)
        : originalOrder;
      var hasFlip = typeof gsap !== "undefined" && typeof Flip !== "undefined";
      var state = hasFlip ? Flip.getState(list.children) : null;
      target.forEach(function (row) { list.appendChild(row); });
      if (hasFlip) Flip.from(state, { duration: 0.8, ease: "power3.inOut" });
    }

    function setStatus(msg, isError) {
      card.innerHTML = '<p class="' + (isError ? "fit-error" : "fit-loading") + '">' + esc(msg) + "</p>";
      card.hidden = false;
    }

    window.runFit = function (jd) {
      if (busy) return;
      if (!jd || jd.trim().length < 100) {
        setStatus("paste the whole job description (at least 100 characters), not just the title", true);
        return;
      }
      busy = true;
      setStatus("reading the role · scoring against published claims · this takes a few seconds");
      fetch("/api/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd: jd.trim(), source: "hero" })
      }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, data: data }; });
      }).then(function (res) {
        busy = false;
        if (!res.ok) { setStatus(res.data.error || "something went wrong", true); return; }
        render(res.data);
        reorder(res.data.reordered_case_studies);
        if (heroTail && res.data.tailored_hero_line) {
          heroTail.textContent = res.data.tailored_hero_line;
          heroTail.hidden = false;
        }
        try { gsap.registerPlugin(ScrollTrigger); ScrollTrigger.refresh(); } catch (e) {}
      }).catch(function () {
        busy = false;
        setStatus("could not reach the fit service. if this is a local preview, it only runs on the deployed site.", true);
      });
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      window.runFit(input.value);
    });

    var toggle = document.querySelector("[data-jd-toggle]");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var open = panel.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) setTimeout(function () { input.focus(); }, 250);
      });
    }
  });
})();
