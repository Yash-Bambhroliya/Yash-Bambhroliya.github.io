/* greet.js · context theater. One self-aware line built from the only three
   things a static page can know: where you came from, your clock, and your
   pointer. Composed locally, sent nowhere. */

(function () {
  "use strict";

  document.addEventListener("DOMContentLoaded", function () {
    var slot = document.querySelector("[data-greet]");
    if (!slot) return;

    var ref = document.referrer || "";
    var host = "";
    try { host = ref ? new URL(ref).hostname.replace(/^www\./, "") : ""; } catch (e) {}

    var source = null;
    if (/linkedin\.com|lnkd\.in/.test(host)) source = "LinkedIn";
    else if (/github\.com/.test(host)) source = "GitHub";
    else if (/news\.ycombinator\.com/.test(host)) source = "Hacker News";
    else if (/twitter\.com|^t\.co$|^x\.com$/.test(host)) source = "X";
    else if (/google\.|bing\.com|duckduckgo\.com/.test(host)) source = "a search engine";

    var h = new Date().getHours();
    var when = h < 5 ? "deep in the night" : h < 9 ? "early" : h < 18 ? null : h < 23 ? "in the evening" : "late";
    var touch = window.matchMedia("(pointer: coarse)").matches;

    var line;
    if (source === "LinkedIn" && (h >= 20 || h < 6)) {
      line = "You came from LinkedIn, " + (when || "today") + ". Screening candidates after hours? The evals are the fast read.";
    } else if (source === "LinkedIn") {
      line = "You came from LinkedIn. The case studies have the numbers the profile does not.";
    } else if (source === "GitHub") {
      line = "You came from GitHub. The trainer running on this page is hand-written, view source says hello.";
    } else if (source === "Hacker News") {
      line = "You came from Hacker News. Yes, the loss curve is real. Press backtick.";
    } else if (source === "X") {
      line = "You came from X. This will take longer than a timeline, but the numbers are real.";
    } else if (source === "a search engine") {
      line = "You searched, you found. The case studies are the substance.";
    } else if (when === "deep in the night" || when === "late") {
      line = "Reading portfolios " + when + ". Respect. The terminal is the fun part, press backtick.";
    } else if (touch) {
      line = "On a phone, a smaller model trains for you. The desktop version goes harder.";
    } else {
      return; /* nothing interesting to say beats saying something generic */
    }

    line += " (referrer, clock, pointer type. that is all this site knows about you.)";
    slot.textContent = line;
    slot.hidden = false;
  });
})();
