const DEFAULT_SONGS = [
{
        title: "夜訪吸血鬼",
        artist: "Mayday",
        src: "../songs/angel.mp3",
        cover: "../img/logo.jpg"
    },
    {
        title: "你不是真正的快樂",
        artist: "Mayday",
        src: '../songs/not-truly-happy.mp3',
        cover: "../img/logo.jpg"
    },
    {
        title: "Self aware",
        artist: "Temper City",
        src: "../songs/self-aware.mp3",
        cover: "../img/logo.jpg"
    },
    {
        title: "End Of Begining",
        artist: "Djo",
        src: '../songs/end of begining.mp3',
        cover: "../img/logo.jpg"
    }
]

const songList = document.querySelector('.songList');
const favoriteList = document.querySelector('.favoriteList');
const songCount = document.querySelector('.songCount');
const favoriteCount = document.querySelector('.favoriteCount');
const searchInput = document.querySelector('.searchInput');

const detailCover = document.querySelector('.detailCover');
const detailName = document.querySelector('.songName');
const detailArtist = document.querySelector('.artistName');
const detailPath = document.querySelector('.songPath');
const detailDuration = document.querySelector('.detailDuration');
const detailStatus = document.querySelector('.detailStatus');
const detailPlayButton = document.querySelector('.detailPlayButton');
const detailLikeButton = document.querySelector('.detailLikeButton');

const nowCover = document.querySelector('.nowplayingCover');
const nowName = document.querySelector('.songInfoName');
const nowArtist = document.querySelector('.songInfoSinger');
const playerLikeButton = document.querySelector('.likeButton');

const playButton = document.querySelector('.playButton');
const previousButton = document.querySelector('.previousButton');
const nextButton = document.querySelector('.nextButton');
const shuffleButton = document.querySelector('.shuffleButton');
const repeatButton = document.querySelector('.repeatButton');
const volumeButton = document.querySelector('.volumeButton');

const progressBar = document.querySelector('.progressBar');
const progress = document.querySelector('.progress');
const currentTime = document.querySelector('.currentTime');
const totalTime = document.querySelector('.totalTime');

const volumeBar = document.querySelector('.volumeBar');
const volumeLevel = document.querySelector('.volumeLevel');

let songs = [];
let currentIndex = 0;
let currentSound = null;
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;
let volume = 0.7;
let lastVolume = volume;
let progressFrame = null;
let favorites = new Set(JSON.parse(localStorage.getItem('favoriteSongs') || '[]'));

function getSongId(song) {
    return song.src;
}

function normalizeSong(song, index) {
    const fileName = song.src ? song.src.split('/').pop() : `Song ${index + 1}`;

    return {
        title: song.title || makeTitleFromFileName(fileName),
        artist: song.artist || 'Local Songs',
        src: song.src,
        cover: song.cover || '../img/logo.jpg'
    };
}

