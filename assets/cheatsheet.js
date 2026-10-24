/**
 * Reusable CheatSheet UI Engine for GreekNotes
 * Renders header, 5 balanced columns (desktop 100vh auto-fit) or 1 scrollable sausage (mobile),
 * search, test mode (blur), Greek TTS, article color-coding, and A4 landscape print.
 *
 * Usage:
 *   window.LESSON_DATA = {
 *     num: 11,                    // Lesson number or badge text (e.g. 11 or "ΕΛ")
 *     title: "Квартиры и город",  // Main title in header
 *     elTitle: "Ψάχνω για σπίτι", // Greek subtitle
 *     backUrl: "../index.html",   // Optional back link (omit on main navigator)
 *     backLabel: "← Уроки",       // Optional back button label
 *     extraBadgeHtml: "",         // Optional extra pill in header
 *     sections: [
 *       {
 *         title: "1. Типы жилья",
 *         subtitle: "Τύποι κατοικιών",
 *         badge: "bg-blue-50 text-blue-700 border-blue-200", // optional (auto-assigned if omitted)
 *         colIndex: 0, // optional (0..4); if omitted, auto-balanced across 5 columns!
 *         url: "lessons/lesson_11.html", // optional link for navigator cards
 *         ready: true,                   // optional highlight for navigator cards
 *         actionLabel: "Открыть →",      // optional action button label
 *         words: [
 *           { el: "το σπίτι", ru: "дом" }
 *         ]
 *       }
 *     ]
 *   };
 */

