/** Onboarding translations for all 6 supported languages. */

export interface OnboardingI18n {
  stepOf: (current: number, total: number) => string;
  replay: string;
  next: string;
  back: string;
  finish: string;
  skip: string;
  letsGo: string;
  doneTitle: string;
  doneSubtitle: string;
  steps: {
    readingLevel: { narration: string; options: Record<string, string> };
    preferredFormat: { narration: string; options: Record<string, string> };
    responseLength: { narration: string; options: Record<string, string> };
    fontDisplay: {
      narration: string;
      options: Record<string, string>;
      dyslexiaToggle: string;
    };
    colorTheme: { narration: string; options: Record<string, string> };
    visualExtras: {
      narration: string;
      overlayLabel: string;
      options: Record<string, string>;
      reduceMotion: string;
      widerSpacing: string;
    };
    voiceSpeed: {
      narration: string;
      label: string;
      options: Record<string, string>;
    };
    preferredVoice: { narration: string };
    focusTimer: {
      narration: string;
      workLabel: string;
      breakLabel: string;
      autoRead: string;
      minSuffix: string;
    };
  };
}

// ── English ──────────────────────────────────────────────────────────────────

const en: OnboardingI18n = {
  stepOf: (c, t) => `Step ${c} of ${t}`,
  replay: "Replay",
  next: "Next",
  back: "Back",
  finish: "Finish",
  skip: "Skip",
  letsGo: "Let's Go",
  doneTitle: "You're all set!",
  doneSubtitle:
    "Your preferences have been saved. You can change them anytime in Settings.",
  steps: {
    readingLevel: {
      narration:
        "Let's start by finding the right reading level for you. Would you like responses that are simple and easy to follow, something moderate, or more detailed and advanced?",
      options: { simple: "Simple", moderate: "Moderate", advanced: "Advanced" },
    },
    preferredFormat: {
      narration:
        "How do you like your information presented? Would you prefer bullet points, short paragraphs, step-by-step instructions, or a mix of everything?",
      options: {
        bullets: "Bullet Points",
        paragraphs: "Short Paragraphs",
        steps: "Step-by-Step",
        mixed: "Mix",
      },
    },
    responseLength: {
      narration:
        "How much information do you want at once? Would you prefer short and concise answers, medium-length responses, or long and detailed explanations?",
      options: {
        short: "Short & Concise",
        medium: "Medium",
        long: "Long & Detailed",
      },
    },
    fontDisplay: {
      narration:
        "Let's make reading more comfortable. Would you like a larger font size? And would you prefer a dyslexia-friendly font?",
      options: {
        small: "Small",
        medium: "Medium",
        large: "Large",
        "x-large": "Extra Large",
      },
      dyslexiaToggle: "Dyslexia-friendly font (OpenDyslexic)",
    },
    colorTheme: {
      narration:
        "How about colours and themes? Would you like a light background, a dark background, or high contrast?",
      options: {
        light: "Light",
        dark: "Dark",
        "high-contrast": "High Contrast",
      },
    },
    visualExtras: {
      narration:
        "Would you like any visual helpers? You can turn on a colour overlay, reduce motion and animations, or adjust line spacing.",
      overlayLabel: "Colour Overlay",
      options: {
        none: "No Overlay",
        yellow: "Yellow",
        blue: "Blue",
        green: "Green",
        pink: "Pink",
      },
      reduceMotion: "Reduce motion & animations",
      widerSpacing: "Wider line spacing",
    },
    voiceSpeed: {
      narration:
        "How fast would you like me to speak? Move the slider to set your preferred speed. Slow, normal, or fast.",
      label: "Voice Speed",
      options: { slow: "Slow", medium: "Normal", fast: "Fast" },
    },
    preferredVoice: {
      narration:
        "Choose a voice you feel comfortable with. You can pick from a few different options.",
    },
    focusTimer: {
      narration:
        "Last one! Would you like a focus timer to help you stay on track? You can set how long to work before a gentle break reminder.",
      workLabel: "Work duration (minutes)",
      breakLabel: "Break reminder (minutes)",
      autoRead: "Auto-read responses aloud",
      minSuffix: "min",
    },
  },
};

// ── Spanish ──────────────────────────────────────────────────────────────────

