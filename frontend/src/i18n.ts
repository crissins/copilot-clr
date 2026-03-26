/**
 * App-wide UI translations for all 6 supported languages.
 * Covers sidebar, chat, header, file-upload, settings, and common actions.
 */

export interface AppI18n {
  // Header
  appTitle: string;
  switchToLight: string;
  switchToDark: string;
  accessibilityPrefs: string;
  signOut: string;

  // Sidebar nav
  nav: {
    chat: string;
    documentUpload: string;
    simplifyContent: string;
    remindersFocus: string;
    mediaProcessing: string;
    taskDecomposer: string;
    accessibilityHub: string;
    speechAssistant: string;
    feedback: string;
    settings: string;
    collapseNav: string;
    expandNav: string;
  };

  // Chat
  chat: {
    newChat: string;
    previousChats: string;
    welcomeTitle: string;
    welcomeBody: string;
    placeholder: string;
    send: string;
    errorGeneric: string;
    loadingSessions: string;
    noSessions: string;
    deleteSession: string;
  };

  // File upload
  upload: {
    label: string;
    uploading: string;
    uploadedStatus: (name: string, chunks: number) => string;
    errorGeneric: string;
  };

  // Document library
  docs: {
    title: string;
    refresh: string;
    loading: string;
    empty: string;
    chunks: string;
  };

  // Feedback
  feedback: {
    title: string;
    subtitle: string;
    rateExperience: string;
    category: string;
    placeholder: string;
    submit: string;
    submitting: string;
    thankYou: string;
    history: string;
    loading: string;
    noFeedback: string;
    categories: {
      general: string;
      accessibility: string;
      performance: string;
      feature_request: string;
      bug: string;
    };
  };

  // Common
  skip: string;
  cancel: string;
  save: string;
  close: string;
}

// ── English ─────────────────────────────────────────────────────────────

const en: AppI18n = {
  appTitle: "Copilot CLR",
  switchToLight: "Switch to light mode",
  switchToDark: "Switch to dark mode",
  accessibilityPrefs: "Accessibility preferences",
  signOut: "Sign out",
  nav: {
    chat: "Chat",
    documentUpload: "Document Upload",
    simplifyContent: "Simplify Content",
    remindersFocus: "Reminders & Focus",
    mediaProcessing: "Media Processing",
    taskDecomposer: "Task Decomposer",
    accessibilityHub: "Accessibility Hub",
    speechAssistant: "Speech Assistant",
    feedback: "Feedback",
    settings: "Settings",
    collapseNav: "Collapse navigation",
    expandNav: "Expand navigation",
  },
  chat: {
    newChat: "New Chat",
    previousChats: "Previous Chats",
    welcomeTitle: "Welcome to Copilot CLR",
    welcomeBody:
      "I help reduce cognitive load by breaking down complex tasks, simplifying documents, and adapting to your accessibility preferences. Try asking me to simplify something, or upload a document to chat with it.",
    placeholder: "Type a message… (Enter to send, Shift+Enter for new line)",
    send: "Send message",
    errorGeneric: "Something went wrong. Please try again in a moment.",
    loadingSessions: "Loading…",
    noSessions: "No previous chats",
    deleteSession: "Delete chat",
  },
  upload: {
    label: "📄 Upload Document",
    uploading: "Uploading...",
    uploadedStatus: (name, chunks) => `Uploaded: ${name} (${chunks} chunks)`,
    errorGeneric: "Upload failed. Please check file type and size (max 100 MB).",
  },
  docs: {
    title: "Document Library",
    refresh: "Refresh",
    loading: "Loading documents…",
    empty: "No documents uploaded yet. Upload a file to get started.",
    chunks: "chunks",
  },
  feedback: {
    title: "Feedback",
    subtitle: "Help us improve your experience.",
    rateExperience: "Rate your experience",
    category: "Category",
    placeholder: "Share your thoughts, suggestions, or report an issue…",
    submit: "Submit Feedback",
    submitting: "Submitting…",
    thankYou: "Thank you for your feedback!",
    history: "Previous Feedback",
    loading: "Loading…",
    noFeedback: "No feedback submitted yet.",
    categories: {
      general: "General",
      accessibility: "Accessibility",
      performance: "Performance",
      feature_request: "Feature Request",
      bug: "Bug Report",
    },
  },
  skip: "Skip",
  cancel: "Cancel",
  save: "Save",
  close: "Close",
};