(function () {
  const DEFAULT_BADGES = [
    "bg-blue-50 text-blue-700 border-blue-200",
    "bg-indigo-50 text-indigo-700 border-indigo-200",
    "bg-cyan-50 text-cyan-700 border-cyan-200",
    "bg-teal-50 text-teal-700 border-teal-200",
    "bg-emerald-50 text-emerald-700 border-emerald-200",
    "bg-amber-50 text-amber-700 border-amber-200",
    "bg-rose-50 text-rose-700 border-rose-200",
    "bg-purple-50 text-purple-700 border-purple-200",
    "bg-violet-50 text-violet-700 border-violet-200",
    "bg-sky-50 text-sky-700 border-sky-200"
  ];

  let speechRate = 0.9;
  let manualScaleMultiplier = 1.0;
  let isAutoFitActive = true;
  let searchQuery = '';
  const speedCycle = [0.7, 0.9, 1.0];

  function pluralizeWords(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return `${n} слово`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return `${n} слова`;
    return `${n} слов`;
  }

  function formatGreek(text) {
    return text.replace(/^(το|τα|η|οι|ο)\s+/i, (match, art) => {
      const lower = art.toLowerCase();
      let cls = 'art-neu';
      if (lower === 'η' || lower === 'οι') cls = 'art-fem';
      else if (lower === 'ο') cls = 'art-masc';
      return `<span class="${cls}">${art}</span> `;
    });
  }

  function speak(text, e) {
    if (e) e.stopPropagation();
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/\(.*?\)/g, '').replace(/\/.*/, '').trim();
    const utter = new SpeechSynthesisUtterance(clean);
    utter.lang = 'el-GR';
    utter.rate = speechRate;
    window.speechSynthesis.speak(utter);
  }

  // Distribute sections across 5 columns automatically if colIndex is not explicitly specified
  function assignColumns(sections) {
    const colHeights = [0, 0, 0, 0, 0];
    return sections.map((sec, idx) => {
      const weight = (sec.words ? sec.words.length : 0) + 2.2; // header weight ~2.2 rows
      let col = typeof sec.colIndex === 'number' ? sec.colIndex : -1;
      if (col < 0 || col > 4) {
        // Greedy balance: pick the column with minimum current height
        let minCol = 0;
        for (let c = 1; c < 5; c++) {
          if (colHeights[c] < colHeights[minCol]) minCol = c;
        }
        col = minCol;
      }
      colHeights[col] += weight;
      return {
        ...sec,
        _resolvedCol: col,
        _badge: sec.badge || DEFAULT_BADGES[idx % DEFAULT_BADGES.length]
      };
    });
  }

  function fitViewport() {
    const container = document.getElementById('viewport-container');
    const stage = document.getElementById('scale-stage');
    const columnsContainer = document.getElementById('columnsContainer');
    if (!container || !stage || !columnsContainer) return;

    if (window.innerWidth < 1024) {
      stage.style.transform = 'none';
      stage.style.width = '100%';
      stage.style.height = 'auto';
      return;
    }

    stage.style.transform = 'none';
    stage.style.width = '100%';
    stage.style.height = 'auto';

    const availH = container.clientHeight - 8;
    const availW = container.clientWidth - 8;

    if (availH <= 0 || availW <= 0) return;

    if (isAutoFitActive) {
      const naturalH = columnsContainer.offsetHeight;
      if (naturalH > availH) {
        const scale = availH / naturalH;
        stage.style.width = `${100 / scale}%`;
        const adjustedH = columnsContainer.offsetHeight;
        const finalScale = Math.min(1, availH / adjustedH);
        stage.style.width = `${100 / finalScale}%`;
        stage.style.transform = `scale(${finalScale})`;
      } else {
        stage.style.width = '100%';
        stage.style.transform = 'scale(1)';
      }
    } else {
      stage.style.width = `${100 / manualScaleMultiplier}%`;
      stage.style.transform = `scale(${manualScaleMultiplier})`;
    }
  }

  function buildShell(data) {
    document.body.className = "bg-slate-100 text-slate-900 font-sans antialiased flex flex-col";

    const totalWords = (data.sections || []).reduce((acc, s) => acc + (s.words ? s.words.length : 0), 0);
    const defaultCounterText = data.counterLabel || pluralizeWords(totalWords);
    const printTitle = data.printTitle || `🇬🇷 Греческий язык — ${data.num ? `Урок ${data.num}: ` : ''}${data.title}${data.elTitle ? ` (${data.elTitle})` : ''}`;
    const printSubtitle = data.printSubtitle || `${defaultCounterText} • A4 Landscape Sheet`;

    const backBtnHtml = data.backUrl
      ? `<a href="${data.backUrl}" class="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold text-slate-700 hover:text-sky-700 bg-slate-50 hover:bg-sky-50 border border-slate-200 transition" title="Вернуться к списку всех уроков">
          <span>${data.backLabel || '← Уроки'}</span>
        </a>`
      : '';

    const badgeIconText = data.badgeText || (data.num ? String(data.num) : 'ΕΛ');

    document.body.innerHTML = `
      <!-- Print Sheet Banner (Only displayed when printing) -->
      <div id="print-banner" class="hidden">
        <div class="text-[8.5pt] font-bold tracking-tight text-slate-900">
          ${printTitle}
        </div>
        <div class="text-[7pt] text-slate-500 font-medium">
          ${printSubtitle}
        </div>
      </div>

      <!-- Top Navigation Control Bar -->
      <header id="screen-header" class="h-[38px] max-h-[38px] bg-white border-b border-slate-200 px-3 flex items-center justify-between gap-2 shadow-2xs shrink-0 z-30">
        
        <div class="flex items-center gap-2 shrink-0">
          ${backBtnHtml}
          <div class="w-6 h-6 rounded bg-sky-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
            ${badgeIconText}
          </div>
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-slate-900 text-xs tracking-tight hidden sm:inline">${data.title || 'Греческий язык'}</span>
            ${data.elTitle ? `<span class="text-[11px] text-slate-400 font-medium hidden md:inline">(${data.elTitle})</span>` : ''}
            <span id="wordCounter" class="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-50 text-sky-700 font-bold border border-sky-200">${defaultCounterText}</span>
            ${data.extraBadgeHtml || ''}
          </div>
        </div>

        <!-- Compact Search Box -->
        <div class="flex-1 max-w-xs min-w-[110px]">
          <div class="relative">
            <input 
              type="text" 
              id="searchInput" 
              placeholder="${data.searchPlaceholder || 'Поиск (el / ru)...'}" 
              class="w-full pl-6 pr-6 py-0.5 text-xs rounded border border-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 bg-slate-50 focus:bg-white text-slate-900 transition"
            />
            <svg class="w-3.5 h-3.5 text-slate-400 absolute left-1.5 top-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            <button id="clearSearchBtn" class="hidden absolute right-1.5 top-0.5 text-slate-400 hover:text-slate-600 text-xs">✕</button>
          </div>
        </div>

        <!-- Action Toolbar -->
        <div class="flex items-center gap-1 shrink-0 text-xs">
          
          <button 
            id="autoFitBtn"
            title="Автоматически подогнать размер всех слов под экран без прокрутки"
            class="hidden lg:flex px-2 py-0.5 rounded text-[11px] font-semibold border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 items-center gap-1 shadow-2xs cursor-pointer"
          >
            <svg class="w-3 h-3 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path>
            </svg>
            <span>В экран</span>
          </button>

          <button 
            id="testBtn"
            title="Скрыть русский перевод для самопроверки"
            class="px-2 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 font-medium text-[11px] text-slate-700 flex items-center gap-1 cursor-pointer"
          >
            <span id="testIcon">👁️</span>
            <span class="hidden sm:inline" id="testLabel">Тест</span>
          </button>

          <div class="hidden lg:flex items-center border border-slate-200 rounded text-[11px] overflow-hidden bg-white">
            <button id="scaleDownBtn" title="Уменьшить масштаб" class="px-1.5 py-0.5 hover:bg-slate-100 text-slate-700 font-bold border-r border-slate-200 cursor-pointer">A-</button>
            <button id="scaleUpBtn" title="Увеличить масштаб" class="px-1.5 py-0.5 hover:bg-slate-100 text-slate-700 font-bold cursor-pointer">A+</button>
          </div>

          <button 
            id="speedBtn"
            title="Скорость греческой озвучки"
            class="px-1.5 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-100 font-bold text-[11px] text-slate-700 cursor-pointer"
          >
            <span id="speedValue">0.9x</span>
          </button>

          <button 
            id="printBtn"
            title="Распечатать шпаргалку на 1 лист A4 (альбомная)"
            class="flex items-center gap-1 px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[11px] shadow-2xs transition cursor-pointer"
          >
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path>
            </svg>
            <span class="hidden sm:inline">Печать А4</span>
          </button>
        </div>
      </header>

      <!-- Viewport Stage -->
      <main id="viewport-container">
        <div id="scale-stage">
          <div id="columnsContainer" class="sheet-columns"></div>
        </div>
      </main>
    `;
  }

  function initCheatSheet(data) {
    if (!data || !Array.isArray(data.sections)) return;

    buildShell(data);

    const preparedSections = assignColumns(data.sections);
    const totalWords = preparedSections.reduce((acc, s) => acc + (s.words ? s.words.length : 0), 0);
    const defaultCounterText = data.counterLabel || pluralizeWords(totalWords);

    function render() {
      const container = document.getElementById('columnsContainer');
      container.innerHTML = '';

      const cols = [0, 1, 2, 3, 4].map(() => {
        const div = document.createElement('div');
        div.className = 'col-stack';
        return div;
      });

      let matchedWords = 0;
      const q = searchQuery.toLowerCase().trim();

      preparedSections.forEach(sec => {
        const headerMatch = (sec.title && sec.title.toLowerCase().includes(q)) ||
                            (sec.subtitle && sec.subtitle.toLowerCase().includes(q));

        const words = (sec.words || []).filter(w => {
          if (!q || headerMatch) return true;
          return w.el.toLowerCase().includes(q) || w.ru.toLowerCase().includes(q);
        });

        if (words.length === 0) return;
        matchedWords += words.length;

        const card = document.createElement('div');
        card.className = `vocab-card ${sec.ready ? 'ready-lesson' : ''}`;

        const header = document.createElement('div');
        header.className = 'vocab-card-header text-slate-800';

        let rightBadgeHtml = '';
        if (sec.url) {
          rightBadgeHtml = `<a href="${sec.url}" class="px-1.5 py-0.5 rounded text-[9.5px] font-bold ${
            sec.ready
              ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-2xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
          } transition shrink-0">${sec.actionLabel || 'Открыть →'}</a>`;
        } else {
          rightBadgeHtml = `<span class="text-[9.5px] font-bold px-1 rounded border ${sec._badge} shrink-0">${sec.badgeLabel || words.length}</span>`;
        }

        const titleHtml = sec.url
          ? `<a href="${sec.url}" class="text-[11px] font-bold ${sec.ready ? 'text-sky-700' : 'text-slate-800'} hover:underline">${sec.title}</a>`
          : `<span class="text-[11px] font-bold text-slate-800">${sec.title}</span>`;

        header.innerHTML = `
          <div class="truncate">
            ${titleHtml}
            ${sec.subtitle ? `<span class="text-[9.5px] text-slate-400 font-normal ml-0.5">(${sec.subtitle})</span>` : ''}
          </div>
          ${rightBadgeHtml}
        `;
        card.appendChild(header);

        const list = document.createElement('div');
        list.className = 'flex flex-col';

        words.forEach(w => {
          const row = document.createElement('div');
          row.className = 'vocab-row group';
          row.onclick = (e) => speak(w.el, e);
          row.title = 'Кликните для озвучки';

          row.innerHTML = `
            <div class="flex items-baseline gap-1 min-w-0">
              <span class="font-semibold text-slate-900 leading-tight">${formatGreek(w.el)}</span>
              <button class="audio-btn opacity-0 group-hover:opacity-100 text-slate-400 hover:text-sky-600 p-0.5 shrink-0" title="Озвучить">
                <svg class="w-2.5 h-2.5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"></path>
                </svg>
              </button>
            </div>
            <div class="ru-translation text-slate-600 text-right shrink-0 font-normal">
              ${w.ru}
            </div>
          `;
          list.appendChild(row);
        });

        card.appendChild(list);
        cols[sec._resolvedCol].appendChild(card);
      });

      cols.forEach(c => container.appendChild(c));
      document.getElementById('wordCounter').innerText = q ? `${matchedWords} найдено` : defaultCounterText;

      requestAnimationFrame(fitViewport);
    }

    // Bind Controls
    const autoFitBtn = document.getElementById('autoFitBtn');
    const testBtn = document.getElementById('testBtn');
    const scaleDownBtn = document.getElementById('scaleDownBtn');
    const scaleUpBtn = document.getElementById('scaleUpBtn');
    const speedBtn = document.getElementById('speedBtn');
    const printBtn = document.getElementById('printBtn');
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');

    autoFitBtn.addEventListener('click', () => {
      isAutoFitActive = !isAutoFitActive;
      if (isAutoFitActive) {
        autoFitBtn.className = "hidden lg:flex px-2 py-0.5 rounded text-[11px] font-semibold border border-sky-300 bg-sky-50 text-sky-700 hover:bg-sky-100 items-center gap-1 shadow-2xs cursor-pointer";
        manualScaleMultiplier = 1.0;
      } else {
        autoFitBtn.className = "hidden lg:flex px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 items-center gap-1 cursor-pointer";
      }
      fitViewport();
    });

    testBtn.addEventListener('click', () => {
      const isTest = document.body.classList.toggle('test-mode');
      document.getElementById('testIcon').innerText = isTest ? '🙈' : '👁️';
      document.getElementById('testLabel').innerText = isTest ? 'Ответы' : 'Тест';
    });

    function adjustScale(delta) {
      isAutoFitActive = false;
      autoFitBtn.className = "hidden lg:flex px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 items-center gap-1 cursor-pointer";
      manualScaleMultiplier = Math.max(0.65, Math.min(1.35, manualScaleMultiplier + delta));
      fitViewport();
    }

    scaleDownBtn.addEventListener('click', () => adjustScale(-0.04));
    scaleUpBtn.addEventListener('click', () => adjustScale(0.04));

    speedBtn.addEventListener('click', () => {
      const idx = speedCycle.indexOf(speechRate);
      speechRate = speedCycle[(idx + 1) % speedCycle.length];
      document.getElementById('speedValue').innerText = speechRate + 'x';
    });

    printBtn.addEventListener('click', () => {
      const wasTest = document.body.classList.contains('test-mode');
      const wasQuery = searchQuery;

      if (wasTest) document.body.classList.remove('test-mode');
      if (wasQuery) {
        searchQuery = '';
        searchInput.value = '';
        render();
      }

      window.print();

      if (wasTest) document.body.classList.add('test-mode');
      if (wasQuery) {
        searchQuery = wasQuery;
        searchInput.value = wasQuery;
        render();
      }
    });

    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      clearBtn.classList.toggle('hidden', !searchQuery);
      render();
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      clearBtn.classList.add('hidden');
      render();
      searchInput.focus();
    });

    window.addEventListener('resize', fitViewport);

    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }

    render();
  }

  window.GreekCheatSheet = { init: initCheatSheet };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.LESSON_DATA) initCheatSheet(window.LESSON_DATA);
    });
  } else {
    if (window.LESSON_DATA) initCheatSheet(window.LESSON_DATA);
  }
})();