const es: OnboardingI18n = {
  stepOf: (c, t) => `Paso ${c} de ${t}`,
  replay: "Repetir",
  next: "Siguiente",
  back: "Atrás",
  finish: "Finalizar",
  skip: "Omitir",
  letsGo: "¡Vamos!",
  doneTitle: "¡Todo listo!",
  doneSubtitle:
    "Tus preferencias han sido guardadas. Puedes cambiarlas en cualquier momento en Configuración.",
  steps: {
    readingLevel: {
      narration:
        "Empecemos encontrando el nivel de lectura adecuado para ti. ¿Prefieres respuestas simples y fáciles de seguir, algo moderado, o más detalladas y avanzadas?",
      options: { simple: "Simple", moderate: "Moderado", advanced: "Avanzado" },
    },
    preferredFormat: {
      narration:
        "¿Cómo prefieres que se presente la información? ¿Viñetas, párrafos cortos, instrucciones paso a paso, o una mezcla de todo?",
      options: {
        bullets: "Viñetas",
        paragraphs: "Párrafos cortos",
        steps: "Paso a paso",
        mixed: "Mezcla",
      },
    },
    responseLength: {
      narration:
        "¿Cuánta información quieres a la vez? ¿Respuestas cortas y concisas, de longitud media, o largas y detalladas?",
      options: {
        short: "Corto y conciso",
        medium: "Medio",
        long: "Largo y detallado",
      },
    },
    fontDisplay: {
      narration:
        "Hagamos la lectura más cómoda. ¿Te gustaría un tamaño de fuente más grande? ¿Y preferirías una fuente amigable para la dislexia?",
      options: {
        small: "Pequeño",
        medium: "Medio",
        large: "Grande",
        "x-large": "Extra grande",
      },
      dyslexiaToggle: "Fuente para dislexia (OpenDyslexic)",
    },
    colorTheme: {
      narration:
        "¿Qué tal los colores y temas? ¿Prefieres un fondo claro, un fondo oscuro, o alto contraste?",
      options: {
        light: "Claro",
        dark: "Oscuro",
        "high-contrast": "Alto contraste",
      },
    },
    visualExtras: {
      narration:
        "¿Te gustaría algún ayudante visual? Puedes activar una superposición de color, reducir el movimiento y las animaciones, o ajustar el espaciado de líneas.",
      overlayLabel: "Superposición de color",
      options: {
        none: "Sin superposición",
        yellow: "Amarillo",
        blue: "Azul",
        green: "Verde",
        pink: "Rosa",
      },
      reduceMotion: "Reducir movimiento y animaciones",
      widerSpacing: "Espaciado de líneas más amplio",
    },
    voiceSpeed: {
      narration:
        "¿Qué tan rápido te gustaría que hable? Mueve el control deslizante para configurar tu velocidad preferida. Lento, normal o rápido.",
      label: "Velocidad de voz",
      options: { slow: "Lento", medium: "Normal", fast: "Rápido" },
    },
    preferredVoice: {
      narration:
        "Elige una voz con la que te sientas cómodo. Puedes elegir entre varias opciones.",
    },
    focusTimer: {
      narration:
        "¡Última pregunta! ¿Te gustaría un temporizador de enfoque para mantenerte concentrado? Puedes establecer cuánto trabajar antes de un recordatorio de descanso.",
      workLabel: "Duración del trabajo (minutos)",
      breakLabel: "Recordatorio de descanso (minutos)",
      autoRead: "Leer respuestas en voz alta",
      minSuffix: "min",
    },
  },
};

// ── Italian ──────────────────────────────────────────────────────────────────