// ── Spanish ─────────────────────────────────────────────────────────────

const es: AppI18n = {
  appTitle: "Copilot CLR",
  switchToLight: "Cambiar a modo claro",
  switchToDark: "Cambiar a modo oscuro",
  accessibilityPrefs: "Preferencias de accesibilidad",
  signOut: "Cerrar sesión",
  nav: {
    chat: "Chat",
    documentUpload: "Subir documento",
    simplifyContent: "Simplificar contenido",
    remindersFocus: "Recordatorios y enfoque",
    mediaProcessing: "Procesamiento de medios",
    taskDecomposer: "Descomponer tareas",
    accessibilityHub: "Centro de accesibilidad",
    speechAssistant: "Asistente de voz",
    feedback: "Comentarios",
    settings: "Configuración",
    collapseNav: "Contraer navegación",
    expandNav: "Expandir navegación",
  },
  chat: {
    newChat: "Nuevo chat",
    previousChats: "Chats anteriores",
    welcomeTitle: "Bienvenido a Copilot CLR",
    welcomeBody:
      "Te ayudo a reducir la carga cognitiva desglosando tareas complejas, simplificando documentos y adaptándome a tus preferencias de accesibilidad. Prueba pedirme que simplifique algo, o sube un documento para chatear con él.",
    placeholder: "Escribe un mensaje… (Enter para enviar, Shift+Enter nueva línea)",
    send: "Enviar mensaje",
    errorGeneric: "Algo salió mal. Inténtalo de nuevo en un momento.",
    loadingSessions: "Cargando…",
    noSessions: "No hay chats anteriores",
    deleteSession: "Eliminar chat",
  },
  upload: {
    label: "📄 Subir documento",
    uploading: "Subiendo...",
    uploadedStatus: (name, chunks) => `Subido: ${name} (${chunks} partes)`,
    errorGeneric: "Error al subir. Verifica el tipo y tamaño del archivo (máx. 100 MB).",
  },
  docs: {
    title: "Biblioteca de documentos",
    refresh: "Actualizar",
    loading: "Cargando documentos…",
    empty: "Aún no hay documentos subidos. Sube un archivo para empezar.",
    chunks: "partes",
  },
  feedback: {
    title: "Comentarios",
    subtitle: "Ayúdanos a mejorar tu experiencia.",
    rateExperience: "Califica tu experiencia",
    category: "Categoría",
    placeholder: "Comparte tus ideas, sugerencias o reporta un problema…",
    submit: "Enviar comentario",
    submitting: "Enviando…",
    thankYou: "¡Gracias por tu comentario!",
    history: "Comentarios anteriores",
    loading: "Cargando…",
    noFeedback: "Aún no has enviado comentarios.",
    categories: {
      general: "General",
      accessibility: "Accesibilidad",
      performance: "Rendimiento",
      feature_request: "Solicitud de función",
      bug: "Reporte de error",
    },
  },
  skip: "Omitir",
  cancel: "Cancelar",
  save: "Guardar",
  close: "Cerrar",
};

// ── Italian ─────────────────────────────────────────────────────────────

