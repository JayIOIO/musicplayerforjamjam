(() => {
  const $ = (id) => document.getElementById(id);
  const audio = $("audio");
  const el = {
    title: $("title"), artist: $("artist"), disc: $("disc"),
    seek: $("seek"), cur: $("cur"), dur: $("dur"),
    play: $("play"), iconPlay: $("iconPlay"), iconPause: $("iconPause"),
    prev: $("prev"), next: $("next"), shuffle: $("shuffle"),
    openList: $("openList"), back: $("back"), list: $("songList"),
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

  let index = 0;
  let shuffleOn = false;
  let history = [];

  const fmt = (s) => {
    if (!isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    return m + ":" + String(Math.floor(s % 60)).padStart(2, "0");
  };

  function setPlayingUI(on) {
    el.iconPlay.hidden = on;
    el.iconPause.hidden = !on;
    el.play.setAttribute("aria-label", on ? "Pause" : "Play");
    el.disc.classList.toggle("playing", on);
  }

  function paintSeek() {
    const max = parseFloat(el.seek.max) || 1;
    el.seek.style.setProperty("--p", (el.seek.value / max) * 100 + "%");
  }

  function load(i, autoplay) {
    if (!tracks.length) return;
    index = (i + tracks.length) % tracks.length;
    const t = tracks[index];
    audio.src = "music/" + encodeURIComponent(t.file);
    el.title.textContent = t.title;
    el.artist.textContent = t.artist;
    el.seek.value = 0; el.seek.max = 100; paintSeek();
    el.cur.textContent = "0:00"; el.dur.textContent = "0:00";
    document.title = t.title + (t.artist ? " · " + t.artist : "");
    markCurrent();
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
    } else {
      load(index + 1, true);
    }
  }

  function prev() {
    if (!tracks.length) return;
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    if (shuffleOn && history.length) load(history.pop(), true);
    else load(index - 1, true);
  }

  // Events
  audio.addEventListener("play", () => setPlayingUI(true));
  audio.addEventListener("pause", () => setPlayingUI(false));
  audio.addEventListener("ended", next);
  audio.addEventListener("loadedmetadata", () => {
    el.seek.max = audio.duration;
    el.dur.textContent = fmt(audio.duration);
    paintSeek();
  });
  audio.addEventListener("timeupdate", () => {
    if (!dragging) { el.seek.value = audio.currentTime; paintSeek(); }
    el.cur.textContent = fmt(audio.currentTime);
  });
  audio.addEventListener("error", () => {
    const t = tracks[index];
    el.artist.textContent = "Can't find music/" + (t ? t.file : "");
  });

  // Seek: click or drag anywhere on the bar
  let dragging = false;
  el.seek.addEventListener("pointerdown", () => { dragging = true; });
  window.addEventListener("pointerup", () => { dragging = false; });
  el.seek.addEventListener("input", () => {
    paintSeek();
    el.cur.textContent = fmt(parseFloat(el.seek.value));
    if (isFinite(audio.duration)) audio.currentTime = parseFloat(el.seek.value);
  });

  el.play.addEventListener("click", toggle);
  el.next.addEventListener("click", next);
  el.prev.addEventListener("click", prev);
  el.shuffle.addEventListener("click", () => {
    shuffleOn = !shuffleOn;
    history = [];
    el.shuffle.setAttribute("aria-pressed", String(shuffleOn));
  });

  // Pages: player <-> song list (phone back button works too)
  el.openList.addEventListener("click", () => { location.hash = "songs"; });
  el.back.addEventListener("click", () => {
    if (location.hash === "#songs") history_back(); else showView();
  });
  function history_back() { window.history.back(); }
  function showView() {
    const list = location.hash === "#songs";
    el.player.classList.toggle("active", !list);
    el.listView.classList.toggle("active", list);
  }
  window.addEventListener("hashchange", showView);

  // Song list
  function buildList() {
    el.list.innerHTML = "";
    if (!tracks.length) {
      el.list.innerHTML = '<li class="empty">No songs yet. Add files to the music folder and list them in songs.js.</li>';
      return;
    }
    tracks.forEach((t, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.innerHTML = '<span class="dot"></span><span class="name"><span class="t"></span><span class="a"></span></span>';
      b.querySelector(".t").textContent = t.title;
      b.querySelector(".a").textContent = t.artist;
      b.addEventListener("click", () => {
        history.push(index);
        load(i, true);
        location.hash = "";
        showView();
      });
      li.appendChild(b);
      el.list.appendChild(li);
    });
    markCurrent();
  }
  function markCurrent() {
    [...el.list.children].forEach((li, i) => li.classList.toggle("current", i === index));
  }

  // Lock screen / headphone buttons
  if ("mediaSession" in navigator) {
    navigator.mediaSession.setActionHandler("play", play);
    navigator.mediaSession.setActionHandler("pause", pause);
    navigator.mediaSession.setActionHandler("previoustrack", prev);
    navigator.mediaSession.setActionHandler("nexttrack", next);
  }

  buildList();
  showView();
  if (tracks.length) load(0, false);
})();
