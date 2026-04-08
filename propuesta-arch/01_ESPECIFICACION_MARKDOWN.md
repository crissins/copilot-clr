# COGNITIVE LOAD REDUCTION ASSISTANT - ESPECIFICACIÓN DEL PROYECTO

## SECCIÓN 1: VISIÓN DEL PROYECTO

### Nombre del Proyecto
Cognitive Load Reduction Assistant (CLRA)

### Desafío
Adaptive agent system that simplifies work and learning for neurodiverse users

### Período
Hackathon Innovation Challenge (Marzo 2026)

### VISIÓN
Crear un asistente de IA inteligente y empático que reduzca significativamente la sobrecarga cognitiva para personas neurodiversas (TDAH, autismo, dislexia) mediante la simplificación adaptativa de información, descomposición de tareas y apoyo personalizado para la concentración.

### IMPACTO
- Mejora de productividad y bienestar para usuarios neurodiversos
- Accesibilidad inclusiva en espacios de trabajo y educación
- Modelo escalable de IA responsable y empática

---

## SECCIÓN 2: REQUISITOS DEL PROYECTO

### REQUISITOS FUNCIONALES PRINCIPALES

#### 1. DESCOMPOSICIÓN DE TAREAS
- Convertir instrucciones complejas en pasos claros
- Asignar límites de tiempo realistas a cada paso
- Ofrecer recordatorios contextuales
- Permitir "mini breaks" entre tareas

#### 2. SIMPLIFICACIÓN DE DOCUMENTOS
- Analizar documentos complejos
- Generar resúmenes en múltiples niveles de lectura
- Extraer información clave
- Reformatear con estructura visual clara

#### 3. APOYO PARA LA CONCENTRACIÓN
- Temporizadores adaptables (Pomodoro, etc.)
- Bloqueo de distracciones
- Recordatorios suaves y no invasivos
- Indicadores de progreso visual

#### 4. PERFIL PERSONALIZADO DEL USUARIO
- Almacenar preferencias de accesibilidad
- Adaptar presentación de información
- Recordar configuraciones entre sesiones
- Actualizar preferencias de forma segura

#### 5. SEGURIDAD & IA RESPONSABLE
- Lenguaje calmado, empático, que no genere ansiedad
- Explicación de decisiones de simplificación
- Protección de datos sensibles
- Sin sesgos discriminatorios
- Control total del usuario sobre sus datos

### REQUISITOS NO FUNCIONALES
- **Rendimiento:** Respuesta < 2 segundos para la mayoría de operaciones
- **Escalabilidad:** Preparado para múltiples usuarios simultáneos
- **Seguridad:** Datos encriptados en tránsito y reposo
- **Observabilidad:** Logs y métricas para monitoreo

---

## SECCIÓN 3: ARQUITECTURA DE SOLUCIÓN

### STACK TECNOLÓGICO - SERVICIOS AZURE

```
┌─────────────────────────────────────────────────────────────┐
│           CAPA DE PRESENTACIÓN                              │
│  Frontend: React/Web App - Interfaz limpia y accesible      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│           CAPA DE ORQUESTACIÓN                              │
│  Azure App Service: Backend API (Node.js/Python)            │
│  Azure Functions: Procesamiento asincrónico                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│           CAPA DE IA & LÓGICA                               │
│  Azure OpenAI: Agente adaptativo + LLM principal            │
│  Azure Cognitive Services:                                  │
│    - Text Analytics: Extracción de entidades, sentimiento    │
│    - Language Understanding: Comprensión del contexto        │
│    - Content Moderator: Validación de lenguaje              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│           CAPA DE DATOS & SEGURIDAD                         │
│  Azure Cosmos DB: Perfiles de usuario, preferencias          │
│  Azure Key Vault: Gestión de secretos y credenciales         │
│  Azure Blob Storage: Documentos y archivos procesados        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│           CAPA DE OBSERVABILIDAD                            │
│  Azure Monitor: Métricas del sistema                         │
│  Application Insights: Rendimiento y errores                 │
│  Logging: Auditoría de acciones sensibles                   │
└─────────────────────────────────────────────────────────────┘
```