const it: OnboardingI18n = {
  stepOf: (c, t) => `Passo ${c} di ${t}`,
  replay: "Ripeti",
  next: "Avanti",
  back: "Indietro",
  finish: "Fine",
  skip: "Salta",
  letsGo: "Andiamo!",
  doneTitle: "Tutto pronto!",
  doneSubtitle:
    "Le tue preferenze sono state salvate. Puoi modificarle in qualsiasi momento nelle Impostazioni.",
  steps: {
    readingLevel: {
      narration:
        "Iniziamo trovando il livello di lettura giusto per te. Preferisci risposte semplici e facili da seguire, qualcosa di moderato, o più dettagliate e avanzate?",
      options: { simple: "Semplice", moderate: "Moderato", advanced: "Avanzato" },
    },
    preferredFormat: {
      narration:
        "Come preferisci che vengano presentate le informazioni? Elenchi puntati, paragrafi brevi, istruzioni passo-passo o un mix di tutto?",
      options: {
        bullets: "Elenchi puntati",
        paragraphs: "Paragrafi brevi",
        steps: "Passo-passo",
        mixed: "Mix",
      },
    },
    responseLength: {
      narration:
        "Quante informazioni vuoi alla volta? Risposte brevi e concise, di media lunghezza, o lunghe e dettagliate?",
      options: {
        short: "Breve e conciso",
        medium: "Medio",
        long: "Lungo e dettagliato",
      },
    },
    fontDisplay: {
      narration:
        "Rendiamo la lettura più comoda. Vorresti un carattere più grande? E preferiresti un font adatto alla dislessia?",
      options: {
        small: "Piccolo",
        medium: "Medio",
        large: "Grande",
        "x-large": "Extra grande",
      },
      dyslexiaToggle: "Font per dislessia (OpenDyslexic)",
    },
    colorTheme: {
      narration:
        "Che ne dici di colori e temi? Preferisci uno sfondo chiaro, scuro o ad alto contrasto?",
      options: {
        light: "Chiaro",
        dark: "Scuro",
        "high-contrast": "Alto contrasto",
      },
    },
    visualExtras: {
      narration:
        "Vorresti degli aiuti visivi? Puoi attivare una sovrapposizione di colore, ridurre il movimento e le animazioni, o regolare la spaziatura delle righe.",
      overlayLabel: "Sovrapposizione di colore",
      options: {
        none: "Nessuna",
        yellow: "Giallo",
        blue: "Blu",
        green: "Verde",
        pink: "Rosa",
      },
      reduceMotion: "Ridurre movimento e animazioni",
      widerSpacing: "Spaziatura righe più ampia",
    },
    voiceSpeed: {
      narration:
        "Quanto velocemente vorresti che parlassi? Sposta il cursore per impostare la velocità preferita. Lento, normale o veloce.",
      label: "Velocità della voce",
      options: { slow: "Lento", medium: "Normale", fast: "Veloce" },
    },
    preferredVoice: {
      narration:
        "Scegli una voce con cui ti senti a tuo agio. Puoi scegliere tra diverse opzioni.",
    },
    focusTimer: {
      narration:
        "Ultima domanda! Vorresti un timer di concentrazione per restare in pista? Puoi impostare quanto lavorare prima di una pausa.",
      workLabel: "Durata del lavoro (minuti)",
      breakLabel: "Promemoria pausa (minuti)",
      autoRead: "Leggi le risposte ad alta voce",
      minSuffix: "min",
    },
  },
};

// ── Portuguese ───────────────────────────────────────────────────────────────

const pt: OnboardingI18n = {
  stepOf: (c, t) => `Passo ${c} de ${t}`,
  replay: "Repetir",
  next: "Próximo",
  back: "Voltar",
  finish: "Concluir",
  skip: "Pular",
  letsGo: "Vamos!",
  doneTitle: "Tudo pronto!",
  doneSubtitle:
    "Suas preferências foram salvas. Você pode alterá-las a qualquer momento nas Configurações.",
  steps: {
    readingLevel: {
      narration:
        "Vamos começar encontrando o nível de leitura certo para você. Você prefere respostas simples e fáceis de seguir, algo moderado, ou mais detalhadas e avançadas?",
      options: { simple: "Simples", moderate: "Moderado", advanced: "Avançado" },
    },
    preferredFormat: {
      narration:
        "Como você gosta que a informação seja apresentada? Tópicos, parágrafos curtos, instruções passo a passo ou uma mistura de tudo?",
      options: {
        bullets: "Tópicos",
        paragraphs: "Parágrafos curtos",
        steps: "Passo a passo",
        mixed: "Mistura",
      },
    },
    responseLength: {
      narration:
        "Quanta informação você quer de uma vez? Respostas curtas e concisas, de tamanho médio, ou longas e detalhadas?",
      options: {
        short: "Curto e conciso",
        medium: "Médio",
        long: "Longo e detalhado",
      },
    },
    fontDisplay: {
      narration:
        "Vamos deixar a leitura mais confortável. Gostaria de um tamanho de fonte maior? E preferiria uma fonte amigável para dislexia?",
      options: {
        small: "Pequeno",
        medium: "Médio",
        large: "Grande",
        "x-large": "Extra grande",
      },
      dyslexiaToggle: "Fonte para dislexia (OpenDyslexic)",
    },
    colorTheme: {
      narration:
        "E quanto a cores e temas? Você prefere um fundo claro, escuro ou alto contraste?",
      options: {
        light: "Claro",
        dark: "Escuro",
        "high-contrast": "Alto contraste",
      },
    },
    visualExtras: {
      narration:
        "Gostaria de algum ajudante visual? Você pode ativar uma sobreposição de cor, reduzir movimento e animações, ou ajustar o espaçamento de linhas.",
      overlayLabel: "Sobreposição de cor",
      options: {
        none: "Sem sobreposição",
        yellow: "Amarelo",
        blue: "Azul",
        green: "Verde",
        pink: "Rosa",
      },
      reduceMotion: "Reduzir movimento e animações",
      widerSpacing: "Espaçamento de linhas mais amplo",
    },
    voiceSpeed: {
      narration:
        "Quão rápido gostaria que eu falasse? Mova o controle para definir sua velocidade preferida. Lento, normal ou rápido.",
      label: "Velocidade da voz",
      options: { slow: "Lento", medium: "Normal", fast: "Rápido" },
    },
    preferredVoice: {
      narration:
        "Escolha uma voz com a qual você se sinta confortável. Você pode escolher entre várias opções.",
    },
    focusTimer: {
      narration:
        "Última pergunta! Gostaria de um temporizador de foco para se manter concentrado? Você pode definir quanto tempo trabalhar antes de um lembrete de pausa.",
      workLabel: "Duração do trabalho (minutos)",
      breakLabel: "Lembrete de pausa (minutos)",
      autoRead: "Ler respostas em voz alta",
      minSuffix: "min",
    },
  },
};