const it: AppI18n = {
  appTitle: "Copilot CLR",
  switchToLight: "Passa alla modalità chiara",
  switchToDark: "Passa alla modalità scura",
  accessibilityPrefs: "Preferenze di accessibilità",
  signOut: "Esci",
  nav: {
    chat: "Chat",
    documentUpload: "Carica documento",
    simplifyContent: "Semplifica contenuto",
    remindersFocus: "Promemoria e concentrazione",
    mediaProcessing: "Elaborazione media",
    taskDecomposer: "Scomponi attività",
    accessibilityHub: "Centro accessibilità",
    speechAssistant: "Assistente vocale",
    feedback: "Feedback",
    settings: "Impostazioni",
    collapseNav: "Comprimi navigazione",
    expandNav: "Espandi navigazione",
  },
  chat: {
    newChat: "Nuova chat",
    previousChats: "Chat precedenti",
    welcomeTitle: "Benvenuto su Copilot CLR",
    welcomeBody:
      "Ti aiuto a ridurre il carico cognitivo scomponendo compiti complessi, semplificando documenti e adattandomi alle tue preferenze di accessibilità. Prova a chiedermi di semplificare qualcosa, o carica un documento per chattare con esso.",
    placeholder: "Scrivi un messaggio… (Invio per inviare, Shift+Invio nuova riga)",
    send: "Invia messaggio",
    errorGeneric: "Qualcosa è andato storto. Riprova tra un momento.",
    loadingSessions: "Caricamento…",
    noSessions: "Nessuna chat precedente",
    deleteSession: "Elimina chat",
  },
  upload: {
    label: "📄 Carica documento",
    uploading: "Caricamento...",
    uploadedStatus: (name, chunks) => `Caricato: ${name} (${chunks} parti)`,
    errorGeneric: "Caricamento fallito. Controlla tipo e dimensione (max 100 MB).",
  },
  docs: {
    title: "Libreria documenti",
    refresh: "Aggiorna",
    loading: "Caricamento documenti…",
    empty: "Nessun documento caricato. Carica un file per iniziare.",
    chunks: "parti",
  },
  feedback: {
    title: "Feedback",
    subtitle: "Aiutaci a migliorare la tua esperienza.",
    rateExperience: "Valuta la tua esperienza",
    category: "Categoria",
    placeholder: "Condividi pensieri, suggerimenti o segnala un problema…",
    submit: "Invia feedback",
    submitting: "Invio…",
    thankYou: "Grazie per il tuo feedback!",
    history: "Feedback precedenti",
    loading: "Caricamento…",
    noFeedback: "Nessun feedback inviato.",
    categories: {
      general: "Generale",
      accessibility: "Accessibilità",
      performance: "Prestazioni",
      feature_request: "Richiesta funzionalità",
      bug: "Segnalazione bug",
    },
  },
  skip: "Salta",
  cancel: "Annulla",
  save: "Salva",
  close: "Chiudi",
};

// ── Portuguese ──────────────────────────────────────────────────────────

const pt: AppI18n = {
  appTitle: "Copilot CLR",
  switchToLight: "Mudar para modo claro",
  switchToDark: "Mudar para modo escuro",
  accessibilityPrefs: "Preferências de acessibilidade",
  signOut: "Sair",
  nav: {
    chat: "Chat",
    documentUpload: "Enviar documento",
    simplifyContent: "Simplificar conteúdo",
    remindersFocus: "Lembretes e foco",
    mediaProcessing: "Processamento de mídia",
    taskDecomposer: "Decompor tarefas",
    accessibilityHub: "Centro de acessibilidade",
    speechAssistant: "Assistente de voz",
    feedback: "Feedback",
    settings: "Configurações",
    collapseNav: "Recolher navegação",
    expandNav: "Expandir navegação",
  },
  chat: {
    newChat: "Novo chat",
    previousChats: "Chats anteriores",
    welcomeTitle: "Bem-vindo ao Copilot CLR",
    welcomeBody:
      "Eu ajudo a reduzir a carga cognitiva decompondo tarefas complexas, simplificando documentos e adaptando-me às suas preferências de acessibilidade. Experimente pedir para simplificar algo, ou envie um documento para conversar sobre ele.",
    placeholder: "Digite uma mensagem… (Enter para enviar, Shift+Enter nova linha)",
    send: "Enviar mensagem",
    errorGeneric: "Algo deu errado. Tente novamente em instantes.",
    loadingSessions: "Carregando…",
    noSessions: "Nenhum chat anterior",
    deleteSession: "Excluir chat",
  },
  upload: {
    label: "📄 Enviar documento",
    uploading: "Enviando...",
    uploadedStatus: (name, chunks) => `Enviado: ${name} (${chunks} partes)`,
    errorGeneric: "Falha no envio. Verifique o tipo e tamanho do arquivo (máx. 100 MB).",
  },
  docs: {
    title: "Biblioteca de documentos",
    refresh: "Atualizar",
    loading: "Carregando documentos…",
    empty: "Nenhum documento enviado ainda. Envie um arquivo para começar.",
    chunks: "partes",
  },
  feedback: {
    title: "Feedback",
    subtitle: "Ajude-nos a melhorar sua experiência.",
    rateExperience: "Avalie sua experiência",
    category: "Categoria",
    placeholder: "Compartilhe suas ideias, sugestões ou reporte um problema…",
    submit: "Enviar feedback",
    submitting: "Enviando…",
    thankYou: "Obrigado pelo seu feedback!",
    history: "Feedback anteriores",
    loading: "Carregando…",
    noFeedback: "Nenhum feedback enviado ainda.",
    categories: {
      general: "Geral",
      accessibility: "Acessibilidade",
      performance: "Desempenho",
      feature_request: "Solicitação de funcionalidade",
      bug: "Relatório de bug",
    },
  },
  skip: "Pular",
  cancel: "Cancelar",
  save: "Salvar",
  close: "Fechar",
};