### FLUJO PRINCIPAL DE USUARIO

#### 1. AUTENTICACIÓN SEGURA
```
Usuario inicia sesión → Validación en Azure AD → Token JWT
```

#### 2. CARGA DE PREFERENCIAS
```
Recuperar perfil de Cosmos DB → Aplicar configuraciones
(Tamaño fuente, contraste, velocidad de lectura, etc.)
```

#### 3. INGESTA DE CONTENIDO
```
Usuario sube tarea/documento → Se almacena en Blob Storage
```

#### 4. PROCESAMIENTO CON IA

**RAMA A - Simplificación de documento:**
- Text Analytics extrae elementos clave
- OpenAI genera resumen adaptado
- Reformatea con estructura clara

**RAMA B - Descomposición de tareas:**
- OpenAI analiza complejidad
- Divide en pasos claros
- Asigna tiempos estimados

**RAMA C - Soporte de concentración:**
- Configura temporizadores
- Genera recordatorios contextuales

#### 5. ENTREGA & ALMACENAMIENTO
```
Presentar resultado → Almacenar en DB → Registrar métrica
```

---

## SECCIÓN 4: MATRIZ DE RESPONSABILIDADES DEL EQUIPO

### ROL 1: ARQUITECTO TÉCNICO
**Responsabilidades:**
- Diseñar arquitectura Azure
- Configurar servicios y conexiones
- Implementar seguridad y IA responsable
- Responsable: [Nombre]

### ROL 2: DESARROLLADOR BACKEND
**Responsabilidades:**
- Implementar Azure App Service & Functions
- Integrar Azure OpenAI API
- Crear lógica de procesamiento
- Responsable: [Nombre]

### ROL 3: DESARROLLADOR FRONTEND
**Responsabilidades:**
- Crear interfaz accesible y limpia
- Implementar UX/Accessibility standards
- Integración con API
- Responsable: [Nombre]

### ROL 4: ESPECIALISTA EN IA RESPONSABLE
**Responsabilidades:**
- Validar prompts y respuestas
- Implementar guardias de seguridad
- Documentar políticas de IA ética
- Responsable: [Nombre]

### ROL 5: LÍDER DE PROYECTO / QA
**Responsabilidades:**
- Coordinar equipo
- Testing integral
- Preparar video y presentación
- Responsable: [Nombre]

---

## SECCIÓN 5: PLAN DE IMPLEMENTACIÓN (HITOS)

### SEMANA 1 - SETUP (Día 1-2)
BACKEND:
- Setup Express/FastAPI + TypeScript/Python template
- Estructura de carpetas
- Testing framework
- Endpoint /health (GET)
- Endpoint /login (POST) con JWT básico
- **Entregable:** Backend corriendo en localhost:3000

FRONTEND:
- Setup React + Tailwind + TypeScript
- Layout base (Header, Sidebar, Main)
- Página de login estática
- Setup Axios para HTTP calls
- **Entregable:** Frontend corriendo en localhost:3001

TECH LEAD:
- Crear suscripción Azure (o acceso a la existente)
- Provisionar recursos: App Service, Cosmos DB, OpenAI, Key Vault
- Crear repositorio GitHub privado
- Escribir README inicial
- **Entregable:** Azure resources listos, repo con estructura base

IA RESPONSIBLE:
- Leer documentación sobre lenguaje empático
- Crear primer set de prompts base
- Documentar "tone & voice" guidelines
- Crear 5 test cases de validación

### SEMANA 1 - MVP INICIAL (Día 3-5)
BACKEND:
- Integración con Azure OpenAI API
- Test simple: "Simplificar este documento"
- Endpoint POST /simplify (recibe texto, devuelve resumen)
- Implementar logging
- Documentar API en Swagger/OpenAPI
- **Entregable:** Endpoint funcional de simplificación

FRONTEND:
- Página de login funcional
- Dashboard con área de ingesta de texto
- Formulario para "Simplificar documento"
- Mostrar resultados
- Loading indicators
- **Entregable:** MVP frontend funcional

