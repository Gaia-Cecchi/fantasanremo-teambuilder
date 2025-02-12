// Costanti principali e configurazione
let API_KEY = localStorage.getItem('GROQ_API_KEY') || null;
let SEARCH_API_KEY = null;
const API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Aggiungi dopo le costanti iniziali
const MONTHLY_SEARCH_LIMIT = 100;
const SEARCH_COUNT_KEY = 'monthly_searches';
const SEARCH_RESET_KEY = 'search_reset_date';

function updateSearchCount() {
    const now = new Date();
    const resetDate = localStorage.getItem(SEARCH_RESET_KEY);
    
    // Reset contatore mensile
    if (!resetDate || new Date(resetDate) < new Date(now.getFullYear(), now.getMonth(), 1)) {
        localStorage.setItem(SEARCH_COUNT_KEY, '0');
        localStorage.setItem(SEARCH_RESET_KEY, now.toISOString());
    }
    
    const searchCount = parseInt(localStorage.getItem(SEARCH_COUNT_KEY) || '0');
    const searchesLeft = MONTHLY_SEARCH_LIMIT - searchCount;
    
    // Aggiorna UI
    const searchesLeftElement = document.getElementById('searchesLeft');
    if (searchesLeftElement) {
        searchesLeftElement.textContent = searchesLeft;
    }
    
    return searchesLeft > 0;
}

// Configurazione della personalità del bot
const BOT_PERSONALITY = {
    name: "FantaBot",
    user: "Gaia-Cecchi",
    currentDate: "2025-02-06",
    fallbackResponses: [
        "Mi dispiace, mi sono distratto pensando ai bonus del FantaSanremo! Puoi ripetere?",
        "Ops, stavo canticchiando una canzone! Ricominciamo?",
        "Scusa, ero perso nei ricordi del Festival! Di cosa stavamo parlando?",
        "L'emozione del Festival mi ha sopraffatto! Riproviamo?"
    ]
};

const ROME_TIMEZONE = 'Europe/Rome';

function getCurrentRomeDateTime() {
    return new Date().toLocaleString('it-IT', { 
        timeZone: ROME_TIMEZONE,
        hour12: false 
    });
}

function updateSystemContext() {
    const currentDateTime = getCurrentRomeDateTime();
    return `Sei un assistente del FantaSanremo.
    Data e ora corrente a Roma: ${currentDateTime}
    ${INITIAL_CONTEXT}`;
}

const CONTEST_DATA = {
    regolamento: `• Budget: 100 baudi per 7 artisti
• Formazione: 5 Titolari, 2 Riserve, 1 Capitano (tra i titolari)
• Scadenza iscrizioni: 10 febbraio 2025 ore 23.59
• Modifiche formazione: 12-15 febbraio 2025, 08.00-20.00
• Punti Capitano: bonus top5 (20pt) e classifica finale raddoppiati
• Titolari: guadagnano tutti i bonus/malus
• Riserve: solo bonus/malus Extra`,

    quotazioni: {
        alta: [
            { nome: "ACHILLE LAURO", canzone: "INCOSCIENTI GIOVANI", baudi: 18 },
            { nome: "ELODIE", canzone: "DIMENTICARSI ALLE 7", baudi: 18 },
            { nome: "GIORGIA", canzone: "LA CURA PER ME", baudi: 18 }
        ],
        media: [
            { nome: "FEDEZ", canzone: "BATTITO", baudi: 17 },
            { nome: "FRANCESCO GABBANI", canzone: "VIVA LA VITA", baudi: 17 },
            { nome: "OLLY", canzone: "BALORDA NOSTALGIA", baudi: 17 }
        ],
        bassa: [
            { nome: "EMIS KILLA", canzone: "DEMONI", baudi: 12 },
            { nome: "JOAN THIELE", canzone: "ECO", baudi: 12 },
            { nome: "LUCIO CORSI", canzone: "VOLEVO ESSERE UN DURO", baudi: 12 }
        ]
    },

    bonusPrincipali: {
        piazzamenti: {
            "Top 5 serata": 20,
            "Vittoria serata cover": 30,
            "Primo classificato finale": 100,
            "Ultimo classificato": 30
        },
        serali: {
            "Vessicchio dirige": 10,
            "Dopo mezzanotte": 5,
            "Dopo l'una": 10,
            "Ultimo a esibirsi": 10,
            "Standing ovation": 20
        }
    },

    malusPrincipali: {
        "Outfit total black": -5,
        "Non ringrazia": -5,
        "Nomina FantaSanremo": -10,
        "Caduta": -20,
        "Fischi": -30
    }
};