// ── German ──────────────────────────────────────────────────────────────

const de: AppI18n = {
  appTitle: "Copilot CLR",
  switchToLight: "Zum hellen Modus wechseln",
  switchToDark: "Zum dunklen Modus wechseln",
  accessibilityPrefs: "Barrierefreiheits-Einstellungen",
  signOut: "Abmelden",
  nav: {
    chat: "Chat",
    documentUpload: "Dokument hochladen",
    simplifyContent: "Inhalt vereinfachen",
    remindersFocus: "Erinnerungen & Fokus",
    mediaProcessing: "Medienverarbeitung",
    taskDecomposer: "Aufgaben aufteilen",
    accessibilityHub: "Barrierefreiheits-Center",
    speechAssistant: "Sprachassistent",
    feedback: "Feedback",
    settings: "Einstellungen",
    collapseNav: "Navigation einklappen",
    expandNav: "Navigation ausklappen",
  },
  chat: {
    newChat: "Neuer Chat",
    previousChats: "Vorherige Chats",
    welcomeTitle: "Willkommen bei Copilot CLR",
    welcomeBody:
      "Ich helfe dir, die kognitive Belastung zu reduzieren, indem ich komplexe Aufgaben aufschlüssele, Dokumente vereinfache und mich an deine Barrierefreiheits-Einstellungen anpasse. Probiere es aus – bitte mich, etwas zu vereinfachen, oder lade ein Dokument hoch.",
    placeholder: "Nachricht eingeben… (Enter zum Senden, Shift+Enter neue Zeile)",
    send: "Nachricht senden",
    errorGeneric: "Etwas ist schiefgelaufen. Bitte versuche es gleich noch einmal.",
    loadingSessions: "Laden…",
    noSessions: "Keine vorherigen Chats",
    deleteSession: "Chat löschen",
  },
  upload: {
    label: "📄 Dokument hochladen",
    uploading: "Hochladen...",
    uploadedStatus: (name, chunks) => `Hochgeladen: ${name} (${chunks} Teile)`,
    errorGeneric: "Hochladen fehlgeschlagen. Typ und Größe prüfen (max. 100 MB).",
  },
  docs: {
    title: "Dokumentenbibliothek",
    refresh: "Aktualisieren",
    loading: "Dokumente laden…",
    empty: "Noch keine Dokumente hochgeladen. Laden Sie eine Datei hoch.",
    chunks: "Teile",
  },
  feedback: {
    title: "Feedback",
    subtitle: "Helfen Sie uns, Ihre Erfahrung zu verbessern.",
    rateExperience: "Bewerten Sie Ihre Erfahrung",
    category: "Kategorie",
    placeholder: "Teilen Sie Gedanken, Vorschläge oder melden Sie ein Problem…",
    submit: "Feedback senden",
    submitting: "Wird gesendet…",
    thankYou: "Vielen Dank für Ihr Feedback!",
    history: "Bisheriges Feedback",
    loading: "Laden…",
    noFeedback: "Noch kein Feedback abgegeben.",
    categories: {
      general: "Allgemein",
      accessibility: "Barrierefreiheit",
      performance: "Leistung",
      feature_request: "Funktionswunsch",
      bug: "Fehlerbericht",
    },
  },
  skip: "Überspringen",
  cancel: "Abbrechen",
  save: "Speichern",
  close: "Schließen",
};