// ── German ───────────────────────────────────────────────────────────────────

const de: OnboardingI18n = {
  stepOf: (c, t) => `Schritt ${c} von ${t}`,
  replay: "Wiederholen",
  next: "Weiter",
  back: "Zurück",
  finish: "Fertig",
  skip: "Überspringen",
  letsGo: "Los geht's!",
  doneTitle: "Alles bereit!",
  doneSubtitle:
    "Deine Einstellungen wurden gespeichert. Du kannst sie jederzeit in den Einstellungen ändern.",
  steps: {
    readingLevel: {
      narration:
        "Beginnen wir damit, das richtige Leseniveau für dich zu finden. Möchtest du Antworten, die einfach und leicht verständlich sind, etwas Mittleres, oder detaillierter und fortgeschrittener?",
      options: { simple: "Einfach", moderate: "Mittel", advanced: "Fortgeschritten" },
    },
    preferredFormat: {
      narration:
        "Wie möchtest du Informationen dargestellt bekommen? Aufzählungspunkte, kurze Absätze, Schritt-für-Schritt-Anleitungen oder eine Mischung aus allem?",
      options: {
        bullets: "Aufzählungspunkte",
        paragraphs: "Kurze Absätze",
        steps: "Schritt für Schritt",
        mixed: "Mischung",
      },
    },
    responseLength: {
      narration:
        "Wie viel Information möchtest du auf einmal? Kurze und knappe Antworten, mittellange Antworten oder lange und ausführliche Erklärungen?",
      options: {
        short: "Kurz & knapp",
        medium: "Mittel",
        long: "Lang & ausführlich",
      },
    },
    fontDisplay: {
      narration:
        "Machen wir das Lesen bequemer. Möchtest du eine größere Schriftgröße? Und bevorzugst du eine legastheniefreundliche Schrift?",
      options: {
        small: "Klein",
        medium: "Mittel",
        large: "Groß",
        "x-large": "Extra groß",
      },
      dyslexiaToggle: "Legasthenie-Schrift (OpenDyslexic)",
    },
    colorTheme: {
      narration:
        "Wie sieht es mit Farben und Themen aus? Möchtest du einen hellen Hintergrund, einen dunklen Hintergrund oder hohen Kontrast?",
      options: {
        light: "Hell",
        dark: "Dunkel",
        "high-contrast": "Hoher Kontrast",
      },
    },
    visualExtras: {
      narration:
        "Möchtest du visuelle Hilfen? Du kannst eine Farbüberlagerung einschalten, Bewegung und Animationen reduzieren oder den Zeilenabstand anpassen.",
      overlayLabel: "Farbüberlagerung",
      options: {
        none: "Keine",
        yellow: "Gelb",
        blue: "Blau",
        green: "Grün",
        pink: "Rosa",
      },
      reduceMotion: "Bewegung & Animationen reduzieren",
      widerSpacing: "Größerer Zeilenabstand",
    },
    voiceSpeed: {
      narration:
        "Wie schnell soll ich sprechen? Stelle den Schieberegler auf deine bevorzugte Geschwindigkeit ein. Langsam, normal oder schnell.",
      label: "Sprechgeschwindigkeit",
      options: { slow: "Langsam", medium: "Normal", fast: "Schnell" },
    },
    preferredVoice: {
      narration:
        "Wähle eine Stimme, mit der du dich wohlfühlst. Du kannst aus verschiedenen Optionen wählen.",
    },
    focusTimer: {
      narration:
        "Letzte Frage! Möchtest du einen Fokus-Timer, um konzentriert zu bleiben? Du kannst einstellen, wie lange du arbeiten möchtest, bevor eine sanfte Pausenerinnerung kommt.",
      workLabel: "Arbeitsdauer (Minuten)",
      breakLabel: "Pausenerinnerung (Minuten)",
      autoRead: "Antworten laut vorlesen",
      minSuffix: "Min.",
    },
  },
};