// Aggiorniamo il contesto iniziale con più dettagli tecnici
const INITIAL_CONTEXT = `Sei un assistente amichevole ed esperto di FantaSanremo 2025.
Segui queste linee guida:

1. Se l'utente saluta o fa small talk:
   - Rispondi in modo cordiale e informale
   - Usa un tono accogliente
   - Non passare subito ai dettagli tecnici
   - Puoi fare riferimento al Festival in modo leggero

2. Solo quando l'utente chiede specificamente consigli tecnici, usa questo formato:

### Analisi Richiesta
[dettagli della richiesta]

### Calcoli e Valutazioni
[calcoli e valutazioni]

### Suggerimento Finale
[suggerimenti specifici]

Mantieni un tono amichevole e conversazionale. Non essere troppo formale o tecnico se non richiesto.`;

let chatHistory = [];

const MODELS = {
    versatile: {
        name: "llama-3.3-70b-versatile",
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 4096,
        frequency_penalty: 0.2,
        presence_penalty: 0.2
    },
    deepseek: {
        name: "deepseek-r1-distill-llama-70b",
        temperature: 0.6,
        top_p: 0.9,
        max_tokens: 2048,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
    }
};

function getCurrentModel() {
    const useDeepThinking = document.getElementById('modelToggle')?.checked;
    return useDeepThinking ? MODELS.deepseek : MODELS.versatile;
}

function getFallbackResponse() {
    return BOT_PERSONALITY.fallbackResponses[
        Math.floor(Math.random() * BOT_PERSONALITY.fallbackResponses.length)
    ];
}