// ── Japanese ────────────────────────────────────────────────────────────

const ja: AppI18n = {
  appTitle: "Copilot CLR",
  switchToLight: "ライトモードに切り替え",
  switchToDark: "ダークモードに切り替え",
  accessibilityPrefs: "アクセシビリティ設定",
  signOut: "サインアウト",
  nav: {
    chat: "チャット",
    documentUpload: "ドキュメントのアップロード",
    simplifyContent: "コンテンツを簡略化",
    remindersFocus: "リマインダーと集中",
    mediaProcessing: "メディア処理",
    taskDecomposer: "タスク分割",
    accessibilityHub: "アクセシビリティ ハブ",
    speechAssistant: "音声アシスタント",
    feedback: "フィードバック",
    settings: "設定",
    collapseNav: "ナビゲーションを折りたたむ",
    expandNav: "ナビゲーションを展開",
  },
  chat: {
    newChat: "新しいチャット",
    previousChats: "以前のチャット",
    welcomeTitle: "Copilot CLR へようこそ",
    welcomeBody:
      "複雑なタスクの分解、ドキュメントの簡略化、アクセシビリティの設定に合わせて、認知的負荷を軽減するお手伝いをします。何かを簡略化するよう聞いてみるか、ドキュメントをアップロードしてチャットしてみてください。",
    placeholder: "メッセージを入力…（Enterで送信、Shift+Enterで改行）",
    send: "メッセージを送信",
    errorGeneric: "問題が発生しました。しばらくしてからもう一度お試しください。",
    loadingSessions: "読み込み中…",
    noSessions: "以前のチャットはありません",
    deleteSession: "チャットを削除",
  },
  upload: {
    label: "📄 ドキュメントをアップロード",
    uploading: "アップロード中...",
    uploadedStatus: (name, chunks) => `アップロード完了: ${name}（${chunks} チャンク）`,
    errorGeneric: "アップロード失敗。ファイルの種類とサイズを確認してください（最大100 MB）。",
  },
  docs: {
    title: "ドキュメント ライブラリ",
    refresh: "更新",
    loading: "ドキュメントを読み込み中…",
    empty: "まだドキュメントがアップロードされていません。ファイルをアップロードしてください。",
    chunks: "チャンク",
  },
  feedback: {
    title: "フィードバック",
    subtitle: "体験の改善にご協力ください。",
    rateExperience: "体験を評価してください",
    category: "カテゴリ",
    placeholder: "ご意見、ご提案、問題の報告をお寄せください…",
    submit: "フィードバックを送信",
    submitting: "送信中…",
    thankYou: "フィードバックありがとうございます！",
    history: "過去のフィードバック",
    loading: "読み込み中…",
    noFeedback: "まだフィードバックはありません。",
    categories: {
      general: "一般",
      accessibility: "アクセシビリティ",
      performance: "パフォーマンス",
      feature_request: "機能リクエスト",
      bug: "バグ報告",
    },
  },
  skip: "スキップ",
  cancel: "キャンセル",
  save: "保存",
  close: "閉じる",
};

// ── Lookup ──────────────────────────────────────────────────────────────

const translations: Record<string, AppI18n> = { en, es, it, pt, de, ja };

export function getAppI18n(lang: string): AppI18n {
  return translations[lang] || translations.en;
}