// ── Japanese ─────────────────────────────────────────────────────────────────

const ja: OnboardingI18n = {
  stepOf: (c, t) => `ステップ ${c} / ${t}`,
  replay: "もう一度",
  next: "次へ",
  back: "戻る",
  finish: "完了",
  skip: "スキップ",
  letsGo: "はじめましょう！",
  doneTitle: "準備完了！",
  doneSubtitle:
    "設定が保存されました。いつでも設定画面から変更できます。",
  steps: {
    readingLevel: {
      narration:
        "あなたに合った読みやすさのレベルを見つけましょう。シンプルでわかりやすい回答、バランスの取れた回答、それとも詳しく高度な回答のどれがいいですか？",
      options: { simple: "シンプル", moderate: "バランス", advanced: "詳しい" },
    },
    preferredFormat: {
      narration:
        "情報をどのように表示してほしいですか？箇条書き、短い段落、ステップバイステップの手順、またはすべてのミックスのどれがいいですか？",
      options: {
        bullets: "箇条書き",
        paragraphs: "短い段落",
        steps: "ステップバイステップ",
        mixed: "ミックス",
      },
    },
    responseLength: {
      narration:
        "一度にどのくらいの情報がほしいですか？短く簡潔な回答、中程度の長さ、それとも長く詳しい説明のどれがいいですか？",
      options: {
        short: "短く簡潔",
        medium: "中程度",
        long: "長く詳しい",
      },
    },
    fontDisplay: {
      narration:
        "読みやすくしましょう。フォントサイズを大きくしますか？ディスレクシア対応のフォントを使いますか？",
      options: {
        small: "小",
        medium: "中",
        large: "大",
        "x-large": "特大",
      },
      dyslexiaToggle: "ディスレクシア対応フォント (OpenDyslexic)",
    },
    colorTheme: {
      narration:
        "色とテーマはどうしますか？明るい背景、暗い背景、それともハイコントラストのどれがいいですか？",
      options: {
        light: "ライト",
        dark: "ダーク",
        "high-contrast": "ハイコントラスト",
      },
    },
    visualExtras: {
      narration:
        "視覚的なヘルパーはいりますか？カラーオーバーレイ、モーションとアニメーションの削減、行間隔の調整ができます。",
      overlayLabel: "カラーオーバーレイ",
      options: {
        none: "なし",
        yellow: "黄色",
        blue: "青",
        green: "緑",
        pink: "ピンク",
      },
      reduceMotion: "モーション・アニメーションを減らす",
      widerSpacing: "行間隔を広くする",
    },
    voiceSpeed: {
      narration:
        "どのくらいの速さで話してほしいですか？スライダーを動かして好みの速さを設定してください。ゆっくり、普通、速いの中から選べます。",
      label: "話す速さ",
      options: { slow: "ゆっくり", medium: "普通", fast: "速い" },
    },
    preferredVoice: {
      narration:
        "心地よい声を選んでください。いくつかの選択肢から選べます。",
    },
    focusTimer: {
      narration:
        "最後の質問です！集中タイマーを使いますか？休憩のリマインダーまでの作業時間を設定できます。",
      workLabel: "作業時間（分）",
      breakLabel: "休憩リマインダー（分）",
      autoRead: "回答を自動で読み上げ",
      minSuffix: "分",
    },
  },
};

// ── Lookup ───────────────────────────────────────────────────────────────────

const translations: Record<string, OnboardingI18n> = { en, es, it, pt, de, ja };

export function getI18n(lang: string): OnboardingI18n {
  return translations[lang] || translations.en;
}

// TTS voice per language (for narration synthesis)
export const LANG_VOICES: Record<string, string> = {
  en: "en-US-JennyNeural",
  es: "es-ES-ElviraNeural",
  it: "it-IT-ElsaNeural",
  pt: "pt-BR-FranciscaNeural",
  de: "de-DE-KatjaNeural",
  ja: "ja-JP-NanamiNeural",
};
