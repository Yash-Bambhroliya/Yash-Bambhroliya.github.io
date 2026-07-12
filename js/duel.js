/* duel.js · beat the model. Ten rounds of next-character prediction on the
   real corpus, human versus the network born in this tab. The model commits
   its guess in the worker before the choices render, so nothing can cheat. */

(function () {
  "use strict";

  var ROUNDS = 10;
  var FALLBACK_CHARS = ["e", "a", "t", "o", "n", "s", "r", "i", "l", " "];

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function glyph(ch) {
    if (ch === " ") return "␣";
    if (ch === "\n") return "¶";
    return ch;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var root = document.querySelector("[data-duel]");
    if (!root) return;

    var el = {
      score: root.querySelector("[data-duel-score]"),
      intro: root.querySelector("[data-duel-intro]"),
      round: root.querySelector("[data-duel-round]"),
      count: root.querySelector("[data-duel-count]"),
      live: root.querySelector("[data-duel-live]"),
      ctx: root.querySelector("[data-duel-ctx]"),
      choices: root.querySelector("[data-duel-choices]"),
      reveal: root.querySelector("[data-duel-reveal]"),
      verdict: root.querySelector("[data-duel-verdict]"),
      top: root.querySelector("[data-duel-top]"),
      next: root.querySelector("[data-duel-next]"),
      end: root.querySelector("[data-duel-end]"),
      final: root.querySelector("[data-duel-final]"),
      line: root.querySelector("[data-duel-line]"),
      share: root.querySelector("[data-duel-share]"),
      again: root.querySelector("[data-duel-again]"),
      start: root.querySelector("[data-duel-start]"),
      close: root.querySelector("[data-duel-close]")
    };

    var S = { open: false, n: 0, you: 0, model: 0, answered: false, current: null };

    function setScore() {
      el.score.textContent = "you " + S.you + " · it " + S.model;
    }

    function show(which) {
      el.intro.hidden = which !== "intro";
      el.start.hidden = which !== "intro";
      el.round.hidden = which !== "round";
      el.end.hidden = which !== "end";
    }

    function reset() {
      S.n = 0; S.you = 0; S.model = 0; S.answered = false; S.current = null;
      setScore();
      show("intro");
    }

    function open() {
      if (!window.TRAINER || !TRAINER.ready()) return;
      root.hidden = false;
      document.body.classList.add("duel-open");
      S.open = true;
      reset();
      var st = TRAINER.state();
      el.live.hidden = !!st.doneInfo;
      setTimeout(function () { el.start.focus(); }, 60);
    }

    function close() {
      root.hidden = true;
      document.body.classList.remove("duel-open");
      S.open = false;
    }

    function buildChoices(q) {
      var set = [q.truth];
      /* distractors: what the model itself considered likely, then commons */
      q.top.forEach(function (t) {
        if (set.length < 5 && set.indexOf(t[0]) === -1) set.push(t[0]);
      });
      for (var i = 0; set.length < 5 && i < FALLBACK_CHARS.length; i++) {
        if (set.indexOf(FALLBACK_CHARS[i]) === -1) set.push(FALLBACK_CHARS[i]);
      }
      /* shuffle */
      for (i = set.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = set[i]; set[i] = set[j]; set[j] = tmp;
      }
      return set;
    }

    function playRound() {
      S.answered = false;
      el.reveal.hidden = true;
      el.count.textContent = "round " + (S.n + 1) + "/" + ROUNDS;
      el.ctx.textContent = "…";
      el.choices.innerHTML = "";
      TRAINER.quiz().then(function (q) {
        if (!S.open) return;
        if (!q) { el.ctx.textContent = "the sampler timed out, one more try"; TRAINER.quiz().then(gotRound); return; }
        gotRound(q);
      });
    }

    function gotRound(q) {
      if (!S.open || !q) { if (S.open) endGame(); return; }
      S.current = q;
      el.ctx.textContent = q.context.replace(/\s+/g, " ");
      var choices = buildChoices(q);
      el.choices.innerHTML = "";
      choices.forEach(function (ch, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "duel-choice";
        b.innerHTML = "<kbd>" + (i + 1) + "</kbd> " + esc(glyph(ch));
        if (ch === " ") b.setAttribute("aria-label", "space");
        b.addEventListener("click", function () { answer(ch, b); });
        el.choices.appendChild(b);
      });
    }

    function answer(ch, btn) {
      if (S.answered || !S.current) return;
      S.answered = true;
      var q = S.current;
      var youRight = ch === q.truth;
      var modelRight = q.pick === q.truth;
      if (youRight) S.you++;
      if (modelRight) S.model++;
      setScore();

      Array.prototype.forEach.call(el.choices.children, function (b) {
        b.disabled = true;
        b.classList.remove("picked");
      });
      if (btn) btn.classList.add("picked");
      Array.prototype.forEach.call(el.choices.children, function (b) {
        if (b.textContent.slice(-1) === glyph(q.truth)) b.classList.add("truth");
      });

      var verdict = "the next character was \"" + glyph(q.truth) + "\". ";
      verdict += youRight ? "you got it. " : "you guessed \"" + glyph(ch) + "\". ";
      verdict += modelRight ? "so did the model." : "the model guessed \"" + glyph(q.pick) + "\" and missed.";
      el.verdict.innerHTML = esc(verdict);
      el.verdict.className = youRight && !modelRight ? "duel-win" : !youRight && modelRight ? "duel-loss" : "";

      var bars = q.top.map(function (t) {
        var bar = "█".repeat(Math.max(1, Math.round(t[1] * 14)));
        return esc(glyph(t[0])) + '  <span class="p-bar">' + bar + "</span> " + t[1].toFixed(2);
      }).join("\n");
      el.top.innerHTML = "what it believed:\n" + bars;

      el.reveal.hidden = false;
      el.next.textContent = S.n + 1 >= ROUNDS ? "see the result" : "next";
      el.next.focus();
    }

    function endLine() {
      var st = TRAINER.stats();
      var secs = Math.max(1, Math.round(st.trainedMs / 1000));
      if (S.you > S.model) {
        return "you beat a model that is " + secs + " seconds old. respect. it will be smarter by the time you email me.";
      }
      if (S.you < S.model) {
        return "it learned to write like me in " + secs + " seconds on your device. imagine what I ship in a quarter.";
      }
      return "a tie with a " + secs + " second old model. close one.";
    }

    function endGame() {
      show("end");
      el.final.textContent = "you " + S.you + " · it " + S.model;
      el.line.textContent = endLine();
    }

    function nextRound() {
      S.n++;
      if (S.n >= ROUNDS) { endGame(); return; }
      playRound();
    }

    el.start.addEventListener("click", function () { show("round"); playRound(); });
    el.next.addEventListener("click", nextRound);
    el.again.addEventListener("click", function () { reset(); show("round"); playRound(); });
    el.close.addEventListener("click", close);
    root.addEventListener("click", function (e) { if (e.target === root) close(); });

    el.share.addEventListener("click", function () {
      var text = "I went " + S.you + "-" + S.model + " against a tiny neural network born in my browser on yashb.me";
      var done = function () {
        el.share.textContent = "copied";
        setTimeout(function () { el.share.textContent = "copy your result"; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else { done(); }
    });

    document.addEventListener("keydown", function (e) {
      if (!S.open) return;
      if (e.key === "Escape") { close(); return; }
      if (!el.round.hidden && !S.answered && e.key >= "1" && e.key <= "5") {
        var b = el.choices.children[+e.key - 1];
        if (b) b.click();
      } else if (!el.reveal.hidden && e.key === "Enter") {
        /* enter advances via the focused next button anyway */
      }
    });

    window.DUEL = { open: open };
  });
})();