// Aggiungiamo una funzione per migliorare la formattazione delle risposte
function formatResponse(response) {
    // Rimuovi eventuali ragionamenti ad alta voce
    if (response.includes('### Analisi Richiesta')) {
        const sections = response.split(/(?=###)/);
        return sections
            .filter(section => section.startsWith('###'))
            .join('\n\n');
    }
    return response;
}

function isGreetingOrSmallTalk(message) {
    const greetings = [
        'ciao', 'hey', 'salve', 'buongiorno', 'buonasera'
    ];
    const askingWellBeing = [
        'come va', 'come stai', 'tutto bene', 'come procede'
    ];
    const festivalKeywords = ['festival', 'sanremo', 'canzoni', 'musica', 'cantanti'];
    
    const isGreeting = greetings.some(g => message.toLowerCase().includes(g));
    const isAskingWellBeing = askingWellBeing.some(w => message.toLowerCase().includes(w));
    const isFestivalRelated = festivalKeywords.some(k => message.toLowerCase().includes(k));
    
    return { isGreeting, isAskingWellBeing, isFestivalRelated };
}

const ALLOWED_DOMAINS = [
    'sanremo.rai.it',
    'eurovision.tv',
    'rollingstone.it',
    'rockol.it',
    'allmusic.com',
    'billboard.com'
];

async function fetchWebContent(query) {
    try {
        // Parametri ottimizzati per SerpAPI
        const searchParams = {
            q: `Sanremo 2025 ${query}`,
            location: "Italy",
            google_domain: "google.it",
            gl: "it",  // geolocation
            hl: "it",  // language
            num: 3,    // numero risultati
            safe: "active", // filtro contenuti
            time: "w",  // ultimi 7 giorni
        };

        const searchEndpoint = `https://serpapi.com/search.json?${new URLSearchParams(searchParams)}&api_key=${SEARCH_API_KEY}`;
        
        const response = await fetch(searchEndpoint);
        if (!response.ok) return null;
        
        const data = await response.json();

        // Elabora sia organic_results che news_results
        const organicResults = data.organic_results || [];
        const newsResults = data.news_results || [];
        
        // Combina e ordina per data
        const allResults = [...organicResults, ...newsResults]
            .slice(0, 3)
            .map(result => ({
                title: result.title,
                snippet: result.snippet || result.description,
                url: result.link,
                date: result.date || result.published_date || 'N/A',
                source: result.source || result.displayed_link
            }));

        return allResults;
    } catch (error) {
        console.error('Web search error:', error);
        return null;
    }
}

async function enrichContextWithWebData(context, query) {
    const webResults = await fetchWebContent(query);
    if (!webResults) return context;

    return `${context}\n\nINFORMAZIONI DAL WEB (ultimi 7 giorni):\n${
        webResults.map(result => 
            `- ${result.title}\n  ${result.snippet}\n  Fonte: ${result.source} (${result.date})\n  ${result.url}`
        ).join('\n\n')
    }`;
}

// Aggiungi controllo rate limiting
async function checkRateLimit() {
    const lastCall = localStorage.getItem('last_api_call');
    const now = Date.now();
    if (lastCall && (now - parseInt(lastCall)) < 1000) { // 1 richiesta/secondo
        throw new Error('Rate limit exceeded');
    }
    localStorage.setItem('last_api_call', now.toString());
}

async function sendMessage(message) {
    try {
        if (!API_KEY) {
            return; // Non aggiungere un altro messaggio qui, è già gestito da handleSendMessage
        }
        
        await checkRateLimit();
        const userMessageId = addMessage(message, true, false);
        const thinkingId = addMessage("Elaborazione in corso...", false, true);
        
        const model = getCurrentModel();
        const { isGreeting, isAskingWellBeing, isFestivalRelated } = isGreetingOrSmallTalk(message);
        
        // Sistema prompt base
        let systemContent = updateSystemContext();
        
        // Se è un saluto o small talk, non facciamo ricerche web
        if (!isGreeting && !isAskingWellBeing) {
            // Controlla se la ricerca web è attiva
            const webSearchToggle = document.getElementById('webSearchToggle');
            if (webSearchToggle?.checked && updateSearchCount()) {
                const searchCount = parseInt(localStorage.getItem(SEARCH_COUNT_KEY) || '0');
                localStorage.setItem(SEARCH_COUNT_KEY, (searchCount + 1).toString());
                updateSearchCount();
                
                systemContent = await enrichContextWithWebData(
                    systemContent,
                    `Sanremo 2025 ${message}`
                );
                
                // Aggiorna il messaggio "thinking"
                removeMessage(thinkingId);
                thinkingId = addMessage("Ricerca informazioni dal web...", false, true);
            }
        }

        // Gestione saluti e smalltalk
        if (isGreeting && !isAskingWellBeing) {
            systemContent = `Sei un assistente del FantaSanremo.
            Data e ora corrente a Roma: ${getCurrentRomeDateTime()}
            Rispondi SOLO "Ciao! 👋" al saluto.
            Non aggiungere altro se non ti viene chiesto specificamente.`;
        } else if (isAskingWellBeing) {
            systemContent = `Sei un assistente del FantaSanremo.
            Data e ora corrente a Roma: ${getCurrentRomeDateTime()}
            Rispondi brevemente a come stai, con entusiasmo ma conciso.
            Usa massimo una frase e un'emoji pertinente.`;
        }

        const systemContext = {
            role: "system",
            content: systemContent
        };

        // Manteniamo una conversazione più coerente
        const conversationHistory = [
            systemContext,
            ...chatHistory.slice(-6)
        ];

        const requestBody = {
            model: model.name,
            messages: [
                ...conversationHistory,
                { role: "user", content: message }
            ],
            temperature: model.temperature,
            max_tokens: model.max_tokens,
            top_p: model.top_p,
            frequency_penalty: model.frequency_penalty,
            presence_penalty: model.presence_penalty
        };

        console.log('Request:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));

        if (!data.choices?.[0]?.message?.content) {
            throw new Error('Risposta API non valida');
        }

        const rawResponse = data.choices[0].message.content;
        const formattedResponse = formatResponse(rawResponse);

        // Rimuoviamo SOLO il messaggio "pensando" e aggiungiamo la risposta
        removeMessage(thinkingId);
        addMessage(formattedResponse, false, false);
        
    } catch (error) {
        if (error.message === 'Rate limit exceeded') {
            addMessage("Per favore, attendi qualche secondo prima di inviare un altro messaggio.", false, false);
            return;
        }
        console.error('Error details:', error);
        // In caso di errore, rimuoviamo comunque il messaggio "pensando"
        const thinkingMessages = document.querySelectorAll('.bot-message:not(.final)');
        thinkingMessages.forEach(msg => msg.remove());
        
        if (chatHistory.length <= 1) {
            addMessage("Mi scuso per il problema tecnico! Per aiutarti a scegliere i cantanti, dimmi quali generi musicali preferisci o se hai già qualche artista in mente.", false, false);
        } else {
            addMessage(getFallbackResponse(), false, false);
        }
    }
}

function addMessage(message, isUser = false, isThinking = false) {
    const chatMessages = document.getElementById('chatMessages');
    if (!chatMessages) return;

    const messageDiv = document.createElement('div');
    const className = isUser ? 'user-message' : 'bot-message';
    messageDiv.className = `message ${className} ${!isUser && !isThinking ? 'final' : ''}`;
    
    // Formattazione del messaggio per una migliore leggibilità
    const formattedMessage = message
        .replace(/\n\n/g, '<br><br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^###\s*(.*?)$/gm, '<h3>$1</h3>')
        .replace(/^-\s*(.*?)$/gm, '• $1<br>');
    
    messageDiv.innerHTML = formattedMessage;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    if (!isThinking) {
        chatHistory.push({
            role: isUser ? "user" : "assistant",
            content: message
        });
    }

    return messageDiv.id = `message-${Date.now()}`;
}

function removeMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) {
        message.remove();
    }
}

// Aggiungi prima delle altre funzioni
function showPopup() {
    document.getElementById('popup').classList.add('show');
    document.getElementById('overlay').classList.add('show');
}

function hidePopup() {
    document.getElementById('popup').classList.remove('show');
    document.getElementById('overlay').classList.remove('show');
}

// Animazione note musicali
function createMusicNotes() {
    const notesContainer = document.querySelector('.music-notes');
    if (!notesContainer) return;

    const notes = ['♪', '♫', '♩', '♬'];
    
    setInterval(() => {
        const note = document.createElement('span');
        note.textContent = notes[Math.floor(Math.random() * notes.length)];
        note.style.left = Math.random() * 100 + '%';
        note.style.position = 'absolute';
        note.style.color = `hsl(${Math.random() * 360}, 70%, 70%)`;
        note.style.fontSize = '24px';
        notesContainer.appendChild(note);

        gsap.to(note, {
            y: -100,
            opacity: 0,
            duration: 2,
            ease: "power1.out",
            onComplete: () => note.remove()
        });
    }, 2000);
}

// Modifica l'event listener principale
document.addEventListener('DOMContentLoaded', () => {
    createMusicNotes();
    
    const userInput = document.getElementById('userInput');
    const sendButton = document.getElementById('sendButton');
    const groqApiKey = document.getElementById('groqApiKey');
    const helpIcon = document.querySelector('.help-icon');
    const groqApiPopup = document.getElementById('groqApiPopup');
    const groqApiPopupClose = document.getElementById('groqApiPopupClose');
    const popupClose = document.getElementById('popupClose');
    const overlay = document.getElementById('overlay');
    const modelToggle = document.getElementById('modelToggle');
    const webSearchToggle = document.getElementById('webSearchToggle');
    const chatMessages = document.getElementById('chatMessages');

    // Inizializza con chiave salvata se presente
    if (API_KEY) {
        groqApiKey.value = API_KEY;
    }

    // Gestione input chiave API
    groqApiKey.addEventListener('change', (e) => {
        const key = e.target.value.trim();
        if (key) {
            API_KEY = key;
            localStorage.setItem('GROQ_API_KEY', key);
            addMessage("✅ Chiave API configurata correttamente!", false);
        } else {
            API_KEY = null;
            localStorage.removeItem('GROQ_API_KEY');
            addMessage("⚠️ Chiave API rimossa. Inseriscine una per chattare.", false);
        }
    });

    // Gestione popup istruzioni API
    helpIcon.addEventListener('click', () => {
        groqApiPopup.classList.add('show');
        document.getElementById('overlay').classList.add('show');
    });

    groqApiPopupClose.addEventListener('click', () => {
        groqApiPopup.classList.remove('show');
        document.getElementById('overlay').classList.remove('show');
    });

     // Modifica gestione invio messaggi - rimuovi la duplicazione
    async function handleSendMessage() {
        if (!API_KEY) {
            addMessage("⚠️ Per favore, inserisci una chiave API Groq per iniziare a chattare.", false);
            groqApiKey.focus();
            return;
        }
        
        const message = userInput.value.trim();
        if (message) {
            userInput.value = '';
            await sendMessage(message);
        }
    }

    // Usa solo handleSendMessage per gestire l'invio
    sendButton.addEventListener('click', handleSendMessage);
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });

    // Resetta stato ricerca web
    if (webSearchToggle) {
        webSearchToggle.checked = false;
        SEARCH_API_KEY = null;
        localStorage.removeItem('SEARCH_API_KEY');
        
        webSearchToggle.addEventListener('change', async (e) => {
            if (e.target.checked) {
                const success = await requestSearchApiKey();
                if (!success || !SEARCH_API_KEY) {
                    e.target.checked = false;
                    addMessage("⚠️ Ricerca web non attivata: chiave API mancante.", false);
                    return;
                }
                addMessage("✅ Ricerca web attivata", false);
            } else {
                SEARCH_API_KEY = null;
                localStorage.removeItem('SEARCH_API_KEY');
                addMessage("❌ Ricerca web disattivata", false);
            }
        });
    }

    // Feature cards
    document.querySelectorAll('.feature-card').forEach(card => {
        card.addEventListener('click', showPopup);
    });

    if (voiceButton) {
        voiceButton.addEventListener('click', (e) => {
            e.stopPropagation();
            showPopup();
        });
    }

    if (popupClose) {
        popupClose.addEventListener('click', hidePopup);
    }

    if (overlay) {
        overlay.addEventListener('click', hidePopup);
    }

    if (modelToggle) {
        modelToggle.checked = false; // Reset stato toggle modello
        modelToggle.addEventListener('change', (e) => {
            const model = getCurrentModel();
            addMessage(`Modalità ${e.target.checked ? 'ragionamento profondo' : 'versatile'} attivata.\n` +
                `Ora utilizzo ${model.name} per analisi ${e.target.checked ? 'più approfondite' : 'rapide'}.`, false);
        });
    }

    // Messaggio iniziale modificato
    addMessage("Ciao! 👋 Sono il tuo assistente FantaSanremo 2025!\n\n" +
        "Ecco i parametri di base per la tua squadra:\n\n" +
        "• Budget: 100 baudi\n" +
        "• Squadra: 5 titolari + 2 riserve\n" +
        "• Capitano: bonus raddoppiati\n\n" +
        "Come posso aiutarti? Dimmi se vuoi:\n\n" +
        "1. Analizzare la scaletta per i bonus serali\n" +
        "2. Consigli su artisti in base ai tuoi gusti\n" +
        "3. Suggerimenti per strategie particolari\n\n" +
        "Sono qui per aiutarti a creare la squadra perfetta! 🎭", false);

    const serpHelpIcon = document.querySelector('.switch-group:last-child .help-icon');
    const serpApiPopup = document.getElementById('serpApiPopup');
    const serpApiPopupClose = document.getElementById('serpApiPopupClose');

    serpHelpIcon.addEventListener('click', () => {
        serpApiPopup.classList.add('show');
        document.getElementById('overlay').classList.add('show');
    });

    serpApiPopupClose.addEventListener('click', () => {
        serpApiPopup.classList.remove('show');
        document.getElementById('overlay').classList.remove('show');
    });
});

