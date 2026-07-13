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
      if (report.share && report.share.f) {
        html += '<p class="fit-share"><button type="button" class="fit-share-btn" data-fit-share>copy a link for your hiring manager</button><span class="fit-share-note">the whole report travels inside the link. nothing is stored anywhere.</span></p>';
      }
      card.innerHTML = html;
      card.hidden = false;
      var reset = card.querySelector("[data-fit-reset]");
      if (reset) reset.addEventListener("click", function () { reorder(null); });
      var shareBtn = card.querySelector("[data-fit-share]");
      if (shareBtn) {
        shareBtn.addEventListener("click", function () {
          var url = location.origin + "/#f=" + report.share.f;
          var done = function () {
            shareBtn.textContent = "copied";
            setTimeout(function () { shareBtn.textContent = "copy a link for your hiring manager"; }, 1800);
          };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(done, done);
          } else { done(); }
        });
      }
    }

    function reorder(slugOrder) {
      var list = document.querySelector(".work-list");
      if (!list) return;
      var rows = {
        "innerlens": document.getElementById("row-innerlens"),
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

    function applyReport(data) {
      render(data);
      reorder(data.reordered_case_studies);
      if (heroTail && data.tailored_hero_line) {
        heroTail.textContent = data.tailored_hero_line;
        heroTail.hidden = false;
      }
      try { gsap.registerPlugin(ScrollTrigger); ScrollTrigger.refresh(); } catch (e) {}
    }

    function post(payload) {
      if (busy) return;
      busy = true;
      setStatus("reading the role · scoring against published claims · this takes a few seconds");
      fetch("/api/fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (r) {
        return r.json().then(function (data) { return { ok: r.ok, data: data }; });
      }).then(function (res) {
        busy = false;
        if (!res.ok) { setStatus(res.data.error || "something went wrong", true); return; }
        applyReport(res.data);
      }).catch(function () {
        busy = false;
        setStatus("could not reach the fit service. if this is a local preview, it only runs on the deployed site.", true);
      });
    }

    window.runFit = function (jd) {
      if (!jd || jd.trim().length < 100) {
        setStatus("paste the whole job description (at least 100 characters), not just the title", true);
        return;
      }
      post({ jd: jd.trim(), source: "hero" });
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      window.runFit(input.value);
    });

    /* ---------- the three-question interview ---------- */

    var briefForm = document.querySelector("[data-brief-form]");
    var chips = document.querySelectorAll("[data-brief-chips] .chip");
    chips.forEach(function (c) {
      c.addEventListener("click", function () { c.classList.toggle("on"); });
    });
    if (briefForm) {
      briefForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var role = briefForm.querySelector("[data-brief-role]").value.trim();
        var focus = Array.prototype.filter.call(chips, function (c) { return c.classList.contains("on"); })
          .map(function (c) { return c.getAttribute("data-chip"); });
        var concern = briefForm.querySelector("[data-brief-concern]").value.trim();
        if (role.length < 2) { setStatus("name the role first", true); return; }
        if (!focus.length) { setStatus("pick at least one focus area", true); return; }
        post({ brief: { role: role, focus: focus, concern: concern } });
      });
    }

    var tabs = document.querySelectorAll("[data-fit-tab]");
    tabs.forEach(function (t) {
      t.addEventListener("click", function () {
        tabs.forEach(function (x) { x.classList.toggle("on", x === t); });
        var briefMode = t.getAttribute("data-fit-tab") === "brief";
        form.hidden = briefMode;
        if (briefForm) briefForm.hidden = !briefMode;
      });
    });

    var toggle = document.querySelector("[data-jd-toggle]");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var open = panel.classList.toggle("open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) setTimeout(function () { input.focus(); }, 250);
      });
    }

    /* ---------- shared link: the report lives in the URL fragment ---------- */

    function b64urlDecode(s) {
      s = s.replace(/-/g, "+").replace(/_/g, "/");
      while (s.length % 4) s += "=";
      var bin = atob(s);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder("utf-8").decode(bytes);
    }

    (function sharedBoot() {
      if (location.hash.indexOf("#f=") !== 0) return;
      var f = location.hash.slice(3);
      var at = f.lastIndexOf(".");
      if (at < 1 || f.length > 16384) return;
      var payload = null;
      try { payload = JSON.parse(b64urlDecode(f.slice(0, at))); } catch (e) { return; }
      if (!payload || !Array.isArray(payload.dimensions) || typeof payload.overall !== "number") return;

      var banner = document.querySelector("[data-shared-banner]");
      var bText = document.querySelector("[data-shared-text]");
      var bStatus = document.querySelector("[data-shared-status]");
      if (banner && bText) {
        bText.textContent = "tailored view for " + (payload.role_label || "this role") +
          (payload.generatedAt ? " · generated " + payload.generatedAt : "");
        if (bStatus) bStatus.textContent = "checking signature";
        banner.hidden = false;
      }

      panel.classList.add("open");
      var jdToggle = document.querySelector("[data-jd-toggle]");
      if (jdToggle) jdToggle.setAttribute("aria-expanded", "true");
      applyReport(payload);

      fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ f: f })
      }).then(function (r) { return r.json(); }).then(function (v) {
        if (!bStatus) return;
        bStatus.textContent = v && v.valid ? "signed by yashb.me" : "signature check failed, treat with suspicion";
        bStatus.className = "shared-status " + (v && v.valid ? "ok" : "bad");
      }).catch(function () {
        if (bStatus) bStatus.textContent = "signature not checked (offline preview)";
      });
    })();
  });
})();
