🏛️ Diagrama Arquitectónico CLRA Completo
El diagrama que ves arriba muestra la arquitectura completa de CLRA con todas las capas que hemos diseñado:

5 CAPAS PRINCIPALES
1. 🎨 Presentación - Frontend (React + TypeScript + Fluent UI)

SimplifyView: Formulario para simplificar documentos
DecomposeView: Descomposición de tareas en pasos
SettingsView: Configuración de preferencias
Auth/Profile: Gestión de usuario y perfil
Stack: Zustand Store + Axios API Client + Fluent UI Components

2. 🐍 Backend - FastAPI + Python

Auth Routes: Autenticación JWT
Simplify API: Endpoint POST /simplify
Decompose API: Endpoint POST /decompose
User Profile: Gestión de preferencias
Focus Timer: Temporizadores Pomodoro
Servicios: OpenAI, Cosmos DB, Key Vault, Logging

3. 🧠 Azure AI Services + IA Responsable

Azure OpenAI: Agente principal de IA (simplificación, descomposición)
Text Analytics: Análisis y extracción de entidades
Language Services: Comprensión del contexto
Prompts Library: Librería centralizada de prompts
IA Responsable: Lenguaje empático, sin sesgos, guardrails, explicabilidad

4. 💾 Data & Storage Layer

Cosmos DB: Perfiles de usuarios, preferencias, operaciones
Blob Storage: Documentos uploadados
Key Vault: Secretos y credenciales
App Insights: Logs y métricas

5. 🏗️ Infrastructure as Code - Bicep

App Service Plan: Hosting del backend
Resource Group: Organización de recursos
Networking: VNet, subnets (opcional)
Monitoring: Application Insights


📊 Dos Casos de Uso Principales
Caso 1: Simplificación de Documentos 📄

Usuario sube documento en React Fluent UI
FastAPI recibe en /api/simplify
OpenAI simplifica según preferencias
Resultado guardado en Cosmos DB
Frontend muestra resultado con explicación

Caso 2: Descomposición de Tareas ⚙️

Usuario describe tarea en DecomposeView
Text Analytics analiza complejidad
OpenAI genera pasos claros con tiempos
Timers y recordatorios contextuales
Historial guardado para referencia


🎯 Servicios Azure Implementados ✅
ServicioFunciónEn DiagramaAzure OpenAIIA principal para simplificación/descomposiciónCapa 3Cosmos DBBase de datos para usuarios y operacionesCapa 4Blob StorageAlmacenamiento de documentosCapa 4Key VaultGestión segura de secretosCapa 4App ServiceHosting backend Python FastAPICapa 5App InsightsMonitoreo y logsCapa 4/5Text AnalyticsAnálisis de sentimiento y entidadesCapa 3Cognitive ServicesProcesamiento de lenguaje naturalCapa 3Bicep (IaC)Automatización de infraestructuraCapa 5

💡 Flujo Completo de Datos
Usuario (Navegador)
    ↓
React + Fluent UI (Frontend)
    ↓
Zustand Store + Axios
    ↓
FastAPI Backend (Python)
    ↓
Azure OpenAI + Text Analytics + Cognitive Services
    ↓
IA Responsable (Prompts Library + Guardrails)
    ↓
Cosmos DB + Blob Storage (Datos)
    ↓
Key Vault (Secretos)
    ↓
App Insights (Monitoreo)
    ↓
Resultado al Usuario