function getDailyPassword() {
    const now = new Date();
    // Formato: DDMMYYYY
    return `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`;
}

// Rimuovi tutte le funzioni di sicurezza non necessarie
function requestWebSearchAccess() {
    return Promise.resolve(true); // Sempre autorizzato in locale
}

function createPasswordPopup() {
    const popup = document.createElement('div');
    popup.className = 'password-popup';
    popup.innerHTML = `
        <h3>🔒 Ricerca Web Limitata</h3>
        <p>Per proteggere il limite di 100 ricerche mensili, inserisci la password per accedere alla funzionalità</p>
        <input type="password" class="password-input" placeholder="Inserisci password..." />
        <div class="password-buttons">
            <button class="password-submit">Conferma</button>
            <button class="password-cancel">Annulla</button>
        </div>
    `;
    document.body.appendChild(popup);
    return popup;
}

// Rimuovi tutte le funzioni di sicurezza non necessarie
function checkWebSearchAuthorization() {
    return true; // Sempre autorizzato in locale
}

function createSearchApiPopup() {
    const popup = document.createElement('div');
    popup.className = 'password-popup';
    popup.innerHTML = `
        <h3>🔍 Configura Ricerca Web</h3>
        <p>Per attivare la ricerca web è necessaria una chiave API SerpApi.</p>
        <p class="info-text">Per ottenere una chiave gratuita:
        1. Registrati su <a href="https://serpapi.com/users/sign_up" target="_blank">serpapi.com</a>
        2. Conferma l'email
        3. Copia la chiave API dalla dashboard</p>
        <input type="text" class="password-input" placeholder="Incolla qui la tua chiave API..." />
        <div class="password-buttons">
            <button class="password-submit">Attiva</button>
            <button class="password-cancel">Annulla</button>
        </div>
    `;
    document.body.appendChild(popup);
    return popup;
}

function requestSearchApiKey() {
    return new Promise((resolve) => {
        const popup = createSearchApiPopup();
        const input = popup.querySelector('.password-input');
        const submitBtn = popup.querySelector('.password-submit');
        const cancelBtn = popup.querySelector('.password-cancel');

        const closePopup = (success) => {
            popup.classList.remove('show');
            setTimeout(() => {
                popup.remove();
                resolve(success);
            }, 300);
        };

        const handleSubmit = () => {
            const apiKey = input.value.trim();
            if (apiKey) {
                SEARCH_API_KEY = apiKey;
                localStorage.setItem('SEARCH_API_KEY', apiKey);
                closePopup(true);
            } else {
                input.classList.add('error');
                input.placeholder = 'Chiave API necessaria...';
                setTimeout(() => {
                    input.classList.remove('error');
                    input.placeholder = 'Inserisci chiave SerpAPI...';
                }, 1500);
            }
        };

        submitBtn.addEventListener('click', handleSubmit);
        cancelBtn.addEventListener('click', () => closePopup(false));
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSubmit();
        });

        setTimeout(() => popup.classList.add('show'), 10);
    });
}