TECH LEAD:
- Configurar GitHub Actions pipeline
- Crear secrets en Key Vault
- Deploy de rama 'main' a Azure App Service
- Crear documentation de deployment

IA RESPONSIBLE:
- Revisar respuestas del LLM
- Refinar prompts para que sean más empáticos
- Documentar casos de éxito
- Crear validador de "no-anxious-language"

### SEMANA 2 - EXPANSIÓN A CASO 2 (Día 6-7)
BACKEND:
- Endpoint POST /decompose
- Recibe descripción de tarea → devuelve pasos + tiempos
- Integrar con Cognitive Services (Text Analytics)
- Validación de inputs
- Error handling mejorado

FRONTEND:
- Tab/Sección para "Descomponer Tareas"
- Formulario para descripción de tarea
- Visualización de resultados
- Timeline visual con duraciones
- Agregar feature de "guardias" (recordatorios)

TECH LEAD:
- Setup Cosmos DB (crear colecciones)
- Implementar queries básicas
- Configurar Connection Strings en Key Vault
- Performance testing

### SEMANA 2 - PERSONALIZACIÓN & PULIDO (Día 8+)
BACKEND:
- Endpoint GET/POST /user/profile
- Almacenar preferencias en Cosmos DB
- Aplicar preferencias en respuestas futuras

FRONTEND:
- Página de Configuración/Perfil
- Controles para personalización
- Preview en tiempo real
- Guardar preferencias

TECH LEAD:
- Implementar autenticación robusta
- Audit logging
- Encriptación end-to-end

---

## SECCIÓN 6: CRITERIOS DE EVALUACIÓN & ESTRATEGIA

### CRITERIO 1: RENDIMIENTO (25%)
**Qué buscan:** Funcionalidad real, demostración clara, robustez

**Tu estrategia:**
- Demostración en vivo en el video de al menos 2 casos de uso
- Respuestas rápidas (< 2 seg)
- Manejo graceful de errores
- Datos de ejemplo bien curados
- Mostrar velocidad y confiabilidad

### CRITERIO 2: INNOVACIÓN (25%)
**Qué buscan:** Algo nuevo, diferenciador, creativo

**Tu estrategia:**
- ADAPTRACIÓN DINÁMICA: Sistema aprende preferencias del usuario
- EXPLICABILIDAD: Mostrar POR QUÉ se simplificó cada cosa
- PERSONALIZACIÓN: Cada usuario tiene experiencia única
- Highlight: Cómo el sistema evoluciona en el tiempo

### CRITERIO 3: AMPLITUD SERVICIOS AZURE (25%) ⭐ CRÍTICO
**Qué buscan:** Máximo uso creativo de servicios

**Tu estrategia (MÍNIMO 5 servicios):**
- Azure App Service (hosting backend)
- Azure OpenAI (IA principal - OBLIGATORIO)
- Azure Cognitive Services (Text Analytics, Language)
- Azure Cosmos DB (almacenamiento seguro)
- Azure Functions (procesamiento async)
- BONUS: Azure Key Vault, Application Insights, Container Registry

**EN EL VIDEO MENCIONAR CADA SERVICIO Y POR QUÉ SE USA**

### CRITERIO 4: IA RESPONSABLE (25%) ⭐ CRÍTICO
**Qué buscan:** Ética, transparencia, cuidado

**Tu estrategia:**
- LENGUAJE: Demostrar que las respuestas son calmadas, empáticas
- EXPLICABILIDAD: "El sistema dice por qué simplificó esto"
- CONTROL: Usuario puede rechazar simplificaciones
- SEGURIDAD: Datos encriptados, acceso controlado
- SIN SESGOS: Pruebas con diversos usuarios neurodiversos
- VALIDACIÓN: Mostrar que simplificaciones mantienen precisión

**EN LA PRESENTACIÓN DEDICAR SECCIÓN A ESTO**

---

## SECCIÓN 7: ENTREGABLES FINALES

### ARCHIVO 1: DESCRIPCIÓN DEL PROYECTO (100-200 palabras)
"El Cognitive Load Reduction Assistant es un sistema de IA adaptativo que 
simplifica tareas complejas y documentos densos para personas neurodiversas 
(TDAH, autismo, dislexia). 