function makeTitleFromFileName(fileName) {
    return decodeURIComponent(fileName)
        .replace(/\.[^/.]+$/, '')
        .replace(/^snd[_-]?/i, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${secs}`;
}

function saveFavorites() {
    localStorage.setItem('favoriteSongs', JSON.stringify([...favorites]));
}

async function loadSongs() {
    try {
        const response = await fetch('../songs/manifest.json', { cache: 'no-store' });
        if (!response.ok) throw new Error('Cannot read songs/manifest.json');

        const data = await response.json();
        songs = data.filter((song) => song.src).map(normalizeSong);
    } catch (error) {
        console.warn('Using fallback playlist because manifest could not be loaded:', error);
        songs = DEFAULT_SONGS.map(normalizeSong);
    }

    renderAll();

    if (songs.length > 0) {
        selectSong(0, false);
    } else {
        showEmptyPlaylist();
    }
}

function showEmptyPlaylist() {
    songList.innerHTML = '<div class="emptyState">Không tìm thấy bài hát trong folder songs/.</div>';
    favoriteList.innerHTML = '<li class="emptyState">Chưa có bài hát yêu thích.</li>';
    songCount.textContent = '0 songs';
    favoriteCount.textContent = '0';
}

function renderAll() {
    renderPlaylist();
    renderFavorites();
    updateFavoriteButtons();
}

function renderPlaylist() {
    const keyword = (searchInput?.value || '').trim().toLowerCase();
    const filteredSongs = songs
        .map((song, index) => ({ song, index }))
        .filter(({ song }) => {
            const text = `${song.title} ${song.artist}`.toLowerCase();
            return text.includes(keyword);
        });

    songCount.textContent = `${songs.length} songs`;

    if (filteredSongs.length === 0) {
        songList.innerHTML = '<div class="emptyState">Không có bài hát phù hợp.</div>';
        return;
    }

    songList.innerHTML = filteredSongs.map(({ song, index }) => `
        <button class="songItem ${index === currentIndex ? 'active' : ''}" data-index="${index}" type="button">
            <img class="songThumb" src="${song.cover}" alt="${song.title}">
            <span class="songText">
                <span class="songItemTitle">${song.title}</span>
                <span class="songItemArtist">${song.artist}</span>
            </span>
            <span class="songItemIndex">${index + 1}</span>
        </button>
    `).join('');
}

function renderFavorites() {
    const favoriteSongs = songs
        .map((song, index) => ({ song, index }))
        .filter(({ song }) => favorites.has(getSongId(song)));

    favoriteCount.textContent = favoriteSongs.length;

    if (favoriteSongs.length === 0) {
        favoriteList.innerHTML = '<li class="emptyState">Bấm ♡ để thêm bài hát yêu thích.</li>';
        return;
    }

    favoriteList.innerHTML = favoriteSongs.map(({ song, index }) => `
        <li>
            <button class="favoriteItem ${index === currentIndex ? 'active' : ''}" data-index="${index}" type="button">
                <span class="favoriteText">
                    <span class="favoriteTitle">${song.title}</span>
                    <span class="favoriteArtist">${song.artist}</span>
                </span>
                <span>♥</span>
            </button>
        </li>
    `).join('');
}

function selectSong(index, autoplay = true) {
    if (!songs[index]) return;

    stopProgressLoop();

    if (currentSound) {
        currentSound.stop();
        currentSound.unload();
    }

    currentIndex = index;
    const song = songs[currentIndex];

    currentSound = new Howl({
        src: [song.src],
        html5: true,
        volume,
        onload: updateDuration,
        onplay: () => {
            isPlaying = true;
            updatePlayState();
            startProgressLoop();
        },
        onpause: () => {
            isPlaying = false;
            updatePlayState();
            stopProgressLoop();
        },
        onstop: () => {
            isPlaying = false;
            updatePlayState();
            stopProgressLoop();
            updateProgress();
        },
        onend: handleSongEnd,
        onloaderror: (_, error) => {
            console.error('Load error:', error);
            detailStatus.textContent = 'Load error';
        },
        onplayerror: (_, error) => {
            console.error('Play error:', error);
            detailStatus.textContent = 'Play error';
        }
    });

    updateSongInfo();
    updateProgress();
    renderAll();

    if (autoplay) {
        playCurrentSong();
    }
}

function playCurrentSong() {
    if (!songs.length) return;
    if (!currentSound) selectSong(currentIndex, false);

    currentSound.play();
}

function pauseCurrentSong() {
    if (currentSound) currentSound.pause();
}

function togglePlay() {
    if (!songs.length) return;

    if (isPlaying) {
        pauseCurrentSong();
    } else {
        playCurrentSong();
    }
}

function playNextSong() {
    if (!songs.length) return;

    let nextIndex = currentIndex + 1;

    if (isShuffle && songs.length > 1) {
        do {
            nextIndex = Math.floor(Math.random() * songs.length);
        } while (nextIndex === currentIndex);
    }

    if (nextIndex >= songs.length) nextIndex = 0;
    selectSong(nextIndex, true);
}

function playPreviousSong() {
    if (!songs.length) return;

    const currentSeek = currentSound ? currentSound.seek() || 0 : 0;
    if (currentSeek > 3) {
        currentSound.seek(0);
        updateProgress();
        return;
    }

    const previousIndex = currentIndex === 0 ? songs.length - 1 : currentIndex - 1;
    selectSong(previousIndex, true);
}

function handleSongEnd() {
    isPlaying = false;
    updatePlayState();

    if (isRepeat) {
        currentSound.seek(0);
        currentSound.play();
        return;
    }

    playNextSong();
}

function updateSongInfo() {
    const song = songs[currentIndex];
    if (!song) return;

    nowCover.src = song.cover;
    nowName.textContent = song.title;
    nowArtist.textContent = song.artist;

    detailCover.src = song.cover;
    detailName.textContent = song.title;
    detailArtist.textContent = song.artist;
    detailPath.textContent = song.src.replace('../', '');
    detailStatus.textContent = 'Ready';
    detailDuration.textContent = '0:00';
    currentTime.textContent = '0:00';
    totalTime.textContent = '0:00';

    updateFavoriteButtons();
}

function updateDuration() {
    const duration = currentSound ? currentSound.duration() : 0;
    detailDuration.textContent = formatTime(duration);
    totalTime.textContent = formatTime(duration);
}

function updatePlayState() {
    playButton.classList.toggle('is-playing', isPlaying);
    playButton.setAttribute('aria-label', isPlaying ? 'Pause song' : 'Play song');
    detailPlayButton.textContent = isPlaying ? 'Pause' : 'Play';
    detailStatus.textContent = isPlaying ? 'Playing' : 'Paused';
}

function updateProgress() {
    if (!currentSound) {
        progress.style.width = '0%';
        currentTime.textContent = '0:00';
        return;
    }

    const seek = currentSound.seek() || 0;
    const duration = currentSound.duration() || 0;
    const percent = duration ? (seek / duration) * 100 : 0;

    progress.style.width = `${Math.min(percent, 100)}%`;
    currentTime.textContent = formatTime(seek);
    totalTime.textContent = formatTime(duration);
}

function startProgressLoop() {
    stopProgressLoop();

    const tick = () => {
        updateProgress();
        progressFrame = requestAnimationFrame(tick);
    };

    progressFrame = requestAnimationFrame(tick);
}

function stopProgressLoop() {
    if (progressFrame) {
        cancelAnimationFrame(progressFrame);
        progressFrame = null;
    }
}

function seekFromMouseEvent(event) {
    if (!currentSound) return;

    const duration = currentSound.duration();
    if (!duration) return;

    const rect = progressBar.getBoundingClientRect();
    const percent = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);

    currentSound.seek(duration * percent);
    updateProgress();
}

function setVolume(nextVolume) {
    volume = Math.min(Math.max(nextVolume, 0), 1);
    if (volume > 0) lastVolume = volume;

    if (currentSound) currentSound.volume(volume);
    volumeLevel.style.width = `${volume * 100}%`;
    volumeButton.classList.toggle('active', volume > 0);
}

function setVolumeFromMouseEvent(event) {
    const rect = volumeBar.getBoundingClientRect();
    const percent = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    setVolume(percent);
}

function toggleMute() {
    if (volume > 0) {
        setVolume(0);
    } else {
        setVolume(lastVolume || 0.7);
    }
}

function toggleFavorite() {
    const song = songs[currentIndex];
    if (!song) return;

    const id = getSongId(song);
    if (favorites.has(id)) {
        favorites.delete(id);
    } else {
        favorites.add(id);
    }

    saveFavorites();
    renderFavorites();
    updateFavoriteButtons();
}

function updateFavoriteButtons() {
    const song = songs[currentIndex];
    const isFavorite = song ? favorites.has(getSongId(song)) : false;

    playerLikeButton.classList.toggle('active', isFavorite);
    playerLikeButton.textContent = isFavorite ? '♥' : '♡';

    detailLikeButton.classList.toggle('active', isFavorite);
    detailLikeButton.textContent = isFavorite ? '♥ Favourite' : '♡ Add favourite';
}

function bindEvents() {
    songList.addEventListener('click', (event) => {
        const item = event.target.closest('.songItem');
        if (!item) return;

        selectSong(Number(item.dataset.index), true);
    });

    favoriteList.addEventListener('click', (event) => {
        const item = event.target.closest('.favoriteItem');
        if (!item) return;

        selectSong(Number(item.dataset.index), true);
    });

    searchInput.addEventListener('input', renderPlaylist);

    playButton.addEventListener('click', togglePlay);
    detailPlayButton.addEventListener('click', togglePlay);
    previousButton.addEventListener('click', playPreviousSong);
    nextButton.addEventListener('click', playNextSong);
    playerLikeButton.addEventListener('click', toggleFavorite);
    detailLikeButton.addEventListener('click', toggleFavorite);
    progressBar.addEventListener('click', seekFromMouseEvent);
    volumeBar.addEventListener('click', setVolumeFromMouseEvent);
    volumeButton.addEventListener('click', toggleMute);

    shuffleButton.addEventListener('click', () => {
        isShuffle = !isShuffle;
        shuffleButton.classList.toggle('active', isShuffle);
    });

    repeatButton.addEventListener('click', () => {
        isRepeat = !isRepeat;
        repeatButton.classList.toggle('active', isRepeat);
    });

    document.addEventListener('keydown', (event) => {
        if (event.target.matches('input, textarea')) return;

        if (event.code === 'Space') {
            event.preventDefault();
            togglePlay();
        }

        if (event.code === 'ArrowRight') playNextSong();
        if (event.code === 'ArrowLeft') playPreviousSong();
    });
}

bindEvents();
setVolume(volume);
loadSongs();
