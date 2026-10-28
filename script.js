(() => {
  const $ = (id) => document.getElementById(id);
  const audio = $("audio");
  const el = {
    title: $("title"), artist: $("artist"), stage: $("stage"),
    seek: $("seek"), bars: $("bars"), cur: $("cur"), dur: $("dur"),
    play: $("play"), prev: $("prev"), next: $("next"),
    shuffle: $("shuffle"), navShuffle: $("navShuffle"),
    openList: $("openList"), navPlayer: $("navPlayer"), list: $("songList"),
    player: $("playerView"), listView: $("listView"),
  };

  // "Artist - Title.mp3" -> { artist, title }. No " - " means title only.
  const tracks = (typeof SONGS !== "undefined" ? SONGS : []).map((file) => {
    const base = file.replace(/\.[^.]+$/, "").replace(/_/g, " ").trim();
    const parts = base.split(" - ");
    return parts.length > 1
      ? { file, artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() }
      : { file, artist: "", title: base };
  });

  let index = 0, shuffleOn = false, history = [], dragging = false;

  // Remember song, position and shuffle across refreshes
  const KEY = "songPlayerState";
  let pendingTime = 0, lastSave = 0;
  function save() {
    try {
      const t = tracks[index];
      if (!t) return;
      localStorage.setItem(KEY, JSON.stringify({ file: t.file, time: audio.currentTime || pendingTime || 0, shuffle: shuffleOn }));
    } catch (e) {}
  }
  function readSaved() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; }
  }

  const fmt = (s) => {
    if (!isFinite(s)) return "0:00";
    return Math.floor(s / 60) + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  };

  // Waveform bars (shape is generated from the file name, so each song looks different)
  const BARS = 42;
  let barEls = [];
  function buildBars(seedStr) {
    let h = 0;
    for (const c of seedStr) h = (h * 31 + c.charCodeAt(0)) | 0;
    const rnd = () => { h = (h * 1664525 + 1013904223) | 0; return (h >>> 0) / 4294967296; };
    const phase = rnd() * 6;
    el.bars.innerHTML = "";
    barEls = [];
    for (let i = 0; i < BARS; i++) {
      const b = document.createElement("i");
      const v = 0.3 * rnd() + 0.7 * Math.abs(Math.sin(i * 0.38 + phase));
      b.style.height = 14 + v * 86 + "%";
      el.bars.appendChild(b);
      barEls.push(b);
    }
  }
  function paintSeek() {
    const max = parseFloat(el.seek.max) || 1;
    const n = Math.round((el.seek.value / max) * BARS);
    barEls.forEach((b, i) => b.classList.toggle("on", i < n));
  }

  function setPlayingUI(on) {
    el.play.classList.toggle("is-playing", on);
    el.play.setAttribute("aria-label", on ? "Pause" : "Play");
    el.stage.classList.toggle("playing", on);
    refreshPills();
  }

  function load(i, autoplay, startTime) {
    if (!tracks.length) return;
    index = (i + tracks.length) % tracks.length;
    pendingTime = startTime || 0;
    const t = tracks[index];
    audio.src = "music/" + encodeURIComponent(t.file);
    el.title.textContent = t.title;
    el.artist.textContent = t.artist;
    buildBars(t.file);
    el.seek.value = 0; el.seek.max = 100; paintSeek();
    el.cur.textContent = "0:00"; el.dur.textContent = "0:00";
    document.title = t.title + (t.artist ? " · " + t.artist : "");
    markCurrent();
    save();
    if ("mediaSession" in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: t.title, artist: t.artist });
    }
    if (autoplay) play();
  }

  function play() {
    if (!tracks.length) return;
    if (!audio.src) load(index, false);
    audio.play().catch(() => {});
  }
  function pause() { audio.pause(); }
  function toggle() { audio.paused ? play() : pause(); }

  function next() {
    if (!tracks.length) return;
    history.push(index);
    if (shuffleOn && tracks.length > 1) {
      let n;
      do { n = Math.floor(Math.random() * tracks.length); } while (n === index);
      load(n, true);
    } else load(index + 1, true);
  }
  function prev() {
    if (!tracks.length) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    if (shuffleOn && history.length) load(history.pop(), true);
    else load(index - 1, true);
  }

  // Audio events
  audio.addEventListener("play", () => setPlayingUI(true));
  audio.addEventListener("pause", () => { setPlayingUI(false); save(); });
  audio.addEventListener("ended", next);
  audio.addEventListener("loadedmetadata", () => {
    el.seek.max = audio.duration;
    el.dur.textContent = fmt(audio.duration);
    if (pendingTime > 0 && pendingTime < audio.duration) audio.currentTime = pendingTime;
    pendingTime = 0;
    el.seek.value = audio.currentTime; el.cur.textContent = fmt(audio.currentTime);
    paintSeek();
  });
  audio.addEventListener("timeupdate", () => {
    if (!dragging) { el.seek.value = audio.currentTime; paintSeek(); }
    el.cur.textContent = fmt(audio.currentTime);
    if (Date.now() - lastSave > 1000) { lastSave = Date.now(); save(); }
  });
  audio.addEventListener("error", () => {
    const t = tracks[index];
    el.artist.textContent = "Can't find music/" + (t ? t.file : "");
  });
  window.addEventListener("pagehide", save);
  document.addEventListener("visibilitychange", () => { if (document.hidden) save(); });

  // Seek: tap or drag anywhere on the waveform
  el.seek.addEventListener("pointerdown", () => { dragging = true; });
  window.addEventListener("pointerup", () => { dragging = false; });
  el.seek.addEventListener("input", () => {
    paintSeek();
    el.cur.textContent = fmt(parseFloat(el.seek.value));
    if (isFinite(audio.duration)) audio.currentTime = parseFloat(el.seek.value);
  });

  // Buttons
  el.play.addEventListener("click", toggle);
  el.next.addEventListener("click", next);
  el.prev.addEventListener("click", prev);
  function setShuffle(on) {
    shuffleOn = on; history = [];
    el.shuffle.setAttribute("aria-pressed", String(on));
    el.navShuffle.setAttribute("aria-pressed", String(on));
    save();
  }
  el.shuffle.addEventListener("click", () => setShuffle(!shuffleOn));
  el.navShuffle.addEventListener("click", () => setShuffle(!shuffleOn));

  // Pages: player <-> Explore (phone back button works too)
  el.openList.addEventListener("click", () => { location.hash = "songs"; });
  el.navPlayer.addEventListener("click", () => { location.hash = ""; showView(); });
  function showView() {
    const list = location.hash === "#songs";
    el.player.classList.toggle("active", !list);
    el.listView.classList.toggle("active", list);
    if (list) { centerCurrent(); arc(); }
  }
  window.addEventListener("hashchange", showView);

  // Explore list
  function buildList() {
    el.list.innerHTML = "";
    if (!tracks.length) {
      el.list.innerHTML = '<li class="empty">No songs yet. Add files to the music folder and list them in songs.js.</li>';
      return;
    }
    tracks.forEach((t, i) => {
      const li = document.createElement("li");
      li.innerHTML =
        '<div class="row" role="button" tabindex="0"><span class="thumb"></span>' +
        '<span class="name"><span class="t"></span><span class="a"></span></span>' +
        '<button class="pill" type="button">Play</button></div>';
      li.querySelector(".thumb").style.setProperty("--h", (i * 47 + 210) % 360);
      li.querySelector(".t").textContent = t.title;
      li.querySelector(".a").textContent = t.artist;
      const row = li.querySelector(".row");
      const choose = () => {
        if (i === index) return toggle();
        history.push(index);
        load(i, true);
        location.hash = ""; showView();
      };
      row.addEventListener("click", choose);
      row.addEventListener("keydown", (e) => { if (e.key === "Enter") choose(); });
      li.querySelector(".pill").addEventListener("click", (e) => { e.stopPropagation(); toggle(); });
      el.list.appendChild(li);
    });
    markCurrent();
  }
  function markCurrent() {
    [...el.list.children].forEach((li, i) => li.classList.toggle("current", i === index));
    refreshPills();
  }
  function refreshPills() {
    const pill = el.list.querySelector("li.current .pill");
    if (pill) pill.textContent = audio.paused ? "Play" : "Pause";
  }
  function centerCurrent() {
    const li = el.list.children[index];
    if (li) el.list.scrollTop = li.offsetTop - el.list.clientHeight / 2 + li.offsetHeight / 2;
  }
  // Items fan out and fade away from the middle of the list
  function arc() {
    const box = el.list.getBoundingClientRect();
    if (!box.height) return;
    const mid = box.top + box.height / 2;
    [...el.list.children].forEach((li) => {
      const r = li.getBoundingClientRect();
      const a = Math.min(Math.abs((r.top + r.height / 2 - mid) / (box.height / 2)), 1.2);
      li.style.transform = "translateX(" + a * a * 22 + "px) scale(" + (1 - a * 0.1) + ")";
      li.style.opacity = 1 - a * 0.5;
    });
  }
  el.list.addEventListener("scroll", () => requestAnimationFrame(arc));
  window.addEventListener("resize", arc);

  // Lock screen / headphone buttons
  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", play);
    navigator.mediaSession.setActionHandler("pause", pause);
    navigator.mediaSession.setActionHandler("previoustrack", prev);
    navigator.mediaSession.setActionHandler("nexttrack", next);
  }

  buildList();
  if (tracks.length) {
    const saved = readSaved();
    const at = saved ? tracks.findIndex((t) => t.file === saved.file) : -1;
    if (saved && saved.shuffle) setShuffle(true);
    if (at >= 0) load(at, false, saved.time);
    else load(0, false);
  }
  showView();
})();