Mediante descomposición de tareas en pasos claros, simplificación de textos 
con niveles de lectura ajustables, y personalización de preferencias de accesibilidad, 
nuestro sistema reduce significativamente la carga cognitiva.

Utilizamos Azure OpenAI, Cognitive Services, Cosmos DB, App Service y Key Vault 
para crear una solución escalable, segura y empática que explica sus decisiones 
y respeta los datos del usuario."

### ARCHIVO 2: VIDEO DE DEMOSTRACIÓN (3-5 MINUTOS)
Contenido obligatorio:
1. Intro (30 seg): Qué es, para quién, por qué
2. Demo (2 min): Mostrar los 2 casos de uso en vivo
3. Arquitectura (1 min): Dibujar/explicar servicios Azure
4. Learnings (30 seg): Qué aprendimos
5. Closing (30 seg): Conclusión + siguiente

Recomendaciones:
- Grabación de pantalla + webcam en esquina
- Audio claro
- Subtítulos en español e inglés

### ARCHIVO 3: PRESENTACIÓN POWERPOINT
Mínimo 10 slides, máximo 15
- Problema claramente definido
- Solución visual
- Diagrama de arquitectura
- Casos de uso reales
- Responsible AI (sección dedicada)
- Resultados/Métricas
- Learnings
- Siguiente evolución

### ARCHIVO 4: REPOSITORIO GITHUB
```
CLRA-Hackathon/
├── README.md
├── ARCHITECTURE.md
├── RESPONSIBLE_AI.md
├── backend/
│   ├── src/
│   ├── tests/
│   ├── requirements.txt
│   └── README.md
├── frontend/
│   ├── src/
│   ├── tests/
│   ├── package.json
│   └── README.md
├── docs/
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── CONTRIBUTING.md
└── .gitignore
```

Checklist:
- Código limpio y comentado
- Tests unitarios (20+ tests)
- Tests de integración
- README con "quick start"
- .env.example con variables necesarias
- No secrets en el repo
- Commits descriptivos
- Branch main en estado "working"

---

## SECCIÓN 8: PRÓXIMOS PASOS INMEDIATOS

### TAREA 1 (HOY - 2 horas)
- Leer ambos documentos como equipo
- Asignar roles según matriz
- Crear canal de comunicación (Discord/Teams)
- Primer meeting: Alineación general

### TAREA 2 (MAÑANA - 4 horas)
- Crear suscripción Azure (o acceso a la existente)
- Provisionar recursos iniciales
- Crear repositorio GitHub privado
- Setup CI/CD pipeline inicial

### TAREA 3 (ESTA SEMANA - 8-12 horas)
- Script Python/Node que integre Azure OpenAI
- Input: documento → Output: resumen simplificado
- Validar que el concepto funciona
- Esto te da confianza de que es factible

### TAREA 4 (PRÓXIMA SEMANA - 8-12 horas)
- Crear página web simple (React)
- Integrar con backend
- Agregar autenticación básica

---

## REFERENCIAS & DOCUMENTACIÓN

### Documentación Azure
- Azure OpenAI: https://learn.microsoft.com/en-us/azure/cognitive-services/openai/
- Cosmos DB: https://learn.microsoft.com/en-us/azure/cosmos-db/
- Cognitive Services: https://learn.microsoft.com/en-us/azure/cognitive-services/
- App Service: https://learn.microsoft.com/en-us/azure/app-service/
- Key Vault: https://learn.microsoft.com/en-us/azure/key-vault/

### Responsable AI
- Microsoft Responsible AI: https://www.microsoft.com/en-us/ai/responsible-ai
- Azure AI Responsible Use: https://learn.microsoft.com/en-us/training/modules/ai-responsible-use/

### Accesibilidad
- WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/
- WebAIM: https://webaim.org/
- Neurodiversity friendly design: https://www.neurodiversityhub.org/

---

**Documento Preparado Para:** Innovation Challenge - Microsoft
**Versión:** 1.0 | **Fecha:** Marzo 2026
**¡Éxito en el Hackathon! 🚀💚**
