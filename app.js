/* EdVoice Advisor — AI Course Consultant (no external APIs) */
(function () {
	'use strict';

	// DOM refs
	const messagesEl = document.getElementById('messages');
	const textInput = document.getElementById('textInput');
	const sendBtn = document.getElementById('btn-send');
	const micBtn = document.getElementById('btn-mic');
	const langToggle = document.getElementById('langToggle');
	const quickPromptsEl = document.getElementById('quickPrompts');
	const btnRecommend = document.getElementById('btn-recommend');
	const goalSelect = document.getElementById('goalSelect');
	const categorySelect = document.getElementById('categorySelect');
	const recoCard = document.getElementById('recommendationsCard');
	const recoList = document.getElementById('recoList');
	const scheduleBtn = document.getElementById('btn-schedule');
	const modal = document.getElementById('callbackModal');
	const cbClose = document.getElementById('cbClose');
	const cbForm = document.getElementById('cbForm');
	const cbName = document.getElementById('cbName');
	const cbPhone = document.getElementById('cbPhone');
	const cbWhen = document.getElementById('cbWhen');
	const cbIcs = document.getElementById('cbIcs');
	const toast = document.getElementById('toast');

	// App state
	const state = {
		language: 'en', // 'en' | 'hi'
		listening: false,
		speaking: false,
		dialogContext: {
			lastCourseId: null,
			userGoal: 'job',
			userCategory: 'any'
		}
	};

	// Utilities
	function showToast(text) {
		toast.textContent = text;
		toast.classList.add('show');
		setTimeout(() => toast.classList.remove('show'), 2000);
	}
	function nowIsoLocal() {
		const n = new Date();
		const off = n.getTimezoneOffset();
		const d = new Date(n.getTime() - off * 60000);
		return d.toISOString().slice(0, 16);
	}

	// Messages UI
	function addMessage(text, who = 'bot') {
		const wrapper = document.createElement('div');
		wrapper.className = `bubble ${who}`;
		wrapper.innerHTML = text;
		messagesEl.appendChild(wrapper);
		messagesEl.scrollTop = messagesEl.scrollHeight;
	}

	function addRecoList(items) {
		recoList.innerHTML = '';
		items.forEach((c) => {
			const li = document.createElement('li');
			li.className = 'reco-item';
			li.innerHTML = `
				<div class="title">${c.title}</div>
				<div class="meta">${c.provider} • ${c.mode} • ${c.durationWeeks} weeks • ₹${c.feesINR.toLocaleString('en-IN')}</div>
				<div class="row">
					<button class="btn" data-id="${c.id}" data-act="details">Details</button>
					<button class="btn primary" data-id="${c.id}" data-act="tell">Ask Agent</button>
				</div>
			`;
			recoList.appendChild(li);
		});
		recoCard.hidden = items.length === 0;
	}

	// Quick prompts
	const quickPrompts = [
		{ en: 'Show me data science courses', hi: 'डेटा साइंस कोर्स दिखाओ' },
		{ en: 'Fees and duration for web dev', hi: 'वेब डेवलपमेंट की फीस और अवधि' },
		{ en: 'Do you have placement support?', hi: 'क्या प्लेसमेंट सपोर्ट है?' },
		{ en: 'Help me choose a course', hi: 'मेरे लिए सही कोर्स सुझाओ' }
	];
	quickPrompts.forEach((p) => {
		const chip = document.createElement('button');
		chip.type = 'button';
		chip.className = 'chip';
		chip.textContent = state.language === 'en' ? p.en : p.hi;
		chip.addEventListener('click', () => {
			textInput.value = chip.textContent;
			sendText();
		});
		quickPromptsEl.appendChild(chip);
	});

	function refreshPromptLanguage() {
		[...quickPromptsEl.children].forEach((el, idx) => {
			el.textContent = state.language === 'en' ? quickPrompts[idx].en : quickPrompts[idx].hi;
		});
	}

	// NLU — super-light bilingual keyword matcher
	const vocab = {
		greet: [/\b(hi|hello|hey)\b/i, /(namaste|namaskar|नमस्ते|नमस्कार)/i],
		goodbye: [/(bye|see you|goodbye)/i, /(alvida|चलता|फिर मिलेंगे)/i],
		help: [/(help|what can you do)/i, /(madad|कैसे मदद|क्या कर सकते)/i],
		recommend: [/(suggest|recommend|choose.*course|best course)/i, /(sujha|sujhav|सुझा|सुझाव|कोर्स चुन)/i],
		fees: [/(fee|fees|price|cost)/i, /(fee|फीस|कीमत|दाम)/i],
		duration: [/(duration|how long|weeks|months)/i, /( अवधि|कितने सप्ताह|कितने महीने)/i],
		syllabus: [/(syllabus|curriculum|topics)/i, /(पाठ्यक्रम|सिलेबस|विषय)/i],
		placement: [/(placement|job support)/i, /(प्लेसमेंट|नौकरी|जॉब सपोर्ट)/i],
		schedule: [/(schedule.*call|callback|talk to human)/i, /(कॉल शेड्यूल|कॉल बैक|मानव से बात)/i],
		course_query: [/(data|ai|ml|web|frontend|full.?stack|mba|design|ui|ux)/i, /(डेटा|एआई|एमएल|वेब|फ्रंटएंड|फुल.?स्टैक|एमबीए|डिज़ाइन|यूआई|यूएक्स)/i]
	};

	function detectIntent(text) {
		const isHi = state.language === 'hi' || /[\u0900-\u097F]/.test(text);
		const keys = Object.keys(vocab);
		for (const k of keys) {
			const arr = vocab[k];
			const [enRe, hiRe] = arr;
			if (enRe && enRe.test(text)) return { intent: k, lang: 'en' };
			if (hiRe && hiRe.test(text)) return { intent: k, lang: 'hi' };
		}
		return { intent: 'course_query', lang: isHi ? 'hi' : 'en' };
	}

	// Dialog manager
	function respond(text) {
		const { intent } = detectIntent(text);
		switch (intent) {
			case 'greet':
				return speakAndShow(msg({ en: 'Hi! I am your course consultant. How can I help?', hi: 'नमस्ते! मैं आपका कोर्स सलाहकार हूँ। कैसे मदद करूँ?' }));
			case 'help':
				return speakAndShow(msg({ en: 'I can suggest courses, share fees, duration, syllabus, and schedule a callback.', hi: 'मैं कोर्स सुझा सकता हूँ, फीस, अवधि, सिलेबस बता सकता हूँ और कॉल शेड्यूल कर सकता हूँ।' }));
			case 'goodbye':
				return speakAndShow(msg({ en: 'Goodbye! Wishing you success.', hi: 'अलविदा! आपकी सफलता की कामना।' }));
			case 'fees':
				return handleCourseAttribute(text, 'fees');
			case 'duration':
				return handleCourseAttribute(text, 'duration');
			case 'syllabus':
				return handleCourseAttribute(text, 'syllabus');
			case 'placement':
				return handleCourseAttribute(text, 'placement');
			case 'schedule':
				openModal();
				return speakAndShow(msg({ en: 'Sure, please provide your details for a callback.', hi: 'ज़रूर, कृपया कॉल-बैक के लिए विवरण भरें।' }));
			case 'recommend':
				return recommendCourses();
			default:
				return recommendCourses(text);
		}
	}

	function msg(map) { return state.language === 'en' ? map.en : map.hi; }

	function handleCourseAttribute(text, attr) {
		const course = findRelevantCourse(text) || (state.dialogContext.lastCourseId && COURSES.find(c => c.id === state.dialogContext.lastCourseId));
		if (!course) {
			return speakAndShow(msg({ en: 'Which course are you asking about?', hi: 'किस कोर्स के बारे में पूछ रहे हैं?' }));
		}
		state.dialogContext.lastCourseId = course.id;
		if (attr === 'fees') {
			return speakAndShow(formatAttr(course, 'fees'));
		}
		if (attr === 'duration') {
			return speakAndShow(formatAttr(course, 'duration'));
		}
		if (attr === 'syllabus') {
			return speakAndShow(formatAttr(course, 'syllabus'));
		}
		if (attr === 'placement') {
			return speakAndShow(formatAttr(course, 'placement'));
		}
	}

	function formatAttr(course, attr) {
		if (attr === 'fees') {
			return msg({ en: `${course.title} fee is ₹${course.feesINR.toLocaleString('en-IN')}.`, hi: `${course.title} की फीस ₹${course.feesINR.toLocaleString('en-IN')} है।` });
		}
		if (attr === 'duration') {
			return msg({ en: `${course.title} duration is ${course.durationWeeks} weeks.`, hi: `${course.title} की अवधि ${course.durationWeeks} सप्ताह है।` });
		}
		if (attr === 'syllabus') {
			return msg({ en: `${course.title} covers: ${course.syllabus.slice(0,6).join(', ')}…`, hi: `${course.title} में यह शामिल है: ${course.syllabus.slice(0,6).join(', ')}…` });
		}
		if (attr === 'placement') {
			return course.placementSupport
				? msg({ en: `${course.title} includes placement support.`, hi: `${course.title} में प्लेसमेंट सपोर्ट शामिल है।` })
				: msg({ en: `${course.title} does not include placement support.`, hi: `${course.title} में प्लेसमेंट सपोर्ट नहीं है।` });
		}
	}

	function findRelevantCourse(text) {
		if (!text) return null;
		const t = text.toLowerCase();
		const keywords = [
			{ k: ['data science','ml','machine learning','ai','डेटा','एआई','एमएल'], cat: 'data' },
			{ k: ['web','frontend','react','full stack','फ्रंट','वेब','फुल'], cat: 'dev' },
			{ k: ['mba','business','management','एमबीए','बिज़नेस'], cat: 'mba' },
			{ k: ['design','ui','ux','डिजाइन','यूआई','यूएक्स'], cat: 'design' }
		];
		let cat = null;
		for (const entry of keywords) {
			if (entry.k.some(w => t.includes(w))) { cat = entry.cat; break; }
		}
		const candidates = COURSES.filter(c => !cat || c.category === cat);
		if (candidates.length === 0) return null;
		// pick best by simple score: language preference and goal
		const goal = state.dialogContext.userGoal;
		const scored = candidates.map(c => ({
			c,
			score: (c.tags.includes(goal) ? 2 : 0) + (c.languages.includes(state.language) ? 1 : 0)
		})).sort((a,b) => b.score - a.score);
		return scored[0].c;
	}

	function recommendCourses(userText) {
		if (userText) {
			const c = findRelevantCourse(userText);
			if (c) {
				state.dialogContext.lastCourseId = c.id;
				addRecoList([c]);
				const s = msg({ en: `I recommend ${c.title}. Do you want fees, duration or syllabus?`, hi: `मैं ${c.title} सुझाता हूँ। क्या आप फीस, अवधि या सिलेबस जानना चाहेंगे?` });
				return speakAndShow(s);
			}
		}
		// use filters
		state.dialogContext.userGoal = goalSelect.value;
		state.dialogContext.userCategory = categorySelect.value;
		const items = COURSES.filter(c => (categorySelect.value === 'any' || c.category === categorySelect.value) && c.tags.includes(goalSelect.value)).slice(0, 3);
		addRecoList(items);
		if (items.length === 0) {
			return speakAndShow(msg({ en: 'I did not find a match. Try another category.', hi: 'कोई उपयुक्त कोर्स नहीं मिला। कोई और श्रेणी चुनें।' }));
		}
		const line = msg({ en: `Here are ${items.length} good matches.`, hi: `ये रहे ${items.length} अच्छे विकल्प।` });
		return speakAndShow(line);
	}

	// Voice IO (Web Speech API)
	let recognition = null;
	const hasSpeechRecognition = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
	if (hasSpeechRecognition) {
		const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
		recognition = new SR();
		recognition.continuous = false;
		recognition.interimResults = true;
		recognition.maxAlternatives = 1;
		recognition.onresult = (ev) => {
			let finalText = '';
			for (let i = ev.resultIndex; i < ev.results.length; i++) {
				const res = ev.results[i];
				if (res.isFinal) finalText += res[0].transcript;
			}
			if (finalText) {
				textInput.value = finalText.trim();
				sendText();
			}
		};
		recognition.onstart = () => { state.listening = true; micBtn.setAttribute('aria-pressed','true'); };
		recognition.onend = () => { state.listening = false; micBtn.setAttribute('aria-pressed','false'); };
		recognition.onerror = () => { state.listening = false; micBtn.setAttribute('aria-pressed','false'); };
	}

	function setRecognitionLanguage() {
		if (!recognition) return;
		recognition.lang = state.language === 'en' ? 'en-IN' : 'hi-IN';
	}

	function speak(text) {
		if (!('speechSynthesis' in window)) return;
		window.speechSynthesis.cancel();
		const utter = new SpeechSynthesisUtterance(text);
		utter.lang = state.language === 'en' ? 'en-IN' : 'hi-IN';
		utter.rate = 1.0;
		utter.pitch = 1.0;
		// Prefer Indian voices if present
		const voices = window.speechSynthesis.getVoices();
		const preferred = voices.find(v => /en-IN|hi-IN|hindi|india/i.test(`${v.name} ${v.lang}`));
		if (preferred) utter.voice = preferred;
		state.speaking = true;
		utter.onend = () => { state.speaking = false; };
		window.speechSynthesis.speak(utter);
	}
	window.speechSynthesis?.addEventListener?.('voiceschanged', () => {});

	function stopSpeaking() {
		if (!('speechSynthesis' in window)) return;
		if (state.speaking) {
			window.speechSynthesis.cancel();
			state.speaking = false;
		}
	}

	// Barge-in: stop TTS when user starts speaking / presses mic
	function startListening() {
		if (!recognition) { showToast('Speech recognition not supported'); return; }
		stopSpeaking();
		setRecognitionLanguage();
		try { recognition.start(); } catch (_) {}
	}
	function stopListening() {
		try { recognition && recognition.stop(); } catch (_) {}
	}

	function speakAndShow(text) {
		addMessage(text, 'bot');
		speak(text);
	}

	// Send text message
	function sendText() {
		const text = textInput.value.trim();
		if (!text) return;
		addMessage(escapeHtml(text), 'user');
		textInput.value = '';
		respond(text);
	}

	function escapeHtml(s) { return s.replace(/[&<>"]+/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

	// Recommendations panel clicks
	recoList.addEventListener('click', (e) => {
		const btn = e.target.closest('button');
		if (!btn) return;
		const id = btn.getAttribute('data-id');
		const act = btn.getAttribute('data-act');
		const course = COURSES.find(c => c.id === id);
		if (!course) return;
		state.dialogContext.lastCourseId = course.id;
		if (act === 'details') {
			const line = `${course.title} — ${course.description}<br/><small>Topics: ${course.syllabus.slice(0,8).join(', ')}…</small>`;
			addMessage(line, 'bot');
			speak(msg({ en: `${course.title} covers ${course.syllabus.slice(0,5).join(', ')}`, hi: `${course.title} में ${course.syllabus.slice(0,5).join(', ')} शामिल है` }));
		}
		if (act === 'tell') {
			respond(course.title);
		}
	});

	// Modal controls
	function openModal() { modal.setAttribute('aria-hidden', 'false'); }
	function closeModal() { modal.setAttribute('aria-hidden', 'true'); }
	scheduleBtn.addEventListener('click', openModal);
	cbClose.addEventListener('click', closeModal);
	modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

	cbForm.addEventListener('submit', (e) => {
		e.preventDefault();
		const name = cbName.value.trim();
		const phone = cbPhone.value.trim();
		const when = cbWhen.value;
		if (!name || !phone || !when) return;
		const entry = { name, phone, when };
		const items = JSON.parse(localStorage.getItem('callbacks') || '[]');
		items.push(entry);
		localStorage.setItem('callbacks', JSON.stringify(items));
		const ics = buildIcs(entry);
		const blob = new Blob([ics], { type: 'text/calendar' });
		cbIcs.href = URL.createObjectURL(blob);
		showToast(msg({ en: 'Saved. Download calendar to remember!', hi: 'सेव हो गया। कैलेंडर डाउनलोड करें!' }));
		closeModal();
	});

	function buildIcs(entry) {
		const dt = new Date(entry.when);
		const dtEnd = new Date(dt.getTime() + 30*60000);
		function fmt(d){ return d.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z'; }
		return [
			'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//EdVoice Advisor//IN',
			'BEGIN:VEVENT',
			`UID:${Date.now()}@edvoice`,
			`DTSTAMP:${fmt(new Date())}`,
			`DTSTART:${fmt(dt)}`,
			`DTEND:${fmt(dtEnd)}`,
			`SUMMARY:EdTech Callback with ${entry.name}`,
			`DESCRIPTION:Phone ${entry.phone}`,
			'END:VEVENT','END:VCALENDAR'
		].join('\n');
	}

	// Listeners
	sendBtn.addEventListener('click', sendText);
	textInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendText(); });

	micBtn.addEventListener('mousedown', startListening);
	micBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startListening(); });
	micBtn.addEventListener('mouseup', stopListening);
	micBtn.addEventListener('mouseleave', stopListening);
	micBtn.addEventListener('touchend', stopListening);

	langToggle.addEventListener('change', () => {
		state.language = langToggle.checked ? 'hi' : 'en';
		refreshPromptLanguage();
		showToast(state.language === 'en' ? 'English' : 'हिन्दी');
	});

	btnRecommend.addEventListener('click', () => recommendCourses());

	// Seed greeting and defaults
	cbWhen.value = nowIsoLocal();
	setTimeout(() => {
		addMessage('👋');
		speakAndShow(msg({ en: 'Hi! Ask me about courses, fees, duration, syllabus, or say recommend.', hi: 'नमस्ते! कोर्स, फीस, अवधि, सिलेबस पूछें या कहें सुझाओ।' }));
	}, 200);
})();

