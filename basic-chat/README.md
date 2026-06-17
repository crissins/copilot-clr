# 🚀 Hackathon – Azure AI Foundry Base Chat Agent

Este proyecto provisiona la infraestructura en Azure AI Foundry y crea un agente conversacional base (`base-chat-agent`) con un tono calmado y supportive.

El objetivo es establecer la **capa foundation** sobre la cual se construirán funcionalidades posteriores como RAG, memoria y accesibilidad.

---

# 🧱 Estructura del proyecto

```
.
├─ azure.yaml
├─ README.md
├─ .env.example
├─ .gitignore
│
├─ infra/
│  └─ main.bicep
│
├─ scripts/
│  ├─ deploy-model.sh
│  └─ create_agent.py
│
├─ backend/
│  ├─ requirements.txt
│  └─ app/
```

---

# ⚙️ Requisitos

Asegúrate de tener instalado:

* Python 3.10+
* Azure CLI
* Azure Developer CLI (`azd`)
* Git
* (Opcional) Git Bash o WSL en Windows

Instalar extensión necesaria:

```bash
az extension add -n cognitiveservices
```

Iniciar sesión:

```bash
az login
azd auth login
```

---

# 📦 Instalación de dependencias

```bash
cd backend

python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

pip install -r requirements.txt
```

---

# 🚀 Provisionamiento completo

Este comando ejecuta todo el flujo:

```bash
azd up
```

Durante el proceso:

### 1. Se te solicitará:

* Nombre del entorno (ej: `hackathon-env`)
* Suscripción
* Región (**recomendado: eastus**)
* `foundryAccountName` → **debe ser único globalmente**

Ejemplo:

```
hackathonfoundry12345
```

---

### 2. Automáticamente se ejecuta:

✔ Infraestructura (Bicep)
✔ Creación de Foundry resource
✔ Creación de Foundry project
✔ Deploy del modelo (`gpt-4.1-mini`)
✔ Creación del agente `base-chat-agent`

---

# 🧠 Qué se está creando

## 🏗 Infraestructura

* Azure AI Foundry resource
* Foundry Project

## 🤖 Modelo

* Deployment: `gpt-4.1-mini`

## 🧩 Agente

* Nombre: `base-chat-agent`
* Tipo: Prompt Agent
* Configuración:

  * tono calmado
  * lenguaje claro
  * respuestas paso a paso
  * sin RAG ni herramientas (por ahora)

---

# ✅ Verificación

## Opción 1 – Consola

Debes ver:

```
Agent created successfully.
name=base-chat-agent
```

---

## Opción 2 – Azure Portal

1. Ir a Azure Portal
2. Abrir recurso Foundry
3. Entrar al Project
4. Verificar:

* Agents → `base-chat-agent`
* Models → deployment activo

---

# 🔁 Ejecución manual (debug)

Si algo falla, puedes ejecutar paso a paso:

## 1. Cargar variables del entorno

```bash
azd env get-values
```

---

## 2. Deploy del modelo

```bash
sh scripts/deploy-model.sh
```

---

## 3. Crear el agente

```bash
python scripts/create_agent.py
```

---

# ⚠️ Problemas comunes

## ❌ Error de autenticación

```
DefaultAzureCredential failed
```

Solución:

```bash
az login
```

---

## ❌ Modelo no disponible

Ver modelos disponibles:

```bash
az cognitiveservices account list-models \
  --name <tu-recurso> \
  --resource-group <tu-rg>
```

---

## ❌ Error en Windows (bash)

Usar:

* Git Bash
* o WSL

---

## ❌ El agente no se crea

Verifica:

* El modelo existe
* `MODEL_DEPLOYMENT_NAME` coincide
* `FOUNDRY_PROJECT_ENDPOINT` es correcto

---

# 🧩 Variables de entorno

Ejemplo (`.env.example`):

```env
FOUNDRY_PROJECT_ENDPOINT=
MODEL_DEPLOYMENT_NAME=gpt-4.1-mini
AGENT_NAME=base-chat-agent
```

---

# 🧠 Notas importantes

* Este proyecto usa **Azure AI Foundry Agent Service**
* NO usa Agent Framework como base
* El agente es persistente en Azure
* El system prompt vive en el agente (no en el código)

---

# 🚀 Siguientes pasos

1. Implementar backend (FastAPI)
2. Crear endpoint `/api/chat`
3. Conectar React + Fluent UI
4. Agregar:

   * memoria
   * RAG
   * preferencias de accesibilidad

---

# 🎯 Resultado esperado

Después de ejecutar:

```bash
azd up
```

Debes tener:

* ✅ Foundry resource
* ✅ Foundry project
* ✅ Modelo desplegado
* ✅ Agente `base-chat-agent` funcionando

---

# 💡 Tip para equipo

Sincronizar variables:

```bash
azd env refresh
```

---

# 👨‍💻 Proyecto

Hackathon – Cognitive Load Reduction Assistant
